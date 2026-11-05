// michelson-params.js — the Michelson Interferometer's controls. Values in SI units; `scale` shows
// them in friendlier ones.

// the light, in the order of native/pedals/michelson/michelson-model.cpp's table
export const SOURCES = [
  ['hene', 'HeNe laser, 633 nm'], ['green', 'Green laser, 532 nm'], ['violet', 'Violet laser, 405 nm'],
  ['sodium', 'Sodium lamp, 589 nm'], ['white', 'White LED'],
];

const pedal = [
  { id: 'stroke', label: 'Stroke', min: 20e-9, max: 4e-6, def: 400e-9, log: true, unit: 'nm/V', scale: 1e9, decimals: 0, perform: true,
    hint: 'How far the mirror moves for each volt of your bass. The light\'s path changes by twice that, and every half wavelength of travel takes the detector from bright through dark and back: at 400 nm/V a note peaking at 0.5 V swings the red laser\'s paths by 0.63 of a wavelength each way, folding the wave over several times. Turned down, the drive is gentle and nearly linear; turned up, the folds come thick and the highs ring.' },
  { id: 'fringe', label: 'Fringe', min: 0, max: 360, def: 90, unit: '°', decimals: 0, perform: true,
    hint: 'Where on a fringe the mirror rests, as the phase between the two paths (a small steady voltage on the actuator). At 90° or 270° the detector sits on a fringe\'s steep side: a quiet note comes through nearly unchanged, and the folds add odd harmonics. At 0° (bright) or 180° (dark) it sits on a crest, so the mirror moving either way does the same: the note comes out an octave up, in even harmonics only.' },
  { id: 'level', label: 'Level', min: -30, max: 12, def: 0, unit: 'dB', decimals: 1, perform: true,
    hint: 'The output, after the detector\'s amplifier. From dark to bright the detector gives 1 V, so however hard you play the output stays within a volt from its lowest to its highest.' },
  { id: 'light', label: 'Light', type: 'select', def: 'hene', options: SOURCES, perform: true,
    hint: 'The light. A shorter wavelength makes more fringes for the same stroke: violet folds 1.6 times as often as red. A laser\'s light stays in step with itself over millimetres to centimetres, so its fringes keep their contrast; the sodium lamp\'s two yellow lines, 0.6 nm apart, beat, so its fringes fade to a third at 145 µm of Arm difference and are back at 291 µm; a white LED\'s light is coherent over only a few micrometres, so its fringes appear only with the arms nearly equal, and a big stroke carries the mirror out of them and back.' },
];

const bench = [
  { id: 'arm', label: 'Arm difference', min: 0, max: 600e-6, def: 20e-6, unit: 'µm', scale: 1e6, decimals: 1,
    hint: 'How much longer one arm is than the other (the micrometer, to the nearest wavelength; the paths differ by twice this). With the red laser it hardly matters. With the violet diode the contrast falls by half at about 36 µm; with the sodium lamp it falls to a third at 145 µm and is back at 291 µm, as its two lines go out of step and in again; with the white LED there are strong fringes only within a micrometre of zero, and faint blue ones out to a few micrometres.' },
  { id: 'mount', label: 'Mirror mount', type: 'select', def: 'piezo', options: [['piezo', 'Piezo stack'], ['speaker', 'Loudspeaker cone']],
    hint: 'What moves the mirror. A piezo stack is stiff: its resonance is at 20 kHz, far above a bass, so the mirror follows the voltage. A mirror glued to a small loudspeaker\'s cone rides a soft suspension that resonates at 80 Hz: below that it follows; above, the cone\'s mass holds it back, 12 dB less travel for each octave up, so high notes fold less than low ones.' },
  { id: 'air', label: 'Air currents', min: 0, max: 200e-9, def: 10e-9, unit: 'nm', scale: 1e9, decimals: 0,
    hint: 'Warm air drifting through the arms changes their optical length by some nanometres, over half a second or so: the resting point wanders along the fringe, and the tone with it, as on an unshielded optical bench. 0 is a bench under a hood; at 80 nm the red laser\'s resting point wanders over a quarter of a fringe.' },
];

export const GROUPS = [
  { name: 'The pedal', params: pedal },
  { name: 'The bench', params: bench },
];

const stock = { stroke: 400e-9, fringe: 90, level: 0, light: 'hene', arm: 20e-6, mount: 'piezo', air: 10e-9 };
export const PRESETS = {
  'Red laser, mid-fringe': { ...stock },
  'Bright fringe: an octave up': { ...stock, fringe: 0, stroke: 150e-9 },
  'Dark fringe': { ...stock, fringe: 180, stroke: 150e-9 },
  'Deep folds': { ...stock, stroke: 2e-6 },
  'Green laser': { ...stock, light: 'green' },
  'Violet laser': { ...stock, light: 'violet' },
  'Sodium lamp, lines in step': { ...stock, light: 'sodium', arm: 0 },
  'Sodium lamp, lines out of step': { ...stock, light: 'sodium', arm: 145.4e-6 },
  'White light at zero path': { ...stock, light: 'white', arm: 0, stroke: 600e-9 },
  'White light, out and back': { ...stock, light: 'white', arm: 0, stroke: 4e-6 },
  'Loudspeaker mount': { ...stock, mount: 'speaker', stroke: 1e-6 },
  'Breezy lab': { ...stock, air: 80e-9 },
};
export const KEEP = [];
