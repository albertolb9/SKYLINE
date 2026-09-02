# REQUIREMENTS.md — SKYLINE Traceability Index

Normative keywords: **MUST/SHALL** = required; **SHOULD** = strong default; **MAY** = optional.

## Product

- **GAME-001** — A round SHALL require exactly one economic player action after play amount selection: PLAY.
- **GAME-002** — A round SHALL resolve as either `collapse` (0x) or `survive` (>0x) presentation.
- **GAME-003** — The player SHALL be able to understand the core mechanic from the first round without a mandatory tutorial.
- **GAME-004** — The official zone order SHALL be Street → Skyline → Sky → Atmosphere → Space → Moon.
- **GAME-005** — Moon SHALL occur only for the 10,000x outcome.
- **GAME-006** — Normal zones SHALL target 3–5 block events each.
- **GAME-007** — Height SHALL not map one-to-one to payout in Street/Skyline/Sky/Atmosphere overlap regions.
- **GAME-008** — 0x outcomes MAY reach Sky but SHALL NOT reach Atmosphere, Space or Moon under Height Distribution V1.
- **GAME-009** — A partial return (<1x) SHALL not use the same celebratory treatment as a profitable result.
- **GAME-010** — Prototype scope SHALL prioritize tension/simplicity over feature count.

## Math

- **MATH-001** — Target RTP SHALL be exactly 96.00% for the base V1 mode.
- **MATH-002** — Maximum payout SHALL be 10,000x.
- **MATH-003** — Payout support SHALL match Payout Ladder V1.
- **MATH-004** — Target payout probabilities SHALL match Distribution B2 unless superseded by an explicit decision.
- **MATH-005** — Total probability SHALL sum to 100%.
- **MATH-006** — Weighted mean payout SHALL equal 0.96x.
- **MATH-007** — 10,000x target probability SHALL be 0.00001% (1 in 10,000,000) in Math Distribution V1.
- **MATH-008** — A larger payout on the locked ladder SHALL NOT have a higher individual probability than the preceding smaller payout in B2.
- **MATH-009** — Math publication SHALL satisfy current Stake Book/LUT payout integrity checks.
- **MATH-010** — Production math SHALL be simulated/analyzed with official Math SDK tooling or compatible verified outputs.

## Stake/RGS

- **STAKE-001** — Normal sessions SHALL authenticate before wallet APIs.
- **STAKE-002** — Frontend SHALL respect play amount configuration returned by RGS authenticate.
- **STAKE-003** — RGS SHALL be authoritative for selected outcome and settlement.
- **STAKE-004** — Game SHALL remain stateless between bets.
- **STAKE-005** — Replay SHALL be supported for new-game approval.
- **STAKE-006** — Replay mode SHALL not require a player session and SHALL disable/hide normal betting controls.
- **STAKE-007** — On authenticate, an active round SHALL be detected and handled according to the current official RGS contract.
- **STAKE-008** — Exact `end-round` behavior SHALL be re-verified against current official docs/Web SDK immediately before RGS implementation.
- **STAKE-009** — Prototype SHALL NOT implement `/bet/event`; production may add it only through a superseding decision.
- **STAKE-010** — Stake sample visual/audio assets SHALL NOT ship in the submitted game.
- **STAKE-011** — Production build SHALL be static and SHALL NOT load external runtime assets outside allowed Stake Engine hosting/CDN rules.
- **STAKE-012** — Game rules SHALL communicate RTP, Max Win and the required RGS/browser disclaimer before submission.

## Books

- **BOOK-001** — Each production simulation SHALL contain `id`, `events`, and `payoutMultiplier` in the current Stake-required form.
- **BOOK-002** — Book Events SHALL process in array order.
- **BOOK-003** — Every event type present in a production Book SHALL have a frontend handler.
- **BOOK-004** — Same Book SHALL produce the same logical tower/event sequence on every playback.
- **BOOK-005** — Round-critical block offset, rotation, behavior, intensity and zone progression SHALL be Book-explicit or deterministically implied by Book data.
- **BOOK-006** — Cosmetic randomness SHALL NOT affect economic or round-critical state.
- **BOOK-007** — `moon` SHALL appear only in a 10,000x Book.
- **BOOK-008** — A 10,000x Book SHALL end with Max Win-compatible final win data from Math SDK output.
- **BOOK-009** — Book schema SHALL use integer logical values for placement/rotation controls.
- **BOOK-010** — Development SHALL fail loudly on unknown Book Event types.

## Tower/renderer

- **TOWER-001** — Runtime physics SHALL NOT determine collapse/survive/payout.
- **TOWER-002** — Logical tower geometry SHALL be independent of screen pixels.
- **TOWER-003** — Renderer SHALL transform logical units to device pixels without changing logical state.
- **TOWER-004** — Wobble, slide, near-fall, recovery and collapse SHALL be deterministic for a given Book.
- **TOWER-005** — `Math.random()` SHALL NOT be used for round-critical behavior.
- **TOWER-006** — Cosmetic PRNG SHALL be deterministic and covered by cross-language test vectors before production generation.
- **TOWER-007** — Tower motion SHALL remain visually legible on target mobile viewports.
- **TOWER-008** — Camera motion SHALL follow deterministic Book/tower progression and SHALL NOT affect logical outcome.

## Prototype

- **PROTO-001** — Prototype SHALL run without live RGS.
- **PROTO-002** — Prototype SHALL play hardcoded validated Books through the same Book Player abstraction intended for Replay.
- **PROTO-003** — Prototype SHALL implement at minimum: towerStart, block, zoneChange, collapse, survive and moon.
- **PROTO-004** — Prototype SHALL implement clean, offset, wobble and nearFall; slide MAY be deferred to the second prototype pass.
- **PROTO-005** — Prototype SHALL include at least one 0x short loss, one cruel 0x, one partial return, one normal win, one big climb, one Space run, and one Moon run.
- **PROTO-006** — Prototype SHALL include Storybook/fixture isolation for each implemented Book Event.
- **PROTO-007** — Prototype SHALL demonstrate deterministic replay of the same fixture.
- **PROTO-008** — Prototype SHALL not contain final art/audio dependencies.

## QA

- **QA-001** — RTP and probability validation SHALL be automated.
- **QA-002** — Book schema validation SHALL be automated.
- **QA-003** — Determinism regression tests SHALL compare logical playback fingerprints.
- **QA-004** — Mobile layout SHALL be tested on representative small, standard and tall aspect ratios.
- **QA-005** — Max Win/Moon fixture SHALL be replayable on demand.
- **QA-006** — Unknown/invalid Book data SHALL produce a development/test failure, not silent fallback.
