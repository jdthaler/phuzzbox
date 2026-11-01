// envelope-engine.cpp — the Envelope Filter as an effect (envelope-engine.h).

#include "envelope-engine.h"

#include <cmath>

namespace envelope {

Engine::Engine(double fs) : Effect(fs) {
  for (int i = 0; i < kParamCount; i++) P[i] = kParams[i].def;
  every = (int)std::lround(0.010 * fs);
  setParams(P);
  started = false; // the host's first parameters seat the cells again
}

void Engine::reset() {
  env = 0;
  s1 = s2 = 0;
  // the cells settled in the light the LED gives at rest (none up, the standing current down)
  const double L = light(M, 0);
  n = steadyN(L);
  const double cap = CAPTURE * n;
  m = cap * TRAPS / (cap + 1 / M.tauE); // the traps in balance: k n (N − m) = m/τe
}

void Engine::setParams(const double *Pn) {
  for (int i = 0; i < kParamCount; i++) P[i] = Pn[i];
  M = model(P);
  // the first parameters seat the cells in the light they rest in (Down rests lit)
  if (!started) { started = true; reset(); }
}

void Engine::process(const float *in, float *L, float *R, int count) {
  const double h = 1 / fs;
  const double ca = std::exp(-h * (1 / M.ta + 1 / M.td)), va = M.td / (M.ta + M.td), cd = std::exp(-h / M.td);
  const double k = 1 / M.q, wet = M.level * (1 - M.blend), dry = M.level * M.blend;
  for (int i = 0; i < count; i++) {
    const double x = in[i];
    // the follower and the cells, then the filter with the integrators' resistance they make
    env = follow(env, std::abs(M.gain * x), ca, va, cd);
    if (env < 1e-30) env = 0;
    const double Lt = light(M, env);
    cellStep(M, Lt, n, m, h);
    const double r = filterR(M, n), g = h / (2 * r * M.c); // ωT/2: the trapezoidal rule
    const double hp = (x - (k + g) * s1 - s2) / (1 + g * (g + k));
    const double v1 = g * hp, bp = v1 + s1;
    s1 = bp + v1;
    const double v2 = g * bp, lp = v2 + s2;
    s2 = lp + v2;
    if (std::abs(s1) < 1e-30) s1 = 0;
    if (std::abs(s2) < 1e-30) s2 = 0;
    const double y = M.mode == 0 ? lp : M.mode == 1 ? bp : hp;
    const float out = (float)(wet * y + dry * x);
    L[i] = out;
    R[i] = out;
    if (messages && ++at >= every) {
      at = 0;
      msg.type = kState;
      msg.count = 6;
      msg.values[0] = (float)(1 / (2 * PI * r * M.c));
      msg.values[1] = (float)env;
      msg.values[2] = (float)(Lt * I_REF * 1e3);
      msg.values[3] = (float)n;
      msg.values[4] = (float)(m / TRAPS);
      msg.values[5] = (float)cellR(M, n);
      post(msg);
    }
  }
}

} // namespace envelope
