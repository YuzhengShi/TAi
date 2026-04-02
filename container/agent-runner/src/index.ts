/**
 * NanoClaw Agent Runner
 * Runs inside a container, receives config via stdin, outputs result to stdout
 *
 * Input protocol (NDJSON on stdin):
 *   Line 1: {<ContainerInput fields>}\n          — initial input
 *   Line N: {"type":"message","text":"..."}\n    — follow-up messages
 *   <EOF>                                        — close signal
 *
 * Stdout protocol:
 *   Each result is wrapped in OUTPUT_START_MARKER / OUTPUT_END_MARKER pairs.
 *   Multiple results may be emitted (one per agent teams result).
 *   Final marker after loop ends signals completion.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { query, HookCallback, PreCompactHookInput, PreToolUseHookInput } from '@anthropic-ai/claude-agent-sdk';
import { fileURLToPath } from 'url';

interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  secrets?: Record<string, string>;
  canvasUserId?: string;
  githubUsername?: string;
}

interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

interface SessionEntry {
  sessionId: string;
  fullPath: string;
  summary: string;
  firstPrompt: string;
}

interface SessionsIndex {
  entries: SessionEntry[];
}

interface SDKUserMessage {
  type: 'user';
  message: { role: 'user'; content: string };
  parent_tool_use_id: null;
  session_id: string;
}


/**
 * Push-based async iterable for streaming user messages to the SDK.
 * Keeps the iterable alive until end() is called, preventing isSingleUserTurn.
 */
class MessageStream {
  private queue: SDKUserMessage[] = [];
  private waiting: (() => void) | null = null;
  private done = false;

  push(text: string): void {
    this.queue.push({
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
      session_id: '',
    });
    this.waiting?.();
  }

  end(): void {
    this.done = true;
    this.waiting?.();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<SDKUserMessage> {
    while (true) {
      while (this.queue.length > 0) {
        yield this.queue.shift()!;
      }
      if (this.done) return;
      await new Promise<void>(r => { this.waiting = r; });
      this.waiting = null;
    }
  }
}

/**
 * Reads NDJSON lines from stdin, buffers them, supports blocking nextLine()
 * and non-blocking drainBuffered().
 */
class StdinReader {
  private buffer: string[] = [];
  private partial = '';
  private closed = false;
  private waiting: (() => void) | null = null;

  constructor() {
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk: string) => {
      const parts = (this.partial + chunk).split('\n');
      this.partial = parts.pop()!; // last element is incomplete or ''
      for (const line of parts) {
        if (line.length > 0) {
          this.buffer.push(line);
        }
      }
      this.waiting?.();
    });

    process.stdin.on('end', () => {
      // flush any trailing partial line
      if (this.partial.length > 0) {
        this.buffer.push(this.partial);
        this.partial = '';
      }
      this.closed = true;
      this.waiting?.();
    });

    process.stdin.on('error', () => {
      this.closed = true;
      this.waiting?.();
    });
  }

  /** Returns next buffered line or waits; returns null on EOF with empty buffer. */
  async nextLine(): Promise<string | null> {
    while (true) {
      if (this.buffer.length > 0) {
        return this.buffer.shift()!;
      }
      if (this.closed) return null;
      await new Promise<void>(r => { this.waiting = r; });
      this.waiting = null;
    }
  }

  /** Returns all currently buffered lines (non-blocking). */
  drainBuffered(): string[] {
    const lines = this.buffer.splice(0);
    return lines;
  }

  /** True when EOF received and buffer empty. */
  get isClosed(): boolean {
    return this.closed && this.buffer.length === 0;
  }
}

const OUTPUT_START_MARKER = '---NANOCLAW_OUTPUT_START---';
const OUTPUT_END_MARKER = '---NANOCLAW_OUTPUT_END---';

function writeOutput(output: ContainerOutput): void {
  console.log(OUTPUT_START_MARKER);
  console.log(JSON.stringify(output));
  console.log(OUTPUT_END_MARKER);
}

function log(message: string): void {
  console.error(`[agent-runner] ${message}`);
}

function getSessionSummary(sessionId: string, transcriptPath: string): string | null {
  const projectDir = path.dirname(transcriptPath);
  const indexPath = path.join(projectDir, 'sessions-index.json');

  if (!fs.existsSync(indexPath)) {
    log(`Sessions index not found at ${indexPath}`);
    return null;
  }

  try {
    const index: SessionsIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const entry = index.entries.find(e => e.sessionId === sessionId);
    if (entry?.summary) {
      return entry.summary;
    }
  } catch (err) {
    log(`Failed to read sessions index: ${err instanceof Error ? err.message : String(err)}`);
  }

  return null;
}

/**
 * Archive the full transcript to conversations/ before compaction.
 */
function createPreCompactHook(): HookCallback {
  return async (input, _toolUseId, _context) => {
    const preCompact = input as PreCompactHookInput;
    const transcriptPath = preCompact.transcript_path;
    const sessionId = preCompact.session_id;

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      log('No transcript found for archiving');
      return {};
    }

    try {
      const content = fs.readFileSync(transcriptPath, 'utf-8');
      const messages = parseTranscript(content);

      if (messages.length === 0) {
        log('No messages to archive');
        return {};
      }

      const summary = getSessionSummary(sessionId, transcriptPath);
      const name = summary ? sanitizeFilename(summary) : generateFallbackName();

      const conversationsDir = '/workspace/group/conversations';
      fs.mkdirSync(conversationsDir, { recursive: true });

      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const time = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
      const filename = `${date}-${time}-${name}.md`;
      const filePath = path.join(conversationsDir, filename);

      const markdown = formatTranscriptMarkdown(messages, summary);
      fs.writeFileSync(filePath, markdown);

      log(`Archived conversation to ${filePath}`);
    } catch (err) {
      log(`Failed to archive transcript: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {};
  };
}

// Secrets to strip from Bash tool subprocess environments.
// These are needed by claude-code for API auth but should never
// be visible to commands the agent runs.
const SECRET_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'CANVAS_API_TOKEN',
  'GITHUB_TOKEN',
];

// Dangerous commands blocked for non-main containers.
// These patterns are checked against the raw command string.
const BLOCKED_COMMANDS: RegExp[] = [
  // Destructive filesystem operations
  /\brm\s+(-[^\s]*\s+)*-[^\s]*r[^\s]*\s+\//,  // rm -rf / (anything starting from root)
  /\bmkfs\b/,
  /\bdd\b.*\bof\s*=\s*\/dev\//,
  // Outbound network tools (data exfiltration, proxy attacks)
  /\bcurl\b/,
  /\bwget\b/,
  /\bncat?\b/,           // nc / ncat
  /\bsocat\b/,
  /\btelnet\b/,
  /\bpython3?\b.*\b(http\.server|SimpleHTTPServer|requests\.|urllib|socket\b|aiohttp|httpx)/,
  /\bnode\b.*\b(http|https|net|fetch)\b/,
  // Indirect execution (blocklist bypass via encoding or eval)
  /\bbase64\b.*\|\s*(ba)?sh\b/,           // base64 -d | bash
  /\beval\b/,                              // eval "$cmd"
  /\bsource\s+\/dev\/stdin\b/,            // source /dev/stdin (pipe to shell)
  /\b(ba)?sh\s+-c\s.*\$[({]/,             // sh -c "...$(...)" or sh -c "...${...}"
];

function createSanitizeBashHook(isMain: boolean): HookCallback {
  return async (input, _toolUseId, _context) => {
    const preInput = input as PreToolUseHookInput;
    const command = (preInput.tool_input as { command?: string })?.command;
    if (!command) return {};

    // Block attempts to read sensitive files via shell commands
    // Broad match: any command mentioning .env/.db files with common read/copy/edit tools
    if (/\/proc\/[^\s]*environ/i.test(command) ||
        /\.(env|db|sqlite)\b/.test(command) && /(cat|head|tail|less|more|strings|xxd|hexdump|sqlite3|cp|mv|vi|vim|nano|sed|awk|grep|sort|tee|dd|tar|zip|base64)\b/.test(command)) {
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          decision: 'block' as const,
          reason: 'Access to sensitive files (.env, .db, /proc) is blocked.',
        },
      };
    }

    // Non-main containers: block dangerous and network commands
    if (!isMain) {
      for (const pattern of BLOCKED_COMMANDS) {
        if (pattern.test(command)) {
          return {
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              decision: 'block' as const,
              reason: `Command blocked for security: matches restricted pattern. If you need network access, use the provided MCP tools (canvas_query, github_query, youtube_transcript, etc.) instead.`,
            },
          };
        }
      }
    }

    const unsetPrefix = `unset ${SECRET_ENV_VARS.join(' ')} 2>/dev/null; `;
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        updatedInput: {
          ...(preInput.tool_input as Record<string, unknown>),
          command: unsetPrefix + command,
        },
      },
    };
  };
}

// Sensitive file patterns blocked from Read tool (all containers, including main).
// Even admin agents shouldn't read these — prevents prompt injection from leaking secrets.
const SENSITIVE_FILE_PATTERNS: RegExp[] = [
  /^\/proc\/.*\/(environ|cmdline)$/i,     // procfs secrets
  /\/\.env$/,                               // .env files
  /\/\.env\..+$/,                           // .env.local, .env.production, etc.
  /\/nanoclaw\.db$/,                        // SQLite database (all messages, groups, sessions)
  /\/nanoclaw\.db-(wal|shm)$/,             // SQLite WAL/SHM files
];

function createSensitiveFileReadHook(): HookCallback {
  return async (input, _toolUseId, _context) => {
    const preInput = input as PreToolUseHookInput;
    const filePath = (preInput.tool_input as { file_path?: string })?.file_path;
    if (!filePath) return {};

    for (const pattern of SENSITIVE_FILE_PATTERNS) {
      if (pattern.test(filePath)) {
        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            decision: 'block' as const,
            reason: 'This file contains sensitive data and cannot be read directly.',
          },
        };
      }
    }
    return {};
  };
}

/** Guard WebFetch for non-main containers: rate limit + block private/internal URLs. */
function createWebFetchGuardHook(maxCalls: number): HookCallback {
  let callCount = 0;
  // Private/internal IP ranges and localhost — prevents SSRF to internal services
  const PRIVATE_URL_PATTERNS: RegExp[] = [
    /^https?:\/\/localhost\b/i,
    /^https?:\/\/127\./,
    /^https?:\/\/10\./,
    /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
    /^https?:\/\/192\.168\./,
    /^https?:\/\/0\./,
    /^https?:\/\/\[::1\]/,
    /^file:/i,
  ];

  return async (input, _toolUseId, _context) => {
    const preInput = input as PreToolUseHookInput;
    const url = (preInput.tool_input as { url?: string })?.url || '';

    // Rate limit
    callCount++;
    if (callCount > maxCalls) {
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          decision: 'block' as const,
          reason: `WebFetch rate limit exceeded: max ${maxCalls} calls per session.`,
        },
      };
    }

    // Block private/internal URLs
    for (const pattern of PRIVATE_URL_PATTERNS) {
      if (pattern.test(url)) {
        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            decision: 'block' as const,
            reason: 'Cannot fetch internal/private URLs. Only public web pages are accessible.',
          },
        };
      }
    }

    return {};
  };
}

/** Block writes larger than maxBytes (non-main only). */
function createFileSizeGuardHook(maxBytes: number): HookCallback {
  return async (input, _toolUseId, _context) => {
    const preInput = input as PreToolUseHookInput;
    const toolInput = preInput.tool_input as Record<string, unknown>;
    const content = (toolInput.content as string) || (toolInput.new_string as string) || '';
    if (content.length > maxBytes) {
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          decision: 'block' as const,
          reason: `File content too large (${(content.length / 1024 / 1024).toFixed(1)}MB). Maximum allowed: ${(maxBytes / 1024 / 1024).toFixed(0)}MB.`,
        },
      };
    }
    return {};
  };
}

/** Block writes if workspace directory exceeds maxMB total (non-main only). */
function createWorkspaceSizeGuardHook(maxMB: number): HookCallback {
  return async (_input, _toolUseId, _context) => {
    try {
      const output = execSync('du -sm /workspace/group', { timeout: 3000, encoding: 'utf-8' });
      const sizeMB = parseInt(output.trim().split(/\s+/)[0], 10);
      if (sizeMB >= maxMB) {
        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            decision: 'block' as const,
            reason: `Workspace is full (${sizeMB}MB / ${maxMB}MB limit). Remove unnecessary files before writing new ones.`,
          },
        };
      }
    } catch {
      // If du fails or times out, allow the write (defense in depth: tmpfs + file size limits still apply)
    }
    return {};
  };
}

/**
 * Hook to prevent suspicious bulk modifications to COMPETENCY.md.
 * Normal teaching updates 1-2 concepts at a time with small increments.
 * A student tricking the agent into setting all confidences to 1.0 is detectable.
 */
function createCompetencyGuardHook(isMain: boolean): HookCallback {
  return async (input, _toolUseId, _context) => {
    if (isMain) return {}; // Admin can do anything

    const preInput = input as PreToolUseHookInput;
    const toolInput = preInput.tool_input as Record<string, unknown>;

    // Check Edit tool: old_string + new_string
    // Check Write tool: content (full file rewrite)
    const filePath = (toolInput.file_path as string) || '';
    if (!filePath.endsWith('COMPETENCY.md')) return {};

    // For Write (full rewrite), check the content
    const content = (toolInput.content as string) || '';
    // For Edit, check the new_string
    const newString = (toolInput.new_string as string) || '';
    const textToCheck = content || newString;
    if (!textToCheck) return {};

    // Count high-confidence values being set (>= 0.8)
    const confidenceMatches = textToCheck.match(/confidence:\s*([\d.]+)/g) || [];
    let highConfCount = 0;
    for (const match of confidenceMatches) {
      const val = parseFloat(match.replace('confidence:', '').trim());
      if (val >= 0.8) highConfCount++;
    }

    // Block if 3+ concepts are being set to high confidence in one operation
    if (highConfCount >= 3) {
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          decision: 'block' as const,
          reason: `Blocked: setting ${highConfCount} concepts to confidence >= 0.8 in a single edit is not allowed. Mastery scores must be updated incrementally based on demonstrated understanding, not in bulk. Update concepts one at a time after each interaction.`,
        },
      };
    }

    return {};
  };
}

function sanitizeFilename(summary: string): string {
  return summary
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function generateFallbackName(): string {
  const time = new Date();
  return `conversation-${time.getHours().toString().padStart(2, '0')}${time.getMinutes().toString().padStart(2, '0')}`;
}

interface ParsedMessage {
  role: 'user' | 'assistant';
  content: string;
}

function parseTranscript(content: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'user' && entry.message?.content) {
        const text = typeof entry.message.content === 'string'
          ? entry.message.content
          : entry.message.content.map((c: { text?: string }) => c.text || '').join('');
        if (text) messages.push({ role: 'user', content: text });
      } else if (entry.type === 'assistant' && entry.message?.content) {
        const textParts = entry.message.content
          .filter((c: { type: string }) => c.type === 'text')
          .map((c: { text: string }) => c.text);
        const text = textParts.join('');
        if (text) messages.push({ role: 'assistant', content: text });
      }
    } catch {
    }
  }

  return messages;
}

function stripInternalTags(text: string): string {
  return text
    .replace(/<internal>[\s\S]*?<\/internal>/g, '')  // closed tags
    .replace(/<internal>[\s\S]*$/g, '')               // unclosed tag → strip to end
    .trim();
}

function formatTranscriptMarkdown(messages: ParsedMessage[], title?: string | null): string {
  const now = new Date();
  const formatDateTime = (d: Date) => d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const lines: string[] = [];
  lines.push(`# ${title || 'Conversation'}`);
  lines.push('');
  lines.push(`Archived: ${formatDateTime(now)}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of messages) {
    const sender = msg.role === 'user' ? 'User' : 'TAi';
    // Strip <internal> reasoning blocks from archived assistant messages
    const cleaned = msg.role === 'assistant' ? stripInternalTags(msg.content) : msg.content;
    if (!cleaned) continue;
    const content = cleaned.length > 2000
      ? cleaned.slice(0, 2000) + '...'
      : cleaned;
    lines.push(`**${sender}**: ${content}`);
    lines.push('');
  }

  return lines.join('\n');
}


/**
 * Run a single query and stream results via writeOutput.
 * Uses MessageStream (AsyncIterable) to keep isSingleUserTurn=false,
 * allowing agent teams subagents to run to completion.
 * Polls stdinReader's in-memory buffer for follow-up messages during the query.
 */
function buildMcpServers(
  mcpServerPath: string,
  containerInput: ContainerInput,
  sdkEnv: Record<string, string | undefined>,
) {
  // AWS credentials for MCP tools that call boto3 scripts (tts.py, image_gen.py)
  const awsEnv = Object.fromEntries(
    ['AWS_REGION', 'AWS_DEFAULT_REGION', 'AWS_ACCESS_KEY_ID',
     'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN']
      .filter(k => sdkEnv[k])
      .map(k => [k, sdkEnv[k]!])
  );

  const servers: Record<string, { command: string; args: string[]; env: Record<string, string> }> = {
    nanoclaw: {
      command: 'node',
      args: [mcpServerPath],
      env: {
        NANOCLAW_CHAT_JID: containerInput.chatJid,
        NANOCLAW_GROUP_FOLDER: containerInput.groupFolder,
        NANOCLAW_IS_MAIN: containerInput.isMain ? '1' : '0',
        NANOCLAW_IS_SCHEDULED_TASK: containerInput.isScheduledTask ? '1' : '0',
        // Identity binding (from trusted DB — containers cannot modify)
        ...(containerInput.canvasUserId ? { NANOCLAW_CANVAS_USER_ID: containerInput.canvasUserId } : {}),
        ...(containerInput.githubUsername ? { NANOCLAW_GITHUB_USERNAME: containerInput.githubUsername } : {}),
        ...awsEnv,
        // Canvas LMS + GitHub integration credentials
        ...(sdkEnv['CANVAS_API_TOKEN'] ? { CANVAS_API_TOKEN: sdkEnv['CANVAS_API_TOKEN'] } : {}),
        ...(sdkEnv['CANVAS_BASE_URL'] ? { CANVAS_BASE_URL: sdkEnv['CANVAS_BASE_URL'] } : {}),
        ...(sdkEnv['CANVAS_COURSE_ID'] ? { CANVAS_COURSE_ID: sdkEnv['CANVAS_COURSE_ID'] } : {}),
        ...(sdkEnv['GITHUB_TOKEN'] ? { GITHUB_TOKEN: sdkEnv['GITHUB_TOKEN'] } : {}),
        ...(sdkEnv['GITHUB_TOKEN_PUBLIC'] ? { GITHUB_TOKEN_PUBLIC: sdkEnv['GITHUB_TOKEN_PUBLIC'] } : {}),
        ...(sdkEnv['GITHUB_BASE_URL'] ? { GITHUB_BASE_URL: sdkEnv['GITHUB_BASE_URL'] } : {}),
        ...(sdkEnv['GITHUB_ALLOWED_ORGS'] ? { GITHUB_ALLOWED_ORGS: sdkEnv['GITHUB_ALLOWED_ORGS'] } : {}),
        ...(sdkEnv['YOUTUBE_API_KEY'] ? { YOUTUBE_API_KEY: sdkEnv['YOUTUBE_API_KEY'] } : {}),
        ...(sdkEnv['VOICE_INTERVIEW_SECRET'] ? { VOICE_INTERVIEW_SECRET: sdkEnv['VOICE_INTERVIEW_SECRET'] } : {}),
        ...(sdkEnv['VOICE_BASE_URL'] ? { VOICE_BASE_URL: sdkEnv['VOICE_BASE_URL'] } : {}),
        ...(sdkEnv['VOICE_PORT'] ? { VOICE_PORT: sdkEnv['VOICE_PORT'] } : {}),
      },
    },
  };

  // LeanRAG is at /workspace/leanrag for non-main groups (dedicated mount)
  // or /workspace/project/leanrag for main (project root mount).
  const leanragPaths = ['/workspace/leanrag', '/workspace/project/leanrag'];
  const leanragRoot = leanragPaths.find(p => fs.existsSync(`${p}/graph.pkl`));
  if (leanragRoot) {
    log(`LeanRAG registered: ${leanragRoot}/graph.pkl`);
    servers.leanrag = {
      command: '/opt/leanrag/bin/python3',
      args: ['-m', 'leanrag.mcp_server'],
      env: {
        PYTHONPATH: path.dirname(leanragRoot),
        ...awsEnv,
      },
    };
  } else {
    log(`LeanRAG NOT found (checked: ${leanragPaths.join(', ')})`);
  }

  return servers;
}

async function runQuery(
  prompt: string,
  sessionId: string | undefined,
  mcpServerPath: string,
  containerInput: ContainerInput,
  sdkEnv: Record<string, string | undefined>,
  stdinReader: StdinReader,
  resumeAt?: string,
): Promise<{ newSessionId?: string; lastAssistantUuid?: string; closedDuringQuery: boolean; had500Error: boolean; messageCount: number }> {
  const stream = new MessageStream();
  stream.push(prompt);

  // Poll stdin buffer for follow-up messages and EOF during the query
  let stdinPumping = true;
  let closedDuringQuery = false;
  const pollStdinDuringQuery = () => {
    if (!stdinPumping) return;
    if (stdinReader.isClosed) {
      log('EOF detected during query, ending stream');
      closedDuringQuery = true;
      stream.end();
      stdinPumping = false;
      return;
    }
    for (const line of stdinReader.drainBuffered()) {
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'message' && msg.text) {
          log(`Piping stdin message into active query (${msg.text.length} chars)`);
          stream.push(msg.text);
        }
      } catch (err) {
        log(`Failed to parse stdin line: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    setTimeout(pollStdinDuringQuery, 100);
  };
  setTimeout(pollStdinDuringQuery, 100);

  let newSessionId: string | undefined;
  let lastAssistantUuid: string | undefined;
  let messageCount = 0;
  let resultCount = 0;
  let had500Error = false;

  // Load global CLAUDE.md as additional system context (shared across all groups).
  // Main also loads it so admin can test the teaching persona in the same DM.
  const globalClaudeMdPath = containerInput.isMain
    ? '/workspace/project/groups/global/CLAUDE.md'
    : '/workspace/global/CLAUDE.md';
  let globalClaudeMd: string | undefined;
  if (fs.existsSync(globalClaudeMdPath)) {
    globalClaudeMd = fs.readFileSync(globalClaudeMdPath, 'utf-8');
  }

  // Discover additional directories mounted at /workspace/extra/*
  // These are passed to the SDK so their CLAUDE.md files are loaded automatically
  const extraDirs: string[] = [];
  const extraBase = '/workspace/extra';
  if (fs.existsSync(extraBase)) {
    for (const entry of fs.readdirSync(extraBase)) {
      const fullPath = path.join(extraBase, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        extraDirs.push(fullPath);
      }
    }
  }
  if (extraDirs.length > 0) {
    log(`Additional directories: ${extraDirs.join(', ')}`);
  }

  // Inject current date+time so the agent can answer time questions accurately
  // Explicitly pass timeZone so it works reliably inside Docker containers
  const tz = process.env.TZ || 'UTC';
  const now = new Date();
  const dateTimeHeader = `Current date and time: ${now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz,
  })} at ${now.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz, timeZoneName: 'short',
  })}.\n\n`;
  const memCtxPath = '/workspace/group/memory_context.md';
  const memoryContext = fs.existsSync(memCtxPath)
    ? '\n\n' + fs.readFileSync(memCtxPath, 'utf-8') + '\n\n'
    : '';
  const systemAppend = dateTimeHeader + memoryContext + (globalClaudeMd || '');

  for await (const message of query({
    prompt: stream,
    options: {
      cwd: '/workspace/group',
      additionalDirectories: extraDirs.length > 0 ? extraDirs : undefined,
      resume: sessionId,
      resumeSessionAt: resumeAt,
      systemPrompt: { type: 'preset' as const, preset: 'claude_code' as const, append: systemAppend },
      allowedTools: [
        'Bash',
        'Read', 'Write', 'Edit', 'Glob', 'Grep',
        'WebSearch',
        'WebFetch',
        'Task', 'TaskOutput', 'TaskStop',
        ...(containerInput.isMain ? ['TeamCreate', 'TeamDelete'] : []), // Subagents: main only (hook bypass)
        'SendMessage',
        'TodoWrite', 'ToolSearch', 'Skill',
        'NotebookEdit',
        'mcp__nanoclaw__*',
        'mcp__leanrag__*'
      ],
      env: sdkEnv,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      settingSources: ['project', 'user'],
      mcpServers: buildMcpServers(mcpServerPath, containerInput, sdkEnv),
      hooks: {
        PreCompact: [{ hooks: [createPreCompactHook()] }],
        PreToolUse: [
          { matcher: 'Bash', hooks: [createSanitizeBashHook(containerInput.isMain)] },
          { matcher: 'Read', hooks: [createSensitiveFileReadHook()] },
          { matcher: 'Edit', hooks: [createCompetencyGuardHook(containerInput.isMain)] },
          { matcher: 'Write', hooks: [createCompetencyGuardHook(containerInput.isMain)] },
          // Non-main: guard WebFetch (rate limit + block private/internal URLs)
          ...(!containerInput.isMain ? [{ matcher: 'WebFetch', hooks: [createWebFetchGuardHook(15)] }] : []),
          // Non-main: limit file write size to 5MB
          ...(!containerInput.isMain ? [
            { matcher: 'Write', hooks: [createFileSizeGuardHook(5 * 1024 * 1024)] },
            { matcher: 'Edit', hooks: [createFileSizeGuardHook(5 * 1024 * 1024)] },
          ] : []),
          // Non-main: block writes if workspace exceeds 500MB total
          ...(!containerInput.isMain ? [
            { matcher: 'Write', hooks: [createWorkspaceSizeGuardHook(500)] },
            { matcher: 'Edit', hooks: [createWorkspaceSizeGuardHook(500)] },
          ] : []),
        ],
      },
    }
  })) {
    messageCount++;
    const msgType = message.type === 'system' ? `system/${(message as { subtype?: string }).subtype}` : message.type;
    log(`[msg #${messageCount}] type=${msgType}`);

    if (message.type === 'assistant' && 'uuid' in message) {
      lastAssistantUuid = (message as { uuid: string }).uuid;
    }

    if (message.type === 'system' && message.subtype === 'init') {
      newSessionId = message.session_id;
      log(`Session initialized: ${newSessionId}`);
    }

    if (message.type === 'system' && (message as { subtype?: string }).subtype === 'task_notification') {
      const tn = message as { task_id: string; status: string; summary: string };
      log(`Task notification: task=${tn.task_id} status=${tn.status} summary=${tn.summary}`);
    }

    if (message.type === 'result') {
      resultCount++;
      let textResult = 'result' in message ? (message as { result?: string }).result : null;
      // Detect Bedrock 500 errors (context overflow) — abort the query immediately
      // and signal caller to reset session. User gets a friendly retry message instead.
      if (textResult && /^API Error:\s*500\b/.test(textResult)) {
        log(`Result #${resultCount}: Bedrock 500 error detected, aborting query`);
        had500Error = true;
        stream.end();
        break;
      }
      // Strip hallucinated Human turns — the model sometimes echoes the
      // XML message input format as part of its output, especially after
      // tool use when follow-up messages are piped mid-session.
      if (textResult && /Human:\s*<messages>/.test(textResult)) {
        log(`Result #${resultCount}: stripping hallucinated Human turn from output`);
        textResult = textResult.replace(/Human:\s*<messages>[\s\S]*/g, '').trim() || null;
      }
      log(`Result #${resultCount}: subtype=${message.subtype}${textResult ? ` text=${textResult.slice(0, 200)}` : ''}`);
      writeOutput({
        status: 'success',
        result: textResult || null,
        newSessionId
      });
    }
  }

  stdinPumping = false;
  log(`Query done. Messages: ${messageCount}, results: ${resultCount}, lastAssistantUuid: ${lastAssistantUuid || 'none'}, closedDuringQuery: ${closedDuringQuery}`);
  return { newSessionId, lastAssistantUuid, closedDuringQuery, had500Error, messageCount };
}

async function main(): Promise<void> {
  const stdinReader = new StdinReader();
  let containerInput: ContainerInput;

  try {
    const firstLine = await stdinReader.nextLine();
    if (firstLine === null) {
      writeOutput({ status: 'error', result: null, error: 'Empty stdin (no input received)' });
      process.exit(1);
    }
    containerInput = JSON.parse(firstLine);
    log(`Received input for group: ${containerInput.groupFolder}`);
  } catch (err) {
    writeOutput({
      status: 'error',
      result: null,
      error: `Failed to parse input: ${err instanceof Error ? err.message : String(err)}`
    });
    process.exit(1);
  }

  // Build SDK env: merge secrets into process.env for the SDK only.
  // Secrets never touch process.env itself, so Bash subprocesses can't see them.
  const sdkEnv: Record<string, string | undefined> = { ...process.env };
  for (const [key, value] of Object.entries(containerInput.secrets || {})) {
    sdkEnv[key] = value;
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mcpServerPath = path.join(__dirname, 'ipc-mcp-stdio.js');

  let sessionId = containerInput.sessionId;

  // Build initial prompt (drain any buffered stdin lines too)
  let prompt = containerInput.prompt;
  if (containerInput.isScheduledTask) {
    prompt = `[SCHEDULED TASK - The following message was sent automatically and is not coming directly from the user or group.]\n\n${prompt}`;
  }
  const pending = stdinReader.drainBuffered();
  if (pending.length > 0) {
    log(`Draining ${pending.length} buffered stdin messages into initial prompt`);
    const texts: string[] = [];
    for (const line of pending) {
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'message' && msg.text) texts.push(msg.text);
      } catch { /* skip malformed lines */ }
    }
    if (texts.length > 0) {
      prompt += '\n' + texts.join('\n');
    }
  }

  // Query loop: run query → wait for stdin message → run new query → repeat
  let resumeAt: string | undefined;
  let queriesOnSession = 0;
  const MAX_QUERIES_PER_SESSION = 10;

  while (true) {
    // Proactive session cap — force fresh session after N query iterations
    // to prevent unbounded context growth that leads to Bedrock 500 errors.
    queriesOnSession++;
    if (queriesOnSession > MAX_QUERIES_PER_SESSION && sessionId) {
      log(`Session query cap reached (${queriesOnSession - 1} queries), starting fresh session`);
      sessionId = undefined;
      resumeAt = undefined;
      queriesOnSession = 1;
    }

    log(`Starting query (session: ${sessionId || 'new'}, resumeAt: ${resumeAt || 'latest'}, queryNum: ${queriesOnSession})...`);

    let queryResult: Awaited<ReturnType<typeof runQuery>> | null = null;
    try {
      queryResult = await runQuery(prompt, sessionId, mcpServerPath, containerInput, sdkEnv, stdinReader, resumeAt);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // If stdin is already closed (host shutting down), exit gracefully
      if (stdinReader.isClosed) {
        log(`Query crashed during shutdown, exiting: ${errorMessage}`);
        break;
      }

      // Crash with active session — likely context overflow. Reset and continue.
      if (sessionId) {
        log(`Query crashed with active session, resetting: ${errorMessage}`);
        writeOutput({
          status: 'success',
          result: "sorry, my memory got too full — I've cleared my context and I'm ready to go. could you send that last message again?",
          newSessionId: sessionId,
        });
        sessionId = undefined;
        resumeAt = undefined;
        queriesOnSession = 0;
        // Fall through to wait for next stdin message
      } else {
        // Fresh session crashed — real error, bail out
        log(`Agent error: ${errorMessage}`);
        writeOutput({ status: 'error', result: null, newSessionId: sessionId, error: errorMessage });
        process.exit(1);
      }
    }

    if (queryResult) {
      if (queryResult.newSessionId) {
        sessionId = queryResult.newSessionId;
      }
      if (queryResult.lastAssistantUuid) {
        resumeAt = queryResult.lastAssistantUuid;
      }

      // Bedrock 500 detected in results — reset session and notify user
      if (queryResult.had500Error) {
        log('Bedrock 500 errors detected in results, resetting session');
        writeOutput({
          status: 'success',
          result: "sorry, my memory got too full — I've cleared my context and I'm ready to go. could you send that last message again?",
          newSessionId: sessionId,
        });
        sessionId = undefined;
        resumeAt = undefined;
        queriesOnSession = 0;
      }

      // If EOF was detected during the query, exit immediately.
      // Don't emit a session-update marker (it would reset the host's
      // idle timer and cause a 30-min delay before the next close).
      if (queryResult.closedDuringQuery) {
        log('EOF consumed during query, exiting');
        break;
      }

      // Emit session update so host can track it
      writeOutput({ status: 'success', result: null, newSessionId: sessionId });
    }

    log('Query ended, waiting for next stdin message...');

    // Wait for the next message or EOF
    const nextLine = await stdinReader.nextLine();
    if (nextLine === null) {
      log('EOF received, exiting');
      break;
    }

    try {
      const msg = JSON.parse(nextLine);
      if (msg.type === 'message' && msg.text) {
        log(`Got new message (${msg.text.length} chars), starting new query`);
        prompt = msg.text;
      } else {
        log(`Unknown stdin message type: ${msg.type}, skipping`);
        continue;
      }
    } catch (err) {
      log(`Failed to parse stdin line: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
  }
}

main();
