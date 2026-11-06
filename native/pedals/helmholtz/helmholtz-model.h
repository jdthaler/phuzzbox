// helmholtz-model.h — Helmholtz's resonators: his ten glass spheres, each held to the ear.
//
//   each: a cavity of volume V and a short neck of radius r and length ℓ, the air in the neck a mass
//   on the cavity's spring (Rienstra and Hirschberg, eq. 5.41–5.42):
//     ((ℓ + 2δ) V/(c² Sn)) p'' + (R V/(ρ c² Sn)) p' + p = pex,   ω0² = Sn c²/((ℓ + 2δ) V)
//   p the pressure inside (at the ear, which closes the second opening), pex the sound's outside;
//   Sn = π r², δ = 0.85 r at each end (their eq. 5.43). The neck's length isn't in Helmholtz's table:
//   ℓ = 0.544 r makes the pitch his measured n = 47000 σ^¼/√S (σ the opening's area in mm², S the
//   volume in mm³), against 56174 for an orifice in a thin wall.
//   R: the neck's radiation, ¼ (k r)² ρc (their eq. 6.93), and the viscous drag of its walls, 2ρc α
//   over its length, α the viscous part of Kirchhoff's attenuation, (1/(r c)) √(π f μ/ρ)
//   the air: c = 343.2 √(T/293.15) m/s, ρ = 1.2041 (293.15/T) kg/m³, μ 1.8205e-5 Pa·s at 20 °C
#pragma once

namespace helmholtz {

constexpr int kCount = 10;
constexpr double kPi = 3.14159265358979323846;

// Helmholtz's table (Ellis's translation, Appendix II): the sphere's and the orifice's diameters (mm)
// and the interior's volume (cm³)
struct Glass { double sphere, orifice, volume; };
extern const Glass kGlass[kCount];

struct Resonator {
  double r, Sn, V, neck;    // the opening's radius (m), area (m²), the volume (m³), the neck's length ℓ (m)
  double f0, w0, Q;         // the resonance (Hz, rad/s) and its quality factor
  double Qrad, Qvisc;       // the radiation's and the walls' shares: 1/Q = 1/Qrad + 1/Qvisc
};
struct Parts {
  double c, rho, mu, T;     // the air
  Resonator res[kCount];
  int one;                  // the resonator at your ear, 0 … 9
  double openEar, level;    // gains
};
Parts parts(const double *P);
Resonator resonator(const Glass &g, double scale, double c, double rho, double mu);

// the pressure inside each resonator for each pascal outside at f (Hz): re, im (e^(−iωt))
void response(const Resonator &r, double f, double &re, double &im);

} // namespace helmholtz
