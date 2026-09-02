# CLAUDE.md — SKYLINE Implementation Contract

This file is normative for Claude Code and any other coding agent working in this repository.

## 1. Mandatory reading before any task

Before modifying code, read in this order:

1. `docs/PROJECT.md`
2. `docs/DECISIONS.md`
3. `docs/REQUIREMENTS.md`
4. The spec(s) relevant to the task
5. `docs/REFERENCE_GAMES.md` when making/changing a V1 product/game-feel decision
6. `docs/STAKE_ENGINE_RULES.md` for any Stake/RGS/math/replay concern
7. `docs/TEST_PLAN.md`

Do not implement from chat memory.

## 2. SDD rule

Every non-trivial implementation must map to one or more requirement IDs. If a requested implementation has no requirement/spec support:

1. do not invent product behavior;
2. identify the missing requirement;
3. update the relevant spec and `DECISIONS.md` before or with the implementation;
4. add/adjust tests.

For larger tasks, create a short implementation note under `docs/work/` named `TASK-<id>-<slug>.md` containing scope, requirement IDs, files to change, tests, and exit criteria. These task notes are execution artifacts, not product truth.

## 3. Locked product rules

Never change these implicitly:

- RTP = 96.00%.
- Max Win = 10,000x.
- Moon is exclusive to 10,000x.
- Official zones are exactly: Street, Skyline, Sky, Atmosphere, Space, Moon.
- One economic play decision per round.
- Stake/RGS is authoritative for the economic result.
- Runtime physics and runtime visual RNG may not determine payout, survival, collapse, zone, block count, or any round-critical outcome.
- Same Book must reproduce the same logical tower and event sequence.
- V1 must remain intentionally simple.

See `docs/DECISIONS.md` for the complete register.

## 4. Stake Engine rule

Never guess a Stake API, RGS, Math SDK, Web SDK, Books, Bet Mode, Replay, End Round, recovery, jurisdiction, currency, or approval behavior.

Before implementing any Stake-specific behavior:

1. re-check the relevant current official documentation/repository;
2. compare it with `docs/STAKE_ENGINE_RULES.md`;
3. update `Verified` date/source if behavior has changed;
4. if official sources conflict, stop implementation of that behavior and record the conflict explicitly.

Community repositories may be used for intelligence only, never as authority.

## 5. Prototype boundary

For `PROTOTYPE_V1`, do not implement unless the spec is amended:

- real RGS calls;
- production Math SDK generation;
- production wallet/balance UI;
- autoplay;
- turbo/fastplay;
- additional Bet Modes;
- bonus features;
- cashout;
- continuation;
- final art;
- final audio;
- real-money/economic physics;
- unrequested feature ideas.

## 6. Determinism contract

Forbidden in round-critical runtime code:

- `Math.random()`;
- unseeded random libraries;
- device/FPS-dependent logical outcomes;
- physics-engine collision results deciding state;
- timing races deciding event order;
- frontend payout calculations that can disagree with Book/RGS.

Cosmetic variation is allowed only through the deterministic cosmetic PRNG defined in `docs/TOWER_SYSTEM.md` and only for fields explicitly classified as cosmetic.

## 7. Book contract

The Book is the presentation contract between math/RGS and frontend.

- Process Book Events strictly in array order.
- Every event type must have a handler or fail loudly in development.
- A handler may fan out into multiple renderer/audio/camera animations.
- Renderer events may dramatize an event; they may not change its logical meaning.
- Do not add camera/VFX/audio as economic Book Events unless the spec explicitly requires it.

## 8. Code quality

- TypeScript strict mode for frontend code.
- Prefer explicit types for Book/Event schemas.
- Validate hardcoded/prototype Books at runtime in development and in tests.
- Keep game logic independent of pixel resolution.
- Keep renderer concerns separate from logical tower state.
- Prefer small pure functions for deterministic transforms.
- Do not silently coerce invalid Book values.
- No console noise or sensitive game data in production builds.

## 9. Testing discipline

Before closing a task:

1. run unit tests;
2. run typecheck/lint if configured;
3. run relevant Storybook stories or deterministic fixtures;
4. verify requirement acceptance criteria;
5. inspect the diff for accidental scope growth;
6. update specs if implementation revealed a durable decision.

Any fix to determinism must include a regression test.

## 10. Git discipline

- Keep commits scoped to a coherent task.
- Do not mix speculative refactors with feature work.
- Do not rewrite locked documentation to make code appear compliant.
- A stable milestone should leave specs, tests, and code aligned.

## 11. Escalation rules

Stop and surface the issue rather than inventing an answer when:

- a Stake rule cannot be verified;
- official Stake sources contradict each other materially;
- a locked decision blocks implementation;
- a Book field is insufficient to reproduce a required visual state;
- a requested change alters Math Distribution V1, RTP, Max Win, zone semantics, or Moon semantics;
- a new feature materially expands V1 scope.

## 12. Implementation philosophy

**Renderer may dramatize. Renderer may never decide.**

**Build the smallest system that proves tension.**
