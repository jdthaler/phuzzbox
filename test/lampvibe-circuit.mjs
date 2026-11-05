// lampvibe-circuit.mjs — the Lamp Vibe's physics worked out here independently of the C++: the
// filament's power balance solved by Newton's method and its time constant from the slope of
// that balance; tungsten's emissivity also from Davisson and Weeks's older free-electron series;
// the light the cells see integrated over frequency rather than wavelength; the cells' steady
// state from the quadratic; the stages' phase as arctangents, and the chorus's notches where it
// reaches −180° and −540°.

// tungsten's resistivity (µΩ·cm) from 300 K to 3600 K in steps of 100 K (Forsythe and Watson's,
// as the CRC Handbook tabulates them)
export const RHO = [
  5.65, 8.06, 10.56, 13.23, 16.09, 19.00, 21.94, 24.93, 27.94, 30.98, 34.08, 37.19, 40.36, 43.55,
  46.78, 50.05, 53.35, 56.67, 60.06, 63.48, 66.91, 70.39, 73.91, 77.49, 81.04, 84.70, 88.33, 92.04,
  95.76, 99.54, 103.3, 107.2, 111.1, 115.0,
];
export function rho(T) { // Ω·m
  const x = Math.min(Math.max((T - 300) / 100, 0), RHO.length - 1), i = Math.min(Math.floor(x), RHO.length - 2);
  return 1e-8 * (RHO[i] + (RHO[i + 1] - RHO[i]) * (x - i));
}
// total hemispherical emissivity of a metal from ρT (ρ in Ω·cm): Parker and Abbott (1965), and
// Davisson and Weeks (1924), good to 1 % for ρT under 0.1 Ω·cm·K
export const parkerAbbott = (T) => { const x = 100 * rho(T) * T; return 0.766 * Math.sqrt(x) - (0.309 - 0.0889 * Math.log(x)) * x - 0.0175 * x ** 1.5; };
export const davissonWeeks = (T) => { const x = 100 * rho(T) * T; return 0.754 * Math.sqrt(x) - 0.632 * x + 0.670 * x ** 1.5 - 0.607 * x * x; };

export const SIGMA = 5.670374419e-8, ROOM = 300, DENSITY = 19300, HEAT = 150;
export const LAMPS = { grain: { V: 12, I: 0.05, T: 2500 }, pilot: { V: 6.3, I: 0.15, T: 2500 }, panel: { V: 12, I: 5 / 12, T: 2500 } };

// the filament a lamp's rating implies: at V it draws I at T, so R = V/I = ρ(T) L/(π d²/4) and
// V I = ε σ A (T⁴ − T₀⁴) with A = π d L
export function filament(lamp) {
  const P = lamp.V * lamp.I, R = lamp.V / lamp.I;
  const A = P / (parkerAbbott(lamp.T) * SIGMA * (lamp.T ** 4 - ROOM ** 4));
  const geom = R / rho(lamp.T); // L/(π d²/4)
  const d = Math.cbrt((4 * A) / (Math.PI * Math.PI * geom)), L = A / (Math.PI * d);
  return { A, geom, d, L, C: DENSITY * HEAT * ((Math.PI * d * d) / 4) * L };
}
// the power in, less the power radiated (W)
export const net = (f, v, T) => (v * v) / (rho(T) * f.geom) - parkerAbbott(T) * SIGMA * f.A * (T ** 4 - ROOM ** 4);
// where the filament settles with v across it (Newton's method, from above)
export function settle(f, v) {
  if (v <= 0) return ROOM;
  let T = 3500;
  for (let i = 0; i < 100; i++) {
    const h = 0.01, s = (net(f, v, T + h) - net(f, v, T - h)) / (2 * h), step = net(f, v, T) / s;
    T = Math.max(ROOM + 1, T - step);
    if (Math.abs(step) < 1e-9) break;
  }
  return T;
}
// how quickly it settles near there: τ = C / −(d net / dT)
export function timeConstant(f, v) {
  const T = settle(f, v), h = 0.01;
  return f.C / -((net(f, v, T + h) - net(f, v, T - h)) / (2 * h));
}

// the photons a cadmium-sulphide cell (a Gaussian bell around 540 nm, 160 nm across at half
// height) catches from a black body at T, integrated over frequency: n(ν) ∝ ν² / (e^{hν/kT} − 1)
const H = 6.62607015e-34, C = 299792458, K = 1.380649e-23;
export const PEAK = 540e-9, FWHM = 160e-9;
export function photons(T) {
  const sd = FWHM / (2 * Math.sqrt(2 * Math.LN2)), lo = C / (PEAK + 7 * sd), hi = C / (PEAK - 7 * sd), n = 20000;
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const nu = lo + ((hi - lo) * i) / n, l = C / nu, S = Math.exp(-0.5 * ((l - PEAK) / sd) ** 2);
    s += (i === 0 || i === n ? 0.5 : 1) * S * nu * nu / Math.expm1((H * nu) / (K * T));
  }
  return s;
}
export const glow = (T, Tref) => photons(T) / photons(Tref);

// the cells: the free electrons a steady light keeps (n(1 + n) = Λ), and the resistance
export const RLIT = 3e3, RDARK = 10e6;
export const cellN = (light) => (-1 + Math.sqrt(1 + 4 * light)) / 2;
export const cellR = (n) => 1 / (1 / RDARK + n / RLIT);

// the stages
export const CAPS = [470e-9, 100e-9, 22e-9, 4.7e-9];
export const phase = (R, f) => CAPS.reduce((a, c) => a - 2 * Math.atan(2 * Math.PI * f * R * c), 0);
// chorus: (1 + e^{iφ})/2, whose size is |cos(φ/2)|
export const chorusGain = (R, f) => Math.abs(Math.cos(phase(R, f) / 2));
// the same by the bilinear transform at fs, each stage prewarped to its corner 1/(2πRC): its phase
// at f is the analog stage's at fc tan(πf/fs) / tan(πfc/fs)
export const phaseAt = (R, f, fs) => CAPS.reduce((a, c) => { const fc = 1 / (2 * Math.PI * R * c); return a - 2 * Math.atan(Math.tan((Math.PI * f) / fs) / Math.tan((Math.PI * Math.min(fc, 0.49 * fs)) / fs)); }, 0);
export const chorusGainAt = (R, f, fs) => Math.abs(Math.cos(phaseAt(R, f, fs) / 2));
// the notches: where the phase passes −π and −3π (bisection in log frequency)
export function notches(R) {
  return [-Math.PI, -3 * Math.PI].map((target) => {
    let lo = Math.log(0.01), hi = Math.log(1e6);
    for (let i = 0; i < 200; i++) { const m = 0.5 * (lo + hi); (phase(R, Math.exp(m)) > target ? (lo = m) : (hi = m)); }
    return Math.exp(0.5 * (lo + hi));
  });
}
