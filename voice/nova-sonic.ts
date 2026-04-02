/**
 * Nova Sonic — Bedrock bidirectional streaming wrapper.
 * Handles the event protocol for real-time voice conversation.
 *
 * Nova Sonic protocol (correct event names):
 * - contentStart / textInput / audioInput / contentEnd  (NOT contentBlockStart/Delta/Stop)
 * - Content identified by contentName (UUID), not contentBlockIndex
 * - toolConfiguration in promptStart (NOT toolUseConfiguration)
 */
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

import {
  BedrockRuntimeClient,
  InvokeModelWithBidirectionalStreamCommand,
  InvokeModelWithBidirectionalStreamInput,
} from '@aws-sdk/client-bedrock-runtime';
import { WebSocketFetchHandler } from '@aws-sdk/middleware-websocket';

import { readEnvFile } from '../src/env.js';
import { EVALUATE_ANSWER_TOOL } from './types.js';

let cachedClient: BedrockRuntimeClient | null = null;

function getClient(): BedrockRuntimeClient {
  if (cachedClient) return cachedClient;
  const secrets = readEnvFile([
    'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_REGION',
  ]);
  cachedClient = new BedrockRuntimeClient({
    region: 'us-east-1', // Nova Sonic is only available in us-east-1
    credentials: {
      accessKeyId: secrets.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: secrets.AWS_SECRET_ACCESS_KEY || '',
      sessionToken: secrets.AWS_SESSION_TOKEN,
    },
    requestHandler: new WebSocketFetchHandler({ connectionTimeout: 5000 }),
  });
  return cachedClient;
}

const MODEL_ID = 'amazon.nova-2-sonic-v1:0';
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

export interface NovaSonicEvents {
  audio: (chunk: Buffer) => void;
  text: (text: string) => void;
  toolUse: (data: { toolUseId: string; name: string; input: Record<string, string> }) => void;
  error: (err: Error) => void;
  done: () => void;
}

/**
 * Wraps a Nova Sonic bidirectional stream session.
 * Input: 16kHz mono PCM audio + text events.
 * Output: 24kHz PCM audio + text + tool use events.
 */
export class NovaSonicSession extends EventEmitter {
  private inputQueue: Array<InvokeModelWithBidirectionalStreamInput> = [];
  private inputResolve: (() => void) | null = null;
  private closed = false;
  private promptName: string;
  private audioContentName: string;
  private sendCount = 0;
  constructor() {
    super();
    this.promptName = randomUUID();
    this.audioContentName = randomUUID();
  }

  /** Start the session with system prompt and tool definitions. */
  async start(systemPrompt: string): Promise<void> {
    const client = getClient();

    // 1. Session start
    this.enqueueEvent({
      sessionStart: {
        inferenceConfiguration: {
          maxTokens: 1024,
          topP: 0.9,
          temperature: 0.7,
        },
      },
    });

    // 2. Prompt start — note: toolConfiguration (not toolUseConfiguration)
    this.enqueueEvent({
      promptStart: {
        promptName: this.promptName,
        textOutputConfiguration: { mediaType: 'text/plain' },
        audioOutputConfiguration: {
          mediaType: 'audio/lpcm',
          sampleRateHertz: 24000,
          sampleSizeBits: 16,
          channelCount: 1,
          voiceId: 'tiffany',
          encoding: 'base64',
          audioType: 'SPEECH',
        },
        toolUseOutputConfiguration: {
          mediaType: 'application/json',
        },
        toolConfiguration: {
          tools: [EVALUATE_ANSWER_TOOL],
        },
      },
    });

    // 3. System prompt content block
    const systemContentName = randomUUID();
    this.enqueueEvent({
      contentStart: {
        promptName: this.promptName,
        contentName: systemContentName,
        type: 'TEXT',
        interactive: false,
        role: 'SYSTEM',
        textInputConfiguration: { mediaType: 'text/plain' },
      },
    });
    this.enqueueEvent({
      textInput: {
        promptName: this.promptName,
        contentName: systemContentName,
        content: systemPrompt,
      },
    });
    this.enqueueEvent({
      contentEnd: {
        promptName: this.promptName,
        contentName: systemContentName,
      },
    });

    // 4. Open audio input block (stays open until end())
    this.enqueueEvent({
      contentStart: {
        promptName: this.promptName,
        contentName: this.audioContentName,
        type: 'AUDIO',
        interactive: true,
        role: 'USER',
        audioInputConfiguration: {
          mediaType: 'audio/lpcm',
          sampleRateHertz: 16000,
          sampleSizeBits: 16,
          channelCount: 1,
          audioType: 'SPEECH',
          encoding: 'base64',
        },
      },
    });

    // Create the bidirectional stream
    const command = new InvokeModelWithBidirectionalStreamCommand({
      modelId: MODEL_ID,
      body: this.createInputStream(),
    });

    try {
      const response = await client.send(command);
      // Process output stream in background
      this.processOutputStream(response.body!).catch(err => {
        if (!this.closed) this.emit('error', err);
      });
    } catch (err) {
      this.emit('error', err as Error);
    }
  }

  /** Send a PCM audio chunk (16kHz mono s16le). */
  sendAudio(pcmChunk: Buffer): void {
    if (this.closed) return;
    this.enqueueEvent({
      audioInput: {
        promptName: this.promptName,
        contentName: this.audioContentName,
        content: pcmChunk.toString('base64'),
      },
    });
  }

  /** Send a tool result back to Nova Sonic. */
  sendToolResult(toolUseId: string, result: string): void {
    if (this.closed) return;
    const contentName = randomUUID();
    this.enqueueEvent({
      contentStart: {
        promptName: this.promptName,
        contentName,
        type: 'TOOL_RESULT',
        interactive: false,
        toolResultInputConfiguration: {
          toolUseId,
          type: 'TEXT',
          textInputConfiguration: { mediaType: 'text/plain' },
        },
      },
    });
    this.enqueueEvent({
      textInput: {
        promptName: this.promptName,
        contentName,
        content: result,
      },
    });
    this.enqueueEvent({
      contentEnd: {
        promptName: this.promptName,
        contentName,
      },
    });
  }

  /** Gracefully end the session. */
  async end(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    // Close the audio input block
    this.enqueueEvent({
      contentEnd: {
        promptName: this.promptName,
        contentName: this.audioContentName,
      },
    });

    // End the prompt
    this.enqueueEvent({
      promptEnd: {
        promptName: this.promptName,
      },
    });

    // End the session
    this.enqueueEvent({
      sessionEnd: {},
    });

    // Signal the async iterator to finish
    this.flushInput();
  }

  // --- Internal ---

  private enqueueEvent(payload: Record<string, unknown>): void {
    const wrapped = { event: payload };
    const json = JSON.stringify(wrapped);
    const n = ++this.sendCount;
    const eventType = Object.keys(payload)[0];
    // For audioInput, only log the count to avoid log spam
    if (eventType === 'audioInput') {
      console.debug(`[nova-sonic] send #${n}: audioInput`);
    } else {
      console.debug(`[nova-sonic] send #${n}:`, json.slice(0, 400));
    }
    const bytes = ENCODER.encode(json);
    this.inputQueue.push({ chunk: { bytes } });
    this.flushInput();
  }

  private flushInput(): void {
    if (this.inputResolve) {
      const resolve = this.inputResolve;
      this.inputResolve = null;
      resolve();
    }
  }

  private async *createInputStream(): AsyncGenerator<InvokeModelWithBidirectionalStreamInput> {
    while (!this.closed || this.inputQueue.length > 0) {
      if (this.inputQueue.length > 0) {
        yield this.inputQueue.shift()!;
      } else {
        // Wait for new input
        await new Promise<void>(resolve => { this.inputResolve = resolve; });
      }
    }
  }

  private async processOutputStream(
    body: AsyncIterable<{ chunk?: { bytes?: Uint8Array } }>,
  ): Promise<void> {
    try {
      for await (const event of body) {
        if (this.closed && !event.chunk?.bytes) break;

        if (event.chunk?.bytes) {
          const raw = DECODER.decode(event.chunk.bytes);
          try {
            const json = JSON.parse(raw);
            this.handleOutputEvent(json);
          } catch {
            console.warn('[nova-sonic] unparseable output chunk:', raw.slice(0, 200));
          }
        }
      }
    } catch (err) {
      // Server-side error (e.g. ValidationException) arrives as a thrown error from the iterator
      const msg = (err as Error).message || String(err);
      console.error(`[nova-sonic] stream error after ${this.sendCount} sent events:`, msg);
      throw err;
    }
    this.emit('done');
  }

  private handleOutputEvent(event: Record<string, unknown>): void {
    const inner = (event.event ?? event) as Record<string, unknown>;
    const eventType = Object.keys(inner)[0] || 'unknown';
    // Always log full output events (they're infrequent and important)
    console.debug(`[nova-sonic] recv [${eventType}]:`, JSON.stringify(inner).slice(0, 500));

    // Audio output
    if (inner.audioOutput) {
      const ao = inner.audioOutput as Record<string, unknown>;
      if (ao.content && typeof ao.content === 'string') {
        this.emit('audio', Buffer.from(ao.content, 'base64'));
      }
    }

    // Text output
    if (inner.textOutput) {
      const to = inner.textOutput as Record<string, unknown>;
      if (to.content && typeof to.content === 'string') {
        this.emit('text', to.content);
      }
    }

    // Tool use — Nova Sonic sends a single toolUse event with all fields
    if (inner.toolUse) {
      const tu = inner.toolUse as Record<string, unknown>;
      const toolUseId = String(tu.toolUseId || '');
      const name = String(tu.toolName || tu.name || '');
      let input: Record<string, string> = {};
      try {
        const raw = tu.content || tu.input || '{}';
        input = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
      } catch {
        // ignore parse errors
      }
      this.emit('toolUse', { toolUseId, name, input });
    }

    // Session end
    if (inner.sessionEnd || inner.completionEvent) {
      this.closed = true;
    }
  }
}
