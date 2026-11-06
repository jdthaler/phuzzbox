// neon-model.cpp — the Neon Tremolo's lamp, oscillator and cell (neon-model.h).

#include "neon-model.h"

#include <cmath>
#include <limits>

#include "neon-params.h"

namespace neon {

namespace {
constexpr double kE = 2.718281828459045;
// Wang, Venkattraman, Loveless, Buerke and Garner, J. Appl. Phys. 132, 073302 (2022), Table I
const Gas kTable[kGases] = {
  {"Neon", 4, 100},
  {"Helium", 3, 34},
  {"Argon", 12, 180},
};
} // namespace

const Gas &gasOf(int k) { return kTable[k < 0 ? 0 : k >= kGases ? kGases - 1 : k]; }

double breakdown(const Gas &g, double pd, double gamma) {
  const double x = std::log(g.A * pd / std::log(1 + 1 / gamma));
  return x > 0 ? g.B * pd / x : std::numeric_limits<double>::infinity();
}
double minimumV(const Gas &g, double gamma) { return kE * g.B / g.A * std::log(1 + 1 / gamma); }
double minimumPd(const Gas &g, double gamma) { return kE * std::log(1 + 1 / gamma) / g.A; }
double cathodeFall(const Gas &g, double gamma) { return 3 * g.B / g.A * std::log(1 + 1 / gamma); }

Parts parts(const double *P) {
  Parts p{};
  p.gas = &gasOf((int)std::lround(P[neon::gas]));
  p.pd = P[pd];
  p.gamma = P[neon::gamma];
  p.Vs = P[supply];
  p.R = P[rate];
  p.C = P[cap];
  p.Vb = breakdown(*p.gas, p.pd, p.gamma);
  p.Vm = cathodeFall(*p.gas, p.gamma);
  p.Ve = p.Vm + kBallast * kHold;
  p.tau = P[cell];
  const double d = P[depth] < 0 ? 0 : P[depth] > 1 ? 1 : P[depth];
  p.Rd = kPot * (1 - d) * (1 - d);
  p.gain = std::pow(10.0, P[level] / 20);
  return p;
}

double litTarget(const Parts &p) { return (p.Vs * kBallast + p.Vm * p.R) / (p.R + kBallast); }
double litTau(const Parts &p) { return p.C * p.R * kBallast / (p.R + kBallast); }
bool glowsSteadily(const Parts &p) { return (p.Vs - p.Vm) / (p.R + kBallast) >= kHold; }

double chargeTime(const Parts &p) { return p.R * p.C * std::log((p.Vs - p.Ve) / (p.Vs - p.Vb)); }
double flashTime(const Parts &p) {
  const double vi = litTarget(p);
  return litTau(p) * std::log((p.Vb - vi) / (p.Ve - vi));
}

double advance(const Parts &p, Osc &o, double dt, int *strikes) {
  double q = 0;
  int guard = 0;
  while (dt > 0 && guard++ < 64) {
    if (!o.lit) {
      // charging toward Vs through R
      const double T = p.R * p.C;
      if (o.v < p.Vb && p.Vs > p.Vb) {
        const double t = T * std::log((p.Vs - o.v) / (p.Vs - p.Vb));
        if (t < dt) { o.v = p.Vb; o.lit = true; dt -= t; if (strikes) ++*strikes; continue; }
      } else if (o.v >= p.Vb) { o.lit = true; if (strikes) ++*strikes; continue; }
      o.v = p.Vs + (o.v - p.Vs) * std::exp(-dt / T);
      return q;
    }
    // lit: toward vi with τ; the charge through the lamp is ∫ (v − Vm)/r dt
    const double vi = litTarget(p), T = litTau(p), a = o.v - vi;
    double t = dt;
    bool out = false;
    if (vi < p.Ve) { // the current falls below the hold and the glow goes out
      const double te = T * std::log((o.v - vi) / (p.Ve - vi));
      if (te < dt) { t = te > 0 ? te : 0; out = true; }
    }
    const double e = std::exp(-t / T);
    q += ((vi - p.Vm) * t + a * T * (1 - e)) / kBallast;
    o.v = vi + a * e;
    dt -= t;
    if (out) { o.v = p.Ve; o.lit = false; }
  }
  return q;
}

double steadyN(double light) { return 0.5 * (std::sqrt(1 + 4 * light) - 1); }
double cellStep(const Parts &p, double light, double n, double dt) {
  const auto f = [&](double m) { return (light - m * (1 + m)) / p.tau; };
  const double k1 = f(n), m = n + dt * k1, k2 = f(m < 0 ? 0 : m), r = n + 0.5 * dt * (k1 + k2);
  return r < 0 ? 0 : r;
}

} // namespace neon
