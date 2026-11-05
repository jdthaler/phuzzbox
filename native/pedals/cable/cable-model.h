// cable-model.h — the Transatlantic Cable's physics: your bass sent down a long cable, a line whose
// every metre has series resistance R and inductance L, and shunt capacitance C and leakance G
// (per unit length). The telegrapher's equations:
//
//   ∂v/∂x = −R i − L ∂i/∂t,   ∂i/∂x = −G v − C ∂v/∂t
//
// A sine of angular frequency ω travels as e^{−γx}, γ = √((R + iωL)(G + iωC)), into the line's
// characteristic impedance Z₀ = √((R + iωL)/(G + iωC)).
//
// - Unloaded, a submarine cable is all R and C: γ ≈ √(iωRC), so a sine's loss in nepers grows as
//   √f, and a pulse doesn't travel but diffuses, arriving in a time ∝ RC ℓ² (Kelvin's law of
//   squares).
// - Loaded with coils (Pupin and Campbell, 1900), every 1.83 km, the line behaves like a ladder of
//   L and C up to its cutoff f_c = 1/(π √(L_coil C d)), losing far less, and nothing above it.
// - Loaded as Heaviside proposed, with L/R = C/G along its whole length, it is distortionless:
//   γ = √(RG) + iω√(LC) exactly, so every frequency loses the same and travels at the same speed;
//   Z₀ = √(L/C) is real, and the line is a pure delay with a flat loss.
//
// The source drives the line through its resistance: a telegraph battery's few ohms, or a
// telephone's 600 Ω. The far end is matched (|Z₀| at 1 kHz, or √(L/C)) or open into an amplifier's
// megohm, which reflects the waves back.
#pragma once

#include <complex>

namespace cable {

constexpr int kCables = 3;
constexpr double kOpen = 1e6;        // Ω: the far end, open into an amplifier
constexpr double kCoilSpacing = 1828.8; // m: a loading coil every 6000 feet
constexpr int kMaxSections = 256;

// a cable's constants per metre: series resistance (Ω/m) and inductance (H/m), shunt capacitance
// (F/m) and leakance (S/m); and the resistance of what drives it (Ω)
struct Cable { const char *name; double R, L, C, G, source; };
const Cable &cableAt(int k);
// a submarine cable from its construction: a stranded copper core of mass mc (kg/m) inside
// gutta-percha of mass mg (kg/m), the sea its return (the cables of 1858 and 1866)
Cable submarine(const char *name, double mc, double mg);

enum Loading { none = 0, coils = 1, heaviside = 2 };

struct Parts {
  Cable c;          // the cable, with any Heaviside loading in its L and G
  double length;    // m
  int loading;
  double coil;      // H: each loading coil
  double source, load; // Ω: the source's and the far end's resistances
  double gain;      // the repeater's gain, as a factor
  // the line as solved: N sections of a ladder (unloaded and coil-loaded), each a series R and L
  // and a shunt C and G, a coil in series before every per-th; or (Heaviside) a delay and a loss
  int sections, per;
  double Rs, Ls, Cs, Gs;
  double delay, loss; // s and the factor e^{−√(RG) ℓ} (Heaviside)
  double z0;          // Ω: √(L/C) (Heaviside)
  double cutoff;      // Hz: the coils' 1/(π √((L_coil + L d) C d)), d the distance between them
};
Parts parts(const double *P);

// γ and Z₀ at f, per metre and in ohms
std::complex<double> gamma(const Cable &c, double f);
std::complex<double> z0(const Cable &c, double f);
// the far end's voltage over the source's at f: the continuous line (ABCD: cosh γℓ, Z₀ sinh γℓ,
// sinh γℓ / Z₀), with coil-loading's coils between lengths of it where it has them
std::complex<double> response(const Parts &p, double f);
// the same for the ladder as solved, each section's series and shunt branches lumped
std::complex<double> ladderResponse(const Parts &p, double f);

} // namespace cable
