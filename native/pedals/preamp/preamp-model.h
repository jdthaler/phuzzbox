// preamp-model.h — the Tube Preamp's physics: a 1959 Fender Bassman's preamp (5F6-A), its first
// stage the 12AX7 of Fender's AB763 amps, as a netlist for the nodal DK method (phuzzbox/dk.h).
//
//   jack A ── 68 kΩ ── G1;  A ── 1 MΩ ── ground            V1a: grid G1, plate P1, cathode K1
//   P1 ── 100 kΩ ── D;  K1 ── 1.5 kΩ ∥ 25 µF ── ground
//   P1 ─┤├─ Q (20 nF);  Q ── Gain pot 1 MΩ (audio) ── ground, its wiper W1;  W1 ── 270 kΩ ── G2
//   V2a: grid G2, plate P2 ── 100 kΩ ── D, cathode K2 ── 820 Ω ── ground (no bypass)
//   V2b, a cathode follower: grid P2 (DC-coupled), plate D, cathode K3 ── 100 kΩ ── ground
//   the tone stack from K3 (Yeh and Smith's):  K3 ─┤├─ T (250 pF);  T ── (1 − t) 250 kΩ ── O;
//     O ── t 250 kΩ ── X;  K3 ── 56 kΩ ── S;  S ─┤├─ X (20 nF);  S ─┤├─ Y (20 nF);
//     X ── l 1 MΩ ── Z;  Z ── (1 − m) 25 kΩ ── Y;  Y ── m 25 kΩ ── ground
//   O ── Master pot 1 MΩ (audio) ── ground, its wiper V the output, into the cable and the next input
//   the supply: the 385 V rail E ── dropper ── D;  D ── 8 µF ── ground
//   each triode's capacitances: grid–cathode 2.3 pF, grid–plate 2.4 pF, plate–cathode 0.9 pF
//   A: the bass's coil (R, then L, to ground), its own capacitance and the cable's, its pots, and
//   the Norton current that drives them (preamp-engine.h)
//
// Each triode is Dempwolf and Zölzer's (DAFx 2011), with their fits of three 12AX7s.
#pragma once

#include "phuzzbox/dk.h"

namespace preamp {

// the nodes (0 is ground)
enum Node : int { A = 1, M, G1, P1, K1, Q, W1, G2, P2, K2, K3, T, O, X, S, Y, Z, V, D, E, kNodes = E };

// the schematic's fixed parts
constexpr double RGRID = 1e6, RSTOP1 = 68e3, RP1 = 100e3, RK1 = 1.5e3, CC = 20e-9, GAIN_POT = 1e6, RSTOP2 = 270e3;
constexpr double RP2 = 100e3, RK2 = 820, RK3 = 100e3, MASTER_POT = 1e6;
constexpr double TS_C1 = 250e-12, TS_C2 = 20e-9, TS_C3 = 20e-9, TS_R1 = 250e3, TS_R2 = 1e6, TS_R3 = 25e3, TS_R4 = 56e3;
constexpr double CGK = 2.3e-12, CAG = 2.4e-12, CAK = 0.9e-12; // the 12AX7's, as Dempwolf and Zölzer use them
constexpr double L_ACTIVE = 1e-6; // H: an active bass's output has no coil; a microhenry stands in (0.1 Ω at 20 kHz)

// Dempwolf and Zölzer's Table 1: RSD-1, RSD-2, EHX-1
extern const phuzzbox::dk::Netlist::Tube kTubes[3];

// an audio-taper pot's wiper fraction at rotation a: 10 % at half, (81^a − 1)/80
double taper(double a);

// the netlist's parts that the parameters change: their indices
struct Parts {
  int gainTop, gainBot, masterTop, masterBot, tTop, tBot, bass, midTop, midBot, supplyR, coilR, pots, load;
  int filterC, cathodeC, jackC, outC, coilL;
  int tubes[3];
};

// The circuit: voltage source 0 the 385 V rail (u[0]), current source 0 the bass's Norton current
// into A (u[1]); outputs V (the output), A (the jack), K3 (the tone stack's input) and D (the rail).
phuzzbox::dk::Netlist netlist(const double *P, Parts &parts);
// set the parts the parameters change on a circuit made from netlist(); true if its matrices need
// making again (a resistor or capacitor moved), false if only the tubes changed
bool apply(phuzzbox::dk::Circuit &c, const Parts &parts, const double *P);
phuzzbox::dk::Netlist::Tube tubeOf(const double *P); // the tube chosen, its emission applied

// what the recording saw of the bass: its coil, every capacitance and conductance across the jack
struct Recording { double coilR, coilL, C, G; };
Recording recording(const double *P);

} // namespace preamp
