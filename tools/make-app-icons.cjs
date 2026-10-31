// make-app-icons.cjs — native/icons/phuzzbox.icns (macOS) and .ico (Windows), the app's icons, drawn
// from shared/icons/icon.svg on a transparent ground. Needs Playwright's Chromium:
// node tools/make-app-icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const svg = fs.readFileSync(`${__dirname}/../shared/icons/icon.svg`, 'utf8')
    .replace('<rect width="512" height="512" fill="#f4f1ec"/>', ''); // the app icon: the pedal alone, on transparent
  const png = {};
  for (const n of [16, 32, 48, 64, 128, 256, 512, 1024]) {
    const p = await b.newPage({ viewport: { width: n, height: n } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${n}" height="${n}" `)}</body></html>`);
    png[n] = await p.screenshot({ omitBackground: true });
    await p.close();
  }
  await b.close();
  const types = [['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024]];
  const parts = types.map(([t, n]) => { const h = Buffer.alloc(8); h.write(t, 0, 'ascii'); h.writeUInt32BE(8 + png[n].length, 4); return Buffer.concat([h, png[n]]); });
  const body = Buffer.concat(parts), head = Buffer.alloc(8); head.write('icns', 0, 'ascii'); head.writeUInt32BE(8 + body.length, 4);
  fs.writeFileSync(`${__dirname}/../native/icons/phuzzbox.icns`, Buffer.concat([head, body]));
  const sizes = [16, 32, 48, 256], dir = Buffer.alloc(6 + 16 * sizes.length);
  dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(sizes.length, 4);
  let off = dir.length;
  sizes.forEach((n, i) => { const e = 6 + 16 * i; dir.writeUInt8(n === 256 ? 0 : n, e); dir.writeUInt8(n === 256 ? 0 : n, e + 1); dir.writeUInt16LE(1, e + 4); dir.writeUInt16LE(32, e + 6); dir.writeUInt32LE(png[n].length, e + 8); dir.writeUInt32LE(off, e + 12); off += png[n].length; });
  fs.writeFileSync(`${__dirname}/../native/icons/phuzzbox.ico`, Buffer.concat([dir, ...sizes.map((n) => png[n])]));
})();
