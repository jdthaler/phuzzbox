// engine.cpp — the app's audio (engine.h).

#include "engine.h"

#include <algorithm>
#include <chrono>
#include <cmath>

#include "phuzzbox/denormals.h"

namespace phuzzbox::app {
namespace {
constexpr double kPi = 3.14159265358979323846;
constexpr double kFade = 0.005; // the footswitch's crossfade, seconds (shared/worklet.js's FADE)
constexpr double kGlide = 0.01; // the volume's time constant, seconds (shell.js's setTargetAtTime)
double now() { return std::chrono::duration<double>(std::chrono::steady_clock::now().time_since_epoch()).count(); }
template <class T> void raise(std::atomic<T> &a, T x) {
  T was = a.load(std::memory_order_relaxed);
  while (x > was && !a.compare_exchange_weak(was, x, std::memory_order_relaxed)) {}
}
} // namespace

Engine::Engine(const PedalInfo &p) : pedal(p), values(p.paramCount), P(p.paramCount), keep(kKeep, 0.0f) {
  for (int i = 0; i < p.paramCount; i++) values[i] = p.params[i].def;
}

void Engine::prepare(double rate, int maxFrames) {
  if (!effect || rate != fs) effect.reset(pedal.create(rate));
  fs = rate;
  effect->reset();
  v.assign(maxFrames, 0); L.assign(maxFrames, 0); R.assign(maxFrames, 0);
  dirty = true;
  wet = bypass ? 0 : 1;
  level = gain;
  busy = span = 0;
}

void Engine::setParam(int i, double x) {
  if (i < 0 || i >= pedal.paramCount) return;
  values[i] = constrain(pedal.params[i], x);
  dirty = true;
}

void Engine::applyPreset(int k) {
  if (k < 0 || k >= pedal.presetCount) return;
  const Preset &p = pedal.presets[k];
  for (int j = 0; j < p.count; j++) values[p.values[j].param] = constrain(pedal.params[p.values[j].param], p.values[j].value);
  dirty = true;
}

void Engine::takeLevels(double &in, double &out) {
  in = inPeak.exchange(0);
  out = outPeak.exchange(0);
}

void Engine::snapshot(float *dst, int n) const {
  n = std::min(n, kKeep);
  const int end = keepAt.load(std::memory_order_acquire);
  for (int i = 0; i < n; i++) dst[i] = keep[(end - n + i + kKeep) % kKeep];
}

void Engine::startMeasure() {
  measuredMs = -1;
  measureRequest = true;
}

// One sample of the loopback test, as shared/worklet.js's loopback(): 0.2 s of the input's noise,
// a 2 ms 1 kHz click at 0.3 of full scale, then the first sample above max(0.01, 6 × the noise).
float Engine::loopback(float x) {
  const long quiet = std::lround(0.2 * fs), click = std::lround(0.002 * fs);
  const float a = std::abs(x);
  float y = 0;
  switch (phase) {
    case Phase::quiet:
      floor = std::max(floor, a);
      if (++t >= quiet) { phase = Phase::click; sentAt = t; }
      break;
    case Phase::click:
      y = (float)(0.3 * std::sin(2 * kPi * 1000 * (t - sentAt) / fs));
      if (++t - sentAt >= click) phase = Phase::listen;
      break;
    case Phase::listen:
      if (a > std::max(0.01f, 6 * floor)) { measuredMs = 1000.0 * (t - sentAt) / fs; phase = Phase::off; }
      else if (t - sentAt > (long)fs) { measuredMs = -2; phase = Phase::off; }
      t++;
      break;
    case Phase::off: break;
  }
  return y;
}

void Engine::process(const float *in, int inChannels, float *out, int outChannels, int n) {
  NoDenormals denormals;
  const double t0 = now();
  if (dirty.exchange(false)) {
    for (int i = 0; i < pedal.paramCount; i++) P[i] = values[i].load();
    effect->setParams(P.data());
  }
  if (measureRequest.exchange(false)) { phase = Phase::quiet; t = 0; floor = 0; }
  const int ch = std::clamp(channel.load(), 0, std::max(0, inChannels - 1));
  const float k = (float)fullScale.load();
  int at = keepAt.load(std::memory_order_relaxed);
  float peakIn = 0, peakOut = 0;
  for (int i = 0; i < n; i++) {
    v[i] = in && inChannels > 0 ? in[i * inChannels + ch] * k : 0.0f;
    peakIn = std::max(peakIn, std::abs(v[i]));
    keep[at] = v[i];
    at = (at + 1) % kKeep;
  }
  keepAt.store(at, std::memory_order_release);

  if (phase != Phase::off) { // the loopback test owns the output while it runs
    for (int i = 0; i < n; i++) {
      const float y = loopback(in && inChannels > 0 ? in[i * inChannels + ch] : 0.0f);
      for (int c = 0; c < outChannels; c++) out[i * outChannels + c] = y;
    }
    raise(inPeak, peakIn);
    return;
  }

  effect->process(v.data(), L.data(), R.data(), n);
  const double target = bypass ? 0 : 1, step = 1 / (kFade * fs);
  const bool silent = mute;
  const double g = std::clamp(gain.load(), 0.0, 1.0), glide = 1 - std::exp(-1 / (kGlide * fs));
  for (int i = 0; i < n; i++) {
    if (wet != target) wet = target > wet ? std::min(target, wet + step) : std::max(target, wet - step);
    level += glide * (g - level);
    float l = (float)(wet * L[i] + (1 - wet) * v[i]), r = (float)(wet * R[i] + (1 - wet) * v[i]);
    if (!std::isfinite(l) || !std::isfinite(r)) { effect->reset(); l = r = 0; }
    peakOut = std::max({peakOut, std::abs(l), std::abs(r)});
    const float ol = silent ? 0.0f : (float)(level * l / k), orr = silent ? 0.0f : (float)(level * r / k);
    for (int c = 0; c < outChannels; c++) out[i * outChannels + c] = c % 2 ? orr : ol;
  }
  raise(inPeak, peakIn);
  raise(outPeak, peakOut);

  busy += now() - t0;
  span += n / fs;
  if (span >= 0.5) { cpuLoad = busy / span; busy = span = 0; }
}

} // namespace phuzzbox::app
