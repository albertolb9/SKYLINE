# SKYLINE — SDD Package V1

**Studio:** Bodega Studios  
**Platform target:** Stake Engine  
**Product type:** Burst / Instant  
**Package version:** 0.1.0  
**Prepared:** 2026-09-02  
**Status:** Initial implementation package

SKYLINE is Bodega Studios' first serious Burst Game for Stake Engine. A tower builds automatically block by block. The higher it climbs, the more spectacular the environment becomes and the more unstable the tower appears. The player makes one play decision; Stake/RGS is authoritative for the economic result, while the frontend deterministically presents the selected Book.

## Core product anchors

- RTP: **96.00%**.
- Max Win: **10,000x**.
- Environmental progression: **Street → Skyline → Sky → Atmosphere → Space → Moon**.
- **Moon is exclusive to the 10,000x Max Win.**
- Target round length: usually **~3–15 seconds**, with most normal rounds intended around **~6–8 seconds** after tuning.
- Mobile-first.
- Stateless.
- One player action after choosing play amount: **PLAY**.
- Runtime physics never determines an economic outcome.
- Same Book must reproduce the same logical round.

## Read order before implementation

1. [`CLAUDE.md`](CLAUDE.md)
2. [`docs/PROJECT.md`](docs/PROJECT.md)
3. [`docs/DECISIONS.md`](docs/DECISIONS.md)
4. [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
5. [`docs/GAME_SPEC.md`](docs/GAME_SPEC.md)
6. [`docs/REFERENCE_GAMES.md`](docs/REFERENCE_GAMES.md)
7. [`docs/MATH_SPEC.md`](docs/MATH_SPEC.md)
8. [`docs/STAKE_ENGINE_RULES.md`](docs/STAKE_ENGINE_RULES.md)
9. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
10. [`docs/ROUND_LIFECYCLE.md`](docs/ROUND_LIFECYCLE.md)
11. [`docs/BOOK_SPEC.md`](docs/BOOK_SPEC.md)
12. [`docs/TOWER_SYSTEM.md`](docs/TOWER_SYSTEM.md)
13. [`docs/PROTOTYPE_V1.md`](docs/PROTOTYPE_V1.md)
14. [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md)
15. [`docs/ART_DIRECTION.md`](docs/ART_DIRECTION.md)
16. [`docs/STAKE_SUBMISSION_CHECKLIST.md`](docs/STAKE_SUBMISSION_CHECKLIST.md)

## Status vocabulary

- **LOCKED** — explicitly closed; implementation must not change it without a new decision entry.
- **ACCEPTED** — current V1 direction; may be tuned only through an explicit SDD change.
- **PROVISIONAL** — selected working approach that must be verified during prototype/RGS integration.
- **OPEN** — intentionally undecided.
- **SUPERSEDED** — historical only; do not implement.

## Source-of-truth hierarchy

1. Current official Stake Engine documentation and official Stake Engine repositories for platform behavior.
2. This repository's locked SDD decisions for SKYLINE product behavior.
3. Current code and tests.
4. Chat history and external/community sources are context only.

If code conflicts with a locked spec, the spec wins until the decision is deliberately changed.

## Current implementation gate

**Do not start production integration yet.** The first coding target is the deterministic greybox defined in `docs/PROTOTYPE_V1.md`. The prototype exists to answer one question: **does the tower create continuous tension with very low systemic complexity?**

## Prototype tooling (P0 bootstrap)

Plain Vite + Svelte 5 app (no SvelteKit — single canvas view, no routing/SSR needed), PixiJS 8 renderer, TypeScript strict mode, Vitest for pure unit tests, Storybook for the fixture/QA dev surface. Single pnpm package, not a TurboRepo monorepo (SKYLINE is one game; `docs/ARCHITECTURE.md` §3 already specifies a single `src/` module tree).

Versions verified against `github.com/StakeEngine/web-sdk` per `docs/STAKE_ENGINE_RULES.md` SE-021 on 2026-09-02, then pinned exact (no `^`/`~`) in `package.json` to the versions `pnpm-lock.yaml` actually resolved, for reproducible installs:

| Tool | Version |
|---|---|
| Node | `>=22.16.0` |
| pnpm | `10.5.0` |
| Svelte | `5.57.0` |
| PixiJS | `8.20.1` |
| Vite | `6.4.3` |
| TypeScript | `5.9.3` |
| Vitest | `3.2.7` |
| Storybook | `9.1.20` (framework: `@storybook/svelte-vite`, the Vite-only counterpart to the official SDK's `@storybook/sveltekit` — SKYLINE has no SvelteKit app to target) |
| ESLint | `9.39.5` (flat config) |
| Prettier | `3.9.6` |

No dedicated unit-test runner exists in the official Web SDK (it relies on Storybook/Chromatic); Vitest was added here because `docs/TEST_PLAN.md` and `docs/REQUIREMENTS.md` (QA-001–003) require pure unit tests for math/schema/PRNG/determinism independent of visual fixtures.

Commands:

```
pnpm install
pnpm dev             # local dev server, empty Pixi stage
pnpm build            # static production bundle
pnpm test             # Vitest unit tests
pnpm typecheck         # svelte-check, strict mode
pnpm lint / pnpm format
pnpm storybook          # fixture/component dev surface
pnpm build-storybook
```
