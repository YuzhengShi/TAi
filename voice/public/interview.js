/**
 * Interview client — handles Socket.IO, mic capture, audio playback.
 *
 * Critical audio routing for Android:
 * - Playback: AudioContext + BufferSource (media channel, gapless)
 * - Mic capture: MediaStreamTrackProcessor (Breakout Box API, NO AudioContext involvement)
 * - The AudioContext NEVER touches getUserMedia → stays in media mode on Android
 * - Fallback: AudioWorklet if MediaStreamTrackProcessor unavailable (older browsers)
 */

class InterviewClient {
  constructor(token) {
    this.token = token;
    this.socket = null;
    this.audioContext = null;
    this.workletNode = null;
    this.stream = null;
    this.playbackQueue = [];
    this.isPlaying = false;
    this.currentSource = null;
    this.startTime = null;
    this.timerInterval = null;
    this.gainNode = null;
    this.captureActive = false;
    this.usingTrackProcessor = false;
  }

  async init() {
    this.socket = io();

    this.socket.on('status', (data) => this.setStatus(data.phase, data.message));
    this.socket.on('audio_chunk', (base64) => this.queueAudio(base64));
    this.socket.on('interview_done', (data) => this.onInterviewDone(data));
    this.socket.on('error', (data) => this.setStatus('error', data.message));
    this.socket.on('disconnect', () => this.setStatus('disconnected', 'Connection lost. Please refresh.'));
    try {
      const resp = await fetch(`/api/context/${this.token}`);
      if (resp.ok) {
        const ctx = await resp.json();
        document.getElementById('student-name').textContent = ctx.studentName;
        document.getElementById('assignment-name').textContent = ctx.assignmentName;
      }
    } catch { /* ignore */ }
  }

  async start() {
    try {
      if (!navigator.mediaDevices) {
        const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        this.setStatus('error', isLocalhost
          ? 'Mic access not available. Try Chrome or Firefox.'
          : 'Mic access requires HTTPS or localhost.');
        return;
      }

      // Step 1: Create AudioContext for PLAYBACK ONLY (establishes media audio session)
      this.audioContext = new AudioContext({ sampleRate: 48000 });
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);

      // Play silent buffer to activate media session before getUserMedia
      const silentBuf = this.audioContext.createBuffer(1, 4800, 48000);
      const silentSrc = this.audioContext.createBufferSource();
      silentSrc.buffer = silentBuf;
      silentSrc.connect(this.audioContext.destination);
      silentSrc.start();
      await new Promise(r => setTimeout(r, 100));

      // Step 2: Get mic stream
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: false,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });

      // Step 3: Capture mic WITHOUT connecting to AudioContext
      if (typeof MediaStreamTrackProcessor !== 'undefined') {
        this.startTrackProcessor();
      } else {
        await this.startAudioWorklet();
      }

      this.socket.emit('start_interview', { token: this.token });

      this.startTime = Date.now();
      this.timerInterval = setInterval(() => this.updateTimer(), 1000);

      document.getElementById('start-btn').style.display = 'none';
      document.getElementById('end-btn').style.display = 'inline-block';
      document.getElementById('mic-indicator').classList.add('active');
    } catch (err) {
      this.setStatus('error', `Mic access denied: ${err.message}`);
    }
  }

  // --- Mic Capture: MediaStreamTrackProcessor (preferred, keeps media mode) ---

  startTrackProcessor() {
    this.usingTrackProcessor = true;
    this.captureActive = true;

    const track = this.stream.getAudioTracks()[0];
    const processor = new MediaStreamTrackProcessor({ track });
    const reader = processor.readable.getReader();

    const CHUNK_SIZE = 1600; // 100ms at 16kHz
    let resampleBuf = [];

    const readLoop = async () => {
      while (this.captureActive) {
        try {
          const { value: frame, done } = await reader.read();
          if (done) break;

          const srcRate = frame.sampleRate;
          const float32 = new Float32Array(frame.numberOfFrames);
          frame.copyTo(float32, { planeIndex: 0 });
          frame.close();

          // Resample to 16kHz (simple decimation, fine for voice)
          const ratio = srcRate / 16000;
          for (let i = 0; i < float32.length; i += ratio) {
            const idx = Math.floor(i);
            if (idx < float32.length) resampleBuf.push(float32[idx]);
          }

          // Emit 100ms chunks
          while (resampleBuf.length >= CHUNK_SIZE) {
            const chunk = resampleBuf.splice(0, CHUNK_SIZE);
            const int16 = new Int16Array(chunk.length);
            for (let j = 0; j < chunk.length; j++) {
              const s = Math.max(-1, Math.min(1, chunk[j]));
              int16[j] = s < 0 ? s * 32768 : s * 32767;
            }

            if (this.socket?.connected) {
              // Send silence while AI is playing to prevent speaker echo
              // feeding back into Nova Sonic as user speech.
              const toSend = this.isPlaying ? new Int16Array(int16.length) : int16;
              this.socket.emit('audio_chunk', this.arrayBufferToBase64(toSend.buffer));
            }
          }
        } catch (e) {
          if (this.captureActive) console.error('Track processor error:', e);
          break;
        }
      }
    };

    readLoop();
  }

  // --- Mic Capture: AudioWorklet fallback (older browsers, may use communication mode) ---

  async startAudioWorklet() {
    this.usingTrackProcessor = false;
    await this.audioContext.audioWorklet.addModule('/audio-worklet.js');

    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-capture');

    this.workletNode.port.onmessage = (event) => {
      if (this.socket?.connected) {
        // Send silence while AI is playing to prevent speaker echo
        // feeding back into Nova Sonic as user speech.
        if (this.isPlaying) {
          const silence = new Int16Array(new Int16Array(event.data).length);
          this.socket.emit('audio_chunk', this.arrayBufferToBase64(silence.buffer));
        } else {
          this.socket.emit('audio_chunk', this.arrayBufferToBase64(event.data));
        }
      }
    };

    source.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);
  }

  stop() {
    this.socket?.emit('end_interview');
    this.cleanup();
  }

  // --- Audio Playback (AudioContext BufferSource — gapless, media channel) ---

  queueAudio(base64) {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }
    this.playbackQueue.push(float32);
    if (!this.isPlaying) this.playNext();
  }

  playNext() {
    if (this.playbackQueue.length === 0 || !this.audioContext) {
      this.isPlaying = false;
      this.currentSource = null;
      return;
    }
    this.isPlaying = true;

    const samples = this.playbackQueue.shift();
    const buffer = this.audioContext.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);
    source.onended = () => this.playNext();
    this.currentSource = source;
    source.start();
  }

  // --- UI ---

  setStatus(phase, message) {
    const el = document.getElementById('status');
    el.textContent = message;
    el.className = `status ${phase}`;
    if (phase === 'active') {
      document.getElementById('speaking-indicator').style.display = 'block';
    }
  }

  updateTimer() {
    if (!this.startTime) return;
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const min = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const sec = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('timer').textContent = `${min}:${sec}`;
  }

  onInterviewDone(data) {
    this.cleanup();
    document.getElementById('results').style.display = 'block';
    document.getElementById('interview-area').style.display = 'none';

    document.getElementById('result-duration').textContent = `${data.duration} minutes`;
    document.getElementById('result-clarity').textContent = `${data.rubric.verbal_clarity}/5`;
    document.getElementById('result-accuracy').textContent = `${data.rubric.technical_accuracy}/5`;
    document.getElementById('result-depth').textContent = `${data.rubric.depth_of_reasoning}/5`;
    document.getElementById('result-process').textContent = `${data.rubric.problem_solving_process}/5`;

    const strengthsEl = document.getElementById('result-strengths');
    strengthsEl.textContent = '';
    for (const s of data.strengths) {
      const li = document.createElement('li');
      li.textContent = s;
      strengthsEl.appendChild(li);
    }
    const weaknessesEl = document.getElementById('result-weaknesses');
    weaknessesEl.textContent = '';
    for (const w of data.weaknesses) {
      const li = document.createElement('li');
      li.textContent = w;
      weaknessesEl.appendChild(li);
    }
  }

  cleanup() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.captureActive = false;
    if (this.workletNode) this.workletNode.disconnect();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.playbackQueue = [];
    if (this.currentSource) {
      this.currentSource.onended = null;
      try { this.currentSource.stop(); } catch (_) {}
      this.currentSource = null;
    }
    this.gainNode = null;
    if (this.audioContext) this.audioContext.close();
    this.audioContext = null;

    document.getElementById('mic-indicator').classList.remove('active');
    document.getElementById('end-btn').style.display = 'none';
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

let client = null;

window.addEventListener('DOMContentLoaded', async () => {
  const path = window.location.pathname;
  const match = path.match(/\/interview\/(.+)/);
  if (!match) {
    document.getElementById('status').textContent = 'Invalid interview link.';
    return;
  }

  const token = match[1];
  client = new InterviewClient(token);
  await client.init();

  document.getElementById('start-btn').addEventListener('click', () => client.start());
  document.getElementById('end-btn').addEventListener('click', () => client.stop());
});
