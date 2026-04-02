/**
 * Teaching Patrol — Phase 1D
 * Auto-seeds a daily teaching patrol cron task for each student group.
 * The patrol reads COMPETENCY.md and decides whether proactive intervention is needed.
 */
import { CronExpressionParser } from 'cron-parser';

import { MAIN_GROUP_FOLDER, TIMEZONE } from './config.js';
import { createTask, getAllTasks } from './db.js';
import { logger } from './logger.js';
import { RegisteredGroup } from './types.js';

const PATROL_TAG = '[TEACHING_PATROL]';

const PATROL_PROMPT = `${PATROL_TAG}
You are running your daily Teaching Patrol. This is a proactive check — no student messaged you.

Instructions:
1. Read COMPETENCY.md for this student.
2. Read /workspace/global/COURSE_STATUS.md for latest Canvas/GitHub sync data (assignments, submissions, deadlines, GitHub activity). Use this instead of querying Canvas/GitHub directly — it's already synced.
3. Check the current date and course week (Week 1 starts Jan 6, 2026).
4. Evaluate each intervention trigger below. For EACH trigger, decide "intervene" or "no action" and log your reasoning.

Intervention triggers:
- 5+ days inactive + homework deadline approaching (due Monday 9am) → reach out with specific value, not nagging
- Low confidence (<0.4) on this week's topic + mock interview coming → offer targeted practice
- High confidence (>0.7) but low stability (<0.3) + 14+ days since last_evidence → spaced review needed
- Confirmed misconception not yet remediated → send targeted correction
- High confidence + scope missing "verbal" + mock interview within 2 days → offer verbal practice
- Prerequisite gap: student working on topic X but prerequisite Y confidence < 0.4 → address prerequisite first
- Canvas: assignment due within 24h + student has not submitted (check COURSE_STATUS.md) → proactive nudge
- Canvas: assignment past due + no submission → gentle check-in (not nagging)
- GitHub: no commits in 5+ days + assignment active → ask if they need help getting started
- Submission content: COURSE_STATUS.md "Submission Content Signals" shows topic thin/missing in report → target that gap

5. If ALL triggers evaluate to "no action needed":
   - Update the Proactive Intervention Log in COMPETENCY.md with your decision and reasoning.
   - DO NOT send any message. Do not send a message explaining why you're not sending a message. Just update COMPETENCY.md and stop.
   - Never leak internal reasoning to the student. Your patrol analysis is private.

6. If you decide to intervene (at least one trigger fires):
   - Use send_message to reach out to the student
   - Keep it warm and specific — reference what they were working on
   - Offer concrete value (practice question, concept check, resource)
   - ONE message only, ONE question only
   - Update the Proactive Intervention Log in COMPETENCY.md

CRITICAL: The student must NEVER see your patrol reasoning. No messages like "No action needed", "I checked and everything looks fine", "Just doing my daily check-in", etc. If there's nothing to act on, the student should not know a patrol ran at all.

Remember: 90% of patrols should result in "no action needed". Your value is in judgment, not volume.`;

/**
 * Check if a teaching patrol task already exists for a group folder.
 */
export function hasPatrolTask(groupFolder: string): boolean {
  const tasks = getAllTasks();
  return tasks.some(
    (t) =>
      t.group_folder === groupFolder &&
      t.prompt.includes(PATROL_TAG) &&
      t.status === 'active',
  );
}

/**
 * Seed teaching patrol tasks for all registered student groups.
 * Skips groups that already have an active patrol task.
 * Skips the main (admin) group.
 */
export function seedTeachingPatrol(
  registeredGroups: Record<string, RegisteredGroup>,
): void {
  let seeded = 0;

  for (const [jid, group] of Object.entries(registeredGroups)) {
    // Skip admin group
    if (group.folder === MAIN_GROUP_FOLDER) continue;

    // Skip if patrol already exists
    if (hasPatrolTask(group.folder)) continue;

    // Compute next run: weekdays 9am local time
    const cron = '0 9 * * 1-5';
    let nextRun: string;
    try {
      const interval = CronExpressionParser.parse(cron, { tz: TIMEZONE });
      const next = interval.next();
      nextRun = next.toISOString()!;
    } catch {
      logger.warn(
        { group: group.name },
        'Failed to parse patrol cron, skipping',
      );
      continue;
    }

    const taskId = `patrol-${group.folder}-${Date.now()}`;
    createTask({
      id: taskId,
      group_folder: group.folder,
      chat_jid: jid,
      prompt: PATROL_PROMPT,
      schedule_type: 'cron',
      schedule_value: cron,
      context_mode: 'group',
      next_run: nextRun,
      status: 'active',
      created_at: new Date().toISOString(),
    });

    seeded++;
    logger.info(
      { taskId, group: group.name, nextRun },
      'Teaching patrol task seeded',
    );
  }

  if (seeded > 0) {
    logger.info({ count: seeded }, 'Teaching patrol tasks seeded for student groups');
  }
}
