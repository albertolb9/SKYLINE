import { BookBuilder } from '../bookBuilder';
import type { Book } from '../../book/schema';

/**
 * High tower, one major recovery beat, then a 0x loss in Sky. Exercises the GAME-008
 * boundary: a 0x Book may reach Sky but must not reach Atmosphere/Space/Moon.
 * PROTOTYPE_V1.md §5 fixture 3.
 */
export const cruelCollapseSky0x: Book = new BookBuilder()
  .towerStart('cruelCollapse', 'normal', 333)
  .block({ behavior: 'clean' })
  .block({ behavior: 'offset', offsetU: -600, rotationMd: -500, direction: -1 })
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .zoneChange('skyline')
  .block({ behavior: 'clean' })
  .block({ behavior: 'nearFall', offsetU: -1500, rotationMd: -1600, direction: -1, intensity: 3 })
  .block({ behavior: 'clean' }) // recovery beat
  .block({ behavior: 'offset', offsetU: 650, rotationMd: 600, direction: 1 })
  .block({ behavior: 'clean' })
  .zoneChange('sky')
  .block({ behavior: 'clean' })
  .block({ behavior: 'wobble', offsetU: 800, rotationMd: 750, direction: 1, intensity: 2 })
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .collapse('leanLeft', 4)
  .setTotalWin(0)
  .finalWin(0)
  .build(3, 0, 'cruel-collapse-sky-0x');
