// ringmod-model.cpp — the Ring Modulator's circuit (ringmod-model.h).

#include "ringmod-model.h"

#include <algorithm>
#include <cmath>

#include "ringmod-params.h"

namespace ringmod {

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

// solve the symmetric 3 × 3 A x = b in place (b becomes x) by Cramer's rule
bool solve3(const double *A, double *b) {
  const double a = A[0], bb = A[1], c = A[2], d = A[4], e = A[5], f = A[8];
  const double c0 = d * f - e * e, c1 = c * e - bb * f, c2 = bb * e - c * d;
  const double det = a * c0 + bb * c1 + c * c2;
  if (det == 0 || !std::isfinite(det)) return false;
  const double b0 = b[0], b1 = b[1], b2 = b[2];
  const double m11 = a * f - c * c, m12 = bb * c - a * e, m22 = a * d - bb * bb;
  b[0] = (c0 * b0 + c1 * b1 + c2 * b2) / det;
  b[1] = (c1 * b0 + m11 * b1 + m12 * b2) / det;
  b[2] = (c2 * b0 + m12 * b1 + m22 * b2) / det;
  return true;
}

// the ring's residuals F (zero at the solution) and their Jacobian ∂F/∂(u, vc, w), symmetric
void residuals(const Parts &p, double vin, double vcar, double G1, double J1, double G2, double J2, Ring &r, double *F, double *A) {
  const double x[4] = {r.vc + r.u - r.w, r.w - r.vc + r.u, r.vc - r.u + r.w, -r.w - r.vc - r.u};
  double g[4];
  for (int k = 0; k < 4; k++) r.i[k] = p.d[k].current(x[k], g[k]);
  const double *i = r.i, sum = g[0] + g[1] + g[2] + g[3];
  F[0] = p.Gs * (vin - r.u) - (G1 * r.u + J1) - (i[0] + i[1] - i[2] - i[3]);
  F[1] = p.Gc * (vcar - r.vc) - (i[0] - i[1] + i[2] - i[3]);
  F[2] = (i[0] - i[1] - i[2] + i[3]) - (G2 + p.GL) * r.w - J2;
  A[0] = -p.Gs - G1 - sum;
  A[1] = A[3] = -(g[0] - g[1] - g[2] + g[3]);
  A[2] = A[6] = g[0] - g[1] + g[2] - g[3];
  A[4] = -p.Gc - sum;
  A[5] = A[7] = g[0] + g[1] - g[2] - g[3];
  A[8] = -sum - G2 - p.GL;
}
} // namespace

const Family &family(int k) { return kTable[std::clamp(k, 0, kFamilies - 1)]; }

double Diode::current(double v, double &slope) const {
  const double u = v / nvt;
  if (u > cap) { const double e = std::exp(cap); slope = is * e / nvt; return is * (e - 1) + slope * (v - cap * nvt); }
  const double e = std::exp(std::max(u, -700.0));
  slope = std::max(is * e / nvt, 1e-15); // reversed: the saturation current, and a whisker of slope
  return is * (e - 1);
}

Parts parts(const double *P) {
  Parts p{};
  p.Gs = 1 / kRs; p.Gc = 1 / kRc; p.GL = 1 / kRL;
  p.L = P[inductance];
  const Family &f = family((int)std::lround(P[diodes]));
  const double vt = kK * kT / kQ, nvt = f.n * vt, is = 1e-3 / std::expm1(f.v1mA / nvt);
  for (Diode &d : p.d) d.is = is;
  // D1 needs `mismatch` more volts for the same current: its saturation current e^(−Δ/nVT) smaller
  p.d[0].is = is * std::exp(-P[mismatch] / nvt);
  for (Diode &d : p.d) { d.nvt = nvt; d.cap = std::log(1 / d.is); d.knee = nvt * std::log(nvt / (std::sqrt(2.0) * d.is)); }
  p.fc = P[carrier];
  p.amp = P[carrierLevel];
  p.wave = std::clamp((int)std::lround(P[wave]), 0, 2);
  p.rise = 2 * p.amp / kSlew;
  p.mix = P[mix];
  p.makeup = kMakeup;
  p.gain = std::pow(10.0, P[level] / 20);
  return p;
}

double carrierAt(const Parts &p, double phase) {
  const double q = phase - std::floor(phase);
  if (p.wave == kSine) return p.amp * std::sin(2 * kPi * q);
  // a triangle peaking at a quarter cycle
  const double tri = q < 0.25 ? 4 * q : q < 0.75 ? 2 - 4 * q : 4 * q - 4;
  if (p.wave == kTriangle) return p.amp * tri;
  // the square: a comparator's output slewing between ±amp, d of a cycle from one to the other
  // (at most half: a slewing comparator that never arrives makes a smaller triangle)
  const double d = std::max(p.rise * p.fc, 1e-9);
  return p.amp * std::clamp(tri / (2 * d), -1.0, 1.0);
}

int solve(const Parts &p, double vin, double vcar, double G1, double J1, double G2, double J2, Ring &r, double tol) {
  double F[3], A[9];
  for (int its = 1; its <= 60; its++) {
    residuals(p, vin, vcar, G1, J1, G2, J2, r, F, A);
    double d[3] = {-F[0], -F[1], -F[2]};
    if (!solve3(A, d)) return 0;
    // limit each diode's forward step to 4 nVT past where it was, or past its knee, so its
    // exponential can't overshoot (SPICE's pnjlim, more simply)
    const double x[4] = {r.vc + r.u - r.w, r.w - r.vc + r.u, r.vc - r.u + r.w, -r.w - r.vc - r.u};
    const double dx[4] = {d[1] + d[0] - d[2], d[2] - d[1] + d[0], d[1] - d[0] + d[2], -d[2] - d[1] - d[0]};
    double t = 1;
    for (int k = 0; k < 4; k++) {
      const Diode &dk = p.d[k];
      const double from = std::max(x[k], dk.knee), room = from + 4 * dk.nvt - x[k];
      if (dx[k] > room && x[k] + dx[k] > dk.knee) t = std::min(t, room / dx[k]);
    }
    r.u += t * d[0]; r.vc += t * d[1]; r.w += t * d[2];
    // a full step under 20 µV leaves an error near its square over nVT, under 10 nV, 160 dB below
    // a volt (the diodes' currents are those from before it, as near)
    if (t == 1 && std::fabs(d[0]) + std::fabs(d[1]) + std::fabs(d[2]) < tol) return its;
  }
  return 0;
}

void currents(const Parts &p, Ring &r) {
  const double x[4] = {r.vc + r.u - r.w, r.w - r.vc + r.u, r.vc - r.u + r.w, -r.w - r.vc - r.u};
  double g;
  for (int k = 0; k < 4; k++) r.i[k] = p.d[k].current(x[k], g);
}

void switching(const Parts &p, double vcar, double J1, double J2, Ring &r, double &g, double &w0) {
  if (!solve(p, 0, vcar, 0, J1, 0, J2, r, 1e-10)) {
    r = Ring{};
    r.vc = std::clamp(vcar, -0.5, 0.5); // the centre tap starts near the diodes' knee
    if (!solve(p, 0, vcar, 0, J1, 0, J2, r, 1e-10)) { g = w0 = NAN; return; }
  }
  double F[3], A[9];
  residuals(p, 0, vcar, 0, J1, 0, J2, r, F, A);
  // A dx/dvin = −∂F/∂vin = −(Gs, 0, 0)
  double d[3] = {-p.Gs, 0, 0};
  solve3(A, d);
  g = d[2];
  w0 = r.w;
}

void cycle(const Parts &p, int n, double *vcar, double *g, double *w0) {
  for (int i = 0; i < n; i++) vcar[i] = carrierAt(p, (double)i / n);
  // the averages of u and w over the cycle, with the inductors' currents J1 and J2
  auto averages = [&](double J1, double J2, double &su, double &sw) {
    Ring r;
    su = sw = 0;
    for (int i = 0; i < n; i++) {
      switching(p, vcar[i], J1, J2, r, g[i], w0[i]);
      su += r.u / n;
      sw += r.w / n;
    }
  };
  double J1 = 0, J2 = 0, su, sw;
  averages(J1, J2, su, sw);
  for (int it = 0; it < 20 && std::max(std::fabs(su), std::fabs(sw)) > 1e-13; it++) {
    const double d = 1e-9;
    double au, aw, bu, bw;
    averages(J1 + d, J2, au, aw);
    averages(J1, J2 + d, bu, bw);
    const double m00 = (au - su) / d, m01 = (bu - su) / d, m10 = (aw - sw) / d, m11 = (bw - sw) / d;
    const double det = m00 * m11 - m01 * m10;
    if (det == 0 || !std::isfinite(det)) break;
    J1 -= (m11 * su - m01 * sw) / det;
    J2 -= (-m10 * su + m00 * sw) / det;
    averages(J1, J2, su, sw);
  }
}

} // namespace ringmod
