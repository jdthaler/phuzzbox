// doppler-model.h — a source passing a listener on a straight road, and the retarded time at which
// what is heard now was sent.
//
// The source moves at v through still air along a line d from the listener's, who moves along it
// at u; sound travels at c. One pass lasts T: the source is level with the listener halfway, at
// s = 0 (s the time from then). An ear offset e along the road (− the left, + the right) hears at
// time s what the source sent D earlier, where the sound's path equals c D:
//
//   c² D² = (X − v D)² + d²,  X = (v − u) s − e,
//
// the source's position relative to the ear now being X, and v D how far it has moved since. A
// quadratic in D, (c² − v²) D² + 2 X v D − (X² + d²) = 0, solved exactly:
//
//   below Mach 1, one root,          D₀ = (X² + d²) / (X v + S),  S = √(c² X² + (c² − v²) d²);
//   above, none until the Mach cone reaches the ear (c² X² ≥ (v² − c²) d², X > 0), then two:
//                                    D₀ as above and D₁ = (X v + S) / (v² − c²).
//
// D₀ is written so that it never cancels. What reaches the ear is the moving source's field, the
// wave equation's solution for a point source (Liénard–Wiechert's form): q(τ) / (4π R |1 − M_r|),
// summed over every retarded time τ = s − D, with R = c D the path and 1 − M_r = dt/dτ the
// compression; R (1 − M_r) = ±S / c.
#pragma once

namespace doppler {

constexpr double PI = 3.14159265358979323846;
constexpr double EAR = 0.0875; // half the spacing of the ears (m): one each side of the head

// the speed of sound in dry air at T °C (m/s): 331.3 √(1 + T / 273.15)
double soundSpeed(double celsius);

struct Pass {
  double v = 0, u = 0, d = 1, c = 343, T = 1; // m/s, m/s, m, m/s, s
};

// the delays D (s) of what an ear at offset e hears at time s from the pass's middle: how many
// (0, 1 or 2), shortest first
int delays(const Pass &p, double s, double e, double D[2]);

// above Mach 1: when the Mach cone reaches the ear (s), and the delay there, where the two roots
// meet; false below Mach 1
bool cone(const Pass &p, double e, double &s, double &D);

// how long sound from a pass can take to arrive, at most (s): from anywhere on its stretch of road
double longest(const Pass &p);

// the source's strength along its pass: a raised cosine in over the first min(T / 6, 1 s), out
// over the last, 1 between; τ from the pass's start
double envelope(const Pass &p, double tau);

} // namespace doppler
