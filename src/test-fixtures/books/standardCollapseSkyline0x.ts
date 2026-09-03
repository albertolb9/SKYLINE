import { BookBuilder } from '../bookBuilder';
import type { Book } from '../../book/schema';

/** Normal-tension 0x loss, reaches Skyline. PROTOTYPE_V1.md §5 fixture 2. */
export const standardCollapseSkyline0x: Book = new BookBuilder()
  .towerStart('standardCollapse', 'normal', 222)
  .block({ behavior: 'clean' })
  .block({ behavior: 'offset', offsetU: 600, rotationMd: 500, direction: 1 })
  .block({ behavior: 'clean' })
  .block({ behavior: 'wobble', offsetU: -750, rotationMd: -700, direction: -1, intensity: 2 })
  .zoneChange('skyline')
  .block({ behavior: 'clean' })
  .block({ behavior: 'offset', offsetU: 700, rotationMd: 650, direction: 1 })
  .block({ behavior: 'wobble', offsetU: 800, rotationMd: 750, direction: 1, intensity: 2 })
  .block({ behavior: 'clean' })
  .collapse('leanRight', 3)
  .setTotalWin(0)
  .finalWin(0)
  .build(2, 0, 'standard-collapse-skyline-0x');
