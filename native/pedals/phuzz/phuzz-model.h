// phuzz-model.h — the Phuzz's physics: a two-transistor germanium fuzz (PNP, positive ground) as
// a circuit, driven by the bass's pickup at its input jack.
//
//   jack A ─┤├─ B         C1 2.2 µF; Q1: base B, emitter to ground, collector K1 ── R1 33 kΩ ── S
//   B ── R4 100 kΩ ── E2  Q2: base K1, emitter E2, collector K2
//   E2 ── (1 − fuzz)·1 kΩ ── W ── fuzz·1 kΩ ── ground;  W ── C2 20 µF ── ground   (the Fuzz pot)
//   K2 ── R3 8.2 kΩ ── X ── R2 470 Ω ── S;   X ─┤├─ O (C3 10 nF);  O ── 500 kΩ audio pot ── ground,
//   its wiper V the output, into the cable's capacitance and the next input
//   S: the rail, the battery's − (its EMF behind its internal resistance); its + is ground
//   A: the bass's coil (R + sL) to ground, its own capacitance and the cable's, its pots
//
// Each transistor is Ebers–Moll's (the transport form): with veb = Ve − Vb and vcb = Vc − Vb,
//   iF = Is (e^(veb/Vt) − 1),  iR = Is (e^(vcb/Vt) − 1)
//   current out of the collector  iF − iR/αR,  out of the base  iF/βF + iR/βR
// with Is from the leakage a transistor tester reads, I_CEO = Is (βF + βR + 1)/βR at 20 °C, and
// SPICE's temperature laws: Is ∝ (T/T0)³ e^((Eg/kT)(T/T0 − 1)) with germanium's Eg = 0.67 eV,
// β ∝ (T/T0)^1.5, Vt = kT/q.
//
// The circuit is discretised by the nodal DK method (Yeh, Abel and Smith 2010; Holters and Zölzer
// 2011): every capacitor and the coil by the trapezoidal rule, as a conductance and a current
// carried from the last sample; the linear network solved once (a 10 × 10 inverse) for what each
// carried current, each source and each transistor current does to every node; and each sample
// only the four junction voltages solved, by Newton on v = p + K i(v).
#pragma once

#include <array>

namespace phuzz {

constexpr double kT0 = 293.15;            // K: where the leakage is quoted (20 °C)
constexpr double kBoltzmannOverQ = 8.617333262e-5; // V/K
constexpr double kEg = 0.67, kXti = 3, kXtb = 1.5, kBetaR = 2;
// the schematic's parts
constexpr double kC1 = 2.2e-6, kR1 = 33e3, kR4 = 100e3, kFuzzPot = 1e3, kC2 = 20e-6, kR2 = 470, kC3 = 10e-9, kVolPot = 500e3;

// an audio-taper pot's wiper fraction at rotation a: 10 % at half, as the usual two-segment taper
// is approximated, (81^a − 1)/80
double taper(double a);

struct Transistor {
  double bF = 100, bR = kBetaR, is = 1e-6, vt = 0.025;
  double vcrit = 0.3; // where SPICE starts limiting a junction's forward steps: Vt ln(Vt / (√2 Is))
  // collector and base currents flowing OUT of a PNP's terminals, and their derivatives by veb, vcb
  void currents(double veb, double vcb, double &ic, double &ib, double dic[2], double dib[2]) const;
};
Transistor transistor(double hfe, double iceo, double T);

// The circuit's values, from the pedal's parameters.
struct Parts {
  Transistor q1, q2;
  double Ra, Rb, Rtop, Rbot, R3, Vbat, Rbat;
  bool active;
  double coilR, coilL, Gpots, Cself, Cin, Crec, Grec, Cout, Gload;
};
Parts parts(const double *P);

// The node numbers.
enum Node : int { A, B, K1, E2, W, K2, X, S, O, V, kNodes };

// The DK method's matrices for one sampling interval T (T = 0: DC, capacitors open). The
// carried state z = [J of C1, C2, C3, Cjack, Cout; the coil's carried current; the bass's Norton
// current I; the battery's EMF]; the junctions v = [veb1, vcb1, veb2, vcb2]; the transistor
// currents i = [out of Q1's collector, its base, Q2's collector, its base].
struct DK {
  static constexpr int NZ = 8, NV = 4, NY = 7; // y = [the five capacitors' voltages, the jack, the output]
  void build(const Parts &p, double T);
  std::array<double, NV * NZ> Pz{};   // p = Pz z
  std::array<double, NV * NV> K{};    // v = p + K i
  std::array<double, NY * NZ> Yz{};   // y = Yz z + Yi i
  std::array<double, NY * NV> Yi{};
  std::array<double, kNodes * NZ> Hz{}; // every node voltage = Hz z + Hi i (for the views)
  std::array<double, kNodes * NV> Hi{};
  std::array<double, 5> Gc{};         // the capacitors' companion conductances 2C/T
  double Gl = 0, rho = 0;             // the coil's: i = Gl v + carried; carried' = rho i + Gl v
};

// Newton on v = p + K i(v): from the guess in v until a step is under 100 µV (and so the error
// under about 0.2 µV) or maxIt; returns the iterations taken (maxIt + 1: no convergence).
// Forward steps are limited as SPICE limits them (pnjlim).
int solveJunctions(const DK &dk, const Transistor &q1, const Transistor &q2, const double p[4], double v[4], double i[4], int maxIt = 50);

// The DC operating point: the battery switched on in steps, Newton at each.
struct OperatingPoint {
  double v[4], i[4];
  double node[kNodes];
};
OperatingPoint operatingPoint(const Parts &p);

} // namespace phuzz
