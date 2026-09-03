// Deterministic test/fixture-authoring helper. This is NOT the offline Tower Sequence
// Generator described in docs/TOWER_SYSTEM.md §15 (which decides narrative content from
// payout/seed inputs) — every field here is explicitly supplied by the caller. This helper
// only centralizes the purely mechanical bookkeeping (sequential `index`/`ordinal`
// counters) that BOOK_SPEC.md §2 already asks to centralize rather than hand-duplicate,
// so P1 fixtures and tests don't hand-compute running indices across up to ~26 events.

import type {
  Book,
  BlockBehavior,
  BookEvent,
  CollapseProfile,
  Direction,
  Intensity,
  MoonVariant,
  Pace,
  RoundArchetype,
  Zone,
} from '../book/schema';

type ZoneChangeTarget = Exclude<Zone, 'street' | 'moon'>;

type BlockOverrides = {
  offsetU?: number;
  rotationMd?: number;
  behavior?: BlockBehavior;
  intensity?: Intensity;
  direction?: Direction;
};

export class BookBuilder {
  private readonly events: BookEvent[] = [];
  private nextIndex = 0;
  private nextOrdinal = 1;

  towerStart(archetype: RoundArchetype, pace: Pace, visualSeed = 1): this {
    this.events.push({ index: this.nextIndex++, type: 'towerStart', visualSeed, archetype, pace });
    return this;
  }

  block(overrides: BlockOverrides = {}): this {
    this.events.push({
      index: this.nextIndex++,
      type: 'block',
      ordinal: this.nextOrdinal++,
      offsetU: overrides.offsetU ?? 100,
      rotationMd: overrides.rotationMd ?? 100,
      behavior: overrides.behavior ?? 'clean',
      intensity: overrides.intensity ?? 0,
      direction: overrides.direction ?? 0,
    });
    return this;
  }

  blocks(count: number, overrides: BlockOverrides = {}): this {
    for (let k = 0; k < count; k += 1) this.block(overrides);
    return this;
  }

  zoneChange(zone: ZoneChangeTarget): this {
    this.events.push({ index: this.nextIndex++, type: 'zoneChange', zone });
    return this;
  }

  collapse(profile: CollapseProfile, intensity: 1 | 2 | 3 | 4 = 4): this {
    this.events.push({ index: this.nextIndex++, type: 'collapse', profile, intensity });
    return this;
  }

  survive(intensity: Intensity = 2): this {
    this.events.push({ index: this.nextIndex++, type: 'survive', intensity });
    return this;
  }

  moon(variant: MoonVariant = 0): this {
    this.events.push({ index: this.nextIndex++, type: 'moon', variant });
    return this;
  }

  setWin(amount: number, winLevel = 0): this {
    this.events.push({ index: this.nextIndex++, type: 'setWin', amount, winLevel });
    return this;
  }

  setTotalWin(amount: number): this {
    this.events.push({ index: this.nextIndex++, type: 'setTotalWin', amount });
    return this;
  }

  wincap(amount: number): this {
    this.events.push({ index: this.nextIndex++, type: 'wincap', amount });
    return this;
  }

  finalWin(amount: number): this {
    this.events.push({ index: this.nextIndex++, type: 'finalWin', amount });
    return this;
  }

  build(id: number, payoutMultiplier: number, name?: string): Book {
    return { id, name, payoutMultiplier, events: this.events };
  }
}
