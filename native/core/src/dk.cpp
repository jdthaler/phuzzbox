// dk.cpp — the nodal DK method (dk.h).
//
// Unknowns: the voltages of the nodes no source holds (v_U); the sources' nodes are known (u).
// Each capacitor or inductor k between nodes a and b is its trapezoidal companion, a conductance
// g_k in parallel with a current z_k (its state):
//
//   i_k = g_k v_k − z_k,   capacitor g = 2C/T, z' = 2 g v − z;   inductor g = T/(2L), z' = −(2 g v − z)
//
// Each port p (a junction, or a triode's grid or plate) is a current i_p(v_p) from its first node
// to its second. Kirchhoff's current law at the unknown nodes, with N the incidence (+1 at a, −1 at
// b) split into its unknown (·U) and known (·K) columns and Y the conductances (resistors and
// companions) likewise, and each current source's amperes u_I into its node:
//
//   Y v_U + Y_K u = N_xU' z − N_nU' i   ⇒   v_U = S (N_xU' z − N_nU' i − Y_K u),  S = Y⁻¹
//
// where a current source is a column of Y_K with −1 at its node (and u its amperes).
//
// so the junctions' voltages, the reactive parts' voltages and the outputs are each
//
//   v_n = D z + E u + F i(v_n),   v_x = A z + B u + C i,   y = Do z + Eo u + Fo i
//
// and a sample is a Newton solve of v_n − D z − E u − F i(v_n) = 0 (four unknowns for two
// transistors, six for three triodes), then the states' update.

#include "phuzzbox/dk.h"

#include <algorithm>
#include <cmath>

namespace phuzzbox::dk {
namespace {

constexpr double GMIN = 1e-12;   // S from every node to ground, so no node floats at DC
constexpr double GSHORT = 1e4;   // S: an inductor at DC
constexpr double XMAX = 80;      // exp(x) beyond this is continued as a straight line

// exp, continued linearly past XMAX so that Newton's first guesses cannot overflow
inline void expLin(double x, double &e, double &de) {
  if (x < -40) { e = de = 0; return; } // a junction reverse biased past 1 V: e^x < 5e-18, nothing
  if (x < XMAX) { e = std::exp(x); de = e; return; }
  const double m = std::exp(XMAX);
  e = m * (1 + x - XMAX);
  de = m;
}

// log(1 + e^x) and its derivative, the logistic function, without overflow
inline void softplus(double x, double &s, double &ds) {
  const double e = std::exp(-std::abs(x));
  s = std::max(x, 0.0) + std::log1p(e);
  ds = x >= 0 ? 1 / (1 + e) : e / (1 + e);
}

// in-place solve of the n × n system M x = b by Gaussian elimination with partial pivoting
template <class T>
bool solve(T *M, T *b, int n) {
  for (int k = 0; k < n; k++) {
    int piv = k;
    for (int i = k + 1; i < n; i++) if (std::abs(M[i * n + k]) > std::abs(M[piv * n + k])) piv = i;
    if (std::abs(M[piv * n + k]) == 0.0) return false;
    if (piv != k) { for (int j = 0; j < n; j++) std::swap(M[k * n + j], M[piv * n + j]); std::swap(b[k], b[piv]); }
    for (int i = k + 1; i < n; i++) {
      const T m = M[i * n + k] / M[k * n + k];
      if (m == T(0)) continue;
      for (int j = k; j < n; j++) M[i * n + j] -= m * M[k * n + j];
      b[i] -= m * b[k];
    }
  }
  for (int k = n - 1; k >= 0; k--) {
    T s = b[k];
    for (int j = k + 1; j < n; j++) s -= M[k * n + j] * b[j];
    b[k] = s / M[k * n + k];
  }
  return true;
}

} // namespace

void triodeCurrents(const Netlist::Tube &u, double vg, double va, double &ig, double &ia) {
  double sk, dsk, sg, dsg;
  softplus(u.C * (va / u.mu + vg), sk, dsk);
  softplus(u.Cg * vg, sg, dsg);
  ig = u.Gg * std::pow(sg / u.Cg, u.xi) + u.Ig0;
  ia = u.G * std::pow(sk / u.C, u.gamma) - ig;
}

Circuit::Circuit(const Netlist &n, double fs) : net(n), fs(fs), T(1 / fs) {
  nK = (int)net.sources.size();
  nI = nK + (int)net.currents.size();
  col.assign(net.nodes + 1, 0);
  for (int k = 0; k < nK; k++) col[net.sources[k]] = -1 - k;
  nU = 0;
  for (int i = 1; i <= net.nodes; i++) if (col[i] >= 0) col[i] = nU++;
  nX = (int)(net.capacitors.size() + net.inductors.size());
  nN = (int)(2 * net.bjts.size() + net.diodes.size() + 2 * net.triodes.size());
  nO = (int)net.outputs.size();
  Y = Mat(nU, nU); Yk = Mat(nU, nI); S = Mat(nU, nU); work = Mat(nU, 2 * nU);
  A = Mat(nX, nX); B = Mat(nX, nI); C = Mat(nX, nN);
  D = Mat(nN, nX); E = Mat(nN, nI); F = Mat(nN, nN);
  Do = Mat(nO, nX); Eo = Mat(nO, nI); Fo = Mat(nO, nN);
  Edc = Mat(nN, nI); Fdc = Mat(nN, nN);
  SxT = Mat(nU, nX); SnT = Mat(nU, nN); SY = Mat(nU, nI);
  gX.assign(nX, 0); sign.assign(nX, 1);
  for (size_t k = 0; k < net.inductors.size(); k++) sign[net.capacitors.size() + k] = -1;
  z.assign(nX, 0); vx.assign(nX, 0); vn.assign(nN, 0); in.assign(nN, 0); p.assign(nN, 0); r.assign(nN, 0);
  Jd.assign((size_t)nN * nN, 0); Jm.assign((size_t)nN * nN, 0); dv.assign(nN, 0);
  dcV.assign(net.nodes + 1, 0); iDC.assign(nN, 0); uStep.assign(nI, 0); vPrev.assign(nN, 0); xa.assign(nX, 0); xb.assign(nX, 0);
  na.assign(nN, 0); nb.assign(nN, 0); oa.assign(nO, 0);
  for (int k = 0; k < nX; k++) {
    const Netlist::Two &t = k < (int)net.capacitors.size() ? net.capacitors[k] : net.inductors[k - net.capacitors.size()];
    xa[k] = t.a; xb[k] = t.b;
  }
  int q = 0;
  for (const Netlist::Bjt &b : net.bjts) { // NPN: B→E, B→C; PNP: E→B, C→B
    if (!b.pnp) { na[q] = b.b; nb[q++] = b.e; na[q] = b.b; nb[q++] = b.c; }
    else { na[q] = b.e; nb[q++] = b.b; na[q] = b.c; nb[q++] = b.b; }
  }
  for (const Netlist::Diode &d : net.diodes) { na[q] = d.a; nb[q++] = d.k; }
  for (const Netlist::Triode &t : net.triodes) { na[q] = t.g; nb[q++] = t.k; na[q] = t.p; nb[q++] = t.k; }
  for (int k = 0; k < nO; k++) oa[k] = net.outputs[k];
  blockLo.assign(nN, 0); blockHi.assign(nN, 0);
  nvtQ.assign(nN, 0); vcritQ.assign(nN, 0); maxStep.assign(nN, 0);
  const int nb2 = 2 * (int)net.bjts.size(), nd = nb2 + (int)net.diodes.size();
  for (int k = 0; k < nN; k++) {
    const bool pair = k < nb2 || k >= nd; // a transistor's two junctions, a triode's two ports
    const int first = k < nb2 ? k - k % 2 : k >= nd ? k - (k - nd) % 2 : k;
    blockLo[k] = first;
    blockHi[k] = first + (pair ? 2 : 1);
    if (k < nd) {
      const double Is = k < nb2 ? net.bjts[k / 2].Is : net.diodes[k - nb2].Is;
      nvtQ[k] = k < nb2 ? net.bjts[k / 2].Vt : net.diodes[k - nb2].n * net.diodes[k - nb2].Vt;
      vcritQ[k] = nvtQ[k] * std::log(nvtQ[k] / (std::sqrt(2.0) * Is));
    } else {
      // a grid moves at most 2 V a step (its current grows as a power of its voltage once it
      // conducts, and Newton can overshoot into it); a plate as far as it likes
      maxStep[k] = (k - nd) % 2 == 0 ? 2.0 : 0.0;
    }
  }
  update();
}

void Circuit::stamp(int a, int b, double g) {
  const int n[2] = {a, b};
  for (int s = 0; s < 2; s++) {
    const int i = n[s];
    if (i <= 0 || col[i] < 0) continue;
    for (int t = 0; t < 2; t++) {
      const int j = n[t];
      if (j <= 0) continue;
      const double v = s == t ? g : -g;
      if (col[j] >= 0) Y(col[i], col[j]) += v; else Yk(col[i], -1 - col[j]) += v;
    }
  }
}

void Circuit::build(bool dc) {
  Y.zero(); Yk.zero();
  for (int i = 0; i < nU; i++) Y(i, i) = GMIN;
  for (const Netlist::Two &t : net.resistors) stamp(t.a, t.b, 1 / t.value);
  const int nc = (int)net.capacitors.size();
  for (int k = 0; k < nX; k++) {
    const double v = k < nc ? net.capacitors[k].value : net.inductors[k - nc].value;
    gX[k] = k < nc ? 2 * v / T : T / (2 * v);
    if (dc) { if (k >= nc) stamp(xa[k], xb[k], GSHORT); } // capacitors open, inductors shorted
    else stamp(xa[k], xb[k], gX[k]);
  }
  // S = Y⁻¹ by Gauss–Jordan with partial pivoting
  for (int i = 0; i < nU; i++) for (int j = 0; j < nU; j++) { work(i, j) = Y(i, j); work(i, nU + j) = i == j; }
  for (int k = 0; k < nU; k++) {
    int piv = k;
    for (int i = k + 1; i < nU; i++) if (std::abs(work(i, k)) > std::abs(work(piv, k))) piv = i;
    if (piv != k) for (int j = 0; j < 2 * nU; j++) std::swap(work(k, j), work(piv, j));
    const double d = 1 / work(k, k);
    for (int j = 0; j < 2 * nU; j++) work(k, j) *= d;
    for (int i = 0; i < nU; i++) {
      if (i == k) continue;
      const double m = work(i, k);
      if (m == 0) continue;
      for (int j = 0; j < 2 * nU; j++) work(i, j) -= m * work(k, j);
    }
  }
  for (int i = 0; i < nU; i++) for (int j = 0; j < nU; j++) S(i, j) = work(i, nU + j);
  // a current source pushes its amperes into its node: Y_K's column −1 there
  for (size_t k = 0; k < net.currents.size(); k++) {
    const int n = net.currents[k];
    if (n > 0 && col[n] >= 0) Yk(col[n], nK + (int)k) = -1;
  }

  // S N_x', S N_n', S Y_K: S's columns combined by the incidences (each row of N has two entries)
  auto sCol = [&](int node, int i) { return node > 0 && col[node] >= 0 ? S(i, col[node]) : 0.0; };
  for (int i = 0; i < nU; i++) {
    for (int k = 0; k < nX; k++) SxT(i, k) = sCol(xa[k], i) - sCol(xb[k], i);
    for (int k = 0; k < nN; k++) SnT(i, k) = sCol(na[k], i) - sCol(nb[k], i);
    for (int k = 0; k < nI; k++) { double s = 0; for (int j = 0; j < nU; j++) s += S(i, j) * Yk(j, k); SY(i, k) = s; }
  }
  // rows: (N_U · M) for an incidence (a, b) is M's row at a minus its row at b; N_K adds ±1 at a known node
  auto rowU = [&](int a, int b, const Mat &M, int j) {
    double s = 0;
    if (a > 0 && col[a] >= 0) s += M(col[a], j);
    if (b > 0 && col[b] >= 0) s -= M(col[b], j);
    return s;
  };
  auto rowK = [&](int a, int b, int k) {
    double s = 0;
    if (a > 0 && col[a] < 0 && -1 - col[a] == k) s += 1;
    if (b > 0 && col[b] < 0 && -1 - col[b] == k) s -= 1;
    return s;
  };
  if (dc) {
    for (int q = 0; q < nN; q++) {
      for (int k = 0; k < nI; k++) Edc(q, k) = rowK(na[q], nb[q], k) - rowU(na[q], nb[q], SY, k);
      for (int k = 0; k < nN; k++) Fdc(q, k) = -rowU(na[q], nb[q], SnT, k);
    }
    return;
  }
  for (int q = 0; q < nX; q++) {
    for (int k = 0; k < nX; k++) A(q, k) = rowU(xa[q], xb[q], SxT, k);
    for (int k = 0; k < nI; k++) B(q, k) = rowK(xa[q], xb[q], k) - rowU(xa[q], xb[q], SY, k);
    for (int k = 0; k < nN; k++) C(q, k) = -rowU(xa[q], xb[q], SnT, k);
  }
  for (int q = 0; q < nN; q++) {
    for (int k = 0; k < nX; k++) D(q, k) = rowU(na[q], nb[q], SxT, k);
    for (int k = 0; k < nI; k++) E(q, k) = rowK(na[q], nb[q], k) - rowU(na[q], nb[q], SY, k);
    for (int k = 0; k < nN; k++) F(q, k) = -rowU(na[q], nb[q], SnT, k);
  }
  for (int q = 0; q < nO; q++) {
    for (int k = 0; k < nX; k++) Do(q, k) = rowU(oa[q], 0, SxT, k);
    for (int k = 0; k < nI; k++) Eo(q, k) = rowK(oa[q], 0, k) - rowU(oa[q], 0, SY, k);
    for (int k = 0; k < nN; k++) Fo(q, k) = -rowU(oa[q], 0, SnT, k);
  }
}

void Circuit::update() {
  if (!dirty) return;
  build(false);
  dirty = false;
}

// the junctions' currents i(v) and their Jacobian ∂i/∂v (block diagonal: 2 × 2 per transistor)
void Circuit::junctions(const double *v, double *i, double *J) const {
  if (J) std::fill(J, J + (size_t)nN * nN, 0.0);
  int q = 0;
  for (const Netlist::Bjt &b : net.bjts) {
    double eF, dF, eR, dR;
    expLin(v[q] / b.Vt, eF, dF);
    expLin(v[q + 1] / b.Vt, eR, dR);
    const double IF = b.Is * (eF - 1), IR = b.Is * (eR - 1), gF = b.Is * dF / b.Vt, gR = b.Is * dR / b.Vt;
    const double kF = 1 + 1 / b.betaF, kR = 1 + 1 / b.betaR;
    i[q] = kF * IF - IR;       // base to emitter (Ebers–Moll, transport form)
    i[q + 1] = -IF + kR * IR;  // base to collector
    if (J) {
      J[q * nN + q] = kF * gF; J[q * nN + q + 1] = -gR;
      J[(q + 1) * nN + q] = -gF; J[(q + 1) * nN + q + 1] = kR * gR;
    }
    q += 2;
  }
  for (const Netlist::Diode &d : net.diodes) {
    double e, de;
    const double nvt = d.n * d.Vt;
    expLin(v[q] / nvt, e, de);
    i[q] = d.Is * (e - 1);
    if (J) J[q * nN + q] = d.Is * de / nvt;
    q++;
  }
  for (const Netlist::Triode &t : net.triodes) {
    const Netlist::Tube &u = t.t;
    const double vg = v[q], va = v[q + 1];
    double sk, dsk, sg, dsg;
    softplus(u.C * (va / u.mu + vg), sk, dsk);
    softplus(u.Cg * vg, sg, dsg);
    const double bk = sk / u.C, bg = sg / u.Cg;
    const double pk = std::pow(bk, u.gamma - 1), pg = std::pow(bg, u.xi - 1); // b^γ = b^(γ−1) b: one power each
    const double Ik = u.G * pk * bk, Ig = u.Gg * pg * bg + u.Ig0;
    i[q] = Ig;           // grid to cathode
    i[q + 1] = Ik - Ig;  // plate to cathode
    if (J) {
      const double dk = u.G * u.gamma * pk * dsk; // ∂Ik/∂Vg; ∂Ik/∂Va is that over µ
      const double dg = u.Gg * u.xi * pg * dsg;   // ∂Ig/∂Vg
      J[q * nN + q] = dg; J[q * nN + q + 1] = 0;
      J[(q + 1) * nN + q] = dk - dg; J[(q + 1) * nN + q + 1] = dk / u.mu;
    }
    q += 2;
  }
}

// SPICE's junction limiting (pnjlim): a step that would take a forward-biased junction far up its
// exponential is shortened to a logarithmic one
double Circuit::limit(int q, double vnew, double vold) const {
  if (nvtQ[q] == 0) { // a triode's port
    const double m = maxStep[q];
    return m > 0 ? std::clamp(vnew, vold - m, vold + m) : vnew;
  }
  const double nvt = nvtQ[q], vcrit = vcritQ[q];
  if (vnew > vcrit && std::abs(vnew - vold) > 2 * nvt) {
    if (vold > 0) {
      const double arg = 1 + (vnew - vold) / nvt;
      vnew = arg > 0 ? vold + nvt * std::log(arg) : vcrit;
    } else vnew = nvt * std::log(vnew / nvt);
  }
  return vnew;
}

// v − p − F i(v) = 0 by Newton from v as given; v is left at the solution
bool Circuit::newton(const double *pp, const Mat &FF, double *v, int maxIter, double tol) {
  for (iterations = 1; iterations <= maxIter; iterations++) {
    junctions(v, in.data(), Jd.data());
    double worst = 0;
    for (int a = 0; a < nN; a++) {
      double s = v[a] - pp[a];
      for (int b = 0; b < nN; b++) s -= FF(a, b) * in[b];
      r[a] = -s;
      for (int b = 0; b < nN; b++) { // ∂i/∂v is block diagonal: only b's own block contributes
        double m = a == b ? 1.0 : 0.0;
        for (int c = blockLo[b]; c < blockHi[b]; c++) m -= FF(a, c) * Jd[c * nN + b];
        Jm[a * nN + b] = m;
      }
    }
    if (!solve(Jm.data(), r.data(), nN)) return false;
    for (int a = 0; a < nN; a++) {
      const double vnew = limit(a, v[a] + r[a], v[a]);
      dv[a] = vnew - v[a];
      worst = std::max(worst, std::abs(dv[a]));
      v[a] = vnew;
    }
    if (worst < tol) {
      // the currents at the last step's end, to first order (the step's square is below tol²)
      for (int a = 0; a < nN; a++) { double s = 0; for (int b = 0; b < nN; b++) s += Jd[a * nN + b] * dv[b]; r[a] = s; }
      for (int a = 0; a < nN; a++) in[a] += r[a];
      return true;
    }
  }
  return false;
}

void Circuit::nodeVoltages(const double *u, const double *i, std::vector<double> &V, bool withStates) const {
  V.assign(net.nodes + 1, 0.0);
  for (int k = 0; k < nK; k++) V[net.sources[k]] = u[k];
  for (int n = 1; n <= net.nodes; n++) {
    if (col[n] < 0) continue;
    const int row = col[n];
    double s = 0;
    for (int k = 0; k < nN; k++) s -= SnT(row, k) * i[k];
    for (int k = 0; k < nI; k++) s -= SY(row, k) * u[k];
    if (withStates) for (int k = 0; k < nX; k++) s += SxT(row, k) * z[k];
    V[n] = s;
  }
}

bool Circuit::operatingPoint(const double *u) {
  build(true);
  std::fill(vn.begin(), vn.end(), 0.0);
  std::vector<double> &uu = uStep; // made once, in the constructor: this may run in the audio thread
  bool ok = true;
  const int steps = 20; // the sources stepped up from zero
  for (int s = 1; s <= steps; s++) {
    for (int k = 0; k < nI; k++) uu[k] = u[k] * s / steps;
    for (int a = 0; a < nN; a++) { double t = 0; for (int k = 0; k < nI; k++) t += Edc(a, k) * uu[k]; p[a] = t; }
    ok = newton(p.data(), Fdc, vn.data(), 200, 1e-12);
  }
  junctions(vn.data(), iDC.data(), nullptr);
  std::copy(iDC.begin(), iDC.end(), in.begin());
  std::copy(vn.begin(), vn.end(), vPrev.begin());
  nodeVoltages(u, iDC.data(), dcV, false);
  // the states at rest: no current in a capacitor, the DC current through an inductor
  const int nc = (int)net.capacitors.size();
  build(false);
  dirty = false;
  for (int k = 0; k < nX; k++) {
    const double v = dcV[xa[k]] - dcV[xb[k]];
    z[k] = k < nc ? gX[k] * v : -GSHORT * v;
  }
  return ok;
}

bool Circuit::step(const double *u, double *out) {
  if (extrapolate) { // Newton from the ports carried on in a straight line from the last two samples
    for (int a = 0; a < nN; a++) { const double was = vn[a]; vn[a] = 2 * was - vPrev[a]; vPrev[a] = was; }
  }
  for (int a = 0; a < nN; a++) {
    double s = 0;
    for (int k = 0; k < nX; k++) s += D(a, k) * z[k];
    for (int k = 0; k < nI; k++) s += E(a, k) * u[k];
    p[a] = s;
  }
  bool ok = newton(p.data(), F, vn.data(), 50, tolerance); // the error after it is ~ tolerance²
  if (!ok && extrapolate) { // the line overshot a kink: again from where the ports were
    const int first = iterations;
    std::copy(vPrev.begin(), vPrev.end(), vn.begin());
    ok = newton(p.data(), F, vn.data(), 50, tolerance);
    iterations += first;
  }
  if (!ok) junctions(vn.data(), in.data(), nullptr);
  for (int q = 0; q < nO; q++) {
    double s = 0;
    for (int k = 0; k < nX; k++) s += Do(q, k) * z[k];
    for (int k = 0; k < nI; k++) s += Eo(q, k) * u[k];
    for (int k = 0; k < nN; k++) s += Fo(q, k) * in[k];
    out[q] = s;
  }
  for (int q = 0; q < nX; q++) {
    double s = 0;
    for (int k = 0; k < nX; k++) s += A(q, k) * z[k];
    for (int k = 0; k < nI; k++) s += B(q, k) * u[k];
    for (int k = 0; k < nN; k++) s += C(q, k) * in[k];
    vx[q] = s;
  }
  for (int q = 0; q < nX; q++) z[q] = sign[q] * (2 * gX[q] * vx[q] - z[q]);
  return ok;
}

void Circuit::response(double f, std::complex<double> *out, int input) const {
  using cd = std::complex<double>;
  const double w = 2 * 3.14159265358979323846 * f;
  std::vector<cd> M((size_t)nU * nU, 0.0), rhs(nU, 0.0);
  // the input: a voltage source at 1 V, or a current source's 1 A into its node; the other
  // sources held (AC ground, or open)
  auto known = [&](int n) -> cd { return n > 0 && col[n] < 0 && -1 - col[n] == input ? 1.0 : 0.0; };
  if (input >= nK) {
    const int n = net.currents[input - nK];
    if (n > 0 && col[n] >= 0) rhs[col[n]] += 1.0;
  }
  auto add = [&](int a, int b, cd y) {
    const int n[2] = {a, b};
    for (int s = 0; s < 2; s++) {
      const int i = n[s];
      if (i <= 0 || col[i] < 0) continue;
      for (int t = 0; t < 2; t++) {
        const int j = n[t];
        if (j <= 0) continue;
        const cd v = s == t ? y : -y;
        if (col[j] >= 0) M[(size_t)col[i] * nU + col[j]] += v; else rhs[col[i]] -= v * known(j);
      }
    }
  };
  for (int i = 0; i < nU; i++) M[(size_t)i * nU + i] += GMIN;
  for (const Netlist::Two &t : net.resistors) add(t.a, t.b, 1 / t.value);
  for (const Netlist::Two &t : net.capacitors) add(t.a, t.b, cd(0, w * t.value));
  for (const Netlist::Two &t : net.inductors) add(t.a, t.b, 1.0 / cd(0, w * t.value));
  // the junctions linearised at the operating point: i_p = Σ_q J_pq v_q, each v_q across (na, nb)
  std::vector<double> v(nN), i(nN), J((size_t)nN * nN);
  for (int q = 0; q < nN; q++) v[q] = dcV[na[q]] - dcV[nb[q]];
  junctions(v.data(), i.data(), J.data());
  for (int pp = 0; pp < nN; pp++) for (int q = 0; q < nN; q++) {
    const double g = J[pp * nN + q];
    if (g == 0) continue;
    // current g·(v_na[q] − v_nb[q]) leaves na[pp] and enters nb[pp]
    const int rows[2] = {na[pp], nb[pp]}, cols[2] = {na[q], nb[q]};
    for (int s = 0; s < 2; s++) {
      const int ri = rows[s];
      if (ri <= 0 || col[ri] < 0) continue;
      for (int t = 0; t < 2; t++) {
        const int cj = cols[t];
        if (cj <= 0) continue;
        const double y = (s == 0 ? 1 : -1) * (t == 0 ? 1 : -1) * g;
        if (col[cj] >= 0) M[(size_t)col[ri] * nU + col[cj]] += y; else rhs[col[ri]] -= y * known(cj);
      }
    }
  }
  solve(M.data(), rhs.data(), nU);
  for (int q = 0; q < nO; q++) out[q] = col[oa[q]] >= 0 ? rhs[col[oa[q]]] : known(oa[q]);
}

} // namespace phuzzbox::dk
