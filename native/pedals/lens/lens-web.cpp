// lens-web.cpp — the model functions the Gravitational Lens's page and tests call (through the
// scratch area, shared/wasm.js), from a parameter array.

#include <cmath>
#include <complex>

#include "lens-engine.h"
#include "lens-model.h"
#include "lens-params.h"
#include "phuzzbox/web.h"

using lens::kParamCount;

namespace {
// a kernel for P at fs, built whole (the engine's largest at that rate)
const lens::Kernel &built(const double *P, double fs) {
  static lens::Kernel k;
  const int cap = fs <= 50000 ? 16384 : fs <= 100000 ? 32768 : 65536;
  k.reserve(cap);
  k.start(lens::parts(P), fs, cap);
  while (!k.work(1 << 20)) {}
  return k;
}
} // namespace

extern "C" {
// in: P, a sample rate (Hz), then room for n. out (at the room): the kernel's length in taps, then
// its first n − 1 taps (zero past its end): the lens's impulse response in waves from the first
// image on, sampled at that rate (whatever P's Optics).
PHUZZ_EXPORT void lens_kernel(double *io, int n) {
  const lens::Kernel &k = built(io, io[kParamCount]);
  double *out = io + kParamCount + 1;
  out[0] = k.length();
  for (int i = 1; i < n; i++) out[i] = i - 1 < k.length() ? k.taps()[i - 1] : 0;
}
// in: P, a sample rate (Hz), then n frequencies (Hz). out (after them): at each, the waves'
// response (the kernel's: size, then phase in rad, e^{−iωt} with the first image at t = 0), the
// rays' as the engine plays them (their chains and kRayLead samples' lead: size, phase), and
// geometric optics', the two images alone (size, phase): 6n numbers.
PHUZZ_EXPORT void lens_response(double *io, int n) {
  const double fs = io[kParamCount];
  const lens::Kernel &k = built(io, fs);
  const lens::Parts p = lens::parts(io);
  const double *f = io + kParamCount + 1;
  double *out = io + kParamCount + 1 + n;
  const std::vector<double> &h = k.taps();
  for (int i = 0; i < n; i++) {
    // Σ hₖ e^{−iωk/fs}, the phasor turned by multiplication (renormalised now and then)
    const std::complex<double> step = std::polar(1.0, -2 * 3.14159265358979323846 * f[i] / fs);
    std::complex<double> z = 1, s = 0;
    for (int j = 0; j < k.length(); j++) {
      s += h[j] * z;
      z *= step;
      if ((j & 1023) == 1023) z /= std::abs(z);
    }
    const std::complex<double> g = lens::geometric(p, f[i]), r = lens::rayResponse(p, f[i], fs);
    out[i] = std::abs(s);
    out[n + i] = std::arg(s);
    out[2 * n + i] = std::abs(r);
    out[3 * n + i] = std::arg(r);
    out[4 * n + i] = std::abs(g);
    out[5 * n + i] = std::arg(g);
  }
}
// in: an offset y (Einstein radii), then n arrival times τ. out (after them): the area of the lens
// plane arriving before each (Einstein radii²).
PHUZZ_EXPORT void lens_area(double *io, int n) {
  for (int i = 0; i < n; i++) io[1 + n + i] = lens::area(io[1 + i], io[0]);
}
// in: P. out (at io): the time unit 4GM(1 + z)/c³ (s); the images' positions x₊, x₋ (Einstein
// radii), arrival times T₊, T₋ (units) and magnifications μ₊, μ₋; the second image's delay (s);
// the total magnification |μ₊| + |μ₋|; and the frequency at which w = 1, 1/(2π · unit) (Hz):
// 11 numbers.
PHUZZ_EXPORT void lens_parts(double *io) {
  const lens::Parts p = lens::parts(io);
  const double out[11] = {p.unit, p.im.xp, p.im.xm, p.im.Tp, p.im.Tm, p.im.mup, p.im.mum, p.delay, p.magnification,
                          1 / (2 * 3.14159265358979323846 * p.unit), 0};
  for (int k = 0; k < 11; k++) io[k] = out[k];
}
}
