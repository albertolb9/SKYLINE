# REFERENCE_GAMES.md — V1 Benchmark Register

**Status:** Living product-reference document.  
**Purpose:** Ensure SKYLINE V1 decisions are informed by Burst games already published on Stake without copying their themes, assets or exact mechanics.

## 1. Evidence rule

Use published games to understand product patterns: pacing, visible progress, depth, feature density, spectacle and UX. Do **not** infer undocumented internal RGS/Book/recovery implementation from a public game page.

Technical Stake behavior is governed by `STAKE_ENGINE_RULES.md` and official SDK/docs.

## 2. Stake Engine quality benchmark

Current Stake Engine Game Quality Rankings explicitly says simple Burst concepts do not perform well and names **Cut n Crash, Angry Balls and Drop the Boss** as good benchmarks for in-depth Burst concepts capable of high quality ranking.

**Source:** https://stake-engine.com/docs/approval-guidelines/game-quality-rankings

### Transfer to SKYLINE

SKYLINE must remain simple to build but cannot feel shallow. Its depth comes from:

- deterministic construction variety;
- tension/recovery rhythm;
- vertical environmental progression;
- round archetypes;
- escalating spectacle for rare outcomes;
- memorable Moon Max Win.

We intentionally prefer these layers over feature-heavy math for the first Bodega release.

## 3. Angry Balls — Coreffect Interactive

Public Stake description currently presents Angry Balls as a fast Burst game built around a simple slingshot/destruction fantasy with collectible multipliers, powerups, enhancer modes and bonus-wheel progression. Current Stake page lists RTP around 96.51% and Max Win 37,168x.

**Source:** https://stake.com/casino/games/coreffectinteractive-angry-balls

### Pattern worth learning

- instantly understandable core action;
- continuous events during one round rather than waiting passively for a number;
- visible value/progress objects;
- rare outcomes become more spectacular;
- replayable variation around one core fantasy.

### SKYLINE response

- Keep the one-sentence action equally clear: build a tower upward.
- Use blocks, danger beats and world height as continuous events.
- Do **not** add powerups/bonus wheels merely because a successful reference has them.
- Height/environment can serve as SKYLINE's psychological progress indicator.

## 4. Drop the Boss — Mirror Image Gaming

Public Stake description lists 96.00% RTP, High volatility and 5,000x Max Win. The round is a visually eventful falling journey with collectible rewards/obstacles, plus optional Ante/Chaos-style modes.

**Source:** https://stake.com/casino/games/mirrorimage-drop-the-boss-trump

### Pattern worth learning

- the round itself tells the outcome story;
- multiple small events maintain attention during an automatic sequence;
- strong escalation through physical journey/height;
- high-value outcomes feel different without abandoning the core action.

### SKYLINE response

- Make tower construction narrate the result rather than using a static reveal.
- Use recoveries, near-falls and environmental transitions as attention beats.
- Keep one base mode initially; this is a deliberate V1 simplification, not ignorance of mode-based depth.

## 5. Drop the Boss 2: Maralago — Mirror Image Gaming

Current Stake page describes a Burst sequel with physics-style presentation, multiple launch origins/features, RTP 96.15% and Max Win up to 10,000x.

**Source:** https://stake.com/casino/games/mirrorimage-drop-the-boss-2-maralago

### Pattern worth learning

- 10,000x can support a clear spectacle ladder;
- sequels deepen a proven core rather than replacing it;
- a simple physical fantasy can carry multiple intensity states.

### SKYLINE response

First prove the tower mechanic with one clean mode. Future depth can build around a proven core only after V1 demonstrates retention/quality.

## 6. Cut N Crash — Coreffect Interactive

Stake's Coreffect catalogue describes Cut N Crash as a Burst game based on cutting a rope, avoiding a laser and accumulating wins/multipliers, with a 10,000x Max Win. The current game page lists RTP 97.29%.

**Sources:**
- https://stake.com/casino/games/coreffectinteractive-cut-n-crash
- https://stake.com/casino/group/coreffect-interactive

### Pattern worth learning

- one strong physical verb can carry a full Burst identity;
- risk should remain visually legible throughout the round;
- a 10,000x ceiling benefits from an obvious exceptional state.

### SKYLINE response

SKYLINE's strong verb is **BUILD/CLIMB**. Moon is the exceptional 10,000x state.

## 7. Drop the Neta — Mirror Image Gaming

Current Stake description shows another automatic journey-style Burst with autoplay/game-speed options and physics-driven presentation around distance, items and tricks, up to 5,000x.

**Source:** https://stake.com/casino/games/mirrorimage-drop-the-neta

### Pattern worth learning

- fast repeated rounds benefit from speed/pacing controls in some products;
- physical motion can be the entire surface language of the game.

### SKYLINE response

Turbo/Autoplay remain OPEN production decisions. We do not add them to the greybox; if added later, current Stake requirements and readability must be re-verified.

## 8. Brick Breaker — Coreffect Interactive

Current Stake page describes a classic arcade core adapted into Burst form with multiplier bricks and a simple continuous physical sequence; current page lists RTP 96.19% and Max Win up to 16,200x.

**Source:** https://stake.com/casino/games/coreffect-brick-breaker

### Pattern worth learning

Familiar motion plus casino outcome can reduce tutorial cost. SKYLINE should similarly read as “stack/build tower” immediately.

## 9. V1 decisions informed by references

| SKYLINE decision | Reference pattern | Our deliberate choice |
|---|---|---|
| One core action | Angry Balls / Cut N Crash / Drop the Boss | Build tower automatically after PLAY. |
| Continuous round events | Drop the Boss / Angry Balls | Every few blocks create land/wobble/near-fall/recovery interest. |
| Depth without complex rules | Stake quality guidance | Round archetypes + environmental progression instead of bonus systems. |
| Spectacle ladder | Drop the Boss family / Angry Balls | Street → Skyline → Sky → Atmosphere → Space → Moon. |
| 10,000x exceptional state | Cut N Crash / Drop the Boss 2 | Moon is exclusive 10,000x endpoint. |
| Multiple modes common in market | Angry Balls / Drop the Boss | One Base Mode for V1 unless evidence justifies more. |
| Visible multiplier/progress common | Angry Balls / journey games | Keep payout presentation OPEN; prototype height as progress first. |
| Speed/autoplay appears in peers | Drop the Neta | Defer until production requirements/product fit are verified. |

## 10. Anti-copy rules

SKYLINE must not copy:

- another game's character/theme;
- exact layouts/assets;
- powerup names/icons;
- bonus-wheel structures merely for familiarity;
- specific animation sequences;
- branded satire/characters;
- exact multiplier presentation if it weakens SKYLINE's own identity.

We study **patterns and product quality**, not assets or protected expression.

## 11. Review cadence

Before a major V1 feature decision:

1. identify 2–4 relevant currently published Burst/Instant references;
2. record the observed product pattern here or in a linked research note;
3. verify Stake platform compatibility separately in official docs;
4. choose the simplest SKYLINE-native solution;
5. add the durable choice to `DECISIONS.md`.
