// dk.h — a circuit of resistors, capacitors, inductors, voltage sources and transistors, solved
// sample by sample by the nodal DK method (Yeh, Abel and Smith 2010; Holters and Zölzer 2011,
// with variable parts): modified nodal analysis, the capacitors and inductors replaced by their
// trapezoidal companions (exactly the bilinear transform), and the linear part solved once, so
// that each sample's Newton iteration runs only on the nonlinear junctions' voltages.
//
//   Netlist net;                      nodes 1 … nodes (0 is ground)
//   net.resistor(1, 2, 68e3);  net.capacitor(2, 3, 10e-9);  net.inductor(6, 7, 0.5);
//   net.source(1);                    node 1 held at u[0], the next source at u[1], …
//   net.npn(3, 4, 5, Is, βF, βR);     base, collector, emitter: Ebers–Moll, two junctions
//   net.output(8);                    read node 8
//   Circuit c(net, fs);  c.operatingPoint(u);  c.step(u, out);  c.setResistor(k, ohms); c.update();
//
// The linear part's matrices (K × states and so on) are recomputed by update(), after a resistor
// or a reactive part changes (a pot turning): one inversion of the nodal matrix, no allocation, so
// it may run in the audio thread a few thousand times a second.
//
// For a linear check, response(f) gives the small-signal transfer from source 0 to each output at
// the operating point, by complex nodal analysis (the transistors' junctions linearised).
#pragma once

#include <algorithm>
#include <complex>
#include <vector>

namespace phuzzbox::dk {

struct Netlist {
  struct Two { int a, b; double value; };
  struct Bjt { int b, c, e; double Is, betaF, betaR, Vt; bool pnp; };
  struct Diode { int a, k; double Is, n, Vt; };
  int nodes = 0;
  std::vector<Two> resistors, capacitors, inductors;
  std::vector<int> sources, outputs;
  std::vector<Bjt> bjts;
  std::vector<Diode> diodes;

  int resistor(int a, int b, double ohms) { grow(a, b); resistors.push_back({a, b, ohms}); return (int)resistors.size() - 1; }
  int capacitor(int a, int b, double farads) { grow(a, b); capacitors.push_back({a, b, farads}); return (int)capacitors.size() - 1; }
  int inductor(int a, int b, double henries) { grow(a, b); inductors.push_back({a, b, henries}); return (int)inductors.size() - 1; }
  void source(int node) { grow(node, 0); sources.push_back(node); }
  void output(int node) { grow(node, 0); outputs.push_back(node); }
  void npn(int b, int c, int e, double Is, double betaF, double betaR, double Vt = 0.02585) { grow(b, c); grow(e, 0); bjts.push_back({b, c, e, Is, betaF, betaR, Vt, false}); }
  void pnp(int b, int c, int e, double Is, double betaF, double betaR, double Vt = 0.02585) { grow(b, c); grow(e, 0); bjts.push_back({b, c, e, Is, betaF, betaR, Vt, true}); }
  void diode(int a, int k, double Is, double n = 1, double Vt = 0.02585) { grow(a, k); diodes.push_back({a, k, Is, n, Vt}); }

 private:
  void grow(int a, int b) { nodes = std::max(nodes, std::max(a, b)); }
};

// a dense row-major matrix that never reallocates after construction
struct Mat {
  int r = 0, c = 0;
  std::vector<double> a;
  Mat() = default;
  Mat(int r, int c) : r(r), c(c), a((size_t)r * c, 0.0) {}
  double &operator()(int i, int j) { return a[(size_t)i * c + j]; }
  double operator()(int i, int j) const { return a[(size_t)i * c + j]; }
  void zero() { std::fill(a.begin(), a.end(), 0.0); }
};

class Circuit {
 public:
  Circuit(const Netlist &net, double fs);

  // change a part's value; update() then makes the matrices again
  void setResistor(int k, double ohms) { net.resistors[k].value = ohms; dirty = true; }
  void setCapacitor(int k, double farads) { net.capacitors[k].value = farads; dirty = true; }
  void setInductor(int k, double henries) { net.inductors[k].value = henries; dirty = true; }
  void update();

  // the DC operating point for constant sources u (capacitors open, inductors shorted), found by
  // Newton with the sources stepped up from zero; the states are set to it, so the circuit starts
  // there without a thump. False if it did not converge.
  bool operatingPoint(const double *u);
  // one sample: the sources u, the outputs out. False if the Newton iteration did not converge
  // (the sample is still the last iterate's).
  bool step(const double *u, double *out);

  // node voltages at the last operating point (index 0 is ground)
  const std::vector<double> &dcNodes() const { return dcV; }
  // small-signal transfer from source 0 to each output at the operating point, at f Hz
  void response(double f, std::complex<double> *out) const;
  int iterations = 0; // Newton iterations in the last step (for tests)

  Netlist net;

 private:
  void stamp(int a, int b, double g);
  void build(bool dc);
  void junctions(const double *v, double *i, double *J) const; // port currents and ∂i/∂v (block diagonal)
  double limit(int q, double vnew, double vold) const;
  bool newton(const double *p, const Mat &F, double *v, int maxIter, double tol);
  void nodeVoltages(const double *u, const double *i, std::vector<double> &V, bool withStates) const;

  double fs, T;
  int nU, nK, nX, nN, nO;
  std::vector<int> col;            // node → its unknown's index, or −1 − its source's index
  std::vector<int> xa, xb, na, nb, oa; // the reactive parts', the junctions' and the outputs' nodes
  std::vector<double> gX;          // the reactive parts' companion conductances
  std::vector<int> sign;           // +1 capacitor, −1 inductor
  Mat Y, Yk, S, work;              // nodal matrix, its known-node part, its inverse, space to invert
  Mat SxT, SnT, SY;                // S N_xU', S N_nU', S Y_K
  Mat A, B, C, D, E, F, Do, Eo, Fo; // the DK matrices at the sample rate
  Mat Edc, Fdc;                    // and the junctions' at DC
  std::vector<double> z, vx, vn, in, p, r, Jd, Jm, dv, dcV, iDC;
  std::vector<int> blockLo, blockHi; // each junction's device: its first junction and one past its last
  std::vector<double> nvtQ, vcritQ; // each junction's n·Vt, and where its limiting starts
  bool dirty = true;
};

} // namespace phuzzbox::dk
