#!/usr/bin/env python3
"""app-v82 -- the Home hero gets the actions Aaron approved: Log this dose, and Snooze.

    Aaron, 2026-09-14: "This screen shots that I sent for redesign should have been put in place
    when I first approved it over 12 hours ago. Not acceptable. Do it now"

WHAT WAS THERE. app-v80 built the "Up next" card and gave it ONE control, `scrollToMedCard`,
labelled "Go to <name>" or "Show me the card". Aaron's mockup shows two: **Log this dose** and
**Snooze**. So the card announced what was due and then made the caregiver go and find it -- which
is most of the distance between the screen he approved and the screen that shipped.

**WHY IT SHIPPED THAT WAY, and the reasoning was mine and was wrong.** The app-v80 note says: "Its
button does not log a dose. A second way to log a dose is a second way to double-log one." That is a
real hazard and the wrong conclusion drawn from it. The hazard is a second WRITE PATH, not a second
BUTTON. `logMed()` is the one path every dose on Home already takes: it checks the lock, offers the
override when the dose is blocked, and opens the confirm-the-time sheet that actually writes. The
hero calls exactly that, with exactly the arguments a card passes. There is no second path, no
second ceiling check, and nothing new that can double-log.

WHICH DOSE. A medication with one dose option logs that one. A medication offering several strengths
cannot have one chosen for it -- so the hero keeps "Show me the card" for those, because picking a
strength on the caregiver's behalf is precisely the kind of guess this release series has spent
eleven audit rounds learning not to make.

SNOOZE. There was no snooze concept anywhere in this app (`grep -c snooze` = 0), so this defines
one, deliberately small: **it hides the hero for 15 minutes.** It does not touch the dose, the
schedule, the reminder, or any record -- it is the caregiver saying "not now, stop showing me this"
and nothing more. A snooze that moved a reminder would be changing a medication schedule from the
Home screen, which is a different and much larger decision than the one the mockup asks for.

WRITE MODEL: this release writes NO record. `logMed` opens the same sheet it always did -- the write
still happens there, behind the same confirmation -- and Snooze sets one number in memory.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

def cut(src, old, new, what):
    if src.count(old) != 1:
        die(what + ' is not where it was (' + str(src.count(old)) + ' matches) -- nothing written')
    return src.replace(old, new, 1)

src = HTML.read_text(encoding='utf-8')
if 'heroSnoozeUntil' in src:
    die('already applied')

# --- the snooze slot, beside the rest of the ephemeral UI state -------------------------------
src = cut(src, "let state = { medFlash: null,", "let state = { heroSnoozeUntil: 0, medFlash: null,", 'the state object')

# --- the hero's actions -----------------------------------------------------------------------
OLD = """        h('button', {
          onClick: () => scrollToMedCard(nx.med.id),"""
NEW = """        // THE ACTIONS AARON APPROVED. Two controls, not one: log it, or put it off.
        // `heroDose` is the dose to log when there is exactly one to log. With several strengths
        // the app will not choose for her -- it shows the card instead, where the strengths are.
        (function () {
          const doses = Array.isArray(nx.med.doses) ? nx.med.doses : [];
          const heroDose = doses.length === 1 ? doses[0] : null;
          const canLogHere = nx.openNow && (doses.length <= 1);
          return h('div', { 'data-home-actions': 'up-next', style: { display: 'flex', gap: '8px', marginTop: '15px' } },
            canLogHere ? h('button', {
              // THE SAME PATH A MEDICATION CARD TAKES, with the same arguments. logMed checks the
              // lock, offers the override when a dose is blocked, and opens the confirm-the-time
              // sheet that does the writing. The app-v80 note reasoned that a second BUTTON was a
              // second way to double-log; the hazard is a second WRITE PATH, and there is not one.
              onClick: () => logMed(nx.med.id, heroDose),
              style: { flex: '1 1 auto', minWidth: '0', minHeight: '48px', padding: '0 14px', borderRadius: '14px', border: '0', background: '#FFFFFF', color: '#8E3818', fontSize: '16px', fontWeight: '800', boxShadow: '0 3px 10px rgba(0,0,0,0.16)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
            }, 'Log this dose') : null,
            h('button', {
              onClick: () => setState({ heroSnoozeUntil: Date.now() + 15 * 60 * 1000 }),
              // SNOOZE HIDES THE CARD FOR FIFTEEN MINUTES AND DOES NOTHING ELSE. It does not touch
              // the dose, the schedule, the reminder or any record. A snooze that moved a reminder
              // would be editing a medication's schedule from the Home screen, which is a far
              // larger decision than this control is asking to make.
              style: { flexShrink: '0', minHeight: '48px', padding: '0 16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.16)', color: '#FFFFFF', fontSize: '15px', fontWeight: '700' }
            }, 'Snooze'),
            canLogHere ? null : h('button', {
              onClick: () => scrollToMedCard(nx.med.id),"""

src = cut(src, OLD, NEW, 'the hero button')

OLD2 = """        }, (nx.openNow && String(nx.med.name).length <= 22) ? ('Go to ' + nx.med.name) : 'Show me the card')
      ));"""
NEW2 = """            }, 'Show me the card')
          );
        })()
      ));"""
src = cut(src, OLD2, NEW2, 'the hero button label')

# --- honour the snooze ------------------------------------------------------------------------
src = cut(src, """    const nx = nextDueDose(now);""",
"""    const nx = nextDueDose(now);
    // SNOOZED MEANS HIDDEN, NOT HANDLED. The card comes back by itself; nothing about the dose, the
    // schedule or the record has changed while it was away.
    const heroSnoozed = Number(state.heroSnoozeUntil) > Date.now();""",
'the hero data')

# GATED ON THE DUE BRANCH, NOT THE "ALL DONE" ONE. The first version gated the finished-for-today
# card -- the single case where a snooze means nothing, because nothing is outstanding -- and left
# the due card showing after Snooze was tapped. The suite caught it by asserting the hero goes away.
src = cut(src, """      parts.push(h('section', {
        'data-home': 'up-next',
        style: {
          position: 'relative', overflow: 'hidden', borderRadius: '20px', padding: '18px 18px 16px',""",
"""      // SNOOZED MEANS HIDDEN. Gated HERE, on the branch that shows a dose as due \u2014 the first
      // version gated the "all done" branch instead, which is the one case where a snooze means
      // nothing because nothing is outstanding. The suite caught it by asserting the hero goes away.
      if (!heroSnoozed) parts.push(h('section', {
        'data-home': 'up-next',
        style: {
          position: 'relative', overflow: 'hidden', borderRadius: '20px', padding: '18px 18px 16px',""",
'the due hero section')

HTML.write_text(src, encoding='utf-8')
print('app-v82 applied: the hero logs the dose and can be snoozed')
