// sabine-web.cpp — the model functions Sabine's Room's page and tests call (through the scratch area,
// shared/wasm.js), from a parameter array.

#include <algorithm>
#include <cmath>
#include <vector>

#include "sabine-engine.h"
#include "sabine-model.h"
#include "sabine-params.h"
#include "phuzzbox/web.h"

extern "C" {
// in: P. out (at io): the room's volume V (m³) and surface S (m²), the distance d from the bass to
// you (m), the path Re where the late sound comes in (m); then for each band its absorption area A
// (m², with the air's), Sabine's T60 and Eyring's (s), and the air's attenuation m (1/m): 4 + 4 × 6
PHUZZ_EXPORT void sabine_parts(double *io) {
  const sabine::Parts p = sabine::parts(io);
  std::vector<sabine::Reflection> scratch(sabine::kMaxImages);
  sabine::Reflection refl[sabine::kEarly + 1];
  const double Re = sabine::early(p, refl, scratch.data());
  io[0] = p.V(); io[1] = p.S(); io[2] = p.d; io[3] = Re;
  for (int b = 0; b < sabine::kBands; b++) {
    io[4 + 4 * b] = p.A(b); io[5 + 4 * b] = p.sabine(b); io[6 + 4 * b] = p.eyring(b); io[7 + 4 * b] = p.m[b];
  }
}
// in: P. out: the direct sound and the first 64 reflections, nearest first, each its path r (m), its
// order and its gain in each band: 65 × 8
PHUZZ_EXPORT void sabine_early(double *io) {
  const sabine::Parts p = sabine::parts(io);
  std::vector<sabine::Reflection> scratch(sabine::kMaxImages);
  sabine::Reflection refl[sabine::kEarly + 1];
  sabine::early(p, refl, scratch.data());
  for (int i = 0; i <= sabine::kEarly; i++) {
    double *o = io + 8 * i;
    o[0] = refl[i].r; o[1] = refl[i].order;
    for (int b = 0; b < sabine::kBands; b++) o[2 + b] = refl[i].gain[b];
  }
}
// in: P. out (after it): the late sound of one band alone, an impulse into its network at its delay
// after the direct sound: the power of its output in each of `blocks` blocks of k samples, from the
// direct sound on (the energy over the block, over k)
PHUZZ_EXPORT void sabine_late(double *io, double fs, int band, int blocks, int k) {
  const sabine::Parts p = sabine::parts(io);
  sabine::Engine e(fs);
  int base[sabine::kBands][sabine::kLines];
  for (int b = 0; b < sabine::kBands; b++) for (int j = 0; j < sabine::kLines; j++) base[b][j] = e.lineDelay(b, j);
  std::vector<sabine::Reflection> scratch(sabine::kMaxImages);
  static sabine::Engine::Config c;
  sabine::Engine::configure(p, fs, base, c, scratch.data());
  const sabine::Late &l = c.late[band];
  sabine::Network net;
  int longest = 0;
  for (int j = 0; j < sabine::kLines; j++) longest = std::max(longest, l.m[j]);
  net.size(longest);
  double *o = io + sabine::kParamCount;
  for (long n = 0; n < (long)blocks * k; n++) {
    double y = net.step(n == c.pre ? 1.0 : 0.0, l);
    y *= l.kappa;
    if (n % k == 0) o[n / k] = 0;
    o[n / k] += y * y / k;
  }
}
// in: P. out (after it): the engine's taps: their count, then each one's delay after the direct sound
// (samples, fractional) and its gain in each band (7 numbers each); then the late sound's delay
// (samples), then each band's output scale (1 + 6)
PHUZZ_EXPORT void sabine_taps(double *io, double fs) {
  sabine::Engine e(fs);
  e.setParams(io);
  const auto &c = e.config();
  double *o = io + sabine::kParamCount;
  o[0] = c.taps;
  for (int k = 0; k < c.taps; k++) {
    o[1 + 7 * k] = c.delay[k] + (double)c.frac[k];
    for (int b = 0; b < sabine::kBands; b++) o[2 + 7 * k + b] = c.gain[k][b];
  }
  double *q = o + 1 + 7 * c.taps;
  q[0] = c.pre;
  for (int b = 0; b < sabine::kBands; b++) q[1 + b] = c.late[b].kappa;
}
}
