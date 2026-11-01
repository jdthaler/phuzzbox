# Pedalboard

Every PhuzzBox pedal on one board, in the order you choose, from your bass to the amp. The board
is more than the pedals one after another: the pedals whose circuits include their jacks are wired
to each other as real pedals are. A fuzz first in the chain feels your pickup; after another pedal
it sees that pedal's buffered output, and plays differently. A pedal that drives its output from a
high impedance drives the next pedal's input through the patch cable between them.

Part of [PhuzzBox](../README.md).

| Input | |
|---|---|
| Your audio interface | pick it in the source menu (then **In 1** or **In 2**) |
| `Z`…`/`, `A`…`;`, `Q`…`P`, `1`…`0` | the test bass's E, A, D and G strings, open to the ninth fret |
| `Space` | the board's footswitch: all of it, in or out |

## Playing it

The pedals sit below the board's own face, top to bottom from the bass to the amp. Each has its
knobs, its presets and its footswitch; ↑ and ↓ move it along the chain, ✕ takes it off. **Add a
pedal** puts one at the end, as you left it on its own page; **Boards** starts from a chain:

* **Fuzz first**: the Phuzz, the Wah, the Cabinet.
* **Fuzz after a buffer**: the same, with the Buffer in front. Switch the Buffer in and out and
  hear the Phuzz change.
* **Studio chain**: the Opto Compressor, the Tube Preamp, the Cabinet.
* **Synth bass**: the Octave Down into the Envelope Filter, into the Cabinet.
* **Dub**: the Opto Compressor, the Tape Echo's long repeats, the Spring Reverb.

Up to eight pedals. Each pedal's own page has its views and How it works; its name on the board
links there.

## The jacks

Four pedals model their input jack: the **Buffer**, the **Phuzz**, the **Tube Preamp**, and the
**Wah** plugged in backwards. Each takes the bass as a Norton source, the current that into your
recording's circuit (the coil, the capacitances, the pots, your interface) makes the voltage it
recorded, and puts that current into its own input instead (the [Buffer's notes](../buffer/README.md)
derive it). On the board, such a pedal feels your pickup only when nothing engaged is before it:

* **First in the chain**, it feels the pickup through the **Cable from the bass**, plus a patch
  cable for each bypassed pedal before it.
* **After a pedal**, it sees a source of 100 Ω through the patch cable, as the output of an op amp
  or a transistor follower is.

Three pedals model their output jack: the **Phuzz** (its volume pot), the **Tube Preamp** (its tone
stack and Master), and the **Wah** backwards (its input jack, through R1's 68 kΩ). Each drives a
cable and a load: on the board, the patch cable and the next engaged pedal's input impedance, or
the **Cable to the amp** and the **Amp's input** if it is the last.

The input impedances the board uses:

| Pedal | Input | Why |
|---|---|---|
| Buffer | its own Input impedance knob | the Buffer is a cable into that input |
| Phuzz | 10 kΩ | its input is below 10 kΩ across the bass's range (see below); the loads stop at 10 kΩ |
| Wah | 68 kΩ (backwards, 10 kΩ) | R1; backwards, the jack is Q1's collector, which loads it harder |
| Tube Preamp | 1 MΩ | the first triode's grid leak |
| the rest | 1 MΩ | a buffered input, a pedal's usual |

The other pedals (the Opto Compressor, the Cabinet, the Envelope Filter, the Octave Down, the Spring
Reverb, the Tape Echo, the Wah the right way round) take the voltage at their input and give a
voltage at their output: buffered jacks, 1 MΩ in and a low impedance out.

**True bypass.** A pedal switched off is a wire between its jacks: the pedals either side see each
other through both cables, and the board rewires itself. Its footswitch crossfades over 10 ms
against its input delayed by its latency, as on its own page. A pedal fully switched off is not run,
and comes back from rest, as a circuit with nothing at its input would.

## A fuzz first, or after a buffer

Plugged straight into the bass, the Phuzz's low input impedance is in series with the pickup's
coil, 3.6 H and 10.5 kΩ, and most of the pickup's voltage is lost across the coil. After a buffer,
the 100 Ω source loses almost nothing. So after a buffer the Phuzz is hit much harder: in the
tests, a small note reaches its output 22.6 dB louder at 100 Hz and 17.9 dB louder at 2 kHz. That is
the sound fuzz players know, a fuzz after a buffer that won't clean up and fizzes.

The tests check that against the pickup's circuit written out as complex impedances: the coil, its
capacitance and the cables', the bass's pots and your interface. Into an input of 10 kΩ the jack
would lose only 5.9 dB at 100 Hz and 14.6 dB at 2 kHz. The Phuzz loses more, so its input is below
10 kΩ, lowest at the bottom where its feedback works on the input too. That is why the board holds
it at 10 kΩ when another pedal drives it: the loads' Amp's input knobs stop there.

## The cables

* **Cable from the bass** (0.3–30 m): into a light input it tunes the pickup's resonance. Into
  the Buffer at 1 MΩ, 20 m against 1 m takes 15 dB off 5 kHz. Into the Phuzz, 10 m against 1 m
  changes 1 kHz by 0.13 dB, and after a buffering pedal not at all.
* **Patch cables** (0.15–3 m): from a buffered output they make no difference. From the Phuzz with
  its Volume at half, 3 m against 0.15 m takes 0.6 dB off 5 kHz. (The pedals' own cable knobs stop
  at 0.3 m, so shorter patches are taken as 0.3 m.)
* **Cable to the amp** (0.3–30 m): behind the Tube Preamp, 30 m takes 10 dB off 3 kHz.
* **Amp's input** (10 kΩ–10 MΩ): into 10 kΩ the Tube Preamp is 15.6 dB quieter than into 1 MΩ.

The bass and how it is plugged in are in Controls, as on the Buffer's page, and every pedal on the
board takes them from there.

## Solving it

The board is one AudioWorklet holding every pedal's WebAssembly (about half a megabyte, loaded when
the audio starts). Each pedal on the board is its own instance, run in order on each block of 128
samples: the output of one is the input of the next, in volts. When the chain or a setting
changes, the board works out each pedal's parameters with the wiring above and sets only those
that changed, so a reverb's tail and a tape's repeats carry on as you turn another pedal's knobs.

The tests check the chain against things independent of it:

* A board of one pedal plays exactly as that pedal does on its own, with the board's wiring.
* Two linear pedals commute, and their chain's impulse response is the convolution of their own:
  the Cabinet into the Spring Reverb, 10 mV in, against the Spring Reverb into the Cabinet and the
  convolution of the two pedals' impulse responses, agree within 2 parts in a million of the peak.
* A bypassed pedal passes its input untouched, and switching one in leaves no step larger than
  the signal's own.

## The views

* **The chain**: each jack on the board, what drives it, through how much cable, into what, and
  the loudest voltage there in the last moment.
* **Spectrum** and **Scope**: the bass against what reaches the amp.

## What is simplified

* **Mono between pedals.** Every pedal here plays mono, so the chain is one voltage.
* **Loads as resistances.** A pedal that drives a load takes the next input as a resistance of
  10 kΩ or more. The Phuzz's and the backwards Wah's inputs are lower, and change with frequency
  and their knobs.
* **Buffered outputs as 100 Ω.** A real op amp's or follower's output is a few ohms to a few
  hundred.
* **The Wah the right way round** takes the signal as recorded and drives an ideal input. Its
  68 kΩ input loads the pedal before it, but not the pickup when it is first.
* **Six pedals' jacks are ideal**: the Opto Compressor, the Cabinet, the Envelope Filter, the
  Octave Down, the Spring Reverb and the Tape Echo, as on their own pages.
* **The board is on the site only.** In a DAW the pedals are plugins in a chain the DAW makes, and
  they take the voltage at their input, as here after a buffer. The MIDI pedals move the board's
  own controls, its footswitch and the volume; not yet a wah's rocker on the board.

## Files

* `src/board-jacks.js`: the wiring, each pedal's jacks and input impedance.
* `src/board-chain.js`: the chain, with the effect contract; `src/board-worklet.js`: its worklet.
* `src/board-pedals.js`: the pedals the board can hold; `src/board-params.js`: the board's own
  controls and its starting boards; `src/board-main.js`: the page.
* `test/board-tests.mjs`: the wiring, the chain against convolution and commutation, the fuzz
  after a buffer against the pickup's circuit, and each hint.

## Prior art and references

* ElectroSmash. "Fuzz Face Analysis." [electrosmash.com/fuzz-face](https://electrosmash.com/fuzz-face).
  The Fuzz Face's input impedance of a few kilohms, which loads the pickup, and why the pedal is
  put first in the chain: after a buffer, it sounds worse.
* The [Buffer](../buffer/README.md), the [Phuzz](../phuzz/README.md), the
  [Wah](../wah/README.md) and the [Tube Preamp](../preamp/README.md): the circuits of the jacks the
  board wires together.
