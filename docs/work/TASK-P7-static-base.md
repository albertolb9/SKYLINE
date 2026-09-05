# TASK-P7-static-base

**Scope:** a renderer correction made before the combined P7 audit (P7 — Collapse plus this
correction close together). Adds a static, permanently non-rotating visual tower base as a sibling
of the existing moving tower root, so wobble/nearFall/recovery/holdForCollapse/collapse motion
reads relative to a stable support rather than drifting in a void. No new Book Event, no new
logical block, no P8 camera work.

**Requirement IDs:** TOWER-001/002/003/005 (renderer never decides placement/outcome; logical/
pixel separation unaffected), ARCHITECTURE.md §7 (renderer responsibilities). Governing spec:
`docs/TOWER_SYSTEM.md` §19 (new), `docs/DECISIONS.md` D-037 (new), `docs/ARCHITECTURE.md` §7.

## Whether a base already existed

No. `createTowerRenderer.ts` constructed exactly two containers (`cameraContainer`, `wobbleRoot`)
and, per `addBlock` call, exactly one `Graphics` (the block itself). There was no separate ground/
support/foundation visual anywhere in the renderer, Storybook stories, or `TowerStage.svelte`. This
is a net-new visual element, not a misconfigured existing one.

## Container hierarchy

`base` is a sibling of `wobbleRoot`, both direct children of `cameraContainer`, added base-first
(renders behind the moving tower where the two may ever overlap during an active lean — a visual-
tuning choice, not an architectural one; trivially reversible if manual QA prefers otherwise):

```
app.stage
  └─ cameraContainer
       ├─ base         — Graphics, static after construction; inherits ONLY cameraContainer's
       │                 translation; nothing ever sets its .rotation
       └─ wobbleRoot    — unchanged: .rotation driven by wobble/nearFall/collapse
            └─ block graphics — unchanged
```

`base` is a plain `Graphics` (like a block), not a `Container` — it never needs its own pivot or
rotation. Created once, positioned once, never touched again by `addBlock`, `collapse`, or
`cancel`.

## Shared support-point extraction

The existing inline pivot formula (`x = config.originX`, `y = config.originY +
config.blockHeightPx / 2`) is extracted into one pure, named, tested function so both consumers
provably reference the identical value rather than two independently-authored copies that could
silently drift apart — the same discipline `NEAR_FALL_HOLD_FREEZE_T_V1` already established in P6:

```ts
// transforms.ts
export interface TowerSupportPivot {
  readonly x: number;
  readonly y: number;
}

export function computeTowerSupportPivot(config: TowerRenderConfig): TowerSupportPivot {
  return { x: config.originX, y: config.originY + config.blockHeightPx / 2 };
}
```

This is the one production change in this task that is a refactor rather than a pure addition —
the value is unchanged (same formula, same numbers); only its ownership moves. Both `wobbleRoot`'s
pivot/position and `base`'s placement now call this one function.

## Base geometry stays local to the renderer (not transforms.ts)

Base width/height/drawing are renderer-presentation concerns, not logical->pixel math, so they stay
local to `createTowerRenderer.ts` behind a small `createBaseGraphics(config)` helper, mirroring
`createBlockGraphics`'s existing pattern — drawn with its **top edge at local y = 0**, horizontally
centered, then positioned via `base.x = pivot.x; base.y = pivot.y;` so the rendered rectangle's
top-center lands exactly on the shared support point.

```ts
const BASE_WIDTH_MULTIPLIER_V1 = 1.25; // wider than one block -- reads as a foundation lip
const BASE_HEIGHT_BLOCKS_V1 = 3;        // in units of blockHeightPx
const BASE_FILL_COLOR = 0x2a2e38;       // slightly darker than BLOCK_FILL_COLOR (0x3a3f4b)
const BASE_STROKE_COLOR = BLOCK_STROKE_COLOR;
```

**GREYBOX TUNING, NOT LOCKED VALUES.** Sizing derives from `config` (viewport-derived, computed
once at construction) — no new resize-reactivity. With the default tuning (`bottomMarginBlocks:
1`), only the base's top ~1 block-height is visible above the viewport's bottom edge before it runs
off-frame — intentional (a foundation disappearing off-screen reads as normal), not a bug. Camera
bottom-margin tuning was deliberately left unchanged rather than adjusted to expose more base.
Manual QA judges size/color/z-order; none of these are architecture.

## Animation isolation

No changes to `wobble.ts`, `nearFall.ts`, or `collapse.ts` math, and no changes to `addBlock`'s or
`collapse()`'s logic beyond the container-construction section — both still only ever read/write
`wobbleRoot.rotation`. `base.rotation`/`base.x`/`base.y` are assigned exactly once, at construction,
and never referenced again anywhere in this module. This makes the base's stillness a structural
property of the code (nothing exists that could mutate it), not a behavior that happens to hold
today. Proven directly through wobble, nearFall (approach/recovery and the frozen
`holdForCollapse` pose), and collapse (direct start, same-sign held start, and the load-bearing
opposite-sign held start).

## Camera

Zero changes to `computeCameraOffsetY` or to where `cameraContainer.y` is assigned. Because `base`
and `wobbleRoot` are both direct children of the same `cameraContainer`, they inherit its
translation identically and automatically, by Pixi's normal parent-child composition. "Static"
means static *relative to tower animation*, not screen-fixed — base still moves with the world/
camera exactly like the tower does.

## Cancellation

No changes to `cancel()`. Its existing unconditional `wobbleRoot.rotation = 0` reset never touches
`base`, and nothing else ever will — there is no reset needed for a transform that is never
mutated.

## Test-infrastructure fix (required, not optional)

`createTowerRenderer.test.ts`'s shared `vi.mock('pixi.js', ...)` records every `new Graphics()`
call into one flat `graphicsInstances` array, and most existing tests read `graphicsInstances[0]`
immediately after constructing a renderer and adding one block, assuming index 0 is that block's
own graphics. Once `base` is also a `Graphics` created at construction time, it would land at index
0 instead, silently shifting every such assertion by one.

Fixed with a small test-local wrapper:

```ts
function createRendererUnderTest(app: Application, tuning?: Partial<TowerViewportTuning>): TowerRenderer {
  const before = graphicsInstances.length;
  const renderer = createTowerRenderer(app, tuning);
  graphicsInstances.splice(before, graphicsInstances.length - before); // drop only what THIS
  return renderer;                                                     // construction just added
}
```

Splicing only the entries added during *this* call (not clearing the whole array) is required, not
cosmetic: the existing "determinism" test in the `addBlock` describe block constructs two renderers
back-to-back and compares their respective first block's graphics via `graphicsInstances[0]`/`[1]`;
a blanket `graphicsInstances.length = 0` would also erase the first renderer's already-pushed block
graphics. Hand-traced against that exact test to confirm correctness.

Every existing in-body call to `createTowerRenderer(app, ...)` in the test file — 65 call sites —
was mechanically renamed to `createRendererUnderTest(...)` via a single literal find/replace of the
substring `createTowerRenderer(` (verified beforehand, by grep, that this exact substring appears
nowhere except genuine call sites — not in the file's own `import`/destructure line, not in any
`describe(...)` title, not in the one `ReturnType<typeof createTowerRenderer>` type usage, since
none of those has `(` immediately following the name). New base-specific tests use the **real**
`createTowerRenderer` directly where they need to observe the base's own construction-time
`Graphics` creation (exactly one such test).

`wobbleRootOf(stage)` changed from `cameraContainer.children[0]` to `cameraContainer.children[1]`
(one line; every one of its ~15 call sites is unchanged). A new `baseOf(stage)` helper returns
`cameraContainer.children[0]`.

## Files

- `src/renderer/tower/transforms.ts` (+ `.test.ts`) — new `TowerSupportPivot`/
  `computeTowerSupportPivot`.
- `src/renderer/tower/createTowerRenderer.ts` (+ `.test.ts`) — static base construction/placement;
  shared pivot extraction; updated hierarchy doc comment; test-infrastructure fix above plus new
  tests (below).
- `docs/DECISIONS.md` — new D-037 (+ detail paragraph).
- `docs/TOWER_SYSTEM.md` — new appended §19 (appended, not inserted mid-document, so every
  existing exact-number citation to §1-18 across already-committed task notes stays valid).
- `docs/ARCHITECTURE.md` — one additive §7 bullet.
- `docs/work/TASK-P7-static-base.md` (this file).

Not touched: `src/book/schema.ts`, `src/book/validate.ts`, `src/book/player.ts`,
`src/tower/model.ts`, `src/renderer/tower/wobble.ts`/`nearFall.ts`/`collapse.ts` (+ their tests —
math untouched), `src/renderer/tower/createTowerEventHandlers.ts` (+ `.test.ts`), `src/renderer/
tower/TowerStage.svelte`, `src/renderer/tower/TowerStage.stories.svelte` (no new story needed —
base renders automatically in every existing story), `src/renderer/pixi-stage/*`, all 11 fixture
Books, payout math, `docs/BOOK_SPEC.md`, `docs/GAME_SPEC.md`, `docs/REQUIREMENTS.md`, P8 camera
work.

## Automated tests added

`transforms.test.ts`: 3 new tests for `computeTowerSupportPivot` (real viewport-derived config,
a second differently-shaped viewport, and a hand-built config checked against the exact formula).

`createTowerRenderer.test.ts`: a new `createTowerRenderer — static tower base` describe block (11
tests) proving: base is created once directly under `cameraContainer` and is never a child of
`wobbleRoot` (and is a distinct object from it); base top-center equals the exact shared pivot also
used by `wobbleRoot`; logical block graphics land under `wobbleRoot`, never under `base`; wobble,
nearFall (approach/recovery), `holdForCollapse`, and direct collapse each change `wobbleRoot.rotation`
while `base`'s `x`/`y`/`rotation` stay byte-identical to their construction-time values, checked
both mid-animation and at settle; `cameraContainer` translation structurally carries both `base`
and `wobbleRoot` as siblings once the camera safe band is crossed; cancel mid-animation, cancel
after collapse completion, and double-cancel all leave `base` untouched. Additionally: the existing
P6-handoff "opposite-sign held start" test and the mandatory synthetic P6->P7 handoff test (both
variants, matching-sign and the load-bearing opposite-sign case) were extended in place with
`base`-unchanged assertions at every checkpoint they already inspect, rather than duplicated —
these are the tests that most directly exercise the sequence this correction must not disturb.

No new fingerprint/Book/Model test was added — `base` never reads Book/Model/fingerprint data;
every pre-existing fingerprint-parity test continues to prove this layer is undisturbed simply by
still passing.

## Fresh verification

`pnpm typecheck` (0 errors, 1017 files) · `pnpm test -- --run` (**295/295 passing**, 13 test files
— 281 pre-existing + 3 new in `transforms.test.ts` + 11 new in `createTowerRenderer.test.ts`) ·
`pnpm lint` (clean) · `pnpm build` (clean, 829 modules) · `pnpm build-storybook` (clean, 1355
modules, same pre-existing >500kB chunk advisory, unrelated to this task).

One test-writing bug caught and fixed during verification: an initial "cancel mid-animation" test
called `renderer.collapse(...)` and `renderer.cancel()` without awaiting/catching the resulting
rejection, producing an unhandled-rejection warning from Vitest even though all tests passed —
fixed by asserting the rejection explicitly (`await expect(pending).rejects.toBeInstanceOf(...)`),
matching every other cancellation test in this file.

## Exit criteria

Base renders as a distinct static element in every existing story with zero new story/fixture
files; base is structurally a sibling of `wobbleRoot` under `cameraContainer`, never a child of
`wobbleRoot`; base's top-center coincides exactly with the shared support pivot also used by
`wobbleRoot`; base's local transform is provably unchanged through wobble, nearFall (recover and
hold), collapse (direct, same-sign held, and opposite-sign held), and cancellation at any point;
base inherits camera translation structurally, automatically, with zero new camera code; all
existing block transforms, Book/Model/fingerprint behavior, and P4-P7 test suites remain green with
only the mechanical test-helper changes above; `pnpm typecheck`/`test`/`lint`/`build`/
`build-storybook` all pass; `docs/DECISIONS.md`/`docs/TOWER_SYSTEM.md`/`docs/ARCHITECTURE.md`
updated; manual Storybook QA still required (not performed here — no browser tooling) to confirm
the base reads as a coherent, planted support with no pivot gap/jump, judge base size/color/z-order,
and re-confirm the P6->P7 handoff remains seamless with the base present.

## Out of scope

Redesigning block art or base final style; adjusting camera bottom-margin tuning to expose more of
the base; masking/clipping or new containers to solve any pivot-seam visual issue preemptively (a
z-order flip is the documented first fallback if manual QA finds one); P8 camera work; any change
to Book schema/validator/player/`TowerModel`/fixtures/payout math; a new Storybook story (none
needed).
