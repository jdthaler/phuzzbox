// radio-engine.cpp — the Crystal Radio as an effect (radio-engine.h).

#include "radio-engine.h"

#include <cmath>

#include "radio-params.h"

namespace radio {

namespace {
constexpr double kTau = 6.28318530717958647692;
constexpr double kGlide = 0.05; // the knobs' glide (s)
}

Engine::Engine(double rate) : Effect(rate) { setQuality(phuzzbox::Quality::high); }

void Engine::setQuality(phuzzbox::Quality q) {
  Effect::setQuality(q);
  os.setup(fs, pick(4, 2, 1));
  latencySamples = (int)std::lround(os.delay(fs));
  h = 1 / (fs * os.factor());
  dc = phuzzbox::DCBlock(5, fs);
  alpha = 1 - std::exp(-1 / (kGlide * fs));
  if (!fresh) rx.start(now, h);
  else fresh = true;
}

double Engine::amplifierGain(const Parts &p) const {
  const double s = slope(p, p.Ac);
  return p.level / (p.k * p.Ac * (s > 0 ? s : 1));
}

void Engine::setParams(const double *P) {
  target = radio::parts(P);
  gainTarget = amplifierGain(target);
  // until the first sample, a new set starts at rest on its carrier rather than gliding there
  if (fresh) glide(true);
}

void Engine::glide(bool snap) {
  if (snap) {
    now = target;
    gainNow = gainTarget;
    rx.start(now, h);
    rest = rx.V;
    return;
  }
  // the knobs that move smoothly: the signal, the modulation, the tuning, Q and the next station;
  // the station, the load, the capacitor and the diode switch at once
  const double a = alpha;
  auto move = [a](double &x, double to) { const double d = to - x; if (d == 0) return false; x = std::fabs(d) < 1e-9 * std::fabs(to) ? to : x + a * d; return true; };
  bool moved = false;
  moved |= move(now.Ac, target.Ac);
  moved |= move(now.k, target.k);
  moved |= move(now.tune, target.tune);
  moved |= move(now.Q, target.Q);
  moved |= move(now.B, target.B);
  if (now.fs != target.fs || now.R != target.R || now.C != target.C || now.is != target.is || now.nvt != target.nvt) {
    now.fs = target.fs; now.R = target.R; now.C = target.C; now.is = target.is; now.nvt = target.nvt;
    moved = true;
  }
  move(gainNow, gainTarget);
  if (moved) {
    rx.retune(now);
    rest = settle(now, restingAmplitude(now));
  }
}

void Engine::reset() {
  os.reset();
  dc.reset();
  beat = 1;
  pointAt = points = 0;
  fresh = true;
  glide(true);
}

void Engine::process(const float *in, float *L, float *R, int n) {
  fresh = false;
  const int M = os.factor();
  const cplx turn = std::polar(1.0, kTau * kNeighbour * h); // the next station's beat, a step on
  for (int i = 0; i < n; i++) {
    // a sample that isn't a number goes out as one, so the block is silenced and the pedal reset
    // (px_process), rather than into the oversampler, where it would stay
    if (!std::isfinite(in[i])) { L[i] = R[i] = in[i]; continue; }
    glide(false);
    beat /= std::abs(beat); // kept on the unit circle
    double out = 0;
    for (int m = 0; m < M; m++) {
      const double vin = os.upsample(in[i], m);
      // the transmitter's carrier, which can't go below nothing, and the next station's
      const double env = now.Ac * std::fmax(0.0, 1 + now.k * vin);
      beat = mul(beat, turn);
      const double V = rx.step(cplx(env, 0) + now.B * beat);
      out = os.downsample(V - rest);
    }
    const float v = (float)(gainNow * dc.run(out));
    L[i] = v;
    R[i] = v;
    if (messages && ++pointAt >= pointEvery) { // a point for the page's view of the detector
      pointAt = 0;
      msg.values[2 * points] = (float)rx.A;
      msg.values[2 * points + 1] = (float)rx.V;
      if (++points == 14) {
        msg.type = kPoints;
        msg.count = 30;
        msg.values[28] = (float)restingAmplitude(now);
        msg.values[29] = rx.steps > stepsMark ? (float)(rx.iterations - itersMark) / (rx.steps - stepsMark) : 0;
        post(msg);
        points = 0;
        itersMark = rx.iterations; stepsMark = rx.steps;
      }
    }
  }
}

} // namespace radio
