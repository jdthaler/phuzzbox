// plugins-tests.mjs — the plugin downloads (shared/plugins.js, tools/plugin-release.mjs,
// tools/package-plugins.sh, plugins/README.md) agree: the site links each archive a release holds
// as the file itself (Jesse, 2026-11-01: no GitHub pages), the release's notes say what the site
// reads back, and the packing script makes the archives by the names the site asks for.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, done } from './harness.mjs';
import { PEDALS, PHUZZBOX_VERSION, SOURCE } from '../shared/registry.js';
import { LATEST, SYSTEMS, APP, archive, downloads, withPlugins, parseRelease, releaseLine } from '../shared/plugins.js';
import { notes, files, manifest } from '../tools/plugin-release.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const ready = PEDALS.filter((p) => p.ready);

check(withPlugins().length === ready.length && ready.every((p) => p.plugin?.code), 'every ready pedal has plugins', `${withPlugins().length} of ${ready.length}`);
const all = files();
check(all.length === SYSTEMS.length * (2 + ready.length) && new Set(all).size === all.length,
  'a release holds one archive per system for every pedal together, the app alone and each pedal, each named once', `${all.length} archives`);
const links = [null, APP, ...ready.map((p) => p.id)].flatMap((id) => downloads(id));
check(LATEST === `${SOURCE}/releases/latest/download/` && links.every((d) => d.url === LATEST + d.file && all.includes(d.file)),
  'every download is a file of the latest release, linked directly (no GitHub page)', LATEST);

// the notes the release carries, read back as the site reads them
const rel = parseRelease({ tag_name: 'plugins-v9', body: notes() });
check(ready.every((p) => rel.versions[p.id] === p.version), 'the release\'s notes give each pedal\'s version, and the site reads them back', Object.keys(rel.versions).length + ' pedals');
check(new RegExp(`PhuzzBox ${PHUZZBOX_VERSION.replace(/\./g, '\\.')}`).test(notes()) && !/https?:\/\/(www\.)?github\.com/.test(notes()), 'the notes name PhuzzBox\'s version and send no one to GitHub for information');
const m = manifest();
check(m.includes(`phuzzbox ${PHUZZBOX_VERSION}`) && /^native [0-9a-f]{40}$/m.test(m) && ready.every((p) => m.includes(`${p.id} ${p.version}`)), 'the manifest that decides a new release names every version and the native tree');

// the line under the downloads
const p0 = ready[0];
const line = (r, p) => releaseLine(r, p);
check(!line({ none: true }, p0).ok && line({ tag: 't', versions: { [p0.id]: p0.version } }, p0).ok
  && !line({ tag: 't', versions: {} }, p0).ok && /comes in/.test(line({ tag: 't', versions: { [p0.id]: '0.0.1' } }, p0).text),
  'the line under the downloads: none yet, this version, not yet, an older version');

// the packing script makes those names
const sh = readFileSync(`${root}tools/package-plugins.sh`, 'utf8');
check(archive(null, 'x') === 'PhuzzBox-plugins-x' && archive(APP, 'x') === 'PhuzzBox-app-x' && archive('phuzz', 'x') === 'PhuzzBox-phuzz-x'
  && /pack "PhuzzBox-\$id"/.test(sh) && /pack PhuzzBox-plugins /.test(sh) && /pack PhuzzBox-app /.test(sh),
  'tools/package-plugins.sh packs the archives by the names the site links');
check(SYSTEMS.every(([, suffix]) => sh.includes(`$out-${suffix.replace(/\.(zip|tar\.gz)$/, '')}.${suffix.endsWith('tar.gz') ? 'tar.gz' : 'zip'}`)),
  'and with each system\'s suffix', SYSTEMS.map(([, s]) => s).join(', '));

// the guide
const guide = readFileSync(`${root}plugins/README.md`, 'utf8');
check(['## Mac', '## Windows', '## Linux'].every((h) => guide.includes(h)) && guide.includes('bash install.sh install') && !/https?:\/\/(www\.)?github\.com/.test(guide),
  'plugins/README.md says how to install on each system, and links nothing on GitHub');
const install = readFileSync(`${root}native/install.sh`, 'utf8');
check(['install)', 'uninstall)', 'list)'].every((c) => install.includes(c)) && install.includes('com.apple.quarantine'), 'native/install.sh installs, uninstalls and lists, and clears the Mac\'s quarantine');
done();
