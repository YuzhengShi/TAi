#!/usr/bin/env node
/**
 * Post-process VTT transcripts: strip timestamps, merge text, fix proper nouns via LLM.
 * Outputs clean text + timestamp mapping JSON for LeanRAG ingestion.
 *
 * Usage: node /opt/scripts/polish-transcripts.mjs [--force]
 * Env: AWS_REGION (for Bedrock Haiku 4.5)
 *
 * Input:  /workspace/extra/course-materials/transcripts/*.vtt
 * Output: /workspace/extra/course-materials/transcripts-polished/{name}.txt
 *         /workspace/extra/course-materials/transcripts-polished/{name}.timestamps.json
 */
import fs from 'fs';
import path from 'path';

const INPUT_DIR = '/workspace/extra/course-materials/transcripts';
const OUTPUT_DIR = '/workspace/extra/course-materials/transcripts-polished';
const MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
const CHUNK_WORDS = 800;
const FORCE = process.argv.includes('--force');

const GLOSSARY = [
  'CS6650', 'Piazza', 'Paxos', 'Raft', 'goroutines', 'goroutine', 'Gin',
  'Terraform', 'MapReduce', 'CAP theorem', 'consistent hashing',
  'Yvonne Coady', 'Northeastern', 'Docker', 'Kubernetes', 'gRPC',
  'REST', 'HTTP', 'AWS', 'EC2', 'ECS', 'Lambda', 'Kafka', 'DynamoDB',
  'Go', 'Golang', 'mutex', 'channel', 'WaitGroup', 'sync.Mutex',
  'load balancer', 'round robin', 'Cassandra', 'MongoDB', 'Redis',
  'Zookeeper', 'etcd', 'quorum', 'leader election', 'heartbeat',
  'partition tolerance', 'eventual consistency', 'strong consistency',
  'linearizability', 'vector clock', 'Lamport clock', 'GCP',
  'Google Cloud', 'Elastic Load Balancer', 'Auto Scaling',
].join(', ');

const POLISH_PROMPT = `You are a transcript editor for a university course (CS6650 Building Scalable Distributed Systems).

Fix ONLY these issues in the transcript chunk below:
1. Proper nouns: fix misspellings using this glossary: ${GLOSSARY}
2. Split sentences: rejoin sentences that were artificially split mid-thought
3. Remove filler artifacts: "um", "uh", repeated false starts

Do NOT:
- Rephrase or paraphrase — preserve the speaker's exact words and spoken style
- Add punctuation that changes meaning
- Remove intentional repetition used for emphasis
- Change technical explanations or analogies

Return ONLY the cleaned text, no commentary.`;

function parseVtt(content) {
  const lines = content.split('\n');
  const cues = [];
  let i = 0;

  // Skip WEBVTT header
  while (i < lines.length && !lines[i].includes('-->')) i++;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->').map(s => s.trim());
      const textLines = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
        const cleaned = lines[i].replace(/<[^>]+>/g, '').trim();
        if (cleaned) textLines.push(cleaned);
        i++;
      }
      if (textLines.length > 0) {
        cues.push({
          start: startStr,
          end: endStr,
          text: textLines.join(' '),
        });
      }
    } else {
      i++;
    }
  }
  return cues;
}

function timeToSeconds(timeStr) {
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return parseInt(m) * 60 + parseFloat(s);
  }
  return parseFloat(timeStr);
}

function chunkCues(cues, wordsPerChunk) {
  const chunks = [];
  let currentText = [];
  let currentWordCount = 0;
  let startTime = cues[0]?.start || '00:00:00.000';
  let endTime = startTime;

  for (const cue of cues) {
    const words = cue.text.split(/\s+/).length;
    if (currentWordCount + words > wordsPerChunk && currentText.length > 0) {
      chunks.push({
        text: currentText.join(' '),
        start: startTime,
        end: endTime,
      });
      currentText = [cue.text];
      currentWordCount = words;
      startTime = cue.start;
    } else {
      currentText.push(cue.text);
      currentWordCount += words;
    }
    endTime = cue.end;
  }

  if (currentText.length > 0) {
    chunks.push({ text: currentText.join(' '), start: startTime, end: endTime });
  }
  return chunks;
}

async function callHaiku(text) {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
  const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-2' });

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 4096,
    messages: [
      { role: 'user', content: `${POLISH_PROMPT}\n\n---\n\n${text}` },
    ],
    temperature: 0.1,
  });

  const resp = await client.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body,
  }));

  const result = JSON.parse(new TextDecoder().decode(resp.body));
  return result.content[0]?.text || text;
}

// ─── Main ───────────────────────────────────────────────────────────────────

if (!fs.existsSync(INPUT_DIR)) {
  console.error(`Input directory not found: ${INPUT_DIR}`);
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const vttFiles = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.vtt'));
process.stderr.write(`[main] Found ${vttFiles.length} VTT file(s)\n`);

let polished = 0, skippedCount = 0, failedCount = 0;

for (const file of vttFiles) {
  const baseName = file.replace('.vtt', '');
  const outText = path.join(OUTPUT_DIR, `${baseName}.txt`);
  const outTimestamps = path.join(OUTPUT_DIR, `${baseName}.timestamps.json`);

  if (!FORCE && fs.existsSync(outText)) {
    process.stderr.write(`[skip] ${baseName}\n`);
    skippedCount++;
    continue;
  }

  process.stderr.write(`[polish] ${baseName}\n`);

  try {
    const vttContent = fs.readFileSync(path.join(INPUT_DIR, file), 'utf-8');
    const cues = parseVtt(vttContent);

    if (cues.length === 0) {
      process.stderr.write(`[warn] ${baseName}: no cues found\n`);
      failedCount++;
      continue;
    }

    const chunks = chunkCues(cues, CHUNK_WORDS);
    process.stderr.write(`[info] ${baseName}: ${cues.length} cues → ${chunks.length} chunk(s)\n`);

    const polishedChunks = [];
    const timestamps = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      process.stderr.write(`  chunk ${i + 1}/${chunks.length}...\n`);

      const cleaned = await callHaiku(chunk.text);
      polishedChunks.push(cleaned);
      timestamps.push({
        chunk_index: i,
        start: chunk.start,
        end: chunk.end,
        start_seconds: timeToSeconds(chunk.start),
        end_seconds: timeToSeconds(chunk.end),
        word_count: cleaned.split(/\s+/).length,
      });
    }

    const fullText = polishedChunks.join('\n\n');
    fs.writeFileSync(outText, fullText, 'utf-8');
    fs.writeFileSync(outTimestamps, JSON.stringify(timestamps, null, 2), 'utf-8');
    process.stderr.write(`[done] ${baseName} (${fullText.length} chars, ${chunks.length} chunks)\n`);
    polished++;
  } catch (e) {
    process.stderr.write(`[fail] ${baseName}: ${e.message}\n`);
    failedCount++;
  }
}

console.log('\n=== Polish Summary ===');
console.log(`Total VTT files: ${vttFiles.length}`);
console.log(`Polished: ${polished}`);
console.log(`Skipped (already exist): ${skippedCount}`);
console.log(`Failed: ${failedCount}`);
