# Building a PhuzzBox pedal

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
<slug>/src/<slug>-tour.js               its guided tour of the physics (shared/tour.js)
<slug>/README.md                        the page's How it works
<slug>/src/<slug>-schematics.js         its circuit diagrams (shared/schematic.js), written to
<slug>/schematics/*.svg                 by tools/gen-schematics.mjs, shown as figures
native/pedals/<slug>/                   model, engine, PedalInfo, web bindings, CMakeLists.txt
native/pedals/<slug>/<slug>-params.h    generated from the descriptor (tools/gen-native-params.mjs)
test/<slug>-tests.mjs
```

A descriptor may name its `expression` parameter (the Wah's `position`): a MIDI expression pedal
(CC 1) moves it by default on the page and in the plugins. Every page also has the MIDI pedals card
(`shared/midi-panel.js`), and every plugin a MIDI input with Bypass and Volume pedal parameters
(`native/plugin/plugin.cpp`).

A nonlinear circuit can be written as a netlist for `phuzzbox::dk::Circuit` (`phuzzbox/dk.h`):
resistors, capacitors, inductors, sources, diodes and transistors, solved by the nodal DK method
with Newton on the junctions only; `response(f)` gives its small-signal response for the views and
tests. The Wah (`native/pedals/wah/wah-model.cpp`) is the example.

The page lays itself out (`shared/layout.js`, after Forte's): the pedal at the left, a Views bar
with a toggle for each view, a Controls bar with a toggle for each group, the test bass below. A
view's `title` names its toggle and its `caption` waits behind ⓘ; `perform: true` shows it at first
(by default the first two are). A view draws to fill its card, whatever shape it is given, and
redraws on resize. Every page has a Scope and a Spectrum (`shared/views.js`): the shell adds them
to a page that doesn't bring its own, and a pedal with something to say about them passes
`scopeView({ caption })` or `spectrumView({ caption })` among its views. A view of its own that
plots against frequency marks the note being played with `markNote(g, x, box, api.note)`
(`shared/plot.js`). Every page is dark, with the hardware drawn as hardware (`shared/pedal.css`).

Add the pedal to `shared/registry.js` (`ready: true`, `version: '0.1.0'`, a unique four-letter
`plugin.code`) and to `native/CMakeLists.txt`, and add a note to `changes/` with a
`### <Name> (new)` section, which becomes its first `CHANGELOG.md` entry when it is released.

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

## How it works and the guided tour

**How it works**, by the page's title, is the pedal's README in a dialog (`shared/notes.js`),
with tabs for what every page has: the test bass (`testbass/README.md`), the tuner
(`tuner/README.md`), the scope (`scope/README.md`) and the spectrum (`spectrum/README.md`). It
leaves out the README's `## Files` and lists its other `##` sections as contents. `…/#about`,
`#testbass`, `#tuner`, `#scope` and `#spectrum` open it.

The site never sends a reader to GitHub for information (Jesse, 2026-11-01); the only link there is
the credits' `source` (`SOURCE` in `shared/registry.js`). Everything a reader needs goes in the
README, which is on the site. Link other notes as relative READMEs (`../tuner/README.md`, with
`#section` if you like): the dialog opens their tab, or that pedal's page. A link to any other file
of the repository shows as plain text, and papers and standards keep their own links.

**Tour**, before it, is the pedal's guided tour of its physics, as Forte's instruments have: a
card under the pedal's face steps through three to eight steps, each setting the pedal up,
showing only the views it is about, playing the test bass through it and saying what to listen
for and look at. `…/#tour` opens it at its first step. Write it in `<slug>/src/<slug>-tour.js`
and load it after the main module (`<script type="module" src="src/<slug>-tour.js"></script>`):

```js
import { tour, note, run, riff, sweep } from '../../shared/tour.js';
export const TOUR = tour('phuzz', [
  { title: 'Germanium leaks when warm', views: ['The transistors', 'Scope'], preset: 'Full fuzz',
    set: { temp: 5 }, play: [riff({ times: 3 }), sweep('temp', 5, 45, { at: 0.5, dur: 14 })],
    text: 'What to listen for and look at, and why (Markdown; an indented paragraph is an equation).' },
]);
```

A step names its views by their titles (and `Tuner`, `Scope`, `Spectrum`), a preset by name, parameters by id; it
starts engaged unless `bypass: true`, and keeps the player's own bass (the descriptor's `keep`).
`play` holds notes (`note('E1', { at, dur, vel })`, `run`, `riff()` for the page's riff),
`{ at, set: { … } }` and `sweep(id, from, to, { at, dur, log })` to turn a knob partway, and
`{ at, bypass }` for the footswitch. When it ends, the settings, the footswitch, the tuner's mute
and the player's source come back. The tour reaches the page only through `api.page`
(`shared/shell.js`), so a new layout keeps those members and the tours follow it.

**Circuit diagrams.** Draw them in `<slug>/src/<slug>-schematics.js`, exporting
`SCHEMATICS = { name: () => s.svg() }` built with `schematic()` from `shared/schematic.js` (wires,
resistors, capacitors, inductors, pots, photocells, diodes, triodes, transistors, amplifiers and
blocks on a 20 px grid, each diagram on its own dark panel). `node tools/gen-schematics.mjs`
writes them to `<slug>/schematics/<name>.svg`. A README or a tour's text shows one as a figure,
an image alone in its paragraph: `![What it shows](schematics/name.svg)`, its alt text the
caption. Figures load from the site (the renderer's `assets` URL), never from GitHub.
`test/schematics-tests.mjs` fails when a diagram is stale or a figure is missing.

`test/tour-tests.mjs` checks every ready pedal's tour against its page and descriptor, and that
every quantity in its text (a number and its unit) is one of the READMEs' or a setting the step
makes: the tour says nothing the README, and so the tests, don't back.

## Plugged in backwards

A pedal may have a **Reversed** checkbox (id `reversed`): the bass into its output jack and its input
jack to the amp. Give it one only where the model can honestly be driven from its output: the
bass as its pickup (a Norton source, as the Phuzz, the Tube Preamp and the Wah backwards have it)
at the output node, the amp's cable and input at the input node, and every path the signal could
take back present in the model. Where the real leak back is through parts the model leaves out
(a transistor's junction capacitances, say), it has none, and its README says why under
`## Plugged in backwards`. A backwards circuit can be unstable (the Wah squeals): test where it
oscillates against an independent analysis, not only its response. The Wah is the example
(`native/pedals/wah/wah-model.cpp`, its `wah_squeal` for the page).

## Tests

A plain Node script printing `ok`/`FAIL` lines (`test/harness.mjs`). Load the effect with
`loadPedal(slug)` and the test bass with `loadBass()` (`tools/engine.mjs`). Cover: the model
against independent physics; the engine against the model; each hint; identity or unity where
the physics says so; silence, NaN recovery, latency and tail; presets in range; CPU (named
`CPU: …`, skipped on CI).

## Versions

Each pedal has its own semantic version, kept in `shared/registry.js`; PhuzzBox has one
(`PHUZZBOX_VERSION` and `package.json`) for `shared/`, the landing page, the Pedalboard, the test
bass, `tools/` and the app. The plugins carry the pedal's (`<slug>-info.cmake`), the app
PhuzzBox's. Versions change only when `main` is released to `live` (`CLAUDE.md`). A change adds a
note to `changes/` instead (`changes/README.md`): MINOR for new features or changes to the sound
or the parameters, PATCH for fixes that leave the intended sound alone, MAJOR (from 1.0) when
songs saved with the plugins break. `tools/release.mjs` turns the notes into `CHANGELOG.md`
entries and bumps the versions.

What a saved song relies on, each parameter's id, kind, range, step, scaling and default, the
choices' options and the presets in order, is listed in `native/pedals/<slug>/<slug>-contract.json`,
generated with the parameter tables. `node tools/contract.mjs` says what a change breaks; adding
parameters, options at the end and presets at the end breaks nothing.
