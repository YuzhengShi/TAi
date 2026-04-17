/** HMAC-signed interview tokens. */
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

import { readEnvFile } from '../src/env.js';
import { TokenPayload } from './types.js';

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
// Track consumed tokens to prevent replay (single-use enforcement)
const consumedTokens = new Set<string>();
// Tokens with a successful interview — permanently consumed
const completedTokens = new Set<string>();
// Retry budget per token (allows retries on transient failures like Nova Sonic content filter)
const MAX_ATTEMPTS = 5;
const tokenAttempts = new Map<string, number>();

function getSecret(): string {
  const secrets = readEnvFile(['VOICE_INTERVIEW_SECRET']);
  const secret = secrets.VOICE_INTERVIEW_SECRET || process.env.VOICE_INTERVIEW_SECRET;
  if (!secret) throw new Error('VOICE_INTERVIEW_SECRET not set in .env');
  return secret;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Generate a signed interview token. */
export function generateToken(folder: string, assignmentId?: string): string {
  const payload: TokenPayload = { folder, assignmentId, ts: Date.now() };
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign(json, getSecret());
  return `${json}.${sig}`;
}

/** Validate and decode an interview token. Returns null if invalid/expired. */
export function validateToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [json, sig] = parts;
  const expected = sign(json, getSecret());

  // Constant-time comparison to prevent timing attacks
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload: TokenPayload = JSON.parse(
      Buffer.from(json, 'base64url').toString(),
    );
    if (Date.now() - payload.ts > TOKEN_EXPIRY_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Validate token and check it hasn't exceeded retry budget.
 * Allows up to MAX_ATTEMPTS uses so transient failures (e.g. Nova Sonic
 * content filter) don't permanently burn the token.
 * Call markTokenCompleted() after a successful interview to prevent further reuse.
 */
export function consumeToken(token: string): TokenPayload | null {
  if (completedTokens.has(token)) return null;
  const attempts = tokenAttempts.get(token) || 0;
  if (attempts >= MAX_ATTEMPTS) return null;
  const payload = validateToken(token);
  if (!payload) return null;
  tokenAttempts.set(token, attempts + 1);
  // Clean up old entries periodically (prevent memory leak)
  if (tokenAttempts.size > 1000) {
    const now = Date.now();
    for (const [t] of tokenAttempts) {
      try {
        const [json] = t.split('.');
        const p = JSON.parse(Buffer.from(json, 'base64url').toString());
        if (now - p.ts > TOKEN_EXPIRY_MS * 2) {
          tokenAttempts.delete(t);
          completedTokens.delete(t);
        }
      } catch {
        tokenAttempts.delete(t);
        completedTokens.delete(t);
      }
    }
  }
  return payload;
}

/** Mark a token as permanently consumed after a successful interview. */
export function markTokenCompleted(token: string): void {
  completedTokens.add(token);
}

/** Generate a unique interview ID. */
export function generateInterviewId(): string {
  return randomUUID();
}
