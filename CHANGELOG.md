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

## 2026-11-06 — the Bandgap overdrive; the Bucket Brigade; the Transatlantic Cable; the FC-300 laid out for playing live; Helmholtz's Resonators; the Lamp Vibe; the Gravitational Lens; the Michelson Interferometer; the Neon Tremolo; Open Air; the Crystal Radio; the Ring Modulator; Rubens' Tube; Sabine's Room; the Output Transformer; the Tunnel Diode; the views' readouts read whole

### PhuzzBox 0.6.0
- A switch among several choices can be a knob on a pedal's face, turned through its positions
  by dragging or the arrow keys, as the Bandgap's Diodes switch is.
- The release test lets a pedal waiting for its first release (a `new` note) be missing from the
  changelog until the release writes it.
- **A live layout for the FC-300**: out of the box a Roland FC-300 in Control Change mode now plays
  each page as a pedal on a board: number pedal 1 and the toe switch under expression pedal 2 the
  footswitch, number pedals 2–10 the pedal's switch (the Rotary's Fast) and then its presets,
  CTL 1 a tuner pedal (the output muted and the tuner shown until pressed again), CTL 2 tap tempo,
  expression pedal 1 the volume and expression pedal 2 the pedal's expression control, now on
  every pedal. A page that kept the old defaults untouched takes the new layout.
- **FC-300 view** under the pedal: the board drawn with what each of its pedals does on this page,
  lit while it is on and flashing as it arrives; the same drawing heads the MIDI pedals card, where
  a pedal's rows now name the FC-300's pedal.
- **Footswitch types**: a switch can toggle on each press (the new default, which never gets out of
  step with the screen), follow its latching pedal's light, or be momentary.
- **Pedalboard**: number pedals 1–8 switch the board's pedals in and out, 9 the metronome; EXP 2
  rocks the pedal chosen under the board's menus (EXP rocks) and its toe switch turns it on and
  off; tap tempo reaches every pedal on the board with a tempo; a program change picks a board.
- **Foot controller** notes in How it works: setting up the FC-300 and the layouts.
- The app has the live layout and the FC-300 view too.
- An Optics section on the landing page and in the menu.
- Circuit diagrams can draw a neon lamp.
- A pedal whose name won't do for a file gives its plugins a name of their own (`plugin.name` in
  the registry): clap-wrapper's build commands broke on the apostrophe in Sabine's Room. A test
  keeps every plugin's name to letters, digits, spaces, dots and hyphens.
- Circuit diagrams can draw a tunnel diode (`shared/schematic.js`).
- **The views' readouts read whole:** the live numbers under a view (the Phuzz's operating points,
  the Spring Reverb's springs, the Plate Reverb's driver and pickups, …) wrap onto more lines where
  the card has room, instead of being cut to "…" on one line on nearly every pedal at a desktop's
  size. In a short card they keep to one line as before, and hovering shows each whole. The room
  they take holds steady as their numbers change, so the plots above don't jump.
- A slow-motion view's title stays on one line beside its speed, pause and replay buttons, and its
  clock line shrinks to fit a narrow card instead of running off both sides.

### Wah 0.3.1
- Its notes give the FC-300's new layout: the toe switch under expression pedal 2 switches it in.

### Output Transformer 0.1.0
- **Output Transformer**, a new pedal: the iron at the end of a valve amplifier, between the
  output valves and the speaker, its core magnetised round the hysteresis loop of Jiles and
  Atherton's theory. Three published cores, iron, 50 % nickel and permalloy; Faraday's law makes
  the flux a note needs go as its voltage over its frequency, so the low notes saturate it first.
  Drive, plate resistance, core area and level; views of the core's loop and of the flux each note
  needs, a tour, and its plugins.

### Bandgap 0.1.0
- **Bandgap**, a new pedal: an op-amp overdrive whose diodes you choose by their bandgap,
  germanium, Schottky, silicon, and red, green and blue LEDs that clip at their photons' energy
  (E = hc/λ) and glow on the page as they do. The op-amp has its gain–bandwidth, slew rate and
  rails (LM308, µA741 or TL072); the diodes feel the temperature. Views of the diodes' curves and
  of the response, a tour, and its plugins.

### Transatlantic Cable 0.1.0
- **Transatlantic Cable**, a new pedal: your bass down 1 to 200 km of the 1858 or 1866 Atlantic
  telegraph cable or a telephone pair, by the telegrapher's equations. Unloaded, Kelvin's law of
  squares smears it; loading coils every 1.83 km clear it up to their cutoff; Heaviside's
  distortionless loading delays it whole, and with the far end open, echoes it. Views along the
  cable, of its response and of a volt arriving, a tour, and its plugins.

### Ring Modulator 0.1.0
- **Ring Modulator**, a new pedal: four diodes in a ring between two centre-tapped transformers,
  switched by a sine, triangle or square carrier, so every note comes out as its sum and difference
  with the carrier, the radio engineer's heterodyne. A weak carrier makes it a smooth multiplier, a
  mismatched diode leaks the carrier, and small transformers cut the low end. Views of the ring
  and of its sidebands, a tour, and its plugins.

### Crystal Radio 0.1.0
- **Crystal Radio**, a new pedal: your bass broadcast as an AM station and heard on a crystal set,
  a tuned coil, a point-contact diode and an earphone. A faint station comes through the square
  law, squared, with each note's second harmonic; a strong one comes out straight; a sharp tuned
  circuit cuts the treble; a long RC clips diagonally; the next station whistles at 10 kHz.
  Germanium, Schottky or silicon detectors. Views of the detector's law and of the dial, a tour,
  and its plugins.

### Tunnel Diode 0.1.0
- **Tunnel Diode**, a new pedal: Esaki's germanium tunnel diode, Sze's three currents fitted to the
  GE manual's typical 1 mA diode, whose current falls between its peak and its valley. With a load
  steeper than its negative resistance it is a switch with memory, a Schmitt trigger that turns
  every note that reaches its threshold into a square wave; with an inductor, a relaxation
  oscillator your bass plays. Views of the diode's curve with its load line and of the switch's
  loop, a tour, and its plugins.

### Lamp Vibe 0.1.0
- **Tap tempo**: a tap sets the oscillator to one sweep a beat.
- **Lamp Vibe**, a new pedal: a slow oscillator dims and brightens a small tungsten lamp, whose
  filament heats by its current and cools by radiating, and whose black-body glow lights four
  photocells, each the resistor of an all-pass stage. Chorus (two sweeping notches) or vibrato;
  three bulbs, from a grain of wheat to a 5 W panel bulb that can't keep up; the cells' lifetime.
  Views of the lamp, its glow against the cells' response and the stages' phase, a tour, and its
  plugins.

### Neon Tremolo 0.1.0
- **Neon Tremolo**, a new pedal: a neon lamp flashing in a relaxation oscillator, its striking
  voltage from Paschen's law for neon, helium or argon and the cathode's γ, its flashes lighting a
  photocell that ducks the bass. Too small a resistor and the glow never goes out; too low a supply
  and the lamp never strikes. Views of the lamp and of Paschen's curve, a tour, and its plugins.

### Michelson Interferometer 0.1.0
- **Michelson Interferometer**, a new pedal in a new Optics section: a laser split into two arms,
  one mirror moved by your bass, so the fringes sweeping past a photodiode fold the wave every half
  wavelength. HeNe, green and violet lasers, a sodium lamp whose two lines beat, and a white LED
  coherent over a few micrometres; a piezo or loudspeaker mount; drifting air. Views of the rings,
  the fringe and the mount, a tour, and its plugins.

### Cabinet 0.3.1
- The box's clock line fits its card.

### Spring Reverb 0.3.1
- The echoes' time axis labels every 100 or 200 ms where every 50 ms would run together, and The
  springs puts *drive* and *pickup* up its margins where the clock's line would run into them.

### Tape Echo 0.4.0
- **Tap tempo**: a tap sets the tape's speed so the last head heard comes round once a beat.
- The tape loop's head delays drop a line where two heads sit close enough for their labels to
  run together.

### Bucket Brigade 0.1.0
- **Bucket Brigade**, a new pedal: a bucket-brigade delay, a chain of 512 to 4096 capacitors
  passing the bass along as charge at a clock, sampled and held, with the charges left behind at
  each transfer smearing the top. A swinging clock bends the pitch for chorus and vibrato, feedback
  makes a flanger or echoes, and a slow clock with open filters lets aliases through. Views of the
  chain's charges and of its response, a tour, and its plugins.

### Open Air 0.1.0
- **Open Air**, a new pedal: your bass heard across open ground. The air absorbs its treble by
  ISO 9613-1, more the farther, the drier and the colder; the ground's reflection, by Weyl and van
  der Pol's formula over a ground whose impedance follows Miki's law from its flow resistivity,
  digs a dip into the bass's range: 190 Hz over fresh snow, 500 Hz over grass, 1.6 kHz over a dirt
  road, and a comb over asphalt. Distance, ground, humidity, temperature and level, and the heights
  of the bass and your ears; views of the response and of the ground's reflection, a tour, and
  its plugins.

### Sabine's Room 0.1.0
- **Sabine's Room**, a new pedal: your bass in a room you build. The direct sound and the first 64
  reflections by Allen and Berkley's image method, then the reverberation in each octave from
  125 Hz to 4 kHz, dying away in Eyring's time from the room's size, its walls, its floor, its
  audience and the air's absorption, at the diffuse field's level, so that past the critical
  distance you hear more room than bass. Length, walls, audience, distance and level, with width,
  height, floor and humidity; views of each octave's decay and of the echogram, a tour, and its
  plugins, named Sabine Room.

### Rubens' Tube 0.1.0
- **Rubens' Tube**, a new pedal: your bass through a loudspeaker into a closed pipe of propane or
  methane, heard by a microphone inside. The pipe's modes, a whole number of half wavelengths along
  it, with Kirchhoff's losses to its walls, driven by Gardner, Gee and Dix's measured speaker, whose
  cone damps the lowest of them. Length, gas, drive, microphone and level, with the bore and the gas
  pressure; views of the response and of the flames over the standing wave, a tour, and its
  plugins, named Rubens Tube.

### Helmholtz's Resonators 0.1.0
- **Helmholtz's Resonators**, a new pedal: your bass heard through one of Helmholtz's ten glass
  resonators held to your ear, from the measurements he gave of them: the air in its neck a mass on
  the spring of the air inside, ringing out the partial of each note that falls on it. Resonator,
  opening, other ear and level, with the air's temperature; views of the ten resonators' responses
  and of Koenig's manometric flames, a tour, and its plugins, named Helmholtz Resonators.

### Plate Reverb 0.3.1
- The plate's clock line fits its card.

### Black Hole 0.3.1
- The test masses' clock line fits its card.

### Gravitational Lens 0.1.0
- **Gravitational Lens**, a new pedal: your bass as a wave from far behind a point mass of 1 to
  1000 suns, convolved with no latency with the lens's impulse response from wave optics (the
  second derivative of the area of the lens plane arriving before each time). Two images beat into
  a comb, the second Hilbert-transformed, and the longest waves go round the lens untouched; an
  Optics switch plays geometric optics alone, causally. Views of the lens plane, the arrivals and
  the response, a tour, and its plugins.

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
