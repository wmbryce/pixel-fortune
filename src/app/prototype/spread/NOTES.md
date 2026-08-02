# Mobile spread prototype — #14

**Question.** How does the five-card spread work on a phone? Today
`CardTable.tsx` is `flex flex-row overflow-x-auto`, so three of the five cards
are off-screen and the visitor scrolls sideways to reach them, under a dialog
box pinned `absolute bottom-4` over the row.

`/prototype/spread?variant=A|B|C|D|E&bg=today|scene|zoom`. Same five cards,
`re-hide` resets them, `←`/`→` cycles, `dialog:` toggles the box between its
64px loading height and its 256px message height. Delete this whole route once
the winner lands.

Every variant uses the real reveal from #13 — same spring, same derived lift,
same two mounted faces — because the question is what survives a card that
actually flips.

## The five

| | Idle state | Reach a card | Dialog box |
| --- | --- | --- | --- |
| **A** | fan, overlapped | tap to spread, then tap the card | in flow below; fan sits on top of it |
| **B** | deck of 5, bottom-right | tap deck, tap card, ×5 | in flow below; deck sits beside it |
| **C** | 2+3 grid, all five out | tap the card | in flow below; no overlap at any height |
| **D** | one card centred, neighbours peeking | swipe up to 4 times, then tap | in flow below, dots between |
| **E** | 2+3 grid, dealt as a fan that settles | tap the card | as C |

None of them keeps the dialog over the cards. It moves from `absolute bottom-4`
into the column as a sibling, and the card area takes the slack — which is why
`dialog:64/256` is a switch: the 256px case is what a layout has to survive.

## Measured (Chrome 151, `next dev`, `getBoundingClientRect` sampled per frame)

A flip barely widens a card — `rotateY` narrows the projection as the scale
grows — but it makes it **19% taller** (159px → 189px at the grid size). So the
constraint is vertical clearance, not horizontal.

- **C / A-expanded / E**, 390×844: peak box 111.8 × 189.4. Nearest neighbour
  13.2px clear horizontally, 20.7px clear vertically between the two rows.
  Never leaves the stage.
- **D**, 390×844: scroller is 319px tall with `py-7`; the flipping card peaks at
  277.6px, 9.7px clear of the top edge. `scrollHeight === clientHeight`
  throughout, so the flip introduces no vertical scroll. This is the tightest of
  the five, and it only works because the padding is deliberate — an
  `overflow-x` container clips on the y axis too.
- **B**: the focus slot is the emptiest region on the screen; nothing to clip
  against.
- **D** snap: pitch 180px, `scroll-snap-type: x mandatory`, `snap-align:
  center`, side padding `(width − card)/2` so the first and last card can reach
  the middle. A 120px nudge lands on 180. Peek is ~30px of each neighbour.

Exercised at 390×844, 412×915, 390×1080 and 320×568. 320×568 is the binding
case: `fitCard` drops the card to 65px so C and E still fit two rows above a
256px dialog, and A's fan is the only idle state with room to spare there.

## Against `/apple-design`

| | Reachable without a hunt | Reads as a spread | Interruptible | Spatially consistent |
| --- | --- | --- | --- | --- |
| A | after one extra tap | yes, once spread | yes | best — the grid is the fan run forwards, and every card returns to the slot it left |
| B | one card at a time, 8 taps to see all five | no; only the rail says "five" and only at the end | yes | weakest — deck → focus → rail is one-way; a retired card has no way back |
| C | yes, immediately | yes | trivially, nothing moves | yes |
| D | no — up to 4 swipes | no; dots read as a carousel | yes | yes |
| E | yes, after a 650ms deal | yes | yes | yes — same transform as A, just not a mode |

## Recommendation — **E**

C's grid, with A's fan demoted from a mode to the deal itself. Reasons in the
ticket's terms:

- **Reachability.** Five targets, all on screen, all full size, from the first
  frame the visitor can act. A costs a tap before anything is reachable; D costs
  four swipes; B costs eight taps and never shows the spread.
- **It survives a card flipping in place.** Measured: 13px horizontal and 20.7px
  vertical clearance at the flip's peak, at every size tested down to 320×568.
  D is the one that has to be defended, and its 9.7px is a padding value, not a
  property of the layout.
- **Spatial consistency.** The fan and the grid are the same five cards under
  one transform, so the deal *is* the layout arriving — no second arrangement to
  learn and none to return to. A has the same property but charges a tap for it;
  B breaks it outright.

The fan is worth keeping because it is the only thing here that reads as a
*hand* rather than a diagram, and as the deal it costs nothing.

## Accessibility (#18), per variant

Not attempted here; what each one would hand that ticket:

- **C / E** — five tab stops in reading order matching the visual order, each
  the full card (111×159 at 390 wide, 67×93 at 320 wide: above the 44px minimum
  on both axes at every size tested). Nothing is occluded, so a focus ring is
  visible wherever focus lands. Cheapest of the five.
- **A** — same, but only after the spread; collapsed, four of the five cards
  expose a ~44px sliver, and the covered targets overlap. Needs the fan itself
  to be one control, and the mode to be announced.
- **B** — smallest focus order (one live card at a time) but the deck is a
  second control with its own state, and retired rail cards are 39–54px wide
  and unreachable, so "review the card I already turned" has no path.
- **D** — reachability is the whole problem: a keyboard user tabbing to card 4
  needs the scroller to follow focus, and a screen reader gets five cards of
  which four are visually off-stage.

## Background and the welcome copy

Both are variant-independent and already applied to the app.

- `background-attachment: fixed` is gone; the layout fits the viewport so it
  bought nothing, and it janks on iOS. Below 4:3 the art is sized to 1.7x the
  viewport width over `#0d0e24` — its own border colour, sampled from the
  corners, so the fill is an extension of the image and not a letterbox. `cover`
  on 390×1080 showed a 474px slice of 1792 and read as a wall of moon; `contain`
  (`bg=scene`) keeps everything but downscales pixel art 4.6x into mush. `zoom`
  keeps the whole tableau at a magnification the art can take. Compare with
  `?bg=today|scene|zoom`.
- "Press any key to continue" becomes "Tap to continue" under
  `@media (hover: hover) and (pointer: fine)` — both strings render and the
  input capability picks one, so it is right in the first paint and right again
  if a keyboard is attached later. See `src/app/welcome/welcome.css`.
