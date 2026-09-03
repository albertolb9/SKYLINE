# TASK-P1-book-contracts

**Scope:** `PROTOTYPE_V1.md` §7 P1 — Book contracts only. TypeScript discriminated unions for V1 events, a runtime validator, and deterministic fixture Books. No Book Player, no Tower Model, no rendering, no RGS.

**Requirement IDs:** BOOK-001–BOOK-010, PROTO-002/003/004/005, QA-002, MATH-003 (ladder membership), GAME-006, GAME-008. Governing spec: `docs/BOOK_SPEC.md`, `docs/TOWER_SYSTEM.md` (units/ranges only), `docs/GAME_SPEC.md` §5–7 (zone/archetype guidance).

## Verified official findings (Stake Engine)

`stake-engine.com/docs/*` is a client-rendered SPA and could not be fetched directly this session. Verified instead against `github.com/StakeEngine/math-sdk` source (`src/events/event_constants.py`, `src/events/events.py`):

- Real event-type constants: `setWin`, `setTotalWin`, `finalWin`, `wincap` (plus reel/cluster/free-spin constants not applicable to SKYLINE).
- Every `amount` is `round(value * 100)` — the same ×100 convention `BOOK_SPEC.md` §2 already declares for `payoutMultiplier`.
- `setWin` is skipped once the round's win is capped (`wincap` stands in for it instead).
- Per additional review of official Web SDK sample Books: 0x rounds contain `setTotalWin(0)`/`finalWin(0)` and **no** `setWin` at all.
- No official generated Book/output was found establishing a relative order between `wincap` and `setTotalWin`, and no SKYLINE spec defines one — not enforced.

Resulting rule (implemented in `src/book/validate.ts`):

| Payout class | Result events |
|---|---|
| 0x | `setTotalWin(0)`, `finalWin(0)` — no `setWin`, no `wincap` |
| >0x, <10,000x | `setWin`, `setTotalWin`, `finalWin` (all equal) — no `wincap` |
| 10,000x | `wincap`, `setTotalWin`, `finalWin` (all equal) — no `setWin` |

`finalWin` is always required and must be the last event; no order is asserted between `setWin`/`wincap` and `setTotalWin`.

## Files

- `src/book/schema.ts` — `Zone`, `ZoneChangeTarget`, `BlockBehavior`, `Intensity`, `Direction`, `CollapseProfile`, `MoonVariant`, `Pace`, `RoundArchetype`, all 10 `BookEvent` member types + union, `Book` envelope.
- `src/book/payout.ts` (+ `payout.test.ts`) — centralized ×100 fixed-point conversion helper and the Payout Ladder V1 constant, per `BOOK_SPEC.md` §2's explicit instruction not to scatter `/100` arithmetic.
- `src/book/validate.ts` (+ `validate.test.ts`) — `BookValidationError` + `validateBook(input: unknown): Book`, hand-written (no schema library — see below).
- `src/test-fixtures/events.ts` — representative single events, for reuse by tests and later P9 isolated-event stories.
- `src/test-fixtures/bookBuilder.ts` — deterministic test/fixture-authoring helper (sequential index/ordinal bookkeeping only; every field is still explicitly supplied by the caller — not the offline generator described in `TOWER_SYSTEM.md` §15).
- `src/test-fixtures/books/*.ts` (11 files) + `index.ts` (`FIXTURE_BOOKS` barrel) + `books.test.ts`.

## Validation approach

Hand-written TypeScript assertion validator, no Zod/Valibot. The schema is small and fully specified; what `validateBook` actually checks is almost entirely sequential/stateful array invariants (index contiguity, zone-forward-only, moon-after-space, nothing narrative after the terminal event), which is simpler as a single imperative walk with a small state accumulator than as schema-library `.refine()` chains. Revisit only if the schema grows much larger or starts validating untrusted external JSON (production/RGS concern, not P1).

Two nuances resolved rather than left implicit (see the approved plan for full detail):

1. **Zone is two-level.** `GAME_SPEC.md`/GAME-004 list Moon as the narrative 6th zone; `BOOK_SPEC.md` §7 explicitly excludes Moon from `zoneChange`'s target union. `schema.ts` reflects both: a broad `Zone` (6 values, for later narrative/derived-state use) and a narrower `ZoneChangeTarget` (4 values) actually used by `ZoneChangeEvent`.
2. **No behavior/direction coupling rule.** `BOOK_SPEC.md` has no normative statement linking `behavior` and `direction`; `validateBook` only checks `direction ∈ {-1, 0, 1}`, nothing more.

## Exit criteria

- All 11 fixture Books validate via `validateBook` (`books.test.ts`).
- Hand-built invalid fragments are rejected with a message identifying the offending event (`validate.test.ts`).
- `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint` all pass.
- No `Math.random()`/unseeded RNG anywhere in `src/book/` or `src/test-fixtures/`.
- All fixture `payoutMultiplier` values are on the locked Payout Ladder V1.

## Post-implementation audit correction

A strict audit before commit found `docs/PROTOTYPE_V1.md` §5 fixture 7 named `near-death-win-25x`, but `MATH_SPEC.md`'s locked Payout Ladder V1 has no 25x value (steps 20x → 30x). The fixture's payout was already the correct nearest ladder value (20x); only the name/doc reference was wrong. Corrected: fixture renamed `nearDeathWin25x` → `nearDeathWin20x` (`near-death-win-25x` → `near-death-win-20x`), `PROTOTYPE_V1.md` §5 updated to match. The `nearDeathWin` archetype identifier is unaffected. No schema/validator changes were needed — the issue was fixture-authoring/doc-cross-reference only.

## Out of scope (not built here)

Book Player/sequencing, event handlers, Tower Model, PixiJS rendering, camera, cosmetic PRNG (xorshift32), round state machine, RGS/replay integration, Math SDK generation, Storybook playback stories, P2+.
