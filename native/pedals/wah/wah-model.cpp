// wah-model.cpp — the Wah's circuit (wah-model.h).

#include "wah-model.h"

#include "wah-params.h"

namespace wah {

double alpha(const double *P) { return alpha(P[position], P[taper] < 0.5); }
bool backwards(const double *P) { return P[reversed] >= 0.5; }

namespace {
// the bass's parts at the jack it plugs into, and the amp's at the other
struct Bass { double coilR, coilL, jackC, pots, ampC, amp; };
Bass bass(const double *P) {
  const bool passive = P[active] < 0.5;
  return {passive ? P[pickupR] : P[activeR], passive ? P[pickupL] : L_ACTIVE,
          (passive ? P[pickupC] : 0) + P[cable] * P[cablePF],
          passive ? P[pots] : 1e12, // an active bass's pots are behind its preamp
          P[outCable] * P[cablePF], P[load]};
}
} // namespace

Recording recording(const double *P) {
  const bool passive = P[active] < 0.5;
  const Bass b = bass(P);
  return {b.coilR, b.coilL, (passive ? P[pickupC] : 0) + P[recCable] * P[cablePF], (passive ? 1 / P[pots] : 0) + 1 / P[recLoad]};
}

phuzzbox::dk::Netlist netlist(const double *P, Parts &parts, bool back) {
  phuzzbox::dk::Netlist n;
  const double a = alpha(P);
  parts = Parts{};
  if (!back) {
    n.source(IN);  // u[0]: the input, in volts
    n.source(VCC); // u[1]: the supply
  } else {
    n.source(VCC);   // u[0]: the supply
    n.current(OUT);  // u[1]: the bass's Norton current, into the output jack
    const Bass b = bass(P);
    parts.coilR = n.resistor(OUT, COIL, b.coilR);
    parts.coilL = n.inductor(COIL, 0, b.coilL);
    parts.jackC = n.capacitor(OUT, 0, b.jackC);
    parts.pots = n.resistor(OUT, 0, b.pots);
    parts.ampC = n.capacitor(IN, 0, b.ampC); // the input jack drives the cable to the amp
    parts.amp = n.resistor(IN, 0, b.amp);
  }
  n.resistor(IN, N2, 68e3);       // R1
  n.resistor(COLL1, VCC, 22e3);   // R2
  n.resistor(EMIT1, 0, 390);      // R3
  n.resistor(COLL1, N6, 470e3);   // R4
  n.resistor(COLL1, BASE2, 470e3); // R5
  n.resistor(BASE1, N7, 1.5e3);   // R6
  parts.qR = n.resistor(N6, N7, P[qR]); // R7, across the coil
  n.resistor(N6, 0, 82e3);        // R8
  n.resistor(EMIT2, 0, 10e3);     // R9
  n.resistor(COLL2, VCC, 1e3);    // R10
  parts.potUpper = n.resistor(OUT, WIPER, a * POT);
  parts.potLower = n.resistor(WIPER, 0, (1 - a) * POT);
  n.capacitor(N2, BASE1, 10e-9);  // C1
  n.capacitor(N6, 0, 4.7e-6);     // C2
  parts.sweepC = n.capacitor(N7, EMIT2, P[sweepC]); // C3
  n.capacitor(COLL1, OUT, 220e-9); // C4
  n.capacitor(WIPER, BASE2, 220e-9); // C5
  parts.inductor = n.inductor(N6, N7, P[inductor]); // L1
  n.npn(BASE1, COLL1, EMIT1, IS, BETA_F, BETA_R, VT);
  n.npn(BASE2, COLL2, EMIT2, IS, BETA_F, BETA_R, VT);
  if (back) { n.output(IN); n.output(OUT); } else n.output(OUT);
  return n;
}

void apply(phuzzbox::dk::Circuit &c, const Parts &parts, const double *P, double a) {
  c.setResistor(parts.potUpper, a * POT);
  c.setResistor(parts.potLower, (1 - a) * POT);
  c.setResistor(parts.qR, P[qR]);
  c.setCapacitor(parts.sweepC, P[sweepC]);
  c.setInductor(parts.inductor, P[inductor]);
  if (parts.coilR < 0) return;
  const Bass b = bass(P);
  c.setResistor(parts.coilR, b.coilR);
  c.setInductor(parts.coilL, b.coilL);
  c.setCapacitor(parts.jackC, b.jackC);
  c.setResistor(parts.pots, b.pots);
  c.setCapacitor(parts.ampC, b.ampC);
  c.setResistor(parts.amp, b.amp);
}

} // namespace wah
