// octave-model.cpp — the Octave Down's physics (octave-model.h).

#include "octave-model.h"

#include "octave-params.h"

namespace octave {

Model model(const double *P) {
  Model M;
  M.dry = P[dry]; M.oct1 = P[oct1]; M.oct2 = P[oct2];
  M.track = P[track]; M.hyst = P[hyst]; M.tone = P[tone];
  M.level = std::pow(10.0, P[level] / 20);
  return M;
}

} // namespace octave
