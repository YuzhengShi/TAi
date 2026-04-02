/**
 * Course Sync — Periodic Canvas + GitHub data sync
 * Auto-seeds a recurring task in the main group that queries Canvas and GitHub,
 * then writes COURSE_STATUS.md to the global workspace for teaching patrols.
 */
import { CronExpressionParser } from 'cron-parser';

import { MAIN_GROUP_FOLDER, TIMEZONE } from './config.js';
import { createTask, getAllTasks } from './db.js';
import { logger } from './logger.js';
import { RegisteredGroup } from './types.js';

const SYNC_TAG = '[COURSE_SYNC]';

// Every 6 hours: 2am, 8am, 2pm, 8pm Pacific
const SYNC_CRON = '0 2,8,14,20 * * *';

const SYNC_PROMPT = `${SYNC_TAG}
You are running a periodic Course Sync. This is an automated background task — do NOT send messages to the chat. Wrap ALL output in <internal> tags.

Your job: query ALL Canvas course data and GitHub activity, then write a comprehensive COURSE_STATUS.md to /workspace/project/groups/global/COURSE_STATUS.md.

First, read the existing COURSE_STATUS.md to see previous state — you will note what changed in the Alerts section.

## Part 1: Canvas — Course Content

Query these in parallel where possible:

a) Syllabus and course info:
   canvas_query({ action: "syllabus" })

b) Modules (course structure and materials):
   canvas_query({ action: "modules" })

c) Pages (wiki pages — course policies, resources, guides):
   canvas_query({ action: "pages" })
   - For important pages (syllabus, getting-started, etc.), get content:
     canvas_query({ action: "page_detail", params: { page_url: "<slug>" } })

d) Course files (uploaded materials — slides, readings):
   canvas_query({ action: "files" })

e) Announcements (instructor posts):
   canvas_query({ action: "announcements" })

f) Discussions (student discussions):
   canvas_query({ action: "discussions" })
   - For active discussions with recent posts, get entries:
     canvas_query({ action: "discussion_entries", params: { topic_id: "<id>" } })

## Part 2: Canvas — Assignments & Submissions

g) All assignments with due dates:
   canvas_query({ action: "assignments" })

h) Upcoming assignments:
   canvas_query({ action: "upcoming" })

i) Enrolled students:
   canvas_query({ action: "users" })

j) For each upcoming/recent assignment, get submission status:
   canvas_query({ action: "submissions", params: { assignment_id: "<id>" } })

## Part 2.5: Follow External Links in Canvas Content

Canvas content (assignments, announcements, pages) often contains external links — tutorials, documentation, readings, videos, tools. These show up as "Links to an external site" in Canvas.

For each piece of Canvas content you retrieve, scan for URLs. For important links (tutorials, readings, reference material linked from assignments or announcements):

1. Use agent-browser to visit the URL:
   \`agent-browser open <url>\`
   \`agent-browser snapshot\`  (to see the page content)
   \`agent-browser text\`     (to extract readable text)

2. Summarize what the link contains (1-2 sentences).

3. Add to the "External Resources" section of COURSE_STATUS.md.

Rules:
- READ-ONLY. Never click "submit", "post", "edit", "delete", or any form action. Only read.
- For YouTube links: call youtube_info({ url: "<url>" }) to get title, description, channel, duration, tags.
  Log in External Resources with a one-line summary based on the description.
  The description often has timestamps and key points — capture those.
- Skip login-required pages that aren't Canvas (just note "requires login").
- For Canvas-internal links, use canvas_query instead of agent-browser.
- Max 10 links per sync — prioritize links from upcoming/active assignments and recent announcements.
- If agent-browser fails on a link, just note the URL and move on.

## Part 2.7: Submission Content Analysis

For the 2 most recently graded assignments, fetch individual student submissions to extract understanding signals:

  canvas_query({ action: "student_submission", params: { assignment_id: "<id>", user_id: "<uid>" } })

For each submission that has a text body or attached report:
- Scan for evidence of conceptual understanding vs just code output
- Note topics the student discusses well (tradeoffs, design decisions, analysis)
- Note topics that are thin or missing from their report
- Flag any confusion or misconceptions visible in written content

Write findings to the "Submission Content Signals" section of COURSE_STATUS.md.

Rules:
- Max 3 tool calls total for this section — don't fetch every student × every assignment
- Focus on students who are registered (have groups)
- If submissions aren't text-accessible (e.g. file uploads without text), skip
- Keep signals concise: 1-2 lines per student per assignment

## Part 3: GitHub Activity

k) Student repos:
   github_query({ action: "list_repos", params: { org: "<org>" } })
   - For active repos, check recent commits:
     github_query({ action: "commits", params: { owner: "<owner>", repo: "<repo>" } })

## Part 4: Write COURSE_STATUS.md

Write /workspace/project/groups/global/COURSE_STATUS.md with ALL sections:

# Course Status
Last synced: <timestamp>

## Syllabus Summary
(key info from syllabus: grading policy, office hours, important dates)

## Course Structure (Modules)
| Module | Topics | Materials |
(what each module covers, key resources listed)

## Announcements (Recent)
| Date | Title | Summary |
(last 10 announcements, one-line summary each)

## Active Discussions
| Topic | Posts | Last Activity | Key Themes |
(active discussions, summarize what students are talking about)

## Course Files (Recent)
| File | Type | Updated |
(recently updated files — slides, readings, handouts)

## External Resources (from links in Canvas content)
| Source | URL | Summary |
(links found in assignments/announcements/pages — what each link contains, 1-line summary)

## Assignments
| Name | Due Date | Status | Points |
(all assignments, mark past/active/upcoming)

## Upcoming Deadlines
(assignments due within 7 days, sorted by date — highlight anything due within 24h)

## Student Submission Status
### <student name>
| Assignment | Submitted | Late | Score |
(for each student, submission status on recent/upcoming assignments)

## Submission Content Signals
### <student name>
| Assignment | Topics Strong | Topics Thin/Missing | Notes |
(evidence of understanding from written reports — what they explained well vs glossed over)

## GitHub Activity
### <student name>
- Last commit: <date>
- Active repos: <list>
- Recent commits: <count in last 7 days>

## Alerts
(flag notable changes since last sync)
- New announcements from instructor
- Discussion topics with high activity or unanswered questions
- Approaching deadlines with missing submissions
- Students with no GitHub activity in 5+ days
- New course materials uploaded
- Any errors during sync

## Sync Errors
(if any query failed, log the error here and continue)

IMPORTANT:
- This is a SILENT background task. Do NOT send any messages. Wrap everything in <internal> tags.
- If Canvas or GitHub tokens are not configured, note it and skip those sections.
- If a query fails, log the error in Sync Errors and continue with other queries.
- Keep the file under 300 lines — summarize verbose data.
- For discussions, summarize themes rather than listing every post.
- For announcements, include the full message only for the most recent 3; one-line summary for the rest.`;

/**
 * Check if a course sync task already exists.
 */
export function hasSyncTask(): boolean {
  const tasks = getAllTasks();
  return tasks.some(
    (t) =>
      t.group_folder === MAIN_GROUP_FOLDER &&
      t.prompt.includes(SYNC_TAG) &&
      t.status === 'active',
  );
}

/**
 * Seed the course sync task for the main group.
 * Skips if one already exists.
 */
export function seedCourseSync(
  registeredGroups: Record<string, RegisteredGroup>,
): void {
  // Find the main group JID
  const mainEntry = Object.entries(registeredGroups).find(
    ([, g]) => g.folder === MAIN_GROUP_FOLDER,
  );

  if (!mainEntry) {
    logger.debug('Main group not registered, skipping course sync seed');
    return;
  }

  if (hasSyncTask()) {
    logger.debug('Course sync task already exists, skipping seed');
    return;
  }

  const [mainJid] = mainEntry;

  let nextRun: string;
  try {
    const interval = CronExpressionParser.parse(SYNC_CRON, { tz: TIMEZONE });
    nextRun = interval.next().toISOString()!;
  } catch {
    logger.warn('Failed to parse course sync cron, skipping');
    return;
  }

  const taskId = `course-sync-${Date.now()}`;
  createTask({
    id: taskId,
    group_folder: MAIN_GROUP_FOLDER,
    chat_jid: mainJid,
    prompt: SYNC_PROMPT,
    schedule_type: 'cron',
    schedule_value: SYNC_CRON,
    context_mode: 'isolated',
    next_run: nextRun,
    status: 'active',
    created_at: new Date().toISOString(),
  });

  logger.info(
    { taskId, nextRun },
    'Course sync task seeded (every 6h)',
  );
}
