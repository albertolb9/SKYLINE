# PROJECT.md — SKYLINE

**Studio:** Bodega Studios  
**Game:** SKYLINE  
**Platform:** Stake Engine  
**Category:** Burst / Instant  
**Status:** Pre-prototype / SDD frozen enough to implement greybox  
**Version:** Product/Math foundation V1

## 1. Product statement

SKYLINE is a fast, stateless Burst Game in which a tower automatically builds block by block after the player presses PLAY. Each block increases perceived instability and vertical spectacle. The economic outcome is already determined by Stake/RGS through the selected static simulation/Book; tower motion is a deterministic visual representation of that result.

The central player question is:

> **How high will this tower go, and will it survive?**

## 2. Core loop

`SELECT PLAY AMOUNT → PLAY → BUILD → COLLAPSE or SURVIVE → RESULT → READY`

There are no player decisions after PLAY in V1.

## 3. Product pillars

### P1 — Constant tension
Every few blocks the player should feel that collapse is plausible. Relief/recovery is as important as danger because it resets tension for the next escalation.

### P2 — Simplicity with depth
V1 should feel richer than its system count. Depth comes from deterministic construction variety, pacing, height, environmental progression, near-falls, recoveries, camera, VFX, and memorable large outcomes—not from extra game modes or bonus systems.

### P3 — Environmental progression
The official world progression is:

1. Street
2. Skyline
3. Sky
4. Atmosphere
5. Space
6. Moon

Moon is not a normal zone. It is the final exclusive destination of the 10,000x Max Win.

### P4 — Determinism
A Book must always reproduce the same logical tower and event sequence. Economic outcome never depends on runtime physics.

### P5 — Mobile first
Composition, readability, camera, UI and performance are designed for mobile first; desktop expands the same composition.

### P6 — Cost discipline
Every new system must justify its production, QA, replay and approval cost.

## 4. Locked economics

- RTP: **96.00%**.
- Max Win: **10,000x**.
- Math Distribution V1: **B2**, specified in `MATH_SPEC.md`.
- 0x probability: **44.00%**.
- Partial return (0 < x < 1): **26.00%**.
- Return ≥1x: **30.00%**.

## 5. Round shape

- Typical normal target: ~6–8 s after prototype tuning.
- Broad product range: ~3–15 s.
- Approximately **3–5 blocks per normal zone**.
- Moon is a final event, not another 3–5-block construction zone.
- Higher outcomes generally reach higher, but early/mid zones overlap heavily so height does not reveal an exact payout.

## 6. Resolution semantics

- `0x`: tower collapses.
- `0.25x / 0.50x / 0.75x`: tower may survive, but presentation is neutral/weak; do not celebrate as a profitable win.
- `≥1x`: survive/result presentation scales with outcome.
- `10,000x`: Moon event + Max Win presentation.

## 7. V1 exclusions

Unless a later decision explicitly changes scope, V1 does not include:

- early cashout;
- continuation;
- gamble;
- jackpots;
- bonus buy;
- bonus rounds;
- powerups with economic effects;
- persistent progression;
- inventory;
- second currency;
- player skill after PLAY;
- multiple economic phases in one round;
- multiple Bet Modes at prototype stage;
- autoplay/turbo at prototype stage.

## 8. Technical philosophy

`Stake/RGS → selected static Book → Book Player → logical Tower Model → deterministic renderer`

Stake/RGS selects and settles the outcome. Books communicate the round. The frontend renders it.

## 9. Definition of prototype success

The greybox is successful when:

1. a first-time viewer understands the game without a tutorial;
2. normal rounds create repeated tension/release beats;
3. the tower feels physically dangerous even though outcome is deterministic;
4. small and large rounds feel different without adding mechanics;
5. the same Book is exactly reproducible;
6. mobile composition remains readable;
7. the codebase is small enough to continue SDD cleanly.

## 10. Current open product questions

- Final payout presentation: fully hidden until resolution vs a limited progressive indicator. Prototype should support testing without changing economics.
- Final art direction and exact environmental objects per zone.
- Final Space reach frequency may be tuned if current Height Distribution makes production assets too rare.
- Autoplay/Turbo are production-stage decisions only after current Stake requirements and product fit are re-verified.

## 11. Documents

See root `README.md` for the normative reading order.
