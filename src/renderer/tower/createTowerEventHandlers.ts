// P4 handler factory bridging P2 (event sequencing) + P3 (logical transitions) + the P4
// renderer. See docs/work/TASK-P4-basic-renderer.md for the full P2->P3->renderer integration
// rationale — this is the ONLY place a live playback's running TowerModel is held: a closure
// local to one createTowerEventHandlers(...) call, not shared/module-level state. P2's
// playBookEvents remains the sole owner of live event order; this file never sequences events
// itself and never calls buildTowerModel (a test/tooling convenience, not a production path).

import { applyTowerEvent, INITIAL_TOWER_MODEL, type TowerModel } from '../../tower/model';
import type { Book, BookEvent } from '../../book/schema';
import type { BookEventHandler, BookEventHandlerMap } from '../../book/player';
import type { TowerRenderer } from './createTowerRenderer';
import type { NearFallResolution } from './nearFall';

/**
 * P6 visual-intent classification (docs/work/TASK-P6-near-fall.md §G): a nearFall holds only
 * when the IMMEDIATE next Book event is `collapse` -- a single next-index check, never a forward
 * scan, never a function of the eventual terminal outcome/payoutMultiplier/offsetU/rotationMd/
 * intensity/direction/physics. `validateBook` already guarantees `event.index` equals array
 * position for every event in any Book that reached this layer, so indexing `book.events` by
 * `blockEventIndex + 1` is exact. A missing next event (structurally impossible for a Book that
 * already passed validation, since every Book ends in `finalWin`) defensively defaults to the
 * strictly safer `'recover'` via optional chaining -- never a new validation rule.
 */
export function classifyNearFallResolution(book: Book, blockEventIndex: number): NearFallResolution {
  return book.events[blockEventIndex + 1]?.type === 'collapse' ? 'holdForCollapse' : 'recover';
}

export function createTowerEventHandlers(renderer: TowerRenderer): BookEventHandlerMap {
  let model: TowerModel = INITIAL_TOWER_MODEL;

  const advanceOnly: BookEventHandler<BookEvent> = async (event) => {
    model = applyTowerEvent(model, event);
  };

  return {
    towerStart: advanceOnly,
    block: async (event, context) => {
      model = applyTowerEvent(model, event);
      const block = model.blocks[model.blocks.length - 1];
      const nearFallResolution =
        block.behavior === 'nearFall' ? classifyNearFallResolution(context.book, event.index) : undefined;
      await renderer.addBlock(block, nearFallResolution);
    },
    zoneChange: advanceOnly,
    // P7 (docs/work/TASK-P7-collapse.md): applyTowerEvent commits P3's authoritative
    // collapsed(profile) terminal state FIRST, then the renderer only dramatizes it --
    // profile/intensity are read unchanged from the Book's own event, never decided here. After
    // this Promise resolves, P2 may continue to the following economic/result events
    // (setTotalWin/finalWin) -- collapse ends the NARRATIVE/tower event stream, not the Book
    // itself.
    collapse: async (event) => {
      model = applyTowerEvent(model, event);
      await renderer.collapse(event.profile, event.intensity);
    },
    survive: advanceOnly,
    moon: advanceOnly,
    setWin: advanceOnly,
    setTotalWin: advanceOnly,
    wincap: advanceOnly,
    finalWin: advanceOnly,
  };
}
