// tunnel-model.cpp — the Tunnel Diode's diode and circuit (tunnel-model.h).

#include "tunnel-model.h"

#include <cmath>
#include <limits>

#include "tunnel-params.h"

namespace tunnel {

namespace {
constexpr double kK = 1.380649e-23, kQ = 1.602176634e-19, kT = 298.15;
constexpr double kVT = kK * kT / kQ; // kT/q at 25 °C (V)
constexpr double kMaxStep = 0.005;   // the march's longest stride (V): shorter than any gap between two states
constexpr double kTol = 1e-9;        // the diode's voltage is solved to a nanovolt

Diode fit() {
  // GE's typical 1 mA germanium diode: the peak, valley and forward points
  Diode d{};
  d.Ip = 1e-3; d.Vp = 0.055; d.Iv = 0.1e-3; d.Vv = 0.35; d.Vfp = 0.5;
  auto tun = [&](double V) { return d.Ip * (V / d.Vp) * std::exp(1 - V / d.Vp); };
  auto dtun = [&](double V) { return (d.Ip / d.Vp) * (1 - V / d.Vp) * std::exp(1 - V / d.Vp); };
  // the excess current makes the valley: I(Vv) = Iv and I'(Vv) = 0; diffusion makes I(Vfp) = Ip
  d.I0 = d.Ip / std::expm1(d.Vfp / kVT);
  for (int k = 0; k < 60; k++) {
    const double dif = d.I0 * std::expm1(d.Vv / kVT), ddif = d.I0 / kVT * std::exp(d.Vv / kVT);
    d.Jx = d.Iv - tun(d.Vv) - dif;
    d.C4 = -(dtun(d.Vv) + ddif) / d.Jx;
    d.I0 = (d.Ip - tun(d.Vfp) - d.Jx * std::exp(d.C4 * (d.Vfp - d.Vv))) / std::expm1(d.Vfp / kVT);
  }
  // the steepest negative slope, by golden section between the peak and the valley
  double a = d.Vp, b = d.Vv;
  const double r = 0.5 * (std::sqrt(5.0) - 1);
  for (int k = 0; k < 80; k++) {
    const double c = b - r * (b - a), e = a + r * (b - a);
    if (d.slope(c) < d.slope(e)) b = e; else a = c;
  }
  d.Vm = 0.5 * (a + b);
  d.gmin = d.slope(d.Vm);
  return d;
}
} // namespace

double Diode::current(double V) const {
  return Ip * (V / Vp) * std::exp(1 - V / Vp) + Jx * std::exp(C4 * (V - Vv)) + I0 * std::expm1(V / kVT);
}
double Diode::slope(double V) const {
  return (Ip / Vp) * (1 - V / Vp) * std::exp(1 - V / Vp) + Jx * C4 * std::exp(C4 * (V - Vv)) + I0 / kVT * std::exp(V / kVT);
}

double Diode::both(double V, double &dI) const {
  const double et = std::exp(1 - V / Vp), ex = Jx * std::exp(C4 * (V - Vv)), ed = std::exp(V / kVT);
  dI = (Ip / Vp) * (1 - V / Vp) * et + C4 * ex + I0 / kVT * ed;
  return Ip * (V / Vp) * et + ex + I0 * (ed - 1);
}

const Diode &diode() {
  static const Diode d = fit();
  return d;
}

Parts parts(const double *P) {
  Parts p{};
  p.osc = std::lround(P[circuit]) == 1;
  p.drive = P[drive];
  p.bias = P[bias];
  p.R = P[load];
  p.L = P[inductor];
  p.level = std::pow(10.0, P[level] / 20);
  return p;
}

void Circuit::start(const Parts &p, double vs, double step) {
  h = step;
  double lo, hi;
  if (p.osc) { V = 0; i = 0; return; }
  states(p.R, vs, lo, hi);
  V = std::isnan(lo) ? hi : lo;
  i = diode().current(V);
}

double Circuit::step(const Parts &p, double vs) {
  const Diode &d = diode();
  steps++;
  // the current through the load as the diode's voltage v makes it: (base − v)·gl
  const double Lh = p.osc ? p.L / h : 0, gl = 1 / (Lh + p.R), base = Lh * i + vs, Ch = kC / h, V0 = V;
  // g(v) = the current the load brings less the diode's and the capacitor's; its slope in dg
  auto g = [&](double v, double &dg) {
    evaluations++;
    double dI;
    const double I = d.both(v, dI);
    dg = -gl - dI - Ch;
    return (base - v) * gl - I - Ch * (v - V0);
  };
  double dg0;
  const double g0 = g(V0, dg0);
  if (g0 == 0) { i = (base - V0) * gl; return V; }
  const bool up = g0 > 0;
  // march the way V moves until g changes sign: the first stride Newton's (on a stable branch),
  // then doubling, never longer than kMaxStep
  double s = dg0 < 0 ? std::fmin(kMaxStep, std::fabs(g0 / dg0) * (1 + 1e-6) + 1e-15) : kMaxStep;
  double a = V0, ga = g0, da = dg0, b = V0, gb = g0, db = dg0;
  for (int k = 0; k < 4000; k++) {
    b = up ? a + s : a - s;
    gb = g(b, db);
    if ((gb > 0) != up || gb == 0) break;
    if (db < 0 && std::fabs(gb) < kTol * -db) { V = b; i = (base - b) * gl; return V; } // Newton's next step would be under kTol
    a = b; ga = gb; da = db;
    // on a stable branch, Newton's stride again (it approaches a root from one side); else double
    s = db < 0 ? std::fmin(2 * s, std::fabs(gb / db) * (1 + 1e-6) + 1e-15) : std::fmin(2 * s, kMaxStep);
  }
  // the root lies between a (g on V's side) and b: Newton from whichever is nearer, kept inside
  const bool fromA = std::fabs(ga) < std::fabs(gb) && da < 0;
  double v = fromA ? a : b, gv = fromA ? ga : gb, dv = fromA ? da : db;
  double lo = std::fmin(a, b), hi = std::fmax(a, b);
  for (int k = 0; k < 60 && gv != 0; k++) {
    double nv = v - gv / dv;
    if (!(nv > lo && nv < hi)) nv = 0.5 * (lo + hi);
    const double step = std::fabs(nv - v);
    v = nv;
    if (step < kTol || hi - lo < kTol) break;
    gv = g(v, dv);
    if ((gv > 0) == up) { if (up) lo = v; else hi = v; } else { if (up) hi = v; else lo = v; }
  }
  V = v;
  i = (base - v) * gl;
  return V;
}

void thresholds(double R, double &up, double &down) {
  const Diode &d = diode();
  up = down = -1;
  if (1 + R * d.gmin >= 0) return; // the load line is never as steep as the curve: no memory
  // where I'(V) = −1/R: one root between the peak and Vm, one between Vm and the valley
  auto root = [&](double a, double b) {
    const double fa = 1 + R * d.slope(a);
    for (int k = 0; k < 100; k++) {
      const double m = 0.5 * (a + b), fm = 1 + R * d.slope(m);
      if ((fm > 0) == (fa > 0)) a = m; else b = m;
    }
    return 0.5 * (a + b);
  };
  const double va = root(d.Vp * 0.5, d.Vm), vb = root(d.Vv * 1.2, d.Vm);
  up = va + R * d.current(va);
  down = vb + R * d.current(vb);
}

void states(double R, double vs, double &lo, double &hi) {
  const Diode &d = diode();
  constexpr double nan = std::numeric_limits<double>::quiet_NaN();
  // f(v) = vs − v − R I(v), decreasing on each stable branch
  auto f = [&](double v) { return vs - v - R * d.current(v); };
  auto bisect = [&](double a, double b) {
    for (int k = 0; k < 200; k++) {
      const double m = 0.5 * (a + b);
      if (f(m) > 0) a = m; else b = m;
    }
    return 0.5 * (a + b);
  };
  double up, down;
  thresholds(R, up, down);
  if (up < 0) { lo = hi = bisect(-1, 1); return; }
  // the branches end where the load line is tangent to the curve
  auto tangent = [&](double a, double b) {
    const double fa = 1 + R * d.slope(a);
    for (int k = 0; k < 100; k++) {
      const double m = 0.5 * (a + b), fm = 1 + R * d.slope(m);
      if ((fm > 0) == (fa > 0)) a = m; else b = m;
    }
    return 0.5 * (a + b);
  };
  const double va = tangent(d.Vp * 0.5, d.Vm), vb = tangent(d.Vv * 1.2, d.Vm);
  lo = vs <= up ? bisect(-1, va) : nan;
  hi = vs >= down ? bisect(vb, 1) : nan;
}

} // namespace tunnel
