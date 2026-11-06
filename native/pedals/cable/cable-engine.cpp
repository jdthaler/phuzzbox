// cable-engine.cpp — the Transatlantic Cable as an effect (cable-engine.h).

#include "cable-engine.h"

#include <algorithm>
#include <cmath>

#include "cable-params.h"

namespace cable {

Engine::Engine(double rate) : Effect(rate) {
  x.assign(2 * kMaxSections, 0);
  for (auto *v : {&qd, &qe, &cp, &inv, &rhs}) v->assign(2 * kMaxSections, 0);
  int size = 1;
  while (size < 0.25 * rate) size <<= 1; // room for a quarter-second line
  fwd.assign(size, 0);
  bwd.assign(size, 0);
  mask = size - 1;
  alongEvery = (int)std::lround(rate / 30);
}

void Engine::setParams(const double *P) {
  const Parts was = parts;
  parts = cable::parts(P);
  const bool same = haveParams && was.loading == parts.loading && was.sections == parts.sections && was.per == parts.per;
  factor();
  if (!haveParams) { haveParams = true; reset(); }
  else if (!same) reset(); // a different line: start it quiet
}

void Engine::reset() {
  std::fill(x.begin(), x.end(), 0);
  std::fill(fwd.begin(), fwd.end(), 0);
  std::fill(bwd.begin(), bwd.end(), 0);
  uPrev = lastFar = 0;
  at = alongAt = 0;
}

void Engine::factor() {
  if (parts.loading == heaviside) {
    const double zs = parts.source, zl = parts.load, z = parts.z0;
    tauS = z / (zs + z);
    gammaS = (zs - z) / (zs + z);
    gammaL = (zl - z) / (zl + z);
    n2 = 0;
    return;
  }
  // M x' = A x + b u, M = diag(Ls, Cs, Ls, Cs, …); the trapezoidal rule:
  // (M − h/2 A) x₁ = (M + h/2 A) x₀ + h/2 b (u₀ + u₁). A's off-diagonals are all ±1 (each branch's
  // current leaves one node and enters the next), so the system's are ±h/2, and only its diagonal
  // (the branches' resistances and the nodes' leakances) differs from row to row.
  const int N = parts.sections;
  n2 = 2 * N;
  const double h2 = 0.5 / fs;
  for (int j = 0; j < n2; j++) {
    double m, a;
    if (j % 2 == 0) { // a series branch: Ls i' = v_left − v_right − Rs i (and a coil before every per-th)
      m = parts.Ls + (parts.loading == coils && (j / 2) % parts.per == 0 ? parts.coil : 0);
      a = -(parts.Rs + (j == 0 ? parts.source : 0));
    } else {          // a node: Cs v' = i_in − i_out − Gs v
      m = parts.Cs;
      a = -(parts.Gs + (j == n2 - 1 ? 1 / parts.load : 0));
    }
    qd[j] = m + h2 * a;
    // Thomas's forward sweep on the left side (sub-diagonal −h/2, super-diagonal +h/2), kept:
    // pivots' reciprocals and c'ⱼ = (h/2) / pivotⱼ
    const double piv = m - h2 * a + (j ? h2 * cp[j - 1] : 0);
    inv[j] = 1 / piv;
    cp[j] = h2 * inv[j];
    qe[j] = qd[j] * inv[j];
  }
}

double Engine::stepLadder(double u) {
  // the right-hand side, h/2 (x_{j−1} − x_{j+1}) + qdⱼ xⱼ, and Thomas's forward sweep in one pass,
  // then back substitution
  const int last = n2 - 1;
  const double h2 = 0.5 / fs;
  const double *d = qd.data(), *iv = inv.data(), *c = cp.data(), *e = qe.data();
  double *s = x.data(), *r = rhs.data();
  double prev = r[0] = (d[0] * s[0] - h2 * s[1] + h2 * (uPrev + u)) * iv[0];
  uPrev = u;
  // (written so that each row waits on the last for one multiply and one add)
  for (int j = 1; j < last; j++) r[j] = prev = c[j] * prev + (c[j] * (s[j - 1] - s[j + 1]) + e[j] * s[j]);
  double next = s[last] = (h2 * (s[last - 1] + prev) + d[last] * s[last]) * iv[last];
  for (int j = last - 1; j >= 0; j--) s[j] = next = r[j] - c[j] * next;
  return s[last];
}

double Engine::read(const std::vector<double> &buf, double back) const {
  // cubic (Catmull–Rom) interpolation, back samples behind the newest
  const double d = std::max(1.0, back);
  const int i = (int)d;
  const double t = d - i;
  auto s = [&](int k) { return buf[(at - k) & mask]; };
  const double a = s(i - 1), b = s(i), c = s(i + 1), e = s(i + 2);
  return b + t * (0.5 * (c - a) + t * ((a - 2.5 * b + 2 * c - 0.5 * e) + t * (1.5 * (b - c) + 0.5 * (e - a))));
}

double Engine::stepWaves(double u) {
  // the wave arriving at each end, a line's delay and loss after it set out
  // (read before this step's write, so the newest is a sample old)
  const double back = parts.delay * fs - 1;
  const double toFar = parts.loss * read(fwd, back), toNear = parts.loss * read(bwd, back);
  at = (at + 1) & mask;
  fwd[at] = tauS * u + gammaS * toNear;
  bwd[at] = gammaL * toFar;
  return lastFar = (1 + gammaL) * toFar;
}

double Engine::along(int k) const {
  const double f = (k + 0.5) / 24;
  if (parts.loading == heaviside) {
    // the forward wave a fraction f of the way, and the backward one (1 − f) of the way back
    auto rd = [&](const std::vector<double> &buf, double frac) {
      return std::pow(parts.loss, frac) * read(buf, frac * parts.delay * fs);
    };
    return rd(fwd, f) + rd(bwd, 1 - f);
  }
  const int node = std::min(parts.sections - 1, (int)(f * parts.sections));
  return x[2 * node + 1];
}

void Engine::process(const float *in, float *L, float *R, int n) {
  for (int i = 0; i < n; i++) {
    // a sample that isn't a number goes out as one, so the block is silenced and the pedal reset
    if (!std::isfinite(in[i])) { L[i] = R[i] = in[i]; continue; }
    const double v = parts.loading == heaviside ? stepWaves(in[i]) : stepLadder(in[i]);
    L[i] = R[i] = (float)(parts.gain * v);
    if (messages && ++alongAt >= alongEvery) {
      alongAt = 0;
      for (int k = 0; k < 24; k++) msg.values[k] = (float)along(k);
      msg.values[24] = (float)v;
      msg.type = kAlong;
      msg.count = 25;
      post(msg);
    }
  }
}

} // namespace cable
