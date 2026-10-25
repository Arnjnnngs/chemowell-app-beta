# Developer brief — task #6, gate restore behind Plus (written before any code)

Chain stage 1. Pairs with `outputs/ENHANCER-PASS-backup-gating.md`, which was run first and whose
five findings are inputs here, not repeats.

**Aaron's decision (2026-10-24):** saving a backup stays free; restoring one requires Plus.
**Aaron's report (#6, 2026-10-23):** the plans sheet advertises backup as a Plus feature and the
app gives it to everyone.

## The constraint that shapes the whole change

There is exactly one tier reader in this file: `getLicense().tier`, with `tierLimit()` and
`tierLabel()` beside it (`index.html:158-174`). There is exactly one existing *soft* gate, and it is
the pattern to copy rather than invent around — `openPrintReport()` at `index.html:10737`:

```js
if (getLicense().tier === 'free') { setToast('The printable report is part of Plus — CSV export is free below'); setState({ upgradeOpen: true }); return; }
```

Three properties worth naming because the new gate must have all three: it refuses **at the top of
the action**, before any state is touched; the refusal **names what is still free**; and it opens
the plans sheet rather than leaving a dead end. The button that triggers it carries an inline `PLUS`
pill (`index.html:10792`) so the gate is visible before the tap, not only after it.

## Where the gate goes, and the one place it must NOT go

**`cwBkPickFile()` (`index.html:285`), first line.** That is the single entry point for every
restore: the Restore button calls it directly and nothing else opens the file input. Gating there
means the file picker never opens on Free, so no file is read, no password is typed, and nothing
reaches the parser.

**It must not go in `cwBkConfirmRestore()` (`index.html:372`).** By then the person has chosen a
file, possibly unlocked it with a password, and chosen a destination; refusing at that point is the
worst version of this change. The same argument rules out gating inside `cwBkApplyBundle` or the
dest chooser.

**`createProfileForRestore()` (`index.html:257`) is not touched.** It exists to let a restore exceed
the Free profile cap, and a Plus user restoring into a second profile still needs it. Its comment,
however, is now false in its last sentence and must be rewritten in the same commit — see the
Enhancer's E-1. A comment that asserts a guarantee the code no longer provides is the exact defect
app-v86 was refused for.

## What else has to change for the screen to be honest (Enhancer E-2, E-3, E-4)

1. `PLUS` pill on the Restore button, same markup as the report button's.
2. The backup section's body copy (`index.html:10809`) currently reads *"It is the only way to move
   to a new phone, the only way back if this one is lost"* with no mention of a plan. On Free it
   must say, before the Save button, that loading a backup back onto a phone needs Plus.
3. Help `index.html:4092` lists Plus as *"up to 3 profiles, and the printable doctor's report"* and
   omits backup entirely; the plans sheet (`5093`) includes it. They must agree.
4. `index.html:4092` also promises Free *"CSV export of all your own data"*. `buildExportRows()`
   (`10385`) maps entries only — appointments, notes, the medication list and settings are
   backup-only. Reword to *"everything you've logged"*. This is the sentence that makes the gate
   defensible, so it ships in the same commit or the gate does not ship.

## Approach chosen, and the alternative rejected

**Chosen: a soft gate at `cwBkPickFile()` plus the four copy changes above.** It matches the only
other gate in the app, it is four small edits in one region, and every one of them is reversible by
changing one condition.

**Rejected: gating the Restore BUTTON out of the DOM on Free.** It is fewer lines and it is worse —
a Free user then has no way to discover that restore exists or that Plus is what buys it, and the
app silently becomes a one-way door. The pill-plus-toast pattern sells the upgrade; hiding the
button sells nothing and teaches nothing.

**Rejected: gating `downloadBackupFile()` too.** Directly against Aaron's decision, and against the
reason for it.

## Done means

* Free: Restore shows a `PLUS` pill; tapping it toasts naming what is free and opens the plans
  sheet; **the file picker never opens**; Save still works and still produces a loadable file.
* Plus/Pro: every current path unchanged, including a restore that creates a second profile.
* All four copy surfaces agree with each other and with the code.
* A suite check per bullet, **each one falsified by a mutant that turns it red** — including the one
  that matters most and is the easiest to write vacuously: *set the tier to `plus` and prove the
  picker DOES open*, because a check that only ever asserts the refusal passes just as well on an
  app where restore is broken for everybody.
* `test/v86` and `test/v87` still green; `release_check.sh` exit 0 with an independent audit and a
  PM sign-off naming the release.

## Known landmines

* `h()` does a bare `setAttribute`, so `disabled: cond ? 'disabled' : null` writes the string
  `"null"` and disables the control forever. Spread the object instead — the Save button at
  `index.html:10812` already does, with a comment saying why.
* The licence survives a factory reset (`WIPE_SURVIVORS`, `index.html:170`). A test that erases app
  data does **not** reset the tier; set it explicitly in every fixture.
* There is no purchase flow in the beta. `setLicense` is the only writer, so "upgrade to Plus" in a
  test means writing the key directly, and **nothing in this change can be verified against a real
  store purchase, because there is not one.** Say so in the release message.
