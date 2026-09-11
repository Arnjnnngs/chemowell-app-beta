// AUDIT PROBE (delta5): which surfaces does an awayPeriods span actually change?
// Claim under test (index.html ~line 306, and README/HANDOFF/STATUS):
//   "a span changes only what the missed-dose banner COUNTS ... the export reads the entries
//    themselves ... The worst case is under-reporting on one screen".
import { createRequire } from 'node:module';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = (() => { const _p=require('node:path');
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright',
    _p.join(_p.dirname(process.execPath),'..','lib','node_modules','playwright')])
    { try { return require(c); } catch(e){} } throw new Error('playwright not found'); })();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_FILE = process.argv[2] || '/home/user/care-tracker/index.html';
for (const v of ['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy'])
  if (process.env[v]) { console.error('REFUSING: '+v+' set.'); process.exit(3); }
let html = fs.readFileSync(APP_FILE,'utf8');
// Expose the module's internals to the probe WITHOUT touching the file on disk: the served copy
// only. Nothing here changes behaviour -- it appends one assignment at the end of the module.
if (process.env.FALSIFY === '1') {
  const guard = "if ((med.awayPeriods || []).some(p => p && d0 >= dayStart(p.start) && d0 <= dayStart(p.end))) return;";
  if (html.indexOf(guard) < 0) throw new Error('FALSIFY: guard line not found -- probe is out of date');
  html = html.replace(guard, "// guard removed by FALSIFY");
  console.log('*** FALSIFY MODE: awayPeriods guard removed from the served copy ***');
}
{ const i = html.lastIndexOf('</script>');
  if (i < 0) throw new Error('no closing script tag');
  html = html.slice(0,i) + "\nwindow.__probe = { get state(){return state;}, missedDosesFor, buildExportRows, dayStart, MISSED_TRACK_SINCE };\n" + html.slice(i); }
const stubFs = `
const store={entries:[],prefs:{}};const eL=[],pL=[];let n=0;
function snap(l){return{docs:l.map(e=>({id:e.id,data:()=>{const c=Object.assign({},e);delete c.id;return c;}}))};}
export function getFirestore(){return{__db:true};} export function collection(){return{__kind:'col'};}
export function doc(db,col,id){return{__kind:'doc',id:id};} export function query(){return{__kind:'q'};}
export function orderBy(){return{};}
export function onSnapshot(ref,cb){if(ref&&ref.__kind==='q'){eL.push(cb);cb(snap(store.entries));return()=>{};}
pL.push(cb);cb({exists:()=>false,data:()=>({})});return()=>{};}
export async function addDoc(c,d){store.entries.push(Object.assign({id:'a'+(++n)},d));eL.forEach(f=>f(snap(store.entries)));return{id:'a'+n};}
export async function deleteDoc(){} export async function setDoc(){}
export async function getDocs(){return snap(store.entries);} export function serverTimestamp(){return Date.now();}`;
const STUB_APP = `export function initializeApp(c){return{name:'[DEFAULT]',options:c};}`;
const STUB_MSG = `export function getMessaging(){throw new Error('off');}
export async function getToken(){return null;} export function onMessage(){return()=>{};}`;
const server = http.createServer((rq,rs)=>{ if(rq.url.startsWith('/index.html')){rs.writeHead(200,{'Content-Type':'text/html'});rs.end(html);return;} rs.writeHead(204);rs.end(); }).listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r)); const PORT=server.address().port;
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, serviceWorkers:'block' });
await ctx.route('**/*', route => { const u=route.request().url();
  if(u.includes('firebase-app.js')) return route.fulfill({status:200,contentType:'application/javascript',body:STUB_APP});
  if(u.includes('firebase-firestore.js')) return route.fulfill({status:200,contentType:'application/javascript',body:stubFs});
  if(u.includes('firebase-messaging.js')) return route.fulfill({status:200,contentType:'application/javascript',body:STUB_MSG});
  if(u.startsWith('http://127.0.0.1:'+PORT)) return route.continue(); return route.abort(); });
const page = await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const VER=(html.match(/const APP_VERSION = '([^']+)'/)||[])[1]||'';
await page.addInitScript(v=>{try{localStorage.setItem('caretracker-seen-version',v);}catch(e){}},VER);
await page.goto('http://127.0.0.1:'+PORT+'/index.html',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2500);

const measure = async (spanDays) => page.evaluate((days) => {
  const P = window.__probe; const { missedDosesFor, buildExportRows, dayStart, MISSED_TRACK_SINCE } = P; const state = P.state;
  const now = Date.now();
  const tracked = state.meds.filter(m => m.alerts && m.windows);
  // Pick the medication that actually carries missed doses, so the measurement is not taken on a
  // med that contributes nothing (dexamethasone is chemoOnly and the fixture has no chemo days).
  const counts = {};
  for (let d = dayStart(Date.now() - 0); d >= dayStart(MISSED_TRACK_SINCE); d = dayStart(d - 129600000))
    missedDosesFor(d, Date.now()).forEach(m => counts[m.medId] = (counts[m.medId]||0)+1);
  const target = tracked.slice().sort((a,b) => (counts[b.id]||0)-(counts[a.id]||0))[0];
  if (!target) return { error: 'no tracked med' };
  if (days > 0) target.awayPeriods = [{ start: dayStart(now - days*86400000), end: dayStart(now) }];
  else delete target.awayPeriods;
  // 1. banner total
  const banner = (function(){ let n=0;
    for (let d = dayStart(MISSED_TRACK_SINCE); d <= dayStart(now); d = dayStart(d+129600000))
      n += missedDosesFor(d, now).length; return n; })();
  // 2. clinician export / CSV backup
  const rows = buildExportRows(now);
  const exportTotal = rows.length;
  const exportNotLogged = rows.filter(r => JSON.stringify(r).indexOf('not logged') >= 0).length;
  // 3. History day summaries (days carrying a MISSED count)
  const daysWithMiss = (function(){ let n=0;
    for (let d = dayStart(MISSED_TRACK_SINCE); d <= dayStart(now); d = dayStart(d+129600000))
      if (missedDosesFor(d, now).length) n++; return n; })();
  const perDay = {};
  for (let d = dayStart(MISSED_TRACK_SINCE); d <= dayStart(now); d = dayStart(d+129600000))
    perDay[d] = missedDosesFor(d, now).length;
  return { med: target.id, banner, exportTotal, exportNotLogged, daysWithMiss, perDay };
}, spanDays);

const before = await measure(0);
const after  = await measure(14);
console.log('WITHOUT span :', JSON.stringify(before));
console.log('WITH 14d span:', JSON.stringify(after));
const changedDays = Object.keys(before.perDay).filter(k => before.perDay[k] !== after.perDay[k]).length;
console.log('History day summaries whose MISSED count changed: ' + changedDays);
console.log('DELTA        : banner ' + (before.banner-after.banner) +
  ' | export rows ' + (before.exportTotal-after.exportTotal) +
  ' | export "not logged" rows ' + (before.exportNotLogged-after.exportNotLogged) +
  ' | History days with a miss ' + (before.daysWithMiss-after.daysWithMiss));
console.log('page errors  :', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
