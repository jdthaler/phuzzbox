// radio-tour.js — the guided tour of the Crystal Radio's physics (shared/tour.js)
import { tour, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('radio', [
  {
    title: 'On the air',
    views: ['The dial', 'Scope'],
    preset: 'A local station',
    play: [riff({ times: 2 })],
    text: `Your bass, broadcast. The transmitter sends a carrier at the station's frequency, 1000 kHz, its amplitude Ac(1 + k·vin) following your bass: an AM station. Each note f rides on the carrier as two sidebands, f either side of it. The crystal set picks the station out with a coil and a capacitor tuned to it, and a diode turns the carrier back into sound, with no battery: the station's own power moves the earphone.

![The Crystal Radio: a tuned circuit, a point-contact diode and an earphone](schematics/set.svg)`,
  },
  {
    title: 'Squared',
    views: ['The detector', 'Spectrum'],
    preset: 'Faint and far: square law',
    play: [riff(), sweep('signal', 0.01, 2, { at: 5, dur: 5, log: true }), riff({ at: 5 })],
    text: `A faint station: 10 mV at the diode, well under germanium's nVT of 41 mV. Averaged over a cycle of the carrier, the diode's current is

  Is(e^(−V/nVT) I0(A/nVT) − 1),

and for a small A the Bessel function is 1 + (A/2nVT)²: the earphone's voltage goes as the carrier's square. The bass comes out squared, each note with a second harmonic m/4 of it, 10 % at 40 % modulation. Halfway the station grows to 2 V, where the detector is a peak detector, V ≈ A, and the second harmonic falls to 0.4 %.`,
  },
  {
    title: 'A silicon detector',
    views: ['The detector', 'Spectrum'],
    preset: 'Silicon detector',
    play: [riff({ times: 2 })],
    text: `Silicon needs 0.58 V for a milliampere where germanium needs 0.28 V. At 300 mV, where germanium is nearly a peak detector, silicon is between its two laws, its voltage rising faster than the square, and a 40 % modulation comes out with a 26 % second harmonic, against germanium's 2 %. A crystal set wants a detector that turns on early.`,
  },
  {
    title: 'The tuned circuit',
    views: ['The dial', 'Spectrum'],
    preset: 'Sharp tuning',
    play: [riff(), sweep('q', 200, 50, { at: 5, dur: 5, log: true }), riff({ at: 5 })],
    text: `A coil and a capacitor at Q 200, tuned to 1000 kHz: 3 dB down 2.5 kHz either side. The bass's notes are sidebands of the carrier, so that band is the bass's bandwidth, and the treble is cut, 2.9 dB at 2.5 kHz. Halfway Q falls to 50, 10 kHz either side, and the treble is back.`,
  },
  {
    title: 'Diagonal clipping',
    views: ['The detector', 'Scope'],
    preset: 'Diagonal clipping',
    play: [riff({ times: 2 })],
    text: `The bypass capacitor holds the carrier's peaks between its cycles, and the earphone's resistance lets them down: 1 MΩ and 4.7 nF, RC = 4.7 ms. When the carrier falls faster than that, the voltage can't follow and slides down a straight line instead, diagonal clipping. It starts where mωRC = √(1 − m²): at 40 % modulation, 78 Hz, so a 220 Hz note comes out with an 8 % second harmonic. In **The detector** the solid line leaves the dashed one on the way down.`,
  },
  {
    title: 'The next station',
    views: ['The dial', 'Spectrum'],
    preset: 'Whistle from next door',
    play: [riff(), sweep('tuning', 0, 10000, { at: 5, dur: 5 }), riff({ at: 5 })],
    text: `10 kHz up the dial is the next station, here 24 dB weaker. The tuned circuit lets it through, 3 dB down, and the detector, given two carriers, hears their beat: a 10 kHz whistle, 17 dB under a 0.3 V note. Halfway the dial turns up to it: your station's carrier slides down the curve's side, the bass 3.6 dB quieter, and the whistle stays, the two carriers' difference wherever you tune.`,
  },
  {
    title: 'Overmodulated',
    views: ['Scope', 'Spectrum'],
    preset: 'Overmodulated',
    play: [riff({ times: 2 })],
    text: `At 500 %/V a 0.3 V note asks for 150 % modulation. A transmitter can't send less than nothing, so the carrier is cut off in the note's troughs, 27 % of each cycle, and the troughs come out flattened: an 18 % second harmonic.`,
  },
]);
