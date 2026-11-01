// opto-engine.cpp — the Opto Compressor as an effect (opto-engine.h).

#include "opto-engine.h"

#include <algorithm>
#include <cmath>

#include "phuzzbox/dsp.h"

namespace opto {

Engine::Engine(double fs) : Effect(fs) {
  for (int i = 0; i < kParamCount; i++) P[i] = kParams[i].def;
  every = (int)std::lround(0.010 * fs);
  setParams(P);
}

void Engine::reset() { n = m = light = 0; }

void Engine::setParams(const double *Pn) {
  for (int i = 0; i < kParamCount; i++) P[i] = Pn[i];
  M = model(P);
  makeup = phuzzbox::dbToGain(P[gain]);
  mix = P[blend];
  glow = 1 - std::exp(-1 / (fs * M.tp));
  rest = atten(M, 0);
}

void Engine::process(const float *in, float *L, float *R, int count) {
  const double dt = 1 / fs;
  for (int i = 0; i < count; i++) {
    const double x = in[i], a = atten(M, n), va = a * x;
    // the driver hears the attenuated signal (feedback) or the input (feed-forward); the
    // panel's phosphor follows its emission; the cell's electrons follow the light
    light += (emission(M, drive(M, M.feedForward ? x : va)) - light) * glow;
    cellStep(M, light, n, m, dt);
    const double y = makeup * ((1 - mix) * va + mix * x);
    L[i] = R[i] = (float)y;
    if (messages) {
      inPeak = std::max(inPeak, std::abs(x));
      outPeak = std::max(outPeak, std::abs(y));
      const double gr = 20 * std::log10(a / rest);
      deepest = std::min(deepest, gr);
      if (++at == every) {
        at = 0;
        phuzzbox::Message msg;
        msg.type = kCell;
        msg.count = 8;
        msg.values[0] = (float)gr;
        msg.values[1] = (float)n;
        msg.values[2] = (float)(m / TRAPS);
        msg.values[3] = (float)light;
        msg.values[4] = (float)(1 / (1 / M.darkR + n / M.litR));
        msg.values[5] = (float)inPeak;
        msg.values[6] = (float)outPeak;
        msg.values[7] = (float)deepest;
        post(msg);
        inPeak = outPeak = deepest = 0;
      }
    }
  }
}

} // namespace opto
