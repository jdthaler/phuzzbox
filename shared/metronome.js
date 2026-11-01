// metronome.js — the metronome every page has under the pedal, beside the tuner (its card is
// shared/metronome-card.js; its README metronome/README.md). No DOM: the tests use it in Node.
//
// The sound is two struck bars, as a clockwork metronome's escapement and bell: each beat a maple
// block, the first of each bar a steel bar, both free at both ends. A bar's bending modes are the
// roots of cos(βL) cosh(βL) = 1 (Euler–Bernoulli), at
//   fₙ = (βₙL)² / (2π L²) · √(E I / ρ A),   I / A = t² / 12 for a rectangular section,
// each decaying with the material's loss factor η (τₙ = 1 / (π fₙ η)), struck at its end, where
// every mode moves alike, by a beater in contact for a while: a half-sine of force, whose spectrum
// leaves out the modes above about 1.5 / contact.
//
// The beat comes from a pendulum: a bob below the pivot and a weight you slide above it, so the
// tempo printed on the rod is where the weight sits. Small swings of a compound pendulum take
//   T = 2π √((M r_M² + m r_m²) / (g (M r_M − m r_m))),
// two beats a period (one each way).

export const WOOD = { name: 'maple', E: 12.6e9, rho: 705, eta: 0.02 };
export const STEEL = { name: 'steel', E: 200e9, rho: 7850, eta: 3e-4 };
// the bars: the tick a maple block, the bell a steel bar (lengths and thicknesses in metres)
export const TICK = { material: WOOD, L: 0.15, t: 0.008, contact: 0.2e-3 };
export const BELL = { material: STEEL, L: 0.08, t: 0.004, contact: 0.1e-3 };
// the pendulum: the bob (M at r_M below the pivot) and the sliding weight (m, r_m above it)
export const PENDULUM = { M: 0.06, rM: 0.045, m: 0.03, g: 9.81 };
export const TEMPO = { min: 30, max: 250, def: 100 };

// βₙL for the first n free-free modes, by Newton's method on cos x cosh x − 1 from (n + ½)π
export function beamRoots(n = 4) {
  const out = [];
  for (let k = 1; k <= n; k++) {
    let x = (k + 0.5) * Math.PI;
    for (let i = 0; i < 50; i++) {
      const f = Math.cos(x) * Math.cosh(x) - 1, d = -Math.sin(x) * Math.cosh(x) + Math.cos(x) * Math.sinh(x);
      const dx = f / d;
      x -= dx;
      if (Math.abs(dx) < 1e-13 * x) break;
    }
    out.push(x);
  }
  return out;
}
const ROOTS = beamRoots(4);

// a bar's modes: [{ f, tau, amp }], amp the contact's spectrum at f relative to its value at 0
export function modes(bar, n = 4) {
  const { E, rho, eta } = bar.material, c = Math.sqrt(E / rho), r = bar.t / Math.sqrt(12);
  return ROOTS.slice(0, n).map((bl) => {
    const f = ((bl * bl) / (2 * Math.PI * bar.L * bar.L)) * r * c;
    return { f, tau: 1 / (Math.PI * f * eta), amp: contactSpectrum(f, bar.contact) };
  });
}
// |F(f)| / F(0) for a half-sine of force lasting T: cos(πfT) / (1 − (2fT)²)
export function contactSpectrum(f, T) {
  const u = 2 * f * T;
  return Math.abs(u - 1) < 1e-9 ? Math.PI / 4 : Math.abs(Math.cos(Math.PI * f * T) / (1 - u * u));
}

// the bar's sound, struck once: the modes' velocities at the struck end, normalised to a peak of 1,
// lasting until the slowest mode is 60 dB down (at most 1.5 s)
export function strike(bar, fs) {
  const M = modes(bar).filter((m) => m.f < 0.45 * fs);
  const seconds = Math.min(1.5, Math.max(...M.map((m) => m.tau)) * Math.log(1000));
  const n = Math.max(1, Math.round(seconds * fs)), x = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / fs;
    let y = 0;
    for (const m of M) y += m.amp * Math.sin(2 * Math.PI * m.f * t) * Math.exp(-t / m.tau);
    x[i] = y;
    peak = Math.max(peak, Math.abs(y));
  }
  for (let i = 0; i < n; i++) x[i] /= peak || 1;
  return x;
}

// ---- the pendulum ---------------------------------------------------------------------------------
export function period(rm, P = PENDULUM) {
  const I = P.M * P.rM * P.rM + P.m * rm * rm, k = P.g * (P.M * P.rM - P.m * rm);
  return k > 0 ? 2 * Math.PI * Math.sqrt(I / k) : Infinity;
}
// where the weight sits for a tempo (beats a minute): the root of m r² + K m r + M r_M (r_M − K) = 0,
// K = g (T / 2π)², T two beats
export function weightAt(bpm, P = PENDULUM) {
  const T = 120 / bpm, K = P.g * (T / (2 * Math.PI)) ** 2;
  const a = P.m, b = K * P.m, c = P.M * P.rM * (P.rM - K);
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

// ---- the beats ------------------------------------------------------------------------------------
// The beats from `from` (inclusive) to `to` (exclusive) of a metronome whose beat k0 fell at t0,
// at most `limit` of them, as { t, k, beat }: k counts the beats, beat is where k falls in the bar
// (0 the first, which rings the bell; 1 for every beat with no bar)
export function beatsBetween(t0, bpm, perBar, from, to, k0 = 0, limit = Infinity) {
  const dt = 60 / bpm, out = [];
  for (let j = Math.max(0, Math.ceil((from - t0) / dt - 1e-9)); t0 + j * dt < to && out.length < limit; j++) {
    const k = k0 + j;
    out.push({ t: t0 + j * dt, k, beat: perBar > 0 ? k % perBar : 1 });
  }
  return out;
}
// the tempo from taps (times in seconds): the median of the last few intervals, if they agree
export function tapTempo(taps) {
  const d = taps.slice(-6).map((t, i, a) => (i ? t - a[i - 1] : 0)).slice(1).filter((x) => x > 0.2 && x < 2.5);
  if (d.length < 2) return null;
  d.sort((a, b) => a - b);
  const mid = d[d.length >> 1];
  return Math.min(TEMPO.max, Math.max(TEMPO.min, Math.round(60 / mid)));
}
// the pendulum's angle at time t, as a fraction of its swing (−1 … 1): at an end on each beat
export const swing = (t, t0, bpm) => Math.cos((Math.PI * (t - t0) * bpm) / 60);
