/**
 * Voice message transcription using Amazon Transcribe Streaming.
 * Converts OGG Opus audio to PCM and streams to Transcribe.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from '@aws-sdk/client-transcribe-streaming';
import { readEnvFile } from './env.js';
import { logger } from './logger.js';

const CHUNK_SIZE = 4096;

/** Load AWS credentials from .env, falling back to process.env. */
function getAwsCredentials() {
  const keys = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_REGION', 'AWS_DEFAULT_REGION'];
  const env = readEnvFile(keys);
  for (const key of keys) {
    if (!env[key] && process.env[key]) env[key] = process.env[key]!;
  }
  return env;
}

/** Resolve ffmpeg binary path — checks PATH first, then common Windows install locations. */
function findFfmpeg(): string {
  // Try PATH first
  try {
    execSync('ffmpeg -version', { stdio: 'pipe', timeout: 5000 });
    return 'ffmpeg';
  } catch { /* not on PATH */ }

  // Search common Windows locations
  if (os.platform() === 'win32') {
    const home = os.homedir();
    const candidates = [
      // winget (Gyan.FFmpeg) — version-independent glob
      ...(() => {
        const wingetBase = path.join(home, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');
        try {
          const dirs = fs.readdirSync(wingetBase).filter(d => d.startsWith('Gyan.FFmpeg'));
          for (const dir of dirs) {
            const pkgDir = path.join(wingetBase, dir);
            const subs = fs.readdirSync(pkgDir).filter(s => s.startsWith('ffmpeg-'));
            for (const sub of subs) {
              const bin = path.join(pkgDir, sub, 'bin', 'ffmpeg.exe');
              if (fs.existsSync(bin)) return [bin];
            }
          }
        } catch { /* ignore */ }
        return [];
      })(),
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      path.join(home, 'scoop', 'shims', 'ffmpeg.exe'),
      'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        logger.info({ path: p }, 'Found ffmpeg at non-PATH location');
        return p;
      }
    }
  }

  throw new Error('ffmpeg not found — install via: winget install Gyan.FFmpeg');
}

let ffmpegPath: string | undefined;

export async function transcribeAudio(filePath: string): Promise<string> {
  if (!ffmpegPath) ffmpegPath = findFfmpeg();

  // Convert OGG Opus to 16kHz mono PCM using ffmpeg
  let pcmBuffer: Buffer;
  try {
    pcmBuffer = execSync(
      `"${ffmpegPath}" -i "${filePath}" -ar 16000 -ac 1 -f s16le -loglevel error -`,
      { maxBuffer: 10 * 1024 * 1024 },
    );
  } catch (err) {
    logger.error({ err }, 'ffmpeg conversion failed');
    throw new Error('ffmpeg not available or audio conversion failed');
  }

  if (pcmBuffer.length === 0) {
    throw new Error('ffmpeg produced empty output');
  }

  const awsCreds = getAwsCredentials();
  const region = awsCreds.AWS_REGION || awsCreds.AWS_DEFAULT_REGION || 'us-west-2';
  const client = new TranscribeStreamingClient({
    region,
    ...(awsCreds.AWS_ACCESS_KEY_ID && awsCreds.AWS_SECRET_ACCESS_KEY ? {
      credentials: {
        accessKeyId: awsCreds.AWS_ACCESS_KEY_ID,
        secretAccessKey: awsCreds.AWS_SECRET_ACCESS_KEY,
        ...(awsCreds.AWS_SESSION_TOKEN ? { sessionToken: awsCreds.AWS_SESSION_TOKEN } : {}),
      },
    } : {}),
  });

  async function* audioStream() {
    for (let i = 0; i < pcmBuffer.length; i += CHUNK_SIZE) {
      yield { AudioEvent: { AudioChunk: pcmBuffer.subarray(i, i + CHUNK_SIZE) } };
    }
  }

  const command = new StartStreamTranscriptionCommand({
    LanguageCode: 'en-US',
    MediaEncoding: 'pcm',
    MediaSampleRateHertz: 16000,
    AudioStream: audioStream(),
  });

  logger.info({ filePath, pcmBytes: pcmBuffer.length, region: client.config.region }, 'Sending audio to Transcribe');

  // Wrap in a timeout — TranscriptResultStream can hang in ESM/tsx contexts
  const transcribeWithTimeout = async (): Promise<string> => {
    const response = await client.send(command);
    let transcript = '';

    if (response.TranscriptResultStream) {
      for await (const event of response.TranscriptResultStream) {
        if (event.TranscriptEvent?.Transcript?.Results) {
          for (const result of event.TranscriptEvent.Transcript.Results) {
            if (!result.IsPartial && result.Alternatives?.[0]?.Transcript) {
              transcript += result.Alternatives[0].Transcript + ' ';
            }
          }
        }
      }
    }

    return transcript.trim();
  };

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Transcription timed out after 15s')), 15000),
  );

  const trimmed = await Promise.race([transcribeWithTimeout(), timeoutPromise]);

  if (!trimmed) {
    throw new Error('Transcription returned empty result');
  }

  logger.info({ length: trimmed.length }, 'Voice note transcribed');
  return trimmed;
}
