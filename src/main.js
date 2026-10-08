import { AudioEngine } from './audio-engine.js';

class SynthApp {
  constructor() {
    this.engine = new AudioEngine();
    this.activeNotes = new Map();
    this.controlsSynced = false;
    this.noteButtons = [...document.querySelectorAll('.note')];
    this.rangeInputs = [...document.querySelectorAll('input[type="range"]')];
    this.selects = [...document.querySelectorAll('select')];
    this.status = document.getElementById('status');

    this.bindEvents();
    this.rangeInputs.forEach((input) => this.updateDisplay(input));
  }

  bindEvents() {
    for (const button of this.noteButtons) {
      this.onPointer(button, () => this.toggleNote(button));
    }
    this.onPointer(document.getElementById('stop-all'), () => this.stopAll());
    this.onPointer(document.getElementById('reset-all'), () => this.resetSettings());

    for (const input of this.rangeInputs) {
      input.addEventListener('input', () => {
        this.updateDisplay(input);
        this.applyControl(input);
      });
    }
    for (const select of this.selects) {
      select.addEventListener('change', () => this.applyControl(select));
    }

    window.addEventListener('blur', () => this.stopAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stopAll();
    });
  }

  onPointer(element, action) {
    // Клавиатура не запускает ноты и команды пульта.
    element.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      action();
    });
  }

  async toggleNote(button) {
    const { synth, note } = button.dataset;
    const key = `${synth}:${note}`;

    if (this.activeNotes.has(key)) {
      this.activeNotes.delete(key);
      this.engine.stopNote(synth, note);
      this.setButtonState(button, false);
      return;
    }

    const entry = { button };
    this.activeNotes.set(key, entry);
    this.setButtonState(button, true);

    try {
      await this.engine.start();
      if (!this.controlsSynced) {
        this.syncControls();
        this.controlsSynced = true;
      }
      // Ноту могли выключить, пока браузер запускал аудио.
      if (this.activeNotes.get(key) === entry) this.engine.playNote(synth, note);
    } catch (error) {
      console.error('Не удалось запустить звук:', error);
      if (this.activeNotes.get(key) === entry) {
        this.activeNotes.delete(key);
        this.setButtonState(button, false);
        this.status.textContent = 'Не удалось включить звук';
      }
    }
  }

  stopAll() {
    for (const { button } of this.activeNotes.values()) {
      this.engine.stopNote(button.dataset.synth, button.dataset.note);
      button.classList.remove('active');
      button.setAttribute('aria-pressed', 'false');
    }
    this.activeNotes.clear();
    this.updateStatus();
  }

  resetSettings() {
    this.stopAll();

    for (const input of this.rangeInputs) {
      input.value = input.defaultValue;
      this.updateDisplay(input);
      this.applyControl(input);
    }
    for (const select of this.selects) {
      const defaultOption = [...select.options].find((option) => option.defaultSelected);
      select.value = (defaultOption || select.options[0]).value;
      this.applyControl(select);
    }
  }

  setButtonState(button, isActive) {
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
    this.updateStatus();
  }

  updateStatus() {
    const count = this.activeNotes.size;
    if (count === 0) this.status.textContent = 'Готов к игре';
    else if (count === 1) this.status.textContent = '1 нота включена';
    else if (count < 5) this.status.textContent = `${count} ноты включены`;
    else this.status.textContent = `${count} нот включено`;
  }

  syncControls() {
    for (const control of [...this.rangeInputs, ...this.selects]) {
      this.applyControl(control);
    }
  }

  applyControl(control) {
    this.engine.setControl(control.id, control.value);
  }

  updateDisplay(input) {
    const value = Number(input.value);
    const output = document.querySelector(`[data-value="${input.id}"]`);

    if (output) {
      if (input.id.endsWith('-pan')) {
        output.textContent = value === 0 ? 'центр'
          : value < 0 ? `лево ${-value}` : `право ${value}`;
      } else if (input.id.endsWith('-detune')) {
        output.textContent = `${value} ct`;
      } else if (input.id === 'filter') {
        output.textContent = `${value} Hz`;
      } else {
        output.textContent = `${value}%`;
      }
    }

    const knob = input.closest('.knob-wrap');
    if (knob) {
      const min = Number(input.min);
      const max = Number(input.max);
      const angle = -135 + ((value - min) / (max - min)) * 270;
      knob.style.setProperty('--angle', `${angle}deg`);
    }
  }
}

new SynthApp();
