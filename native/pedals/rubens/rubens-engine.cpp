// rubens-engine.cpp — Rubens' Tube as an effect (rubens-engine.h).

#include "rubens-engine.h"

#include <algorithm>
#include <cmath>

namespace rubens {

Engine::Engine(double fs) : Effect(fs) {
  hpA = std::exp(-2 * kPi * 5 / fs);
  glide = 1 - std::exp(-1 / (0.02 * fs));
}

void Engine::setParams(const double *P) {
  pp = parts(P);
  const double h = 1 / fs;
  const Driver &d = kDriver;
  force = pp.force() * pp.Sd;
  // the trapezoidal rule's matrices for each mode, its frequency prewarped
  for (int n = 1; n <= pp.modes; n++) {
    const double wd = 2 / h * std::tan(std::min(pp.omega[n] * h / 2, 1.5)), s = pp.sigma[n];
    const double W2 = wd * wd + s * s;
    // A = [[0, 1], [−W2, −2s]], b = [F, −2s F]
    const double a11 = 1, a12 = -h / 2, a21 = h / 2 * W2, a22 = 1 + h * s; // I − hA/2
    const double det = a11 * a22 - a12 * a21;
    const double i11 = a22 / det, i12 = -a12 / det, i21 = -a21 / det, i22 = a11 / det;
    const double p11 = 1, p12 = h / 2, p21 = -h / 2 * W2, p22 = 1 - h * s;   // I + hA/2
    m11[n] = i11 * p11 + i12 * p21; m12[n] = i11 * p12 + i12 * p22;
    m21[n] = i21 * p11 + i22 * p21; m22[n] = i21 * p12 + i22 * p22;
    const double b1 = force * h / 2, b2 = -2 * s * force * h / 2;
    gq[n] = i11 * b1 + i12 * b2; gw[n] = i21 * b1 + i22 * b2;
    weightWant[n] = pp.weight[n];
  }
  for (int n = pp.modes + 1; n <= modes; n++) { q[n] = w[n] = 0; weightWant[n] = 0; } // modes now over the cutoff fall silent
  modes = pp.modes;
  G = 0;
  for (int n = 1; n <= modes; n++) G += gq[n];
  Rt = d.Rms() + d.Bl * d.Bl / d.Re;
  Kt = 1 / d.Cms + pp.Sd * pp.Sd * pp.spring();
  denom = d.Mms + h / 2 * Rt + h * h / 4 * Kt + h / 2 * pp.Sd * G;
  if (fresh) {
    std::copy(weightWant, weightWant + kMaxModes + 1, weight);
    driveNow = pp.drive;
    levelNow = pp.level;
  }
}

void Engine::reset() {
  std::fill(q, q + kMaxModes + 1, 0.0);
  std::fill(w, w + kMaxModes + 1, 0.0);
  xi = v = Q = u = hp = hpx = 0;
  std::copy(weightWant, weightWant + kMaxModes + 1, weight);
  driveNow = pp.drive;
  levelNow = pp.level;
  fresh = true;
}

double Engine::tail() const {
  // the slowest mode's 60 dB
  double s = 1e9;
  for (int n = 1; n <= modes; n++) s = std::min(s, pp.sigma[n]);
  return modes ? std::log(1000.0) / s : 0;
}

void Engine::process(const float *in, float *L, float *R, int n) {
  fresh = false;
  const Driver &d = kDriver;
  const double h = 1 / fs, motor = d.Bl / d.Re, spring = pp.spring() * pp.Sd;
  for (int i = 0; i < n; i++) {
    // a sample that isn't a number goes out as one, so the block is silenced and the pedal reset
    if (!std::isfinite(in[i])) { L[i] = R[i] = in[i]; continue; }
    driveNow += glide * (pp.drive - driveNow);
    levelNow += glide * (pp.level - levelNow);
    // the amplifier: its input's 5 Hz coupling, then the Drive
    const double x = in[i];
    hp = hpA * (hp + x - hpx);
    hpx = x;
    const double u1 = driveNow * hp;
    // the modes' part of the step that doesn't depend on the cone's new velocity
    double Qp = 0;
    for (int k = 1; k <= modes; k++) Qp += m11[k] * q[k] + m12[k] * w[k];
    const double s = (2 * d.Mms * v + h / 2 * (motor * (u1 + u) - 2 * Kt * xi - pp.Sd * (Qp + Q))) / denom;
    // the cone's new velocity is s − v; the modes move with s
    double out = 0, sum = 0;
    for (int k = 1; k <= modes; k++) {
      const double qn = m11[k] * q[k] + m12[k] * w[k] + gq[k] * s;
      const double wn = m21[k] * q[k] + m22[k] * w[k] + gw[k] * s;
      q[k] = qn;
      w[k] = wn;
      sum += qn;
      weight[k] += glide * (weightWant[k] - weight[k]);
      out += weight[k] * qn;
    }
    xi += h / 2 * s;
    v = s - v;
    Q = sum;
    u = u1;
    const double p = spring * xi + out;
    const float y = (float)(levelNow * kMic * p);
    L[i] = y;
    R[i] = y;
    if (++sinceFlush == 1024) {
      sinceFlush = 0;
      for (int k = 1; k <= modes; k++) { if (std::fabs(q[k]) < 1e-30) q[k] = 0; if (std::fabs(w[k]) < 1e-30) w[k] = 0; }
      if (std::fabs(xi) < 1e-30) xi = 0;
      if (std::fabs(v) < 1e-30) v = 0;
      if (std::fabs(hp) < 1e-30) hp = 0;
    }
  }
}

} // namespace rubens
