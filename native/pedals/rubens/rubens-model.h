// rubens-model.h — Rubens' Tube: a loudspeaker at one end of a closed pipe of gas, a microphone inside.
//
//   the pipe: L long, radius a, cross-section St = π a², closed at both ends (the speaker's cone at
//   x = 0, a cap at x = L); plane waves only, below its first cross mode, 1.84 c/(2π a)
//   its modes: p(x, t) = p0(t) + Σ qn(t) cos(nπ x/L). The uniform one, p0 = ρc² Sd ξ/(L St), the
//   gas squeezed by the cone's displacement ξ; the others driven by the cone's volume velocity U:
//     qn'' + 2σn qn' + ωn² qn = (2ρc²/(L St)) U',
//   their losses Kirchhoff's, to the boundary layers at the walls: the wave's number
//   k = ω/c + (1 + i) α, α = (1/(a c)) √(π f μ/ρ) (1 + (γ − 1)/√Pr) (per metre), so that each mode
//   rings at ωn = nπ c/L − c αn, dying away at σn = c αn
//   the speaker: Gardner, Gee and Dix's driver (their Table I): a voice coil Re, a motor Bl, a cone of
//   mass Mms on a suspension of compliance Cms losing Rms = 2π Fs Mms/Qms, a piston filling the bore, Sd = St:
//     Mms ξ'' = Bl (V − Bl ξ')/Re − Rms ξ' − ξ/Cms − Sd p(0, t)
//   driven by an amplifier, V = Drive × the bass
#pragma once

#include <complex>

namespace rubens {

constexpr int kMaxModes = 160;
constexpr double kPi = 3.14159265358979323846;

struct Gas {
  double c, rho, mu, gamma, prandtl; // m/s, kg/m³, Pa·s, Cp/Cv, μ Cp/k
};
const Gas &gasOf(int which); // 0 propane, 1 methane: NIST at 20 °C, 101.325 kPa

struct Driver {
  double Re, Bl, Mms, Cms, Fs, Qms;
  double Rms() const { return 2 * kPi * Fs * Mms / Qms; }
};
extern const Driver kDriver;

struct Parts {
  double L, a, St, V, Sd;       // the pipe (m, m², m³), and the cone's area, the bore's (m²)
  Gas g;
  double xm;                    // the microphone, from the speaker (m)
  double drive, level, pressure;
  double cutoff;                // the first cross mode (Hz)
  int modes;                    // n = 1 … modes, all under the cutoff
  double f0[kMaxModes + 1];     // nπ c/(2π L), lossless (Hz)
  double alpha[kMaxModes + 1];  // Kirchhoff's attenuation at f0 (1/m)
  double omega[kMaxModes + 1];  // ωn = 2π f0 − c α (rad/s)
  double sigma[kMaxModes + 1];  // c α (1/s)
  double weight[kMaxModes + 1]; // cos(nπ xm/L)
  double force() const { return 2 * g.rho * g.c * g.c / (L * St); } // each mode's coupling to U'
  double spring() const { return g.rho * g.c * g.c / (L * St); }    // p0 per unit volume pushed in
};
Parts parts(const double *P);
double kirchhoff(const Gas &g, double a, double f);

// the steady response at f (Hz), e^(−iωt): the pressure at x (Pa) per volt of the amplifier, and the
// cone's velocity (m/s) per volt
struct Response { std::complex<double> p, v; };
Response response(const Parts &p, double f, double x);

} // namespace rubens
