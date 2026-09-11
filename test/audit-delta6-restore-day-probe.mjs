// AUDIT PROBE (delta6): does the SINGLE-DAY fallback span suppress anything?
// Claim under test, shipped in index.html of all three apps, in all three patches, and in
// PM_app-v73.md / README.md:
//   "the span collapses to a single day and suppresses nothing"
//   "a single-day span, which suppresses nothing that matters"
// and the caregiver-facing toast on that same path:
//   "The app has no usable record of when you removed it, so the days it was away will still
//    show as missed."
import { createRequire } from 'node:module';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = (() => { const _p=require('node:path');
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright',
    _p.join(_p.dirname(process.execPath),'..','lib','node_modules','playwright')])
    { try { return require(c); } catch(e){} } throw new Error('playwright not found'); })();
const APP_FILE = process.argv[2] || '/home/user/care-tracker/index.html';
for (const v of ['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy'])
  if (process.env[v]) { console.error('REFUSING: '+v+' set.'); process.exit(3); }
let html = fs.readFileSync(APP_FILE,'utf8');
if (process.env.FALSIFY === '1') {
  const guard = "if ((med.awayPeriods || []).some(p => p && d0 >= dayStart(p.start) && d0 <= dayStart(p.end))) return;";
  const guard2 = html.indexOf(guard) >= 0 ? guard : null;
  if (!guard2) throw new Error('FALSIFY: guard line not found');
  html = html.replace(guard2, "// guard removed by FALSIFY");
  console.log('*** FALSIFY MODE: awayPeriods guard removed from the served copy ***');
}
{ const i = html.lastIndexOf('</script>');
  html = html.slice(0,i) + "\nwindow.__probe = { get state(){return state;}, missedDosesFor, dayStart, MISSED_TRACK_SINCE, restoreMedicationConfig, deleteMedicationConfig, buildExportRows, setState };\n" + html.slice(i); }
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
const VER=(html.match(/APP_VERSION\s*=\s*'([^']+)'/)||[])[1]||'';
await page.addInitScript(v=>{try{localStorage.setItem('caretracker-seen-version',v);}catch(e){}},VER);
await page.goto('http://127.0.0.1:'+PORT+'/index.html',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2500);

const MODE = process.argv[3] || 'none';   // none | future
const out = await page.evaluate(async (mode) => {
  const P = window.__probe; const { missedDosesFor, dayStart, MISSED_TRACK_SINCE } = P;
  const state = P.state;
  const now = Date.now();
  const today = dayStart(now);
  // late in the day, so windows that closed earlier today are already "missed"
  const lateToday = today + 23*3600000 + 59*60000;
  const counts = {};
  for (let d = today; d >= dayStart(MISSED_TRACK_SINCE); d = dayStart(d - 129600000))
    missedDosesFor(d, now).forEach(m => counts[m.medId] = (counts[m.medId]||0)+1);
  const tracked = state.meds.filter(m => m.alerts && m.windows);
  const target = tracked.slice().sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0))[0];
  if (!target) return { error:'no tracked med' };
  const id = target.id;
  const todayMissesBefore = missedDosesFor(today, lateToday).filter(m=>m.medId===id).length;
  // --- remove it (two taps) ---
  P.deleteMedicationConfig(id); await new Promise(r=>setTimeout(r,80));
  P.deleteMedicationConfig(id); await new Promise(r=>setTimeout(r,150));
  const arch = P.state.archivedMeds || {};
  if (!arch[id]) return { error:'archive missing after remove', keys:Object.keys(arch) };
  // simulate the two not-usable cases
  if (mode === 'none') delete arch[id].removedAt;            // archive from any pre-v75 build
  else arch[id].removedAt = now + 5*86400000;                // removal day five days in the future
  // --- bring it back (two taps) ---
  P.restoreMedicationConfig(id); await new Promise(r=>setTimeout(r,80));
  P.restoreMedicationConfig(id); await new Promise(r=>setTimeout(r,200));
  const med = P.state.meds.find(m=>m.id===id);
  const spans = (med && med.awayPeriods || []).map(s=>({start:s.start,end:s.end,
    startD:new Date(s.start).toISOString(), endD:new Date(s.end).toISOString(),
    backwards: s.start > s.end }));
  const toast = P.state.toast || (document.body.innerText.match(/is back[^\n]*/)||[])[0] || '';
  const todayMissesWithSpan = missedDosesFor(today, lateToday).filter(m=>m.medId===id).length;
  const withSpanAll = missedDosesFor(today, lateToday).length;
  const exportWith = P.buildExportRows(lateToday).length;
  // drop the span and re-measure, same build, same fixture
  const saved = med.awayPeriods; delete med.awayPeriods;
  const todayMissesNoSpan = missedDosesFor(today, lateToday).filter(m=>m.medId===id).length;
  const noSpanAll = missedDosesFor(today, lateToday).length;
  const exportNo = P.buildExportRows(lateToday).length;
  med.awayPeriods = saved;
  return { id, mode, spans, toast, todayMissesBefore, todayMissesWithSpan, todayMissesNoSpan,
           withSpanAll, noSpanAll, exportWith, exportNo,
           windows: (med.windows||[]).map(w=>w.name+' '+w.start+'-'+w.end) };
}, MODE);
console.log(JSON.stringify(out, null, 2));
console.log('page errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
