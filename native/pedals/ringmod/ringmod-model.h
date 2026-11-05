// ringmod-model.h — the Ring Modulator's circuit: four diodes in a ring between two centre-tapped
// transformers, with the carrier fed between the centre taps.
//
//   the bass, from the input buffer, through Rs = 600 Ω into T1's primary; T1's secondary is two
//   halves, each with the primary's turns, so its ends sit at vc ± u, where vc is its centre tap
//   the carrier, from its oscillator through Rc = 470 Ω, into T1's centre tap: vc
//   the ring: D1 from T1's top end (A) to T2's top end (C), D2 from C to T1's bottom end (B),
//   D3 from B to T2's bottom end (D), D4 from D to A; T2's primary ends at ±w, its centre tap
//   grounded; its secondary, with the turns of one half, drives RL = 600 Ω with w
//
// The diodes' voltages are x1 = vc + u − w, x2 = w − vc + u, x3 = vc − u + w, x4 = −w − vc − u.
// Ampère's law on each transformer's core (ideal, but for its magnetising inductance, Lm across
// the winding that is one half's turns) and Kirchhoff's current law give three equations in u,
// vc and w, the ring's own unknowns:
//
//   (vin − u)/Rs = iL1 + (i1 + i2 − i3 − i4)     T1: the primary's current is the halves' difference
//   (vcar − vc)/Rc = i1 − i2 + i3 − i4           the carrier's current, out of T1's centre tap
//   i1 − i2 − i3 + i4 = iL2 + w/RL               T2: the halves' difference drives the load
//
// with the inductors' currents iL1, iL2 the only state (L diL/dt = u, and = w). A carrier far
// above the knee turns D1 and D3 on (vc > 0) or D2 and D4 (vc < 0), and w = ±u: the bass times
// the sign of the carrier. With no load or source resistance, ideal exponential diodes give
// tanh(w/nVT) = tanh(u/nVT) tanh(vc/nVT) exactly (test/ringmod-circuit.mjs).
#pragma once

namespace ringmod {

// a diode family (the Bandgap's): voltage at 1 mA at 25 °C, and ideality n
struct Family { const char *name; double v1mA, n; };
constexpr int kFamilies = 3;
const Family &family(int k);

// one diode: saturation current and n kT/q; past `cap` (1 A) its exponential carries on as its
// tangent, so Newton's steps stay finite
struct Diode {
  double is = 1e-9, nvt = 0.04, cap = 20;
  double knee = 0.3; // SPICE's vcrit, nVT ln(nVT / (√2 is)): where Newton's steps start to be limited
  double current(double v, double &slope) const;
};

enum Wave : int { kSine = 0, kTriangle = 1, kSquare = 2 };

struct Parts {
  double Gs, Gc, GL;   // 1/Rs, 1/Rc, 1/RL (S)
  double L;            // each transformer's magnetising inductance (H)
  Diode d[4];          // D1 … D4; D1 needs `mismatch` more volts than the rest
  double fc, amp;      // the carrier: frequency (Hz) and peak (V)
  int wave;
  double rise;         // the square's rise time, rail to rail at the comparator's slew rate (s)
  double mix, gain;    // the wet share, and the Level times the recovery amplifier's 2
  double makeup;       // the recovery amplifier's gain
};
Parts parts(const double *P);
constexpr double kRs = 600, kRc = 470, kRL = 600, kSlew = 0.5e6, kMakeup = 2;

// the carrier's voltage at phase p (cycles, any real)
double carrierAt(const Parts &p, double phase);

// The ring's state: u, vc, w, and the diodes' currents.
struct Ring { double u = 0, vc = 0, w = 0, i[4] = {}; };

// Solve the ring's three equations for x = {u, vc, w} by Newton from the x given, with the
// inductors as conductance G and a current J each (G = 0, J = 0: no inductors, as for the views).
// It stops after a full step smaller than tol (V; the error left is near its square over nVT).
// Returns the iterations, or 0 if it didn't converge.
int solve(const Parts &p, double vin, double vcar, double G1, double J1, double G2, double J2, Ring &r, double tol = 2e-5);

// the diodes' currents at r's voltages
void currents(const Parts &p, Ring &r);

// d w / d vin at vin = 0 for the carrier voltage vcar, with the inductors carrying the constant
// currents J1 and J2: the switching function the bass is multiplied by; and w at vin = 0, what of
// the carrier leaks through. r: the guess, and the solution.
void switching(const Parts &p, double vcar, double J1, double J2, Ring &r, double &g, double &w0);

// One cycle of the carrier at n points, in its periodic steady state with nothing in, for
// transformers whose inductance is large: a winding holds no DC voltage, so each inductor carries
// the constant current that makes u's and w's averages zero (Newton's method on the two averages).
// Out: the carrier's voltage, the switching function and the leak at each point.
void cycle(const Parts &p, int n, double *vcar, double *g, double *w0);

} // namespace ringmod
