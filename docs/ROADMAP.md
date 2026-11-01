# Roadmap

The plan, agreed 2026-10-31: browser and plugins first, as Forte; a hardware pedal later from the
same C++. The full write-up is the [Phuzzbox plan](https://claude.ai/artifact/A2XjTZYn5To2U4uh3agFu8).

## Phases

1. **Scaffold** — done: `native/` (effect contract, parameter tables generated from the
   descriptors, the CLAP effect plugin, the WebAssembly API), the page shell (audio input or the
   test bass, the pedal's face, meters, tuner, latency, Controls, How it works), the **test
   bass**, and the **Buffer** as the template pedal. Since then: the latency work (smallest
   browser buffer, output picker, loopback measurement), a tuner that reads a string's first
   partial, Full scale from the interface's specification, and Phuzzbox as an installable web app.
2. **Phuzz** — done: a two-transistor germanium fuzz (Ebers–Moll, temperature, battery sag,
   the input impedance that loads the pickup through the Buffer's circuit), solved by the nodal
   DK method (Newton on the four junctions) at 4× oversampling between minimum-phase Chebyshev
   filters; views of the transistors' characteristics with their operating points moving, a
   scope and the spectra; plugins. Tested against an independent nodal analysis in JavaScript
   (test/phuzz-circuit.mjs). The app plays it; next, listening on the owner's bass.
3. **The rig**: tube preamp, opto compressor, cabinet; the **pedalboard** page, chaining pedals
   with real input and output impedances.
   The **Tube Preamp** landed 2026-11-01: the 5F6-A Bassman's preamp (with the AB763's bypassed
   first stage) as one circuit of 20 nodes, three Dempwolf–Zölzer triodes with grid current, the
   Yeh–Smith tone stack, the supply rail through its dropper, by the DK method (`phuzzbox/dk.h`
   gained triodes and current sources); tested against an independent JavaScript model
   (`test/preamp-circuit.mjs`). The output transformer, which the first plan put here, waits for
   a power-amp pedal, where it belongs.
   For the rig, done ahead of it (2026-10-31): **MIDI pedals**, Web MIDI on every page and a MIDI input on the plugins,
   with learn and the Roland FC-300's factory CCs as defaults (CC 7 volume, CC 1 the pedal's
   expression control, CC 65 the footswitch, CC 66 the tuner's mute); the **Wah** (an inductor
   wah from its circuit, by the nodal DK method in `phuzzbox/dk.h`, swept low for bass) for the
   expression pedal to rock. The app (`native/app/`) is to forward its MIDI to the page with
   `window.phuzzMidi(status, d1, d2)`.
   For every pedal, done 2026-11-01: **How it works** as Forte's (the README in a dialog, with
   contents and tabs for the test bass's and the new tuner's notes) and a **physics tour** of
   each pedal (`shared/tour.js`), checked by `test/tour-tests.mjs`; a new pedal brings its tour.
4. **Time and space**: spring reverb (Forte's springs), plate reverb, tape echo, rotary speaker.
5. **The rest**: envelope filter, octave down, sympathetic strings, black hole, Doppler; a
   hardware pedal (Electrosmith Daisy Seed) if wanted.

## The standalone app

Decided 2026-10-31: the owner plays a passive four-string through a Scarlett 2i2 and finds
MainStage too much, so Phuzzbox gets a simple app of its own. First the installable web app (done),
then **Phuzzbox.app** (`native/app/`, done): the same face in a window, with audio in C++ through
RtAudio at small buffers, a few milliseconds' round trip against Chrome's 15–25. Its own program
rather than clap-wrapper's standalone, which fixes the buffer at 256 samples on macOS. The app
plays every ready pedal, one at a time, from a menu in its title (2026-11-01: the Phuzz on the
site measured 70 ms in Chrome on the owner's Mac). Next: the same face as the plugins' panel in
MainStage and Logic (Forte's editor.cpp).

## The page

Decided 2026-11-01 (Jesse): the pages look and work like Forte's. One screen, with toggles to show
and hide each view and group of controls, Discover and Perform, and a handle sharing the height
(`shared/layout.js`); a dark theme with skeuomorphic hardware (powder-coated enclosure, knurled
knobs on a scale, a chrome footswitch, LED-ladder meters, a lit tuner display, faders, a rosewood
fretboard); the test bass on screen only while it is the input; the spectra mark the note being
played. The app's window takes the dark theme; giving it the one-screen layout is still to do.

## Open

- The site is up at `phuzzbox.jthaler.net` (GitHub Pages from `live`, 2026-10-31).
