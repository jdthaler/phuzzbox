// buffer-model.h — the Buffer's physics: the pickup circuit as you are plugged in (what the
// signal arriving at the pedal has already been through) and as you want to hear it, from the
// parameters (pickup.h).
#pragma once

#include "phuzzbox/pickup.h"

namespace buffer {

struct Circuits {
  phuzzbox::PickupCircuit recorded, wanted;
};

Circuits circuits(const double *P);

// The filter that takes the signal as recorded to the signal as wanted: wanted(s) / recorded(s),
// both v / e of the same pickup, so the EMF cancels:
//   H(s) = D_recorded(s) / D_wanted(s)
// exactly 1 when the two circuits are the same.
phuzzbox::AnalogBiquad transfer(const Circuits &c);

} // namespace buffer
