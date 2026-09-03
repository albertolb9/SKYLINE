// Representative single Book Events, kept independent from any whole Book. Reused by
// src/book/validate.test.ts for small negative-test fragments, and positioned as the
// location P9 (Storybook isolated-event stories) can pull individual events from later
// (docs/PROTOTYPE_V1.md P9) without depending on a full fixture Book.
//
// `index` values are representative placeholders — callers spread-override `index` (and
// any ordinal/zone-dependent fields) to fit the sequence they're composing.

import type {
  BlockEvent,
  CollapseEvent,
  FinalWinEvent,
  MoonEvent,
  SetTotalWinEvent,
  SetWinEvent,
  SurviveEvent,
  TowerStartEvent,
  WincapEvent,
  ZoneChangeEvent,
} from '../book/schema';

export const sampleTowerStart: TowerStartEvent = {
  index: 0,
  type: 'towerStart',
  visualSeed: 123456789,
  archetype: 'standardCollapse',
  pace: 'normal',
};

export const sampleBlockClean: BlockEvent = {
  index: 1,
  type: 'block',
  ordinal: 1,
  offsetU: 100,
  rotationMd: 100,
  behavior: 'clean',
  intensity: 0,
  direction: 0,
};

export const sampleBlockOffsetLeft: BlockEvent = {
  index: 1,
  type: 'block',
  ordinal: 1,
  offsetU: -600,
  rotationMd: -500,
  behavior: 'offset',
  intensity: 1,
  direction: -1,
};

export const sampleBlockWobbleRight: BlockEvent = {
  index: 1,
  type: 'block',
  ordinal: 1,
  offsetU: 750,
  rotationMd: 700,
  behavior: 'wobble',
  intensity: 2,
  direction: 1,
};

export const sampleBlockNearFallLeft: BlockEvent = {
  index: 1,
  type: 'block',
  ordinal: 1,
  offsetU: -1500,
  rotationMd: -1600,
  behavior: 'nearFall',
  intensity: 3,
  direction: -1,
};

export const sampleBlockNearFallRight: BlockEvent = {
  index: 1,
  type: 'block',
  ordinal: 1,
  offsetU: 1500,
  rotationMd: 1600,
  behavior: 'nearFall',
  intensity: 3,
  direction: 1,
};

export const sampleZoneChangeSkyline: ZoneChangeEvent = {
  index: 0,
  type: 'zoneChange',
  zone: 'skyline',
};

export const sampleCollapseLeft: CollapseEvent = {
  index: 0,
  type: 'collapse',
  profile: 'leanLeft',
  intensity: 4,
};

export const sampleCollapseRight: CollapseEvent = {
  index: 0,
  type: 'collapse',
  profile: 'leanRight',
  intensity: 4,
};

export const sampleSurvive: SurviveEvent = {
  index: 0,
  type: 'survive',
  intensity: 2,
};

export const sampleMoon: MoonEvent = {
  index: 0,
  type: 'moon',
  variant: 0,
};

export const sampleSetWin: SetWinEvent = {
  index: 0,
  type: 'setWin',
  amount: 500,
  winLevel: 0,
};

export const sampleSetTotalWin: SetTotalWinEvent = {
  index: 0,
  type: 'setTotalWin',
  amount: 500,
};

export const sampleWincap: WincapEvent = {
  index: 0,
  type: 'wincap',
  amount: 1_000_000,
};

export const sampleFinalWin: FinalWinEvent = {
  index: 0,
  type: 'finalWin',
  amount: 500,
};
