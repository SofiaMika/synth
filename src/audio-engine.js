import * as Tone from 'tone';

const ENVELOPE = {
  attack: 0.03,
  decay: 0.1,
  sustain: 0.7,
  release: 0.18,
};

export class AudioEngine {
  constructor() {
    this.voices = {};
    this.startPromise = null;
    this.isReady = false;
  }

  start() {
    if (!this.startPromise) {
      this.startPromise = Tone.start()
        .then(() => {
          this.createGraph();
          this.isReady = true;
        })
        .catch((error) => {
          this.startPromise = null;
          throw error;
        });
    }
    return this.startPromise;
  }

  createGraph() {
    const limiter = new Tone.Limiter(-1).toDestination();
    this.master = new Tone.Gain(0.7).connect(limiter);
    this.echo = new Tone.FeedbackDelay('8n', 0.25).connect(this.master);
    this.filter = new Tone.Filter(6000, 'lowpass').connect(this.echo);

    // Два голоса смешиваются перед общими эффектами.
    for (const name of ['surface', 'deep']) {
      const pan = new Tone.Panner(0).connect(this.filter);
      const volume = new Tone.Gain(0.65).connect(pan);
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: name === 'surface' ? 'sine' : 'triangle' },
        envelope: ENVELOPE,
      }).connect(volume);
      this.voices[name] = { synth, volume, pan };
    }
  }

  playNote(name, note) {
    this.voices[name].synth.triggerAttack(note);
  }

  stopNote(name, note) {
    if (this.isReady) this.voices[name].synth.triggerRelease(note);
  }

  setControl(id, rawValue) {
    if (!this.isReady) return;

    const [name, parameter] = id.split('-');
    const voice = this.voices[name];
    const value = Number(rawValue);

    if (voice) {
      switch (parameter) {
        case 'volume':
          voice.volume.gain.rampTo(value / 100, 0.05);
          break;
        case 'pan':
          voice.pan.pan.rampTo(value / 100, 0.05);
          break;
        case 'detune':
          voice.synth.set({ detune: value });
          break;
        case 'wave':
          voice.synth.set({ oscillator: { type: rawValue } });
          break;
      }
      return;
    }

    switch (id) {
      case 'filter':
        this.filter.frequency.rampTo(value, 0.05);
        break;
      case 'echo':
        this.echo.wet.rampTo(value / 100, 0.05);
        break;
      case 'master-volume':
        this.master.gain.rampTo(value / 100, 0.05);
        break;
    }
  }
}
