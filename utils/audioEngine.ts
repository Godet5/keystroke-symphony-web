import { SoundProfile, ScaleType } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private dryNode: GainNode | null = null;
  private wetNode: GainNode | null = null;
  
  private isHarmonizerActive: boolean = false;
  private currentScale: ScaleType = 'pentatonic';

  // Current sound profile settings
  private currentProfile: SoundProfile = {
    oscillatorType: 'sine',
    attack: 0.01,
    decay: 0.1,
    sustain: 0.3,
    release: 0.5,
    filterFreq: 2000,
    filterQ: 1,
    distortion: 0,
    reverbMix: 0.3
  };

  // Base frequency calculation for C3
  private readonly rootFreq = 130.81; 

  // Intervals (semitones) for different scales
  private scaleIntervals: Record<ScaleType, number[]> = {
    pentatonic: [0, 2, 4, 7, 9], // Major Pentatonic
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    blues: [0, 3, 5, 6, 7, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  };

  constructor() {
    // Lazy init in start()
  }

  public async start() {
    if (this.ctx) {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        return;
    }
    
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Master Chain
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-10, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.01, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.1, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.4;

    this.dryNode = this.ctx.createGain();
    this.wetNode = this.ctx.createGain();
    
    await this.setupReverb();

    if (this.masterGain && this.dryNode && this.wetNode && this.reverbNode && this.compressor) {
      this.masterGain.connect(this.dryNode);
      this.masterGain.connect(this.wetNode);

      this.dryNode.connect(this.compressor);
      
      this.wetNode.connect(this.reverbNode);
      this.reverbNode.connect(this.compressor);

      this.compressor.connect(this.ctx.destination);
    }
    
    this.updateMix();
  }

  public setProfile(profile: SoundProfile) {
    this.currentProfile = profile;
    this.updateMix();
  }

  public setScale(scale: ScaleType) {
    this.currentScale = scale;
  }

  public setHarmonizer(active: boolean) {
    this.isHarmonizerActive = active;
  }

  public updateParam(key: keyof SoundProfile, value: any) {
      (this.currentProfile as any)[key] = value;
      if (key === 'reverbMix') this.updateMix();
  }

  private updateMix() {
    if (!this.dryNode || !this.wetNode) return;
    const mix = Math.max(0, Math.min(1, this.currentProfile.reverbMix));
    const gainDry = Math.cos(mix * 0.5 * Math.PI);
    const gainWet = Math.sin(mix * 0.5 * Math.PI);
    
    this.dryNode.gain.setTargetAtTime(gainDry, 0, 0.01);
    this.wetNode.gain.setTargetAtTime(gainWet, 0, 0.01);
  }

  private async setupReverb() {
    if (!this.ctx) return;
    const duration = 3.0;
    const decay = 3.0;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = i / length;
        left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
        right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
    }

    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = impulse;
  }

  private createDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 0;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    
    if (amount === 0) return null;

    for (let i = 0; i < n_samples; ++i) {
      const x = i * 2 / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private getFrequency(charIndex: number): number {
      const intervals = this.scaleIntervals[this.currentScale];
      const octaveSpan = intervals.length;
      
      const octave = Math.floor(charIndex / octaveSpan);
      const noteIndex = Math.abs(charIndex) % octaveSpan;
      const semitoneOffset = intervals[noteIndex];
      
      // Calculate frequency: f = f0 * (2^(n/12))
      // Base is C3, we shift by octaves (12 semitones) + scale interval
      const totalSemitones = (octave * 12) + semitoneOffset;
      return this.rootFreq * Math.pow(2, totalSemitones / 12);
  }

  public playKey(char: string) {
    if (!this.ctx || !this.masterGain) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    // Map char to index approx
    const code = char.toLowerCase().charCodeAt(0);
    // Map 'a' (97) to index 0, etc. Center around middle range.
    const index = (code - 97); 
    
    const baseFreq = this.getFrequency(index);
    
    this.triggerOscillator(baseFreq);

    if (this.isHarmonizerActive) {
        // Play a major third (4 semitones) and perfect fifth (7 semitones) above
        // Or strictly stick to scale? For simplicity/sound quality, fixed intervals usually sound "thickest" for chords
        const thirdFreq = baseFreq * Math.pow(2, 4/12);
        const fifthFreq = baseFreq * Math.pow(2, 7/12);
        
        // Slight delay for strum effect
        setTimeout(() => this.triggerOscillator(thirdFreq, 0.4), 20);
        setTimeout(() => this.triggerOscillator(fifthFreq, 0.4), 40);
    }
  }

  private triggerOscillator(freq: number, gainScale: number = 1.0) {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const p = this.currentProfile;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();
    
    osc.type = p.oscillatorType;
    osc.frequency.setValueAtTime(freq, t);
    
    // Detune slightly for thickness
    osc.detune.setValueAtTime((Math.random() - 0.5) * 10, t);
    panner.pan.setValueAtTime((Math.random() * 0.8) - 0.4, t);

    filter.type = 'lowpass';
    filter.Q.value = p.filterQ;
    
    // Filter Env
    if (p.attack < 0.1) {
        filter.frequency.setValueAtTime(100, t);
        filter.frequency.exponentialRampToValueAtTime(Math.min(20000, p.filterFreq * 2), t + p.attack);
        filter.frequency.exponentialRampToValueAtTime(Math.max(50, p.filterFreq), t + p.attack + p.decay);
    } else {
        filter.frequency.setValueAtTime(p.filterFreq / 2, t);
        filter.frequency.linearRampToValueAtTime(p.filterFreq, t + p.attack);
    }

    // Amp Env
    const peakGain = 0.4 * gainScale; 
    const sustainGain = Math.max(0.01, p.sustain * peakGain);
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + p.attack);
    gain.gain.exponentialRampToValueAtTime(sustainGain, t + p.attack + p.decay);
    
    const holdTime = 0.1; 
    const releaseStart = t + p.attack + p.decay + holdTime;
    gain.gain.setValueAtTime(sustainGain, releaseStart);
    gain.gain.exponentialRampToValueAtTime(0.001, releaseStart + p.release);

    // Distortion
    let distortionNode: WaveShaperNode | null = null;
    if (p.distortion > 0) {
        distortionNode = this.ctx.createWaveShaper();
        distortionNode.curve = this.createDistortionCurve(p.distortion * 100);
        distortionNode.oversample = '2x';
    }

    // Connect
    let source: AudioNode = osc;
    if (distortionNode) {
        source.connect(distortionNode);
        source = distortionNode;
    }

    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);

    const totalDuration = p.attack + p.decay + holdTime + p.release;
    osc.start(t);
    osc.stop(t + totalDuration + 1.0); 

    setTimeout(() => {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
        panner.disconnect();
        if (distortionNode) distortionNode.disconnect();
    }, (totalDuration + 1.5) * 1000);
  }

  public playError() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.3);
    
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.35);
    
    setTimeout(() => {
        osc.disconnect();
        gain.disconnect();
    }, 400);
  }
}

export const audioEngine = new AudioEngine();