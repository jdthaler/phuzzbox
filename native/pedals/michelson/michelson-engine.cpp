// michelson-engine.cpp — the Michelson Interferometer as an effect (michelson-engine.h).

#include "michelson-engine.h"

#include <cmath>

#include "michelson-params.h"

namespace michelson {

namespace {
constexpr double kPi = 3.14159265358979323846;
constexpr double kCoupling = 5; // Hz: the detector's AC coupling
} // namespace

Engine::Engine(double rate) : Effect(rate) { setQuality(phuzzbox::Quality::high); }

void Engine::setQuality(phuzzbox::Quality q) {
  Effect::setQuality(q);
  os.setup(fs, pick(4, 2, 1));
  latencySamples = (int)std::lround(os.delay(fs));
  if (haveParams) { design(); settle(); }
}

// the decimator settled on the light now, so that a pedal switched on (or a quality changed) in
// silence stays silent
void Engine::settle() {
  for (int k = 0; k < 512 * os.factor(); k++) os.downsample(lastI);
}

void Engine::design() {
  const double fh = fs * os.factor();
  // the actuator: a resonant low-pass, prewarped so its resonance lands where it should
  const double g = std::tan(kPi * std::fmin(parts.f0, 0.45 * fh) / fh), k = 1 / parts.Q;
  a1 = 1 / (1 + g * (g + k));
  a2 = g * a1;
  a3 = g * a2;
  // the air, sampled at the host's rate: w ← a w + σ √(1 − a²) n keeps its variance σ²
  airDecay = std::exp(-1 / (fs * parts.airTime));
  airKick = parts.air * std::sqrt(1 - airDecay * airDecay);
  const double gh = std::tan(kPi * kCoupling / fs);
  hpG = gh / (1 + gh);
}

void Engine::setParams(const double *P) {
  parts = michelson::parts(P);
  design();
  if (!haveParams) { haveParams = true; reset(); }
}

void Engine::reset() {
  os.reset();
  ic1 = ic2 = x = 0;
  w = wPrev = 0;
  rng = 0x9e3779b97f4a7c15ull;
  haveSpare = false;
  opdPrev = parts.rest;
  lastI = intensity(parts, parts.rest);
  settle();
  hp = lastI * parts.fullScale; // the coupling capacitor charged to the light at rest
  pointAt = points = 0;
}

double Engine::gaussian() {
  if (haveSpare) { haveSpare = false; return spare; }
  auto uniform = [this] { // xorshift64*, its top 53 bits in (0, 1)
    rng ^= rng >> 12; rng ^= rng << 25; rng ^= rng >> 27;
    return ((rng * 0x2545f4914f6cdd1dull >> 11) + 0.5) / 9007199254740992.0;
  };
  const double r = std::sqrt(-2 * std::log(uniform())), t = 2 * kPi * uniform();
  spare = r * std::sin(t);
  haveSpare = true;
  return r * std::cos(t);
}

void Engine::process(const float *in, float *L, float *R, int n) {
  const int M = os.factor();
  for (int i = 0; i < n; i++) {
    // a sample that isn't a number goes out as one, so the block is silenced and the pedal reset
    if (!std::isfinite(in[i])) { L[i] = R[i] = in[i]; continue; }
    wPrev = w;
    if (parts.air > 0) w = airDecay * w + airKick * gaussian();
    else w = 0;
    double out = 0, I = lastI;
    for (int m = 0; m < M; m++) {
      const double v = parts.stroke * os.upsample(in[i], m);
      // the actuator, one step
      const double v3 = v - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
      ic1 = 2 * v1 - ic1;
      ic2 = 2 * v2 - ic2;
      x = v2;
      const double air = wPrev + (w - wPrev) * (m + 1) / M;
      const double opd = parts.rest + 2 * (x + air);
      I = intensityAveraged(parts, opdPrev, opd);
      opdPrev = opd;
      out = os.downsample(I);
    }
    lastI = I;
    // the coupling capacitor: what passes is the light's change
    const double v = out * parts.fullScale, lp = hp + hpG * (v - hp);
    hp = 2 * lp - hp;
    const float y = (float)(parts.gain * (v - lp));
    L[i] = y;
    R[i] = y;
    if (messages && ++pointAt >= pointEvery) { // a point for the page's views of the light
      pointAt = 0;
      float *pt = msg.values + 3 * points;
      pt[0] = (float)(x * 1e9); pt[1] = (float)(w * 1e9); pt[2] = (float)I;
      if (++points == 9) {
        msg.type = kPoints;
        msg.count = 29;
        msg.values[27] = (float)contrast(parts, parts.rest);
        msg.values[28] = (float)(parts.rest * 1e6);
        post(msg);
        points = 0;
      }
    }
  }
}

} // namespace michelson
