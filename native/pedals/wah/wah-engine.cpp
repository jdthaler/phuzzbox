// wah-engine.cpp — the Wah as an effect (wah-engine.h).

#include "wah-engine.h"

#include <cmath>

#include "phuzzbox/dsp.h"

namespace wah {

Engine::Engine(double fs) : Effect(fs) {
  for (int i = 0; i < kParamCount; i++) P[i] = kParams[i].def;
  circuit = std::make_unique<phuzzbox::dk::Circuit>(netlist(P, parts), fs);
  a = aTarget = alpha(P);
  reset();
}

void Engine::reset() {
  const double u[2] = {0, P[vcc]};
  a = aTarget;
  apply(*circuit, parts, P, a);
  circuit->operatingPoint(u);
}

void Engine::setParams(const double *Pn) {
  const bool supply = Pn[vcc] != P[vcc];
  const bool parts_ = Pn[sweepC] != P[sweepC] || Pn[qR] != P[qR] || Pn[inductor] != P[inductor];
  for (int i = 0; i < kParamCount; i++) P[i] = Pn[i];
  aTarget = alpha(P);
  gain = phuzzbox::dbToGain(P[level]);
  mix = P[blend];
  if (!started || supply) { started = true; reset(); return; } // a new supply: a new operating point
  if (parts_) { apply(*circuit, parts, P, a); circuit->update(); }
}

void Engine::process(const float *in, float *L, float *R, int n) {
  const double k = 1 - std::exp(-SUB / (0.010 * fs)); // the rocker's glide, τ = 10 ms
  double u[2] = {0, P[vcc]}, y = 0;
  for (int at = 0; at < n; at += SUB) {
    if (a != aTarget) {
      a += (aTarget - a) * k;
      if (std::abs(aTarget - a) < 1e-5) a = aTarget;
      apply(*circuit, parts, P, a);
      circuit->update();
    }
    const int m = n - at < SUB ? n - at : SUB;
    for (int i = at; i < at + m; i++) {
      u[0] = in[i];
      circuit->step(u, &y);
      const float out = (float)(gain * ((1 - mix) * y + mix * in[i]));
      L[i] = out;
      R[i] = out;
    }
  }
}

} // namespace wah
