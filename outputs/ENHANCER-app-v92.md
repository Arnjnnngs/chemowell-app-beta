# ENHANCER PASS — ChemoWell app-v92

Run **before** the build (Rule 1.5), on the screens app-v92 will touch: the **Home timeline rows**
(task #28) and the **Reports sub-screens** (task #36). The Enhancer proposes; Aaron decides. It
never widens a release on its own — every extra control on a medication app is a new way to mis-tap.

**Everything below was read out of the current `index.html`, with line numbers.** A note on that:
the first draft of this pass claimed symptoms here are corrected by appending a superseding entry.
**That is `care-tracker`'s v72 fix, not this app's** — I was about to write one app's history into
another's record, which is the exact cross-contamination both repos' Rule 0 exists to stop. What
this file actually does is below, measured.

## 1. Add / edit / remove symmetry

| Screen / record | Add | Correct | Remove |
|---|---|---|---|
| Home timeline row — a logged **dose** | yes, from the medication card above | **no** | yes, `removeBtn` (`5885`), and only within 48h |
| Home timeline row — a **symptom** | yes | yes, but **delete-then-re-log** (`3307-3309`) | yes |
| **Bowel movement / appetite** | yes | yes, **append-only** via `supersedeStamp` (`3845`, `3939`, `12010`) | n/a |
| Reports / Weight, Temperature | yes, the report screen has a log control | **no** | **no** — already task #32 |

### Finding E1 — a dose can be logged and deleted, but never corrected. Size M.

Log a dose at 2pm when it was 2am, or tap the wrong dose on the list, and the only route back is
Remove and log it again. Past 48 hours there is no route at all: `removeBtn` returns `null` beyond
48h by design, because history is permanent — which is right, and which means **a wrong time becomes
permanent.** On a medication tracker the time is half the information.

**Recommendation: queue, do not fold into v92.** This is a write-model change — it needs the write
model stated before any code and an independent auditor on it (Rule 2.2: anything that writes, edits
or deletes a record gets an auditor regardless of size). v92 is two layout fixes. Aaron's call on
when it runs.

### Finding E2 — correcting a symptom DELETES the original first, and the safe pattern is already
### in this file two features over. Size S-M.

`confirmTimeAndLog` (`index.html:3307-3309`):

```js
if (editId) await removeEntryDB(editId);
await logSymptom(m.symptomType, ts, { ... });
```

Delete, then write. **Bowel movement and appetite do not do this** — they append an entry whose
stamp is computed by `supersedeStamp(prev, dayStartTs)` so the correction supersedes the original
without removing it. The right pattern exists in the same file.

How it can actually bite, stated honestly rather than dramatically: this app stores to
`localStorage`, not to a remote database, so a refused write is not routine. But `saveJSON` is
`localStorage.setItem` with **no try/catch** (`index.html`, `function saveJSON`), and
`confirmTimeAndLog` wraps neither call. A `QuotaExceededError` on a full device between those two
lines loses the original symptom entry and writes nothing in its place, with no error shown. Narrow,
real, and cheap to close — and it is the same shape as a defect that was live in the sibling app for
ten releases.

**Recommendation: queue with E1** — they are the same work (one append-only correction path serving
both), and they belong behind an auditor, not inside a layout release.

## 2. The empty states, read out loud

- Home, no doses: *"No doses logged yet today. Doses you log from your medication cards will appear
  here."* — **correct and complete.** It points at another screen because the action genuinely is on
  another screen. This is not the Paracentesis bug.
- Blood pressure report, no readings: *"No blood pressure readings yet. Log them…"* — and the report
  screen **does** carry a log control, so the sentence points at the screen it is printed on. Fine.

**Nothing to propose here — said explicitly, because an explicit "nothing this time" is information
and silence is not.**

## 3. Dead ends — information shown with no action available on it

None on the two screens this release touches, beyond E1/E2 above.

## 4. Is everything already on the screen worth being there?

The question this role is most likely to walk past, so it is asked on the record.

- A timeline row shows time · name · badge · dose · Remove. Every element is doing work.
- **The Back pill itself**, since v92 pads the page around it: is a floating Back pill right at all,
  when the nav directly below it returns to Reports in one tap? **Keep it.** The nav goes to the
  Reports *menu*; the pill is the only control that means "out of this report". `index.html:5470`
  records a real v28 tap-target incident on this exact control, so moving or removing it costs more
  than the defect does. **Not a proposal — written down so the next pass does not re-open it.**
- **No finding of the "Averaging 5.6 L per procedure" shape** on either screen: nothing computed
  about the patient appears on a Home timeline row or on the report screens v92 touches that a
  clinician could not use. (The Weight trend's "Average" tile *is* that shape — already task #33,
  awaiting Aaron's decision on what replaces it. Not in this release.)

## The list, for the release message

| # | Proposal | Size | Recommendation |
|---|---|---|---|
| E1 | Let a logged **dose** be corrected — time or dose — instead of delete-and-re-log, which is impossible at all past 48h | M | Queue. Write-model change; needs the write model stated and an auditor. |
| E2 | Correct a **symptom** by appending a superseding entry, the way bowel/appetite already do, instead of deleting the original first | S-M | Queue with E1 — one correction path serves both. |

Nothing else proposed. The empty states and the copy on these screens read clean, and both findings
are the same shape as something this codebase already solved one feature over.
