import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Application } from 'pixi.js';
import type { LogicalBlock, TowerModel } from '../../tower/model';
import { playBookEvents } from '../../book/player';
import { cruelCollapseSky0x, nearDeathWin20x, wobbleWin5x } from '../../test-fixtures/books';
import { BookBuilder } from '../../test-fixtures/bookBuilder';
import { DEFAULT_TOWER_VIEWPORT_TUNING, computeBlockTransform, computeTowerViewportConfig, rotationMdToRadians } from './transforms';
import { WOBBLE_PRESETS_V1_BY_INTENSITY } from './wobble';
import { NEAR_FALL_HOLD_FREEZE_T_V1, NEAR_FALL_PRESETS_V1_BY_INTENSITY, computeNearFallLeanMd } from './nearFall';

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

function wobbleRootOf(stage: FakeContainer): FakeContainer {
  const cameraContainer = stage.children[0] as FakeContainer;
  return cameraContainer.children[0] as FakeContainer;
}

const config = computeTowerViewportConfig(390, 844, DEFAULT_TOWER_VIEWPORT_TUNING);

describe('createTowerRenderer — addBlock', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('creates exactly one Graphics, adds it to wobbleRoot, and sets x/rotation immediately (before any tick)', () => {
    const { app, stage } = createFakeApp();
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
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

    void createTowerRenderer(appA).addBlock(block);
    void createTowerRenderer(appB).addBlock(block);

    const [first, second] = graphicsInstances;
    expect(second.x).toBe(first.x);
    expect(second.rotation).toBe(first.rotation);
  });

  it('camera follow stays at zero for a short run and becomes positive once the safe band is crossed', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);

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
    const renderer = createTowerRenderer(app);
    renderer.cancel();

    await expect(renderer.addBlock(makeBlock())).rejects.toBeInstanceOf(TowerRenderCancelledError);
    expect(ticker.add).not.toHaveBeenCalled();
    expect(graphicsInstances).toHaveLength(0);
  });

  it('is idempotent — calling cancel() with nothing in flight does not throw, even called twice', () => {
    const { app } = createFakeApp();
    const renderer = createTowerRenderer(app);
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
    createTowerRenderer(app);
    const wobbleRoot = wobbleRootOf(stage);

    const expectedPivot = { x: config.originX, y: config.originY + config.blockHeightPx / 2 };
    expect(wobbleRoot.pivot).toEqual(expectedPivot);
    expect({ x: wobbleRoot.x, y: wobbleRoot.y }).toEqual(expectedPivot);
  });

  it('keeps the fixed tower-base support point visually invariant under root rotation, while a point above it moves', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
    const wobbleRoot = wobbleRootOf(stage);

    const pending = renderer.addBlock(makeBlock({ behavior: 'wobble', intensity: 0, direction: 1 }));
    tick(config.dropDurationMs + 1);
    await pending;

    expect(wobbleRoot.rotation).toBe(0);
    expect(ticker.add).toHaveBeenCalledTimes(1);
  });

  it('wobble with direction 0 resolves after drop alone, with root rotation exactly 0 and no second ticker phase', async () => {
    const { app, stage, ticker, tick } = createFakeApp();
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);

    const pending = renderer.addBlock(makeBlock({ behavior: 'clean' }));
    tick(config.dropDurationMs + 1);
    await expect(pending).resolves.toBeUndefined();
  });

  it('leaves authored graphics x/rotation unchanged after a wobble fully completes', async () => {
    const { app, tick } = createFakeApp();
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
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
    const rendererA = createTowerRenderer(appA);
    const rendererB = createTowerRenderer(appB);
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
    const rendererA = createTowerRenderer(appA);
    const rendererB = createTowerRenderer(appB);
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
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
    const wobbleRoot = wobbleRootOf(stage);

    const pending = renderer.addBlock(makeBlock({ behavior: 'nearFall', intensity: 0, direction: 1 }), 'recover');
    tick(config.dropDurationMs + 1);
    await pending;

    expect(wobbleRoot.rotation).toBe(0);
    expect(ticker.add).toHaveBeenCalledTimes(1);
  });

  it('nearFall with direction 0 resolves after drop alone, with root rotation exactly 0 and no second ticker phase, even when classified holdForCollapse', async () => {
    const { app, stage, ticker, tick } = createFakeApp();
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
    const wobbleRoot = wobbleRootOf(stage);
    const preset = NEAR_FALL_PRESETS_V1_BY_INTENSITY[4];

    const pending = renderer.addBlock(makeBlock({ behavior: 'nearFall', intensity: 4, direction: 1 })); // no 2nd arg
    tick(config.dropDurationMs + preset.durationMs + 1); // full recover duration
    await pending;

    expect(wobbleRoot.rotation).toBe(0); // recovered fully, not frozen at the hold pose
  });

  it('a clean block resolves right after drop even when a nearFallResolution is (meaninglessly) passed', async () => {
    const { app, tick } = createFakeApp();
    const renderer = createTowerRenderer(app);
    const pending = renderer.addBlock(makeBlock({ behavior: 'clean' }), 'holdForCollapse');
    tick(config.dropDurationMs + 1);
    await expect(pending).resolves.toBeUndefined();
  });

  it('leaves authored graphics x/rotation unchanged after a recover completes', async () => {
    const { app, tick } = createFakeApp();
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
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
    const rendererA = createTowerRenderer(appA);
    const rendererB = createTowerRenderer(appB);
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
    const rendererA = createTowerRenderer(appA);
    const rendererB = createTowerRenderer(appB);
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
      const renderer = createTowerRenderer(app);
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
    const renderer = createTowerRenderer(app);
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
    expect(wobbleRoot.rotation).toBeCloseTo(rotationMdToRadians(expectedFreezeMd));

    // (4)/(5) Only now does P2 advance and collapse get applied -- never early.
    await playing;
    const finalTypes = applyTowerEventSpy.mock.calls.map((call) => call[1].type);
    expect(finalTypes).toEqual(['towerStart', 'block', 'block', 'block', 'collapse', 'setTotalWin', 'finalWin']);
    expect(applyTowerEventSpy).toHaveBeenCalledTimes(book.events.length);

    // (6) The held pose is still exactly in place -- P6 never animates collapse.
    expect(wobbleRoot.rotation).toBeCloseTo(rotationMdToRadians(expectedFreezeMd));

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
    const renderer = createTowerRenderer(app);
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

  it('cruelCollapseSky0x: nearFall classifies as recover (a block follows immediately), never influenced by the much-later collapse', async () => {
    const before = JSON.stringify(cruelCollapseSky0x);
    const { app, stage, tick } = createFakeApp();
    const renderer = createTowerRenderer(app);
    const wobbleRoot = wobbleRootOf(stage);
    const handlers = createTowerEventHandlers(renderer);

    const playing = playBookEvents(cruelCollapseSky0x, handlers);
    await driveToSettled(playing, tick);

    await expect(playing).resolves.toBeUndefined();
    expect(wobbleRoot.rotation).toBe(0); // recovered (not held) despite the later collapse
    expect(applyTowerEventSpy).toHaveBeenCalledTimes(cruelCollapseSky0x.events.length);
    expect(JSON.stringify(cruelCollapseSky0x)).toBe(before);

    const liveModel = applyTowerEventSpy.mock.results.at(-1)?.value as TowerModel;
    expect(fingerprintTowerModel(liveModel)).toBe(fingerprintTowerModel(buildTowerModel(cruelCollapseSky0x)));
  });
});
