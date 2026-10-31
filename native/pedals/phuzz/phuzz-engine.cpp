// phuzz-engine.cpp — the Phuzz as an effect (phuzz-engine.h).

#include "phuzz-engine.h"

#include <cmath>

#include "phuzz-params.h"

namespace phuzz {

Engine::Engine(double rate) : Effect(rate) {
  for (int i = 0; i < kParamCount; i++) P[i] = kParams[i].def;
  setQuality(phuzzbox::Quality::high);
}

void Engine::setQuality(phuzzbox::Quality q) {
  Effect::setQuality(q);
  os.setup(fs, pick(4, 2, 1));
  latencySamples = (int)std::lround(os.delay(fs));
  pointEvery = 36;
  if (haveParams) rebuild();
}

void Engine::setParams(const double *p) {
  for (int i = 0; i < kParamCount; i++) P[i] = p[i];
  const bool first = !haveParams;
  haveParams = true;
  rebuild();
  if (first) settle();
}

void Engine::rebuild() {
  parts = phuzz::parts(P.data());
  const double T = 1 / (fs * os.factor());
  dk.build(parts, T);
  recGl = dk.Gl;
  recRho = dk.rho;
  recGc = 2 * (parts.Cself + parts.Crec) / T;
}

void Engine::reset() {
  os.reset();
  settle();
}

void Engine::settle() {
  const OperatingPoint op = operatingPoint(parts);
  const int caps[5][2] = {{A, B}, {W, -1}, {X, O}, {A, -1}, {V, -1}};
  for (int k = 0; k < 5; k++) {
    vc[k] = op.node[caps[k][0]] - (caps[k][1] >= 0 ? op.node[caps[k][1]] : 0);
    ic[k] = 0;
  }
  vL = op.node[A];
  iL = vL / parts.coilR;
  for (int k = 0; k < 4; k++) { v[k] = vPrev[k] = op.v[k]; cur[k] = op.i[k]; }
  recIL = recV = recIC = 0;
  pointAt = points = 0;
}

double Engine::step(double vin) {
  // the bass's Norton current: what the recorded voltage drives into the recording's circuit
  const double carried = recRho * recIL + recGl * recV, iCoil = recGl * vin + carried;
  const double J = recGc * recV + recIC, iCap = recGc * vin - J;
  const double I = iCoil + iCap + (parts.Gpots + parts.Grec) * vin;
  recIL = iCoil; recV = vin; recIC = iCap;

  double z[DK::NZ];
  for (int k = 0; k < 5; k++) z[k] = dk.Gc[k] * vc[k] + ic[k];
  z[5] = dk.rho * iL + dk.Gl * vL;
  z[6] = I;
  z[7] = parts.Vbat;
  double p[4];
  for (int r = 0; r < 4; r++) {
    double s = 0;
    for (int c = 0; c < DK::NZ; c++) s += dk.Pz[r * DK::NZ + c] * z[c];
    p[r] = s;
  }
  // Newton from the junctions carried on in a straight line from the last two samples, which
  // usually lands within a few microvolts; where the line overshoots a kink (a transistor
  // saturating) and Newton is slow to come back, again from where they were
  double was[4];
  for (int k = 0; k < 4; k++) { was[k] = v[k]; v[k] = 2 * v[k] - vPrev[k]; vPrev[k] = was[k]; }
  int it = solveJunctions(dk, parts.q1, parts.q2, p, v, cur, 6);
  if (it > 6) {
    for (int k = 0; k < 4; k++) v[k] = was[k];
    const int again = solveJunctions(dk, parts.q1, parts.q2, p, v, cur, 200);
    it += again;
    if (again > 200) { // never seen: keep the last sample's junctions rather than a wild guess
      failures++;
      for (int k = 0; k < 4; k++) v[k] = was[k];
      double d[2];
      parts.q1.currents(v[0], v[1], cur[0], cur[1], d, d);
      parts.q2.currents(v[2], v[3], cur[2], cur[3], d, d);
    }
  }
  iterations += it; steps++; itersSincePost += it; stepsSincePost++;
  double y[DK::NY];
  for (int r = 0; r < DK::NY; r++) {
    double s = 0;
    for (int c = 0; c < DK::NZ; c++) s += dk.Yz[r * DK::NZ + c] * z[c];
    for (int c = 0; c < 4; c++) s += dk.Yi[r * 4 + c] * cur[c];
    y[r] = s;
  }
  for (int k = 0; k < 5; k++) { ic[k] = dk.Gc[k] * y[k] - z[k]; vc[k] = y[k]; }
  iL = dk.Gl * y[5] + z[5];
  vL = y[5];
  for (int c = 0; c < DK::NZ; c++) lastZ[c] = z[c];
  return y[6];
}

void Engine::process(const float *in, float *L, float *R, int n) {
  const int M = os.factor();
  for (int i = 0; i < n; i++) {
    double y = 0;
    for (int m = 0; m < M; m++) y = os.downsample(step(os.upsample(in[i], m)));
    L[i] = (float)y;
    R[i] = (float)y;
    if (messages && ++pointAt == pointEvery) { // a point for the page's view of the transistors
      pointAt = 0;
      float *pt = msg.values + 4 * points;
      pt[0] = (float)(v[1] - v[0]); pt[1] = (float)cur[0]; // V_CE = vcb − veb; I_C out of the collector
      pt[2] = (float)(v[3] - v[2]); pt[3] = (float)cur[2];
      if (++points == 7) {
        double rail = 0;
        for (int c = 0; c < DK::NZ; c++) rail += dk.Hz[S * DK::NZ + c] * lastZ[c];
        for (int c = 0; c < 4; c++) rail += dk.Hi[S * 4 + c] * cur[c];
        msg.type = kOperatingPoints;
        msg.count = 30;
        msg.values[28] = (float)rail;
        msg.values[29] = stepsSincePost ? (float)itersSincePost / stepsSincePost : 0;
        post(msg);
        points = 0;
        itersSincePost = stepsSincePost = 0;
      }
    }
  }
}

} // namespace phuzz
