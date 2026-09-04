// Pixi-facing tower renderer for the P4 greybox phase (docs/work/TASK-P4-basic-renderer.md).
// Consumes already-committed LogicalBlock data; never decides placement and never reads
// TowerModel/BookEvent itself — see transforms.ts for the pure logical->pixel math this wraps.

import { Container, Graphics, type Application, type Ticker } from 'pixi.js';
import type { LogicalBlock } from '../../tower/model';
import {
  DEFAULT_TOWER_VIEWPORT_TUNING,
  computeBlockTransform,
  computeCameraOffsetY,
  computeTowerViewportConfig,
  ease,
  type TowerRenderConfig,
  type TowerViewportTuning,
} from './transforms';

const BLOCK_FILL_COLOR = 0x3a3f4b;
const BLOCK_STROKE_COLOR = 0x9aa4b8;

export class TowerRenderCancelledError extends Error {
  constructor() {
    super('TowerRenderer was cancelled before this block finished animating.');
    this.name = 'TowerRenderCancelledError';
  }
}

export interface TowerRenderer {
  addBlock(block: LogicalBlock): Promise<void>;
  cancel(): void;
}

function createBlockGraphics(config: TowerRenderConfig): Graphics {
  return new Graphics()
    .rect(-config.blockWidthPx / 2, -config.blockHeightPx / 2, config.blockWidthPx, config.blockHeightPx)
    .fill(BLOCK_FILL_COLOR)
    .stroke({ width: 2, color: BLOCK_STROKE_COLOR });
}

/**
 * `app.screen` dimensions are read exactly once, at creation, to derive the viewport-scaled
 * render config — P4 deliberately has no resize-reactivity (docs/work/TASK-P4-basic-renderer.md).
 * At most one `addBlock` animation is ever in flight at a time in practice (the P2 Book Player
 * awaits each handler fully before the next), so a single `activeCancel` slot is sufficient —
 * no collection of in-flight cancellations is needed.
 */
export function createTowerRenderer(
  app: Application,
  tuningOverrides?: Partial<TowerViewportTuning>,
): TowerRenderer {
  const tuning: TowerViewportTuning = { ...DEFAULT_TOWER_VIEWPORT_TUNING, ...tuningOverrides };
  const config = computeTowerViewportConfig(app.screen.width, app.screen.height, tuning);

  const towerContainer = new Container();
  app.stage.addChild(towerContainer);

  let cancelled = false;
  let activeCancel: (() => void) | undefined;

  function addBlock(block: LogicalBlock): Promise<void> {
    if (cancelled) return Promise.reject(new TowerRenderCancelledError());

    const transform = computeBlockTransform(block, config);
    const graphics = createBlockGraphics(config);
    graphics.x = transform.x;
    graphics.rotation = transform.rotation;
    const fromY = transform.y - config.blockHeightPx;
    graphics.y = fromY;
    towerContainer.addChild(graphics);

    return new Promise<void>((resolve, reject) => {
      let elapsedMs = 0;

      const onTick = (ticker: Ticker) => {
        elapsedMs += ticker.deltaMS;
        const t = ease(elapsedMs / config.dropDurationMs);
        graphics.y = fromY + config.blockHeightPx * t;
        if (elapsedMs >= config.dropDurationMs) settle();
      };

      const settle = () => {
        graphics.y = transform.y; // exact final assignment, no drift
        app.ticker.remove(onTick);
        activeCancel = undefined;
        towerContainer.y = computeCameraOffsetY(transform.y, config);
        resolve();
      };

      activeCancel = () => {
        app.ticker.remove(onTick);
        activeCancel = undefined;
        reject(new TowerRenderCancelledError());
      };

      app.ticker.add(onTick);
    });
  }

  function cancel(): void {
    cancelled = true;
    activeCancel?.();
  }

  return { addBlock, cancel };
}
