// gen-schematics.mjs — write each pedal's circuit diagrams, drawn in <slug>/src/<slug>-schematics.js
// (its export SCHEMATICS: { name: () => SVG text }, by shared/schematic.js), to
// <slug>/schematics/<name>.svg, where its README and tour show them as figures.
//   node tools/gen-schematics.mjs [slug…]     every pedal with diagrams if none named
//   node tools/gen-schematics.mjs --check     list the stale ones and exit 1 (test/schematics-tests.mjs)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PEDALS } from '../shared/registry.js';

const root = fileURLToPath(new URL('../', import.meta.url));

// every diagram as [slug, name, path, svg]
export async function diagrams(slugs = PEDALS.map((p) => p.id)) {
  const out = [];
  for (const slug of slugs) {
    const src = `${root}${slug}/src/${slug}-schematics.js`;
    if (!existsSync(src)) continue;
    const { SCHEMATICS } = await import(src);
    for (const [name, draw] of Object.entries(SCHEMATICS)) out.push([slug, name, `${slug}/schematics/${name}.svg`, draw()]);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), check = args.includes('--check'), slugs = args.filter((a) => !a.startsWith('--'));
  const all = await diagrams(slugs.length ? slugs : undefined);
  const stale = [];
  for (const [slug, , path, svg] of all) {
    const file = `${root}${path}`;
    const same = existsSync(file) && readFileSync(file, 'utf8') === svg;
    if (check) { if (!same) stale.push(path); continue; }
    if (same) continue;
    mkdirSync(`${root}${slug}/schematics`, { recursive: true });
    writeFileSync(file, svg);
    console.log(`wrote ${path}`);
  }
  if (check && stale.length) { console.log(`stale: ${stale.join(', ')} (run node tools/gen-schematics.mjs)`); process.exit(1); }
}
