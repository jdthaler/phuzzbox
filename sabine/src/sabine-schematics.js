// sabine-schematics.js — Sabine's Room's plan (shared/schematic.js), written to sabine/schematics/ by
// tools/gen-schematics.mjs: the room seen from above, the bass near one end and you along it, the
// direct path, and one reflection off a side wall, which seems to come from the bass's image beyond it.
import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  room() {
    const s = schematic({ w: 32, h: 21, title: 'Sabine\'s Room seen from above: the bass near one end and you along the room, the direct path, and a reflection off a side wall, which seems to come from the bass\'s image beyond the wall' });
    const x0 = 2, x1 = 30, y0 = 2, y1 = 11.5, src = [7.6, 7.5], you = [20, 4.6];
    // the walls
    s.wire([x0, y0], [x1, y0]); s.wire([x1, y0], [x1, y1]); s.wire([x1, y1], [x0, y1]); s.wire([x0, y1], [x0, y0]);
    for (let x = x0 + 0.6; x < x1; x += 1.2) s.wire([x, y1], [x - 0.5, y1 + 0.5]);
    s.label([16, 1.2], 'L long, W wide, H high: every surface absorbing α of what strikes it', { size: 11 });
    // the bass, you, and the image beyond the near wall (y = y1)
    const image = [src[0], 2 * y1 - src[1]];
    s.block([src[0] - 0.7, src[1] - 0.7], 1.4, 1.4, { accent: true });
    s.label([src[0] - 1.1, src[1] + 0.35], 'the bass', { anchor: 'end', colour: 'accent', size: 11 });
    s.dot(you);
    s.label([you[0] + 0.9, you[1] + 0.35], 'you', { anchor: 'start', colour: 'ink', size: 11 });
    s.block([image[0] - 0.7, image[1] - 0.7], 1.4, 1.4, { colour: 'ink2', dash: '4 4' });
    s.label([image[0] - 1.1, image[1] + 0.35], 'its image', { anchor: 'end', size: 11 });
    // the paths
    const t = (image[1] - y1) / (image[1] - you[1]), hit = [image[0] + t * (you[0] - image[0]), y1];
    s.arrow([src[0] + 0.8, src[1] - 0.25], [you[0] - 0.4, you[1] + 0.1], { colour: 'accent' });
    s.label([12.2, 4.9], 'd, the direct sound', { colour: 'accent', size: 11 });
    s.arrow([src[0] + 0.7, src[1] + 0.5], hit, { colour: 'accent2' });
    s.arrow(hit, [you[0] - 0.3, you[1] + 0.4], { colour: 'accent2' });
    s.arrow([image[0] + 0.7, image[1] - 0.4], hit, { dash: '5 4' });
    s.label([22.5, 9.6], 'a reflection: √(1 − α) of it', { colour: 'accent2', size: 11 });
    s.label([16, 17.4], 'an image for every sequence of bounces, its path r, its strength (√(1 − α))ⁿ/r', { size: 11 });
    s.label([16, 19.4], 'after the first 64, the diffuse field: T60 = 55.3 V/(c A)', { size: 11 });
    return s.svg();
  },
};
