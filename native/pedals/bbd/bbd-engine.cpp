// bbd-engine.cpp — the Bucket Brigade as an effect (bbd-engine.h).

#include "bbd-engine.h"

#include <cmath>

#include "bbd-params.h"

namespace bbd {

namespace {
constexpr double kPi = 3.14159265358979323846;
// a triangle: −1 at phase 0, rising through 0 at a quarter to +1 at a half, and back
double triangle(double ph) { const double q = ph - std::floor(ph); return q < 0.5 ? 4 * q - 1 : 3 - 4 * q; }
} // namespace

void Butterworth3::design(double fc, double fs) {
  const double w = 2 * kPi * fc;
  // 1/((s/w + 1)(s²/w² + s/w + 1)), each section prewarped at the corner
  a = phuzzbox::bilinear({0, 0, 1, 0, 1 / w, 1}, fs, fc);
  b = phuzzbox::bilinear({0, 0, 1, 1 / (w * w), 1 / w, 1}, fs, fc);
}

Engine::Engine(double rate) : Effect(rate) { setQuality(phuzzbox::Quality::high); }

void Engine::setQuality(phuzzbox::Quality q) {
  Effect::setQuality(q);
  os.setup(fs, pick(4, 2, 1));
  latencySamples = (int)std::lround(os.delay(fs));
  h = 1 / (fs * os.factor());
  if (haveParams) design();
}

void Engine::design() {
  const double fsh = fs * os.factor(), fc = std::min(parts.corner, 0.45 * fsh);
  aa.design(fc, fsh);
  recon.design(fc, fsh);
}

void Engine::setParams(const double *P) {
  const double corner = parts.corner;
  parts = bbd::parts(P);
  if (!haveParams) { haveParams = true; design(); reset(); return; }
  if (parts.corner != corner) {
    // a turned Filter keeps each filter's state: the new coefficients carry on from it
    const Butterworth3 a0 = aa, r0 = recon;
    design();
    aa.a.z1 = a0.a.z1; aa.a.z2 = a0.a.z2; aa.b.z1 = a0.b.z1; aa.b.z2 = a0.b.z2;
    recon.a.z1 = r0.a.z1; recon.a.z2 = r0.a.z2; recon.b.z1 = r0.b.z1; recon.b.z2 = r0.b.z2;
  }
}

void Engine::reset() {
  os.reset();
  aa.reset(); recon.reset();
  lfo = 0.25; phase = 0; aaLast = held = wet = 0;
  for (double &c : chain) c = 0;
  head = 0;
  postAt = 0;
}

double Engine::tail() const {
  // the longest delay, times the repeats it takes the feedback to fall 60 dB
  const double delay = parts.stages / (2 * parts.clock * (1 - parts.depth)), g = std::fabs(parts.feedback);
  return delay * (1 + (g > 1e-3 ? 3 / -std::log10(g) : 0)) + 0.01;
}

double Engine::step(double vin) {
  const double x = aa.run(vin + parts.feedback * wet);
  lfo += parts.rate * h;
  if (lfo >= 1) lfo -= std::floor(lfo);
  const double f = parts.clock * (1 + parts.depth * triangle(lfo));
  clockNow = f;
  const int D = parts.stages / 2;
  // the clock's cycles that end within this step, each at its fraction of the step
  double from = 0, avg = 0, p = phase;
  const double dp = f * h;
  while (p + dp * (1 - from) >= 1) {
    const double at = from + (1 - p) / dp; // the fraction of the step where this cycle ends
    avg += held * (at - from);
    // on: the input there; off: the charge D cycles older, through the transfer loss
    chain[head & (kSize - 1)] = aaLast + at * (x - aaLast);
    double out = 0;
    for (int m = 0; m < parts.taps; m++) out += parts.p[m] * chain[(head - D - m) & (kSize - 1)];
    held = out;
    head++;
    ticks++;
    p = 0;
    from = at;
  }
  phase = p + dp * (1 - from);
  avg += held * (1 - from);
  aaLast = x;
  wet = recon.run(avg);
  return (1 - parts.mix) * vin + parts.mix * wet;
}

void Engine::process(const float *in, float *L, float *R, int n) {
  const int M = os.factor();
  for (int i = 0; i < n; i++) {
    if (!std::isfinite(in[i])) { L[i] = R[i] = in[i]; continue; }
    double out = 0;
    for (int m = 0; m < M; m++) out = os.downsample(step(os.upsample(in[i], m)));
    const float v = (float)(parts.gain * out);
    L[i] = v;
    R[i] = v;
    if (messages && ++postAt >= postEvery) { // the chain, for the page
      postAt = 0;
      const int D = parts.stages / 2;
      for (int k = 0; k < 28; k++) msg.values[k] = (float)chain[(head - 1 - (long)k * (D - 1) / 27) & (kSize - 1)];
      msg.values[28] = (float)clockNow;
      msg.values[29] = (float)(parts.stages / (2 * clockNow));
      msg.type = kChain;
      msg.count = 30;
      post(msg);
    }
  }
  aa.flush(); recon.flush();
}

} // namespace bbd
