AUDITED-COMMIT: 65bcb2c
VERDICT: SHIP

Delta-4 re-clearance of ChemoWell app-v88, `git diff 64bb8a6..65bcb2c`, branch
`claude/caretracker-team-review-i83ik2`.

**All three confirmations hold: the `index.html` delta is the two changelog edits and nothing else,
7z genuinely reads rendered text rather than source, and nothing else in the diff touches
behaviour. You were right to be suspicious of your own pattern — I spent the mutant where you asked
and 7z is defeated by `*single*`, `_underscore_` and `[link](url)`, all of which render literally
exactly as `**` did, plus it scans one entry of nine. No caregiver of this build can hit any of
that: every one of the 64 changelog strings across all nine entries is plain prose, which I
checked precisely because a guard this narrow would not have told me.**

`index.html` md5 `6c24a321c5cb91db811896a3043c1b07` before and after; nothing edited, committed or
staged. Mutants served from byte copies on ports 8900/8901 via `FALSIFY_BASE`.

**Before anything else: this one was my miss, four times over, and not a subtle one.** The PM is
right that every reviewer read the array as source. I did worse than that — in my delta-1 probe I
dumped `document.body.innerText` from a real browser and the output I read contained
*"…screens now have \*\*Log another day\*\*: pick the day, pick the answer, done."* The asterisks
were in **rendered** text, in my own tool output, in round one. I was reading that dump for row
values and treated the changelog block as background noise. Re-rendering `64bb8a6` just now to
confirm it rather than assert it:

    64bb8a6  literal markdown characters in the rendered notice: ["*","*","*","*"]
    65bcb2c  literal markdown characters in the rendered notice: []

A dump I scanned for one thing is not a page I looked at. That belongs in the record next to the
Designer seat, because it is the same lesson: output nobody reads as a whole is not coverage.

---

# 1. The `index.html` delta is the two changelog edits and nothing else — confirmed

`git diff --name-only 64bb8a6..65bcb2c` outside `*.md`, `test/` and `outputs/` returns **`index.html`
alone**, and its whole diff is three lines inside `CHANGELOG`: the bullet reworded to
`a “Log another day” button`, and the fourth bullet deleted. No other line of the file moved.

**The deleted bullet leaves a trailing comma, and I checked what that parses to**, because an empty
fourth point would be a new caregiver-visible defect introduced by the fix for one:

- The v88 `points` array is **3 elements**, not 4 — a trailing comma in an array literal does not
  create a hole.
- Rendered: three bullets, no blank one, no stray punctuation.
- No `pageerror` on boot. (The console shows `ERR_NAME_NOT_RESOLVED` for external fonts — this
  sandbox has no outbound DNS. Environment, not the file; the suites listen on `pageerror`, which
  is silent.)

**On the second edit — deleting the dead-code bullet.** I agree with it and it is worth saying why
in the record rather than nodding it through: *"Two unused pieces of the old correction code are
gone. Neither was reachable"* is the Voice's question 2 failing in one sentence. It tells a tired
person at 2am that something they cannot see changed, which invites exactly the worry it cannot
answer. Removing it is a copy fix, not a scope reduction — nothing a caregiver can do changed.

# 2. Nothing else in the diff touches behaviour — confirmed

`BACKLOG.md`, `TEAM.md`, four `outputs/*.md`, twelve PNGs, and two test files. The
`test/v88-log-a-missed-day.mjs` change inside this range is exactly the two edits that landed in
`c1eb3d0` — dropping the dead line-116 `noteShown` capture and tightening 7g's precondition to
`again === true` — both of which I reviewed and asked for last round, and **v88 is 58/58 on HEAD**,
re-run here.

# 3. 7z is real, and it reads the rendered page — confirmed

The main check takes `document.querySelector('[data-whatsnew-modal]').innerText`. That is the
rendered notice, not the array, which is the whole point of it. Not vacuous, with a clean baseline
to measure against:

    BASELINE (unmutated, byte copy)  99/99
    MD  `**Log another day**` restored   ->  2 red, naming the string
    MC  `` `Log another day` ``          ->  2 red, naming the string

Your falsification reproduces exactly.

---

# F1 — 7z is defeated by markdown that renders differently. You were right to ask.

**Severity: guard breadth. Nothing live — see F3.**

I spent the mutant where you pointed and then widened it to the whole family. Every one of these
renders as literal characters on the phone in precisely the way `**` did:

| Mutant | Rendered as | Result |
|---|---|---|
| MD `**Log another day**` | `**Log another day**` | **2 red — caught** |
| MC `` `Log another day` `` | `` `Log another day` `` | **2 red — caught** |
| **MA `*Log another day*`** | `*Log another day*` | **99/99 CLEAN PASS** |
| **MB `_Log another day_`** | `_Log another day_` | **99/99 CLEAN PASS** |
| **MF `[Log another day](#reports)`** | `[Log another day](#reports)` | **99/99 CLEAN PASS** |

The pattern is `/\*\*|`|^\s*[*_]\s/gm`. The third alternative only fires on a **line-initial**
`*` or `_` followed by whitespace — a list bullet — so mid-sentence emphasis slips past both of the
first two. A single asterisk pair is the most likely next instance of this defect, because it is
what a person types when they mean emphasis and half-remember the syntax.

**The fix is the pattern, not more cases.** Anything in
`/\*|_|`|~|^\s*#{1,6}\s|\[[^\]]+\]\([^)]+\)/` has no business in a string that is printed rather
than parsed, and a changelog point has no legitimate use for any of those characters. Matching the
*character class* instead of the *one sequence that shipped* is the difference between a guard and a
regression test for last week.

# F2 — 7z's third check claims every entry and reads one. Measured.

**Severity: guard breadth, and the claim is the part I would fix regardless.**

The check is named *"and no entry reachable from the notice carries any either"*, and its comment
says *"over every entry rather than only the one on screen, because the notice shows the newest
release and the older ones are reachable from 'See recent updates'."* **It never clicks "See recent
updates".** Instrumented directly:

    before clicking:  [data-whatsnew-entry] nodes = ["app-v88"]
    after clicking:   ["app-v88","app-v87","app-v86","app-v85","app-v84","app-v83","app-v82","app-v81","app-v80"]

One of nine. And the one it does read is the same entry the main check already covered through the
modal's `innerText`, so today the check adds nothing at all. Proven rather than argued:

    ME  `**bold**` placed in the app-v87 entry, reachable only behind the button  ->  99/99 CLEAN PASS

Eight entries are unguarded, and a caregiver reaches every one of them with one tap. Three lines
fix it: click the control, wait, then scan. **A check whose name overstates its reach is the shape
this project's record says is worse than no check** — it is why nobody goes back and writes the
real one.

Also in 7z: `const allPoints = await page.evaluate(() => (T && T.helpTopics) ? null : null);` —
returns `null` on both branches and is never read. Dead on arrival; delete it with the rest.

# F3 — and the reason none of this blocks: there is no live defect

This is the check that decides the verdict, and a guard this narrow could not have told me, so I
did it independently of 7z. Parsing the `CHANGELOG` block out of the shipped file and scanning
**every** quoted string across **all nine** entries for double asterisk, single asterisk pair,
underscore pair, backtick, markdown link, heading and list bullet:

    changelog string literals scanned: 64
    >>> NONE — every changelog string is plain prose

So the eight entries behind *See recent updates* are clean today, and the notice a caregiver sees
after updating to v88 renders with zero markdown characters. **F1 and F2 are the guard failing to
protect a thing that is currently correct — reachable only by a future edit, exactly the category
you asked me to name plainly.**

---

# Why this is SHIP and not a fifth refusal

I considered refusing, and the argument for it is real: the PM refused this release over a string,
and a guard that catches the one sequence that shipped while missing three that fail identically is
pattern-matching the wording — the thing you flagged about yourself and asked me to check. If this
were the product I would hold it.

It is not the product. The product is correct on the rendered page, verified the way the defect
demanded, and verified independently across all 64 strings rather than through the guard I am
criticising. Refusing a fifth time to broaden a regex, when nothing a caregiver can reach is wrong,
is the guard-polish round this release has twice been told not to run, and the PM's own judgement
on the Help work was that it ran three rounds past its value.

**So: ship it, and make F1 and F2 the first commit of app-v89 rather than the last of v88.** They
are a regex and three lines, and they will be cheaper then than the fifth round would be now.

# Carried forward, unchanged

The ten `BACKLOG.md` deferrals (M19 first, correctly — it is the only one verified to reproduce a
real defect) · M11 · M15/M20/M21/M22 · the month-boundary fragility in `pickDay`/`tapDay` · the
`v75`-reads-from-disk harness note. **None is reachable by a caregiver of this build.**

# What I did not cover

The Designer pass and its twelve screenshots, and the Enhancer pass — I read that they landed and
did not re-measure them; they are their own seats and neither touches `index.html` · iOS/Safari
rendering, Chromium only here, which stays exempt · the sync backend, Capacitor, and `sw.js` beyond
confirming the CACHE/`APP_VERSION` pairing was untouched by this diff · `outputs/PM-app-v88.md` and
the other documentation in this range.

# The thing worth keeping from this one

Four audit rounds, a Designer seat and a PM all read `**Log another day**` as source and none of us
opened the page — and in my case the rendered asterisks were sitting in my own probe output in round
one. The lesson already written into `TEAM.md` this week was *after any fix, re-run the mutant the
previous round was catching*. This is its pair, and it is cheaper: **for any string a caregiver
reads, look at the rendered page once, as a reader, not as a grep target.** Both of this release's
last two findings were invisible to everything except somebody actually looking.
