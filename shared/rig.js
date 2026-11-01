// rig.js — the rig: what stands between your interface's input and the pedal on the page, on every
// page alike (shared/rig-panel.js is its panel at the foot of the page). Five small units, in this
// order, each with its own switch, as a player's board starts:
//
//   Gain        an ideal amplifier, in decibels: the interface's gain after the converter
//   Hum filter  notches at the mains frequency and its harmonics (second-order band-rejects)
//   Gate        a detector (an RC on a rectifier) opening and closing a gain
//   EQ          bass and treble shelves and a sweepable mid (second-order sections)
//   Compressor  a peak detector and a gain computer, as a VCA compressor has them
//
// It works in volts, as the pedals do, and only on the interface's input: the test bass and the
// test guitar are clean, so they skip it. No DOM: the AudioWorklet (shared/worklet.js) and the
// tests (test/rig-tests.mjs) use it. The README is rig/README.md.
//
//   const rig = new Rig(sampleRate); rig.set(R); rig.process(v, n)   // in place, volts
//   R = { gainOn, gain, humOn, mains, harmonics, humWidth, … }: RIG_PARAMS' ids, rigDefaults()

export const RIG_UNITS = [
  { id: 'gain', name: 'Gain', on: 'gainOn', params: [
    { id: 'gainOn', label: 'Gain', type: 'checkbox', def: true },
    { id: 'gain', label: 'Gain', min: -12, max: 24, def: 0, unit: 'dB', decimals: 1,
      hint: 'Turns your bass up or down before everything else, as more gain on the interface would: match a quiet bass to a hot one, or drive the pedals harder. 6 dB is twice the volts.' },
  ] },
  { id: 'hum', name: 'Hum filter', on: 'humOn', params: [
    { id: 'humOn', label: 'Hum filter', type: 'checkbox', def: false },
    { id: 'mains', label: 'Mains', type: 'select', options: [['60', '60 Hz'], ['50', '50 Hz']], def: '60',
      hint: 'The frequency of the mains where you are: 60 Hz in North America, 50 Hz in Europe and most of the rest of the world. Hum is this and its harmonics.' },
    { id: 'harmonics', label: 'Harmonics', min: 1, max: 12, def: 6, step: 1, unit: '', decimals: 0,
      hint: 'How many of the mains\' harmonics it notches out: a ground loop hums at the first few, a single coil\'s buzz reaches up through many.' },
    { id: 'humWidth', label: 'Width', min: 0.5, max: 10, def: 2, log: true, unit: 'Hz', decimals: 1,
      hint: 'Each notch\'s width between its −3 dB points: narrow leaves the notes beside it alone, wide catches a hum that wanders.' },
  ] },
  { id: 'gate', name: 'Gate', on: 'gateOn', params: [
    { id: 'gateOn', label: 'Gate', type: 'checkbox', def: false },
    { id: 'gateThreshold', label: 'Threshold', min: 0.5e-3, max: 0.3, def: 10e-3, log: true, unit: 'mV', scale: 1000, decimals: 1,
      hint: 'Above this peak voltage the gate opens; once the input falls below half of it, the gate closes and silences the hiss and buzz between notes. Set it just above what you hear with the strings muted.' },
    { id: 'gateRelease', label: 'Release', min: 0.01, max: 1, def: 0.1, log: true, unit: 'ms', scale: 1000, decimals: 0,
      hint: 'How quickly the gate closes once a note has died away (a time constant: the level falls to a third in this long). Longer lets a note\'s tail ring out, shorter cuts the hiss sooner.' },
  ] },
  { id: 'eq', name: 'EQ', on: 'eqOn', params: [
    { id: 'eqOn', label: 'EQ', type: 'checkbox', def: false },
    { id: 'bass', label: 'Bass', min: -15, max: 15, def: 0, unit: 'dB', decimals: 1,
      hint: 'A shelf below 80 Hz: up for more weight under the notes, down to tighten a boomy room. Its full boost or cut reaches the lowest notes.' },
    { id: 'mid', label: 'Mid', min: -15, max: 15, def: 0, unit: 'dB', decimals: 1,
      hint: 'A bell around Mid frequency: up pushes the bass forward in a mix, down scoops it.' },
    { id: 'midFreq', label: 'Mid frequency', min: 100, max: 3000, def: 500, log: true, unit: 'Hz', decimals: 0,
      hint: 'Where the Mid bell is centred: 200–300 Hz is the body of the notes, 700 Hz–1 kHz their growl, 2–3 kHz the click of the strings.' },
    { id: 'treble', label: 'Treble', min: -15, max: 15, def: 0, unit: 'dB', decimals: 1,
      hint: 'A shelf above 4 kHz: up for more string and finger, down to darken it and lose the hiss.' },
  ] },
  { id: 'comp', name: 'Compressor', on: 'compOn', params: [
    { id: 'compOn', label: 'Compressor', type: 'checkbox', def: false },
    { id: 'compThreshold', label: 'Threshold', min: 5e-3, max: 1, def: 0.1, log: true, unit: 'mV', scale: 1000, decimals: 0,
      hint: 'Above this peak voltage the compressor turns the signal down. A passive bass peaks around 0.1–1 V: lower it to squeeze more of every note.' },
    { id: 'ratio', label: 'Ratio', min: 1, max: 20, def: 4, log: true, unit: ': 1', decimals: 1,
      hint: 'How hard it turns down what is over Threshold: at 4 : 1 a note 12 dB over comes out 3 dB over; at 1 : 1 it does nothing.' },
    { id: 'attack', label: 'Attack', min: 1e-4, max: 0.1, def: 0.005, log: true, unit: 'ms', scale: 1000, decimals: 1,
      hint: 'How fast it clamps down on a new note (a time constant): short catches the pluck\'s peak, long lets the pluck through before it squeezes.' },
    { id: 'release', label: 'Release', min: 0.01, max: 2, def: 0.15, log: true, unit: 'ms', scale: 1000, decimals: 0,
      hint: 'How fast it lets go once a note falls (a time constant): long holds the level steady, short lets it pump.' },
    { id: 'makeup', label: 'Makeup', min: 0, max: 24, def: 0, unit: 'dB', decimals: 1,
      hint: 'Turns everything up by this much after compressing, to give back the level it took.' },
  ] },
];
export const RIG_PARAMS = RIG_UNITS.flatMap((u) => u.params);
export const RIG_KEY = 'phuzzbox.rig';
export const rigDefaults = () => Object.fromEntries(RIG_PARAMS.map((p) => [p.id, p.def]));

// every rig value, the given one where it is valid, else the default
export function rigValues(R = {}) {
  const out = rigDefaults();
  for (const p of RIG_PARAMS) {
    const v = R?.[p.id];
    if (p.type === 'checkbox') { if (typeof v === 'boolean') out[p.id] = v; }
    else if (p.type === 'select') { if (p.options.some(([k]) => k === v)) out[p.id] = v; }
    else if (typeof v === 'number' && Number.isFinite(v)) out[p.id] = Math.min(p.max, Math.max(p.min, v));
  }
  return out;
}

// the EQ's fixed corners and the sections' Q (a Butterworth shelf; the mid an octave and a half wide)
export const EQ = { bassHz: 80, trebleHz: 4000, shelfQ: Math.SQRT1_2, midQ: 0.9 };
export const GATE = { attack: 1e-4, detect: 0.05, open: 1e-3, hysteresis: 0.5 };

// ---- second-order sections ----------------------------------------------------------------------
// The analog originals, s normalised to the section's ω0, and their bilinear transforms prewarped
// at ω0 (Bristow-Johnson's cookbook): A = 10^(dB/40), so the full boost or cut is A² = 10^(dB/20).
export const ANALOG = {
  peak: (s, A, Q) => s.mul(s).add(s.scale(A / Q)).add(1).div(s.mul(s).add(s.scale(1 / (A * Q))).add(1)),
  lowShelf: (s, A, Q) => s.mul(s).add(s.scale(Math.sqrt(A) / Q)).add(A).scale(A).div(s.mul(s).scale(A).add(s.scale(Math.sqrt(A) / Q)).add(1)),
  highShelf: (s, A, Q) => s.mul(s).scale(A).add(s.scale(Math.sqrt(A) / Q)).add(1).scale(A).div(s.mul(s).add(s.scale(Math.sqrt(A) / Q)).add(A)),
  notch: (s, A, Q) => s.mul(s).add(1).div(s.mul(s).add(s.scale(1 / Q)).add(1)),
};

// the coefficients [b0, b1, b2, a1, a2] (a0 divided out) of a section at f0 hertz
export function section(kind, f0, fs, dB = 0, Q = Math.SQRT1_2) {
  const A = 10 ** (dB / 40), w = (2 * Math.PI * Math.min(f0, 0.49 * fs)) / fs, c = Math.cos(w), al = Math.sin(w) / (2 * Q), r = 2 * Math.sqrt(A) * al;
  let b0, b1, b2, a0, a1, a2;
  if (kind === 'peak') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
  else if (kind === 'lowShelf') {
    b0 = A * ((A + 1) - (A - 1) * c + r); b1 = 2 * A * ((A - 1) - (A + 1) * c); b2 = A * ((A + 1) - (A - 1) * c - r);
    a0 = (A + 1) + (A - 1) * c + r; a1 = -2 * ((A - 1) + (A + 1) * c); a2 = (A + 1) + (A - 1) * c - r;
  } else if (kind === 'highShelf') {
    b0 = A * ((A + 1) + (A - 1) * c + r); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - r);
    a0 = (A + 1) - (A - 1) * c + r; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - r;
  } else if (kind === 'notch') { b0 = 1; b1 = -2 * c; b2 = 1; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else throw new Error(`no section ${kind}`);
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

// a chain of sections, transposed direct form II, in doubles; nothing allocated in step()
class Sections {
  constructor(max) { this.c = new Float64Array(5 * max); this.z = new Float64Array(2 * max); this.n = 0; }
  load(list) {
    this.n = list.length;
    list.forEach((k, i) => this.c.set(k, 5 * i));
  }
  reset() { this.z.fill(0); }
  step(x) {
    const c = this.c, z = this.z;
    for (let i = 0; i < this.n; i++) {
      const o = 5 * i, q = 2 * i, y = c[o] * x + z[q];
      z[q] = c[o + 1] * x - c[o + 3] * y + z[q + 1];
      z[q + 1] = c[o + 2] * x - c[o + 4] * y;
      x = y;
    }
    return x;
  }
}

const MAX_HARMONICS = 12;
const db = (x) => 10 ** (x / 20);
const coef = (tau, fs) => (tau > 0 ? Math.exp(-1 / (tau * fs)) : 0);

export class Rig {
  constructor(fs) {
    this.fs = fs;
    this.hum = new Sections(MAX_HARMONICS);
    this.eq = new Sections(3);
    this.R = rigValues();
    this.reset();
    this.set(this.R);
  }
  reset() {
    this.hum.reset(); this.eq.reset();
    this.gateEnv = 0; this.gateOpen = false; this.gateGain = 0;
    this.compEnv = 0; this.reduction = 0;
  }
  set(values) {
    const R = (this.R = rigValues(values)), fs = this.fs;
    this.gainK = db(R.gain);
    const fm = +R.mains, notches = [];
    for (let k = 1; k <= Math.round(R.harmonics) && k * fm < 0.45 * fs; k++) notches.push(section('notch', k * fm, fs, 0, (k * fm) / R.humWidth));
    this.hum.load(notches);
    this.eq.load([section('lowShelf', EQ.bassHz, fs, R.bass, EQ.shelfQ), section('peak', R.midFreq, fs, R.mid, EQ.midQ), section('highShelf', EQ.trebleHz, fs, R.treble, EQ.shelfQ)]);
    this.gate = { attack: coef(GATE.attack, fs), detect: coef(GATE.detect, fs), open: coef(GATE.open, fs), close: coef(R.gateRelease, fs), thr: R.gateThreshold };
    this.comp = { attack: coef(R.attack, fs), release: coef(R.release, fs), thrDb: 20 * Math.log10(R.compThreshold), slope: 1 - 1 / R.ratio, makeup: db(R.makeup) };
  }
  // whether any unit changes the signal
  get active() { const R = this.R; return (R.gainOn && R.gain !== 0) || R.humOn || R.gateOn || R.eqOn || R.compOn; }
  process(v, n) {
    const R = this.R;
    if (!this.active) return;
    const G = this.gate, C = this.comp, g = R.gainOn ? this.gainK : 1;
    for (let i = 0; i < n; i++) {
      let x = v[i] * g;
      if (R.humOn) x = this.hum.step(x);
      if (R.gateOn) {
        // the detector: a rectifier charging an RC fast and letting it go over 50 ms; the gate opens
        // above the threshold and closes below half of it, and its gain follows in 1 ms or Release
        const a = Math.abs(x);
        this.gateEnv = a > this.gateEnv ? a + G.attack * (this.gateEnv - a) : G.detect * this.gateEnv;
        if (this.gateEnv > G.thr) this.gateOpen = true; else if (this.gateEnv < GATE.hysteresis * G.thr) this.gateOpen = false;
        const to = this.gateOpen ? 1 : 0, k = this.gateOpen ? G.open : G.close;
        this.gateGain = to + k * (this.gateGain - to);
        x *= this.gateGain;
      }
      if (R.eqOn) x = this.eq.step(x);
      if (R.compOn) {
        // a peak detector, charging in Attack and discharging in Release, and the gain computer:
        // over the threshold, the level comes down by (1 − 1/ratio) of the excess, in decibels
        const a = Math.abs(x);
        this.compEnv = a > this.compEnv ? a + C.attack * (this.compEnv - a) : a + C.release * (this.compEnv - a);
        const over = this.compEnv > 1e-9 ? 20 * Math.log10(this.compEnv) - C.thrDb : -1;
        this.reduction = over > 0 ? over * C.slope : 0;
        x *= C.makeup * db(-this.reduction);
      }
      v[i] = x;
    }
    if (!Number.isFinite(this.compEnv) || !Number.isFinite(this.gateEnv) || !Number.isFinite(v[n - 1])) { this.reset(); v.fill(0, 0, n); }
  }
}

// ---- a tiny complex type, for the analog originals (the tests evaluate them at s = jΩ) ------------
export class Cx {
  constructor(re, im = 0) { this.re = re; this.im = im; }
  static of(z) { return z instanceof Cx ? z : new Cx(z, 0); }
  add(z) { z = Cx.of(z); return new Cx(this.re + z.re, this.im + z.im); }
  mul(z) { z = Cx.of(z); return new Cx(this.re * z.re - this.im * z.im, this.re * z.im + this.im * z.re); }
  scale(k) { return new Cx(this.re * k, this.im * k); }
  div(z) { z = Cx.of(z); const d = z.re * z.re + z.im * z.im; return new Cx((this.re * z.re + this.im * z.im) / d, (this.im * z.re - this.re * z.im) / d); }
  abs() { return Math.hypot(this.re, this.im); }
}
// a section's response at f hertz, from its coefficients
export function response(k, f, fs) {
  const w = (2 * Math.PI * f) / fs, z1 = new Cx(Math.cos(w), -Math.sin(w)), z2 = z1.mul(z1);
  return new Cx(k[0]).add(z1.scale(k[1])).add(z2.scale(k[2])).div(new Cx(1).add(z1.scale(k[3])).add(z2.scale(k[4])));
}
