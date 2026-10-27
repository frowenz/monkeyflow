/* Microphone level meter + simple voice activity detection. Used to draw the
 * live level ring and to start/stop the clock when an external dictation app
 * (e.g. Wispr Flow) only pastes text after you finish talking. */

export interface MicEvents {
  onLevel: (level: number) => void;
  onVoiceStart: (at: number) => void;
}

const MIN_RMS = 0.012;
const ONSET_MS = 120;

export class MicMonitor {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private raf = 0;
  private buf: Float32Array<ArrayBuffer> | null = null;
  private noiseFloor = 0.004;
  private aboveSince: number | null = null;
  private speaking = false;
  private smoothed = 0;
  lastVoiceAt = 0;
  voiceStartAt = 0;

  private events: MicEvents;

  constructor(events: MicEvents) {
    this.events = events;
  }

  get running(): boolean {
    return this.stream !== null;
  }

  async start(): Promise<void> {
    if (this.stream) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.stream = stream;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    this.analyser = analyser;
    this.buf = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
    this.loop();
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.analyser = null;
    this.speaking = false;
    this.aboveSince = null;
    this.smoothed = 0;
    this.events.onLevel(0);
  }

  isSpeakingRecently(withinMs: number): boolean {
    return this.speaking || performance.now() - this.lastVoiceAt < withinMs;
  }

  private loop = () => {
    if (!this.analyser || !this.buf) return;
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    const rms = Math.sqrt(sum / this.buf.length);
    const now = performance.now();

    const threshold = Math.max(MIN_RMS, this.noiseFloor * 3);
    if (rms > threshold) {
      if (this.aboveSince === null) this.aboveSince = now;
      if (!this.speaking && now - this.aboveSince >= ONSET_MS) {
        this.speaking = true;
        this.voiceStartAt = this.aboveSince;
        this.events.onVoiceStart(this.aboveSince);
      }
      if (this.speaking) this.lastVoiceAt = now;
    } else {
      this.aboveSince = null;
      this.noiseFloor = this.noiseFloor * 0.995 + rms * 0.005;
      if (this.speaking && now - this.lastVoiceAt > 350) this.speaking = false;
    }

    const db = 20 * Math.log10(Math.max(rms, 1e-5));
    const level = Math.min(1, Math.max(0, (db + 55) / 40));
    this.smoothed = level > this.smoothed ? level * 0.6 + this.smoothed * 0.4 : level * 0.15 + this.smoothed * 0.85;
    this.events.onLevel(this.smoothed);
    this.raf = requestAnimationFrame(this.loop);
  };
}
