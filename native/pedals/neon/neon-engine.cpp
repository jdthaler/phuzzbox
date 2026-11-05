// neon-engine.cpp — the Neon Tremolo as an effect (neon-engine.h).

#include "neon-engine.h"

#include <cmath>

#include "neon-params.h"

namespace neon {

Engine::Engine(double rate) : Effect(rate) { traceEvery = (int)std::lround(rate / 240); }

void Engine::setParams(const double *P) {
  parts = neon::parts(P);
  if (!haveParams) { haveParams = true; reset(); }
}

void Engine::reset() {
  if (!haveParams) return; // a host may reset before it sets the parameters; setParams resets then
  // the oscillator running: the lamp just gone out, the cell dark
  osc.v = parts.Ve < parts.Vs ? parts.Ve : parts.Vs;
  osc.lit = false;
  nCell = 0;
  rCell = cellR(nCell);
  g = divider(parts, rCell);
  traceAt = traced = 0;
  peak = 0;
}

void Engine::process(const float *in, float *L, float *R, int n) {
  const double dt = 1 / fs;
  for (int i = 0; i < n; i++) {
    const bool wasLit = osc.lit;
    const double v0 = osc.v;
    const double q = advance(parts, osc, dt);
    nCell = cellStep(parts, q / dt / kIref, nCell, dt);
    rCell = cellR(nCell);
    g = divider(parts, rCell);
    if (messages) {
      const double i0 = current(parts, v0, wasLit), i1 = current(parts, osc.v, osc.lit), im = q / dt;
      peak = std::fmax(peak, std::fmax(i0, std::fmax(i1, im)));
    }
    // a sample that isn't a number goes out as one, so the block is silenced and the pedal reset
    if (!std::isfinite(in[i])) { L[i] = R[i] = in[i]; continue; }
    L[i] = R[i] = (float)(parts.gain * g * in[i]);
    if (messages && ++traceAt >= traceEvery) {
      traceAt = 0;
      float *p = msg.values + 4 * traced;
      p[0] = (float)osc.v;
      p[1] = (float)(1e3 * peak);
      p[2] = (float)(rCell * 1e-3);
      p[3] = (float)(20 * std::log10(g));
      peak = 0;
      if (++traced == 5) {
        msg.type = kTrace;
        msg.count = 20;
        post(msg);
        traced = 0;
      }
    }
  }
}

} // namespace neon
