import { describe, expect, it } from 'vitest';
import {
  INITIAL_TOWER_MODEL,
  applyTowerEvent,
  buildTowerModel,
  fingerprintTowerModel,
  fingerprintTowerPlayback,
  type TowerModel,
} from './model';
import type { Book, BlockEvent, BookEvent } from '../book/schema';
import {
  FIXTURE_BOOKS,
  bigClimb100x,
  cleanSurvive150x,
  cruelCollapseSky0x,
  moonRun10000x,
  nearDeathWin20x,
  quickCollapseStreet0x,
  spaceRun1000x,
  spaceRun5000x,
  standardCollapseSkyline0x,
  weakSurvive050x,
  wobbleWin5x,
} from '../test-fixtures/books';

/** Replays a prefix (or full set) of events from INITIAL_TOWER_MODEL. Test-local only — not a
 * production history/event-store utility (see docs/work/TASK-P3-logical-tower-model.md). */
function replay(events: readonly BookEvent[]): TowerModel {
  return events.reduce(applyTowerEvent, INITIAL_TOWER_MODEL);
}

describe('applyTowerEvent — initial/towerStart', () => {
  it('two independent replays of the same fixture agree at every step', () => {
    const book = cleanSurvive150x;
    let a = INITIAL_TOWER_MODEL;
    let b = INITIAL_TOWER_MODEL;
    for (const event of book.events) {
      a = applyTowerEvent(a, event);
      b = applyTowerEvent(b, event);
      expect(a).toEqual(b);
    }
  });

  it('towerStart changes no field', () => {
    const towerStartEvent = quickCollapseStreet0x.events[0];
    expect(towerStartEvent.type).toBe('towerStart');
    const after = applyTowerEvent(INITIAL_TOWER_MODEL, towerStartEvent);
    expect(after).toEqual(INITIAL_TOWER_MODEL);
  });
});

describe('applyTowerEvent — block commitment', () => {
  it('adds exactly one LogicalBlock per block event, with fields copied from that event, in order', () => {
    const book = bigClimb100x; // 4 zones, 17 blocks
    let model = INITIAL_TOWER_MODEL;
    let blockCount = 0;

    for (const event of book.events) {
      const before = model.blocks.length;
      model = applyTowerEvent(model, event);

      if (event.type === 'block') {
        blockCount += 1;
        expect(model.blocks.length).toBe(before + 1);
        expect(model.blocks[model.blocks.length - 1]).toEqual({
          ordinal: event.ordinal,
          offsetU: event.offsetU,
          rotationMd: event.rotationMd,
          behavior: event.behavior,
          intensity: event.intensity,
          direction: event.direction,
        });
      } else {
        expect(model.blocks.length).toBe(before);
      }
    }

    expect(blockCount).toBeGreaterThan(0);
    expect(model.blocks.map((b) => b.ordinal)).toEqual(
      Array.from({ length: blockCount }, (_, i) => i + 1),
    );
  });
});

describe('applyTowerEvent — zoneChange', () => {
  it('updates currentZone and appends to zoneHistory', () => {
    const book = standardCollapseSkyline0x;
    const zoneChangeIndex = book.events.findIndex((e) => e.type === 'zoneChange');
    const before = replay(book.events.slice(0, zoneChangeIndex));
    expect(before.currentZone).toBe('street');
    expect(before.zoneHistory).toEqual(['street']);

    const after = applyTowerEvent(before, book.events[zoneChangeIndex]);
    expect(after.currentZone).toBe('skyline');
    expect(after.zoneHistory).toEqual(['street', 'skyline']);
  });
});

describe('applyTowerEvent — terminal state', () => {
  it('collapse sets terminal from the event alone', () => {
    const book = quickCollapseStreet0x;
    const collapseIndex = book.events.findIndex((e) => e.type === 'collapse');
    const before = replay(book.events.slice(0, collapseIndex));
    expect(before.terminal).toEqual({ status: 'building' });

    const after = applyTowerEvent(before, book.events[collapseIndex]);
    expect(after.terminal).toEqual({ status: 'collapsed', profile: 'leanLeft' });
  });

  it('survive sets terminal from the event alone', () => {
    const book = weakSurvive050x;
    const surviveIndex = book.events.findIndex((e) => e.type === 'survive');
    const before = replay(book.events.slice(0, surviveIndex));
    expect(before.terminal).toEqual({ status: 'building' });

    const after = applyTowerEvent(before, book.events[surviveIndex]);
    expect(after.terminal).toEqual({ status: 'survived' });
  });

  it('an extreme block at the schema range boundary cannot independently collapse the model', () => {
    const extremeBlock: BlockEvent = {
      index: 1,
      type: 'block',
      ordinal: 1,
      offsetU: 3500,
      rotationMd: 4000,
      behavior: 'nearFall',
      intensity: 4,
      direction: 1,
    };
    const after = applyTowerEvent(INITIAL_TOWER_MODEL, extremeBlock);
    expect(after.terminal).toEqual({ status: 'building' });
  });
});

describe('applyTowerEvent — moon', () => {
  it('moon alone (before any survive) sets terminal to moon, and a following survive is a full no-op', () => {
    const book = moonRun10000x;
    const moonIndex = book.events.findIndex((e) => e.type === 'moon');
    const afterMoon = replay(book.events.slice(0, moonIndex + 1));

    expect(afterMoon.terminal).toEqual({ status: 'moon', variant: 0 });
    expect(afterMoon.currentZone).toBe('moon');
    expect(afterMoon.zoneHistory[afterMoon.zoneHistory.length - 1]).toBe('moon');

    const nextEvent = book.events[moonIndex + 1];
    expect(nextEvent.type).toBe('survive'); // sanity: this fixture really exercises moon -> survive

    const afterSurvive = applyTowerEvent(afterMoon, nextEvent);
    expect(afterSurvive).toEqual(afterMoon);
  });
});

describe('applyTowerEvent — economic/result events are no-ops', () => {
  it('setWin leaves the model unchanged', () => {
    const book = cleanSurvive150x;
    const idx = book.events.findIndex((e) => e.type === 'setWin');
    const before = replay(book.events.slice(0, idx));
    expect(applyTowerEvent(before, book.events[idx])).toEqual(before);
  });

  it('setTotalWin leaves the model unchanged', () => {
    const book = cleanSurvive150x;
    const idx = book.events.findIndex((e) => e.type === 'setTotalWin');
    const before = replay(book.events.slice(0, idx));
    expect(applyTowerEvent(before, book.events[idx])).toEqual(before);
  });

  it('wincap leaves the model unchanged', () => {
    const book = moonRun10000x;
    const idx = book.events.findIndex((e) => e.type === 'wincap');
    const before = replay(book.events.slice(0, idx));
    expect(applyTowerEvent(before, book.events[idx])).toEqual(before);
  });

  it('finalWin leaves the model unchanged', () => {
    const book = moonRun10000x;
    const idx = book.events.findIndex((e) => e.type === 'finalWin');
    const before = replay(book.events.slice(0, idx));
    expect(applyTowerEvent(before, book.events[idx])).toEqual(before);
  });
});

describe('buildTowerModel — all 11 fixtures', () => {
  it('all 11 target fixtures are present', () => {
    expect(FIXTURE_BOOKS).toHaveLength(11);
  });

  it.each(FIXTURE_BOOKS.map((book) => [book.name ?? String(book.id), book] as const))(
    '%s builds a TowerModel without throwing',
    (_name, book) => {
      expect(() => buildTowerModel(book)).not.toThrow();
    },
  );

  it('spaceRun5000x ends in Space, survived, and never reaches Moon', () => {
    const model = buildTowerModel(spaceRun5000x);
    expect(model.currentZone).toBe('space');
    expect(model.terminal).toEqual({ status: 'survived' });
    expect(model.zoneHistory).not.toContain('moon');
  });

  it('moonRun10000x ends at Moon with the authored variant', () => {
    const model = buildTowerModel(moonRun10000x);
    expect(model.currentZone).toBe('moon');
    expect(model.terminal).toEqual({ status: 'moon', variant: 0 });
  });

  it.each(
    [quickCollapseStreet0x, standardCollapseSkyline0x, cruelCollapseSky0x].map(
      (book) => [book.name ?? String(book.id), book] as const,
    ),
  )('%s ends collapsed', (_name, book) => {
    expect(buildTowerModel(book).terminal.status).toBe('collapsed');
  });

  it.each(
    [
      weakSurvive050x,
      cleanSurvive150x,
      wobbleWin5x,
      nearDeathWin20x,
      bigClimb100x,
      spaceRun1000x,
      spaceRun5000x,
    ].map((book) => [book.name ?? String(book.id), book] as const),
  )('%s ends survived', (_name, book) => {
    expect(buildTowerModel(book).terminal).toEqual({ status: 'survived' });
  });
});

describe('buildTowerModel — no Book/event mutation', () => {
  it('leaves the Book and its events byte-identical after building a model', () => {
    const book = moonRun10000x;
    const before = JSON.stringify(book);
    buildTowerModel(book);
    expect(JSON.stringify(book)).toBe(before);
  });
});

describe('fingerprintTowerModel — logical identity (no Book)', () => {
  it('same model produces the same fingerprint', () => {
    const a = buildTowerModel(cleanSurvive150x);
    const b = buildTowerModel(cleanSurvive150x);
    expect(fingerprintTowerModel(a)).toBe(fingerprintTowerModel(b));
  });

  it('is independent of Book id and payoutMultiplier', () => {
    const book = cleanSurvive150x;
    const clone: Book = { ...book, id: 999999, payoutMultiplier: 777777 };
    const modelFromOriginal = buildTowerModel(book);
    const modelFromClone = buildTowerModel(clone);
    expect(fingerprintTowerModel(modelFromClone)).toBe(fingerprintTowerModel(modelFromOriginal));
  });

  it('changes when a block field changes', () => {
    const base = buildTowerModel(weakSurvive050x);
    const mutated: TowerModel = {
      ...base,
      blocks: [{ ...base.blocks[0], offsetU: base.blocks[0].offsetU + 1 }, ...base.blocks.slice(1)],
    };
    expect(fingerprintTowerModel(mutated)).not.toBe(fingerprintTowerModel(base));
  });

  it('changes when zoneHistory changes', () => {
    const base = buildTowerModel(weakSurvive050x);
    const mutated: TowerModel = {
      ...base,
      currentZone: 'sky',
      zoneHistory: [...base.zoneHistory, 'sky'],
    };
    expect(fingerprintTowerModel(mutated)).not.toBe(fingerprintTowerModel(base));
  });

  it('changes when terminal state changes', () => {
    const base = buildTowerModel(weakSurvive050x); // terminal: survived
    const mutated: TowerModel = { ...base, terminal: { status: 'collapsed', profile: 'leanLeft' } };
    expect(fingerprintTowerModel(mutated)).not.toBe(fingerprintTowerModel(base));
  });

  it('per-event snapshot fingerprints are identical across two independent replays', () => {
    const book = wobbleWin5x;
    let a = INITIAL_TOWER_MODEL;
    let b = INITIAL_TOWER_MODEL;
    const fingerprintsA: string[] = [];
    const fingerprintsB: string[] = [];

    for (const event of book.events) {
      a = applyTowerEvent(a, event);
      b = applyTowerEvent(b, event);
      fingerprintsA.push(fingerprintTowerModel(a));
      fingerprintsB.push(fingerprintTowerModel(b));
    }

    expect(fingerprintsA).toEqual(fingerprintsB);
  });
});

describe('fingerprintTowerPlayback — §17 literal compliance', () => {
  it('replaying the same Book 100 times produces a byte-identical playback fingerprint', () => {
    const book = spaceRun1000x;
    const first = fingerprintTowerPlayback(book, buildTowerModel(book));
    for (let i = 0; i < 100; i += 1) {
      expect(fingerprintTowerPlayback(book, buildTowerModel(book))).toBe(first);
    }
  });

  it('contains the exact bookId and payoutMultiplier required by TOWER_SYSTEM.md §17', () => {
    const book = bigClimb100x;
    const parsed = JSON.parse(fingerprintTowerPlayback(book, buildTowerModel(book))) as {
      bookId: number;
      payoutMultiplier: number;
    };
    expect(parsed.bookId).toBe(book.id);
    expect(parsed.payoutMultiplier).toBe(book.payoutMultiplier);
  });

  it('changing Book id (identical model) changes the playback fingerprint', () => {
    const book = bigClimb100x;
    const clone: Book = { ...book, id: book.id + 1000 };
    const model = buildTowerModel(book);
    expect(fingerprintTowerPlayback(clone, model)).not.toBe(fingerprintTowerPlayback(book, model));
  });

  it('changing payoutMultiplier (identical model) changes the playback fingerprint', () => {
    const book = bigClimb100x;
    const clone: Book = { ...book, payoutMultiplier: book.payoutMultiplier + 1 };
    const model = buildTowerModel(book);
    expect(fingerprintTowerPlayback(clone, model)).not.toBe(fingerprintTowerPlayback(book, model));
  });
});
