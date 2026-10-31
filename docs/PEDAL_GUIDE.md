# Building a Phuzzbox pedal

Every pedal has the same anatomy, so a new one is mostly physics. Copy the Buffer, which is the
template: the smallest pedal with a model, an engine, a page, views, tests and plugins.

## Anatomy

```
<slug>/index.html, style.css            page and enclosure colours (--enclosure, --enclosure-ink)
<slug>/src/<slug>-params.js             GROUPS, PRESETS, KEEP
<slug>/src/<slug>-pedal.js              the descriptor: id, name, groups, presets, wasm
<slug>/src/<slug>-main.js               createPedal({ PEDAL, worklet, views })
<slug>/src/<slug>-worklet.js            registerPedal(PEDAL), for the AudioWorklet
<slug>/wasm/<slug>.wasm                 built from native/, committed
<slug>/README.md                        the page's How it works
native/pedals/<slug>/                   model, engine, PedalInfo, web bindings, CMakeLists.txt
native/pedals/<slug>/<slug>-params.h    generated from the descriptor (tools/gen-native-params.mjs)
test/<slug>-tests.mjs
```

Add the pedal to `shared/registry.js` (`ready: true`, `version`, a unique four-letter
`plugin.code`) and to `native/CMakeLists.txt`.

## The effect contract

`phuzzbox::Effect` (native/core/include/phuzzbox/effect.h), wrapped for JavaScript by
`shared/wasm.js`:

```cpp
virtual void setParams(const double *P);                    // every parameter, by index
virtual void reset();                                       // forget the signal so far
virtual void process(const float *in, float *L, float *R, int n); // mono volts in, stereo volts out
virtual int latency() const;                                // samples (oversampling filters)
virtual double tail() const;                                // seconds of ringing after the input stops
virtual void setQuality(Quality q);                         // high, medium, low
```

Rules of thumb:
- **No allocation in `process`.** Allocate in the constructor or `setParams`.
- **Exact or implicit discretisations.** Linear sections by the matched-z or bilinear transform
  (`phuzzbox/dsp.h`); nonlinear circuits solved implicitly (Newton on the nodal equations, or wave
  digital filters), oversampled where they alias, with minimum-phase filters so the latency stays
  a few samples.
- **Budget:** one pedal under 5 % of a core at 48 kHz, so a board of eight fits.
- **Stereo** only for a physical reason (two mics, a rotating speaker).
- **Oversampling**: `phuzzbox/oversample.h` (Chebyshev IIR up and down, a few samples of
  latency); report its `delay()` from `latency()`. The Phuzz is the example of a circuit solved
  by the nodal DK method (`native/pedals/phuzz/phuzz-model.cpp`).
- **Telling the page what happens inside**: `post()` a `Message` (a type and up to 30 numbers) at
  a few hundred a second at most; the page's views get them with `api.on('pedal', (messages) => …)`.

## Parameters

```js
{ id: 'load', label: 'Input impedance', min: 5e3, max: 10e6, def: 1e6, log: true,
  unit: 'kΩ', scale: 0.001, decimals: 0, perform: true, hint: 'What it does to the sound.' }
```

Values in SI units; `scale` and `decimals` say how they read (the C++ shows the same text).
`type: 'checkbox'` or `type: 'select'` with `options`. `perform: true` puts a knob on the
pedal's face (three to five of them); the rest stay in the Controls panel. `showIf(P)` hides an
irrelevant control on the page.

## Tests

A plain Node script printing `ok`/`FAIL` lines (`test/harness.mjs`). Load the effect with
`loadPedal(slug)` and the test bass with `loadBass()` (`tools/engine.mjs`). Cover: the model
against independent physics; the engine against the model; each hint; identity or unity where
the physics says so; silence, NaN recovery, latency and tail; presets in range; CPU (named
`CPU: …`, skipped on CI).
