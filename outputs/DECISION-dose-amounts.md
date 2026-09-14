# Decision memo: the app is guessing a number out of prose, and that is the root of seven refusals

**For Aaron. One decision, three options, my recommendation at the bottom.**

## What happened

app-v81 has been refused by the independent audit **seven times**. Every refusal was correct and
every one found a real dosing defect. The first three were in the original bug. **The last four were
all the same shape: an edge case in a parser that tries to work out how many tablets a caregiver
means from a line of free text.**

    ".5 mg"                                   counted 5 mg          -- ten times the dose
    "5/325 mg"                                counted 5 tablets     -- locked the card
    "5/325 mg q6h"                            counted 6 tablets     -- the interval
    "5/325 mg max 8 tabs daily"               counted 8 tablets     -- the maximum

Each fix was right. Each one revealed another string. **That is not bad luck and it is not going to
stop**, because "how many tablets is this sentence" is an open-ended question and a pharmacy label
is prose.

## What the app actually asks for today

One free-text box, **Dosage options**, holding everything: the strength, the count, the schedule,
the maximum. The app then infers a number from it and enforces a daily limit with that number. It
also has only three units — milligrams, pills, applications — which is the thing you pointed at.

## The three options

| | Option | Size | What you get |
|---|---|---|---|
| **A** | **Ship app-v81 as it stands and stop here.** | done | Measurably safer than what is live on every string measured. The app refuses to guess where it cannot be sure, and says so on every screen that can give a dose. More audit rounds on the same parser. |
| **B** | **A, plus a structured amount field.** | **M–L** | The editor asks *how much* and *what unit* as two controls instead of one free-text box. The app stops inferring: it is told. The free-text box stays for anything that does not fit, and anything typed there simply is not counted — honestly, with the notice that already exists. **This ends the class.** |
| **C** | **B, plus the full unit list** — micrograms, millilitres, units, puffs, patches, drops, mEq. | **L** | What you asked for originally. Needs a change to how a logged dose is stored, which is why the Research seat said not to widen the picker until the counting was right. It now is. |

## What I recommend, and why

**B now, C next.** Not C first: adding units to a box the app has to read prose out of multiplies
the surface of exactly the defect that has cost seven rounds. Once the amount is a number and a unit
the app was *told*, adding more units is a list, not a guess.

**A alone is a defensible stopping point** if the cost matters more than the remaining risk — the
build is better than live and the remaining failure mode is now "the app declines to count and says
so", which is the safe direction. **B is what actually finishes the job.**

## The honest part

Three of the seven refusals were defects I introduced while fixing the previous one. The audit
caught all three, which is the process working — and it is also the strongest argument for B:
**every one of those was a guess about prose. None of them could exist if the app were told the
number.**
