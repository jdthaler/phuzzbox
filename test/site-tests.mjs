// site-tests.mjs — the registry, the pages and the READMEs agree.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, done } from './harness.mjs';
import { PEDALS, SECTIONS } from '../shared/registry.js';
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

// the installable app: a manifest whose icons exist, a service worker at the root, every page linked
{
  const m = JSON.parse(readFileSync(`${root}manifest.webmanifest`, 'utf8'));
  const sizes = m.icons.filter((i) => i.type === 'image/png').map((i) => i.sizes);
  check(m.display === 'standalone' && m.start_url && sizes.includes('192x192') && sizes.includes('512x512') && m.icons.every((i) => existsSync(`${root}${i.src}`)),
    'the app manifest is standalone with 192 and 512 px icons that exist');
  const pages = ['index.html', ...ready.map((p) => `${p.id}/index.html`)];
  check(existsSync(`${root}sw.js`) && pages.every((f) => /rel="manifest"/.test(readFileSync(`${root}${f}`, 'utf8'))), 'every page links the manifest, and the service worker sits at the root', pages.join(', '));
  const sw = readFileSync(`${root}sw.js`, 'utf8');
  check(ready.every((p) => sw.includes(`'./${p.id}/'`)), 'the service worker keeps every ready pedal\'s page');
}
// GitHub only in the credits (Jesse, 2026-11-01): the site's code names the repository once, as
// registry.js's SOURCE, and the notes never link a reader to it for information
{
  const { readdirSync } = await import('node:fs');
  const files = ['index.html', 'landing.js', 'landing.css', 'sw.js', ...readdirSync(`${root}shared`).filter((f) => /\.(js|css)$/.test(f)).map((f) => `shared/${f}`),
    ...ready.flatMap((p) => [`${p.id}/index.html`, ...readdirSync(`${root}${p.id}/src`).filter((f) => f.endsWith('.js')).map((f) => `${p.id}/src/${f}`)])];
  const hits = files.flatMap((f) => readFileSync(`${root}${f}`, 'utf8').split('\n').map((l, i) => [f, i + 1, l]))
    .filter(([, , l]) => /https?:\/\/(www\.)?github\.com/.test(l) && !/^\/\//.test(l.trim()));
  const ok = hits.length === 1 && hits[0][0] === 'shared/registry.js' && /SOURCE = 'https:\/\/github\.com\/jdthaler\/phuzzbox'/.test(hits[0][2]);
  check(ok, 'GitHub: the site links it only from the credits (registry.js SOURCE)', hits.map(([f, n]) => `${f}:${n}`).join(', '));
  const notes = readFileSync(`${root}shared/notes.js`, 'utf8');
  check(/function siteLinks/.test(notes) && /github\\?\.com/.test(notes), 'GitHub: the notes turn links to the repository into plain text');
}

// the pedals by their physics: every pedal in one section, every section with a pedal, and the one
// menu (shared/nav.js) and the landing page (shared/face.js) drawn from them
{
  const ids = new Set(SECTIONS.map((x) => x.id));
  check(PEDALS.every((p) => ids.has(p.section)), 'every pedal belongs to a section of physics', PEDALS.filter((p) => !ids.has(p.section)).map((p) => p.id).join());
  check(SECTIONS.every((x) => ready.some((p) => p.section === x.id) && x.title && x.short && x.blurb), 'every section has a title, a blurb and a ready pedal');
  check(ready.every((p) => Array.isArray(p.enclosure) && p.enclosure.every((c) => /^#[0-9a-f]{6}$/.test(c))), 'every ready pedal has its enclosure\'s colours');
  // a stand-in for the DOM: elements as plain objects
  const h = (tag, attrs = {}, ...kids) => { const e = { tag, attrs, kids: kids.flat().filter((k) => k != null), style: { setProperty() {} } }; e.append = (...k) => e.kids.push(...k); return e; };
  const walk = (e, fn) => { if (e && typeof e === 'object') { fn(e); for (const k of e.kids ?? []) walk(k, fn); } };
  globalThis.addEventListener ??= () => {};
  const { navMenu } = await import('../shared/nav.js');
  const menu = navMenu({ h, here: 'phuzz', title: 'Phuzz' });
  const links = [], secs = [];
  walk(menu, (e) => { if (e.tag === 'a' && e.attrs.href && !/^https?:/.test(e.attrs.href)) links.push(e.attrs.href); if (e.attrs?.class === 'menu-sec') secs.push(e.kids[0]); });
  const want = ['../', ...SECTIONS.flatMap((x) => ready.filter((p) => p.section === x.id).map((p) => `../${p.id}/`)), '../board/'];
  check(JSON.stringify(links) === JSON.stringify(want), 'the menu opens on the landing page, then every pedal by its physics, then the Pedalboard', links.join(' '));
  check(JSON.stringify(secs) === JSON.stringify([...SECTIONS.map((x) => x.title), 'The rig']), 'the menu heads each group with its physics', secs.join(', '));
  let current = 0;
  walk(menu, (e) => { if (e.attrs?.['aria-current'] === 'page') current++; });
  check(current === 1, 'the menu marks the pedal you are on');
  const { miniFace } = await import('../shared/face.js');
  for (const p of ready) {
    const { PEDAL } = await import(`${root}${p.id}/src/${p.id}-pedal.js`);
    const face = miniFace({ h, D: PEDAL, enclosure: p.enclosure });
    let knobs = 0, name = '', foot = 0;
    walk(face, (e) => {
      if (/^(knob|dial)\b/.test(e.attrs?.class ?? '')) knobs++;
      if (e.attrs?.class === 'name') name = e.kids[0]?.kids?.[0] ?? '';
      if (e.attrs?.class === 'footswitch') foot++;
    });
    check(knobs === 0 && name === p.name && foot === 1, `${p.name}: the landing page draws its face small, its name and footswitch without its knobs`, `${knobs} knobs, name ${name}, ${foot} footswitch`);
  }
}
// a rocker pedal on the face (shared/treadle.js): heel down at 0, level halfway, toe down at 1
// (a positive SVG rotation is clockwise, so the toe, on the right, goes down), only for a
// continuous control a foot rocks; the Wah's Rocker, the one its expression pedal moves, is one
{
  const { tiltOf } = await import('../shared/treadle.js');
  check(tiltOf(0) < 0 && Math.abs(tiltOf(0.5)) < 1e-12 && tiltOf(1) === -tiltOf(0) && tiltOf(0.25) < tiltOf(0.75) && tiltOf(2) === tiltOf(1),
    'the treadle rocks from heel down to toe down, level halfway', `${tiltOf(0)}° to ${tiltOf(1)}°`);
  const treadles = [];
  for (const p of ready) {
    const { PEDAL } = await import(`${root}${p.id}/src/${p.id}-pedal.js`);
    for (const q of params(PEDAL.groups).filter((x) => x.face === 'treadle')) treadles.push([p.id, q]);
  }
  check(treadles.every(([, q]) => q.perform && !q.type && !q.log), 'a treadle only draws a continuous perform control', treadles.map(([id, q]) => `${id}.${q.id}`).join(' '));
  const { PEDAL: WAH } = await import('../wah/src/wah-pedal.js');
  check(treadles.some(([id, q]) => id === 'wah' && q.id === WAH.expression), 'the Wah\'s rocker, the one its expression pedal moves, is drawn as a rocker pedal');
}
// the audio carries over from page to page: the input, its channel, the output, and whether it was on
{
  const shell = readFileSync(`${root}shared/shell.js`, 'utf8');
  check(['phuzzbox.input', 'phuzzbox.channel', 'phuzzbox.sink'].every((k) => shell.includes(`'${k}'`)) && /session\.set\('audio', true\)/.test(shell) && /if \(session\.get\('audio', false\)\) resumeAudio\(\)/.test(shell),
    'a pedal opened from the menu keeps the input, channel and output, and starts if the last one was on');
}

done();
