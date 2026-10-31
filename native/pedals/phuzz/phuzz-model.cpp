// phuzz-model.cpp — the Phuzz's physics (phuzz-model.h).

#include "phuzz-model.h"

#include <algorithm>
#include <cmath>

#include "phuzz-params.h"

namespace phuzz {

double taper(double a) { return (std::pow(81.0, a) - 1) / 80; }

Transistor transistor(double hfe, double iceo, double T) {
  const double r = T / kT0;
  Transistor q;
  q.bF = hfe * std::pow(r, kXtb);
  q.bR = kBetaR * std::pow(r, kXtb);
  const double is0 = iceo * kBetaR / (hfe + kBetaR + 1); // I_CEO = Is (βF + βR + 1)/βR, at T0
  q.vt = kBoltzmannOverQ * T;
  q.is = is0 * std::pow(r, kXti) * std::exp(kEg / q.vt * (r - 1));
  q.vcrit = q.vt * std::log(q.vt / (std::sqrt(2.0) * q.is));
  return q;
}

void Transistor::currents(double veb, double vcb, double &ic, double &ib, double dic[2], double dib[2]) const {
  // the exponent is capped far above any real junction's, so a wild Newton step can't overflow
  const double eF = std::exp(std::min(veb / vt, 80.0)), eR = std::exp(std::min(vcb / vt, 80.0));
  const double iF = is * (eF - 1), iR = is * (eR - 1), dF = is * eF / vt, dR = is * eR / vt;
  const double aR = bR / (bR + 1);
  ic = iF - iR / aR;
  ib = iF / bF + iR / bR;
  dic[0] = dF; dic[1] = -dR / aR;
  dib[0] = dF / bF; dib[1] = dR / bR;
}

Parts parts(const double *P) {
  Parts p;
  const double T = 273.15 + P[temp];
  p.q1 = transistor(P[hfe1], P[leak1], T);
  p.q2 = transistor(P[hfe2], P[leak2], T);
  const double f = P[fuzz], vol = taper(P[volume]);
  // a pot's ends are never quite zero ohms
  p.Ra = std::max(1.0, (1 - f) * kFuzzPot);
  p.Rb = std::max(1.0, f * kFuzzPot);
  p.Rtop = std::max(1.0, (1 - vol) * kVolPot);
  p.Rbot = std::max(1.0, vol * kVolPot);
  p.R3 = P[bias];
  p.Vbat = P[battery];
  p.Rbat = P[battR];
  p.active = P[active] > 0.5;
  p.coilR = p.active ? P[activeR] : P[pickupR];
  p.coilL = p.active ? 0 : P[pickupL];
  p.Gpots = p.active ? 0 : 1 / P[pots];
  p.Cself = p.active ? 0 : P[pickupC];
  p.Cin = P[cable] * P[cablePF];
  p.Crec = P[recCable] * P[cablePF];
  p.Grec = 1 / P[recLoad];
  p.Cout = P[outCable] * P[cablePF];
  p.Gload = 1 / P[load];
  return p;
}

namespace {
constexpr int N = kNodes;
using Mat = std::array<double, N * N>;
void stamp(Mat &G, int a, int b, double g) { // a conductance between nodes a and b (−1: ground)
  if (a >= 0) G[a * N + a] += g;
  if (b >= 0) G[b * N + b] += g;
  if (a >= 0 && b >= 0) { G[a * N + b] -= g; G[b * N + a] -= g; }
}
// Gauss–Jordan with partial pivoting: Gi = G⁻¹
void invert(Mat G, Mat &Gi) {
  Gi.fill(0);
  for (int i = 0; i < N; i++) Gi[i * N + i] = 1;
  for (int k = 0; k < N; k++) {
    int piv = k;
    for (int r = k + 1; r < N; r++) if (std::abs(G[r * N + k]) > std::abs(G[piv * N + k])) piv = r;
    if (piv != k) for (int c = 0; c < N; c++) { std::swap(G[k * N + c], G[piv * N + c]); std::swap(Gi[k * N + c], Gi[piv * N + c]); }
    const double d = 1 / G[k * N + k];
    for (int c = 0; c < N; c++) { G[k * N + c] *= d; Gi[k * N + c] *= d; }
    for (int r = 0; r < N; r++) {
      if (r == k) continue;
      const double f = G[r * N + k];
      if (f == 0) continue;
      for (int c = 0; c < N; c++) { G[r * N + c] -= f * G[k * N + c]; Gi[r * N + c] -= f * Gi[k * N + c]; }
    }
  }
}
// the capacitors, as [node a, node b] (−1: ground)
constexpr int kCaps[5][2] = {{A, B}, {W, -1}, {X, O}, {A, -1}, {V, -1}};
} // namespace

void DK::build(const Parts &p, double T) {
  Mat G{};
  stamp(G, B, E2, 1 / kR4);
  stamp(G, K1, S, 1 / kR1);
  stamp(G, E2, W, 1 / p.Ra);
  stamp(G, W, -1, 1 / p.Rb);
  stamp(G, K2, X, 1 / p.R3);
  stamp(G, X, S, 1 / kR2);
  stamp(G, S, -1, 1 / p.Rbat);
  stamp(G, O, V, 1 / p.Rtop);
  stamp(G, V, -1, 1 / p.Rbot + p.Gload);
  stamp(G, A, -1, p.Gpots);
  const double C[5] = {kC1, kC2, kC3, p.Cself + p.Cin, p.Cout};
  for (int k = 0; k < 5; k++) {
    Gc[k] = T > 0 ? 2 * C[k] / T : 0;
    stamp(G, kCaps[k][0], kCaps[k][1], Gc[k]);
  }
  // the coil, R in series with L: L (i − i₋) = (T/2)(vL + vL₋) with vL = v − R i gives
  // i = Gl v + carried, Gl = (T/2)/(L + RT/2), carried = rho i₋ + Gl v₋, rho = (L − RT/2)/(L + RT/2)
  if (T > 0) {
    Gl = 0.5 * T / (p.coilL + 0.5 * p.coilR * T);
    rho = (p.coilL - 0.5 * p.coilR * T) / (p.coilL + 0.5 * p.coilR * T);
  } else {
    Gl = 1 / p.coilR;
    rho = 0;
  }
  stamp(G, A, -1, Gl);
  Mat Gi;
  invert(G, Gi);

  // what each entry of z injects into the nodes
  std::array<double, N * NZ> Bz{};
  for (int k = 0; k < 5; k++) {
    Bz[kCaps[k][0] * NZ + k] += 1; // a capacitor's carried current J flows into a, out of b
    if (kCaps[k][1] >= 0) Bz[kCaps[k][1] * NZ + k] -= 1;
  }
  Bz[A * NZ + 5] = -1;            // the coil's carried current leaves A
  Bz[A * NZ + 6] = 1;             // the bass's Norton current enters A
  Bz[S * NZ + 7] = -1 / p.Rbat;   // the battery: its EMF (a positive number) holds S below ground
  // what each transistor current injects: out of a collector or base into its node, and back out
  // of the emitter's
  std::array<double, N * NV> Ni{};
  Ni[K1 * NV + 0] = 1;                            // Q1's collector current (its emitter is ground)
  Ni[B * NV + 1] = 1;                             // Q1's base current
  Ni[K2 * NV + 2] = 1; Ni[E2 * NV + 2] = -1;      // Q2's collector current
  Ni[K1 * NV + 3] = 1; Ni[E2 * NV + 3] = -1;      // Q2's base current
  for (int r = 0; r < N; r++) {
    for (int c = 0; c < NZ; c++) { double s = 0; for (int k = 0; k < N; k++) s += Gi[r * N + k] * Bz[k * NZ + c]; Hz[r * NZ + c] = s; }
    for (int c = 0; c < NV; c++) { double s = 0; for (int k = 0; k < N; k++) s += Gi[r * N + k] * Ni[k * NV + c]; Hi[r * NV + c] = s; }
  }
  // v = Nv · node: veb1 = −V_B, vcb1 = V_K1 − V_B, veb2 = V_E2 − V_K1, vcb2 = V_K2 − V_K1
  const auto port = [&](const auto &H, int cols, int row, int c) {
    switch (row) {
      case 0: return -H[B * cols + c];
      case 1: return H[K1 * cols + c] - H[B * cols + c];
      case 2: return H[E2 * cols + c] - H[K1 * cols + c];
      default: return H[K2 * cols + c] - H[K1 * cols + c];
    }
  };
  for (int r = 0; r < NV; r++) {
    for (int c = 0; c < NZ; c++) Pz[r * NZ + c] = port(Hz, NZ, r, c);
    for (int c = 0; c < NV; c++) K[r * NV + c] = port(Hi, NV, r, c);
  }
  // y: each capacitor's voltage (a − b), the jack's (the coil's), the output's
  const auto out = [&](const auto &H, int cols, int row, int c) {
    if (row < 5) return H[kCaps[row][0] * cols + c] - (kCaps[row][1] >= 0 ? H[kCaps[row][1] * cols + c] : 0.0);
    return H[(row == 5 ? A : V) * cols + c];
  };
  for (int r = 0; r < NY; r++) {
    for (int c = 0; c < NZ; c++) Yz[r * NZ + c] = out(Hz, NZ, r, c);
    for (int c = 0; c < NV; c++) Yi[r * NV + c] = out(Hi, NV, r, c);
  }
}

namespace {
// SPICE's junction limiting (pnjlim): a step that would take a junction far into forward bias is
// cut to the logarithm of what it asked for, so the exponential can't run away; reverse steps,
// which the exponential flattens, are left alone.
double limitJunction(double vnew, double vold, double vt, double vcrit, bool &limited) {
  if (vnew > vcrit && std::abs(vnew - vold) > 2 * vt) {
    limited = true;
    if (vold > 0) {
      const double arg = 1 + (vnew - vold) / vt;
      return arg > 0 ? vold + vt * std::log(arg) : vcrit;
    }
    return vt * std::log(vnew / vt);
  }
  return vnew;
}
} // namespace

int solveJunctions(const DK &dk, const Transistor &q1, const Transistor &q2, const double p[4], double v[4], double i[4], int maxIt) {
  const double vcrit[2] = {q1.vcrit, q2.vcrit};
  const double vts[2] = {q1.vt, q2.vt};
  for (int it = 1; it <= maxIt; it++) {
    // the currents and their derivatives: d[2t] = ∂(collector current)/∂(veb, vcb) of transistor
    // t, d[2t + 1] the base current's
    double d[4][2];
    q1.currents(v[0], v[1], i[0], i[1], d[0], d[1]);
    q2.currents(v[2], v[3], i[2], i[3], d[2], d[3]);
    // F = p + K i − v,  J = K ∂i/∂v − 1
    double J[4][5];
    for (int r = 0; r < 4; r++) {
      double F = p[r] - v[r];
      for (int c = 0; c < 4; c++) F += dk.K[r * 4 + c] * i[c];
      for (int c = 0; c < 4; c++) {
        const int t = c / 2, j = c % 2; // junction c is transistor t's veb (j = 0) or vcb (j = 1)
        J[r][c] = dk.K[r * 4 + 2 * t] * d[2 * t][j] + dk.K[r * 4 + 2 * t + 1] * d[2 * t + 1][j] - (r == c ? 1 : 0);
      }
      J[r][4] = -F;
    }
    // Gaussian elimination with partial pivoting on the 4 × 4
    for (int k = 0; k < 4; k++) {
      int piv = k;
      for (int r = k + 1; r < 4; r++) if (std::abs(J[r][k]) > std::abs(J[piv][k])) piv = r;
      if (piv != k) for (int c = 0; c < 5; c++) std::swap(J[k][c], J[piv][c]);
      for (int r = k + 1; r < 4; r++) {
        const double f = J[r][k] / J[k][k];
        for (int c = k; c < 5; c++) J[r][c] -= f * J[k][c];
      }
    }
    double dv[4];
    for (int r = 3; r >= 0; r--) {
      double s = J[r][4];
      for (int c = r + 1; c < 4; c++) s -= J[r][c] * dv[c];
      dv[r] = s / J[r][r];
    }
    bool limited = false;
    double big = 0;
    for (int r = 0; r < 4; r++) {
      const double vn = limitJunction(v[r] + dv[r], v[r], vts[r / 2], vcrit[r / 2], limited);
      dv[r] = vn - v[r];
      big = std::max(big, std::abs(dv[r]));
    }
    for (int r = 0; r < 4; r++) v[r] += dv[r];
    // Newton converges quadratically, the error after a step δ about δ²/(2 Vt): after a step
    // under 100 µV, under 0.2 µV, which moves a junction's current by 10 parts in a million
    // (−100 dB). Take it, and carry the currents to it to first order, without another round of
    // exponentials.
    if (!limited && big < 1e-4) {
      i[0] += d[0][0] * dv[0] + d[0][1] * dv[1];
      i[1] += d[1][0] * dv[0] + d[1][1] * dv[1];
      i[2] += d[2][0] * dv[2] + d[2][1] * dv[3];
      i[3] += d[3][0] * dv[2] + d[3][1] * dv[3];
      return it;
    }
  }
  double dd[2];
  q1.currents(v[0], v[1], i[0], i[1], dd, dd);
  q2.currents(v[2], v[3], i[2], i[3], dd, dd);
  return maxIt + 1;
}

OperatingPoint operatingPoint(const Parts &p) {
  DK dk;
  dk.build(p, 0);
  OperatingPoint op{};
  double z[DK::NZ] = {};
  for (int s = 1; s <= 40; s++) {
    z[7] = p.Vbat * s / 40;
    double pv[4];
    for (int r = 0; r < 4; r++) { pv[r] = 0; for (int c = 0; c < DK::NZ; c++) pv[r] += dk.Pz[r * DK::NZ + c] * z[c]; }
    solveJunctions(dk, p.q1, p.q2, pv, op.v, op.i, 200);
  }
  for (int r = 0; r < kNodes; r++) {
    double s = 0;
    for (int c = 0; c < DK::NZ; c++) s += dk.Hz[r * DK::NZ + c] * z[c];
    for (int c = 0; c < 4; c++) s += dk.Hi[r * 4 + c] * op.i[c];
    op.node[r] = s;
  }
  return op;
}

} // namespace phuzz
