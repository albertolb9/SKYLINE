# TASK-P2-sequential-book-player

**Scope:** `PROTOTYPE_V1.md` §7 P2 — Sequential Book Player only. Execution semantics for playing a validated Book's events strictly in order through a handler map. No Tower Model, no real handlers, no rendering, no RGS, no round state machine, no replay adapter, no Storybook UI, no P3+.

**Requirement IDs:** BOOK-002, BOOK-003 (shape), BOOK-004, BOOK-010, QA-006, PROTO-002. Governing spec: `docs/ARCHITECTURE.md` §5 (Book Player), `docs/BOOK_SPEC.md`, `docs/TEST_PLAN.md` §5 (PLAYER-T001/T002).

## Official Stake pattern verified

`stake-engine.com/docs/*` remains an unfetchable client-rendered SPA. Verified instead directly against `github.com/StakeEngine/web-sdk` source:

- `packages/utils-book/src/createPlayBookUtils.ts` — `playBookEvent` resolves the handler via direct property access (`bookEventHandlerMap?.[bookEvent.type]`); context passed to each handler is the caller's base context plus the full `bookEvents` array merged in.
- `packages/utils-book/src/types.ts` — `BookEventHandler<TBookEvent, THandlerContext> = (bookEvent, context) => Promise<void>`; `BookEventHandlerMap` is a record keyed by event-type string.
- `packages/utils-shared/sequence.ts` — confirmed: `for (const [index, item] of itemList.entries()) { const result = await itemHandler(item, index, itemList); results.push(result); }`. No `Promise.all`, no try/catch — a rejection propagates immediately and halts the loop.

**One deliberate divergence, documented rather than silently followed or silently overridden:** the official `playBookEvent` soft-fails on a missing handler (`console.error(...)` + continue). This conflicts with `REQUIREMENTS.md` BOOK-010/QA-006 and `ARCHITECTURE.md` §5 ("Unknown event types are fatal in development/test"), both MUST-level. SKYLINE's player **throws** (`MissingBookEventHandlerError`) instead. Everything else (sequential-array-order execution, each handler fully awaited before the next starts, no `Promise.all`, handler resolved via `event.type`, rejection propagates immediately and unchanged) mirrors the verified official behavior exactly.

## Chosen minimal architecture

- `BookEventContext = { readonly book: Book }` — not generic. `Book.events` (P1) already gives handlers the full array (mirrors official `bookEvents`-in-context); `book.payoutMultiplier`/`.id`/`.name` cover `ARCHITECTURE.md` §5.4's "Book reference." No redundant `index` field — every `BookEvent` already self-carries `.index` (P1 `schema.ts`).
- `BookEventHandler<E extends BookEvent> = (event: E, context: BookEventContext) => Promise<void>` and `BookEventHandlerMap = { [E in BookEvent as E['type']]: BookEventHandler<E> }` — a mapped type keyed per-union-member (each key narrows to its own concrete event type), adapted from the official flat generic since SKYLINE has exactly one fixed `BookEvent` union rather than many games sharing one package.
- `playBookEvents(book, handlerMap)` is the **sole owner** of `BookEventContext` construction — builds `{ book }` once and reuses it for every event. It accepts no `context` parameter, so a `book` argument and a divergent `context.book` are not representable through this API at all (not merely avoided by convention). `playBookEvent(event, handlerMap, context)` keeps an explicit `context` parameter as the lower-level primitive both `playBookEvents` calls internally and later phases (P9 isolated-event stories) can call directly.
- No factory closure (official `createPlayBookUtils` wraps state mainly to avoid re-passing a handler map across many calls within one game instance; SKYLINE doesn't need that yet). No separate `sequence()` utility (verified implementation is a plain awaited `for` loop with no try/catch — inlined directly since there is exactly one caller). No `debug` flag. No generic `Context` type parameter anywhere (deferred to P3, when Tower state is a real requirement). No revalidation inside the player — `validateBook` (P1) is a separate, already-complete concern.
- `BookEventHandlerMap` is the complete ("all 10 keys required") shape, documenting BOOK-003's ideal target for later phases. Function parameters accept `Partial<BookEventHandlerMap>` — permissive at compile time, with the runtime `MissingBookEventHandlerError` as the actual enforcement (and what makes the "missing handler" test constructible at all, mirroring how P1's negative tests used deliberately-malformed data).

## One cast, localized and necessary

`playBookEvent` contains exactly one type assertion in the whole implementation: `handler(event as never, context)`. TypeScript cannot correlate "which union member `handlerMap[event.type]` selected" with "which union member `event` statically is" through a dynamic property access, even though they are always the same event at runtime (a known TS limitation for discriminated-union map dispatch). Considered and rejected a 10-case `switch` statement as a cast-free alternative — it would be more code, more repetition, and harder to maintain across event-type changes, failing "use it only if it remains simpler." No other file in this task contains a cast; notably, `handlerMap[event.type]` itself needed **no** cast on the key (`event.type`'s inferred union is exactly `keyof BookEventHandlerMap`), and the recording handler map (below) needed no casts either, since a function accepting the wider `BookEvent` is soundly assignable to a narrower `BookEventHandler<E>` under `strictFunctionTypes` parameter contravariance.

## Files

- `src/book/player.ts` — `BookEventContext`, `BookEventHandler`, `BookEventHandlerMap`, `MissingBookEventHandlerError`, `playBookEvent`, `playBookEvents`.
- `src/book/player.test.ts` — the full test matrix below.
- `src/test-fixtures/tests/recordingHandlerMap.ts` — `createRecordingHandlerMap()` (complete no-op/recording map keyed off one shared handler closure, with an optional per-event hook for injecting deferred/rejecting behavior) and `createDeferred()` (manually-resolvable promise, used throughout for deterministic sequencing proofs without timers).

## Test matrix → requirement coverage

| # | Proves | Requirement |
|---|---|---|
| 1 | Exact Book order | BOOK-002 |
| 2 | Handler N fully resolves before N+1 begins (synchronous log check before any await) | PLAYER-T001, ARCHITECTURE §5.3 |
| 3 | No `Promise.all`/concurrent handlers (synchronous entered-count check) | PLAYER-T001 |
| 4 | Same fixture → same observed sequence on repeat | BOOK-004 |
| 5 | Missing handler rejects before any later event starts | BOOK-010, QA-006, PLAYER-T002 |
| 6 | Handler rejection propagates unchanged and stops immediately | PLAYER-T002 |
| 7 | `playBookEvents` alone supplies `context.book`; `playBookEvent` trusts whatever it's given | ARCHITECTURE §5.4 |
| 8 | All 11 P1 fixtures traverse start-to-finish | PROTOTYPE_V1.md §7 P2 exit line |
| 9 | No Book/event mutation during playback | ARCHITECTURE §4 (economic boundary / data integrity) |

Plus `playBookEvent`-level unit tests (awaits its handler; `MissingBookEventHandlerError` carries `eventType`/`eventIndex` and a useful message).

## Exit criteria

- All test-matrix items pass.
- `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint` all pass.
- No `Promise.all` anywhere in `src/book/player.ts`.
- No Book/event mutation anywhere in the player.
- All 11 P1 fixtures traverse start-to-finish via a synthetic handler map.

## Out of scope (not built here)

Tower Model, any real SKYLINE visual/audio event handler, Pixi rendering, camera, wobble/collapse/recovery animation, cosmetic PRNG, round state machine, RGS/replay integration, Storybook playback UI, `debug`/logging options, retry/recovery logic, revalidation inside the player, a generic/extensible `Context` type parameter, P3+.
