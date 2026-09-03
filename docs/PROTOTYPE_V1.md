# PROTOTYPE_V1.md — SKYLINE Deterministic Greybox

**Status:** READY FOR IMPLEMENTATION  
**Primary owner:** Claude Code implementation under SDD  
**Purpose:** Validate tension, pacing, deterministic Book playback and mobile camera before Stake/RGS production integration.

## 1. Prototype question

> Can a deterministic tower built from simple blocks create enough continuous tension and spectacle to justify SKYLINE before final art, audio and RGS integration?

If the answer is no, change motion/pacing cheaply before production.

## 2. Hard scope

Build:

- Svelte 5 app shell.
- PixiJS 8 game stage.
- explicit state machine for fixture playback.
- Book TypeScript schema + runtime validation.
- sequential Book Player.
- Tower Model using logical integer units.
- `towerStart` handler.
- `block` handler.
- `zoneChange` handler.
- `collapse` handler.
- `survive` handler.
- `moon` handler.
- behaviors: clean, offset, wobble, nearFall.
- deterministic recovery phase.
- `slide` only if the first four behaviors are stable; otherwise Task 2.
- two collapse profiles: left/right.
- deterministic vertical camera.
- placeholder zone backgrounds for Street/Skyline/Sky/Atmosphere/Space/Moon.
- fixture Book selector.
- repeat/play-again control.
- Storybook/event fixtures or equivalent official-Web-SDK-aligned stories.
- automated determinism/schema tests.

## 3. Explicitly out of scope

Do not implement:

- live RGS;
- authenticate/play/end-round;
- Math SDK production generator;
- wallet/balance;
- real Stake play amount UI;
- Bet Replay network endpoint;
- autoplay;
- Turbo;
- multiple Bet Modes;
- bonus mechanics;
- final payout UI decision beyond a simple result overlay;
- final art;
- final VFX;
- final sound;
- mascot;
- localization;
- production rules modal;
- submission packaging.

## 4. Bootstrap direction

Use current official Web SDK architecture/patterns as a reference. Keep the SKYLINE codebase clean and Burst-specific; do not carry unnecessary reel/slot game logic.

At bootstrap, record exact tool versions chosen in README/package files. The official Web SDK versions must be rechecked on implementation day.

## 5. First fixture set

Create at least these named Books:

1. `quick-collapse-street-0x`
2. `standard-collapse-skyline-0x`
3. `cruel-collapse-sky-0x`
4. `weak-survive-050x`
5. `clean-survive-150x`
6. `wobble-win-5x`
7. `near-death-win-20x`
8. `big-climb-100x`
9. `space-run-1000x`
10. `space-run-5000x`
11. `moon-run-10000x`

These fixtures test visuals; their inclusion does not represent their production frequency.

Fixture `payoutMultiplier` values use the prototype Book convention from `BOOK_SPEC.md` (100 = 1x). The simple result overlay must convert through a single tested helper.

## 6. Fixture constraints

- all Books validate against `BOOK_SPEC.md`;
- 0x fixtures collapse;
- >0x fixtures survive;
- only Moon fixture contains `moon`;
- each traversed normal zone contains 3–5 blocks;
- different fixtures demonstrate both left/right danger;
- at least one loss reaches Sky;
- at least one large win has a quiet stretch before a major near-fall.

## 7. Task breakdown

### P0 — Repository bootstrap

- initialize app/tooling;
- configure TypeScript strict mode;
- configure unit tests;
- configure Storybook/fixture dev surface;
- ensure static build target.

**Exit:** clean app builds/tests and displays an empty Pixi stage.

### P1 — Book contracts

- TypeScript discriminated unions for V1 events;
- runtime validator;
- fixture validator tests;
- unknown type failure.

**Exit:** all fixture data validates; invalid fixtures fail with useful diagnostics.

### P2 — Sequential Book Player

- async event sequencing;
- handler map;
- playback state;
- replay same fixture repeatedly.

**Exit:** synthetic handlers prove strict event order.

### P3 — Logical Tower Model

- logical block geometry;
- block commit;
- zone state;
- terminal state;
- deterministic fingerprint.

**Exit:** model tests pass without Pixi.

### P4 — Basic renderer / clean + offset

- render committed blocks;
- drop/land;
- viewport scaling;
- camera follows top.

**Exit:** Street → Skyline fixtures can build cleanly on mobile viewport.

### P5 — Wobble + recovery

- TowerRoot pivot/lean curves;
- intensity presets;
- deterministic settle/recovery.

**Exit:** same fixture produces identical logical fingerprint and visually consistent timing.

### P6 — Near-fall

- high/extreme danger pose;
- hold/pause;
- recover if Book continues;
- transition into collapse if next semantic event is collapse.

**Exit:** near-death win and cruel collapse share a convincing initial danger language but resolve differently.

### P7 — Collapse / survive

- left/right collapse;
- final stable survive;
- simple result overlay from fixture payout.

**Exit:** losses/wins are instantly legible.

### P8 — Zones / camera

- placeholder visual differences for five normal zones;
- deterministic zone transitions;
- Moon placeholder sequence.

**Exit:** big/Space/Moon fixtures communicate altitude even with rectangles/gradients.

### P9 — Storybook / QA surface

Stories/fixtures for:

- each custom Book Event;
- each behavior/intensity range;
- full random/manual fixture selection;
- Moon;
- two representative mobile viewports.

**Exit:** developers can reproduce every important state without RGS.

### P10 — Prototype review gate

Evaluate:

- tension;
- legibility;
- round duration;
- motion sickness/camera;
- repetitive feeling;
- Space/Moon scale;
- whether payout should stay hidden during build.

Record results in `DECISIONS.md` before moving to production integration.

## 8. Acceptance criteria

Prototype is complete only if:

- all 11 target fixtures play start-to-finish;
- same fixture produces identical logical fingerprint over 100 repeated playbacks;
- no round-critical path calls unseeded RNG;
- 0x/positive/Moon invariants are automatically validated;
- Book events are processed in strict order;
- mobile 390×844 class viewport remains readable;
- a tall mobile viewport and desktop viewport scale without logical changes;
- near-fall → recover and near-fall → collapse both feel plausible;
- no RGS code was required to prove the experience;
- team/owner can answer whether the game is tense enough to continue.

## 9. Prototype review metrics

Record, do not over-optimize:

- total duration per fixture;
- duration per block;
- time spent in danger/hold;
- number of major tension peaks;
- blocks visible simultaneously;
- camera movement per second;
- mobile FPS on representative device/browser;
- subjective tension rating after repeated play.

## 10. Next gate after prototype

If approved:

1. freeze/tune Book schema and tower presets;
2. implement offline Book generator + Math SDK integration;
3. generate/validate small uncompressed Books;
4. connect RGS using current official client/docs;
5. implement normal/replay provider adapters;
6. then advance art/audio production and production QA.

If rejected:

Tune tower motion, pacing and camera first. Do not solve weak tension by adding unrelated features.
