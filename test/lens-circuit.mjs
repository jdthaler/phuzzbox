// lens-circuit.mjs — the Gravitational Lens's physics worked out independently of the C++, for
// the tests: the images from the lens equation, Paczyński's magnification, the time delay,
// Takahashi and Nakamura's wave-optics amplification factor (their eq. 17, Peters's solution) by
// its series with a complex Γ and ₁F₁, the geometric-optics limit (their eq. 18), and the area of
// the lens plane arriving before τ, integrated over the angle (the C++ integrates over the radius).
//
// Units: Einstein radii in the lens plane; times in 4GM_z/c³; w = 2πf · 4GM_z/c³.

export const GM_SUN = 1.3271244e20; // m³/s², IAU 2015 B3
export const C = 299792458;
export const UNIT_SUN = (4 * GM_SUN) / C ** 3; // s

// complex numbers as [re, im]
export const cx = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
  exp: (a) => { const m = Math.exp(a[0]); return [m * Math.cos(a[1]), m * Math.sin(a[1])]; },
  log: (a) => [Math.log(Math.hypot(a[0], a[1])), Math.atan2(a[1], a[0])],
  abs: (a) => Math.hypot(a[0], a[1]),
  arg: (a) => Math.atan2(a[1], a[0]),
  conj: (a) => [a[0], -a[1]],
};

// the lens equation β = θ − 1/θ (a point mass, along the line through the source): its two
// solutions, and their magnifications 1/det of the mapping's Jacobian, 1/((1 − 1/θ²)(1 + 1/θ²))
export function images(y) {
  const s = Math.sqrt(y * y + 4), xp = (y + s) / 2, xm = (y - s) / 2;
  const mu = (x) => 1 / ((1 - 1 / (x * x)) * (1 + 1 / (x * x)));
  const T = (x) => ((x - y) ** 2) / 2 - Math.log(Math.abs(x));
  return { xp, xm, mup: mu(xp), mum: mu(xm), Tp: T(xp), Tm: T(xm) };
}
// Paczyński (1986) eq. 5: the two images' total magnification
export const paczynski = (u) => (u * u + 2) / (u * Math.sqrt(u * u + 4));
// Takahashi and Nakamura (2003), after eq. 18: the time delay in units of 4GM_z/c³
export const timeDelay = (y) => { const s = Math.sqrt(y * y + 4); return (y * s) / 2 + Math.log((s + y) / (s - y)); };

// Γ(z) for complex z by Lanczos's approximation (g = 7, nine coefficients), with the reflection
// formula below Re z = 1/2
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
export function gamma(z) {
  if (z[0] < 0.5) {
    // Γ(z) Γ(1 − z) = π / sin(πz)
    const s = cx.sub(cx.exp([-Math.PI * z[1], Math.PI * z[0]]), cx.exp([Math.PI * z[1], -Math.PI * z[0]]));
    const sinpz = cx.div(s, [0, 2]);
    return cx.div([Math.PI, 0], cx.mul(sinpz, gamma(cx.sub([1, 0], z))));
  }
  const zz = cx.sub(z, [1, 0]);
  let x = [LANCZOS[0], 0];
  for (let i = 1; i < 9; i++) x = cx.add(x, cx.div([LANCZOS[i], 0], cx.add(zz, [i, 0])));
  const t = cx.add(zz, [7.5, 0]);
  // √(2π) t^(z − 1/2) e^(−t) x
  const lnPart = cx.sub(cx.mul(cx.add(zz, [0.5, 0]), cx.log(t)), t);
  return cx.mul(cx.mul([Math.sqrt(2 * Math.PI), 0], cx.exp(lnPart)), x);
}
// ₁F₁(a; 1; z) by its series Σ (a)ₙ zⁿ / (n!)², summed until the terms are negligible
export function hyp1f1(a, z) {
  let term = [1, 0], sum = [1, 0];
  for (let n = 0; n < 2000; n++) {
    term = cx.div(cx.mul(cx.mul(term, cx.add(a, [n, 0])), z), [(n + 1) * (n + 1), 0]);
    sum = cx.add(sum, term);
    if (cx.abs(term) < 1e-17 * cx.abs(sum) && n > 5) break;
  }
  return sum;
}
// Takahashi and Nakamura (2003) eq. 17: F(w, y) = exp[πw/4 + i(w/2)(ln(w/2) − 2φm)] Γ(1 − iw/2)
// ₁F₁(iw/2, 1; iwy²/2), φm = (xm − y)²/2 − ln xm with xm = (y + √(y² + 4))/2: the wave's amplitude
// relative to no lens, with the first image's arrival at t = 0 (their sign: e^{+iwt})
export function amplification(w, y) {
  const xm = (y + Math.sqrt(y * y + 4)) / 2, phim = ((xm - y) ** 2) / 2 - Math.log(xm);
  const pre = cx.exp([(Math.PI * w) / 4, (w / 2) * (Math.log(w / 2) - 2 * phim)]);
  return cx.mul(cx.mul(pre, gamma([1, -w / 2])), hyp1f1([0, w / 2], [0, (w * y * y) / 2]));
}
// Their eq. 18, geometric optics: F = |μ₊|^½ − i|μ₋|^½ e^{iwΔT}
export function geometric(w, y) {
  const im = images(y), dT = timeDelay(y);
  return cx.sub([Math.sqrt(Math.abs(im.mup)), 0], cx.mul([0, Math.sqrt(Math.abs(im.mum))], cx.exp([0, w * dT])));
}

// Gauss–Legendre nodes and weights on [−1, 1]
function legendre(n) {
  const x = [], wts = [];
  for (let i = 0; i < n; i++) {
    let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5)), dp = 1;
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = z;
      for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
      dp = (n * (z * p1 - p0)) / (z * z - 1);
      const dz = p1 / dp;
      z -= dz;
      if (Math.abs(dz) < 1e-16) break;
    }
    x.push(z); wts.push(2 / ((1 - z * z) * dp * dp));
  }
  return { x, w: wts };
}
const GL = legendre(96);
// ∫ f from a to b by Gauss–Legendre after θ = a + (b − a)(1 − cos φ)/2, smoothing square-root ends
function integrate(f, a, b) {
  let s = 0;
  for (let i = 0; i < GL.x.length; i++) {
    const phi = (Math.PI / 2) * (GL.x[i] + 1);
    s += GL.w[i] * f(a + ((b - a) * (1 - Math.cos(phi))) / 2) * Math.sin(phi);
  }
  return s * (Math.PI / 2) * ((b - a) / 2);
}
// the root of a decreasing-then-increasing function's branch between a and b, by bisection
function bisect(f, a, b) {
  let fa = f(a);
  for (let i = 0; i < 200; i++) {
    const m = (a + b) / 2, fm = f(m);
    if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m;
  }
  return (a + b) / 2;
}
// The area of the lens plane arriving before τ, over the angle: at each θ, T(r, θ) is convex in
// r, below τ between two radii, so the area is ∫ (r₂² − r₁²) dθ over [0, π] (both halves).
export function area(tau, y) {
  const T = (r, c) => (r * r + y * y) / 2 - r * y * c - Math.log(r);
  const rmin = (c) => (y * c + Math.sqrt(y * y * c * c + 4)) / 2; // where T is least along θ
  const width = (th) => {
    const c = Math.cos(th), r0 = rmin(c);
    if (T(r0, c) >= tau) return 0;
    const g = (r) => T(r, c) - tau;
    const r1 = bisect(g, Math.exp(-tau - y * y - 5), r0), r2 = bisect(g, r0, r0 + 4 + 2 * Math.sqrt(2 * Math.abs(tau) + 1));
    return r2 * r2 - r1 * r1;
  };
  const im = images(y);
  if (tau <= im.Tp) return 0;
  if (tau >= im.Tm) return integrate(width, 0, Math.PI);
  // below T₋ only angles up to θ₀ arrive, where the least T along θ reaches τ
  const th0 = bisect((th) => T(rmin(Math.cos(th)), Math.cos(th)) - tau, 0, Math.PI);
  return integrate(width, 0, th0);
}
