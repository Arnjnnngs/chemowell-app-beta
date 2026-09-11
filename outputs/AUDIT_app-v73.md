# Zero Day Audit — ChemoWell app-v73 and care-tracker v75

AUDITED-COMMIT: 67c5033d9e947d5bdbfca27f767bf038758dee2a
VERDICT: DO NOT SHIP

care-tracker commit examined: `8dc9ced4259e95765f5e947d526a8e6049312833` (index.html and sw.js
unchanged since `feb14ae638245cb20bb6b2240b38fd417705c431`; `APP_VERSION = 'v75'`,
`CACHE = 'caretracker-v75'`).

## THE HEADLINE, IN PLAIN WORDS

**The one safety promise this release is built around is broken in BOTH apps, in opposite
directions, and in both apps the new test says it is fine.**

The promise is: when you bring a removed medication back, its reminders come back OFF, so the weeks
it was away are not counted as missed doses.

* **ChemoWell: the reminders switch themselves back ON the next time the app is opened.** The "off"
  only lasts for as long as that screen stays open. Reopen the app and the medication is tracked
  again — which is exactly the wall of red this release exists to prevent.
* **care-tracker: the reminders are off FOREVER, and the app tells her, in writing, that she can
  turn them back on in Edit. There is no such control anywhere in the app.** So bringing back
  Protonix, Buspirone, Paroxetine, Iron or Dexamethasone silently and permanently switches off
  missed-dose alerting for that medication, under a button labelled "Bring back".

Neither app can lose or corrupt a dose record — I traced every path and found none. The damage here
is to the alerting that protects the patient, and to a sentence that is not true.

---

## BLOCKING FINDINGS

### B1 — ChemoWell: `med.alerts = false` does not survive reopening the app

`normalizeMedication()` (index.html:1118) does not read `original.alerts` at all. It **recomputes**
it:

    alerts: type === 'win' && !(original.scheduleDays && original.scheduleDays.mode === 'asneeded')

`loadMedicationConfig()` runs `saved.meds.map(normalizeMedication)` on **every** load, so the
`med.alerts = false` that `restoreMedicationConfig()` sets is overwritten with `true` for any
scheduled ('win') medication the moment the app is reopened. `state.meds` then holds `true`, and the
next medication edit persists `true` back to storage.

Measured, on the shipped build, driving only the real buttons
(`scratchpad/cw-flood.mjs`, fixture: Protonix, `type:'win'`, two windows):

    archived. keys = ["protonix"]
    A. immediately after restore, SAVED alerts = false     <- what the suite checks
    --- close and reopen the app (reload) ---
    B. after a reload, SAVED alerts = false                <- stale: nothing has rewritten it yet
    C. after ANY later medication edit persists, SAVED alerts = true   <- the live value, written out

The missed-dose walk reads exactly `state.meds.filter(m => m.alerts && m.windows)` (index.html:1719
and :9434), and a restored medication keeps its `windows` from the archived config. So from the next
app open it is tracked again for every day since the range start, including the archived weeks.

**The release's central claim — "RESTORE ALWAYS COMES BACK WITH REMINDERS OFF, whatever the archive
says" — is true for one screen-session and false afterwards.** The same sentence appears, in bold,
in the README row for app-v73 and in `outputs/PM_app-v73.md`; both are untrue of what was built.

Fix: `normalizeMedication` must honour an explicit `alerts === false` (an own key is a decision;
absent is "never configured"), or `restoreMedicationConfig` must record the suppression in a field
normalize does not recompute. Do not fix it by re-applying `alerts = false` at load — that would
make reminders unturnable-on, which is B2 in the other app.

### B2 — care-tracker: the What's New tells her to do something the app cannot do

`index.html:1108`, the v75 changelog entry:

> It comes back with reminders OFF, so the days it was away are not counted as missed doses.
> **Turn them back on in Edit when you are ready.**

There is no reminders control in the medication editor. `medicationFormFrom()` carries no `alerts`
field, and `alerts` is written in exactly two places in the whole file: five `DEFAULT_MEDS` entries
(:197–:216) and `med.alerts = false` in restore (:4525). `normalizeMedication` spreads `...original`,
so `false` is preserved forever; `backfillDefaultMedFlags` fills only ABSENT keys, and `alerts` is
now present. There is no "reset medications to defaults" control — `defaultMedicationConfig()` is a
load fallback only.

Measured, driving only the real buttons (`scratchpad/ct-alerts.mjs`):

    tracked med: {"id":"protonix","name":"Protonix"}
    after restore alerts = false
    reminder/alert controls in the editor: []
    after an editor save, alerts = false  (own key: true )
    after reload, alerts = false

So: **removing and bringing back a tracked medication permanently disables its missed-dose alerting,
with no way back and no warning that it is permanent** — and the release note points at a control
that does not exist. This is the v66 failure class verbatim ("and so can the Weight screen"), and it
is worse than v66 because the false sentence is covering a real, silent loss of a safety feature.

Fix, in order of preference: add the reminders toggle the note already promises, and say in the row
itself that reminders are off until she turns them on; or, if the toggle is out of scope for this
release, change the note and the on-screen sentence to say plainly that the medication comes back
untracked and cannot be re-tracked from this screen — and tell Aaron, because that is a real
regression in cover for the only five medications the app watches.

### B3 — both suites assert the safety claim from a place that cannot see it fail

`test/v73-archived-meds.mjs:280` — *"and reminders are still off"* — reloads and then reads
`alerts` out of **localStorage**. On the broken build that record has not been rewritten yet, so the
check is green while the live app already believes the opposite. This is the identical mistake the
suite's own header records and claims to have fixed one check earlier ("the first version of that
check read `localStorage` and passed on the broken build because the strip happens in memory") — it
was fixed for the archived config and not for `alerts`.

`harness/archived-meds-test.mjs` has the same shape: it asserts the saved record and the missed-dose
count in the same session, and nothing asks whether the caregiver can ever undo the suppression, so
B2 is invisible to it.

**Cheapest edit that breaks what these checks name while leaving them green: the one that is already
in the ChemoWell build.** Any new check must read what the APP believes after a reload (force a
persist, or read through a rendered hook), not what storage happened to keep.

---

## FINDINGS WORTH WRITING DOWN — not blocking

### N1 — ChemoWell: the armed "Yes, bring it back" is rebuilt under her finger every second
The 1s tick guard (index.html:10088) names five confirmations — `confirmDeleteMed`,
`confirmDeleteAppt`, `confirmDeleteNote`, `confirmDeleteProfile`, `confirmRemove` — and app-v73 adds
a sixth without adding it. `render()` builds a fresh tree with `h()`, so the armed button is a new
DOM node each second. Measured against the guarded control in the same session
(`scratchpad/cw-tick.mjs`):

    armed Remove   (in the guard list)  -> SAME node (tick suppressed)
    armed Bring back (NOT in the list)  -> REBUILT every tick

Consequences: focus is dropped every second, so a VoiceOver or keyboard user cannot reliably reach
the second tap; a tap that lands across the swap is delivered to the card, not the button, and reads
as "the app ignored me". No scroll jump (`moved: 0`). One-token fix: add `&& !state.confirmRestoreMed`
to that line. care-tracker's tick guard names no confirmations at all, so it is at least consistent,
and its armed row measured `SAME node` over 1.8s.

### N2 — both: a half-armed "Bring back" survives leaving the screen
`navigateTo` clears `confirmDeleteMed` (care-tracker:2858, ChemoWell:3285) and does not clear
`confirmRestoreMed`. Verified on care-tracker: armed before navigating away `true`, armed after
coming back `true`. Non-destructive, and the button still reads "Yes, bring it back", so it is
honest — but it is inconsistent with every other confirmation in both apps. `confirmRestoreMed` is
also absent from both apps' initial `state` object literal; harmless today (`undefined !== id`), but
it is the only confirmation not declared there.

### N3 — both: `restoreMedicationConfig` reads the archive with a bare index
`const entry = (state.archivedMeds || {})[id];` — no `hasOwnProperty`. Every other id-keyed lookup
in both files was hardened after the v74 block (`nameOf`, `purposeLookup`, `medsyncOwn`, each with a
comment explaining why). I could not reach it from the UI: the row only renders for own keys
(`Object.entries`), and a stale tap after the key is gone is caught by the tie-break, because the
medication is by then in `state.meds`. I drove a medication with the id `constructor` end to end
through both apps — remove, reload, render, bring back, reload — with zero page errors and exactly
one copy restored. Still: one line, the file's own established pattern, and the class that blocked
v74 twice. `safeMedicationId` reduces `__proto__` to `proto` in both apps, so the
prototype-setter hazard in `archived[id] = entry` is unreachable.

### N4 — care-tracker: `migrateSenokotV37` makes the toast untrue for one medication
It runs on every load and on every medsync adopt, and replaces a `senokot` of `type: 'win'` with the
shipped default wholesale. A restored Senokot that was windowed keeps its doses and rules until the
next reload, after which the toast's "is back, with its doses and rules" is no longer true of it.

### N5 — care-tracker: "set up the way it came with the app" is not quite
The shipped-fallback toast says the medication is back "set up the way it came with the app", which
is not so — `alerts` differs from the shipped value. The next sentence discloses it, so it is
self-correcting, but the two halves disagree.

## THE VOICE BRIEF — every caregiver-facing string this diff touched

Section heading ("Removed medications"), the explanatory sentence, both button labels, the aria
labels, and all three toasts read true and would be understood at 2am, **with the exception of
B2**, which is a false instruction, and **N5**. ChemoWell ships no in-app What's New, so there is no
changelog entry to check there — stated as exempt rather than skipped. The section renders only when
something is archived, which is correct; a heading over an empty list would be the defect the v72
audit named.

**The 21 new purpose lines, read as a clinician.** Neulasta, metoclopramide/Reglan, Motrin, MS
Contin, OxyContin, Roxicodone, Ultram, Neurontin, Lidoderm, Xylocaine, Prilosec, Pepcid, Colace,
BuSpar, Paxil, Zoloft, Zyloprim, Tylenol PM, Percocet, Norco and Vicodin are each accurate, free of
dose, schedule, form, route and fever claims, and each says the one thing a caregiver needs. The
combination lines do the job C exists for — I confirmed on the running app that `Tylenol PM` with a
generic of Acetaminophen now renders *"Eases pain, and also contains an antihistamine that helps
with sleep."* rather than the generic fallback. Two notes:

* **`excedrin` is the weakest line of the 21.** *"Eases pain. It also contains aspirin and
  caffeine."* — the bare product name covers Excedrin Tension Headache, which contains **no
  aspirin**, and Excedrin PM, which has diphenhydramine instead. It is also the only combination
  line that does **not** name acetaminophen, where Percocet, Norco and Vicodin all do. Suggest
  *"Eases pain. It also contains acetaminophen, aspirin and caffeine."* The error direction is the
  safe one (naming an ingredient that may be absent, rather than hiding one that is present), which
  is why this is not blocking — but aspirin matters to a patient on chemotherapy with low platelets,
  and that is the reader.
* **promethazine / Phenergan** — *"Settles nausea and vomiting, and is also used for allergies."* is
  true and incomplete in the way C was written to fix: promethazine is strongly sedating, which is
  often why it is given at night and is a fall risk. The table's own Benadryl line names sleep. One
  clause would close it.

## WHAT I COULD NOT BREAK

* **No path here writes, edits or deletes an ENTRY, in either app.** Traced `meds`, `archivedMeds`,
  `persistMedicationConfig`, `deleteMedicationConfig`, `restoreMedicationConfig` and every medsync
  function. The write model's first clause holds.
* Restore under the ORIGINAL id: holds, and the dose history joins back up.
* Tie-break: an active medication holding the id refuses the restore, by name, and the archive keeps
  its copy. Confirmed by accident as well as on purpose — a fixture that had the same medication
  both active and archived could not be armed at all.
* Restoring twice: a no-op. A third, stale tap neither duplicates nor throws.
* The `h()` / prototype trap in the new lookup and the new list render: not reachable (N3).
* Two phones: `medsyncParseConfig` refuses an empty meds array, `medsyncAdopt` re-normalises, and an
  older build reading a richer archive strips `config` back to `{name, sub}` — a degradation to a
  name-only restore, disclosed on screen, not a record loss. A restore and a remove racing on two
  phones is last-write-wins on the config, as every medication edit has always been. A restore while
  the medication editor is open is deferred by the existing `state.medEditor` check in
  `medsyncOnPrefs`. `mergeMissingDefaultMeds` is a no-op when an id leaves the archive, because
  restore puts it into `meds` in the same call.
* Layout: the archived row measured clean at 320 / 360 / 390 / 428 with a 76-character pasted
  medication name in both apps — no horizontal page scroll, no clipped button, no text escaping the
  card, the button a full 44px tall at every width. Vertical growth is graceful (card 141 → 237px at
  320 in care-tracker, 148 → 270px in ChemoWell) with the button never pushed off.
* **Exempt, said out loud:** this sandbox has Chromium only, so iOS rendering and iOS focus
  behaviour are not reproduced here; N1's focus consequence is reasoned from the DOM, not measured on
  a phone. No network was touched — Firebase was stubbed and every other request aborted.

## THE RECORDS

* `cd /home/user/care-tracker && python3 pm.py` → **exit 0**, "clear, with 1 warning to disclose"
  (pinned version literals in nine pre-existing harness files; none introduced by v75).
* `cd /home/user/chemowell-app-beta && ./release_check.sh` → fails, correctly, for two reasons that
  are about process rather than code: this report did not exist when it ran, and
  `outputs/PM_app-v73.md` opens at DO NOT SHIP by design. It will still refuse after this report
  lands, because this report also refuses.
* **The README row for app-v73 and `outputs/PM_app-v73.md` both assert, in bold, that a restored
  medication "ALWAYS COMES BACK WITH REMINDERS OFF, whatever the archive says".** B1 shows that is
  not true of what was built. Both records must be corrected with the fix, not merely re-stamped.
* Both suites re-run clean on the shipped builds as claimed: ChemoWell `test/v73-archived-meds.mjs`
  31/31, care-tracker `harness/archived-meds-test.mjs` 33/33. B3 is why that is not reassuring.

## WHAT TO DO

1. Fix B1 in ChemoWell — make `normalizeMedication` honour an explicit `alerts:false`.
2. Fix B2 in care-tracker — either ship the reminders toggle the changelog already promises, or tell
   her the truth in the changelog and on the screen, and tell Aaron the cover is gone.
3. Fix B3 — the reload check must read what the app believes, then falsify it by reverting the fix
   and watching it go red.
4. N1 is a one-token fix and belongs in the same release.
5. Correct the README row and the PM sign-off to match what actually ships.
