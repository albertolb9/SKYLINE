// P4 handler factory bridging P2 (event sequencing) + P3 (logical transitions) + the P4
// renderer. See docs/work/TASK-P4-basic-renderer.md for the full P2->P3->renderer integration
// rationale — this is the ONLY place a live playback's running TowerModel is held: a closure
// local to one createTowerEventHandlers(...) call, not shared/module-level state. P2's
// playBookEvents remains the sole owner of live event order; this file never sequences events
// itself and never calls buildTowerModel (a test/tooling convenience, not a production path).

import { applyTowerEvent, INITIAL_TOWER_MODEL, type TowerModel } from '../../tower/model';
import type { BookEvent } from '../../book/schema';
import type { BookEventHandler, BookEventHandlerMap } from '../../book/player';
import type { TowerRenderer } from './createTowerRenderer';

export function createTowerEventHandlers(renderer: TowerRenderer): BookEventHandlerMap {
  let model: TowerModel = INITIAL_TOWER_MODEL;

  const advanceOnly: BookEventHandler<BookEvent> = async (event) => {
    model = applyTowerEvent(model, event);
  };

  return {
    towerStart: advanceOnly,
    block: async (event) => {
      model = applyTowerEvent(model, event);
      const block = model.blocks[model.blocks.length - 1];
      await renderer.addBlock(block);
    },
    zoneChange: advanceOnly,
    collapse: advanceOnly,
    survive: advanceOnly,
    moon: advanceOnly,
    setWin: advanceOnly,
    setTotalWin: advanceOnly,
    wincap: advanceOnly,
    finalWin: advanceOnly,
  };
}
