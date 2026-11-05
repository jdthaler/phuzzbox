// bandgap-circuit.mjs — the Bandgap's circuit, solved here independently of the C++ (which
// integrates it by TR-BDF2 with Newton, at up to 4× the sample rate, with a soft clamp at the
// op-amp's rails): the same circuit's equations integrated explicitly by classical Runge–Kutta at
// a step of tens of nanoseconds, with the rails a hard clamp; and its small-signal response by
// nodal analysis with complex impedances. The tests compare the engine with both.
//
// The circuit:
//
//   bass ── op-amp + ;  op-amp out X ── (Rf ∥ Cf) ── U (the − input) ── Rg ── G ── Cg ── ground
//   X ── Rt ── D;  D ── Cd ── ground;  D ── diodes (one way and the other) ── ground
//   D ── buffer ── Rft ── O ── Ct ── ground;  O, times the Level, is the output
//
// The op-amp: dX/dt = SR · tanh((v₊ − v₋)/Vs), Vs = SR / (2π GBW), its output held within its rails.

export const k = 1.380649e-23, q = 1.602176634e-19, h = 6.62607015e-34, c = 299792458; // SI, exact
export const T0 = 298.15;

// the diode families: their voltage at 1 mA at 25 °C, ideality n, gap (eV) and XTI. An LED's gap
// is its photon's energy, and it turns on 0.2 V below it.
const photon = (lambda) => (h * c) / (lambda * q); // eV
export const FAMILIES = {
  ge: { v1: 0.28, n: 1.6, eg: 0.66, xti: 3 },
  schottky: { v1: 0.32, n: 1.05, eg: 0.60, xti: 2 },
  si: { v1: 0.58, n: 1.75, eg: 1.12, xti: 3 },
  red: { v1: photon(630e-9) - 0.2, n: 2, eg: photon(630e-9), xti: 3, lambda: 630e-9 },
  green: { v1: photon(525e-9) - 0.2, n: 2, eg: photon(525e-9), xti: 3, lambda: 525e-9 },
  blue: { v1: photon(465e-9) - 0.2, n: 2, eg: photon(465e-9), xti: 3, lambda: 465e-9 },
};
export const OPAMPS = { lm308: { gbw: 1e6, sr: 0.3e6, headroom: 1.5 }, ua741: { gbw: 1e6, sr: 0.5e6, headroom: 1.5 }, tl072: { gbw: 3e6, sr: 13e6, headroom: 1.5 } };

// a diode of family f at temperature T (K): Shockley's I = Is (e^(V/nVT) − 1), Is from its 1 mA
// voltage at T0 and SPICE's law Is(T) = Is(T0) (T/T0)^(XTI/n) exp((Eg/nk)(1/T0 − 1/T))
export function diode(f, T) {
  const vt0 = (k * T0) / q, is0 = 1e-3 / Math.expm1(f.v1 / (f.n * vt0));
  const is = is0 * (T / T0) ** (f.xti / f.n) * Math.exp(((f.eg * q) / (f.n * k)) * (1 / T0 - 1 / T));
  return { is, nvt: (f.n * k * T) / q };
}
// the voltage across a diode passing current i
export const voltageAt = (d, i) => d.nvt * Math.log1p(i / d.is);

// the circuit's values from the pedal's parameters (P as the page has them)
export function circuit(P) {
  const taper = (x) => (100 ** x - 1) / 99;
  const a = OPAMPS[P.opamp], T = P.temp + 273.15;
  const one = P.diodes === 'none' ? null : diode(FAMILIES[P.diodes], T);
  const counts = { one: [1, 1], two: [2, 2], asym: [1, 2] }[P.perSide];
  return {
    Rf: 100 + 100e3 * taper(P.drive), Cf: 100e-12, Rg: 1e3, Cg: P.lowCut,
    Rt: 1e3, Cd: 3.3e-9, Rft: 1.5e3 + 100e3 * P.filter, Ct: 3.3e-9,
    sr: a.sr, gbw: a.gbw, vs: a.sr / (2 * Math.PI * a.gbw), rail: P.supply / 2 - a.headroom,
    d: one, up: counts[0], down: counts[1], level: 10 ** (P.level / 20),
  };
}
// the current through the diodes at v (positive one way): `up` in series one way, `down` the other
export function diodeCurrent(C, v) {
  if (!C.d) return 0;
  const { is, nvt } = C.d;
  return is * Math.expm1(Math.min(v / (C.up * nvt), 60)) - is * Math.expm1(Math.min(-v / (C.down * nvt), 60));
}

// The response to a signal, sampled at fs: RK4 at `sub` steps a sample, the inputs linear between
// samples, the output the diode node's voltage at each sample times the Level.
export function simulate(P, input, fs, sub = 512) {
  const C = circuit(P), dt = 1 / (fs * sub);
  // the states: the op-amp's output X, the voltage across Rf ∥ Cf (X − U), Cg's, the diode node's, the Filter's
  const deriv = (vin, s) => {
    const [x, vf, g, d] = s; // vf = X − U, across Rf ∥ Cf
    const u = x - vf;
    let dx = C.sr * Math.tanh((vin - u) / C.vs);
    if ((x >= C.rail && dx > 0) || (x <= -C.rail && dx < 0)) dx = 0;
    const iRg = (u - g) / C.Rg;
    return [dx, (iRg - vf / C.Rf) / C.Cf, iRg / C.Cg, ((x - d) / C.Rt - diodeCurrent(C, d)) / C.Cd, (d - s[4]) / (C.Rft * C.Ct)];
  };
  let s = [0, 0, 0, 0, 0];
  const out = new Float64Array(input.length);
  let prev = 0;
  for (let n = 0; n < input.length; n++) {
    const next = input[n];
    for (let j = 0; j < sub; j++) {
      const t0 = j / sub, t1 = (j + 0.5) / sub, t2 = (j + 1) / sub;
      const v0 = prev + (next - prev) * t0, v1 = prev + (next - prev) * t1, v2 = prev + (next - prev) * t2;
      const k1 = deriv(v0, s);
      const k2 = deriv(v1, s.map((y, i) => y + 0.5 * dt * k1[i]));
      const k3 = deriv(v1, s.map((y, i) => y + 0.5 * dt * k2[i]));
      const k4 = deriv(v2, s.map((y, i) => y + dt * k3[i]));
      s = s.map((y, i) => y + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      s[0] = Math.max(-C.rail, Math.min(C.rail, s[0]));
    }
    prev = next;
    out[n] = s[4] * C.level;
  }
  return out;
}

// The small-signal response at f (Hz) around rest, as a complex number [re, im]: the op-amp's
// open-loop gain A = 2π GBW / s, its feedback β = Zg / (Zg + Zf), then the divider Rt into Cd and
// the diodes' conductance at 0 V, then the buffer and the divider Rft into Ct.
const cx = { add: (a, b) => [a[0] + b[0], a[1] + b[1]], mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const m = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / m, (a[1] * b[0] - a[0] * b[1]) / m]; } };
export const mag = (z) => Math.hypot(z[0], z[1]);
export function smallSignal(P, f) {
  const C = circuit(P), w = 2 * Math.PI * f, s = [0, w];
  const Zf = cx.div([C.Rf, 0], cx.add([1, 0], cx.mul(s, [C.Rf * C.Cf, 0])));
  const Zg = cx.add([C.Rg, 0], cx.div([1, 0], cx.mul(s, [C.Cg, 0])));
  const beta = cx.div(Zg, cx.add(Zg, Zf)), A = cx.div([2 * Math.PI * C.gbw, 0], s);
  const x = cx.div(A, cx.add([1, 0], cx.mul(A, beta)));
  // the diodes' conductance at 0 V: Is/(m n VT) for each stack of m
  const g0 = C.d ? C.d.is / (C.up * C.d.nvt) + C.d.is / (C.down * C.d.nvt) : 0;
  const Yd = cx.add([g0, 0], cx.mul(s, [C.Cd, 0]));
  const vd = cx.div(x, cx.add([1, 0], cx.mul([C.Rt, 0], Yd)));
  const H = cx.div(vd, cx.add([1, 0], cx.mul(s, [C.Rft * C.Ct, 0])));
  return [H[0] * C.level, H[1] * C.level];
}
