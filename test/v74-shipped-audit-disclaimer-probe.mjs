import { createRequire } from 'node:module';
import http from 'node:http'; import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const rawHtml = fs.readFileSync('/home/user/chemowell-app-beta/index.html','utf8');
const server = http.createServer((rq,rs)=>{ if(rq.url.startsWith('/index.html')){rs.writeHead(200,{'Content-Type':'text/html'});rs.end(rawHtml);return;} rs.writeHead(204);rs.end();}).listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r)); const PORT=server.address().port;
const browser = await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
const P='chemowell-app-p-p1-';
const PREFS={patientName:'Test Patient',sex:'female',treatmentType:'chemo',tourDone:true,ceilingMg:2500,tempUnit:'Fahrenheit',weightUnit:'lbs',installedAt:Date.now()-30*86400000};
async function run(label, meds, width){
  const ctx = await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await ctx.route('**/*',r=>{const u=r.request().url(); if(u.startsWith('http://127.0.0.1:'+PORT)||u.startsWith('data:')||u.startsWith('blob:'))return r.continue(); return r.abort();});
  const page = await ctx.newPage();
  await page.addInitScript(([p,meds,prefs])=>{ if(localStorage.getItem(p+'prefs-v1'))return;
    localStorage.setItem(p+'entries-v1',JSON.stringify([]));
    localStorage.setItem(p+'prefs-v1',JSON.stringify(prefs));
    localStorage.setItem(p+'med-v1',JSON.stringify({version:1,meds,archivedMeds:{}}));},[P,meds,PREFS]);
  await page.goto('http://127.0.0.1:'+PORT+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1800);
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^Meds$/.test((x.innerText||'').trim()));if(b)b.click();});
  await page.waitForTimeout(900);
  const r = await page.evaluate(()=>({
    disclaimer: (()=>{const d=document.querySelector('[data-med-disclaimer]');return d?(d.innerText||'').trim():null;})(),
    links: [...document.querySelectorAll('[data-med-source]')].map(a=>({id:a.getAttribute('data-med-source'),h:Math.round(a.getBoundingClientRect().height),w:Math.round(a.getBoundingClientRect().width),text:(a.innerText||'').trim()})),
    purposes: document.querySelectorAll('[data-med-purpose]').length,
    cards: document.querySelectorAll('article').length }));
  console.log('\n'+label+' @'+width+'px');
  console.log('  cards='+r.cards+' descriptions='+r.purposes+' links='+r.links.length);
  console.log('  DISCLAIMER: '+(r.disclaimer? JSON.stringify(r.disclaimer.slice(0,200)) : '*** NONE ON SCREEN ***'));
  console.log('  link boxes: '+JSON.stringify(r.links));
  await page.screenshot({path:'/tmp/claude-0/-home-user/41e5d279-40d0-5a8a-b4e0-827057dd9522/scratchpad/disc-'+label.replace(/\W+/g,'-')+'-'+width+'.png',fullPage:true});
  await ctx.close();
}
const UNKNOWN=[{id:'a',name:'Qqzzxw Forte',sub:'',type:'gap',gapH:24,doses:[{label:'1 inj',mg:0}]},
               {id:'b',name:'Vbnmqq XR',sub:'',type:'gap',gapH:24,doses:[{label:'1 inf',mg:0}]}];
const KNOWN=[{id:'z',name:'Zofran',sub:'Ondansetron',type:'gap',gapH:8,doses:[{label:'4 mg',mg:4}]}];
await run('ALL-UNRECOGNISED', UNKNOWN, 360);
await run('ONE-RECOGNISED', KNOWN.concat(UNKNOWN), 360);
await run('ALL-UNRECOGNISED', UNKNOWN, 320);
await run('ONE-RECOGNISED', KNOWN.concat(UNKNOWN), 320);
await browser.close(); server.close();
