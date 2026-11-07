# Foot controller

Every page plays from a MIDI foot controller as well as from the screen. Out of the box it is laid
out for a Roland FC-300, a floor board of ten footswitches and two expression pedals: the pedal
switched in and out, its presets, a tuner, tap tempo, a volume pedal and the pedal's own expression
control, all under your feet. The **FC-300** toggle under the pedal draws the board with what each of
its pedals does on this page, lit while it is on, so you can see the layout while you play. **MIDI
pedals** in Controls lists the same mappings, and teaches any of them another control.

Part of [PhuzzBox](../README.md).

## Setting up the FC-300

The FC-300 has MIDI sockets and no USB, so it reaches the computer through a USB MIDI interface. A
class-compliant one needs no driver: a Roland UM-ONE mk2 with its switch on **TAB** works on a Mac
as it comes.

1. **Connect it.** The FC-300's **MIDI OUT** goes to the interface's input: on the UM-ONE, the plug
   for its MIDI IN. If the page shows nothing when you press a pedal, swap the UM-ONE's two plugs.
   Switch the FC-300 on. It starts in Standard mode.
2. **Put it in Control Change mode.** On its top screen, press **MODE** (or both bank pedals
   together) until the screen says Control Change mode. As it leaves the factory every pedal then
   sends a control change on MIDI channel 1 (owner's manual, pp. 13–15 and 21–23).
3. **Choose the bank.** In Control Change mode the two bank pedals make the five number pedals
   1–5 or 6–10 (their lights are red for 1–5, green for 6–10). Most of what you need is on 1–5 and
   the control pedals.
4. **Connect the page.** In Chrome or Edge (Safari has no Web MIDI), open any pedal and press
   **Connect MIDI** in the bar at the top of the page, beside **Start audio**; the browser asks once
   to use your MIDI devices: allow it. The button then names what it hears (**MIDI: UM-ONE**), its
   lamp flashing as each pedal arrives, and every page connects by itself from then on; press it
   again for the FC-300 drawing under the pedal. If you blocked MIDI once, allow it again from the
   icon at the left of the address bar. In **MIDI pedals** in Controls, the **last** readout shows
   each pedal as it arrives (`EXP 1, CC 7 = 93`); pick the interface in its menu if you have more
   than one. The app needs none of this: it listens to every MIDI input by itself.
5. **Check the expression pedals.** Rock each one from heel to toe: **last** should run from 0 to 127. If
   one stops short, calibrate it: hold **UTILITY** while switching the FC-300 on, and follow its
   screen (p. 56).

Nothing else needs changing on the FC-300: PhuzzBox listens on every channel, and works with its
footswitches as they come, latching (127 on one press, 0 on the next). If you set a switch to
momentary (p. 25), set its row's switch type to momentary too.

## The live layout on a pedal's page

| FC-300 | sends | does |
|---|---|---|
| EXP 1 | CC 7 | the volume after the pedal, through a volume pedal's audio taper |
| EXP 2 | CC 1 | the pedal's expression control: the Wah's rocker, the Radio's tuning, the Tape Echo's tape speed |
| EXP 2's toe switch | CC 83 | the footswitch, as a wah's: press the toe down to switch it in |
| number pedal 1 | CC 65 | the footswitch |
| number pedals 2–5 | CC 66–69 | the pedal's own switch, if it has one (the Rotary's Fast), then its presets |
| number pedals 6–10 | CC 70–74 | the presets after those |
| CTL 1 | CC 80 | the tuner: the output muted and the tuner shown, until you press it again |
| CTL 2 | CC 81 | tap tempo |
| EXP 1's toe switch | CC 82 | free: teach it |

A pedal whose descriptor names no expression control has the expression pedal on its first knob
that is not a level or a mix: the Phuzz's Fuzz, the Plate's Decay, the Doppler's Speed.

Each press of a footswitch toggles what it switches, whatever the screen did meanwhile, so the
pedal never needs pressing twice. The FC-300's own lights follow its presses, not the screen; the
drawing under the pedal follows the screen.

**Tap tempo** sets the metronome's tempo from the time between your taps (the median of the last
few, from two taps on, as the **Tap** button does), and a pedal with a tempo of its own takes the
beat too:

- **Tape Echo**: the tape's speed that brings the last head you hear round once a beat. An echo
  comes a head's distance d after the record head over the tape's speed v, t = d / v, so the beat
  T sets v = d / T: head 2 at 8 cm and 120 beats a minute (T = 0.5 s) run the tape at 16 cm/s. The
  capstan reaches 5 to 40 cm/s, so a tempo it can't reach stops at the nearest end.
- **Lamp Vibe**: one sweep of the lamp a beat, f = 1 / T, within its oscillator's 0.5 to 12 Hz.

A **program change** (the FC-300 in Standard mode, where the number pedals send them) picks the
pedal's preset of that number.

## On the Pedalboard

The board's layout makes the FC-300 a board of stompboxes:

| FC-300 | does |
|---|---|
| number pedals 1–8 | the footswitches of the board's pedals, in order from the bass |
| number pedal 9 | the metronome, on and off |
| EXP 1 | the volume |
| EXP 2 | the expression control of the pedal **EXP rocks** names, under the board's menus (at first, the first pedal that names one, as the Wah) |
| EXP 2's toe switch | that pedal's footswitch |
| CTL 1, CTL 2 | the tuner, and tap tempo for every pedal on the board with a tempo |

A program change picks the board of that number from **Boards** (Fuzz first is 1).

## The physics of an expression pedal

An expression pedal is a potentiometer turned by the rocker. The FC-300 reads its wiper and sends
the travel as a number from 0 to 127, seven bits, so each step is 1/127 of the travel: about 0.8 %.
On a knob that moves on a logarithmic scale, such as the Wah's rocker, a step is a fixed ratio,
and the whole travel spread over 127 steps.

The volume pedal takes the travel x through an audio-taper pot, as a volume pedal's is: the share
of the track below the wiper is

  g(x) = (81^x − 1) / 80,

0 at the heel, 1 at the toe and 10 % (−20 dB) at half travel, the usual "A" taper. Its slope grows
toward the toe, as loudness does with level, so the first half of the travel fades in and the
second sets the level. On the pages the gain glides to each new value with a 10 ms time constant
rather than stepping, which keeps the seven-bit steps from clicking.

## What is simplified

- The FC-300's lights follow its own presses, not the page: Control Change mode takes no MIDI in
  to light them (only System Exclusive mode does, p. 28), so after a change on the screen its
  light can disagree. The drawing under the pedal always says what is on.
- The drawing is a map of the FC-300's controls, not a picture of it to scale.
- PhuzzBox does not know which bank the FC-300 is on; the drawing gives both numbers of each
  number pedal.
- The plugins keep their own, shorter layout (EXP 1 the volume, EXP 2 the expression control,
  number pedal 1 the bypass): a host such as MainStage has its own tuner, tempo and patch changes,
  and maps the FC-300 to them itself.

## Files

- `shared/midi.js`: the FC-300's numbers, the live layout, what a CC does to each kind of control.
- `shared/midi-panel.js`: Web MIDI, the MIDI pedals card, learn, and the drawing of the FC-300.
- `board/src/board-main.js`: the Pedalboard's own targets and layout.
- `test/midi-tests.mjs`: the numbers against the owner's manual, the layouts, the switch types and tap tempo.

## Prior art and references

- Roland Corporation, *FC-300 MIDI Foot Controller Owner's Manual* (2007): modes and how to switch
  them, pp. 14–15; Control Change mode and its factory control changes, pp. 21–23; latching and
  momentary pedals, p. 25; System Exclusive mode, p. 28; expression pedal calibration, p. 56.
- MIDI Manufacturers Association, *The Complete MIDI 1.0 Detailed Specification* (1996): control
  change and program change messages; controllers 120–127 are channel mode messages.
- W3C, *Web MIDI API* (Working Draft): how a page in Chrome or Edge hears a MIDI input.
