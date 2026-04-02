/**
 * AudioWorklet processor for capturing mic audio as 16kHz mono PCM.
 * Receives Float32 samples from the browser's audio graph,
 * resamples to 16kHz, converts to Int16, and posts to main thread.
 */
class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    // Send a chunk every ~100ms (1600 samples at 16kHz)
    this.chunkSize = 1600;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0]; // Float32Array, mono channel

    // Downsample from source rate (usually 48kHz) to 16kHz
    // sampleRate is available in AudioWorkletGlobalScope
    const ratio = sampleRate / 16000;
    for (let i = 0; i < samples.length; i += ratio) {
      const idx = Math.floor(i);
      if (idx < samples.length) {
        this.buffer.push(samples[idx]);
      }
    }

    // When we have enough samples, send a chunk
    while (this.buffer.length >= this.chunkSize) {
      const chunk = this.buffer.splice(0, this.chunkSize);
      // Convert Float32 (-1 to 1) to Int16 (-32768 to 32767)
      const pcm = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        pcm[i] = s < 0 ? s * 32768 : s * 32767;
      }
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm-capture', PCMCaptureProcessor);
