import { BookBuilder } from '../bookBuilder';
import type { Book } from '../../book/schema';

/** Low-tension 1.50x survive. PROTOTYPE_V1.md §5 fixture 5. */
export const cleanSurvive150x: Book = new BookBuilder()
  .towerStart('cleanSurvive', 'normal', 555)
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .block({ behavior: 'offset', offsetU: 600, rotationMd: 550, direction: 1 })
  .block({ behavior: 'clean' })
  .zoneChange('skyline')
  .block({ behavior: 'clean' })
  .block({ behavior: 'offset', offsetU: -600, rotationMd: -550, direction: -1 })
  .block({ behavior: 'clean' })
  .block({ behavior: 'clean' })
  .survive(1)
  .setWin(150)
  .setTotalWin(150)
  .finalWin(150)
  .build(5, 150, 'clean-survive-150x');
