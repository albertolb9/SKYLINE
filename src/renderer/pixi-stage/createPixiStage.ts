import { Application } from 'pixi.js';

export type PixiStageHandle = {
  app: Application;
  destroy: () => void;
};

/**
 * Cosmetic-only Pixi bootstrap: creates and sizes an empty Application to its
 * container. Never touches round-critical state (see TOWER_SYSTEM.md §12).
 *
 * `isAborted` is polled once `init()` resolves, before the canvas is
 * attached, so a component torn down while `init()` was still pending never
 * has its canvas appended to a dead container — the Application is destroyed
 * instead and no handle is returned.
 */
export async function createPixiStage(
  container: HTMLElement,
  isAborted: () => boolean = () => false,
): Promise<PixiStageHandle | undefined> {
  const app = new Application();

  await app.init({
    resizeTo: container,
    backgroundAlpha: 0,
    antialias: true,
  });

  const destroy = () => {
    app.destroy(true, { children: true });
  };

  if (isAborted()) {
    destroy();
    return undefined;
  }

  container.appendChild(app.canvas);

  return { app, destroy };
}
