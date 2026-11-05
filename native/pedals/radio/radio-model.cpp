// radio-model.cpp — the Crystal Radio's set (radio-model.h).

#include "radio-model.h"

#include <algorithm>
#include <cmath>

#include "radio-params.h"
#include "phuzzbox/dsp.h"

namespace radio {

namespace {
constexpr double kK = 1.380649e-23, kQ = 1.602176634e-19, kT = 298.15; // 25 °C
constexpr double kPi = 3.14159265358979323846;

// the Bandgap's families (native/pedals/bandgap/bandgap-model.cpp): a point-contact germanium
// diode, a Schottky, a small-signal silicon diode
const Family kTable[kFamilies] = {
  {"Germanium", 0.28, 1.6},
  {"Schottky", 0.32, 1.05},
  {"Silicon", 0.58, 1.75},
};

// e^{−a} I0(a) for large a, by its asymptotic series (1/√(2πa)) Σ ((2k − 1)!!)² / (k! (8a)^k)
double i0scaled(double a) {
  double term = 1, sum = 1;
  for (int k = 1; k < 16; k++) {
    term *= (2.0 * k - 1) * (2.0 * k - 1) / (8.0 * a * k);
    sum += term;
    if (term < 1e-17 * sum) break;
  }
  return sum / std::sqrt(2 * kPi * a);
}
constexpr double kSeries = 12;
// 1/k², for I0's power series
struct InvSquares { double v[64]; constexpr InvSquares() : v{} { for (int k = 1; k < 64; k++) v[k] = 1.0 / ((double)k * k); } };
constexpr InvSquares kInvSq;
constexpr const double *kInvSquares = kInvSq.v; // below it I0 by its power series, above it by the asymptotic one

} // namespace

const Family &family(int k) { return kTable[std::clamp(k, 0, kFamilies - 1)]; }

double Parts::gamma() const { return kPi * (fs + tune) / Q; }
double Parts::delta() const { return 2 * kPi * tune; }

Parts parts(const double *P) {
  Parts p{};
  const Family &f = family((int)std::lround(P[diode]));
  p.nvt = f.n * kK * kT / kQ;
  p.is = 1e-3 / std::expm1(f.v1mA / p.nvt);
  p.Ac = P[signal];
  p.k = P[depth];
  p.fs = P[station];
  p.tune = P[tuning];
  p.Q = P[q];
  p.B = p.Ac * std::pow(10.0, P[neighbour] / 20);
  p.R = P[load];
  p.C = P[cap];
  p.level = std::pow(10.0, P[level] / 20);
  return p;
}

cplx tank(const Parts &p, double f) { return 1.0 / cplx(1, (2 * kPi * f - p.delta()) / p.gamma()); }

double i0m1(double a) {
  a = std::fabs(a);
  if (a >= kSeries) return std::exp(a) * i0scaled(a) - 1;
  const double x = a * a / 4;
  double term = 1, sum = 0;
  for (int k = 1; k < 200; k++) {
    term *= x * (k < 64 ? kInvSquares[k] : 1.0 / ((double)k * k));
    sum += term;
    if (term < 1e-17 * sum) break;
  }
  return sum;
}

Drive drive(const Parts &p, double A) {
  Drive d;
  d.a = std::fabs(A) / p.nvt;
  d.big = d.a >= kSeries;
  if (d.big) d.scaled = i0scaled(d.a); else d.m1 = i0m1(d.a);
  return d;
}

double meanCurrent(const Parts &p, const Drive &d, double V) {
  const double v = V / p.nvt;
  // e^{−v} (I0 − 1) + (e^{−v} − 1): no cancellation when both are small
  if (!d.big) return p.is * (std::exp(std::min(-v, 700.0)) * d.m1 + std::expm1(std::min(-v, 700.0)));
  return p.is * (std::exp(std::min(d.a - v, 700.0)) * d.scaled - 1);
}

double meanCurrent(const Parts &p, double A, double V) { return meanCurrent(p, drive(p, A), V); }

// d⟨i⟩/dV = −Is e^{−v} I0(a) / nVT = −(⟨i⟩ + Is)/nVT
double meanConductance(const Parts &p, double A, double V) { return -(meanCurrent(p, A, V) + p.is) / p.nvt; }

// The voltage x where G x − ⟨i⟩(x) = c0: the earphone's node, the capacitor's history and the
// load together a conductance G and a current c0, against the diode. The left side rises with x;
// ⟨i⟩ ≥ −Is everywhere and ≤ 0 above A, so the root lies between (c0 − Is)/G and max(A, c0/G).
// Newton's method, on the equation as it is while the diode is nearly off, and on its logarithm,
// ln(G x − c0 + Is) = ln(⟨i⟩ + Is), once the diode's exponential conductance outweighs G, where the
// first would creep up the exponential a nVT at a time; a bisection whenever a step would leave the
// bracket, or after a dozen. Either equation's curvature over twice its slope is under 1/(2nVT),
// so a Newton step dx leaves an error under dx²/(2nVT), and the last needn't be checked by another.
double balance(const Parts &p, const Drive &dr, double G, double c0, double x, long &its) {
  double lo = (c0 - p.is) / G, hi = std::max(dr.a * p.nvt, c0 / G);
  x = std::clamp(x, lo, hi);
  const double curv = 0.5 / p.nvt;
  for (int k = 0; k < 200; k++) {
    // the diode's current i, and i + Is = Is e^{−v} I0(a), its exponential part
    const double v = x / p.nvt;
    double i, e;
    if (!dr.big) {
      const double ev = std::exp(std::min(-v, 700.0));
      i = p.is * (ev * dr.m1 + std::expm1(std::min(-v, 700.0)));
      e = p.is * ev * (1 + dr.m1);
    } else {
      e = p.is * std::exp(std::min(dr.a - v, 700.0)) * dr.scaled;
      i = e - p.is;
    }
    its++;
    const double f = G * x - i - c0;
    if (f == 0) return x;
    if (f > 0) hi = x; else lo = x;
    double nx;
    const double s = G * x - c0 + p.is;
    if (e > G * p.nvt && s > 0) nx = x - std::log(s / e) / (G / s + 1 / p.nvt);
    else nx = x - f / (G + e / p.nvt);
    const bool newton = nx > lo && nx < hi && k < 12;
    if (!newton) nx = 0.5 * (lo + hi);
    const double dx = std::fabs(nx - x), tol = 1e-11 * std::fabs(nx) + 1e-19;
    x = nx;
    if ((newton ? curv * dx * dx : dx) <= tol || hi - lo <= tol) return x;
  }
  return x;
}

double settle(const Parts &p, double A) {
  if (A == 0) return 0;
  long its = 0;
  // the steady state: V/R = ⟨i⟩
  return balance(p, drive(p, A), 1 / p.R, 0, 0.5 * std::fabs(A), its);
}

double slope(const Parts &p, double A) {
  const double e = 1e-4;
  return (settle(p, A * (1 + e)) - settle(p, A * (1 - e))) / (2 * e * A);
}

double restingAmplitude(const Parts &p) { return std::abs(p.Ac * tank(p, 0)); }

void Receiver::start(const Parts &p, double step) {
  h = step;
  retune(p);
  // at rest: the tuned circuit's steady answer to the carrier alone, and the detector settled on it
  e = p.Ac * tank(p, 0);
  u1 = p.Ac;
  A = std::abs(e);
  V = V1 = settle(p, A);
}

void Receiver::retune(const Parts &p) {
  q = p;
  const cplx lambda(p.gamma(), -p.delta());
  pole = std::exp(-lambda * h);
  gain = (1.0 - pole) * p.gamma() / lambda;
  G = 3 * p.C / (2 * h) + 1 / p.R;
}

double Receiver::step(cplx u) {
  // the tuned circuit, its input held at the mean of this step's and the last
  e = mul(pole, e) + mul(gain, 0.5 * (u + u1));
  u1 = u;
  A = std::sqrt(std::norm(e));
  // the earphone: C (3V − 4Vn + Vn−1)/(2h) = ⟨i⟩(A, V) − V/R, solved for V
  const double c0 = q.C * (4 * V - V1) / (2 * h);
  const double x = balance(q, drive(q, A), G, c0, 2 * V - V1, iterations);
  steps++;
  V1 = V;
  V = x;
  return V;
}

} // namespace radio
