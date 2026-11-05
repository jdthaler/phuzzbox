// lampvibe-model.h — the Lamp Vibe's physics: a slow oscillator lights a small tungsten lamp, the
// lamp shines on four cadmium-sulphide cells, and each cell is the resistor of one all-pass stage
// in the signal's path, so the light sweeps the stages' phase:
//
//   LFO ──► lamp (V) ──► filament T ──► glow the cells see ──► cells' resistance R ──► 4 × all-pass
//
// The filament is a thin tungsten wire of mass m, area A and length L, heated by the current and
// cooled by radiation (Stefan–Boltzmann; conduction down the leads neglected):
//
//   m c dT/dt = v² / R(T) − ε(T) σ A (T⁴ − T₀⁴),   R(T) = ρ(T) L / (π d²/4)
//
// with ρ(T) tungsten's measured resistivity and ε(T) its total emissivity. Its size follows from the
// lamp's rating: at the rated voltage it draws the rated current at the rated temperature.
//
// The light a cell sees is the photons its cadmium sulphide absorbs, Planck's law weighted by the
// cell's response (a bell around 540 nm): it climbs very steeply with the temperature, as the
// short-wavelength tail of a black body does. Relative to the glow at the lamp's rating, Λ frees
// electrons in the cell, which recombine with each other (so the response is sublinear):
//
//   dn/dt = Λ/τ − (n/τ)(1 + n),   R = 1 / (1/Rdark + n/Rlit)
//
// n in units of the free electrons the rated glow keeps there (the root of n(1 + n) = 1). Bright,
// the electrons recombine fast; dim, slowly: the cell's resistance falls quickly and climbs back
// slowly. Each stage is a phase splitter whose two outputs, mixed through C and the cell, give
//
//   H(s) = (1 − s R C) / (1 + s R C),
//
// unity gain at every frequency, its phase falling through −90° at f = 1/(2π R C).
#pragma once

#include <cmath>
#include <complex>

namespace lampvibe {

constexpr int kLamps = 3, kStages = 4;
constexpr double kSigma = 5.670374419e-8; // W/(m² K⁴): Stefan–Boltzmann
constexpr double kRoom = 300;             // K: the bench and the bulb's surroundings
constexpr double kDensity = 19300;        // kg/m³: tungsten
constexpr double kHeat = 150;             // J/(kg K): tungsten's specific heat, taken as constant
constexpr double kPeak = 540e-9;          // m: the cells' response peaks here
constexpr double kSpread = 80e-9;         // m: and has this FWHM halved (a bell 160 nm wide)

// tungsten's resistivity (Ω·m) and total hemispherical emissivity at T
double resistivity(double T);
double emissivity(double T);
// the light a cadmium-sulphide cell sees from a black body at T, relative to one at Tref: Planck's
// photon flux weighted by the cell's response, ∫ S(λ) λ B_λ(T) dλ. Tabled in 1/T, so exact
// enough and cheap.
double glow(double T, double Tref);
// the cells' response at wavelength λ (peak 1), and a black body's spectral radiance B_λ(T)
// (W/(m² sr m))
double cellResponse(double lambda);
double planck(double lambda, double T);

// a lamp: its rated voltage (V), current (A) and filament temperature (K)
struct Lamp { const char *name; double V, I, T; };
const Lamp &lamp(int k);

// a filament, sized from its lamp's rating
struct Filament {
  double d, L;   // its wire's diameter and length (m)
  double A;      // its radiating area (m²)
  double geom;   // L / (π d²/4) (1/m): R = ρ(T) geom
  double C;      // its heat capacity (J/K)
};
Filament filament(const Lamp &l);
// the filament's resistance at T (Ω)
inline double resistance(const Filament &f, double T) { return resistivity(T) * f.geom; }
// dT/dt with v across it
double heating(const Filament &f, double v, double T);
// one step of dt, by the classical fourth-order Runge–Kutta (a filament's quickest rate, cold and
// switched on, is some 10 µs, slower than a step at 48 kHz)
double filamentStep(const Filament &f, double v, double T, double dt);
// where the filament settles with v across it (bisection on the power balance)
double steadyT(const Filament &f, double v);

struct Parts {
  const Lamp *lamp;
  Filament fil;
  double speed;        // Hz: the oscillator
  double depth;        // 0–1: how far the lamp's voltage dips from its rating
  double rlit, rdark;  // Ω: the cells
  double tau;          // s: the cells' electrons' lifetime when dim
  double C[kStages];   // F: the stages' capacitors
  bool vibrato;        // the wet signal alone (vibrato), or wet and dry mixed (chorus)
  double gain;         // the Level, as a factor
};
Parts parts(const double *P);

// the lamp's voltage at the oscillator's phase θ (rad): from the rating, dipping by depth
inline double lampVoltage(const Parts &p, double sinTheta) { return p.lamp->V * (1 - p.depth * 0.5 * (1 - sinTheta)); }
// the cells' free electrons under a steady light Λ, and their resistance with n
inline double steadyN(double light) { return 0.5 * (std::sqrt(1 + 4 * light) - 1); }
inline double cellR(const Parts &p, double n) { return 1 / (1 / p.rdark + n / p.rlit); }
// one step of the cells' electrons (Heun's method)
double cellStep(const Parts &p, double light, double n, double dt);

// the four stages' response at f with the cells at R, and the pedal's (wet, or wet and dry halved)
std::complex<double> stages(const Parts &p, double R, double f);
std::complex<double> response(const Parts &p, double R, double f);

} // namespace lampvibe
