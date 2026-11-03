// falsify/probe-timecell-width.mjs -- THE EVIDENCE FOR MUTANT 7'S LABEL, not a gate.
//
// Run:  env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy \
//         node falsify/probe-timecell-width.mjs <dir containing an index.html>
//
// WHY IT EXISTS. Corpus mutant 7 removes `flexShrink: '0'` from the Home timeline's time cell and
// was labelled "the app-v92 defect itself". It SURVIVES the full overflow sweep (measured: 171
// checks, 171 passed, 0 failed, 29m0s run), and an audit had already measured five further
// variants of it, all clean. "The suite cannot see it" and "there is nothing to see" are different
// claims and `overflow-scan` cannot tell them apart, because it only ever reports a box that is
// too small for its text.
//
// So this measures the thing directly: the time cell's USED width against its own text's width,
// cell by cell, by Range (scrollWidth is 0 for inline text -- a trap this repo has paid for).
// Shipped vs the mutant, four widths, 24 cells each:
//
//   shipped   flex-shrink=0   used 58.03 / 66.31   text 58.03 / 66.31   squeezed below text: 0
//   mutant 7  flex-shrink=1   used 58.03 / 66.31   text 58.03 / 66.31   squeezed below text: 0
//
// IDENTICAL, and `flex-shrink` reads 1 in the mutant so the mutation did apply. The property is
// inert on every row this fixture can draw, which is WHY it survives: after app-v92 the name span
// carries `minWidth: '0'` and `overflowWrap: break-word`, so a crowded row relieves itself by
// WRAPPING the name -- even a single long token like "Hydroxychloroquine" breaks mid-word -- and
// the time cell is never put under pressure in the first place. Its `flexShrink: '0'` is
// defence-in-depth whose precondition the name fix removed.
//
// That is a measurement, not an excuse, and it is the reason mutant 7 is relabelled rather than
// deleted or "strengthened" with a check built to kill it. See BACKLOG M39-e.
// Is `flexShrink: '0'` on the Home timeline's time cell INERT on every row the fixture can draw?
// Not "does overflow-scan see a difference" -- that is the question that already answered no.
// This measures the time cell's USED WIDTH and its text's own width, row by row, in both builds.
// If the used width never falls below the text width in either build, the property is provably
// doing nothing on these rows and relabelling its mutant is a measurement rather than an excuse.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('node:path');
  for (const c of ['playwright', '/opt/node-tools/node_modules/playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright']) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found');
})();
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.argv[2];
const srv = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end('no'); return; }
    const x = path.extname(p);
    r.writeHead(200, { 'Content-Type': x === '.html' ? 'text/html' : x === '.js' ? 'text/javascript' : 'application/octet-stream' });
    r.end(d); }); }).listen(0, '127.0.0.1');
await new Promise(r => srv.once('listening', r));
const base = 'http://127.0.0.1:' + srv.address().port + '/index.html';
const P = 'chemowell-app-p-p1-';
const DAY = 86400000, now = Date.UTC(2026, 10, 3, 14, 0, 0);
const meds = { version: 2, archivedMeds: {}, meds: [
  { id: 'm1', name: 'Hydroxychloroquine', schedule: 'daily', times: ['08:00','10:00','20:00'], doses: [{ label: '200 mg', single: true }] },
  { id: 'm2', name: 'Ondansetron', schedule: 'daily', times: ['10:00'], doses: [{ label: '4 mg', single: true }] } ] };
const entries = [];
for (let i = 0; i < 6; i++) entries.push({ id: 'e'+i, medId: i % 2 ? 'm2' : 'm1', dose: i % 2 ? '4 mg' : '200 mg', ts: now - i * 3600000,
  ...(i === 0 ? { override: true, overrideReason: 'offDay+early+overLimit', skipped: true } : {}) });
const b = await chromium.launch();
const out = [];
for (const W of [320, 330, 360, 390]) {
  const ctx = await b.newContext({ viewport: { width: W, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await ctx.route('**/*', (r) => { const u = r.request().url();
    if (u.startsWith('http://127.0.0.1')) return r.continue();
    if (u.includes('cdn.jsdelivr.net')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/**/' });
    return r.abort(); });
  const page = await ctx.newPage();
  await page.addInitScript(([p, e, m]) => {
    localStorage.setItem(p + 'entries-v1', JSON.stringify(e));
    localStorage.setItem(p + 'med-v1', JSON.stringify(m));
    localStorage.setItem(p + 'prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, treatmentType: 'chemo', tourDone: true }));
    localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'free' }));
  }, [P, entries, meds]);
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  // The time cells are the .mono spans whose text matches a clock. Measured by RANGE, which is the
  // only way to get a text run's real width -- scrollWidth is 0 for inline text, a trap this repo
  // has paid for before.
  const rows = await page.evaluate(() => {
    const res = [];
    for (const el of document.querySelectorAll('span.mono, div.mono')) {
      const t = (el.textContent || '').trim();
      if (!/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(t)) continue;
      const box = el.getBoundingClientRect();
      const r = document.createRange(); r.selectNodeContents(el);
      const tr = r.getBoundingClientRect();
      res.push({ t, used: +box.width.toFixed(2), text: +tr.width.toFixed(2), shrink: getComputedStyle(el).flexShrink });
    }
    return res;
  });
  out.push({ W, rows });
  await ctx.close();
}
await b.close(); srv.close();
for (const o of out) {
  const bad = o.rows.filter(r => r.used + 0.5 < r.text);
  console.log(`${o.W}px  ${o.rows.length} time cell(s)  flex-shrink=${[...new Set(o.rows.map(r => r.shrink))].join('/')}  ` +
    `used=${[...new Set(o.rows.map(r => r.used))].join('/')}  text=${[...new Set(o.rows.map(r => r.text))].join('/')}  ` +
    `SQUEEZED BELOW TEXT: ${bad.length}`);
}
