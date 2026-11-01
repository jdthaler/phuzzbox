// plate-model.h — the Plate Reverb's physics: a thin steel plate, simply supported at its edges,
// shaken by a driver and heard by two contact pickups (an EMT 140's plate; by default the positions
// Willemsen gives, which the page lets you move).
//
// Kirchhoff's thin plate: ρh ẅ + D ∇⁴w = F, D = E h³ / 12(1 − ν²). Its modes on a rectangle with
// simply supported edges are sin(mπx/Lx) sin(nπy/Ly), at
//
//   ω_mn = κ [(mπ/Lx)² + (nπ/Ly)²],  κ = √(D/ρh) = h √(E / 12ρ(1 − ν²))
//
// so the plate has a mode every 2κ/S hertz on average (S its area), and bending waves whose group
// velocity 2√(κω) rises with frequency: the highs reach the pickups first.
//
// Losses, each an amplitude decay rate α (1/s), T60 = 3 ln 10 / α:
//   the steel's thermoelastic damping, α = ω² R1 C1 / 2(ω²h² + C1²/h²);
//   radiation into the air below the coincidence frequency f_c = c²/2πκ,
//     α = (1/4π²)(ρ_a c / ρh)(2(Lx + Ly)/(Lx Ly))(c / f_c) g(√(f/f_c));
//   and the damper, a porous mat near the plate, the same at every frequency, set so that a low
//   note (100 Hz) dies in the Decay knob's time.
// Each mode is a damped resonator driven by the driver's force and read as the plate's velocity at
// each pickup.
#pragma once

#include <algorithm>
#include <cmath>

namespace plate {

constexpr double PI = 3.141592653589793;
constexpr double LX = 2, LY = 1, H = 0.5e-3;            // the plate (m)
constexpr double E = 2e11, RHO = 7850, NU = 0.3;        // steel
constexpr double RHO_A = 1.225, C_A = 343;              // air
constexpr double R1 = 4.94e-3, C1 = 2.98e-4;            // steel's thermoelastic constants (C1 in m²/s)
constexpr double DRIVE[2] = {0.4 * LX, 0.415 * LY};     // the driver, by default (m from the left and bottom edges)
constexpr double PICK[2][2] = {{0.1 * LX, 0.45 * LY}, {0.85 * LX, 0.45 * LY}}; // the pickups, left and right, by default
constexpr double F_REF = 100;                           // where the Decay knob's time holds
constexpr int MAX_MODES = 12288;

inline double kappa() { return H * std::sqrt(E / (12 * RHO * (1 - NU * NU))); }
inline double coincidence() { return C_A * C_A / (2 * PI * kappa()); }
double thermoelastic(double f);
double radiation(double f);
inline double steel(double f) { return thermoelastic(f) + radiation(f); }
// the damper's rate for a low note's T60 of `decay` seconds (none past the steel's own)
inline double damper(double decay) { return std::max(0.0, 3 * std::log(10.0) / decay - (thermoelastic(F_REF) + radiation(F_REF))); }

} // namespace plate
