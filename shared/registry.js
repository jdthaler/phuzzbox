// registry.js — every pedal: the landing page, the menus and the tests read this list.
//   id: the folder; name; version (semver, bumped only at a release: CLAUDE.md);
//   ready: playable; blurb: one line for the landing page; after: what it is modelled on;
//   plugin: { code } the AU subtype (four characters, unique)

export const PHUZZBOX_VERSION = '0.1.0';

export const PEDALS = [
  {
    id: 'buffer', name: 'Buffer', version: '0.1.0', ready: true, plugin: { code: 'Bufr' },
    after: 'the cable and the input your bass plugs into',
    blurb: 'Your pickup is an inductor: hear its resonance move as the cable gets longer and the input it drives gets hungrier.',
  },
  { id: 'phuzz', name: 'Phuzz', ready: false, after: 'two-transistor germanium fuzz (1966)', blurb: 'Ebers–Moll transistors that drift with temperature, a sagging battery, and an input that loads your pickup.' },
  { id: 'preamp', name: 'Tube Preamp', ready: false, after: 'all-tube bass amp', blurb: 'Triodes with grid conduction, a passive tone stack, and an output transformer that saturates at the bottom first.' },
  { id: 'opto', name: 'Opto Compressor', ready: false, after: 'electro-optical leveler', blurb: 'A glowing panel and a photocell with memory: the longer it is lit, the slower it lets go.' },
  { id: 'cabinet', name: 'Cabinet', ready: false, after: '8×10 and 1×15 bass cabinets', blurb: 'A loudspeaker from its Thiele–Small parameters in a sealed or ported box, its cone running out of travel on low B.' },
];

export const byId = (id) => PEDALS.find((p) => p.id === id);
