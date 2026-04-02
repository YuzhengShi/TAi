/**
 * Post-interview competency updater.
 *
 * Hierarchical structure:
 *   COMPETENCY.md           — index: mastery scores, mock interview summary
 *   competency/interviews.md — full interview history (prepended, newest first)
 *   competency/strategy-log.md — teaching strategy log (prepended)
 */
import fs from 'fs';
import path from 'path';

import { InterviewSummary } from './types.js';

const GROUPS_DIR = path.join(process.cwd(), 'groups');

/** Update competency files with interview results. */
export function writeInterviewResults(summary: InterviewSummary): void {
  const groupDir = path.join(GROUPS_DIR, summary.studentFolder);
  const compPath = path.join(groupDir, 'COMPETENCY.md');
  const competencyDir = path.join(groupDir, 'competency');

  if (!fs.existsSync(compPath)) {
    console.error(`COMPETENCY.md not found for ${summary.studentFolder}`);
    return;
  }

  // Ensure competency/ subdirectory exists
  fs.mkdirSync(competencyDir, { recursive: true });

  // ── 1. Update COMPETENCY.md (index) ─────────────────────────────────────────

  let index = fs.readFileSync(compPath, 'utf-8');

  // Update mastery lines: add "verbal" to scope and "mock_interview" to via.
  // Compact format: "concept name: conf | stab | [scope1, scope2] | [via1, via2] | date"
  for (const topic of summary.topicsCovered) {
    const escapedTopic = topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Matches: "Some Concept Name: 0.5 | 0.3 | [theoretical, implementation] | [homework] | 2026-03-18"
    const pattern = new RegExp(
      `(${escapedTopic}[^:]*:\\s*[\\d.]+\\s*\\|\\s*[\\d.]+\\s*\\|\\s*\\[)([^\\]]*)(\\]\\s*\\|\\s*\\[)([^\\]]*)(\\]\\s*\\|\\s*)\\S+`,
      'i',
    );
    const match = index.match(pattern);
    if (match) {
      let scope = match[2].trim();
      let via = match[4].trim();
      if (!scope.includes('verbal')) {
        scope = scope ? `${scope}, verbal` : 'verbal';
      }
      if (!via.includes('mock_interview')) {
        via = via ? `${via}, mock_interview` : 'mock_interview';
      }
      index = index.replace(match[0], `${match[1]}${scope}${match[3]}${via}${match[5]}${summary.date}`);
    }
  }

  // Update Mock Interview Summary block
  const overall = getOverallRating(summary);
  const avgScore = (
    summary.rubric.verbal_clarity +
    summary.rubric.technical_accuracy +
    summary.rubric.depth_of_reasoning +
    summary.rubric.problem_solving_process
  ) / 4;
  const newSummaryBlock = `## Mock Interview Summary

- Best session: ${summary.date} (${summary.assignmentName}, ${summary.durationMinutes} min) — ${overall}: clarity ${summary.rubric.verbal_clarity}/5, accuracy ${summary.rubric.technical_accuracy}/5, depth ${summary.rubric.depth_of_reasoning}/5, process ${summary.rubric.problem_solving_process}/5
- Consistent gap: depth_of_reasoning (check interviews.md for pattern)
- Verbal scope earned: ${summary.topicsCovered.length > 0 ? summary.topicsCovered.join(', ') : 'none this session'}
- Average score this session: ${avgScore.toFixed(1)}/5
- → Full history + upcoming focus: \`competency/interviews.md\``;

  index = index.replace(/## Mock Interview Summary[\s\S]*?(?=\n## |\n$|$)/, newSummaryBlock + '\n');

  // Update last updated timestamp
  index = index.replace(/Last updated:.*$/m, `Last updated: ${summary.date}`);

  fs.writeFileSync(compPath, index, 'utf-8');

  // ── 2. Prepend to competency/interviews.md ───────────────────────────────────

  const interviewsPath = path.join(competencyDir, 'interviews.md');

  const historyEntry = `- Week ${getWeekNumber()} (${summary.date}): ${summary.assignmentName}
  Overall: ${overall}
  Strengths: ${summary.strengths.join(', ') || 'none noted'}
  Weaknesses: ${summary.weaknesses.length > 0 ? summary.weaknesses.join(', ') : 'none noted'}
  Rubric scores: verbal_clarity: ${summary.rubric.verbal_clarity}/5, technical_accuracy: ${summary.rubric.technical_accuracy}/5, depth_of_reasoning: ${summary.rubric.depth_of_reasoning}/5, problem_solving_process: ${summary.rubric.problem_solving_process}/5
  Strategy used: VOICE_INTERVIEW (Nova 2 Sonic, ${summary.durationMinutes} min)
  Follow-up needed: ${summary.weaknesses.length > 0 ? summary.weaknesses[0] : 'none'}

`;

  if (!fs.existsSync(interviewsPath)) {
    // Bootstrap the file with the standard header
    const header = `# Interview History

## Upcoming Interview Focus
- Week: [update manually]
- Homework: [update manually]

## Verbal vs Written Gap Analysis
- Concepts missing verbal scope: [auto-populated from COMPETENCY.md mastery scores]

## Interview History (most recent first)

`;
    fs.writeFileSync(interviewsPath, header + historyEntry, 'utf-8');
  } else {
    // Prepend after the "## Interview History" header line
    let interviews = fs.readFileSync(interviewsPath, 'utf-8');
    const marker = '## Interview History (most recent first)';
    const idx = interviews.indexOf(marker);
    if (idx !== -1) {
      const insertAt = idx + marker.length + 1; // after the newline
      interviews = interviews.slice(0, insertAt) + '\n' + historyEntry + interviews.slice(insertAt);
    } else {
      interviews = historyEntry + interviews;
    }
    fs.writeFileSync(interviewsPath, interviews, 'utf-8');
  }

  // ── 3. Prepend to competency/strategy-log.md ─────────────────────────────────

  const strategyPath = path.join(competencyDir, 'strategy-log.md');

  // Skip zero-score test sessions (0-min or all-zero rubric with < 3 min)
  const isTestSession = summary.durationMinutes < 3 &&
    summary.rubric.verbal_clarity === 0 &&
    summary.rubric.technical_accuracy === 0 &&
    summary.rubric.depth_of_reasoning === 0 &&
    summary.rubric.problem_solving_process === 0;

  if (!isTestSession) {
    const strategyEntry = `- ${summary.date}: VOICE_INTERVIEW on ${summary.assignmentName} — ${summary.durationMinutes} min, ${summary.topicsCovered.length} topics covered. Rubric: clarity ${summary.rubric.verbal_clarity}/5, accuracy ${summary.rubric.technical_accuracy}/5, depth ${summary.rubric.depth_of_reasoning}/5, process ${summary.rubric.problem_solving_process}/5\n\n`;

    if (!fs.existsSync(strategyPath)) {
      const header = `# Teaching Strategy Log

`;
      fs.writeFileSync(strategyPath, header + strategyEntry, 'utf-8');
    } else {
      let strategies = fs.readFileSync(strategyPath, 'utf-8');
      // Prepend after the first heading
      const headingEnd = strategies.indexOf('\n\n');
      const insertAt = headingEnd !== -1 ? headingEnd + 2 : 0;
      strategies = strategies.slice(0, insertAt) + strategyEntry + strategies.slice(insertAt);
      fs.writeFileSync(strategyPath, strategies, 'utf-8');
    }
  }

  console.log(`Updated competency files for ${summary.studentFolder} (${overall}, ${summary.durationMinutes} min${isTestSession ? ', skipped strategy log' : ''})`);
}

function getOverallRating(summary: InterviewSummary): string {
  const avg = (
    summary.rubric.verbal_clarity +
    summary.rubric.technical_accuracy +
    summary.rubric.depth_of_reasoning +
    summary.rubric.problem_solving_process
  ) / 4;
  if (avg >= 4) return 'strong';
  if (avg >= 2.5) return 'adequate';
  return 'needs-work';
}

function getWeekNumber(): number {
  // Week 1 starts Jan 6, 2026
  const weekOneStart = new Date('2026-01-06T00:00:00');
  const now = new Date();
  return Math.max(1, Math.ceil((now.getTime() - weekOneStart.getTime()) / (7 * 24 * 60 * 60 * 1000)));
}
