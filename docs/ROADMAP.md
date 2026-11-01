# Roadmap

The plan, agreed 2026-10-31: browser and plugins first, as Forte; a hardware pedal later from the
same C++. The full write-up is the [PhuzzBox plan](https://claude.ai/artifact/A2XjTZYn5To2U4uh3agFu8).

## Phases

1. **Scaffold** — done: `native/` (effect contract, parameter tables generated from the
   descriptors, the CLAP effect plugin, the WebAssembly API), the page shell (audio input or the
   test bass, the pedal's face, meters, tuner, latency, Controls, How it works), the **test
   bass**, and the **Buffer** as the template pedal. Since then: the latency work (smallest
   browser buffer, output picker, loopback measurement), a tuner that reads a string's first
   partial, Full scale from the interface's specification, and PhuzzBox as an installable web app.
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
   The **Opto Compressor** landed 2026-11-01: an electroluminescent panel lit by a driver that
   hears the signal after the cell (or before it), and a photocell from rate equations for its
   free and trapped electrons (Rose 1951), tuned to the LA-2A's published timing (attack 10 ms,
   half the release in 0.06 s, all of it in 0.5–5 s) and tested against them and an independent
   model (`test/opto-circuit.mjs`).
   The **Speaker Cabinet** landed 2026-11-01: drivers from their Thiele–Small parameters (coil,
   cone, box air, port air as four coupled equations, by RK4), sealed or ported, 1 × 15 to 8 × 10,
   with the force factor and suspension nonlinear in the cone's travel, heard at 1 m in half
   space; tested against Small's closed box, the Helmholtz tuning, Small's reference efficiency
   and an independent complex solve (`test/cabinet-circuit.mjs`).
   The Wah's **Auto** mode landed 2026-11-01, at Jesse's ask: an envelope follower (a capacitor
   charged through an attack resistor by an ideal-diode rectifier, discharged through a decay
   resistor) rocks the wah from where the Rocker rests, up or down; tested against the follower's
   closed forms and an RK4 integration. A separate envelope-swept filter pedal is in the queue.
   The **Envelope Filter** landed 2026-11-01: a state-variable filter whose integrators' resistors
   are CdS photocells (the Opto's rate equations), lit by an LED that an ideal-diode envelope
   follower drives, up or down; tested against the cells' closed-form steady state, the filter's
   bilinear image, and an RK4 integration of the follower and cells together
   (`test/envelope-circuit.mjs`).
   The **Octave Down** landed 2026-11-01: the analog divider, a two-pole tracking filter, a
   comparator with hysteresis and two flip-flops that switch the filtered bass's polarity; tested
   against its ideal waveforms' Fourier coefficients by Simpson's rule (8/(3π) for one octave), the
   RC sections' bilinear images, and its tracking on the test bass's strings
   (`test/octave-circuit.mjs`).
   The **Spring Reverb** landed 2026-11-01: the Leem Pro KA-1210's and Olson X-82's springs as
   Parker and Bilbao measured them, as waves on the thin-spring model (a 2 × 2 eigenproblem per
   wavenumber), played as 2300 modes with Forte's loss model and bead filter; tested against
   Parker and Bilbao's T_D and F_C, an independent eigen-solve, and the echoes' arrival times at
   the group delay (`test/spring-circuit.mjs`).
   The **Tape Echo** landed 2026-11-01: a tape loop kept as samples and the positions they were
   written at, so speed changes bend the pitch; the record head on the anhysteretic (Langevin)
   curve; the playback heads' spacing, coating and gap losses as an FIR from their closed form; the
   motor's lag and the capstan's flutter; tested against those closed forms, the curve's harmonics
   by Simpson's rule, and the delays to the sample (`test/echo-circuit.mjs`).
   The **Pedalboard** landed 2026-11-01: every pedal in series in one AudioWorklet
   (`board/src/board-chain.js`), with true bypass; the pedals whose circuits include their jacks
   wired to their neighbours (`board/src/board-jacks.js`): first in the chain they feel the
   pickup, after a pedal a 100 Ω buffered output, and a pedal that drives a load drives the next
   one's input impedance through the patch cable. Tested against convolution and commutation of
   linear pedals, and the Phuzz's loss of the pickup against the pickup's complex impedance. Next
   for it: the MIDI expression pedal on a wah on the board, and a tour.
   The **Rotary Speaker** landed 2026-11-01: a horn and a drum past two microphones, each path
   solved for its retarded time every sample (the Doppler shift exactly), each mouth a baffled
   piston whose off-axis impulse response is a semicircle (2 J1(x)/x exactly), first-order motors;
   tested against the retarded time by bisection (a 3 kHz note's phase within 0.009 rad of a
   16.5 rad swing) and J1 by its series.
   The **Plate Reverb** landed 2026-11-01: the EMT 140's steel plate as Kirchhoff's thin plate,
   simply supported, 6432 modes to 5 kHz (1.31 per hertz), with the steel's thermoelastic and
   radiation losses and a damper, played at a quarter and a half of the sample rate between
   linear-phase filters; tested against the lattice and Weyl's law, every mode summed at the full
   rate in double precision, the decay by Schroeder's integral, and the bending waves' arrival at
   the pickups at their group velocity 2√(κω).
   The **Sympathetic Strings** landed 2026-11-01: a frame of stiff steel strings tuned to a key and
   scale, all at one stress, on a bridge the bass drives as an ideal velocity source; each partial
   (Fletcher's n f₀ √(1 + Bn²)) a resonator pulling on the bridge, with Chaigne and Askenfelt's
   b₁ + b₃ω² losses; tested against the string's driving-point closed form −T k cot(kL), every
   partial summed in double precision, the stretched partials and the decay heard in the output.
   The **Black Hole** landed 2026-11-01: a Kerr hole of 30–3000 suns rung by the bass in its four
   loudest quasinormal modes, (2,2,0), (2,1,0), (3,3,0) and (4,4,0), from Forte's table of Leaver
   solves, each a complex one-pole heard through its spin-weighted harmonic (h₊ left, h× right),
   with Kamaretsos et al.'s merger amplitudes; tested against fresh Leaver solves (1.6 × 10⁻⁶),
   the literature, Hod's near-extremal limit, the harmonics' closed form and the ringing measured
   from a click.
   Queued 2026-11-01, when Jesse asked for the rest of the blueprint: Speaker Cabinet, Envelope
   Filter, Octave Down, Spring Reverb, Tape Echo, the Pedalboard page, Rotary Speaker, Plate
   Reverb, Sympathetic Strings, Black Hole, Doppler, in that order.
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
MainStage too much, so PhuzzBox gets a simple app of its own. First the installable web app (done),
then **PhuzzBox.app** (`native/app/`, done): the same face in a window, with audio in C++ through
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
played. The app's window takes the dark theme and the one-screen layout.

Decided 2026-11-01 (Jesse): every pedal has a Scope and a Spectrum, each with a How it works page
(`shared/views.js`, `scope/README.md`, `spectrum/README.md`), the input dashed against the output
solid, in volts. The app's window has the tuner only; giving it the scope and the spectrum would
need the native host to send it the audio.

Decided 2026-11-01: a pedal gets a **Reversed** switch (plugged in backwards: the bass into its
output jack, its input jack to the amp) only where its circuit model can honestly drive it from the
output. The Wah has one: its loop becomes the signal path, and from a passive bass it squeals (the
"seagull"), which the tests find both in the engine and in an independent linearised analysis. The
Phuzz (no junction capacitances), the Tube Preamp (its tubes pass nothing back but through a few
picofarads: a switch would be a mute) and the Buffer (no circuit of its own) say in their READMEs why
they have none. A new pedal decides the same way (`docs/PEDAL_GUIDE.md`).

## Open

- The site is up at `phuzzbox.jthaler.net` (GitHub Pages from `live`, 2026-10-31).
