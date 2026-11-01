// preamp-circuit.mjs — the Tube Preamp's schematic, solved here independently of the C++ (which
// discretises it by the nodal DK method and solves the triodes by Newton on their six port
// voltages): the DC operating point by Newton on every node voltage at once, the small-signal
// response by complex nodal analysis around it with each triode linearised from its own equations
// (their derivatives taken here by finite differences), and the tone stack alone by Yeh and
// Smith's closed form. The tests compare the engine with all three.
//
// The circuit (a 1959 Bassman's preamp, its first stage the 12AX7 of Fender's AB763 amps):
//
//   jack A ── 68 kΩ ── G1;  A ── 1 MΩ ── ground           V1a: grid G1, plate P1, cathode K1
//   P1 ── 100 kΩ ── D;  K1 ── 1.5 kΩ ∥ 25 µF ── ground
//   P1 ─┤├─ Q (20 nF);  Q ── Gain pot 1 MΩ (audio) ── ground, its wiper W1;  W1 ── 270 kΩ ── G2
//   V2a: grid G2, plate P2 ── 100 kΩ ── D, cathode K2 ── 820 Ω ── ground (no bypass)
//   V2b, a cathode follower: grid P2 (DC-coupled), plate D, cathode K3 ── 100 kΩ ── ground
//   the tone stack from K3 (Yeh and Smith's):  K3 ─┤├─ T (250 pF);  T ── (1 − t) 250 kΩ ── O;
//     O ── t 250 kΩ ── X;  K3 ── 56 kΩ ── S;  S ─┤├─ X (20 nF);  S ─┤├─ Y (20 nF);
//     X ── l 1 MΩ ── Z;  Z ── (1 − m) 25 kΩ ── Y;  Y ── m 25 kΩ ── ground
//   O ── Master pot 1 MΩ (audio) ── ground, its wiper V the output, into the cable and the next input
//   the supply: the 385 V rail E ── dropper ── D;  D ── 8 µF ── ground
//   each triode's capacitances: grid–cathode 2.3 pF, grid–plate 2.4 pF, plate–cathode 0.9 pF
//
// and at A, the bass: its coil (R + sL) to ground, its own capacitance and the cable's, its pots;
// driven by the Norton current that makes the voltage recorded at the interface.

export const taper = (a) => (81 ** a - 1) / 80; // an audio-taper pot's wiper fraction at rotation a (10 % at half)

// Dempwolf and Zölzer's 12AX7s (DAFx 2011, Table 1)
export const TUBES = {
  rsd1: { G: 2.242e-3, mu: 103.2, gamma: 1.26, C: 3.40, Gg: 6.177e-4, xi: 1.314, Cg: 9.901, Ig0: 8.025e-8 },
  rsd2: { G: 2.173e-3, mu: 100.2, gamma: 1.28, C: 3.19, Gg: 5.911e-4, xi: 1.358, Cg: 11.76, Ig0: 4.527e-8 },
  ehx1: { G: 1.371e-3, mu: 86.9, gamma: 1.349, C: 4.56, Gg: 3.263e-4, xi: 1.156, Cg: 11.99, Ig0: 3.917e-8 },
};
export const PARTS = {
  Rgrid: 1e6, Rstop1: 68e3, Rp1: 100e3, Rk1: 1.5e3, Cc: 20e-9, GAIN: 1e6, Rstop2: 270e3, Rp2: 100e3, Rk2: 820, Rk3: 100e3,
  C1: 250e-12, C2: 20e-9, C3: 20e-9, R1: 250e3, R2: 1e6, R3: 25e3, R4: 56e3, MASTER: 1e6,
  Cgk: 2.3e-12, Cag: 2.4e-12, Cak: 0.9e-12, Lactive: 1e-6,
};

// softplus and its derivative, without overflow
const sp = (x) => Math.max(x, 0) + Math.log1p(Math.exp(-Math.abs(x)));
// a triode's grid and plate currents (into the tube, out of its cathode) at Vg, Va from the cathode
export function triode(t, vg, va) {
  const ik = t.G * (sp(t.C * (va / t.mu + vg)) / t.C) ** t.gamma;
  const ig = t.Gg * (sp(t.Cg * vg) / t.Cg) ** t.xi + t.Ig0;
  return { ig, ia: ik - ig };
}

const NODES = ['A', 'M', 'G1', 'P1', 'K1', 'Q', 'W1', 'G2', 'P2', 'K2', 'K3', 'T', 'O', 'X', 'S', 'Y', 'Z', 'V', 'D', 'E'];
export const N = Object.fromEntries(NODES.map((n, i) => [n, i]));
const G0 = -1;

// The circuit's values from the pedal's parameters (P as the page has them, SI units).
export function circuit(P) {
  const tube = { ...TUBES[P.tube] };
  tube.G *= P.emission;
  const pot = (x) => Math.max(1, x);
  const g = taper(P.gain), v = taper(P.master), l = taper(P.bass), m = P.middle, t = P.treble;
  const passive = !P.active;
  return {
    tube,
    gainTop: pot((1 - g) * PARTS.GAIN), gainBot: pot(g * PARTS.GAIN),
    masterTop: pot((1 - v) * PARTS.MASTER), masterBot: pot(v * PARTS.MASTER),
    tTop: pot((1 - t) * PARTS.R1), tBot: pot(t * PARTS.R1), bassR: pot(l * PARTS.R2), midTop: pot((1 - m) * PARTS.R3), midBot: pot(m * PARTS.R3),
    Bplus: P.bplus, Rs: P.supplyR, Cf: P.filterC, Ck: P.cathodeC,
    coilR: passive ? P.pickupR : P.activeR, coilL: passive ? P.pickupL : PARTS.Lactive,
    Gpots: passive ? 1 / P.pots : 0, Cself: passive ? P.pickupC : 0,
    Cin: P.cable * P.cablePF, Crec: P.recCable * P.cablePF, Grec: 1 / P.recLoad,
    Cout: P.outCable * P.cablePF, Gload: 1 / P.load,
  };
}

// the linear parts: [a, b, conductance], [a, b, capacitance], [a, b, inductance]; E is held at B+
function linear(c) {
  const R = [
    [N.A, N.M, 1 / c.coilR], [N.A, G0, c.Gpots], [N.A, G0, 1 / PARTS.Rgrid], [N.A, N.G1, 1 / PARTS.Rstop1],
    [N.P1, N.D, 1 / PARTS.Rp1], [N.K1, G0, 1 / PARTS.Rk1], [N.Q, N.W1, 1 / c.gainTop], [N.W1, G0, 1 / c.gainBot],
    [N.W1, N.G2, 1 / PARTS.Rstop2], [N.P2, N.D, 1 / PARTS.Rp2], [N.K2, G0, 1 / PARTS.Rk2], [N.K3, G0, 1 / PARTS.Rk3],
    [N.T, N.O, 1 / c.tTop], [N.O, N.X, 1 / c.tBot], [N.K3, N.S, 1 / PARTS.R4], [N.X, N.Z, 1 / c.bassR], [N.Z, N.Y, 1 / c.midTop], [N.Y, G0, 1 / c.midBot],
    [N.O, N.V, 1 / c.masterTop], [N.V, G0, 1 / c.masterBot + c.Gload], [N.E, N.D, 1 / c.Rs],
  ];
  const C = [
    [N.A, G0, c.Cself + c.Cin], [N.K1, G0, c.Ck], [N.P1, N.Q, PARTS.Cc], [N.K3, N.T, PARTS.C1], [N.S, N.X, PARTS.C2], [N.S, N.Y, PARTS.C3],
    [N.V, G0, c.Cout], [N.D, G0, c.Cf],
  ];
  for (const [g, p, k] of TRIODES) C.push([g, k, PARTS.Cgk], [g, p, PARTS.Cag], [p, k, PARTS.Cak]);
  const L = [[N.M, G0, c.coilL]];
  return { R, C, L };
}
// each triode's grid, plate and cathode
export const TRIODES = [[N.G1, N.P1, N.K1], [N.G2, N.P2, N.K2], [N.P2, N.D, N.K3]];

const NN = NODES.length;
const zeros = (n) => Array.from({ length: n }, () => 0);
function solve(M, b) { // Gaussian elimination with partial pivoting, real or complex ([re, im]) entries
  const cx = Array.isArray(b[0]);
  const n = b.length, A = M.map((r, i) => [...r, b[i]]);
  const abs = cx ? (z) => Math.hypot(z[0], z[1]) : Math.abs;
  const mul = cx ? (a, z) => [a[0] * z[0] - a[1] * z[1], a[0] * z[1] + a[1] * z[0]] : (a, z) => a * z;
  const sub = cx ? (a, z) => [a[0] - z[0], a[1] - z[1]] : (a, z) => a - z;
  const div = cx ? (a, z) => { const d = z[0] * z[0] + z[1] * z[1]; return [(a[0] * z[0] + a[1] * z[1]) / d, (a[1] * z[0] - a[0] * z[1]) / d]; } : (a, z) => a / z;
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (abs(A[i][k]) > abs(A[p][k])) p = i;
    [A[k], A[p]] = [A[p], A[k]];
    for (let i = k + 1; i < n; i++) {
      const f = div(A[i][k], A[k][k]);
      for (let j = k; j <= n; j++) A[i][j] = sub(A[i][j], mul(f, A[k][j]));
    }
  }
  const x = new Array(n);
  for (let k = n - 1; k >= 0; k--) {
    let s = A[k][n];
    for (let j = k + 1; j < n; j++) s = sub(s, mul(A[k][j], x[j]));
    x[k] = div(s, A[k][k]);
  }
  return x;
}

// The DC operating point: capacitors open, the coil a short; Newton on every node voltage, with E
// held at B+ (its row replaced by V_E = B+) and B+ raised from zero in steps.
export function operatingPoint(P) {
  const c = circuit(P), { R, L } = linear(c);
  const stamp = (M, a, b, g) => {
    if (a >= 0) M[a][a] += g;
    if (b >= 0) M[b][b] += g;
    if (a >= 0 && b >= 0) { M[a][b] -= g; M[b][a] -= g; }
  };
  const Gl = zeros(NN).map(() => zeros(NN));
  for (const [a, b, g] of R) stamp(Gl, a, b, g);
  for (const [a, b] of L) stamp(Gl, a, b, 1e4);
  const V = zeros(NN);
  const steps = 20;
  let converged = false;
  for (let s = 1; s <= steps; s++) {
    const B = (c.Bplus * s) / steps;
    converged = false;
    for (let it = 0; it < 200; it++) {
      // f(V) = G V + (the tubes' currents out of each node) = 0; Jacobian by the tubes' derivatives
      const f = Gl.map((row) => row.reduce((acc, g, j) => acc + g * V[j], 0));
      const J = Gl.map((row) => [...row]);
      for (const [g, p, k] of TRIODES) {
        const vg = V[g] - V[k], va = V[p] - V[k], h = 1e-6;
        const i0 = triode(c.tube, vg, va), ig1 = triode(c.tube, vg + h, va), ia1 = triode(c.tube, vg, va + h);
        const igg = (ig1.ig - i0.ig) / h, iag = (ig1.ia - i0.ia) / h, iaa = (ia1.ia - i0.ia) / h;
        // currents out of the grid and plate into the tube, into the cathode from it
        f[g] += i0.ig; f[p] += i0.ia; f[k] -= i0.ig + i0.ia;
        const rows = [[g, igg, 0], [p, iag, iaa], [k, -(igg + iag), -iaa]];
        for (const [r, dvg, dva] of rows) { J[r][g] += dvg; J[r][p] += dva; J[r][k] -= dvg + dva; }
      }
      f[N.E] = V[N.E] - B;
      J[N.E] = zeros(NN); J[N.E][N.E] = 1;
      const dV = solve(J, f.map((x) => -x));
      // a step that would move any grid more than 1 V from its cathode is shortened, whole
      let k = 1;
      for (const [g, , c] of TRIODES) { const d = Math.abs(dV[g] - dV[c]); if (d > 1) k = Math.min(k, 1 / d); }
      let worst = 0;
      for (let i = 0; i < NN; i++) { V[i] += k * dV[i]; worst = Math.max(worst, Math.abs(dV[i])); }
      if (worst < 1e-9) { converged = true; break; }
    }
  }
  const tubes = TRIODES.map(([g, p, k]) => ({ vg: V[g] - V[k], va: V[p] - V[k], ...triode(c.tube, V[g] - V[k], V[p] - V[k]) }));
  return { V, node: Object.fromEntries(NODES.map((n, i) => [n, V[i]])), tubes, c, converged };
}

// The small-signal response at f Hz at the operating point: the output (and every node) per volt
// recorded at the interface. The bass's Norton current I = V_rec · Y_rec, Y_rec everything the
// recording saw (the coil, the capacitances, the pots, the interface's input), drives node A.
export function smallSignal(P, f, op = operatingPoint(P)) {
  const c = op.c, { R, C, L } = linear(c), w = 2 * Math.PI * f;
  const M = zeros(NN).map(() => zeros(NN).map(() => [0, 0])), rhs = zeros(NN).map(() => [0, 0]);
  const add = (a, b, y) => {
    for (const [i, j, s] of [[a, a, 1], [b, b, 1], [a, b, -1], [b, a, -1]]) {
      if (i < 0 || j < 0) continue;
      M[i][j][0] += s * y[0]; M[i][j][1] += s * y[1];
    }
  };
  for (const [a, b, g] of R) add(a, b, [g, 0]);
  for (const [a, b, cap] of C) add(a, b, [0, w * cap]);
  for (const [a, b, l] of L) add(a, b, [0, -1 / (w * l)]);
  for (const [q, [g, p, k]] of TRIODES.entries()) {
    const t = op.tubes[q], h = 1e-6;
    const i0 = triode(c.tube, t.vg, t.va), ig1 = triode(c.tube, t.vg + h, t.va), ia1 = triode(c.tube, t.vg, t.va + h);
    const igg = (ig1.ig - i0.ig) / h, iag = (ig1.ia - i0.ia) / h, iaa = (ia1.ia - i0.ia) / h;
    for (const [r, dvg, dva] of [[g, igg, 0], [p, iag, iaa], [k, -(igg + iag), -iaa]]) {
      M[r][g][0] += dvg; M[r][p][0] += dva; M[r][k][0] -= dvg + dva;
    }
  }
  // the supply's rail E is AC ground
  M[N.E] = zeros(NN).map(() => [0, 0]); M[N.E][N.E] = [1, 0];
  // the Norton current per recorded volt: 1/(R + jωL) + jω(Cself + Crec) + Gpots + Grec
  const zl = [c.coilR, w * c.coilL], dz = zl[0] * zl[0] + zl[1] * zl[1];
  rhs[N.A] = [zl[0] / dz + c.Gpots + c.Grec, -zl[1] / dz + w * (c.Cself + c.Crec)];
  const x = solve(M, rhs);
  return Object.fromEntries(NODES.map((n, i) => [n, x[i]]));
}
export const mag = (z) => Math.hypot(z[0], z[1]);
const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
export const ratio = cdiv;

// Yeh and Smith's closed form for the Bassman's tone stack, unloaded (DAFx 2006, eqs. 1–3): its
// output over its input at f Hz, for the treble t, middle m and bass l (each pot's fraction).
export function yehSmith(t, m, l, f) {
  const { C1, C2, C3, R1, R2, R3, R4 } = PARTS;
  const b1 = t * C1 * R1 + m * C3 * R3 + l * (C1 * R2 + C2 * R2) + (C1 * R3 + C2 * R3);
  const b2 = t * (C1 * C2 * R1 * R4 + C1 * C3 * R1 * R4) - m * m * (C1 * C3 * R3 * R3 + C2 * C3 * R3 * R3)
    + m * (C1 * C3 * R1 * R3 + C1 * C3 * R3 * R3 + C2 * C3 * R3 * R3) + l * (C1 * C2 * R1 * R2 + C1 * C2 * R2 * R4 + C1 * C3 * R2 * R4)
    + l * m * (C1 * C3 * R2 * R3 + C2 * C3 * R2 * R3) + (C1 * C2 * R1 * R3 + C1 * C2 * R3 * R4 + C1 * C3 * R3 * R4);
  const b3 = l * m * (C1 * C2 * C3 * R1 * R2 * R3 + C1 * C2 * C3 * R2 * R3 * R4) - m * m * (C1 * C2 * C3 * R1 * R3 * R3 + C1 * C2 * C3 * R3 * R3 * R4)
    + m * (C1 * C2 * C3 * R1 * R3 * R3 + C1 * C2 * C3 * R3 * R3 * R4) + t * C1 * C2 * C3 * R1 * R3 * R4 - t * m * C1 * C2 * C3 * R1 * R3 * R4
    + t * l * C1 * C2 * C3 * R1 * R2 * R4;
  const a1 = (C1 * R1 + C1 * R3 + C2 * R3 + C2 * R4 + C3 * R4) + m * C3 * R3 + l * (C1 * R2 + C2 * R2);
  const a2 = m * (C1 * C3 * R1 * R3 - C2 * C3 * R3 * R4 + C1 * C3 * R3 * R3 + C2 * C3 * R3 * R3) + l * m * (C1 * C3 * R2 * R3 + C2 * C3 * R2 * R3)
    - m * m * (C1 * C3 * R3 * R3 + C2 * C3 * R3 * R3) + l * (C1 * C2 * R2 * R4 + C1 * C2 * R1 * R2 + C1 * C3 * R2 * R4 + C2 * C3 * R2 * R4)
    + (C1 * C2 * R1 * R4 + C1 * C3 * R1 * R4 + C1 * C2 * R3 * R4 + C1 * C2 * R1 * R3 + C1 * C3 * R3 * R4 + C2 * C3 * R3 * R4);
  const a3 = l * m * (C1 * C2 * C3 * R1 * R2 * R3 + C1 * C2 * C3 * R2 * R3 * R4) - m * m * (C1 * C2 * C3 * R1 * R3 * R3 + C1 * C2 * C3 * R3 * R3 * R4)
    + m * (C1 * C2 * C3 * R3 * R3 * R4 + C1 * C2 * C3 * R1 * R3 * R3 - C1 * C2 * C3 * R1 * R3 * R4) + l * C1 * C2 * C3 * R1 * R2 * R4
    + C1 * C2 * C3 * R1 * R3 * R4;
  const w = 2 * Math.PI * f; // s = jω: s² = −ω², s³ = −jω³
  const num = [-b2 * w * w, b1 * w - b3 * w ** 3], den = [1 - a2 * w * w, a1 * w - a3 * w ** 3];
  return cdiv(num, den);
}

// The tone stack alone by nodal analysis (its input held at 1 V, its output unloaded), to check
// that the schematic above is the network Yeh and Smith solved.
export function toneStackNodal(t, m, l, f) {
  const w = 2 * Math.PI * f, pot = (x) => Math.max(1, x);
  const n = { T: 0, O: 1, X: 2, S: 3, Y: 4, Z: 5 }, IN = -2;
  const parts = [[IN, n.T, [0, w * PARTS.C1]], [n.T, n.O, [1 / pot((1 - t) * PARTS.R1), 0]], [n.O, n.X, [1 / pot(t * PARTS.R1), 0]],
    [IN, n.S, [1 / PARTS.R4, 0]], [n.S, n.X, [0, w * PARTS.C2]], [n.S, n.Y, [0, w * PARTS.C3]], [n.X, n.Z, [1 / pot(l * PARTS.R2), 0]],
    [n.Z, n.Y, [1 / pot((1 - m) * PARTS.R3), 0]], [n.Y, G0, [1 / pot(m * PARTS.R3), 0]]];
  const M = zeros(6).map(() => zeros(6).map(() => [0, 0])), rhs = zeros(6).map(() => [0, 0]);
  for (const [a, b, y] of parts) {
    for (const [i, j, s] of [[a, a, 1], [b, b, 1], [a, b, -1], [b, a, -1]]) {
      if (i < 0) continue;
      if (j >= 0) { M[i][j][0] += s * y[0]; M[i][j][1] += s * y[1]; } else if (j === IN) { rhs[i][0] -= s * y[0]; rhs[i][1] -= s * y[1]; }
    }
  }
  return solve(M, rhs)[n.O];
}
