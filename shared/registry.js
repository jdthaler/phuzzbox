// registry.js — every pedal: the landing page, the menus and the tests read this list.
//   id: the folder; name; version (semver, bumped only at a release: CLAUDE.md);
//   ready: playable; blurb: one line for the landing page; after: what it is modelled on;
//   plugin: { code } the AU subtype (four characters, unique);
//   enclosure: [its colour, the ink printed on it], as its page's style.css has them;
//   section: the physics it is made of (SECTIONS), which groups it on the landing page and in the
//   menu, in the order PEDALS lists them

export const PHUZZBOX_VERSION = '0.4.0';
// the site's credits link to the source; the only link to GitHub on the site (Jesse, 2026-11-01):
// everything a reader needs is on the site itself, in How it works
export const SOURCE = 'https://github.com/jdthaler/phuzzbox';

// the pedals by the physics they are made of: the landing page's sections and the menu's, in this order
export const SECTIONS = [
  { id: 'circuits', title: 'Circuits', short: 'Circuits',
    blurb: 'Kirchhoff\'s laws with real parts: a pickup\'s coil, germanium transistors, a wah\'s inductor, triodes, and the comparator and flip-flops of an octave divider, solved node by node every sample.' },
  { id: 'light', title: 'Light and photocells', short: 'Light',
    blurb: 'A light and a cadmium-sulphide cell: the signal lights a glowing panel or an LED, the cell\'s resistance follows the light, slowly, and remembers how long it was lit.' },
  { id: 'vibration', title: 'Vibrating steel, paper and air', short: 'Vibration',
    blurb: 'Waves in solids and in air: a loudspeaker\'s cone on its box of air, springs whose waves disperse into chirps, a steel plate\'s thousands of bending modes, and strings that ring in sympathy.' },
  { id: 'motion', title: 'Motion and delay', short: 'Motion',
    blurb: 'Sound that has to travel, from a source that moves: tape running past its heads, a horn spinning past a microphone, a car going by. As the delay changes, the pitch bends, heard at the retarded time.' },
  { id: 'gravity', title: 'Gravity', short: 'Gravity',
    blurb: 'Spacetime itself as the resonator: a black hole, struck by your bass, rings down in its quasinormal modes.' },
];

export const PEDALS = [
  {
    id: 'buffer', section: 'circuits', name: 'Buffer', version: '0.2.0', ready: true, plugin: { code: 'Bufr' }, enclosure: ['#5b6470', '#f5f3ef'],
    after: 'the cable and the input your bass plugs into',
    blurb: 'Your pickup is an inductor: hear its resonance move as the cable gets longer and the input it drives gets hungrier.',
  },
  {
    id: 'phuzz', section: 'circuits', name: 'Phuzz', version: '0.2.0', ready: true, plugin: { code: 'Phuz' }, enclosure: ['#8c2f1f', '#f7efe6'],
    after: 'two-transistor germanium fuzz (1966)',
    blurb: 'Ebers–Moll transistors that drift with temperature, a sagging battery, and an input that loads your pickup.',
  },
  {
    id: 'wah', section: 'circuits', name: 'Wah', version: '0.2.0', ready: true, plugin: { code: 'Wahh' }, enclosure: ['#2b2b2e', '#f2efe8'],
    after: 'the inductor wah of the late 1960s, swept low for bass',
    blurb: 'Two transistors and a coil resonating with a capacitor; your foot, or a MIDI expression pedal, turns the pot that sets how hard the loop pushes back.',
  },
  {
    id: 'preamp', section: 'circuits', name: 'Tube Preamp', version: '0.2.0', ready: true, plugin: { code: 'Tube' }, enclosure: ['#b08a55', '#2a1d10'],
    after: 'the 1959 Fender Bassman\'s preamp',
    blurb: 'Three 12AX7 triodes that conduct at the grid when pushed, a cathode follower, and the passive tone stack that scoops the middle.',
  },
  {
    id: 'opto', section: 'light', name: 'Opto Compressor', version: '0.1.0', ready: true, plugin: { code: 'Opto' }, enclosure: ['#8a9096', '#16181b'],
    after: 'the electro-optical leveling amplifiers of the 1960s',
    blurb: 'A glowing panel and a photocell with memory: the longer it is lit, the slower it lets go.',
  },
  {
    id: 'cabinet', section: 'vibration', name: 'Cabinet', version: '0.2.0', ready: true, plugin: { code: 'Cabn' }, enclosure: ['#232326', '#ece8e1'],
    after: '8×10 and 1×15 bass cabinets, and a guitar 4×12',
    blurb: 'A loudspeaker from its Thiele–Small parameters in a sealed or ported box, its cone running out of travel on low B.',
  },
  {
    id: 'envelope', section: 'light', name: 'Envelope Filter', version: '0.2.0', ready: true, plugin: { code: 'Envf' }, enclosure: ['#4b2f6e', '#f1e9fb'],
    after: 'the envelope-controlled filters of the 1970s',
    blurb: 'A resonant state-variable filter whose resistors are photocells, lit by an LED that follows how hard you play.',
  },
  {
    id: 'octave', section: 'circuits', name: 'Octave Down', version: '0.2.0', ready: true, plugin: { code: 'Octv' }, enclosure: ['#1f4d47', '#e6f4f1'],
    after: 'the analog octave dividers of the 1980s',
    blurb: 'A comparator and two flip-flops that flip your bass\'s polarity once a cycle: an octave below, and two.',
  },
  {
    id: 'spring', section: 'vibration', name: 'Spring Reverb', version: '0.2.0', ready: true, plugin: { code: 'Sprg' }, enclosure: ['#3a3f47', '#eef1f5'],
    after: 'the reverb tanks of guitar and organ amplifiers',
    blurb: 'Steel springs from measured tanks, whose waves travel slower the higher they are: every echo comes back as a chirp.',
  },
  {
    id: 'echo', section: 'motion', name: 'Tape Echo', version: '0.2.0', ready: true, plugin: { code: 'Tape' }, enclosure: ['#5a4632', '#f6eee2'],
    after: 'the multi-head tape echoes of the 1970s',
    blurb: 'A loop of tape past a record head and three playback heads: every repeat recorded again, darker and more saturated, wavering with the capstan.',
  },
  {
    id: 'rotary', section: 'motion', name: 'Rotary Speaker', version: '0.1.0', ready: true, plugin: { code: 'Rtry' }, enclosure: ['#6b3a1e', '#f4e7d6'],
    after: 'the rotating-horn organ speakers of the 1960s',
    blurb: 'A horn and a drum spinning past two microphones: the pitch rises as each comes toward you and falls as it goes, heard at the retarded time.',
  },
  {
    id: 'plate', section: 'vibration', name: 'Plate Reverb', version: '0.2.0', ready: true, plugin: { code: 'Plat' }, enclosure: ['#c9c6bd', '#1d1f22'],
    after: 'the steel plate reverbs of 1960s studios',
    blurb: 'A sheet of steel two metres long, shaken in the middle and heard near its ends: thousands of bending modes, the highs arriving first and dying soonest.',
  },
  {
    id: 'sympathetic', section: 'vibration', name: 'Sympathetic Strings', version: '0.1.0', ready: true, plugin: { code: 'Symp' }, enclosure: ['#7a5a1f', '#f7efdc'],
    after: 'the sitar\'s sympathetic strings',
    blurb: 'A frame of steel strings tuned to a key, all on one bridge your bass shakes: the strings whose partials your notes share ring along, a halo that follows the key.',
  },
  {
    id: 'blackhole', section: 'gravity', name: 'Black Hole', version: '0.2.0', ready: true, plugin: { code: 'BHol' }, enclosure: ['#0d0d12', '#f3d9a4'],
    after: 'the ringdown LIGO hears after a merger',
    blurb: 'Your bass perturbs a spinning black hole and it rings in its quasinormal modes: a thud without spin, a bell near the limit. Mass sets the pitch.',
  },
  {
    id: 'doppler', section: 'motion', name: 'Doppler', version: '0.1.0', ready: true, plugin: { code: 'Dopp' }, enclosure: ['#1f4e5f', '#e9f3f5'],
    after: 'a car, a train, a jet going by',
    blurb: 'Your bass rides past you on a straight road, again and again, heard at its retarded time: the pitch falls as it goes, and past Mach 1 it arrives as a boom, half of it backwards.',
  },
];

export const byId = (id) => PEDALS.find((p) => p.id === id);
