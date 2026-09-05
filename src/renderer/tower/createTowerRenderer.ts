// Pixi-facing tower renderer for the P4/P5/P6 greybox phases (docs/work/TASK-P4-basic-renderer.md,
// docs/work/TASK-P5-wobble-recovery.md, docs/work/TASK-P6-near-fall.md). Consumes already-
// committed LogicalBlock data; never decides placement/outcome and never reads TowerModel/
// BookEvent itself — see transforms.ts for the pure logical->pixel math, wobble.ts/nearFall.ts for
// the pure motion-curve math this wraps.

import { Container, Graphics, type Application, type Ticker } from 'pixi.js';
import type { LogicalBlock } from '../../tower/model';
import {
  DEFAULT_TOWER_VIEWPORT_TUNING,
  computeBlockTransform,
  computeCameraOffsetY,
  computeTowerViewportConfig,
  ease,
  rotationMdToRadians,
  type TowerRenderConfig,
  type TowerViewportTuning,
} from './transforms';
import { WOBBLE_PRESETS_V1_BY_INTENSITY, computeWobbleLeanMd } from './wobble';
import {
  NEAR_FALL_HOLD_FREEZE_T_V1,
  NEAR_FALL_PRESETS_V1_BY_INTENSITY,
  computeNearFallLeanMd,
  type NearFallResolution,
} from './nearFall';

const BLOCK_FILL_COLOR = 0x3a3f4b;
const BLOCK_STROKE_COLOR = 0x9aa4b8;

export class TowerRenderCancelledError extends Error {
  constructor() {
    super('TowerRenderer was cancelled before this block finished animating.');
    this.name = 'TowerRenderCancelledError';
  }
}

export interface TowerRenderer {
  addBlock(block: LogicalBlock, nearFallResolution?: NearFallResolution): Promise<void>;
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
 * render config — no resize-reactivity (docs/work/TASK-P4-basic-renderer.md). At most one
 * `addBlock` animation is ever in flight at a time in practice (the P2 Book Player awaits each
 * handler fully before the next), so a single `activeCancel` slot is sufficient.
 *
 * Container hierarchy (docs/work/TASK-P5-wobble-recovery.md §13-14, unchanged by P6):
 *   app.stage -> cameraContainer (camera translation only, .y) -> wobbleRoot (transient whole-
 *   tower rotation only, driven by wobble OR nearFall curves, never both at once) -> block
 *   graphics (unchanged addChild target/transform values). wobbleRoot's pivot and position are
 *   both set once, at creation, to the fixed tower-base support point — horizontally aligned with
 *   the tower origin U=0 and vertically aligned with the tower's base/ground plane, independent of
 *   any individual block's authored offset/rotation.
 */
export function createTowerRenderer(
  app: Application,
  tuningOverrides?: Partial<TowerViewportTuning>,
): TowerRenderer {
  const tuning: TowerViewportTuning = { ...DEFAULT_TOWER_VIEWPORT_TUNING, ...tuningOverrides };
  const config = computeTowerViewportConfig(app.screen.width, app.screen.height, tuning);

  const cameraContainer = new Container();
  app.stage.addChild(cameraContainer);

  const wobbleRoot = new Container();
  const pivotX = config.originX;
  const pivotY = config.originY + config.blockHeightPx / 2;
  wobbleRoot.pivot.x = pivotX;
  wobbleRoot.pivot.y = pivotY;
  wobbleRoot.x = pivotX;
  wobbleRoot.y = pivotY;
  cameraContainer.addChild(wobbleRoot);

  let cancelled = false;
  let activeCancel: (() => void) | undefined;

  function addBlock(block: LogicalBlock, nearFallResolution?: NearFallResolution): Promise<void> {
    if (cancelled) return Promise.reject(new TowerRenderCancelledError());

    const transform = computeBlockTransform(block, config);
    const graphics = createBlockGraphics(config);
    graphics.x = transform.x;
    graphics.rotation = transform.rotation;
    const fromY = transform.y - config.blockHeightPx;
    graphics.y = fromY;
    wobbleRoot.addChild(graphics);

    // Zero-effect short-circuit (wobble and nearFall alike): intensity 0 (peakLeanMd 0) or
    // direction 0 would make every sample of the curve exactly 0 for its whole duration — a
    // silent block of dead animation time with no visual payoff. Detected explicitly so these
    // blocks behave exactly like clean/offset (drop only, immediate resolve).
    const rawWobblePreset = block.behavior === 'wobble' ? WOBBLE_PRESETS_V1_BY_INTENSITY[block.intensity] : undefined;
    const effectiveWobble =
      rawWobblePreset && block.direction !== 0 && rawWobblePreset.peakLeanMd !== 0 ? rawWobblePreset : undefined;

    const rawNearFallPreset =
      block.behavior === 'nearFall' ? NEAR_FALL_PRESETS_V1_BY_INTENSITY[block.intensity] : undefined;
    const effectiveNearFall =
      rawNearFallPreset && block.direction !== 0 && rawNearFallPreset.peakLeanMd !== 0
        ? rawNearFallPreset
        : undefined;
    // Defensive default: an omitted resolution on an effective nearFall always recovers, never
    // holds — an accidentally-missing visual-intent argument must not leave the tower
    // persistently tilted. The real Book-driven path always passes the explicitly classified
    // value (createTowerEventHandlers.ts); this only guards a caller that forgets to.
    const resolution: NearFallResolution = nearFallResolution ?? 'recover';
    const nearFallPhaseDurationMs = effectiveNearFall
      ? resolution === 'holdForCollapse'
        ? NEAR_FALL_HOLD_FREEZE_T_V1 * effectiveNearFall.durationMs
        : effectiveNearFall.durationMs
      : 0;

    // effectiveWobble and effectiveNearFall can never both be set (block.behavior is one value),
    // so at most one of these two additive terms is ever nonzero.
    const totalDurationMs = config.dropDurationMs + (effectiveWobble?.durationMs ?? 0) + nearFallPhaseDurationMs;

    return new Promise<void>((resolve, reject) => {
      let elapsedMs = 0;

      // One shared accumulator drives the whole operation (drop, then wobble/nearFall when
      // applicable) so "same elapsed time + same config = same visual pose" holds regardless of
      // tick granularity, including across every phase boundary. A two-ticker handoff (drop
      // ticker, then a separately-registered second-phase ticker starting its own clock at 0)
      // would not have this property: a coarse tick that overshoots a boundary would silently
      // discard the overshoot instead of crediting it to the next phase.
      const onTick = (ticker: Ticker) => {
        elapsedMs += ticker.deltaMS;

        const dropT = ease(elapsedMs / config.dropDurationMs); // ease() clamps internally
        graphics.y = fromY + config.blockHeightPx * dropT;

        if (elapsedMs >= config.dropDurationMs) {
          cameraContainer.y = computeCameraOffsetY(transform.y, config); // idempotent past this point
        }

        if (effectiveWobble) {
          const wobbleT = (elapsedMs - config.dropDurationMs) / effectiveWobble.durationMs;
          const leanMd = computeWobbleLeanMd(wobbleT, effectiveWobble, block.direction); // clamps internally
          wobbleRoot.rotation = rotationMdToRadians(leanMd);
        }

        if (effectiveNearFall) {
          const nearFallT = (elapsedMs - config.dropDurationMs) / effectiveNearFall.durationMs;
          const leanMd = computeNearFallLeanMd(nearFallT, effectiveNearFall, block.direction); // clamps internally
          wobbleRoot.rotation = rotationMdToRadians(leanMd);
        }

        if (elapsedMs >= totalDurationMs) settle();
      };

      const settle = () => {
        graphics.y = transform.y; // exact final assignment, no drift
        if (effectiveWobble) wobbleRoot.rotation = 0; // exact settle, no persistent lean
        if (effectiveNearFall) {
          // Recover settles to exact identity, same as wobble. Hold freezes at the exact
          // deterministic pose at the freeze point — never "whatever the last tick's
          // approximation happened to leave it at" — so the frozen pose is bit-for-bit identical
          // regardless of tick granularity.
          wobbleRoot.rotation =
            resolution === 'holdForCollapse'
              ? rotationMdToRadians(computeNearFallLeanMd(NEAR_FALL_HOLD_FREEZE_T_V1, effectiveNearFall, block.direction))
              : 0;
        }
        app.ticker.remove(onTick);
        activeCancel = undefined;
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
    // Unconditionally restore root identity, even if nothing is currently active (e.g. a
    // holdForCollapse already resolved and left the root deliberately tilted, or activeCancel is
    // already undefined for any other reason) -- avoids any stale tilt surviving teardown.
    wobbleRoot.rotation = 0;
    activeCancel?.();
  }

  return { addBlock, cancel };
}
