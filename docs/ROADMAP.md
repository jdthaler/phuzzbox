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
   (test/phuzz-circuit.mjs). Next for it: the app playing it, and listening on the owner's bass.
3. **The rig**: tube preamp, opto compressor, cabinet; the **pedalboard** page, chaining pedals
   with real input and output impedances.
4. **Time and space**: spring reverb (Forte's springs), plate reverb, tape echo, rotary speaker.
5. **The rest**: envelope filter, octave down, sympathetic strings, black hole, Doppler; a
   hardware pedal (Electrosmith Daisy Seed) if wanted.

## The standalone app

Decided 2026-10-31: the owner plays a passive four-string through a Scarlett 2i2 and finds
MainStage too much, so Phuzzbox gets a simple app of its own. First the installable web app (done),
then **Phuzzbox.app** (`native/app/`, done): the same face in a window, with audio in C++ through
RtAudio at small buffers, a few milliseconds' round trip against Chrome's 15–25. Its own program
rather than clap-wrapper's standalone, which fixes the buffer at 256 samples on macOS. Next: the
same face as the plugins' panel in MainStage and Logic (Forte's editor.cpp), and the app choosing
among pedals once there is more than one.

## Open

- The site (`phuzzbox.jthaler.net`), so the app installs from a URL rather than `localhost`.
