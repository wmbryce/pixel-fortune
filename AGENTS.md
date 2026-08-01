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
orderings of the reading vs that timer.

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
