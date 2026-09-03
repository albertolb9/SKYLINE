import { describe, expect, it } from 'vitest';
import {
  MissingBookEventHandlerError,
  playBookEvent,
  playBookEvents,
  type BookEventContext,
  type BookEventHandlerMap,
} from './player';
import type { Book, BookEvent } from './schema';
import {
  FIXTURE_BOOKS,
  cleanSurvive150x,
  quickCollapseStreet0x,
  spaceRun1000x,
  standardCollapseSkyline0x,
  weakSurvive050x,
} from '../test-fixtures/books';
import { createDeferred, createRecordingHandlerMap } from '../test-fixtures/tests/recordingHandlerMap';

describe('playBookEvents — ordering (test matrix #1, #4)', () => {
  it('executes events in exact Book order', async () => {
    const book = quickCollapseStreet0x;
    const { handlerMap, log } = createRecordingHandlerMap();

    await playBookEvents(book, handlerMap);

    const expected = book.events.flatMap((event) => [
      { phase: 'start', type: event.type, index: event.index },
      { phase: 'end', type: event.type, index: event.index },
    ]);
    expect(log).toEqual(expected);
  });

  it('produces the same observed sequence on repeated playback of the same fixture', async () => {
    const book = cleanSurvive150x;
    const first = createRecordingHandlerMap();
    const second = createRecordingHandlerMap();

    await playBookEvents(book, first.handlerMap);
    await playBookEvents(book, second.handlerMap);

    expect(second.log).toEqual(first.log);
  });
});

describe('playBookEvents — strict sequential await (test matrix #2, #3)', () => {
  it('does not begin event N+1 until event N handler resolves', async () => {
    const book = quickCollapseStreet0x;
    const event0 = createDeferred<void>();
    const { handlerMap, log } = createRecordingHandlerMap((event) => {
      if (event.index === 0) return event0.promise;
    });

    const playing = playBookEvents(book, handlerMap);

    // Synchronous check, no await yet: only event 0's start can possibly have run.
    expect(log).toEqual([{ phase: 'start', type: 'towerStart', index: 0 }]);

    event0.resolve();
    await playing;

    expect(log.length).toBe(book.events.length * 2);
    expect(log[1]).toEqual({ phase: 'end', type: 'towerStart', index: 0 });
    expect(log[2]).toEqual({ phase: 'start', type: 'block', index: 1 });
  });

  it('never has more than one handler in flight at once (rules out Promise.all)', async () => {
    const book = quickCollapseStreet0x;
    let entered = 0;
    const gate = createDeferred<void>();
    const { handlerMap } = createRecordingHandlerMap(() => {
      entered += 1;
      return gate.promise;
    });

    const playing = playBookEvents(book, handlerMap);

    // A Promise.all-based implementation would have synchronously invoked every
    // handler up to its first await in this same tick, making `entered` equal the
    // full event count already. Strict sequential await can only have entered the
    // very first handler by this point.
    expect(entered).toBe(1);

    gate.resolve();
    await playing;

    expect(entered).toBe(book.events.length);
  });
});

describe('playBookEvents — failure semantics (test matrix #5, #6)', () => {
  it('rejects on a missing handler and never starts a later event', async () => {
    const book = standardCollapseSkyline0x; // zoneChange occurs mid-sequence, at index 5
    const { handlerMap, log } = createRecordingHandlerMap();
    const incomplete: Partial<BookEventHandlerMap> = { ...handlerMap };
    delete incomplete.zoneChange;

    await expect(playBookEvents(book, incomplete)).rejects.toThrow(MissingBookEventHandlerError);

    const startedIndices = log.filter((entry) => entry.phase === 'start').map((entry) => entry.index);
    expect(startedIndices).toEqual([0, 1, 2, 3, 4]);
  });

  it('propagates a handler rejection unchanged and stops the sequence immediately', async () => {
    const book = weakSurvive050x;
    const failure = new Error('synthetic handler failure');
    const { handlerMap, log } = createRecordingHandlerMap((event) => {
      if (event.index === 2) throw failure;
    });

    await expect(playBookEvents(book, handlerMap)).rejects.toBe(failure);

    const startedIndices = log.filter((entry) => entry.phase === 'start').map((entry) => entry.index);
    const endedIndices = log.filter((entry) => entry.phase === 'end').map((entry) => entry.index);
    expect(startedIndices).toEqual([0, 1, 2]);
    expect(endedIndices).toEqual([0, 1]); // event 2 started but never reached its "end" record
  });
});

describe('playBookEvents — context ownership (test matrix #7)', () => {
  it('supplies context.book as the exact Book being played, for every event', async () => {
    const book = cleanSurvive150x;
    const observedBooks: Book[] = [];
    let observedEventAtIndex2: BookEvent | undefined;
    const { handlerMap } = createRecordingHandlerMap((event, context) => {
      observedBooks.push(context.book);
      if (event.index === 2) observedEventAtIndex2 = event;
    });

    await playBookEvents(book, handlerMap);

    expect(observedBooks.every((observed) => observed === book)).toBe(true);
    expect(observedEventAtIndex2).toBe(book.events[2]);
  });

  it('playBookEvent (the lower-level primitive) trusts whatever context it is given directly', async () => {
    // Deliberately mismatched: the event comes from bookA, the context from bookB.
    // playBookEvents can never produce this (it owns context construction from the
    // one Book it's given); this proves the guarantee lives specifically there, not
    // as an incidental property of playBookEvent itself.
    const bookA = quickCollapseStreet0x;
    const bookB = cleanSurvive150x;
    const mismatchedContext: BookEventContext = { book: bookB };
    let seenBook: Book | undefined;
    const handlerMap: Partial<BookEventHandlerMap> = {
      towerStart: async (_event, context) => {
        seenBook = context.book;
      },
    };

    await playBookEvent(bookA.events[0], handlerMap, mismatchedContext);

    expect(seenBook).toBe(bookB);
  });
});

describe('playBookEvents — all 11 P1 fixtures (test matrix #8)', () => {
  it('all 11 target fixtures are present', () => {
    expect(FIXTURE_BOOKS).toHaveLength(11);
  });

  it.each(FIXTURE_BOOKS.map((book) => [book.name ?? String(book.id), book] as const))(
    '%s plays start-to-finish with a complete no-op/recording handler map',
    async (_name, book) => {
      const { handlerMap, log } = createRecordingHandlerMap();
      await expect(playBookEvents(book, handlerMap)).resolves.toBeUndefined();
      expect(log.length).toBe(book.events.length * 2);
    },
  );
});

describe('playBookEvents — no Book mutation (test matrix #9)', () => {
  it('leaves the Book and its events byte-identical after playback', async () => {
    const book = spaceRun1000x;
    const before = JSON.stringify(book);
    const { handlerMap } = createRecordingHandlerMap();

    await playBookEvents(book, handlerMap);

    expect(JSON.stringify(book)).toBe(before);
  });
});

describe('playBookEvent — unit behavior', () => {
  it('awaits the resolved handler before resolving itself', async () => {
    const event = quickCollapseStreet0x.events[0];
    const context: BookEventContext = { book: quickCollapseStreet0x };
    const gate = createDeferred<void>();
    let handlerFinished = false;
    const handlerMap: Partial<BookEventHandlerMap> = {
      towerStart: async () => {
        await gate.promise;
        handlerFinished = true;
      },
    };

    const playing = playBookEvent(event, handlerMap, context);
    expect(handlerFinished).toBe(false);

    gate.resolve();
    await playing;
    expect(handlerFinished).toBe(true);
  });

  it('throws a MissingBookEventHandlerError with useful diagnostics when no handler exists', async () => {
    const event = quickCollapseStreet0x.events[0]; // towerStart, index 0
    const context: BookEventContext = { book: quickCollapseStreet0x };
    const handlerMap: Partial<BookEventHandlerMap> = { block: async () => {} };

    await expect(playBookEvent(event, handlerMap, context)).rejects.toThrow(
      MissingBookEventHandlerError,
    );

    try {
      await playBookEvent(event, handlerMap, context);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MissingBookEventHandlerError);
      const missingHandlerError = error as MissingBookEventHandlerError;
      expect(missingHandlerError.eventType).toBe('towerStart');
      expect(missingHandlerError.eventIndex).toBe(0);
      expect(missingHandlerError.message).toContain('towerStart');
      expect(missingHandlerError.message).toContain('0');
      expect(missingHandlerError.message).toContain('block');
    }
  });
});
