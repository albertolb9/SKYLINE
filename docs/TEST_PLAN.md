# TEST_PLAN.md — SKYLINE V1

**Status:** Initial QA contract.

## 1. Test layers

1. Pure unit tests — math, schema, PRNG, transforms, state.
2. Book validation tests — invariants and forbidden combinations.
3. Book Player sequencing tests.
4. Determinism regression tests.
5. Storybook/visual fixture tests.
6. Later: RGS integration tests.
7. Later: production math simulation/lookup integrity tests.
8. Later: mobile/performance/submission QA.

## 2. Math tests

### MATH-T001 — Probability total
Given B2, canonical probability sum equals exactly 100%.

### MATH-T002 — RTP
Weighted payout expectation equals exactly 0.96x.

### MATH-T003 — Wincap
No ladder value exceeds 10,000x; 10,000x exists.

### MATH-T004 — Monotonic individual payouts
For ordered positive ladder values, `P(next larger) <= P(current)`.

### MATH-T005 — Moon probability
10,000x probability is 0.00001% in Distribution V1.

### MATH-T006 — Published integrity (production)
Every lookup payout exactly equals its Book payout for the same simulation ID.

## 3. Schema tests

### BOOK-T001 — Event indices
Reject gaps, duplicates or non-zero first index.

### BOOK-T002 — Block ordinals
Reject duplicate/skipped block ordinal.

### BOOK-T003 — Block ranges
Reject offsetU/rotationMd/intensity/direction outside schema.

### BOOK-T004 — Zone order
Reject backwards/skipped zone transitions.

### BOOK-T005 — Collapse invariant
Reject collapse if payout >0.

### BOOK-T006 — Survive invariant
Reject survive if payout ==0.

### BOOK-T007 — Moon invariant
Reject Moon unless payout ==10,000x and Space has been entered.

### BOOK-T008 — Moon required
Production 10,000x narrative Book must contain exactly one Moon event.

### BOOK-T009 — Unknown event
Unknown event type is hard failure in dev/test.

## 4. Determinism tests

### DET-T001 — Logical replay
Play each fixture 100 times; serialized logical fingerprint is byte-identical.

### DET-T002 — PRNG vector
xorshift32 test vector matches `TOWER_SYSTEM.md`.

### DET-T003 — Viewport independence
Play same Book at 390×844, tall mobile and desktop; logical fingerprint is identical.

### DET-T004 — Timing independence
Run Book Player with mocked animation durations; logical event order/final state remains identical.

### DET-T005 — No unseeded RNG
Lint/static rule or code search prevents `Math.random()` in round-critical modules.

## 5. Book Player tests

### PLAYER-T001 — Sequential handlers
Handler N+1 does not begin before awaited handler N resolves.

### PLAYER-T002 — Handler failure
A thrown handler error stops playback and does not advance silently.

### PLAYER-T003 — Replay reset
Play Again resets Tower Model/camera/renderer to initial fixture state before replay.

### PLAYER-T004 — Final state
Result state is entered only after final logical/visual Book sequence completes according to fixture contract.

## 6. Tower behavior visual fixtures

Required Storybook/dev stories:

- clean intensity 0/1;
- offset left/right;
- wobble 1–4;
- nearFall left/right 2–4;
- nearFall → recover;
- nearFall → collapse;
- survive 0–4;
- collapse left/right;
- each zone transition;
- Moon variants;
- full fixtures listed in `PROTOTYPE_V1.md`.

## 7. Camera/layout tests

Representative viewport classes:

- small mobile around 360×640;
- standard mobile around 390×844;
- tall mobile around 430×932;
- tablet-ish portrait;
- desktop landscape;
- later: Stake mini-player/popout dimensions when available in staging.

Assertions:

- tower top visible/focused;
- next block path not hidden by UI;
- result text fits;
- no logical geometry changes;
- no critical clipping during near-fall/collapse.

## 8. Performance prototype gate

Prototype does not need final optimization, but should measure:

- stable interactive FPS on representative mobile hardware/browser;
- no unbounded object creation across repeated Books;
- renderer resets without leaked sprites/listeners;
- no growing memory trend over repeated fixture playback.

## 9. RGS integration tests — later gate

When RGS is connected, add:

- authenticate success/config mapping;
- all allowed play levels exposed;
- insufficient balance;
- invalid/expired session;
- general/maintenance errors;
- 0x path;
- positive single-round path;
- exact end-round behavior per current official SDK;
- reload with active round;
- Replay mode makes no authenticated calls;
- Replay loss/win/big win/Max Win event IDs;
- balance updates only from authoritative responses.

## 10. Submission tests — later gate

- rules/RTP/Max Win visible;
- disclaimer present;
- sound toggle;
- spacebar action;
- languages/currencies;
- social terminology;
- mobile/popout;
- no external runtime requests;
- no console errors/log leaks;
- final asset originality/licensing;
- Replay share URL behavior.

## 11. Exit rule

A task is not complete because it "looks right." It is complete when its requirement IDs and relevant test IDs pass and the SDD remains aligned.
