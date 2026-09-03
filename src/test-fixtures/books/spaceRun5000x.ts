import { BookBuilder } from '../bookBuilder';
import type { Book } from '../../book/schema';

/**
 * Reaches Space and resolves 5,000x — deliberately does NOT include a `moon` event.
 * Exercises the BOOK-007 boundary (Moon exclusive to 10,000x) from the other side: a huge
 * Space win that stops just short of Max Win. PROTOTYPE_V1.md §5 fixture 10.
 */
export const spaceRun5000x: Book = new BookBuilder()
  .towerStart('spaceRun', 'exceptional', 1010)
  .block({ behavior: 'clean' })
  .block({ behavior: 'offset', offsetU: -600, rotationMd: -550, direction: -1 })
  .block({ behavior: 'clean' })
  .zoneChange('skyline')
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .block({ behavior: 'offset', offsetU: 650, rotationMd: 600, direction: 1 })
  .zoneChange('sky')
  .block({ behavior: 'clean' })
  .block({ behavior: 'wobble', offsetU: -800, rotationMd: -750, direction: -1, intensity: 2 })
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .zoneChange('atmosphere')
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .block({ behavior: 'wobble', offsetU: 850, rotationMd: 800, direction: 1, intensity: 3 })
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .zoneChange('space')
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .block({ behavior: 'nearFall', offsetU: -1500, rotationMd: -1600, direction: -1, intensity: 4 })
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .survive(4)
  .setWin(500000)
  .setTotalWin(500000)
  .finalWin(500000)
  .build(10, 500000, 'space-run-5000x');
