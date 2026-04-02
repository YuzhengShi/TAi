/**
 * Competency Bootstrap — Initialize COMPETENCY.md from Canvas grades
 * Runs once per student group when registered. Queries Canvas for grades
 * and submission content, then initializes mastery scores instead of 0.0.
 */
import { createTask } from './db.js';
import { logger } from './logger.js';

const BOOTSTRAP_TAG = '[COMPETENCY_BOOTSTRAP]';

const BOOTSTRAP_PROMPT = `${BOOTSTRAP_TAG}
You are running a one-time COMPETENCY bootstrap for a new student. This is an automated background task — do NOT send any message to the student. Wrap ALL output in <internal> tags.

Your job: query Canvas for this student's grades and submission content, then initialize COMPETENCY.md with non-zero scores based on what they've already completed.

## Step 1: Identify the student

Read COMPETENCY.md to get the student's name. Then get the enrolled users list:
  canvas_query({ action: "users" })

Find the matching user_id for this student.

IMPORTANT: Once you find the user_id, immediately persist it for access control:
  set_student_identity({ canvas_user_id: "<user_id>" })

If you also find their GitHub username (from submission URLs), include it:
  set_student_identity({ canvas_user_id: "<user_id>", github_username: "<username>" })

## Step 2: Get all assignments and grades

  canvas_query({ action: "assignments" })
  canvas_query({ action: "grades" })

## Step 3: Map assignments to competency concepts

Each homework covers specific weekly topics. Use the assignment name/number and COURSE_REFERENCE.md to determine which competency concepts it tests. General mapping:

- HW1 (Go basics, REST API, EC2) → Go programming basics, RESTful API design, AWS EC2, cross-compilation, security groups, performance testing, Tail latency
- HW2 (Docker, deployment) → Docker concepts, Docker deployment to EC2, Container vs VM
- HW3 (Terraform, IaC) → Terraform / Infrastructure as Code, MapReduce paper concepts
- HW4 (Distributed fundamentals) → Distributed systems fundamentals, Client-server architecture, Stateless vs stateful
- HW5 (Scalable design) → Scalable service design patterns
- HW6 (Load testing, threads) → Load testing methodology, Concurrency and threads, Response time distributions
- HW7/8 (CAP, consistency) → CAP theorem, Consistency models, Availability vs consistency tradeoffs
- HW9 (Async, serverless) → Asynchronous processing, Message queues (Kafka), Serverless (AWS Lambda), Event-driven architecture
- HW10 (Deployment, observability) → Deployment strategies, Observability

If the assignment name doesn't clearly match, read the assignment detail:
  canvas_query({ action: "assignment_detail", params: { assignment_id: "<id>" } })

## Step 4: Compute initial scores

For each assignment the student has submitted and been graded on:

Score-to-confidence mapping:
- 90-100% → confidence: 0.5, stability: 0.3, scope: [implementation], via: [homework]
- 80-89%  → confidence: 0.4, stability: 0.2, scope: [implementation], via: [homework]
- 70-79%  → confidence: 0.3, stability: 0.2, scope: [implementation], via: [homework]
- 60-69%  → confidence: 0.2, stability: 0.1, scope: [implementation], via: [homework]
- Below 60% → confidence: 0.1, stability: 0.1, scope: [], via: [homework]
- Not submitted → leave at 0.0 (default)

IMPORTANT: These are STARTING points, not final assessments. The agent will refine through interaction. Cap initial confidence at 0.5 — homework completion proves implementation ability but doesn't prove verbal/theoretical mastery.

Scope is [implementation] only — homework proves they built something, not that they can explain it. "verbal" and "theoretical" must be earned through conversation.

## Step 5: Fetch submission content for deeper signal (optional)

For the 3 most recent graded assignments, try to read the submission content:
  canvas_query({ action: "student_submission", params: { assignment_id: "<id>", user_id: "<uid>" } })

If the submission includes a text body or report URL, read it. Look for:
- Evidence of conceptual understanding (not just code) → add "theoretical" to scope
- Discussion of tradeoffs or design decisions → boost confidence +0.05
- Confusion or errors in the report → note as potential misconception candidates

Do NOT spend more than 3 tool calls on submission content. If submissions aren't accessible, skip this step.

## Step 6: Update COMPETENCY.md

Update the mastery score lines in COMPETENCY.md with the computed values. Also update:
- last_evidence: set to the submission date for each concept
- Student Profile: add any initial observations from submission content

Add a note at the top of the Teaching Strategy Log:
- [today's date]: BOOTSTRAP from Canvas grades — initialized scores from [N] graded assignments. Confidence capped at 0.5; verbal/theoretical scope NOT assumed from homework alone.

Do NOT:
- Send any message to the student
- Set confidence above 0.5 from grades alone
- Assume verbal or theoretical mastery from homework
- Add misconceptions (those must be discovered organically)`;

/**
 * Seed a one-time competency bootstrap task for a student group.
 */
export function seedCompetencyBootstrap(
  groupFolder: string,
  chatJid: string,
): void {
  const taskId = `bootstrap-${groupFolder}-${Date.now()}`;
  createTask({
    id: taskId,
    group_folder: groupFolder,
    chat_jid: chatJid,
    prompt: BOOTSTRAP_PROMPT,
    schedule_type: 'once',
    schedule_value: new Date(Date.now() + 5000).toISOString(), // Run in 5 seconds
    context_mode: 'group',
    next_run: new Date(Date.now() + 5000).toISOString(),
    status: 'active',
    created_at: new Date().toISOString(),
  });

  logger.info(
    { taskId, groupFolder },
    'Competency bootstrap task seeded',
  );
}

/**
 * Check if a bootstrap task has already run for a group.
 */
export function hasBootstrapRun(groupFolder: string, allTasks: Array<{ group_folder: string; prompt: string; status: string }>): boolean {
  return allTasks.some(
    (t) =>
      t.group_folder === groupFolder &&
      t.prompt.includes(BOOTSTRAP_TAG),
  );
}
