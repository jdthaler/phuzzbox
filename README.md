# Phuzzbox

**Effects pedals built from physics**, for bass guitar and other line inputs. A sibling of
[Forte](https://github.com/jdthaler/forte), Forte's keyboards turned inside out: instead of keys
exciting a model, your instrument's signal drives one. Every pedal integrates the equations of a
real mechanism (a pickup and its cable, germanium transistors, a triode and its transformer, a
loudspeaker in a box, a spring, a tape) with the signal as the input. No impulse responses, no
captured profiles, no hand-drawn waveshapers. Vibe coded by Jesse Thaler.

## Pedals

| | Pedal | after | the physics |
|---|---|---|---|
| ✅ | [Buffer](buffer/) | the cable and input your bass plugs into | the pickup's coil, the cable's capacitance and the input's resistance as a circuit: hear the pickup resonance move as the cable gets longer and the input hungrier |
| 🛠 | Phuzz | two-transistor germanium fuzz (1966) | Ebers–Moll transistors that drift with temperature, a sagging battery, an input that loads the pickup |
| 🛠 | Tube Preamp | all-tube bass amp | triodes with grid conduction, a passive tone stack, an output transformer that saturates at the bottom first |
| 🛠 | Opto Compressor | electro-optical leveler | an electroluminescent panel and a photocell with memory |
| 🛠 | Cabinet | 8×10 and 1×15 cabinets | a loudspeaker from its Thiele–Small parameters in a sealed or ported box |

✅ playable · 🛠 in the workshop. The plan and the rest of the lineup are in
[docs/ROADMAP.md](docs/ROADMAP.md).

The **test bass** ([testbass/](testbass/README.md)) is a bass guitar made of physics (stiff
strings, a finger pluck, a magnetic pickup) that every page plays from the computer keys when
nothing is plugged in, and that the tests and demos use as their signal.

## Playing

The pedals play at **<https://phuzzbox.jthaler.net>**, served by GitHub Pages from `main`; it
installs as a web app from the browser's menu. Open a pedal's page and press **Start audio**. Then either:

- **Plug in.** Connect your bass to an audio interface's instrument (Hi-Z) input, choose the
  interface in the source menu, and allow the browser to use it. Pick **In 1** or **In 2** for the
  input your bass is on. Echo cancellation, noise suppression and automatic gain are turned off.
  Use wired headphones or speakers: Bluetooth adds 100–200 ms. The latency pill shows the
  browser's estimate of the round trip; Chrome on a Mac with a class-compliant interface does best.
- **Play the test bass.** The rows of letter keys are its strings, as tablature has them: the
  `Z` row is the low E, then the `A` row, the `Q` row and the number row, each from the open
  string to the ninth fret. **Play a riff** loops a short line.

`Space` is the footswitch. **Full scale** (in Controls) says how many volts at the input jack make
a full-scale signal in the browser. It doesn't matter to the Buffer, but it will to every pedal
that distorts. Choose your interface beside it and type its gain, and the page works it out from
the maker's specification ([shared/interfaces.js](shared/interfaces.js)). The maximum input level
in dBu at minimum gain is the sine that just reaches full scale, so full scale's peak is
√0.6 V × 10^(dBu/20) × √2, less one decibel for each decibel of gain. A Scarlett 2i2 (4th gen)
at 20 dB of gain is 0.436 V. Choosing the interface also sets the Buffer's *Your interface's
input* to its impedance. With an interface that isn't listed, type Full scale in: set it so your
bass and the test bass read alike on the In meter.

**Install as an app.** In Chrome or Edge, **Install app** (on the landing page, or in the
browser's address bar) puts Phuzzbox in a window of its own, with its own Dock icon. A service
worker ([sw.js](sw.js)) keeps a copy of every file it has loaded, so the app opens even with
`npm run serve` stopped. Open each page once with the server running so that its files are kept.

The **tuner** above the plots reads whatever is coming in, your bass or the test bass, in cents
from the nearest note, against a reference A4 you can set (440 Hz unless you change it). It reads
the string's first partial, not the period of the whole waveform. A real string is stiff, so its
upper partials run sharp of whole multiples, f_n = n f₁ √(1 + Bn²). The period is a compromise
among them, which on a low E can read 5 to 20 cents sharp. The tuner finds the period first, to
name the note, then the peak of the fundamental's own spectral line, to a hundredth of a cent
([shared/tuner.js](shared/tuner.js), tested in `test/tuner-tests.mjs`). **Mute while tuning**
silences the output, as a tuner pedal does.

Your settings stay in your browser.

## The app

**Phuzzbox.app** (`native/app/`) plays a pedal with no browser and no DAW. It shows the page's face,
tuner and Controls in a window of its own, built from the same modules. Its audio runs in C++
through CoreAudio (WASAPI on Windows, ALSA on Linux) at the buffer you choose, 64 samples unless
you change it. At 48 kHz the buffers then make a round trip of about 3 ms, where Chrome's is
15–25 ms. Pick your interface for In and Out, the input your bass is on, and the buffer: the
smallest that plays without clicks. **Measure latency** times the real round trip with a cable from
the interface's output back to its input. Settings are kept in `~/Library/Application
Support/Phuzzbox/settings.json` (`%APPDATA%\Phuzzbox` on Windows, `~/.config/phuzzbox` on
Linux).

CI builds it on every pull request (the `native` workflow's `Phuzzbox-app-macos-15` artifact).
The app isn't notarised, so after unzipping it, clear the quarantine flag macOS puts on downloads
(`xattr -dr com.apple.quarantine Phuzzbox.app`), then open it. macOS asks once for the
microphone: that permission covers the interface's inputs too.

## Running it locally

```bash
npm run serve        # http://localhost:8766 (AudioWorklets need HTTP)
npm test             # every test/*-tests.mjs
node tools/bundle-app.mjs   # the app's window, native/app/buffer.html, after changing a module it uses
```

The physics is C++ in `native/`, built as WebAssembly (committed, so the site needs no build
step) and as plugins (CLAP, VST3, AU and a standalone app, through clap-wrapper):

```bash
cd native && cmake --preset linux && cmake --build --preset linux && ctest --preset linux   # or macos, windows
cd native && cmake --preset wasm && cmake --build --preset wasm                             # needs Emscripten 6.0.10
```

See [CLAUDE.md](CLAUDE.md) and [docs/PEDAL_GUIDE.md](docs/PEDAL_GUIDE.md) for how a pedal is built.

## Licence

MIT. The page code, the build and the plugin follow Forte's (also MIT, same author).
