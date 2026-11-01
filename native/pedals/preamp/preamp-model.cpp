// preamp-model.cpp — the Tube Preamp's circuit (preamp-model.h).

#include "preamp-model.h"

#include <algorithm>
#include <cmath>

#include "preamp-params.h"

namespace preamp {

const phuzzbox::dk::Netlist::Tube kTubes[3] = {
  {2.242e-3, 103.2, 1.26, 3.40, 6.177e-4, 1.314, 9.901, 8.025e-8},  // RSD-1
  {2.173e-3, 100.2, 1.28, 3.19, 5.911e-4, 1.358, 11.76, 4.527e-8},  // RSD-2
  {1.371e-3, 86.9, 1.349, 4.56, 3.263e-4, 1.156, 11.99, 3.917e-8},  // EHX-1
};

double taper(double a) { return (std::pow(81.0, a) - 1) / 80; }

phuzzbox::dk::Netlist::Tube tubeOf(const double *P) {
  phuzzbox::dk::Netlist::Tube t = kTubes[std::clamp((int)std::lround(P[preamp::tube]), 0, 2)];
  t.G *= P[emission];
  return t;
}

namespace {
double pot(double r) { return std::max(1.0, r); } // a pot's ends are never quite zero ohms
struct Values {
  double gainTop, gainBot, masterTop, masterBot, tTop, tBot, bass, midTop, midBot, coilR, coilL, pots, jackC, outC, load;
};
Values values(const double *P) {
  Values v;
  const double g = taper(P[gain]), m = taper(P[master]), l = taper(P[preamp::bass]);
  v.gainTop = pot((1 - g) * GAIN_POT); v.gainBot = pot(g * GAIN_POT);
  v.masterTop = pot((1 - m) * MASTER_POT); v.masterBot = pot(m * MASTER_POT);
  v.tTop = pot((1 - P[treble]) * TS_R1); v.tBot = pot(P[treble] * TS_R1);
  v.bass = pot(l * TS_R2);
  v.midTop = pot((1 - P[middle]) * TS_R3); v.midBot = pot(P[middle] * TS_R3);
  const bool passive = P[active] < 0.5;
  v.coilR = passive ? P[pickupR] : P[activeR];
  v.coilL = passive ? P[pickupL] : L_ACTIVE;
  v.pots = passive ? P[pots] : 1e12; // an active bass's pots are behind its preamp
  v.jackC = (passive ? P[pickupC] : 0) + P[cable] * P[cablePF];
  v.outC = P[outCable] * P[cablePF];
  v.load = P[preamp::load];
  return v;
}
} // namespace

Recording recording(const double *P) {
  const Values v = values(P);
  const bool passive = P[active] < 0.5;
  return {v.coilR, v.coilL, (passive ? P[pickupC] : 0) + P[recCable] * P[cablePF], (passive ? 1 / P[pots] : 0) + 1 / P[recLoad]};
}

phuzzbox::dk::Netlist netlist(const double *P, Parts &p) {
  phuzzbox::dk::Netlist n;
  const Values v = values(P);
  n.source(E);  // u[0]: the 385 V rail
  n.current(A); // u[1]: the bass's Norton current
  // the bass at the jack
  p.coilR = n.resistor(A, M, v.coilR);
  p.coilL = n.inductor(M, 0, v.coilL);
  p.jackC = n.capacitor(A, 0, v.jackC);
  p.pots = n.resistor(A, 0, v.pots);
  // V1a
  n.resistor(A, 0, RGRID);
  n.resistor(A, G1, RSTOP1);
  n.resistor(P1, D, RP1);
  n.resistor(K1, 0, RK1);
  p.cathodeC = n.capacitor(K1, 0, P[cathodeC]);
  // the Gain pot, and V2a
  n.capacitor(P1, Q, CC);
  p.gainTop = n.resistor(Q, W1, v.gainTop);
  p.gainBot = n.resistor(W1, 0, v.gainBot);
  n.resistor(W1, G2, RSTOP2);
  n.resistor(P2, D, RP2);
  n.resistor(K2, 0, RK2);
  // V2b, the cathode follower
  n.resistor(K3, 0, RK3);
  // the tone stack
  n.capacitor(K3, T, TS_C1);
  p.tTop = n.resistor(T, O, v.tTop);
  p.tBot = n.resistor(O, X, v.tBot);
  n.resistor(K3, S, TS_R4);
  n.capacitor(S, X, TS_C2);
  n.capacitor(S, Y, TS_C3);
  p.bass = n.resistor(X, Z, v.bass);
  p.midTop = n.resistor(Z, Y, v.midTop);
  p.midBot = n.resistor(Y, 0, v.midBot);
  // the Master pot, the cable and what it drives
  p.masterTop = n.resistor(O, V, v.masterTop);
  p.masterBot = n.resistor(V, 0, v.masterBot);
  p.outC = n.capacitor(V, 0, v.outC);
  p.load = n.resistor(V, 0, v.load);
  // the supply
  p.supplyR = n.resistor(E, D, P[supplyR]);
  p.filterC = n.capacitor(D, 0, P[filterC]);
  // the triodes and their capacitances
  const phuzzbox::dk::Netlist::Tube t = tubeOf(P);
  const int g[3] = {G1, G2, P2}, a[3] = {P1, P2, D}, k[3] = {K1, K2, K3};
  for (int i = 0; i < 3; i++) {
    n.capacitor(g[i], k[i], CGK);
    n.capacitor(g[i], a[i], CAG);
    n.capacitor(a[i], k[i], CAK);
    p.tubes[i] = n.triode(g[i], a[i], k[i], t);
  }
  n.output(V);
  n.output(A);
  n.output(K3);
  n.output(D);
  return n;
}

bool apply(phuzzbox::dk::Circuit &c, const Parts &p, const double *P) {
  const Values v = values(P);
  const phuzzbox::dk::Netlist &n = c.net;
  bool moved = false;
  auto r = [&](int k, double ohms) { if (n.resistors[k].value != ohms) { c.setResistor(k, ohms); moved = true; } };
  auto C = [&](int k, double farads) { if (n.capacitors[k].value != farads) { c.setCapacitor(k, farads); moved = true; } };
  r(p.gainTop, v.gainTop); r(p.gainBot, v.gainBot); r(p.masterTop, v.masterTop); r(p.masterBot, v.masterBot);
  r(p.tTop, v.tTop); r(p.tBot, v.tBot); r(p.bass, v.bass); r(p.midTop, v.midTop); r(p.midBot, v.midBot);
  r(p.supplyR, P[supplyR]); r(p.coilR, v.coilR); r(p.pots, v.pots); r(p.load, v.load);
  C(p.filterC, P[filterC]); C(p.cathodeC, P[cathodeC]); C(p.jackC, v.jackC); C(p.outC, v.outC);
  if (n.inductors[p.coilL].value != v.coilL) { c.setInductor(p.coilL, v.coilL); moved = true; }
  const phuzzbox::dk::Netlist::Tube t = tubeOf(P);
  for (int i = 0; i < 3; i++) c.setTube(p.tubes[i], t);
  return moved;
}

} // namespace preamp
