// lens-schematics.js — the Gravitational Lens's diagram (shared/schematic.js), which
// tools/gen-schematics.mjs writes to lens/schematics/ for its README and tour: the source, the lens
// and you, and the two rays of geometric optics (the default lens: 100 suns, half an Einstein
// radius off, test/lens-tests.mjs).
import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  paths() {
    const s = schematic({ w: 34, h: 15, title: 'The Gravitational Lens: two rays from the source bend round the mass to you, the first past the near side, the second past the far side, 1.99 ms later' });
    // the line through the lens, faint
    s.arrow([3.2, 8], [30.4, 8], { colour: 'ink2', dash: '2 5' });
    // the rays: the first past the source's side of the lens, the second past the far side
    s.arrow([2.2, 6.8], [17, 2.6], { colour: 'accent' });
    s.arrow([17, 2.6], [31.4, 7.6], { colour: 'accent' });
    s.arrow([2.2, 6.8], [17, 11.4], { colour: 'accent', dash: '6 4' });
    s.arrow([17, 11.4], [31.4, 8.4], { colour: 'accent', dash: '6 4' });
    s.dot([2, 6.8]);
    s.label([2, 5.6], 'source ✦');
    s.dot([17, 8]);
    s.label([17, 9.3], 'lens: M');
    s.dot([32, 8]);
    s.label([32, 9.6], 'you');
    s.label([17, 1.6], 'the first image: past the near side, brightened μ₊', { colour: 'accent' });
    s.label([17, 13.2], 'the second: past the far side, Δt later, μ₋, turned a quarter cycle', { colour: 'accent' });
    s.label([17, 14.4], 'waves take every path in between, and the longest go round the lens untouched', { size: 11 });
    return s.svg();
  },
};
