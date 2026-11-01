// blackhole-model.h — the Black Hole's physics: a Kerr black hole's quasinormal modes, the ringing
// by which a perturbed hole settles, which LIGO hears after a merger.
//
// A mode (l, m, n) rings as e^{−iωt} with complex ω; in units of the hole's mass, Mω depends only on
// the spin a. Forte's table (qnm-table.h) holds Mω from Leaver's continued fractions for l = 2–4,
// every m and n = 0–2, at 117 spins from 0 to 1 − 10⁻⁶; between them it is read by Forte's cubic
// Hermite interpolation in u = −log₁₀(1 − a), on Re Mω and log(−Im Mω). The frequency in hertz is
// Re ω / 2π with M in seconds, M = (G M☉ / c³) × the mass in suns.
//
// How strongly a merger of mass ratio q excites each mode is Kamaretsos et al.'s fits, as Gossan,
// Veitch and Sathyaprakash give them in ν = q/(1 + q)²; it is seen at an inclination ι through the
// spin-weighted spherical harmonics ₋₂Y_lm, h₊ − i h× = Σ [A ζ ₋₂Y_lm(ι) + (−1)^l A ζ* ₋₂Y_l,−m(ι)].
#pragma once

#include <cmath>

namespace blackhole {

constexpr double PI = 3.141592653589793;
constexpr double MSUN_S = 4.925490947e-6; // G M☉ / c³ (s)
constexpr double MSUN_KM = 1.476625;      // G M☉ / c² (km)

struct Omega { double re, im; };
// Mω of (l, m, n) at spin a (M = 1); false if the table has no such mode
bool omega(int l, int m, int n, double a, Omega &out);
inline double spinOf(double nines) { return 1 - std::pow(10.0, -nines); }

// ₋₂Y_lm(θ, φ = 0), real
double swsh(int l, int m, double theta);

// the merger's amplitudes (A₂₂ = 1): (2,1), (3,3), (4,4) relative to (2,2)
struct Amplitudes { double a21, a33, a44; };
Amplitudes amplitudes(double q);

// the horizon: r₊ = M(1 + √(1 − a²)), Ω_H = a / (r₊² + a²) (M = 1)
inline double horizon(double a) { return 1 + std::sqrt(1 - a * a); }

} // namespace blackhole
