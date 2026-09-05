# TASK-P6-near-fall

**Scope:** `PROTOTYPE_V1.md` §7 P6 — Near-Fall only. Promotes `behavior === 'nearFall'` to real
deterministic visual motion: the existing drop, then a critical-lean approach → hold plateau →
either recover (counter-swing/overshoot/settle to exact 0) or hold-for-collapse (freeze exactly at
the plateau's end), on the same `wobbleRoot` P5 already established. No collapse animation, no
`slide`, no survive/Moon visual resolution, no cosmetic PRNG, no physics, no P7+.

**Requirement IDs:** TOWER-004, TOWER-001/002/003/005, BOOK-002. Governing spec:
`docs/TOWER_SYSTEM.md` §6/8/10, `docs/BOOK_SPEC.md` §6, `docs/GAME_SPEC.md` §8,
`docs/PROTOTYPE_V1.md` §7 P6.

## Normative precision

**TOWER-004** ("Wobble, slide, near-fall, recovery and collapse SHALL be deterministic for a given
Book") is the operative SHALL driving this phase — nearFall is explicitly named. **D-024**
("Wobble and recovery use deterministic authored curves/presets rather than free rigid-body
simulation") is cited precisely: its literal text names *wobble and recovery*, not nearFall. It
does not directly govern nearFall by name — nearFall's determinism requirement comes from
TOWER-004 directly; the TowerRoot/authored-curve *structural* approach is additionally supported by
TOWER_SYSTEM §§6–8/10 (which describe the same authored-curve, no-physics mechanism for nearFall
specifically) and by the existing architecture. D-024 is precedent for the pattern, not a citation
naming nearFall.

TOWER_SYSTEM §6/BOOK_SPEC §6 describe the recover/hold-for-collapse choice with "can"/"MAY" —
permissive, not mandatory — language. Both paths are still built here (see below), because the
cost is small (both share the same curve up through the hold plateau) and PROTOTYPE_V1 §7's own
P6 task list names both explicitly.

"False drop": grepped every doc in `docs/` for `false.?drop`/`falseDrop` — the term appears in no
SDD document (the only hit found anywhere was inside this repo's own `TASK-P5-wobble-recovery.md`
"out of scope" list, itself quoting prior user-brief prose, not a spec). No translational
false-drop mechanism is specified anywhere. NearFall stays rotation-only, reusing `wobbleRoot`.

## Fixture audit (no modification to any of the 11 canonical Books)

| Fixture | Idx | Zone | Intensity | Direction | Event after | Classification |
|---|---|---|---|---|---|---|
| cruelCollapseSky0x | 7 | skyline | 3 | -1 | `block` ("// recovery beat") | recover (collapse follows 7 events later — never adjacent) |
| nearDeathWin20x | 12 | sky | 4 | 1 | `block` ("// recovery") | recover |
| bigClimb100x | 20 | atmosphere | 4 | 1 | `survive` (adjacent, zero gap) | recover |
| spaceRun1000x | 22 | space | 4 | 1 | `block` | recover |
| spaceRun5000x | 22 | space | 4 | -1 | `block` | recover |
| moonRun10000x | 21 | space | 4 | 1 | `block` | recover |

5 winning nearFalls, 1 losing. No fixture has more than one nearFall. Intensity used: only 3/4.
Direction used: only ±1. **In zero of the 6 real fixtures does `collapse` follow a `nearFall`
immediately** — `cruelCollapseSky0x`'s nearFall recovers and only meets an unrelated collapse much
later; `bigClimb100x`'s nearFall abuts `survive`, not `collapse`.

## Recover-vs-hold: both built, no 12th fixture

HoldForCollapse is implemented and fully automated-tested — pure classification tests,
`BookBuilder`/inline-`Book`-literal hand-built sequences, renderer hold-lifecycle tests, and one
mandatory synthetic end-to-end sequencing test (below) — because the spec text already supports
it and PROTOTYPE_V1 §7's P6 bullet list names it explicitly. **No 12th canonical fixture is added**
— none of the 11 has `nearFall` immediately before `collapse`, and manufacturing one solely for
Storybook coverage was explicitly rejected. **HoldForCollapse's real visual proof (nearFall → hold
→ an actual collapse animation) is deferred to P7**, when collapse animation exists to consume the
held pose. Storybook ships only the recover path, on real fixtures.

## Classification: immediate-next-event only, never a forward scan

```ts
export function classifyNearFallResolution(book: Book, blockEventIndex: number): NearFallResolution {
  return book.events[blockEventIndex + 1]?.type === 'collapse' ? 'holdForCollapse' : 'recover';
}
```
A nearFall holds **only** when `book.events[event.index + 1]` is `collapse`. This is a precise P6
implementation rule, not a claim about what "next semantic Book Event" means in the English text
of any spec. `validateBook` already guarantees `event.index === array position` for every event, so
indexing is exact. No scanning: `nearFall → zoneChange → collapse (later)` still classifies
`recover`, and — the critical case, proven directly against real data —
`cruelCollapseSky0x`'s nearFall classifies `recover` because its immediate next event is a `block`,
even though the Book eventually collapses. Classification never reads `payoutMultiplier`,
`offsetU`, `rotationMd`, intensity, direction, or any visual/physics state. A missing next event
(structurally impossible post-`validateBook`, since every Book ends in `finalWin`) defensively
defaults to `'recover'` via optional chaining — not new validation.

`NearFallResolution` is defined in `nearFall.ts`, not in `createTowerEventHandlers.ts` — the
renderer must never import a behavior-specific visual type from the handler layer. Both files
import it from `./nearFall`. `classifyNearFallResolution` itself stays in
`createTowerEventHandlers.ts`, its only caller and the layer that has `Book` in scope.

The `block` handler gains a `context` parameter (previously unused) to reach `context.book`:
```ts
block: async (event, context) => {
  model = applyTowerEvent(model, event);
  const block = model.blocks[model.blocks.length - 1];
  const nearFallResolution =
    block.behavior === 'nearFall' ? classifyNearFallResolution(context.book, event.index) : undefined;
  await renderer.addBlock(block, nearFallResolution);
},
```
This is a **peek** — a plain read of a future event's `.type`, never a call to
`applyTowerEvent`/any handler for it. P2's exclusive ownership of dispatch order/timing is
untouched; `buildTowerModel` is still never used for live playback.

## Motion/curve/preset design — V1, versioned, greybox tuning

```ts
export const NEAR_FALL_PRESETS_V1_BY_INTENSITY: Readonly<Record<Intensity, NearFallMotionPreset>> = {
  0: { peakLeanMd: 0,     durationMs: 700 },
  1: { peakLeanMd: 2500,  durationMs: 700 },
  2: { peakLeanMd: 5000,  durationMs: 700 },
  3: { peakLeanMd: 7500,  durationMs: 700 },
  4: { peakLeanMd: 10000, durationMs: 700 },
};

export const NEAR_FALL_HOLD_FREEZE_T_V1 = 0.55; // single source of truth, referenced by the curve

export const NEAR_FALL_CURVE_V1_KEYFRAMES = [
  [0.00, 0], [0.15, 0.65], [0.35, 1.00], [NEAR_FALL_HOLD_FREEZE_T_V1, 1.00],
  [0.80, -0.55], [0.92, 0.20], [1.00, 0],
];
```
**GREYBOX TUNING, NOT LOCKED PRODUCT VALUES.** Intensity scales amplitude only (mirroring wobble's
precedent); `durationMs` and curve shape stay uniform across intensities. The plateau (two
keyframes at fraction 1.0) *is* TOWER_SYSTEM §10's "pause near critical lean," encoded directly in
the shared curve. `NEAR_FALL_HOLD_FREEZE_T_V1` is referenced directly inside the keyframe array —
the plateau-end keyframe and the hold terminal point cannot silently drift apart.

**Relative-strength claim, stated precisely.** Wobble's max (intensity 4) is `6000md`. NearFall's
`peakLeanMd` are `2500/5000/7500/10000` for intensities 1–4 — intensities 1–2 are *weaker* than
wobble's max, so it is not true that every nonzero nearFall intensity exceeds wobble. The only
claim made or tested: **the nearFall intensities every real fixture actually uses — 3 and 4 — both
exceed wobble V1's own maximum.** Compared maximum-vs-maximum via the raw versioned `peakLeanMd`
values directly, not at some shared/"equivalent" `t` — nearFall peaks at `t=0.35`, wobble at
`t=0.45`, different normalized times on independently-authored curves; the raw values are valid
maxima only because both curves' own peak keyframe fraction happens to be exactly `1.0`.

## Root/pivot/camera — zero changes to P5's mechanism

Reuses `wobbleRoot` directly (no new container); pivot formula unchanged
(`config.originX`, `config.originY + config.blockHeightPx / 2` — the fixed tower-base support
point, independent of any block's authored transform). `computeCameraOffsetY` untouched, still
reads only committed `transform.y`, structurally blind to `wobbleRoot.rotation` regardless of
behavior, sub-phase, or hold state.

**Held rotation cannot leak into a legal continuation.** A held nonzero rotation only ever occurs
when the classification has already guaranteed the very next Book event is `collapse` — and
`validateBook` forbids any further `block`/`zoneChange`/`survive`/`moon` after `collapse`. There is
no legal subsequent wobble/nearFall for a stale rotation to corrupt.

## Timeline: one shared accumulator, exact final states

Same unified single-`elapsedMs`/single-`ticker.add` design P5 established, extended with an
additional additive term for nearFall (mutually exclusive with wobble's, since a block's
`behavior` can only be one value):
```ts
const totalDurationMs = config.dropDurationMs
  + (effectiveWobble?.durationMs ?? 0)
  + (effectiveNearFall
      ? (resolution === 'holdForCollapse' ? NEAR_FALL_HOLD_FREEZE_T_V1 * effectiveNearFall.durationMs : effectiveNearFall.durationMs)
      : 0);
```
The total elapsed time from ticker registration to hold completion is
`config.dropDurationMs + NEAR_FALL_HOLD_FREEZE_T_V1 × preset.durationMs` — the drop is *included*,
not excluded; the hold-phase-duration alone is a shorter quantity that must not be confused with
the total. At settle: recover sets `wobbleRoot.rotation = 0` exactly; hold explicitly (re-)assigns
`rotationMdToRadians(computeNearFallLeanMd(NEAR_FALL_HOLD_FREEZE_T_V1, preset, direction))` — the
exact mathematical value at the freeze point, never "whatever the last tick's approximation left
it at." Coarse-vs-fine tick tests cover both the drop→approach boundary and, on the recover path,
the plateau→recovery boundary.

## Renderer API

`addBlock(block: LogicalBlock, nearFallResolution?: NearFallResolution): Promise<void>` — one new
optional parameter, ignored for non-nearFall blocks. **Defensive default:** omitted on an effective
nearFall → `'recover'`, never `'holdForCollapse'` — an accidentally-missing visual-intent argument
must not leave the tower persistently tilted. The real Book-driven path always passes the
explicitly classified value; the default only guards a caller that forgets to.

## Cancellation

Still exactly one ticker registration per `addBlock`; `activeCancel` set once, never reassigned.
`cancel()` now **unconditionally** resets `wobbleRoot.rotation = 0` as its first action — even if a
hold already resolved and `activeCancel` is already `undefined` — before invoking `activeCancel?.()`
for any still-active ticker teardown. Covers: cancel during approach, during the recovery tail,
during the hold window, after normal recover completion, **after a resolved hold** (the case this
addition specifically targets), cancel called twice, `addBlock` after cancel, and `TowerStage`
teardown (structural, matching P4/P5's established non-automated verification for Svelte wiring).

## Files

- `src/renderer/tower/nearFall.ts` (+ `.test.ts`) — pure curve/preset math and the
  `NearFallResolution` type.
- `src/renderer/tower/createTowerRenderer.ts` (+ `.test.ts`) — nearFall branch on `wobbleRoot`;
  `addBlock`'s new optional parameter with defensive default; hold-vs-recover duration/settle
  logic; unconditional rotation reset in `cancel()`.
- `src/renderer/tower/createTowerEventHandlers.ts` (+ `.test.ts`) — `block` handler gains
  `context`; new exported `classifyNearFallResolution`.
- `src/renderer/tower/TowerStage.stories.svelte` — new `Near Death Win 20x` story (the existing
  canonical fixture, not previously wired into Storybook); `Big Climb 100x`'s comment refreshed.
- `docs/work/TASK-P6-near-fall.md` (this file).

Not touched: `src/book/schema.ts`, `src/book/validate.ts`, `src/book/player.ts`,
`src/tower/model.ts`, `src/renderer/tower/transforms.ts`, `src/renderer/tower/wobble.ts` (+test),
`src/renderer/pixi-stage/*`, all 11 existing fixture Books, payout math, `docs/BOOK_SPEC.md`,
`docs/TOWER_SYSTEM.md`, `docs/DECISIONS.md`.

## Automated tests

`nearFall.test.ts`: every V1 keyframe including both plateau points; direction mirroring;
direction/intensity-0 → 0; monotonic peak 1→4; intensities 3/4 exceed wobble's max (raw
`peakLeanMd` comparison, not shared-`t`); rest-to-rest; linear-interpolation midpoint;
clamp above/below `[0,1]`; freeze constant resolves to the exact plateau value; no `-0` instability.

`createTowerEventHandlers.test.ts`: `classifyNearFallResolution` against every case in the table
above (collapse/block/survive/moon/zoneChange/zoneChange-then-later-collapse/block-then-later-
collapse/missing-next-event), plus direct checks against real `cruelCollapseSky0x`/`bigClimb100x`
data; handler-wiring tests proving the classified resolution (or `undefined` for non-nearFall
blocks) actually reaches `renderer.addBlock`.

`createTowerRenderer.test.ts`: zero-effect nearFall fallback (intensity 0, direction 0, including a
direction-0 case explicitly classified `holdForCollapse` to prove it still short-circuits); recover
does not resolve early and ends at exact 0; hold resolves at the exact freeze pose with no further
ticker work; defensive-default-recovers test; committed transforms unchanged after both paths;
camera isolation from both transient and held rotation; renderer-level maximum-vs-maximum peak
comparison (nearFall 3/4 vs wobble 4, sampled from real ticked animations, not just preset
constants); pivot/support-point invariance under an active/held nearFall; cancellation cases A–E;
coarse/fine timing equality across both the drop→approach and plateau→recovery boundaries;
real-fixture integration (`nearDeathWin20x`, `cruelCollapseSky0x`) proving recover + fingerprint
parity + no mutation; and the **mandatory synthetic hold-for-collapse full sequencing test** — a
`BookBuilder`-built, non-canonical Book (`towerStart → clean → clean → nearFall → collapse →
setTotalWin(0) → finalWin(0)`) run through the real `playBookEvents` + real
`createTowerEventHandlers` + real `createTowerRenderer`, proving in one continuous run: nearFall's
own `applyTowerEvent` fires exactly once; collapse is not applied while the hold is still pending;
the hold resolves at exactly the freeze pose with the exact total elapsed time (drop duration
*plus* `NEAR_FALL_HOLD_FREEZE_T_V1 × durationMs`); collapse is applied only afterward, exactly
once; the held pose is still present at that moment (no collapse animation runs); the final live
fingerprint matches an independently-computed `buildTowerModel`; and the Book is byte-identical
before/after. All 19 pre-existing P5 tests continue passing unchanged.

## Manual visual QA

**Launch:** `pnpm storybook` → **Renderer/TowerStage** → **Near Death Win 20x** (primary) and
**Big Climb 100x** (secondary, nearFall-abuts-survive variant). Checklist: nearFall clearly more
dangerous than wobble; approach/hold readable; direction readable; intensity 3 vs 4 contrast at
least as legible as wobble's; tower visibly approaches apparent failure, pauses, then recovers;
next block waits for recovery; support stays anchored; camera doesn't chase; no drift on reload;
legible at 390×844 and desktop; mid-story-switch teardown produces no console error; all existing
P4/P5 stories unchanged. No holdForCollapse visual checklist item — nothing to see yet, by design.

## Out of scope

Collapse animation itself (P7); a 12th canonical fixture; `slide`; survive/Moon animation; Max Win
presentation; zone/environment art; the full P8 camera system; camera shake/impulse; audio; payout
UI; RGS/replay; cosmetic PRNG/`visualSeed`; physics engine; translational false-drop; persistent
cross-block `restingLean`; isolated per-intensity Storybook matrix (P9); any change to
`src/book/player.ts`/`schema.ts`/`validate.ts`/`src/tower/model.ts`/the 11 existing fixtures/payout
math; P7+.
