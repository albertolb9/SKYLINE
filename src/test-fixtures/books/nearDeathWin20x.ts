import { BookBuilder } from '../bookBuilder';
import type { Book } from '../../book/schema';

/**
 * One major near-fall followed by recovery, resolves 20x in Sky. PROTOTYPE_V1.md §5
 * fixture 7 ("near-death-win-20x"). 20x is the nearest Payout Ladder V1 value to the
 * Near-Death Win archetype's descriptive target (MATH_SPEC.md §2 has no 25x entry — the
 * ladder steps 20x -> 30x).
 */
export const nearDeathWin20x: Book = new BookBuilder()
  .towerStart('nearDeathWin', 'long', 777)
  .block({ behavior: 'clean' })
  .block({ behavior: 'offset', offsetU: 600, rotationMd: 550, direction: 1 })
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .zoneChange('skyline')
  .block({ behavior: 'clean' })
  .block({ behavior: 'wobble', offsetU: -750, rotationMd: -700, direction: -1, intensity: 2 })
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .zoneChange('sky')
  .block({ behavior: 'clean' })
  .block({ behavior: 'nearFall', offsetU: 1500, rotationMd: 1600, direction: 1, intensity: 4 })
  .block({ behavior: 'clean' }) // recovery
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .survive(3)
  .setWin(2000)
  .setTotalWin(2000)
  .finalWin(2000)
  .build(7, 2000, 'near-death-win-20x');
