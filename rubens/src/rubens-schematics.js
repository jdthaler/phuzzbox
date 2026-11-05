// rubens-schematics.js — Rubens' Tube's set-up (shared/schematic.js), written to rubens/schematics/
// by tools/gen-schematics.mjs: the bass into an amplifier, the speaker closing one end of the pipe,
// the cap and its microphone at the other, the holes along the top, and the standing wave inside.
import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  tube() {
    const s = schematic({ w: 34, h: 15, title: 'Rubens\' Tube: the bass into an amplifier, the amplifier into a speaker closing one end of a pipe of propane, a cap and a microphone at the other end, holes along the top with flames, and the standing wave inside' });
    const y0 = 7, y1 = 10.5, l = 8, r = 31;
    s.terminal([2.6, 8.75], 'bass');
    const a = s.amp([3.2, 8.75], { label: 'Drive', length: 2.2 });
    s.wire(a.out, [l - 1.2, 8.75]);
    // the speaker: a magnet and a cone closing the pipe
    s.block([l - 1.8, 7.9], 0.8, 1.7, { colour: 'ink2' });
    s.wire([l - 1, 7.9], [l, y0]); s.wire([l - 1, 9.6], [l, y1]); s.wire([l, y0], [l, y1]);
    s.label([l - 1.2, 12.6], 'the speaker: Re, Bl, Mms, Cms', { size: 11 });
    // the pipe and the cap
    s.wire([l, y0], [r, y0]); s.wire([l, y1], [r, y1]); s.wire([r, y0], [r, y1]);
    s.label([(l + r) / 2, 12.6], 'L long, radius a, full of propane: modes n c/2L', { size: 11 });
    s.dot([r - 0.3, 8.75]);
    s.label([r + 0.6, 8.6], 'mic', { anchor: 'start', size: 11 });
    // the standing wave (the third mode): |cos(3π x/L)|
    const pts = [];
    for (let k = 0; k <= 60; k++) { const t = k / 60; pts.push([l + (r - l) * t, y1 - 0.25 - 2.9 * Math.abs(Math.cos(3 * Math.PI * t))]); }
    s.wire(...pts);
    // the holes and the flames, shortest over the antinodes
    for (let k = 0; k < 22; k++) {
      const t = (k + 0.5) / 22, x = l + (r - l) * t, hgt = 0.8 + 2.2 * (1 - 0.75 * Math.abs(Math.cos(3 * Math.PI * t)));
      s.arrow([x, y0], [x, y0 - hgt], { colour: 'accent' });
    }
    s.label([(l + r) / 2, 1.3], 'flames over the holes: tallest at the pressure nodes', { colour: 'accent', size: 11 });
    return s.svg();
  },
};
