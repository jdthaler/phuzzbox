// openair-model.h — Open Air: your bass heard across open ground, as outdoor acoustics computes it.
//
//   the air: ISO 9613-1's absorption α(f) in dB/m, from the oxygen's and the nitrogen's vibrational
//   relaxations and the classical and rotational losses, at the temperature and humidity, at sea level;
//   the speed of sound c = 343.2 √(T/293.15) m/s
//   the paths: a source at height hs and a listener at hr, d apart: the direct path r1 and the path
//   reflected from the ground r2, arriving at the angle θ from the vertical, cos θ = (hs + hr)/r2
//   the ground: a porous surface of flow resistivity σ, its impedance by Miki's form of Delany and
//   Bazley's law, Z = 1 + 9.08 (f/σ)^−0.75 + i 11.9 (f/σ)^−0.73 (σ in kPa·s/m², e^(−iωt)), locally
//   reacting; the spherical wave's reflection by Weyl and van der Pol's formula,
//     Q = Rp + (1 − Rp) F(w),  Rp = (Z cos θ − 1)/(Z cos θ + 1),
//     F(w) = 1 + i √π w e^(−w²) erfc(−iw),  w = √(i k r2/2) (1/Z + cos θ)
//   heard: p = e^(ik r1)/r1 · 10^(−α r1/20) + Q e^(ik r2)/r2 · 10^(−α r2/20), with the microphone's
//   gain bringing the direct sound back to what it was a metre from the source, and its delay taken
//   away, so H = 10^(−α r1/20) + (r1/r2) Q 10^(−α r2/20) e^(ik (r2 − r1)).
#pragma once

#include <complex>

namespace openair {

using cplx = std::complex<double>;

constexpr int kGrounds = 5;
// the grounds' flow resistivities (kPa·s/m²), 0 for rigid: the geometric middles of Piercy and
// Embleton's ranges (1982, Fig. 3)
double resistivity(int ground);

struct Parts {
  double d, hs, hr;   // the distance along the ground, the source's and the listener's heights (m)
  double T, rh;       // the air's temperature (K) and relative humidity (%), at sea level's pressure
  double sigma;       // the ground's flow resistivity (kPa·s/m²), 0 for rigid
  double level;       // the Level, as a gain
  double r1() const;  // the direct path (m)
  double r2() const;  // the reflected path (m)
  double cosTheta() const { return (hs + hr) / r2(); }
};
Parts parts(const double *P);

constexpr double kPressure = 101.325; // the air's pressure (kPa): sea level's

// the air's absorption by ISO 9613-1: what doesn't depend on the frequency, worked out once
struct Air {
  Air(double T, double rh, double pa = kPressure);
  double classical, oxygen, frO, nitrogen, frN; // the terms' coefficients and the relaxation frequencies (Hz)
  double at(double f) const;                    // α (dB/m)
};

double speed(double T);                                                    // c (m/s)
double absorption(double f, double T, double rh, double pa = kPressure); // α (dB/m), ISO 9613-1
cplx impedance(double f, double sigma);                     // Z/ρc, Miki (e^(−iωt))
cplx faddeeva(cplx z);                                      // w(z) = e^(−z²) erfc(−iz)
cplx reflection(double f, const Parts &p);                  // Q (e^(−iωt))
cplx response(double f, const Parts &p);                    // H, as heard (e^(+iωt): a delay is e^(−iωτ))

// The FIR filter that plays H at the rate fs: n taps (a power of two), the minimum-phase filter with
// H's magnitude. The model's Q is not quite causal (Miki's law and Weyl and van der Pol's formula are
// approximations), so a filter that begins with the sound can't play its phase; the minimum-phase one
// is the causal filter with that magnitude whose response comes soonest, its phase fixed by its
// magnitude as causality fixes it. Designed from |H| at 2n frequencies through the cepstrum (Oppenheim
// and Schafer's homomorphic method), its end tapered by half a Hann window over the last n/4 taps. The
// ground's reflection Q, the costly part, is worked out at kGrid frequencies spaced evenly in log f
// and interpolated between them: it changes smoothly. scratch: designScratch(n) complex numbers.
constexpr int kGrid = 256;
inline int designScratch(int n) { return 2 * n + kGrid; }
void design(const Parts &p, double fs, int n, double *h, cplx *scratch);
void fft(cplx *x, int n, bool inverse); // in place, radix 2, unscaled

} // namespace openair
