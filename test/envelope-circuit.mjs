// envelope-circuit.mjs — the Envelope Filter's physics written here, independently of the C++: the
// follower's equation and the photocells' rate equations integrated by RK4, the cells' steady
// state in closed form, and the state-variable filter's analog response and its bilinear image.

export const R_LED = 220, I_MAX = 20e-3, I_REF = 1e-3, I_DOWN = 5e-3, R_FLOOR = 33e3, R_MIN = 1e3, DARK_R = 2e6;
export const N1 = 1, TRAPS = 2, CAPTURE = 1;

export const ledLight = (P, v) => { const i = v / R_LED; const led = Math.min(I_MAX, Math.max(0, P.direction === 'down' ? I_DOWN - i : i)); return led / I_REF; };
export const steadyN = (L) => (N1 / 2) * (Math.sqrt(1 + (4 * L) / N1) - 1);
export const cellR = (P, n) => 1 / (1 / DARK_R + n / P.litR);
export const filterR = (P, n) => { const r = cellR(P, n); return (r * R_FLOOR) / (r + R_FLOOR) + R_MIN; };
export const cutoff = (P, n) => 1 / (2 * Math.PI * filterR(P, n) * P.rangeC);
// the cutoff the cells settle to under a steady follower voltage v
export const steadyCutoff = (P, v) => cutoff(P, steadyN(ledLight(P, v)));

// The whole control path for an input (volts, at fs): the follower (C dv/dt = (|G·in| − v)/Ra·[…]
// − v/Rd) and the cells, integrated together by RK4, `sub` steps a sample with the input held.
// Returns the cutoff after each sample, and the cells' n and m.
export function controlPath(P, input, fs, sub = 16) {
  const G = 10 ** (P.sens / 20), h = 1 / fs / sub;
  let v = 0, n = steadyN(ledLight(P, 0)), m;
  { const cap = CAPTURE * n; m = (cap * TRAPS) / (cap + 1 / P.trapTime); }
  const fc = new Float64Array(input.length), ns = new Float64Array(input.length), ms = new Float64Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const r = Math.abs(G * input[i]);
    const f = ([v, n, m]) => {
      const dv = (r > v ? (r - v) / P.attack : 0) - v / P.decay, L = ledLight(P, v);
      const cap = CAPTURE * n * (TRAPS - m), rel = m / P.trapTime;
      return [dv, L / P.lifetime - (n / P.lifetime) * (1 + n / N1) - cap + rel, cap - rel];
    };
    let y = [v, n, m];
    for (let k = 0; k < sub; k++) {
      const k1 = f(y), k2 = f(y.map((q, j) => q + (h / 2) * k1[j])), k3 = f(y.map((q, j) => q + (h / 2) * k2[j])), k4 = f(y.map((q, j) => q + h * k3[j]));
      y = y.map((q, j) => q + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    }
    [v, n, m] = y;
    fc[i] = cutoff(P, n); ns[i] = n; ms[i] = m;
  }
  return { fc, n: ns, m: ms };
}

// the state-variable filter's analog response at f (Hz) for a cutoff fc: [re, im]
export function svf(mode, Q, fc, f) {
  const s = [0, f / fc]; // s/ω
  const d = [1 - s[1] * s[1], s[1] / Q]; // s² + s/Q + 1
  const num = mode === 'lp' ? [1, 0] : mode === 'bp' ? s : [-s[1] * s[1], 0];
  const q = d[0] * d[0] + d[1] * d[1];
  return [(num[0] * d[0] + num[1] * d[1]) / q, (num[1] * d[0] - num[0] * d[1]) / q];
}
// its image under the bilinear transform (the trapezoidal rule) at a sample rate fs: the analog
// response at the frequency the transform maps f to, (fs/π)·tan(πf/fs)
export const svfBilinear = (mode, Q, fc, f, fs) => svf(mode, Q, fc, (fs / Math.PI) * Math.tan((Math.PI * f) / fs));
export const mag = ([a, b]) => Math.hypot(a, b);
