/** HMAC-signed interview tokens. */
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

import { readEnvFile } from '../src/env.js';
import { TokenPayload } from './types.js';

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
// Track consumed tokens to prevent replay (single-use enforcement)
const consumedTokens = new Set<string>();

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
 * Validate token AND mark it as consumed (single-use).
 * Returns null if invalid, expired, or already used.
 */
export function consumeToken(token: string): TokenPayload | null {
  if (consumedTokens.has(token)) return null;
  const payload = validateToken(token);
  if (!payload) return null;
  consumedTokens.add(token);
  // Clean up old tokens periodically (prevent memory leak)
  if (consumedTokens.size > 1000) {
    const now = Date.now();
    for (const t of consumedTokens) {
      try {
        const [json] = t.split('.');
        const p = JSON.parse(Buffer.from(json, 'base64url').toString());
        if (now - p.ts > TOKEN_EXPIRY_MS * 2) consumedTokens.delete(t);
      } catch { consumedTokens.delete(t); }
    }
  }
  return payload;
}

/** Generate a unique interview ID. */
export function generateInterviewId(): string {
  return randomUUID();
}
