
class SoundService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  public isMuted: boolean = false;
  private initialized: boolean = false;
  private clickBuffer: AudioBuffer | null = null;
  private successBuffer: AudioBuffer | null = null;
  private winnerBuffers: AudioBuffer[] = [];
  private levelCompleteBuffer: AudioBuffer | null = null;
  private loseBuffers: AudioBuffer[] = [];
  private bossIntroBuffer: AudioBuffer | null = null;
  private bossIntroSource: AudioBufferSourceNode | null = null;
  private bossBonusBuffer: AudioBuffer | null = null;
  private bossBonusSource: AudioBufferSourceNode | null = null;
  private boss1vittoriaBuffer: AudioBuffer | null = null;
  private boss1vittoriaSource: AudioBufferSourceNode | null = null;
  private boss1sconfittaBuffer: AudioBuffer | null = null;
  private boss1sconfittaSource: AudioBufferSourceNode | null = null;

  /**
   * Inizializza l'AudioContext e sblocca l'hardware con un buffer silente.
   * Cruciale per iOS e Safari.
   */
  public async init() {
    if (this.initialized && this.ctx?.state === 'running') return;

    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
          latencyHint: 'interactive'
        });

        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.4, this.ctx.currentTime);
      }

      if (this.ctx.state !== 'running') {
        await this.ctx.resume();
      }

      // "Kickstart": Riproduce un buffer vuoto per forzare l'attivazione dell'hardware
      const buffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);

      this.initialized = true;
      console.log("Audio Engine Energized:", this.ctx.state);

      this.loadSounds();
    } catch (e) {
      console.warn("Audio Context struggle:", e);
    }
  }

  async loadSounds() {
    if (!this.ctx) return;
    try {
      const clickRes = await fetch('/Clicpulsnati.mp3');
      const clickArr = await clickRes.arrayBuffer();
      this.clickBuffer = await this.ctx.decodeAudioData(clickArr);

      const successRes = await fetch('/combinazione.wav');
      const successArr = await successRes.arrayBuffer();
      this.successBuffer = await this.ctx.decodeAudioData(successArr);

      // Load multiple win sounds
      const winFiles = ['/Win1.mp3', '/Win2.mp3', '/Win3.mp3', '/Win4.mp3'];
      this.winnerBuffers = [];
      for (const file of winFiles) {
        const res = await fetch(file);
        const arr = await res.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(arr);
        this.winnerBuffers.push(buf);
      }

      const levelCompleteRes = await fetch('/Fine_partita_win.mp3');
      const levelCompleteArr = await levelCompleteRes.arrayBuffer();
      this.levelCompleteBuffer = await this.ctx.decodeAudioData(levelCompleteArr);

      // Load multiple lose sounds
      const loseFiles = ['/Lose1.mp3', '/Lose2.mp3'];
      this.loseBuffers = [];
      for (const file of loseFiles) {
        try {
          const res = await fetch(file);
          const arr = await res.arrayBuffer();
          const buf = await this.ctx.decodeAudioData(arr);
          this.loseBuffers.push(buf);
        } catch (e) {
          console.warn(`Failed to load loss sound: ${file}`, e);
        }
      }

      try {
        const bossIntroRes = await fetch('/Boss1intro.mp3');
        const bossIntroArr = await bossIntroRes.arrayBuffer();
        this.bossIntroBuffer = await this.ctx.decodeAudioData(bossIntroArr);
      } catch (e) {
        console.warn("Failed to load boss intro sound:", e);
      }

      try {
        const bossBonusRes = await fetch('/Bonus30secondiboss.mp3');
        const bossBonusArr = await bossBonusRes.arrayBuffer();
        this.bossBonusBuffer = await this.ctx.decodeAudioData(bossBonusArr);
      } catch (e) {
        console.warn("Failed to load boss bonus sound:", e);
      }

      try {
        const boss1WinRes = await fetch('/Boss1vittoria.mp3');
        const boss1WinArr = await boss1WinRes.arrayBuffer();
        this.boss1vittoriaBuffer = await this.ctx.decodeAudioData(boss1WinArr);
      } catch (e) {
        console.warn("Failed to load boss 1 victory sound:", e);
      }

      try {
        const boss1LoseRes = await fetch('/Boss1sconfitta.mp3');
        const boss1LoseArr = await boss1LoseRes.arrayBuffer();
        this.boss1sconfittaBuffer = await this.ctx.decodeAudioData(boss1LoseArr);
      } catch (e) {
        console.warn("Failed to load boss 1 loss sound:", e);
      }
    } catch (e) {
      console.warn("Failed to load sounds:", e);
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (!this.ctx || !this.masterGain) return;

    const targetGain = muted ? 0 : 0.4;
    // Transizione ultra-veloce per evitare click ma mantenere reattività
    this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.02);
  }

  private async playFMSound(carrierFreq: number, modFreq: number, modIndex: number, duration: number, volume: number, type: OscillatorType = 'sine') {
    if (this.isMuted) return;

    // Aggressive State Check & Resume
    if (this.ctx && (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted')) {
      await this.ctx.resume().catch(e => console.warn("Context resume failed", e));
    }

    if (!this.initialized || !this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    // Offset leggermente maggiore per garantire che lo scheduling non fallisca
    const startTime = now + 0.01;

    const carrier = this.ctx.createOscillator();
    const modulator = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const env = this.ctx.createGain();

    carrier.type = type;
    modulator.type = 'sine';

    carrier.frequency.setValueAtTime(carrierFreq, startTime);
    modulator.frequency.setValueAtTime(modFreq, startTime);
    modGain.gain.setValueAtTime(modIndex, startTime);

    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(volume, startTime + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(env);
    env.connect(this.masterGain);

    carrier.start(startTime);
    modulator.start(startTime);

    carrier.stop(startTime + duration);
    modulator.stop(startTime + duration);
  }

  playSelect() {
    if (this.isMuted) return;
    // Feedback "cristallino" ultra-rapido per un feeling premium
    if (this.clickBuffer && this.ctx && this.masterGain) {
      const source = this.ctx.createBufferSource();
      source.buffer = this.clickBuffer;
      const selectGain = this.ctx.createGain();
      // Volume normale per sentire bene il "clic" del file
      selectGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      source.connect(selectGain);
      selectGain.connect(this.masterGain);
      source.playbackRate.setValueAtTime(1.0, this.ctx.currentTime);
      source.start(0);
    } else {
      // FM Sine sweep ultra-veloce (700Hz -> 1400Hz)
      this.playFMSound(700, 1400, 20, 0.04, 0.08, 'sine');
    }
  }


  playUIClick() {
    if (this.isMuted) return;

    if (this.clickBuffer && this.ctx && this.masterGain) {
      // High performance buffer playback
      const source = this.ctx.createBufferSource();
      source.buffer = this.clickBuffer;
      source.connect(this.masterGain);
      source.start(0);
    } else {
      // Fallback to FM synthesis if mp3 not loaded
      this.playFMSound(440, 880, 50, 0.08, 0.15, 'square');
    }
  }

  playSuccess() {
    if (this.isMuted) return;

    if (this.successBuffer && this.ctx && this.masterGain) {
      const source = this.ctx.createBufferSource();
      source.buffer = this.successBuffer;
      source.connect(this.masterGain);
      source.start(0);
    } else {
      // Fallback
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((f, i) => {
        setTimeout(() => this.playFMSound(f, f * 1.5, 300, 0.6, 0.1, 'sine'), i * 80);
      });
    }
  }

  playError() {
    this.playFMSound(110, 55, 500, 0.4, 0.25, 'sawtooth');
  }

  playReset() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.15);
    g.gain.setValueAtTime(0.1, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playBadge() {
    // A clean, high-pitched double chime for notifications
    const now = this.ctx?.currentTime || 0;
    this.playFMSound(880, 1760, 100, 0.1, 0.1, 'sine');
    setTimeout(() => this.playFMSound(1320, 2640, 50, 0.2, 0.1, 'sine'), 100);
  }

  /**
   * Riproduce un file audio esterno (es. MP3/WAV) dalla cartella public
   * @param filename Nome del file (es. 'win.mp3')
   */
  async playExternalSound(filename: string) {
    if (this.isMuted) return;

    if (this.ctx && (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted')) {
      await this.ctx.resume().catch(e => console.warn("External sound resume failed", e));
    }

    try {
      const cleanName = filename.startsWith('/') ? filename.slice(1) : filename;
      const audio = new Audio(`/${cleanName}`);
      audio.volume = 0.7; // Volume più deciso
      audio.play().catch(e => console.warn("Auto-play stopped:", e));
    } catch (e) {
      console.warn("External sound playback failed:", e);
    }
  }

  playTick() {
    this.playFMSound(600, 300, 200, 0.05, 0.3, 'square');
  }

  playPop() {
    this.playFMSound(400, 200, 100, 0.1, 0.3, 'sine');
  }

  playWinner(index?: number) {
    if (this.isMuted || this.winnerBuffers.length === 0 || !this.ctx || !this.masterGain) return;

    // Use index if provided and valid, otherwise random
    let bufferToPlay = this.winnerBuffers[0];
    if (index !== undefined && index >= 0 && index < this.winnerBuffers.length) {
      bufferToPlay = this.winnerBuffers[index];
    } else if (index === undefined) {
      bufferToPlay = this.winnerBuffers[Math.floor(Math.random() * this.winnerBuffers.length)];
    }

    const source = this.ctx.createBufferSource();
    source.buffer = bufferToPlay;
    source.connect(this.masterGain);
    source.start(0);
  }

  playLevelComplete() {
    if (this.isMuted || !this.levelCompleteBuffer || !this.ctx || !this.masterGain) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.levelCompleteBuffer;
    source.connect(this.masterGain);
    source.start(0);
  }

  playLose(index?: number) {
    if (this.isMuted || this.loseBuffers.length === 0 || !this.ctx || !this.masterGain) return;

    // Use index if provided and valid, otherwise random
    let bufferToPlay = this.loseBuffers[0];
    if (index !== undefined && index >= 0 && index < this.loseBuffers.length) {
      bufferToPlay = this.loseBuffers[index];
    } else if (index === undefined) {
      bufferToPlay = this.loseBuffers[Math.floor(Math.random() * this.loseBuffers.length)];
    }

    const source = this.ctx.createBufferSource();
    source.buffer = bufferToPlay;
    source.connect(this.masterGain);
    source.start(0);
  }

  playBossIntro() {
    if (this.isMuted || !this.bossIntroBuffer || !this.ctx || !this.masterGain) return;
    this.stopBossIntro();
    this.bossIntroSource = this.ctx.createBufferSource();
    this.bossIntroSource.buffer = this.bossIntroBuffer;
    this.bossIntroSource.connect(this.masterGain);
    this.bossIntroSource.start(0);
  }

  stopBossIntro() {
    if (this.bossIntroSource) {
      try {
        this.bossIntroSource.stop();
      } catch (e) { }
      this.bossIntroSource = null;
    }
  }

  playBossBonus() {
    if (this.isMuted || !this.bossBonusBuffer || !this.ctx || !this.masterGain) return;
    this.stopBossBonus();
    this.bossBonusSource = this.ctx.createBufferSource();
    this.bossBonusSource.buffer = this.bossBonusBuffer;
    this.bossBonusSource.connect(this.masterGain);
    this.bossBonusSource.start(0);
  }

  stopBossBonus() {
    if (this.bossBonusSource) {
      try { this.bossBonusSource.stop(); } catch (e) { }
      this.bossBonusSource = null;
    }
  }

  playBoss1vittoria() {
    if (this.isMuted || !this.boss1vittoriaBuffer || !this.ctx || !this.masterGain) return;
    this.stopBoss1vittoria();
    this.boss1vittoriaSource = this.ctx.createBufferSource();
    this.boss1vittoriaSource.buffer = this.boss1vittoriaBuffer;
    this.boss1vittoriaSource.connect(this.masterGain);
    this.boss1vittoriaSource.start(0);
  }

  stopBoss1vittoria() {
    if (this.boss1vittoriaSource) {
      try { this.boss1vittoriaSource.stop(); } catch (e) { }
      this.boss1vittoriaSource = null;
    }
  }

  playBoss1sconfitta() {
    if (this.isMuted || !this.boss1sconfittaBuffer || !this.ctx || !this.masterGain) return;
    this.stopBoss1sconfitta();
    this.boss1sconfittaSource = this.ctx.createBufferSource();
    this.boss1sconfittaSource.buffer = this.boss1sconfittaBuffer;
    this.boss1sconfittaSource.connect(this.masterGain);
    this.boss1sconfittaSource.start(0);
  }

  stopBoss1sconfitta() {
    if (this.boss1sconfittaSource) {
      try { this.boss1sconfittaSource.stop(); } catch (e) { }
      this.boss1sconfittaSource = null;
    }
  }
}

export const soundService = new SoundService();
