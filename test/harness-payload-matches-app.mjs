// THE PATCH SCRIPT'S PAYLOAD MUST STILL BE THE APP'S OWN TEXT.
//
// harness-v84-whatsnew.py embeds several blocks of index.html verbatim, precisely because the
// hand-retyped versions drifted from the app FIVE times in one release. But "lifted verbatim" is a
// claim about the day it was lifted, not a property that holds: the app moved one character
// twenty minutes later -- `'chemowell-app'` gained its hyphen -- and the script went straight back
// to rebuilding a file the app no longer is, silently, with the boot gate still green because a
// stale-but-valid file boots perfectly well.
//
// So the guarantee gets a mechanism instead of a good intention. Every r""" block the script
// embeds must appear in index.html EXACTLY ONCE. If the app changes and the script is not
// re-extracted, this goes red the same day rather than at the next release.
//
// It deliberately does NOT require base + patch to equal HEAD -- fourteen commits of audit fixes
// have no patch scripts, which README.md records. It requires only that what the script DOES claim
// to copy is still a copy.
import { readFileSync } from 'node:fs';

const app = readFileSync('index.html', 'utf8');
const script = readFileSync('harness-v84-whatsnew.py', 'utf8');

// Pull every  NAME = r"""...."""  payload out of the patch script.
// The pattern allows anything between `=` and the `r"""` because MOVED_HOOKS is written as
// `MOVED_HOOKS = "\n" + r"""..."""`. The first version of this check anchored on `= r"""` and so
// silently covered three of the four payloads -- the hook block, which had ALREADY drifted once in
// this release (four hooks where the app exports five), was the one it could not see. A check that
// reports a clean board while blind to the block with the worst record is the exact defect class
// this file exists to catch, committed inside the catcher on its first run.
const blocks = [...script.matchAll(/^([A-Z_]+) = [^\n]*?r"""([\s\S]*?)"""/gm)]
  .map(([, name, body]) => ({ name, body }));

const EXPECTED = ['SURVIVORS', 'SNAPSHOT', 'BLOCK', 'MOVED_HOOKS'];
const missing = EXPECTED.filter((n) => !blocks.some((b) => b.name === n));
if (missing.length) {
  console.log(`  FAIL  these payloads were not matched at all: ${missing.join(', ')}`);
  console.log('        a payload this check cannot see is a payload nothing is checking.');
  process.exit(1);
}

if (blocks.length === 0) {
  console.log('  FAIL  no r""" payload blocks found in harness-v84-whatsnew.py -- has it been rewritten?');
  process.exit(1);
}

let pass = 0, fail = 0;
for (const { name, body } of blocks) {
  // MOVED_HOOKS carries the module's closing </script>, which is not part of the block in the app.
  const needle = body.replace(/\n?<\/script>\s*$/, '').trim();
  const n = app.split(needle).length - 1;
  if (n === 1) {
    pass++;
    console.log(`  ok    ${name} (${needle.split('\n').length} lines) appears once in index.html`);
  } else {
    fail++;
    console.log(`  FAIL  ${name} appears ${n} times in index.html -- the patch script has drifted`);
    console.log(`        re-extract it from index.html; do not hand-edit it back into agreement.`);
    const first = needle.split('\n').find((l) => l.trim() && !app.includes(l));
    if (first) console.log(`        first line not found in the app: ${first.trim().slice(0, 100)}`);
  }
}
console.log(`\n${pass + fail} checks: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
