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

## 2026-11-01 — bends, fret dots and the iPad; every page checked in a browser; the footswitch doesn't jump; plugins to download; the rig at the foot of the page, and a metronome; the Wah's rocker, and a slimmer front page

### PhuzzBox 0.5.0
- **Bends:** drag across a string on the test bass's or guitar's fretboard, up or down, to bend the note. The finger pushes the string across the neck, stretching it from nut to bridge, and its tension rises by E A ΔL / L; a drag of one string's row pushes it one string's spacing at the bridge. Each mode keeps its action through a bend (and now through a slide, exactly, on a stiff string).
- **Fret dots** sit between the middle two strings (the bass's D and A, the guitar's G and D), where they belong.
- **iPad and iPhone:** the test instruments play without turning on an audio input first. Any tap or key resumes audio that Safari left suspended, and the page asks for a playback audio session, which the ringer switch does not silence.
- **No text selection** on the playing surface: a long press or a drag across the knobs, the fretboard or the views no longer selects text (How it works and typed values still do).
- `tools/check-pages.mjs`, Forte's: every page opened in headless Chromium at six sizes, from a
  phone to a desktop, failing on console errors, sideways scrolling, a pedal without its knobs,
  footswitch, ⓘ buttons or presets, and toggles that don't turn their view or controls off and on.
  CI runs it on every pull request and lists what differs from the base.
- **Loudness matching:** `tools/loudness.mjs`, as Forte's, measures each pedal engaged against bypassed
  on the test bass's riff, as BS.1770 integrated loudness, and `test/level-tests.mjs` keeps every pedal
  at its defaults within 1 dB of bypass, so engaging one no longer jumps by up to 15 dB.
- The Pedalboard's Amp's input hint says the Tube Preamp's 16 dB is with its Master at 40 %.
- **Plugins and the app to download:** a Plugins tab in How it works on every page (and on the front
  page, Plugins and the app) downloads the latest plugin release's files: on a pedal's page that
  pedal for macOS, Windows or Linux, and everywhere every pedal with the PhuzzBox app, or the app
  alone, with a line saying which release they are. Below them, how to install them on each system.
- Each archive has every format its system builds (AU, VST3, CLAP and standalone apps), the guide,
  `install.sh` on macOS and Linux (`bash install.sh install`), the licence and
  `THIRD-PARTY-NOTICES.md`. The macOS bundles are signed ad hoc so Apple silicon loads them.
- `tools/package-plugins.sh` packs them in every `native` run, and the `release-plugins` workflow
  publishes `live`'s as a GitHub release after each site release that changes them.
- **The rig**, at the foot of every page: its bar has the input and its channel, the output, the
  **Master** volume (after the pedal and the metronome) and the latency, moved from the header.
  Under it, with the test bass or guitar, the fretboard; with your interface, the interface's
  settings (Instrument, Model and gain, Full scale, moved from Controls) and five units before the
  pedal, each with its knobs and footswitch, the same on every page: **Gain**, **Hum filter**
  (notches at 50 or 60 Hz and its harmonics), **Gate**, **EQ** (bass and treble shelves, a
  sweepable mid) and **Compressor**. The test instruments skip them. How it works has a Rig tab.
- **Metronome**, under the pedal beside the tuner: each beat a struck maple block, the first of the
  bar a steel bar's bell, modelled from their bending modes; its pendulum's sliding weight sits
  where the tempo puts it. Tempo by −/+, typing or tapping; 2 to 7 beats a bar or no bell; its own
  level. How it works has a Metronome tab.
- The pedal is always shown (its toggle is gone); the Tuner and Metronome toggles are under it,
  not in the Views bar.
- The presets are on the pedal itself, in a window in the enclosure, on the pages and in the app.
- The front page draws each pedal without its knobs, as a small stompbox with its name and
  footswitch, so a board of them takes far less room; the knobs are on each pedal's page.
- A control a foot rocks can be drawn as a rocker pedal on the face (`face: 'treadle'`,
  `shared/treadle.js`), on the pedal pages, the Pedalboard, the app and the plugins' window.

### Phuzz 0.3.0
- Engaged at its defaults it is as loud as bypassed: the Volume's default goes from 100 % to 77 %.

### Wah 0.3.0
- Engaged at its defaults it is as loud as bypassed: the Level's default goes from 0 to +1.3 dB.
- **Rocker:** the face's Rocker is a rocker pedal, a treadle seen from the side rocking from heel
  down to toe down, in place of a knob; drag it up or right toward the toe. In Auto it rocks with
  the envelope follower as you play.

### Tube Preamp 0.3.0
- Engaged at its defaults it is as loud as bypassed: the Master's default goes from 40 % to 24 %.
- The Cable to the amp and Amp's input hints give their figures with the Master at 40 %, and say they are smaller turned down.

### Opto Compressor 0.2.0
- Engaged at its defaults it is as loud as bypassed: the Gain's default goes from 10 to 8.5 dB.

### Cabinet 0.3.0
- Engaged at its defaults it is as loud as bypassed: the Microphone sensitivity's default goes from 15 to 18.6 mV/Pa.

### Envelope Filter 0.3.0
- Engaged at its defaults it is as loud as bypassed: the Level's default goes from 0 to +6.1 dB.

### Octave Down 0.3.0
- Engaged at its defaults it is as loud as bypassed: the Level's default goes from 0 to +2.7 dB.

### Spring Reverb 0.3.0
- Engaged at its defaults it is as loud as bypassed: the Level's default goes from 0 to −0.6 dB.

### Tape Echo 0.3.0
- Engaged at its defaults it is as loud as bypassed: the Level's default goes from 0 to −3.5 dB.

### Rotary Speaker 0.2.0
- Engaged at its defaults it is as loud as bypassed: the Level's default goes from 0 to +0.4 dB.

### Plate Reverb 0.3.0
- Engaged at its defaults it is as loud as bypassed: the Level's default goes from 0 to −3 dB.

### Sympathetic Strings 0.2.0
- Engaged at its defaults it is as loud as bypassed: the Level's default goes from 0 to −11.5 dB.

### Black Hole 0.3.0
- Engaged at its defaults it is as loud as bypassed: the Level's default goes from 0 to −15.1 dB.

### Doppler 0.2.0
- Engaged at its defaults it is as loud as bypassed: the Level's default goes from 0 to +12 dB.

## 2026-11-01 — slides on the test bass and guitar

### PhuzzBox 0.4.0
- **Slides:** the test bass and guitar slide between notes. Drag along a string on the fretboard, or hold a key and press another on the same row (the note slides there in 0.15 s, and back when that key lets go). The note keeps each mode's displacement as its stopped length changes (the adiabatic invariant), so a note slid up an octave is the open string's pluck heard at the 12th fret.
- **Fretless / Slide bar:** a switch beside the fretboard. Fretted, a slide steps through each fret's equal-tempered pitch; fretless (a slide bar on the guitar), it glides through every pitch between.

## 2026-11-01 — one menu, the pedals drawn and grouped by their physics

### PhuzzBox 0.3.0
- **One menu**, as Forte's: PhuzzBox and the pedal's name in one dropdown at the top left, opening on the landing page, every pedal grouped by the physics it is made of (circuits, light and photocells, vibrating steel, paper and air, motion and delay, gravity), and the Pedalboard.
- **The landing page draws every pedal as itself** (its enclosure, its knobs where you left them, its footswitch), on boards by its physics, with a row of links to each.
- **The audio carries over:** a pedal opened from the menu keeps the input, its channel and the output, and starts its sound if the last one was playing (in Chrome and Edge at once; elsewhere at the first tap or key).
- **The tuner sits under the pedal**, at the left with its controls; its button now reads Mute.
- The app's pedal menu is grouped by physics too, and its tuner sits under the pedal.

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
