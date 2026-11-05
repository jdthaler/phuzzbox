// tunnel-circuit.mjs — the Tunnel Diode worked out independently of the C++, for the tests: Sze's
// three currents fitted to GE's points by Newton's method in all three unknowns at once; the
// switch's thresholds found by scanning the load line's Vs = V + R I(V) for its turning points (no
// derivatives); the switch in the limit of no capacitance, a map that keeps its branch until the
// branch ends; and the oscillator in the same limit, L di/dt = Vs − R i − V(i) on one branch at a
// time, its period an integral over the current.

const K = 1.380649e-23, Q = 1.602176634e-19, T = 298.15, VT = (K * T) / Q;
// GE Tunnel Diode Manual (1961): a 1 mA germanium diode's peak, valley and forward points
export const POINTS = { Ip: 1e-3, Vp: 0.055, Iv: 0.1e-3, Vv: 0.35, Vfp: 0.5 };

export function fitDiode(pt = POINTS) {
  const { Ip, Vp, Iv, Vv, Vfp } = pt;
  const tun = (V) => Ip * (V / Vp) * Math.exp(1 - V / Vp);
  const I = (x, V) => tun(V) + x[1] * Math.exp(x[2] * (V - Vv)) + x[0] * Math.expm1(V / VT);
  const dI = (x, V, h = 1e-7) => (I(x, V + h) - I(x, V - h)) / (2 * h);
  // unknowns I0, Jx, C4; conditions I(Vv) = Iv, I'(Vv) = 0, I(Vfp) = Ip, each scaled to order 1
  const F = (x) => [I(x, Vv) / Iv - 1, dI(x, Vv) * Vv / Iv, I(x, Vfp) / Ip - 1];
  let x = [Ip / Math.expm1(Vfp / VT), Iv / 2, 5];
  for (let it = 0; it < 50; it++) {
    const f = F(x), J = [[], [], []];
    for (let j = 0; j < 3; j++) {
      const d = Math.abs(x[j]) * 1e-6, y = x.slice(); y[j] += d;
      const g = F(y);
      for (let i = 0; i < 3; i++) J[i][j] = (g[i] - f[i]) / d;
    }
    const dx = solve3(J, f.map((v) => -v));
    x = x.map((v, j) => v + dx[j]);
    if (Math.max(...dx.map((v, j) => Math.abs(v / x[j]))) < 1e-13) break;
  }
  const [I0, Jx, C4] = x;
  return { I0, Jx, C4, ...pt, I: (V) => I(x, V) };
}
function solve3(A, b) {
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A);
  return [0, 1, 2].map((j) => det(A.map((row, i) => row.map((v, k) => (k === j ? b[i] : v)))) / D);
}

// the curve's peak and valley, and the steepest negative slope, by scanning
export function extremes(d, dv = 1e-6) {
  let peak = [0, -1], valley = [0, 1], g = [0, 0];
  for (let V = 0.001; V < 0.45; V += dv) {
    const i = d.I(V), s = (d.I(V + dv) - d.I(V - dv)) / (2 * dv);
    if (V < 0.2 && i > peak[1]) peak = [V, i];
    if (V > 0.2 && i < valley[1]) valley = [V, i];
    if (s < g[1]) g = [V, s];
  }
  return { peak, valley, gmin: g[1], vm: g[0] };
}

// the switch's thresholds on Vs for a load R: Vs(V) = V + R I(V) at its turning points, and the
// diode's voltages there (va, vb), where the stable branches end; all null without memory
export function thresholds(d, R, dv = 2e-7) {
  let up = null, down = null, va = null, vb = null, prev = -Infinity, rising = true;
  for (let V = 0; V < 0.6; V += dv) {
    const vs = V + R * d.I(V);
    if (rising && vs < prev) { up = prev; va = V - dv; rising = false; }
    else if (!rising && vs > prev && down === null) { down = prev; vb = V - dv; }
    prev = vs;
  }
  return { up, down, va, vb };
}

// the static state on a branch: the root of Vs − V − R I(V) in [a, b], by bisection
export function root(d, R, vs, a, b) {
  for (let k = 0; k < 200; k++) { const m = (a + b) / 2; if (vs - m - R * d.I(m) > 0) a = m; else b = m; }
  return (a + b) / 2;
}

// The switch without capacitance: for each Vs, the state on the branch it is on until that branch
// ends at a threshold. Returns the diode's voltages.
export function switchMap(d, R, vsList) {
  const { up, down, va, vb } = thresholds(d, R);
  let high = false;
  return vsList.map((vs) => {
    if (!high && vs > up) high = true;
    else if (high && vs < down) high = false;
    return high ? root(d, R, vs, vb, 1) : root(d, R, vs, -1, va);
  });
}

// The voltage on a branch at current i: the low branch below the peak, the high one above the valley.
export function branchV(d, i, high, ex = extremes(d, 1e-5)) {
  let a = high ? ex.valley[0] : -0.5, b = high ? 0.8 : ex.peak[0];
  for (let k = 0; k < 100; k++) { const m = (a + b) / 2; if (d.I(m) < i) a = m; else b = m; }
  return (a + b) / 2;
}

// The relaxation oscillator's period without capacitance: up the low branch from the valley's
// current to the peak's, then down the high one back:
//   T = L ∫ di/(Vs − R i − Vlow(i)) + L ∫ di/(R i + Vhigh(i) − Vs), both from Iv to Ip
export function period(d, R, L, vs, n = 4000) {
  const ex = extremes(d, 1e-5), Ip = ex.peak[1], Iv = ex.valley[1];
  let t = 0;
  for (let k = 0; k < n; k++) { // midpoints, so the ends (where V(i) turns) are never evaluated
    const i = Iv + ((k + 0.5) / n) * (Ip - Iv), di = (Ip - Iv) / n;
    t += L * di * (1 / (vs - R * i - branchV(d, i, false, ex)) + 1 / (R * i + branchV(d, i, true, ex) - vs));
  }
  return t;
}
