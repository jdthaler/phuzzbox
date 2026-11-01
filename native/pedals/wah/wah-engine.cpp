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
  env = 0;
  rocker = P[position];
  a = aTarget;
  supply = P[vcc];
  apply(*circuit, parts, P, a);
  circuit->operatingPoint(u);
}

void Engine::setParams(const double *Pn) {
  const bool parts_ = Pn[sweepC] != P[sweepC] || Pn[qR] != P[qR] || Pn[inductor] != P[inductor];
  for (int i = 0; i < kParamCount; i++) P[i] = Pn[i];
  if (P[control] < 0.5) aTarget = alpha(P); // in Auto the follower sets it, in process()
  gain = phuzzbox::dbToGain(P[level]);
  mix = P[blend];
  // The first parameters set the operating point. After that a new supply is only a new source
  // voltage, u[1] in process(), gliding there as the rocker does: the circuit moves to its new
  // operating point through its own capacitors, as a real one does when its supply is turned.
  // (Starting again from the DC solution at every step of the knob threw the capacitors' charge
  // away: a click each time.)
  if (!started) { started = true; reset(); return; }
  if (parts_) { apply(*circuit, parts, P, a); circuit->update(); }
}

void Engine::process(const float *in, float *L, float *R, int n) {
  const double k = 1 - std::exp(-SUB / (0.010 * fs)); // the rocker's glide, τ = 10 ms
  const double ks = 1 - std::exp(-1 / (0.010 * fs));   // the supply's, sample by sample
  const bool autoMode = P[control] > 0.5, audio = P[taper] < 0.5;
  // the follower's exact steps: charging through Ra with Rd across (τa, τd), or discharging
  const double h = 1 / fs, ta = P[attack], td = P[decay];
  const double ca = std::exp(-h * (1 / ta + 1 / td)), va = td / (ta + td), cd = std::exp(-h / td);
  const int every = (int)std::lround(0.010 * fs);
  double u[2] = {0, supply}, y = 0;
  for (int at = 0; at < n; at += SUB) {
    if (autoMode) {
      // the follower has the rocker; the wiper goes straight where it says (the follower is
      // its own glide)
      rocker = autoRocker(P, env);
      const double target = alpha(rocker, audio);
      aTarget = target;
      if (std::abs(target - a) > 1e-6) { a = target; apply(*circuit, parts, P, a); circuit->update(); }
    } else {
      rocker = P[position];
      if (a != aTarget) {
        a += (aTarget - a) * k;
        if (std::abs(aTarget - a) < 1e-5) a = aTarget;
        apply(*circuit, parts, P, a);
        circuit->update();
      }
    }
    const int m = n - at < SUB ? n - at : SUB;
    for (int i = at; i < at + m; i++) {
      u[0] = in[i];
      if (supply != P[vcc]) { supply += (P[vcc] - supply) * ks; if (std::abs(P[vcc] - supply) < 1e-6) supply = P[vcc]; }
      u[1] = supply;
      circuit->step(u, &y);
      if (autoMode) {
        env = follow(env, in[i], ca, va, cd);
        if (env < 1e-30) env = 0;
        if (messages && ++msgAt >= every) {
          msgAt = 0;
          msg.type = kAuto;
          msg.count = 2;
          msg.values[0] = (float)rocker;
          msg.values[1] = (float)env;
          post(msg);
        }
      }
      const float out = (float)(gain * ((1 - mix) * y + mix * in[i]));
      L[i] = out;
      R[i] = out;
    }
  }
}

} // namespace wah
