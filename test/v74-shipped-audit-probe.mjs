// Zero Day probe, app-v74 shipped. Hostile names + layout. Independent of test/v74-med-lookup.mjs.
import { createRequire } from 'node:module';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = (() => { const _p = require('node:path');
  for (const c of ['playwright', _p.join(_p.dirname(process.execPath),'..','lib','node_modules','playwright'),
    '/opt/node22/lib/node_modules/playwright','/home/claude/.npm-global/lib/node_modules/playwright'])
    { try { return require(c); } catch(e){} } throw new Error('no playwright'); })();
for (const v of ['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy'])
  if (process.env[v]) { console.error('REFUSING: '+v); process.exit(3); }
const APP = process.argv[2] || '/home/user/chemowell-app-beta/index.html';
const rawHtml = fs.readFileSync(APP,'utf8');
let pass=0, fail=0;
const t=(n,c,d)=>{console.log('  '+(c?'PASS  ':'FAIL  ')+n+(d?'  |  '+d:''));c?pass++:fail++;};
const server = http.createServer((rq,rs)=>{ if(rq.url.startsWith('/index.html')){rs.writeHead(200,{'Content-Type':'text/html'});rs.end(rawHtml);return;} rs.writeHead(204);rs.end();}).listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r));
const PORT = server.address().port;
const browser = await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});

const HOSTILE = [
  ['amp',        'Tylenol & Codeine'],
  ['hash',       'Med#3 Fragment'],
  ['question',   'What?query=evil'],
  ['dquote',     'Zo"fran onmouseover=alert(1) x="'],
  ['squote',     "Zo'fran' onclick='alert(1)"],
  ['script',     '<script>window.__pwn=1</script>'],
  ['imgonerr',   '<img src=x onerror=window.__pwn2=1>'],
  ['newline',    'Line1\nLine2\r\nLine3'],
  ['rtl',        'Med ‮gnp.exe'],
  ['emoji',      'Zofran 💊🧬'],
  ['long',       'Z'.repeat(500)],
  ['jsproto',    'javascript:alert(1)'],
  ['dataproto',  'data:text/html,<script>1</script>'],
  ['slashes',    '//evil.example.com/x'],
  ['backslash',  '\\\\evil.example.com\\x'],
  ['colonslash', 'https://evil.example.com/#'],
  ['pctenc',     '%3Cscript%3E%2F%2Fevil.com'],
  ['nullish',    'null'],
  ['ctor',       'constructor'],
  ['ws',         '   '],
  ['tabnl',      '\t\n '],
  ['empty',      ''],
];
const meds = HOSTILE.map(([id,name],i)=>({id:'m'+i,name,sub:'',type:'gap',gapH:6,doses:[{label:'1 tab',mg:0}]}));
const P='chemowell-app-p-p1-';
const seed = {meds, prefs:{patientName:'Test Patient',sex:'female',treatmentType:'chemo',tourDone:true,ceilingMg:2500,tempUnit:'Fahrenheit',weightUnit:'lbs',installedAt:Date.now()-30*86400000}};

async function openMeds(page){
  await page.goto('http://127.0.0.1:'+PORT+'/index.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(({P,seed})=>{ localStorage.clear();
    localStorage.setItem(P+'entries-v1',JSON.stringify([]));
    localStorage.setItem(P+'prefs-v1',JSON.stringify(seed.prefs));
    localStorage.setItem(P+'med-v1',JSON.stringify({version:1,meds:seed.meds,archivedMeds:{}}));
  },{P,seed});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1800);
  // navigate to Meds
  const reached = await page.evaluate(()=>document.querySelectorAll('button').length>5);
  if(!reached) console.log('  !! app did not get past first-run setup');
  const ok = await page.evaluate(()=>{
    const b=[...document.querySelectorAll('button')].find(x=>/^Meds$/.test((x.innerText||'').trim()));
    if(b){b.click();return true;} return false;});
  await page.waitForTimeout(900);
  return ok;
}

const pageErrors=[]; const offDevice=[];
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror',e=>pageErrors.push(String(e && e.message)));
await ctx.route('**/*',r=>{ const u=r.request().url();
  if(!/127\.0\.0\.1|localhost/.test(u)) { offDevice.push(u); return r.abort(); } r.continue(); });
await openMeds(page);

console.log('\n1. HOSTILE MEDICATION NAMES -> the href');
const rows = await page.evaluate(()=>[...document.querySelectorAll('[data-med-source]')].map(a=>({
  id:a.getAttribute('data-med-source'), href:a.href, rawHref:a.getAttribute('href'),
  proto:(()=>{try{return new URL(a.href).protocol}catch(e){return 'INVALID'}})(),
  host:(()=>{try{return new URL(a.href).host}catch(e){return 'INVALID'}})(),
  text:a.textContent, html:a.outerHTML.slice(0,300)})));
const cards = await page.evaluate(()=>document.querySelectorAll('article').length);
console.log('  (cards rendered: '+cards+', source links: '+rows.length+')');
t('every link that rendered is https', rows.every(r=>r.proto==='https:'), rows.filter(r=>r.proto!=='https:').map(r=>r.id+'='+r.href).join(' | ')||'all https');
t('every link that rendered points at medlineplus.gov and nowhere else',
  rows.every(r=>r.host==='medlineplus.gov'), rows.filter(r=>r.host!=='medlineplus.gov').map(r=>r.id+'='+r.host).join(' | ')||'all medlineplus.gov');
t('no javascript: or data: URL is reachable from any name',
  rows.every(r=>!/^(javascript|data|vbscript):/i.test(r.rawHref||'')), rows.filter(r=>/^(javascript|data|vbscript):/i.test(r.rawHref||'')).map(r=>r.id).join(' | ')||'none');
t('no raw & # ? " \' < > or newline survives unencoded into the href',
  rows.every(r=>!/["'<>\s]/.test((r.rawHref||'').replace(/^https:\/\/medlineplus\.gov\/search\/\?query=/,''))
            && !/[&#?]/.test((r.rawHref||'').replace(/^https:\/\/medlineplus\.gov\/search\/\?query=/,''))),
  rows.filter(r=>/["'<>\s&#?]/.test((r.rawHref||'').replace(/^https:\/\/medlineplus\.gov\/search\/\?query=/,''))).map(r=>r.id+'='+r.rawHref).join(' | ')||'all encoded');
const pwn = await page.evaluate(()=>({a:!!window.__pwn,b:!!window.__pwn2, scripts:[...document.querySelectorAll('article script')].length, imgs:[...document.querySelectorAll('article img')].length}));
t('no markup injected from a name (no script ran, no element created)', !pwn.a&&!pwn.b&&pwn.scripts===0&&pwn.imgs===0, JSON.stringify(pwn));
t('no page error while rendering any hostile name', pageErrors.length===0, pageErrors.slice(0,3).join(' | ')||'none');
t('nothing left the device during all of this', offDevice.filter(u=>!/cdn\.jsdelivr\.net/.test(u)).length===0, offDevice.join(' | ')||'none');
const cdn = [...new Set(offDevice)];
console.log('  (blocked off-device URLs seen: '+(cdn.join(' | ')||'none')+')');

console.log('\n2. EMPTY / WHITESPACE-ONLY NAME');
const wsRow = rows.find(r=>r.id==='m19'); const tabRow = rows.find(r=>r.id==='m20'); const emptyRow=rows.find(r=>r.id==='m21');
t('a whitespace-only name renders NO link (not a broken one)', !wsRow && !tabRow, JSON.stringify({ws:wsRow&&wsRow.href,tab:tabRow&&tabRow.href}));
t('an empty name renders NO link', !emptyRow, emptyRow?emptyRow.href:'(none)');
const emptyQ = rows.filter(r=>/query=$/.test(r.rawHref||''));
t('no link anywhere ends in an empty query', emptyQ.length===0, emptyQ.map(r=>r.id).join(' | ')||'none');

console.log('\n3. THE 500-CHARACTER NAME');
const longRow = rows.find(r=>r.id==='m10');
t('a 500-char name still builds a single well-formed medlineplus URL', !!longRow && longRow.host==='medlineplus.gov' && longRow.rawHref.length>500, longRow?('len='+longRow.rawHref.length):'(no link)');

console.log('\n4. LAYOUT at 320 / 360 / 390 with long names and long descriptions');
const LONGDESC = [{id:'d1',name:'Dexamethasone Sodium Phosphate Injection USP 10 mg per mL',sub:'a very long generic name that keeps going and going for a while',purpose:'A corticosteroid used alongside chemotherapy to reduce nausea, swelling and allergic reactions; it is often taken for a few days around each treatment and can affect sleep and blood sugar.',type:'gap',gapH:6,doses:[{label:'1 tab',mg:0}]},
  {id:'d2',name:'Zofran',sub:'Ondansetron',type:'gap',gapH:8,doses:[{label:'4 mg',mg:4}]}];
for (const w of [320,360,390]) {
  const p2 = await ctx.newPage();
  p2.on('pageerror',e=>pageErrors.push('layout'+w+': '+e.message));
  await p2.setViewportSize({width:w,height:760});
  await p2.goto('http://127.0.0.1:'+PORT+'/index.html',{waitUntil:'domcontentloaded'});
  await p2.evaluate(({P,meds,prefs})=>{localStorage.clear();
    localStorage.setItem(P+'entries-v1',JSON.stringify([]));
    localStorage.setItem(P+'prefs-v1',JSON.stringify(prefs));
    localStorage.setItem(P+'med-v1',JSON.stringify({version:1,meds,archivedMeds:{}}));},{P,meds:LONGDESC,prefs:seed.prefs});
  await p2.reload({waitUntil:'domcontentloaded'});
  await p2.waitForTimeout(900);
  await p2.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^Meds$/.test((x.innerText||'').trim()));if(b)b.click();});
  await p2.waitForTimeout(900);
  const m = await p2.evaluate(()=>{
    const de=document.documentElement;
    const link=document.querySelector('[data-med-source]');
    const lr=link?link.getBoundingClientRect():null;
    const card=link?link.closest('article'):null; const cr=card?card.getBoundingClientRect():null;
    const nav=[...document.querySelectorAll('nav,[data-nav],footer')].map(n=>{const r=n.getBoundingClientRect();return {w:r.width,bottom:r.bottom,h:r.height};});
    // widest element on the page
    let widest=0, who='';
    for(const el of document.querySelectorAll('*')){const r=el.getBoundingClientRect(); if(r.width>widest){widest=r.width;who=el.tagName+'.'+(el.getAttribute('data-med-source')||el.className||'');}}
    return {scrollW:de.scrollWidth, clientW:de.clientWidth, widest, who,
      link: lr&&{x:lr.x,right:lr.right,w:lr.width,h:lr.height},
      card: cr&&{x:cr.x,right:cr.right,w:cr.width},
      linkInsideCard: !!(lr&&cr&&lr.right<=cr.right+0.5&&lr.x>=cr.x-0.5), nav};
  });
  console.log('  '+w+'px -> scrollWidth='+m.scrollW+' clientWidth='+m.clientW+' widest='+Math.round(m.widest)+' ('+m.who+')');
  t(w+'px: page does not scroll horizontally', m.scrollW<=m.clientW+1, 'scrollW='+m.scrollW+' clientW='+m.clientW);
  t(w+'px: the lookup link is at least 44px tall', !!m.link&&m.link.h>=43.5, m.link?('h='+m.link.h.toFixed(1)):'(no link)');
  t(w+'px: the link stays inside its card', m.linkInsideCard, JSON.stringify({link:m.link,card:m.card}));
  await p2.screenshot({path:'/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/zd-v74-'+w+'.png',fullPage:true});
  await p2.close();
}

console.log('\n5. FALSIFICATION -- break it and watch the checks go red');
{
  const broken = rawHtml.replace(
    "return 'https://medlineplus.gov/search/?query=' + encodeURIComponent(String(name || '').trim());",
    "return 'https://medlineplus.gov/search/?query=' + String(name || '').trim();");
  if (broken === rawHtml) { t('mutant A applied (encodeURIComponent removed)', false, 'anchor not found'); }
  else {
    const srv2 = http.createServer((rq,rs)=>{ if(rq.url.startsWith('/index.html')){rs.writeHead(200,{'Content-Type':'text/html'});rs.end(broken);return;} rs.writeHead(204);rs.end();}).listen(0,'127.0.0.1');
    await new Promise(r=>srv2.once('listening',r)); const P2=srv2.address().port;
    const p3 = await ctx.newPage();
    await p3.goto('http://127.0.0.1:'+P2+'/index.html',{waitUntil:'domcontentloaded'});
    await p3.evaluate(({P,meds,prefs})=>{localStorage.clear();
      localStorage.setItem(P+'entries-v1',JSON.stringify([]));localStorage.setItem(P+'prefs-v1',JSON.stringify(prefs));
      localStorage.setItem(P+'med-v1',JSON.stringify({version:1,meds,archivedMeds:{}}));},{P,meds:seed.meds,prefs:seed.prefs});
    await p3.reload({waitUntil:'domcontentloaded'}); await p3.waitForTimeout(900);
    await p3.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^Meds$/.test((x.innerText||'').trim()));if(b)b.click();});
    await p3.waitForTimeout(900);
    const mrows = await p3.evaluate(()=>[...document.querySelectorAll('[data-med-source]')].map(a=>({id:a.getAttribute('data-med-source'),rawHref:a.getAttribute('href'),host:(()=>{try{return new URL(a.href).host}catch(e){return 'INVALID'}})()})));
    const badHost = mrows.filter(r=>r.host!=='medlineplus.gov');
    const badEnc = mrows.filter(r=>/["'<>\s&#?]/.test((r.rawHref||'').replace(/^https:\/\/medlineplus\.gov\/search\/\?query=/,'')));
    t('MUTANT: without encodeURIComponent the encoding check GOES RED', badEnc.length>0, badEnc.length+' bad hrefs e.g. '+(badEnc[0]?badEnc[0].rawHref:''));
    t('MUTANT: and at least one name escapes medlineplus.gov entirely', badHost.length>0, badHost.map(r=>r.id+'='+r.host).join(' | ')||'(none -- check is weaker than claimed)');
    await p3.close(); srv2.close();
  }
}
await browser.close(); server.close();
console.log('\n'+pass+'/'+(pass+fail)+' checks passed'+(fail?'   <-- FAIL':''));
process.exit(fail?1:0);
