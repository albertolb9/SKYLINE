import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogicalBlock } from '../../tower/model';
import { playBookEvents } from '../../book/player';
import { cleanSurvive150x, quickCollapseStreet0x, weakSurvive050x } from '../../test-fixtures/books';
import { createDeferred } from '../../test-fixtures/tests/recordingHandlerMap';
import type { TowerRenderer } from './createTowerRenderer';

// Spies on the REAL applyTowerEvent (via importOriginal — behavior is unchanged, only call
// count becomes observable) rather than adding a test-only accessor to production code. This
// is the smallest legitimate way to verify "the model advances exactly once per event" given
// the model is intentionally closure-private inside createTowerEventHandlers — see
// docs/work/TASK-P4-basic-renderer.md's note on this test-quality decision.
vi.mock('../../tower/model', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../tower/model')>();
  return { ...actual, applyTowerEvent: vi.fn(actual.applyTowerEvent) };
});

const { applyTowerEvent } = await import('../../tower/model');
const { createTowerEventHandlers } = await import('./createTowerEventHandlers');
const applyTowerEventSpy = vi.mocked(applyTowerEvent);

function createRecordingRenderer(): { renderer: TowerRenderer; calls: LogicalBlock[] } {
  const calls: LogicalBlock[] = [];
  return {
    renderer: {
      addBlock: async (block) => {
        calls.push(block);
      },
      cancel: () => {},
    },
    calls,
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
