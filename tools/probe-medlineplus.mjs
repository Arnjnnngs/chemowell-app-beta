#!/usr/bin/env node
// probe-medlineplus.mjs -- a throwaway that exists because the machine that writes this code cannot
// reach the internet and the machine that runs it can.
//
// The first real run resolved ZERO page addresses, which is the failure the resolver was written to
// make loud. It did its job: nothing was written and the run went red. What it could not tell me is
// WHY, because I have never seen the page. This prints enough structure to find out, and is deleted
// once the resolver is fixed.
const UA = 'ChemoWell-table-builder (https://github.com/Arnjnnngs/chemowell-app-beta)';
const CANDIDATES = [
  'https://medlineplus.gov/druginformation.html',
  'https://medlineplus.gov/druginfo/drug_Aa.html',
  'https://medlineplus.gov/druginfo/meds/a601209.html'
];
for (const url of CANDIDATES) {
  console.log('\n=================== ' + url);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    console.log('status ' + res.status + '  final url ' + res.url);
    if (!res.ok) continue;
    const html = await res.text();
    console.log('bytes ' + html.length);
    const all = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]{0,60})</gi)];
    console.log('anchors: ' + all.length);
    const drug = all.filter(m => /druginfo/i.test(m[1]));
    console.log('anchors whose href contains "druginfo": ' + drug.length);
    console.log('--- first 12 of those ---');
    for (const m of drug.slice(0, 12)) console.log('   ' + m[1] + '   ==>   ' + m[2].trim());
    if (!drug.length) {
      console.log('--- no druginfo hrefs; first 15 anchors of any kind ---');
      for (const m of all.slice(0, 15)) console.log('   ' + m[1] + '   ==>   ' + m[2].trim());
      console.log('--- does the word appear at all? ---');
      console.log('   "druginfo" occurrences: ' + (html.match(/druginfo/gi) || []).length);
      console.log('   "drug_A" occurrences:   ' + (html.match(/drug_A/gi) || []).length);
    }
    // and on a real drug page, what the section looks like
    if (/meds\//.test(url)) {
      const i = html.search(/Why is this medication prescribed\?/i);
      console.log('"Why is this medication prescribed?" found at: ' + i);
      if (i >= 0) console.log('   next 300 chars: ' + html.slice(i, i + 300).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    }
  } catch (e) {
    console.log('THREW: ' + (e && e.message || e));
  }
}
