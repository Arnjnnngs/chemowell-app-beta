AUDITED-COMMIT: 1da23de
VERDICT: SHIP

# PM Gate — ChemoWell app-v70, final ruling

Five Zero Day Audit passes. Four refused. The fifth says SHIP, and I agree with it.

## The decision, and why

**Ship app-v70.** The product change has been correct since the first pass and no audit has ever
said otherwise. Every refusal was about the words describing the change or the machinery checking
it — which is precisely where this project's documented failures live, so none of the four rounds
was wasted. But the returns are now clearly diminishing: the fifth pass went hunting for a live
falsehood the way it found the previous two, read all 54 sentences the scanner still discards, and
found **not one false**. The live-defect surface is empty.

What ships is a real improvement to a caregiver's day: a mistyped treatment date can be taken back
without wiping the whole schedule, and six separate places that told them a hospital stay pauses
medication logging — untrue since app-v67 — now say what actually happens.

## What the audits actually bought, since four refusals need justifying

Two of the four found things a caregiver would have hit:

- **A sixth false sentence, live for five releases.** The Help-centre subtitle under *Hospital
  stays* — the first line someone reads when they open Help specifically to find out what a stay
  does — said *"and what pauses meanwhile"*. Nothing pauses.
- **The `ip-undo` topic said logging was "never" blocked.** Written in this release. Logging *was*
  blocked in every build to app-v66; that is why app-v67 exists, and why Aaron hit it on a real
  half-day admission. Telling a caregiver who remembers being locked out that it never happened is
  its own small harm.

The other two found the gate itself would not have caught a full reinstatement of the pre-v67
lockout. The auditor put that lockout back **five different ways** across the rounds — in
`status()`, inlined in `logMed()`, refusing every dose after the first, filing doses a month in the
past, and hiding `Take all` — and in every case the entire suite went green. That is the defect this
release exists to prevent, shipping silently. Finding that was worth the rounds.

## The rule that came out of it, and it is now written into the file

Three attempts at a source-shaped ground truth were beaten by simply moving the guard. **You cannot
enumerate the places a bug is forbidden to live.** The check is now behavioural: with a stay open,
press the medication's Log, press Confirm, and require the dose to be in storage — logged twice, on
a standalone card and on a grouped `Take all`, asserting each medication separately and each dose
recorded for today. The same lesson applies to the prose gate, which is an allow-list of what the
app is permitted to say rather than a blacklist of ways to say the wrong thing.

## What is NOT closed, and where it is written down

The auditor listed five ways the harness can still be evaded. **None is a defect in this build** —
each is a future regression the gate would not catch — and all five evade it the same way: by
acting on a dose route the fixture never walks, or a field the check never reads.

| # | The gap | Cost to close |
|---|---|---|
| D1b | a dose recorded with its `dose` label and `mg` stripped | assert the stored label — 1 line |
| D2b | a dose stamped 00:01 — right day, wrong hour and wrong window | assert `ts` within minutes of the click — 1 line |
| C1 | backfilling a missed dose from History dead during a stay | a route the fixture must walk |
| C2b | the override / "log it anyway" path dead during a stay | a route the fixture must walk |
| N1 | a false claim using none of NARROW's vocabulary | relax NARROW now the extractor yields clean prose |

D1b and D2b are two lines and go in the next change. C1 and C2b are real caregiver routes — "took
later" on a missed dose, and "log it anyway" on a locked card — and deserve fixture coverage rather
than a hurried patch. N1 is the last filter that can drop a scoped sentence.

**These are deliberately not being fixed in this commit.** The audit that cleared this release
examined `1da23de`; changing the tree after a SHIP verdict and pushing something the auditor never
saw is exactly the app-v68 failure — gated by an audit of a commit that was not what shipped. They
go in the next release, with their own pass.

## Gates, with real numbers

`v67-chemo-offset` 26/26 · `v67-inpatient-window` 10/10 · `v67-medflag-backfill` 4/4 ·
`v68-treatment-clamp` 28 pass 0 fail · `v69-treatment-date-help` 27/27 · `v70-remove-one-date` 16/16
· `v70-remove-one-date-browser` 15/15 · `v70-stay-does-not-lock` all green, 40 sentences reviewed ·
`v52-fixes`, `v55-help`, `v57-search` ALL GREEN · `v58-eod-checkin` 10/10 · `v59-para` 15/15 ·
`v61-backup` 22/22 · `overflow-scan` **170/170 CLEAN** across 17 passes × 10 phone widths.

Thirteen falsifications, every one red for its own reason, listed in the app-v70 README row.

`APP_VERSION` → `app-v70` and `sw.js` CACHE → `chemowell-app-v70-1`, moved together in the same
commit. Without that, every installed phone keeps serving the old build silently and forever — the
audit's original headline blocker, and the app-v40 failure this gate exists for.

## Ruling

**SHIP `1da23de` to `main`.** The five harness gaps above are logged for the next release.
