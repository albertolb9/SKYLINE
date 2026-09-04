# TASK-P5-wobble-recovery

**Scope:** `PROTOTYPE_V1.md` §7 P5 — Wobble + Recovery only. Promotes `behavior === 'wobble'` to
real deterministic visual motion: the existing P4 drop, followed by a continuous lean/counter-
swing/overshoot/settle curve applied to the whole committed tower via a `TowerRoot`-style
container. No nearFall, no slide-specific animation, no collapse/survive/Moon visual resolution,
no cosmetic PRNG, no physics, no P6+.

**Requirement IDs:** TOWER-001–005, TOWER-008, D-020, D-021, D-024, BOOK-002 (unaffected —
sequencing untouched). Governing spec: `docs/TOWER_SYSTEM.md` §6–10/12, `docs/GAME_SPEC.md` §8,
`docs/BOOK_SPEC.md` §6, `docs/REQUIREMENTS.md` TOWER-004, `docs/DECISIONS.md` D-024,
`docs/PROTOTYPE_V1.md` §7 P5.

## Two judgment calls, made explicitly rather than silently

Unlike P4's D-036 (which resolved a genuine self-contradiction in existing wording), both calls
below exercise latitude the specs already grant explicitly — greybox implementation decisions, not
spec clarifications, and deliberately **not** recorded in `DECISIONS.md` (no existing governance
requires an entry for either).

**1. Offset's "mild corrective tower response" (TOWER_SYSTEM §6) does not get a P5 animation.**
§6's entire offset entry is one sentence: "Visible off-center placement with mild corrective tower
response." Read as descriptive color-text for offset's own already-implemented static placement
(its authored `offsetU`/`rotationMd`, unchanged since P4), not a second root-level animation layer,
because: `REQUIREMENTS.md` TOWER-004 ("Wobble, slide, near-fall, recovery and collapse SHALL be
deterministic for a given Book") and `DECISIONS.md` D-024 ("Wobble and recovery use deterministic
authored curves/presets...") both enumerate the behaviors that get dynamic-motion treatment and
both omit offset; `BOOK_SPEC.md` §6's handler-implication list ("wobble/slide/near-fall →
recovery/settle") does the same; §6's own narrative register is identical (plain descriptive
prose, no SHALL/MUST) across all five behaviors; and P4 already shipped offset as static-placement-
only through full plan/execute/audit scrutiny with zero objection on this point. If the intended
reading is instead that offset needs its own weaker root motion, that is a straightforward future
addition (a small `OFFSET_RESPONSE_V1` preset on the same `wobbleRoot`, signed by `block.direction`
— the schema's only Book-explicit directional field) but is not built here.

**2. The wobble pivot is the fixed tower-base support point, not derived from any block's own
transform.** `TOWER_SYSTEM.md` §8 requires only "a deterministic pivot" for the `TowerRoot`
transform — no coordinates are specified anywhere in the mandated docs. Chosen:
```
pivotX = config.originX
pivotY = config.originY + config.blockHeightPx / 2
```
— horizontally aligned with the fixed tower origin U=0, vertically aligned with the tower's
base/ground plane (the fixed Y an ordinal-1 block's bottom edge would occupy with zero authored
offset/rotation). Deliberately **not** described as "block 1's bottom edge," because block 1 can
itself carry an authored `offsetU`/`rotationMd` and its own rendered transform need not sit at
this point — the pivot is a property of the tower's coordinate system (viewport-derived session
constants), independent of any individual block's committed pose.

## Renderer orchestration: one shared elapsed-time accumulator, not two sequential tickers

A `wobble` block's `addBlock` call runs drop and (when effective — see below) wobble/recovery
inside **one** `ticker.add` registration, sharing one `elapsedMs` counter, rather than a drop
ticker handing off to a separately-registered wobble ticker. This was a correctness requirement,
not a style choice: a two-ticker handoff starts the second phase's clock at 0 on whatever tick
happens to follow the first phase's completion, so a coarse tick that overshoots `dropDurationMs`
(e.g. one 600ms tick against a 450ms drop) silently discards the 150ms overshoot instead of
crediting it to the wobble phase — meaning two playbacks of the *same total elapsed time* at
different tick granularities could show different wobble progress, violating "same elapsed time +
same config = same visual pose." A single shared accumulator makes this impossible by construction
— both the drop sub-phase (`dropT = ease(elapsedMs / dropDurationMs)`) and the wobble sub-phase
(`wobbleT = (elapsedMs - dropDurationMs) / wobble.durationMs`) are pure functions of the one
running `elapsedMs`; there is no handoff moment where time can be dropped. `computeWobbleLeanMd`
clamps its `t` argument internally, so a negative `wobbleT` (before the wobble phase notionally
starts) or one past 1 (after it ends) resolves correctly with no extra clamping at the call site.
Proven directly by a test that crosses the actual `dropDurationMs` boundary at two different tick
granularities and asserts identical intermediate *and* final state (`createTowerRenderer.test.ts`,
"timing independence" describe block).

One practical consequence: cancellation is *simpler* than a two-ticker design would need, not more
complex — since there is only ever one ticker registration per `addBlock` call, `activeCancel` is
set once and never reassigned.

## Zero-effect wobble fallback

`wobble` blocks with `intensity: 0` (preset `peakLeanMd: 0`) or `direction: 0` would make every
sample of the curve exactly 0 for the whole 550ms — a real second ticker phase that visibly does
nothing. Detected explicitly (`effectiveWobble` in `createTowerRenderer.ts`) and skipped: these
blocks take exactly the same single-phase code path as `clean`/`offset` (drop only, immediate
resolve, no second `ticker.add` call). No fixture currently authors either case for `wobble`, but
P1's schema permits both and P5 does not add new validation to forbid them (per instruction) — this
is the deterministic, no-dead-time behavior for whenever they do occur.

## Container hierarchy

```
app.stage
  └─ cameraContainer   — camera translation only (.y), unchanged formula/semantics from P4
       └─ wobbleRoot    — .rotation only, transient, pivot=position=fixed tower-base support point
            └─ block graphics — unchanged addChild target, unchanged x/y/rotation values
```

Camera and wobble mutate strictly disjoint containers/properties by construction — `
computeCameraOffsetY` still reads only the block's committed `transform.y` (from
`computeBlockTransform`), never `wobbleRoot`, so it is structurally blind to whatever
`wobbleRoot.rotation` is doing. The camera offset is applied as soon as `elapsedMs` first reaches
`dropDurationMs` (matching P4's original drop-settle timing, not waiting for a following wobble
to also finish) and is idempotent on every subsequent tick of the same operation.

## Motion values — versioned, greybox tuning

```ts
export const WOBBLE_PRESETS_V1_BY_INTENSITY: Readonly<Record<Intensity, WobbleMotionPreset>> = {
  0: { peakLeanMd: 0,    durationMs: 550 },
  1: { peakLeanMd: 1500, durationMs: 550 },
  2: { peakLeanMd: 3000, durationMs: 550 },
  3: { peakLeanMd: 4500, durationMs: 550 },
  4: { peakLeanMd: 6000, durationMs: 550 },
};

export const WOBBLE_CURVE_V1_KEYFRAMES: readonly (readonly [t: number, fraction: number])[] = [
  [0.00, 0], [0.20, 0.5], [0.45, 1.0], [0.70, -0.45], [0.90, 0.18], [1.00, 0],
];
```

Explicitly versioned (`_V1_`) per `TOWER_SYSTEM.md` §7's "centralized in versioned presets rather
than scattered magic numbers." **GREYBOX TUNING, NOT LOCKED PRODUCT VALUES** — free to change
during the current prototype pass; once any Replay/visual capture exists that depends on these
exact numbers, a real change becomes `WOBBLE_PRESETS_V2_BY_INTENSITY`/`WOBBLE_CURVE_V2_KEYFRAMES`,
new exports, never an in-place edit of V1's values. Intensity scales amplitude only, not duration
(all five rows share `durationMs: 550` today; kept as a per-row field so a future tuning pass can
diverge it without a shape change). Direction is a pure sign multiplier (`direction: 0` → 0 at
every `t`, additionally short-circuited entirely per the zero-effect fallback above). The keyframe
shape (lean → peak at t=0.45 → counter-swing → overshoot → settle) adopts the qualitative timing
`TOWER_SYSTEM.md` §8's conceptual phase example and §10's recovery-shape description independently
converge on; exact fractions/magnitudes are this file's own greybox choice, not a reproduction of
either section's numbers. Peak values (1.5°–6°) are whole-tower transient lean angles, deliberately
a different visual quantity from any single block's own authored ±4° `rotationMd` range.
`wobble.ts` is otherwise a plain pure module — zero Pixi dependency, mirrors `transforms.ts`'s
existing style — and is unaffected by the orchestration/pivot corrections above.

## restingLean / visualSeed

Both deferred again, as `TOWER_SYSTEM.md` §9 itself already permits ("do not finalize... until
greybox tuning"). Each `LogicalBlock` already carries its own authored `rotationMd`, rendered
per-block unchanged since P4 — static "crookedness" needs no new state. The wobble curve returns
to *exactly* 0 at `t=1`, so `wobbleRoot`'s transform is identity except during an active wobble; no
running lean is ever carried between blocks, in the model or the renderer. No xorshift32, no
`visualSeed` consumption — the wobble path is fully determined by `(behavior, intensity,
direction)` plus the fixed preset table, and no per-round cosmetic variation is wanted (the point
of a wobble is to legibly communicate a specific authored intensity/direction).

## P2 → P3 → P5 integration

`createTowerEventHandlers.ts` is **not modified**. Its `block` handler still does exactly `model =
applyTowerEvent(model, event); await renderer.addBlock(block)` — all new phase logic lives inside
`renderer.addBlock`'s one Promise, so P2 still awaits exactly one Promise per event and never
begins event N+1 until it resolves, automatically satisfying "next event must never begin while
wobble/recovery is active." Verified directly (not just assumed from the unmodified handler code)
by a new fingerprint-parity test: the live-playback model (recovered via the same
`vi.mock(importOriginal)` spy technique P4 introduced for the "exactly once" test) fingerprints
identically to `buildTowerModel(book)` computed independently, for a real wobble-containing fixture
(`createTowerEventHandlers.test.ts`).

## Files

- `src/renderer/tower/wobble.ts` (+ `.test.ts`) — pure wobble curve/preset math.
- `src/renderer/tower/createTowerRenderer.ts` (+ `.test.ts`) — `cameraContainer`/`wobbleRoot`
  split, pivot setup, the single shared-accumulator `addBlock` orchestration, zero-effect
  short-circuit.
- `src/renderer/tower/createTowerEventHandlers.test.ts` — one new fingerprint-parity test; no
  change to `createTowerEventHandlers.ts` itself.
- `src/renderer/tower/TowerStage.stories.svelte` — new `Wobble Win 5x` story (`wobbleWin5x`); updated
  `Big Climb 100x` comment.

Not touched: `src/book/schema.ts`, `src/book/validate.ts`, `src/book/player.ts`,
`src/tower/model.ts`, `src/renderer/tower/transforms.ts`, `src/renderer/tower/
createTowerEventHandlers.ts`, `src/renderer/pixi-stage/*`, all 11 fixture Books,
`docs/BOOK_SPEC.md`, `docs/TOWER_SYSTEM.md`, `docs/DECISIONS.md`.

## Manual visual QA

**Launch:** `pnpm storybook` → **Renderer/TowerStage** → **Wobble Win 5x** (primary) and **Big
Climb 100x (camera follow)** (camera-follow regression, now with a real wobble block).

Checklist: clean/offset in all 5 stories look identical to P4; each of `wobbleWin5x`'s 3 wobble
beats visibly leans, counter-swings and settles upright, following its authored direction sign,
with the third (intensity 3) visibly stronger than the first two (intensity 2); the whole tower
leans as one coherent structure, visibly rooted near its base; wobble never changes any block's
final resting pose; recovery is readable before the next block drops; camera does not visibly
react to the transient lean; `bigClimb100x` camera-follow still functions; identical on replay;
legible at 390×844 and desktop; switching stories mid-wobble produces no console error/unhandled
rejection; no `nearFall`/`slide`/collapse animation appears; offset blocks intentionally show no
root motion (expected, not a regression); no console errors/warnings.

## Out of scope

`nearFall`, near-fall false drop, `slide`, collapse/survive/Moon animation, Max Win presentation,
zone/environment art, the full P8 camera system, camera shake/impulse, audio, payout UI,
RGS/replay, cosmetic PRNG/`visualSeed`, physics engine, offset root-motion (see judgment call 1
above), isolated per-intensity Storybook matrix (`docs/PROTOTYPE_V1.md` P9's scope — reusing real
Book fixtures instead, per P4's own precedent), any change to `src/book/player.ts` /
`BookEventContext` / `src/tower/model.ts` / fixture data, P6+.
