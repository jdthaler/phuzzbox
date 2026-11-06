// transformer-web.cpp — the model functions the Output Transformer's page and tests call (through the
// scratch area, shared/wasm.js), from a parameter array.

#include <algorithm>
#include <cmath>

#include "transformer-engine.h"
#include "transformer-model.h"
#include "transformer-params.h"
#include "phuzzbox/web.h"

extern "C" {
// in: P. out (at io): the core's Ms, a, α, k, c (A/m, but α and c); the turns N, the magnetic path l
// (m), the load reflected to the primary (Ω), the core's area A (m²), the source's resistance Rs and
// the resistance the core sees, Rs ∥ RL (Ω), Vth per Vs; the saturation flux density µ0 Ms (T) and the
// small-signal inductance µ0 (1 + χ0) N² A/l (H): 14 numbers
PHUZZ_EXPORT void transformer_parts(double *io) {
  const transformer::Parts p = transformer::parts(io);
  const transformer::Core &c = *p.core;
  using namespace transformer;
  const double L0 = kMu0 * (1 + initialSusceptibility(c)) * kTurns * kTurns * p.A / kPath;
  const double out[] = {c.Ms, c.a, c.alpha, c.k, c.c, kTurns, kPath, kLoad, p.A, p.Rs, p.rp(), p.divider(), kMu0 * c.Ms, L0};
  for (int k = 0; k < 14; k++) io[k] = out[k];
}
// The core's loop: in: P, then the field's peak Hmax (A/m). From the demagnetised core the field
// rises to Hmax, then over n points (after the input) falls to −Hmax and rises back: n pairs (H, B)
// (A/m, T).
PHUZZ_EXPORT void transformer_loop(double *io, int n) {
  const transformer::Parts p = transformer::parts(io);
  const double Hmax = io[transformer::kParamCount];
  double *out = io + transformer::kParamCount + 1;
  double H = 0, M = 0, slope;
  int subs;
  M = transformer::advance(*p.core, H, M, Hmax, slope, subs);
  H = Hmax;
  for (int i = 0; i < n; i++) {
    const double u = (double)(i + 1) / n, target = Hmax * (u < 0.5 ? 1 - 4 * u : 4 * u - 3);
    M = transformer::advance(*p.core, H, M, target - H, slope, subs);
    H = target;
    out[2 * i] = H;
    out[2 * i + 1] = transformer::kMu0 * (H + M);
  }
}
// The output stage playing a tone from rest: in: P, then the tone's frequency (Hz), its peak at the
// input (V) and the whole periods to play. In steps of about 1/192 kHz, the tone Vs = Drive × peak ×
// sin 2πft from t = 0; over the last two periods n points (after the inputs) of the primary's voltage
// v, the field H and the flux density B (V, A/m, T): three arrays of n.
PHUZZ_EXPORT void transformer_tone(double *io, int n) {
  const transformer::Parts p = transformer::parts(io);
  const double f = io[transformer::kParamCount], amp = io[transformer::kParamCount + 1];
  const int periods = std::max(2, (int)io[transformer::kParamCount + 2]);
  double *out = io + transformer::kParamCount + 3;
  const int sub = std::max(1, (int)std::ceil(2 * 192000.0 / (f * n)));
  const double h = 2 / (f * n * sub), tau = 6.28318530717958647692, g = p.drive * p.divider() * amp;
  transformer::Transformer tx;
  const long total = (long)periods * n / 2 * sub, from = total - (long)n * sub;
  for (long i = 0; i < total; i++) {
    const double v = tx.step(p, g * std::sin(tau * f * h * (i + 1)), h);
    const long j = i - from;
    if (j >= 0 && (j + 1) % sub == 0) {
      const long k = j / sub;
      out[k] = v; out[n + k] = tx.H; out[2 * n + k] = tx.B();
    }
  }
}
PHUZZ_EXPORT double transformer_evaluations(phuzzbox::Effect *e) { auto &t = static_cast<transformer::Engine *>(e)->tx; return t.steps ? (double)t.evaluations / t.steps : 0; }
PHUZZ_EXPORT double transformer_substeps(phuzzbox::Effect *e) { auto &t = static_cast<transformer::Engine *>(e)->tx; return t.evaluations ? (double)t.substeps / t.evaluations : 0; }
}
