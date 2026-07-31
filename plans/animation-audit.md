# Animation audit

Stamped at `ab1a15d`. Resolves [#10](https://github.com/wmbryce/pixel-fortune/issues/10).

Audited against the eight categories in the `improve-animations` playbook (Emil Kowalski's motion philosophy). Every finding below was re-read at its `file:line` before being listed.

## Recon

| | |
| --- | --- |
| Stack | Next 16 App Router, React 19, `motion` 12 (`motion/react`), Tailwind 3 |
| Motion surfaces | `Card.tsx`, `CardTable.tsx`, `DialogBox/index.tsx`, plus 4 Tailwind keyframes |
| Tokens | **None.** Every duration, curve and offset is hand-typed inline |
| Personality | Playful pixel-art RPG — earns a larger delight budget than a dashboard |

**Frequency map.** This is a short-session app with one flow: land → deal 5 cards → reveal each → read the fortune → reset. Nothing is hit 100+ times/day, so almost nothing here should be *deleted* for being over-animated. That inverts the usual audit result — the dominant problem is motion that is **wrong or missing**, not motion that is excessive.

## Findings

Ordered by leverage (impact ÷ effort).

| # | Severity | Category | Location | Finding | Fix summary |
| --- | --- | --- | --- | --- | --- |
| 1 | HIGH | Missed opportunity | `Card.tsx:84-101` | The card reveal — the signature moment of a tarot app — is a 1s opacity crossfade of the card back. There is no flip. | 3D `rotateY` flip with `backface-visibility: hidden`, spring `{ duration: 0.5, bounce: 0.2 }` |
| 2 | HIGH | Purpose | `Card.tsx:24,42` | `backgroundRef` is declared but never attached to any element, so the third step of the reveal sequence animates `null`. The darkening it intends already happens via `backgroundVariants`. Dead motion. | Delete the third `animate()` step and the ref |
| 3 | HIGH | Performance | `DialogBox/index.tsx:161-187` | The dialog springs `height` 64px → 256px. Height triggers layout + paint on every frame, on the app's most-visible element. | Animate `transform: scaleY` or a grid-rows trick; keep `height` off the timeline |
| 4 | HIGH | Interruptibility | `CardTable.tsx:29-40` | The deal stagger is a `setTimeout` inside an effect that re-triggers itself by incrementing its own dependency. Non-interruptible, and it is the source of the `react-hooks/set-state-in-effect` lint error. | Delete the effect; use motion's `staggerChildren` / `delayChildren` at 60ms |
| 5 | HIGH | Accessibility | whole app | No `prefers-reduced-motion` handling anywhere — not in CSS, not via `useReducedMotion()`. | Branch transform values on `useReducedMotion()`; keep opacity, drop travel |
| 6 | MEDIUM | Accessibility | `Card.tsx:70` | `whileHover={{ y: -10 }}` is ungated, so touch devices fire a false hover on tap. There is no `whileTap` at all, so the primary interaction has no press feedback. | Gate hover behind `@media (hover: hover)`; add `whileTap={{ scale: 0.97 }}` |
| 7 | MEDIUM | Easing & duration | `tarot/layout.tsx:12`, `Welcome.tsx:8` | `animate-fadeIn` resolves to `fadeInOut 3s linear reverse` — 3000ms on a page entrance, 10× the 300ms UI budget, with `linear` easing and keyframes (so non-interruptible). | 200ms with `cubic-bezier(0.23, 1, 0.32, 1)`, as a transition not keyframes |
| 8 | MEDIUM | Easing & duration | `Card.tsx:89` | Card-back exit is `{ type: 'spring', duration: 1 }`. Nominally a 1s exit — and a motion spring **ignores `duration` unless paired with `bounce` or `visualDuration`**, so the value is inert and the real timing is the default spring. | Subsumed by the flip in #1 |
| 9 | MEDIUM | Easing & duration | `DialogBox/index.tsx:224` | Button row uses `{ duration: 2, type: 'spring' }` — same inert-duration bug, nominally 2s. | `{ type: 'spring', duration: 0.4, bounce: 0.2 }` |
| 10 | MEDIUM | Physicality | `CardTable.tsx:64` | Cards deal in from a hardcoded `y: -500`. On a short viewport they start far off-screen; on a tall one they barely travel. | `y: '-120%'` — percentage of the element's own height |
| 11 | MEDIUM | Purpose | `DialogBox:192`, `CardTable:62` | `layoutId` on elements with no counterpart to travel between, plus `AnimatePresence mode="popLayout"` (`DialogBox:190`) wrapping a permanently-mounted child. Layout-animation machinery doing nothing. | Remove all three |
| 12 | LOW | Cohesion | everywhere | Zero motion tokens. Durations `0.2 / 0.5 / 1 / 2 / 3s` and every spring config are hand-typed at each call site. | Introduce `--ease-*` / `--duration-*` and a shared spring preset |
| 13 | LOW | Cohesion | `Card.tsx:28`, `tailwind.config.ts:47`, `tarot/layout.tsx:12` | Dead motion config: `staggerDelay` declared and unused; the `type` keyframe animation never referenced; `bg-grey` is not a defined colour token. | Delete |
| 14 | LOW | Accessibility | `welcome/page.tsx:39` | `animate-blink` runs `infinite` — perpetual motion with no reduced-motion escape. | Gate under `prefers-reduced-motion` |

## Missed opportunities

Additive, not corrective. Four real seams observed in the flow:

1. **`/welcome` → `/tarot` is a hard swap.** `router.push` with nothing connecting the two screens; the 3s page fade (#7) is a blunt substitute for a real transition. The most spatially meaningful moment in the app has no motion explaining it.
2. **The fortune's arrival is unmarked.** The mutation resolves and text simply begins typing. No transition between "the spirits are consulting" and "here is your reading" — the emotional peak of the app lands flat.
3. **Blocked-continue has no physical feedback.** Clicking Continue before all cards are revealed sets `errorText` and nothing moves. A short shake on the dialog, or a pulse on the unrevealed cards, would say it without prose.
4. **Reset teleports.** "Complete" calls `router.push('/welcome')` — the same hard swap as #1, at the moment the loop closes.

## Suggested execution order

Findings #2, #11, #13 are pure deletions and can land immediately — they shrink the surface everything else has to work against. #1 and #4 are the two that change how the app *feels* and deserve the most care. #5 and #12 are best done once, late, across everything.

Nothing here is blocked on the reveal-interaction prototype ([#13](https://github.com/wmbryce/pixel-fortune/issues/13)) except #1, which that prototype exists to settle.
