// effect-api.cpp — a pedal's effect for JavaScript, as C functions on a handle: the effect contract
// (phuzzbox/effect.h) for the WebAssembly build. shared/wasm.js wraps them in a class with the
// contract's methods, which shared/worklet.js and the Node tests call.

#include <memory>

#include "phuzzbox/denormals.h"
#include "phuzzbox/guard.h"
#include "phuzzbox/pedal.h"
#include "phuzzbox/web.h"

const phuzzbox::PedalInfo &phuzz_pedal();

namespace {
struct Handle {
  std::unique_ptr<phuzzbox::Effect> effect;
  std::unique_ptr<double[]> P;
  float in[128], L[128], R[128];
  phuzzbox::SpscQueue<phuzzbox::Message> messages{256};
  phuzzbox::Message message;
};
alignas(16) unsigned char scratch[1 << 16]; // for the model functions' arguments and results
} // namespace

extern "C" {
PHUZZ_EXPORT int px_param_count() { return phuzz_pedal().paramCount; }
PHUZZ_EXPORT const char *px_param_id(int i) { return phuzz_pedal().params[i].id; }
PHUZZ_EXPORT void *px_scratch() { return scratch; }
PHUZZ_EXPORT int px_scratch_size() { return (int)sizeof scratch; }

PHUZZ_EXPORT Handle *px_create(double fs) {
  const phuzzbox::PedalInfo &I = phuzz_pedal();
  Handle *h = new Handle;
  h->effect.reset(I.create(fs));
  h->effect->messages = &h->messages;
  h->P.reset(new double[I.paramCount]);
  for (int i = 0; i < I.paramCount; i++) h->P[i] = I.params[i].def;
  h->effect->setParams(h->P.get());
  return h;
}
PHUZZ_EXPORT void px_destroy(Handle *h) { delete h; }
PHUZZ_EXPORT phuzzbox::Effect *px_effect(Handle *h) { return h->effect.get(); }
PHUZZ_EXPORT double *px_params(Handle *h) { return h->P.get(); }
PHUZZ_EXPORT void px_set_params(Handle *h) {
  const phuzzbox::PedalInfo &I = phuzz_pedal();
  for (int i = 0; i < I.paramCount; i++) h->P[i] = phuzzbox::constrain(I.params[i], h->P[i]);
  h->effect->setParams(h->P.get());
}
PHUZZ_EXPORT void px_reset(Handle *h) { h->effect->reset(); }
PHUZZ_EXPORT void px_set_quality(Handle *h, int q) { h->effect->setQuality((phuzzbox::Quality)(q < 0 ? 0 : q > 2 ? 2 : q)); }
PHUZZ_EXPORT int px_latency(Handle *h) { return h->effect->latency(); }
PHUZZ_EXPORT double px_tail(Handle *h) { return h->effect->tail(); }
PHUZZ_EXPORT float *px_input(Handle *h) { return h->in; }
PHUZZ_EXPORT float *px_left(Handle *h) { return h->L; }
PHUZZ_EXPORT float *px_right(Handle *h) { return h->R; }
// 1 if the block came out finite; 0 if it didn't, and then the block is silence and the pedal reset
PHUZZ_EXPORT int px_process(Handle *h, int n) {
  phuzzbox::NoDenormals ftz;
  n = n < 128 ? n : 128;
  h->effect->process(h->in, h->L, h->R, n);
  if (phuzzbox::guardBlock(h->L, h->R, n)) return 1;
  h->effect->reset();
  return 0;
}
// the next message the effect posted, or null
PHUZZ_EXPORT phuzzbox::Message *px_message(Handle *h) { return h->messages.pop(h->message) ? &h->message : nullptr; }
}
