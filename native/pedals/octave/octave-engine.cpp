// octave-engine.cpp — the Octave Down as an effect (octave-engine.h).

#include "octave-engine.h"

#include <cmath>

namespace octave {

Engine::Engine(double fs) : Effect(fs) {
  for (int i = 0; i < kParamCount; i++) P[i] = kParams[i].def;
  every = (int)std::lround(0.010 * fs);
  setParams(P);
  reset();
}

void Engine::reset() {
  t1.s = t2.s = o1.s = o2.s = 0;
  xf = y1 = y2 = 0;
  c = -1; q1 = 1; q2 = 1;
  since = period = 0;
}

void Engine::setParams(const double *Pn) {
  for (int i = 0; i < kParamCount; i++) P[i] = Pn[i];
  M = model(P);
  t1.set(M.track, fs); t2.set(M.track, fs);
  o1.set(M.tone, fs); o2.set(M.tone, fs);
}

void Engine::step(double x) {
  xf = t2.run(t1.run(x));
  since++;
  // the comparator, with hysteresis: it rises past +h and falls past −h
  if (c < 0 && xf > M.hyst) {
    c = 1;
    period = since; since = 0;
    q1 = -q1;                 // flip-flop 1 toggles on the comparator's rising edge
    if (q1 > 0) q2 = -q2;     // flip-flop 2 on flip-flop 1's
  } else if (c > 0 && xf < -M.hyst) {
    c = -1;
  }
  y1 = o1.run(q1 * xf);
  y2 = o2.run(q2 * xf);
}

void Engine::process(const float *in, float *L, float *R, int n) {
  for (int i = 0; i < n; i++) {
    const double x = in[i];
    step(x);
    const float out = (float)(M.level * (M.dry * x + M.oct1 * y1 + M.oct2 * y2));
    L[i] = out;
    R[i] = out;
    if (messages && ++at >= every) {
      at = 0;
      msg.type = kState;
      msg.count = 3;
      // toggling if it rose within the last two periods, or 0.1 s
      const bool live = period > 0 && since < 2 * period + (long)(0.1 * fs);
      msg.values[0] = live ? (float)(fs / period) : 0.f;
      msg.values[1] = (float)q1;
      msg.values[2] = (float)q2;
      post(msg);
    }
  }
  t1.flush(); t2.flush(); o1.flush(); o2.flush();
}

} // namespace octave
