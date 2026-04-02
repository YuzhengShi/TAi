import fs from 'fs';
import path from 'path';

import makeWASocket, {
  Browsers,
  DisconnectReason,
  WASocket,
  WAMessage,
  downloadMediaMessage,
  extractMessageContent,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';

import { ASSISTANT_HAS_OWN_NUMBER, ASSISTANT_NAME, DATA_DIR, STORE_DIR } from '../config.js';
import { transcribeAudio } from '../transcription.js';
import {
  getLastGroupSync,
  setLastGroupSync,
  updateChatName,
} from '../db.js';
import { logger } from '../logger.js';
import { Channel, OnInboundMessage, OnChatMetadata, RegisteredGroup } from '../types.js';

const GROUP_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_MEDIA_SIZE = 10 * 1024 * 1024; // 10 MB

const SUPPORTED_MEDIA_TYPES = ['imageMessage', 'documentMessage', 'stickerMessage', 'audioMessage'] as const;
const UNSUPPORTED_MEDIA_LABELS: Record<string, string> = {
  videoMessage: 'Video — not yet supported',
};

export interface WhatsAppChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
}

export class WhatsAppChannel implements Channel {
  name = 'whatsapp';

  private sock!: WASocket;
  private connected = false;
  private reconnecting = false;
  private lidToPhoneMap: Record<string, string> = {};
  private outgoingQueue: Array<{ jid: string; text: string }> = [];
  private flushing = false;
  private groupSyncTimerStarted = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Recent messages for dedup — agent sometimes sends via send_message AND text output */
  private recentlySent = new Map<string, { prefix: string; time: number }>();
  /** Track message IDs sent by the bot to filter out echoes on shared-number setups */
  private sentByBot = new Set<string>();

  private opts: WhatsAppChannelOpts;

  constructor(opts: WhatsAppChannelOpts) {
    this.opts = opts;
  }

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.connectInternal(resolve).catch(reject);
    });
  }

  private async connectInternal(onFirstOpen?: () => void): Promise<void> {
    // Close previous socket before creating a new one to prevent
    // multiple concurrent connections that conflict with each other
    if (this.sock) {
      try {
        // Remove listeners BEFORE ending so the old socket's 'close' event
        // doesn't trigger another reconnect cycle
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        this.sock.ev.removeAllListeners('messages.upsert');
        this.sock.end(undefined);
      } catch {
        // ignore errors closing stale socket
      }
    }

    const authDir = path.join(STORE_DIR, 'auth');
    fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    this.sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      logger,
      browser: Browsers.ubuntu('Chrome'),
    });

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const msg =
          'WhatsApp authentication required. Run /setup in Claude Code.';
        logger.error(msg);
        setTimeout(() => process.exit(1), 1000);
      }

      if (connection === 'close') {
        this.connected = false;
        const reason = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = reason !== DisconnectReason.loggedOut;
        logger.info({ reason, shouldReconnect, queuedMessages: this.outgoingQueue.length }, 'Connection closed');

        if (shouldReconnect) {
          // Guard against multiple concurrent reconnect attempts — each
          // creates a new socket that conflicts with the others.
          if (this.reconnecting) {
            logger.debug('Reconnect already scheduled, skipping duplicate');
            return;
          }
          this.reconnecting = true;

          // Delay reconnect to let the old socket fully close on WhatsApp's
          // servers. Conflict errors need a longer delay.
          const isConflict = reason === DisconnectReason.connectionReplaced;
          const delayMs = isConflict ? 5000 : 2000;
          logger.info({ delayMs, isConflict }, 'Reconnecting...');
          setTimeout(() => {
            this.reconnecting = false;
            this.connectInternal().catch((err) => {
              logger.error({ err }, 'Failed to reconnect, retrying in 10s');
              setTimeout(() => {
                this.connectInternal().catch((err2) => {
                  logger.error({ err: err2 }, 'Reconnection retry failed');
                });
              }, 10000);
            });
          }, delayMs);
        } else {
          logger.info('Logged out. Run /setup to re-authenticate.');
          process.exit(0);
        }
      } else if (connection === 'open') {
        this.connected = true;
        logger.info('Connected to WhatsApp');

        // Announce availability so WhatsApp relays subsequent presence updates (typing indicators)
        this.sock.sendPresenceUpdate('available').catch(() => {});

        // Build LID to phone mapping from auth state for self-chat translation
        if (this.sock.user) {
          const phoneUser = this.sock.user.id.split(':')[0];
          const lidUser = this.sock.user.lid?.split(':')[0];
          if (lidUser && phoneUser) {
            this.lidToPhoneMap[lidUser] = `${phoneUser}@s.whatsapp.net`;
            logger.debug({ lidUser, phoneUser }, 'LID to phone mapping set');
          }
        }

        // Flush any messages queued while disconnected
        this.flushOutgoingQueue().catch((err) =>
          logger.error({ err }, 'Failed to flush outgoing queue'),
        );

        // Sync group metadata on startup (respects 24h cache)
        this.syncGroupMetadata().catch((err) =>
          logger.error({ err }, 'Initial group sync failed'),
        );
        // Set up daily sync timer (only once)
        if (!this.groupSyncTimerStarted) {
          this.groupSyncTimerStarted = true;
          setInterval(() => {
            this.syncGroupMetadata().catch((err) =>
              logger.error({ err }, 'Periodic group sync failed'),
            );
          }, GROUP_SYNC_INTERVAL_MS);
        }

        // Signal first connection to caller
        if (onFirstOpen) {
          onFirstOpen();
          onFirstOpen = undefined;
        }
      }
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        if (!msg.message) continue;
        const rawJid = msg.key.remoteJid;
        if (!rawJid || rawJid === 'status@broadcast') continue;

        // Translate LID JID to phone JID if applicable
        const chatJid = await this.translateJid(rawJid);

        // Mark message as read immediately (blue ticks) so student knows TAi saw it
        if (!msg.key.fromMe) {
          this.sock.readMessages([msg.key]).catch(() => {});
        }

        const timestamp = new Date(
          Number(msg.messageTimestamp) * 1000,
        ).toISOString();

        // Always notify about chat metadata for group discovery
        const isGroup = chatJid.endsWith('@g.us');
        this.opts.onChatMetadata(chatJid, timestamp, undefined, 'whatsapp', isGroup);

        // Only deliver full message for registered groups
        const groups = this.opts.registeredGroups();
        if (groups[chatJid]) {
          const group = groups[chatJid];
          let content =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption ||
            msg.message?.documentMessage?.caption ||
            '';

          // Detect reaction messages — skip bot's own reaction echoes
          const reactionMsg = extractMessageContent(msg.message)?.reactionMessage;
          if (reactionMsg) {
            if (!reactionMsg.text) continue; // Reaction removed
            const isBotReaction = ASSISTANT_HAS_OWN_NUMBER
              ? msg.key.fromMe
              : this.sentByBot.has(msg.key.id || '');
            if (isBotReaction) continue;
            content = `[Student reacted with ${reactionMsg.text} to message ${reactionMsg.key?.id || 'unknown'}]`;
          }

          // Include quoted message context when student replies to a specific message
          const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          if (quoted) {
            const quotedText = quoted.conversation
              || quoted.extendedTextMessage?.text
              || quoted.imageMessage?.caption
              || '';
            if (quotedText) {
              content = `[Replying to: "${quotedText.slice(0, 200)}"]\n${content}`;
            }
          }

          // Handle supported media (image, document, sticker, audio)
          // Skip media processing for bot-sent messages (e.g. bot-sent voice notes/images).
          // On shared-number setups, fromMe is true for both user and bot, so check sentByBot.
          const isBotSent = ASSISTANT_HAS_OWN_NUMBER ? msg.key.fromMe : this.sentByBot.has(msg.key.id || '');
          const mediaPath = isBotSent ? null : await this.downloadMedia(msg, group.folder);
          if (mediaPath) {
            const inner = extractMessageContent(msg.message);

            if (inner?.audioMessage) {
              // Transcribe voice note via Amazon Transcribe
              try {
                const hostPath = path.join(DATA_DIR, 'ipc', group.folder, 'media', path.basename(mediaPath));
                const transcription = await transcribeAudio(hostPath);
                const voiceRef = `[Voice note transcription: "${transcription}"]`;
                content = content ? `${content}\n${voiceRef}` : voiceRef;
              } catch (err) {
                logger.warn({ err, msgId: msg.key.id }, 'Failed to transcribe voice note');
                const voiceRef = `[Voice note received — transcription failed. Audio saved at: ${mediaPath}]`;
                content = content ? `${content}\n${voiceRef}` : voiceRef;
              }
            } else {
              let label = 'an image';
              let hint = '';
              if (inner?.stickerMessage) {
                label = 'a sticker';
              } else if (inner?.documentMessage) {
                const mime = inner.documentMessage.mimetype || 'application/octet-stream';
                if (mime === 'application/pdf') {
                  label = 'a PDF document';
                  hint = ' For large PDFs, use the pages parameter (e.g., pages: "1-5").';
                } else if (mime.includes('zip') || mime.includes('tar') || mime.includes('gzip')) {
                  label = `an archive (${mime})`;
                  hint = ' Use Bash to extract it (unzip for .zip, tar for .tar/.tar.gz).';
                } else {
                  label = `a document (${mime})`;
                }
              }
              const mediaRef = `[User sent ${label}. Use your Read tool to view: ${mediaPath}${hint}]`;
              content = content ? `${content}\n${mediaRef}` : mediaRef;
            }
          } else {
            // Check for unsupported media types (audio, video)
            const inner = extractMessageContent(msg.message);
            if (inner) {
              for (const [type, humanLabel] of Object.entries(UNSUPPORTED_MEDIA_LABELS)) {
                if (inner[type as keyof typeof inner]) {
                  const unsupportedRef = `[${humanLabel}]`;
                  content = content ? `${content}\n${unsupportedRef}` : unsupportedRef;
                  break;
                }
              }
            }
          }

          const sender = msg.key.participant || msg.key.remoteJid || '';
          const senderName = msg.pushName || sender.split('@')[0];

          const fromMe = msg.key.fromMe || false;
          // Detect bot messages: with own number, fromMe is reliable
          // since only the bot sends from that number.
          // With shared number, bot messages carry the assistant name prefix
          // (even in DMs/self-chat) so we check for that.
          const isBotMessage = ASSISTANT_HAS_OWN_NUMBER
            ? fromMe
            : content.startsWith(`${ASSISTANT_NAME}:`) || this.sentByBot.has(msg.key.id || '');

          this.opts.onMessage(chatJid, {
            id: msg.key.id || '',
            chat_jid: chatJid,
            sender,
            sender_name: senderName,
            content,
            timestamp,
            is_from_me: fromMe,
            is_bot_message: isBotMessage,
          });
        }
      }
    });
  }

  private trackSentMessage(id: string): void {
    this.sentByBot.add(id);
    // Evict after 60s to avoid unbounded growth
    setTimeout(() => this.sentByBot.delete(id), 60_000);
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    // Prefix bot messages with assistant name so users know who's speaking.
    // On a shared number, prefix is also needed in DMs (including self-chat)
    // to distinguish bot output from user messages.
    // Skip only when the assistant has its own dedicated phone number.
    const prefixed = ASSISTANT_HAS_OWN_NUMBER
      ? text
      : `${ASSISTANT_NAME}: ${text}`;

    // Dedup: agent sometimes sends the same response via send_message tool AND
    // text output. Suppress the second copy if same prefix within 10s.
    const now = Date.now();
    const dedupPrefix = text.slice(0, 80).toLowerCase().replace(/\s+/g, ' ');
    const recent = this.recentlySent.get(jid);
    if (recent && now - recent.time < 10_000 && recent.prefix === dedupPrefix) {
      logger.info({ jid, length: prefixed.length }, 'Duplicate message suppressed (send_message + text output)');
      return;
    }
    this.recentlySent.set(jid, { prefix: dedupPrefix, time: now });
    // Evict stale entries periodically
    if (this.recentlySent.size > 50) {
      for (const [k, v] of this.recentlySent) {
        if (now - v.time > 30_000) this.recentlySent.delete(k);
      }
    }

    if (!this.connected) {
      this.outgoingQueue.push({ jid, text: prefixed });
      logger.info({ jid, length: prefixed.length, queueSize: this.outgoingQueue.length }, 'WA disconnected, message queued');
      return;
    }
    try {
      const sent = await this.sock.sendMessage(jid, { text: prefixed });
      if (sent?.key?.id) this.trackSentMessage(sent.key.id);
      logger.info({ jid, length: prefixed.length }, 'Message sent');
    } catch (err) {
      // If send fails, queue it for retry
      this.outgoingQueue.push({ jid, text: prefixed });
      logger.warn({ jid, err, queueSize: this.outgoingQueue.length }, 'Failed to send, message queued');
      // Schedule a delayed retry — 403 from groupMetadata is often transient
      // (e.g. initial sync not yet complete) and resolves without reconnection
      this.scheduleRetryFlush();
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.endsWith('@g.us') || jid.endsWith('@s.whatsapp.net');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.sock?.end(undefined);
  }

  async sendReaction(jid: string, messageId: string, emoji: string): Promise<void> {
    try {
      const sent = await this.sock.sendMessage(jid, {
        react: { text: emoji, key: { remoteJid: jid, id: messageId } },
      });
      if (sent?.key?.id) this.trackSentMessage(sent.key.id);
      logger.info({ jid, messageId, emoji }, 'Reaction sent');
    } catch (err) {
      logger.warn({ jid, messageId, emoji, err }, 'Failed to send reaction');
    }
  }

  async sendAudioMessage(jid: string, buffer: Buffer): Promise<void> {
    try {
      const sent = await this.sock.sendMessage(jid, {
        audio: buffer,
        ptt: true,
        mimetype: 'audio/ogg; codecs=opus',
      });
      if (sent?.key?.id) this.trackSentMessage(sent.key.id);
      logger.info({ jid, size: buffer.length }, 'Audio message sent');
    } catch (err) {
      logger.warn({ jid, err }, 'Failed to send audio message');
    }
  }

  async sendImageMessage(jid: string, buffer: Buffer, caption?: string): Promise<void> {
    try {
      const sent = await this.sock.sendMessage(jid, {
        image: buffer,
        caption: caption || undefined,
        mimetype: 'image/png',
      });
      if (sent?.key?.id) this.trackSentMessage(sent.key.id);
      logger.info({ jid, size: buffer.length, hasCaption: !!caption }, 'Image message sent');
    } catch (err) {
      logger.warn({ jid, err }, 'Failed to send image message');
    }
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    try {
      const status = isTyping ? 'composing' : 'paused';
      logger.debug({ jid, status }, 'Sending presence update');
      await this.sock.presenceSubscribe(jid);
      await this.sock.sendPresenceUpdate(status, jid);
    } catch (err) {
      logger.debug({ jid, err }, 'Failed to update typing status');
    }
  }

  /**
   * Sync group metadata from WhatsApp.
   * Fetches all participating groups and stores their names in the database.
   * Called on startup, daily, and on-demand via IPC.
   */
  async syncGroupMetadata(force = false): Promise<void> {
    if (!force) {
      const lastSync = getLastGroupSync();
      if (lastSync) {
        const lastSyncTime = new Date(lastSync).getTime();
        if (Date.now() - lastSyncTime < GROUP_SYNC_INTERVAL_MS) {
          logger.debug({ lastSync }, 'Skipping group sync - synced recently');
          return;
        }
      }
    }

    try {
      logger.info('Syncing group metadata from WhatsApp...');
      const groups = await this.sock.groupFetchAllParticipating();

      let count = 0;
      for (const [jid, metadata] of Object.entries(groups)) {
        if (metadata.subject) {
          updateChatName(jid, metadata.subject);
          count++;
        }
      }

      setLastGroupSync();
      logger.info({ count }, 'Group metadata synced');
    } catch (err) {
      logger.error({ err }, 'Failed to sync group metadata');
    }
  }

  private async translateJid(jid: string): Promise<string> {
    if (!jid.endsWith('@lid')) return jid;
    const lidUser = jid.split('@')[0].split(':')[0];

    // Check local cache first
    const cached = this.lidToPhoneMap[lidUser];
    if (cached) {
      logger.debug({ lidJid: jid, phoneJid: cached }, 'Translated LID to phone JID (cached)');
      return cached;
    }

    // Query Baileys' signal repository for the mapping
    try {
      const pn = await this.sock.signalRepository?.lidMapping?.getPNForLID(jid);
      if (pn) {
        const phoneJid = `${pn.split('@')[0].split(':')[0]}@s.whatsapp.net`;
        this.lidToPhoneMap[lidUser] = phoneJid;
        logger.info({ lidJid: jid, phoneJid }, 'Translated LID to phone JID (signalRepository)');
        return phoneJid;
      }
    } catch (err) {
      logger.debug({ err, jid }, 'Failed to resolve LID via signalRepository');
    }

    return jid;
  }

  private async downloadMedia(msg: WAMessage, groupFolder: string): Promise<string | null> {
    try {
      const inner = extractMessageContent(msg.message);
      if (!inner) return null;

      // Skip viewOnce messages (privacy)
      if (msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2 || msg.message?.viewOnceMessageV2Extension) {
        return null;
      }

      // Find which supported media type is present
      const mediaType = SUPPORTED_MEDIA_TYPES.find((t) => inner[t]);
      if (!mediaType) return null;

      const mediaMsg = inner[mediaType] as Record<string, any>;

      // Also check viewOnce flag on the media message itself
      if (mediaMsg.viewOnce) return null;

      // Check file size before downloading
      const fileLength = Number(mediaMsg.fileLength || 0);
      if (fileLength > MAX_MEDIA_SIZE) {
        logger.warn({ fileLength, maxSize: MAX_MEDIA_SIZE }, 'Media too large, skipping download');
        return null;
      }

      const buffer = await downloadMediaMessage(msg, 'buffer', {});
      const ext = this.mimeToExtension(mediaMsg.mimetype, mediaType);
      const filename = `${msg.key.id}.${ext}`;

      const mediaDir = path.join(DATA_DIR, 'ipc', groupFolder, 'media');
      fs.mkdirSync(mediaDir, { recursive: true });
      fs.writeFileSync(path.join(mediaDir, filename), buffer as Buffer);

      logger.info({ filename, groupFolder, size: (buffer as Buffer).length }, 'Media downloaded');
      return `/workspace/ipc/media/${filename}`;
    } catch (err) {
      logger.warn({ err, msgId: msg.key.id }, 'Failed to download media');
      return null;
    }
  }

  private mimeToExtension(mime: string | undefined | null, mediaType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/msword': 'doc',
      'application/vnd.ms-excel': 'xls',
      'text/plain': 'txt',
      'audio/ogg; codecs=opus': 'ogg',
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'application/zip': 'zip',
      'application/x-tar': 'tar',
      'application/gzip': 'tar.gz',
      'application/x-gzip': 'tar.gz',
    };
    if (mime && map[mime]) return map[mime];
    // Fallback by media type
    if (mediaType === 'imageMessage') return 'jpg';
    if (mediaType === 'stickerMessage') return 'webp';
    if (mediaType === 'audioMessage') return 'ogg';
    if (mediaType === 'documentMessage') return 'bin';
    return 'bin';
  }

  private async flushOutgoingQueue(): Promise<void> {
    if (this.flushing || this.outgoingQueue.length === 0) return;
    this.flushing = true;
    try {
      logger.info({ count: this.outgoingQueue.length }, 'Flushing outgoing message queue');
      while (this.outgoingQueue.length > 0) {
        const item = this.outgoingQueue[0];
        try {
          // Send directly — queued items are already prefixed by sendMessage
          await this.sock.sendMessage(item.jid, { text: item.text });
          this.outgoingQueue.shift(); // Only remove after successful send
          logger.info({ jid: item.jid, length: item.text.length }, 'Queued message sent');
        } catch (err) {
          logger.warn({ jid: item.jid, err }, 'Failed to send queued message, will retry');
          this.scheduleRetryFlush();
          break; // Stop flushing — remaining items stay in queue
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Schedule a delayed retry for the outgoing queue.
   * Handles transient failures (e.g. 403 from groupMetadata during initial sync)
   * without requiring a full reconnection.
   */
  private scheduleRetryFlush(): void {
    if (this.retryTimer) return; // already scheduled
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.connected && this.outgoingQueue.length > 0) {
        logger.info({ queueSize: this.outgoingQueue.length }, 'Retrying queued messages');
        this.flushOutgoingQueue().catch((err) =>
          logger.error({ err }, 'Retry flush failed'),
        );
      }
    }, 15_000); // 15 second delay — enough for group metadata sync to complete
  }
}
