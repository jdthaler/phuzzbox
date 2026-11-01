// slide-tests.mjs — sliding between notes on the test bass and guitar (testbass/README.md,
// ## Sliding), against what is written here: the stopped length ℓ = ℓ_s 2^(−fret/12), so a fretted
// slide passes through the equal-tempered pitch of every fret on the way and a fretless one through
// every pitch between; the adiabatic invariant, which keeps each mode's displacement through a slow
// change of length, so a note slid to the 12th fret is the open string's pluck heard at the 12th;
// and the finger: lifting it mutes the note it moved, a slide moves only the note still ringing.

import { check, done } from './harness.mjs';
import { loadBass } from '../tools/engine.mjs';
import { amplitudeAt } from '../tools/audio-util.mjs';

const TB = await loadBass();
const fs = 48000;
const cents = (a, b) => 1200 * Math.log2(a / b);
const et = (key) => 440 * 2 ** ((key - 69) / 12);
const render = (b, seconds) => { const x = new Float32Array(Math.round(seconds * fs)); b.process(x); return x; };

// the frequency near f0 where a block's spectrum peaks (Hann window, golden-section search)
function peakNear(x, f0) {
  let a = f0 * 2 ** (-1.5 / 12), c = f0 * 2 ** (1.5 / 12);
  const g = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 60; i++) {
    const p = c - g * (c - a), q = a + g * (c - a);
    if (amplitudeAt(x, p, fs) > amplitudeAt(x, q, fs)) c = q; else a = p;
  }
  return (a + c) / 2;
}

// The finger moves at a steady speed along the neck: its distance from the nut, ℓ_s (1 − 2^(−fret/12)),
// is linear in time. When does it reach `fret`, sliding from `from` to `to` over T seconds?
const dist = (fret) => 1 - 2 ** (-fret / 12);
const reach = (from, to, T, fret) => (T * (dist(fret) - dist(from))) / (dist(to) - dist(from));

// 1. a slow slide on the bass's G string from the open string to the 2nd fret over 4 s: fretted,
// the pitch the pickup hears is the open G, then G♯, then A, each equal-tempered to a tenth of a
// cent; fretless, it passes through every pitch between, where the finger is at that moment
for (const fretless of [false, true]) {
  const b = new TB(fs); b.set('fretless', fretless ? 1 : 0);
  b.pluck(3, 0, 0.8);
  const lead = 0.3, T = 4;
  render(b, lead);
  b.slide(3, 2, T);
  const x = render(b, T + 0.6);
  const rows = []; let worst = 0;
  for (const at of [0.25, 0.75, 1.25, 1.75, 2]) {
    const t = at === 2 ? T + 0.3 : reach(0, 2, T, at), i = Math.round(t * fs);
    const w = x.subarray(i - 0.1 * fs, i + 0.1 * fs);
    const want = et(43 + (fretless ? at : Math.round(at))), got = peakNear(w, want);
    worst = Math.max(worst, Math.abs(cents(got, want)));
    rows.push(`${at}: ${(100 * (12 * Math.log2(got / et(43)))).toFixed(0)} ¢`);
  }
  check(worst < (fretless ? 2 : 0.1), fretless
    ? 'fretless, a slide from G to A passes through every pitch between, where the finger is'
    : 'fretted, a slide from G to A steps through G♯, each fret equal-tempered', `finger at fret ${rows.join(', ')}; worst ${worst.toFixed(2)} ¢ off`);
}

// 2. the adiabatic invariant: a string's length changing slowly against its period keeps each mode's
// action E/ω. A mode's energy is ½ (μℓ/2) ω² A², so the action goes as ℓ f A² and the displacement
// as 1/√(ℓ f): on a flexible string ℓf is constant and A is kept; a stiff string's partials stretch
// more as it shortens (B ∝ 1/ℓ²), so its upper modes lose a little. The open A plucked and slid to
// the 12th in 50 ms, against the 12th plucked at the same moment: their partials differ by the
// ratio of the two plucks' modal amplitudes times √(ℓ₀ fₙ(ℓ₀) / ℓ₁₂ fₙ(ℓ₁₂)),
//   aₙ(ℓ) = 2ℓ² / (n²π² xₚ (ℓ − xₚ)) sin(nπxₚ/ℓ) sinc(nπw/2ℓ),
// both heard by the same pickup at the same frequencies (fretless or fretted, the same at the end),
// and the slid one having lost less on the way, at the lower frequencies' σ = b₁ + b₃ f²
for (const fretless of [false, true]) {
  const a = new TB(fs), r = new TB(fs);
  a.set('fretless', fretless ? 1 : 0);
  a.pluck(1, 0, 0.8); a.slide(1, 12, 0.05);
  r.pluck(1, 12, 0.8);
  const xa = render(a, 0.6).subarray(0.3 * fs), xr = render(r, 0.6).subarray(0.3 * fs);
  const scale = a.get('scale'), xp = a.get('pluckAt'), w = a.get('width');
  const modal = (len, n) => { const k = (n * Math.PI) / len, s = (k * w) / 2; return (2 * len * len) / (n * n * Math.PI ** 2 * xp * (len - xp)) * Math.sin(k * xp) * (Math.sin(s) / s); };
  const ps = r.partials(1, 12), rows = []; let worst = 0;
  const b3 = (ps[1].sigma - ps[0].sigma) / (ps[1].f ** 2 - ps[0].f ** 2);
  for (const n of [1, 2, 3, 5]) {
    // ∫ (σ at the 12th − σ where the finger is) dt over the slide, the finger as in 1
    const f0 = r.partials(1, 0)[n - 1].f; let saved = 0;
    for (let t = 0.5e-4; t < 0.05; t += 1e-4) {
      const at = -12 * Math.log2(1 - (t / 0.05) * dist(12)), f = f0 * 2 ** ((fretless ? at : Math.round(at)) / 12);
      saved += b3 * (ps[n - 1].f ** 2 - f * f) * 1e-4;
    }
    const want = Math.abs(modal(scale, n) / modal(scale / 2, n)) * Math.exp(saved) * Math.sqrt((scale * f0) / ((scale / 2) * ps[n - 1].f));
    const got = amplitudeAt(xa, ps[n - 1].f, fs) / amplitudeAt(xr, ps[n - 1].f, fs);
    worst = Math.max(worst, Math.abs(got / want - 1));
    rows.push(`${n}: ${got.toFixed(3)} for ${want.toFixed(3)}`);
  }
  check(worst < 0.005, `${fretless ? 'fretless' : 'fretted'}, a note slid an octave keeps each mode's action, E/ω (the adiabatic invariant)`, `partial ${rows.join(', ')}`);
}

// 3. a slide of no distance changes nothing, sample for sample
{
  const a = new TB(fs), r = new TB(fs);
  a.pluck(0, 3, 0.8); r.pluck(0, 3, 0.8);
  a.slide(0, 3, 0.2);
  const xa = render(a, 0.5), xr = render(r, 0.5);
  check(xa.every((v, i) => v === xr[i]), 'a slide to the fret already held changes nothing, sample for sample');
}

// 4. the finger: a slide moves only a note still ringing on that string, and the slid note is the
// one its key lifts
{
  const quiet = new TB(fs); quiet.slide(2, 5, 0.1);
  const silent = render(quiet, 0.2).every((v) => v === 0);
  const muted = new TB(fs), still = new TB(fs);
  muted.pluck(2, 0, 0.8); still.pluck(2, 0, 0.8); render(muted, 0.1); render(still, 0.1);
  muted.mute(2); still.mute(2); muted.slide(2, 7, 0.05);
  const xm = render(muted, 0.3), xs = render(still, 0.3);
  check(silent && xm.every((v, i) => v === xs[i]), 'a slide on a string with nothing ringing, or whose note was lifted, does nothing');

  const b = new TB(fs), c = new TB(fs);
  b.note(33, 0.8); c.note(33, 0.8); // the open A
  b.slide(1, 5, 0.05); c.slide(1, 5, 0.05);
  render(b, 0.2); render(c, 0.2);
  b.noteOff(38); c.noteOff(33); // D, where it was slid, and A, where it began
  const lifted = render(b, 0.5).subarray(0.4 * fs), kept = render(c, 0.5).subarray(0.4 * fs);
  const lv = Math.max(...lifted.map(Math.abs)), kv = Math.max(...kept.map(Math.abs));
  check(lv < 1e-3 * kv, 'lifting the key a note was slid to mutes it; its first key no longer does', lv ? `${(20 * Math.log10(lv / kv)).toFixed(0)} dB` : 'silent');
}

// 5. hard slides stay finite and die away: the guitar's high E slid from the nut to the 24th fret
// and back at a low rate (its top modes cross the Nyquist frequency and fall silent rather than
// alias), then lifted
{
  let finite = true, top = 0;
  for (const rate of [22050, 48000]) {
    const b = new TB(rate, 'guitar'); b.set('fretless', 1);
    b.pluck(5, 0, 1); b.slide(5, 24, 0.1);
    const run = (s) => { const x = new Float32Array(Math.round(s * rate)); b.process(x); finite = finite && x.every(Number.isFinite); return x; };
    run(0.3); b.slide(5, 0, 0.1); run(0.3); b.mute(5);
    top = Math.max(top, ...run(1.5).subarray(Math.round(1.4 * rate)).map(Math.abs));
  }
  check(finite && top < 1e-5, 'the high E slid to the 24th fret and back, at 22.05 and 48 kHz, stays finite and dies away when lifted', `${top.toExponential(1)} V after 1.5 s`);
}

// 6. a bend: the finger pushes the string δ across the neck at the fret, a from the nut and ℓ from
// the bridge. The string, nut to bridge (L), stretches by ΔL = √(a² + δ²) − a + √(ℓ² + δ²) − ℓ and its
// tension rises by E A ΔL / L, A the steel core's section (E = 200 GPa): the guitar's plain G
// (0.432 mm, 73.8 N) at the 7th fret pushed 10 mm, by hand
{
  const g = new TB(fs, 'guitar'), L = 0.648, len = L * 2 ** (-7 / 12), a = L - len, d = 0.01;
  const want = 1 + (200e9 * Math.PI * 0.432e-3 ** 2 / 4) * (Math.hypot(a, d) - a + Math.hypot(len, d) - len) / L / 73.8;
  const got = g.bendTension(3, 7, d);
  check(Math.abs(got / want - 1) < 1e-12 && g.bendTension(3, 0, d) === 1 && g.bendTension(3, 7, 0.2) === 1.5,
    'a bend stretches the string, nut to bridge: its tension rises by E A ΔL / L (an open string has nothing to push against; a string is not pushed past 1.5 × its tension)',
    `the G at the 7th pushed 10 mm: × ${got.toFixed(4)}, ${(6 * Math.log2(got)).toFixed(2)} semitones`);
}

// 7. bent, the note is f √(T'/T), and each mode keeps its action: ℓ is fixed, so its displacement
// goes as 1/√f and what the pickup hears (its velocity, f A) as √f, (T'/T)^¼. The G at the 7th
// plucked twice, one pushed 10 mm 50 ms in: the bent one's fundamental, after its losses at its
// higher frequency (σ = b₁ + b₃ f²), against the other's; then let back, the note it was
for (const kind of ['guitar']) {
  const b = new TB(fs, kind), r = new TB(fs, kind), d = 0.01;
  b.pluck(3, 7, 0.8); r.pluck(3, 7, 0.8);
  render(b, 0.05); render(r, 0.05);
  b.bend(3, d);
  const xb = render(b, 0.5).subarray(0.2 * fs), xr = render(r, 0.5).subarray(0.2 * fs);
  const tension = b.bendTension(3, 7, d), p1 = r.partials(3, 7), p2 = p1[1];
  const fu = p1[0].f, fb = fu * Math.sqrt(tension), b3 = (p2.sigma - p1[0].sigma) / (p2.f ** 2 - fu ** 2);
  const got = peakNear(xb, fb), level = amplitudeAt(xb, fb, fs) / amplitudeAt(xr, fu, fs);
  const tc = 0.2 + 0.15; // the window's centre, after the bend began
  const wantLevel = tension ** 0.25 * Math.exp(-b3 * (fb * fb - fu * fu) * tc);
  check(Math.abs(cents(got, fb)) < 0.1 && Math.abs(level / wantLevel - 1) < 0.005,
    'bent, the note is f √(T\'/T), and the pickup hears (T\'/T)^¼ as much: each mode keeps its action',
    `${cents(got, fu).toFixed(1)} ¢ up for ${cents(fb, fu).toFixed(1)}; × ${level.toFixed(4)} for ${wantLevel.toFixed(4)}`);
  b.bend(3, 0);
  const back = render(b, 0.4).subarray(0.1 * fs);
  check(Math.abs(cents(peakNear(back, fu), fu)) < 0.1, 'let back, the bent note returns to the note it was, to a tenth of a cent');
}

// 8. a string already pushed when it is plucked starts bent (a pre-bend), and the bass's G, longer and
// under more tension for its core (E A / T 231 against the guitar G's 397), bends less for the same push
{
  const g = new TB(fs, 'guitar'); g.bend(3, 0.01); g.pluck(3, 7, 0.8);
  const x = render(g, 0.4).subarray(0.1 * fs), want = et(62) * Math.sqrt(g.bendTension(3, 7, 0.01));
  const bass = new TB(fs), up = (t) => 12 * Math.log2(Math.sqrt(t));
  check(Math.abs(cents(peakNear(x, want), want)) < 0.1 && up(bass.bendTension(3, 7, 0.01)) < up(g.bendTension(3, 7, 0.01)),
    'a string pushed before it is plucked plays bent; a bass\'s G bends less than a guitar\'s for the same push',
    `10 mm at the 7th: guitar G ${up(g.bendTension(3, 7, 0.01)).toFixed(2)}, bass G ${up(bass.bendTension(3, 7, 0.01)).toFixed(2)} semitones`);
}

done();
