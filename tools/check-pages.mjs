// check-pages.mjs — open every page in headless Chromium at the sizes CLAUDE.md names and check
// what a layout regression breaks, as Forte's tool does: errors in the console (and anything the
// server couldn't find), a page that scrolls sideways (as loaded, with How it works open, with
// every view and group of controls turned on, and with audio started), the controls each pedal
// page should place (knobs and the footswitch on the pedal, ⓘ buttons, the presets in the
// controls' bar, Discover | Perform in the views' bar, Start audio), that each toggle turns its
// view or group of controls off and on, and on the desktop that what's turned on is still on after
// a reload and that each bar's fold button folds its panel away and back. The front page has a
// link for every ready pedal and the Pedalboard.
//
// Usage: node tools/check-pages.mjs [--base <git ref>] [--json <file>] [filter]
//   filter       only the pages whose path contains it (phuzz, index, board)
//   --base main  also open the same pages from <ref> (a git worktree, served on a second port)
//                and list every count that differs: what a change meant to leave alone shouldn't
//   --json f     write every page's counts to f
// Needs Playwright (the cloud sessions have it installed globally; CI installs it).
// Exits 1 when a check fails; differences from --base are reported, not failed.

import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { availableParallelism, tmpdir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { PEDALS } from '../shared/registry.js';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i < 0 ? null : args.splice(i, 2)[1]; };
const base = opt('--base');
const jsonOut = opt('--json');
const filter = args[0] || '';
const ROOT = resolve(new URL('..', import.meta.url).pathname);
const READY = PEDALS.filter((p) => p.ready);

async function playwright() {
  try { return await import('playwright'); } catch { /* not local: try the global install */ }
  try { return createRequire(import.meta.url)('playwright'); } catch { /* nor on NODE_PATH */ }
  const g = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  return import(join(g, 'playwright', 'index.mjs'));
}
const { chromium, devices } = await playwright();

const PAGES = ['', 'board/', ...READY.map((p) => `${p.id}/`)].filter((p) => (p || 'index').includes(filter));

// CLAUDE.md's sizes: a phone with touch and without Web MIDI (no iOS browser has it), a tablet
// both ways, a desktop and a narrow desktop window.
const phone = devices['iPhone 13'], pad = devices['iPad Pro 11'];
const SIZES = [
  { name: 'phone', ...phone, viewport: { width: 390, height: 664 }, ios: true },
  { name: 'phone-landscape', ...phone, viewport: { width: 750, height: 340 }, ios: true },
  { name: 'ipad', ...pad, ios: true },
  { name: 'ipad-landscape', ...pad, viewport: { width: pad.viewport.height, height: pad.viewport.width }, ios: true },
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'narrow', viewport: { width: 900, height: 800 } },
];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.md': 'text/markdown', '.m4a': 'audio/mp4', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };

// A static server for one checkout, on a free port of localhost (a secure context, so the
// AudioWorklet runs).
function serve(root) {
  const server = createServer(async (req, res) => {
    let path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!path.startsWith(root + sep) && path !== root) { res.writeHead(403).end(); return; }
    try {
      if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
      const body = await readFile(path);
      res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, url: `http://localhost:${server.address().port}/` })));
}

// What one page shows, counted in the page.
const COUNT = () => {
  const n = (s) => document.querySelectorAll(s).length;
  const visible = (s) => [...document.querySelectorAll(s)].filter((e) => e.checkVisibility()).length;
  return {
    knobs: visible('.rack .knob'),
    footswitch: visible('.rack .footswitch'),
    controls: n('#controls [data-param]'),
    info: n('button.info'),
    presets: n('select.presets option'),
    barPresets: visible('.controls-bar .bar-tools select.presets'),
    views: n('.views-bar .toggles button'),
    controlGroups: n('.controls-bar .toggles button'),
    viewsOn: n('.views-bar .toggles button[aria-pressed="true"]'),
    mode: visible('.views-bar .mode button'),
    start: n('button.start'),
    pedalLinks: n('a.go'),
  };
};
const WIDE = () => document.documentElement.scrollWidth - window.innerWidth;

// Each toggle turns its view, or its group of controls, off and on again, the button and what it
// shows both following; everything is on at the end. A view's card is found by its name
// (data-view): the pedal is the rack, and a card may sit in the rack or in the stage. Returns how
// many toggles there are.
const ROWS = [
  ['.views-bar .toggles button', 'views', 'view'],
  ['.controls-bar .toggles button', 'controls', 'controls'],
];
const TOGGLES = (sel) => [...document.querySelectorAll(sel)].map((b) => b.getAttribute('aria-pressed') === 'true');
const SHOWN = (what) => {
  const shown = (e) => !!e && !e.hidden && e.checkVisibility();
  // each view's toggle names it, and its card (or the rack, the pedal's) carries that name in data-view
  if (what === 'views') return [...document.querySelectorAll('.views-bar .toggles button')].map((b) => shown(document.querySelector(`[data-view="${CSS.escape(b.textContent.trim())}"]`)));
  return [...document.querySelectorAll('#controls .groups > *')].map(shown);
};
async function toggles(tab, broken) {
  let n = 0;
  for (const [row, items, what] of ROWS) {
    const buttons = await tab.locator(row).all();
    n += buttons.length;
    for (const [i, b] of buttons.entries()) {
      const name = (await b.textContent()).trim();
      if (!(await b.isVisible())) { broken.push(`the "${name}" toggle is hidden`); continue; }
      for (const want of [true, false, true]) { // on (if it was off), off, and on again
        if ((await tab.evaluate(TOGGLES, row))[i] === want) continue;
        await b.click({ timeout: 2000 }).catch(() => {});
        await tab.waitForTimeout(50);
        if ((await tab.evaluate(TOGGLES, row))[i] !== want || (await tab.evaluate(SHOWN, items))[i] !== want) broken.push(`the "${name}" toggle doesn't turn its ${what} ${want ? 'on' : 'off'}`);
      }
    }
  }
  return n;
}
// With everything on: still on after a reload, and each panel folded away and back by its bar.
async function remembered(tab) {
  const out = [];
  await tab.reload({ waitUntil: 'networkidle' });
  await tab.waitForTimeout(300);
  for (const [row, items, what] of ROWS) {
    if (!(await tab.evaluate(TOGGLES, row)).every(Boolean) || !(await tab.evaluate(SHOWN, items)).every(Boolean)) out.push(`the ${what} turned on are not on after a reload`);
  }
  const HEIGHTS = () => [document.querySelector('#views'), document.querySelector('#controls')].map((e) => (e.hidden ? 0 : e.offsetHeight));
  for (const [i, kind] of ['views', 'controls'].entries()) {
    const fold = tab.locator(`.${kind}-bar .fold`);
    await fold.click({ timeout: 2000 }).catch(() => {});
    await tab.waitForTimeout(150);
    const hh = await tab.evaluate(HEIGHTS);
    if (hh[i] !== 0 || !(hh[1 - i] > 0)) out.push(`folding the ${kind} leaves them ${hh[i]}px and the others ${hh[1 - i]}px`);
    if (await tab.evaluate(WIDE) > 0) out.push(`scrolls sideways with the ${kind} folded away`);
    await fold.click({ timeout: 2000 }).catch(() => {});
    await tab.waitForTimeout(150);
    if ((await tab.evaluate(HEIGHTS)).some((x) => !(x > 0))) out.push(`the ${kind}' fold button doesn't bring them back`);
  }
  return out;
}

async function checkPage(browser, url, page, size) {
  const { name, ios, ...device } = size;
  const ctx = await browser.newContext({ ...device, deviceScaleFactor: 1 });
  if (ios) await ctx.addInitScript(() => { delete Navigator.prototype.requestMIDIAccess; });
  const tab = await ctx.newPage();
  const errors = [], wide = [], broken = [];
  tab.on('pageerror', (e) => errors.push(e.message));
  tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  tab.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url().replace(url, '')}`); });
  const sideways = async (state) => { const w = await tab.evaluate(WIDE); if (w > 0) wide.push(`${state} (+${w}px)`); };
  const click = async (sel) => {
    const el = tab.locator(sel).first();
    if (await el.isVisible().catch(() => false)) { await el.click({ timeout: 2000 }).catch(() => {}); await tab.waitForTimeout(250); return true; }
    return false;
  };
  try {
    await tab.goto(url + page, { waitUntil: 'networkidle', timeout: 30000 });
    await tab.waitForTimeout(500);
    await sideways('loaded');
    const counts = await tab.evaluate(COUNT);
    // How it works, from the pedal's ⓘ, and closed again
    if (await click('.rack button.info, header button.info')) { await tab.waitForTimeout(250); await sideways('How it works open'); await tab.keyboard.press('Escape'); await tab.waitForTimeout(150); }
    if (await toggles(tab, broken)) { await tab.waitForTimeout(250); await sideways('every view on'); }
    if (name === 'desktop' && counts.views) broken.push(...await remembered(tab));
    if (await click('button.start')) { await tab.waitForTimeout(800); await sideways('audio started'); }
    return { page: page || 'index', size: name, counts, errors, wide, broken };
  } catch (e) {
    return { page: page || 'index', size: name, counts: null, errors: [...errors, e.message], wide, broken };
  } finally { await ctx.close(); }
}

// The checks: what every pedal page must have, whatever else a change does to it.
function failures(r) {
  const f = [...r.errors.map((e) => `error: ${e}`), ...r.wide.map((w) => `scrolls sideways: ${w}`), ...r.broken];
  const c = r.counts;
  if (!c) return f;
  if (r.page === 'index' && c.pedalLinks < READY.length + 1) f.push(`${c.pedalLinks} links to pages, not ${READY.length + 1} (one for each ready pedal and the Pedalboard)`);
  if (!READY.some((p) => `${p.id}/` === r.page)) return f;
  if (!c.knobs) f.push('no knobs on the pedal');
  if (!c.footswitch) f.push('no footswitch');
  if (!c.info) f.push('no ⓘ buttons');
  if (!c.controls) f.push('no controls');
  if (c.presets < 2) f.push('no presets');
  if (!c.barPresets) f.push('no presets in the controls\' bar');
  if (!c.views) f.push('no toggles for the views');
  if (!c.mode) f.push('no Discover | Perform in the views\' bar');
  if (!c.start) f.push('no Start audio');
  return f;
}

async function run(root, label) {
  const { server, url } = await serve(root);
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const jobs = PAGES.flatMap((p) => SIZES.map((s) => [p, s]));
  const out = [];
  const width = Math.min(jobs.length, Math.max(4, availableParallelism() * 2));
  await Promise.all(Array.from({ length: width }, async () => {
    while (jobs.length) { const [p, s] = jobs.shift(); out.push(await checkPage(browser, url, p, s)); }
  }));
  await browser.close();
  server.close();
  const key = (r) => `${r.page} ${r.size}`;
  out.sort((a, b) => key(a).localeCompare(key(b)));
  if (label) console.log(`${label}: ${out.length} page views`);
  return out;
}

const t0 = performance.now();
const results = await run(ROOT);
let failed = 0;
for (const r of results) {
  const f = failures(r);
  if (f.length) { failed++; console.log(`FAIL  ${r.page} ${r.size}`); for (const l of f.slice(0, 8)) console.log(`      ${l}`); }
}
console.log(`${results.length - failed}/${results.length} page views passed (${PAGES.length} pages × ${SIZES.length} sizes) in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
if (jsonOut) await writeFile(jsonOut, JSON.stringify(results, null, 1));

if (base) {
  const dir = await mkdtemp(join(tmpdir(), 'phuzzbox-base-'));
  execFileSync('git', ['-C', ROOT, 'worktree', 'add', '--detach', dir, base], { stdio: 'ignore' });
  try {
    const before = new Map((await run(dir, `\n${base}`)).map((r) => [`${r.page} ${r.size}`, r]));
    let differ = 0;
    for (const r of results) {
      const b = before.get(`${r.page} ${r.size}`);
      if (!b?.counts || !r.counts) continue;
      const d = Object.keys(r.counts).filter((k) => r.counts[k] !== b.counts[k]).map((k) => `${k} ${b.counts[k]} → ${r.counts[k]}`);
      if (d.length) { differ++; console.log(`DIFF  ${r.page} ${r.size}: ${d.join(', ')}`); }
    }
    console.log(differ ? `${differ} page views differ from ${base}` : `every page view counts the same as ${base}`);
  } finally {
    execFileSync('git', ['-C', ROOT, 'worktree', 'remove', '--force', dir], { stdio: 'ignore' });
    await rm(dir, { recursive: true, force: true });
  }
}
process.exit(failed ? 1 : 0);
