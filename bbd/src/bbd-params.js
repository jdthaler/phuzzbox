// bbd-params.js — the Bucket Brigade's controls. Values in SI units; `scale` shows them in friendlier ones.

// the chips: their stages (native/pedals/bbd/bbd-model.cpp)
export const CHIPS = [['512', '512 stages'], ['1024', '1024 stages'], ['2048', '2048 stages'], ['4096', '4096 stages']];

const pedal = [
  { id: 'clock', label: 'Clock', min: 5e3, max: 200e3, def: 100e3, log: true, unit: 'kHz', scale: 1e-3, decimals: 1, perform: true,
    hint: 'The clock that moves the charges along, one stage each half-cycle: the delay is the stages over twice the clock, 5.12 ms through 1024 stages at 100 kHz, 102 ms at 5 kHz. The bass is sampled once a clock cycle, so nothing above half the clock survives: slowed below about 20 kHz the delay gets long and dark, and the filters let through what folds back as aliases.' },
  { id: 'rate', label: 'Rate', min: 0.05, max: 10, def: 0.8, log: true, unit: 'Hz', decimals: 2, perform: true,
    hint: 'How fast a triangle wave swings the clock up and down. Speeding the clock shortens the delay while the charges already inside it come out faster: the pitch rises, and falls as it slows. Slow, a chorus\'s gentle drift; fast, a vibrato.' },
  { id: 'depth', label: 'Depth', min: 0, max: 0.5, def: 0.15, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'How far the triangle swings the clock, as a share of its frequency: at 15 % and 0.8 Hz the pitch wavers by about 6 cents either way at 100 kHz, and the Vibrato preset\'s 20 % at 5 Hz by half a semitone. Zero holds the delay still.' },
  { id: 'feedback', label: 'Feedback', min: -0.95, max: 0.95, def: 0, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'How much of the delayed sound goes back into the chip. With a short delay it deepens the comb of peaks and notches the delay makes against the dry sound into a flanger\'s ringing; negative flips which frequencies ring. With a long one, repeats.' },
  { id: 'mix', label: 'Mix', min: 0, max: 1, def: 0.5, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'The delayed sound against the dry. At 50 %, half each: where the delay puts them in step they add, where it puts them in opposition they cancel, and the notches sit at odd multiples of half the delay\'s inverse. At 100 %, the delay alone: a vibrato.' },
  { id: 'level', label: 'Level', min: -24, max: 12, def: 3.7, unit: 'dB', decimals: 1,
    hint: 'The output. At Mix 50 % the delay\'s comb takes a few decibels off a bass, whose fundamentals sit near its first notch, so the Level starts a little up to match bypass.' },
];

const chip = [
  { id: 'stages', label: 'Stages', type: 'select', def: '1024', options: CHIPS,
    hint: 'The capacitors in the chain. Each clock cycle moves every charge two stages, so the delay is the stages over twice the clock: more stages, longer delays at the same clock, the same brightness. The common chips had 512 to 4096.' },
  { id: 'cti', label: 'Transfer loss', min: 0, max: 1e-3, def: 1e-4, unit: 'ppm', scale: 1e6, decimals: 0,
    hint: 'The share of each charge left behind at each transfer, which joins the next charge instead. Over the N transfers it smears the highs: at half the clock the loss is ((1 − ε)/(1 + ε))^N, about e^(−2Nε), 1.8 dB through 1024 stages at 100 ppm, 35.6 dB through 4096 at 500 ppm.' },
  { id: 'filter', label: 'Filter corner', min: 2e3, max: 20e3, def: 8e3, log: true, unit: 'kHz', scale: 1e-3, decimals: 1,
    hint: 'The corner of the two third-order Butterworth filters, before the chip (against aliasing) and after it (against the clock\'s steps). Below half the clock they keep the folded frequencies down; opened up past it, a low clock\'s aliases come through, the metallic gargle of a cheap delay.' },
];

export const GROUPS = [
  { name: 'The pedal', params: pedal },
  { name: 'The chip', params: chip },
];

const stock = { clock: 100e3, rate: 0.8, depth: 0.15, feedback: 0, mix: 0.5, level: 3.7, stages: '1024', cti: 1e-4, filter: 8e3 };
export const PRESETS = {
  'Chorus': { ...stock },
  'Vibrato': { ...stock, mix: 1, rate: 5, depth: 0.2, level: 0 },
  'Flanger': { ...stock, clock: 150e3, stages: '512', rate: 0.15, depth: 0.45, feedback: 0.7, level: 4.6 },
  'Negative flanger': { ...stock, clock: 150e3, stages: '512', rate: 0.15, depth: 0.45, feedback: -0.7, level: 1.4 },
  'Slapback': { ...stock, stages: '4096', clock: 30e3, depth: 0, mix: 0.4, filter: 6e3, level: 3 },
  'Dark echoes': { ...stock, stages: '4096', clock: 12e3, depth: 0.02, rate: 0.5, feedback: 0.55, mix: 0.4, filter: 4e3, level: 1.7 },
  'Aliasing': { ...stock, stages: '4096', clock: 8e3, depth: 0, feedback: 0.3, mix: 0.5, filter: 20e3, level: 2.9 },
  'Leaky chain': { ...stock, stages: '4096', clock: 40e3, cti: 5e-4, depth: 0.05, level: 3.3 },
};
export const KEEP = [];
