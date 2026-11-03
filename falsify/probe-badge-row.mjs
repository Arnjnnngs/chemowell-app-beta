import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => { const _p = require('node:path');
  for (const c of ['playwright','/opt/node-tools/node_modules/playwright']) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found'); })();
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
const P = 'chemowell-app-p-p1-', now = Date.UTC(2026, 10, 3, 14, 0, 0);
const meds = { version: 2, archivedMeds: {}, meds: [
  { id: 'm1', name: 'Hydroxychloroquine', schedule: 'daily', times: ['08:00','10:00'], doses: [{ label: '200 mg', single: true }] } ] };
const entries = [
  { id: 'a', medId: 'm1', dose: '200 mg', ts: now - 3600000, override: true, overrideReason: 'offDay+early+overLimit', skipped: true },
  { id: 'b', medId: 'm1', dose: '200 mg', ts: now - 7200000 } ];
const b = await chromium.launch();
for (const W of [320, 330, 360, 390]) {
  const ctx = await b.newContext({ viewport: { width: W, height: 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
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
  await page.waitForTimeout(1400);
  const m = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('span')) {
      const t = (el.textContent || '').trim();
      if (!/Not scheduled|Skipped/.test(t)) continue;
      const r = el.getBoundingClientRect();
      const row = el.closest('[style*="flex"]');
      // The same comparison overflow-scan makes: the text's own rects against the element's box.
      const rg = document.createRange(); rg.selectNodeContents(el);
      let maxR = -1e9, minL = 1e9;
      for (const q of rg.getClientRects()) { if (q.width < 1 || q.height < 1) continue; maxR = Math.max(maxR, q.right); minL = Math.min(minL, q.left); }
      const over = Math.round(Math.max(0, maxR - r.right));
      out.push({ t: t.slice(0, 40), box: Math.round(r.width) + 'x' + Math.round(r.height),
        right: Math.round(r.right), textRight: Math.round(maxR), textOver: over,
        lines: rg.getClientRects().length, ws: getComputedStyle(el).overflowWrap + '/' + getComputedStyle(el).minWidth });
    }
    return { badges: out, docW: document.documentElement.scrollWidth, winW: window.innerWidth };
  });
  console.log(W + 'px  scrollWidth=' + m.docW + ' innerWidth=' + m.winW + (m.docW > m.winW ? '  ** HORIZONTAL OVERFLOW **' : '') +
    '  badges: ' + JSON.stringify(m.badges));
  // The badge sits ~1500px down the timeline, so a viewport screenshot at scroll 0 shows nothing.
  // Scroll it into view, then clip to the row's own band plus margin.
  const clip = await page.evaluate(() => {
    let t = null;
    for (const el of document.querySelectorAll('span')) {
      if (/Not scheduled/.test((el.textContent || '').trim())) { t = el; break; }
    }
    if (!t) return null;
    const card = t.closest('section') || t.parentElement.parentElement.parentElement;
    card.scrollIntoView({ block: 'center' });
    const r = card.getBoundingClientRect();
    // CLAMP TO THE VIEWPORT PROPERLY. The first version clamped width and height but not their
    // sum against the origin, so at 320px -- where the card is tallest, six wrapped lines of
    // badge -- x + width and y + height ran past the viewport and Playwright threw on the clip.
    // The measurements printed fine and the screenshot did not, which is the worst shape for a
    // probe: it looks like it worked. (app-v92 delta2 audit, F5.)
    const vw = window.innerWidth, vh = window.innerHeight;
    const x = Math.max(0, Math.min(r.left - 6, vw - 1));
    const y = Math.max(0, Math.min(r.top - 6, vh - 1));
    return { x, y, width: Math.max(1, Math.min(r.width + 12, vw - x)), height: Math.max(1, Math.min(r.height + 12, vh - y)) };
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: outDir + '/badge-row-' + W + '.png', ...(clip ? { clip } : {}) });
  await ctx.close();
}
await b.close(); srv.close();
