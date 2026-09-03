// Barrel for the P1 fixture Book set (PROTOTYPE_V1.md §5). This is the seam a later
// fixture selector (P2/P9) and Book Player replay tests import from — nothing here plays
// a Book back.

import type { Book } from '../../book/schema';
import { quickCollapseStreet0x } from './quickCollapseStreet0x';
import { standardCollapseSkyline0x } from './standardCollapseSkyline0x';
import { cruelCollapseSky0x } from './cruelCollapseSky0x';
import { weakSurvive050x } from './weakSurvive050x';
import { cleanSurvive150x } from './cleanSurvive150x';
import { wobbleWin5x } from './wobbleWin5x';
import { nearDeathWin20x } from './nearDeathWin20x';
import { bigClimb100x } from './bigClimb100x';
import { spaceRun1000x } from './spaceRun1000x';
import { spaceRun5000x } from './spaceRun5000x';
import { moonRun10000x } from './moonRun10000x';

export {
  quickCollapseStreet0x,
  standardCollapseSkyline0x,
  cruelCollapseSky0x,
  weakSurvive050x,
  cleanSurvive150x,
  wobbleWin5x,
  nearDeathWin20x,
  bigClimb100x,
  spaceRun1000x,
  spaceRun5000x,
  moonRun10000x,
};

export const FIXTURE_BOOKS: readonly Book[] = [
  quickCollapseStreet0x,
  standardCollapseSkyline0x,
  cruelCollapseSky0x,
  weakSurvive050x,
  cleanSurvive150x,
  wobbleWin5x,
  nearDeathWin20x,
  bigClimb100x,
  spaceRun1000x,
  spaceRun5000x,
  moonRun10000x,
];
