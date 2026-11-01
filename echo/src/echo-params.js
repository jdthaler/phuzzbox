// echo-params.js — the Tape Echo's controls. Values in SI units; `scale` shows them in friendlier
// ones. A loop of tape passes a record head and three playback heads; the echoes are the distances
// between them over the tape's speed, and the tape's magnetisation and the heads' losses colour them.

const tape = [
  { id: 'speed', label: 'Tape speed', min: 0.05, max: 0.4, def: 0.19, log: true, unit: 'cm/s', scale: 100, decimals: 1, perform: true,
    hint: 'How fast the capstan pulls the tape past the heads. The echoes come after the heads\' distances over the speed: faster is shorter, and brighter, since each wavelength on the tape is longer and the heads lose less of it. Turning it while echoes are on the tape bends their pitch as the motor follows.' },
  { id: 'heads', label: 'Playback heads', type: 'select', def: '12',
    options: [['1', 'Head 1'], ['2', 'Head 2'], ['3', 'Head 3'], ['12', 'Heads 1 and 2'], ['23', 'Heads 2 and 3'], ['13', 'Heads 1 and 3'], ['123', 'All three']],
    hint: 'Which playback heads are heard. They sit 4, 8 and 12 cm after the record head unless you move them, so at 19 cm/s they echo after 211, 421 and 632 ms; together they make rhythms of the same tape.' },
  { id: 'repeats', label: 'Repeats', min: 0, max: 1.2, def: 0.35, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'How much of what the heads play is recorded again. Each repeat goes through the tape once more, darker and more saturated each time. Past 100 % the loop grows until the tape saturates and holds it: the runaway these machines are known for.' },
];

// where the playback heads sit along the tape, as on the page's picture of the loop, where they can
// be dragged
const heads = [
  { id: 'head1', label: 'Head 1', min: 0.01, max: 0.2, def: 0.04, unit: 'cm', scale: 100, decimals: 1,
    hint: 'How far along the tape after the record head the first playback head sits. Its echo comes after this distance over the tape\'s speed: twice as far, twice as late. Slide it while it plays and the echo jumps to the tape that is there.' },
  { id: 'head2', label: 'Head 2', min: 0.01, max: 0.2, def: 0.08, unit: 'cm', scale: 100, decimals: 1,
    hint: 'Where the second playback head sits after the record head. Heads at whole multiples of one distance make even rhythms; others make uneven ones.' },
  { id: 'head3', label: 'Head 3', min: 0.01, max: 0.2, def: 0.12, unit: 'cm', scale: 100, decimals: 1,
    hint: 'Where the third playback head sits after the record head, up to 20 cm: at 5 cm/s that is a 4 s echo.' },
];

const machine = [
  { id: 'record', label: 'Record level', min: -24, max: 24, def: 0, unit: 'dB', decimals: 1,
    hint: 'How hard the record head drives the tape. With an ideal bias the tape keeps the anhysteretic magnetisation, which bends over as the particles line up: louder is more compressed, and the third harmonic grows. The echoes come out at the same level until it bends.' },
  { id: 'spacing', label: 'Head spacing', min: 0.5e-6, max: 30e-6, def: 4e-6, log: true, unit: 'µm', scale: 1e6, decimals: 1,
    hint: 'How far the tape rides from the playback heads: dust, wear, a tired pressure pad. The head hears the tape\'s field fall away over the gap, more for short wavelengths, so more spacing takes the top off every echo, and more off each repeat.' },
  { id: 'gap', label: 'Head gap', min: 1e-6, max: 20e-6, def: 5e-6, log: true, unit: 'µm', scale: 1e6, decimals: 1,
    hint: 'The width of the playback head\'s gap. A wavelength that fits in the gap cancels itself: the response falls to nothing where the wavelength equals the gap, which a wide gap at a slow speed brings down into hearing.' },
  { id: 'flutter', label: 'Capstan eccentricity', min: 0, max: 20e-6, def: 3e-6, unit: 'µm', scale: 1e6, decimals: 1,
    hint: 'How far the capstan\'s shaft is off centre. It speeds and slows the tape once a turn, so the echoes waver in pitch: flutter, at the capstan\'s turning rate.' },
];

const mix = [
  { id: 'dry', label: 'Dry', min: 0, max: 1, def: 1, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'Your bass as it came in.' },
  { id: 'wet', label: 'Echo', min: 0, max: 1, def: 0.5, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'How much of the playback heads is mixed in.' },
  { id: 'level', label: 'Level', min: -24, max: 12, def: -3.5, unit: 'dB', decimals: 1,
    hint: 'Gain after the mix, in decibels.' },
];

export const GROUPS = [
  { name: 'The tape', params: tape },
  { name: 'The heads', params: heads },
  { name: 'The machine', params: machine },
  { name: 'The mix', params: mix },
];

export const PRESETS = {
  'Slapback': { speed: 0.38, heads: '1', repeats: 0, record: 0, spacing: 3e-6, gap: 5e-6, flutter: 3e-6, dry: 1, wet: 0.6 },
  'Dub bass': { speed: 0.19, heads: '2', repeats: 0.55, record: 3, spacing: 6e-6, gap: 5e-6, flutter: 3e-6, dry: 1, wet: 0.6 },
  'Three heads': { speed: 0.19, heads: '123', repeats: 0.3, record: 0, spacing: 4e-6, gap: 5e-6, flutter: 3e-6, dry: 1, wet: 0.5 },
  'Worn machine': { speed: 0.095, heads: '12', repeats: 0.5, record: 6, spacing: 15e-6, gap: 10e-6, flutter: 12e-6, dry: 1, wet: 0.6 },
  'Runaway': { speed: 0.19, heads: '13', repeats: 1.1, record: 6, spacing: 5e-6, gap: 5e-6, flutter: 4e-6, dry: 0.8, wet: 0.5 },
};
export const KEEP = ['level'];
