import { MAX_MESSAGE_LENGTH, TIMEZONE } from './config.js';
import { Channel, NewMessage } from './types.js';

export function escapeXml(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', { timeZone: TIMEZONE });
  } catch {
    return iso;
  }
}

export function formatMessages(messages: NewMessage[]): string {
  const lines = messages.map((m) => {
    let content = m.content;
    if (content.length > MAX_MESSAGE_LENGTH) {
      content = content.slice(0, MAX_MESSAGE_LENGTH) + `\n[... truncated — original was ${content.length} chars]`;
    }
    return `<message id="${escapeXml(m.id)}" sender="${escapeXml(m.sender_name)}" time="${formatTimestamp(m.timestamp)}">${escapeXml(content)}</message>`;
  });
  return `<messages>\n${lines.join('\n')}\n</messages>`;
}

export function stripInternalTags(text: string): string {
  return text
    .replace(/<internal>[\s\S]*?<\/internal>/g, '')  // closed tags
    .replace(/<internal>[\s\S]*$/g, '')               // unclosed tag → strip to end
    .replace(/Human:\s*<messages>[\s\S]*/g, '')                // hallucinated Human turn → strip everything after
    .replace(/<messages>[\s\S]*?<\/messages>/g, '')           // bare message XML (closed)
    .replace(/<messages>[\s\S]*$/g, '')                       // bare message XML (unclosed)
    .replace(/<message\s+[^>]*>[\s\S]*?<\/message>/g, '')   // individual <message> tags (closed)
    .replace(/<message\s+[^>]*>[\s\S]*$/g, '')               // individual <message> tag (unclosed)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Fingerprint phrases from system prompt files that should never appear in student-facing output.
// These are unique enough to not occur in normal conversation but reliably identify leakage.
const SYSTEM_PROMPT_FINGERPRINTS = [
  'Six-Step Pedagogical Reasoning Loop',
  'COMPETENCY_PROTOCOL.md',
  'TEACHING_STRATEGIES.md',
  'COURSE_REFERENCE.md',
  'createSanitizeBashHook',
  'createCompetencyGuardHook',
  'mcp__nanoclaw__',
  'mcp__leanrag__',
  'hookEventName',
  'PreToolUse',
  'permissionMode',
  'bypassPermissions',
  'NANOCLAW_IS_MAIN',
  'NANOCLAW_CHAT_JID',
  'NANOCLAW_GROUP_FOLDER',
  'writeIpcFile',
  'boundCanvasUserId',
  'boundGithubUsername',
  'hasFullAccess',
  'Proactive Intervention Log',
  'Teaching Strategy Log',
  'confidence_delta',
  'stability_delta',
  'COMPETENCY.md',
];

/**
 * Detect and redact system prompt leakage from agent output.
 * Returns the cleaned text, or a replacement message if heavily contaminated.
 */
function redactSystemPromptLeakage(text: string): string {
  // Count fingerprints against original text first
  let leakCount = 0;
  for (const fp of SYSTEM_PROMPT_FINGERPRINTS) {
    if (text.includes(fp)) leakCount++;
  }

  // If heavily contaminated (3+ fingerprints), replace entire output
  if (leakCount >= 3) {
    return "hmm, I got a bit confused there — what were we talking about?";
  }

  // For 1-2 fingerprints, redact the sentences containing them
  if (leakCount > 0) {
    let cleaned = text;
    for (const fp of SYSTEM_PROMPT_FINGERPRINTS) {
      if (cleaned.includes(fp)) {
        const escaped = fp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cleaned = cleaned.replace(new RegExp(`[^.!?\\n]*${escaped}[^.!?\\n]*[.!?]?`, 'g'), '[redacted]');
      }
    }
    return cleaned;
  }

  return text;
}

export function formatOutbound(rawText: string): string {
  let text = stripInternalTags(rawText);
  if (!text) return '';
  text = redactSystemPromptLeakage(text);
  return text;
}

export function routeOutbound(
  channels: Channel[],
  jid: string,
  text: string,
): Promise<void> {
  const channel = channels.find((c) => c.ownsJid(jid) && c.isConnected());
  if (!channel) throw new Error(`No channel for JID: ${jid}`);
  return channel.sendMessage(jid, text);
}

export function findChannel(
  channels: Channel[],
  jid: string,
): Channel | undefined {
  return channels.find((c) => c.ownsJid(jid));
}
