// ringmod-circuit.mjs — the Ring Modulator's circuit solved independently of the C++: the ring's
// node equations, written from the diagram (ringmod/README.md) as the currents into each of its four
// corners, solved by Newton with a finite-difference Jacobian and a line search; the closed form
// for an unloaded ring driven by stiff sources; and the carrier's waveforms from their definitions.

export const k = 1.380649e-23, q = 1.602176634e-19, T = 298.15;
export const VT = (k * T) / q;
// each family's voltage at 1 mA at 25 °C and its ideality (the Bandgap's)
export const FAMILIES = { ge: [0.28, 1.6], schottky: [0.32, 1.05], si: [0.58, 1.75] };
export const RS = 600, RC = 470, RL = 600, SLEW = 0.5e6;

export function diodes(kind, mismatch = 0) {
  const [v1, n] = FAMILIES[kind], nvt = n * VT, is = 1e-3 / Math.expm1(v1 / nvt);
  return { nvt, is: [is * Math.exp(-mismatch / nvt), is, is, is] };
}

// The ring with the bass's source vin behind Rs (T1's primary, whose secondary halves sit at
// vc ± u), the carrier vcar behind Rc into T1's centre tap (vc), and T2's halves at ±w into RL
// (Infinity: no load); the transformers' magnetising inductances as constant currents J1 and J2
// (their currents over a cycle when L is large: steadyLeak). Returns u, vc, w and the diodes' currents.
export function ring({ vin, vcar, kind = 'ge', mismatch = 0, Rs = RS, Rc = RC, Rl = RL, J1 = 0, J2 = 0, guess = null }) {
  const { nvt, is } = diodes(kind, mismatch);
  const I = (j, v) => is[j] * Math.expm1(Math.min(v / nvt, 600));
  // the corners: A = vc + u and B = vc − u (T1's ends), C = w and D = −w (T2's)
  const currents = ([u, vc, w]) => {
    const A = vc + u, B = vc - u, C = w, D = -w;
    return [I(0, A - C), I(1, C - B), I(2, B - D), I(3, D - A)]; // D1 A→C, D2 C→B, D3 B→D, D4 D→A
  };
  const F = (x) => {
    const [i1, i2, i3, i4] = currents(x), [u, vc, w] = x;
    const outA = i1 - i4, outB = i3 - i2, inC = i1 - i2, inD = i3 - i4;
    return [
      (vin - u) / Rs - J1 - (outA - outB), // T1's primary carries the difference of its halves' currents
      (vcar - vc) / Rc - (outA + outB), // the carrier supplies their sum, through the centre tap
      inC - inD - J2 - (Rl === Infinity ? 0 : w / Rl), // T2's halves' difference flows in the load
    ];
  };
  const norm = (f) => Math.hypot(...f.map((v, i) => v * [Rs, Rc, 1e3][i]));
  let x = guess ? [...guess] : [0, Math.max(-0.4, Math.min(0.4, vcar)), 0];
  let f = F(x);
  for (let it = 0; it < 200; it++) {
    const J = [0, 1, 2].map(() => [0, 0, 0]);
    for (let j = 0; j < 3; j++) {
      const hstep = 1e-7, xp = [...x];
      xp[j] += hstep;
      const fp = F(xp);
      for (let i = 0; i < 3; i++) J[i][j] = (fp[i] - f[i]) / hstep;
    }
    const d = gauss(J, f.map((v) => -v));
    // a line search: halve the step until the residual falls
    let t = 1, xn, fn;
    for (let h = 0; h < 60; h++, t /= 2) {
      xn = x.map((v, i) => v + t * d[i]);
      fn = F(xn);
      if (norm(fn) < norm(f) || h === 59) break;
    }
    const moved = Math.max(...d.map((v) => Math.abs(t * v)));
    x = xn; f = fn;
    if (moved < 1e-12 || norm(f) < 1e-15) break;
  }
  const [i1, i2, i3, i4] = currents(x);
  return { u: x[0], vc: x[1], w: x[2], i: [i1, i2, i3, i4] };
}

function gauss(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const m = M[r][c] / M[c][c]; for (let k2 = c; k2 <= n; k2++) M[r][k2] -= m * M[c][k2]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c]; x[r] = s / M[r][r]; }
  return x;
}

// The carrier's periodic steady state with nothing in, for transformers whose inductance is large: a
// winding can hold no DC voltage, so each inductor carries the constant current (J1, J2) that makes
// u's and w's averages over a cycle zero, and at the carrier's frequency it passes almost nothing.
// Found by Newton's method on the two averages. Returns w over one cycle at N points.
export function steadyLeak({ wave, amp, fc, kind, mismatch, N = 256 }) {
  const cycle = (J1, J2) => {
    let guess = null, su = 0, sw = 0;
    const w = [];
    for (let i = 0; i < N; i++) {
      const z = ring({ vin: 0, vcar: carrier(wave, amp, fc, i / N), kind, mismatch, J1, J2, guess });
      guess = [z.u, z.vc, z.w]; su += z.u / N; sw += z.w / N; w.push(z.w);
    }
    return { su, sw, w };
  };
  let J = [0, 0], c = cycle(0, 0);
  for (let it = 0; it < 20 && Math.max(Math.abs(c.su), Math.abs(c.sw)) > 1e-13; it++) {
    const d = 1e-9, a = cycle(J[0] + d, J[1]), b = cycle(J[0], J[1] + d);
    const m = [[(a.su - c.su) / d, (b.su - c.su) / d], [(a.sw - c.sw) / d, (b.sw - c.sw) / d]];
    const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    J = [J[0] - (m[1][1] * c.su - m[0][1] * c.sw) / det, J[1] - (-m[1][0] * c.su + m[0][0] * c.sw) / det];
    c = cycle(J[0], J[1]);
  }
  return c.w;
}

// The unloaded ring between stiff sources: with ideal exponential diodes, KCL at T2's ends gives
// e^(a+b−c) − e^(−a+b+c) − e^(a−b+c) + e^(−a−b−c) = 0 (a, b, c = vc, u, w over nVT), that is
// e^a sinh(b − c) = e^(−a) sinh(b + c), so tanh c = tanh a tanh b: a multiplier in tanh's terms.
export const unloaded = (u, vc, nvt) => nvt * Math.atanh(Math.tanh(u / nvt) * Math.tanh(vc / nvt));

// the carrier's waveforms, from their definitions: phase p in cycles
export function carrier(wave, amp, fc, p) {
  const ph = p - Math.floor(p);
  if (wave === 'sine') return amp * Math.sin(2 * Math.PI * ph);
  // a triangle: up from 0 to amp in a quarter cycle, down to −amp by three quarters, back to 0
  const tri = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * ph));
  if (wave === 'triangle') return amp * tri;
  // a comparator slewing at SLEW from −amp to +amp: a straight ramp through each zero crossing of
  // the ideal square, flat at ±amp between (a smaller triangle, if it never gets there)
  const half = 1 / (2 * fc), t = ph / fc; // within the cycle, s
  const tc = t < half / 2 ? t : t < (3 * half) / 2 ? t - half : t - 2 * half; // from the nearest crossing
  const sign = t < half / 2 || t >= (3 * half) / 2 ? 1 : -1;
  return sign * Math.max(-amp, Math.min(amp, SLEW * tc));
}

// the complex Fourier coefficient m of a periodic sequence x (one period, N samples)
export function fourier(x, m) {
  let re = 0, im = 0;
  for (let i = 0; i < x.length; i++) { const a = (-2 * Math.PI * m * i) / x.length; re += x[i] * Math.cos(a); im += x[i] * Math.sin(a); }
  return Math.hypot(re, im) / x.length;
}
