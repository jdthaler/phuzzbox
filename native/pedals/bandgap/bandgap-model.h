// bandgap-model.h — the Bandgap's circuit: a non-inverting op-amp stage whose gain the Drive pot
// sets, then 1 kΩ into a pair of diodes to ground with 3.3 nF across them, then a buffer, the
// Filter (1.5 kΩ and a 100 kΩ pot into 3.3 nF) and the Level. Four capacitors' voltages are the
// state the diodes couple (the Filter's, behind the buffer, follows on its own):
//
//   x   the op-amp's output (its compensation capacitor's voltage, as a macromodel has it)
//   vf  across Cf (100 pF) and the Drive pot Rf, from the output to the inverting input u = x − vf
//   vg  across the low-cut capacitor Cg, in series with Rg (1 kΩ) from u to ground
//   vd  across the diodes and Cd (3.3 nF), fed from x through Rt = 1 kΩ
//
// The op-amp: its input pair's current saturates as tanh, so its output moves at
//   dx/dt = SR tanh(e / Vs),  e = v+ − u,  Vs = SR / (2π GBW),
// which is 2π GBW e for small e (the gain–bandwidth product) and ±SR, the slew rate, for large;
// and it stops within a little of each rail. Each diode is Shockley's, its saturation current
// from its voltage at 1 mA and climbing with temperature by its bandgap (bandgap-model.cpp).
#pragma once

#include <complex>

namespace bandgap {

// a diode family: its voltage at 1 mA at 25 °C, ideality n, the energy (eV) that sets how its
// saturation current climbs with temperature (the bandgap; a Schottky's barrier height), the
// exponent of T in front (XTI: 3 for a pn junction, 2 for a Schottky), and for an LED its light's
// wavelength (m), whose photon energy hc/λ is the bandgap
struct Family { const char *name; double v1mA, n, eg, xti, lambda; };
constexpr int kFamilies = 6;
const Family &family(int k);
constexpr double kT0 = 298.15; // 25 °C, where v1mA holds

// a stack of identical diodes in series, at temperature T: current and its slope at voltage v
struct Stack {
  int count = 1;       // diodes in series (0: none, no current)
  double is = 0, nvt = 0.0257; // saturation current (A), and n kT/q per diode (V)
  double cap = 40;             // ln(10 A / is): past it, the exponential carries on as its tangent
  double current(double v, double &slope) const;
  double voltageAt(double i) const; // the voltage that passes current i > 0
};

struct Parts {
  double Rf, Cf, Rg, Cg, Rt, Cd; // ohms and farads
  double Rft, Ct;                // the Filter after the buffer: 1.5 kΩ + the pot, into 3.3 nF
  double SR, GBW, Vs, rail;      // V/s, Hz, V, and the output's swing (±V)
  Stack up, down;                // the diodes that conduct for vd > 0 and vd < 0
  double gain;                   // the Level, as a factor
  int diodes;                    // the family (kFamilies: none)
};
Parts parts(const double *P);

// the circuit's derivatives at state y = {x, vf, vg, vd} with input vin, and their Jacobian
// (row i, column j: ∂f_i/∂y_j); the diode current comes back in *id
void derivatives(const Parts &p, const double *y, double vin, double *f, double *J, double *id);

// the small-signal transfer function from the input to vd, at frequency f (Hz): the op-amp an
// integrator 2π GBW / s, the diodes their slope at 0 V
std::complex<double> response(const Parts &p, double f);

} // namespace bandgap
