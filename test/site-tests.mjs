// site-tests.mjs — the registry, the pages and the READMEs agree.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, done } from './harness.mjs';
import { PEDALS } from '../shared/registry.js';
import { renderMarkdown } from '../shared/markdown.js';
import { params } from '../shared/params.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const ready = PEDALS.filter((p) => p.ready);
const codes = ready.map((p) => p.plugin?.code);
check(codes.every((c) => /^[A-Za-z0-9]{4}$/.test(c)) && new Set(codes).size === codes.length, 'every ready pedal has a unique four-character AU code');
check(new Set(PEDALS.map((p) => p.id)).size === PEDALS.length, 'pedal ids are unique');

for (const p of ready) {
  const files = ['index.html', 'style.css', 'README.md', `src/${p.id}-params.js`, `src/${p.id}-pedal.js`, `src/${p.id}-main.js`, `src/${p.id}-worklet.js`];
  const missing = files.filter((f) => !existsSync(`${root}${p.id}/${f}`));
  check(!missing.length, `${p.name}: has its page, descriptor, worklet and README`, missing.join(', '));
  check(/^\d+\.\d+\.\d+$/.test(p.version ?? ''), `${p.name}: has a version`);
  const readme = readFileSync(`${root}${p.id}/README.md`, 'utf8');
  check(/^## Prior art and references/m.test(readme), `${p.name}: its README credits prior art`);
  check(/^## What is simplified/m.test(readme), `${p.name}: its README says what is simplified`);
  let html = '';
  try { html = renderMarkdown(readme, { skip: ['Files'] }).html; } catch (e) { console.log(e.message); }
  check(html.length > 500 && !html.includes('Files</h2>'), `${p.name}: its README renders as the page's notes`);
  const { PEDAL } = await import(`${root}${p.id}/src/${p.id}-pedal.js`);
  const ps = params(PEDAL.groups);
  check(PEDAL.id === p.id && PEDAL.name === p.name, `${p.name}: the descriptor and the registry agree`);
  check(ps.every((q) => q.type || (q.unit !== undefined && q.min < q.max && q.def >= q.min && q.def <= q.max)), `${p.name}: every knob has a unit and a default inside its range`);
  check(ps.every((q) => q.hint), `${p.name}: every control explains itself`);
  const perform = ps.filter((q) => q.perform).length;
  check(perform >= 1 && perform <= 5, `${p.name}: one to five knobs on the pedal's face`, `${perform}`);
}
check(/^## Prior art and references/m.test(readFileSync(`${root}testbass/README.md`, 'utf8')), 'the test bass\'s README credits prior art');
done();
