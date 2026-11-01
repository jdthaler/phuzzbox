# PhuzzBox

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
| ✅ | [Phuzz](phuzz/) | two-transistor germanium fuzz (1966) | Ebers–Moll transistors that drift with temperature, a sagging battery, an input that loads the pickup; solved by the nodal DK method at 4× oversampling |
| ✅ | [Wah](wah/) | the inductor wah of the late 1960s, swept low for bass | two Ebers–Moll transistors and a 500 mH coil, solved node by node; a MIDI expression pedal rocks it |
| ✅ | [Tube Preamp](preamp/) | the 1959 Fender Bassman's preamp | three 12AX7 triodes (Dempwolf–Zölzer, with grid conduction), the passive tone stack and its supply rail, solved node by node at up to 4× oversampling |
| ✅ | [Opto Compressor](opto/) | the electro-optical leveling amplifiers of the 1960s | a glowing panel and a photocell whose free and trapped electrons set the attack (10 ms) and the program-dependent release |
| ✅ | [Speaker Cabinet](cabinet/) | 8 × 10, 4 × 10, 2 × 10 and 1 × 15 bass cabinets | drivers from their Thiele–Small parameters, in a sealed or ported box, with the cones running out of travel on loud low notes |
| ✅ | [Envelope Filter](envelope/) | the envelope-controlled filters of the 1970s | a state-variable filter whose resistors are photocells, lit by an LED that an envelope follower drives; the cells' electrons set how it sweeps and remembers |
| ✅ | [Octave Down](octave/) | the analog octave dividers of the 1980s | a tracking filter, a comparator with hysteresis and two flip-flops that flip the bass's polarity every cycle or every other: one and two octaves down, with the real thing's warble and dropouts |
| ✅ | [Spring Reverb](spring/) | the reverb tanks of guitar and organ amplifiers | steel springs from measured tanks as waves on a coil of wire, 2300 modes from their dispersion: every echo a chirp up to the transition frequency |
| ✅ | [Tape Echo](echo/) | the multi-head tape echoes of the 1970s | a tape loop past a record head and three playback heads: the tape's anhysteretic magnetisation, the heads' spacing, coating and gap losses, the motor's pitch bend and the capstan's flutter |
| ✅ | [Rotary Speaker](rotary/) | the rotating-horn organ speakers of the 1960s | a horn and a drum turning past two microphones: each sound heard at its retarded time (the Doppler shift, exactly), a piston's directivity as its impulse response, motors with inertia |
| ✅ | [Plate Reverb](plate/) | the steel plate reverbs of 1960s studios | a steel plate 2 m by 1 m as Kirchhoff's thin plate: 6432 bending modes to 5 kHz, the highs arriving first, the steel's thermoelastic and radiation losses and a damper |
| ✅ | [Sympathetic Strings](sympathetic/) | the sitar's sympathetic strings | stiff steel strings tuned to a key on one bridge your bass drives: Fletcher's stretched partials, Chaigne and Askenfelt's losses, ringing along with the notes whose harmonics they share |
| ✅ | [Black Hole](blackhole/) | the ringdown LIGO hears after a merger | a spinning black hole your bass strikes: its four loudest quasinormal modes from Leaver's continued fractions (Forte's table), heard through their spin-weighted harmonics as h₊ and h×, from a thud without spin to a bell near the limit |
| ✅ | [Doppler](doppler/) | a car, a train, a jet going by | a source playing your bass on a straight road past you: each ear's retarded time solved exactly (a quadratic), the moving source's field integrated over each sample; above Mach 1 the cone, the boom and the approach heard backwards |
| ✅ | [Pedalboard](board/) | every pedal here, in a chain | the pedals in series in one worklet; the ones whose circuits include their jacks feel the pickup or a buffered output, and drive the next input through a patch cable; true bypass rewires them |

✅ playable · 🛠 in the workshop. The plan and the rest of the lineup are in
[docs/ROADMAP.md](docs/ROADMAP.md).

The **test bass** ([testbass/](testbass/README.md)) is a bass guitar made of physics (stiff
strings, a finger pluck, a magnetic pickup) that every page plays from the computer keys when
nothing is plugged in, and that the tests and demos use as their signal.

## Playing

The pedals play at **<https://phuzzbox.jthaler.net>**, served by GitHub Pages from the `live`
branch, which takes `main` at each release; it installs as a web app from the browser's menu. Open a pedal's page and press **Start audio**.

The landing page draws every pedal as itself, on boards grouped by the physics it is made of:
circuits, light and photocells, vibrating steel, paper and air, motion and delay, and gravity, then
the Pedalboard. On every page, the menu at the top left (PhuzzBox and the pedal's name) goes back
to the landing page or to any pedal, grouped the same way. The audio carries over: a pedal opened
from the menu starts its sound from the input, channel and output the last one used (in Chrome
and Edge at once; elsewhere at the first tap or key).

A pedal's page fits one screen, as Forte's do: the pedal on its board at the left, with the tuner
under it; the **Views** bar with a toggle for each view (the pedal, the tuner, the plots) and the **Controls** bar with a
toggle for each group of controls (the pedal's, the **Rig** and the **MIDI pedals**), with the
presets beside them. Drag the handle on the Controls bar to share the height between them, or fold
either away with its chevron. **Discover** shows every view with its explanations behind ⓘ;
**Perform** clears the text off the views and folds the controls behind More controls. The test
bass sits at the bottom while it is the input. On a phone the page scrolls instead. What you turn
on is remembered for each pedal.

**Your own presets** live in the same Presets menu, as on Forte. *Save these settings…* keeps the
pedal's settings under a name in your browser, and *Copy a link to these settings* makes a link
that opens the page playing them, to send to someone or to bookmark for a song. *Your presets and
files…* lists yours, and saves them to a file or opens one (`shared/presets.js` gives the format).

Then either:

- **Plug in.** Connect your bass to an audio interface's instrument (Hi-Z) input, choose the
  interface in the source menu, and allow the browser to use it. Pick **In 1** or **In 2** for the
  input your bass is on. Echo cancellation, noise suppression and automatic gain are turned off.
  Use wired headphones or speakers: Bluetooth adds 100–200 ms. The latency pill shows the
  browser's estimate of the round trip; Chrome on a Mac with a class-compliant interface does best.
- **Play the test bass.** The rows of letter keys are its strings, as tablature has them: the
  `Z` row is the low E, then the `A` row, the `Q` row and the number row, each from the open
  string to the ninth fret. **Play a riff** loops a short line. The fretboard shows only while the test bass is the input, and the letter keys play it only then.

`Space` is the footswitch. **Full scale** (in Controls, under Rig) says how many volts at the input jack make
a full-scale signal in the browser. It doesn't matter to the Buffer, but it does to the Phuzz and
every pedal that distorts: a fuzz clips at a voltage, not at a fraction of full scale. Choose your interface beside it and type its gain, and the page works it out from
the maker's specification ([shared/interfaces.js](shared/interfaces.js)). The maximum input level
in dBu at minimum gain is the sine that just reaches full scale, so full scale's peak is
√0.6 V × 10^(dBu/20) × √2, less one decibel for each decibel of gain. A Scarlett 2i2 (4th gen)
at 20 dB of gain is 0.436 V. Choosing the interface also sets the Buffer's *Your interface's
input* to its impedance. With an interface that isn't listed, type Full scale in: set it so your
bass and the test bass read alike on the In meter.

**Install as an app.** In Chrome or Edge, **Install app** (on the landing page, or in the
browser's address bar) puts PhuzzBox in a window of its own, with its own Dock icon. A service
worker ([sw.js](sw.js)) keeps a copy of every file it has loaded, so the app opens even with
`npm run serve` stopped. Open each page once with the server running so that its files are kept.

The **tuner** under the pedal reads whatever is coming in, your bass or the test bass, in cents
from the nearest note, against a reference A4 you can set (440 Hz unless you change it). It reads
the string's first partial, not the period of the whole waveform. A real string is stiff, so its
upper partials run sharp of whole multiples, f_n = n f₁ √(1 + Bn²). The period is a compromise
among them, which on a low E can read 5 to 20 cents sharp. The tuner finds the period first, to
name the note, then the peak of the fundamental's own spectral line, to a hundredth of a cent
([tuner/README.md](tuner/README.md), tested in `test/tuner-tests.mjs`). **Mute**, on the tuner,
silences the output, as a tuner pedal does.

Every pedal also has a **Scope** and a **Spectrum**, each showing what goes in (dashed) against
what comes out (solid), in volts. The scope draws the two waves over 50 ms, held still by a
trigger on the input's rising edges with hysteresis, as a bench oscilloscope's
([scope/README.md](scope/README.md)). The spectrum draws them against frequency, calibrated so a
partial reads its peak amplitude in dBV (0 dBV is a sine of 1 V peak), with the note being played
marked in green ([spectrum/README.md](spectrum/README.md)); both are tested in
`test/views-tests.mjs`.

**How it works and Tour.** By each page's title, **How it works** opens the pedal's notes (its
README: the equations, the numbers, what is simplified and the sources), with tabs for the test
bass's, the tuner's, the scope's and the spectrum's. **Tour** is a guided tour of the pedal's physics, as Forte's instruments
have: a few steps, each setting the pedal up and playing the test bass through it while a card
says what to listen for and which view to watch. Your own settings come back when it ends.

**MIDI pedals.** A MIDI foot controller (a Roland FC-300 through a USB
MIDI interface, in Control Change mode) works the page in Chrome or Edge: press **Connect MIDI** in
the MIDI pedals card. Out of the box its expression pedal 1 (CC 7) is a volume pedal, expression
pedal 2 (CC 1) the pedal's expression control (the Wah's rocker), number pedal 1 (CC 65) the
footswitch and number pedal 2 (CC 66) the tuner's mute; **Learn** teaches any pedal any control.
The plugins take the same CCs on their MIDI input ([shared/midi.js](shared/midi.js),
`native/core/include/phuzzbox/midi.h`).

Your settings stay in your browser.

## The app

**PhuzzBox.app** (`native/app/`) plays the pedals with no browser and no DAW, one at a time: the
menu in its title picks the Buffer, the Phuzz or the Wah, and each keeps its own settings (your
bass and how it is plugged in go with you from one to the other). It shows the page's face, tuner
and Controls in a window of its own, built from the same modules; the pages' views stay on the
site. Its audio runs in C++ through CoreAudio (WASAPI on Windows, ALSA on Linux) at the buffer you
choose, 64 samples unless you change it. At 48 kHz the buffers then make a round trip of about 3
ms, where Chrome's is 15–25 ms. Pick your interface for In and Out, the input your bass is on, and
the buffer: the smallest that plays without clicks. **Measure latency** times the real round trip
with a cable from the interface's output back to its input. Settings are kept in
`~/Library/Application Support/PhuzzBox/settings.json` (`%APPDATA%\PhuzzBox` on Windows,
`~/.config/phuzzbox` on Linux).

A MIDI foot controller works in the app as on the pages: the app listens to every MIDI input
(RtMidi), and its MIDI card maps the control changes with the FC-300's factory numbers to start
(expression 1 the **Volume**, expression 2 the Wah's rocker, number pedals 1 and 2 the
footswitch and the tuner's mute), each pedal keeping its own mappings.

CI builds it on every pull request (the `native` workflow's `PhuzzBox-app-macos-15` artifact).
The app isn't notarised, so after unzipping it, clear the quarantine flag macOS puts on downloads
(`xattr -dr com.apple.quarantine PhuzzBox.app`), then open it. macOS asks once for the
microphone: that permission covers the interface's inputs too.

## Running it locally

```bash
npm run serve        # http://localhost:8766 (AudioWorklets need HTTP)
npm test             # every test/*-tests.mjs
node tools/bundle-app.mjs   # the app's window, native/app/window.html, after changing a module it uses
node tools/render-phuzz.mjs # the Phuzz's demos to examples/phuzz/ (and render-buffer.mjs, the Buffer's)
```

The physics is C++ in `native/`, built as WebAssembly (committed, so the site needs no build
step) and as plugins (CLAP, VST3, AU and a standalone app, through clap-wrapper):

```bash
cd native && cmake --preset linux && cmake --build --preset linux && ctest --preset linux   # or macos, windows
cd native && cmake --preset wasm && cmake --build --preset wasm                             # needs Emscripten 6.0.10
```

See [CLAUDE.md](CLAUDE.md) and [docs/PEDAL_GUIDE.md](docs/PEDAL_GUIDE.md) for how a pedal is built.

## Versions

PhuzzBox and each pedal carry their own [semantic version](https://semver.org), as Forte and its
instruments do: on the front page and in each pedal's How it works, kept in `shared/registry.js`
(and `package.json` for PhuzzBox) and logged in [CHANGELOG.md](CHANGELOG.md). The plugins carry
their pedal's version, the app PhuzzBox's. Everything is pre-release (0.x) for now:

* **MINOR** (0.**x**.0) for new features, or for changes to a pedal's sound or parameters.
* **PATCH** (0.x.**y**) for fixes that leave the intended sound alone.

From 1.0 on, a pedal's MAJOR version will change only when songs saved with its plugins, or the
sound of its presets, break. Versions move only at a release: each change leaves a note in
[changes/](changes/README.md), and `node tools/release.mjs` gathers them.

## Licence

MIT. The page code, the build and the plugin follow Forte's (also MIT, same author).
