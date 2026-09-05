import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogicalBlock, TowerModel } from '../../tower/model';
import { playBookEvents } from '../../book/player';
import type { Book, BookEvent } from '../../book/schema';
import {
  bigClimb100x,
  cleanSurvive150x,
  cruelCollapseSky0x,
  quickCollapseStreet0x,
  weakSurvive050x,
  wobbleWin5x,
} from '../../test-fixtures/books';
import { createDeferred } from '../../test-fixtures/tests/recordingHandlerMap';
import type { TowerRenderer } from './createTowerRenderer';
import type { NearFallResolution } from './nearFall';

// Spies on the REAL applyTowerEvent (via importOriginal — behavior is unchanged, only call
// count becomes observable) rather than adding a test-only accessor to production code. This
// is the smallest legitimate way to verify "the model advances exactly once per event" given
// the model is intentionally closure-private inside createTowerEventHandlers — see
// docs/work/TASK-P4-basic-renderer.md's note on this test-quality decision.
vi.mock('../../tower/model', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../tower/model')>();
  return { ...actual, applyTowerEvent: vi.fn(actual.applyTowerEvent) };
});

const { applyTowerEvent, buildTowerModel, fingerprintTowerModel } = await import('../../tower/model');
const { createTowerEventHandlers, classifyNearFallResolution } = await import('./createTowerEventHandlers');
const applyTowerEventSpy = vi.mocked(applyTowerEvent);

function createRecordingRenderer(): { renderer: TowerRenderer; calls: LogicalBlock[] } {
  const calls: LogicalBlock[] = [];
  return {
    renderer: {
      addBlock: async (block) => {
        calls.push(block);
      },
      collapse: async () => {},
      cancel: () => {},
    },
    calls,
  };
}

function createResolutionRecordingRenderer(): {
  renderer: TowerRenderer;
  resolutions: (NearFallResolution | undefined)[];
} {
  const resolutions: (NearFallResolution | undefined)[] = [];
  return {
    renderer: {
      addBlock: async (_block, nearFallResolution) => {
        resolutions.push(nearFallResolution);
      },
      collapse: async () => {},
      cancel: () => {},
    },
    resolutions,
  };
}

/** A minimal Book-shaped object whose events[0] is a nearFall block and events[1] (if given) is
 * whatever event should be classified against — for testing classifyNearFallResolution's
 * next-index-only rule in isolation. Not a canonical fixture, not run through validateBook (the
 * classification function only ever reads events[index + 1].type, nothing else). */
function bookWithNearFallFollowedBy(nextEvent?: BookEvent): Book {
  const nearFallEvent: BookEvent = {
    index: 0,
    type: 'block',
    ordinal: 1,
    offsetU: 0,
    rotationMd: 0,
    behavior: 'nearFall',
    intensity: 4,
    direction: 1,
  };
  return {
    id: 1,
    payoutMultiplier: 0,
    events: nextEvent ? [nearFallEvent, { ...nextEvent, index: 1 }] : [nearFallEvent],
  };
}

describe('createTowerEventHandlers — P3 model advancement', () => {
  beforeEach(() => {
    applyTowerEventSpy.mockClear();
  });

  it('calls the real applyTowerEvent exactly once per Book event', async () => {
    const book = weakSurvive050x;
    const { renderer } = createRecordingRenderer();

    await playBookEvents(book, createTowerEventHandlers(renderer));

    expect(applyTowerEventSpy).toHaveBeenCalledTimes(book.events.length);
  });
});

describe('createTowerEventHandlers — sequential completion', () => {
  it('does not begin the next event until the current block\'s renderer animation resolves', async () => {
    const book = quickCollapseStreet0x; // towerStart, block, block, block, collapse, setTotalWin, finalWin
    const gate = createDeferred<void>();
    let addBlockCallCount = 0;
    const renderer: TowerRenderer = {
      addBlock: async () => {
        addBlockCallCount += 1;
        await gate.promise;
      },
      collapse: async () => {},
      cancel: () => {},
    };

    const playing = playBookEvents(book, createTowerEventHandlers(renderer));

    // Let towerStart's own trivial (non-block) step settle; nothing can progress past the first
    // block's gated addBlock call until the gate is resolved, however many microtasks pass.
    await Promise.resolve();
    await Promise.resolve();
    expect(addBlockCallCount).toBe(1);

    gate.resolve();
    await playing;
    expect(addBlockCallCount).toBe(3); // all 3 block events in this fixture eventually reached the renderer
  });
});

describe('createTowerEventHandlers — full fixture traversal', () => {
  it('plays a real fixture start-to-finish through the complete handler map without throwing', async () => {
    const book = weakSurvive050x;
    const { renderer, calls } = createRecordingRenderer();

    await expect(playBookEvents(book, createTowerEventHandlers(renderer))).resolves.toBeUndefined();

    const blockEventCount = book.events.filter((event) => event.type === 'block').length;
    expect(calls).toHaveLength(blockEventCount);
  });
});

describe('createTowerEventHandlers — no Book/event mutation', () => {
  it('leaves the Book and its events byte-identical after playback', async () => {
    const book = weakSurvive050x;
    const before = JSON.stringify(book);
    const { renderer } = createRecordingRenderer();

    await playBookEvents(book, createTowerEventHandlers(renderer));

    expect(JSON.stringify(book)).toBe(before);
  });
});

describe('createTowerEventHandlers — deterministic replay', () => {
  it('two independent replays of the same fixture produce the same recorded block sequence', async () => {
    const book = cleanSurvive150x;
    const first = createRecordingRenderer();
    const second = createRecordingRenderer();

    await playBookEvents(book, createTowerEventHandlers(first.renderer));
    await playBookEvents(book, createTowerEventHandlers(second.renderer));

    expect(second.calls).toEqual(first.calls);
  });
});

describe('createTowerEventHandlers — logical fingerprint parity', () => {
  it('the live-playback model fingerprints identically to buildTowerModel for the same Book (P5 exit criterion)', async () => {
    const book = wobbleWin5x; // exercises real wobble blocks, not just clean/offset
    applyTowerEventSpy.mockClear();
    const { renderer } = createRecordingRenderer();

    await playBookEvents(book, createTowerEventHandlers(renderer));

    // applyTowerEvent is pure, so its last invocation's return value IS the final live-playback
    // model — the only way to observe it without adding a getModel accessor to production code.
    const liveModel = applyTowerEventSpy.mock.results.at(-1)?.value as TowerModel;
    expect(fingerprintTowerModel(liveModel)).toBe(fingerprintTowerModel(buildTowerModel(book)));
  });
});

// ==========================================================================================
// P6 — Near-Fall: classifyNearFallResolution (docs/work/TASK-P6-near-fall.md §G)
// ==========================================================================================

describe('classifyNearFallResolution — immediate-next-event-only classification', () => {
  it('nearFall -> collapse = holdForCollapse', () => {
    const book = bookWithNearFallFollowedBy({ index: 0, type: 'collapse', profile: 'leanLeft', intensity: 4 });
    expect(classifyNearFallResolution(book, 0)).toBe('holdForCollapse');
  });

  it('nearFall -> block = recover', () => {
    const book = bookWithNearFallFollowedBy({
      index: 0,
      type: 'block',
      ordinal: 2,
      offsetU: 0,
      rotationMd: 0,
      behavior: 'clean',
      intensity: 0,
      direction: 0,
    });
    expect(classifyNearFallResolution(book, 0)).toBe('recover');
  });

  it('nearFall -> survive = recover', () => {
    const book = bookWithNearFallFollowedBy({ index: 0, type: 'survive', intensity: 2 });
    expect(classifyNearFallResolution(book, 0)).toBe('recover');
  });

  it('nearFall -> moon = recover', () => {
    const book = bookWithNearFallFollowedBy({ index: 0, type: 'moon', variant: 0 });
    expect(classifyNearFallResolution(book, 0)).toBe('recover');
  });

  it('nearFall -> zoneChange = recover', () => {
    const book = bookWithNearFallFollowedBy({ index: 0, type: 'zoneChange', zone: 'skyline' });
    expect(classifyNearFallResolution(book, 0)).toBe('recover');
  });

  it('nearFall -> zoneChange -> collapse (later) = recover -- proves no forward scan', () => {
    const book = bookWithNearFallFollowedBy({ index: 0, type: 'zoneChange', zone: 'skyline' });
    // A collapse exists further in the array, but classification must only ever look at index+1.
    const withLaterCollapse: Book = {
      ...book,
      events: [...book.events, { index: 2, type: 'collapse', profile: 'leanRight', intensity: 4 }],
    };
    expect(classifyNearFallResolution(withLaterCollapse, 0)).toBe('recover');
  });

  it('nearFall -> block -> ... -> collapse much later = recover -- proves classification never considers the eventual terminal outcome', () => {
    const book = bookWithNearFallFollowedBy({
      index: 0,
      type: 'block',
      ordinal: 2,
      offsetU: 0,
      rotationMd: 0,
      behavior: 'clean',
      intensity: 0,
      direction: 0,
    });
    const withLaterCollapse: Book = {
      ...book,
      events: [...book.events, { index: 2, type: 'collapse', profile: 'leanRight', intensity: 4 }],
    };
    expect(classifyNearFallResolution(withLaterCollapse, 0)).toBe('recover');
  });

  it('missing next event (malformed/edge case) defensively defaults to recover', () => {
    const book = bookWithNearFallFollowedBy(undefined);
    expect(classifyNearFallResolution(book, 0)).toBe('recover');
  });

  it('matches real fixture data: cruelCollapseSky0x\'s nearFall (index 7) classifies as recover, despite the Book eventually collapsing 7 events later', () => {
    expect(classifyNearFallResolution(cruelCollapseSky0x, 7)).toBe('recover');
  });

  it('matches real fixture data: bigClimb100x\'s nearFall (index 20) classifies as recover, since the immediate next event is survive, not collapse', () => {
    expect(classifyNearFallResolution(bigClimb100x, 20)).toBe('recover');
  });
});

describe('createTowerEventHandlers — block handler wiring for nearFall', () => {
  it('passes the classified resolution to renderer.addBlock only for nearFall blocks, and never pre-applies/dispatches the following collapse', async () => {
    const book = bookWithNearFallFollowedBy({ index: 0, type: 'collapse', profile: 'leanLeft', intensity: 4 });
    // bookWithNearFallFollowedBy's Book isn't a full playable Book (no towerStart/finalWin) --
    // this test drives the handler map directly against the two events, mirroring how
    // playBookEvent would, without needing a fully valid Book for this narrow wiring check.
    const { renderer, resolutions } = createResolutionRecordingRenderer();
    const handlers = createTowerEventHandlers(renderer);
    const context = { book };

    await handlers.block(book.events[0] as Extract<BookEvent, { type: 'block' }>, context);

    expect(resolutions).toEqual(['holdForCollapse']);
  });

  it('passes undefined resolution for non-nearFall blocks', async () => {
    const book: Book = {
      id: 1,
      payoutMultiplier: 0,
      events: [
        {
          index: 0,
          type: 'block',
          ordinal: 1,
          offsetU: 0,
          rotationMd: 0,
          behavior: 'clean',
          intensity: 0,
          direction: 0,
        },
      ],
    };
    const { renderer, resolutions } = createResolutionRecordingRenderer();
    const handlers = createTowerEventHandlers(renderer);

    await handlers.block(book.events[0] as Extract<BookEvent, { type: 'block' }>, { book });

    expect(resolutions).toEqual([undefined]);
  });
});

// ==========================================================================================
// P7 — Collapse: handler wiring (docs/work/TASK-P7-collapse.md)
// ==========================================================================================

function createCollapseRecordingRenderer(gate?: Promise<void>): {
  renderer: TowerRenderer;
  calls: { profile: string; intensity: number }[];
} {
  const calls: { profile: string; intensity: number }[] = [];
  return {
    renderer: {
      addBlock: async () => {},
      collapse: async (profile, intensity) => {
        calls.push({ profile, intensity });
        if (gate) await gate;
      },
      cancel: () => {},
    },
    calls,
  };
}

describe('createTowerEventHandlers — collapse handler wiring', () => {
  beforeEach(() => {
    applyTowerEventSpy.mockClear();
  });

  it('calls applyTowerEvent exactly once and renderer.collapse exactly once, with the event\'s own unmodified profile/intensity', async () => {
    const book = quickCollapseStreet0x; // real fixture: collapse('leanLeft', 3)
    const { renderer, calls } = createCollapseRecordingRenderer();

    await playBookEvents(book, createTowerEventHandlers(renderer));

    expect(calls).toEqual([{ profile: 'leanLeft', intensity: 3 }]);
    const collapseEvent = book.events.find((e) => e.type === 'collapse');
    expect(applyTowerEventSpy.mock.calls.some(([, event]) => event === collapseEvent)).toBe(true);
    expect(applyTowerEventSpy.mock.calls.filter(([, event]) => event.type === 'collapse')).toHaveLength(1);
  });

  it('passes leanRight/intensity exactly as authored for a different real fixture', async () => {
    const { renderer, calls } = createCollapseRecordingRenderer();
    const book: Book = {
      id: 999,
      payoutMultiplier: 0,
      events: [
        { index: 0, type: 'towerStart', visualSeed: 1, archetype: 'quickCollapse', pace: 'quick' },
        { index: 1, type: 'collapse', profile: 'leanRight', intensity: 2 },
        { index: 2, type: 'setTotalWin', amount: 0 },
        { index: 3, type: 'finalWin', amount: 0 },
      ],
    };

    await playBookEvents(book, createTowerEventHandlers(renderer));

    expect(calls).toEqual([{ profile: 'leanRight', intensity: 2 }]);
  });

  it('awaits the renderer.collapse Promise before resolving -- economic events do not advance until collapse\'s animation completes', async () => {
    const gate = createDeferred<void>();
    let renderedCollapseCallCount = 0;
    const renderer: TowerRenderer = {
      addBlock: async () => {},
      collapse: async () => {
        renderedCollapseCallCount += 1;
        await gate.promise;
      },
      cancel: () => {},
    };
    const book: Book = {
      id: 998,
      payoutMultiplier: 0,
      events: [
        { index: 0, type: 'towerStart', visualSeed: 1, archetype: 'quickCollapse', pace: 'quick' },
        { index: 1, type: 'collapse', profile: 'leanLeft', intensity: 1 },
        { index: 2, type: 'setTotalWin', amount: 0 },
        { index: 3, type: 'finalWin', amount: 0 },
      ],
    };

    const playing = playBookEvents(book, createTowerEventHandlers(renderer));

    await Promise.resolve();
    await Promise.resolve();
    expect(renderedCollapseCallCount).toBe(1);
    // setTotalWin/finalWin are advanceOnly and synchronous once reached -- their effect (P2
    // completing) cannot be observed yet because collapse's own Promise is still gated.
    expect(applyTowerEventSpy.mock.calls.map((call) => call[1].type)).toEqual(['towerStart', 'collapse']);

    gate.resolve();
    await playing;
    expect(applyTowerEventSpy.mock.calls.map((call) => call[1].type)).toEqual([
      'towerStart',
      'collapse',
      'setTotalWin',
      'finalWin',
    ]);
  });

  it('leaves the Book and its events byte-identical after a real collapse playback', async () => {
    const book = cruelCollapseSky0x;
    const before = JSON.stringify(book);
    const { renderer } = createCollapseRecordingRenderer();

    await playBookEvents(book, createTowerEventHandlers(renderer));

    expect(JSON.stringify(book)).toBe(before);
  });
});
