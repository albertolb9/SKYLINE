// Sequential Book Player (docs/ARCHITECTURE.md §5). Execution semantics only — no
// handlers, no Tower Model, no rendering live here. See
// docs/work/TASK-P2-sequential-book-player.md for the verified official Stake pattern
// this mirrors and the one deliberate divergence (missing handlers throw here; the
// official default is a console.error-and-continue soft fail, which conflicts with
// REQUIREMENTS.md BOOK-010/QA-006).

import type { Book, BookEvent } from './schema';

export interface BookEventContext {
  readonly book: Book;
}

export type BookEventHandler<E extends BookEvent> = (
  event: E,
  context: BookEventContext,
) => Promise<void>;

/** Complete, per-key-narrowed handler map — the "every event type has a handler" shape
 * BOOK-003 describes. Callers may supply a `Partial` of this during incremental
 * development/tests; `playBookEvent` enforces completeness against whatever Book is
 * actually played, at runtime. */
export type BookEventHandlerMap = {
  [E in BookEvent as E['type']]: BookEventHandler<E>;
};

export class MissingBookEventHandlerError extends Error {
  constructor(
    public readonly eventType: string,
    public readonly eventIndex: number,
    registeredTypes: readonly string[],
  ) {
    super(
      `No handler registered for Book event type "${eventType}" (event index ${eventIndex}). ` +
        `Registered handler types: ${registeredTypes.join(', ') || '(none)'}.`,
    );
    this.name = 'MissingBookEventHandlerError';
  }
}

/**
 * Plays one BookEvent through the matching handler. Lower-level primitive: takes an
 * explicit context rather than a Book, so it stays reusable in isolation (e.g. a later
 * single-event Storybook story) without requiring a full Book.
 */
export async function playBookEvent(
  event: BookEvent,
  handlerMap: Partial<BookEventHandlerMap>,
  context: BookEventContext,
): Promise<void> {
  const handler = handlerMap[event.type];
  if (!handler) {
    throw new MissingBookEventHandlerError(event.type, event.index, Object.keys(handlerMap));
  }
  // `event`'s static type here is the full BookEvent union, not the specific member `E`
  // that `handler`'s lookup-by-key established at runtime — TypeScript cannot correlate
  // "which union member the key selected" with "which union member `event` is" through a
  // dynamic property access, even though they are always the same event. This cast is the
  // sole, localized dispatch-boundary workaround for that known limitation; nothing else
  // in this file is cast.
  await handler(event as never, context);
}

/**
 * Plays every event in a Book strictly in array order — event N+1 never starts until
 * event N's handler has fully resolved. No Promise.all, no parallelism, no retry. A
 * handler that throws/rejects propagates immediately and unchanged; no later event runs.
 *
 * Sole owner of BookEventContext construction: builds `{ book }` once from the exact Book
 * being played and reuses it for every event, so `context.book` can never diverge from
 * the Book actually being played — there is no parameter through which a caller could
 * supply a different one.
 */
export async function playBookEvents(
  book: Book,
  handlerMap: Partial<BookEventHandlerMap>,
): Promise<void> {
  const context: BookEventContext = { book };
  for (const event of book.events) {
    await playBookEvent(event, handlerMap, context);
  }
}
