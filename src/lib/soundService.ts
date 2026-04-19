class SoundService {
  private ctx: AudioContext | null = null;
  
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
      
      // Som de click "lúdico" (tipo um "pop" de bolha bem rápido)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.05);
      
      gainNode.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch(e) {}
  }

  playTick() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      // Som de tick (curto e percussivo)
      osc.type = 'square';
      osc.frequency.setValueAtTime(1000, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.02);
      
      gainNode.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.02);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.02);
    } catch(e) {}
  }

  playBell() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const t = this.ctx.currentTime;
      // TRIMMMM - Multiple oscillators simulating an old alarm clock bell
      const freqs = [800, 840, 1200];
      
      freqs.forEach(freq => {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);
        
        // Tremolo effect rapidly modulating volume
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(40, t); // fast amplitude modulation
        
        const amGain = this.ctx.createGain();
        lfo.connect(amGain.gain);
        amGain.gain.value = 0.5; // Envelope the tremolo
        
        // Master gain for ring
        gainNode.gain.setValueAtTime(0.2, t);
        gainNode.gain.exponentialRampToValueAtTime(0.01, t + 1.2);
        
        osc.connect(amGain);
        amGain.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.start(t);
        lfo.start(t);
        osc.stop(t + 1.2);
        lfo.stop(t + 1.2);
      });
      
    } catch(e) {}
  }

  playCorrect() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      // Som "completinho" de sucesso: Acorde subindo estilo Mário (C5 -> E5 -> G5)
      osc.type = 'sine';
      
      // Nota 1
      osc.frequency.setValueAtTime(523.25, t); 
      // Nota 2
      osc.frequency.setValueAtTime(659.25, t + 0.1); 
      // Nota 3 (Final brilhante)
      osc.frequency.setValueAtTime(783.99, t + 0.2); 
      
      // Volume: Sobe suave e desce alongado
      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gainNode.gain.setValueAtTime(0.3, t + 0.3);
      gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(t + 0.6);
    } catch(e) {}
  }

  playWrong() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      // Som "completinho" de erro: Descendente, tipo trombone triste ("bumm-bum")
      osc.type = 'triangle';
      
      // Pitch caindo
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.5);
      
      // Dois "toques" no envelope de volume
      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.05, t + 0.25);
      gainNode.gain.linearRampToValueAtTime(0.3, t + 0.3);
      gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(t + 0.6);
    } catch(e) {}
  }

  playVictory() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const t = this.ctx.currentTime;
      // Fanfarra de vitória estilo jogo - notas alegres sublindo
      const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
      
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t + i * 0.15);
        
        gainNode.gain.setValueAtTime(0, t + i * 0.15);
        gainNode.gain.linearRampToValueAtTime(0.2, t + i * 0.15 + 0.05);
        gainNode.gain.setValueAtTime(0.2, t + i * 0.15 + 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, t + i * 0.15 + 0.3);
        
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.start(t + i * 0.15);
        osc.stop(t + i * 0.15 + 0.3);
      });
    } catch(e) {}
  }

  playCountdown() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(1100, t + 0.05);
      
      gainNode.gain.setValueAtTime(0.15, t);
      gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(t + 0.2);
    } catch(e) {}
  }
}

export const soundService = new SoundService();
