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

## 2026-11-01 — the physics live in the views, and fixed physics made movable; the plugins' own window; your own presets and shareable links; a test guitar, and every pedal set for a guitar; versions, release notes and a changelog, as Forte's

### PhuzzBox 0.2.0
- **Slow motion:** views can replay each note you play (or, until you do, a test bass note) through the pedal's own model at 1/10 to 1/1000 of real time, with a speed menu, a pause and a replay in the card's title bar (`shared/motion.js`).
- **Harmonics on a curve:** a response curve can carry the note's harmonics as dots, each as large as it is loud at the input (`markPartials` in `shared/plot.js`).
- **The plugins' window:** in MainStage, Logic or any host, a pedal's plugin opens the app's face as
  its own window, in a web view (Forte's editor): the knobs, footswitch, Volume, meters and tuner,
  with the host's parameters behind them. A knob turned in the window is recorded by the host, an
  automation lane or a MIDI pedal moves the knob in the window, and the song keeps the window's
  layout.
- **Your own presets, as on Forte:** the Presets menu on every pedal's page has *Save these
  settings…*, which keeps them under a name in this browser, *Copy a link to these settings*, a
  link that opens the page playing them, and *Your presets and files…*, the list (play, link,
  save to a file, delete) and opening a preset file. A link carries only what differs from the
  defaults; a preset file names the pedal and its version, so a later version can read it.
- **Test guitar:** the test bass's sibling, six strings of a 10–46 set on a 25.5-inch scale, a pick and a single coil, with its own How it works.
- **Instrument:** Bass or Guitar, in the Rig and beside the fretboard. It sets the test instrument (six strings on screen, Shift for the top four), the riff, the tuner's range (60–1400 Hz for a guitar) and each pedal's settings, which each instrument keeps apart.
- The guided tours play the test bass, and a guitarist's page comes back when one ends.
- The Pedalboard starts a guitar's pickup from the test guitar's.
- **Versions that move:** PhuzzBox and each pedal keep their own semantic version, as Forte and
  its instruments do. A change leaves a note in `changes/`; a release gathers the notes into
  `CHANGELOG.md` and bumps each version named once (`node tools/release.mjs`), and the plugins and
  the app carry the new versions.
- The front page shows each pedal's version on its tile, beside PhuzzBox's at the foot.
- **Saved songs are guarded:** each pedal's parameters and presets are listed in
  `native/pedals/<id>/<id>-contract.json`, generated from its descriptor, and `tools/contract.mjs`
  says what a change would break in a song saved with the plugins. The `tests` workflow warns
  about a break now and, from a pedal's 1.0 on, will ask for a major version.

### Buffer 0.2.0
- **The pickup's response:** the note being played and its harmonics on the curve.
- Set for a guitar, the pickup starts as the test guitar's single coil (2.5 H, 6 kΩ).

### Phuzz 0.2.0
- Set for a guitar, the pickup it loads starts as the test guitar's single coil.

### Wah 0.2.0
- **The sweep:** the note being played and its harmonics on the curve, so the peak can be seen lifting them.
- Set for a guitar, the sweep capacitor starts at the 10 nF it was built with, and the pickup (for the Wah backwards) as the test guitar's.

### Tube Preamp 0.2.0
- Set for a guitar, the pickup starts as the test guitar's single coil.

### Cabinet 0.2.0
- **The box:** a new view, the cone, the port's air and the box's pressure in slow motion.
- **Guitar cabinets:** 1 × 12, 2 × 12 and 4 × 12 layouts, and a **Guitar 4 × 12 closed back** preset of Eminence Legend 1258s from their datasheet, where a page set for a guitar starts. Linear travel (Xmax) now goes down to 0.3 mm.

### Envelope Filter 0.2.0
- **The filter:** the note's harmonics ride the curve as dots.
- Set for a guitar, the range capacitors start at 15 nF, a guitar's range (317 Hz to 4.8 kHz).

### Octave Down 0.2.0
- Set for a guitar, the tracking filter starts at 150 Hz, which follows the test guitar's open strings.

### Spring Reverb 0.2.0
- **The springs:** a new view of the tank's springs in slow motion, the twist from each note running from bead to bead, from the engine's own modes.
- **Bead magnets:** a control for which way the beads' magnets lie, along the springs (as before) or across them, five times harder to turn and a darker tank.

### Tape Echo 0.2.0
- **The tape loop:** a new view of the tape running past the heads with what the record head wrote on it.
- **Head 1 to Head 3:** where each playback head sits, 1 to 20 cm after the record head, dragged on The tape loop.

### Plate Reverb 0.2.0
- **The plate:** now in slow motion, every mode the engine plays summed into the plate's motion, the ripples spreading from the driver.
- **Where they sit:** the driver and both pickups are controls (across and up the plate), dragged on The plate. The transducers' gain stays the one for the default places.

### Black Hole 0.2.0
- **The test masses:** a new view, a ring of free-falling masses stretched and squeezed by the hole's wave in slow motion.

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
