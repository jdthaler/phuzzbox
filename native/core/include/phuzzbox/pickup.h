// pickup.h — a magnetic pickup and what it drives, as a circuit: the EMF e(t) the strings induce,
// behind the coil's resistance R and inductance L, across the coil's own capacitance, the cable's,
// and the resistance of everything to ground (the bass's volume and tone pots, the input it plugs
// into):
//
//        R       L
//   e ──/\/\──⌇⌇⌇⌇──┬────┬──── v
//                   C    R_load
//                   ⏚    ⏚
//
//   v / e = 1 / (L C s² + (R C + L / R_load) s + 1 + R / R_load)
//
// a second-order low-pass whose peak, near 1/(2π√(LC)), is the "pickup resonance" (2–6 kHz on a
// bass into a short cable). More capacitance (a longer cable) moves it down; a smaller load (a
// vintage fuzz's 10 kΩ input) damps it away. An active bass's preamp drives the cable from a few
// hundred ohms, with no inductance: v / e = 1 / (R C s + 1 + R / R_load), flat through the band.
#pragma once

#include "phuzzbox/dsp.h"

namespace phuzzbox {

struct PickupCircuit {
  bool active = false;
  double L = 3.6;        // H: the coil's inductance (passive)
  double R = 10500;      // Ω: the coil's resistance, or an active preamp's output resistance
  double Cself = 100e-12; // F: the coil's own capacitance (passive)
  double Rpots = 125e3;  // Ω: the bass's volume and tone pots to ground, in parallel (passive)
  double cable = 3;      // m of cable
  double cablePerM = 100e-12; // F per metre of cable
  double Rload = 1e6;    // Ω: the input the cable plugs into
  double Cload = 0;      // F: that input's own capacitance

  double C() const { return (active ? 0 : Cself) + cable * cablePerM + Cload; }
  double Rshunt() const { const double a = active ? 0 : 1 / Rpots; return 1 / (a + 1 / Rload); }
  // v / e as an analog section, denominator only (the numerator is 1)
  AnalogBiquad section() const {
    const double c = C(), g = 1 / Rshunt();
    if (active) return {0, 0, 1, 0, R * c, 1 + R * g};
    return {0, 0, 1, L * c, R * c + L * g, 1 + R * g};
  }
  // the undamped resonance 1/(2π√(LC)) (Hz), or 0 for an active bass
  double resonance() const { return active ? 0 : 1 / (TAU * std::sqrt(L * C())); }
};

} // namespace phuzzbox
