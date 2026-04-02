/**
 * Stdio MCP Server for NanoClaw
 * Standalone process that agent teams subagents can inherit.
 * Reads context from environment variables, writes IPC files for the host.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { CronExpressionParser } from 'cron-parser';

const IPC_DIR = '/workspace/ipc';
const MESSAGES_DIR = path.join(IPC_DIR, 'messages');
const TASKS_DIR = path.join(IPC_DIR, 'tasks');

// Context from environment variables (set by the agent runner)
const chatJid = process.env.NANOCLAW_CHAT_JID!;
const groupFolder = process.env.NANOCLAW_GROUP_FOLDER!;
const isMain = process.env.NANOCLAW_IS_MAIN === '1';
const isScheduledTask = process.env.NANOCLAW_IS_SCHEDULED_TASK === '1';

// Identity binding (from trusted DB via env — containers cannot modify these)
const boundCanvasUserId = process.env.NANOCLAW_CANVAS_USER_ID || '';
const boundGithubUsername = process.env.NANOCLAW_GITHUB_USERNAME || '';

// Debug: verify GitHub tokens reached the MCP server process
console.error(`[mcp-stdio] GITHUB_TOKEN: ${process.env.GITHUB_TOKEN ? 'set' : 'MISSING'}, GITHUB_TOKEN_PUBLIC: ${process.env.GITHUB_TOKEN_PUBLIC ? 'set' : 'MISSING'}, GITHUB_BASE_URL: ${process.env.GITHUB_BASE_URL || '(default)'}`);
const githubAllowedOrgs = (process.env.GITHUB_ALLOWED_ORGS || '').split(',').map(s => s.trim()).filter(Boolean);

// Full access = admin (main) OR system-initiated tasks (bootstrap, patrol)
const hasFullAccess = isMain || isScheduledTask;

// Per-session rate limits for expensive tools (resets each container lifecycle)
const RATE_LIMITS: Record<string, number> = {
  canvas_query: 30,
  github_query: 30,
  generate_teaching_image: 5,
  send_voice_message: 10,
  render_diagram: 10,
  start_mock_interview: 3,
};
const callCounts: Record<string, number> = {};

function checkRateLimit(tool: string): string | null {
  if (hasFullAccess) return null;  // admin bypasses all rate limits
  const limit = RATE_LIMITS[tool];
  if (!limit) return null;
  callCounts[tool] = (callCounts[tool] || 0) + 1;
  if (callCounts[tool] > limit) {
    return `Rate limit exceeded for ${tool}: max ${limit} calls per session.`;
  }
  return null;
}

function writeIpcFile(dir: string, data: object): string {
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  const filepath = path.join(dir, filename);

  // Atomic write: temp file then rename
  const tempPath = `${filepath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filepath);

  return filename;
}

const server = new McpServer({
  name: 'nanoclaw',
  version: '1.0.0',
});

server.tool(
  'send_message',
  "Send a message to the user or group immediately while you're still running. Use this ONLY for progress updates during long operations or when you need to send multiple separate messages. Do NOT use this for your normal response — your text output is ALREADY forwarded to the user automatically. If you use send_message, your text output will be suppressed to avoid duplicates.",
  {
    text: z.string().describe('The message text to send'),
    sender: z.string().optional().describe('Your role/identity name (e.g. "Researcher"). When set, messages appear from a dedicated bot in Telegram.'),
  },
  async (args) => {
    const data: Record<string, string | undefined> = {
      type: 'message',
      chatJid,
      text: args.text,
      sender: args.sender || undefined,
      groupFolder,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(MESSAGES_DIR, data);

    // Signal host that send_message was used — host will suppress text output
    // to prevent the student from receiving duplicate messages.
    fs.writeFileSync(path.join(MESSAGES_DIR, '.send_message_used'), '');

    return { content: [{ type: 'text' as const, text: 'Message sent. Your text output will be suppressed to avoid sending a duplicate — wrap your remaining output in <internal> tags.' }] };
  },
);

server.tool(
  'schedule_task',
  `Schedule a recurring or one-time task. The task will run as a full agent with access to all tools.

CONTEXT MODE - Choose based on task type:
\u2022 "group": Task runs in the group's conversation context, with access to chat history. Use for tasks that need context about ongoing discussions, user preferences, or recent interactions.
\u2022 "isolated": Task runs in a fresh session with no conversation history. Use for independent tasks that don't need prior context. When using isolated mode, include all necessary context in the prompt itself.

If unsure which mode to use, you can ask the user. Examples:
- "Remind me about our discussion" \u2192 group (needs conversation context)
- "Check the weather every morning" \u2192 isolated (self-contained task)
- "Follow up on my request" \u2192 group (needs to know what was requested)
- "Generate a daily report" \u2192 isolated (just needs instructions in prompt)

MESSAGING BEHAVIOR - The task agent's output is sent to the user or group. It can also use send_message for immediate delivery, or wrap output in <internal> tags to suppress it. Include guidance in the prompt about whether the agent should:
\u2022 Always send a message (e.g., reminders, daily briefings)
\u2022 Only send a message when there's something to report (e.g., "notify me if...")
\u2022 Never send a message (background maintenance tasks)

SCHEDULE VALUE FORMAT (all times are LOCAL timezone):
\u2022 cron: Standard cron expression (e.g., "*/5 * * * *" for every 5 minutes, "0 9 * * *" for daily at 9am LOCAL time)
\u2022 interval: Milliseconds between runs (e.g., "300000" for 5 minutes, "3600000" for 1 hour)
\u2022 once: Local time WITHOUT "Z" suffix (e.g., "2026-02-01T15:30:00"). Do NOT use UTC/Z suffix.`,
  {
    prompt: z.string().describe('What the agent should do when the task runs. For isolated mode, include all necessary context here.'),
    schedule_type: z.enum(['cron', 'interval', 'once']).describe('cron=recurring at specific times, interval=recurring every N ms, once=run once at specific time'),
    schedule_value: z.string().describe('cron: "*/5 * * * *" | interval: milliseconds like "300000" | once: local timestamp like "2026-02-01T15:30:00" (no Z suffix!)'),
    context_mode: z.enum(['group', 'isolated']).default('group').describe('group=runs with chat history and memory, isolated=fresh session (include context in prompt)'),
    target_group_jid: z.string().optional().describe('(Main group only) JID of the group to schedule the task for. Defaults to the current group.'),
    confirmed: z.boolean().default(false).describe('For recurring tasks (cron/interval): set to true ONLY after the user explicitly confirms. First call with false to preview, then call with true after user approval.'),
  },
  async (args) => {
    // Recurring tasks require explicit confirmation to prevent accidental creation
    const isRecurring = args.schedule_type === 'cron' || args.schedule_type === 'interval';
    if (isRecurring && !args.confirmed) {
      const desc = args.schedule_type === 'cron'
        ? `Cron: ${args.schedule_value}`
        : `Every ${Math.round(parseInt(args.schedule_value, 10) / 60000)} minutes`;
      return {
        content: [{ type: 'text' as const, text: `⚠️ Recurring task requires confirmation.\n\nSchedule: ${desc}\nPrompt: ${args.prompt.slice(0, 200)}${args.prompt.length > 200 ? '...' : ''}\n\nAsk the user to confirm, then call schedule_task again with confirmed=true.` }],
      };
    }

    // Validate schedule_value before writing IPC
    if (args.schedule_type === 'cron') {
      try {
        CronExpressionParser.parse(args.schedule_value);
      } catch {
        return {
          content: [{ type: 'text' as const, text: `Invalid cron: "${args.schedule_value}". Use format like "0 9 * * *" (daily 9am) or "*/5 * * * *" (every 5 min).` }],
          isError: true,
        };
      }
    } else if (args.schedule_type === 'interval') {
      const ms = parseInt(args.schedule_value, 10);
      if (isNaN(ms) || ms <= 0) {
        return {
          content: [{ type: 'text' as const, text: `Invalid interval: "${args.schedule_value}". Must be positive milliseconds (e.g., "300000" for 5 min).` }],
          isError: true,
        };
      }
    } else if (args.schedule_type === 'once') {
      const date = new Date(args.schedule_value);
      if (isNaN(date.getTime())) {
        return {
          content: [{ type: 'text' as const, text: `Invalid timestamp: "${args.schedule_value}". Use local time like "2026-02-01T15:30:00" (no Z suffix).` }],
          isError: true,
        };
      }
    }

    // Non-main groups can only schedule for themselves
    const targetJid = isMain && args.target_group_jid ? args.target_group_jid : chatJid;

    const data = {
      type: 'schedule_task',
      prompt: args.prompt,
      schedule_type: args.schedule_type,
      schedule_value: args.schedule_value,
      context_mode: args.context_mode || 'group',
      targetJid,
      createdBy: groupFolder,
      timestamp: new Date().toISOString(),
    };

    const filename = writeIpcFile(TASKS_DIR, data);

    return {
      content: [{ type: 'text' as const, text: `Task scheduled (${filename}): ${args.schedule_type} - ${args.schedule_value}` }],
    };
  },
);

server.tool(
  'list_tasks',
  "List all scheduled tasks. From main: shows all tasks. From other groups: shows only that group's tasks.",
  {},
  async () => {
    const tasksFile = path.join(IPC_DIR, 'current_tasks.json');

    try {
      if (!fs.existsSync(tasksFile)) {
        return { content: [{ type: 'text' as const, text: 'No scheduled tasks found.' }] };
      }

      const allTasks = JSON.parse(fs.readFileSync(tasksFile, 'utf-8'));

      const tasks = isMain
        ? allTasks
        : allTasks.filter((t: { groupFolder: string }) => t.groupFolder === groupFolder);

      if (tasks.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No scheduled tasks found.' }] };
      }

      const formatted = tasks
        .map(
          (t: { id: string; prompt: string; schedule_type: string; schedule_value: string; status: string; next_run: string }) =>
            `- [${t.id}] ${t.prompt.slice(0, 50)}... (${t.schedule_type}: ${t.schedule_value}) - ${t.status}, next: ${t.next_run || 'N/A'}`,
        )
        .join('\n');

      return { content: [{ type: 'text' as const, text: `Scheduled tasks:\n${formatted}` }] };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error reading tasks: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  },
);

server.tool(
  'pause_task',
  'Pause a scheduled task. It will not run until resumed.',
  { task_id: z.string().describe('The task ID to pause') },
  async (args) => {
    const data = {
      type: 'pause_task',
      taskId: args.task_id,
      groupFolder,
      isMain,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return { content: [{ type: 'text' as const, text: `Task ${args.task_id} pause requested.` }] };
  },
);

server.tool(
  'resume_task',
  'Resume a paused task.',
  { task_id: z.string().describe('The task ID to resume') },
  async (args) => {
    const data = {
      type: 'resume_task',
      taskId: args.task_id,
      groupFolder,
      isMain,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return { content: [{ type: 'text' as const, text: `Task ${args.task_id} resume requested.` }] };
  },
);

server.tool(
  'cancel_task',
  'Cancel and delete a scheduled task.',
  { task_id: z.string().describe('The task ID to cancel') },
  async (args) => {
    const data = {
      type: 'cancel_task',
      taskId: args.task_id,
      groupFolder,
      isMain,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return { content: [{ type: 'text' as const, text: `Task ${args.task_id} cancellation requested.` }] };
  },
);

server.tool(
  'register_group',
  `Register a new WhatsApp group so the agent can respond to messages there. Main group only.

Use available_groups.json to find the JID for a group. The folder name should be lowercase with hyphens (e.g., "family-chat").`,
  {
    jid: z.string().describe('The WhatsApp JID (e.g., "120363336345536173@g.us")'),
    name: z.string().describe('Display name for the group'),
    folder: z.string().describe('Folder name for group files (lowercase, hyphens, e.g., "family-chat")'),
    trigger: z.string().describe('Trigger word (e.g., "@TAi")'),
    requires_trigger: z.boolean().default(true).describe('Whether messages need the trigger prefix. Set to false for 1-on-1 student chats where all messages should be processed.'),
    canvas_user_id: z.string().optional().describe('Canvas LMS user ID for identity-bound access control'),
    github_username: z.string().optional().describe('GitHub username for identity-bound access control'),
    confirmed: z.boolean().default(false).describe('Set to true ONLY after the user explicitly confirms registration details. First call with false to preview, then call with true after user approval.'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [{ type: 'text' as const, text: 'Only the main group can register new groups.' }],
        isError: true,
      };
    }

    // Require explicit confirmation before registering
    if (!args.confirmed) {
      return {
        content: [{ type: 'text' as const, text: `⚠️ Group registration requires confirmation.\n\nJID: ${args.jid}\nName: ${args.name}\nFolder: ${args.folder}\nTrigger: ${args.trigger}\nRequires trigger: ${args.requires_trigger}\n\nAsk the user to confirm these details, then call register_group again with confirmed=true.` }],
      };
    }

    const data = {
      type: 'register_group',
      jid: args.jid,
      name: args.name,
      folder: args.folder,
      trigger: args.trigger,
      requiresTrigger: args.requires_trigger,
      canvasUserId: args.canvas_user_id || undefined,
      githubUsername: args.github_username || undefined,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [{ type: 'text' as const, text: `Group "${args.name}" registered. It will start receiving messages immediately.` }],
    };
  },
);

server.tool(
  'react_to_message',
  'React to a student message with an emoji. Use to acknowledge correct answers, show encouragement, etc.',
  {
    message_id: z.string().describe('The message ID to react to (from the id attribute in <message> tags)'),
    emoji: z.string().describe('Single emoji to react with (e.g., thumbs up, check mark, heart, target, lightbulb)'),
  },
  async (args) => {
    const data = {
      type: 'reaction',
      chatJid,
      messageId: args.message_id,
      emoji: args.emoji,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(MESSAGES_DIR, data);

    return { content: [{ type: 'text' as const, text: `Reacted with ${args.emoji}` }] };
  },
);

server.tool(
  'send_voice_message',
  'Convert text to speech and send as a voice note. Use when a student asks you to explain something verbally, or for mock interview practice.',
  {
    text: z.string().describe('The text to convert to speech (max 3000 chars)'),
  },
  async (args) => {
    const rl = checkRateLimit('send_voice_message');
    if (rl) return { content: [{ type: 'text' as const, text: rl }], isError: true };

    const mediaDir = path.join(IPC_DIR, 'media');
    fs.mkdirSync(mediaDir, { recursive: true });
    const audioPath = path.join(mediaDir, `tts-${Date.now()}.ogg`);

    try {
      const audioBuffer = execSync('/opt/leanrag/bin/python3 /opt/scripts/tts.py', {
        input: args.text,
        maxBuffer: 10 * 1024 * 1024,
      });
      fs.writeFileSync(audioPath, audioBuffer);
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `TTS failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }

    writeIpcFile(MESSAGES_DIR, {
      type: 'voice_message',
      chatJid,
      audioPath,
      timestamp: new Date().toISOString(),
    });

    return { content: [{ type: 'text' as const, text: 'Voice message sent.' }] };
  },
);

server.tool(
  'generate_teaching_image',
  'Generate a teaching illustration using AI (Amazon Nova Canvas). Use for conceptual visualizations when a student says "I can\'t picture this" or when a concept is inherently spatial. For precise technical diagrams with labels and arrows, use render_diagram instead. Your text output is suppressed after this tool — put your FULL response (explanation + follow-up question) in the caption.',
  {
    prompt: z.string().describe('Specific image description for the illustration'),
    caption: z.string().describe('Your full response to the student: explanation of the image + follow-up question. This is the ONLY text they will see.'),
  },
  async (args) => {
    const rl = checkRateLimit('generate_teaching_image');
    if (rl) return { content: [{ type: 'text' as const, text: rl }], isError: true };

    console.error(`[nanoclaw-mcp] generate_teaching_image: AWS_REGION=${process.env.AWS_REGION || 'not set'}, creds=${process.env.AWS_ACCESS_KEY_ID ? 'set' : 'NOT SET'}`);

    if (!process.env.AWS_ACCESS_KEY_ID) {
      return { content: [{ type: 'text' as const, text: 'Image generation failed: AWS credentials not available in container environment.' }], isError: true };
    }

    const mediaDir = path.join(IPC_DIR, 'media');
    fs.mkdirSync(mediaDir, { recursive: true });
    const imagePath = path.join(mediaDir, `img-${Date.now()}.png`);

    try {
      const imageBuffer = execSync('/opt/leanrag/bin/python3 /opt/scripts/image_gen.py', {
        input: args.prompt,
        maxBuffer: 20 * 1024 * 1024,
        timeout: 60000,
      });
      fs.writeFileSync(imagePath, imageBuffer);
    } catch (err: unknown) {
      const stderr = (err as { stderr?: Buffer })?.stderr?.toString() || '';
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[nanoclaw-mcp] generate_teaching_image FAILED: ${msg}`);
      if (stderr) console.error(`[nanoclaw-mcp] stderr: ${stderr.slice(-1000)}`);
      return {
        content: [{ type: 'text' as const, text: `Image generation failed: ${msg}${stderr ? `\nDetails: ${stderr.slice(-500)}` : ''}` }],
        isError: true,
      };
    }

    writeIpcFile(MESSAGES_DIR, {
      type: 'image_message',
      chatJid,
      imagePath,
      caption: args.caption || undefined,
      timestamp: new Date().toISOString(),
    });

    // Suppress text output — caption is the response
    fs.writeFileSync(path.join(MESSAGES_DIR, '.send_message_used'), '');

    return { content: [{ type: 'text' as const, text: 'Image sent. Your text output will be suppressed — put your full response (explanation + follow-up question) in the caption. Wrap any remaining output in <internal> tags.' }] };
  },
);

server.tool(
  'render_diagram',
  'Render a Mermaid diagram as an image and send it to the student immediately. Your text output is suppressed after this tool — put your FULL response (explanation of the diagram + follow-up question) in the caption. The caption is the ONLY text the student will see alongside the diagram.',
  {
    mermaid_syntax: z.string().describe('Valid Mermaid diagram syntax'),
    caption: z.string().describe('Your full response to the student: explain what the diagram shows + ask a follow-up question. This is the ONLY text they will see.'),
  },
  async (args) => {
    const rl = checkRateLimit('render_diagram');
    if (rl) return { content: [{ type: 'text' as const, text: rl }], isError: true };

    const mediaDir = path.join(IPC_DIR, 'media');
    fs.mkdirSync(mediaDir, { recursive: true });
    const ts = Date.now();
    const inputPath = path.join(mediaDir, `diagram-${ts}.mmd`);
    const outputPath = path.join(mediaDir, `diagram-${ts}.png`);

    fs.writeFileSync(inputPath, args.mermaid_syntax);

    try {
      execSync(
        `mmdc -i ${inputPath} -o ${outputPath} -b white --scale 2 -p /opt/scripts/puppeteer-config.json`,
        { timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] },
      );
    } catch (err) {
      // Clean up input file on failure
      try { fs.unlinkSync(inputPath); } catch { /* ignore */ }
      return {
        content: [{ type: 'text' as const, text: `Diagram rendering failed: ${err instanceof Error ? err.message : String(err)}. Check your Mermaid syntax and try again, or describe the diagram in text instead.` }],
        isError: true,
      };
    }

    // Clean up input file
    try { fs.unlinkSync(inputPath); } catch { /* ignore */ }

    writeIpcFile(MESSAGES_DIR, {
      type: 'image_message',
      chatJid,
      imagePath: outputPath,
      caption: args.caption || undefined,
      timestamp: new Date().toISOString(),
    });

    // Suppress text output — caption is the response
    fs.writeFileSync(path.join(MESSAGES_DIR, '.send_message_used'), '');

    return { content: [{ type: 'text' as const, text: 'Diagram sent. Your text output will be suppressed — put your full response (explanation + follow-up question) in the caption. Wrap any remaining output in <internal> tags.' }] };
  },
);

// --- Canvas LMS Integration ---

server.tool(
  'canvas_query',
  `Query Canvas LMS for real-time course data (read-only). This is the authoritative source for deadlines, grades, and submissions.

Actions:
- "assignments": List all assignments with due dates
- "assignment_detail": Single assignment with rubric criteria and point values (params: assignment_id)
- "submissions": Who submitted an assignment, when, late? (params: assignment_id)
- "student_submission": Specific student's submission (params: assignment_id, user_id)
- "my_grades": Your scores across all assignments (auto-scoped to your Canvas ID)
- "grades": Gradebook for all students (admin only)
- "announcements": Recent instructor announcements
- "discussions": Discussion topics
- "discussion_detail": Full discussion topic (params: topic_id)
- "discussion_entries": Discussion replies/posts (params: topic_id)
- "upcoming": Assignments due soon
- "modules": Course modules and content structure (includes item URLs)
- "module_items": Items in a specific module with external URLs (params: module_id)
- "pages": List wiki pages (syllabus, guides, policies)
- "page_detail": Full page content (params: page_url — the slug, not full URL)
- "syllabus": Course syllabus body
- "files": List uploaded course files (slides, readings) — returns file IDs
- "file_content": Download and extract text from a Canvas file (params: file_id) — handles PDFs, text, code files. READ-ONLY.
- "users": Enrolled students

This tool does NOT count against the 3-tool-call search limit.`,
  {
    action: z.string().describe('Canvas action to perform'),
    params: z.record(z.string(), z.string()).optional().describe('Action parameters (e.g., assignment_id, user_id, topic_id)'),
  },
  async (args) => {
    const rl = checkRateLimit('canvas_query');
    if (rl) return { content: [{ type: 'text' as const, text: rl }], isError: true };

    if (!process.env.CANVAS_API_TOKEN) {
      return { content: [{ type: 'text' as const, text: 'Canvas not configured: CANVAS_API_TOKEN not set in .env' }], isError: true };
    }

    // --- Identity-based access control ---
    // Actions that expose other students' data are restricted for student containers.
    // Admin (main) and system tasks (bootstrap, patrol) retain full access.
    const CANVAS_RESTRICTED_ACTIONS = new Set(['grades', 'users', 'submissions']);
    const CANVAS_IDENTITY_ACTIONS = new Set(['student_submission', 'my_grades']);

    if (!hasFullAccess) {
      if (CANVAS_RESTRICTED_ACTIONS.has(args.action)) {
        return {
          content: [{ type: 'text' as const, text: `The "${args.action}" action is restricted to protect student privacy. Use "my_grades" to see your own scores, or "student_submission" for a specific assignment.` }],
          isError: true,
        };
      }

      if (CANVAS_IDENTITY_ACTIONS.has(args.action)) {
        if (!boundCanvasUserId) {
          return {
            content: [{ type: 'text' as const, text: 'Your Canvas identity has not been linked yet. Please ask your instructor to run the competency bootstrap, or use /admin to set your Canvas user ID.' }],
            isError: true,
          };
        }
        // Enforce: always use the bound user_id, ignore any user-supplied value
        args.params = { ...(args.params || {}), user_id: boundCanvasUserId };
      }
    }

    try {
      const result = execSync('/opt/leanrag/bin/python3 /opt/scripts/canvas_api.py', {
        input: JSON.stringify({ action: args.action, params: args.params || {} }),
        maxBuffer: 5 * 1024 * 1024,
        timeout: 60000,
        env: {
          ...process.env,
          CANVAS_API_TOKEN: process.env.CANVAS_API_TOKEN,
          CANVAS_BASE_URL: process.env.CANVAS_BASE_URL || '',
          CANVAS_COURSE_ID: process.env.CANVAS_COURSE_ID || '',
        },
      });
      return { content: [{ type: 'text' as const, text: result.toString() }] };
    } catch (err: unknown) {
      const stdout = (err as { stdout?: Buffer })?.stdout?.toString() || '';
      const stderr = (err as { stderr?: Buffer })?.stderr?.toString() || '';
      const msg = stdout || stderr || (err instanceof Error ? err.message : String(err));
      return { content: [{ type: 'text' as const, text: `Canvas query failed: ${msg.slice(-1000)}` }], isError: true };
    }
  },
);

// --- GitHub Integration ---

server.tool(
  'github_query',
  `Query GitHub for student repository data (read-only). Use for code review, commit history, PR status, and CI/CD checks.

Actions:
- "list_repos": List repos for org/user (params: org OR user)
- "repo_tree": View file structure (params: owner, repo, path?, ref?)
- "commits": Recent commits (params: owner, repo, author?, path?, limit?)
- "commit_detail": View a commit diff (params: owner, repo, sha)
- "pull_requests": List PRs (params: owner, repo, state?)
- "pr_detail": PR details and stats (params: owner, repo, number)
- "pr_reviews": Code review comments (params: owner, repo, number)
- "check_runs": CI/CD status (params: owner, repo, ref)
- "file_content": Read a file (params: owner, repo, path, ref?)

This tool does NOT count against the 3-tool-call search limit.`,
  {
    action: z.string().describe('GitHub action to perform'),
    params: z.record(z.string(), z.string()).optional().describe('Action parameters (e.g., owner, repo, sha, number)'),
  },
  async (args) => {
    const rl = checkRateLimit('github_query');
    if (rl) return { content: [{ type: 'text' as const, text: rl }], isError: true };

    if (!process.env.GITHUB_TOKEN) {
      return { content: [{ type: 'text' as const, text: 'GitHub not configured: GITHUB_TOKEN not set in .env' }], isError: true };
    }

    // --- Identity-based access control ---
    // Student containers can only access their own repos + allowed course orgs.
    if (!hasFullAccess) {
      const ownerParam = args.params?.owner || args.params?.org || args.params?.user;
      if (ownerParam) {
        const isOwnRepo = boundGithubUsername && ownerParam.toLowerCase() === boundGithubUsername.toLowerCase();
        const isAllowedOrg = githubAllowedOrgs.some(org => org.toLowerCase() === ownerParam.toLowerCase());
        if (!isOwnRepo && !isAllowedOrg) {
          if (!boundGithubUsername) {
            return {
              content: [{ type: 'text' as const, text: 'Your GitHub identity has not been linked yet. Please share your GitHub username so I can look up your repositories.' }],
              isError: true,
            };
          }
          return {
            content: [{ type: 'text' as const, text: `You can only access your own repositories (${boundGithubUsername}). I cannot browse other students' code.` }],
            isError: true,
          };
        }
      }
    }

    try {
      // Detect host from params: if params contain a 'host' key, use it directly.
      // Otherwise infer from GITHUB_BASE_URL: enterprise host → GITHUB_TOKEN,
      // no enterprise or explicit github.com → GITHUB_TOKEN_PUBLIC + api.github.com.
      const paramHost = args.params?.host || '';
      const enterpriseHost = process.env.GITHUB_BASE_URL
        ? (process.env.GITHUB_BASE_URL.match(/https?:\/\/(github[^/]+)/)?.[1] || '')
        : '';
      const isPublicGithub = paramHost === 'github.com' ||
        (!paramHost && (!enterpriseHost || enterpriseHost === 'api.github.com'));

      const ghEnv = isPublicGithub
        ? {
            ...process.env,
            GITHUB_TOKEN: process.env.GITHUB_TOKEN_PUBLIC || '',
            GITHUB_BASE_URL: 'https://api.github.com',
          }
        : {
            ...process.env,
            GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
            GITHUB_BASE_URL: process.env.GITHUB_BASE_URL || 'https://api.github.com',
          };

      const result = execSync('/opt/leanrag/bin/python3 /opt/scripts/github_api.py', {
        input: JSON.stringify({ action: args.action, params: args.params || {} }),
        maxBuffer: 5 * 1024 * 1024,
        timeout: 60000,
        env: ghEnv,
      });
      return { content: [{ type: 'text' as const, text: result.toString() }] };
    } catch (err: unknown) {
      const stdout = (err as { stdout?: Buffer })?.stdout?.toString() || '';
      const stderr = (err as { stderr?: Buffer })?.stderr?.toString() || '';
      const msg = stdout || stderr || (err instanceof Error ? err.message : String(err));
      return { content: [{ type: 'text' as const, text: `GitHub query failed: ${msg.slice(-1000)}` }], isError: true };
    }
  },
);

// --- YouTube Video Info ---

server.tool(
  'youtube_info',
  `Get YouTube video metadata (title, description, channel, duration, tags) via the official YouTube Data API. Use this when Canvas content or students share YouTube links.

The description often contains a summary, timestamps, and links — enough to understand what the video covers. For the actual video content, tell the student to watch it and come back to discuss.`,
  {
    url: z.string().describe('YouTube URL (youtube.com/watch?v=... or youtu.be/...)'),
  },
  async (args) => {
    if (!process.env.YOUTUBE_API_KEY) {
      return { content: [{ type: 'text' as const, text: 'YouTube API not configured: YOUTUBE_API_KEY not set in .env' }], isError: true };
    }
    try {
      const result = execSync('/opt/leanrag/bin/python3 /opt/scripts/youtube_info.py', {
        input: JSON.stringify({ url: args.url }),
        maxBuffer: 5 * 1024 * 1024,
        timeout: 15000,
        env: {
          ...process.env,
          YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
        },
      });
      return { content: [{ type: 'text' as const, text: result.toString() }] };
    } catch (err: unknown) {
      const stdout = (err as { stdout?: Buffer })?.stdout?.toString() || '';
      const stderr = (err as { stderr?: Buffer })?.stderr?.toString() || '';
      const msg = stdout || stderr || (err instanceof Error ? err.message : String(err));
      return { content: [{ type: 'text' as const, text: `YouTube info failed: ${msg.slice(-1000)}` }], isError: true };
    }
  },
);

// --- YouTube Transcript ---

server.tool(
  'youtube_transcript',
  `Fetch the full transcript (captions/subtitles) of a YouTube video. Returns the actual spoken text content of the video.

Use this when:
- A student shares a YouTube link and you need to understand what the video covers
- Canvas content references a YouTube video and you need its content for teaching
- You want to generate quiz questions or discussion points from a video

The transcript is cached locally so repeated requests for the same video are instant.
For just metadata (title, description, tags), use youtube_info instead.`,
  {
    url: z.string().describe('YouTube URL (youtube.com/watch?v=... or youtu.be/...) or video ID'),
    lang: z.string().optional().describe('Language code (default: "en")'),
    max_chars: z.number().optional().describe('Truncate transcript to this many characters (useful for long videos)'),
  },
  async (args) => {
    try {
      const input = JSON.stringify({
        url: args.url,
        lang: args.lang || 'en',
        max_chars: args.max_chars,
      });
      const result = execSync('/opt/leanrag/bin/python3 /opt/scripts/youtube_transcript.py', {
        input,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
        env: process.env,
      });
      return { content: [{ type: 'text' as const, text: result.toString() }] };
    } catch (err: unknown) {
      const stdout = (err as { stdout?: Buffer })?.stdout?.toString() || '';
      const stderr = (err as { stderr?: Buffer })?.stderr?.toString() || '';
      const msg = stdout || stderr || (err instanceof Error ? err.message : String(err));
      return { content: [{ type: 'text' as const, text: `YouTube transcript failed: ${msg.slice(-1000)}` }], isError: true };
    }
  },
);

// --- Mock Interview ---

server.tool(
  'start_mock_interview',
  `Generate a voice mock interview link for the student. BEFORE calling this tool:

1. Ask the student which homework they want to practice (e.g. "HW3 - Docker and concurrency")
2. Use canvas_query({action: "assignments"}) to find the matching assignment and get its ID
3. If you know the student's GitHub username (from COMPETENCY.md or they've mentioned it), pass it as github_username

This tool then:
- Fetches the assignment spec + that week's lecture materials from Canvas
- Fetches the student's Canvas submission for that assignment
- Fetches their GitHub code (tries to match repo to the assignment)
- Writes all context to interview_context.json for the voice server to use
- Returns a browser link the student opens for a live voice mock interview

The interview asks targeted questions about THEIR specific work — "I see you used Gin, why not net/http?" — not generic questions.`,
  {
    assignment_id: z.string().optional().describe('Canvas assignment ID to focus on. Get this from canvas_query({action:"assignments"}) first by asking the student which HW they want to practice.'),
    canvas_user_id: z.string().optional().describe('Canvas user ID to fetch submissions for. Overrides COMPETENCY.md lookup. Use when testing from admin or fetching a different student\'s submission.'),
    github_username: z.string().optional().describe('Student GitHub username. Check COMPETENCY.md first (GitHub: field). Ask the student if not found.'),
    student_folder: z.string().optional().describe('Student folder name (e.g. "yuzheng"). Only needed from the admin channel.'),
  },
  async (args) => {
    const rl = checkRateLimit('start_mock_interview');
    if (rl) return { content: [{ type: 'text' as const, text: rl }], isError: true };

    const secret = process.env.VOICE_INTERVIEW_SECRET;
    if (!secret) {
      return {
        content: [{ type: 'text' as const, text: 'Voice interview not configured: VOICE_INTERVIEW_SECRET not set.' }],
        isError: true,
      };
    }

    const targetFolder = args.student_folder || groupFolder;
    const studentDir = path.join('/workspace/project/groups', targetFolder);

    // --- Helper ---
    const callPyErrors: string[] = [];
    function callPy(script: string, input: Record<string, unknown>, envOverride?: Record<string, string>): unknown {
      try {
        const out = execSync(`/opt/leanrag/bin/python3 /opt/scripts/${script}`, {
          input: JSON.stringify(input),
          maxBuffer: 5 * 1024 * 1024,
          timeout: 30000,
          env: envOverride ? { ...process.env, ...envOverride } : process.env,
        });
        const result = JSON.parse(out.toString());
        if (result && typeof result === 'object' && 'error' in result) {
          const msg = `${script}(${input.action}): ${result.error}`;
          callPyErrors.push(msg);
          console.error('[start_mock_interview] callPy error:', msg);
        }
        return result;
      } catch (err) {
        const stdout = (err as { stdout?: Buffer })?.stdout?.toString() || '';
        const stderr = (err as { stderr?: Buffer })?.stderr?.toString() || '';
        let result: unknown;
        try { result = JSON.parse(stdout); } catch { result = null; }
        if (result && typeof result === 'object' && 'error' in (result as object)) {
          const msg = `${script}(${input.action}): ${(result as Record<string,unknown>).error}`;
          callPyErrors.push(msg);
          console.error('[start_mock_interview] callPy error:', msg);
          return result;
        }
        const msg = `${script}(${input.action}): ${stderr || (err as Error).message}`;
        callPyErrors.push(msg);
        console.error('[start_mock_interview] callPy exception:', msg);
        return { error: msg };
      }
    }
    function trunc(text: string, max: number): string {
      if (!text || text.length <= max) return text || '';
      const cut = text.slice(0, max);
      const p = cut.lastIndexOf('.');
      return (p > max * 0.7 ? cut.slice(0, p + 1) : cut) + ' [...]';
    }

    // --- 1. Parse COMPETENCY.md ---
    let studentName = targetFolder;
    // Priority: DB binding (trusted) > explicit MCP arg > COMPETENCY.md fallback
    let canvasUserId = boundCanvasUserId || args.canvas_user_id || '';
    let githubUsername = boundGithubUsername || args.github_username || '';
    const weakConcepts: string[] = [];
    const verbalGaps: string[] = [];
    const misconceptions: string[] = [];
    try {
      const comp = fs.readFileSync(path.join(studentDir, 'COMPETENCY.md'), 'utf-8');
      const nm = comp.match(/^(?:[-*\s]*)?\**(?:Student name|Student|Name)\**:\s*([^\n\r]+)/im);
      if (nm) studentName = nm[1].trim();
      const cm = comp.match(/Canvas User ID:\s*(\d+)/i);
      if (cm && !canvasUserId) canvasUserId = cm[1]; // DB binding takes precedence
      const gm = comp.match(/GitHub:\s*(\S+)/i);
      if (gm && !githubUsername) githubUsername = gm[1]; // DB binding takes precedence
      const cpat = /^([A-Z][^:\n]+?):\s*\n\s+confidence:\s*([\d.]+)\s*\|\s*stability:\s*([\d.]+)\s*\|\s*scope:\s*\[([^\]]*)\]/gm;
      let m;
      while ((m = cpat.exec(comp)) !== null) {
        const [, concept, confStr, , scopeStr] = m;
        const conf = parseFloat(confStr);
        const scopes = scopeStr.split(',').map((s: string) => s.trim().replace(/"/g, ''));
        if (conf < 0.5 && conf > 0) weakConcepts.push(`${concept.trim()} (${confStr})`);
        if (conf >= 0.3 && !scopes.includes('verbal')) verbalGaps.push(concept.trim());
      }
      const mpat = /- "([^"]+)"\s*\n\s+contradicts:/g;
      while ((m = mpat.exec(comp)) !== null) misconceptions.push(m[1]);
    } catch { /* COMPETENCY.md missing is fine */ }

    // --- 2. Canvas: assignment + submission ---
    let assignmentId = args.assignment_id || '';
    let assignmentName = 'Unknown';
    let assignmentSpec = '';
    let submissionText = '';
    let submissionRepoOwner = '';
    let submissionRepoName = '';
    let submissionGithubHost = '';

    if (process.env.CANVAS_API_TOKEN) {
      // Get assignments
      const assignments = callPy('canvas_api.py', { action: 'assignments' }) as Array<Record<string, unknown>>;
      if (Array.isArray(assignments)) {
        let target: Record<string, unknown> | undefined;
        if (assignmentId) {
          target = assignments.find(a => String(a.id) === assignmentId);
        }
        if (!target) {
          const now = new Date();
          const sorted = assignments.filter(a => a.due_at)
            .sort((a, b) => new Date(b.due_at as string).getTime() - new Date(a.due_at as string).getTime());
          target = sorted.find(a => new Date(a.due_at as string) <= now) || sorted[sorted.length - 1];
        }
        if (target) {
          assignmentId = String(target.id || '');
          assignmentName = String(target.name || 'Unknown');
          // Assignment detail (spec)
          const detail = callPy('canvas_api.py', { action: 'assignment_detail', params: { assignment_id: assignmentId } }) as Record<string, unknown>;
          if (detail && !('error' in detail)) {
            const raw = String(detail.description || detail.body || '');
            assignmentSpec = trunc(raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), 2000);
          }
          // Find Canvas user ID by name if not set
          if (!canvasUserId) {
            const users = callPy('canvas_api.py', { action: 'users' }) as Array<Record<string, unknown>>;
            if (Array.isArray(users)) {
              const nameLower = studentName.toLowerCase();
              const found = users.find(u => {
                const n = String(u.name || u.sortable_name || '').toLowerCase();
                return n.includes(nameLower) || nameLower.includes(n.split(',')[0]?.trim() || '');
              });
              if (found) canvasUserId = String(found.id || '');
            }
          }
          // Student submission
          if (canvasUserId && assignmentId) {
            const sub = callPy('canvas_api.py', { action: 'student_submission', params: { assignment_id: assignmentId, user_id: canvasUserId } }) as Record<string, unknown>;
            if (sub && !('error' in sub)) {
              submissionText = trunc(String(sub.full_text || sub.body || sub.submission_body || ''), 3000);
              // P2: extract host+owner+repo from submission GitHub URLs (github.com or Enterprise)
              const subGithubUrls = (Array.isArray(sub.github_urls) ? sub.github_urls : []) as string[];
              if (subGithubUrls.length > 0) {
                const m = String(subGithubUrls[0]).match(/https?:\/\/(github[^/\s]*)\/([^/\s]+)\/([^/\s]+)/);
                if (m) {
                  submissionGithubHost = m[1];
                  submissionRepoOwner = m[2];
                  submissionRepoName = m[3].replace(/\.git$/, '');
                  if (!githubUsername) githubUsername = m[2];
                }
              }
            }
          }
        }
      }
    }

    // If submission URL parsing didn't yield a GitHub host, infer from GITHUB_BASE_URL config.
    // e.g. GITHUB_BASE_URL=https://github.khoury.northeastern.edu/api/v3 → host=github.khoury.northeastern.edu
    if (!submissionGithubHost && process.env.GITHUB_BASE_URL) {
      const m = process.env.GITHUB_BASE_URL.match(/https?:\/\/(github[^/]+)/);
      if (m && m[1] !== 'github.com') submissionGithubHost = m[1];
    }

    // --- 2.5. Lecture materials: find the Canvas module for this assignment ---
    let lectureContent = '';
    if (process.env.CANVAS_API_TOKEN && assignmentId) {
      try {
        const modules = callPy('canvas_api.py', { action: 'modules' }) as Array<Record<string, unknown>>;
        if (Array.isArray(modules)) {
          // Find the module containing this assignment
          const targetModule = modules.find(mod => {
            const items = (mod.items || []) as Array<Record<string, unknown>>;
            return items.some(item => item.type === 'Assignment' && String(item.content_id) === assignmentId);
          });
          if (targetModule) {
            // Get files and pages in this module (lecture slides, readings)
            const items = (targetModule.items || []) as Array<Record<string, unknown>>;
            const fileItems = items.filter(i => i.type === 'File').slice(0, 3);
            const pageItems = items.filter(i => i.type === 'Page').slice(0, 2);
            const parts: string[] = [];

            for (const item of fileItems) {
              if (!item.content_id) continue;
              const fc = callPy('canvas_api.py', { action: 'file_content', params: { file_id: String(item.content_id) } }) as Record<string, unknown>;
              if (fc?.content) parts.push(`=== ${item.title} ===\n${trunc(String(fc.content), 1500)}`);
            }
            for (const item of pageItems) {
              if (!item.page_url) continue;
              const pg = callPy('canvas_api.py', { action: 'page_detail', params: { page_url: String(item.page_url) } }) as Record<string, unknown>;
              if (pg?.body) parts.push(`=== ${item.title} ===\n${trunc(String(pg.body), 800)}`);
            }
            lectureContent = parts.join('\n\n');
          }
        }
      } catch { /* lecture fetch is best-effort */ }
    }

    // --- 3. GitHub: assignment-matched code ---
    let codeExcerpts = '';
    const ghOwner = submissionRepoOwner || githubUsername;

    // Build env for the right GitHub instance (Enterprise vs public github.com)
    function githubEnvFor(host: string): Record<string, string> {
      if (host && host !== 'github.com') {
        // GitHub Enterprise detected from submission URL
        return {
          GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
          GITHUB_BASE_URL: `https://${host}/api/v3`,
        };
      }
      if (!host && process.env.GITHUB_BASE_URL) {
        // No host from submission URL — use configured GITHUB_BASE_URL (e.g. Khoury GHE)
        return {
          GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
          GITHUB_BASE_URL: process.env.GITHUB_BASE_URL,
        };
      }
      // Public github.com — prefer GITHUB_TOKEN_PUBLIC if set
      return {
        GITHUB_TOKEN: process.env.GITHUB_TOKEN_PUBLIC || process.env.GITHUB_TOKEN || '',
        GITHUB_BASE_URL: 'https://api.github.com',
      };
    }

    if ((process.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN_PUBLIC) && ghOwner) {
      const ghEnv = githubEnvFor(submissionGithubHost || '');
let targetRepo = submissionRepoName;  // direct from submission URL if available

      // If no specific repo from submission URL, list repos and match by assignment name
      if (!targetRepo) {
        const repos = callPy('github_api.py', { action: 'list_repos', params: { user: ghOwner } }, ghEnv) as Array<Record<string, unknown>>;
        if (Array.isArray(repos) && repos.length > 0) {
          // Build smart keyword list: words + HW number patterns
          const hwNum = assignmentName.match(/(?:hw|homework|assignment)[^\d]*(\d+)/i)?.[1]
            || assignmentName.match(/\b(\d{1,2})\b/)?.[1];
          const baseKw = assignmentName.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
          const keywords = hwNum
            ? [...baseKw, `hw${hwNum}`, `homework${hwNum}`, `assignment${hwNum}`, hwNum]
            : baseKw;

          const sorted = repos.sort((a, b) =>
            new Date(b.updated_at as string || 0).getTime() - new Date(a.updated_at as string || 0).getTime()
          );
          const matched = sorted.find(r => {
            const name = String(r.name || '').toLowerCase();
            return keywords.some(kw => name.includes(kw));
          });
          // No sorted[0] fallback — wrong repo is worse than no repo
          if (matched) targetRepo = String(matched.name);
        }
      }

      if (targetRepo) {
        const tree = callPy('github_api.py', { action: 'repo_tree', params: { owner: ghOwner, repo: targetRepo, recursive: true } }, ghEnv) as Array<Record<string, unknown>>;
        if (Array.isArray(tree)) {
          const filePath = (f: Record<string, unknown>) => String(f.path || f.name);
          const keyFiles = tree.filter(f => f.type === 'file')
            .filter(f => /\.(go|py|java|js|ts|tf|yaml|yml|dockerfile)$/i.test(filePath(f)) || filePath(f).split('/').pop() === 'Dockerfile')
            .slice(0, 4);
          const excerpts: string[] = [];
          for (const f of keyFiles) {
            const fp = filePath(f);
            const fc = callPy('github_api.py', { action: 'file_content', params: { owner: ghOwner, repo: targetRepo, path: fp } }, ghEnv) as Record<string, unknown>;
            if (fc?.content) excerpts.push(`--- ${targetRepo}/${fp} ---\n${trunc(String(fc.content), 600)}`);
          }
          codeExcerpts = excerpts.join('\n\n');
        }
      }
    }

    // --- 4. Write interview_context.json ---
    const ctx = { studentName, canvasUserId, assignmentId, assignmentName, assignmentSpec, lectureContent, submissionText, codeExcerpts, weakConcepts, verbalGaps, misconceptions, generatedAt: new Date().toISOString() };
    try {
      fs.writeFileSync(path.join(studentDir, 'interview_context.json'), JSON.stringify(ctx, null, 2));
    } catch (err) {
      console.error('Failed to write interview_context.json:', err);
    }

    // --- 5. Generate HMAC-signed token ---
    const { createHmac } = await import('crypto');
    const payload = JSON.stringify({ folder: targetFolder, assignmentId, ts: Date.now() });
    const json = Buffer.from(payload).toString('base64url');
    const sig = createHmac('sha256', secret).update(json).digest('hex');
    const token = `${json}.${sig}`;
    const baseUrl = process.env.VOICE_BASE_URL || `http://localhost:${process.env.VOICE_PORT || '3001'}`;
    const url = `${baseUrl}/interview/${token}`;

    const hasCanvas = !!process.env.CANVAS_API_TOKEN;
    const hasGitHub = !!process.env.GITHUB_TOKEN;
    const loaded = [
      hasCanvas ? (assignmentSpec ? `spec ✓` : `spec ✗`) : `spec ✗ (no CANVAS_API_TOKEN)`,
      hasCanvas ? (lectureContent ? `lecture ✓` : `lecture ✗`) : `lecture ✗ (no CANVAS_API_TOKEN)`,
      hasCanvas ? (submissionText ? `submission ✓` : `submission ✗`) : `submission ✗`,
      hasGitHub ? (codeExcerpts ? `code ✓` : `code ✗`) : `code ✗ (no GITHUB_TOKEN)`,
    ].join(', ');

    const errorSummary = callPyErrors.length > 0
      ? `\n\nContext errors:\n${callPyErrors.map(e => `• ${e}`).join('\n')}`
      : '';

    return {
      content: [{ type: 'text' as const, text: `Mock interview ready for ${studentName} — ${assignmentName}\nContext: ${loaded}${errorSummary}\n\n${url}\n\nExpires in 1 hour. Open in Chrome with headphones connected.` }],
    };
  },
);

// --- Long-Term Memory ---

server.tool(
  'memory_query',
  `Search past memories AND conversation history for this student. Use this when:
- You need to recall something specific from a past session not in the current context
- A student references something from weeks ago and you need the details
- You want to check if a strategy or insight was already recorded

Searches two sources:
1. Stored memories (facts explicitly saved via memory_store across sessions)
2. Recent conversation history (last 100 messages from the messages database)

For what's already loaded, check the <memory_context> block in your system prompt first.`,
  {
    query: z.string().describe('Keywords to search for (e.g., "MapReduce breakthrough", "Docker deployment", "goroutine misconception")'),
    category: z.enum(['student_preference', 'decision', 'breakthrough', 'misconception', 'concept', 'homework', 'identity', 'other']).optional().describe('Filter memories by category (does not apply to message search)'),
    limit: z.number().optional().describe('Max results per source (default 8)'),
  },
  async (args) => {
    const storePath = '/workspace/group/memory_store.json';
    if (!fs.existsSync(storePath)) {
      return { content: [{ type: 'text' as const, text: 'No memory store found.' }] };
    }

    let store: { memories?: Array<{ text: string; category: string; entity: string | null; key: string | null; value: string | null; created_at: number }>; messages?: Array<{ sender_name: string; content: string; timestamp: string; is_bot_message: number }> };
    try {
      store = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    } catch {
      return { content: [{ type: 'text' as const, text: 'Failed to read memory store.' }] };
    }

    const limit = args.limit ?? 8;
    const queryLower = args.query.toLowerCase();
    const keywords = queryLower.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 1);

    const parts: string[] = [];

    // --- Search stored memories ---
    const memories = store.memories || [];
    let memResults = memories.filter(m => {
      if (args.category && m.category !== args.category) return false;
      const haystack = [m.text, m.category, m.entity, m.key, m.value].filter(Boolean).join(' ').toLowerCase();
      return keywords.some(kw => haystack.includes(kw));
    }).slice(0, limit);

    if (memResults.length > 0) {
      parts.push(`## Stored memories (${memResults.length})`);
      for (const m of memResults) {
        const date = new Date(m.created_at).toISOString().slice(0, 10);
        const kv = m.key && m.value ? ` [${m.key}=${m.value}]` : '';
        const entity = m.entity ? ` (${m.entity})` : '';
        parts.push(`- [${m.category}${entity}]${kv} ${m.text} (${date})`);
      }
    }

    // --- Search conversation history ---
    const messages = store.messages || [];
    const msgResults = messages.filter(msg => {
      return keywords.some(kw => msg.content.toLowerCase().includes(kw));
    }).slice(-limit); // take most recent matches

    if (msgResults.length > 0) {
      parts.push(`## Conversation history matches (${msgResults.length})`);
      for (const msg of msgResults) {
        const role = msg.is_bot_message ? 'TAi' : (msg.sender_name || 'Student');
        const ts = msg.timestamp ? msg.timestamp.slice(0, 10) : '';
        const content = msg.content.length > 200 ? msg.content.slice(0, 200) + '...' : msg.content;
        parts.push(`[${ts}] ${role}: ${content}`);
      }
    }

    if (parts.length === 0) {
      return { content: [{ type: 'text' as const, text: `No results found for "${args.query}".` }] };
    }

    return { content: [{ type: 'text' as const, text: parts.join('\n') }] };
  },
);

server.tool(
  'memory_store',
  `Store an important fact in long-term memory for future sessions.

Category guide:
- student_preference: how the student likes to learn ("prefers problem-first over analogies")
- decision: a teaching decision and why ("decided to skip Terraform — too much at once")
- breakthrough: a learning breakthrough ("understood MapReduce via problem-first approach")
- misconception: a misconception the student has or had ("thought goroutines = threads, now resolved")
- concept: concept understanding note ("explains Docker image vs container correctly")
- homework: homework-specific insight ("submitted HW2 but Docker deployment still shaky")
- identity: stable facts ("CS grad student, graduating Aug 2026, strong programmer background")

When to call:
- Student has a breakthrough or "aha" moment
- You discover a strategy that works or doesn't for this student
- Student shares important context (background, goals, constraints)
- A misconception is confirmed or resolved
- End of substantive session — capture key insights`,
  {
    text: z.string().describe('The fact to remember (1-2 sentences, specific and actionable)'),
    category: z.enum(['student_preference', 'decision', 'breakthrough', 'misconception', 'concept', 'homework', 'identity', 'other']).optional(),
    entity: z.string().optional().describe('Main subject (e.g., "Docker", "MapReduce")'),
    key: z.string().optional().describe('Short key for structured recall (e.g., "learning_style")'),
    value: z.string().optional().describe('Value for the key (e.g., "problem-first")'),
  },
  async (args) => {
    writeIpcFile(MESSAGES_DIR, {
      type: 'memory_store',
      studentFolder: groupFolder,
      fact: {
        text: args.text,
        category: args.category || 'other',
        entity: args.entity,
        key: args.key,
        value: args.value,
      },
      timestamp: new Date().toISOString(),
    });
    return { content: [{ type: 'text' as const, text: 'Memory stored.' }] };
  },
);

// --- Student Identity Binding ---

server.tool(
  'set_student_identity',
  `Persist a student's Canvas user ID or GitHub username in the system database.
This creates a trusted identity binding used for access control — students cannot modify it.

Only available to admin (main group) and system tasks (bootstrap, patrol).
Call this after discovering a student's Canvas user ID (e.g., from the users list during bootstrap)
or GitHub username (e.g., from a Canvas submission URL).`,
  {
    canvas_user_id: z.string().optional().describe('Canvas LMS user ID for this student'),
    github_username: z.string().optional().describe('GitHub username for this student'),
    target_folder: z.string().optional().describe('(Main only) Target student folder. Defaults to current group.'),
  },
  async (args) => {
    if (!hasFullAccess) {
      return {
        content: [{ type: 'text' as const, text: 'Only admin or system tasks can set student identity bindings.' }],
        isError: true,
      };
    }

    if (!args.canvas_user_id && !args.github_username) {
      return {
        content: [{ type: 'text' as const, text: 'Provide at least one of canvas_user_id or github_username.' }],
        isError: true,
      };
    }

    const targetFolder = (isMain && args.target_folder) ? args.target_folder : groupFolder;

    const data = {
      type: 'set_student_identity',
      targetFolder,
      canvasUserId: args.canvas_user_id || undefined,
      githubUsername: args.github_username || undefined,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    const parts: string[] = [];
    if (args.canvas_user_id) parts.push(`Canvas ID: ${args.canvas_user_id}`);
    if (args.github_username) parts.push(`GitHub: ${args.github_username}`);

    return {
      content: [{ type: 'text' as const, text: `Identity binding saved for ${targetFolder}: ${parts.join(', ')}` }],
    };
  },
);

// Start the stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
