// wah-model.cpp — the Wah's circuit (wah-model.h).

#include "wah-model.h"

#include "wah-params.h"

namespace wah {

double alpha(const double *P) { return alpha(P[position], P[taper] < 0.5); }

phuzzbox::dk::Netlist netlist(const double *P, Parts &parts) {
  phuzzbox::dk::Netlist n;
  const double a = alpha(P);
  n.source(IN);  // u[0]: the input, in volts
  n.source(VCC); // u[1]: the supply
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
  n.output(OUT);
  return n;
}

void apply(phuzzbox::dk::Circuit &c, const Parts &parts, const double *P, double a) {
  c.setResistor(parts.potUpper, a * POT);
  c.setResistor(parts.potLower, (1 - a) * POT);
  c.setResistor(parts.qR, P[qR]);
  c.setCapacitor(parts.sweepC, P[sweepC]);
  c.setInductor(parts.inductor, P[inductor]);
}

} // namespace wah
