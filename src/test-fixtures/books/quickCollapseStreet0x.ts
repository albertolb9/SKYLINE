import { BookBuilder } from '../bookBuilder';
import type { Book } from '../../book/schema';

/** Fast 0x loss, all in Street. PROTOTYPE_V1.md §5 fixture 1. */
export const quickCollapseStreet0x: Book = new BookBuilder()
  .towerStart('quickCollapse', 'quick', 111)
  .block({ behavior: 'clean' })
  .block({ behavior: 'offset', offsetU: -600, rotationMd: -500, direction: -1 })
  .block({ behavior: 'clean' })
  .collapse('leanLeft', 3)
  .setTotalWin(0)
  .finalWin(0)
  .build(1, 0, 'quick-collapse-street-0x');
