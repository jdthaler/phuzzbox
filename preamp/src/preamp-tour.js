// preamp-tour.js — the guided tour of the Tube Preamp's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('preamp', [
  {
    title: 'Three triodes',
    views: ['The tubes', 'Scope'],
    preset: 'Clean and warm',
    play: [riff({ times: 2 })],
    text: `![The three triodes: V1a and V2a amplify, with the Gain pot between them; V2b follows](schematics/stages.svg)

Each 12AX7 is a cathode that emits, a grid that controls, and a plate that collects. The cathode's current follows Child's law, smoothed at cut-off:

  Ik = G (ln(1 + e^(C (Va/µ + Vg))) / C)^γ

The grid counts about µ ≈ 100 times as much as the plate, which is where the gain comes from. **The tubes** shows the 12AX7's curves with each stage's load line, in its own colour: the first stage rests at 217 V and 1.06 mA, the second at 186 V and 1.38 mA. Played gently, each trail stays on the straight middle of its line: the first stage gains 66, the second 45, and nothing clips.`,
  },
  {
    title: 'Turning up the Gain',
    views: ['The tubes', 'Scope', 'Spectrum'],
    preset: 'Edge of break-up',
    play: [riff({ times: 3 }), sweep('gain', 0.15, 0.8, { at: 0.5, dur: 12 })],
    text: `**Gain** is the amp's Volume, a pot between the two stages. The second triode's grid rests 1.15 V below its cathode. Turn it up and watch V2a's trail: once the grid swings above its cathode it draws current, which the 270 kΩ stopper turns into a voltage that holds it there, and the plate's swing flattens at the top of its line. Swung a few volts below, the tube cuts off and the plate runs up to the rail.

The two edges are not alike, so the even harmonics come first: listen for the notes thickening before they fuzz.`,
  },
  {
    title: 'The cathode follower',
    views: ['The tubes', 'Scope'],
    preset: 'Cranked',
    play: [note('E1', { dur: 3, vel: 1 }), note('A1', { at: 3, dur: 3, vel: 1 })],
    text: `The third triode doesn't amplify: its cathode follows its grid (a gain of 0.98) and drives the tone stack from about 615 Ω. Its grid sits right on V2a's plate, and rests only 0.48 V below its own cathode.

So when V2a swings hard, the follower's grid conducts too, and loads V2a's plate: watch the third trail climb to its 0 V curve on every peak. That second, softer clipping is the Bassman's thick, compressed break-up.`,
  },
  {
    title: 'The tone stack takes away',
    views: ['The tone stack', 'Spectrum'],
    preset: 'Edge of break-up',
    play: [riff({ times: 3 }), sweep('middle', 1, 0, { at: 1, dur: 5 }), sweep('bass', 0.5, 1, { at: 7, dur: 3 })],
    text: `![The tone stack: three capacitors and the Treble, Bass and Middle pots, then the Master](schematics/tonestack.svg)

The tone stack is three capacitors and three pots, passive: with every knob at halfway it takes about 12 dB off at 1 kHz, and scoops the middle most, near 700 Hz. Watch the dashed curve.

**Middle** goes from full up to all the way down: the scoop deepens to about 22 dB near 900 Hz, the famous scooped sound. Then **Bass** goes up, which lifts 60 Hz by about 4 dB. No knob adds anything: each only takes away less. The gain the tubes made before the stack is what lets it.`,
  },
  {
    title: 'A small cathode capacitor',
    views: ['The tone stack', 'The tubes'],
    preset: 'Edge of break-up',
    set: { gain: 0.5 },
    play: [riff(), { at: 5, set: { cathodeC: 0.68e-6 } }, riff({ at: 5 })],
    text: `The first triode's 1.5 kΩ cathode resistor has 25 µF across it. Without it, the cathode would follow the grid a little and take back some of the gain; with it, the cathode holds still for everything a bass plays.

Halfway, it becomes 0.68 µF, which only holds still for the highs: under 100 Hz the stage loses about 5 dB of its gain. The low notes push the second stage less hard, and the bass comes out tighter while the top still breaks up.`,
  },
  {
    title: 'Tired tubes, a low rail',
    views: ['The tubes', 'Scope'],
    preset: 'Edge of break-up',
    set: { gain: 0.45 },
    play: [riff(), { at: 5, set: { emission: 0.6, bplus: 300 } }, riff({ at: 5 })],
    text: `The preamp's rail hangs from the 385 V supply through a 14 kΩ dropper and an 8 µF filter, at about 325 V.

Halfway the tubes' emission falls to 60 % and the supply to 300 V: the rail drops to about 250 V, every load line shrinks toward the origin, and with less current each stage gains less, about 5 dB in all. Less room to swing and less gain to swing it with: a softer, earlier, browner break-up.`,
  },
]);
