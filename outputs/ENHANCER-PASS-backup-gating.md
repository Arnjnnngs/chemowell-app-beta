# Enhancer pass — backup gating (task #6), BEFORE the build

Run 2026-10-25, before a line exists, on the screens the change will touch:
Settings → Export & backup (`renderExportSection` / `renderBackupSection`, `index.html:10780-10960`),
the plans sheet (`renderUpgradeModal`, `index.html:5029-5100`), and the two Help entries that
describe the plans (`index.html:3926`, `index.html:4092`).

**Aaron's decision, 2026-10-24:** *"Keep saving free, gate restore behind Plus."*
This pass does not re-litigate it. It lists what the screens need in order for that decision to be
honest on a phone, and flags the two places where the app currently contradicts itself about plans
regardless of which way the gate goes.

---

## E-1 — THE DECISION COLLIDES WITH A PRINCIPLE WRITTEN INTO THIS FILE. Aaron should see it once.

`index.html:253-256`, a comment above `createProfileForRestore()`:

> Deliberately WITHOUT the tier check in createProfile(). Free caps at one profile, and a restore
> that needs a second one would otherwise be blocked — which means holding a person's own medical
> records hostage to a $4.99 upgrade. **The cap governs CREATING profiles. It does not govern
> getting your own data back, and it never will.**

And `index.html:265-267`, above the restore writer:

> Never deletes, never overwrites an existing record, and loading the same file twice is a no-op —
> which is what makes it safe to **hand someone a restore button at the worst moment of their week.**

A whole function exists for no other purpose than to let a Free user exceed the Free profile cap
*while restoring*. Gating restore makes that function unreachable on Free and makes both comments
false. **Severity: this is not a code problem, it is Aaron's call arriving at a door somebody
already bolted open on purpose, and the only wrong outcome is nobody noticing the door.**

The case for shipping it anyway is real: "move your data to a new phone" is the single clearest
thing to charge for in a one-time-purchase app with no subscription, and saving stays free so
nothing is ever lost for not paying. The case against is the sentence above — the person tapping
Restore has usually just lost or replaced a phone.

**The mitigation that keeps the revenue and answers the objection, and it is one line of copy plus
one of code:** the person is only *locked out* if the free route out of the app is complete. It is
not — see E-4. Make it complete, say so at save time, and the gate stops being a hostage.
**Recommended. S.**

---

## E-2 — THE PLANS COPY ALREADY DISAGREES WITH ITSELF, TODAY, BEFORE ANY GATE

Three surfaces describe what Plus includes. They do not match.

| Where | What it says Plus adds |
|---|---|
| Plans sheet, `index.html:5093` | 3 profiles · printable report · **"Backup & restore — move your data to a new phone"** |
| Help, `index.html:4092` | 3 profiles · printable report. **Backup is not mentioned at all.** |
| Help, `index.html:3926` | profiles only |

So the app sells backup as a Plus feature on the plans sheet, does not list it in Help, and ships it
free to everyone — which is Aaron's original report (#6) seen from the inside. **Whichever way the
gate goes, all three have to say the same thing, and the Help steps are the ones that are wrong
today.** S.

---

## E-3 — A FREE USER MUST BE TOLD BEFORE THEY SAVE, NOT AFTER THEY TAP RESTORE

If restore becomes Plus and nothing else changes, the Free screen offers a primary button that
produces a `.json` file, and a secondary button that refuses to read it. **A screen that makes a
thing it cannot consume is the Paracentesis shape** — the asymmetry this seat exists to catch, and
the reason it exists at all.

The app already has the right pattern and it should be copied rather than reinvented: the
*Printable report* button carries an inline `PLUS` pill (`index.html:10792`) and `openPrintReport()`
(`10737`) toasts *"The printable report is part of Plus — CSV export is free below"* and opens the
plans sheet. Three things, in that order: say what is free, name the gate, offer the upgrade.

Required for this change:
1. `PLUS` pill on the **Restore** button, same markup as the report button's.
2. A sentence in the backup section's body copy, visible on Free **before** saving, that the file
   needs Plus to load back onto a phone.
3. The refusal toast names what IS free in the same breath, as the report one does.
**All three, M together with the gate itself.**

---

## E-4 — THE FREE ROUTE OUT IS NOT COMPLETE, AND E-1 DEPENDS ON IT BEING COMPLETE

Help, `index.html:4092`, tells a Free user they get *"CSV export of all your own data."*

`buildExportRows()` (`index.html:10385`) maps `allEntriesRaw()` and nothing else. **Appointments,
notes, the medication list and settings are in a backup and are not in the CSV** — the backup
section's own copy lists all four. So *"all your own data"* is already an overstatement today.

Today that is a copy defect. **The moment restore goes behind Plus it becomes the load-bearing
claim**, because the CSV is then the only thing a non-paying person can take with them. Two ways:

* **(a) Fix the copy.** *"CSV export of everything you've logged"* — accurate, one word changed. **S.**
* **(b) Fix the export.** Appointments and notes into the CSV, or a second free "everything" file.
  **M**, and it weakens Pro, whose *"Complete data export — entries, appointments, and notes bundled
  into one file"* bullet (`index.html:5098`) is exactly this and is marked *coming soon*.

**Recommended: (a) now, with the gate.** (b) is a real product decision about what Pro is for and
should not be smuggled in underneath a gating change.

---

## E-5 — SMALLER, ALL FOUND ON THE SAME SCREENS

* **The password toggle outlives its purpose on Free.** `renderBackupProtect()` lets a Free user put
  a password on a backup that no Free phone can open. It still makes sense (they may send it to
  someone who has Plus, or upgrade later) but the hint text should not imply a round trip. **S.**
* **The undo row is not a second gate.** `renderUndoRow()` / `cwUndoRestore()` are reachable only
  after a restore has happened, so on Free they simply never appear. Nothing to do — written down so
  the next reader does not "fix" it. **Nil.**
* **`createProfileForRestore()` becomes dead on Free but must NOT be deleted.** It is how a Plus
  restore lands in a second profile, and deleting it would reintroduce the cap collision for paying
  users. **Nil, but name it in the diff review.**
* **Two buttons, one row, both primary-weight on a 320px screen.** Save is a filled orange button and
  Restore is outlined; with a `PLUS` pill added, re-check 320 and 360 for wrap. **S, Designer.**

---

## What this pass deliberately did NOT look at

The sync/pairing code (`index.html:740-870`) is a different feature at a different tier and is not
on these screens. The purchase flow itself does not exist in the beta — `setLicense` is the only
writer and there is no store integration, so "gate restore behind Plus" means a tier check against
`getLicense().tier`, and **nothing in this pass has been tested against a real purchase, because
there is not one.** That is worth saying out loud before store submission.
