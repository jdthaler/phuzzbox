// phuzz-circuit.mjs — the Phuzz's schematic, solved here independently of the C++ (which
// discretises it by the nodal DK method and solves the transistors by Newton on their junction
// voltages): the DC operating point by Newton on every node voltage at once, and the small-signal
// response by complex nodal analysis around that point, with each transistor linearised from its
// Ebers–Moll equations. The tests compare the engine with both.
//
// The circuit (PNP germanium, positive ground: the battery's + is ground, its − the rail S):
//
//   jack A ─┤├─ B (Q1 base)          Q1: emitter to ground, collector K1 ── 33 kΩ ── S
//      C1 2.2 µF                     Q2: base K1, emitter E2, collector K2
//   B ── 100 kΩ ── E2                 E2 ── (1 − fuzz)·1 kΩ ── W ── fuzz·1 kΩ ── ground,  W ── 20 µF ── ground
//   K2 ── 8.2 kΩ ── X ── 470 Ω ── S   X ─┤├─ O (10 nF),  O ── volume pot 500 kΩ (audio) ── ground, wiper V
//   S ── battery (EMF, internal resistance) ── ground;   V: the output, into the cable and the next input
//
// and at A, the bass: its coil (R + sL) to ground, its own capacitance and the cable's, its pots;
// driven by the Norton current that makes the voltage recorded at the interface (see source()).

const k_q = 8.617333262e-5; // Boltzmann's constant over the electron's charge, V/K
export const T0 = 293.15;   // K: the temperature the leakage is quoted at (20 °C)
export const EG = 0.67, XTI = 3, XTB = 1.5, BETA_R = 2; // germanium's band gap (eV); SPICE's exponents; reverse β
export const PARTS = { C1: 2.2e-6, R1: 33e3, R4: 100e3, FUZZ: 1e3, C2: 20e-6, R2: 470, C3: 10e-9, VOL: 500e3 };
const N = { A: 0, B: 1, K1: 2, E2: 3, W: 4, K2: 5, X: 6, S: 7, O: 8, V: 9 }, NN = 10, G0 = -1;

export const taper = (a) => (81 ** a - 1) / 80; // an audio-taper pot's wiper fraction at rotation a (10 % at half)

// One PNP from its parameters at temperature T: βF, βR and Is (from the leakage I_CEO at T0).
export function transistor(hfe, iceo, T) {
  const r = T / T0, bF = hfe * r ** XTB, bR = BETA_R * r ** XTB;
  const is0 = (iceo * BETA_R) / (hfe + BETA_R + 1); // I_CEO = Is (βF + βR + 1) / βR
  const is = is0 * r ** XTI * Math.exp((EG / (k_q * T)) * (r - 1));
  return { bF, bR, is, vt: k_q * T };
}
// Ebers–Moll (transport form) for a PNP with junction voltages veb = Ve − Vb, vcb = Vc − Vb:
// currents INTO the collector and base terminals, and their derivatives.
export function ebersMoll(q, veb, vcb) {
  const eF = Math.exp(veb / q.vt), eR = Math.exp(vcb / q.vt);
  const iF = q.is * (eF - 1), iR = q.is * (eR - 1), dF = (q.is * eF) / q.vt, dR = (q.is * eR) / q.vt;
  const aR = q.bR / (q.bR + 1);
  // NPN: Ic = iF − iR/αR, Ib = iF/βF + iR/βR; a PNP is the same with every sign turned over
  return {
    ic: -(iF - iR / aR), ib: -(iF / q.bF + iR / q.bR),
    dic: [-dF, dR / aR], dib: [-dF / q.bF, -dR / q.bR], // ∂/∂veb, ∂/∂vcb
  };
}

// The circuit's values from the pedal's parameters (P as the page has them, SI units).
export function circuit(P) {
  const T = 273.15 + P.temp;
  const fz = P.fuzz, vol = taper(P.volume);
  const passive = !P.active;
  return {
    q1: transistor(P.hfe1, P.leak1, T), q2: transistor(P.hfe2, P.leak2, T),
    Ra: Math.max(1, (1 - fz) * PARTS.FUZZ), Rb: Math.max(1, fz * PARTS.FUZZ),
    Rtop: Math.max(1, (1 - vol) * PARTS.VOL), Rbot: Math.max(1, vol * PARTS.VOL),
    R3: P.bias, Vbat: P.battery, Rbat: P.battR,
    coilR: passive ? P.pickupR : P.activeR, coilL: passive ? P.pickupL : 0,
    Gpots: passive ? 1 / P.pots : 0, Cself: passive ? P.pickupC : 0,
    Cin: P.cable * P.cablePF, Crec: P.recCable * P.cablePF, Grec: 1 / P.recLoad,
    Cout: P.outCable * P.cablePF, Gload: 1 / P.load,
  };
}

// the linear elements: [a, b, conductance] and [a, b, capacitance]
function linear(c) {
  const R = [[N.B, N.E2, 1 / PARTS.R4], [N.K1, N.S, 1 / PARTS.R1], [N.E2, N.W, 1 / c.Ra], [N.W, G0, 1 / c.Rb],
    [N.K2, N.X, 1 / c.R3], [N.X, N.S, 1 / PARTS.R2], [N.S, G0, 1 / c.Rbat], [N.O, N.V, 1 / c.Rtop],
    [N.V, G0, 1 / c.Rbot + c.Gload], [N.A, G0, c.Gpots]];
  const C = [[N.A, N.B, PARTS.C1], [N.W, G0, PARTS.C2], [N.X, N.O, PARTS.C3], [N.A, G0, c.Cself + c.Cin], [N.V, G0, c.Cout]];
  return { R, C };
}
const stamp = (M, a, b, g) => {
  if (a >= 0) M[a][a] += g;
  if (b >= 0) M[b][b] += g;
  if (a >= 0 && b >= 0) { M[a][b] -= g; M[b][a] -= g; }
};
function solve(M, b) { // Gaussian elimination with partial pivoting
  const n = b.length, A = M.map((r, i) => [...r, b[i]]);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
    [A[k], A[p]] = [A[p], A[k]];
    for (let i = k + 1; i < n; i++) { const f = A[i][k] / A[k][k]; for (let j = k; j <= n; j++) A[i][j] -= f * A[k][j]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = A[i][n]; for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j]; x[i] = s / A[i][i]; }
  return x;
}
// the transistors' terminals: [base, collector, emitter], ground as −1
const TERMINALS = [[N.B, N.K1, G0], [N.K1, N.K2, N.E2]];
const vAt = (V, n) => (n < 0 ? 0 : V[n]);

// The DC operating point: capacitors open, the coil its resistance. Newton on all ten node
// voltages, from everything at 0 V with the battery switched on in 40 steps (source stepping),
// each Newton step limited so that no junction moves more than 0.1 V at once.
export function operatingPoint(P) {
  const c0 = circuit(P), { R } = linear(c0), qs = [c0.q1, c0.q2];
  let V = new Array(NN).fill(0);
  for (let s = 1; s <= 40; s++) V = newton(V, { ...c0, Vbat: (c0.Vbat * s) / 40 });
  const c = c0;
  return finish(V);
  function newton(V, c) {
  for (let it = 0; it < 200; it++) {
    const J = Array.from({ length: NN }, () => new Array(NN).fill(0)), F = new Array(NN).fill(0);
    for (const [a, b, g] of R) stamp(J, a, b, g);
    if (c.coilR) stamp(J, N.A, G0, 1 / c.coilR);
    for (let i = 0; i < NN; i++) for (let j = 0; j < NN; j++) F[i] += J[i][j] * V[j];
    F[N.S] += c.Vbat / c.Rbat; // the battery's Norton source: −Vbat/Rbat into S
    qs.forEach((q, k) => {
      const [b, cl, e] = TERMINALS[k], vb = vAt(V, b);
      const m = ebersMoll(q, vAt(V, e) - vb, vAt(V, cl) - vb);
      const ie = -m.ic - m.ib;
      // currents leaving each node into the transistor, and their derivatives by node voltage
      const out = [[cl, m.ic, m.dic], [b, m.ib, m.dib], [e, ie, [-m.dic[0] - m.dib[0], -m.dic[1] - m.dib[1]]]];
      for (const [n, i, d] of out) {
        if (n < 0) continue;
        F[n] += i;
        // veb = Ve − Vb, vcb = Vc − Vb
        if (e >= 0) J[n][e] += d[0];
        if (cl >= 0) J[n][cl] += d[1];
        if (b >= 0) J[n][b] -= d[0] + d[1];
      }
    });
    const dV = solve(J, F.map((x) => -x));
    let lim = 1;
    for (const [b, cl, e] of TERMINALS) for (const n of [cl, e]) {
      const d = Math.abs(vAt(dV, n) - vAt(dV, b));
      if (d * lim > 0.1) lim = 0.1 / d;
    }
    V = V.map((v, i) => v + lim * dV[i]);
    if (Math.max(...dV.map(Math.abs)) * lim < 1e-12) break;
  }
  return V;
  }
  function finish(V) {
  const at = (k) => { const [b, cl, e] = TERMINALS[k], vb = vAt(V, b); return ebersMoll(qs[k], vAt(V, e) - vb, vAt(V, cl) - vb); };
  const m1 = at(0), m2 = at(1);
  return {
    V, node: N, c,
    q1: { vce: V[N.K1], ic: -m1.ic, ib: -m1.ib }, // collector current flowing out of the collector
    q2: { vce: V[N.K2] - V[N.E2], ic: -m2.ic, ib: -m2.ib },
    supply: -V[N.S],
  };
  }
}

// complex arithmetic on [re, im]
const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]], cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
function csolve(M, b) {
  const n = b.length, A = M.map((r, i) => [...r.map((z) => [...z]), [...b[i]]]);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.hypot(...A[i][k]) > Math.hypot(...A[p][k])) p = i;
    [A[k], A[p]] = [A[p], A[k]];
    for (let i = k + 1; i < n; i++) {
      const f = cdiv(A[i][k], A[k][k]);
      for (let j = k; j <= n; j++) { const t = cmul(f, A[k][j]); A[i][j] = [A[i][j][0] - t[0], A[i][j][1] - t[1]]; }
    }
  }
  const x = new Array(n).fill([0, 0]);
  for (let i = n - 1; i >= 0; i--) {
    let s = A[i][n];
    for (let j = i + 1; j < n; j++) { const t = cmul(A[i][j], x[j]); s = [s[0] - t[0], s[1] - t[1]]; }
    x[i] = cdiv(s, A[i][i]);
  }
  return x;
}

// The small-signal gain from the voltage recorded at the interface to the output at frequency f:
// the bass is a Norton source at the jack, I = v_rec · Y_rec, where Y_rec is everything the
// interface's recording saw at the jack (coil, capacitances, pots, the interface's own input).
export function smallSignal(P, freqs) {
  const op = operatingPoint(P), c = op.c, { R, C } = linear(c), V = op.V, qs = [c.q1, c.q2];
  return freqs.map((f) => {
    const w = 2 * Math.PI * f;
    const Y = Array.from({ length: NN }, () => Array.from({ length: NN }, () => [0, 0]));
    const add = (a, b, z) => {
      if (a >= 0) Y[a][a] = cadd(Y[a][a], z);
      if (b >= 0) Y[b][b] = cadd(Y[b][b], z);
      if (a >= 0 && b >= 0) { Y[a][b] = cadd(Y[a][b], [-z[0], -z[1]]); Y[b][a] = cadd(Y[b][a], [-z[0], -z[1]]); }
    };
    for (const [a, b, g] of R) add(a, b, [g, 0]);
    for (const [a, b, cap] of C) add(a, b, [0, w * cap]);
    const coil = cdiv([1, 0], [c.coilR, w * c.coilL]);
    add(N.A, G0, coil);
    qs.forEach((q, k) => {
      const [b, cl, e] = TERMINALS[k], vb = vAt(V, b);
      const m = ebersMoll(q, vAt(V, e) - vb, vAt(V, cl) - vb);
      const rows = [[cl, m.dic], [b, m.dib], [e, [-m.dic[0] - m.dib[0], -m.dic[1] - m.dib[1]]]];
      for (const [n, d] of rows) {
        if (n < 0) continue;
        if (e >= 0) Y[n][e] = cadd(Y[n][e], [d[0], 0]);
        if (cl >= 0) Y[n][cl] = cadd(Y[n][cl], [d[1], 0]);
        if (b >= 0) Y[n][b] = cadd(Y[n][b], [-(d[0] + d[1]), 0]);
      }
    });
    const Yrec = cadd(cadd(coil, [c.Gpots + c.Grec, 0]), [0, w * (c.Cself + c.Crec)]);
    const rhs = Array.from({ length: NN }, () => [0, 0]);
    rhs[N.A] = Yrec;
    const x = csolve(Y, rhs);
    return { out: x[N.V], jack: x[N.A] };
  });
}
export const mag = (z) => Math.hypot(z[0], z[1]);

// The input impedance at the jack, looking into the pedal (the bass removed), at frequency f.
export function inputImpedance(P, f) {
  // drive the jack with 1 A, the bass's own elements gone: put an ideal current into A with
  // nothing else there (a passive bass with no coil: active, a huge preamp resistance, no cable)
  const Q = { ...P, active: true, activeR: 1e15, cable: 0 };
  const op = operatingPoint(Q), c = op.c, { R, C } = linear(c), V = op.V, qs = [c.q1, c.q2], w = 2 * Math.PI * f;
  const Y = Array.from({ length: NN }, () => Array.from({ length: NN }, () => [0, 0]));
  const add = (a, b, z) => {
    if (a >= 0) Y[a][a] = cadd(Y[a][a], z);
    if (b >= 0) Y[b][b] = cadd(Y[b][b], z);
    if (a >= 0 && b >= 0) { Y[a][b] = cadd(Y[a][b], [-z[0], -z[1]]); Y[b][a] = cadd(Y[b][a], [-z[0], -z[1]]); }
  };
  for (const [a, b, g] of R) add(a, b, [g, 0]);
  for (const [a, b, cap] of C) add(a, b, [0, w * cap]);
  add(N.A, G0, [1e-15, 0]);
  qs.forEach((q, k) => {
    const [b, cl, e] = TERMINALS[k], vb = vAt(V, b);
    const m = ebersMoll(q, vAt(V, e) - vb, vAt(V, cl) - vb);
    for (const [n, d] of [[cl, m.dic], [b, m.dib], [e, [-m.dic[0] - m.dib[0], -m.dic[1] - m.dib[1]]]]) {
      if (n < 0) continue;
      if (e >= 0) Y[n][e] = cadd(Y[n][e], [d[0], 0]);
      if (cl >= 0) Y[n][cl] = cadd(Y[n][cl], [d[1], 0]);
      if (b >= 0) Y[n][b] = cadd(Y[n][b], [-(d[0] + d[1]), 0]);
    }
  });
  const rhs = Array.from({ length: NN }, () => [0, 0]);
  rhs[N.A] = [1, 0];
  return csolve(Y, rhs)[N.A];
}
