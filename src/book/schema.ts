// SKYLINE Book/Event contract — see docs/BOOK_SPEC.md and docs/TOWER_SYSTEM.md.
// Round-critical narrative state only; no renderer/animation concerns live here.

export type Zone = 'street' | 'skyline' | 'sky' | 'atmosphere' | 'space' | 'moon';

// Book-schema-level transition target for `zoneChange` (BOOK_SPEC.md §7). Street is the
// implicit start and Moon is reached only via the dedicated `moon` event, so neither is a
// valid zoneChange target — see docs/work/TASK-P1-book-contracts.md for the Zone-vs-Book
// distinction this narrows.
export type ZoneChangeTarget = Exclude<Zone, 'street' | 'moon'>;

export type BlockBehavior = 'clean' | 'offset' | 'wobble' | 'slide' | 'nearFall';
export type Intensity = 0 | 1 | 2 | 3 | 4;
export type CollapseIntensity = 1 | 2 | 3 | 4;
export type Direction = -1 | 0 | 1;
export type CollapseProfile = 'leanLeft' | 'leanRight';
export type MoonVariant = 0 | 1 | 2;
export type Pace = 'quick' | 'normal' | 'long' | 'exceptional';

export type RoundArchetype =
  | 'quickCollapse'
  | 'standardCollapse'
  | 'cruelCollapse'
  | 'weakSurvive'
  | 'cleanSurvive'
  | 'wobbleWin'
  | 'nearDeathWin'
  | 'bigClimb'
  | 'spaceRun'
  | 'moonRun';

interface BaseEvent {
  index: number;
}

export interface TowerStartEvent extends BaseEvent {
  type: 'towerStart';
  visualSeed: number;
  archetype: RoundArchetype;
  pace: Pace;
}

export interface BlockEvent extends BaseEvent {
  type: 'block';
  ordinal: number;
  offsetU: number;
  rotationMd: number;
  behavior: BlockBehavior;
  intensity: Intensity;
  direction: Direction;
}

export interface ZoneChangeEvent extends BaseEvent {
  type: 'zoneChange';
  zone: ZoneChangeTarget;
}

export interface CollapseEvent extends BaseEvent {
  type: 'collapse';
  profile: CollapseProfile;
  intensity: CollapseIntensity;
}

export interface SurviveEvent extends BaseEvent {
  type: 'survive';
  intensity: Intensity;
}

export interface MoonEvent extends BaseEvent {
  type: 'moon';
  variant: MoonVariant;
}

/** Fires once per round for a positive, non-wincap payout. Absent for 0x and for the
 * wincap case (docs/work/TASK-P1-book-contracts.md §1/§2, verified against
 * StakeEngine/math-sdk `set_win_event`). */
export interface SetWinEvent extends BaseEvent {
  type: 'setWin';
  amount: number;
  winLevel: number;
}

export interface SetTotalWinEvent extends BaseEvent {
  type: 'setTotalWin';
  amount: number;
}

/** Replaces `setWin` when the round's payout is the configured wincap (SKYLINE: 10,000x
 * only). Verified against StakeEngine/math-sdk `wincap_event`. */
export interface WincapEvent extends BaseEvent {
  type: 'wincap';
  amount: number;
}

export interface FinalWinEvent extends BaseEvent {
  type: 'finalWin';
  amount: number;
}

export type BookEvent =
  | TowerStartEvent
  | BlockEvent
  | ZoneChangeEvent
  | CollapseEvent
  | SurviveEvent
  | MoonEvent
  | SetWinEvent
  | SetTotalWinEvent
  | WincapEvent
  | FinalWinEvent;

export interface Book {
  id: number;
  /** Prototype-only dev metadata; adapters strip this for production (BOOK_SPEC.md §2). */
  name?: string;
  /** ×100 fixed-point: 1x = 100, 10,000x = 1_000_000 (BOOK_SPEC.md §2). */
  payoutMultiplier: number;
  events: BookEvent[];
}
