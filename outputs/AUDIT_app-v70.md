# Zero Day Audit — ChemoWell app-v70

AUDITED-COMMIT: f0c74ca3436068030d2d629f86b5c288eb1b22ab

Branch: main (local) / claude/caretracker-chemowell-updates-k80ydk
Auditor: Zero Day Auditor
Date: 2026-08-31
Scope: `removeChemoDate()` + per-date list, the Help corrections, the version bumps, and the four
changed/new harness files.

## VERDICT: DO NOT SHIP

Two blockers. One is a false statement the app makes on screen to a caregiver standing in a
hospital. The other is that the headline new gate in this release — the check that is supposed to
stop Help from naming a button that does not exist — does not work, and I made Help wrong twice
while it reported all green.

The *storage* design at the centre of this release is sound and I could not break it. The problem
is the Help work and the gate that was written to protect it.

---

## BLOCKER 1 — the app still says medication logging pauses during a hospital stay

This release exists partly to delete that claim. The commit says it was in three places and all
three are fixed. It was in **five**. Two are still there, and the worse of the two is not in Help
at all — it is on the In-Patient screen itself.

**`index.html:8705`** — rendered directly under the amber "Active" chip whenever a stay is open:

> Since <date>. Home medication logging is paused while a stay is active — the hospital is
> administering doses, not you.

That is false. Verified against the code, not against other prose:

- `inpatientCoversMoment(ts)` (`index.html:3087`) is the only place a stay changes anything.
- Its only caller is `index.html:1744`, inside missed-dose detection: `if
  (inpatientCoversMoment(win.ws)) return;` — it suppresses a **missed-dose flag** for a window that
  *opened* during the stay. Nothing else.
- There is no lock, no disable, no "Restricted" state on any Log button while a stay is active.
  The Home banner (`index.html:4528`) already says the true thing, and the Help topic
  `ip-meds-restricted` documents that this changed on 2026-08-26 after Aaron hit it on a real
  half-day stay.

So the In-Patient tab now contradicts the Home banner, the FAQ, the tour, and its own help icon —
all on the same subject, in the same build. This is the exact defect class the release was opened
to close, left in the most-read location for it. Nothing in the harness guards this string; I
grepped every suite in `test/` for it and got zero hits.

**`index.html:2965`** — Help topic `ip-undo`, final step: *"The entry is removed and home
medication logging goes back to normal."* Softer, but it still tells the reader logging was not
normal during the stay. Same fix, same commit.

Secondary, lower confidence: Help topic `miss-false-missed` says *"days inside a hospital stay are
never flagged as missed"*. The real rule is per dose window, judged at the moment the window
opened. A stay that ends at noon leaves that afternoon's and evening's windows flagged — which is
the whole point of the 2026-08-26 change. "Days ... are never flagged" is the old whole-day model.
Worth tightening while the file is open.

## BLOCKER 2 — the new button-name check in `test/v69-treatment-date-help.mjs` cannot do its job

The check pulls every `tap **X**` out of the topic's steps and requires `X` to be a real button on
the card. The commit is explicit that this replaced a fixed list because the fixed list let a check
*disappear*. The replacement has the same hole plus a new one. Both proven, on scratch copies,
against the real suite:

**Escape A — stop using the word "tap".** I changed one step from
`then tap **Set date**` to `then press **Save schedule**`. Help now sends the reader to a button
that does not exist anywhere in the app.

    Result: 18/18 checks passed, exit 0, no failure of any kind.

The only defence is `namedButtons.length >= 4`. Help currently names five buttons, so one can be
silently dropped for free. (Dropping two does trip the floor — I confirmed that too: 16/17. So the
gate catches a careless rewrite and misses a targeted one, which is backwards.)

**Escape B — name something that is merely a quoted string near the card.** I changed the same step
to `then tap **Paracentesis**`.

    Result: 19/19 checks passed, and the suite printed, in green:
      PASS  Help says tap **Paracentesis** and the card really renders a button called that

It does not. `card` is a blind 6000-character slice starting at the first `'Treatment schedule'`
literal, and the test is `card.includes("'" + label + "'")`. That window spills into an unrelated
card and contains, among others: `'Paracentesis'`, `'Pick a date'`, `'Treatment date cleared'` (a
toast), `'Treatment schedule'`, `'Keep'`, `'true'`, `'center'`, `'flex'`, `'column'`, `'mono'`.
Any of those passes as "a real button label on the card".

A check that prints a specific green sentence which is false is worse than no check, because the
count still reads healthy and the sentence reads like evidence.

The fix is not more regex: extract the actual button labels from the card by parsing
`h('button', {...}, 'Label')` within a bounded region, compare Help's names against **that set**,
and assert the set is non-empty and contains the labels the topic must name. And match the
instruction verb generically (`tap|press|hit|choose|select`) or, better, check every `**X**` in the
steps that is not a screen or tab name.

---

## What I could NOT break — the append-only removal itself

This is the part I attacked hardest, and it held.

- **No new entry shape.** `removeChemoDate()` writes only `ts === 0` (the existing tombstone) and
  `ts > 0` (the existing add). Confirmed in the store by the browser suite:
  `{"count":6,"negatives":0,"medIds":["chemo_date"]}`. An older build restoring this backup reads
  it correctly. The rejected negative-`ts` design would indeed have landed in 1970; rejecting it
  was right.
- **`chemoDayList()` is untouched.** Verified by diff.
- **The `loggedAt` tie guard is real and it is falsifiable.** I replaced
  `Math.max(Date.now(), latest + 1)` with plain `Date.now()`. The unit suite went **11/12**, red on
  *"removing the last date leaves nothing"* — three removals inside one millisecond, tombstone tied
  with its own re-adds, schedule not cleared. Right failure, right reason.
  As a bonus the same `Math.max` also survives a device clock set **backwards**: `latest + 1` wins
  and ordering stays monotonic. That was not claimed and it holds.
- **Rapid double-tap is safe.** I traced this rather than guessing. `addEntryDB()` is declared
  `async` but its body is entirely synchronous — `saveJSON` then `notifyEntries()`, which rewrites
  `state.chemoDates` immediately. Every `await` inside `removeChemoDate()` therefore resolves as a
  microtask, and microtasks drain before the next click event (a macrotask). A second tap cannot
  land in the window between the tombstone and its re-adds, which is the only moment the schedule
  is transiently empty.
- **Remove with a tombstone already in the log**, **remove then add**, **remove a date not
  present**, **remove the last one**: all covered by the unit suite and all behave.
- **The `h()` trap does not apply.** The new `h()` calls pass no conditional or null-valued
  attribute; the conditional is the whole subtree (`return null` when `< 2`), and `h()` skips null
  children. The `key: String(d)` attribute is inert — this renderer rebuilds elements every time
  and does no reconciliation — so it lands in the DOM as a meaningless `key="..."` attribute.
  Cosmetic only; worth removing so a future reader does not think keys mean something here.

## Falsification log — every changed gate, broken on a scratch copy outside the repo

All sabotage applied to copies under the session scratchpad. Each copy was diffed against the base
and parse-checked identically to the base before being run, so no green below comes from a
sabotage that failed to apply.

| # | What I broke | Suite | Baseline | Sabotaged | Verdict |
|---|---|---|---|---|---|
| B1 | `onClick` on the per-date Remove replaced with a no-op | v70 browser | 15/15 | **4 FAILED** | catches a dead button |
| B1 | same | v70 unit | 12/12 | 12/12 | blind, as documented |
| B2 | tombstone logged *after* its own re-adds (`base + 2`) | v70 browser | 15/15 | **3 FAILED** | catches wrong ordering |
| B2 | same | v70 unit | 12/12 | **7/12** | catches it too |
| B3 | tie guard removed (`Date.now()` alone) | v70 unit | 12/12 | **11/12** | right check, right reason |
| B3 | same | v70 browser | 15/15 | 15/15 | cannot see it (real clock gaps) — acceptable, but not the "falsified three ways" the commit implies for the browser suite |
| A2 | Help names a button that does not exist, avoiding the word "tap" | v69 help | 19/19 | **18/18 GREEN** | **HOLE** |
| A3 | Help says tap **Paracentesis** | v69 help | 19/19 | **19/19 GREEN** | **HOLE** |
| A1 | two fake names at once | v69 help | 19/19 | 16/17 | only the `>= 4` floor saves it |
| B4 | re-adds kept in memory only, never persisted | v70 browser | 15/15 | **3 FAILED** (incl. "the removal survives a reload") | catches a removal that does not stick |
| O1 | Home in-patient banner rendered with no open stay (`if (inpatientActiveNow)` → `if (true)`) | overflow-scan | 170/170 CLEAN | **170/170 CLEAN — byte-identical log** | **HOLE** |

## FINDING 3 — the `no-stay:home` overflow pass has a guard that cannot fire

The pass carries this receipt, and it is the only thing separating it from a pass that measures the
state it was written to replace:

    if (/Day \d+ of (this |the )?(hospital )?stay/i.test(main.innerText))
      return 'the stay banner is still on Home';

The Home in-patient banner (`index.html:4526-4528`) renders:

    In-Patient active
    Day 3 — doses given by hospital staff are not counted as missed. You can still log anything yourself.

There is no "of ... stay" anywhere in it. I ran the guard's own regex against the real banner
string: **false**.

Then I proved it end to end rather than leaving it as reading. I changed `if (inpatientActiveNow)`
to `if (true)` on a scratch copy, so the Home banner renders permanently — including inside
`no-stay:home`, the one pass whose entire purpose is to scan Home *without* it. Sabotage verified
applied (one `if (true)` at line 4521, zero remaining `if (inpatientActiveNow) {`).

    committed tree : 170 of 170 scanned, 0 overflowing — CLEAN, exit 0
    sabotaged tree : 170 of 170 scanned, 0 overflowing — CLEAN, exit 0

The two logs are **byte-identical**. The pass returned `true` while the banner it is written to
detect was on screen at all ten widths. Its correctness receipt is decorative, and the release's
"170/170" therefore includes one pass that cannot fail for the reason it exists.

The needle to use is already on screen and unambiguous: `'In-Patient active'`.

By contrast the other two new passes have receipts that actually bite: `no-stay:inpatient` reads
the `Log In-Patient Start` button back off the screen after clicking End, and `no-dates:home`
asserts both that `[data-chemo-list]` is gone and that the card says "No treatment date set". Those
two are honest. The ordering claim is also honest — all three are last in `EXTRA`, they do mutate
state, and each device gets a fresh `newContext()` inside the `DEVICES` loop, so the mutation does
not leak into the next width.

## FINDING 4 — the `>= 2` gate is defensible, and Help covers the stranded case

Hiding the list at one date is fine: the single date is already named in the headline, and the
`Clear` → `Confirm clear` route is still there and still visible (`chemoTs ? ...`). The `treat-clear`
topic now spells that out as its own step. I could not construct a state where a user has a date
they cannot get rid of.

One consequence of the gate: the `keep.length === 0` branch of the toast — *"Removed the only
treatment date"* — is unreachable from the UI, since the list only renders at two or more. Harmless
dead copy; flagging it so nobody later reads it as evidence the path is supported.

## FINDING 5 — the headline date can jump after a removal (minor, pre-existing shape)

`nextChemoTs()` picks the entry with the greatest `loggedAt`, breaking ties toward the **last**
element of an array that `notifyEntries()` sorted by `ts`. After a removal every surviving date
shares one `loggedAt`, so the tie is decided by largest `ts` — the **furthest** treatment. With
dates entered out of order (say 7 Sep, then 5 Oct, then 21 Sep), removing 7 Sep flips the card's
headline from "21 Sep" to "5 Oct" even though 21 Sep is still on the schedule and is the next one
due. Not introduced by this release — `nextChemoTs()` has always meant "most recently entered", not
"next" — but the removal is a new way to trigger it, and no gate would notice. Worth a follow-up,
not a blocker.

## FINDING 6 — watch item, not a defect today

`removeChemoDate()` computes `latest` as `Math.max(m, e.loggedAt || 0)`, but `chemoDayList()` sorts
with the fallback `(a.loggedAt || a.ts || 0)`. For any `chemo_date` row missing `loggedAt`,
`chemoDayList()` orders it by its `ts` — a future treatment date, larger than `Date.now()` — so the
new tombstone would sort *before* it and that date would survive its own removal. I checked every
`chemo_date` write in this repo's history (`git log -S`, back to the `app-v1` seed): all of them set
`loggedAt`, so no device this codebase has ever written can hold such a row. It only becomes
reachable through a restore of a backup from an older lineage. Making `latest` use the same
fallback as the sort is a one-line change that closes it permanently.

## Suite runs — real numbers from this session

Every number below is from a run I executed against the committed tree.

- `test/v70-remove-one-date.mjs` — **12/12**, exit 0
- `test/v70-remove-one-date-browser.mjs` — **15/15**, exit 0
- `test/v69-treatment-date-help.mjs` — **19/19**, exit 0 (see Blocker 2: the total is not
  trustworthy)
- `test/v55-help.mjs` — **150 PASS, 0 FAIL, ALL GREEN**, exit 0. The repointing at the renamed topic
  works; the claim that this suite is green again is true.
- `test/overflow-scan.mjs` — **170 of 170 scanned, 0 overflowing elements, CLEAN, exit 0**. The
  commit's 170/170 claim is reproduced exactly. But see Finding 3: the same 170/170 CLEAN comes back
  from a build where the In-Patient banner is stuck on Home, so one of those passes is not really
  checking anything.

Version bumps verified together: `APP_VERSION` `app-v68` → `app-v70` and `sw.js` CACHE
`chemowell-app-v68-1` → `chemowell-app-v70-1`. Both moved in the same commit. Correct.

## What has to happen before this can ship

1. Fix `index.html:8705`. Say what the code does: everything stays loggable; dose windows that
   opened during the stay are counted as the hospital's, not as misses. Fix `index.html:2965` in the
   same pass.
2. Add a gate that would have caught it. A single check that no live string in `index.html` claims
   logging pauses/stops/is locked during a stay — asserted against source strings, not against
   `document.body.textContent`. Falsify it by reinstating the sentence.
3. Rewrite the button-name check so escapes A and B both go red, then prove it by re-running my two
   sabotages.
4. Change the `no-stay:home` needle to `'In-Patient active'` and falsify it by forcing the banner to
   render with no open stay.
5. Re-run the full overflow scan and report the real total afterwards.

No sabotage string was left in the working tree. Every modified copy lived outside the repo and the
tree was verified clean at the end of the audit.

---

## Note on the working tree at the end of this audit

This audit is of the commit named at the top of this file. It is not an audit of the working tree.

While the audit was running, uncommitted edits appeared in the repo from another worker —
`index.html`, `test/overflow-scan.mjs`, `test/v69-treatment-date-help.mjs` modified, and a new
`test/v70-stay-does-not-lock.mjs`. On inspection they are fixes aimed at the findings above
(the In-Patient tab sentence, `ip-undo`, `miss-false-missed`, the `loggedAt || ts` fallback, a new
absence gate). **None of that is audited here.** The verdict stands against the commit; a re-audit
is required against whatever is committed next, and every one of the five items in "What has to
happen" needs its own falsification run on that tree.

Confirmed at close: none of my sabotage strings are in the repo. The `'Paracentesis'` hits in
`index.html` are the pre-existing `proc-para` Help topic, and the ones in
`test/v69-treatment-date-help.mjs` are explanatory comments written by that other worker quoting
this audit — not sabotage. Every sabotaged copy lived only under the session scratchpad, outside the
repository, and each suite was pointed at it with `--file`.
