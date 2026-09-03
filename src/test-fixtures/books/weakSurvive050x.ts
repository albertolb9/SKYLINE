import { BookBuilder } from '../bookBuilder';
import type { Book } from '../../book/schema';

/**
 * 0.50x weak/neutral survive — presentation must stay neutral, never celebratory
 * (GAME-009). PROTOTYPE_V1.md §5 fixture 4.
 */
export const weakSurvive050x: Book = new BookBuilder()
  .towerStart('weakSurvive', 'normal', 444)
  .block({ behavior: 'clean' })
  .block({ behavior: 'offset', offsetU: 550, rotationMd: 500, direction: 1 })
  .block({ behavior: 'clean' })
  .zoneChange('skyline')
  .block({ behavior: 'clean' })
  .block({ behavior: 'offset', offsetU: -600, rotationMd: -550, direction: -1 })
  .block({ behavior: 'clean' })
  .survive(0)
  .setWin(50)
  .setTotalWin(50)
  .finalWin(50)
  .build(4, 50, 'weak-survive-050x');
