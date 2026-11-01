// board-jacks.js — how the Pedalboard wires its pedals to each other: what drives each pedal's
// input jack, and what its output jack drives. Pure functions, run in the board's AudioWorklet
// (board-chain.js) and the tests.
//
// A pedal whose circuit includes its input jack (the Buffer, the Phuzz, the Tube Preamp, the Wah
// plugged in backwards: the ones with the bass's pickup among their parameters) is driven by whatever comes before it:
// the bass itself, through the cable and any bypassed pedals' cables, if it is the first pedal
// engaged; otherwise the pedal before it, as a source of a few hundred ohms (a buffered output, or
// the voltage a circuit pedal has already worked out at this jack). A pedal whose circuit includes
// its output jack (the Phuzz, the Tube Preamp, the Wah plugged in backwards: the ones with a cable
// to the amp and an amp's input) drives the next pedal's input impedance through the patch cable,
// or the amp's through the cable to it. Bypassed pedals are true bypass, a wire between their
// jacks: their cables add up and the pedals either side see each other.

// the bass, as the board's Controls set it: every pedal that models the pickup takes these
export const BASS = ['active', 'pickupL', 'pickupR', 'pickupC', 'pots', 'activeR', 'recCable', 'recLoad', 'cablePF'];
// what the board sets from the wiring, in the pedals that have them
export const SOURCE = ['active', 'activeR', 'cable'];
export const LOAD = ['outCable', 'load'];
// a source of a few hundred ohms: an op amp's or a transistor's buffered output (the least the
// pedals' Preamp output resistance goes to)
export const BUFFERED_OUT = 100;

// Each pedal's input impedance, as the pedal before it sees it (Ω), from its circuit (its README).
// The models that drive a load take it as a resistance, from 10 kΩ up (their Amp's input knob).
export const INPUT = {
  buffer: (P) => P.load,           // the Buffer is a cable into an input of this impedance
  // the Phuzz's is below 10 kΩ across the bass's range, lowest at the bottom, where its feedback
  // works on the input too (test/board-tests.mjs finds it from what it takes off the pickup):
  // held at 10 kΩ, the least a load goes to
  phuzz: () => 10e3,
  // R1, 68 kΩ; plugged in backwards, the jack is Q1's collector, which loads it harder: held at 10 kΩ
  wah: (P) => (P.reversed ? 10e3 : 68e3),
  preamp: () => 1e6,               // the first triode's 1 MΩ grid leak
};
export const STANDARD_INPUT = 1e6; // the rest: a buffered input of 1 MΩ, a pedal's usual

// Whether a pedal's circuit includes its input jack and its output jack, as it is set: the ones
// with the pickup among their parameters, and the ones with a load; the Wah only plugged in
// backwards (the right way round, it takes the signal as recorded and drives an ideal input).
const SPECIAL = { wah: (P) => ({ input: !!P.reversed, output: !!P.reversed }) };
export function jacks(D, P) {
  if (SPECIAL[D.id]) return SPECIAL[D.id](P);
  return { input: has(D, 'active'), output: has(D, 'outCable') };
}

const has = (D, id) => D.groups.some((g) => g.params.some((p) => p.id === id));
const range = (D, id) => D.groups.flatMap((g) => g.params).find((p) => p.id === id);
const clampTo = (D, id, v) => { const p = range(D, id); return p ? Math.min(p.max, Math.max(p.min, v)) : v; };
export const inputImpedance = (id, P) => (INPUT[id] ? INPUT[id](P) : STANDARD_INPUT);

// slots: [{ id, P, bypass }] in signal order; B: the board's parameters (BASS, cable: from the bass
// to the board, patch: each patch cable, ampCable, ampLoad); D: id → descriptor.
// Returns each slot's parameters as the pedal plays them, and where each jack's signal comes from.
export function wire(slots, B, D) {
  const on = slots.map((s) => !s.bypass);
  return slots.map((s, i) => {
    const d = D[s.id], P = { ...s.P };
    for (const id of BASS) if (has(d, id)) P[id] = B[id];
    // what drives the input: the nearest engaged pedal before, or the bass, through every cable on
    // the way (each bypassed pedal's patch cable as well)
    let j = i - 1, cable = B.patch;
    while (j >= 0 && !on[j]) { cable += B.patch; j--; }
    const fromBass = j < 0;
    if (fromBass) cable += B.cable - B.patch;
    if (has(d, 'active') && !fromBass) { P.active = true; P.activeR = clampTo(d, 'activeR', BUFFERED_OUT); }
    if (has(d, 'cable') && has(d, 'active')) P.cable = clampTo(d, 'cable', cable);
    // what the output drives: the nearest engaged pedal after, or the amp
    let k = i + 1, out = B.patch;
    while (k < slots.length && !on[k]) { out += B.patch; k++; }
    const toAmp = k >= slots.length;
    if (toAmp) out += B.ampCable - B.patch;
    if (has(d, 'outCable')) {
      P.outCable = clampTo(d, 'outCable', out);
      P.load = clampTo(d, 'load', toAmp ? B.ampLoad : inputImpedance(slots[k].id, slots[k].P));
    }
    return { P, from: fromBass ? 'bass' : j, to: toAmp ? 'amp' : k, cableIn: cable, cableOut: out };
  });
}
