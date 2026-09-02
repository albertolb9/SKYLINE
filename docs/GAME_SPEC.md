# GAME_SPEC.md — SKYLINE Game Specification V1

**Status:** Product foundation ACCEPTED / locked items referenced in Decisions  
**Goal:** Define what the player experiences; implementation details live elsewhere.

## 1. One-sentence mechanic

Press PLAY and watch a block tower build upward through increasingly spectacular environments while it appears closer and closer to collapse; if it survives, reveal the selected payout, and if it collapses the result is 0x.

## 2. Core loop

1. Player selects an allowed play amount.
2. Player presses PLAY.
3. Stake/RGS selects/returns the round Book in production.
4. Tower begins automatically.
5. Blocks land with increasing visual risk and intermittent recovery.
6. Camera/world progress upward.
7. Round resolves:
   - collapse → 0x;
   - survive → >0x result;
   - Moon → 10,000x Max Win.
8. Result is clearly displayed.
9. Game returns to READY.

## 3. Player agency

No choices occur after PLAY in V1. There is no cashout or skill timing.

## 4. Environmental zones — LOCKED

1. **Street**
2. **Skyline**
3. **Sky**
4. **Atmosphere**
5. **Space**
6. **Moon**

World objects are art-direction content, not economic mechanics. Current design intent includes concepts such as cars at Street, birds in Sky and aircraft around the upper-sky/Atmosphere transition, but exact placement/assets are not locked in this technical package.

Moon is a unique final destination, not a normal repeatable zone.

## 5. Zone length

- Each normal zone targets **3–5 block events** before a zone transition or terminal resolution.
- A Street-only round therefore usually contains 3–5 blocks.
- Reaching Skyline normally implies Street 3–5 + Skyline 3–5, etc.
- Moon occurs after Space as a final authored event.

Prototype may tune block timings, but not the 3–5 design rule without an SDD decision.

## 6. Height Distribution V1 — ACCEPTED, prototype-tunable

This table allocates an economic payout class to a terminal visual zone. Percentages are conditional within each payout class and do not change payout probabilities.

| Payout class | Street | Skyline | Sky | Atmosphere | Space | Moon |
|---|---:|---:|---:|---:|---:|---:|
| 0x | 65% | 33% | 2% | — | — | — |
| 0.25–0.75x | 55% | 43% | 2% | — | — | — |
| 1–1.5x | 25% | 65% | 10% | — | — | — |
| 2–4x | 5% | 60% | 35% | — | — | — |
| 5–7.5x | — | 25% | 65% | 10% | — | — |
| 10–30x | — | 5% | 60% | 35% | — | — |
| 50–150x | — | — | 20% | 70% | 10% | — |
| 250–500x | — | — | — | 70% | 30% | — |
| 1,000–2,500x | — | — | — | 20% | 80% | — |
| 5,000x | — | — | — | — | 100% | — |
| 10,000x | — | — | — | — | — | 100% |

### Derived reach frequency under Math Distribution B2

- Reach Skyline or above: **51.71500%** (~1 / 1.93 rounds).
- Reach Sky or above: **7.98375%** (~1 / 12.53).
- Reach Atmosphere or above: **0.465792%** (~1 / 214.69).
- Reach Space or above: **0.011189%** (~1 / 8,937).
- Reach Moon: **0.00001%** (1 / 10,000,000).

**Tuning note:** Space frequency is intentionally marked for prototype/product review because ~1/8,937 may make premium Space assets too rarely seen. Height Distribution can be adjusted without changing Math Distribution V1, provided Moon exclusivity remains locked.

## 7. Round Archetypes V1

Archetypes are narrative generation families, not Bet Modes and not new mechanics.

| Archetype | Typical payout | Typical blocks | Purpose |
|---|---:|---:|---|
| Quick Collapse | 0x | 3–5 | Fast loss; keeps session pacing efficient. |
| Standard Collapse | 0x | 5–10 | Normal tension and collapse. |
| Cruel Collapse | 0x | 9–15 | High tower, recovery, then loss; protects uncertainty. |
| Weak Survive | 0.25–0.75x | 3–10 | Survival with neutral/weak result presentation. |
| Clean Survive | 1–2.5x | 5–10 | Lower-tension positive/break-even result. |
| Wobble Win | 2–10x | 7–13 | Multiple instability/recovery beats. |
| Near-Death Win | 5–50x | 9–16 | One major near-fall becomes the emotional beat. |
| Big Climb | 50–500x | 12–20 | Height/world escalation does most of the spectacle. |
| Space Run | 500–5,000x | 16–25 | Rare long climb into Space; Moon may be visible but unreachable. |
| Moon Run | 10,000x | ~18–26 + Moon event | Exclusive Max Win sequence. |

Counts are game-feel targets, not economic rules. Zone 3–5-block constraints take precedence when generating actual Books.

## 8. Tension vocabulary

A block can have one of five semantic behaviors:

- `clean`
- `offset`
- `wobble`
- `slide`
- `nearFall`

Renderer may produce recovery/settling as part of a block's animation when the Book continues.

Terminal events:

- `collapse`
- `survive`
- `moon` followed by Max Win resolution

## 9. Tension curve

Rounds SHOULD avoid constant escalation without relief. Preferred shape:

`calm → danger → recover → calm/height → greater danger → resolution`

Guidelines:

- quiet blocks create contrast;
- repeated near-falls should be spaced;
- more payout does not automatically mean more wobble;
- some large rounds can feel unnervingly stable before one extreme danger beat.

## 10. Resolution presentation

### 0x
Tower collapses. Result clearly communicates 0x. No fake win celebration.

### 0.25–0.75x
Tower may survive. Result is clear but neutral/weak because the return is below the play amount.

### ≥1x
Tower survives; win presentation scales according to result tier.

### 10,000x
Space progression reveals/approaches the Moon, final authored danger beat resolves, tower reaches Moon, then Max Win presentation triggers.

## 11. Moon behavior

- No non-10,000x Book may emit `moon`.
- 5,000x can use Space and may visually tease the Moon at a distance, subject to Art Direction.
- Moon is intended to be the game's iconic Replay/share moment.

## 12. Payout display during construction — OPEN

Prototype should make it cheap to compare:

- **A:** final payout hidden until resolution;
- **B:** limited/progressive value feedback without implying cashout rights.

Do not let this UI experiment change the Book payout or round behavior.

## 13. Tutorial philosophy

The game should be understandable from motion and UI. A rules/info panel remains required for production, but core comprehension should not depend on reading it.

## 14. Mobile UX principles

- tower top and next block are always the visual focus;
- play controls never obscure critical tower danger;
- payout/result remains legible at small widths;
- camera transitions avoid motion sickness and disorientation;
- environmental detail may simplify on low-end/mobile without changing logical state.
