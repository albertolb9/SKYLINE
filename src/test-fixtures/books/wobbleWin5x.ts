import { BookBuilder } from '../bookBuilder';
import type { Book } from '../../book/schema';

/** Multiple wobble beats in both directions, resolves 5x in Sky. PROTOTYPE_V1.md §5 fixture 6. */
export const wobbleWin5x: Book = new BookBuilder()
  .towerStart('wobbleWin', 'normal', 666)
  .block({ behavior: 'clean' })
  .block({ behavior: 'wobble', offsetU: -750, rotationMd: -700, direction: -1, intensity: 2 })
  .block({ behavior: 'clean' })
  .zoneChange('skyline')
  .block({ behavior: 'clean' })
  .block({ behavior: 'wobble', offsetU: 800, rotationMd: 750, direction: 1, intensity: 2 })
  .block({ behavior: 'offset', offsetU: -650, rotationMd: -600, direction: -1 })
  .block({ behavior: 'clean' })
  .zoneChange('sky')
  .block({ behavior: 'clean' })
  .block({ behavior: 'wobble', offsetU: -850, rotationMd: -800, direction: -1, intensity: 3 })
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .survive(2)
  .setWin(500)
  .setTotalWin(500)
  .finalWin(500)
  .build(6, 500, 'wobble-win-5x');
