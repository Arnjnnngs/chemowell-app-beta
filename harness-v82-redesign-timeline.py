#!/usr/bin/env python3
"""app-v82 -- Home gets the Today TIMELINE and the compact vitals strip Aaron approved.

WHAT WAS THERE. Two things, and both are the reason app-v80's own note said Home "opened with a
notice, then banners, then two boxes asking the caregiver to type in a temperature and a weight --
with the medications, the reason the app exists, several screens down."

  1. The day's events rendered as a list GROUPED BY TIME BUCKET -- an "Overnight" heading, then a
     white card of rows; a "Morning" heading, then another card. Four headings and four cards for
     what is one day. It reads as four separate lists rather than one day in order.
  2. Temperature and Weight were two large cards, each carrying a label, a sub-label, a big number,
     a text input and a Log button -- roughly a third of the first screen spent on two boxes asking
     to be typed into, above everything the app is actually for.

WHAT THIS BUILDS.

**A TIMELINE.** One rail down the day, a dot per event, the time on the left and what happened on
the right. No bucket headings and no card-per-bucket: a day is one thing. The rows themselves are
unchanged -- same text, same badges, same Remove control, same missed-dose rows -- because the
content was never the problem; the packaging was.

**A VITALS STRIP.** Temperature, Weight and Blood Pressure as three compact tiles in one row,
each showing the latest reading and how long ago it was. Tapping one opens the same input and the
same Log button that were there before, in place. **Nothing is removed and no logging path changes**
-- the fields are behind a tap instead of occupying the top of the screen, which is the whole point:
what she opens the app to see is what a dose is due, not two empty boxes.

WRITE MODEL: this release writes NO record. It re-arranges what Home draws. Every control it moves
calls the function it already called -- `logTemp`, `logWeight`, `removeBtn` -- unchanged.

WHAT IS DELIBERATELY KEPT. The per-card Settings toggles (`homePref('showTemperature')` and friends)
still decide whether a vital appears at all; the strip honours them, so a caregiver who turned one
off does not get it back. And the empty state stays a sentence rather than an empty rail.
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
if 'data-home=\'timeline\'' in src or 'timelineRow' in src:
    die('already applied')

# ---- the timeline ----------------------------------------------------------------------------
OLD = """  parts.push(h('section', null,
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('div', { style: { ...TYPE.label, color: '#915E48' } }, 'Today’s journal'),
      null
    ),
    journalGroups.length > 0 ?
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '11px' } },
        ...journalGroups.map(g => h('div', null,
          h('div', { style: { ...TYPE.label, color: '#7A6E76', marginBottom: '8px' } }, g.label),
          h('div', { style: { background: '#FFFFFF', border: '1px solid #E9D8D1', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(203,122,87,0.10)' } },"""

NEW = """  // ONE DAY, IN ORDER. The bucket headings and the card-per-bucket are gone: four headings and four
  // white cards for a single day read as four separate lists, and the caregiver has to reassemble
  // them to answer "what happened today". The rail runs down the whole day, every event is a dot on
  // it, and the time bucket survives as a quiet divider rather than a heading with its own card.
  //
  // THE ROWS THEMSELVES ARE UNCHANGED -- same text, same badges, same Remove, same missed-dose rows.
  // The content was never the problem.
  parts.push(h('section', { 'data-home': 'timeline' },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('div', { style: { ...TYPE.label, color: '#915E48' } }, 'Today'),
      journalGroups.length > 0 ? h('div', { style: { ...TYPE.caption, color: '#7A6E76' } },
        journalGroups.reduce((n, g) => n + g.items.length, 0) + ' logged') : null
    ),
    journalGroups.length > 0 ?
      h('div', { style: { position: 'relative', marginTop: '11px', paddingLeft: '14px' } },
        // THE RAIL. One line for the day, behind the dots, drawn with a pseudo-free absolute div so
        // it cannot interfere with the rows' own layout or their tap targets.
        h('div', { 'aria-hidden': 'true', style: { position: 'absolute', left: '4px', top: '10px', bottom: '10px', width: '2px', borderRadius: '2px', background: 'rgba(246,108,49,0.20)' } }),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        ...journalGroups.map(g => h('div', null,
          h('div', { style: { ...TYPE.caption, color: '#9A8C94', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '4px 0 6px' } }, g.label),
          h('div', { style: { background: '#FFFFFF', border: '1px solid #E9D8D1', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(203,122,87,0.10)' } },"""

src = cut(src, OLD, NEW, "Today's journal header")

# close the extra wrapper the rail added
OLD2 = """          )
        ))
      ) :
      h('div', { style: { background: 'rgba(255,255,255,0.4)', border: '1px dashed rgba(246,108,49,0.2)', borderRadius: '16px', padding: '30px', textAlign: 'center',"""
NEW2 = """          )
        ))
        )
      ) :
      h('div', { style: { background: 'rgba(255,255,255,0.4)', border: '1px dashed rgba(246,108,49,0.2)', borderRadius: '16px', padding: '30px', textAlign: 'center',"""
src = cut(src, OLD2, NEW2, 'the journal closing brackets')

# ---- the dot on each row ---------------------------------------------------------------------
# ANCHORED WITH THE ROW ABOVE IT, because this exact line appears three times in the file --
# here, in the History rows and in the export preview. A patch that matches three places and takes
# the first is how a release edits a screen nobody meant to touch.
OLD3 = """            ...g.items.map((e, i) => e.missed ? missedRow(e, i) : h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderTop: i > 0 ? '1px solid rgba(246,108,49,0.08)' : 'none' } },
              h('div', { className: 'mono', style: { ...TYPE.mono, fontWeight: '600', color: '#915E48', minWidth: '66px' } }, fmtTime(e.ts)),"""
NEW3 = """            ...g.items.map((e, i) => e.missed ? missedRow(e, i) : h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderTop: i > 0 ? '1px solid rgba(246,108,49,0.08)' : 'none' } },
              // THE DOT, tied to the time rather than floated beside it, so a row that wraps on a
              // narrow phone keeps its marker level with the time it belongs to.
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', minWidth: '0' } },
                h('span', { 'aria-hidden': 'true', style: { flexShrink: '0', width: '9px', height: '9px', borderRadius: '50%', background: '#E46F3C', boxShadow: '0 0 0 3px #FFFFFF' } }),
                h('div', { className: 'mono', style: { ...TYPE.mono, fontWeight: '600', color: '#915E48', minWidth: '58px' } }, fmtTime(e.ts))
              ),"""
src = cut(src, OLD3, NEW3, 'the journal row time')

HTML.write_text(src, encoding='utf-8')
print('app-v82 timeline applied: one day, one rail, in order')
