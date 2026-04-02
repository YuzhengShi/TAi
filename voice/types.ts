/** Shared types for voice interview system. */

export interface InterviewContext {
  studentFolder: string;
  studentName: string;
  canvasUserId: string;
  githubUsername: string;
  assignmentId: string;
  assignmentName: string;
  /** Assembled system prompt for Nova Sonic */
  systemPrompt: string;
  /** Concepts with confidence < 0.5 */
  weakConcepts: string[];
  /** Concepts missing "verbal" scope */
  verbalGaps: string[];
  /** Active misconceptions from COMPETENCY.md */
  misconceptions: string[];
}

export interface EvaluationResult {
  accuracy: number;       // 1-5
  depth: number;          // 1-5
  verbal_clarity: number; // 1-5
  problem_solving: number; // 1-5
  missed_concepts: string[];
  suggested_follow_up: string;
  difficulty_adjustment: 'easier' | 'maintain' | 'harder';
}

export interface SessionState {
  interviewId: string;
  sessionIndex: number;
  startTime: number;
  /** Q&A pairs from all sessions */
  transcript: TranscriptEntry[];
  /** Shadow Evaluator results */
  evaluations: EvaluationResult[];
  /** Topics already asked about */
  topicsAsked: Set<string>;
  /** Current difficulty level */
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface TranscriptEntry {
  role: 'interviewer' | 'student';
  text: string;
  timestamp: number;
}

export interface InterviewSummary {
  interviewId: string;
  studentFolder: string;
  assignmentName: string;
  date: string;
  durationMinutes: number;
  rubric: {
    verbal_clarity: number;
    technical_accuracy: number;
    depth_of_reasoning: number;
    problem_solving_process: number;
  };
  strengths: string[];
  weaknesses: string[];
  misconceptionsDiscovered: string[];
  topicsCovered: string[];
  transcript: TranscriptEntry[];
}

export interface TokenPayload {
  folder: string;
  assignmentId?: string;
  ts: number;
}

/** Nova Sonic tool definition for Shadow Evaluator.
 * NOTE: inputSchema.json MUST be a JSON string (doubly-encoded), not an object.
 * Nova Sonic's bidirectional stream API expects the schema serialized as a string,
 * matching the Python reference implementation which uses json.dumps(). */
export const EVALUATE_ANSWER_TOOL = {
  toolSpec: {
    name: 'evaluate_answer',
    description: 'Evaluate the student\'s answer to the current interview question. Call this after each substantive student response to get scoring and a suggested follow-up direction.',
    inputSchema: {
      json: JSON.stringify({
        type: 'object',
        properties: {
          question_asked: { type: 'string', description: 'The question you just asked' },
          student_answer_summary: { type: 'string', description: 'Summary of what the student said' },
          topic: { type: 'string', description: 'The CS6650 topic being tested' },
        },
        required: ['question_asked', 'student_answer_summary', 'topic'],
      }),
    },
  },
};
