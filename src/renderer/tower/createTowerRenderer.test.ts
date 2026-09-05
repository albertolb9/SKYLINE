import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Application } from 'pixi.js';
import type { LogicalBlock, TowerModel } from '../../tower/model';
import { playBookEvents } from '../../book/player';
import {
  cruelCollapseSky0x,
  nearDeathWin20x,
  quickCollapseStreet0x,
  standardCollapseSkyline0x,
  wobbleWin5x,
} from '../../test-fixtures/books';
import { BookBuilder } from '../../test-fixtures/bookBuilder';
import {
  DEFAULT_TOWER_VIEWPORT_TUNING,
  computeBlockTransform,
  computeTowerSupportPivot,
  computeTowerViewportConfig,
  rotationMdToRadians,
  type TowerViewportTuning,
} from './transforms';
import type { TowerRenderer } from './createTowerRenderer';
import { WOBBLE_PRESETS_V1_BY_INTENSITY } from './wobble';
import { NEAR_FALL_HOLD_FREEZE_T_V1, NEAR_FALL_PRESETS_V1_BY_INTENSITY, computeNearFallLeanMd } from './nearFall';
import { COLLAPSE_PRESETS_V1_BY_INTENSITY, computeCollapseTargetLeanMd } from './collapse';
import type { CollapseProfile } from '../../book/schema';

type TickCallback = (ticker: { deltaMS: number }) => void;

function createFakeGraphicsInstance() {
  const instance = {
    x: 0,
    y: 0,
    rotation: 0,
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
  };
  instance.rect.mockReturnValue(instance);
  instance.fill.mockReturnValue(instance);
  instance.stroke.mockReturnValue(instance);
  return instance;
}

function createFakeContainerInstance() {
  const children: unknown[] = [];
  return {
    x: 0,
    y: 0,
    rotation: 0,
    pivot: { x: 0, y: 0 },
    children,
    addChild: vi.fn((child: unknown) => children.push(child)),
  };
}

type FakeContainer = ReturnType<typeof createFakeContainerInstance>;

// Mirrors Pixi's real Container transform (rotate around pivot, then translate to position).
// Production code only ever SETS pivot/position/rotation and lets real Pixi apply this at render
// time — this exists purely so tests can verify pivot invariance without a real Pixi renderer.
function toWorldPoint(container: FakeContainer, local: { x: number; y: number }) {
  const dx = local.x - container.pivot.x;
  const dy = local.y - container.pivot.y;
  const cos = Math.cos(container.rotation);
  const sin = Math.sin(container.rotation);
  return {
    x: container.x + dx * cos - dy * sin,
    y: container.y + dx * sin + dy * cos,
  };
}

const graphicsInstances: ReturnType<typeof createFakeGraphicsInstance>[] = [];

vi.mock('pixi.js', () => ({
  Graphics: vi.fn().mockImplementation(() => {
    const instance = createFakeGraphicsInstance();
    graphicsInstances.push(instance);
    return instance;
  }),
  Container: vi.fn().mockImplementation(() => createFakeContainerInstance()),
}));

// Spies on the REAL applyTowerEvent (via importOriginal — behavior is unchanged, only call
// order/count becomes observable), needed only by the P6 integration tests further down (the
// mandatory hold-for-collapse sequencing test and the real-fixture nearFall integration tests).
// Harmless for every other test in this file — spread `...actual` preserves real behavior.
vi.mock('../../tower/model', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../tower/model')>();
  return { ...actual, applyTowerEvent: vi.fn(actual.applyTowerEvent) };
});

const { createTowerRenderer, TowerRenderCancelledError } = await import('./createTowerRenderer');
const { createTowerEventHandlers } = await import('./createTowerEventHandlers');
const { applyTowerEvent, buildTowerModel, fingerprintTowerModel } = await import('../../tower/model');
const applyTowerEventSpy = vi.mocked(applyTowerEvent);

function createFakeApp(screenWidth = 390, screenHeight = 844) {
  const tickCallbacks: TickCallback[] = [];
  const stage = createFakeContainerInstance();
  const ticker = {
    add: vi.fn((cb: TickCallback) => tickCallbacks.push(cb)),
    remove: vi.fn((cb: TickCallback) => {
      const idx = tickCallbacks.indexOf(cb);
      if (idx !== -1) tickCallbacks.splice(idx, 1);
    }),
  };
  const app = { screen: { width: screenWidth, height: screenHeight }, stage, ticker };
  const tick = (deltaMS: number) => {
    for (const cb of [...tickCallbacks]) cb({ deltaMS });
  };
  return { app: app as unknown as Application, stage, ticker, tick };
}

function makeBlock(overrides: Partial<LogicalBlock> = {}): LogicalBlock {
  return {
    ordinal: 1,
    offsetU: 500,
    rotationMd: 200,
    behavior: 'clean',
    intensity: 0,
    direction: 1,
    ...overrides,
  };
}

// docs/work/TASK-P7-static-base.md: the static base is a Graphics created once at construction
// time, before any addBlock call -- without this wrapper, its instance would land at
// graphicsInstances[0], silently shifting every existing "the block's own graphics" assertion in
// this file by one. Splicing only the entries added during THIS construction call (rather than
// clearing the whole array) is required, not cosmetic: some tests construct two renderers
// back-to-back and compare their respective first block's graphics, and a blanket
// `graphicsInstances.length = 0` would also erase the first renderer's already-pushed graphics.
function createRendererUnderTest(app: Application, tuningOverrides?: Partial<TowerViewportTuning>): TowerRenderer {
  const before = graphicsInstances.length;
  const renderer = createTowerRenderer(app, tuningOverrides);
  graphicsInstances.splice(before, graphicsInstances.length - before); // drop only the base's own Graphics
  return renderer;
}

function wobbleRootOf(stage: FakeContainer): FakeContainer {
  const cameraContainer = stage.children[0] as FakeContainer;
  return cameraContainer.children[1] as FakeContainer; // [0] is the static base (docs/work/TASK-P7-static-base.md)
}

function baseOf(stage: FakeContainer): ReturnType<typeof createFakeGraphicsInstance> {
  const cameraContainer = stage.children[0] as FakeContainer;
  return cameraContainer.children[0] as ReturnType<typeof createFakeGraphicsInstance>;
}

const config = computeTowerViewportConfig(390, 844, DEFAULT_TOWER_VIEWPORT_TUNING);

describe('createTowerRenderer — addBlock', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('creates exactly one Graphics, adds it to wobbleRoot, and sets x/rotation immediately (before any tick)', () => {
    const { app, stage } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const block = makeBlock();
    const expected = computeBlockTransform(block, config);

    void renderer.addBlock(block);

    expect(graphicsInstances).toHaveLength(1);
    const graphics = graphicsInstances[0];
    expect(graphics.x).toBeCloseTo(expected.x);
    expect(graphics.rotation).toBeCloseTo(expected.rotation);
    expect(graphics.y).not.toBeCloseTo(expected.y); // starts above target — hasn't landed yet
    expect(wobbleRoot.addChild).toHaveBeenCalled();
  });

  it('resolves with the exact final y once elapsed time reaches the drop duration, and recomputes camera offset', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const cameraContainer = stage.children[0] as FakeContainer;
    const block = makeBlock(); // behavior: 'clean' -> single-phase drop only
    const expected = computeBlockTransform(block, config);

    const pending = renderer.addBlock(block);
    tick(config.dropDurationMs + 1);
    await pending;

    const graphics = graphicsInstances[0];
    expect(graphics.y).toBe(expected.y); // exact, not merely close — no drift
    expect(cameraContainer.y).toBe(0); // a single short block never crosses the safe band
  });

  it('computing the same block/config repeatedly always yields the same transform (determinism)', () => {
    const { app: appA } = createFakeApp();
    const { app: appB } = createFakeApp();
    const block = makeBlock({ offsetU: -1200, rotationMd: -900 });

    void createRendererUnderTest(appA).addBlock(block);
    void createRendererUnderTest(appB).addBlock(block);

    const [first, second] = graphicsInstances;
    expect(second.x).toBe(first.x);
    expect(second.rotation).toBe(first.rotation);
  });

  it('camera follow stays at zero for a short run and becomes positive once the safe band is crossed', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const cameraContainer = stage.children[0] as FakeContainer;

    for (let ordinal = 1; ordinal <= 16; ordinal += 1) {
      const pending = renderer.addBlock(makeBlock({ ordinal }));
      tick(config.dropDurationMs + 1);
      await pending;
    }
    expect(cameraContainer.y).toBe(0);

    const pending17 = renderer.addBlock(makeBlock({ ordinal: 17 }));
    tick(config.dropDurationMs + 1);
    await pending17;
    expect(cameraContainer.y).toBeGreaterThan(0);
  });
});

describe('createTowerRenderer — cancellation', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('rejects the pending addBlock promise with TowerRenderCancelledError when cancelled mid-drop, and removes the ticker callback', async () => {
    const { app, ticker, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);

    const pending = renderer.addBlock(makeBlock());
    tick(config.dropDurationMs / 2); // partway through, not complete
    expect(ticker.add).toHaveBeenCalledTimes(1);
    const registeredCallback = ticker.add.mock.calls[0]?.[0] as TickCallback;

    renderer.cancel();

    await expect(pending).rejects.toBeInstanceOf(TowerRenderCancelledError);
    expect(ticker.remove).toHaveBeenCalledWith(registeredCallback);
  });

  it('rejects immediately, without starting any animation, when addBlock is called after cancel()', async () => {
    const { app, ticker } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    renderer.cancel();

    await expect(renderer.addBlock(makeBlock())).rejects.toBeInstanceOf(TowerRenderCancelledError);
    expect(ticker.add).not.toHaveBeenCalled();
    expect(graphicsInstances).toHaveLength(0);
  });

  it('is idempotent — calling cancel() with nothing in flight does not throw, even called twice', () => {
    const { app } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    expect(() => renderer.cancel()).not.toThrow();
    expect(() => renderer.cancel()).not.toThrow();
  });
});

describe('createTowerRenderer — wobble pivot geometry', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('sets wobbleRoot pivot/position to the fixed tower-base support point', () => {
    const { app, stage } = createFakeApp();
    createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);

    const expectedPivot = computeTowerSupportPivot(config);
    expect(wobbleRoot.pivot).toEqual(expectedPivot);
    expect({ x: wobbleRoot.x, y: wobbleRoot.y }).toEqual(expectedPivot);
  });

  it('keeps the fixed tower-base support point visually invariant under root rotation, while a point above it moves', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const supportPoint = { x: wobbleRoot.pivot.x, y: wobbleRoot.pivot.y };
    const higherBlock = makeBlock({ ordinal: 5, offsetU: 300 });
    const higherBlockLocal = computeBlockTransform(higherBlock, config);

    const atRest = {
      support: toWorldPoint(wobbleRoot, supportPoint),
      higher: toWorldPoint(wobbleRoot, higherBlockLocal),
    };

    const pending = renderer.addBlock(makeBlock({ behavior: 'wobble', intensity: 4, direction: 1 }));
    tick(config.dropDurationMs + 100); // comfortably into the wobble phase
    expect(wobbleRoot.rotation).not.toBe(0);

    const whileRotated = {
      support: toWorldPoint(wobbleRoot, supportPoint),
      higher: toWorldPoint(wobbleRoot, higherBlockLocal),
    };

    expect(whileRotated.support.x).toBeCloseTo(atRest.support.x);
    expect(whileRotated.support.y).toBeCloseTo(atRest.support.y);
    expect(
      Math.abs(whileRotated.higher.x - atRest.higher.x) + Math.abs(whileRotated.higher.y - atRest.higher.y),
    ).toBeGreaterThan(0.01);

    tick(2000); // drive to completion so no dangling promise is left behind
    await pending;
  });
});

describe('createTowerRenderer — zero-effect wobble fallback', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('wobble with intensity 0 resolves after drop alone, with root rotation exactly 0 and no second ticker phase', async () => {
    const { app, stage, ticker, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);

    const pending = renderer.addBlock(makeBlock({ behavior: 'wobble', intensity: 0, direction: 1 }));
    tick(config.dropDurationMs + 1);
    await pending;

    expect(wobbleRoot.rotation).toBe(0);
    expect(ticker.add).toHaveBeenCalledTimes(1);
  });

  it('wobble with direction 0 resolves after drop alone, with root rotation exactly 0 and no second ticker phase', async () => {
    const { app, stage, ticker, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);

    const pending = renderer.addBlock(makeBlock({ behavior: 'wobble', intensity: 3, direction: 0 }));
    tick(config.dropDurationMs + 1);
    await pending;

    expect(wobbleRoot.rotation).toBe(0);
    expect(ticker.add).toHaveBeenCalledTimes(1);
  });
});

describe('createTowerRenderer — effective wobble', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('runs a second phase after drop, rotation nonzero mid-phase and exactly 0 at full completion; the promise does not resolve at drop-completion alone', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const preset = WOBBLE_PRESETS_V1_BY_INTENSITY[3];

    let resolved = false;
    const pending = renderer.addBlock(makeBlock({ behavior: 'wobble', intensity: 3, direction: 1 }));
    pending.then(() => {
      resolved = true;
    });

    tick(config.dropDurationMs + 1);
    await Promise.resolve();
    expect(resolved).toBe(false); // drop alone must not resolve a wobble block's promise

    tick(preset.durationMs / 2);
    expect(wobbleRoot.rotation).not.toBe(0);
    expect(resolved).toBe(false);

    tick(preset.durationMs); // comfortably finish the wobble phase
    await pending;
    expect(resolved).toBe(true);
    expect(wobbleRoot.rotation).toBe(0);
  });

  it('clean/offset blocks resolve right after drop, with no second phase', async () => {
    const { app, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);

    const pending = renderer.addBlock(makeBlock({ behavior: 'clean' }));
    tick(config.dropDurationMs + 1);
    await expect(pending).resolves.toBeUndefined();
  });

  it('leaves authored graphics x/rotation unchanged after a wobble fully completes', async () => {
    const { app, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const block = makeBlock({ behavior: 'wobble', intensity: 4, direction: -1, offsetU: 700, rotationMd: 300 });
    const expected = computeBlockTransform(block, config);
    const preset = WOBBLE_PRESETS_V1_BY_INTENSITY[4];

    const pending = renderer.addBlock(block);
    tick(config.dropDurationMs + preset.durationMs + 1);
    await pending;

    const graphics = graphicsInstances[0];
    expect(graphics.x).toBe(expected.x);
    expect(graphics.rotation).toBe(expected.rotation);
  });

  it('camera offset is unaffected by an in-progress or completed wobble, and is already applied once drop alone completes', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const cameraContainer = stage.children[0] as FakeContainer;

    for (let ordinal = 1; ordinal <= 16; ordinal += 1) {
      const pending = renderer.addBlock(makeBlock({ ordinal }));
      tick(config.dropDurationMs + 1);
      await pending;
    }

    const preset = WOBBLE_PRESETS_V1_BY_INTENSITY[2];
    const pending17 = renderer.addBlock(makeBlock({ ordinal: 17, behavior: 'wobble', intensity: 2, direction: 1 }));
    tick(config.dropDurationMs + 1); // drop alone completes; wobble phase begins
    const cameraAfterDrop = cameraContainer.y;
    expect(cameraAfterDrop).toBeGreaterThan(0);

    tick(preset.durationMs / 2); // mid-wobble
    expect(cameraContainer.y).toBe(cameraAfterDrop);

    tick(preset.durationMs); // finish
    await pending17;
    expect(cameraContainer.y).toBe(cameraAfterDrop);
  });

  it('cancellation during the wobble sub-phase rejects, removes the one active ticker callback, and resets rotation to exactly 0', async () => {
    const { app, stage, ticker, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);

    const pending = renderer.addBlock(makeBlock({ behavior: 'wobble', intensity: 3, direction: 1 }));
    tick(config.dropDurationMs + 50); // now inside the wobble sub-phase
    expect(wobbleRoot.rotation).not.toBe(0);
    expect(ticker.add).toHaveBeenCalledTimes(1);
    const registeredCallback = ticker.add.mock.calls[0]?.[0] as TickCallback;

    renderer.cancel();

    await expect(pending).rejects.toBeInstanceOf(TowerRenderCancelledError);
    expect(ticker.remove).toHaveBeenCalledWith(registeredCallback);
    expect(wobbleRoot.rotation).toBe(0);
  });
});

describe('createTowerRenderer — timing independence', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('reaches the same wobbleRoot.rotation at a common checkpoint entirely inside the wobble phase, regardless of tick granularity', () => {
    const { app: appA, stage: stageA, tick: tickA } = createFakeApp();
    const { app: appB, stage: stageB, tick: tickB } = createFakeApp();
    const rendererA = createRendererUnderTest(appA);
    const rendererB = createRendererUnderTest(appB);
    const block = makeBlock({ behavior: 'wobble', intensity: 3, direction: 1 });
    const wobbleRootA = wobbleRootOf(stageA);
    const wobbleRootB = wobbleRootOf(stageB);

    void rendererA.addBlock(block);
    void rendererB.addBlock(block);

    const checkpointMs = config.dropDurationMs + 200; // entirely inside the wobble phase

    tickA(checkpointMs); // one large tick
    let remaining = checkpointMs;
    while (remaining > 0) {
      const step = Math.min(17, remaining); // deliberately does not evenly divide checkpointMs
      tickB(step);
      remaining -= step;
    }

    expect(wobbleRootB.rotation).toBeCloseTo(wobbleRootA.rotation);
  });

  it('conserves elapsed time exactly across the drop->wobble phase boundary, independent of tick granularity', async () => {
    const { app: appA, stage: stageA, tick: tickA } = createFakeApp();
    const { app: appB, stage: stageB, tick: tickB } = createFakeApp();
    const rendererA = createRendererUnderTest(appA);
    const rendererB = createRendererUnderTest(appB);
    const block = makeBlock({ behavior: 'wobble', intensity: 3, direction: 1 });
    const preset = WOBBLE_PRESETS_V1_BY_INTENSITY[3];
    const wobbleRootA = wobbleRootOf(stageA);
    const wobbleRootB = wobbleRootOf(stageB);

    let resolvedA = false;
    let resolvedB = false;
    const pendingA = rendererA.addBlock(block);
    const pendingB = rendererB.addBlock(block);
    pendingA.then(() => {
      resolvedA = true;
    });
    pendingB.then(() => {
      resolvedB = true;
    });

    // Genuinely crosses dropDurationMs (450) into the wobble phase.
    const checkpointMs = config.dropDurationMs + 120;

    tickA(checkpointMs); // one large tick spanning the drop/wobble boundary
    let remaining = checkpointMs;
    while (remaining > 0) {
      const step = Math.min(13, remaining); // deliberately does not evenly divide checkpointMs
      tickB(step);
      remaining -= step;
    }
    await Promise.resolve();

    const graphicsA = graphicsInstances[0];
    const graphicsB = graphicsInstances[1];
    expect(graphicsB.y).toBeCloseTo(graphicsA.y);
    expect(wobbleRootB.rotation).toBeCloseTo(wobbleRootA.rotation);
    expect(resolvedA).toBe(false);
    expect(resolvedB).toBe(false);

    // Drive both to completion and verify identical exact final state.
    const remainingMs = config.dropDurationMs + preset.durationMs - checkpointMs + 1;
    tickA(remainingMs);
    tickB(remainingMs);
    await pendingA;
    await pendingB;

    expect(graphicsB.y).toBe(graphicsA.y);
    expect(wobbleRootA.rotation).toBe(0);
    expect(wobbleRootB.rotation).toBe(0);
  });
});

describe('createTowerRenderer — full fixture integration (wobbleWin5x)', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('plays the real wobbleWin5x fixture through createTowerEventHandlers end-to-end without throwing', async () => {
    const { app, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const handlers = createTowerEventHandlers(renderer);

    let settled = false;
    const playing = playBookEvents(wobbleWin5x, handlers);
    playing.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    const chunkMs = 50;
    const maxIterations = 2000; // generous safety cap, not a tight bound
    let iterations = 0;
    while (!settled && iterations < maxIterations) {
      tick(chunkMs);
      await Promise.resolve();
      await Promise.resolve();
      iterations += 1;
    }

    expect(settled).toBe(true);
    await expect(playing).resolves.toBeUndefined();
  });
});

// ==========================================================================================
// P6 — Near-Fall (docs/work/TASK-P6-near-fall.md)
// ==========================================================================================

describe('createTowerRenderer — zero-effect nearFall fallback', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('nearFall with intensity 0 resolves after drop alone, with root rotation exactly 0 and no second ticker phase', async () => {
    const { app, stage, ticker, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);

    const pending = renderer.addBlock(makeBlock({ behavior: 'nearFall', intensity: 0, direction: 1 }), 'recover');
    tick(config.dropDurationMs + 1);
    await pending;

    expect(wobbleRoot.rotation).toBe(0);
    expect(ticker.add).toHaveBeenCalledTimes(1);
  });

  it('nearFall with direction 0 resolves after drop alone, with root rotation exactly 0 and no second ticker phase, even when classified holdForCollapse', async () => {
    const { app, stage, ticker, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);

    const pending = renderer.addBlock(
      makeBlock({ behavior: 'nearFall', intensity: 3, direction: 0 }),
      'holdForCollapse',
    );
    tick(config.dropDurationMs + 1);
    await pending;

    expect(wobbleRoot.rotation).toBe(0);
    expect(ticker.add).toHaveBeenCalledTimes(1);
  });
});

describe('createTowerRenderer — effective nearFall', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('recover: does not resolve before the full recovery tail completes, and ends at exact rotation 0', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];

    let resolved = false;
    const pending = renderer.addBlock(makeBlock({ behavior: 'nearFall', intensity: 4, direction: 1 }), 'recover');
    pending.then(() => {
      resolved = true;
    });

    tick(config.dropDurationMs + NEAR_FALL_HOLD_FREEZE_T_V1 * preset.durationMs); // through the plateau
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(wobbleRoot.rotation).not.toBe(0);

    tick(preset.durationMs); // finish comfortably
    await pending;
    expect(resolved).toBe(true);
    expect(wobbleRoot.rotation).toBe(0);
  });

  it('holdForCollapse: resolves at exactly the freeze pose and registers no further ticker work', async () => {
    const { app, stage, ticker, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];

    const pending = renderer.addBlock(
      makeBlock({ behavior: 'nearFall', intensity: 4, direction: 1 }),
      'holdForCollapse',
    );
    tick(config.dropDurationMs + NEAR_FALL_HOLD_FREEZE_T_V1 * preset.durationMs + 1);
    await pending;

    const expectedFreezeMd = computeNearFallLeanMd(NEAR_FALL_HOLD_FREEZE_T_V1, preset, 1);
    expect(wobbleRoot.rotation).toBeCloseTo(rotationMdToRadians(expectedFreezeMd));
    expect(ticker.add).toHaveBeenCalledTimes(1);
    expect(ticker.remove).toHaveBeenCalledTimes(1);

    const rotationAfterResolve = wobbleRoot.rotation;
    tick(10000); // further ticks must have no effect -- no active callback remains
    expect(wobbleRoot.rotation).toBe(rotationAfterResolve);
  });

  it('an effective nearFall with nearFallResolution omitted defaults to recover, never holds', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];

    const pending = renderer.addBlock(makeBlock({ behavior: 'nearFall', intensity: 4, direction: 1 })); // no 2nd arg
    tick(config.dropDurationMs + preset.durationMs + 1); // full recover duration
    await pending;

    expect(wobbleRoot.rotation).toBe(0); // recovered fully, not frozen at the hold pose
  });

  it('a clean block resolves right after drop even when a nearFallResolution is (meaninglessly) passed', async () => {
    const { app, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const pending = renderer.addBlock(makeBlock({ behavior: 'clean' }), 'holdForCollapse');
    tick(config.dropDurationMs + 1);
    await expect(pending).resolves.toBeUndefined();
  });

  it('leaves authored graphics x/rotation unchanged after a recover completes', async () => {
    const { app, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const block = makeBlock({ behavior: 'nearFall', intensity: 3, direction: -1, offsetU: -900, rotationMd: -400 });
    const expected = computeBlockTransform(block, config);
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[3];

    const pending = renderer.addBlock(block, 'recover');
    tick(config.dropDurationMs + preset.durationMs + 1);
    await pending;

    const graphics = graphicsInstances[0];
    expect(graphics.x).toBe(expected.x);
    expect(graphics.rotation).toBe(expected.rotation);
  });

  it('leaves authored graphics x/rotation unchanged after a hold resolves', async () => {
    const { app, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const block = makeBlock({ behavior: 'nearFall', intensity: 4, direction: 1, offsetU: 1200, rotationMd: 900 });
    const expected = computeBlockTransform(block, config);
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];

    const pending = renderer.addBlock(block, 'holdForCollapse');
    tick(config.dropDurationMs + NEAR_FALL_HOLD_FREEZE_T_V1 * preset.durationMs + 1);
    await pending;

    const graphics = graphicsInstances[0];
    expect(graphics.x).toBe(expected.x);
    expect(graphics.rotation).toBe(expected.rotation);
  });

  it('camera offset is unaffected by an in-progress or held nearFall, and is already applied once drop alone completes', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const cameraContainer = stage.children[0] as FakeContainer;

    for (let ordinal = 1; ordinal <= 16; ordinal += 1) {
      const pending = renderer.addBlock(makeBlock({ ordinal }));
      tick(config.dropDurationMs + 1);
      await pending;
    }

    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];
    const pending17 = renderer.addBlock(
      makeBlock({ ordinal: 17, behavior: 'nearFall', intensity: 4, direction: 1 }),
      'holdForCollapse',
    );
    tick(config.dropDurationMs + 1); // drop alone completes
    const cameraAfterDrop = cameraContainer.y;
    expect(cameraAfterDrop).toBeGreaterThan(0);

    tick(NEAR_FALL_HOLD_FREEZE_T_V1 * preset.durationMs + 1); // finish the hold
    await pending17;
    expect(cameraContainer.y).toBe(cameraAfterDrop);
  });
});

describe('createTowerRenderer — nearFall pivot geometry', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('keeps the fixed tower-base support point invariant under an active/held nearFall rotation, while a point above it moves', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const supportPoint = { x: wobbleRoot.pivot.x, y: wobbleRoot.pivot.y };
    const higherBlock = makeBlock({ ordinal: 5, offsetU: 300 });
    const higherBlockLocal = computeBlockTransform(higherBlock, config);

    const atRest = {
      support: toWorldPoint(wobbleRoot, supportPoint),
      higher: toWorldPoint(wobbleRoot, higherBlockLocal),
    };

    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];
    const pending = renderer.addBlock(
      makeBlock({ behavior: 'nearFall', intensity: 4, direction: 1 }),
      'holdForCollapse',
    );
    tick(config.dropDurationMs + NEAR_FALL_HOLD_FREEZE_T_V1 * preset.durationMs + 1);
    await pending;
    expect(wobbleRoot.rotation).not.toBe(0);

    const whileHeld = {
      support: toWorldPoint(wobbleRoot, supportPoint),
      higher: toWorldPoint(wobbleRoot, higherBlockLocal),
    };

    expect(whileHeld.support.x).toBeCloseTo(atRest.support.x);
    expect(whileHeld.support.y).toBeCloseTo(atRest.support.y);
    expect(
      Math.abs(whileHeld.higher.x - atRest.higher.x) + Math.abs(whileHeld.higher.y - atRest.higher.y),
    ).toBeGreaterThan(0.01);
  });
});

describe('createTowerRenderer — nearFall cancellation', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('(A) cancel during nearFall approach rejects and resets rotation to 0', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);

    const pending = renderer.addBlock(makeBlock({ behavior: 'nearFall', intensity: 4, direction: 1 }), 'recover');
    tick(config.dropDurationMs + 50); // into the approach phase
    expect(wobbleRoot.rotation).not.toBe(0);

    renderer.cancel();

    await expect(pending).rejects.toBeInstanceOf(TowerRenderCancelledError);
    expect(wobbleRoot.rotation).toBe(0);
  });

  it('(B) cancel during the recovery tail rejects and resets rotation to 0', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];

    const pending = renderer.addBlock(makeBlock({ behavior: 'nearFall', intensity: 4, direction: 1 }), 'recover');
    tick(config.dropDurationMs + preset.durationMs * 0.85); // past the plateau, into counter-swing/overshoot
    expect(wobbleRoot.rotation).not.toBe(0);

    renderer.cancel();

    await expect(pending).rejects.toBeInstanceOf(TowerRenderCancelledError);
    expect(wobbleRoot.rotation).toBe(0);
  });

  it('(C) cancel during the hold window itself rejects and resets rotation to 0', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];

    const pending = renderer.addBlock(
      makeBlock({ behavior: 'nearFall', intensity: 4, direction: 1 }),
      'holdForCollapse',
    );
    tick(config.dropDurationMs + (NEAR_FALL_HOLD_FREEZE_T_V1 * preset.durationMs) / 2); // mid-hold-window
    expect(wobbleRoot.rotation).not.toBe(0);

    renderer.cancel();

    await expect(pending).rejects.toBeInstanceOf(TowerRenderCancelledError);
    expect(wobbleRoot.rotation).toBe(0);
  });

  it('(E) cancel after a holdForCollapse has already resolved still restores rotation to exactly 0', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];

    const pending = renderer.addBlock(
      makeBlock({ behavior: 'nearFall', intensity: 4, direction: 1 }),
      'holdForCollapse',
    );
    tick(config.dropDurationMs + NEAR_FALL_HOLD_FREEZE_T_V1 * preset.durationMs + 1);
    await pending;
    expect(wobbleRoot.rotation).not.toBe(0); // held, deliberately nonzero

    renderer.cancel(); // called AFTER resolution -- activeCancel is already undefined

    expect(wobbleRoot.rotation).toBe(0); // unconditional defensive reset still fires
  });
});

describe('createTowerRenderer — nearFall timing independence', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('conserves elapsed time across the drop->approach boundary, independent of tick granularity', async () => {
    const { app: appA, stage: stageA, tick: tickA } = createFakeApp();
    const { app: appB, stage: stageB, tick: tickB } = createFakeApp();
    const rendererA = createRendererUnderTest(appA);
    const rendererB = createRendererUnderTest(appB);
    const block = makeBlock({ behavior: 'nearFall', intensity: 4, direction: 1 });
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];
    const wobbleRootA = wobbleRootOf(stageA);
    const wobbleRootB = wobbleRootOf(stageB);

    const pendingA = rendererA.addBlock(block, 'recover');
    const pendingB = rendererB.addBlock(block, 'recover');

    const checkpointMs = config.dropDurationMs + 120; // genuinely crosses the drop boundary
    tickA(checkpointMs);
    let remaining = checkpointMs;
    while (remaining > 0) {
      const step = Math.min(13, remaining); // deliberately does not evenly divide checkpointMs
      tickB(step);
      remaining -= step;
    }
    expect(wobbleRootB.rotation).toBeCloseTo(wobbleRootA.rotation);

    const remainingMs = config.dropDurationMs + preset.durationMs - checkpointMs + 1;
    tickA(remainingMs);
    tickB(remainingMs);
    await pendingA;
    await pendingB;
    expect(wobbleRootA.rotation).toBe(0);
    expect(wobbleRootB.rotation).toBe(0);
  });

  it('conserves elapsed time across the plateau->recovery boundary on the recover path, independent of tick granularity', async () => {
    const { app: appA, stage: stageA, tick: tickA } = createFakeApp();
    const { app: appB, stage: stageB, tick: tickB } = createFakeApp();
    const rendererA = createRendererUnderTest(appA);
    const rendererB = createRendererUnderTest(appB);
    const block = makeBlock({ behavior: 'nearFall', intensity: 4, direction: 1 });
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];
    const wobbleRootA = wobbleRootOf(stageA);
    const wobbleRootB = wobbleRootOf(stageB);

    const pendingA = rendererA.addBlock(block, 'recover');
    const pendingB = rendererB.addBlock(block, 'recover');

    // Genuinely crosses the plateau-end boundary (NEAR_FALL_HOLD_FREEZE_T_V1) into the
    // counter-swing/overshoot/settle tail.
    const checkpointMs = config.dropDurationMs + NEAR_FALL_HOLD_FREEZE_T_V1 * preset.durationMs + 40;

    tickA(checkpointMs);
    let remaining = checkpointMs;
    while (remaining > 0) {
      const step = Math.min(11, remaining);
      tickB(step);
      remaining -= step;
    }
    expect(wobbleRootB.rotation).toBeCloseTo(wobbleRootA.rotation);

    const remainingMs = config.dropDurationMs + preset.durationMs - checkpointMs + 1;
    tickA(remainingMs);
    tickB(remainingMs);
    await pendingA;
    await pendingB;
    expect(wobbleRootA.rotation).toBe(0);
    expect(wobbleRootB.rotation).toBe(0);
  });
});

describe('createTowerRenderer — nearFall exceeds wobble (renderer-level, maximum vs maximum)', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('a real ticked nearFall intensity 3/4 reaches a peak rotation magnitude exceeding a real ticked wobble intensity 4', async () => {
    async function peakRotationMagnitude(behavior: 'wobble' | 'nearFall', intensity: 2 | 3 | 4): Promise<number> {
      const { app, stage, tick } = createFakeApp();
      const renderer = createRendererUnderTest(app);
      const wobbleRoot = wobbleRootOf(stage);
      const durationMs =
        behavior === 'wobble'
          ? WOBBLE_PRESETS_V1_BY_INTENSITY[intensity].durationMs
          : NEAR_FALL_PRESETS_V1_BY_INTENSITY[intensity].durationMs;
      const pending = renderer.addBlock(makeBlock({ behavior, intensity, direction: 1 }), 'recover');
      let peak = 0;
      const steps = 40;
      const stepMs = (config.dropDurationMs + durationMs) / steps;
      for (let i = 1; i <= steps; i += 1) {
        tick(stepMs);
        peak = Math.max(peak, Math.abs(wobbleRoot.rotation));
      }
      await pending;
      return peak;
    }

    const wobbleMaxPeak = await peakRotationMagnitude('wobble', 4);
    const nearFall3Peak = await peakRotationMagnitude('nearFall', 3);
    const nearFall4Peak = await peakRotationMagnitude('nearFall', 4);

    expect(nearFall3Peak).toBeGreaterThan(wobbleMaxPeak);
    expect(nearFall4Peak).toBeGreaterThan(wobbleMaxPeak);
  });
});

describe('createTowerRenderer — mandatory hold-for-collapse full sequencing (synthetic Book)', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
    applyTowerEventSpy.mockClear();
  });

  it('proves the complete P2 -> handler -> renderer wiring for a nearFall that holds for an immediately-following collapse', async () => {
    const book = new BookBuilder()
      .towerStart('cruelCollapse', 'quick', 42)
      .block({ behavior: 'clean' })
      .block({ behavior: 'clean' })
      .block({ behavior: 'nearFall', offsetU: 1500, rotationMd: 1600, direction: 1, intensity: 4 })
      .collapse('leanRight', 4)
      .setTotalWin(0)
      .finalWin(0)
      .build(9001, 0, 'synthetic-nearfall-hold-collapse');
    const before = JSON.stringify(book);

    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const handlers = createTowerEventHandlers(renderer);

    const playing = playBookEvents(book, handlers);

    // Drive with small ticks + microtask flushes until exactly the nearFall block's own
    // applyTowerEvent call has happened (towerStart, block, block, block[nearFall] = 4 calls) --
    // at that instant its addBlock/ticker has just been registered but not yet ticked, giving a
    // clean, precisely-known starting point (elapsedMs=0) for the nearFall's own operation.
    while (applyTowerEventSpy.mock.calls.length < 4) {
      tick(20);
      await Promise.resolve();
      await Promise.resolve();
    }

    // (1) nearFall's own applyTowerEvent occurred exactly once by this point.
    expect(applyTowerEventSpy.mock.calls.length).toBe(4);

    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];
    const holdPhaseMs = NEAR_FALL_HOLD_FREEZE_T_V1 * preset.durationMs;
    // Total elapsed time since the nearFall's own ticker registration until hold completion --
    // includes the initial drop, which the hold-phase-duration alone does NOT.
    const holdTotalMs = config.dropDurationMs + holdPhaseMs;
    const midCheckpointMs = config.dropDurationMs + holdPhaseMs / 2;

    // (2) Partway through the hold window: still pending, collapse not yet applied/dispatched.
    tick(midCheckpointMs);
    await Promise.resolve();
    await Promise.resolve();
    expect(applyTowerEventSpy.mock.calls.map((call) => call[1].type)).toEqual([
      'towerStart',
      'block',
      'block',
      'block',
    ]);
    expect(wobbleRoot.rotation).not.toBe(0);

    // (3) Complete the hold exactly.
    tick(holdTotalMs - midCheckpointMs + 5);
    await Promise.resolve();
    await Promise.resolve();
    const expectedFreezeMd = computeNearFallLeanMd(NEAR_FALL_HOLD_FREEZE_T_V1, preset, 1);
    const heldRotation = wobbleRoot.rotation;
    expect(heldRotation).toBeCloseTo(rotationMdToRadians(expectedFreezeMd));

    // (4)/(5) Only now does P2 advance and collapse's own applyTowerEvent get applied -- never
    // early. A generous, bounded microtask drain (not a fixed guess at the exact hop count) lets
    // the nearFall addBlock's resolution propagate through the handler/P2 chain until the
    // collapse handler starts.
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    expect(applyTowerEventSpy.mock.calls.map((call) => call[1].type)).toEqual([
      'towerStart',
      'block',
      'block',
      'block',
      'collapse',
    ]);

    // P7 (docs/work/TASK-P7-collapse.md): at the exact instant collapse's own ticker has just
    // registered but has not yet ticked, rotation is STILL the exact P6 held pose -- no
    // reset-to-zero frame in the handoff.
    expect(wobbleRoot.rotation).toBe(heldRotation);

    // Drive collapse's own single-phase animation (this Book's profile/intensity is
    // 'leanRight'/4, matching-sign with the nearFall's own direction 1) to completion, then let
    // the remaining economic events (setTotalWin/finalWin) dispatch.
    const collapsePreset = COLLAPSE_PRESETS_V1_BY_INTENSITY[4];
    tick(collapsePreset.durationMs + 5);
    await playing;

    const finalTypes = applyTowerEventSpy.mock.calls.map((call) => call[1].type);
    expect(finalTypes).toEqual(['towerStart', 'block', 'block', 'block', 'collapse', 'setTotalWin', 'finalWin']);
    expect(applyTowerEventSpy).toHaveBeenCalledTimes(book.events.length);

    // (6) Collapse has now consumed the held pose and animated to its OWN authoritative terminal
    // pose (leanRight/intensity 4) -- not the nearFall's stale freeze value, and not a reset to 0.
    const expectedTargetRad = rotationMdToRadians(computeCollapseTargetLeanMd('leanRight', collapsePreset));
    expect(wobbleRoot.rotation).toBe(expectedTargetRad);

    // (7) Logical fingerprint parity against an independently-computed buildTowerModel.
    const liveModel = applyTowerEventSpy.mock.results.at(-1)?.value as TowerModel;
    expect(fingerprintTowerModel(liveModel)).toBe(fingerprintTowerModel(buildTowerModel(book)));

    // (8) Book/events byte-identical before vs. after the full run.
    expect(JSON.stringify(book)).toBe(before);
  });
});

describe('createTowerRenderer — real fixture integration (nearFall recover paths)', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
    applyTowerEventSpy.mockClear();
  });

  async function driveToSettled(playing: Promise<void>, tick: (deltaMS: number) => void): Promise<void> {
    let settled = false;
    playing.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    let iterations = 0;
    while (!settled && iterations < 2000) {
      tick(50);
      await Promise.resolve();
      await Promise.resolve();
      iterations += 1;
    }
  }

  it('nearDeathWin20x: nearFall classifies as recover, fully recovers, and construction continues to survive', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const handlers = createTowerEventHandlers(renderer);

    const playing = playBookEvents(nearDeathWin20x, handlers);
    await driveToSettled(playing, tick);

    await expect(playing).resolves.toBeUndefined();
    expect(wobbleRoot.rotation).toBe(0); // fully recovered and settled by the end
    expect(applyTowerEventSpy).toHaveBeenCalledTimes(nearDeathWin20x.events.length);

    const liveModel = applyTowerEventSpy.mock.results.at(-1)?.value as TowerModel;
    expect(fingerprintTowerModel(liveModel)).toBe(fingerprintTowerModel(buildTowerModel(nearDeathWin20x)));
  });

  it('cruelCollapseSky0x: nearFall classifies as recover (a block follows immediately, proven separately in createTowerEventHandlers.test.ts), and the eventual real collapse reaches its exact profile/intensity terminal pose, unaffected by the earlier already-resolved nearFall/wobble danger beats (P7)', async () => {
    const before = JSON.stringify(cruelCollapseSky0x);
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const handlers = createTowerEventHandlers(renderer);

    const playing = playBookEvents(cruelCollapseSky0x, handlers);
    await driveToSettled(playing, tick);

    await expect(playing).resolves.toBeUndefined();
    // cruelCollapseSky0x collapses leanLeft/intensity 4 (docs/work/TASK-P7-collapse.md fixture
    // audit) -- the final rotation is the collapse's own terminal pose, not 0. (Before P7 existed,
    // collapse was a no-op and this fixture's final rotation happened to be 0 because nearFall had
    // already recovered by then; that was never proof collapse itself does nothing -- see the
    // dedicated P7 collapse fixture-integration tests below for the direct collapse-only proof.)
    const collapsePreset = COLLAPSE_PRESETS_V1_BY_INTENSITY[4];
    const expectedTargetRad = rotationMdToRadians(computeCollapseTargetLeanMd('leanLeft', collapsePreset));
    expect(wobbleRoot.rotation).toBe(expectedTargetRad);
    expect(applyTowerEventSpy).toHaveBeenCalledTimes(cruelCollapseSky0x.events.length);
    expect(JSON.stringify(cruelCollapseSky0x)).toBe(before);

    const liveModel = applyTowerEventSpy.mock.results.at(-1)?.value as TowerModel;
    expect(fingerprintTowerModel(liveModel)).toBe(fingerprintTowerModel(buildTowerModel(cruelCollapseSky0x)));
  });
});

// ==========================================================================================
// P7 — Collapse (docs/work/TASK-P7-collapse.md)
// ==========================================================================================

describe('createTowerRenderer — collapse', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('direct collapse: starts from exact root rotation 0, and does not mutate it before any tick', () => {
    const { app, stage } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    expect(wobbleRoot.rotation).toBe(0);

    void renderer.collapse('leanRight', 3);

    expect(wobbleRoot.rotation).toBe(0); // unchanged immediately at registration, before any tick
  });

  it('reaches the exact profile/intensity-derived terminal rotation for every profile/intensity combination', async () => {
    for (const profile of ['leanLeft', 'leanRight'] as const) {
      for (const intensity of [1, 2, 3, 4] as const) {
        const { app, stage, tick } = createFakeApp();
        const renderer = createRendererUnderTest(app);
        const wobbleRoot = wobbleRootOf(stage);
        const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[intensity];

        const pending = renderer.collapse(profile, intensity);
        tick(preset.durationMs + 1);
        await pending;

        const expectedTargetRad = rotationMdToRadians(computeCollapseTargetLeanMd(profile, preset));
        expect(wobbleRoot.rotation).toBe(expectedTargetRad);
      }
    }
  });

  it('profile alone determines the final macro side -- leanLeft and leanRight settle on opposite signs for the same intensity', async () => {
    const { app: appL, tick: tickL } = createFakeApp();
    const { app: appR, tick: tickR } = createFakeApp();
    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[4];

    const pendingL = createRendererUnderTest(appL).collapse('leanLeft', 4);
    tickL(preset.durationMs + 1);
    const pendingR = createRendererUnderTest(appR).collapse('leanRight', 4);
    tickR(preset.durationMs + 1);
    await Promise.all([pendingL, pendingR]);

    const targetLeft = rotationMdToRadians(computeCollapseTargetLeanMd('leanLeft', preset));
    const targetRight = rotationMdToRadians(computeCollapseTargetLeanMd('leanRight', preset));
    expect(targetLeft).toBeLessThan(0);
    expect(targetRight).toBeGreaterThan(0);
    expect(targetLeft).toBeCloseTo(-targetRight);
  });

  it('intensity changes the terminal magnitude while profile stays fixed', async () => {
    const magnitudes: number[] = [];
    for (const intensity of [1, 2, 3, 4] as const) {
      const { app, tick } = createFakeApp();
      const renderer = createRendererUnderTest(app);
      const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[intensity];
      const pending = renderer.collapse('leanRight', intensity);
      tick(preset.durationMs + 1);
      await pending;
      magnitudes.push(Math.abs(rotationMdToRadians(computeCollapseTargetLeanMd('leanRight', preset))));
    }
    for (let i = 1; i < magnitudes.length; i += 1) {
      expect(magnitudes[i]).toBeGreaterThan(magnitudes[i - 1]);
    }
  });

  it('exhibits the approved overshoot: rotation magnitude briefly exceeds the terminal target before settling back to it exactly', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[4];

    const pending = renderer.collapse('leanRight', 4);
    tick(preset.durationMs * 0.8); // the overshoot keyframe (t=0.8 -> fraction 1.08)
    const targetRad = rotationMdToRadians(computeCollapseTargetLeanMd('leanRight', preset));
    expect(Math.abs(wobbleRoot.rotation)).toBeGreaterThan(Math.abs(targetRad));

    tick(preset.durationMs * 0.2 + 5);
    await pending;
    expect(wobbleRoot.rotation).toBe(targetRad); // settles back to exactly the target, no drift
  });

  it('does not resolve before the full duration completes', async () => {
    const { app, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[4];
    let resolved = false;
    const pending = renderer.collapse('leanRight', 4);
    pending.then(() => {
      resolved = true;
    });

    tick(preset.durationMs * 0.5);
    await Promise.resolve();
    expect(resolved).toBe(false);

    tick(preset.durationMs);
    await pending;
    expect(resolved).toBe(true);
  });

  it('removes the ticker after resolution and the terminal pose survives further ticks unchanged', async () => {
    const { app, stage, ticker, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[3];

    const pending = renderer.collapse('leanLeft', 3);
    tick(preset.durationMs + 1);
    await pending;

    expect(ticker.add).toHaveBeenCalledTimes(1);
    expect(ticker.remove).toHaveBeenCalledTimes(1);
    const rotationAfterResolve = wobbleRoot.rotation;
    tick(10000); // no active callback remains -- must have no effect
    expect(wobbleRoot.rotation).toBe(rotationAfterResolve);
  });

  it('reaches the same rotation at a common checkpoint regardless of tick granularity', () => {
    const { app: appA, stage: stageA, tick: tickA } = createFakeApp();
    const { app: appB, stage: stageB, tick: tickB } = createFakeApp();
    const rendererA = createRendererUnderTest(appA);
    const rendererB = createRendererUnderTest(appB);
    const wobbleRootA = wobbleRootOf(stageA);
    const wobbleRootB = wobbleRootOf(stageB);
    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[3];

    void rendererA.collapse('leanLeft', 3);
    void rendererB.collapse('leanLeft', 3);

    const checkpointMs = preset.durationMs * 0.6;
    tickA(checkpointMs);
    let remaining = checkpointMs;
    while (remaining > 0) {
      const step = Math.min(17, remaining); // deliberately does not evenly divide checkpointMs
      tickB(step);
      remaining -= step;
    }

    expect(wobbleRootB.rotation).toBeCloseTo(wobbleRootA.rotation);
  });

  it('does not affect camera offset or any committed block transform', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const cameraContainer = stage.children[0] as FakeContainer;

    for (let ordinal = 1; ordinal <= 17; ordinal += 1) {
      const pending = renderer.addBlock(makeBlock({ ordinal }));
      tick(config.dropDurationMs + 1);
      await pending;
    }
    const cameraBefore = cameraContainer.y;
    const graphicsBefore = graphicsInstances.map((g) => ({ x: g.x, y: g.y, rotation: g.rotation }));

    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[4];
    const pending = renderer.collapse('leanRight', 4);
    tick(preset.durationMs + 1);
    await pending;

    expect(cameraContainer.y).toBe(cameraBefore);
    const graphicsAfter = graphicsInstances.map((g) => ({ x: g.x, y: g.y, rotation: g.rotation }));
    expect(graphicsAfter).toEqual(graphicsBefore);
  });
});

async function driveNearFallToHeldPose(
  renderer: ReturnType<typeof createTowerRenderer>,
  tick: (deltaMS: number) => void,
  direction: 1 | -1,
  intensity: 4 = 4,
): Promise<void> {
  const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[intensity];
  const pending = renderer.addBlock(makeBlock({ behavior: 'nearFall', intensity, direction }), 'holdForCollapse');
  tick(config.dropDurationMs + NEAR_FALL_HOLD_FREEZE_T_V1 * preset.durationMs + 1);
  await pending;
}

describe('createTowerRenderer — collapse held-start continuity (P6 handoff)', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('same-sign held start: continues smoothly from the exact P6 freeze pose toward a matching-sign collapse target', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    await driveNearFallToHeldPose(renderer, tick, 1); // holds a POSITIVE lean
    const heldRotation = wobbleRoot.rotation;
    expect(heldRotation).toBeGreaterThan(0);

    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[4];
    const pending = renderer.collapse('leanRight', 4); // leanRight -> positive target, SAME sign
    expect(wobbleRoot.rotation).toBe(heldRotation); // no reset before any tick

    tick(preset.durationMs + 1);
    await pending;

    const expectedTargetRad = rotationMdToRadians(computeCollapseTargetLeanMd('leanRight', preset));
    expect(wobbleRoot.rotation).toBe(expectedTargetRad);
  });

  it('opposite-sign held start: continues smoothly from the exact P6 freeze pose, reversing through the authoritative collapse direction, with no snap to 0 -- and the static base stays unchanged throughout (docs/work/TASK-P7-static-base.md)', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const base = baseOf(stage);
    const baseBefore = { x: base.x, y: base.y, rotation: base.rotation };
    await driveNearFallToHeldPose(renderer, tick, -1); // holds a NEGATIVE lean
    const heldRotation = wobbleRoot.rotation;
    expect(heldRotation).toBeLessThan(0);
    expect({ x: base.x, y: base.y, rotation: base.rotation }).toEqual(baseBefore);

    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[4];
    const pending = renderer.collapse('leanRight', 4); // leanRight -> positive target, OPPOSITE sign
    expect(wobbleRoot.rotation).toBe(heldRotation); // no reset before any tick -- the core proof

    tick(preset.durationMs * 0.1); // partway through the reversal
    expect(wobbleRoot.rotation).not.toBe(0); // never snaps through exactly 0 on the way
    expect({ x: base.x, y: base.y, rotation: base.rotation }).toEqual(baseBefore);

    tick(preset.durationMs + 1);
    await pending;

    const expectedTargetRad = rotationMdToRadians(computeCollapseTargetLeanMd('leanRight', preset));
    expect(wobbleRoot.rotation).toBe(expectedTargetRad);
    expect(wobbleRoot.rotation).toBeGreaterThan(0); // profile won, despite the opposite held start
    expect({ x: base.x, y: base.y, rotation: base.rotation }).toEqual(baseBefore);
  });
});

describe('createTowerRenderer — collapse cancellation', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('(A) cancel during collapse rejects, removes the ticker, and resets rotation to 0', async () => {
    const { app, stage, ticker, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[3];

    const pending = renderer.collapse('leanLeft', 3);
    tick(preset.durationMs * 0.4);
    expect(wobbleRoot.rotation).not.toBe(0);
    expect(ticker.add).toHaveBeenCalledTimes(1);
    const registeredCallback = ticker.add.mock.calls[0]?.[0] as TickCallback;

    renderer.cancel();

    await expect(pending).rejects.toBeInstanceOf(TowerRenderCancelledError);
    expect(ticker.remove).toHaveBeenCalledWith(registeredCallback);
    expect(wobbleRoot.rotation).toBe(0);
  });

  it('(B) cancel after collapse completion is safe -- the terminal pose is cleared because teardown is occurring', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[4];

    const pending = renderer.collapse('leanRight', 4);
    tick(preset.durationMs + 1);
    await pending;
    expect(wobbleRoot.rotation).not.toBe(0);

    expect(() => renderer.cancel()).not.toThrow();
    expect(wobbleRoot.rotation).toBe(0); // existing unconditional reset, harmless at teardown
  });

  it('(C) cancel twice during/after collapse is safe and idempotent', async () => {
    const { app, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const pending = renderer.collapse('leanLeft', 2);
    tick(50);

    expect(() => renderer.cancel()).not.toThrow();
    expect(() => renderer.cancel()).not.toThrow();
    await expect(pending).rejects.toBeInstanceOf(TowerRenderCancelledError);
  });

  it('(D) collapse() called after cancel() rejects immediately without starting any animation', async () => {
    const { app, ticker } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    renderer.cancel();

    await expect(renderer.collapse('leanRight', 4)).rejects.toBeInstanceOf(TowerRenderCancelledError);
    expect(ticker.add).not.toHaveBeenCalled();
  });
});

describe('createTowerRenderer — real fixture integration (collapse)', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
    applyTowerEventSpy.mockClear();
  });

  async function driveToSettledLocal(playing: Promise<void>, tick: (deltaMS: number) => void): Promise<void> {
    let settled = false;
    playing.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    let iterations = 0;
    while (!settled && iterations < 2000) {
      tick(50);
      await Promise.resolve();
      await Promise.resolve();
      iterations += 1;
    }
  }

  it('quickCollapseStreet0x: reaches the exact leanLeft/intensity-3 terminal pose', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const handlers = createTowerEventHandlers(renderer);

    const playing = playBookEvents(quickCollapseStreet0x, handlers);
    await driveToSettledLocal(playing, tick);

    await expect(playing).resolves.toBeUndefined();
    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[3];
    const expectedTargetRad = rotationMdToRadians(computeCollapseTargetLeanMd('leanLeft', preset));
    expect(wobbleRoot.rotation).toBe(expectedTargetRad);
    expect(applyTowerEventSpy).toHaveBeenCalledTimes(quickCollapseStreet0x.events.length);

    const liveModel = applyTowerEventSpy.mock.results.at(-1)?.value as TowerModel;
    expect(fingerprintTowerModel(liveModel)).toBe(fingerprintTowerModel(buildTowerModel(quickCollapseStreet0x)));
  });

  it('standardCollapseSkyline0x: reaches the exact leanRight/intensity-3 terminal pose', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const handlers = createTowerEventHandlers(renderer);

    const playing = playBookEvents(standardCollapseSkyline0x, handlers);
    await driveToSettledLocal(playing, tick);

    await expect(playing).resolves.toBeUndefined();
    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[3];
    const expectedTargetRad = rotationMdToRadians(computeCollapseTargetLeanMd('leanRight', preset));
    expect(wobbleRoot.rotation).toBe(expectedTargetRad);
    expect(applyTowerEventSpy).toHaveBeenCalledTimes(standardCollapseSkyline0x.events.length);

    const liveModel = applyTowerEventSpy.mock.results.at(-1)?.value as TowerModel;
    expect(fingerprintTowerModel(liveModel)).toBe(fingerprintTowerModel(buildTowerModel(standardCollapseSkyline0x)));
  });
});

describe('createTowerRenderer — mandatory P6 -> P7 collapse handoff (synthetic Book)', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
    applyTowerEventSpy.mockClear();
  });

  async function flushMicrotasks(times = 10): Promise<void> {
    for (let i = 0; i < times; i += 1) await Promise.resolve();
  }

  async function runHandoff(
    nearFallDirection: 1 | -1,
    collapseProfile: CollapseProfile,
    tick: (deltaMS: number) => void,
    wobbleRoot: { rotation: number },
    playBookThenFinish: () => Promise<void>,
    base: { x: number; y: number; rotation: number },
  ): Promise<{ heldRotation: number; expectedTargetRad: number }> {
    const baseBefore = { x: base.x, y: base.y, rotation: base.rotation };
    // (1) Drive with small ticks + microtask flushes until exactly the nearFall block's own
    // applyTowerEvent has happened (towerStart, block, block, block[nearFall] = 4 calls) --
    // identical setup technique to P6's own mandatory test.
    while (applyTowerEventSpy.mock.calls.length < 4) {
      tick(20);
      await Promise.resolve();
      await Promise.resolve();
    }
    expect(applyTowerEventSpy.mock.calls.length).toBe(4);

    const nearFallPreset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];
    const holdPhaseMs = NEAR_FALL_HOLD_FREEZE_T_V1 * nearFallPreset.durationMs;
    const holdTotalMs = config.dropDurationMs + holdPhaseMs;

    // (2) Complete the nearFall's own hold exactly -- settle() recomputes and assigns the exact
    // freeze pose synchronously within this tick() call.
    tick(holdTotalMs + 5);
    const heldRotation = wobbleRoot.rotation;
    const expectedFreezeMd = computeNearFallLeanMd(NEAR_FALL_HOLD_FREEZE_T_V1, nearFallPreset, nearFallDirection);
    expect(heldRotation).toBeCloseTo(rotationMdToRadians(expectedFreezeMd));
    expect(heldRotation).not.toBe(0);
    // (docs/work/TASK-P7-static-base.md) the static base stays planted through the held pose.
    expect({ x: base.x, y: base.y, rotation: base.rotation }).toEqual(baseBefore);

    // (3) Let the nearFall's own addBlock Promise resolution propagate through the handler/P2
    // chain until the collapse handler starts (its own applyTowerEvent becomes the 5th call) --
    // a generous, bounded microtask drain, not a fixed guess at the exact hop count.
    await flushMicrotasks();
    expect(applyTowerEventSpy.mock.calls.length).toBe(5);
    expect(applyTowerEventSpy.mock.calls.map((c) => c[1].type)).toEqual(['towerStart', 'block', 'block', 'block', 'collapse']);

    // (6)/(7) At the exact instant collapse's own ticker has just registered but has not yet
    // ticked, rotation must still be EXACTLY the held P6 pose -- no reset-to-zero frame anywhere
    // in between.
    expect(wobbleRoot.rotation).toBe(heldRotation);
    expect({ x: base.x, y: base.y, rotation: base.rotation }).toEqual(baseBefore);

    // (9) Collapse's own Promise remains pending mid-duration -- economic events cannot have
    // dispatched yet.
    const collapsePreset = COLLAPSE_PRESETS_V1_BY_INTENSITY[4];
    tick(collapsePreset.durationMs / 2);
    await flushMicrotasks();
    expect(applyTowerEventSpy.mock.calls.length).toBe(5); // still just the 5 events above

    // (4)/(10) Finish collapse's animation; only then do the economic/result events dispatch.
    tick(collapsePreset.durationMs / 2 + 10);
    await playBookThenFinish();

    const finalTypes = applyTowerEventSpy.mock.calls.map((c) => c[1].type);
    expect(finalTypes).toEqual(['towerStart', 'block', 'block', 'block', 'collapse', 'setTotalWin', 'finalWin']);
    expect(applyTowerEventSpy).toHaveBeenCalledTimes(7);

    // (8) Collapse profile wins authoritatively, continuing smoothly from the held start.
    const expectedTargetRad = rotationMdToRadians(computeCollapseTargetLeanMd(collapseProfile, collapsePreset));
    expect(wobbleRoot.rotation).toBe(expectedTargetRad);
    // (docs/work/TASK-P7-static-base.md) the static base is still exactly as it started, at the
    // very end of the full handoff sequence.
    expect({ x: base.x, y: base.y, rotation: base.rotation }).toEqual(baseBefore);

    return { heldRotation, expectedTargetRad };
  }

  function buildSyntheticBook(nearFallDirection: 1 | -1, collapseProfile: CollapseProfile) {
    return new BookBuilder()
      .towerStart('cruelCollapse', 'quick', 42)
      .block({ behavior: 'clean' })
      .block({ behavior: 'clean' })
      .block({ behavior: 'nearFall', offsetU: 1500, rotationMd: 1600, direction: nearFallDirection, intensity: 4 })
      .collapse(collapseProfile, 4)
      .setTotalWin(0)
      .finalWin(0)
      .build(9002, 0, `synthetic-nearfall-hold-collapse-${nearFallDirection}-${collapseProfile}`);
  }

  it('matching-sign: nearFall direction 1 (positive hold) -> collapse leanRight (positive target)', async () => {
    const book = buildSyntheticBook(1, 'leanRight');
    const before = JSON.stringify(book);
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const base = baseOf(stage);
    const handlers = createTowerEventHandlers(renderer);
    const playing = playBookEvents(book, handlers);

    const { heldRotation, expectedTargetRad } = await runHandoff(1, 'leanRight', tick, wobbleRoot, () => playing, base);
    expect(heldRotation).toBeGreaterThan(0);
    expect(expectedTargetRad).toBeGreaterThan(0);

    // (11) fingerprint parity, (12) Book byte-identical.
    const liveModel = applyTowerEventSpy.mock.results.at(-1)?.value as TowerModel;
    expect(fingerprintTowerModel(liveModel)).toBe(fingerprintTowerModel(buildTowerModel(book)));
    expect(JSON.stringify(book)).toBe(before);
  });

  it('opposite-sign (load-bearing): nearFall direction -1 (negative hold) -> collapse leanRight (positive target) -- profile wins authoritatively, no reset, no snap', async () => {
    const book = buildSyntheticBook(-1, 'leanRight');
    const before = JSON.stringify(book);
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const wobbleRoot = wobbleRootOf(stage);
    const base = baseOf(stage);
    const handlers = createTowerEventHandlers(renderer);
    const playing = playBookEvents(book, handlers);

    const { heldRotation, expectedTargetRad } = await runHandoff(-1, 'leanRight', tick, wobbleRoot, () => playing, base);
    expect(heldRotation).toBeLessThan(0); // started held toward the left
    expect(expectedTargetRad).toBeGreaterThan(0); // finished toward the right, per profile alone

    const liveModel = applyTowerEventSpy.mock.results.at(-1)?.value as TowerModel;
    expect(fingerprintTowerModel(liveModel)).toBe(fingerprintTowerModel(buildTowerModel(book)));
    expect(JSON.stringify(book)).toBe(before);
  });
});

// ==========================================================================================
// P7.1 — Static tower base (docs/work/TASK-P7-static-base.md, DECISIONS.md D-037)
// ==========================================================================================

describe('createTowerRenderer — static tower base', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('base is created once directly under cameraContainer, is never a child of wobbleRoot, and is a distinct object from it', () => {
    const { app, stage } = createFakeApp();
    createTowerRenderer(app); // real constructor -- observes the base's own construction-time Graphics
    const cameraContainer = stage.children[0] as FakeContainer;
    const base = baseOf(stage);
    const wobbleRoot = wobbleRootOf(stage);

    expect(graphicsInstances).toHaveLength(1); // exactly the base -- no block has been added yet
    expect(cameraContainer.children).toContain(base);
    expect(cameraContainer.children).toContain(wobbleRoot);
    expect(wobbleRoot.children).not.toContain(base);
    expect(base).not.toBe(wobbleRoot);
  });

  it('base top-center coincides exactly with the shared tower support pivot also used by wobbleRoot', () => {
    const { app, stage } = createFakeApp();
    createRendererUnderTest(app);
    const base = baseOf(stage);
    const wobbleRoot = wobbleRootOf(stage);
    const pivot = computeTowerSupportPivot(config);

    expect({ x: base.x, y: base.y }).toEqual(pivot);
    expect({ x: wobbleRoot.pivot.x, y: wobbleRoot.pivot.y }).toEqual(pivot);
    expect({ x: wobbleRoot.x, y: wobbleRoot.y }).toEqual(pivot);
  });

  it('logical block graphics land under wobbleRoot, never under base', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const base = baseOf(stage);
    const wobbleRoot = wobbleRootOf(stage);

    const pending = renderer.addBlock(makeBlock());
    tick(config.dropDurationMs + 1);
    await pending;

    expect(wobbleRoot.children).toContain(graphicsInstances[0]);
    expect(wobbleRoot.children).not.toContain(base);
  });

  it('wobble changes wobbleRoot.rotation while base stays fully unchanged', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const base = baseOf(stage);
    const wobbleRoot = wobbleRootOf(stage);
    const baseBefore = { x: base.x, y: base.y, rotation: base.rotation };

    const pending = renderer.addBlock(makeBlock({ behavior: 'wobble', intensity: 4, direction: 1 }));
    tick(config.dropDurationMs + 100); // mid-wobble
    expect(wobbleRoot.rotation).not.toBe(0);
    expect({ x: base.x, y: base.y, rotation: base.rotation }).toEqual(baseBefore);

    tick(2000); // drive to completion
    await pending;
    expect({ x: base.x, y: base.y, rotation: base.rotation }).toEqual(baseBefore);
  });

  it('nearFall approach/recovery changes wobbleRoot.rotation while base stays fully unchanged', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const base = baseOf(stage);
    const wobbleRoot = wobbleRootOf(stage);
    const baseBefore = { x: base.x, y: base.y, rotation: base.rotation };

    const pending = renderer.addBlock(makeBlock({ behavior: 'nearFall', intensity: 4, direction: 1 }), 'recover');
    tick(config.dropDurationMs + 50); // inside the approach
    expect(wobbleRoot.rotation).not.toBe(0);
    expect({ x: base.x, y: base.y, rotation: base.rotation }).toEqual(baseBefore);

    tick(2000); // drive the full recovery to completion
    await pending;
    expect({ x: base.x, y: base.y, rotation: base.rotation }).toEqual(baseBefore);
  });

  it('holdForCollapse leaves wobbleRoot.rotation held nonzero while base stays fully unchanged', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const base = baseOf(stage);
    const wobbleRoot = wobbleRootOf(stage);
    const baseBefore = { x: base.x, y: base.y, rotation: base.rotation };

    await driveNearFallToHeldPose(renderer, tick, 1);

    expect(wobbleRoot.rotation).not.toBe(0);
    expect({ x: base.x, y: base.y, rotation: base.rotation }).toEqual(baseBefore);
  });

  it('direct collapse changes wobbleRoot.rotation while base stays fully unchanged, mid-animation and at the terminal pose', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const base = baseOf(stage);
    const wobbleRoot = wobbleRootOf(stage);
    const baseBefore = { x: base.x, y: base.y, rotation: base.rotation };
    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[4];

    const pending = renderer.collapse('leanRight', 4);
    tick(preset.durationMs * 0.5);
    expect(wobbleRoot.rotation).not.toBe(0);
    expect({ x: base.x, y: base.y, rotation: base.rotation }).toEqual(baseBefore);

    tick(preset.durationMs + 1);
    await pending;
    expect({ x: base.x, y: base.y, rotation: base.rotation }).toEqual(baseBefore);
  });

  it('cameraContainer translation carries both base and wobbleRoot together (structural sibling proof)', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const cameraContainer = stage.children[0] as FakeContainer;
    const base = baseOf(stage);
    const wobbleRoot = wobbleRootOf(stage);

    for (let ordinal = 1; ordinal <= 16; ordinal += 1) {
      const pending = renderer.addBlock(makeBlock({ ordinal }));
      tick(config.dropDurationMs + 1);
      await pending;
    }
    expect(cameraContainer.y).toBe(0);

    const pending17 = renderer.addBlock(makeBlock({ ordinal: 17 }));
    tick(config.dropDurationMs + 1);
    await pending17;

    expect(cameraContainer.y).toBeGreaterThan(0);
    // Both base and wobbleRoot are direct children of the SAME cameraContainer whose .y just
    // became positive -- real Pixi composes a child's world transform through its parent's, so
    // both inherit this translation identically and automatically; there is no separate camera
    // code path for base to test.
    expect(cameraContainer.children).toContain(base);
    expect(cameraContainer.children).toContain(wobbleRoot);
  });

  it('cancel mid-animation does not leave base transformed', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const base = baseOf(stage);
    const baseBefore = { x: base.x, y: base.y, rotation: base.rotation };

    const pending = renderer.collapse('leanRight', 4);
    tick(50);
    renderer.cancel();

    await expect(pending).rejects.toBeInstanceOf(TowerRenderCancelledError);
    expect({ x: base.x, y: base.y, rotation: base.rotation }).toEqual(baseBefore);
  });

  it('cancel after collapse completion does not leave base state dirty', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const base = baseOf(stage);
    const baseBefore = { x: base.x, y: base.y, rotation: base.rotation };
    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[4];

    const pending = renderer.collapse('leanRight', 4);
    tick(preset.durationMs + 1);
    await pending;
    renderer.cancel();

    expect({ x: base.x, y: base.y, rotation: base.rotation }).toEqual(baseBefore);
  });

  it('double cancel is safe and leaves base untouched', () => {
    const { app, stage } = createFakeApp();
    const renderer = createRendererUnderTest(app);
    const base = baseOf(stage);
    const baseBefore = { x: base.x, y: base.y, rotation: base.rotation };

    expect(() => renderer.cancel()).not.toThrow();
    expect(() => renderer.cancel()).not.toThrow();
    expect({ x: base.x, y: base.y, rotation: base.rotation }).toEqual(baseBefore);
  });
});
