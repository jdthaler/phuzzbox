// neon-tour.js — the guided tour of the Neon Tremolo's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('neon', [
  {
    title: 'A lamp that flashes',
    views: ['The lamp', 'Scope'],
    preset: 'Neon pulse',
    bypass: true,
    play: [note('A1', { dur: 2.4, vel: 0.8 }), { at: 2.5, bypass: false }, note('A1', { at: 2.6, dur: 3.5, vel: 0.8 }), riff({ at: 6.2 })],
    text: `First the A string alone, then through the lamp. The capacitor charges through the 4.7 MΩ Rate resistor toward the 180 V supply. At 143 V the neon breaks down, the lamp flashes, and in 2.8 ms it dumps the capacitor down to where the glow goes out, just above 110 V; then the capacitor charges again. In **The lamp** the white line is that sawtooth, about 3.4 flashes a second.

Each flash lights a cadmium-sulphide cell that pulls the bass to ground through the Depth pot: the orange line drops at once and swells back as the cell goes dark. In the **Scope**, every note is chopped by the flashes.

![The Neon Tremolo: a neon lamp flashing across a capacitor, lighting the photocell of a divider](schematics/tremolo.svg)`,
  },
  {
    title: 'Paschen\'s law',
    views: ['Paschen\'s curve', 'The lamp'],
    preset: 'Neon pulse',
    play: [sweep('pd', 3, 2, { at: 0.2, dur: 4, log: true }), sweep('pd', 2, 4.4, { at: 5, dur: 6, log: true }), riff({ times: 2 })],
    text: `A gas insulates until an electron leaving the cathode can start an avalanche big enough that its ions, landing on the cathode, knock out another electron to replace it: γ (e^(αd) − 1) = 1. With Townsend's α = A p e^(−B p/E), that gives the striking voltage

  Vb = B pd / ln(A pd / ln(1 + 1/γ)),

which depends on the pressure and the gap only through their product. Now pd falls from 3 to 2 Torr·cm, and the strike from 143 V to 118 V: the capacitor has less far to climb, and the flashes come faster. Then it rises past 4: up the right side of the curve, more gas to push through, and the strike climbs toward the supply until the lamp barely fires at all.`,
  },
  {
    title: 'Why it flashes and doesn\'t glow',
    views: ['The lamp', 'Paschen\'s curve'],
    preset: 'Steady glow: R too small',
    play: [riff(), sweep('rate', 1e6, 4.7e6, { at: 5, dur: 3, log: true }), riff({ at: 5 })],
    text: `Lit, the lamp burns from its cathode fall, the thin layer of ions in front of the cathode that carries its voltage. The layer sets its own thickness at the least voltage that keeps it going, 3 (B/A) ln(1 + 1/γ): 110 V, below the 143 V it took to strike. That gap is the flash: struck at 143 V, it can run the capacitor down to 110 V before it goes out.

It goes out only if the current falls below 50 µA. With R at 1 MΩ the supply alone pushes (180 − 110) V through it, more than that, so the lamp never goes out: the glow holds, the cell stays lit, and the bass is held down with no tremolo. Below about 1.4 MΩ it is always so. Halfway R climbs back to 4.7 MΩ and the flashing returns.`,
  },
  {
    title: 'The supply',
    views: ['The lamp', 'Paschen\'s curve'],
    preset: 'Below the strike: dark',
    play: [riff(), sweep('supply', 130, 300, { at: 4.5, dur: 7 }), riff({ at: 4.5, times: 2 })],
    text: `At 130 V the supply is below the lamp's 143 V: the capacitor charges toward it and stops short, the lamp never fires, and the bass passes untouched. As the supply climbs past the strike, the lamp starts, slowly, and quickens as it rises: 150 V flashes about 1.25 times a second, 300 V 10.9 times. The time to charge is

  T = R C ln((Vs − Ve)/(Vs − Vb)),

and the closer Vs sits to Vb, the longer the last stretch of the climb takes. Push it too far and the supply holds the glow on: at 400 V it needs more than 5.8 MΩ to flash.`,
  },
  {
    title: 'The cell lets go slowly',
    views: ['Scope', 'The lamp'],
    preset: 'Sharp chop (quick cell)',
    play: [riff(), { at: 5, set: { cell: 120e-3, cap: 220e-9 } }, riff({ at: 5 })],
    text: `The flash lasts a few milliseconds; the cell takes it in at once, its freed electrons piling up, and lets it go as they find each other and recombine. With their lifetime at 8 ms the bass swells halfway back in 12 ms, a short bite at each flash. Halfway the lifetime goes to 120 ms and the capacitor to 220 nF, a longer, brighter flash: halfway back in 107 ms, and the dips run together into a slow throb.`,
  },
  {
    title: 'Other gases',
    views: ['Paschen\'s curve', 'The lamp'],
    preset: 'Helium lamp',
    play: [riff(), { at: 5, set: { gas: 'ar', pd: 2, supply: 250, level: 3 } }, riff({ at: 5 })],
    text: `Each gas has its own Townsend constants, and so its own curve. Helium's electrons ionise most easily at low fields: at the stock 3 Torr·cm it would strike at 56 V and burn from 50 V, so the preset widens pd to 10 to give the flashes some height. Halfway, argon at 2 Torr·cm on a 250 V supply. Real indicator lamps are neon with a trace of argon: a neon atom left in a long-lived excited state ionises the argon (the Penning effect), and the lamp strikes far lower than either gas alone.`,
  },
]);
