/**
 * LeanRAG Sync — polls Canvas for new lecture/assignment/paper files,
 * downloads them to cs6650-materials/, and triggers an incremental
 * `python -m leanrag.build_graph` rebuild.
 *
 * Runs host-side on a 6-hour interval. Never goes through Docker containers.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { readEnvFile } from './env.js';
import { logger } from './logger.js';

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const INITIAL_DELAY_MS = 30_000;              // wait for app to settle at startup

const MANIFEST_PATH = path.resolve(process.cwd(), 'leanrag', 'canvas-manifest.json');
const MATERIALS_DIR = path.resolve(process.cwd(), 'cs6650-materials');

// Use python3 on Linux/Mac, python on Windows
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';


// ── Types ──────────────────────────────────────────────────────────────

interface CanvasFile {
  id: number;
  display_name: string;
  url: string;
  updated_at: string;
  'content-type': string;
  folder_id: number;
}

interface CanvasFolder {
  id: number;
  full_name: string;
}

interface ManifestEntry {
  display_name: string;
  updated_at: string;
  local_path: string;
}

interface Manifest {
  files: Record<string, ManifestEntry>;
  last_check: string;
}


// ── Manifest helpers ───────────────────────────────────────────────────

function loadManifest(): Manifest {
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')) as Manifest;
    }
  } catch { /* ignore */ }
  return { files: {}, last_check: new Date(0).toISOString() };
}

function saveManifest(manifest: Manifest): void {
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
}


// ── Canvas API helpers ─────────────────────────────────────────────────

async function canvasFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Canvas API ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

/** Map Canvas folder path to local cs6650-materials/ subdirectory. */
function folderToSubdir(folder: CanvasFolder | undefined): string {
  if (!folder) return 'lectures';
  const name = folder.full_name.toLowerCase();
  if (name.includes('assignment') || name.includes('homework')) return 'assignments';
  if (name.includes('paper') || name.includes('reading')) return 'papers';
  return 'lectures';
}

/** Fetch all pages of a Canvas API list endpoint. */
async function fetchAll<T>(baseUrl: string, token: string): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  while (true) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const batch = await canvasFetch<T[]>(`${baseUrl}${sep}per_page=100&page=${page}`, token);
    results.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return results;
}


// ── Build trigger ──────────────────────────────────────────────────────

function runBuild(): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info('LeanRAG sync: starting incremental graph rebuild');
    const proc = spawn(PYTHON, ['-m', 'leanrag.build_graph'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const forward = (d: Buffer) => {
      for (const line of d.toString().trim().split('\n')) {
        if (line) logger.info(`[leanrag] ${line}`);
      }
    };
    proc.stdout.on('data', forward);
    proc.stderr.on('data', forward);

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info('LeanRAG sync: rebuild completed');
        resolve();
      } else {
        reject(new Error(`leanrag.build_graph exited ${code}`));
      }
    });
    proc.on('error', reject);
  });
}


// ── Main sync ──────────────────────────────────────────────────────────

async function sync(): Promise<void> {
  const env = readEnvFile(['CANVAS_API_TOKEN', 'CANVAS_BASE_URL', 'CANVAS_COURSE_ID']);
  const token = env.CANVAS_API_TOKEN;
  const baseUrl = env.CANVAS_BASE_URL;
  const courseId = env.CANVAS_COURSE_ID;

  if (!token || !baseUrl || !courseId) {
    logger.debug('LeanRAG sync: Canvas not configured, skipping');
    return;
  }

  logger.info('LeanRAG sync: checking Canvas for new files');

  const manifest = loadManifest();

  // Fetch folder list for subdirectory mapping
  const folders = await fetchAll<CanvasFolder>(
    `${baseUrl}/courses/${courseId}/folders`, token,
  );
  const folderMap = new Map(folders.map((f) => [f.id, f]));

  // Fetch all course files, filter to document types
  const allFiles = await fetchAll<CanvasFile>(
    `${baseUrl}/courses/${courseId}/files?sort=updated_at&order=desc`, token,
  );
  const SUPPORTED = new Set(['application/pdf', 'text/markdown', 'text/plain']);
  const files = allFiles.filter((f) => SUPPORTED.has(f['content-type']));

  // Identify new or updated files
  const toDownload: Array<{ file: CanvasFile; subdir: string }> = [];
  for (const file of files) {
    const key = String(file.id);
    const existing = manifest.files[key];
    if (!existing || existing.updated_at !== file.updated_at) {
      const folder = folderMap.get(file.folder_id);
      toDownload.push({ file, subdir: folderToSubdir(folder) });
    }
  }

  manifest.last_check = new Date().toISOString();

  if (toDownload.length === 0) {
    logger.info('LeanRAG sync: no new files');
    saveManifest(manifest);
    return;
  }

  logger.info({ count: toDownload.length }, 'LeanRAG sync: downloading new files');

  let downloaded = 0;
  for (const { file, subdir } of toDownload) {
    const localRelPath = path.join(subdir, file.display_name);
    const destPath = path.join(MATERIALS_DIR, localRelPath);
    try {
      const res = await fetch(file.url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, buf);

      manifest.files[String(file.id)] = {
        display_name: file.display_name,
        updated_at: file.updated_at,
        local_path: localRelPath,
      };
      downloaded++;
      logger.info({ file: file.display_name, subdir }, 'LeanRAG sync: downloaded');
    } catch (err) {
      logger.error({ err, file: file.display_name }, 'LeanRAG sync: download failed');
    }
  }

  saveManifest(manifest);

  if (downloaded === 0) {
    logger.warn('LeanRAG sync: all downloads failed, skipping rebuild');
    return;
  }

  // Trigger incremental rebuild
  try {
    await runBuild();
  } catch (err) {
    logger.error({ err }, 'LeanRAG sync: rebuild failed');
  }
}


// ── Public API ─────────────────────────────────────────────────────────

let syncRunning = false;

export function startLeanRAGSync(): void {
  const run = async () => {
    if (syncRunning) {
      logger.debug('LeanRAG sync already running, skipping');
      return;
    }
    syncRunning = true;
    try {
      await sync();
    } catch (err) {
      logger.error({ err }, 'LeanRAG sync error');
    } finally {
      syncRunning = false;
    }
  };

  // Initial run after app settles, then every 6 hours
  setTimeout(run, INITIAL_DELAY_MS);
  setInterval(run, SYNC_INTERVAL_MS);

  logger.info('LeanRAG sync started (6h interval, first check in 30s)');
}
