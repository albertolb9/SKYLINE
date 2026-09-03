import { BookBuilder } from '../bookBuilder';
import type { Book } from '../../book/schema';

/**
 * Exclusive 10,000x Max Win sequence: full climb through every zone into Space, the
 * `moon` event, a short stabilization `survive`, then the wincap result events (`setWin`
 * is absent — see docs/work/TASK-P1-book-contracts.md §1/§2). PROTOTYPE_V1.md §5 fixture 11.
 */
export const moonRun10000x: Book = new BookBuilder()
  .towerStart('moonRun', 'exceptional', 1111)
  .block({ behavior: 'clean' })
  .block({ behavior: 'offset', offsetU: 600, rotationMd: 550, direction: 1 })
  .block({ behavior: 'clean' })
  .zoneChange('skyline')
  .block({ behavior: 'clean' })
  .block({ behavior: 'wobble', offsetU: -750, rotationMd: -700, direction: -1, intensity: 2 })
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .zoneChange('sky')
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .block({ behavior: 'offset', offsetU: -650, rotationMd: -600, direction: -1 })
  .zoneChange('atmosphere')
  .block({ behavior: 'clean' })
  .block({ behavior: 'wobble', offsetU: 800, rotationMd: 750, direction: 1, intensity: 3 })
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .zoneChange('space')
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .block({ behavior: 'nearFall', offsetU: 1500, rotationMd: 1600, direction: 1, intensity: 4 })
  .block({ behavior: 'clean' })
  .moon(0)
  .survive(2)
  .wincap(1_000_000)
  .setTotalWin(1_000_000)
  .finalWin(1_000_000)
  .build(11, 1_000_000, 'moon-run-10000x');
