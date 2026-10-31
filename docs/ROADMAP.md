# Roadmap

The plan, agreed 2026-10-31: browser and plugins first, as Forte; a hardware pedal later from the
same C++. The full write-up is the [Phuzzbox plan](https://claude.ai/artifact/A2XjTZYn5To2U4uh3agFu8).

## Phases

1. **Scaffold** — done: `native/` (effect contract, parameter tables generated from the
   descriptors, the CLAP effect plugin, the WebAssembly API), the page shell (audio input or the
   test bass, the pedal's face, meters, tuner, latency, Controls, How it works), the **test
   bass**, and the **Buffer** as the template pedal.
   **MIDI pedals** — done (2026-10-31): Web MIDI on every page and a MIDI input on the plugins,
   with learn and the Roland FC-300's factory CCs as defaults (CC 7 volume, CC 1 the pedal's
   expression control, CC 65 the footswitch, CC 66 the tuner's mute); the **Wah** (an inductor
   wah from its circuit, by the nodal DK method in `phuzzbox/dk.h`, swept low for bass) for the
   expression pedal to rock. The app (`native/app/`) is to forward its MIDI to the page with
   `window.phuzzMidi(status, d1, d2)`.
2. **Phuzz**, end to end: a two-transistor germanium fuzz (Ebers–Moll, temperature, battery sag,
   the input impedance that loads the pickup through the Buffer's circuit), solved implicitly and
   oversampled; views of the transistors' operating points; plugins.
3. **The rig**: tube preamp, opto compressor, cabinet; the **pedalboard** page, chaining pedals
   with real input and output impedances.
4. **Time and space**: spring reverb (Forte's springs), plate reverb, tape echo, rotary speaker.
5. **The rest**: envelope filter, octave down, sympathetic strings, black hole, Doppler; a
   hardware pedal (Electrosmith Daisy Seed) if wanted.

## Open

- The GitHub repository (`jdthaler/phuzzbox`) and the site (`phuzzbox.jthaler.net`).
- The owner's rig (bass, interface, DAW) to set latency targets and Full scale.
- CI: `.github/workflows/` is written but has not yet run.
