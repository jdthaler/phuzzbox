// transformer-model.cpp — the Output Transformer's core and its solver (transformer-model.h).

#include "transformer-model.h"

#include <algorithm>
#include <cmath>

#include "transformer-params.h"

namespace transformer {

namespace {
// Iron: the parameters of Jiles and Atherton (1986), as Holters and Zölzer (2016) give them in their
// Table 1, with c = 0.2 in the 1986 form; 50 % nickel–iron at 30 °C (Plucinski et al. 2025, Table 1);
// Fe–Ni permalloy (Szewczyk 2018, Table 1)
constexpr Core kCoreTable[kCores] = {
  {"Iron", 1.6e6, 1100, 1.6e-3, 400, 0.2},
  {"50 % nickel", 9.70e5, 4.040, 6e-6, 4.200, 4e-5},
  {"Permalloy", 6.14e5, 1.010, 2.988e-6, 0.588, 4e-5},
};
} // namespace

const Core &core(int k) { return kCoreTable[std::clamp(k, 0, kCores - 1)]; }

double initialSusceptibility(const Core &c) {
  const double cc = c.c / (1 + c.c), lp = c.Ms / (3 * c.a);
  return cc * lp / (1 - c.alpha * cc * lp);
}

Parts parts(const double *P) {
  Parts p{};
  p.core = &core((int)std::lround(P[material]));
  p.drive = P[drive];
  p.Rs = P[source];
  p.A = P[area];
  p.level = std::pow(10.0, P[level] / 20);
  return p;
}

double langevin(double x) {
  if (std::fabs(x) < 1e-4) return x / 3;
  return 1 / std::tanh(x) - 1 / x;
}
double langevinSlope(double x) {
  if (std::fabs(x) < 1e-3) return 1.0 / 3 - x * x / 15;
  const double s = std::sinh(x);
  return std::fabs(x) > 300 ? 1 / (x * x) : 1 / (x * x) - 1 / (s * s);
}
double anhysteretic(const Core &c, double He) { return c.Ms * langevin(He / c.a); }

namespace {
// a substep moves the effective field this share of the anhysteretic's scale at most
constexpr double kSubstep = 0.1;

// The core's state seen along the direction dir from (y, m): the anhysteretic Man and its slope lp
// in the effective field He = H + αM, w = Man − M, and the coefficients of the JA equation.
struct Local { double lp, w, r, beta, kap, D; bool irr; };
Local local(const Core &c, double y, double m, double dir) {
  const double cc = c.c / (1 + c.c), x = (y + c.alpha * m) / c.a;
  double Lx, Lpx; // L(x) and L′(x) from one exponential
  if (std::fabs(x) < 1e-3) {
    Lx = x / 3 * (1 - x * x / 15);
    Lpx = 1.0 / 3 - x * x / 15;
  } else {
    const double ax = std::fabs(x), e = std::exp(-2 * ax), q = 1 - e;
    Lx = std::copysign((1 + e) / q - 1 / ax, x);
    Lpx = 1 / (x * x) - 4 * e / (q * q);
  }
  Local L;
  L.lp = (c.Ms / c.a) * Lpx;
  L.w = c.Ms * Lx - m;
  L.r = 1 - c.alpha * cc * L.lp;
  L.beta = (1 - c.alpha * L.lp) / L.r;
  L.irr = dir * L.w >= 0;
  L.kap = std::max((1 + c.c) * (c.k - c.alpha * std::fabs(L.w)), 1e-6 * (1 + c.c) * c.k);
  L.D = ((L.irr ? dir * L.w / L.kap : 0) + cc * L.lp) / L.r; // dM/dH
  return L;
}
// One substep of length t along dir, with the anhysteretic taken as linear in He (its value and
// slope at the start): the JA equation is then linear in w and its solution exact,
//   dw/dt = dir lp (1 − cc β) − β w/κ,  dM/dH = (dir w/κ + cc lp)/r,
// cc = c/(1 + c), r = 1 − α cc lp, β = (1 − α lp)/r. Returns ΔM, and dM/dH at the end in D.
double substep(const Core &c, const Local &L, double dir, double t, double &D) {
  const double cc = c.c / (1 + c.c);
  if (!L.irr) { D = L.D; return dir * t * L.D; } // the reversible part alone
  const double lam = L.beta / L.kap, z = lam * t, drive = dir * L.lp * (1 - cc * L.beta);
  double p1, p2; // φ1 = ∫ e^(−λs) ds over [0, t] = (1 − e^(−z))/λ, and φ2 = (t − φ1)/λ
  if (std::fabs(z) < 1e-4) {
    p1 = t * (1 - z / 2 + z * z / 6);
    p2 = t * t * (0.5 - z / 6 + z * z / 24);
  } else {
    p1 = -std::expm1(-z) / lam;
    p2 = (t - p1) / lam;
  }
  const double wEnd = L.w * (1 - lam * p1) + drive * p1; // w e^(−z) + drive φ1
  D = (dir * wEnd / L.kap + cc * L.lp) / L.r;
  return ((L.w * p1 + drive * p2) / L.kap + dir * cc * L.lp * t) / L.r; // ∫ D dH
}
} // namespace

double advance(const Core &c, double H, double M, double dh, double &slope, int &substeps) {
  const double dir = dh >= 0 ? 1 : -1;
  double y = H, m = M, rem = std::fabs(dh);
  int n = 0;
  slope = local(c, H, M, dir).D;
  while (rem > 0 && n < 100000) {
    const Local L = local(c, y, m, dir);
    // a substep that moves the effective field (H and αM) no more than a tenth of the anhysteretic's
    // scale there (a near zero, growing as |He|), and, where the mean field runs away (β < 0), no
    // more than half the e-folding length: chosen from the state alone, so that M at the end is a
    // continuous function of dh, which the solver needs
    double t = kSubstep * std::max(c.a, 0.25 * std::fabs(y + c.alpha * m)) / (1 + c.alpha * std::fabs(L.D));
    if (L.irr && L.beta < 0) t = std::min(t, -0.5 * L.kap / L.beta);
    if (!L.irr) { // stop where M falls behind the anhysteretic and the irreversible part starts
      const double cc = c.c / (1 + c.c), grow = dir * L.lp * (1 - cc * L.beta);
      if (grow * dir > 0) t = std::min(t, -L.w / grow);
    }
    t = std::min(t, rem);
    m += substep(c, L, dir, t, slope);
    y += dir * t;
    rem -= t;
    n++;
  }
  substeps = n;
  return m;
}

double Transformer::step(const Parts &p, double vth, double h) {
  steps++;
  const Core &c = *p.core;
  const double K = kTurns * p.A * kMu0, rp = p.rp(), Rl = 0.5 * h * rp * kPath / kTurns;
  const double T = K * (H + M) + 0.5 * h * (vth + v);
  // F(x) = Φ/N at the field x, plus the trapezoidal rule's share of the drop across Rp, less T
  double m = M;
  auto F = [&](double x, double &dF) {
    double slope;
    int n;
    m = advance(c, H, M, x - H, slope, n);
    evaluations++;
    substeps += n;
    dF = K * (1 + std::max(0.0, slope)) + Rl;
    return K * (x + m) + Rl * x - T;
  };
  const double tol = 1e-12 * (K * (std::fabs(H) + std::fabs(M) + c.a) + std::fabs(T));
  double x = 2 * H - Hp, dF;
  double f = F(x, dF);
  double lo = -INFINITY, hi = INFINITY;
  for (int k = 0; k < 100 && std::fabs(f) > tol; k++) {
    if (f < 0) lo = x; else hi = x;
    double nx = x - f / dF;
    if (std::isfinite(lo) && std::isfinite(hi) && !(nx > lo && nx < hi)) nx = 0.5 * (lo + hi);
    if (nx == x) break;
    x = nx;
    f = F(x, dF);
  }
  Hp = H;
  H = x;
  M = m;
  v = vth - rp * kPath * H / kTurns;
  return v;
}

} // namespace transformer
