/**
 * Voice Interview Server — Express + Socket.IO.
 * Separate process from main WhatsApp app.
 * Run with: npm run voice
 */
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';

import { readEnvFile } from '../src/env.js';
import { writeInterviewResults } from './competency-writer.js';
import { loadInterviewContext, loadInterviewMetadata } from './context-loader.js';
import { consumeToken, generateToken, validateToken } from './interview-token.js';
import { SessionManager } from './session-manager.js';
import { InterviewSummary } from './types.js';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  maxHttpBufferSize: 1e6, // 1MB max for audio chunks
});

// Serve static frontend
app.use(express.static(path.join(import.meta.dirname, 'public')));

// Generate a test token (development only — disabled in production)
app.get('/api/test-token/:folder', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).send('Not found');
    return;
  }
  const token = generateToken(req.params.folder);
  res.json({ token, url: `/interview/${token}` });
});

// Interview page — validate token and serve
app.get('/interview/:token', (req, res) => {
  const payload = validateToken(req.params.token);
  if (!payload) {
    res.status(403).send('Invalid or expired interview link. Please request a new one from TAi on WhatsApp.');
    return;
  }
  // Serve the interview page with context injected
  res.sendFile(path.join(import.meta.dirname, 'public', 'index.html'));
});

// API to get interview context (called by frontend after page load)
app.get('/api/context/:token', async (req, res) => {
  const payload = validateToken(req.params.token);
  if (!payload) {
    res.status(403).json({ error: 'Invalid token' });
    return;
  }
  try {
    const meta = loadInterviewMetadata(payload.folder);
    res.json(meta);
  } catch (err) {
    console.error('Context load error:', err);
    res.status(500).json({ error: 'Failed to load interview context' });
  }
});

// Active interviews (for cleanup)
const activeInterviews = new Map<string, SessionManager>();

// Socket.IO connection
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  let manager: SessionManager | null = null;

  socket.on('start_interview', async (data: { token: string }) => {
    // consumeToken: validates + marks as single-use (replay protection)
    const payload = consumeToken(data.token);
    if (!payload) {
      socket.emit('error', { message: 'Invalid, expired, or already-used token' });
      return;
    }

    console.log(`Starting interview for ${payload.folder}`);
    socket.emit('status', { phase: 'loading', message: 'Loading your course data...' });

    try {
      // Load all context
      const context = await loadInterviewContext(payload.folder, payload.assignmentId);
      socket.emit('status', { phase: 'connecting', message: 'Connecting to interview...' });

      // Create session manager
      manager = new SessionManager(
        context,
        // onAudio — forward Nova Sonic audio to browser
        (chunk: Buffer) => {
          socket.emit('audio_chunk', chunk.toString('base64'));
        },
        // onDone — interview complete
        (summary: InterviewSummary) => {
          console.log(`Interview done for ${payload.folder}: ${summary.durationMinutes}min`);
          socket.emit('interview_done', {
            duration: summary.durationMinutes,
            rubric: summary.rubric,
            strengths: summary.strengths,
            weaknesses: summary.weaknesses,
          });

          // Write results to COMPETENCY.md
          try {
            writeInterviewResults(summary);
          } catch (err) {
            console.error('Failed to write interview results:', err);
          }

          activeInterviews.delete(socket.id);
          manager = null;
        },
      );

      activeInterviews.set(socket.id, manager);

      // Start the Nova Sonic session
      await manager.start();
      socket.emit('status', { phase: 'active', message: 'Interview started' });
    } catch (err) {
      console.error('Interview start error:', err);
      socket.emit('error', { message: 'Failed to start interview. Please try again.' });
    }
  });

  // Audio from browser → Nova Sonic
  socket.on('audio_chunk', (base64: string) => {
    if (manager) {
      manager.sendAudio(Buffer.from(base64, 'base64'));
    }
  });

  // Student ends interview
  socket.on('end_interview', async () => {
    if (manager) {
      await manager.stop();
    }
  });

  socket.on('disconnect', async () => {
    console.log(`Client disconnected: ${socket.id}`);
    if (manager) {
      await manager.stop();
    }
    activeInterviews.delete(socket.id);
  });
});

// Start server
const secrets = readEnvFile(['VOICE_PORT']);
const port = parseInt(secrets.VOICE_PORT || '3001', 10);

httpServer.listen(port, () => {
  console.log(`Voice interview server running on http://localhost:${port}`);
  console.log(`Generate test token: http://localhost:${port}/api/test-token/<student-folder>`);
});
