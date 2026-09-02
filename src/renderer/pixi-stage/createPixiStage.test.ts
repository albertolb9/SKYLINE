import { beforeEach, describe, expect, it, vi } from 'vitest';

const initMock = vi.fn().mockResolvedValue(undefined);
const destroyMock = vi.fn();
const canvas = document.createElement('canvas');

vi.mock('pixi.js', () => {
  return {
    Application: vi.fn().mockImplementation(() => ({
      init: initMock,
      destroy: destroyMock,
      canvas,
    })),
  };
});

const { createPixiStage } = await import('./createPixiStage');

describe('createPixiStage', () => {
  beforeEach(() => {
    initMock.mockClear();
    destroyMock.mockClear();
    canvas.remove();
  });

  it('initializes the Pixi Application sized to the container and appends its canvas', async () => {
    const container = document.createElement('div');

    const result = await createPixiStage(container);
    if (!result) throw new Error('expected a stage handle when not aborted');

    expect(initMock).toHaveBeenCalledWith(expect.objectContaining({ resizeTo: container }));
    expect(container.contains(canvas)).toBe(true);
    expect(result.app.canvas).toBe(canvas);
  });

  it('destroys the underlying Application and detaches the canvas on cleanup', async () => {
    const container = document.createElement('div');
    const result = await createPixiStage(container);
    if (!result) throw new Error('expected a stage handle when not aborted');

    result.destroy();

    expect(destroyMock).toHaveBeenCalledWith(true, { children: true });
  });

  it('destroys a late-resolving Application exactly once and never appends its canvas when aborted before init resolves', async () => {
    const container = document.createElement('div');
    let resolveInit!: () => void;
    initMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveInit = resolve;
        }),
    );

    let aborted = false;
    const pending = createPixiStage(container, () => aborted);

    // Simulate the owning component being torn down while init() is still pending.
    aborted = true;
    resolveInit();

    const result = await pending;

    expect(result).toBeUndefined();
    expect(container.contains(canvas)).toBe(false);
    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(destroyMock).toHaveBeenCalledWith(true, { children: true });
  });
});
