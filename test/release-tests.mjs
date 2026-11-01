// release-tests.mjs — the versions and the release notes (tools/release.mjs, tools/contract.mjs,
// changes/README.md): the notes in changes/ parse, the versions agree, and the release's rules
// do what changes/README.md says, checked on made-up notes and contracts.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, done } from './harness.mjs';
import { PEDALS, PHUZZBOX_VERSION } from '../shared/registry.js';
import { parseNote, readNotes, bump, plan } from '../tools/release.mjs';
import { compare } from '../tools/contract.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const SEMVER = /^\d+\.\d+\.\d+$/;

// what is in the repository
let notes = [];
try { notes = readNotes(); check(true, `the notes in changes/ parse (${notes.length})`); } catch (e) { check(false, 'the notes in changes/ parse', e.message); }
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8'));
check(SEMVER.test(PHUZZBOX_VERSION) && pkg.version === PHUZZBOX_VERSION, `PhuzzBox's version is one in package.json and registry.js (${PHUZZBOX_VERSION})`);
const log = readFileSync(`${root}CHANGELOG.md`, 'utf8');
check(log.includes(`### PhuzzBox ${PHUZZBOX_VERSION}\n`), `CHANGELOG.md has PhuzzBox ${PHUZZBOX_VERSION}`);
for (const p of PEDALS.filter((q) => q.ready)) {
  check(SEMVER.test(p.version ?? '') && log.includes(`### ${p.name} ${p.version}\n`), `CHANGELOG.md has ${p.name} ${p.version}`);
  const cmake = readFileSync(`${root}native/pedals/${p.id}/${p.id}-info.cmake`, 'utf8');
  check(cmake.includes(`set(PHUZZ_VERSION ${p.version})`), `${p.name}: the plugins carry its version`);
}
// a release leaves no note behind that would release again, and no version twice
{
  const heads = [...log.matchAll(/^### (.+) (\d+\.\d+\.\d+)$/gm)].map((m) => `${m[1]} ${m[2]}`);
  check(new Set(heads).size === heads.length, 'CHANGELOG.md names each version once');
  if (notes.length) {
    let ok = true;
    try { plan(notes, '2000-01-01'); } catch (e) { ok = false; console.log(e.message); }
    check(ok, 'the notes in changes/ make a release');
  }
}

// the rules, on made-up notes
const P0 = PEDALS[0].name, P1 = PEDALS[1].name;
const note = (text) => { try { return parseNote('x.md', text); } catch (e) { return e.message; } };
check(SEMVER.test('1.2.3') && bump('0.3.4', 'patch') === '0.3.5' && bump('0.3.4', 'minor') === '0.4.0' && bump('0.3.4', 'major') === '1.0.0' && bump('0.1.0', 'new') === '0.1.0',
  'a patch bumps the last number, a minor the middle one and zeroes the last, a major the first; new keeps the first version');
check(typeof note(`# t\n\n### PhuzzBox (minor)\n- a\n\n### ${P0} (patch)\n- b`) === 'object', 'a note with PhuzzBox and a pedal parses');
check(/first line/.test(note('### PhuzzBox (minor)\n- a')), 'a note without its # topic line is refused');
check(/neither PhuzzBox/.test(note('# t\n### Nobody (minor)\n- a')), 'a note naming no pedal is refused');
check(/the kind is/.test(note('# t\n### PhuzzBox (huge)\n- a')), 'a kind other than patch, minor, major or new is refused');
check(/twice/.test(note(`# t\n### ${P0} (minor)\n- a\n### ${P0} (patch)\n- b`)), 'a pedal named twice in a note is refused');
check(/says nothing/.test(note('# t\n### PhuzzBox (minor)\n')), 'a section with nothing under it is refused');
check(/only the first line/.test(note('# t\n## stray\n### PhuzzBox (minor)\n- a')), 'a stray heading is refused');
{
  const a = parseNote('a.md', `# one\n### ${P0} (patch)\n- fix\n### PhuzzBox (patch)\n- p`);
  const b = parseNote('b.md', `# two\n### ${P0} (minor)\n- feature\n### ${P1} (patch)\n- other`);
  const { changes, entry } = plan([a, b], '2000-01-01', '# Changelog\n');
  const by = Object.fromEntries(changes.map((c) => [c.name, c]));
  check(by[P0].to === bump(PEDALS[0].version, 'minor') && by[P1].to === bump(PEDALS[1].version, 'patch') && by.PhuzzBox.to === bump(PHUZZBOX_VERSION, 'patch'),
    'a release bumps each version once, by the largest kind its notes give');
  check(changes[0].name === 'PhuzzBox' && entry.startsWith('## 2000-01-01 — one; two') && entry.includes(`### ${P0} ${by[P0].to}\n- fix\n- feature`),
    'its changelog entry joins the topics, PhuzzBox first, each name\'s lines together');
  let refused = false;
  try { plan([a], '2000-01-01', `### ${P0} ${bump(PEDALS[0].version, 'patch')}\n`); } catch { refused = true; }
  check(refused, 'a release that would repeat a version already in the changelog is refused');
}

// the contract, on made-up ones
{
  const base = { params: [{ id: 'a', kind: 'continuous', min: 0, max: 1, step: 0, log: false, def: 0.5 }, { id: 'm', kind: 'choice', options: ['x', 'y'], def: 'x' }],
    presets: [{ name: 'One', values: { a: 0.2 } }] };
  const copy = () => JSON.parse(JSON.stringify(base));
  check(!compare(base, copy()).breaks.length && !compare(base, copy()).added.length, 'an unchanged contract breaks and adds nothing');
  const grow = copy(); grow.params.push({ id: 'b', kind: 'toggle', def: false }); grow.params[1].options.push('z'); grow.presets.push({ name: 'Two', values: {} });
  const g = compare(base, grow);
  check(!g.breaks.length && g.added.length === 3, 'a new parameter, an option at the end and a preset at the end break nothing', g.added.join('; '));
  const range = copy(); range.params[0].max = 2;
  const gone = copy(); gone.params.shift();
  const moved = copy(); moved.params[1].options.reverse();
  const preset = copy(); preset.presets[0].values.a = 0.3;
  const def = copy(); def.params[0].def = 0.6;
  check([range, gone, moved, preset, def].every((c) => compare(base, c).breaks.length === 1),
    'a range, a removed parameter, reordered options, a preset\'s values and a default each break saved songs');
}
done();
