import { getDb } from './db.js';

export interface MemoryFact {
  text: string;
  category?: string;
  entity?: string;
  key?: string;
  value?: string;
}

type DecayClass = 'permanent' | 'stable' | 'active' | 'session' | 'checkpoint';

const DECAY_TTL_MS: Record<DecayClass, number | null> = {
  permanent: null,
  stable:     90 * 24 * 60 * 60 * 1000,
  active:     14 * 24 * 60 * 60 * 1000,
  session:     1 * 24 * 60 * 60 * 1000,
  checkpoint:  4 * 60 * 60 * 1000,
};

const CATEGORY_DECAY: Record<string, DecayClass> = {
  student_preference: 'permanent',
  decision:           'permanent',
  identity:           'permanent',
  misconception:      'stable',
  breakthrough:       'stable',
  concept:            'active',
  homework:           'active',
  session:            'session',
  checkpoint:         'checkpoint',
  other:              'stable',
};

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of',
  'and', 'or', 'but', 'not', 'with', 'this', 'that', 'was', 'are', 'be',
  'have', 'has', 'had', 'do', 'did', 'will', 'can', 'how', 'what', 'when',
]);

export function storeMemory(studentFolder: string, fact: MemoryFact): void {
  const db = getDb();
  const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const category = fact.category || 'other';
  const decayClass: DecayClass = (CATEGORY_DECAY[category] as DecayClass) || 'stable';
  const ttl = DECAY_TTL_MS[decayClass];
  const createdAt = Date.now();
  const expiresAt = ttl ? createdAt + ttl : null;

  db.prepare(`
    INSERT INTO memories (id, student_folder, text, category, entity, key, value, source, created_at, decay_class, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'agent', ?, ?, ?)
  `).run(
    id, studentFolder, fact.text, category,
    fact.entity ?? null, fact.key ?? null, fact.value ?? null,
    createdAt, decayClass, expiresAt,
  );
}

interface MemoryRow {
  text: string;
  category: string;
  entity: string | null;
  key: string | null;
  value: string | null;
  created_at: number;
}

export function recallMemories(studentFolder: string, query: string, limit = 5): MemoryRow[] {
  const db = getDb();
  const now = Date.now();

  const keywords = query.toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  if (keywords.length > 0) {
    const ftsQuery = keywords.join(' OR ');
    try {
      const rows = db.prepare(`
        SELECT m.text, m.category, m.entity, m.key, m.value, m.created_at
        FROM memories m
        WHERE m.rowid IN (
          SELECT rowid FROM memories_fts WHERE memories_fts MATCH ?
        )
        AND m.student_folder = ?
        AND (m.expires_at IS NULL OR m.expires_at > ?)
        ORDER BY m.created_at DESC
        LIMIT ?
      `).all(ftsQuery, studentFolder, now, limit) as MemoryRow[];
      if (rows.length > 0) return rows;
    } catch {
      /* FTS5 not available, fall through to recency-based recall */
    }
  }

  return db.prepare(`
    SELECT text, category, entity, key, value, created_at
    FROM memories
    WHERE student_folder = ? AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY created_at DESC
    LIMIT ?
  `).all(studentFolder, now, limit) as MemoryRow[];
}

interface MessageRow {
  sender_name: string;
  content: string;
  timestamp: string;
  is_bot_message: number;
}

function recallMessages(chatJid: string, limit = 20): MessageRow[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT sender_name, content, timestamp, is_bot_message
    FROM messages
    WHERE chat_jid = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(chatJid, limit) as MessageRow[];
  return rows.reverse();
}

export function buildMemoryContext(chatJid: string, studentFolder: string, prompt: string): string {
  const memories = recallMemories(studentFolder, prompt, 6);
  const messages = recallMessages(chatJid, 20);

  const parts: string[] = ['<memory_context>'];

  if (memories.length > 0) {
    parts.push('## Stored memories (from past sessions)');
    for (const m of memories) {
      const kv = m.key && m.value ? ` [${m.key}=${m.value}]` : '';
      parts.push(`- [${m.category}]${kv} ${m.text}`);
    }
  }

  if (messages.length > 0) {
    parts.push('## Recent conversation history');
    for (const msg of messages) {
      const role = msg.is_bot_message ? 'TAi' : (msg.sender_name || 'Student');
      const ts = msg.timestamp ? msg.timestamp.slice(0, 10) : '';
      const content = msg.content.length > 250
        ? msg.content.slice(0, 250) + '...'
        : msg.content;
      parts.push(`[${ts}] ${role}: ${content}`);
    }
  }

  if (parts.length === 1) return '';

  parts.push('</memory_context>');
  return parts.join('\n');
}

export interface MemoryExport {
  memories: MemoryRow[];
  messages: MessageRow[];
}

export function buildMemoryExport(studentFolder: string, chatJid: string): MemoryExport {
  const db = getDb();
  const memories = db.prepare(`
    SELECT text, category, entity, key, value, created_at
    FROM memories
    WHERE student_folder = ? AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY created_at DESC
  `).all(studentFolder, Date.now()) as MemoryRow[];

  // Include last 100 messages for searchable history
  const messages = (db.prepare(`
    SELECT sender_name, content, timestamp, is_bot_message
    FROM messages
    WHERE chat_jid = ?
    ORDER BY timestamp DESC
    LIMIT 100
  `).all(chatJid) as MessageRow[]).reverse();

  return { memories, messages };
}

export function pruneExpiredMemories(): number {
  const db = getDb();
  const result = db.prepare(
    `DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at < ?`,
  ).run(Date.now());
  return result.changes;
}
