// blackhole-web.cpp — the model functions the Black Hole's page and tests call (through the
// scratch area, shared/wasm.js): the modes as the engine rings them, the table, the harmonics.

#include <memory>

#include "phuzzbox/web.h"
#include "blackhole-engine.h"
#include "blackhole-params.h"

extern "C" {
// in: P. out: the spin, the detector's gain, then for each of the four modes l, m, n, frequency
// (Hz), damping rate (1/s), Q, the merger's amplitude, its h₊ and h× weights, and 1 if it rings
// below 0.45 fs at 48 kHz
PHUZZ_EXPORT void blackhole_modes(double *io) {
  auto e = std::make_unique<blackhole::Engine>(48000);
  e->setParams(io);
  io[0] = e->a; io[1] = e->gain;
  for (int k = 0; k < blackhole::Engine::MODES; k++) {
    const auto &m = e->mode[k];
    double *o = io + 2 + 10 * k;
    o[0] = m.l; o[1] = m.m; o[2] = m.n; o[3] = m.f; o[4] = m.gamma; o[5] = m.Q; o[6] = m.amp; o[7] = m.plus; o[8] = m.cross; o[9] = m.on;
  }
}
// in: l, m, n, a. out: Re Mω, Im Mω from the table (0, 0 if it has no such mode)
PHUZZ_EXPORT void blackhole_omega(double *io) {
  blackhole::Omega w{0, 0};
  blackhole::omega((int)io[0], (int)io[1], (int)io[2], io[3], w);
  io[0] = w.re; io[1] = w.im;
}
// in: l, m, θ. out: ₋₂Y_lm(θ, 0)
PHUZZ_EXPORT void blackhole_swsh(double *io) { io[0] = blackhole::swsh((int)io[0], (int)io[1], io[2]); }
}
