// bandgap-engine.cpp — the Bandgap as an effect (bandgap-engine.h).

#include "bandgap-engine.h"

#include <algorithm>
#include <cmath>

#include "bandgap-params.h"

namespace bandgap {

namespace {
const double kGamma = 2 - std::sqrt(2.0); // TR-BDF2's split: the trapezoidal stage covers γ of the step

// solve A d = b in place for the circuit's pattern: the op-amp's output, vf and vg couple among
// themselves (rows 0–2), and vd hangs off the output alone (row 3: a30 and a33). Cramer's rule on
// the 3 × 3, then vd.
bool solve4(const double *A, double *b) {
  const double a00 = A[0], a01 = A[1], a02 = A[2], a10 = A[4], a11 = A[5], a12 = A[6], a20 = A[8], a21 = A[9], a22 = A[10];
  const double c0 = a11 * a22 - a12 * a21, c1 = a12 * a20 - a10 * a22, c2 = a10 * a21 - a11 * a20;
  const double det = a00 * c0 + a01 * c1 + a02 * c2;
  if (det == 0 || A[15] == 0) return false;
  const double b0 = b[0], b1 = b[1], b2 = b[2];
  const double x0 = (b0 * c0 + a01 * (a12 * b2 - b1 * a22) + a02 * (b1 * a21 - a11 * b2)) / det;
  const double x1 = (a00 * (b1 * a22 - a12 * b2) + b0 * (a12 * a20 - a10 * a22) + a02 * (a10 * b2 - b1 * a20)) / det;
  const double x2 = (a00 * (a11 * b2 - b1 * a21) + a01 * (b1 * a20 - a10 * b2) + b0 * (a10 * a21 - a11 * a20)) / det;
  b[0] = x0; b[1] = x1; b[2] = x2;
  b[3] = (b[3] - A[12] * x0) / A[15];
  return true;
}
} // namespace

Engine::Engine(double rate) : Effect(rate) { setQuality(phuzzbox::Quality::high); }

void Engine::setQuality(phuzzbox::Quality q) {
  Effect::setQuality(q);
  os.setup(fs, pick(4, 2, 1));
  latencySamples = (int)std::lround(os.delay(fs));
  h = 1 / (fs * os.factor());
}

void Engine::setParams(const double *P) {
  parts = bandgap::parts(P);
  if (!haveParams) { haveParams = true; reset(); return; }
  // a knob turned while it plays keeps the state, so the sound carries on from where it was
  double J[16];
  derivatives(parts, y, lastIn, f0, J, &id);
}

void Engine::reset() {
  os.reset();
  for (int i = 0; i < 4; i++) y[i] = yPrev[i] = 0; // no bias: the op-amp and the diodes sit at 0 V with nothing in
  lastIn = 0;
  double J[16];
  derivatives(parts, y, 0, f0, J, &id);
  pointAt = points = 0;
}

// Newton on y − a f(y, vin) = r, from the y given; the Jacobian I − a ∂f/∂y. A step is held to
// 0.2 V on the diodes and 1 V on the others, so the diodes' exponential can't throw it far.
bool Engine::solve(double *yy, double a, const double *r, double vin, int &its) {
  double f[4], J[16], A[16], g[4];
  for (its = 1; its <= 40; its++) {
    derivatives(parts, yy, vin, f, J, &id);
    for (int i = 0; i < 4; i++) {
      g[i] = r[i] - (yy[i] - a * f[i]);
      for (int j = 0; j < 4; j++) A[i * 4 + j] = (i == j) - a * J[i * 4 + j];
    }
    if (!solve4(A, g)) return false;
    double big = 0;
    for (int i = 0; i < 4; i++) {
      const double lim = i == 3 ? 0.2 : 1.0, d = std::clamp(g[i], -lim, lim);
      yy[i] += d;
      big = std::max(big, std::fabs(g[i]));
    }
    // a step under 10 µV leaves an error near its square over the curves' scale (10 mV at the
    // rail, more on the diodes and the input pair): under 10 nV, 140 dB below a bass
    if (big < 1e-5) return true;
  }
  return false;
}

double Engine::step(double vin) {
  const double vg = lastIn + kGamma * (vin - lastIn); // the input part way through the step, by a straight line
  // the trapezoidal stage to t + γh: y_g − (γh/2) f(y_g) = y + (γh/2) f(y)
  double yg[4], r[4], y1[4];
  const double a1 = kGamma * h / 2;
  // the guess: the last step's straight line carried on
  for (int i = 0; i < 4; i++) { r[i] = y[i] + a1 * f0[i]; yg[i] = y[i] + kGamma * (y[i] - yPrev[i]); }
  int it1 = 0, it2 = 0;
  bool ok = solve(yg, a1, r, vg, it1);
  if (!ok) { for (int i = 0; i < 4; i++) yg[i] = y[i]; ok = solve(yg, a1, r, vg, it1); }
  // the second-order backward difference to t + h:
  //   y1 − ((1 − γ)/(2 − γ)) h f(y1) = (y_g − (1 − γ)² y) / (γ (2 − γ))
  const double a2 = (1 - kGamma) / (2 - kGamma) * h, k = kGamma * (2 - kGamma);
  for (int i = 0; i < 4; i++) { r[i] = (yg[i] - (1 - kGamma) * (1 - kGamma) * y[i]) / k; y1[i] = yg[i] + (1 - kGamma) / kGamma * (yg[i] - y[i]); }
  bool ok2 = solve(y1, a2, r, vin, it2);
  if (!ok2) { for (int i = 0; i < 4; i++) y1[i] = yg[i]; ok2 = solve(y1, a2, r, vin, it2); }
  if (!ok || !ok2 || !std::isfinite(y1[0] + y1[1] + y1[2] + y1[3])) {
    failures++; // never seen: keep the last state rather than a wild one
    double J[16];
    derivatives(parts, y, vin, f0, J, &id);
  } else {
    // the derivatives at the new state, for the next step's trapezoid: y1 − a2 f(y1) = r says them
    for (int i = 0; i < 4; i++) { yPrev[i] = y[i]; y[i] = y1[i]; f0[i] = (y1[i] - r[i]) / a2; }
  }
  lastIn = vin;
  iterations += it1 + it2; steps++;
  itersSincePost += it1 + it2; stepsSincePost++;
  return y[3];
}

void Engine::process(const float *in, float *L, float *R, int n) {
  const int M = os.factor();
  for (int i = 0; i < n; i++) {
    double out = 0;
    for (int m = 0; m < M; m++) out = os.downsample(step(os.upsample(in[i], m)));
    const float v = (float)(parts.gain * out);
    L[i] = v;
    R[i] = v;
    if (messages && ++pointAt >= pointEvery) { // a point for the page's view of the diodes
      pointAt = 0;
      float *pt = msg.values + 4 * points;
      const double e = lastIn - (y[0] - y[1]);
      pt[0] = (float)y[3]; pt[1] = (float)id; pt[2] = (float)y[0]; pt[3] = (float)(e / parts.Vs);
      if (++points == 7) {
        msg.type = kPoints;
        msg.count = 30;
        msg.values[28] = (float)parts.rail;
        msg.values[29] = stepsSincePost ? (float)itersSincePost / stepsSincePost : 0;
        post(msg);
        points = 0;
        itersSincePost = stepsSincePost = 0;
      }
    }
  }
}

} // namespace bandgap
