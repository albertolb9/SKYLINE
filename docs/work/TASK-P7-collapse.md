# TASK-P7-collapse

**Scope:** `PROTOTYPE_V1.md` §7 P7 — Collapse only. Promotes `collapse` Book events to real
deterministic visual motion: the whole tower topples, on the existing `wobbleRoot`, from whatever
rotation the renderer currently holds (zero for a direct collapse, or the exact P6
`holdForCollapse` freeze pose for a held collapse) toward an authoritative terminal lean whose
sign comes only from `profile` and whose magnitude comes only from `intensity`, remaining there
for the rest of the rendered round. No individual block detach/chaos, no `slide`, no survive/Moon
visual resolution, no cosmetic PRNG, no physics, no P8+.

**Requirement IDs:** TOWER-004, TOWER-001/002/003/005, BOOK-002. Governing spec:
`docs/TOWER_SYSTEM.md` §11, `docs/BOOK_SPEC.md` §8, `docs/GAME_SPEC.md` §8, `docs/PROTOTYPE_V1.md`
§7 P7 (as clarified by this task — see below).

## Real scope mismatch found and resolved: PROTOTYPE_V1.md §7

`PROTOTYPE_V1.md` §7's P7 heading previously read "Collapse / survive" and bundled three bullets:
"left/right collapse; final stable survive; simple result overlay from fixture payout." The
current implementation roadmap is P7 = Collapse only, with Survive/Win presentation and the
result/payout overlay deferred to a later dedicated phase. Treating "left/right collapse" as this
phase's authoritative scope while silently excluding the other two bullets, while also claiming no
SDD clarification was necessary, would have been a real, unresolved inconsistency.

**Resolved** by editing `PROTOTYPE_V1.md` directly (not a `DECISIONS.md` entry — this is
phase/task-sequencing bookkeeping, not a locked or accepted product/architecture decision; nothing
in the `DECISIONS.md` register governs how work is split across phase headings): P7's heading is
now "Collapse" with the single bullet "left/right collapse" and exit line "losses are instantly
legible." "Final stable survive" and "simple result overlay from fixture payout" moved to the
front of the *existing* P8 heading, now "Survive / result / zones / camera," with its exit line
extended to "wins are instantly legible; big/Space/Moon fixtures communicate altitude even with
rectangles/gradients." No renumbering cascade through P9/P10 — same phase count, same later
numbering, two bullets relocated one heading down.

## Normative precision

**TOWER-004** ("Wobble, slide, near-fall, recovery **and collapse** SHALL be deterministic for a
given Book") is the operative SHALL. **TOWER_SYSTEM §11**, quoted exactly: "Collapse is a
deterministic presentation sequence. **Suggested** implementation: 1. increase TowerRoot lean; 2.
move/rotate tower out of stability; 3. **optionally** detach a limited visual subset of blocks for
chaos after outcome is already terminal; 4. finish on readable 0x state." The whole list is
"suggested," and step 3 is independently marked "optionally" — neither is a MUST. Steps 1-2 are
exactly the whole-tower-root-lean mechanism P5/P6 already built.

**Corrected terminal-event scope.** Re-verified directly against `src/book/validate.ts`: after
`collapse`, `narrativeState` becomes `'closed'`. Every narrative/tower event case (`block`,
`zoneChange`, `survive`, `moon`, another `collapse`) requires `narrativeState === 'building'`
(survive also accepts `'afterMoon'`) — none can ever follow `'closed'`. But every economic/result
event case (`setWin`, `setTotalWin`, `wincap`, `finalWin`) requires the *opposite* —
`narrativeState !== 'building'` — so these are specifically gated to fire **only after** a
terminal narrative event, and every valid Book must end with `setTotalWin` + `finalWin`. The
precise, correct statement, used consistently in code/tests: **after `collapse`, no further
narrative/tower event can legally occur; economic/result events may and do follow, and must.**
("No event of any kind can follow collapse" is imprecise and directly contradicted by every real
0x Book's own `collapse -> setTotalWin(0) -> finalWin(0)` shape.)

## Collapse fixture audit (no modification to any of the 11 canonical Books)

Only `payoutMultiplier === 0` Books can legally contain `collapse` (`validate.ts`). Exactly 3 of
the 11 fixtures qualify:

| Fixture | Idx | Profile | Intensity | Zone | Last ordinal | Preceding event | Earlier danger (recovered) |
|---|---|---|---|---|---|---|---|
| quickCollapseStreet0x | 4 | leanLeft | 3 | street | 3 | block, clean | none |
| standardCollapseSkyline0x | 10 | leanRight | 3 | skyline | 8 | block, clean | wobble (5 events earlier) |
| cruelCollapseSky0x | 16 | leanLeft | 4 | sky | 13 | block, clean | nearFall + wobble (both recovered) |

3 real collapse Books; both profiles occur; only intensities 3/4 occur (never 1/2 — the same
pattern nearFall's own real fixtures showed). No canonical Book has nearFall/wobble/zoneChange
*immediately* before collapse — every real collapse is "cold," immediately preceded by a plain
`clean` block, with any earlier danger behavior long since fully recovered. No Book has more than
one collapse, and none can (`narrativeState` becomes `'closed'` permanently). No block/zoneChange/
survive/moon can legally occur after collapse, in any Book.

**Load-bearing conclusion:** every real collapse today already proves "history has zero effect on
collapse" by construction (nothing in the renderer reads history at all). The one scenario that
needs proving directly — nearFall immediately followed by collapse — exists in no canonical Book,
matching P6's own finding from the other side. Proven instead via a synthetic Book (see Tests).

## Whole-tower-only decision: why optional detach/chaos was deferred

**Decision: whole-tower lean only. No per-block detach/chaos in P7.** Reasoning:
1. TOWER_SYSTEM §11's detach step is textually optional, inside a list itself only "suggested."
2. `PROTOTYPE_V1.md`'s actual P7 task line (post-clarification) asks only for "left/right
   collapse" — no per-block mechanism named.
3. Asymmetric cost: whole-tower lean needs **zero new renderer state** (rotating the shared
   `wobbleRoot` parent already carries every existing block `Graphics` child automatically, via
   Pixi's normal parent-child transform propagation); per-block detach would need a brand-new
   persistent block/Graphics registry (`createTowerRenderer.ts` keeps none today — each
   `addBlock` call's local `graphics` reference goes out of scope once that call resolves) plus
   its own deterministic-chaos formula and test surface.
4. Consistency: P5 (wobble) and P6 (nearFall) both use whole-tower-root-rotation exclusively;
   collapse following suit keeps the mechanism uniform across all three behaviors.
5. `CLAUDE.md`'s "Build the smallest system that proves tension" and `PROJECT.md`'s cost-discipline
   pillar both favor the smaller system absent a requirement forcing the larger one.

If a future phase needs it, detach/chaos is a bounded *addition* on top of this same design, not a
replacement.

## Profile authority

`CollapseProfile` (`leanLeft`/`leanRight`) is the **sole** authoritative source of the terminal
lean's sign. `CollapseEvent` carries no `offsetU`/`rotationMd`/`direction` field of its own
(`schema.ts`), and `validate.ts` enforces no relationship between a preceding nearFall's direction
and a following collapse's profile — a valid Book can legally hold nearFall `direction: -1`
immediately followed by `collapse` `profile: 'leanRight'` (opposite signs). No special case exists
for this: the general lerp formula (below) handles it identically to the matching-sign case.

## Intensity authority

`CollapseIntensity` is `1|2|3|4` — no `0` (a "no collapse" isn't representable as an event), so
collapse needs **no zero-effect short-circuit**, unlike wobble/nearFall. Intensity controls
**terminal lean magnitude only**; `durationMs` stays constant (800ms) across intensities.

## V1 greybox values — GREYBOX TUNING, NOT LOCKED PRODUCT VALUES

```ts
export const COLLAPSE_PRESETS_V1_BY_INTENSITY: Readonly<Record<CollapseIntensity, CollapseMotionPreset>> = {
  1: { terminalLeanMd: 12000, durationMs: 800 },
  2: { terminalLeanMd: 16000, durationMs: 800 },
  3: { terminalLeanMd: 20000, durationMs: 800 },
  4: { terminalLeanMd: 25000, durationMs: 800 },
};

export const COLLAPSE_ROOT_CURVE_V1_KEYFRAMES = [
  [0.0, 0], [0.55, 0.75], [0.8, 1.08], [1.0, 1.0],
];
```

Every intensity's `terminalLeanMd` deliberately exceeds nearFall V1's own max (10,000md at
intensity 4), since collapse is the most dramatic terminal state. The curve is a fraction of the
**start->target distance**, not a fraction of a fixed peak like wobble/nearFall — collapse has no
fixed zero baseline, since its start is whatever rotation already exists. The small overshoot past
1.0 at `t=0.8` then settle to exactly 1.0 reads as a physical "topple and thud." Manual Storybook
QA must judge whether intensities 3/4 read as a decisive terminal collapse rather than merely a
strong lean — tune these values (not the architecture) before P7 closes if they don't.

## Direct-start / held-start architecture — one formula, no branch

`createTowerRenderer.ts`'s new `collapse(profile, intensity)`:

```ts
const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[intensity];
const startRotationRad = wobbleRoot.rotation; // exact snapshot, ZERO conversion
const targetRotationRad = rotationMdToRadians(computeCollapseTargetLeanMd(profile, preset)); // ONE conversion, the existing function
// per tick:
wobbleRoot.rotation = startRotationRad + (targetRotationRad - startRotationRad) * computeCollapseFraction(t);
```

`startRotationRad` is read exactly once, directly, whatever `wobbleRoot.rotation` actually is — no
radians->millidegrees->radians round trip, no new inverse conversion function
(`rotationMdFromRadians` was considered and deliberately **not** created). `collapse.ts` stays
pure and millidegree-authored for its preset table (matching `wobble.ts`/`nearFall.ts`'s existing
convention and keeping its tests directly comparable), while exporting a **unit-agnostic**
`computeCollapseFraction(t)` and a **profile->target** `computeCollapseTargetLeanMd(profile,
preset)` — the actual start->target lerp arithmetic lives entirely in the renderer, directly in
radians. At `t=0`, the renderer's own fraction is exactly `0`, so rotation is exactly
`startRotationRad` — identical for a direct start (`0`), a same-sign held start, or an
opposite-sign held start, with no branching for any of the three. At `t=1`, rotation is exactly
`targetRotationRad`, independent of the start.

## Sequencing (P2 -> P3 -> P7)

```ts
collapse: async (event) => {
  model = applyTowerEvent(model, event); // P3 terminal becomes collapsed(profile), exactly once
  await renderer.collapse(event.profile, event.intensity); // dramatizes only
},
```

Precise sequence: P2 dispatches `collapse` -> `applyTowerEvent` exactly once -> P3 becomes
`collapsed(profile)` -> `await renderer.collapse(...)` -> the collapse visual reaches its exact
terminal pose -> the renderer Promise resolves -> only then may P2 dispatch `setTotalWin`/
`finalWin` (both remain `advanceOnly`, so they cannot run until the `collapse` handler's own
`await` resolves, via P2's unchanged sequential-await loop in `src/book/player.ts`).

## Camera isolation

Zero changes. `computeCameraOffsetY` reads only the locally-captured, never-mutated `transform.y`
from `computeBlockTransform` — already structurally blind to `wobbleRoot.rotation` regardless of
which behavior drives it. No SDD passage requires a collapse-specific camera response.

## Terminal visual state

Final root rotation is exactly `targetRotationRad`, assigned at `settle()`. **Persists for the
remainder of the rendered round — through any later economic/result events — until
`cancel()`/component teardown.** Not described as "forever": nothing in the normal Book-playback
path (economic-event dispatch or any other in-round mechanism) ever touches it again, but it is
simply never claimed to be permanent/eternal state. `renderer.cancel()` needs no changes — its
existing unconditional `wobbleRoot.rotation = 0` reset is harmless post-collapse for the same
reason it was already harmless post-hold in P6: `cancel()` only ever fires from
`TowerStage.svelte`'s `onBeforeDestroy`, the instant before the whole Pixi `Application` is
destroyed. No renderer reset/round-restart API is added.

## Cancellation

`collapse()` reuses the existing single-slot `activeCancel`/`cancelled` mechanism unchanged — no
changes to `cancel()` itself. Covered: cancel during the (only) lean phase; cancel after
completion (root resets to 0, harmless, only reachable at teardown); cancel called twice;
`collapse()` called after `cancel()` (rejects immediately, no animation started). "Detach"/"chaos"
cancellation cases are not applicable (no such phases exist under the whole-tower-only decision).

## Storybook strategy — no 12th canonical fixture

Real stories: `quickCollapseStreet0x` (leanLeft/3), `standardCollapseSkyline0x` (leanRight/3,
crosses a zoneChange), `cruelCollapseSky0x` (leanLeft/4, the strongest historical-independence
proof — an earlier nearFall and an earlier wobble both already recovered well before the eventual
collapse). One dev-only synthetic scenario, built inline in `TowerStage.stories.svelte` with the
real `BookBuilder` (verified before use: its only import is type-only from `book/schema`, zero
Vitest/test-framework runtime dependency, and it is already transitively bundled into Storybook
today via every existing fixture story) — never exported from `test-fixtures/books`, never added
to the canonical 11, never covered by `books.test.ts`. It exercises the hardest valid case:
nearFall holds toward the left (`direction: -1`, intensity 4) immediately followed by `collapse`
`profile: 'leanRight'` (intensity 4) — proving no snap to 0, exact continuity from the held pose,
and that profile authoritatively controls the final side even against the nearFall's own opposite
direction. Clearly labeled `"DEV ONLY - NearFall to Collapse Handoff (opposite direction)"` (plain
ASCII — the Storybook Svelte CSF indexer derives an export identifier from the story name and
rejects em-dash/arrow characters in it, discovered directly by running `build-storybook`).

## Files

- `src/renderer/tower/collapse.ts` (+ `.test.ts`) — pure preset/curve math:
  `COLLAPSE_PRESETS_V1_BY_INTENSITY`, `COLLAPSE_ROOT_CURVE_V1_KEYFRAMES`,
  `computeCollapseTargetLeanMd`, `computeCollapseFraction`.
- `src/renderer/tower/createTowerRenderer.ts` (+ `.test.ts`) — new `collapse(profile, intensity)`
  method; no changes to `addBlock`, `cancel()`, container setup, or camera logic.
- `src/renderer/tower/createTowerEventHandlers.ts` (+ `.test.ts`) — `collapse` handler gains the
  `renderer.collapse(...)` call (previously `advanceOnly`).
- `src/renderer/tower/TowerStage.stories.svelte` — 3 real collapse stories + 1 dev-only handoff
  story.
- `docs/PROTOTYPE_V1.md` — the minimal §7 P7/P8 scope clarification above (no `DECISIONS.md`
  entry).
- `docs/work/TASK-P7-collapse.md` (this file).

Not touched: `src/book/schema.ts`, `src/book/validate.ts`, `src/book/player.ts`,
`src/tower/model.ts`, `src/renderer/tower/wobble.ts`/`nearFall.ts` (+ tests),
`src/renderer/tower/transforms.ts`/`.test.ts` (a `rotationMdFromRadians` inverse was considered and
rejected — the radians-direct design above needs no new conversion function), `src/renderer/
pixi-stage/*`, all 11 existing fixture Books, payout math, `docs/BOOK_SPEC.md`, `docs/
TOWER_SYSTEM.md`, `docs/DECISIONS.md`.

## Automated tests

`collapse.test.ts`: exact preset table (all 4 intensities); no intensity-0 entry; constant
duration; strictly increasing magnitude 1->4; every intensity exceeds nearFall's own max; exact
keyframes including the overshoot point; profile sign mapping (`leanRight`->positive,
`leanLeft`->negative); deterministic repeatability; exact fraction 0 at `t=0` and 1 at `t=1`;
piecewise interpolation; clamp outside `[0,1]`; no `-0` instability.

`createTowerRenderer.test.ts`: direct collapse starts from exact 0 and does not mutate root before
any tick; reaches the exact profile/intensity terminal rotation for every combination; profile
alone determines the final side (leanLeft/leanRight settle on opposite signs); intensity changes
magnitude only; approved overshoot exhibited then settles back exactly; Promise does not resolve
early; ticker removed after completion and the terminal pose survives further ticks; coarse/fine
tick equality; camera and committed block transforms unaffected; **same-sign held start** and
**opposite-sign held start** continuity (driving a real nearFall `holdForCollapse` to resolution
first, then calling `collapse()` on the same renderer instance, asserting zero reset before any
tick and the exact profile-commanded final target regardless of the held start's sign);
cancellation cases A-D; real-fixture integration for `quickCollapseStreet0x` and
`standardCollapseSkyline0x` (exact terminal pose + fingerprint parity); the pre-existing P6
`cruelCollapseSky0x` integration test updated in place (its final assertion, written when
`collapse` was a no-op, now correctly expects the real collapse terminal pose instead of `0`); and
the **mandatory P6->P7 synthetic handoff test**, in two variants (matching-sign and the
load-bearing opposite-sign case), each proving in one continuous run: nearFall's own
`applyTowerEvent` exactly once; the exact P6 freeze pose reached; collapse's own `applyTowerEvent`
occurs only afterward, exactly once; **at the instant collapse's ticker registers but has not yet
ticked, rotation is still exactly the held pose** (the core continuity proof); no reset-to-zero
frame anywhere in between; collapse's Promise remains pending mid-duration; economic events
(`setTotalWin`/`finalWin`) dispatch only after collapse resolves; the final rotation is the
profile-commanded target regardless of the nearFall's own direction; fingerprint parity against an
independently-computed `buildTowerModel`; Book byte-identical before/after. The pre-existing P6
"mandatory hold-for-collapse full sequencing" test (written when `collapse` was a no-op) was
updated in place to drive collapse's own new animation to completion and assert its real terminal
pose, rather than asserting the stale nearFall freeze value forever.

`createTowerEventHandlers.test.ts`: `applyTowerEvent`/`renderer.collapse` each called exactly once
with the event's own unmodified `profile`/`intensity`; economic events do not dispatch until
`renderer.collapse`'s Promise resolves (explicit gated-promise test); no Book mutation across a
real collapse fixture playback.

## Exit criteria

Real `collapse` Book events produce deterministic terminal animation on the whole `wobbleRoot`;
renderer never decides whether collapse happens, its profile, or its intensity; `profile` alone
controls the authoritative macro direction, proven under a deliberately opposite-signed held start;
`intensity` controls only terminal-lean magnitude; direct and held-start collapse both proven, with
zero visual snap between `holdForCollapse` and `collapse`, snapshotted and interpolated directly in
radians with no unit round-trip; same Book produces the same logical fingerprint; economic/result
events correctly wait for, and then do follow, the collapse animation; the collapse terminal pose
persists through the remainder of the rendered round until teardown/cancel; camera remains fully
isolated; no RNG/physics/wall-clock-dependent final state anywhere in P7; cancellation/teardown
safe; all pre-existing P4-P6 tests remain green; `pnpm typecheck`/`test`/`build`/`lint`/
`build-storybook` all pass; manual Storybook QA passes, including the opposite-direction dev-only
handoff proof and the greybox-angle legibility gate; `docs/PROTOTYPE_V1.md`'s P7/P8 scope
clarification is included in this task's diff.

## Out of scope

Survive animation; result/payout UI (both deferred to P8 per the scope clarification above);
Moon; zone/environment art; the full P8 camera system; camera shake/impulse; individual block
detach/debris/chaos simulation; physics engine; cosmetic PRNG/`visualSeed`; `slide`; audio; a 12th
canonical fixture; a renderer reset/round-restart API; any change to `src/book/player.ts`/
`schema.ts`/`validate.ts`/`src/tower/model.ts`/the 11 existing fixtures/payout math; P8+.
