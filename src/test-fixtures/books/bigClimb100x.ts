import { BookBuilder } from '../bookBuilder';
import type { Book } from '../../book/schema';

/**
 * Height/world escalation carries most of the spectacle; a quiet stretch precedes one
 * major danger beat late in Atmosphere before resolving 100x. PROTOTYPE_V1.md §5 fixture 8.
 */
export const bigClimb100x: Book = new BookBuilder()
  .towerStart('bigClimb', 'long', 888)
  .block({ behavior: 'clean' })
  .block({ behavior: 'offset', offsetU: -600, rotationMd: -550, direction: -1 })
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .zoneChange('skyline')
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .block({ behavior: 'offset', offsetU: 650, rotationMd: 600, direction: 1 })
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .zoneChange('sky')
  .block({ behavior: 'clean' })
  .block({ behavior: 'wobble', offsetU: -800, rotationMd: -750, direction: -1, intensity: 2 })
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .zoneChange('atmosphere')
  .block({ behavior: 'clean' }) // quiet stretch
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .block({ behavior: 'nearFall', offsetU: 1500, rotationMd: 1600, direction: 1, intensity: 4 })
  .survive(3)
  .setWin(10000)
  .setTotalWin(10000)
  .finalWin(10000)
  .build(8, 10000, 'big-climb-100x');
