// lampvibe-engine.cpp — the Lamp Vibe as an effect (lampvibe-engine.h).

#include "lampvibe-engine.h"

#include <cmath>

#include "lampvibe-params.h"

namespace lampvibe {

namespace {
constexpr double kPi = 3.14159265358979323846;
} // namespace

Engine::Engine(double rate) : Effect(rate) { traceEvery = (int)std::lround(rate / 120); }

void Engine::setParams(const double *P) {
  const Lamp *was = haveParams ? parts.lamp : nullptr;
  parts = lampvibe::parts(P);
  if (!haveParams) { haveParams = true; reset(); }
  else if (was != parts.lamp) T = steadyT(parts.fil, v); // a new lamp in the socket, already glowing
}

void Engine::reset() {
  if (!haveParams) return; // a host may reset before it sets the parameters; setParams resets then
  theta = 0;
  v = lampVoltage(parts, 0);
  T = steadyT(parts.fil, v);
  light = glow(T, parts.lamp->T);
  nCell = steadyN(light);
  rCell = cellR(parts, nCell);
  for (int k = 0; k < kStages; k++) { s[k] = 0; G[k] = 0; dG[k] = 0; }
  at = 0;
  control();
  for (int k = 0; k < kStages; k++) { G[k] += kEvery * dG[k]; dG[k] = 0; }
  at = 0;
  traceAt = traced = 0;
}

void Engine::control() {
  const double dt = kEvery / fs;
  theta += 2 * kPi * parts.speed * dt;
  if (theta > 2 * kPi) theta -= 2 * kPi;
  v = lampVoltage(parts, std::sin(theta));
  T = filamentStep(parts.fil, v, T, dt);
  light = glow(T, parts.lamp->T);
  nCell = cellStep(parts, light, nCell, dt);
  rCell = cellR(parts, nCell);
  // each stage's corner, prewarped: g = tan(π f/fs), G = g/(1 + g), reached over the next step
  for (int k = 0; k < kStages; k++) {
    const double f = std::fmin(1 / (2 * kPi * rCell * parts.C[k]), 0.45 * fs), g = std::tan(kPi * f / fs);
    dG[k] = (g / (1 + g) - G[k]) / kEvery;
  }
}

void Engine::process(const float *in, float *L, float *R, int n) {
  for (int i = 0; i < n; i++) {
    if (at == 0) control();
    if (++at == kEvery) at = 0;
    // a sample that isn't a number goes out as one, so the block is silenced and the pedal reset
    if (!std::isfinite(in[i])) { L[i] = R[i] = in[i]; continue; }
    const double x = in[i];
    double y = x;
    for (int k = 0; k < kStages; k++) {
      G[k] += dG[k];
      const double u = (y - s[k]) * G[k], lp = u + s[k];
      s[k] = lp + u;
      y = 2 * lp - y; // the phase splitter's two halves, mixed: (1 − sRC)/(1 + sRC)
    }
    const double out = parts.gain * (parts.vibrato ? y : 0.5 * (x + y));
    L[i] = R[i] = (float)out;
    if (messages && ++traceAt >= traceEvery) {
      traceAt = 0;
      float *p = msg.values + 5 * traced;
      p[0] = (float)T;
      p[1] = (float)(1e3 * v / resistance(parts.fil, T));
      p[2] = (float)light;
      p[3] = (float)(rCell * 1e-3);
      p[4] = (float)v;
      if (++traced == 5) {
        msg.type = kTrace;
        msg.count = 25;
        post(msg);
        traced = 0;
      }
    }
  }
}

} // namespace lampvibe
