// lampvibe-web.cpp — the model functions the Lamp Vibe's page and tests call (through the scratch
// area, shared/wasm.js), from a parameter array.

#include <cmath>
#include <complex>

#include "lampvibe-model.h"
#include "lampvibe-params.h"
#include "phuzzbox/web.h"

using lampvibe::kParamCount;

extern "C" {
// in: P, then n voltages across the lamp. out (after them): where the filament settles at each:
// its temperature (K), its current (A), and the glow the cells see relative to the lamp's rating.
PHUZZ_EXPORT void lampvibe_steady(double *io, int n) {
  const lampvibe::Parts p = lampvibe::parts(io);
  const double *v = io + kParamCount;
  double *out = io + kParamCount + n;
  for (int i = 0; i < n; i++) {
    const double T = lampvibe::steadyT(p.fil, v[i]);
    out[i] = T;
    out[n + i] = v[i] / lampvibe::resistance(p.fil, T);
    out[2 * n + i] = lampvibe::glow(T, p.lamp->T);
  }
}
// in: P, the filament's starting temperature (K), a step (s), then n voltages, one a step. out
// (after them): the filament's temperature after each step (the engine's integration).
PHUZZ_EXPORT void lampvibe_filament(double *io, int n) {
  const lampvibe::Parts p = lampvibe::parts(io);
  double T = io[kParamCount];
  const double dt = io[kParamCount + 1], *v = io + kParamCount + 2;
  double *out = io + kParamCount + 2 + n;
  for (int i = 0; i < n; i++) out[i] = T = lampvibe::filamentStep(p.fil, v[i], T, dt);
}
// in: n temperatures (K) (no P). out (after them): tungsten's resistivity (Ω·m), its emissivity,
// and the glow the cells see relative to a filament at 2500 K.
PHUZZ_EXPORT void lampvibe_tungsten(double *io, int n) {
  const double *T = io;
  double *out = io + n;
  for (int i = 0; i < n; i++) {
    out[i] = lampvibe::resistivity(T[i]);
    out[n + i] = lampvibe::emissivity(T[i]);
    out[2 * n + i] = lampvibe::glow(T[i], 2500);
  }
}
// in: a temperature (K), then n wavelengths (m) (no P). out (after them): a black body's spectral
// radiance there (W/(m² sr m)), and the cells' response (peak 1).
PHUZZ_EXPORT void lampvibe_spectrum(double *io, int n) {
  const double T = io[0], *l = io + 1;
  double *out = io + 1 + n;
  for (int i = 0; i < n; i++) {
    out[i] = lampvibe::planck(l[i], T);
    out[n + i] = lampvibe::cellResponse(l[i]);
  }
}
// in: P, the cells' resistance (Ω), then n frequencies (Hz). out (after them): the pedal's gain,
// and the four stages' phase (rad, unwrapped: 0 to −4π).
PHUZZ_EXPORT void lampvibe_response(double *io, int n) {
  const lampvibe::Parts p = lampvibe::parts(io);
  const double R = io[kParamCount], *f = io + kParamCount + 1;
  double *out = io + kParamCount + 1 + n;
  for (int i = 0; i < n; i++) {
    out[i] = std::abs(lampvibe::response(p, R, f[i]));
    double ph = 0;
    for (int k = 0; k < lampvibe::kStages; k++) ph -= 2 * std::atan(2 * 3.14159265358979323846 * f[i] * R * p.C[k]);
    out[n + i] = ph;
  }
}
// in: P. out (at io): the lamp's rated voltage (V), current (A) and temperature (K); the filament's
// diameter (m), length (m), area (m²), heat capacity (J/K), and cold resistance at 300 K (Ω); the
// cells' lit and dark resistance (Ω) and lifetime (s); the four capacitors (F); the oscillator's
// speed (Hz) and depth; 1 for vibrato, 0 for chorus; and the Level as a factor: 20 numbers.
PHUZZ_EXPORT void lampvibe_parts(double *io) {
  const lampvibe::Parts p = lampvibe::parts(io);
  const double out[20] = {p.lamp->V, p.lamp->I, p.lamp->T, p.fil.d, p.fil.L, p.fil.A, p.fil.C,
                          lampvibe::resistance(p.fil, 300), p.rlit, p.rdark, p.tau, p.C[0], p.C[1], p.C[2], p.C[3],
                          p.speed, p.depth, p.vibrato ? 1.0 : 0.0, p.gain, 0};
  for (int k = 0; k < 20; k++) io[k] = out[k];
}
}
