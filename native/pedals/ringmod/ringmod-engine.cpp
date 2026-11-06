// ringmod-engine.cpp — the Ring Modulator as an effect (ringmod-engine.h).

#include "ringmod-engine.h"

#include <cmath>

#include "ringmod-params.h"

namespace ringmod {

Engine::Engine(double rate) : Effect(rate) { setQuality(phuzzbox::Quality::high); }

void Engine::setQuality(phuzzbox::Quality q) {
  Effect::setQuality(q);
  os.setup(fs, pick(4, 2, 1));
  latencySamples = (int)std::lround(os.delay(fs));
  h = 1 / (fs * os.factor());
}

void Engine::setParams(const double *P) {
  parts = ringmod::parts(P);
  // a knob turned while it plays keeps the ring, the transformers' currents and the carrier's phase
  if (!haveParams) { haveParams = true; reset(); }
}

void Engine::reset() {
  os.reset();
  ring = last = before = Ring{};
  iL1 = iL2 = 0;
  phase = 0;
  pointAt = points = 0;
}

double Engine::step(double vin) {
  phase += parts.fc * h;
  if (phase >= 1) phase -= std::floor(phase);
  const double vcar = carrierAt(parts, phase);
  // the inductors by the trapezoidal rule: i' = i + (h/2L)(v + v') = G v' + J
  const double G = h / (2 * parts.L), J1 = iL1 + G * last.u, J2 = iL2 + G * last.w;
  // the guess: the last two steps' straight line carried on
  ring.u = 2 * last.u - before.u; ring.vc = 2 * last.vc - before.vc; ring.w = 2 * last.w - before.w;
  int its = solve(parts, vin, vcar, G, J1, G, J2, ring);
  if (!its) { ring = last; its = solve(parts, vin, vcar, G, J1, G, J2, ring); }
  if (!its || !std::isfinite(ring.u + ring.vc + ring.w)) {
    failures++; // never seen: keep the last state rather than a wild one
    ring = last;
  } else {
    iL1 = G * ring.u + J1;
    iL2 = G * ring.w + J2;
  }
  before = last;
  last = ring;
  iterations += its; steps++;
  itersSincePost += its; stepsSincePost++;
  return parts.mix * parts.makeup * ring.w + (1 - parts.mix) * vin;
}

void Engine::process(const float *in, float *L, float *R, int n) {
  const int M = os.factor();
  for (int i = 0; i < n; i++) {
    // a sample that isn't a number goes out as one, so the block is silenced and the pedal reset
    // (px_process), rather than into the oversampler, where it would stay
    if (!std::isfinite(in[i])) { L[i] = R[i] = in[i]; continue; }
    double out = 0;
    for (int m = 0; m < M; m++) out = os.downsample(step(os.upsample(in[i], m)));
    const float v = (float)(parts.gain * out);
    L[i] = v;
    R[i] = v;
    if (messages && ++pointAt >= pointEvery) { // a point for the page's view of the ring
      pointAt = 0;
      float *pt = msg.values + 7 * points;
      pt[0] = (float)carrierAt(parts, phase); pt[1] = (float)ring.u; pt[2] = (float)ring.w;
      for (int k = 0; k < 4; k++) pt[3 + k] = (float)ring.i[k];
      if (++points == 4) {
        msg.type = kPoints;
        msg.count = 30;
        msg.values[28] = stepsSincePost ? (float)itersSincePost / stepsSincePost : 0;
        msg.values[29] = (float)parts.fc;
        post(msg);
        points = 0;
        itersSincePost = stepsSincePost = 0;
      }
    }
  }
}

} // namespace ringmod
