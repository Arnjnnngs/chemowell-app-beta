# Developer brief — app-v89: every feature free for one person

## The decision this implements

Aaron, 2026-10-25, verbatim and governing:

> *"agreed. make backup free for all tiers. I might have read that wrong earlier. free shouldn't be
> penalized bc they didn't pay. after all, this is in Brandi's memory and people should be able to
> use ALL the features if they are a single user. its the most important thing to me. not money"*

So the pricing axis stops being **which features you get** and becomes **how many people you track**.
Free is the complete app for one person, forever. Paying adds profiles and nothing else.

This also settles the earlier exchange where I proposed launching free-only and Aaron rejected it as
bait-and-switch — *"I don't want to have to put out separate things saying this one is free but then
hit them with other stuff later to purchase. thats not how a business should work."* A ladder whose
only rung is a profile count cannot become a bait-and-switch, because there is nothing left to take
away later.

## What is actually gated today — measured, not assumed

`grep -n "upgradeOpen: true" index.html` returns five call sites. Four are the profile cap (two
"Add profile" buttons that open the plans sheet when you are at your limit, two "View plans"
buttons). **Exactly one is a feature paywall:**

    10892:  if (getLicense().tier === 'free') { setToast('The printable report is part of Plus ...

That is the whole paywall. One line, on a read-only report.

**Backup & restore is already free** and has been since it shipped. There is no tier check anywhere
in `renderBackupSection()` or the restore path, and `createProfileForRestore()` carries a comment
saying so deliberately: *"The cap governs CREATING profiles. It does not govern getting your own
data back, and it never will."* So Aaron's *"make backup free for all tiers"* describes something
the code already does — what is wrong is the **plans sheet**, which lists "Backup & restore" as a
Plus bullet and therefore tells free users they do not have a feature they have had all along.

That is worth stating plainly because it changes what this release is. It is not mostly a code
change. It is one deleted gate and a screen full of copy that has drifted away from the code.

## The write model

**This release writes nothing.** No new storage key, no new entry shape, no new field on an existing
record. The only storage it touches at all is `LICENSE_KEY`, through the existing `setLicense()`, in
the existing Buy buttons, unchanged.

That makes the usual Zero Day question ("what can this destroy?") the wrong question, and the right
one is its mirror: **what gets through now that a check used to stop?** Answer: a free user can open
the printable report. The report is built by `buildExportRows()`, which is the same function CSV
export already uses and which free users already run. Nothing new is reachable.

## The two real hazards, and the ratchets for them

1. **`tierLimit()` must not move.** The temptation while "making things free" is to loosen the
   profile cap too. That is the one thing Aaron is still selling. `tierLimit` stays exactly
   `pro → Infinity, plus → 3, free → 1`, and the new suite pins all three numbers so a future
   session cannot quietly widen it.

2. **Three plan cards must survive.** The plans sheet is the only place a purchase starts. Drop a
   `planCard(...)` call while rewriting the copy and that tier's Buy button vanishes — which, once
   Google Play Billing lands (#31), is a missing SKU rather than a missing paragraph. The suite
   asserts three cards, three prices, and a Buy control on each paid card.

## Scope

* `openPrintReport()` — delete the gate.
* `renderExportSection()` — delete `isFree` and the PLUS pill.
* Plans sheet — rewrite all three cards onto the profile-count axis.
* **Remove the "Most popular" badge on Plus.** There is no data behind it; this build has no
  customers. The Voice's first question is "is it true?", and it is not. It is also the kind of
  unsupported claim a store review flags.
* Help — `exp-printable`, `pro-plans`, and the stale comments at 10519-10521 and 10888.
* `priv-lost-phone` — **a false statement found while reading this screen as a reader.** It says
  *"A proper backup-and-move-to-a-new-phone feature is planned but not built yet."* It ships. It is
  in the Export section, two taps from the Help topic that denies it exists. Someone could lose a
  record because Help told them the thing that would have saved it does not exist yet. Logged as
  task #27 and fixed here, in the same release, because it is the same screen and the same subject.

## Done means

Free tier, from a cold profile: the printable report opens and produces the report; no PLUS pill
anywhere; the plans sheet names no feature as paid; adding a second profile still opens the plans
sheet; `tierLimit` still 1/3/∞; Help agrees with all of it; every existing suite still green.

---

## Falsification record (filled in after the fact, as the brief said it would be)

**First round — eight mutants, each a byte copy served on its own port.** Every one red on the
section written for it: the paywall restored (4 red, including the toast nudge once check 1.5 was
fixed to sample at the click rather than after a 6-second popup timeout), the free cap widened to
3 (1), the Plus cap made unlimited (1), the report bullet back on the Plus card (1), the PLUS pill
back (1), Help's "not built yet" claim back (1), the Free card stripped of what it names (1), the
"Most popular" badge back (1).

**Second round — the Zero Day Auditor wrote four of its own and all four walked through.** Closed,
and re-falsified along with guards for its two blockers. Eight mutants, every server md5-verified
against its own tree before the run:

| # | Mutant | Red |
|---|---|---|
| N1 | the `if (superseded)` line back above the `else` — the live export defect, exactly as it shipped | 5 |
| N2 | free users served only the last 3 rows of the printable report (the auditor's A11) | 2 |
| N3 | one of the two Add-profile cap guards loosened (A9) | 2 |
| N4 | the Plus card sells two features again, one of them a promise (A10) | 2 |
| N5 | the two prices swapped (A12) | 2 |
| N6 | Help stops naming the protected-save button label | 1 |
| N7 | Help drops the set-up-first caveat — blocker B1 restored | 2 |
| N8 | the password step back to position 3, after the file is shared — blocker B2 restored | 2 |

**Three of those reported clean on the first pass and were not detected — they were unmutated**,
because a setup script had aborted before reaching them. The md5 check caught it. That is the third
instrument failure of this release, after a check that ran too late and a mutant served from the
wrong directory, and it is why verifying the server before believing a falsification result is now
written into `TEAM.md` rather than remembered.

**N1's failure message is the clearest statement of what was live for three releases:**
*BLANK Detail for: Temperature, Blood Pressure, Weight, paracentesis, Radiation Session, Bowel
Movement, Appetite, Nausea.*
