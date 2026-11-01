// wah-engine.cpp — the Wah as an effect (wah-engine.h).

#include "wah-engine.h"

#include <cmath>

#include "phuzzbox/dsp.h"

namespace wah {

Engine::Engine(double fs) : Effect(fs) {
  for (int i = 0; i < kParamCount; i++) P[i] = kParams[i].def;
  forward = std::make_unique<phuzzbox::dk::Circuit>(netlist(P, parts, false), fs);
  back = std::make_unique<phuzzbox::dk::Circuit>(netlist(P, backParts, true), fs);
  reversed_ = backwards(P);
  circuit = reversed_ ? back.get() : forward.get();
  a = aTarget = alpha(P);
  rec = recording(P);
  reset();
}

void Engine::applyParts() {
  apply(*circuit, reversed_ ? backParts : parts, P, a);
}

// the circuit at its operating point (both ways round it is the same: every jack is AC-coupled)
void Engine::settle() {
  const double uf[2] = {0, supply}, ub[2] = {supply, 0};
  applyParts();
  circuit->operatingPoint(reversed_ ? ub : uf);
  recIL = recV = recIC = 0;
}

void Engine::reset() {
  env = 0;
  rocker = P[position];
  a = aTarget;
  supply = P[vcc];
  settle();
}

void Engine::setParams(const double *Pn) {
  const bool parts_ = Pn[sweepC] != P[sweepC] || Pn[qR] != P[qR] || Pn[inductor] != P[inductor];
  bool bass_ = false; // the bass's parts, the cables or the amp (backwards only)
  for (int i : {cable, outCable, load, active, pickupL, pickupR, pickupC, pots, activeR, cablePF}) bass_ = bass_ || Pn[i] != P[i];
  for (int i = 0; i < kParamCount; i++) P[i] = Pn[i];
  if (P[control] < 0.5) aTarget = alpha(P); // in Auto the follower sets it, in process()
  gain = phuzzbox::dbToGain(P[level]);
  rec = recording(P);
  const bool flip = backwards(P) != reversed_;
  reversed_ = backwards(P);
  circuit = reversed_ ? back.get() : forward.get();
  // blend: a pot between the dry signal and the wah, not part of the circuit model; plugged in
  // backwards there is no dry signal at the input jack to blend, so it is off
  mix = reversed_ ? 0 : P[blend];
  // The first parameters set the operating point. After that a new supply is only a new source
  // voltage, u[1] in process(), gliding there as the rocker does: the circuit moves to its new
  // operating point through its own capacitors, as a real one does when its supply is turned.
  // (Starting again from the DC solution at every step of the knob threw the capacitors' charge
  // away: a click each time.) Turning the cables round starts the other circuit at its operating
  // point, where the jacks' coupling capacitors leave every node.
  if (!started) { started = true; reset(); return; }
  if (flip) { a = aTarget; settle(); return; }
  if (parts_ || (reversed_ && bass_)) { applyParts(); circuit->update(); }
}

void Engine::process(const float *in, float *L, float *R, int n) {
  const double k = 1 - std::exp(-SUB / (0.010 * fs)); // the rocker's glide, τ = 10 ms
  const double ks = 1 - std::exp(-1 / (0.010 * fs));   // the supply's, sample by sample
  const bool autoMode = P[control] > 0.5, audio = P[taper] < 0.5;
  // the follower's exact steps: charging through Ra with Rd across (τa, τd), or discharging
  const double h = 1 / fs, ta = P[attack], td = P[decay];
  const double ca = std::exp(-h * (1 / ta + 1 / td)), va = td / (ta + td), cd = std::exp(-h / td);
  const int every = (int)std::lround(0.010 * fs);
  // backwards: the recording's copy of the bass, by the trapezoidal rule
  const double kL = h / (2 * rec.coilL), gC = 2 * rec.C / h;
  double u[2] = {0, supply}, y[2] = {0, 0};
  for (int at = 0; at < n; at += SUB) {
    if (autoMode) {
      // the follower has the rocker; the wiper goes straight where it says (the follower is
      // its own glide)
      rocker = autoRocker(P, env);
      const double target = alpha(rocker, audio);
      aTarget = target;
      if (std::abs(target - a) > 1e-6) { a = target; applyParts(); circuit->update(); }
    } else {
      rocker = P[position];
      if (a != aTarget) {
        a += (aTarget - a) * k;
        if (std::abs(aTarget - a) < 1e-5) a = aTarget;
        applyParts();
        circuit->update();
      }
    }
    const int m = n - at < SUB ? n - at : SUB;
    for (int i = at; i < at + m; i++) {
      if (supply != P[vcc]) { supply += (P[vcc] - supply) * ks; if (std::abs(P[vcc] - supply) < 1e-6) supply = P[vcc]; }
      if (!reversed_) {
        u[0] = in[i];
        u[1] = supply;
      } else {
        // the bass's Norton current: what the recorded voltage drives into the recording's
        // circuit, its coil (R then L) and capacitance by the trapezoidal rule
        const double vin = in[i];
        const double iL = (recIL * (1 - kL * rec.coilR) + kL * (vin + recV)) / (1 + kL * rec.coilR);
        const double iC = gC * (vin - recV) - recIC;
        u[0] = supply;
        u[1] = iL + iC + rec.G * vin;
        recIL = iL; recV = vin; recIC = iC;
      }
      circuit->step(u, y);
      if (autoMode) {
        // the follower hears the input jack: the bass, or plugged in backwards, what the jack
        // sends to the amp
        env = follow(env, reversed_ ? y[0] : in[i], ca, va, cd);
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
      const float out = (float)(gain * ((1 - mix) * y[0] + mix * in[i]));
      L[i] = out;
      R[i] = out;
    }
  }
}

} // namespace wah
