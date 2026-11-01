// registry.js — every pedal: the landing page, the menus and the tests read this list.
//   id: the folder; name; version (semver, bumped only at a release: CLAUDE.md);
//   ready: playable; blurb: one line for the landing page; after: what it is modelled on;
//   plugin: { code } the AU subtype (four characters, unique)

export const PHUZZBOX_VERSION = '0.1.0';
// the site's credits link to the source; the only link to GitHub on the site (Jesse, 2026-11-01):
// everything a reader needs is on the site itself, in How it works
export const SOURCE = 'https://github.com/jdthaler/phuzzbox';

export const PEDALS = [
  {
    id: 'buffer', name: 'Buffer', version: '0.1.0', ready: true, plugin: { code: 'Bufr' },
    after: 'the cable and the input your bass plugs into',
    blurb: 'Your pickup is an inductor: hear its resonance move as the cable gets longer and the input it drives gets hungrier.',
  },
  {
    id: 'phuzz', name: 'Phuzz', version: '0.1.0', ready: true, plugin: { code: 'Phuz' },
    after: 'two-transistor germanium fuzz (1966)',
    blurb: 'Ebers–Moll transistors that drift with temperature, a sagging battery, and an input that loads your pickup.',
  },
  {
    id: 'wah', name: 'Wah', version: '0.1.0', ready: true, plugin: { code: 'Wahh' },
    after: 'the inductor wah of the late 1960s, swept low for bass',
    blurb: 'Two transistors and a coil resonating with a capacitor; your foot, or a MIDI expression pedal, turns the pot that sets how hard the loop pushes back.',
  },
  {
    id: 'preamp', name: 'Tube Preamp', version: '0.1.0', ready: true, plugin: { code: 'Tube' },
    after: 'the 1959 Fender Bassman\'s preamp',
    blurb: 'Three 12AX7 triodes that conduct at the grid when pushed, a cathode follower, and the passive tone stack that scoops the middle.',
  },
  {
    id: 'opto', name: 'Opto Compressor', version: '0.1.0', ready: true, plugin: { code: 'Opto' },
    after: 'the electro-optical leveling amplifiers of the 1960s',
    blurb: 'A glowing panel and a photocell with memory: the longer it is lit, the slower it lets go.',
  },
  {
    id: 'cabinet', name: 'Cabinet', version: '0.1.0', ready: true, plugin: { code: 'Cabn' },
    after: '8×10 and 1×15 bass cabinets',
    blurb: 'A loudspeaker from its Thiele–Small parameters in a sealed or ported box, its cone running out of travel on low B.',
  },
  {
    id: 'envelope', name: 'Envelope Filter', version: '0.1.0', ready: true, plugin: { code: 'Envf' },
    after: 'the envelope-controlled filters of the 1970s',
    blurb: 'A resonant state-variable filter whose resistors are photocells, lit by an LED that follows how hard you play.',
  },
  {
    id: 'octave', name: 'Octave Down', version: '0.1.0', ready: true, plugin: { code: 'Octv' },
    after: 'the analog octave dividers of the 1980s',
    blurb: 'A comparator and two flip-flops that flip your bass\'s polarity once a cycle: an octave below, and two.',
  },
  {
    id: 'spring', name: 'Spring Reverb', version: '0.1.0', ready: true, plugin: { code: 'Sprg' },
    after: 'the reverb tanks of guitar and organ amplifiers',
    blurb: 'Steel springs from measured tanks, whose waves travel slower the higher they are: every echo comes back as a chirp.',
  },
  {
    id: 'echo', name: 'Tape Echo', version: '0.1.0', ready: true, plugin: { code: 'Tape' },
    after: 'the multi-head tape echoes of the 1970s',
    blurb: 'A loop of tape past a record head and three playback heads: every repeat recorded again, darker and more saturated, wavering with the capstan.',
  },
  {
    id: 'rotary', name: 'Rotary Speaker', version: '0.1.0', ready: true, plugin: { code: 'Rtry' },
    after: 'the rotating-horn organ speakers of the 1960s',
    blurb: 'A horn and a drum spinning past two microphones: the pitch rises as each comes toward you and falls as it goes, heard at the retarded time.',
  },
  {
    id: 'plate', name: 'Plate Reverb', version: '0.1.0', ready: true, plugin: { code: 'Plat' },
    after: 'the steel plate reverbs of 1960s studios',
    blurb: 'A sheet of steel two metres long, shaken in the middle and heard near its ends: thousands of bending modes, the highs arriving first and dying soonest.',
  },
];

export const byId = (id) => PEDALS.find((p) => p.id === id);
