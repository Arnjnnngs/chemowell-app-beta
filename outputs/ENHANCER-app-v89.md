# Enhancer pass — app-v89

Surfaces touched this release: the **plans sheet**, the **Export section** on Account/Settings, and
the **Help** topics for export, plans and privacy. Run inline, before the build, per Rule 1.5.

Two findings changed the build rather than waiting for Aaron, because both were falsehoods on screen
rather than missing capability — and checklist item 6 is explicitly about what is already there:

* **"Most popular" on the Plus card.** Nothing has ever been measured behind it; this build has no
  customers. Removed. (It is also the kind of unsupported claim a store review flags.)
* **Help said backup-to-a-new-phone "is planned but not built yet."** It ships, and sits two taps
  from the topic denying it exists. Logged as task #27 and fixed here. Checklist item 2 word for
  word: *read the empty states out loud — the app is telling you the screen is incomplete.* This
  was not an empty state, it was a note, and it was the app filing a bug report about itself.

## Proposals — Aaron decides, nothing below was built

| # | Proposal | Why | Size |
|---|---|---|---|
| E-1 | **"Restore purchases" on the plans sheet** | Checklist item 1, add/remove symmetry, and the sharpest one on the list. A person who buys Plus, changes phone and reinstalls has **no way to get it back** — the only route to a non-free tier today is the `TEST_MODE` reset button, which is not in a store build. Apple *requires* a restore control; Google expects one. **This is a store blocker, not a nicety**, and it belongs with #31 (Play Billing). | M, blocked on #31 |
| E-2 | **The tier pill should count people, not name a plan** | Account and Profiles both show a pill reading `Free plan`. With every feature free, that badge now tells the reader nothing except that they have not paid — and Aaron's whole decision here is that free must not be made to feel like a penalty. `1 of 1 person` says the only thing the plan still governs, and makes the upgrade legible at the moment it would matter. | S |
| E-3 | **No way back down a tier** | Checklist item 3, can a mistake be corrected. Buying Pro when Plus was meant is unwindable only by the beta reset button. Low urgency — store purchases are refunded through the store, not the app — but worth a line in Help so nobody hunts for a control that should not exist. | S (Help only) |
| E-4 | **The plans sheet is reachable only from Profiles** | Two "View plans" buttons, both on profile screens. Someone wondering what the app costs before committing their records to it has no path from Home, Settings or About. | S |

**Nothing is missing from the Export section.** Save, restore, undo, password, CSV and the printable
report are all on one screen, and after this release none of them is gated. That is the first time
a surface this pass has looked at came back with no add/edit/remove gap at all.
