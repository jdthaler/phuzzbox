// cabinet-circuit.mjs — the Speaker Cabinet's physics written here, independently of the C++: the
// driver's Thiele–Small parameters turned into masses, springs and a motor; the cabinet as a linear
// system of four equations (coil, cone, box air, port air) solved by complex Gaussian elimination;
// and Small's closed forms for sealed and vented boxes, which hold where the coil's inductance and
// the amp's impedance are left out.

export const RHO = 1.204, C = 343, RC2 = RHO * C * C, QL = 7, END = 1.463;
const LAYOUT = { '1x15': [1, 1], '2x10': [2, 1], '4x10': [4, 2], '8x10': [8, 2] }; // drivers, in series

export function derive(P) {
  const [n, s] = LAYOUT[P.layout], par = n / s, w = 2 * Math.PI * P.fs;
  const cms = P.vas / (RC2 * P.sd ** 2), mms = 1 / (w * w * cms);
  const d = {
    n, s, par, cms, mms, kms: 1 / cms, bl: Math.sqrt((w * mms * P.re) / P.qes), rms: (w * mms) / P.qms,
    re: P.re, le: P.le, sd: P.sd, rg: (P.ampR * par) / s, e: 10 ** (P.drive / 20) / s,
    vb: P.volume / n, cab: P.volume / n / RC2, ported: P.box === 'ported', mic: P.mic,
  };
  if (d.ported) {
    const a = P.portD / 2, area = Math.round(P.ports) * Math.PI * a * a, leff = P.portL + END * a;
    d.sp = area / n; d.mp = RHO * d.sp * leff;
    d.fb = (C / (2 * Math.PI)) * Math.sqrt(area / (P.volume * leff));
    d.ra = QL / (2 * Math.PI * d.fb * d.cab);
  } else { d.sp = 0; d.mp = 1; d.fb = 0; d.ra = Infinity; }
  return d;
}

// complex numbers as [re, im]
const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a, b) => { const q = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / q, (a[1] * b[0] - a[0] * b[1]) / q]; };
export const mag = (a) => Math.hypot(a[0], a[1]);
const R = (x) => [x, 0];

function solve(A, b) {
  const n = b.length;
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (mag(A[i][k]) > mag(A[p][k])) p = i;
    [A[k], A[p]] = [A[p], A[k]]; [b[k], b[p]] = [b[p], b[k]];
    for (let i = k + 1; i < n; i++) {
      const m = div(A[i][k], A[k][k]);
      for (let j = k; j < n; j++) A[i][j] = sub(A[i][j], mul(m, A[k][j]));
      b[i] = sub(b[i], mul(m, b[k]));
    }
  }
  const x = new Array(n);
  for (let k = n - 1; k >= 0; k--) { let s = b[k]; for (let j = k + 1; j < n; j++) s = sub(s, mul(A[k][j], x[j])); x[k] = div(s, A[k][k]); }
  return x;
}

// One driver and its share of the box at f, driven by `volts` across it (from the amp, before Rg):
// unknowns [i, u, p, up]; returns them, the microphone's volts, the cabinet's impedance, excursion
export function smallSignal(d, f, volts = d.e) {
  const s = [0, 2 * Math.PI * f], z = R(0);
  const ze = add(R(d.rg + d.re), mul(s, R(d.le)));
  const zm = add(add(mul(s, R(d.mms)), R(d.rms)), div(R(d.kms), s));
  const A = [
    [ze, R(d.bl), z, z],                                          // e = Ze i + Bl u
    [R(-d.bl), zm, R(-d.sd), z],                                  // 0 = −Bl i + Zm u − Sd p
    [z, R(d.sd), add(mul(s, R(d.cab)), R(1 / d.ra)), R(d.sp)],    // 0 = Sd u + Sp up + (s Cab + 1/Ra) p
    [z, z, R(-d.sp), mul(s, R(d.mp))],                            // 0 = −Sp p + s Mp up
  ];
  const [i, u, p, up] = solve(A, [R(volts), z, z, z]);
  const q = add(mul(R(d.sd), u), mul(R(d.sp), up));               // the volume velocity out
  const pressure = mul(R((d.n * RHO) / (2 * Math.PI)), mul(s, q));
  const zin = sub(div(R(volts), i), R(d.rg));
  return { i, u, p, up, h: mul(R(d.mic), pressure), z: mul(zin, R((d.s * d.s) / d.n)), x: div(u, s), pressure };
}

// Small's closed box: the system's resonance and Q with the box's air as an extra spring
export function closedBox(P) { const a = P.vas / P.volume * ({ '1x15': 1, '2x10': 2, '4x10': 4, '8x10': 8 })[P.layout], qts = (P.qes * P.qms) / (P.qes + P.qms); return { fc: P.fs * Math.sqrt(1 + a), qtc: qts * Math.sqrt(1 + a), alpha: a, qts }; }
// its response with Le = 0 and Rg = 0, normalised to the passband: s²/(s² + s ωc/Qtc + ωc²)
export function closedBoxShape(cb, f) { const x = f / cb.fc; return x * x / Math.sqrt((1 - x * x) ** 2 + (x / cb.qtc) ** 2); }
// Small's reference efficiency into half space, and the sound pressure level at 1 W, 1 m
export function efficiency(P) { const eta = ((4 * Math.PI ** 2) / C ** 3) * (P.fs ** 3 * P.vas) / P.qes; return { eta, spl: 112.1 + 10 * Math.log10(eta) }; }
