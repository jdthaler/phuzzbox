// release.mjs — versions are bumped only when main is released to live (CLAUDE.md, CHANGELOG.md),
// as Forte's are.
//
// A pull request into main bumps nothing: it adds a note to changes/ (changes/README.md says how),
// naming what it changes and whether that is a major, minor or patch change. Releasing gathers the
// notes into one CHANGELOG.md entry, bumps each version named once (the largest change wins),
// regenerates the plugins' <slug>-info.cmake that carry those versions, and deletes the notes.
//
// Usage: node tools/release.mjs              make the release commit's changes (on a branch off main)
//        node tools/release.mjs --dry-run    print what it would do
//        node tools/release.mjs --check      check the notes in changes/ (test/site-tests.mjs does)
//        node tools/release.mjs --check-pr <base> <head>
//                                            the pull-request rules (the tests workflow): into main,
//                                            no version changes but a release's, a note when the
//                                            site or the plugins change, and a major one for a
//                                            pedal from 1.0 on whose contract breaks
//                                            (tools/contract.mjs); into live, no notes left

import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { PEDALS, PHUZZBOX_VERSION } from '../shared/registry.js';
import { changesBetween } from './contract.mjs';

const R = new URL('..', import.meta.url);
const read = (f) => readFileSync(new URL(f, R), 'utf8');
const KINDS = ['patch', 'minor', 'major', 'new'];
const SEMVER = /^\d+\.\d+\.\d+$/;

// Everything a note can name: PhuzzBox, and each pedal by its registry name.
const components = () => new Map([['PhuzzBox', { id: 'phuzzbox', version: PHUZZBOX_VERSION, ready: true }],
  ...PEDALS.map((p) => [p.name, p])]);

// One note: a "# <topic>" line, then "### <PhuzzBox or a pedal's name> (patch|minor|major|new)"
// sections, each with the lines that go under that name in CHANGELOG.md.
export function parseNote(file, text) {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
  const topic = lines[0].match(/^# (.+)$/)?.[1]?.trim();
  if (!topic) throw new Error(`changes/${file}: the first line is "# <topic>"`);
  const known = components(), sections = [];
  for (const line of lines.slice(1)) {
    const h = line.match(/^### (.+?) \((\w+)\)\s*$/);
    if (h) {
      const [, name, kind] = h;
      if (!known.has(name)) throw new Error(`changes/${file}: "${name}" is neither PhuzzBox nor a pedal's name in shared/registry.js`);
      if (!KINDS.includes(kind)) throw new Error(`changes/${file}: ${name} (${kind}): the kind is patch, minor, major or new`);
      if (sections.some((s) => s.name === name)) throw new Error(`changes/${file}: ${name} appears twice`);
      sections.push({ name, kind, body: [] });
    } else if (/^#{1,3} /.test(line)) {
      throw new Error(`changes/${file}: "${line}": only the first line is "# ", and sections are "### <name> (patch|minor|major|new)"`);
    } else if (sections.length) sections.at(-1).body.push(line);
    else if (line.trim()) throw new Error(`changes/${file}: text before the first "### <name> (kind)" section`);
  }
  if (!sections.length) throw new Error(`changes/${file}: no "### <name> (patch|minor|major|new)" section`);
  for (const s of sections) {
    s.body = s.body.join('\n').trim();
    if (!s.body) throw new Error(`changes/${file}: ${s.name} says nothing`);
    const c = known.get(s.name);
    if (s.kind === 'new' && !(c.ready && SEMVER.test(c.version ?? ''))) throw new Error(`changes/${file}: ${s.name} (new) needs ready: true and its first version in shared/registry.js`);
    if (s.kind !== 'new' && !SEMVER.test(c.version ?? '')) throw new Error(`changes/${file}: ${s.name} has no version yet; its first release is (new)`);
  }
  return { file, topic, sections };
}

export function readNotes() {
  const dir = new URL('changes/', R);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').sort()
    .map((f) => parseNote(f, readFileSync(new URL(f, dir), 'utf8')));
}

export function bump(version, kind) {
  const [x, y, z] = version.split('.').map(Number);
  return kind === 'major' ? `${x + 1}.0.0` : kind === 'minor' ? `${x}.${y + 1}.0` : kind === 'patch' ? `${x}.${y}.${z + 1}` : version;
}

// The release: every component's new version, and its CHANGELOG.md entry.
export function plan(notes, date = new Date().toISOString().slice(0, 10), changelog = read('CHANGELOG.md')) {
  if (!notes.length) throw new Error('changes/ has no notes: nothing to release');
  const known = components(), order = ['PhuzzBox', ...PEDALS.map((p) => p.name)], by = new Map();
  for (const n of notes) for (const s of n.sections) {
    const e = by.get(s.name) ?? { name: s.name, kinds: [], bodies: [] };
    e.kinds.push(s.kind); e.bodies.push(s.body); by.set(s.name, e);
  }
  const changes = order.filter((name) => by.has(name)).map((name) => {
    const e = by.get(name), c = known.get(name);
    // a first release ('new') with fixes on top is still the first release
    const kind = ['new', 'major', 'minor'].find((k) => e.kinds.includes(k)) ?? 'patch';
    return { name, id: c.id, from: c.version, to: bump(c.version, kind), kind, body: e.bodies.join('\n') };
  });
  for (const c of changes) {
    if (changelog.includes(`### ${c.name} ${c.to}\n`)) throw new Error(`CHANGELOG.md already has ${c.name} ${c.to}`);
  }
  const topics = [...new Set(notes.map((n) => n.topic))];
  const entry = [`## ${date} — ${topics.join('; ')}`, '',
    ...changes.flatMap((c) => [`### ${c.name} ${c.to}`, c.body, ''])].join('\n');
  return { changes, entry };
}

export function apply({ changes, entry }, notes) {
  const box = changes.find((c) => c.id === 'phuzzbox');
  let reg = read('shared/registry.js');
  if (box) {
    reg = reg.replace(/^export const PHUZZBOX_VERSION = '[^']*';/m, `export const PHUZZBOX_VERSION = '${box.to}';`);
    const pkg = read('package.json');
    writeFileSync(new URL('package.json', R), pkg.replace(/"version": "[^"]*"/, `"version": "${box.to}"`));
  }
  for (const c of changes.filter((x) => x.id !== 'phuzzbox' && x.to !== x.from)) {
    const line = new RegExp(`^(.*\\bid: '${c.id}',.*\\bversion: ')[^']*(')`, 'm');
    if (!line.test(reg)) throw new Error(`shared/registry.js: no "id: '${c.id}', … version: '…'" line`);
    reg = reg.replace(line, `$1${c.to}$2`);
  }
  writeFileSync(new URL('shared/registry.js', R), reg);

  const log = read('CHANGELOG.md'), at = log.indexOf('\n## ');
  writeFileSync(new URL('CHANGELOG.md', R), at < 0 ? `${log.trimEnd()}\n\n${entry}` : `${log.slice(0, at + 1)}${entry}\n${log.slice(at + 1)}`);
  for (const n of notes) unlinkSync(new URL(`changes/${n.file}`, R));

  // the plugins carry the pedals' versions (<slug>-info.cmake); the app takes PhuzzBox's from package.json
  const ported = (id) => existsSync(new URL(`native/pedals/${id}/`, R));
  const slugs = changes.filter((c) => c.id !== 'phuzzbox' && ported(c.id)).map((c) => c.id);
  if (slugs.length) execFileSync(process.execPath, [new URL('tools/gen-native-params.mjs', R).pathname, ...slugs], { cwd: R, stdio: 'inherit' });
}

// Paths whose changes need no note: the documentation, CI, and the notes themselves.
export const UNVERSIONED = [/^[^/]+\.md$/, /^docs\/[^/]+\.md$/, /^native\/[^/]+\.md$/, /^\.github\//, /^\.claude\//, /^changes\//, /^\.gitignore$/];

const git = (...a) => execFileSync('git', a, { cwd: R, stdio: ['ignore', 'pipe', 'pipe'] }).toString();

// The version a commit gives each component.
export function versionsAt(ref) {
  const reg = git('show', `${ref}:shared/registry.js`), out = { PhuzzBox: reg.match(/PHUZZBOX_VERSION = '([^']*)'/)?.[1] };
  for (const m of reg.matchAll(/\bid: '([^']+)', name: '((?:[^'\\]|\\.)+)'[^\n]*?\bversion: '([^']*)'/g)) out[m[2].replace(/\\(.)/g, '$1')] = m[3];
  return out;
}
const notesAt = (ref) => { try { return git('ls-tree', '--name-only', `${ref}:changes`).split('\n').filter((f) => f.endsWith('.md') && f !== 'README.md'); } catch { return []; } };
const fileAt = (ref, f) => { try { return git('show', `${ref}:${f}`); } catch { return ''; } };

export function checkPr(base, head = 'HEAD', warnings = []) {
  const target = base.replace(/^origin\//, '');
  const errors = [];
  const files = git('diff', '--name-only', `${base}...${head}`).split('\n').filter(Boolean);
  const notes = notesAt(head);
  if (target === 'live') {
    if (notes.length) errors.push(`changes/ still has notes (${notes.join(', ')}): make the release first (node tools/release.mjs on a branch off main, merged into main)`);
    return errors;
  }
  const mb = git('merge-base', base, head).trim();
  const before = versionsAt(mb), after = versionsAt(head);
  const moved = Object.entries(after).filter(([name, v]) => before[name] !== undefined && before[name] !== v);
  // A release (tools/release.mjs, merged into main before main goes to live) bumps versions: it
  // leaves no notes, and the changelog gains each new version. Anything else bumps none.
  const log = fileAt(head, 'CHANGELOG.md'), oldLog = fileAt(mb, 'CHANGELOG.md');
  const isRelease = moved.length && !notes.length && notesAt(mb).length
    && moved.every(([name, v]) => log.includes(`### ${name} ${v}\n`) && !oldLog.includes(`### ${name} ${v}\n`));
  if (moved.length && !isRelease) {
    for (const [name, v] of moved) errors.push(`${name} goes from ${before[name]} to ${v}: versions change only in a release (tools/release.mjs); add a note to changes/ instead (changes/README.md)`);
  }
  if (isRelease) return errors;
  const added = git('diff', '--name-only', '--diff-filter=AM', `${base}...${head}`, '--', 'changes/').split('\n').filter((f) => f.endsWith('.md') && !f.endsWith('README.md'));
  const site = files.filter((f) => !UNVERSIONED.some((re) => re.test(f)));
  if (site.length && !added.length) errors.push(`this changes the site or the plugins (${site.slice(0, 5).join(', ')}${site.length > 5 ? ', …' : ''}) but adds no note to changes/ (changes/README.md says how)`);
  // a broken contract (tools/contract.mjs): a major note from 1.0 on, a warning before
  const kinds = new Map();
  for (const f of added) {
    let n;
    try { n = parseNote(f.replace(/^changes\//, ''), git('show', `${head}:${f}`)); } catch { continue; } // test/site-tests.mjs reports it
    for (const s of n.sections) kinds.set(s.name, [...(kinds.get(s.name) ?? []), s.kind]);
  }
  for (const c of changesBetween(mb, head)) {
    if (!c.breaks.length) continue;
    const p = PEDALS.find((x) => x.id === c.slug), v = before[p?.name] ?? '0.0.0';
    const what = `${p?.name ?? c.slug}: ${c.breaks.join('; ')}`;
    if (Number(v.split('.')[0]) < 1) warnings.push(`${what}. Saved songs and automation change; from 1.0 on this needs a major note`);
    else if (!kinds.get(p.name)?.includes('major')) errors.push(`${what}. Saved songs and automation change, so ${p.name} ${v} needs a "### ${p.name} (major)" note (tools/contract.mjs)`);
  }
  return errors;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  try {
    if (args[0] === '--check-pr') {
      const warnings = [], errors = checkPr(args[1] ?? 'origin/main', args[2] ?? 'HEAD', warnings);
      for (const w of warnings) console.log(`::warning::${w}`);
      for (const e of errors) console.error(`::error::${e}`);
      if (errors.length) process.exit(1);
      console.log('ok');
    } else if (args[0] === '--check') {
      const notes = readNotes();
      console.log(`${notes.length} note${notes.length === 1 ? '' : 's'} in changes/`);
    } else {
      const notes = readNotes(), p = plan(notes);
      for (const c of p.changes) console.log(`${c.name} ${c.from === c.to ? `${c.to} (first release)` : `${c.from} → ${c.to}`}`);
      if (args.includes('--dry-run')) console.log(`\n${p.entry}`);
      else apply(p, notes);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
