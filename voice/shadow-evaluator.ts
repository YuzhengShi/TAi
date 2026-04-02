/**
 * Shadow Evaluator — Claude Sonnet 4 evaluates student answers mid-interview.
 * Called as a Nova Sonic tool. Student never sees the evaluation.
 */
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

import { readEnvFile } from '../src/env.js';
import { EvaluationResult, InterviewContext } from './types.js';

let client: BedrockRuntimeClient | null = null;

function getClient(): BedrockRuntimeClient {
  if (client) return client;
  const secrets = readEnvFile([
    'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_REGION',
  ]);
  client = new BedrockRuntimeClient({
    region: secrets.AWS_REGION || 'us-west-2',
    credentials: {
      accessKeyId: secrets.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: secrets.AWS_SECRET_ACCESS_KEY || '',
      sessionToken: secrets.AWS_SESSION_TOKEN,
    },
  });
  return client;
}

export async function evaluateAnswer(
  input: { question_asked: string; student_answer_summary: string; topic: string },
  context: InterviewContext,
): Promise<EvaluationResult> {
  const bedrock = getClient();

  const systemPrompt = `You are a CS6650 teaching evaluator. Score the student's mock interview answer on four dimensions (1-5 each). Be strict but fair — this is a graduate distributed systems course.

Student: ${context.studentName}
Known weak spots: ${context.weakConcepts.join(', ') || 'none identified'}
Known misconceptions: ${context.misconceptions.join('; ') || 'none'}

Return ONLY valid JSON with this exact structure:
{
  "accuracy": <1-5>,
  "depth": <1-5>,
  "verbal_clarity": <1-5>,
  "problem_solving": <1-5>,
  "missed_concepts": ["concept1", "concept2"],
  "suggested_follow_up": "Ask about...",
  "difficulty_adjustment": "easier" | "maintain" | "harder"
}

Scoring guide:
- 1: No understanding, wrong answer, or silence
- 2: Vague or superficial, missing key details
- 3: Adequate — correct core idea but gaps in depth or precision
- 4: Strong — accurate with good depth, minor gaps
- 5: Excellent — accurate, deep, well-articulated, considers edge cases`;

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 400,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Question asked: "${input.question_asked}"\n\nStudent's answer: "${input.student_answer_summary}"\n\nTopic: ${input.topic}\n\nEvaluate this answer.`,
    }],
  });

  const response = await bedrock.send(new InvokeModelCommand({
    modelId: 'us.anthropic.claude-sonnet-4-6',
    body,
    contentType: 'application/json',
  }));

  const responseText = new TextDecoder().decode(response.body);
  const parsed = JSON.parse(responseText);
  const content = parsed.content?.[0]?.text || '{}';

  // Extract JSON from response (may be wrapped in markdown code fences)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return defaultEvaluation();
  }

  try {
    const eval_ = JSON.parse(jsonMatch[0]) as EvaluationResult;
    return {
      accuracy: clamp(eval_.accuracy, 1, 5),
      depth: clamp(eval_.depth, 1, 5),
      verbal_clarity: clamp(eval_.verbal_clarity, 1, 5),
      problem_solving: clamp(eval_.problem_solving, 1, 5),
      missed_concepts: eval_.missed_concepts || [],
      suggested_follow_up: eval_.suggested_follow_up || '',
      difficulty_adjustment: eval_.difficulty_adjustment || 'maintain',
    };
  } catch {
    return defaultEvaluation();
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v || min));
}

function defaultEvaluation(): EvaluationResult {
  return {
    accuracy: 3, depth: 3, verbal_clarity: 3, problem_solving: 3,
    missed_concepts: [],
    suggested_follow_up: 'Continue probing the current topic.',
    difficulty_adjustment: 'maintain',
  };
}
