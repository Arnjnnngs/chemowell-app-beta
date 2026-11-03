import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => { for (const t of ['playwright','/opt/node22/lib/node_modules/playwright']) { try { return require(t); } catch(e){} } throw new Error('no playwright'); })();
const [base, out, tag] = process.argv.slice(2);
const seed = `(() => {
  const now = Date.now(); const e = [];
  for (let d = 0; d < 6; d++) {
    e.push({ id:'m'+d, medId:'med-1', name:'Blood pressure', kind:'med', ts: now-d*86400000-3600000, dose:'1 tablet' });
    e.push({ id:'w'+d, medId:'weight', ts: now-d*86400000-7200000, weight:150+d, unit:'lb', dose:(150+d)+' lb' });
    e.push({ id:'t'+d, medId:'temp', ts: now-d*86400000-9000000, temp:98.6+d*0.3, unit:'Fahrenheit', dose:(98.6+d*0.3).toFixed(1)+' F' });
  }
  localStorage.setItem('chemowell-app-profiles-v1', JSON.stringify({ list:[{id:'p1',name:'Alex',createdAt:1}], activeId:'p1' }));
  localStorage.setItem('chemowell-app-license-v1', JSON.stringify({ tier:'free' }));
  localStorage.setItem('chemowell-app-p-p1-prefs-v1', JSON.stringify({ patientName:'Alex', onboarded:true, treatmentType:'chemo', tourDone:true, installedAt: now-90*86400000 }));
  localStorage.setItem('chemowell-app-p-p1-med-v1', JSON.stringify({ version:2, archivedMeds:{}, meds:[{id:'med-1',name:'Blood pressure',schedule:'daily',times:['08:00','10:00'],doses:[{label:'1 tablet',single:true}]}] }));
  localStorage.setItem('chemowell-app-p-p1-entries-v1', JSON.stringify(e));
})()`;
const b = await chromium.launch();
const errs = [];
for (const w of [320, 360, 390]) {
  const c = await b.newContext({ viewport:{width:w,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
  c.on('page', pg => pg.on('pageerror', e2 => errs.push(w + ': ' + e2)));
  const p = await c.newPage();
  await p.addInitScript(seed);
  await p.goto(base, { waitUntil:'load' });
  await p.waitForTimeout(2400);
  const close = await p.$('[data-whatsnew-close="true"]'); if (close) { await close.click(); await p.waitForTimeout(400); }
  await p.screenshot({ path: out + '/' + tag + '-home-' + w + '.png' });
  await p.click('[data-tour="nav-reports"]'); await p.waitForTimeout(800);
  await p.screenshot({ path: out + '/' + tag + '-reports-' + w + '.png' });
  await p.evaluate(() => window.__v86Test.openReport('history')); await p.waitForTimeout(900);
  await p.screenshot({ path: out + '/' + tag + '-history-' + w + '.png' });
  await p.evaluate(() => window.__v86Test.openReport('weight')); await p.waitForTimeout(900);
  await p.screenshot({ path: out + '/' + tag + '-weight-' + w + '.png' });
  console.log(tag + ' ' + w + 'px captured');
  await c.close();
}
console.log('page errors: ' + errs.length + (errs.length ? ' -> ' + errs.slice(0,3).join(' | ') : ''));
await b.close();
