// plate-model.cpp — the Plate Reverb's losses (plate-model.h).

#include "plate-model.h"

namespace plate {

double thermoelastic(double f) {
  const double w = 2 * PI * f;
  return w * w * R1 * C1 / (2 * (w * w * H * H + C1 * C1 / (H * H)));
}

double radiation(double f) {
  const double fc = coincidence(), psi = std::sqrt(std::min(f / fc, 0.999));
  const double g = ((1 - psi * psi) * std::log((1 + psi) / (1 - psi)) + 2 * psi) / std::pow(1 - psi * psi, 1.5);
  return (1 / (4 * PI * PI)) * (RHO_A * C_A / (RHO * H)) * (2 * (LX + LY) / (LX * LY)) * (C_A / fc) * g;
}

} // namespace plate
