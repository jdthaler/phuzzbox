# Changelog

PhuzzBox and each pedal have their own [semantic version](https://semver.org), as Forte and its
instruments do. PhuzzBox's version covers the site and the shared code (`shared/`, the landing
page, the Pedalboard, the test bass, the tuner, the scope and spectrum pages, `tools/`) and the
app; a pedal's version covers its folder, its tests and its port in `native/pedals/<id>/`, which
the plugins carry. Everything is pre-release (0.x) for now, so any release may change the sound or
the parameters.

Versions change only when `main` is released to `live`, the branch the site is published from:
each pull request into `main` leaves a note in `changes/` (`changes/README.md`), and
`node tools/release.mjs` gathers them into one entry here, bumping each version once.

## 2026-11-01 — the first releases

Until versions were kept, five releases went to `live` at 0.1.0 without bumping anything. This
entry records them: from here on each release has its own.

### PhuzzBox 0.1.0
- **2026-10-31, the site goes up** at phuzzbox.jthaler.net, served from `live` (#8): the page
  shell with the test bass (a bass made of physics, played from the computer keys), the meters,
  the latency card with a loopback measurement and the output picker (#2), the tuner that reads a
  stiff string's first partial (#3), Full scale from the interface's specification, the
  installable web app (#4) and the Mac app, PhuzzBox.app, with audio through RtAudio at small
  buffers (#5).
- **Release of 2026-11-01 (#13):** MIDI foot controllers on every page and plugin, with learn
  and the Roland FC-300's factory CCs (#6); where the browser's latency comes from (#9); the app's
  pedal menu (#10) and MIDI (#11); How it works and a physics tour on every pedal (#12); each
  page on one screen in a dark theme with skeuomorphic hardware (#14).
- **Release (#22):** the PhuzzBox name, with a capital B (#16); the app's window on one screen
  (#17); 6 ms out of every page's round trip (#18); dark app colours, the riff lighting its frets
  (#19); no allocation in the AudioWorklet's block (#20).
- **Release (#36):** real-time fixes (denormals, bypass timing, NaN resets) (#23); a Scope and a
  Spectrum on every pedal, each with a How it works page (#24); circuit diagrams drawn from
  `src/<id>-schematics.js`, in How it works and the tours (#25, #28, #30); GitHub linked only
  from the credits (#26); Space presses keyboard-focused buttons, bigger ⓘ targets (#27).
- **Release (#45):** the Pedalboard, every pedal in series with true bypass and real jacks
  between them (#38); each view's legend kept on screen in short cards (#44).

### Buffer 0.1.0
- New pedal (2026-10-31): the pickup, cable and input a bass plugs into, as one circuit: the
  pickup's resonance moves as the cable lengthens and the input loads it.

### Phuzz 0.1.0
- New pedal (2026-10-31, #7): a two-transistor germanium fuzz, Ebers–Moll transistors that drift
  with temperature, a sagging battery and an input that loads the pickup, by the nodal DK method
  at 4× oversampling.

### Wah 0.1.0
- New pedal (#6): the inductor wah from its circuit, swept low for bass, rocked by the foot or a
  MIDI expression pedal. Since then: Supply clicks fixed (#23), **Auto**, an envelope follower
  rocking it (#31), and **Reversed**, plugged in backwards, where it squeals like a seagull (#32).

### Tube Preamp 0.1.0
- New pedal (#15): the 1959 Bassman's preamp, three Dempwolf–Zölzer triodes with grid current, the
  Yeh–Smith tone stack and the supply through its dropper, as one circuit by the DK method.

### Opto Compressor 0.1.0
- New pedal (#21): an electroluminescent panel and a CdS photocell from rate equations for its free
  and trapped electrons, tuned to the LA-2A's published timing.

### Cabinet 0.1.0
- New pedal (#29): drivers from their Thiele–Small parameters in a sealed or ported box, 1 × 15 to
  8 × 10, with the force factor and suspension nonlinear in the cone's travel.

### Envelope Filter 0.1.0
- New pedal (#33): a state-variable filter whose resistors are photocells, lit by an LED that an
  envelope follower drives, up or down.

### Octave Down 0.1.0
- New pedal (#34): a tracking filter, a comparator with hysteresis and two flip-flops that flip the
  bass's polarity: an octave down, and two.

### Spring Reverb 0.1.0
- New pedal (#35): measured tanks' springs as waves on the thin-spring model, 2300 modes, every
  echo a chirp.

### Tape Echo 0.1.0
- New pedal (#37): a tape loop past a record head on the Langevin curve and three playback heads
  with their spacing, coating and gap losses, the motor's lag and the capstan's flutter.

### Rotary Speaker 0.1.0
- New pedal (#39): a horn and a drum past two microphones at the retarded time, each mouth a
  baffled piston.

### Plate Reverb 0.1.0
- New pedal (#40): the EMT 140's steel plate as Kirchhoff's thin plate, 6432 modes to 5 kHz, with
  thermoelastic and radiation losses and a damper.

### Sympathetic Strings 0.1.0
- New pedal (#41): a frame of stiff steel strings tuned to a key and scale on a bridge the bass
  drives.

### Black Hole 0.1.0
- New pedal (#42): a Kerr hole rung in its four loudest quasinormal modes, from Leaver solves,
  heard through their spin-weighted harmonics.

### Doppler 0.1.0
- New pedal (#43): a point source on a straight road, each ear's retarded time in closed form,
  through the Mach cone and its boom.
