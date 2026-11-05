// michelson-model.h — the Michelson Interferometer's physics: a beam split into two arms and
// recombined on a photodiode, one arm's mirror moved by your bass. The light's two paths differ by
// OPD = 2 (d + δ + x + w), the arms' difference d (the micrometer, to the nearest whole wavelength),
// the fine offset δ (the Fringe knob, a DC voltage on the actuator), the mirror's motion x and the
// air's drift w. Each spectral line j of the source (wavenumber k_j = 2π/λ_j, weight w_j, Gaussian,
// FWHM Δλ_j) gives the detector
//
//   I = (1/2) [1 + Σ_j w_j V_j(OPD) cos(k_j OPD)] / Σ_j w_j,   V_j = exp(−(π Δλ_j OPD / λ_j²)² / (4 ln 2))
//
// (the visibility: the Fourier transform of the line's shape, Wiener–Khinchin), from 0 (dark) to 1
// (bright). The mirror is a mass on a spring, driven by the actuator:
//
//   x'' + (ω₀/Q) x' + ω₀² x = ω₀² s v,  s the Stroke (m/V), v the bass's voltage.
#pragma once

#include <complex>

namespace michelson {

constexpr int kSources = 5, kMaxLines = 2;

// a spectral line: its wavelength (m), its weight, its width (FWHM, m)
struct Line { double lambda, weight, width; };
// a source: a name, its centre wavelength (m: whole wavelengths of it set the micrometer's steps,
// and the Fringe knob's phase is its), its lines, and a colour for the page (sRGB, 0–1)
struct Source { const char *name; double lambda0; int lines; Line line[kMaxLines]; };
const Source &source(int k);

// an actuator: its resonance (Hz) and quality factor
struct Actuator { double f0, Q; };
const Actuator &actuator(int k);

struct Parts {
  const Source *src;
  double rest;          // the paths' difference with the mirror at rest, before the air: 2 (d + δ) (m)
  double stroke;        // the mirror's travel per volt at low frequencies (m/V)
  double f0, Q;         // the actuator's resonance (Hz) and quality factor
  double air;           // the air's RMS drift of the arm's length (m), and its correlation time (s)
  double airTime;
  double gain;          // the Level, as a factor
  double fullScale;     // the detector's output from dark to bright (V)
};
Parts parts(const double *P);

// the detector's intensity, 0 to 1, at path difference opd (m)
double intensity(const Parts &p, double opd);
// its average over a stretch where opd runs straight from a to b: each line's cosine averaged
// exactly (its antiderivative, sin), the visibility taken at the middle
double intensityAveraged(const Parts &p, double a, double b);
// the fringes' contrast at path difference opd: (Imax − Imin)/(Imax + Imin) over a wavelength
double contrast(const Parts &p, double opd);

// the mirror's travel per volt at frequency f: s ω₀² / (ω₀² − ω² + i ω ω₀/Q)
std::complex<double> actuatorResponse(const Parts &p, double f);

} // namespace michelson
