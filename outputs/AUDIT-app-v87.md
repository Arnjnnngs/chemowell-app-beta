AUDITED-COMMIT: bb45852
VERDICT: DO NOT SHIP

Zero Day Audit — ChemoWell app-v87, branch `claude/caretracker-team-review-i83ik2`, HEAD `bb45852`.
Delta audited: `git diff 03e277d bb45852` (code+suite `daea89b`, Designer pass `bb45852`).

## HEADLINE

**E-2 is fixed in one of the two controls that has it, and the one left behind is the primary
one.** `BOWEL_MOVEMENT_LABELS` has five values. The release found a hardcoded `<select>` with four
and added `Loose` to it. There is a **second** hardcoded bowel `<select>` — line 3698, the **daily
check-in sheet**, which app-v86's own changelog calls the once-a-day route the whole feature is
built around — and it still offers `normal / very_little / none / diarrhea`. Four of five, in the
door the app pushes hardest, in the release whose entire purpose is that finding.

It is worse than a missing option. `openCheckinModal()` pre-fills `bowel:
bowelMovementFor(todayStart).value`. With `loose` standing — now one tap from the urgent banner —
the select has no matching option, `selectedIndex` is **-1**, and the control renders **blank**.
Measured in Chromium at 390: `{values:["","normal","very_little","none","diarrhea"], value:"",
selectedIndex:-1, shown:"(BLANK - no matching option)"}`. Not "Not answered" — nothing.

**And the new placeholder is false.** `'Change today’s answer…'` is hardcoded into a
banner that targets `latestBowelDay()`, which is explicitly not today — the writer's own comment
says so. Rendered, three days after the last answer, the card reads:

    Bowel issue active | Diarrhea · Day 1
    UPDATE STATUS FOR THURSDAY, OCT 22
    [ Change today's answer…  ▾ ]  [Update]

and Update wrote to **Oct 22**, three days back: `[{v:"diarrhea",daysAgo:3},{v:"normal",daysAgo:3}]`.
The label and the text describing it disagree, two lines apart, on the app's alarm surface — the
rule Rule 2.7 calls "both paid for" — introduced by a change whose stated job was to fix a
misleading placeholder. The Designer pass reviewed this string and blessed it.

Both are small fixes squarely inside this release's own scope. Neither should ship unfixed in the
release that is about exactly them.

## FINDINGS

### F1 — HIGH — BLOCKER. The check-in sheet still offers four of five, and goes blank on `loose`.
Location: `index.html` ~3698-3704 (`renderCheckinModal`), against the fixed one at ~6006-6012.
Only two hardcoded bowel selects exist (`grep -n "value: 'diarrhea'"` → 3703, 6011); v87 changed
6011. Reproduction: profile with `homeCards:{bowelCheckin:true}`, `dailyCheckinTime:'00:01'`, one
entry `{medId:'bowel_movement', value:'loose', ts:dayStart+12h}`; tap **Start** on the Daily
check-in card; inspect the bowel `<select>` → five options are not there and the box is empty.
Consequence: `Loose` cannot be recorded from the daily check-in at all, and a caregiver who sees a
blank box re-picks `Normal`, which writes a supersede. No data is destroyed (the writer refuses a
no-op and supersedes rather than deletes), so this is a correctness-of-record problem, not a loss.
**Checklist item 5 of the Enhancer brief is "where a sibling screen already got it right, why
didn't this one?" — the sibling is 2,300 lines up with the identical defect.**

### F2 — MEDIUM-HIGH — BLOCKER. `"Change today's answer…"` is untrue whenever the banner day is not today.
Location: `index.html` ~6006. `bannerDayLabel` immediately above already computes `today` /
`yesterday` / a date; the placeholder ignores it. Reproduction above, with evidence quoted in the
headline. Fix is one expression: `'Change the answer for ' + bannerDayLabel + '…'`, or the
day-agnostic `'Change this day’s answer…'` already used by the new corrector — which is
true on every path and is the same sentence, so the two surfaces would also finally agree.
Secondary harm: a caregiver who believes they just answered for today stops looking for the
check-in, and today stays unanswered.

### F3 — MEDIUM. `loose` is in no classification set, so the app displays it as "fine".
`grep -n "loose" index.html` returns exactly two app lines: the label map (3489) and the new option
(6010). It is absent from `BOWEL_ISSUE_VALUES = {none, diarrhea}`, therefore:
* logging `Loose` from the bowel-issue banner **dismisses the banner** (`bowelIssueActive()` false)
  and breaks the `daysSinceBowelIssueStart()` streak;
* the Bowel Movement History dot for `loose` is the **green** `#0F9D6B` — measured
  `rgb(15, 157, 107)`, byte-identical to `Normal`.
**The release's own Designer screenshot shows this**: `outputs/design-app-v87/08-correct-open-320.png`
has *"Saturday, Oct 24 — Loose"* with a green dot directly under *"Sunday, Oct 25 — Diarrhea"* with
a red one. Pre-existing since the value entered the map, but v87 is the release that argues in its
own README that Loose is *"the one that most often moves first during chemotherapy"* and then puts
it one tap from the alarm. Either it is clinically significant — in which case amber, beside
`very_little` — or the README prose overstates it. It cannot be both. Not a blocker on its own;
it should not ship a third time unexamined.

### F4 — MEDIUM — THE SEVENTH VACUOUS/MISSING CHECK. The new control has no completeness check.
`test/v87-correct-a-past-day.mjs` scores **25/25 green** with `Loose` deleted from the corrector:

    ...Object.keys(labels).filter(k2 => k2 !== 'loose').map(val => {

`test/v86-logging-and-labels.mjs` (86/86) and `test/v83-meds-and-reports.mjs` (80/80) are green on
it too. The README's ratchet claim — *"the banner check counts against the app's own label map, not
a number typed into the suite"* — is **true and non-vacuous for the banner** (verified: adding
`watery` to the map turns check 1.3 red). It covers one control. The brand-new picker this release
adds, and the check-in sheet of F1, have no such check, so the exact defect the release exists to
fix can be reintroduced inside its own fix in silence. One check against
`window.__v86Test.bowelLabels()`, applied to every control that renders bowel values, closes F1 and
F4 together and is what makes F1 unable to come back.

### F5 — LOW-MEDIUM. The write-failure path is never exercised.
Moving `dailyLogBusy = false` out of `finally` into the end of the `try` — stranding the shared flag
after a failed write, which then silently deadens **both** the corrector and the today-logger —
scores **25/25 green**. The shipped code is correct (`finally`), but nothing holds it there. The new
caregiver-facing string `"Could not save that — nothing was changed."` is read by no check in
any suite. One scenario that makes `addEntryDB` reject covers the toast, the flag and the picker
staying open.

### F6 — LOW. A corrected appetite day keeps a note that described the old answer.
`renderDayCorrector` calls `logAppetite(v, d)` with no note, so `incoming = (prev && prev.note)`
carries it forward. The suite asserts this as a feature (*"the note the day carried comes with it"*)
and it ran: value `none`, note `"ate a full dinner"`. The standing row then reads **"No Appetite" /
"ate a full dinner"**, and `buildExportRows()` carries the note into the clinician's CSV beside the
corrected value. Arithmetically consistent, clinically contradictory — the Voice's question 3 shape.
The corrector offers no way to edit or clear it. Not a blocker; decide deliberately rather than by
default, and say which it is.

### F7 — LOW. Nothing checks that the picker marks the standing answer.
`const on = false;` survives at 25/25. The highlight is the only thing telling the caregiver what
they are changing *from*.

### F8 — NIT, but this project's worst-finding shape. A comment asserting a mechanism that is not there.
`// Not persisted -- it is a draft, and setState's persistence list deliberately excludes drafts.`
`setState()` is `Object.assign(state, patch)` + a pending-entries flush + `render()`. **It has no
persistence list.** The conclusion is right — `editingDaily` is never written to prefs, since
persistence is explicit through `setPrefsDB(patch)` — but the stated reason does not exist, and a
future reader who adds a key to a list that is not there gets nothing. app-v84's README row calls
"a comment asserting a guarantee the code did not have" that release's worst finding.

### F9 — NIT. The Designer report's own count.
`outputs/DESIGN-app-v87.md` heads a section *"Three screens not re-captured, and why"* and names
one (`03-history-summary`). The set is 7 screens × 3 widths = 21, which the same file states. One
screen at three widths is not three screens.

## MUTANT BOARD

Baseline `test/v87-correct-a-past-day.mjs` **25/25**. Every mutant applied in place to `index.html`,
`md5sum -c` against a byte copy after each restore (`5b2f45c8df80e4eecc28f14f09194009`, OK every time).

| # | Mutant | Result |
|---|---|---|
| M1 | drop `removeBtn(e)` from the bowel report row | **CAUGHT** 24/25 — *"and Remove is still there"*. The `innerText` match is non-vacuous on that screen |
| M2 | `Object.keys(labels).filter(k => k !== 'loose')` in the corrector | **SURVIVED 25/25** — and survives v86 (86/86) and v83 (80/80). See F4 |
| M3 | `dailyLogBusy = false` moved out of `finally` into the `try` | **SURVIVED 25/25** — no scenario makes a write fail. See F5 |
| M4 | `renderDayCorrector('bowel_movement', dayStart(simNow()), …)` | **CAUGHT** 14/19, 5 reds incl. *"both stay on the day they belong to"* and the export pair |
| M5 | `setToast(true ? 'Changed to ' …)` — always claim a change | **CAUGHT** 24/25 — the false-reassurance shape is covered |
| M6 | `const on = false` — no current-answer highlight | **SURVIVED 25/25**. See F7 |
| M7 | `supersedeStamp` → `Math.max(prev.ts, base)` (equal stamps) | **CAUGHT** 23/25 — both export-marking checks red |
| M8 | add `watery` to `BOWEL_MOVEMENT_LABELS`, leave the banner | **CAUGHT** 24/25 — the README's label-map ratchet claim is real |

3 survived of 8. M2 is the seventh vacuous/missing check the brief predicted, and it is the same
defect as the release's own headline, one control over.

## RUNS — what was measured, not asserted

Served `python3 -m http.server 8899 --directory /home/user/chemowell-app-beta`, loopback only,
`env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy`. Both servers killed; `curl` to
8899 and 8898 returns 000.

| Suite | Result |
|---|---|
| `test/v87-correct-a-past-day.mjs` | **25/25** — matches the README figure |
| `test/v86-logging-and-labels.mjs` | **86/86** — matches |
| `test/v83-meds-and-reports.mjs` | 80/80 |
| `test/v85-profile-reminders.mjs` | 43/43 |
| `test/v75-no-other-patient.mjs` | 27/27 (Rule 0 ratchet intact) |
| `test/v80-up-next.mjs` | 49/49 |
| `test/v58-eod-checkin.mjs` | 10/10 |
| `test/v59-para.mjs` | 15/15 |
| `test/v64-logger.mjs` | 23/23 |
| `test/v84-whatsnew.mjs` | 95/96 — pre-existing, the single red is *"the field is below the fold"*, `top=836` in an 844px viewport |
| `test/v71-report-controls.mjs` | pre-existing crash. **Spot-checked both ways**: identical stack (`confirmModal`, line 128) at HEAD and against `87d1784`'s own `index.html` served on 8898. Not this release |

## CHECKED AND GOOD

* **Shared `state.editingDaily`.** One object, keyed on `{kind, day}`, so two rows cannot be open at
  once and the two report screens cannot open each other's picker (`kind` differs). Initialised to
  `null` in the `state` literal and never read back from prefs — `setPrefsDB(patch)` is the only
  persistence route and nothing passes it `editingDaily`, so it cannot survive a reload. (The
  comment explaining why is wrong — F8 — but the behaviour is right.)
* **`dailyLogBusy` on the happy paths.** Guarded on entry, released in `finally` on success and on
  throw in both the corrector and the today-logger. The throw path is untested, not broken (F5).
* **The day argument.** `dayStart(e.ts)` is correct for every entry an app writer can produce:
  `supersedeStamp` stamps `dayStart+12h` and climbs 1s per correction, so a same-day run would need
  ~43,200 corrections to cross midnight, and midday is unreachable by any DST shift. Verified live
  that both the original and the correction land on the day they belong to, two days back, under
  the beta date override. M4 proves the check can fail.
* **`wrote` is handled on every path.** No-op → *"Already logged as X for that day."* (verified
  `2 -> 2` entries, correct toast); real change → *"Changed to X"*; throw → *"Could not save that —
  nothing was changed."* M5 proves the first two cannot be faked.
* **`Remove` is untouched.** `removeBtn` is unchanged in the diff; the corrector is added as a
  sibling, never a replacement. `bowel_movement` and `appetite` are both in `BYPASS_48H_IDS`, so old
  rows really do carry `Remove`, which is what makes the release's claim about them true. M1 proves
  the check bites.
* **Supersede, not delete.** Export after a past-day correction:
  `["Normal (corrected later — superseded)", "Diarrhea"]` — both answers present, exactly one
  marked. `isSupersededEntry` depends on a strictly-newer stamp and M7 shows the check fails without
  one.
* **Rule 0.** Zero matches for a patient name, any gendered pronoun (including code comments), a
  care-plan dose/ceiling/schedule, or a new medication-id branch across the `index.html` delta;
  `v75-no-other-patient` 27/27. The one `he` in the delta is in `README.md` and refers to Aaron.
* **Release mechanics.** `APP_VERSION 'app-v86' → 'app-v87'` and `CACHE 'chemowell-app-v86-1' →
  'chemowell-app-v87-1'` move together. README row added. Both README test figures verified by
  running them.
* **No page errors** on any scenario in any suite or probe.
* **Working tree.** `git status --porcelain` empty apart from this report; `index.html` md5
  `5b2f45c8df80e4eecc28f14f09194009`, unchanged from `bb45852`. No commit, no push, no
  `caretracker_*` name touched, no network beyond loopback.

## TO SHIP

1. **F1** — add `h('option', { value: 'loose' }, 'Loose')` to the check-in sheet's bowel select
   (`index.html` ~3703), in map order, between `None` and `Diarrhea`, matching the banner.
2. **F4** — one check, applied to **every** control that renders bowel values (banner, check-in
   sheet, Reports logger, corrector), asserting each offers `Object.keys(window.__v86Test
   .bowelLabels())` in full. This is what stops F1 returning, and it is the check the release
   already argues for in its own README.
3. **F2** — make the banner placeholder tell the truth about the day it writes to:
   `'Change the answer for ' + bannerDayLabel + '…'`, or reuse the corrector's day-agnostic
   `'Change this day’s answer…'`. Add a check that reads the placeholder on a banner whose
   day is **not** today — the existing check 1.5 only asserts the old wording is gone.
4. **F3** — decide `loose` explicitly and write the decision down: either put it in the amber band
   beside `very_little` (and say whether it should hold the bowel-issue banner open), or soften the
   README's clinical claim about it. A value the app shows in "all good" green while its own release
   note calls it the first thing to move is a false impression either way.
5. **F8** — correct the comment to what `setState` actually does, or delete the clause.
6. **F5 / F6 / F7 / F9** — not ship-blocking. F5 is one rejecting-write scenario; F6 needs a
   decision, not necessarily code; F9 is a number in a report.

Re-audit on the fix is a delta pass: F1+F2 are two expressions and F4 is one check, so the whole
of the above is well inside a single round.
