// schematics-tests.mjs — the circuit diagrams: each pedal's SVGs are what its
// <slug>-schematics.js draws (tools/gen-schematics.mjs), every figure a README or a tour shows
// exists, and the Markdown renderer turns a figure into an image on the site, never elsewhere.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, done } from './harness.mjs';
import { diagrams } from '../tools/gen-schematics.mjs';
import { renderMarkdown } from '../shared/markdown.js';
import { schematic } from '../shared/schematic.js';
import { PEDALS } from '../shared/registry.js';

const root = fileURLToPath(new URL('../', import.meta.url));

// the drawing: well-formed SVG with its title, and parts that must lie on a grid line refuse not to
{
  const s = schematic({ w: 10, h: 6, title: 'A & B' });
  s.terminal([1, 2], 'in').resistor([1, 2], [5, 2], { label: 'R1', value: '47 kΩ' }).capacitor([5, 2], [5, 5], '10 nF').ground([5, 5]);
  const svg = s.svg();
  check(/^<svg [^>]*viewBox="0 0 200 120"/.test(svg) && svg.includes('<title>A &amp; B</title>') && svg.trim().endsWith('</svg>') && !/NaN|undefined/.test(svg), 'a drawing is a whole SVG, its title escaped, no NaN in it');
  let threw = false;
  try { schematic({ w: 4, h: 4 }).resistor([0, 0], [2, 1]); } catch { threw = true; }
  check(threw, 'a part off a grid line is refused');
}

// each pedal's diagrams are up to date
const all = await diagrams();
const stale = all.filter(([, , path, svg]) => !existsSync(`${root}${path}`) || readFileSync(`${root}${path}`, 'utf8') !== svg).map(([, , p]) => p);
check(!stale.length, `every diagram is what its pedal draws (${all.length})`, stale.length ? `stale: ${stale.join(', ')}; run node tools/gen-schematics.mjs` : '');

// every figure a README or a tour names exists
{
  const missing = [];
  const figures = (md) => [...md.matchAll(/^ {0,3}!\[[^\]]*\]\(\s*<?([^()\s<>]+)>?\s*\)\s*$/gm)].map((m) => m[1]);
  for (const p of PEDALS.filter((q) => q.ready)) {
    const dir = `${root}${p.id}/`;
    for (const f of figures(readFileSync(`${dir}README.md`, 'utf8'))) if (!/^https?:/.test(f) && !existsSync(dir + f)) missing.push(`${p.id}/README.md → ${f}`);
    const tour = `${dir}src/${p.id}-tour.js`;
    if (existsSync(tour)) for (const f of figures(readFileSync(tour, 'utf8').replace(/\\n/g, '\n'))) if (!existsSync(dir + f)) missing.push(`${p.id} tour → ${f}`);
  }
  check(!missing.length, 'every figure a README or a tour shows exists', missing.join(', '));
}

// the renderer: a figure alone in its paragraph, resolved against the site, captioned
{
  const { html } = renderMarkdown('Text.\n\n![The **cell**: 2 kΩ lit](schematics/cell.svg)\n\nInline ![not](x.svg) here.\n', { base: 'https://github.com/a/b/blob/main/opto/', assets: 'https://phuzzbox.jthaler.net/opto/' });
  check(html.includes('<figure class="pz-figure"><img src="https://phuzzbox.jthaler.net/opto/schematics/cell.svg" alt="The cell: 2 kΩ lit"') && html.includes('<figcaption>The <strong>cell</strong>: 2 kΩ lit</figcaption>'), 'a figure is an image from the site, captioned by its alt text');
  check(!html.includes('x.svg"') || !html.includes('<img src="https://phuzzbox.jthaler.net/opto/x.svg"'), 'an image inside a paragraph is not a figure');
  const bad = renderMarkdown('![x](data:image/svg+xml,AAAA)\n', { assets: 'https://a.example/' }).html;
  check(!bad.includes('<img'), 'only http(s) images: no data: or script URLs');
  const fallback = renderMarkdown('![y](s.svg)\n', { base: 'https://b.example/d/' }).html;
  check(fallback.includes('src="https://b.example/d/s.svg"'), 'without assets, figures resolve against base');
}

done();
