// native-tests.cpp — the C++ alone: parameters read and write their text, the Buffer is the identity
// when nothing changes, the test bass plays in tune, the tuner reads as the page's does, and the
// app's audio engine routes, fades, mutes and measures, with each of its pedals. (The physics is tested in test/, on the
// WebAssembly build.)

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <memory>
#include <vector>

#include "buffer-params.h"
#include "engine.h"
#include "phuzzbox/tuner.h"
#include "phuzzbox/pedal.h"
#include "testbass.h"

static int failures = 0;
static void check(bool ok, const char *what) {
  std::printf("%s %s\n", ok ? "ok  " : "FAIL", what);
  if (!ok) failures++;
}

int main() {
  const phuzzbox::PedalInfo &I = *phuzzbox::app::findPedal("buffer");
  char text[64];
  phuzzbox::formatValue(I.params[buffer::pickupR], 10500, text, sizeof text);
  check(!std::strcmp(text, "10.5 kΩ"), "a value shows in its unit");
  double v = 0;
  check(phuzzbox::parseValue(I.params[buffer::pickupR], "7.2 kΩ", v) && std::abs(v - 7200) < 1e-9, "and reads back from it");
  check(std::abs(phuzzbox::fromNormalized(I.params[buffer::load], phuzzbox::toNormalized(I.params[buffer::load], 68e3)) - 68e3) < 1e-6, "log knobs round-trip");

  std::vector<double> P(I.paramCount);
  for (int i = 0; i < I.paramCount; i++) P[i] = I.params[i].def;
  std::unique_ptr<phuzzbox::Effect> e(I.create(48000));
  e->setParams(P.data());
  std::vector<float> in(128), L(128), R(128);
  double worst = 0;
  for (int b = 0; b < 20; b++) {
    for (int i = 0; i < 128; i++) in[i] = (float)std::sin(0.37 * (b * 128 + i)) * 0.3f;
    e->process(in.data(), L.data(), R.data(), 128);
    for (int i = 0; i < 128; i++) worst = std::max(worst, (double)std::abs(L[i] - in[i]));
  }
  check(worst < 1e-6, "the Buffer at its defaults passes the signal unchanged");

  // on the heap: a Bass is about 60 kB, which with main's other locals overflows the WebAssembly
  // build's 64 kB stack (and an overflow there overwrote libc's tables until the check below)
  auto bass = std::make_unique<testbass::Bass>(48000);
  const auto ps = testbass::partials(bass->settings, 0, 5, 48000); // A1 on the E string
  check(std::abs(1200 * std::log2(ps[0].f / 55.0)) < 0.01, "the test bass's fifth fret on E is A1");

  // the tuner (tuner.h), on a detuned harmonic tone, as test/tuner-tests.mjs checks shared/tuner.js
  {
    const double fs = 48000, f = 41.2034 * std::pow(2.0, 7.3 / 1200);
    std::vector<float> x(16384);
    for (size_t i = 0; i < x.size(); i++) {
      double s = 0;
      for (int k = 1; k <= 8; k++) s += std::sin(2 * 3.14159265358979323846 * k * f * i / fs + k) / k;
      x[i] = (float)(0.1 * s * std::exp(-(double)i / fs / 1.5));
    }
    const double got = phuzzbox::tuner::tune(x.data(), x.size(), fs);
    check(std::abs(1200 * std::log2(got / f)) < 0.1, "the tuner reads a low E 7.3 cents sharp to a tenth of a cent");
    std::vector<float> quiet(16384, 0.0f);
    check(phuzzbox::tuner::tune(quiet.data(), quiet.size(), fs) == 0, "and reads nothing in silence");
  }

  // the app's engine (app/engine.h)
  {
    using phuzzbox::app::Engine;
    const int n = 64;
    std::vector<float> in(2 * n), out(2 * n);
    Engine a(I);
    a.prepare(48000, n);
    a.fullScale = 0.5;
    a.channel = 1;
    double worst = 0;
    for (int b = 0; b < 40; b++) {
      for (int i = 0; i < n; i++) { in[2 * i] = 0.9f; in[2 * i + 1] = (float)(0.4 * std::sin(0.05 * (b * n + i))); }
      a.process(in.data(), 2, out.data(), 2, n);
      if (b > 2) for (int i = 0; i < n; i++) worst = std::max({worst, (double)std::abs(out[2 * i] - in[2 * i + 1]), (double)std::abs(out[2 * i + 1] - in[2 * i + 1])});
    }
    check(worst < 1e-5, "the app plays the chosen input channel through the Buffer to both outputs");
    std::vector<float> kept(n);
    a.snapshot(kept.data(), n);
    check(std::abs(kept[n - 1] - 0.5f * in[2 * (n - 1) + 1]) < 1e-7, "and keeps the input, in volts, for the tuner");
    double levelIn = 0, levelOut = 0;
    a.takeLevels(levelIn, levelOut);
    check(std::abs(levelIn - 0.2) < 0.002 && std::abs(levelOut - 0.2) < 0.002, "its levels are the peak volts in and out");

    a.mute = true;
    a.process(in.data(), 2, out.data(), 2, n);
    check(*std::max_element(out.begin(), out.end()) == 0 && *std::min_element(out.begin(), out.end()) == 0, "Mute silences the output");
    a.mute = false;

    // a volume pedal at half: the output glides to half of the Buffer's (its identity), with a
    // 10 ms time constant
    a.gain = 0.5;
    for (int b = 0; b < 90; b++) { // 120 ms
      for (int i = 0; i < n; i++) { in[2 * i] = 0; in[2 * i + 1] = 0.4f; }
      a.process(in.data(), 2, out.data(), 2, n);
    }
    check(std::abs(out[2 * (n - 1)] - 0.2f) < 1e-4 && std::abs(out[2 * (n - 1) + 1] - 0.2f) < 1e-4, "a volume pedal at half halves the output, gliding there");
    a.gain = 1;
    for (int b = 0; b < 90; b++) a.process(in.data(), 2, out.data(), 2, n);

    // a loopback cable 300 samples long: what goes out comes back in 300 samples later
    const int D = 300;
    std::vector<float> line(48000 * 2, 0.0f);
    a.startMeasure();
    for (int b = 0; b * n < 48000 * 2 && a.measured() == -1; b++) {
      for (int i = 0; i < n; i++) { const int t = b * n + i; const float back = t >= D ? line[t - D] : 0.0f; in[2 * i] = 0; in[2 * i + 1] = back + 1e-4f * (float)std::sin(0.3 * t); }
      a.process(in.data(), 2, out.data(), 2, n);
      for (int i = 0; i < n; i++) line[b * n + i] = out[2 * i];
    }
    const double ms = a.measured(), want = 1000.0 * D / 48000;
    check(ms > 0 && std::abs(ms - want) < 1000.0 * 2 / 48000, "the loopback test times a 300-sample cable to two samples");
    std::printf("     (measured %.3f ms for %.3f ms)\n", ms, want);
  }

  // every pedal the app offers plays through its engine: a low E at a passive pickup's level
  // comes out, and bounded, each with its defaults
  {
    using namespace phuzzbox::app;
    check(pedals().size() >= 2 && findPedal("phuzz") && !findPedal("nonesuch"), "the app has its pedals, found by slug");
    for (const phuzzbox::PedalInfo *p : pedals()) {
      const int n = 64;
      std::vector<float> in(n), out(2 * n);
      Engine a(*p);
      for (int i = 0; i < p->paramCount; i++) a.setParam(i, p->params[i].def);
      a.prepare(48000, n);
      double peak = 0;
      bool finite = true;
      for (int b = 0; b < 750; b++) { // a second
        for (int i = 0; i < n; i++) in[i] = (float)(0.2 * std::sin(2 * 3.14159265358979323846 * 41.2 * (b * n + i) / 48000));
        a.process(in.data(), 1, out.data(), 2, n);
        for (float y : out) { finite = finite && std::isfinite(y); if (b > 375) peak = std::max(peak, (double)std::abs(y)); }
      }
      char what[96];
      std::snprintf(what, sizeof what, "the app plays the %s: a low E comes out, finite and under 20 V (peak %.3f V)", p->name, peak);
      check(finite && peak > 0.01 && peak < 20, what);
    }
  }
  return failures ? 1 : 0;
}
