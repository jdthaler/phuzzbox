// tunnel-engine.cpp — the Tunnel Diode as an effect (tunnel-engine.h).

#include "tunnel-engine.h"

#include <cmath>

#include "tunnel-params.h"

namespace tunnel {

namespace {
constexpr double kGlide = 0.05; // the Bias's, the Drive's and the Level's glide (s)
}

Engine::Engine(double rate) : Effect(rate) { setQuality(phuzzbox::Quality::high); }

void Engine::setQuality(phuzzbox::Quality q) {
  Effect::setQuality(q);
  os.setup(fs, pick(4, 2, 1));
  latencySamples = (int)std::lround(os.delay(fs));
  dc = phuzzbox::DCBlock(5, fs);
  alpha = 1 - std::exp(-1 / (kGlide * fs));
  cx.h = 1 / (fs * os.factor());
  if (!fresh) rest();
}

void Engine::setParams(const double *P) {
  const bool wasOsc = p.osc;
  p = tunnel::parts(P);
  if (fresh) { // until the first sample, a new circuit starts at rest rather than gliding there
    biasNow = p.bias; driveNow = p.drive; levelNow = p.level;
    rest();
  } else if (wasOsc != p.osc) {
    cx.i = (biasNow - cx.V) / p.R; // the inductor switched in or out: the current the load carries now
  }
}

void Engine::reset() {
  os.reset();
  pointAt = points = 0;
  fresh = true;
  biasNow = p.bias; driveNow = p.drive; levelNow = p.level;
  rest();
}

void Engine::rest() {
  cx.start(p, biasNow, 1 / (fs * os.factor()));
  // the decimator and the coupling capacitor settled on the resting voltage, so starting doesn't thump
  os.reset();
  for (int k = 0; k < 4096; k++) os.downsample(cx.V);
  dc.reset();
  dc.x1 = cx.V;
}

void Engine::process(const float *in, float *L, float *R, int n) {
  fresh = false;
  const int M = os.factor();
  for (int i = 0; i < n; i++) {
    // a sample that isn't a number goes out as one, so the block is silenced and the pedal reset
    // (px_process), rather than into the oversampler, where it would stay
    if (!std::isfinite(in[i])) { L[i] = R[i] = in[i]; continue; }
    biasNow += alpha * (p.bias - biasNow);
    driveNow += alpha * (p.drive - driveNow);
    levelNow += alpha * (p.level - levelNow);
    double out = 0, vs = biasNow;
    for (int m = 0; m < M; m++) {
      vs = biasNow + driveNow * os.upsample(in[i], m);
      out = os.downsample(cx.step(p, vs));
    }
    const float v = (float)(levelNow * dc.run(out));
    L[i] = v;
    R[i] = v;
    if (messages && ++pointAt >= pointEvery) { // a point for the page's view of the diode
      pointAt = 0;
      msg.values[3 * points] = (float)vs;
      msg.values[3 * points + 1] = (float)cx.V;
      msg.values[3 * points + 2] = (float)cx.i;
      if (++points == 10) {
        msg.type = kPoints;
        msg.count = 30;
        post(msg);
        points = 0;
      }
    }
  }
}

} // namespace tunnel
