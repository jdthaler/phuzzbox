// helmholtz-engine.cpp — Helmholtz's Resonators as an effect (helmholtz-engine.h).

#include "helmholtz-engine.h"

#include <algorithm>
#include <cmath>

namespace helmholtz {

Engine::Engine(double fs) : Effect(fs) { glide = 1 - std::exp(-1 / (0.02 * fs)); }

void Engine::setParams(const double *P) {
  pp = parts(P);
  for (int j = 0; j < kCount; j++) {
    g[j] = std::tan(kPi * std::min(pp.res[j].f0 / fs, 0.45));
    k[j] = 1 / pp.res[j].Q;
  }
  if (fresh) {
    for (int j = 0; j < kCount; j++) gain[j] = j == pp.one ? 1 : 0;
    earNow = pp.openEar;
    levelNow = pp.level;
  }
}

void Engine::reset() {
  std::fill(s1, s1 + kCount, 0.0);
  std::fill(s2, s2 + kCount, 0.0);
  for (int j = 0; j < kCount; j++) gain[j] = j == pp.one ? 1 : 0;
  earNow = pp.openEar;
  levelNow = pp.level;
  fresh = true;
}

double Engine::tail() const {
  // the resonator at your ear dying by 60 dB: its amplitude decays at ω0/2Q
  const Resonator &r = pp.res[pp.one];
  return std::log(1000.0) * 2 * r.Q / r.w0;
}

void Engine::process(const float *in, float *L, float *R, int n) {
  fresh = false;
  for (int i = 0; i < n; i++) {
    // a sample that isn't a number goes out as one, so the block is silenced and the pedal reset
    if (!std::isfinite(in[i])) { L[i] = R[i] = in[i]; continue; }
    earNow += glide * (pp.openEar - earNow);
    levelNow += glide * (pp.level - levelNow);
    const double x = in[i];
    double y = 0;
    for (int j = 0; j < kCount; j++) {
      // the trapezoidal state-variable filter: its lowpass is the pressure inside
      const double hp = (x - (k[j] + g[j]) * s1[j] - s2[j]) / (1 + g[j] * (k[j] + g[j]));
      const double bp = g[j] * hp + s1[j];
      const double lp = g[j] * bp + s2[j];
      s1[j] = g[j] * hp + bp;
      s2[j] = g[j] * bp + lp;
      gain[j] += glide * ((j == pp.one ? 1.0 : 0.0) - gain[j]);
      y += gain[j] * lp;
    }
    const float out = (float)(levelNow * (y + earNow * x));
    L[i] = out;
    R[i] = out;
    if (++sinceFlush == 1024) {
      sinceFlush = 0;
      for (int j = 0; j < kCount; j++) {
        if (std::fabs(s1[j]) < 1e-30) s1[j] = 0;
        if (std::fabs(s2[j]) < 1e-30) s2[j] = 0;
        if (gain[j] < 1e-12) gain[j] = 0;
      }
    }
  }
}

} // namespace helmholtz
