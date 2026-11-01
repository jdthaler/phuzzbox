// preamp-engine.cpp — the Tube Preamp as an effect (preamp-engine.h).

#include "preamp-engine.h"

#include <algorithm>
#include <cmath>

namespace preamp {

Engine::Engine(double rate) : Effect(rate) {
  for (int i = 0; i < kParamCount; i++) P[i] = kParams[i].def;
  setQuality(phuzzbox::Quality::high);
}

void Engine::setQuality(phuzzbox::Quality q) {
  Effect::setQuality(q);
  os.setup(fs, pick(4, 2, 1));
  latencySamples = (int)std::lround(os.delay(fs));
  if (haveParams) { rebuild(); settle(); }
}

void Engine::rebuild() {
  circuit = std::make_unique<phuzzbox::dk::Circuit>(netlist(P, parts), fs * os.factor());
  circuit->extrapolate = os.factor() > 1;
  circuit->tolerance = 1e-3; // the plates swing by a hundred volts: what is left is about a microvolt
}

void Engine::setParams(const double *Pn) {
  // the supply and the tubes set the operating point: a change there starts again from it, as
  // switching the amp off and on would, rather than thumping its way over
  const bool dc = !haveParams || Pn[bplus] != P[bplus] || Pn[supplyR] != P[supplyR] || Pn[tube] != P[tube] || Pn[emission] != P[emission];
  for (int i = 0; i < kParamCount; i++) P[i] = Pn[i];
  rec = recording(P);
  if (!haveParams) { haveParams = true; rebuild(); settle(); return; }
  if (apply(*circuit, parts, P)) circuit->update();
  if (dc) settle();
}

void Engine::reset() {
  os.reset();
  if (haveParams) settle(); // before the first parameters there is no circuit yet
}

void Engine::settle() {
  u[0] = P[bplus];
  u[1] = 0;
  apply(*circuit, parts, P);
  circuit->operatingPoint(u);
  recIL = recV = recIC = 0;
  pointAt = points = 0;
  gridPeak = 0;
}

double Engine::step(double vin) {
  // the bass's Norton current: what the recorded voltage drives into the recording's circuit, its
  // coil (R then L) and capacitance by the trapezoidal rule at the circuit's own rate
  const double T = 1 / (fs * os.factor()), k = T / (2 * rec.coilL);
  const double iL = (recIL * (1 - k * rec.coilR) + k * (vin + recV)) / (1 + k * rec.coilR);
  const double iC = 2 * rec.C / T * (vin - recV) - recIC;
  u[1] = iL + iC + rec.G * vin;
  recIL = iL; recV = vin; recIC = iC;
  if (!circuit->step(u, y)) failures++;
  iterations += circuit->iterations; steps++;
  itersSincePost += circuit->iterations; stepsSincePost++;
  return y[0];
}

void Engine::process(const float *in, float *L, float *R, int n) {
  const int M = os.factor();
  for (int i = 0; i < n; i++) {
    double out = 0;
    for (int m = 0; m < M; m++) {
      out = os.downsample(step(os.upsample(in[i], m)));
      const std::vector<double> &ig = circuit->portCurrents();
      gridPeak = std::max({gridPeak, ig[0], ig[2], ig[4]});
    }
    L[i] = (float)out;
    R[i] = (float)out;
    if (messages && ++pointAt == pointEvery) { // a point for the page's view of the triodes
      pointAt = 0;
      const std::vector<double> &v = circuit->portVoltages(), &c = circuit->portCurrents();
      float *pt = msg.values + 6 * points;
      for (int t = 0; t < 3; t++) { pt[2 * t] = (float)v[2 * t + 1]; pt[2 * t + 1] = (float)c[2 * t + 1]; }
      if (++points == 4) {
        msg.type = kTubePoints;
        msg.count = 27;
        msg.values[24] = (float)y[3];
        msg.values[25] = stepsSincePost ? (float)itersSincePost / stepsSincePost : 0;
        msg.values[26] = (float)gridPeak;
        post(msg);
        points = 0;
        itersSincePost = stepsSincePost = 0;
        gridPeak = 0;
      }
    }
  }
}

} // namespace preamp
