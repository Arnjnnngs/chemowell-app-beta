#!/usr/bin/env python3
"""app-v84 -- the Meds card stops being a dead end. Aaron's approved mockup, Enhancer finding E5.

WHAT WAS THERE. A medication card said what the medication IS (name, generic name, what it is for)
and what its rules ARE (doses, minimum gap, which Home card it sits on). It said **nothing about
what has happened**. No count today, no last dose, no running total against the daily limit, no
route through to the log. Rule 2.6's fourth question is *is anything a dead end* -- this is the
clearest one in the app, and `outputs/ENHANCER-app-v81-meds-page.md` logged it as **E5** before
app-v81 shipped.

WHAT THIS BUILDS, and it is exactly the mockup Aaron approved and nothing more:

  * **A STATUS PILL** at the top of every card, from the same `status()` the Home cards use --
    Available / Due now / Paused / Wait 2h 10m / Daily limit reached / Held around treatment.
    One source, so the Meds screen can never disagree with the Home screen about a medication.
  * **A CEILING BAR** for any medication that has a daily limit: *"2,500 / 3,000 mg - 4 doses
    today - 500 mg left"*, with the bar filling and turning amber and then red. Read from
    `dailyCeiling(med)`, which is what the lockout itself reads.
  * **A DOSES-TODAY LINE** for every medication, limit or not: how many doses today and when the
    last one was. A medication with no limit still has a "have they had it today" question, and
    that question had no answer anywhere on this screen.

WRITE MODEL: this release writes NO record and changes NO logging path. Every figure is computed
from `status()`, `dailyCeiling()`, `entriesFor()` and `dayStart()` -- all of which this file already
called on every render. **There is no new button that logs a dose.** A second way to log a dose is a
second way to double-log one; the card links to Home, where the ceiling check, the gap check and
the override flow already live.

WHAT IS DELIBERATELY *NOT* HERE, and each is a proposal in the release message rather than a
silent widening (Rule 2.6: the Enhancer proposes, Aaron decides):
  E1 the unlabelled schedule select - E2 the empty Meds screen - E3 the administrator's paragraph
  E4 "No generic name" printed as a label - E6 the three-deep daily-limit chain - E7 the field order.

WHAT IS DELIBERATELY EXEMPT: a medication whose dose amounts the app cannot count (app-v81's
`uncountableDoses`) gets the doses-today line but NO ceiling bar, because a bar drawn from a total
the app admits it cannot compute would be a number that looks measured and is not. The card says so
in words instead. **Arithmetically correct and clinically meaningless is still a false impression**
-- Rule 2.7's third question, and the reason the paracentesis average was taken off a screen.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('REFUSED: ' + msg); sys.exit(1)

def cut(src, old, new, what):
    if src.count(old) != 1:
        die('%s -- anchor matched %d times, expected exactly 1' % (what, src.count(old)))
    return src.replace(old, new)

src = HTML.read_text()
if "data-med-status" in src:
    die('the Meds card status block is already in this file')

# ---- the helpers, declared above renderMedicationManager ----------------------------------------
HELPERS = r"""
// ---- WHAT THE MEDS CARD SAYS ABOUT TODAY -------------------------------------------------------
//
// Enhancer E5: the card described the medication and its rules and said nothing about what had
// happened. These three helpers are the whole of the fix, and every one of them READS -- none
// writes, and none is a second route to logging a dose.

// The pill, from the SAME status() the Home cards use. One source, so the two screens cannot
// disagree about whether a medication may be given -- which is the only way a status pill can do
// real harm.
function medStatusPill(med) {
  const st = status(med) || {};
  if (st.paused) return { text: 'Paused', fg: '#6F5347', bg: 'rgba(124,97,86,0.12)', bd: 'rgba(124,97,86,0.22)' };
  if (st.chemoBlock) return { text: 'Held around treatment', fg: '#8B3C1B', bg: 'rgba(174,88,51,0.12)', bd: 'rgba(174,88,51,0.26)' };
  if (st.ceilingHit) return { text: 'Daily limit reached', fg: '#A5443C', bg: 'rgba(192,69,59,0.10)', bd: 'rgba(192,69,59,0.26)' };
  if (st.locked && st.availableAt) {
    const left = st.availableAt - state.now;
    return { text: left > 0 ? ('Wait ' + fmtCountdown(left)) : 'Available', fg: '#9A6419', bg: 'rgba(154,100,25,0.10)', bd: 'rgba(154,100,25,0.24)' };
  }
  if (st.courseComplete) return { text: 'Course finished', fg: '#6F5347', bg: 'rgba(124,97,86,0.12)', bd: 'rgba(124,97,86,0.22)' };
  if (st.noWindowToday) return { text: 'Not scheduled today', fg: '#6F5347', bg: 'rgba(124,97,86,0.12)', bd: 'rgba(124,97,86,0.22)' };
  if (st.locked) return { text: 'Not available', fg: '#6F5347', bg: 'rgba(124,97,86,0.12)', bd: 'rgba(124,97,86,0.22)' };
  // DUE NOW vs AVAILABLE is a real distinction and status() marks it with `windowName`, not with a
  // flag: an unlocked SCHEDULED medication is one standing inside an open window, which is what
  // "due" means. An unlocked as-needed medication is merely available -- nothing is asking for it,
  // and a card headed "Due now" would invite a dose nobody asked for (the app-v80 finding).
  // There is no `st.dueNow`; an earlier draft of this function read one and would have printed
  // "Available" for every scheduled medication forever, silently and correctly-looking.
  if (st.windowName) return { text: 'Due now · ' + st.windowName, fg: '#A83D0F', bg: 'rgba(200,83,32,0.12)', bd: 'rgba(200,83,32,0.26)' };
  return { text: 'Available', fg: '#0A6B4A', bg: 'rgba(46,125,79,0.10)', bd: 'rgba(46,125,79,0.24)' };
}

// How many doses today and when the last one was. Every medication has this question, limit or not.
function medTodayLine(med) {
  const from = dayStart(state.now);
  const today = entriesFor(med.id).filter(e => e.ts >= from).sort((a, b) => b.ts - a.ts);
  if (!today.length) return 'None logged today';
  const n = today.length;
  return n + (n === 1 ? ' dose today' : ' doses today') + ' · last at ' + fmtTime(today[0].ts);
}

// The bar, and ONLY when there is a real number behind it. A medication whose amounts the app
// cannot count (app-v81) has no honest total to draw, so it gets no bar -- a bar drawn from a
// figure the app admits it cannot compute looks measured and is not. That is the paracentesis
// average all over again (Rule 2.7, question 3), and it is the harder kind to catch because
// nothing is wrong with the arithmetic.
function medCeilingBar(med) {
  const dc = dailyCeiling(med);
  if (!dc || !dc.max) return null;
  const used = Number(dc.used) || 0;
  const pct = Math.max(0, Math.min(100, (used / dc.max) * 100));
  const over = used >= dc.max;
  const near = !over && pct >= 75;
  const colour = over ? '#C0453B' : near ? '#9A6419' : '#E46F3C';
  const left = Math.max(0, dc.max - used);
  const unit = dc.unit === 'mg' ? 'mg' : String(dc.unit || '');
  return h('div', { 'data-med-ceiling': med.id, style: { marginTop: '9px' } },
    h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' } },
      h('div', { className: 'mono', style: { fontSize: '13px', fontWeight: '700', color: over ? '#A5443C' : '#2A2127' } },
        used.toLocaleString() + ' / ' + dc.max.toLocaleString() + ' ' + unit),
      h('div', { style: { ...TYPE.caption, color: over ? '#A5443C' : '#7A6E76' } },
        over ? 'Limit reached' : (left.toLocaleString() + ' ' + unit + ' left'))
    ),
    h('div', { role: 'img',
      'aria-label': used.toLocaleString() + ' of ' + dc.max.toLocaleString() + ' ' + unit + ' used today',
      style: { height: '8px', marginTop: '6px', borderRadius: '99px', background: 'rgba(246,108,49,0.10)', overflow: 'hidden' } },
      h('div', { style: { height: '100%', width: Math.round(pct) + '%', background: colour, borderRadius: '99px', transition: 'width .45s ease, background .45s ease' } })
    )
  );
}
"""

src = cut(src, "function renderMedicationManager(now) {", HELPERS + "\nfunction renderMedicationManager(now) {",
          'the Meds card helpers')

# ---- the card itself ---------------------------------------------------------------------------
OLD = """      h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: '5px', marginTop: '10px', color: '#5E4337', fontSize: '12px', lineHeight: '1.35' } },
        h('div', null, h('span', { style: { color: '#A83D0F', fontWeight: '700' } }, 'Doses: '), medicationDoseSummary(med)),
        h('div', null, h('span', { style: { color: '#A83D0F', fontWeight: '700' } }, 'Rules: '), formatRuleSummary(med)),
        med.note ? h('div', { style: { color: '#745649' } }, med.note) : null
      ),"""

NEW = """      // WHAT HAS HAPPENED, above what the rules are. The card used to open with configuration;
      // somebody looking at this screen at 2am wants to know whether a dose has been given.
      (function () {
        const pill = medStatusPill(med);
        return h('div', { 'data-med-status': med.id, style: { marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #F0E3DD' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
            h('span', { 'data-med-status-pill': med.id, style: { borderRadius: '99px', padding: '3px 9px', fontSize: '12px', fontWeight: '800', color: pill.fg, background: pill.bg, border: '1px solid ' + pill.bd } }, pill.text),
            h('span', { 'data-med-today': med.id, style: { ...TYPE.caption, color: '#7A6E76', minWidth: '0', overflowWrap: 'anywhere' } }, medTodayLine(med))
          ),
          medCeilingBar(med)
        );
      })(),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: '5px', marginTop: '10px', color: '#5E4337', fontSize: '12px', lineHeight: '1.35' } },
        h('div', null, h('span', { style: { color: '#A83D0F', fontWeight: '700' } }, 'Doses: '), medicationDoseSummary(med)),
        h('div', null, h('span', { style: { color: '#A83D0F', fontWeight: '700' } }, 'Rules: '), formatRuleSummary(med)),
        med.note ? h('div', { style: { color: '#745649' } }, med.note) : null
      ),"""

src = cut(src, OLD, NEW, 'the medication card body')

HTML.write_text(src)
print('OK -- Meds card status, ceiling bar and today line applied')
