# Enhancer — app-v93 (the profile notification work)

Run BEFORE the build, on the screens the release touches: the drawer, the app header, and the
notification surface itself. Rule 2.6's question is not "is this correct" — every other seat asks
that — it is **can the caregiver do the whole job here, or does the app send them somewhere else?**

## The screens this release touches

| Screen | Add | Edit | Remove | Verdict |
|---|---|---|---|---|
| Drawer → profile rows | — (Account) | switch, silence | — (Account) | **incomplete, deliberately: see E1** |
| App header (menu button) | n/a | n/a | n/a | read-only by design |
| Notification | n/a | n/a | n/a | not a screen |

## What the release fixes that this role would otherwise have proposed

**The drawer had no profile switcher at all.** Aaron described one — *"you can look over on the
left hand side with the drop down of the accounts or profile"* — and was describing something that
did not exist. Switching profiles lived only on the Account screen, two taps deeper, and the
drawer's identity header is deliberately non-interactive since v54. A caregiver with three people
on one phone had no way to see, from the menu, who they were even tracking. That is now the first
thing the menu shows.

## Proposals — Aaron decides, the builder does not widen the release on its own

**E3 — the profile rows can switch and silence, but not add, rename or delete (S).** Those three
live on the Account screen one row below. This is the add/edit/remove asymmetry from the checklist
and it is **proposed as deliberately left alone**: the drawer is a navigation surface, and putting
a delete control for a whole person's medical record inside a menu that opens with one tap of a
hamburger is a new way to mis-tap something irreversible. Recommendation: **leave it**. Written
down so the asymmetry is a decision and not an oversight.

**E4 — silencing has no end date (S/M).** Aaron's own example is a hospital stay, which ends. The
switch is permanent until somebody notices and turns it back on, and the app never prompts. A
caregiver who silences a profile on admission and forgets is the exact person this app exists to
protect. Options: a plain "silenced since 3 Nov" line on the row (S, no new control, no new
behaviour — **recommended**), or "silence until a date" (M, a date picker and a wake-up path).
Recommendation: ship the date line next release and see whether that is enough before building a
scheduler.

**E5 — a silenced profile's missed doses are still accumulating behind the scenes (S, needs a
decision not code).** Silencing stops the reminder. It does not stop the medication being recorded
as missed, so a two-week hospital stay produces a wall of missed-dose flags in History when the
profile is reopened — and the missed-dose banner has no upper bound (task #17, open). The app
already has the right mechanism for "not taking this at the moment": a medication **pause**, which
`isPausedOn` keeps out of missed-dose history for exactly the days it covers. Proposal: when a
profile is silenced, offer "also pause their medications" as a one-tap follow-up. **This is the
most valuable item on this list** and it is the one that needs Aaron's intent before anything is
built, because it changes the record and not just the alerts.

**E6 — nothing tells the caregiver that silencing leaves appointment reminders on, except the one
line under the rows (S).** That line is correct and visible. The risk is the reverse: somebody
silences a profile expecting total quiet and is then surprised by a 7 AM appointment alert. The
line already says it. Recommendation: **nothing this time** — adding a confirmation dialog to a
reversible toggle is friction on the wrong control.

## Read the empty states out loud

There is one new empty state: a profile with nothing due reads **"Nothing due"**, and the open
profile with nothing due reads **"Open now"**. Neither is a bug report the app wrote about itself
— they are both true statements with no missing action behind them.

## Is everything already on the row worth being there?

Four things compete for a 320px row: the initial, the name, the status line, the count, the bell.
The Designer pass measures that; this role's answer is that the **initial** is the one that earns
its place least — the name is right beside it. It is kept because it is the same identity treatment
the drawer header already uses, and consistency within one screen beats shaving 34px. Flagged, not
proposed.
