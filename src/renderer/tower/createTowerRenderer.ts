// Pixi-facing tower renderer for the P4-P7 greybox phases (docs/work/TASK-P4-basic-renderer.md,
// docs/work/TASK-P5-wobble-recovery.md, docs/work/TASK-P6-near-fall.md, docs/work/
// TASK-P7-collapse.md). Consumes already-committed LogicalBlock data; never decides placement/
// outcome and never reads TowerModel/BookEvent itself — see transforms.ts for the pure
// logical->pixel math, wobble.ts/nearFall.ts/collapse.ts for the pure motion-curve math this
// wraps.

import { Container, Graphics, type Application, type Ticker } from 'pixi.js';
import type { LogicalBlock } from '../../tower/model';
import type { CollapseIntensity, CollapseProfile } from '../../book/schema';
import {
  DEFAULT_TOWER_VIEWPORT_TUNING,
  computeBlockTransform,
  computeCameraOffsetY,
  computeTowerSupportPivot,
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
import {
  COLLAPSE_PRESETS_V1_BY_INTENSITY,
  computeCollapseFraction,
  computeCollapseTargetLeanMd,
} from './collapse';

const BLOCK_FILL_COLOR = 0x3a3f4b;
const BLOCK_STROKE_COLOR = 0x9aa4b8;

// Static tower base (docs/work/TASK-P7-static-base.md) -- GREYBOX TUNING, NOT LOCKED VALUES.
// Renderer-presentation-only constants; base geometry deliberately stays local to this file
// rather than transforms.ts, since it is a drawing/sizing concern, not logical->pixel math.
const BASE_WIDTH_MULTIPLIER_V1 = 1.25; // wider than one block -- reads as a foundation lip
const BASE_HEIGHT_BLOCKS_V1 = 3; // in units of blockHeightPx
const BASE_FILL_COLOR = 0x2a2e38; // slightly darker than BLOCK_FILL_COLOR, same visual family
const BASE_STROKE_COLOR = BLOCK_STROKE_COLOR;

export class TowerRenderCancelledError extends Error {
  constructor() {
    super('TowerRenderer was cancelled before this block finished animating.');
    this.name = 'TowerRenderCancelledError';
  }
}

export interface TowerRenderer {
  addBlock(block: LogicalBlock, nearFallResolution?: NearFallResolution): Promise<void>;
  collapse(profile: CollapseProfile, intensity: CollapseIntensity): Promise<void>;
  cancel(): void;
}

function createBlockGraphics(config: TowerRenderConfig): Graphics {
  return new Graphics()
    .rect(-config.blockWidthPx / 2, -config.blockHeightPx / 2, config.blockWidthPx, config.blockHeightPx)
    .fill(BLOCK_FILL_COLOR)
    .stroke({ width: 2, color: BLOCK_STROKE_COLOR });
}

/**
 * Static tower base (docs/work/TASK-P7-static-base.md). Drawn with its TOP edge at local y=0,
 * horizontally centered -- the caller positions it so that local origin lands exactly on the
 * shared tower support pivot, making the rendered rectangle's top-center coincide with it.
 */
function createBaseGraphics(config: TowerRenderConfig): Graphics {
  const width = config.blockWidthPx * BASE_WIDTH_MULTIPLIER_V1;
  const height = config.blockHeightPx * BASE_HEIGHT_BLOCKS_V1;
  return new Graphics()
    .rect(-width / 2, 0, width, height)
    .fill(BASE_FILL_COLOR)
    .stroke({ width: 2, color: BASE_STROKE_COLOR });
}

/**
 * `app.screen` dimensions are read exactly once, at creation, to derive the viewport-scaled
 * render config — no resize-reactivity (docs/work/TASK-P4-basic-renderer.md). At most one
 * `addBlock` animation is ever in flight at a time in practice (the P2 Book Player awaits each
 * handler fully before the next), so a single `activeCancel` slot is sufficient.
 *
 * Container hierarchy (docs/work/TASK-P5-wobble-recovery.md §13-14; extended by
 * docs/work/TASK-P7-static-base.md, DECISIONS.md D-037):
 *   app.stage -> cameraContainer (camera translation only, .y)
 *                  |- base (static visual, renderer presentation only -- never rotates, never
 *                  |   touched by addBlock/collapse/cancel; inherits cameraContainer's
 *                  |   translation like any other sibling)
 *                  `- wobbleRoot (whole-tower rotation only, driven by wobble OR nearFall OR
 *                      collapse, never concurrently — P2's strict one-event-at-a-time sequencing
 *                      guarantees this) -> block graphics (unchanged addChild target/transform
 *                      values)
 * `base` and `wobbleRoot` are siblings, both direct children of `cameraContainer` -- `base` is
 * added first (renders behind the moving tower where the two may ever overlap during an active
 * lean; purely a visual-tuning choice, not an architectural one). Both consume the exact same
 * `computeTowerSupportPivot(config)` value: `wobbleRoot`'s pivot/position, and `base`'s top-center,
 * are provably identical rather than two independently-authored copies that could drift apart.
 */
export function createTowerRenderer(
  app: Application,
  tuningOverrides?: Partial<TowerViewportTuning>,
): TowerRenderer {
  const tuning: TowerViewportTuning = { ...DEFAULT_TOWER_VIEWPORT_TUNING, ...tuningOverrides };
  const config = computeTowerViewportConfig(app.screen.width, app.screen.height, tuning);

  const pivot = computeTowerSupportPivot(config);

  const cameraContainer = new Container();
  app.stage.addChild(cameraContainer);

  const base = createBaseGraphics(config);
  base.x = pivot.x;
  base.y = pivot.y;
  cameraContainer.addChild(base);

  const wobbleRoot = new Container();
  wobbleRoot.pivot.x = pivot.x;
  wobbleRoot.pivot.y = pivot.y;
  wobbleRoot.x = pivot.x;
  wobbleRoot.y = pivot.y;
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

  /**
   * P7 collapse (docs/work/TASK-P7-collapse.md). `profile` is the sole authoritative source of
   * the terminal lean's sign; `intensity` selects only its magnitude -- neither is ever derived
   * from a preceding block's direction, offsetU, rotationMd, tower geometry, or the renderer's
   * own current rotation. The starting rotation is snapshotted exactly once, directly in radians
   * -- zero for a direct collapse, or the exact P6 holdForCollapse pose for a held collapse --
   * with NO radians->millidegrees->radians round trip: `startRotationRad` is used as-is, and
   * `targetRotationRad` is computed once via the already-existing `rotationMdToRadians`. The same
   * lerp formula handles a direct start, a same-sign held start, and an opposite-sign held start
   * identically -- there is no branch for "opposite direction." At settle, rotation is assigned
   * exactly `targetRotationRad` and is never reset afterward by anything in this module; it
   * persists for the remainder of the rendered round (through any later economic/result events)
   * until `cancel()`/teardown.
   */
  function collapse(profile: CollapseProfile, intensity: CollapseIntensity): Promise<void> {
    if (cancelled) return Promise.reject(new TowerRenderCancelledError());

    const preset = COLLAPSE_PRESETS_V1_BY_INTENSITY[intensity];
    const startRotationRad = wobbleRoot.rotation; // exact snapshot, zero conversion
    const targetRotationRad = rotationMdToRadians(computeCollapseTargetLeanMd(profile, preset));

    return new Promise<void>((resolve, reject) => {
      let elapsedMs = 0;

      const onTick = (ticker: Ticker) => {
        elapsedMs += ticker.deltaMS;
        const fraction = computeCollapseFraction(elapsedMs / preset.durationMs); // clamps internally
        wobbleRoot.rotation = startRotationRad + (targetRotationRad - startRotationRad) * fraction;
        if (elapsedMs >= preset.durationMs) settle();
      };

      const settle = () => {
        wobbleRoot.rotation = targetRotationRad; // exact terminal pose, no drift
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
    // holdForCollapse/collapse already resolved and left the root deliberately tilted, or
    // activeCancel is already undefined for any other reason) -- avoids any stale tilt surviving
    // teardown. Harmless even after a completed collapse: cancel() is only ever invoked from
    // TowerStage.svelte's onBeforeDestroy, i.e. the instant before the whole Pixi Application is
    // destroyed, so resetting a rotation that is about to stop being rendered has no observable
    // effect.
    wobbleRoot.rotation = 0;
    activeCancel?.();
  }

  return { addBlock, collapse, cancel };
}
