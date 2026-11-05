// michelson-web.cpp — the model functions the Michelson Interferometer's page and tests call
// (through the scratch area, shared/wasm.js), from a parameter array.

#include <cmath>
#include <complex>

#include "michelson-model.h"
#include "michelson-params.h"
#include "phuzzbox/web.h"

using michelson::kParamCount;

extern "C" {
// in: P, then n paths' differences (m). out (after them): the detector's intensity at each, 0–1.
PHUZZ_EXPORT void michelson_intensity(double *io, int n) {
  const michelson::Parts p = michelson::parts(io);
  const double *opd = io + kParamCount;
  double *out = io + kParamCount + n;
  for (int i = 0; i < n; i++) out[i] = michelson::intensity(p, opd[i]);
}
// in: P, then the mirror's travel x (m) and n angles θ (rad) off the axis. out (after them): the
// intensity a screen shows at each angle, where the paths differ by (rest + 2x) cos θ: the rings.
PHUZZ_EXPORT void michelson_rings(double *io, int n) {
  const michelson::Parts p = michelson::parts(io);
  const double x = io[kParamCount], *th = io + kParamCount + 1;
  double *out = io + kParamCount + 1 + n;
  for (int i = 0; i < n; i++) out[i] = michelson::intensity(p, (p.rest + 2 * x) * std::cos(th[i]));
}
// in: P, then n paths' differences (m). out (after them): the fringes' contrast at each.
PHUZZ_EXPORT void michelson_contrast(double *io, int n) {
  const michelson::Parts p = michelson::parts(io);
  const double *opd = io + kParamCount;
  double *out = io + kParamCount + n;
  for (int i = 0; i < n; i++) out[i] = michelson::contrast(p, opd[i]);
}
// in: P, then n frequencies (Hz). out (after them): the mirror's travel per volt (m/V) and its phase (rad).
PHUZZ_EXPORT void michelson_actuator(double *io, int n) {
  const michelson::Parts p = michelson::parts(io);
  const double *f = io + kParamCount;
  double *out = io + kParamCount + n;
  for (int i = 0; i < n; i++) {
    const std::complex<double> h = michelson::actuatorResponse(p, f[i]);
    out[i] = std::abs(h);
    out[n + i] = std::arg(h);
  }
}
// in: P. out (at io): the paths' difference at rest (m), the source's centre wavelength (m), its
// lines' count, then each line's wavelength, weight and width (m) (two lines' room), the actuator's
// resonance (Hz) and Q, the stroke (m/V), the air's drift (m) and time (s), the detector's full
// scale (V) and the Level as a factor: 16 numbers.
PHUZZ_EXPORT void michelson_parts(double *io) {
  const michelson::Parts p = michelson::parts(io);
  double out[16] = {p.rest, p.src->lambda0, (double)p.src->lines};
  for (int j = 0; j < p.src->lines; j++) {
    out[3 + 3 * j] = p.src->line[j].lambda;
    out[4 + 3 * j] = p.src->line[j].weight;
    out[5 + 3 * j] = p.src->line[j].width;
  }
  const double tail[] = {p.f0, p.Q, p.stroke, p.air, p.airTime, p.fullScale, p.gain};
  for (int k = 0; k < 7; k++) out[9 + k] = tail[k];
  for (int k = 0; k < 16; k++) io[k] = out[k];
}
}
