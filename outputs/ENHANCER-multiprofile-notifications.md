# Enhancer + Voice — the screens this touches (inline, before any build)

## E1. The Settings notification card has EIGHT states and none of them is the one Aaron hit

`nativeNotifStatus()` returns: web · paused_sim · checking · blocked · not_asked · failed ·
on-exact · empty · on. There is no state for "armed for this profile only, and the other
profile on this phone has nothing armed." So the app cannot say the true thing.

## E2. AND THE 'on' STATE PRINTS A SENTENCE THAT IS TRUE AND LEAVES A FALSE IMPRESSION

    "<N> reminders scheduled over the next 3 days, next at <time>"

With Tom active, N counts TOM's reminders. Aaron reads a green card with a real number and a
real next-fire time and concludes he is covered. He was not. **Every word is accurate and the
screen as a whole is false** — the Voice's first question, and the exact shape this release has
been refused for six times. It is worse here than in a changelog: the thing being misreported is
whether a medication reminder will fire.

## E3. THE NOTIFICATION ITSELF CANNOT SAY WHOSE DOSE IT IS

Body: `"<Medication> Due"` / `"<Medication> — <window> dose window has opened"`. The payload
already carries `profileId` in `extra`, but nothing user-visible does. On a phone with two
patients, "Tylenol Due" does not answer the only question that matters. **This is a privacy
decision, not a copy decision** — a patient name on a lock screen is visible to anyone who picks
the phone up — so it is Aaron's to make, not mine.

## E4. ADD / EDIT / REMOVE SYMMETRY on the profiles card — the Rule 2.6 checklist

The card on Home does: Switch · + Add profile · "Rename or delete profiles in Settings."
It says nothing about reminders. There is no per-profile answer to "will this person be
reminded?" anywhere in the app. A caregiver managing two patients cannot find out from any
screen which of them the phone is currently watching.

## E5. THE EMPTY STATE IS A BUG REPORT THE APP WROTE ABOUT ITSELF

`empty` renders when `notifScheduledCount === 0`. On the non-active profile that is ALWAYS the
case — not because nothing is due, but because nothing was planned. Same sentence, two utterly
different meanings, and the caregiver cannot tell them apart.

## E6. WHAT HAPPENS ON PROFILE DELETE — asked, not answered

`deleteProfile()` removes the storage keys. Nothing visible cancels that profile's armed
notifications. If they survive, the phone keeps firing reminders for a patient the app no longer
has, with no screen able to explain them. Flagged for the Developer to measure; I have not.
