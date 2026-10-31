// buffer-model.cpp — the Buffer's physics (buffer-model.h).

#include "buffer-model.h"

#include "buffer-params.h"

namespace buffer {

Circuits circuits(const double *P) {
  phuzzbox::PickupCircuit base;
  base.active = P[active] > 0.5;
  base.L = P[pickupL];
  base.R = base.active ? P[activeR] : P[pickupR];
  base.Cself = P[pickupC];
  base.Rpots = P[pots];
  base.cablePerM = P[cablePF];
  Circuits c{base, base};
  c.recorded.cable = P[recCable];
  c.recorded.Rload = P[recLoad];
  c.wanted.cable = P[cable];
  c.wanted.Rload = P[load];
  return c;
}

phuzzbox::AnalogBiquad transfer(const Circuits &c) {
  const phuzzbox::AnalogBiquad r = c.recorded.section(), w = c.wanted.section();
  return {r.a2, r.a1, r.a0, w.a2, w.a1, w.a0};
}

} // namespace buffer
