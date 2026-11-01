// spring-model.h — the Spring Reverb's physics: a reverb tank's helical springs as waves on a
// curved rod, and their modes.
//
//   in ─► drive coil ─► torque on bead 0 ─► springs (in parallel) ─► bead 1 turns ─► pickup coil
//         (a current source)                                          (EMF ∝ its angular velocity)
//
// Each spring is a steel wire of radius r wound into a coil of radius R, L long. Waves on it obey
// the thin-spring model of the spring-reverb literature (Fletcher, Tarnopolskaya & de Hoog 2001;
// Bilbao & Parker 2010): the coil as a stack of rings at zero helix angle, moving in its plane,
// with u the displacement toward the axis and v along the wire, ε = 1/R:
//
//   ρA u_tt = −EI (∂ₛ² + ε²)² u + EA ε (∂ₛv − εu)
//   ρA v_tt = EA ∂ₛ(∂ₛv − εu)
//
// Plane waves e^{i(ωt − ks)} turn it into a symmetric 2 × 2 eigenproblem K(k)y = ω²y,
//
//   K = [ κ²(k² − ε²)² + γ²ε²   −γ²εk ]      κ² = EI/ρA = r²E/4ρ,  γ² = E/ρ
//       [ −γ²εk                  γ²k² ]
//
// whose lower root carries the sound: ω² = 2p/(s + √(s² − 4p)), s = tr K, p = det K =
// κ²γ²k²(k² − ε²)². It rises from zero, peaks at the transition frequency F_C (k ≈ 0.53ε), falls
// to zero at k = ε (the coil sliding sideways) and climbs again as a bending wave.
//
// The tank's ends: the bead turns with the wire's end section, whose rotation about the spring's
// axis is ψ = ∂ₛu + εv. Standing waves with u ∝ sin ks and v ∝ cos ks (k = nπ/L) leave the ends
// free to turn; mode n's share of the bead's motion is
//
//   share = (β − kR)² / (1 + β²),   β = γ²εk/(γ²k² − ω²)
//
// (1 for the low-frequency rotation wave, 0 for the sideways slide at k = ε). The bead's own
// inertia I_b loads each end: a wave passes it as 1/|1 + iωI_b/Z|, Z = I'c₀ the rotation line's
// impedance, which for both beads is H(f) = 1/(1 + (f/f_b)²), f_b = f₀/(πμ), μ = I_b/I_spring.
#pragma once

#include <cmath>

namespace spring {

constexpr double PI = 3.141592653589793;
constexpr double STEEL_E = 200e9, STEEL_RHO = 7850; // spring steel, typical values
constexpr double MAGNET_RHO = 7300;                 // the beads: alnico magnets
constexpr int MAX_SPRINGS = 3;
constexpr int MAX_MODES = 3200;                     // the engine's bank, over all the springs

// One spring of a tank as Parker and Bilbao measured it (DAFx-09, Appendix A).
struct Coil { double D, turns, H, magnetL, magnetD; }; // coil diameter, turns, helix length; the bead's magnet (m)
struct Tank { int count; Coil coil[MAX_SPRINGS]; };
const Tank &tankOf(int which); // 0: Leem Pro KA-1210 (three springs), 1: Olson X-82 (two), 2: the Leem's first alone

// One spring's waves.
struct Spring {
  double R = 0, r = 0, L = 0, eps = 0;
  double kap2 = 0, gam2 = 0;     // κ², γ²
  double c0 = 0, TD = 0;         // the low-frequency speed along the wire κε, and the echo time 2L/c₀
  double kc = 0, Fc = 0;         // the transition: the lower root's peak
  double mu = 0, fb = 0;         // the bead's inertia, as a share of the spring's, and its corner
  void set(const Coil &c, double wireD);
  double w2(double k) const;            // the lower root ω²(k)
  double omega(double k) const { return std::sqrt(w2(k)); }
  double cg(double k) const;            // dω/dk
  double share(double k) const;         // the bead's share of the mode
  double bead(double f) const { const double x = f / fb; return 1 / (1 + x * x); }
};

// The losses (rates σ, 1/s): oil, the steel, and the mounts (ℓ dB at each bead, |c_g|/L times a
// second).
double sigma(double f, double cg, double L, double mountsDb, double eta, double oil);

// The page's numbers for the controls.
struct Model {
  int tank = 0;
  double wire = 0.35e-3, mounts = 0.4, eta = 2e-4, oil = 0;
  double dry = 1, reverb = 0.3, level = 1;
};
Model model(const double *P);

} // namespace spring
