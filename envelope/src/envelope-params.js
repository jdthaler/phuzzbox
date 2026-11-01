// envelope-params.js — the Envelope Filter's controls. Values in SI units; `scale` shows them in
// friendlier ones. The filter is a state-variable filter whose two integrators' resistors are
// photocells lit by one LED; an envelope follower drives the LED from how hard you play.

const filter = [
  { id: 'mode', label: 'Mode', type: 'select', options: [['lp', 'Low-pass'], ['bp', 'Band-pass'], ['hp', 'High-pass']], def: 'bp',
    hint: 'Which of the state-variable filter\'s three outputs you hear. Band-pass is the vocal "quack", a peak that rides up with each note; low-pass keeps the bottom and opens the top like a synth; high-pass thins the note from below as the cutoff climbs.' },
  { id: 'reso', label: 'Resonance (Q)', min: 0.5, max: 15, def: 5, log: true, decimals: 1, unit: '', perform: true,
    hint: 'How little the filter\'s damping resistor damps it. More, a taller and narrower peak at the cutoff that whistles and quacks; at 0.7 the low-pass is flat to the cutoff with no peak at all.' },
  { id: 'rangeC', label: 'Range (capacitors)', min: 10e-9, max: 220e-9, def: 47e-9, log: true, unit: 'nF', scale: 1e9, decimals: 0, perform: true,
    hint: 'The two integrators\' capacitors. The cutoff is 1/(2πRC), so bigger capacitors move the whole sweep down, as 1/C: 47 nF sweeps about 100 Hz to 1.5 kHz for bass, 15 nF a guitar\'s range.' },
];

const envelope = [
  { id: 'sens', label: 'Sensitivity', min: 0, max: 40, def: 20, unit: 'dB', decimals: 1, perform: true,
    hint: 'The follower\'s gain, ahead of the LED. More, and a softer note lights the LED as brightly as a hard one did: the sweep goes higher, and hard notes pin it at the top.' },
  { id: 'direction', label: 'Direction', type: 'select', options: [['up', 'Up'], ['down', 'Down']], def: 'up',
    hint: 'Up, the follower adds to the LED\'s current: each pluck sweeps the filter up and it falls as the note fades. Down, it subtracts from a standing 5 mA: the filter rests high, each pluck pulls it down, and it rises again as the note dies.' },
  { id: 'attack', label: 'Attack', min: 1e-3, max: 0.1, def: 10e-3, log: true, unit: 'ms', scale: 1000, decimals: 1,
    hint: 'The follower\'s charging time constant. Short, the sweep jumps with the pluck; long, it slides up while the note sounds.' },
  { id: 'decay', label: 'Decay', min: 0.02, max: 2, def: 0.15, log: true, unit: 'ms', scale: 1000, decimals: 0,
    hint: 'The follower\'s discharging time constant. Short, the sweep follows each note down; long, it hangs up between notes.' },
];

const cell = [
  { id: 'lifetime', label: 'Carrier lifetime', min: 3e-3, max: 0.2, def: 15e-3, log: true, unit: 'ms', scale: 1000, decimals: 1,
    hint: 'How long a free electron lasts in the photocells before it recombines. It is how fast the cells darken when the LED dims: longer, and the sweep falls back more lazily than the follower asks.' },
  { id: 'trapTime', label: 'Trap release time', min: 0.1, max: 5, def: 0.5, log: true, unit: 's', decimals: 2,
    hint: 'How long the cells\' traps hold the electrons they catch. A long, hard note fills the traps, and after it the filter takes this long to fall all the way to rest: the photocell\'s memory.' },
  { id: 'litR', label: 'Cell resistance, lit', min: 1e3, max: 20e3, def: 5e3, log: true, unit: 'kΩ', scale: 1e-3, decimals: 1,
    hint: 'Each cell\'s resistance scale under 1 mA through the LED (the cell is 1.6 times this at that light, since its electrons respond sublinearly). Lower cells conduct more for the same light: the sweep reaches higher.' },
];

const output = [
  { id: 'blend', label: 'Clean blend', min: 0, max: 1, def: 0, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'Your dry signal mixed back in after the filter, so the bass\'s bottom stays under the sweep (most use for band-pass and high-pass).' },
  { id: 'level', label: 'Level', min: -24, max: 12, def: 0, unit: 'dB', decimals: 1,
    hint: 'Gain after the filter, in decibels.' },
];

export const GROUPS = [
  { name: 'The filter', params: filter },
  { name: 'The envelope', params: envelope },
  { name: 'The photocells', params: cell },
  { name: 'Output', params: output },
];

export const PRESETS = {
  'Quack (band-pass)': { mode: 'bp', reso: 5, rangeC: 47e-9, sens: 20, direction: 'up', attack: 10e-3, decay: 0.15, blend: 0.2 },
  'Synth bass (low-pass)': { mode: 'lp', reso: 6, rangeC: 47e-9, sens: 22, direction: 'up', attack: 5e-3, decay: 0.2, blend: 0 },
  'Gentle bloom': { mode: 'lp', reso: 1.5, rangeC: 47e-9, sens: 16, direction: 'up', attack: 30e-3, decay: 0.4, blend: 0.3 },
  'Downward': { mode: 'bp', reso: 5, rangeC: 47e-9, sens: 20, direction: 'down', attack: 5e-3, decay: 0.25, blend: 0.2 },
  'Squelch': { mode: 'bp', reso: 12, rangeC: 33e-9, sens: 28, direction: 'up', attack: 3e-3, decay: 0.12, blend: 0.15 },
  'Slow cells': { mode: 'bp', reso: 5, rangeC: 47e-9, sens: 20, direction: 'up', attack: 5e-3, decay: 0.05, lifetime: 0.1, trapTime: 2, blend: 0.2 },
};
export const KEEP = ['level'];
