# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Running the fortune path without an OpenAI key

`test/mock-openai.mjs` is a stand-in chat-completions endpoint with a configurable
delay and an error mode (see its header comment). Start it, then point the app at
it — `openai` reads `OPENAI_BASE_URL`:

    MOCK_DELAY_MS=0 node test/mock-openai.mjs &
    OPENAI_API_KEY=sk-mock OPENAI_BASE_URL=http://localhost:3222/v1 npm run dev

The delay is the lever for the DialogBox state machine: the reveal placeholder is
scheduled 2200ms after the hand is dealt, so 0ms and 4000ms exercise opposite
orderings of the reading vs that timer. `MOCK_MODE=long` and `MOCK_MODE=cutoff`
cover the two reading-length paths.

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

`TypingText` types out whatever it is handed, in full, always; paging is the
dialog box's job. It used to cap each page at 1000 characters against a
`startIndex` nothing advanced, which stalled the typewriter mid-paragraph with
no Continue button. Regression tests: `test/typing-text.test.tsx` and the long
page case in `test/dialog-box-race.test.tsx`.

## The card reveal is a flip, so both faces are always mounted

`Card.tsx` turns the card on `rotateY` (back at 0deg, front at 180deg) with
`backface-visibility: hidden`. The old reveal cross-faded the back *out of the
tree*, so "is the card back in the DOM?" used to answer "is this card hidden?" —
it no longer does, and a test that assumes it passes on a card that never turns.
Assert the rotation instead (`test/card-reveal.test.tsx`).

The scale/z lift is derived from the rotation value, not scheduled beside it, so
an interrupted flip cannot strand the card off the table; it is clamped to
[0,180] because past 180 the sine inverts and the card visibly sinks. The spring
is critically damped on purpose (`bounce: 0`) — a tap carries no momentum for a
bounce to express. Decided in #13, which measured the alternatives.

## The spread is measured, not set by breakpoints

`CardTable.tsx` measures its stage and calls `planSpread` — five across while
they stay usably large, 2+3 once they do not. Breakpoints cannot express the
binding constraint, which is vertical: two rows above the dialog box's fixed
256px. Two things follow, and both are easy to undo by accident:

- **The dialog's strip is reserved from the start** in `tarot/page.tsx`
  (`h-[292px]` = 256 + the box's own `mt-6`). Letting it size to content makes
  every card resize when the box opens.
- **The caption row is dropped below a 64px card** (`showsLabel` in `Card.tsx`).
  It is the difference between the spread fitting a 568px-tall viewport and not,
  and `planSpread` solves the fit twice so its answer agrees with what `Card`
  will actually render. `test/spread-layout.test.ts` pins both.

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

## Tests

`npm test` (vitest + jsdom, config in `vitest.config.mts`, specs in `test/`).
Component specs mock `src/app/_trpc/client` rather than standing up tRPC.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
