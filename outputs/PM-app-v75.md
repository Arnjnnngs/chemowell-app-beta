# PM sign-off — ChemoWell app-v75

**NOT SIGNED OFF FOR RELEASE. One item needs Aaron.** Everything else is done, verified and pushed.

## What shipped into the branch

MedlinePlus's own sentences, fetched once on a build machine and baked in, with a link to the exact
page each came from. The app still makes no outbound request of any kind: a phone downloads
something that already knows the answers and asks nobody anything.

- **30 descriptions quoted; 11 of them actually show.** The other 19 lose to a line this app already
  had, which is deliberate and is the whole of the first audit block.
- **The card shows two lines and opens the rest on tap.** Aaron approved a 120-character limit; built
  as a data rule it would have deleted a third of the table, so it moved to the display. Nothing is
  trimmed — every word is in the page and in the accessibility tree.
- **The citation is earned.** "Read it on MedlinePlus" appears only over words that came from that
  page. Otherwise the link stays a search.
- **One specific patient taken out of a shared product** (`harness-product-neutral-patch.py`): the
  medication disclaimer said "Follow her care team", two In-Patient FAQ sentences narrated a hospital
  stay as "she", and a dead `ceilingMg: 2500` carried one care plan's acetaminophen limit. Zero
  gendered pronouns remain in any user-facing string, checked by parsing them out of the file.

## Gates

| gate | result |
|---|---|
| `test/v75-table-builder.mjs` | 96/96 |
| `test/v75-med-description-shots.mjs` (320 / 360 / 390) | all pass |
| `test/v72-med-purpose.mjs` | 64/64 (was 61/62) |
| `test/v74-med-lookup.mjs` | 32/32 (was 30/31) |
| Zero Day Audit | **BLOCK ×2**, both cleared — `outputs/AUDIT-app-v75.md` |
| `./release_check.sh` | blocked until this file and the audit existed |

Five suites are red and were red on app-v74 before any of this work: `audit-v55`, `pm-v55`,
`pm-v55b`, `v57-browser-notice`, `v74-shipped-audit-probe`, plus `audit-v55b` which cannot start at
all (it reads a path from a sandbox that no longer exists). **Confirmed pre-existing by running them
against the app-v74 build**, not assumed. They are not this release's and are not fixed by it.

## Every new check was falsified

Not one was trusted without being broken first: the ordering check (restore the blocked order → it
names all 13 regressions), the notice gate (both directions — always-on fails the empty case, the old
gate fails the unrecognised-medication case), the run-on backstop, the length ceiling, the on-topic
requirement (both directions, because a requirement fails the opposite way from a ban), the
ambiguous-alias refusal, the brand parser against a fixture that now contains a table of contents,
and the off-label reporter against four sentences that must NOT be flagged.

## What needs Aaron

**Whether to ship it at all.** He has not approved a push to `main`, and this release puts 11 medical
sentences on a screen. It sits on `claude/caretracker-team-review-i83ik2`, fully reproducible from
`origin/main` + the two patches.

**And the open content question.** Two sentences survive every guard and assert nothing false, but a
person might still not want them:

- **leucovorin** — "…or to treat an overdose of methotrexate". Accurate; the word "overdose" on a
  medication card is alarming.
- **amitriptyline** — "Used to treat symptoms of depression", while `tools/med-list.json` has it on
  the list for nerve pain and mouth sores. Flagged by the new off-label reporter, deliberately not
  dropped.

## Standing after this release

**The hardcoded medication rules are still in the file** — the Zofran post-chemo block, the
dexamethasone tile, Iron + Protonix, the Tylenol ceiling copy. Verified unreachable for a real user
by running the app (a new "Zofran" gets id `zofran-2`), but the fence is the only thing holding.
Removing them is a behaviour change and needs its own release. This is the remaining half of Aaron's
"no hard coding for medication including treatment or diagnosis".

**Coverage is 85 of 113 pages, not 113.** 46 → 68 with dosage forms allowed for, 68 → 85 once brand
names were read off the pages themselves. The last 28 are drugs MedlinePlus does not carry under any
name we hold, plus the ones where two pages claim the same short name and the run refuses to guess
(fluorouracil is both an infusion and a skin cream). Those refusals are printed by name every run.
