// buffer-engine.cpp — the Buffer as an effect (buffer-engine.h).

#include "buffer-engine.h"

#include "buffer-model.h"
#include "buffer-params.h"

namespace buffer {

void Engine::setParams(const double *P) {
  const Circuits c = circuits(P);
  phuzzbox::Biquad q = phuzzbox::matchedZ(transfer(c), fs);
  q.z1 = filter.z1; // keep the state: a turn of a knob doesn't restart the filter
  q.z2 = filter.z2;
  filter = q;
  gain = phuzzbox::dbToGain(P[level]);
}

void Engine::process(const float *in, float *L, float *R, int n) {
  for (int i = 0; i < n; i++) {
    const float y = (float)(gain * filter.run(in[i]));
    L[i] = y;
    R[i] = y;
  }
}

} // namespace buffer
