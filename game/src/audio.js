// Sound, synthesized live with WebAudio — no audio files. Each effect is a
// few oscillators and a breath of filtered noise shaped by a gain envelope:
// a boot's scuff, a blade's ring, a coin's chime. The context is created
// lazily on the first user gesture (browsers refuse it sooner), M mutes,
// and in screenshot mode nothing here is ever touched.

export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ freq, freqEnd = null, dur = 0.12, type = 'sine', gain = 0.12, delay = 0 }) {
    const ac = ensure();
    if (!ac || muted) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.1, gain = 0.1, delay = 0, freq = 1200 }) {
    const ac = ensure();
    if (!ac || muted) return;
    const t0 = ac.currentTime + delay;
    const length = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ac.createBufferSource();
    source.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const amp = ac.createGain();
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    source.connect(filter).connect(amp).connect(ac.destination);
    source.start(t0);
  }

  return {
    /** Call from any user gesture so the context may start. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    move() {
      tone({ freq: 170, freqEnd: 120, dur: 0.05, type: 'triangle', gain: 0.035 });
    },
    hit() {
      tone({ freq: 150, freqEnd: 65, dur: 0.09, type: 'square', gain: 0.1 });
      noise({ dur: 0.06, gain: 0.08, freq: 2400 });
    },
    kill() {
      noise({ dur: 0.2, gain: 0.12, freq: 900 });
      tone({ freq: 320, freqEnd: 40, dur: 0.22, type: 'sawtooth', gain: 0.07 });
    },
    hurt() {
      tone({ freq: 120, freqEnd: 50, dur: 0.16, type: 'sawtooth', gain: 0.16 });
    },
    pickup() {
      tone({ freq: 660, dur: 0.07, type: 'sine', gain: 0.09 });
      tone({ freq: 990, dur: 0.1, type: 'sine', gain: 0.09, delay: 0.06 });
    },
    potion() {
      tone({ freq: 300, freqEnd: 640, dur: 0.2, type: 'sine', gain: 0.1 });
    },
    descend() {
      tone({ freq: 392, dur: 0.12, type: 'triangle', gain: 0.1 });
      tone({ freq: 311, dur: 0.12, type: 'triangle', gain: 0.1, delay: 0.11 });
      tone({ freq: 233, dur: 0.2, type: 'triangle', gain: 0.1, delay: 0.22 });
    },
    win() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => tone({ freq, dur: 0.16, type: 'triangle', gain: 0.11, delay: i * 0.11 }));
      tone({ freq: 1319, dur: 0.4, type: 'sine', gain: 0.08, delay: 0.46 });
    },
    lose() {
      const notes = [220, 196, 165, 110];
      notes.forEach((freq, i) => tone({ freq, dur: 0.24, type: 'sine', gain: 0.11, delay: i * 0.17 }));
    },
  };
}
