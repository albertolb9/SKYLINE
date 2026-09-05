# ARCHITECTURE.md — SKYLINE Technical Architecture V1

**Status:** ACCEPTED for prototype; Stake-sensitive portions re-verified at integration.

## 1. Architectural principle

**Renderer may dramatize. Renderer may never decide.**

Production responsibility chain:

```text
Stake/RGS selection + wallet settlement
            ↓
       Static Book
            ↓
      RGS/Replay client
            ↓
      Round State Machine
            ↓
         Book Player
            ↓
      Logical Tower Model
            ↓
 Renderer / Camera / World / VFX / Audio
```

## 2. Technology baseline

For the first serious Bodega Stake project, use the current official Web SDK patterns rather than inventing a custom platform stack:

- Svelte 5 for app/UI composition.
- PixiJS 8 for game rendering.
- TypeScript.
- XState or an equivalently explicit state machine; preference is XState because it is already present in the official Web SDK pattern.
- Storybook/fixture-driven Book/Event development.
- Official Stake TypeScript client/contracts when RGS integration begins.

The official Web SDK is optional; SKYLINE may use a clean subset/base rather than carrying slot-specific sample code. Sample visual/audio assets must not ship.

## 3. Module boundaries

Suggested logical modules (exact folders may adapt to bootstrap):

```text
src/
  app/
    bootstrap
    query-params
  rgs/
    client
    replay-client
    adapters
  round/
    machine
    types
  book/
    schema
    validate
    player
    handlers
  tower/
    model
    transforms
    prng
    presets
  renderer/
    pixi-stage
    tower-view
    camera
    world
    effects
  ui/
    controls
    result
    rules
  test-fixtures/
    books
```

## 4. Economic boundary

Only RGS/math Book data can define:

- payout;
- Max Win;
- collapse/survive outcome;
- block count;
- terminal zone;
- round-critical block placement/behavior;
- Moon occurrence.

Frontend may not derive these from physics or device conditions.

## 5. Book Player

The Book Player SHALL:

1. accept a validated Book;
2. process `events[]` sequentially;
3. await each handler's completion before the next event unless a handler explicitly launches non-blocking cosmetic work;
4. provide event context (Book and event index) to handlers;
5. expose deterministic logical state snapshots for tests;
6. be reused by normal play and Replay.

Unknown event types are fatal in development/test.

## 6. Logical Tower Model

The Tower Model is renderer-independent state:

- ordered list of logical blocks;
- current zone;
- logical offsets/rotations;
- current terminal status;
- current resting visual lean metadata if derived;
- deterministic cosmetic seed state only where required.

No Pixi objects live in the model.

## 7. Renderer

Renderer responsibilities:

- convert logical units to pixels;
- animate drops/impacts/wobbles/slides/near-falls/recovery/collapse;
- render a static tower base/support presentation (renderer-owned, not a logical Book block — DECISIONS.md D-037);
- camera tracking;
- environmental transitions;
- VFX/audio triggers;
- performance quality scaling.

Renderer must be disposable/reconstructible from Book + logical state.

## 8. Deterministic cosmetics

Round-critical values are explicit. Cosmetic values may be generated through a versioned deterministic PRNG seeded from `towerStart.visualSeed` and event indices.

Cosmetic outputs include only things such as:

- decorative block variant within an equivalent visual family;
- bird/car/satellite variant and timing inside an allowed zone;
- dust particle variation;
- non-critical micro camera noise.

Cosmetics may not change danger meaning or obscure result.

## 9. Normal play vs Replay

```text
Normal: /play response → Book adapter → Book Player
Replay: /bet/replay response → Replay adapter → Book Player
```

The renderer/Book Player must not know whether its Book came from normal play or Replay except for UI controls surrounding playback.

## 10. Prototype architecture

The greybox replaces RGS with a `FixtureBookProvider`:

```text
Fixture selector → validated hardcoded Book → Book Player → Tower Model → Pixi Renderer
```

This preserves the production seam while avoiding premature RGS integration.

## 11. Error boundaries

Separate:

- platform/network errors;
- invalid Book/schema errors;
- renderer errors;
- asset load errors.

Do not convert malformed game logic into a fallback round; fail safely and visibly in development so bad Books cannot pass QA.

## 12. Performance principles

- mobile-first render budget;
- avoid per-frame allocations in hot loops;
- object pool repeated particles/decorative actors where useful;
- cap off-screen world content;
- quality scaling may reduce cosmetics, never logical events;
- static bundled assets only in production.

## 13. Security/integration principles

- no external runtime asset URLs in production build;
- no session/game information leaked through production logs;
- use official RGS client/contracts where practical;
- never store/derive wallet state independently of RGS responses.
