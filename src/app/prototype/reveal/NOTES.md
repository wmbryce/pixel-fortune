# Card reveal prototype — #13

**Question.** What should revealing a card feel like? `revealCard` in `Card.tsx`
bounces 10px on `y` and cross-fades the back out — no flip, no re-hide.

`/prototype/reveal?variant=A|B|C`. Same five cards, `re-hide` resets them, `←`/`→`
cycles. Delete this whole route once the winner lands.

## The three

| | Input | Spring | Derived motion |
| --- | --- | --- | --- |
| **A** | tap | `bounce 0, duration 0.45` | none |
| **B** | drag, 1:1 | `bounce 0.2, duration 0.45`, release velocity handed off | `z` lift from rotation |
| **C** | tap | `bounce 0.5, duration 0.6` | `scale` + `z` from rotation |

All three are a true 3D `rotateY` flip with `backface-visibility: hidden` — back
at 0°, front at 180°, so a card returns to the face it came from.

## Measured (Chrome, `next dev`, inline transform sampled per frame)

- **A** — 0 → 180° monotonic, settles 450ms. Reversed mid-flight at 150ms: carried
  to 148°, turned, settled at 0 by 570ms. No jump, no brick wall — motion re-targets
  from the presentation value and blends velocity.
- **B** — 8px of pointer travel = 6.8°, i.e. 180° over 1.1 card widths, tracked 1:1.
  Flick released at **34°** — nowhere near halfway — projected past the midpoint and
  committed to 180°, settling 583ms with a 1.9° overshoot. Held at 34° and released
  cold, it returned to 0°. Momentum decides, not position.
- **C** — overshoots to **205°** at 155ms, settles 455ms. The derived lift peaks at
  `scale 1.09 / translateZ 46px` at 90°, then inverts on the overshoot to
  `scale 0.95 / translateZ -25px`: the card visibly *sinks below the table* while it
  rocks back. The lift itself is good; the inversion is a side effect of driving it
  from `sin(rotation)` past 180°.

## Against `/apple-design`

| | Interruptible | Physical | Spatially consistent |
| --- | --- | --- | --- |
| A | yes — measured reversal | spring, but flat: a tap carries no momentum, so there is nothing for a bounce to express | yes |
| B | yes — grab cancels the running spring, drag re-tracks from where it is | best of the three: 1:1 tracking, real velocity handoff, rubber-banded past 0/180 | yes — an abandoned drag returns to the face it started on |
| C | yes — same re-target as A | overshoot the gesture never earned (§4: bounce only after a flick/throw), plus the sinking artefact | yes, but the dip breaks the "card on a table" plane |

## Recommendation — **A, grafted with C's lift**

A tap-driven, critically damped 3D flip (`bounce 0`, `duration 0.4`), with C's
`scale`/`z` lift derived from the same rotation value but capped so it cannot invert
past 180°. Reasons, in the ticket's terms:

- **Interruptible:** A is interruptible for free because one motion value has one
  target; B is interruptible too, but only because ~60 lines of pointer bookkeeping
  cancel and hand off correctly. Same property, a fraction of the surface.
- **Physical:** the lift is what makes a flip feel like a card leaving the table, and
  it is derived from the spring rather than scheduled alongside it, so it stays
  correct through an interruption. C's *bounce* is the part to drop — the audit's
  suggested `bounce: 0.2` for #1 is momentum a tap never supplied.
- **Spatially consistent:** all three pass; A is the only one where the return path
  needs no extra rule, because it is the same target run backwards.

Against B, which is the more impressive interaction in isolation: it costs a
horizontal pan gesture on a row that already scrolls horizontally, needs a
discoverability affordance a tarot card does not naturally carry, and turns five
reveals into five drags. Its momentum projection is the thing worth keeping in mind
if a later ticket adds a gesture elsewhere.

## Constrains other tickets

**Accessibility (#18)**

- A / C — the card becomes a real `<button>` with `aria-pressed`; Enter/Space is the
  whole keyboard story. One code path.
- B — the drag is unreachable by keyboard or AT, so #18 has to build a second,
  discrete flip path and keep it in sync with the pointer one.
- All three — `prefers-reduced-motion` reduces to a cross-fade of the two faces with
  no rotation and no lift.

**Mobile (#14)**

- A / C — a tap is a tap; nothing to negotiate. Still needs the `whileHover` gating
  from audit #6 so touch does not fire a false hover.
- B — the card must claim `touch-action: none` (it does here) or the browser scrolls
  the row instead of flipping. That directly fights `overflow-x-auto` on the card
  row, which is how five cards fit on a narrow viewport today.
