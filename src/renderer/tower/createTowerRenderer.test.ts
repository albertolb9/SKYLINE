import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Application } from 'pixi.js';
import type { LogicalBlock } from '../../tower/model';
import { DEFAULT_TOWER_VIEWPORT_TUNING, computeBlockTransform, computeTowerViewportConfig } from './transforms';

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
  return { y: 0, children, addChild: vi.fn((child: unknown) => children.push(child)) };
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

const config = computeTowerViewportConfig(390, 844, DEFAULT_TOWER_VIEWPORT_TUNING);

describe('createTowerRenderer — addBlock', () => {
  beforeEach(() => {
    graphicsInstances.length = 0;
  });

  it('creates exactly one Graphics, adds it to the tower container, and sets x/rotation immediately (before any tick)', () => {
    const { app, stage } = createFakeApp();
    const renderer = createTowerRenderer(app);
    const towerContainer = stage.children[0] as ReturnType<typeof createFakeContainerInstance>;
    const block = makeBlock();
    const expected = computeBlockTransform(block, config);

    void renderer.addBlock(block);

    expect(graphicsInstances).toHaveLength(1);
    const graphics = graphicsInstances[0];
    expect(graphics.x).toBeCloseTo(expected.x);
    expect(graphics.rotation).toBeCloseTo(expected.rotation);
    expect(graphics.y).not.toBeCloseTo(expected.y); // starts above target — hasn't landed yet
    expect(towerContainer.addChild).toHaveBeenCalled();
  });

  it('resolves with the exact final y once elapsed time reaches the drop duration, and recomputes camera offset', async () => {
    const { app, stage, tick } = createFakeApp();
    const renderer = createTowerRenderer(app);
    const towerContainer = stage.children[0] as ReturnType<typeof createFakeContainerInstance>;
    const block = makeBlock();
    const expected = computeBlockTransform(block, config);

    const pending = renderer.addBlock(block);
    tick(config.dropDurationMs + 1); // one tick comfortably past the full duration
    await pending;

    const graphics = graphicsInstances[0];
    expect(graphics.y).toBe(expected.y); // exact, not merely close — no drift
    expect(towerContainer.y).toBe(0); // a single short block never crosses the safe band
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
    const towerContainer = stage.children[0] as ReturnType<typeof createFakeContainerInstance>;

    for (let ordinal = 1; ordinal <= 16; ordinal += 1) {
      const pending = renderer.addBlock(makeBlock({ ordinal }));
      tick(config.dropDurationMs + 1);
      await pending;
    }
    expect(towerContainer.y).toBe(0);

    const pending17 = renderer.addBlock(makeBlock({ ordinal: 17 }));
    tick(config.dropDurationMs + 1);
    await pending17;
    expect(towerContainer.y).toBeGreaterThan(0);
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
