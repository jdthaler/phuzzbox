// native-tests.cpp — the C++ alone: parameters read and write their text, the Buffer is the identity
// when nothing changes, and the test bass plays in tune. (The physics is tested in test/, on the
// WebAssembly build.)

#include <cmath>
#include <cstdio>
#include <cstring>
#include <memory>
#include <vector>

#include "buffer-params.h"
#include "phuzzbox/pedal.h"
#include "testbass.h"

const phuzzbox::PedalInfo &phuzz_pedal();

static int failures = 0;
static void check(bool ok, const char *what) {
  std::printf("%s %s\n", ok ? "ok  " : "FAIL", what);
  if (!ok) failures++;
}

int main() {
  const phuzzbox::PedalInfo &I = phuzz_pedal();
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

  testbass::Bass bass(48000);
  const auto ps = testbass::partials(bass.settings, 0, 5, 48000); // A1 on the E string
  check(std::abs(1200 * std::log2(ps[0].f / 55.0)) < 0.01, "the test bass's fifth fret on E is A1");
  return failures ? 1 : 0;
}
