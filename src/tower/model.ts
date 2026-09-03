// Logical Tower Model (docs/ARCHITECTURE.md §6, docs/TOWER_SYSTEM.md). Pure, deterministic,
// renderer-independent state derived from a validated Book's events — no Pixi, no timing, no
// physics, no RNG. See docs/work/TASK-P3-logical-tower-model.md for full rationale, including
// why `moon` is itself a terminal outcome and why there are two fingerprint functions.

import type {
  Book,
  BlockBehavior,
  BookEvent,
  CollapseProfile,
  Direction,
  Intensity,
  MoonVariant,
  Zone,
} from '../book/schema';

export type TowerTerminalState =
  | { readonly status: 'building' }
  | { readonly status: 'collapsed'; readonly profile: CollapseProfile }
  | { readonly status: 'survived' }
  | { readonly status: 'moon'; readonly variant: MoonVariant };

export interface LogicalBlock {
  readonly ordinal: number;
  readonly offsetU: number;
  readonly rotationMd: number;
  readonly behavior: BlockBehavior;
  readonly intensity: Intensity;
  readonly direction: Direction;
}

export interface TowerModel {
  readonly blocks: readonly LogicalBlock[];
  readonly currentZone: Zone;
  readonly zoneHistory: readonly Zone[];
  readonly terminal: TowerTerminalState;
}

export const INITIAL_TOWER_MODEL: TowerModel = {
  blocks: [],
  currentZone: 'street',
  zoneHistory: ['street'],
  terminal: { status: 'building' },
};

/**
 * Pure per-event transition — the production primitive. `src/book/player.ts`'s
 * `playBookEvents` remains the sole owner of live event order; P4's real rendering handlers
 * (registered into that Book Player's handler map) will call this once per event to advance a
 * running model alongside animation.
 */
export function applyTowerEvent(state: TowerModel, event: BookEvent): TowerModel {
  switch (event.type) {
    case 'towerStart':
      return state;

    case 'block':
      return {
        ...state,
        blocks: [
          ...state.blocks,
          {
            ordinal: event.ordinal,
            offsetU: event.offsetU,
            rotationMd: event.rotationMd,
            behavior: event.behavior,
            intensity: event.intensity,
            direction: event.direction,
          },
        ],
      };

    case 'zoneChange':
      return {
        ...state,
        currentZone: event.zone,
        zoneHistory: [...state.zoneHistory, event.zone],
      };

    case 'collapse':
      return { ...state, terminal: { status: 'collapsed', profile: event.profile } };

    case 'survive':
      // The only reachable order is moon -> survive (P1's validator requires narrativeState
      // === 'building' for both collapse and moon, so neither can follow a moon that already
      // moved state past 'building'). Moon is itself the round's terminal outcome
      // (GAME_SPEC.md §8); an optional post-moon stabilization beat must not downgrade it.
      if (state.terminal.status === 'moon') return state;
      return { ...state, terminal: { status: 'survived' } };

    case 'moon':
      return {
        ...state,
        currentZone: 'moon',
        zoneHistory: [...state.zoneHistory, 'moon'],
        terminal: { status: 'moon', variant: event.variant },
      };

    case 'setWin':
    case 'setTotalWin':
    case 'wincap':
    case 'finalWin':
      return state;

    default: {
      const exhaustive: never = event;
      throw new Error(`applyTowerEvent: unhandled BookEvent type ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Whole-Book convenience fold for tests/tooling — NOT a second production playback engine.
 * Live rounds never call this; they go through `playBookEvents` with real handlers that each
 * call `applyTowerEvent`.
 */
export function buildTowerModel(book: Book): TowerModel {
  return book.events.reduce(applyTowerEvent, INITIAL_TOWER_MODEL);
}

/**
 * Logical-state-only fingerprint — no Book. Two models with identical tower content produce
 * the same fingerprint regardless of which Book (id/payoutMultiplier) they came from.
 */
export function fingerprintTowerModel(model: TowerModel): string {
  return JSON.stringify({
    zones: model.zoneHistory,
    blocks: model.blocks,
    terminal: model.terminal,
  });
}

/**
 * Full replay fingerprint satisfying TOWER_SYSTEM.md §17 literally (Book id, payoutMultiplier,
 * ordered zones, block fields, terminal event/profile, Moon variant). `currentZone` is not
 * duplicated here: for valid model state it is always `zoneHistory`'s last entry, and
 * `zoneHistory` is the canonical ordered-zone representation §17 asks for.
 */
export function fingerprintTowerPlayback(book: Book, model: TowerModel): string {
  return JSON.stringify({
    bookId: book.id,
    payoutMultiplier: book.payoutMultiplier,
    zones: model.zoneHistory,
    blocks: model.blocks,
    terminal: model.terminal,
  });
}
