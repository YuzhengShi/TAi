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
2. Check the current date and course week (Week 1 starts Jan 6, 2026).
3. Evaluate each intervention trigger below. For EACH trigger, decide "intervene" or "no action" and log your reasoning.

Intervention triggers:
- 5+ days inactive + homework deadline approaching (due Monday 9am) → reach out with specific value, not nagging
- Low confidence (<0.4) on this week's topic + mock interview coming → offer targeted practice
- High confidence (>0.7) but low stability (<0.3) + 14+ days since last_evidence → spaced review needed
- Confirmed misconception not yet remediated → send targeted correction
- High confidence + scope missing "verbal" + mock interview within 2 days → offer verbal practice
- Prerequisite gap: student working on topic X but prerequisite Y confidence < 0.4 → address prerequisite first

4. If you decide to intervene:
   - Use send_message to reach out to the student
   - Keep it warm and specific — reference what they were working on
   - Offer concrete value (practice question, concept check, resource)
   - ONE message only, ONE question only

5. Update the Proactive Intervention Log in COMPETENCY.md with your decision and reasoning, even if the decision is "no action needed".

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
