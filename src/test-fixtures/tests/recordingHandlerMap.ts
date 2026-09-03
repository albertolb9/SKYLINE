// Test-only recording handler map for src/book/player.test.ts. Records a start/end log
// entry around every event, optionally delegating to a caller-supplied hook (e.g. a
// deferred promise, or a rejection) to prove sequencing/failure semantics. Not a
// production abstraction — lives under test-fixtures and is consumed only by tests.

import type { BookEvent } from '../../book/schema';
import type { BookEventContext, BookEventHandlerMap } from '../../book/player';

export interface RecordedEntry {
  phase: 'start' | 'end';
  type: BookEvent['type'];
  index: number;
}

export type RecordingHandlerHook = (
  event: BookEvent,
  context: BookEventContext,
) => Promise<void> | void;

export interface RecordingHandlerMap {
  handlerMap: BookEventHandlerMap;
  log: RecordedEntry[];
}

/**
 * Complete (all 10 event types) no-op/recording handler map. `onEvent`, if given, runs
 * between the recorded "start" and "end" entries for every event — tests use it to inject
 * deferred promises (to prove ordering) or rejections (to prove failure semantics).
 */
export function createRecordingHandlerMap(onEvent?: RecordingHandlerHook): RecordingHandlerMap {
  const log: RecordedEntry[] = [];

  const handler = async (event: BookEvent, context: BookEventContext): Promise<void> => {
    log.push({ phase: 'start', type: event.type, index: event.index });
    if (onEvent) await onEvent(event, context);
    log.push({ phase: 'end', type: event.type, index: event.index });
  };

  const handlerMap: BookEventHandlerMap = {
    towerStart: handler,
    block: handler,
    zoneChange: handler,
    collapse: handler,
    survive: handler,
    moon: handler,
    setWin: handler,
    setTotalWin: handler,
    wincap: handler,
    finalWin: handler,
  };

  return { handlerMap, log };
}

/** A promise you resolve/reject manually from outside — for deterministic sequencing
 * proofs without timers. */
export function createDeferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
