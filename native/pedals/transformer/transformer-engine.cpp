// transformer-engine.cpp — the Output Transformer as an effect (transformer-engine.h).

#include "transformer-engine.h"

#include <cmath>

#include "transformer-params.h"

namespace transformer {

namespace {
// the glide of the Drive, the Plate resistance, the Core's area and the Level (s): a step in the
// area would step the flux, and the primary's voltage with it
constexpr double kGlide = 0.05;
}

Engine::Engine(double rate) : Effect(rate) { setQuality(phuzzbox::Quality::high); }

void Engine::setQuality(phuzzbox::Quality q) {
  Effect::setQuality(q);
  os.setup(fs, pick(2, 1, 1));
  latencySamples = (int)std::lround(os.delay(fs));
  alpha = 1 - std::exp(-1 / (kGlide * fs));
}

void Engine::setParams(const double *P) {
  const Core *was = p.core;
  p = transformer::parts(P);
  if (fresh) {
    now = p; // until the first sample the parts snap to the knobs
  } else {
    now.core = p.core;
    if (was != p.core) tx.reset(); // a new core: demagnetised, as a new part is
  }
}

void Engine::reset() {
  os.reset();
  tx.reset();
  pointAt = points = 0;
  fresh = true;
  now = p;
}

void Engine::process(const float *in, float *L, float *R, int n) {
  fresh = false;
  const int M = os.factor();
  const double h = 1 / (fs * M);
  for (int i = 0; i < n; i++) {
    // a sample that isn't a number goes out as one, so the block is silenced and the pedal reset
    // (px_process), rather than into the oversampler, where it would stay
    if (!std::isfinite(in[i])) { L[i] = R[i] = in[i]; continue; }
    now.drive += alpha * (p.drive - now.drive);
    now.Rs += alpha * (p.Rs - now.Rs);
    now.A += alpha * (p.A - now.A);
    now.level += alpha * (p.level - now.level);
    const double g = now.drive * now.divider();
    double out = 0;
    for (int m = 0; m < M; m++) out = os.downsample(tx.step(now, g * os.upsample(in[i], m), h));
    const float v = (float)(now.level * out / g);
    L[i] = v;
    R[i] = v;
    if (messages && ++pointAt >= pointEvery) { // a point for the page's view of the core
      pointAt = 0;
      msg.values[2 * points] = (float)tx.H;
      msg.values[2 * points + 1] = (float)tx.B();
      if (++points == 10) {
        msg.type = kPoints;
        msg.count = 20;
        post(msg);
        points = 0;
      }
    }
  }
}

} // namespace transformer
