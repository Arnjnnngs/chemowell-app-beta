// falsify/probe-drawer-profiles.mjs -- THE DESIGNER'S MEASUREMENTS for the app-v93 drawer rows.
// Evidence, not a gate. Renders the drawer with three profiles at four widths, measures every
// touch target and every text run by Range, and writes a screenshot per width.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy \
//        node falsify/probe-drawer-profiles.mjs <dir with index.html> <out dir>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('node:path');
  for (const c of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found');
})();
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = process.argv[2], outDir = process.argv[3];
const srv = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end('no'); return; }
    const x = path.extname(p);
    r.writeHead(200, { 'Content-Type': x === '.html' ? 'text/html' : x === '.js' ? 'text/javascript' : 'application/octet-stream' });
    r.end(d); }); }).listen(0, '127.0.0.1');
await new Promise(r => srv.once('listening', r));
const base = 'http://127.0.0.1:' + srv.address().port + '/index.html';
const FROZEN = Date.UTC(2026, 10, 3, 10, 30, 0);
const freeze = `(() => { const F = ${FROZEN}; const R = Date;
  function D(...a) { return a.length ? new R(...a) : new R(F); }
  D.prototype = R.prototype; D.now = () => F; D.UTC = R.UTC; D.parse = R.parse;
  Object.setPrototypeOf(D, R); window.Date = D; })()`;
// A DELIBERATELY HOSTILE FIXTURE: a long real-world name, a short one, and a profile with no name
// at all, which the app numbers rather than calling "Patient" like every other unnamed one.
const names = [['p1', 'Bartholomew Fitzgerald-Hume'], ['p2', 'Jo'], ['p3', '']];
const seed = `(() => {
  const P = (id, s) => 'chemowell-app-p-' + id + '-' + s;
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({
    list: ${JSON.stringify(names.map(([id, name], i) => ({ id, name, createdAt: i + 1 })))}, activeId: 'p1' }));
  localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'pro' }));
  ${JSON.stringify(names)}.forEach(([id, nm], i) => {
    localStorage.setItem(P(id, 'prefs-v1'), JSON.stringify({ patientName: nm, onboarded: true, treatmentType: 'chemo', tourDone: true }));
    localStorage.setItem(P(id, 'entries-v1'), JSON.stringify([]));
    // Two-digit counts on purpose: a badge sized for "1" and never shown "12" is a badge nobody
    // has measured.
    const meds = [];
    for (let k = 0; k < (i === 0 ? 12 : i === 1 ? 1 : 0); k++) {
      meds.push({ id: 'm' + i + k, name: 'Medication ' + k, type: 'win', schemaV: 2, quickLog: true,
        doses: [{ label: '1 tablet', pills: 1 }], windows: [{ start: 9, end: 12, name: 'Morning' }] });
    }
    localStorage.setItem(P(id, 'med-v1'), JSON.stringify({ version: 2, archivedMeds: {}, meds: meds }));
  });
})()`;
const b = await chromium.launch();
for (const W of [320, 330, 360, 390]) {
  const ctx = await b.newContext({ viewport: { width: W, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: 'UTC' });
  await ctx.route('**/*', (r) => { const u = r.request().url();
    if (u.startsWith('http://127.0.0.1')) return r.continue();
    if (u.includes('cdn.jsdelivr.net')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/**/' });
    return r.abort(); });
  await ctx.addInitScript(freeze);
  const page = await ctx.newPage();
  await page.addInitScript(seed);
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(1100);
  await page.click('[data-tour="menu-btn"]');
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => {
    const out = { rows: [], overflow: [], truncated: [], small: [] };
    document.querySelectorAll('[data-profile-row]').forEach(row => {
      const id = row.getAttribute('data-profile-row');
      const sw = row.querySelector('button'); const mute = row.querySelector('[data-profile-mute]');
      const sb = sw.getBoundingClientRect(), mb = mute.getBoundingClientRect();
      out.rows.push({ id, switchBox: Math.round(sb.width) + 'x' + Math.round(sb.height),
        muteBox: Math.round(mb.width) + 'x' + Math.round(mb.height), rowH: Math.round(row.getBoundingClientRect().height) });
      if (sb.height < 44 || mb.height < 44 || mb.width < 44) out.small.push(id + ' switch ' + Math.round(sb.height) + ' mute ' + Math.round(mb.width) + 'x' + Math.round(mb.height));
      // Every text run against its own parent box -- the same question overflow-scan asks, on a
      // surface overflow-scan never opens.
      row.querySelectorAll('div, span').forEach(el => {
        const t = (el.textContent || '').trim();
        if (!t || el.children.length) return;
        const cs = getComputedStyle(el);
        if (parseFloat(cs.fontSize) < 10) out.small.push('type ' + cs.fontSize + ' on "' + t.slice(0, 20) + '"');
        // CLIPPED TEXT IS NOT OVERFLOWING TEXT, and the first version of this probe did not know
        // the difference: it reported the long name as "over by 115px" on a build where the name
        // is correctly ellipsised. overflow-scan has carried a `clipped` guard for this since it
        // was written; this probe needed the same one. An element that hides its own overflow and
        // shows an ellipsis is doing its job -- what matters is that it is TRUNCATED, which is
        // reported separately so a name that silently disappears is still visible here.
        const r = document.createRange(); r.selectNodeContents(el);
        let w = 0; for (const q of r.getClientRects()) w = Math.max(w, q.width);
        const pb = el.parentElement.getBoundingClientRect();
        const clipped = cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis';
        if (w - pb.width > 1.5) {
          if (clipped) out.truncated.push(id + ' "' + t.slice(0, 20) + '" ellipsised, ' + Math.round(w - pb.width) + 'px hidden');
          else out.overflow.push(id + ' "' + t.slice(0, 26) + '" by ' + Math.round(w - pb.width) + 'px');
        }
      });
    });
    const d = document.getElementById('app-drawer');
    out.drawerW = d ? Math.round(d.getBoundingClientRect().width) : null;
    out.pageScroll = document.documentElement.scrollWidth > window.innerWidth;
    return out;
  });
  console.log(W + 'px  drawer=' + m.drawerW + '  rows=' + JSON.stringify(m.rows) +
    '  overflow=' + (m.overflow.length ? JSON.stringify(m.overflow) : '0') +
    '  truncated=' + (m.truncated.length ? JSON.stringify(m.truncated) : '0') +
    '  under-44/under-10px=' + (m.small.length ? JSON.stringify(m.small) : '0') +
    (m.pageScroll ? '  ** PAGE SIDE-SCROLLS **' : ''));
  const clip = await page.evaluate(() => {
    const d = document.getElementById('app-drawer'); if (!d) return null;
    const r = d.getBoundingClientRect(); const vw = window.innerWidth, vh = window.innerHeight;
    const x = Math.max(0, Math.min(r.left, vw - 1)), y = Math.max(0, Math.min(r.top, vh - 1));
    return { x, y, width: Math.max(1, Math.min(r.width, vw - x)), height: Math.max(1, Math.min(r.height, vh - y)) };
  });
  await page.screenshot({ path: outDir + '/drawer-' + W + '.png', ...(clip ? { clip } : {}) });
  await ctx.close();
}
await b.close(); srv.close();
