// wah-model.h — the Wah's physics: the inductor wah's circuit as a netlist (phuzzbox/dk.h), with
// its parts and transistors as Holters and Zölzer list them (DAFx 2011, Table 1), and the rocker's
// pot split by the wiper. The nodes are the paper's (1 the input, 13 the supply):
//
//   R1  68 kΩ   in → 2          C1  10 nF   2 → 3 (Q1's base)
//   R2  22 kΩ   4 → Vcc         C2  4.7 µF  6 → ground
//   R3  390 Ω   5 → ground      C3  sweep   7 → 12 (Q2's emitter)       22 nF here, 10 nF as built
//   R4  470 kΩ  4 → 6           C4  220 nF  4 → 8 (the output)
//   R5  470 kΩ  4 → 10          C5  220 nF  9 (the wiper) → 10 (Q2's base)
//   R6  1.5 kΩ  3 → 7           L1  500 mH  6 → 7
//   R7  33 kΩ   6 → 7 (the Q resistor, across the coil)
//   R8  82 kΩ   6 → ground      VR1 100 kΩ  8 → 9 (α of it) and 9 → ground (the rest)
//   R9  10 kΩ   12 → ground     Q1 NPN: base 3, collector 4, emitter 5
//   R10 1 kΩ    11 → Vcc        Q2 NPN: base 10, collector 11, emitter 12
//
// Q1 (common emitter) drives the pot; the wiper feeds Q2 (an emitter follower), whose emitter
// drives the coil's top through the sweep capacitor; the coil's current returns to Q1's base
// through R6. The more of Q1's swing the wiper passes back (heel down, α small), the larger the
// sweep capacitor looks from the coil (Miller), and the lower and sharper the resonance. The DC
// bias comes from Q1's collector through R4, the coil and R6 to its base.
//
// Plugged in backwards (the Reversed switch), the bass drives the output jack (node 8) and the input
// jack (node 1) drives the cable to the amp. The bass is its pickup, as the Phuzz and the Tube
// Preamp have it: a Norton current (what the recorded voltage drove into the recording's circuit)
// into the coil's resistance and inductance (8 → 14 → ground), its own capacitance and the cable's,
// and its pots; node 1 has the amp's cable and input to ground. The signal then runs the loop the
// other way: the wiper passes the bass to Q2, which drives the coil through C3; the coil's current
// reaches Q1's base through R6, and the base reaches the input jack through C1 and R1. Q1 still
// amplifies its base onto node 8, against the pickup's impedance.
#pragma once

#include <cmath>

#include "phuzzbox/dk.h"

namespace wah {

// the nodes, numbered as the paper's
enum Node : int { IN = 1, N2, BASE1, COLL1, EMIT1, N6, N7, OUT, WIPER, BASE2, COLL2, EMIT2, VCC, COIL };

// the parts that change: their indices in the netlist (the bass's and the amp's, plugged in
// backwards only; −1 otherwise)
struct Parts { int potUpper, potLower, qR, sweepC, inductor; int coilR = -1, coilL = -1, jackC = -1, pots = -1, ampC = -1, amp = -1; };

constexpr double POT = 100e3;               // Ω: the rocker's pot
constexpr double ALPHA_HEEL = 0.008, ALPHA_TOE = 0.999; // the wiper's travel in the enclosure (the paper's)
// transistors (the paper's Ebers–Moll parameters)
constexpr double IS = 20.3e-15, BETA_F = 1430, BETA_R = 4, VT = 0.026;
constexpr double L_ACTIVE = 1e-6; // H: an active bass's output has no coil; a microhenry stands in (0.1 Ω at 20 kHz)

// The wiper's position α from the top of the pot (heel down: near 0, the most feedback) for the
// rocker's position x (0 heel, 1 toe). A linear pot's wiper follows x; an audio pot's lower part,
// from the wiper to ground, is the usual log taper (81^t − 1)/80 of the travel t = 1 − x from the
// toe, 10 % at mid-travel.
inline double alpha(double x, bool audio) {
  x = x < 0 ? 0 : x > 1 ? 1 : x;
  const double travel = audio ? 1 - (std::pow(81.0, 1 - x) - 1) / 80 : x;
  return ALPHA_HEEL + (ALPHA_TOE - ALPHA_HEEL) * travel;
}
double alpha(const double *P); // from the parameters

// The circuit. Forward: voltage source 0 the input (u[0], volts), 1 the supply (u[1]); the output
// is node 8. Backwards: voltage source 0 the supply (u[0]), current source 0 the bass's Norton
// current into node 8 (u[1], amperes); the outputs are node 1 (what the amp gets) and node 8.
phuzzbox::dk::Netlist netlist(const double *P, Parts &parts, bool backwards = false);
bool backwards(const double *P); // the Reversed switch
// set the parts the parameters change on a circuit made from netlist()
void apply(phuzzbox::dk::Circuit &c, const Parts &parts, const double *P, double alpha);

// what the recording saw of the bass: its coil, every capacitance and conductance across the jack
struct Recording { double coilR, coilL, C, G; };
Recording recording(const double *P);

} // namespace wah
