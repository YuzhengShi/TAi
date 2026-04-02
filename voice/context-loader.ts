/**
 * Context Loader — assembles all student data into a Nova Sonic system prompt.
 * Runs BEFORE the interview starts. Reuses existing Canvas/GitHub Python scripts.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { readEnvFile } from '../src/env.js';
import { InterviewContext } from './types.js';

const GROUPS_DIR = path.join(process.cwd(), 'groups');
const SCRIPTS_DIR = path.join(process.cwd(), 'container', 'scripts');

function getSecrets(): Record<string, string> {
  return readEnvFile([
    'CANVAS_API_TOKEN', 'CANVAS_BASE_URL', 'CANVAS_COURSE_ID',
    'GITHUB_TOKEN', 'GITHUB_BASE_URL',
    'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_REGION',
  ]);
}

/** Call a Python script with JSON on stdin, return parsed JSON. */
function callScript(script: string, input: Record<string, unknown>, secrets: Record<string, string>): unknown {
  try {
    const result = execSync(`python3 ${path.join(SCRIPTS_DIR, script)}`, {
      input: JSON.stringify(input),
      maxBuffer: 5 * 1024 * 1024,
      timeout: 15000,
      env: { ...process.env, ...secrets, PATH: process.env.PATH },
    });
    return JSON.parse(result.toString());
  } catch (err: unknown) {
    const stdout = (err as { stdout?: Buffer })?.stdout?.toString() || '';
    try { return JSON.parse(stdout); } catch { /* ignore */ }
    return { error: (err as Error).message };
  }
}

/** Parse COMPETENCY.md to extract student profile and weak spots. */
function parseCompetency(content: string): {
  name: string;
  canvasUserId: string;
  githubUsername: string;
  weakConcepts: string[];
  verbalGaps: string[];
  misconceptions: string[];
  competencySummary: string;
} {
  // Match "- Name: Yuzheng" or "**Name**: Yuzheng" or "Name: Yuzheng"
  const nameMatch = content.match(/^(?:[-*\s]*)?\**(?:Student name|Student|Name)\**:\s*([^\n\r]+)/im);
  const canvasMatch = content.match(/Canvas User ID:\s*(\d+)/i);
  const githubMatch = content.match(/GitHub:\s*(\S+)/i);

  // Parse mastery lines: "Concept name:\n  confidence: X | stability: Y | scope: [...] | via: [...]"
  const conceptPattern = /^([A-Z][^:\n]+?):\s*\n\s+confidence:\s*([\d.]+)\s*\|\s*stability:\s*([\d.]+)\s*\|\s*scope:\s*\[([^\]]*)\]/gm;
  const weakConcepts: string[] = [];
  const verbalGaps: string[] = [];
  let match;

  while ((match = conceptPattern.exec(content)) !== null) {
    const [, concept, confStr, , scopeStr] = match;
    const confidence = parseFloat(confStr);
    const scopes = scopeStr.split(',').map(s => s.trim().replace(/"/g, ''));

    if (confidence < 0.5 && confidence > 0) {
      weakConcepts.push(`${concept.trim()} (${confStr})`);
    }
    if (confidence >= 0.3 && !scopes.includes('verbal')) {
      verbalGaps.push(concept.trim());
    }
  }

  // Extract active misconceptions
  const misconceptions: string[] = [];
  const miscPattern = /- "([^"]+)"\s*\n\s+contradicts:/g;
  while ((match = miscPattern.exec(content)) !== null) {
    misconceptions.push(match[1]);
  }

  // Build a concise summary of the student's mastery state
  const lines: string[] = [];
  if (weakConcepts.length > 0) lines.push(`Weak concepts: ${weakConcepts.join(', ')}`);
  if (verbalGaps.length > 0) lines.push(`Verbal gaps (can't articulate): ${verbalGaps.join(', ')}`);
  if (misconceptions.length > 0) lines.push(`Active misconceptions: ${misconceptions.join('; ')}`);

  return {
    name: nameMatch?.[1]?.trim() || 'Unknown',
    canvasUserId: canvasMatch?.[1] || '',
    githubUsername: githubMatch?.[1] || '',
    weakConcepts,
    verbalGaps,
    misconceptions,
    competencySummary: lines.join('\n') || 'No prior mastery data available.',
  };
}

/** Build competency summary string from parsed arrays. */
function buildCompetencySummary(weakConcepts: string[], verbalGaps: string[], misconceptions: string[]): string {
  const lines: string[] = [];
  if (weakConcepts.length > 0) lines.push(`Weak concepts: ${weakConcepts.join(', ')}`);
  if (verbalGaps.length > 0) lines.push(`Verbal gaps (can't articulate): ${verbalGaps.join(', ')}`);
  if (misconceptions.length > 0) lines.push(`Active misconceptions: ${misconceptions.join('; ')}`);
  return lines.join('\n') || 'No prior mastery data available.';
}

/** Truncate text to maxChars, ending at a sentence boundary if possible. */
function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastPeriod = cut.lastIndexOf('.');
  if (lastPeriod > maxChars * 0.7) return cut.slice(0, lastPeriod + 1) + ' [...]';
  return cut + ' [...]';
}

/** Lightweight metadata load — just name/assignment/competency, no Sonnet, no scripts.
 * Used by /api/context to populate the frontend UI before the interview starts. */
export function loadInterviewMetadata(studentFolder: string): {
  studentName: string;
  assignmentName: string;
  weakConcepts: string[];
  verbalGaps: string[];
} {
  // Try pre-loaded JSON first
  const preloadPath = path.join(GROUPS_DIR, studentFolder, 'interview_context.json');
  if (fs.existsSync(preloadPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(preloadPath, 'utf-8'));
      return {
        studentName: raw.studentName || studentFolder,
        assignmentName: raw.assignmentName || 'Unknown',
        weakConcepts: raw.weakConcepts || [],
        verbalGaps: raw.verbalGaps || [],
      };
    } catch { /* fall through */ }
  }
  // Fall back to COMPETENCY.md
  const compPath = path.join(GROUPS_DIR, studentFolder, 'COMPETENCY.md');
  const comp = fs.existsSync(compPath)
    ? parseCompetency(fs.readFileSync(compPath, 'utf-8'))
    : { name: studentFolder, weakConcepts: [], verbalGaps: [] };
  return {
    studentName: comp.name,
    assignmentName: 'Unknown',
    weakConcepts: comp.weakConcepts,
    verbalGaps: comp.verbalGaps,
  };
}

/** Load all interview context for a student.
 * Prefers pre-loaded interview_context.json (written by start_mock_interview agent tool).
 * Falls back to calling Python scripts directly if not available. */
export async function loadInterviewContext(
  studentFolder: string,
  assignmentId?: string,
): Promise<InterviewContext> {
  // Fast path: agent pre-loaded context via start_mock_interview tool
  const preloadPath = path.join(GROUPS_DIR, studentFolder, 'interview_context.json');
  if (fs.existsSync(preloadPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(preloadPath, 'utf-8'));
      console.log(`[context-loader] Pre-loaded context for ${studentFolder}: spec=${raw.assignmentSpec?.length || 0}c, lecture=${raw.lectureContent?.length || 0}c, submission=${raw.submissionText?.length || 0}c, code=${raw.codeExcerpts?.length || 0}c`);
      const systemPrompt = buildSystemPrompt({
        studentName: raw.studentName || studentFolder,
        assignmentName: raw.assignmentName || 'Unknown',
        assignmentSpec: raw.assignmentSpec || '',
        lectureContent: raw.lectureContent || '',
        submissionText: raw.submissionText || '',
        codeExcerpts: raw.codeExcerpts || '',
        competencySummary: buildCompetencySummary(raw.weakConcepts || [], raw.verbalGaps || [], raw.misconceptions || []),
        weakConcepts: raw.weakConcepts || [],
        verbalGaps: raw.verbalGaps || [],
        misconceptions: raw.misconceptions || [],
      });
      return {
        studentFolder,
        studentName: raw.studentName || studentFolder,
        canvasUserId: raw.canvasUserId || '',
        githubUsername: raw.githubUsername || '',
        assignmentId: raw.assignmentId || '',
        assignmentName: raw.assignmentName || 'Unknown',
        systemPrompt,
        weakConcepts: raw.weakConcepts || [],
        verbalGaps: raw.verbalGaps || [],
        misconceptions: raw.misconceptions || [],
      };
    } catch (err) {
      console.warn(`[context-loader] Failed to parse interview_context.json, falling back to scripts:`, err);
    }
  }

  // Slow path: call Python scripts directly
  console.log(`[context-loader] No pre-loaded context for ${studentFolder}, calling scripts...`);
  const secrets = getSecrets();

  // 1. Read COMPETENCY.md
  const compPath = path.join(GROUPS_DIR, studentFolder, 'COMPETENCY.md');
  const compContent = fs.existsSync(compPath)
    ? fs.readFileSync(compPath, 'utf-8')
    : '';
  const comp = parseCompetency(compContent);

  // 2. Get assignments and pick target
  let targetAssignment: { id: string; name: string; description: string } = {
    id: assignmentId || '', name: 'Unknown', description: '',
  };

  if (secrets.CANVAS_API_TOKEN) {
    const assignments = callScript('canvas_api.py', { action: 'assignments' }, secrets) as Array<Record<string, string>>;
    if (Array.isArray(assignments)) {
      if (assignmentId) {
        const found = assignments.find(a => String(a.id) === String(assignmentId));
        if (found) targetAssignment = { id: String(found.id), name: found.name || '', description: '' };
      } else {
        // Pick most recent past-due or soonest upcoming
        const now = new Date();
        const sorted = assignments
          .filter(a => a.due_at)
          .sort((a, b) => new Date(b.due_at).getTime() - new Date(a.due_at).getTime());
        const pastDue = sorted.find(a => new Date(a.due_at) <= now);
        const target = pastDue || sorted[sorted.length - 1];
        if (target) targetAssignment = { id: String(target.id), name: target.name || '', description: '' };
      }
    }

    // 3. Get assignment detail
    if (targetAssignment.id) {
      const detail = callScript('canvas_api.py', {
        action: 'assignment_detail',
        params: { assignment_id: targetAssignment.id },
      }, secrets) as Record<string, string>;
      if (detail && !('error' in detail)) {
        targetAssignment.name = detail.name || targetAssignment.name;
        targetAssignment.description = detail.description || '';
      }
    }
  }

  // 4. Get student submission
  let submissionText = '';
  if (secrets.CANVAS_API_TOKEN && targetAssignment.id && comp.canvasUserId) {
    const sub = callScript('canvas_api.py', {
      action: 'student_submission',
      params: { assignment_id: targetAssignment.id, user_id: comp.canvasUserId },
    }, secrets) as Record<string, unknown>;
    if (sub && !('error' in sub)) {
      submissionText = String(sub.body || sub.submission_body || sub.text || '');
    }
  }

  // 5. Get student code from GitHub
  let codeExcerpts = '';
  if (secrets.GITHUB_TOKEN && comp.githubUsername) {
    // Try to find a relevant repo (match assignment name or look for recent)
    const repos = callScript('github_api.py', {
      action: 'list_repos',
      params: { user: comp.githubUsername },
    }, secrets) as Array<Record<string, string>>;

    if (Array.isArray(repos) && repos.length > 0) {
      // Pick the most recently updated repo
      const sorted = repos.sort((a, b) =>
        new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime(),
      );
      const repo = sorted[0];
      if (repo?.name) {
        // Get repo tree
        const tree = callScript('github_api.py', {
          action: 'repo_tree',
          params: { owner: comp.githubUsername, repo: repo.name },
        }, secrets) as Array<Record<string, string>>;

        if (Array.isArray(tree)) {
          // Read key files (main.go, Dockerfile, or most relevant)
          const keyFiles = tree
            .filter(f => f.type === 'file')
            .filter(f => /\.(go|py|java|js|ts|tf|yaml|yml|dockerfile)$/i.test(f.name) || f.name === 'Dockerfile')
            .slice(0, 3);

          const excerpts: string[] = [];
          for (const f of keyFiles) {
            const content = callScript('github_api.py', {
              action: 'file_content',
              params: { owner: comp.githubUsername, repo: repo.name, path: f.name },
            }, secrets) as Record<string, string>;
            if (content?.content) {
              excerpts.push(`--- ${f.name} ---\n${truncate(content.content, 600)}`);
            }
          }
          codeExcerpts = excerpts.join('\n\n');
        }
      }
    }
  }

  // 6. Build system prompt
  const systemPrompt = buildSystemPrompt({
    studentName: comp.name,
    assignmentName: targetAssignment.name,
    assignmentSpec: truncate(targetAssignment.description, 1500),
    lectureContent: '',
    submissionText: truncate(submissionText, 1500),
    codeExcerpts: truncate(codeExcerpts, 2000),
    competencySummary: comp.competencySummary,
    weakConcepts: comp.weakConcepts,
    verbalGaps: comp.verbalGaps,
    misconceptions: comp.misconceptions,
  });

  return {
    studentFolder,
    studentName: comp.name,
    canvasUserId: comp.canvasUserId,
    githubUsername: comp.githubUsername,
    assignmentId: targetAssignment.id,
    assignmentName: targetAssignment.name,
    systemPrompt,
    weakConcepts: comp.weakConcepts,
    verbalGaps: comp.verbalGaps,
    misconceptions: comp.misconceptions,
  };
}

function buildSystemPrompt(data: {
  studentName: string;
  assignmentName: string;
  assignmentSpec: string;
  lectureContent: string;
  submissionText: string;
  codeExcerpts: string;
  competencySummary: string;
  weakConcepts: string[];
  verbalGaps: string[];
  misconceptions: string[];
}): string {
  return `You are TAi, a fellow grad-student TA for CS6650 Building Scalable Distributed Systems at Northeastern, taught by Professor Yvonne Coady. You're having a practice mock interview with ${data.studentName} about ${data.assignmentName}. Think of this as a chill study session where you're helping them prep — not an exam.

## THIS IS A VOICE INTERFACE

Everything you generate is spoken aloud immediately. Only generate the words you are speaking to them. No thinking steps, no meta-commentary, no formatting.

## RULES

1. ONE sentence per turn. Keep it short and natural.
2. ONE question per turn. Never stack two questions.
3. Don't answer your own question. Ask it, then wait. Only explain if they ask you to.
4. NEVER speak evaluation results. Tool results are internal — no scores, no "missed concepts". Use them silently to guide your next question.

## WHO YOU ARE

You're a friendly grad student who's been through this course. You genuinely want them to do well, and you know mock interviews can be stressful, so you keep things relaxed. You're not here to grill anyone — you're here to help them practice thinking out loud.

- Be conversational and natural. Use filler: "hmm", "right", "okay so...", "yeah that makes sense"
- Match their energy. If they're nervous, slow down and be warm. If they're vibing, match that.
- Let casual moments be casual. If they crack a joke or go off-topic briefly, roll with it for a beat before coming back.
- It's totally fine if they say "I'm not sure" — that's honest and you respect it.
- Remember they're a person, not a knowledge dispenser. This is practice, not judgment.

## TONE — chill but curious

You're genuinely curious about how they think. Not testing them — exploring ideas together.

- Acknowledge good stuff naturally: "oh nice, yeah exactly", "right that's the key thing"
- If they're nervous: "no pressure, just walk me through your thinking"
- Short reactions are great: "okay", "got it", "interesting", "hmm yeah"
- If they're struggling, don't make it weird. Just simplify or move on casually.
- Never be pushy. If a topic isn't clicking, try a different angle or just move on — "no worries, let's talk about something else"

When they're stuck ("I don't know" or going quiet), you can give a brief hint or ask something easier. No big deal.

## How you talk

Like a real person in a conversation. Use filler naturally: "hmm", "yeah", "right", "so basically", "I mean". Never start with "Great question!". Celebrate wins casually: "oh nice, yeah exactly."

## Opening — chit-chat first

Start with a brief casual chat before going anywhere near the homework. Ask about how things are going, how the course is treating them, anything low-stakes. Let them settle in. A couple exchanges is enough — when the conversation naturally winds down or they seem ready, transition into the interview. Don't announce the transition ("okay let's start the interview") — just ease into it organically, like "alright, so tell me about your assignment..."

## What to cover

You have about 15 minutes (after the chit-chat). Use the student's competency data, their submission, and the assignment spec below to decide what's most worth exploring. You might ask about their code, the concepts behind it, edge cases, tradeoffs — whatever makes sense given where they are. Follow the conversation naturally — if one topic opens up something interesting, go with it. Just make sure you cover enough breadth overall.

Reference THEIR specific work — their code, their submission, their design choices. Not generic textbook stuff.

${data.weakConcepts.length > 0 ? `They're weaker on ${data.weakConcepts.map(c => c.split(' (')[0]).join(', ')} — ease into these with recall questions like "walk me through what happens when..." If they can't get it after a couple tries, give a small hint and move on. No pressure.` : ''}

${data.verbalGaps.length > 0 ? `They know these but haven't practiced saying them out loud yet (${data.verbalGaps.join(', ')}). Gently nudge: "how would you explain that to someone who hasn't seen your code?"` : ''}

For stuff they're strong on: push to edge cases — "what happens at 1000 concurrent users?", "what if a node dies mid-request?"

${data.misconceptions.filter(m => !m.startsWith('[')).length > 0 ? `They might have some misconceptions — don't call them out directly, just ask questions that help them think through it:\n${data.misconceptions.filter(m => !m.startsWith('[')).map(m => `- "${m}"`).join('\n')}` : ''}

If they're stuck, try a different angle:
- A simpler real-life analogy: "it's like having 4 friends each sorting 13 cards then merging"
- Or just a simpler version of the question
- Each attempt should come from a different direction — don't just repeat yourself
- And if it's still not clicking, genuinely no worries, just move on

## The conversation

Open with: "hey ${data.studentName.split(' ')[0]}, how's it going?" and let the chit-chat happen naturally. When it feels right, ease into the homework.

When wrapping up: mention something specific they did well, maybe one thing to think about, and keep it warm. "You're in good shape, nice work."

---

${data.competencySummary !== 'No prior mastery data available.' ? `About ${data.studentName}:\n${data.competencySummary}` : ''}

${data.assignmentName}:
${data.assignmentSpec || 'No spec available.'}

${data.lectureContent ? `This week's course material:\n${data.lectureContent}` : ''}

${data.submissionText ? `Their submission:\n${data.submissionText}` : ''}

${data.codeExcerpts ? `Their code:\n${data.codeExcerpts}` : ''}

---

After each substantive answer, call evaluate_answer silently. Do not say anything while calling it. When the tool result comes back, DO NOT READ IT ALOUD — no numbers, no scores, no "missed concepts". Just silently use the result to pick your next question.`;
}
