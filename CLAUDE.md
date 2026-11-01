# PhuzzBox

Effects pedals for bass and other line inputs, synthesised in the browser and in plugins from
their physics. A sibling of Forte (github.com/jdthaler/forte, on this Mac at ~/claude/piano):
same principles, same shape of code, with an effect contract in place of Forte's notes. Plain
JavaScript pages, no build step; the physics is C++ in `native/`, built as committed WebAssembly
and as CLAP/VST3/AU plugins through clap-wrapper.

The site is <https://phuzzbox.jthaler.net>, served by GitHub Pages from the `live` branch, as
Forte's is. `main` is where work lands; `live` moves only when the owner asks for a release.

Read first:
- `README.md`: what the project is and how to play it.
- `docs/PEDAL_GUIDE.md`: the anatomy of a pedal, the effect contract, parameters, tests.
- `docs/ROADMAP.md`: the plan and the lineup; update it when a pedal lands or a decision is made.

## Commands

- `npm run serve` serves the site at <http://localhost:8766> (AudioWorklets need HTTP).
- `npm test` runs every `test/*-tests.mjs` in parallel; `npm test buffer` runs one.
- `node tools/bundle-app.mjs` rebuilds the app's window (`native/app/window.html`) from
  `native/app/app.js` and the site's modules it imports; `test/native-tests.mjs` fails when stale.
- `node tools/gen-native-params.mjs` rewrites each pedal's C++ parameter tables from its
  descriptor (after changing parameters or presets); `test/native-tests.mjs` fails when stale.
- `node tools/gen-schematics.mjs` rewrites each pedal's circuit diagrams (`<slug>/schematics/*.svg`) from
  its `src/<slug>-schematics.js` (drawn with `shared/schematic.js`); `test/schematics-tests.mjs` fails when stale.
  A README or tour shows one as a figure: an image alone in its paragraph, `![caption](schematics/x.svg)`.
- `cd native && cmake --preset wasm && cmake --build --preset wasm` rebuilds the WebAssembly
  (Emscripten 6.0.10, `native/emscripten-version`). Commit the `.wasm` files it writes.
- `cd native && cmake --preset linux && cmake --build --preset linux && ctest --preset linux`
  builds the plugins and the native tests (ALSA and JACK headers needed on Linux).
- `CI=1 npm test` skips the CPU-timing tests, as CI does.
- `node tools/release.mjs --dry-run` shows what the next release would bump and the changelog
  entry it would write; `node tools/contract.mjs` what a change breaks in songs saved with the plugins.

## Principles (Forte's)

- **Physics, not samples.** Every sound is the integration of a model of a mechanism: circuits
  with real component values, mechanical systems with real dimensions. No impulse responses or
  captured profiles; tables computed from physics are fine.
- **Knobs are physical.** Values in SI units with a unit shown; hints say what each does to the
  sound, and must be true (a test checks each).
- **Tested against something independent**, written in the test: a closed form, circuit theory
  from complex impedances, a conservation law, a textbook limit. Then the engine against the model.
- **Honest README** per pedal, which is also its page's How it works: equations, numbers,
  sources, what is simplified, and `## Prior art and references` with verified citations only.
- **Volts in, volts out.** A pedal's input is the line's voltage (a passive bass peaks around
  0.1–1 V); the page converts with the Full scale setting. Nonlinear pedals depend on it.

## Making a change

1. Work on a branch off `main`, never directly on `main` or `live`.
2. Verify: `npm test` passes; for a page change, open it in a browser (Playwright headless will
   do) at phone (390×664), tablet and desktop (1440×900) sizes, with no console errors and no
   sideways scrolling.
3. **A release note, not a version.** A pull request into `main` bumps no version (semver, all
   0.x, as Forte's). It adds one note to `changes/` (`changes/README.md`): a `# <topic>` line, then
   a `### PhuzzBox (minor|patch)` or `### <Pedal name> (major|minor|patch|new)` section for each
   part it changes, with the lines for the changelog. PhuzzBox covers `shared/`, the landing page,
   the Pedalboard, the test bass, `tools/` and the app; a pedal covers its folder, its tests and its
   port. Docs alone and CI need no note. The `tests` workflow checks both rules
   (`node tools/release.mjs --check-pr origin/main HEAD` runs it locally).
4. Commit with a title that says what changed, and no version; the body says why and how it was checked.
5. Pull request into `main` with *Why*, *What changed* and *Testing*.

Listening with a real bass and interface is the owner's job; say in the pull request what needs it.

## Releasing `main` to `live`

Only when the owner asks for a release. Merging into `main` publishes nothing; the owner hears
`main` with `npm run serve` before each release.

1. On a branch off the latest `main`, run `node tools/release.mjs`. It gathers the notes in
   `changes/` into one `## YYYY-MM-DD — <topics>` entry at the top of `CHANGELOG.md`, bumps each
   version named once by the largest kind its notes give (PhuzzBox in `package.json` and
   `PHUZZBOX_VERSION` together), regenerates the plugins' `<slug>-info.cmake`, and deletes the
   notes. Commit it with every version in the title (`Release PhuzzBox 0.2.0, Spring Reverb
   0.2.0`), open a pull request into `main` whose body is the new changelog entry, and merge it
   once green (the release-note check lets a release, and only a release, move versions).
2. Open a pull request from `main` into `live` titled `Release YYYY-MM-DD: <what is new>`, whose
   body is the changelog entry. CI runs on it as on any pull request, and also checks that no
   notes are left in `changes/`. Whatever fails is fixed on `main` first.
3. Merge it with a merge commit when the owner asks. GitHub Pages publishes `live` at once, and
   installed copies pick it up on their next load (`sw.js` asks the server first).
4. `live` only ever takes `main`, so it never needs merging back.
