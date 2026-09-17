# Designer pass — ChemoWell app-v85 stage 1

The seat the PM gate refused this release for, and it was right to. app-v85 adds a sentence
INSIDE an existing card and lengthens what that card says by roughly a quarter. None of the
three audit passes was a layout pass, and the suite runs at 390 only.

## What was rendered

Four states x three widths = twelve real renders; screenshots in `outputs/design-app-v85/`.
The states are the three that can show the scope line (`on`, `on-exact`, `empty`) plus a
**three-profile** configuration, because the plural branch is reachable on a paid tier
(`tierLimit`: free 1 / plus 3 / pro unlimited) and nothing had ever rendered it.

| state | phone width | line width | line height | overflows right | clipped | page scrolls sideways |
|---|---|---|---|---|---|---|
| on | 320 | 258px | 145px | no | no | no |
| on | 360 | 298px | 109px | no | no | no |
| on | 390 | 328px | 109px | no | no | no |
| on-exact | 320 | 258px | 145px | no | no | no |
| on-exact | 360 | 298px | 109px | no | no | no |
| on-exact | 390 | 328px | 109px | no | no | no |
| empty | 320 | 258px | 145px | no | no | no |
| empty | 360 | 298px | 109px | no | no | no |
| empty | 390 | 328px | 109px | no | no | no |
| on-3prof | 320 | 258px | 145px | no | no | no |
| on-3prof | 360 | 298px | 109px | no | no | no |
| on-3prof | 390 | 328px | 109px | no | no | no |

**Nothing overflows, nothing is clipped, and the page never scrolls sideways — including at 320.**
The line wraps to 145px at 320 and 109px at 360/390: three lines on the narrowest phone, two on
the others. That is the expected shape for a sentence this long, and it is exactly why it was
worth rendering rather than reasoning about.

**A note on this table, because the first version of it was wrong.** The measurement script
spread its results after the viewport width and silently overwrote it, so the table reported
258 / 298 / 328 as phone sizes — the element's own width wearing the viewport's label. Caught
before the report was written, and the keys are namespaced now. An instrument that mislabels
its axis is the shape of defect this release has already been refused for twice.

## The copy as it actually renders

Singular, two profiles:

> This count is for Alex only. The other profile on this phone keeps the reminders it already had, but nothing adds to them while you are not in it, and they run out within about three days — open that profile to set its reminders up again.

Plural, three profiles — **the branch no check had ever rendered**:

> This count is for Alex only. The other 2 profiles on this phone keep the reminders they already had, but nothing adds to those while you are not in them, and they run out within about three days — open that profile to set its reminders up again.

Empty state, where there is no count on the card:

> This is for Alex only. The other profile on this phone keeps the reminders it already had, but nothing adds to them while you are not in it, and they run out within about three days — open that profile to set its reminders up again.

## Findings

1. **No layout defect at any width in any state.** The card grows by one paragraph and absorbs it.
2. **The plural branch reads correctly and agrees in number.** An earlier draft had broken
   agreement (*"they ... the one you are in"*); this confirms the fix on a rendered card rather
   than in source.
3. **It is the longest thing on that card** — at 320 it is three lines of amber under a green
   tick. That is the right emphasis for a limitation people were previously not told about, and
   I am not proposing to shorten it: shortening is how it lost the expiry clause once already.
4. **Deliberately unchanged:** the amber colour and weight match the existing `on-exact`
   advisory line, so the card keeps one visual language for "this is a caveat".

## Exempt, stated rather than skipped

**iPhone rendering.** This sandbox has Chromium only — Safari's font metrics, safe-area insets
and text rendering cannot be reproduced. These are Chromium at Apple viewport sizes and are NOT
a substitute for opening Settings on a real phone.

**Every "native" result here is a Capacitor stub, not a device.** The card renders only when
`isNativeApp()` is true, so the stub is what makes this pass possible at all — and is also its
ceiling.
