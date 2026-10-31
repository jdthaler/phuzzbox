// guard.h — a NaN or an infinity must not silence the pedal for good (it
// would lodge in every filter after it). Zero the block; the caller resets the pedal.
#pragma once

#include <cmath>
#include <cstring>

namespace phuzzbox {

// True if the block is finite; otherwise zeroes it and returns false.
inline bool guardBlock(float *L, float *R, int n) {
  for (int i = 0; i < n; i++) if (!std::isfinite(L[i] + R[i])) {
    std::memset(L, 0, n * sizeof *L);
    std::memset(R, 0, n * sizeof *R);
    return false;
  }
  return true;
}

} // namespace phuzzbox
