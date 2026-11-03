// The DESIGNER seat for app-v90. The two chart report screens, at 320/360/390, both label formats,
// screenshots to disk and every drawn label measured against the drawing's own bounds.
//
// IT RUNS LATE AND THAT IS A RULE 1.5 BREACH, stated here rather than left for the gate to find:
// design-time seats run BEFORE the build, on the screens about to change. This one runs after
// three audit passes and a PM refusal, and the PM refusal is the only reason it ran at all.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('path');
  for (const t of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { return require(t); } catch (e) {} }
  throw new Error('playwright not found');
})();
const OUT = process.argv[2];
const BASE = 'http://127.0.0.1:8899/index.html';
const DAY = 86400000, HOUR = 3600000;
const b = await chromium.launch();
const thrown = [];
let bad = 0;

const CHARTS = [
  { key: 'temp',   name: 'Temperature', mk: (ts, i) => ({ id: 't' + i, medId: 'temp', ts, temp: 99 + i * 0.4, unit: 'Fahrenheit', dose: (99 + i * 0.4).toFixed(1) + ' °F' }) },
  { key: 'weight', name: 'Weight',      mk: (ts, i) => ({ id: 'w' + i, medId: 'weight', ts, weight: 150 + i, unit: 'lb', dose: (150 + i) + ' lb' }) },
];
const seed = (entries) => `(() => {
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list: [{ id: 'p1', name: 'Alex', createdAt: 1 }], activeId: 'p1' }));
  localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier: 'free' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName: 'Alex', onboarded: true, treatmentType: 'chemo', tourDone: true, installedAt: Date.now() - 90*86400000 }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version: 2, archivedMeds: {}, meds: [] }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify(${JSON.stringify(entries)}));
  localStorage.setItem('chemowell-app-seen-version', 'app-v90');
})()`;

// Fixtures relative to now, clamped so they never land before midnight -- the lesson the suite
// already carries: an absolute hour makes a fixture true only at some hours of the day.
const ago = (h) => { const n = Date.now(); const m = new Date(); m.setHours(0,0,0,0);
  return Math.max(n - h * HOUR, m.getTime() + 60000); };

const FIXTURES = [
  { tag: 'times', note: 'three readings this morning -- the NEW label format, and the widest labels the axis draws',
    mk: (c) => [c.mk(ago(4), 0), c.mk(ago(2.5), 1), c.mk(ago(1), 2)] },
  { tag: 'dates', note: 'a reading a week for four weeks -- the ordinary dated axis',
    mk: (c) => [0, 7, 14, 21, 27].map((d, i) => c.mk(ago(1) - (27 - d) * DAY, i)) },
];

for (const w of [320, 360, 390]) {
  for (const chart of CHARTS) {
    for (const fx of FIXTURES) {
      const c = await b.newContext({ viewport: { width: w, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      c.on('page', (p2) => p2.on('pageerror', (e) => thrown.push(w + ' ' + chart.key + ' ' + fx.tag + ': ' + String(e))));
      const pg = await c.newPage();
      await pg.addInitScript(seed(fx.mk(chart)));
      await pg.goto(BASE, { waitUntil: 'load' });
      await pg.waitForTimeout(2200);
      const ok = await pg.evaluate((k) => {
        if (!(window.__v86Test && window.__v86Test.openReport)) return 'no hook';
        window.__v86Test.openReport(k); return 'ok';
      }, chart.key);
      if (ok !== 'ok') { thrown.push('openReport hook missing'); await c.close(); continue; }
      await pg.waitForTimeout(900);
      const name = chart.key + '-' + fx.tag + '-' + w;
      await pg.screenshot({ path: OUT + '/' + name + '.png', fullPage: true });
      // EVERY DRAWN LABEL IN THE CHART, not just the axis: the release moved pad.right, which
      // moves the y labels and the threshold line's label too.
      const m = await pg.evaluate(() => {
        const ax = [...document.querySelectorAll('[data-xaxis]')];
        const svg = ax.length ? ax[0].closest('svg') : null;
        if (!svg) return null;
        const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
        const texts = [...svg.querySelectorAll('text')].map(n => {
          let box = null; try { const g = n.getBBox(); box = [Math.round(g.x*10)/10, Math.round((g.x+g.width)*10)/10]; } catch (e) {}
          return { s: (n.textContent||'').trim(), box: box, axis: n.hasAttribute('data-xaxis') };
        });
        const r = svg.getBoundingClientRect();
        return { vbW: vb[2], vbH: vb[3], cssW: Math.round(r.width*10)/10, texts: texts };
      });
      if (!m) { thrown.push(name + ': no chart svg'); await c.close(); continue; }
      const out = m.texts.filter(x => x.box && (x.box[0] < 0 || x.box[1] > m.vbW));
      const xlab = m.texts.filter(x => x.axis).map(x => x.s);
      console.log('--- ' + name + '  svg ' + m.cssW + 'css / ' + m.vbW + 'vb   x-axis ' + JSON.stringify(xlab));
      console.log('    widest drawn text: ' + JSON.stringify(m.texts.filter(x=>x.box).sort((p,q)=>(q.box[1]-q.box[0])-(p.box[1]-p.box[0]))[0]));
      console.log('    rightmost edge reached: ' + Math.max(...m.texts.filter(x=>x.box).map(x=>x.box[1])) + ' of ' + m.vbW);
      if (out.length) { bad++; console.log('    *** OUTSIDE THE DRAWING: ' + JSON.stringify(out)); }
      await c.close();
    }
  }
}
console.log('\npage errors: ' + thrown.length + (thrown.length ? ' -> ' + thrown.slice(0,3).join(' | ') : ''));
console.log('labels drawn outside the chart: ' + bad);
await b.close();
process.exit(bad || thrown.length ? 1 : 0);
