/* Microphone level meter + simple voice activity detection. Used to draw the
 * live level ring and to start/stop the clock when an external dictation app
 * (e.g. Wispr Flow) only pastes text after you finish talking.
 *
 * On phones this must not run while built-in speech recognition is listening:
 * Android gives the microphone to only one capture (the recognizer hears silence)
 * and iOS mutes one of the two. Use pulse() there to animate the level instead. */

export interface MicEvents {
  onLevel: (level: number) => void;
  onVoiceStart: (at: number) => void;
  /** The browser ended the capture (device unplugged, phone call, another app took the mic). */
  onLost?: () => void;
}

const MIN_RMS = 0.012;
const ONSET_MS = 120;

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ?? null;
}

async function openMicStream(): Promise<MediaStream> {
  const media = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
  if (!media?.getUserMedia) throw new DOMException("Microphone capture needs a secure (https) page.", "NotSupportedError");
  try {
    return await media.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAllowedError" || name === "SecurityError") throw err;
    // Older Safari rejects constraint sets it doesn't know; plain audio works everywhere.
    return media.getUserMedia({ audio: true });
  }
}

export class MicMonitor {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private raf = 0;
  private buf: Float32Array<ArrayBuffer> | null = null;
  private bytes: Uint8Array<ArrayBuffer> | null = null;
  private pending: Promise<void> | null = null;
  private token = 0;
  private wanted = false;
  private listening = false;
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

  /** Call synchronously from the click/keydown handler: iOS only unlocks audio inside the gesture. */
  start(): Promise<void> {
    this.wanted = true;
    this.ensureContext();
    if (this.stream) return Promise.resolve();
    if (this.pending) return this.pending;
    const token = ++this.token;
    const pending = this.open(token).finally(() => {
      if (this.pending === pending) this.pending = null;
    });
    this.pending = pending;
    return pending;
  }

  private async open(token: number): Promise<void> {
    let stream: MediaStream;
    try {
      stream = await openMicStream();
    } catch (err) {
      if (token === this.token && this.ctx?.state === "running") void this.ctx.suspend().catch(() => {});
      throw err;
    }
    if (token !== this.token) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    stream.getAudioTracks().forEach((t) => t.addEventListener("ended", this.onTrackEnded));
    this.listen(true);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    this.source = source;
    this.analyser = analyser;
    this.buf = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
    cancelAnimationFrame(this.raf);
    this.loop();
  }

  /** One context for the page's lifetime: iOS limits how many exist and each needs a gesture to run. */
  private ensureContext(): AudioContext | null {
    if (!this.ctx || this.ctx.state === "closed") {
      const Ctx = audioContextCtor();
      if (!Ctx) return null;
      try {
        this.ctx = new Ctx();
      } catch {
        return null;
      }
    }
    this.resumeAudio();
    return this.ctx;
  }

  /** AudioContexts created without a user gesture start suspended; iOS also "interrupts" them on calls and app switches. */
  resumeAudio(): void {
    const ctx = this.ctx;
    if (ctx && ctx.state !== "running" && ctx.state !== "closed") void ctx.resume().catch(() => {});
  }

  stop(): void {
    this.wanted = false;
    this.token++;
    this.pending = null;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.release();
    if (this.ctx?.state === "running") void this.ctx.suspend().catch(() => {});
    this.listen(false);
    this.speaking = false;
    this.aboveSince = null;
    this.smoothed = 0;
    this.events.onLevel(0);
  }

  /**
   * Animates the level from outside activity (e.g. recognizer results) while no
   * stream is open, so the ring still reacts on phones where the recognizer owns the mic.
   */
  pulse(strength = 0.6): void {
    if (this.stream) return;
    this.smoothed = Math.max(this.smoothed, Math.min(1, strength));
    if (!this.raf) this.raf = requestAnimationFrame(this.decay);
  }

  isSpeakingRecently(withinMs: number): boolean {
    return this.speaking || performance.now() - this.lastVoiceAt < withinMs;
  }

  private release() {
    this.source?.disconnect();
    this.source = null;
    this.analyser = null;
    this.stream?.getTracks().forEach((t) => {
      t.removeEventListener("ended", this.onTrackEnded);
      t.stop();
    });
    this.stream = null;
  }

  private listen(on: boolean) {
    if (on === this.listening || typeof document === "undefined") return;
    this.listening = on;
    if (on) document.addEventListener("visibilitychange", this.onVisibility);
    else document.removeEventListener("visibilitychange", this.onVisibility);
  }

  private onTrackEnded = () => {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.release();
    this.speaking = false;
    this.aboveSince = null;
    this.smoothed = 0;
    this.events.onLevel(0);
    this.events.onLost?.();
  };

  private onVisibility = () => {
    if (document.visibilityState !== "visible" || !this.wanted) return;
    this.resumeAudio();
    if (!this.stream && !this.pending) void this.start().catch(() => {});
  };

  private decay = () => {
    this.raf = 0;
    if (this.stream) return;
    this.smoothed = this.smoothed < 0.02 ? 0 : this.smoothed * 0.92;
    this.events.onLevel(this.smoothed);
    if (this.smoothed > 0) this.raf = requestAnimationFrame(this.decay);
  };

  private readRms(analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>): number {
    if (typeof analyser.getFloatTimeDomainData === "function") {
      analyser.getFloatTimeDomainData(buf);
    } else {
      // Safari before 14.1 only has the byte variant.
      const bytes = (this.bytes ??= new Uint8Array(new ArrayBuffer(analyser.fftSize)));
      analyser.getByteTimeDomainData(bytes);
      for (let i = 0; i < bytes.length; i++) buf[i] = (bytes[i] - 128) / 128;
    }
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  private loop = () => {
    if (!this.analyser || !this.buf) return;
    const rms = this.readRms(this.analyser, this.buf);
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
