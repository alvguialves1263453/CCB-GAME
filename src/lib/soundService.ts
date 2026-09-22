class SoundService {
  private ctx: AudioContext | null = null;
  private bgMusicGain: GainNode | null = null;
  private bgOscillators: OscillatorNode[] = [];
  private bgMusicPlaying = false;
  
  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playClick() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.08);
      
      gainNode.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch(e) {}
  }

  playTick() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      
      gainNode.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.03);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.03);
    } catch(e) {}
  }

  playBell() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const t = this.ctx.currentTime;
      const freqs = [523, 659, 784, 1047];
      
      freqs.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        
        gainNode.gain.setValueAtTime(0, t);
        gainNode.gain.linearRampToValueAtTime(0.12, t + 0.02);
        gainNode.gain.setValueAtTime(0.12, t + 0.3);
        gainNode.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
        
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.start(t + i * 0.1);
        osc.stop(t + 1.5);
      });
    } catch(e) {}
  }

  playCorrect() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const t = this.ctx.currentTime;
      const notes = [523, 659, 784, 1047];
      
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.1);
        
        gainNode.gain.setValueAtTime(0, t + i * 0.1);
        gainNode.gain.linearRampToValueAtTime(0.15, t + i * 0.1 + 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.01, t + i * 0.1 + 0.4);
        
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.start(t + i * 0.1);
        osc.stop(t + i * 0.1 + 0.4);
      });
    } catch(e) {}
  }

  playWrong() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.5);
      
      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(0.15, t + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(t + 0.5);
    } catch(e) {}
  }

  playVictory() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const t = this.ctx.currentTime;
      const notes = [523, 659, 784, 1047, 1319, 1568];
      
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.12);
        
        gainNode.gain.setValueAtTime(0, t + i * 0.12);
        gainNode.gain.linearRampToValueAtTime(0.15, t + i * 0.12 + 0.05);
        gainNode.gain.setValueAtTime(0.15, t + i * 0.12 + 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.01, t + i * 0.12 + 0.5);
        
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.start(t + i * 0.12);
        osc.stop(t + i * 0.12 + 0.5);
      });
    } catch(e) {}
  }

  playCountdown() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, this.ctx.currentTime);
      
      gainNode.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch(e) {}
  }

  playReady() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const t = this.ctx.currentTime;
      const notes = [392, 494, 587];
      
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.15);
        
        gainNode.gain.setValueAtTime(0.1, t + i * 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, t + i * 0.15 + 0.3);
        
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.start(t + i * 0.15);
        osc.stop(t + i * 0.15 + 0.3);
      });
    } catch(e) {}
  }

  playGameStart() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const t = this.ctx.currentTime;
      const notes = [523, 659, 784, 1047];
      
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.2);
        
        gainNode.gain.setValueAtTime(0, t + i * 0.2);
        gainNode.gain.linearRampToValueAtTime(0.12, t + i * 0.2 + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, t + i * 0.2 + 0.6);
        
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.start(t + i * 0.2);
        osc.stop(t + i * 0.2 + 0.6);
      });
    } catch(e) {}
  }

  startBgMusic() {
    try {
      this.init();
      if (!this.ctx || this.bgMusicPlaying) return;
      
      this.bgMusicPlaying = true;
      this.bgMusicGain = this.ctx.createGain();
      this.bgMusicGain.gain.value = 0.06;
      this.bgMusicGain.connect(this.ctx.destination);
      
      const baseNotes = [261, 293, 329, 349, 392, 440, 493, 523];
      const seq = [...baseNotes, ...baseNotes.reverse().slice(1, -1)];
      
      const playNote = (noteIdx: number) => {
        if (!this.ctx || !this.bgMusicPlaying || !this.bgMusicGain) return;
        
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = seq[noteIdx % seq.length];
        
        const t = this.ctx.currentTime;
        noteGain.gain.setValueAtTime(0, t);
        noteGain.gain.linearRampToValueAtTime(0.5, t + 0.1);
        noteGain.gain.setValueAtTime(0.5, t + 0.8);
        noteGain.gain.exponentialRampToValueAtTime(0.01, t + 1.2);
        
        osc.connect(noteGain);
        noteGain.connect(this.bgMusicGain!);
        
        osc.start(t);
        osc.stop(t + 1.2);
        
        setTimeout(() => {
          if (this.bgMusicPlaying) {
            playNote((noteIdx + 1) % seq.length);
          }
        }, 1200);
      };
      
      playNote(0);
    } catch(e) {}
  }

  stopBgMusic() {
    this.bgMusicPlaying = false;
    if (this.bgMusicGain) {
      this.bgMusicGain.disconnect();
      this.bgMusicGain = null;
    }
  }

  setBgVolume(volume: number) {
    if (this.bgMusicGain) {
      this.bgMusicGain.gain.value = volume;
    }
  }
}

export const soundService = new SoundService();