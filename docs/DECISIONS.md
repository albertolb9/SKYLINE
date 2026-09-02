# DECISIONS.md — SKYLINE Decision Register

**Rule:** Decisions are appended and superseded; history is not silently rewritten.  
**Statuses:** LOCKED / ACCEPTED / PROVISIONAL / OPEN / SUPERSEDED.

| ID | Status | Decision |
|---|---|---|
| D-001 | LOCKED | SKYLINE is a stateless, one-play Burst/Instant game for Stake Engine. |
| D-002 | LOCKED | Current official Stake Engine docs/repos are the technical source of truth for Stake behavior. |
| D-003 | LOCKED | RTP is 96.00%. |
| D-004 | LOCKED | Max Win is 10,000x. |
| D-005 | LOCKED | Reaching the Moon is exclusive to the 10,000x Max Win. |
| D-006 | LOCKED | Official environmental progression is Street → Skyline → Sky → Atmosphere → Space → Moon. |
| D-007 | LOCKED | Normal zones use approximately 3–5 blocks; Moon is a final event rather than a normal construction zone. |
| D-008 | LOCKED | Payout Ladder V1 is the discrete ladder defined in `MATH_SPEC.md`. |
| D-009 | LOCKED | Math Distribution V1 is B2 exactly as defined in `MATH_SPEC.md`. |
| D-010 | LOCKED | Stake/RGS is authoritative for economic outcome; frontend physics/motion is presentation only. |
| D-011 | LOCKED | Same Book must reproduce the same logical tower and round event sequence. |
| D-012 | LOCKED | V1 economic result never depends on runtime non-deterministic physics. |
| D-013 | ACCEPTED | Base V1 uses one economic Bet Mode unless later product evidence justifies another. |
| D-014 | ACCEPTED | Partial returns 0.25x, 0.50x and 0.75x are allowed; they are neutral/weak survives, not celebratory wins. |
| D-015 | ACCEPTED | Height correlates with payout statistically, not one-to-one; lower/mid zones deliberately overlap. |
| D-016 | ACCEPTED | Height Distribution V1 is the table in `GAME_SPEC.md`; it is prototype-tunable without changing Math Distribution V1. |
| D-017 | ACCEPTED | Ten Round Archetypes define narrative families; they are not Bet Modes. |
| D-018 | ACCEPTED | Custom Book Events are semantic and compact; one `block` event can imply several renderer animations. |
| D-019 | ACCEPTED | Custom prototype event vocabulary: `towerStart`, `block`, `zoneChange`, `collapse`, `survive`, `moon`; use SDK-standard win events where appropriate. |
| D-020 | ACCEPTED | Five block behaviors: `clean`, `offset`, `wobble`, `slide`, `nearFall`. |
| D-021 | ACCEPTED | Intensity is discrete 0–4. |
| D-022 | ACCEPTED | Logical block placement uses device-independent integer units; renderer converts to pixels. |
| D-023 | ACCEPTED | Round-critical placement/behavior is explicit in the Book; seed-derived randomness is cosmetic only. |
| D-024 | ACCEPTED | Wobble and recovery use deterministic authored curves/presets rather than free rigid-body simulation. |
| D-025 | ACCEPTED | Prototype starts with two deterministic collapse directions/profiles; additional collapse families require evidence. |
| D-026 | ACCEPTED | Moon Runs receive authored/semi-authored treatment rather than being left entirely to generic generation. |
| D-027 | ACCEPTED | Normal play and Replay use the same Book Player/event handlers. |
| D-028 | PROVISIONAL | Base Bet Mode uses `auto_close_disabled = false`; re-verify against current official SDK at RGS integration. |
| D-029 | PROVISIONAL | V1 does not use `/bet/event` for mid-animation progress; add only if integration/approval testing demonstrates need. |
| D-030 | PROVISIONAL | Current single-round lifecycle should mirror current official Web SDK timing by bet type; re-verify before implementation. |
| D-031 | OPEN | Payout presentation during build: fully hidden vs limited progressive indicator. Prototype must permit evaluation. |
| D-032 | OPEN | Final art direction, final palette, block styling, exact ambient assets and audio language are handled in the design track. |
| D-033 | OPEN | Autoplay in production. Do not implement in prototype. |
| D-034 | OPEN | Turbo/Fastplay in production. Do not implement in prototype. |
| D-035 | LOCKED | SDD/repository documents, not chat history, govern implementation. Claude implements specs rather than inventing product. |

## Decision details

### D-003 — RTP 96.00%
**Reason:** Explicit product/math target selected for SKYLINE V1.  
**Impact:** All optimized lookup tables and analysis must validate exact 96.00% target within the Math SDK/RGS-required representation.

### D-004 / D-005 — 10,000x and Moon
**Reason:** The rarest outcome needs a visually unique destination and memorable Replay.  
**Constraint:** Space may contain huge wins up to 5,000x. Only 10,000x may emit `moon`.

### D-008 / D-009 — Payout Ladder and B2
**Reason:** A monotonic frequency shape is easier to reason about and avoids a larger payout being more common than a smaller adjacent payout.  
**Constraint:** Do not alter individual payout probabilities silently during implementation. Any optimizer output must be validated against the locked target distribution or deliberately supersede D-009.

### D-010 — Economic authority
**Reason:** Stake Engine uses pre-generated static outcomes; frontend events are illustrative presentation and winnings are settled from RGS.  
**Constraint:** No browser-side physical accident or random event may change payout.

### D-016 — Height Distribution
**Reason:** Height is presentation/narrative allocation layered on top of the locked economics. It may be tuned for game feel without changing payout probabilities.  
**Constraint:** Moon exclusivity may not be tuned.

### D-028 / D-030 — Round closing
**Reason:** Current official Stake sources distinguish automatic close, `end-round`, and bet-type timing. This is platform-sensitive.  
**Rule:** Treat the present selection as implementation guidance, not an excuse to skip re-verification immediately before RGS code is written.
