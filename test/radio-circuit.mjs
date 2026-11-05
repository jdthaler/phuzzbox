// radio-circuit.mjs — the Crystal Radio worked out independently of the C++, for the tests: the
// diode's current averaged over the carrier's cycle by summing it round the cycle (no Bessel
// function), the detector's steady voltage by bisection, and the whole set simulated at radio
// frequency, cycle by cycle of the carrier: the modulated carrier and the next station's through
// the tuned circuit's own second-order equation, into the diode and the earphone's R and C, with
// no envelope taken anywhere.

const K = 1.380649e-23, Q = 1.602176634e-19, T = 298.15;
// the Bandgap's families: the voltage at 1 mA and the ideality factor
export const FAMILIES = { ge: [0.28, 1.6], schottky: [0.32, 1.05], si: [0.58, 1.75] };
export function diode(kind) {
  const [v1, n] = FAMILIES[kind], nvt = (n * K * T) / Q;
  return { nvt, is: 1e-3 / Math.expm1(v1 / nvt) };
}

// ⟨Is(e^{(A cos θ − V)/nVT} − 1)⟩ over θ, by the trapezoidal rule round the cycle (exact to
// rounding for a smooth periodic integrand once there are enough points)
export function meanCurrent(d, A, V, N = 512) {
  let s = 0;
  for (let j = 0; j < N; j++) s += Math.expm1((A * Math.cos((2 * Math.PI * j) / N) - V) / d.nvt);
  return (d.is * s) / N;
}
// the steady voltage on a steady carrier: ⟨i⟩ = V/R, by bisection
export function settle(d, R, A) {
  let lo = -d.is * R, hi = A;
  for (let k = 0; k < 200; k++) {
    const m = (lo + hi) / 2;
    if (m / R - meanCurrent(d, A, m) > 0) hi = m; else lo = m;
  }
  return (lo + hi) / 2;
}
// the textbook limits: square law, V = (a²/4) Is R / (1 + Is R/nVT); and a peak detector, V = A −
// nVT ln(√(2πa)(1 + V/(Is R))), a = A/nVT (solved by iterating)
export const squareLaw = (d, R, A) => ((A / d.nvt) ** 2 / 4) * d.is * R / (1 + (d.is * R) / d.nvt);
export function peakLaw(d, R, A) {
  let V = A;
  for (let k = 0; k < 50; k++) V = A - d.nvt * Math.log(Math.sqrt((2 * Math.PI * A) / d.nvt) * (1 + V / (d.is * R)));
  return V;
}

// The whole set at radio frequency. o: { station (Hz), tune (Hz), q, Ac, k, B (V), R, C, kind,
// tone: [f (Hz), amp (V)] or none, perCycle: steps a carrier cycle, settle, span (s) }. Returns the
// earphone's voltage over the span, sampled every `every` steps, and that sampling rate.
export function simulate(o) {
  const d = diode(o.kind);
  const fc = o.station, f0 = fc + o.tune, w0 = 2 * Math.PI * f0, wc = 2 * Math.PI * fc, wn = 2 * Math.PI * (fc + 10e3);
  const h = 1 / (fc * o.perCycle), steps = Math.round((o.settle + o.span) / h), first = Math.round(o.settle / h);
  // the tuned circuit, H(s) = (w0/Q) s / (s² + (w0/Q) s + w0²), by the bilinear transform with its
  // centre prewarped onto w0: x'' + (w0/Q) x' + w0² x = (w0/Q) u'
  const c = w0 / Math.tan((w0 * h) / 2), bw = w0 / o.q;
  const a0 = c * c + bw * c + w0 * w0;
  const b0 = (bw * c) / a0, b2 = -b0, a1 = (2 * w0 * w0 - 2 * c * c) / a0, a2 = (c * c - bw * c + w0 * w0) / a0;
  let u1 = 0, u2 = 0, x1 = 0, x2 = 0;
  // the detector: C dV/dt = Is(e^{(x − V)/nVT} − 1) − V/R by the trapezoidal rule, Newton at each step
  const id = (x, V) => d.is * Math.expm1((x - V) / d.nvt);
  let V = 0, iPrev = 0;
  const out = [], every = o.every ?? 1;
  const env = (t) => o.Ac * Math.max(0, 1 + (o.tone ? o.k * o.tone[1] * Math.sin(2 * Math.PI * o.tone[0] * t) : 0));
  for (let n = 0; n < steps; n++) {
    const t = (n + 1) * h;
    const u = env(t) * Math.cos(wc * t) + o.B * Math.cos(wn * t);
    const x = b0 * u + b2 * u2 - a1 * x1 - a2 * x2;
    u2 = u1; u1 = u; x2 = x1; x1 = x;
    // C (V' − V)/h = ½(i' + i) − (V' + V)/(2R)
    const g0 = (2 * o.C) / h + 1 / o.R, rhs = ((2 * o.C) / h - 1 / o.R) * V + iPrev;
    let v = V;
    for (let k = 0; k < 60; k++) {
      const i = id(x, v), f = g0 * v - i - rhs, df = g0 + (i + d.is) / d.nvt;
      let dv = -f / df;
      if (dv > 4 * d.nvt) dv = 4 * d.nvt; // the exponential's overshoot limited, as SPICE does
      v += dv;
      if (Math.abs(dv) < 1e-13 + 1e-11 * Math.abs(v)) break;
    }
    V = v; iPrev = id(x, V);
    if (n >= first && (n - first) % every === 0) out.push(V);
  }
  return { V: out, rate: 1 / (h * every) };
}

// the amplitude of the component at f in x (sampled at rate), over whole periods
export function component(x, rate, f) {
  const per = rate / f, n = Math.floor(Math.floor(x.length / per) * per);
  let re = 0, im = 0;
  for (let j = 0; j < n; j++) { const a = (2 * Math.PI * f * j) / rate; re += x[j] * Math.cos(a); im += x[j] * Math.sin(a); }
  return (2 * Math.hypot(re, im)) / n;
}
