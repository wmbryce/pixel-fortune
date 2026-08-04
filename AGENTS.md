# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Running the fortune path without an OpenAI key

`test/mock-openai.mjs` is a stand-in chat-completions endpoint with a configurable
delay and an error mode (see its header comment). Start it, then point the app at
it — `openai` reads `OPENAI_BASE_URL`:

    MOCK_DELAY_MS=0 node test/mock-openai.mjs &
    OPENAI_API_KEY=sk-mock OPENAI_BASE_URL=http://localhost:3222/v1 npm run dev

The delay is the lever for the DialogBox state machine: the reveal prompt fires
on a fixed 2200ms beat after the hand is dealt (`REVEAL_BEAT_MS`), so 0ms and
4000ms land the reading either side of that beat. `MOCK_MODE=long` and
`MOCK_MODE=cutoff` cover the two reading-length paths.

## API budget: live until the cap, then cached

`src/server/budget.ts` (spend cap), `src/server/cache.ts` (reading pool),
`src/server/rate-limit.ts`, `src/server/handlers/reading.ts` (the two procedures).
Read the header comments there before changing any of it. Two things are easy to
break without noticing:

- **In cached mode the reading is chosen first and its cards are dealt.** Never
  turn it into "deal a spread, then look up a reading for it" — five of 78 cards
  essentially never repeats, so that lookup would miss every time.
- **A truncated reading never enters the pool.** `GeneratedFortune.truncated`
  (set from `finish_reason === 'length'`, whether or not trimming removed
  anything) skips the `cacheReading` call in `settleGeneration`; the visitor who
  paid for it still gets it, and the hold still replays it for that same token.
  Caching one would re-serve a visibly short reading forever.
- **Budget is reserved before the OpenAI call, not after.** The reserve is one
  atomic `INCRBY`; check-then-call lets a concurrent burst through the cap.
- **A reservation is settled against the month it was charged to**, carried on
  the hold rather than resolved at settle time — otherwise a hold that outlives
  midnight UTC on the 1st refunds into the new month and raises its cap.

The per-reading reservation is **derived at runtime, never configured**: the
price of `FORTUNE_MODEL` (`src/server/model.ts`) applied to `MAX_PROMPT_TOKENS`
plus `PF_MAX_OUTPUT_TOKENS`, times `RESERVATION_MARGIN`. Today: `gpt-4o-mini` at
$0.15/$0.60 per M tokens, 400 prompt + 700 completion tokens = $0.00048 worst
case, reserved at $0.0006. There is deliberately no `PF_READING_BUDGET_USD` —
the settle step caps the charge at the reservation, so a token ceiling raised on
its own would book a call at less than it cost and silently overspend the month.
One knob, and the money follows it. Asserted in `test/fortune-cost.test.ts`.

Consequences worth knowing before touching it:

- `src/server/pricing.ts` owns `MICROS_PER_USD` and is a leaf, because
  `config.ts` derives the reservation from it. Don't make it import the config
  back.
- A model with no row there cannot be derived, so the reservation falls back to
  `UNPRICED_READING_BUDGET_USD` ($0.01) and `/api/status` reports
  `perReadingBudgetDerived: false`. Change `FORTUNE_MODEL`, add its row.
- Rows match by **longest** prefix, because a completion reports the dated
  snapshot (`gpt-4o-mini-2024-07-18`), never the alias the request sent — and
  `gpt-4o` is a prefix of every mini snapshot.

Tuning is env-only, all optional with defaults (`src/server/config.ts`):
`PF_MONTHLY_CAP_USD`, `PF_MAX_OUTPUT_TOKENS`, `PF_RATE_VISITOR`, `PF_RATE_IP`,
`PF_RATE_WINDOW_SECONDS`, `PF_CACHE_MAX`, `PF_HOLD_TTL_SECONDS`,
`PF_MAX_CONCURRENT_HOLDS`. `PF_MONTHLY_CAP_USD=0` is the "never generate live"
kill switch; a blank or non-positive `PF_MAX_OUTPUT_TOKENS` falls back to 700
rather than deriving a zero reservation, which would disable the cap entirely.

Durable state wants Redis (`UPSTASH_REDIS_REST_URL`/`_TOKEN`, or the
`KV_REST_API_*` names Vercel injects). With neither set the store falls back to
per-instance memory — fine for `npm run dev`, useless on Vercel.

`GET /api/status` reports mode, spend, cache size, the derived reservation (and
what it was derived from), `ceilingHits`, and which store is live.
Store failures are contained everywhere else (a visitor gets the cold-start
reading, never an error), so this endpoint is where that shows up: `mode` is
`degraded` — never `live` — when the store cannot answer or recently failed a
command, and `store.lastFailure` names the site. The failure counter is
per-instance, so the log line `noteStoreFailure` emits is the durable record.
`ceilingHits` (`src/server/ceiling.ts`) is the same shape for the other invisible
failure: a count that climbs means `PF_MAX_OUTPUT_TOKENS` is too low.

## The reading's shape is load-bearing

The dialog box splits the reading on blank lines and pages one paragraph at a
time through a 30ms/char typewriter, so the prompt in
`src/server/handlers/fortune.ts` pins the format — 4 paragraphs, blank-line
separated, plain prose, no markdown — as much as the voice. Loosening it pages
literal `##` through a pixel dialog box, or hands `TypingText` a wall of text
that takes minutes to type.

A card is `id`/`name`/`image` and nothing else. #17 removed the empty
`description` field rather than filling it: card text in the prompt breaks the
400-token prompt ceiling the per-reading reservation is derived from. Adding
per-card prose back needs a consumer and a budget answer first.

`TypingText` types out whatever it is handed, in full, always, and owns its own
scroll box; paging is the dialog box's job. It used to cap each page at 1000
characters against a `startIndex` nothing advanced, which stalled the typewriter
mid-paragraph with no Continue button. Regression tests:
`test/typing-text.test.tsx` and the long page case in
`test/dialog-box-race.test.tsx`.

## The dialog box is a state machine, and that is the whole design

`src/app/_components/DialogBox/machine.ts` is pure — no React, no timers, no DOM
— and `index.tsx` owns the clock, the network and the pixels, each of which
talks to it only by dispatching an event. Nothing else writes dialog state.
Three bugs came out of the shape this replaced (a `stateIndex` into a
`dialogStates` array that the mutation's `onSettled` rewrote mid-flight): a fast
reading overwritten by the 2200ms placeholder timer, a typewriter that stopped
without reporting completion, and a reset that misbehaved under machine-fast
keypresses. Three properties make them unrepresentable, and undoing any one
brings its bug back:

- **A reading arriving is not a move.** `reading` fills a slot no `Scene` lives
  in, so no arrival — early, late or never — can touch where the visitor stands.
  The reveal prompt comes from the beat and from nothing else.
- **A `Scene` carries its own text.** `passage` holds the paragraph, not an
  index into an array someone else owns, so no cursor can dangle.
- **`leaving` accepts nothing.** The reset is terminal, so the keypress burst
  during the page exit has nowhere to go, and the box holds the frame it was
  pressed on rather than blanking under the fade.

`test/dialog-machine.test.ts` states all three at the seam;
`test/dialog-box-race.test.tsx` walks the same journeys through React. The box
animates `height` rather than `scaleY` on purpose: the 8px pixel border and the
typewriter's scroll box both distort under a scale, and the strip it grows
inside is reserved, so that layout costs nothing else on the page. Decided in
#16.

## Every control is a real control, and "any key" is not one

The arc is completable by keyboard alone: welcome, draw, five reveals, four
pages of reading, reset. Four rules hold it up, and each replaced something that
looked convenient and was a wall (#18).

- **A card is a `<button>`.** It was a `div` with `onClick`. The keyboard
  reaches the #13 flip through the browser's own Enter/Space-to-click, so there
  is exactly one activation path; nothing hand-binds keys to it. A revealed
  card stays enabled rather than becoming `disabled` — disabling the card that
  holds focus strands it.
- **`isAnyKeyPress` (`_libs/keys.ts`) is what the window listeners answer.**
  Both `Welcome` and `DialogBox` bind `keydown` on the window, which is the
  point of "press any key" — but Tab is how you reach those card buttons, and
  answering it advanced the flow out from under the visitor and refused at the
  reveal prompt on every step between cards. The rule is that a key whose whole
  purpose is navigation is never an activation, and it covers moving the
  viewport as well as moving focus: the arrows, PageUp/PageDown and Home/End
  are out too, because a spread taller than the stage is scrolled to and every
  scroll was read as an advance. Space stays in — it is a real "press any key".
  Shortcut combos are out; every other key still counts, focused or not.
  `DialogBox` additionally ignores Enter/Space aimed at any button, because the
  browser already answers those with a click of the button's own.
- **A face-down card must not name itself.** Both faces are mounted from the
  first frame, so the front's `alt` used to read out a card nobody had turned,
  and the caption sits at `opacity: 0` rather than out of the tree. Both faces
  are `alt=""` and the caption is `aria-hidden`; the button's `aria-label` is
  the single answer, and it changes when the card turns.
- **The reading is announced a paragraph at a time.** The live region is in
  `DialogBox`, outside the page-keyed `TypingText`, because a region has to
  exist before its content changes to be announced. `TypingText`'s visible
  paragraph is `aria-hidden`: a live region over the text a typewriter is
  building announces a character at a time, which is noise. The consequence is
  deliberate — a screen reader hears the paragraph in full while the typewriter
  is on its first characters, and is not made to wait 13s for the button.

`DialogBox` also gives focus back to its button when it remounts after a page
types, but only from `<body>` and only once the visitor has pressed it at least
once. The `<body>` guard is what keeps a visitor who has tabbed off into the
spread from being pulled out of it; the pressed-once ref is what keeps the
first arrival from being a focus grab, since nothing is focused then either and
a focus move cuts off the greeting the live region is still announcing. The
refusal is rendered `key={refusal.nonce}` so each refused advance is a fresh
node: it is one fixed message, and an alert whose text does not change is
announced only the first time. `test/keyboard-access.test.tsx` pins all of
this; `test/card-reveal.test.tsx` pins the card's half.

## The card reveal is a flip, so both faces are always mounted

`Card.tsx` turns the card on `rotateY` (back at 0deg, front at 180deg) with
`backface-visibility: hidden`. The old reveal cross-faded the back _out of the
tree_, so "is the card back in the DOM?" used to answer "is this card hidden?" —
it no longer does, and a test that assumes it passes on a card that never turns.
Assert the rotation instead (`test/card-reveal.test.tsx`).

The scale/z lift is derived from the rotation value, not scheduled beside it, so
an interrupted flip cannot strand the card off the table; it is clamped to
[0,180] because past 180 the sine inverts and the card visibly sinks. The spring
is critically damped on purpose (`bounce: 0`) — a tap carries no momentum for a
bounce to express. Decided in #13, which measured the alternatives.

## Motion comes from tokens, and reduced motion is a cross-fade

`src/app/_libs/motion.ts` owns every spring and duration in the app; nothing
else may hand-type one. `useReducedMotion()` is read in `Card`, `CardTable`,
`DialogBox` and `PageTransition`, and each one substitutes `CROSSFADE` for its
spring rather than disabling the animation — the card stops turning but the back
still fades off it, the deal keeps its beat but each card fades up in its seat,
and hover and press dim instead of lifting. A blanket disable is the failure
mode `test/reduced-motion.test.tsx` exists to catch. Decided in #15.

`TypingText` is the fifth reader, added by #18: the reduced form of a typewriter
is the text. There is no travel to cross-fade, and a box that scrolls itself for
thirteen seconds is the auto-updating motion the preference opts out of.

A reduced variant must restate every key its full-motion twin can put on screen.
`useReducedMotion()` is false on the server, so every document ships the
full-motion `initial` inline; a key the reduced set omits is one the client
never writes back, and the page keeps a value it never asked for.
`test/page-transition.test.tsx` pins it.

Route changes go through `PageTransition` (`usePageLeave(href, direction)`),
which renders the page's own `<main>` and holds `router.push` until the exit has
played. Calling `router.push` directly from a screen is the hard swap it
replaced. Three parts of it are load-bearing and none is decoration:

- **The entrance is CSS** (`_components/page-transition.css`), not motion's
  `initial`. `initial` is the only state the server can inline, so it has to be
  the visible one — a motion-owned entrance ships every document with
  `opacity: 0` on `<main>` and makes the page appear only once it hydrates. The
  media query gives that entrance its reduced-motion form for free. The class is
  dropped once the exit starts, because a running CSS animation outranks
  motion's inline styles — so the exit seeds itself with the opacity that was
  actually on screen, or interrupting the entrance would jump to full
  brightness before fading. Its durations and easing are restated from the
  tokens (a stylesheet cannot import them) and pinned against them in
  `test/page-transition.test.tsx`.
- **Every screen declares what it can leave to** (`prefetch={LEAVES_TO}`, warmed
  on mount). The exit is ~240ms; that is not a head start a cold route arrives
  inside.
- **`loading.tsx` under each route** is what the App Router shows while the
  destination resolves. The push fires _after_ the outgoing screen has faded to
  nothing, so without a boundary a cold hop is a blank screen for the whole
  fetch — worse than the hard swap this replaced.

Two testing consequences:

- **jsdom ships no `matchMedia`**, so `test/setup.ts` installs one that answers
  false to everything.
- **`motion` reads the preference once, lazily, on the first `useReducedMotion`
  in a module graph.** A spec wanting the reduced answer must stub `matchMedia`
  before its first render and cannot share a file with one rendering under the
  default.

## The spread is measured, not set by breakpoints

`CardTable.tsx` measures its stage and calls `planSpread`, which builds both
candidates — five across and 2+3 — and takes the one that actually yields the
larger card without overflowing, never a single threshold: on a short wide
stage 2+3 comes back both smaller _and_ taller. Breakpoints cannot express the
binding constraint either, which is vertical: two rows above the dialog box's
fixed 256px. Three things follow, and all are easy to undo by accident:

- **The dialog's strip is reserved from the start** in `tarot/page.tsx`
  (`h-[292px]`, broken down in the comment there). Letting it size to content
  makes every card resize when the box opens.
- **The caption row is dropped below a 64px card** (`showsLabel` in `Card.tsx`).
  It is the difference between the spread fitting a 568px-tall viewport and not,
  and `fitCard` solves the fit twice so its answer agrees with what `Card` will
  actually render. `test/spread-layout.test.ts` pins both.
- **No plan may paint outside the stage.** `gridTop` is clamped at 0, the stage
  reserves `plan.height` as `minHeight`, and `tarot/layout.tsx` is
  `min-h-[100dvh]` — together they let a landscape phone (a 66px stage) scroll
  to the cards instead of stranding them over the header and the dialog.

Reveals can arrive in one batch, so `UpdateRevealCard` builds the next array
from a ref rather than from state — otherwise each reveal in the batch reads the
same stale array and only the last survives (`test/card-table.test.tsx`).
Decided in #14, which compared five layouts.

## The tarot background is 16:9 and a phone is not

`src/app/tarot/background.css`; its header comment carries the reasoning and the
measurements. The one fact the file cannot show: `#0d0e24` is the illustration's
own border colour, sampled from its corners, which is why filling beyond the art
with it reads as an extension rather than a letterbox. Neither `cover` nor
`contain` works below 4:3 — one crops the tableau away, the other downscales
pixel art 4.6x. Decided in #14.

## TypeScript ceiling

The binding constraint is `typescript-eslint` (vendored under `eslint-config-next`),
whose peer range is `typescript: ">=4.8.4 <6.1.0"` — so the range in `package.json`
is `~6.0.3`, patches only. Widening it to a caret lets `npm install` pull 6.1.x and
lint on an unsupported compiler.

The outer bound is Next.js: `npm run build` fails on TS 7 with "TypeScript 7.x does
not provide the compiler API required by Next.js", even though `tsc --noEmit` is
clean. Don't bump to `latest`.

## Tests, and what CI runs

`npm test` (vitest + jsdom, config in `vitest.config.mts`, specs in `test/`).
Component specs mock `src/app/_trpc/client` rather than standing up tRPC.

`.github/workflows/ci.yml` runs lint, typecheck, test and build on every push
and PR, on the Node in `.nvmrc` with `npm ci`. **The build belongs on CI, not on
your machine** — it is the one check the development box cannot afford, which is
why every step after lint carries
`if: !cancelled() && steps.install.outcome == 'success'`: a red lint must not
mask the other three, but a failed `npm ci` must skip them rather than fail all
three for the same missing `node_modules`.

`shuffleArray` (`src/server/handlers/deck.ts`) shuffles in place _and_ returns
the same array. Kept dual and pinned by `test/deck.test.ts`; `createTarotDeck`
copies `TarotDeck` before calling it, and any new caller must do the same.
`drawHand` (`src/server/handlers/reading.ts`) is exported only so the same spec
pins the real deal instead of a copy of it.

## Formatting is enforced, and prettier is pinned

`npm run lint` runs `prettier --check .` before eslint, so a formatting drift
fails lint. `prettier` is pinned exactly (no caret) — a floating formatter
reformats the repo differently on the next machine, which is worse than none.
`npm run format` fixes. Keep any reformat in its own commit; mixed with real
changes it is unreviewable.

Prettier runs first, and the eslint baseline is **clean** — any finding is
something your change broke. The one long-standing exception, an
`@typescript-eslint/no-explicit-any` on `shuffleArray(array: any[])`, was
carried on the assumption that issue #18 (Accessibility pass) would land the
fix; #33 landed first and made the function generic instead, and #18's PR
followed. Don't reintroduce a baseline: eslint has no suppression and no
`--max-warnings` escape hatch, and adding one would make the lint step
decorative.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
