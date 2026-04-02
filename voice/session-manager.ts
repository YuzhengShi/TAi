/**
 * Session Manager — handles 8-min session limits, transcript tracking, and resume.
 */
import { randomUUID } from 'crypto';

import { NovaSonicSession } from './nova-sonic.js';
import { evaluateAnswer } from './shadow-evaluator.js';
import {
  EvaluationResult,
  InterviewContext,
  InterviewSummary,
  SessionState,
  TranscriptEntry,
} from './types.js';

/** Max session duration before forced resume (7 min to allow wrap-up). */
const SESSION_WARN_MS = 7 * 60 * 1000;
/** Hard limit — close session at 7.5 min. */
const SESSION_HARD_LIMIT_MS = 7.5 * 60 * 1000;
/** Max total interview duration. */
const MAX_INTERVIEW_MS = 20 * 60 * 1000;

export class SessionManager {
  private state: SessionState;
  private context: InterviewContext;
  private session: NovaSonicSession | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private interviewStart: number;
  private onAudio: (chunk: Buffer) => void;
  private onDone: (summary: InterviewSummary) => void;
  private warningSent = false;

  constructor(
    context: InterviewContext,
    onAudio: (chunk: Buffer) => void,
    onDone: (summary: InterviewSummary) => void,
  ) {
    this.context = context;
    this.onAudio = onAudio;
    this.onDone = onDone;
    this.interviewStart = Date.now();
    this.state = {
      interviewId: randomUUID(),
      sessionIndex: 0,
      startTime: Date.now(),
      transcript: [],
      evaluations: [],
      topicsAsked: new Set(),
      difficulty: 'medium',
    };
  }

  /** Start the first session. */
  async start(): Promise<void> {
    await this.startSession(this.context.systemPrompt);
  }

  /** Send audio from the browser to Nova Sonic. */
  sendAudio(pcmChunk: Buffer): void {
    this.session?.sendAudio(pcmChunk);
  }

  /** Force-end the interview. */
  async stop(): Promise<void> {
    this.stopTimer();
    await this.session?.end();
    this.session = null;
    this.onDone(this.buildSummary());
  }

  // --- Internal ---

  private async startSession(systemPrompt: string): Promise<void> {
    this.session = new NovaSonicSession();
    this.state.startTime = Date.now();
    this.warningSent = false;

    // Wire events
    this.session.on('audio', (chunk: Buffer) => {
      this.onAudio(chunk);
    });

    this.session.on('text', (text: string) => {
      this.state.transcript.push({
        role: 'interviewer',
        text,
        timestamp: Date.now(),
      });
    });

    this.session.on('toolUse', async (data) => {
      if (data.name === 'evaluate_answer') {
        // Track the student's answer in transcript
        if (data.input.student_answer_summary) {
          this.state.transcript.push({
            role: 'student',
            text: data.input.student_answer_summary,
            timestamp: Date.now(),
          });
        }
        if (data.input.topic) {
          this.state.topicsAsked.add(data.input.topic);
        }

        // Call Shadow Evaluator (with fallback — must never crash the session)
        let evaluation;
        try {
          evaluation = await evaluateAnswer(data.input, this.context);
        } catch (err) {
          console.error('Shadow evaluator error:', err);
          evaluation = { accuracy: 3, depth: 3, verbal_clarity: 3, problem_solving: 3,
            missed_concepts: [], suggested_follow_up: 'Continue probing.', difficulty_adjustment: 'maintain' as const };
        }
        this.state.evaluations.push(evaluation);

        // Adjust difficulty
        this.updateDifficulty(evaluation);

        // Nova Sonic uses async tool calling — do NOT send a TOOL_RESULT content block
        // back (bidirectional stream API rejects that content type).
        // Evaluation scores are used in buildResumePrompt() at session boundaries.
      }
    });

    this.session.on('done', () => {
      this.stopTimer();
      // Check if we should resume or finish
      const totalElapsed = Date.now() - this.interviewStart;
      if (totalElapsed < MAX_INTERVIEW_MS && this.state.sessionIndex < 2) {
        // Resume with a new session
        this.state.sessionIndex++;
        const resumePrompt = this.buildResumePrompt();
        this.startSession(resumePrompt).catch(err => {
          console.error('Failed to resume session:', err);
          this.onDone(this.buildSummary());
        });
      } else {
        this.onDone(this.buildSummary());
      }
    });

    this.session.on('error', (err) => {
      console.error('Nova Sonic error:', err);
      this.stopTimer();
      this.onDone(this.buildSummary());
    });

    // Start timer
    this.startTimer();

    // Start the Nova Sonic session
    await this.session.start(systemPrompt);
  }

  private startTimer(): void {
    this.timer = setInterval(() => {
      const elapsed = Date.now() - this.state.startTime;

      if (elapsed >= SESSION_HARD_LIMIT_MS) {
        // Hard limit — force close
        this.session?.end();
      } else if (elapsed >= SESSION_WARN_MS && !this.warningSent) {
        this.warningSent = true;
        // The session will end naturally via the 'done' event, then resume
      }

      // Check total interview time
      const totalElapsed = Date.now() - this.interviewStart;
      if (totalElapsed >= MAX_INTERVIEW_MS) {
        this.session?.end();
      }
    }, 10000);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private updateDifficulty(eval_: EvaluationResult): void {
    if (eval_.difficulty_adjustment === 'easier') {
      this.state.difficulty = this.state.difficulty === 'hard' ? 'medium' : 'easy';
    } else if (eval_.difficulty_adjustment === 'harder') {
      this.state.difficulty = this.state.difficulty === 'easy' ? 'medium' : 'hard';
    }
  }

  private buildResumePrompt(): string {
    const recentTranscript = this.state.transcript
      .slice(-20)
      .map(t => `${t.role === 'interviewer' ? 'TAi' : 'Student'}: ${t.text}`)
      .join('\n');

    const topicsStr = [...this.state.topicsAsked].join(', ');
    const avgScores = this.computeAverageScores();

    return `${this.context.systemPrompt}

## Conversation So Far (Session ${this.state.sessionIndex})
${recentTranscript}

## Topics Already Covered
${topicsStr || 'None yet'}

## Current Difficulty Level: ${this.state.difficulty}

## Average Scores So Far
Accuracy: ${avgScores.accuracy.toFixed(1)}/5, Depth: ${avgScores.depth.toFixed(1)}/5, Verbal Clarity: ${avgScores.verbal_clarity.toFixed(1)}/5

## Instructions
Continue the interview from where you left off. Don't re-introduce yourself. Pick up naturally: "Alright, so we were talking about..."
Focus on topics NOT yet covered, especially the student's weak spots.
${this.state.sessionIndex >= 2 ? 'This is the final session — wrap up with feedback in the next 5-7 minutes.' : ''}`;
  }

  private computeAverageScores(): { accuracy: number; depth: number; verbal_clarity: number; problem_solving: number } {
    if (this.state.evaluations.length === 0) {
      return { accuracy: 0, depth: 0, verbal_clarity: 0, problem_solving: 0 };
    }
    const sum = this.state.evaluations.reduce(
      (acc, e) => ({
        accuracy: acc.accuracy + e.accuracy,
        depth: acc.depth + e.depth,
        verbal_clarity: acc.verbal_clarity + e.verbal_clarity,
        problem_solving: acc.problem_solving + e.problem_solving,
      }),
      { accuracy: 0, depth: 0, verbal_clarity: 0, problem_solving: 0 },
    );
    const n = this.state.evaluations.length;
    return {
      accuracy: sum.accuracy / n,
      depth: sum.depth / n,
      verbal_clarity: sum.verbal_clarity / n,
      problem_solving: sum.problem_solving / n,
    };
  }

  private buildSummary(): InterviewSummary {
    const avg = this.computeAverageScores();
    const allMissed = this.state.evaluations.flatMap(e => e.missed_concepts);
    const uniqueMissed = [...new Set(allMissed)];

    // Determine strengths and weaknesses from evaluations
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (avg.verbal_clarity >= 4) strengths.push('Clear verbal explanations');
    if (avg.accuracy >= 4) strengths.push('Strong technical accuracy');
    if (avg.depth >= 4) strengths.push('Good depth of reasoning');
    if (avg.problem_solving >= 4) strengths.push('Solid problem-solving approach');
    if (avg.verbal_clarity < 3) weaknesses.push('Needs work on verbal clarity');
    if (avg.accuracy < 3) weaknesses.push('Technical accuracy needs improvement');
    if (avg.depth < 3) weaknesses.push('Should go deeper in explanations');
    if (avg.problem_solving < 3) weaknesses.push('Problem-solving approach needs development');
    if (uniqueMissed.length > 0) weaknesses.push(`Missed concepts: ${uniqueMissed.join(', ')}`);

    return {
      interviewId: this.state.interviewId,
      studentFolder: this.context.studentFolder,
      assignmentName: this.context.assignmentName,
      date: new Date().toISOString().split('T')[0],
      durationMinutes: Math.round((Date.now() - this.interviewStart) / 60000),
      rubric: {
        verbal_clarity: Math.round(avg.verbal_clarity * 10) / 10,
        technical_accuracy: Math.round(avg.accuracy * 10) / 10,
        depth_of_reasoning: Math.round(avg.depth * 10) / 10,
        problem_solving_process: Math.round(avg.problem_solving * 10) / 10,
      },
      strengths,
      weaknesses,
      misconceptionsDiscovered: uniqueMissed.filter(c =>
        this.context.misconceptions.every(m => !m.includes(c)),
      ),
      topicsCovered: [...this.state.topicsAsked],
      transcript: this.state.transcript,
    };
  }
}
