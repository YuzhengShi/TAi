#!/usr/bin/env node
/**
 * Combines polished transcript text with timestamp headers for LeanRAG ingestion.
 * Reads from transcripts-polished/, outputs to cs6650-materials/transcripts/.
 *
 * Usage: node /opt/scripts/prepare-transcripts-for-leanrag.mjs
 *
 * Input:  /workspace/extra/course-materials/transcripts-polished/{name}.txt
 *         /workspace/extra/course-materials/transcripts-polished/{name}.timestamps.json
 * Output: /workspace/extra/cs6650-materials/transcripts/{name}.txt
 */
import fs from 'fs';
import path from 'path';

const INPUT_DIR = '/workspace/extra/course-materials/transcripts-polished';
const OUTPUT_DIR = '/workspace/extra/cs6650-materials/transcripts';

function formatTime(timeStr) {
  // "00:14:30.000" → "14:30"  or "01:02:30.000" → "1:02:30"
  const parts = timeStr.split(':');
  const h = parseInt(parts[0]);
  const m = parts[1];
  const s = parts[2]?.split('.')[0] || '00';
  if (h > 0) return `${h}:${m}:${s}`;
  return `${parseInt(m)}:${s}`;
}

function filenameToTitle(basename) {
  // "week-3-concurrency-fun--lecture-3-video" → "Week 3 — Concurrency Fun"
  const parts = basename.split('--');
  const weekPart = parts[0];

  // Extract week identifier and title
  const weekMatch = weekPart.match(/^(week-\d+)-(.+)$/);
  if (weekMatch) {
    const weekNum = weekMatch[1].replace('week-', 'Week ');
    const title = weekMatch[2]
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return `${weekNum} — ${title}`;
  }

  // "welcome--class-1-video" → "Welcome — Class 1"
  const welcomeMatch = weekPart.match(/^welcome$/);
  if (welcomeMatch && parts[1]) {
    const title = parts[1]
      .replace(/-video$/, '')
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return `Welcome — ${title}`;
  }

  // Fallback: capitalize the whole basename
  return basename.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ─── Main ───────────────────────────────────────────────────────────────────

if (!fs.existsSync(INPUT_DIR)) {
  console.error(`Input directory not found: ${INPUT_DIR}`);
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const txtFiles = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.txt'));
let processed = 0, failed = 0;

for (const file of txtFiles) {
  const baseName = file.replace('.txt', '');
  const txtPath = path.join(INPUT_DIR, file);
  const tsPath = path.join(INPUT_DIR, `${baseName}.timestamps.json`);
  const outPath = path.join(OUTPUT_DIR, file);

  try {
    const rawText = fs.readFileSync(txtPath, 'utf-8');
    const title = filenameToTitle(baseName);

    if (!fs.existsSync(tsPath)) {
      // No timestamps — just prepend a simple header to the whole file
      const output = `[Lecture: ${title}]\n\n${rawText}`;
      fs.writeFileSync(outPath, output, 'utf-8');
      process.stderr.write(`[done] ${baseName} (no timestamps, single header)\n`);
      processed++;
      continue;
    }

    const timestamps = JSON.parse(fs.readFileSync(tsPath, 'utf-8'));
    const chunks = rawText.split('\n\n');

    // Align chunks with timestamps (they should be 1:1)
    const outputChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i].trim();
      if (!chunk) continue;

      const ts = timestamps[i];
      if (ts) {
        const start = formatTime(ts.start);
        const end = formatTime(ts.end);
        outputChunks.push(`[Lecture: ${title} | ${start}–${end}]\n${chunk}`);
      } else {
        outputChunks.push(`[Lecture: ${title}]\n${chunk}`);
      }
    }

    fs.writeFileSync(outPath, outputChunks.join('\n\n'), 'utf-8');
    process.stderr.write(`[done] ${baseName} (${outputChunks.length} chunks with timestamps)\n`);
    processed++;
  } catch (e) {
    process.stderr.write(`[fail] ${baseName}: ${e.message}\n`);
    failed++;
  }
}

console.log(`\n=== Prepare Summary ===`);
console.log(`Processed: ${processed}`);
console.log(`Failed: ${failed}`);
console.log(`Output: ${OUTPUT_DIR}/`);
