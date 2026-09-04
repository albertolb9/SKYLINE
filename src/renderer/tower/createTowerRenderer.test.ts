import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Application } from 'pixi.js';
import type { LogicalBlock } from '../../tower/model';
import { playBookEvents } from '../../book/player';
import { wobbleWin5x } from '../../test-fixtures/books';
import { DEFAULT_TOWER_VIEWPORT_TUNING, computeBlockTransform, computeTowerViewportConfig } from './transforms';
import { WOBBLE_PRESETS_V1_BY_INTENSITY } from './wobble';

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

const { createTowerRenderer, TowerRenderCancelledError } = await import('./createTowerRenderer');
const { createTowerEventHandlers } = await import('./createTowerEventHandlers');

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
