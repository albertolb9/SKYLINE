# TASK-P4-basic-renderer

**Scope:** `PROTOTYPE_V1.md` §7 P4 — Basic Renderer / Clean + Offset only. First visual phase:
render an already-deterministic Book/TowerModel sequence in Pixi using `clean`/`offset` block
placement, viewport-derived scaling, and a minimal tower-top camera follow. No wobble, nearFall,
slide-specific animation, collapse/survive/Moon visual resolution, final art, the full P8 camera
system, audio, payout UI, RGS/replay, cosmetic PRNG, physics, or P5+.

**Requirement IDs:** TOWER-001/002/003/004/005/007/008, BOOK-002, ARCHITECTURE.md §7. Governing
spec: `docs/TOWER_SYSTEM.md` §3-7/18, `docs/PROTOTYPE_V1.md` §7 P4, `docs/ART_DIRECTION.md`.

## Locked V1 geometry clarification (D-036)

`TOWER_SYSTEM.md` §3's original `offsetU` wording ("relative to the intended center/support
position") was genuinely ambiguous between an absolute-from-tower-origin reading and a
delta-from-previous-block reading — the prior planning pass overclaimed that the existing text
already decided this; it didn't. Resolved explicitly as a V1 decision, not a rediscovery:
**`block.offsetU` is the block center's absolute horizontal displacement from the fixed tower
origin U=0 (`resolvedCenterU = offsetU`), not accumulated from the previous block.** Renderer:
`pixelX = originX + offsetU × scale`. Recorded in `TOWER_SYSTEM.md` §3 (wording updated) and
`DECISIONS.md` D-036 (ACCEPTED, with reason/impact). This is a geometry-contract clarification,
not a change to any LOCKED product rule, and does not touch P3's `LogicalBlock`/`TowerModel`
shape — `offsetU` was already stored as-is; only its downstream interpretation is now explicit.

## P2 → P3 → renderer integration

```
P2 playBookEvents(book, handlerMap)
  → dispatches event N
    → handler: model = applyTowerEvent(model, event)   [P3, exactly once]
    → handler: await renderer.addBlock(newBlock)         [P4, only for 'block' events]
    → handler resolves
  → P2 advances to event N+1 only after the above Promise resolves
```

`createTowerEventHandlers(renderer)` is a handler *factory* closing over `let model: TowerModel`
local to that one call — the only place a live playback's running model is held. This differs
from P3's `buildTowerModel` (a single synchronous fold, test/tooling convenience, never a
production path) because `playBookEvents` invokes separate, independent async handler calls one
event at a time; something has to carry the model *across* those calls, and the closure is fresh
per factory call (no cross-session leakage) rather than shared/module-level state. `src/book/
player.ts` and `BookEventContext` are **not modified**. `buildTowerModel` is never called from
the live path.

9 of 10 event types share one `advanceOnly` handler (`model = applyTowerEvent(model, event)`, no
renderer call), reusing the "wide handler assignable to a narrower per-key slot under
`strictFunctionTypes`" pattern already proven in P2's `recordingHandlerMap.ts` — no cast needed.
Only `block` also calls `renderer.addBlock`. The returned map has all 10 keys (not
`Partial<...>`), so TypeScript enforces completeness at compile time.

## Viewport-derived transform

`TowerViewportTuning` (fixed prototype defaults) and `TowerRenderConfig` (viewport-derived,
computed once per renderer session from `app.screen.width/height`) are kept as separate types so
"fixed default" and "actual session geometry" can't be confused. `blockWidthPx = clamp(viewportWidth
× widthFraction, min, max)` — mobile viewports get proportionally-sized blocks; wide desktop
viewports clamp at `maxBlockWidthPx` so they show *more of the tower*, not bigger blocks
(mobile-first, PROJECT.md §5). No resize-reactivity — computed once at creation, deliberately.

`originY` represents the **center** of the ordinal-1 block (matching `computeBlockTransform`'s
convention), so `bottomMarginBlocks` (the actual empty margin below that block's *bottom edge*)
requires subtracting an extra half-block-height: `originY = viewportHeight − blockHeightPx ×
bottomMarginBlocks − blockHeightPx / 2`. Tested directly against the bottom edge, not just
`originY` in isolation (`transforms.test.ts`).

`logicalYFromOrdinal(ordinal) = (ordinal − 1) × BLOCK_HEIGHT_UNITS` — the only reading of
TOWER_SYSTEM §5's "assign deterministic logical Y from ordinal/block height" consistent with
zero-gap stacking; flagged as an inference, not a literally-quoted formula.

## Minimal camera follow (not P8)

One `towerContainer` (child of `app.stage`) holds every block; blocks are positioned in its local
space via `computeBlockTransform`, never touched by camera logic. Camera follow is a single
`towerContainer.y` translation, recomputed via the pure `computeCameraOffsetY(topmostBlockLocalY,
config)` after each block lands (an instant snap, no easing). Zero for short towers; a positive,
deterministic offset once the topmost block's local top edge crosses `cameraSafeBandPx`. Under
the default mobile tuning this threshold is first crossed at ordinal 17 — which is exactly why
`bigClimb100x` (17 blocks) was chosen as the camera-follow demo fixture, not by coincidence.
**P4 = this one pure formula, snap, no easing, no zone-driven behavior. P8 = the full presentation
system** (framing rules, easing, zone-triggered reframing) that will very likely replace this
formula rather than extend it.

## Block rendering / animation

Greybox Pixi `Graphics` rectangle, one flat fill/stroke for every block regardless of `behavior`
— no color-coding, no branching on behavior type. `x`/`rotation` are set to their final authored
values *immediately* at spawn; only `y` animates (a straight vertical fall from one block-height
above the target). This was a deliberate choice: interpolating `x` toward an off-center offset
would risk reading as exactly the "snap toward center" the spec forbids for `offset` blocks, and
it makes `clean`/`offset` mechanically identical in the renderer (only the *data* differs).
**Temporary greybox policy, documented explicitly, not silent**: a `wobble`/`nearFall`/`slide`
block, if played, also just falls straight to its authored placement with no drama — the renderer
does not special-case `behavior` at all yet.

Animation uses Pixi's own `app.ticker` (`ticker.deltaMS`, not frame count) — no
`requestAnimationFrame`, no new dependency. `ease(t)` is a closed-form, monotonic easeOutQuad
(no overshoot, no `Math.random`). The final `y` is explicitly assigned to the exact computed
target on completion — no drift. Intermediate frames may vary by device/timing; the final
assigned value never does.

## Cancellation / lifecycle

`TowerRenderer.cancel()` + `TowerRenderCancelledError`: at most one `addBlock` is ever in flight
(P2 awaits each handler fully before the next), so a single `activeCancel` slot suffices — no
collection needed. `cancel()` is idempotent, removes the active ticker callback, and rejects the
pending `addBlock` promise (or, if called first, makes any *future* `addBlock` reject immediately
without starting a new animation). `PixiStage.svelte` gained two small, additive, backward-
compatible props: `onReady?: (app) => void` and `onBeforeDestroy?: () => void` (fired inside its
existing `onDestroy`, before `handle?.destroy()`) — **PixiStage remains the sole owner of
`Application` destruction**; `TowerStage`/`TowerRenderer` never call `app.destroy()` themselves.
`TowerStage.svelte` passes `renderer.cancel` as `onBeforeDestroy` and wraps its top-level
`playBookEvents(...).catch(...)` to silently absorb only `TowerRenderCancelledError` (expected on
intentional teardown) while `console.error`-ing anything else (unexpected errors still surface,
just not as a raw unhandled rejection).

**Destroyed-before-ready race**: `renderer` in `TowerStage.svelte` starts `undefined`; if
`onBeforeDestroy` fires before `onReady` ever ran (component torn down while the Pixi
`Application` is still initializing), `renderer?.cancel()` safely no-ops via optional chaining —
no dereference of an uninitialized renderer, no added lifecycle infrastructure. The underlying
race (component destroyed before `createPixiStage`'s promise resolves) is already handled by
P0's existing `isAborted` mechanism, already tested in `createPixiStage.test.ts`; because of that,
`onReady` structurally cannot fire after teardown, so no `TowerRenderer` is ever created in that
case and there is nothing for a leftover animation to leak.

## Test-quality note: verifying "exactly once" honestly

The running `TowerModel` is intentionally closure-private inside `createTowerEventHandlers` — no
`getModel`/session accessor was added to production code to make this observable, since indirect
proxies (e.g. inspecting `renderer.addBlock`'s received data) cannot actually distinguish
"`applyTowerEvent` called once" from "called twice with the same net effect." Instead,
`createTowerEventHandlers.test.ts` uses `vi.mock('../../tower/model', async (importOriginal) =>
...)` to wrap the *real* `applyTowerEvent` in a `vi.fn()` spy (behavior unchanged, call count
observable) and asserts it was called exactly `book.events.length` times over a full fixture
replay. This is a **zero production-API-surface** solution — smaller than the `getModel`
accessor the original brief anticipated might be needed — so there is no API deviation to audit
here.

## Files

- `src/renderer/tower/transforms.ts` (+ `.test.ts`) — pure logical→pixel/camera/easing math,
  zero Pixi dependency.
- `src/renderer/tower/createTowerRenderer.ts` (+ `.test.ts`) — Pixi orchestration, ticker-driven
  drop animation, cancellation.
- `src/renderer/tower/createTowerEventHandlers.ts` (+ `.test.ts`) — the P2 handler-map factory.
- `src/renderer/tower/TowerStage.svelte` — wires `PixiStage` + the renderer + the handler
  factory + `playBookEvents` together for one `Book` prop.
- `src/renderer/tower/TowerStage.stories.svelte` — manual QA entry point (below).
- `src/renderer/pixi-stage/PixiStage.svelte` — modified: `onReady`/`onBeforeDestroy` props added.
- `docs/TOWER_SYSTEM.md`, `docs/DECISIONS.md` — modified: D-036 clarification (above).

Not touched: `src/book/player.ts`, `src/book/schema.ts`, `src/tower/model.ts`, all 11 fixture
Books, `src/main.ts`, `src/app/App.svelte`, `src/book/validate.ts`, `docs/BOOK_SPEC.md`.

## Manual visual QA

**Launch:** `pnpm storybook` → **Renderer/TowerStage**. `pnpm dev`/`App.svelte`/`main.ts` are
unmodified and not part of this QA — fixture Books are never wired into production app behavior.

Stories: `quickCollapseStreet0x` (3 blocks, collapse), `weakSurvive050x` (6 blocks, crosses to
Skyline, survive), `cleanSurvive150x` (7 blocks, crosses to Skyline, survive) — all three are, on
inspection, already 100% `clean`/`offset` blocks with no `wobble`/`nearFall`, reused rather than
inventing a new fixture — and `bigClimb100x` (17 blocks, reaches Atmosphere) specifically to
exercise camera follow.

Checklist: clean/offset placement and rotation match authored values; no center-snap/drift;
stable after landing; identical on replay; no P5+ animation; legible at a 390×844 mobile viewport
and at a normal desktop width (reload the story after resizing — scale is computed once, not
resize-reactive); camera visibly follows on `bigClimb100x` and stays inert on the shorter
fixtures; switching away from a story mid-drop produces no console error/unhandled rejection and
leaves no stray canvas; no console errors/warnings throughout.

## Out of scope

Wobble, recovery, nearFall, slide-specific animation, collapse/survive/Moon visual resolution,
final environmental art, the full P8 camera/zone presentation system, audio, payout UI,
RGS/replay, cosmetic PRNG, physics engine, resize-responsiveness, any change to `src/book/
player.ts`/`BookEventContext`/`src/tower/model.ts`/fixture data, P5+.
