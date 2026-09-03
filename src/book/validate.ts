// Runtime validator for the Book/Event contract (docs/BOOK_SPEC.md). Hand-written on
// purpose — see docs/work/TASK-P1-book-contracts.md §5 for why a schema library
// (Zod/Valibot) was evaluated and rejected for V1.
//
// Fails loudly (throws) on the first violation found, per CLAUDE.md §8/§11 and
// REQUIREMENTS.md QA-006 — invalid Book data must never silently fall back.

import { isOnPayoutLadder, WINCAP_X100 } from './payout';
import type { Book, CollapseProfile, Pace, RoundArchetype, BlockBehavior, Zone } from './schema';

export class BookValidationError extends Error {
  readonly eventIndex?: number;

  constructor(message: string, eventIndex?: number) {
    super(eventIndex === undefined ? message : `event[${eventIndex}]: ${message}`);
    this.name = 'BookValidationError';
    this.eventIndex = eventIndex;
  }
}

function fail(message: string, eventIndex?: number): never {
  throw new BookValidationError(message, eventIndex);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

const ROUND_ARCHETYPES = new Set<RoundArchetype>([
  'quickCollapse',
  'standardCollapse',
  'cruelCollapse',
  'weakSurvive',
  'cleanSurvive',
  'wobbleWin',
  'nearDeathWin',
  'bigClimb',
  'spaceRun',
  'moonRun',
]);

const PACES = new Set<Pace>(['quick', 'normal', 'long', 'exceptional']);
const BLOCK_BEHAVIORS = new Set<BlockBehavior>(['clean', 'offset', 'wobble', 'slide', 'nearFall']);
const COLLAPSE_PROFILES = new Set<CollapseProfile>(['leanLeft', 'leanRight']);

/** The 5 real zones a Book traverses via zoneChange; Moon is reached only via `moon`. */
const ZONE_PROGRESSION: readonly Zone[] = ['street', 'skyline', 'sky', 'atmosphere', 'space'];

type NarrativeState = 'building' | 'afterMoon' | 'closed';

export function validateBook(input: unknown): Book {
  if (!isRecord(input)) fail('Book must be an object');

  const { id, name, payoutMultiplier, events } = input;

  if (typeof id !== 'number' || !Number.isInteger(id)) fail('Book.id must be an integer');
  if (name !== undefined && typeof name !== 'string') {
    fail('Book.name must be a string when present');
  }
  if (typeof payoutMultiplier !== 'number' || !isOnPayoutLadder(payoutMultiplier)) {
    fail(`Book.payoutMultiplier must be a value on Payout Ladder V1, got ${String(payoutMultiplier)}`);
  }
  if (!Array.isArray(events) || events.length === 0) {
    fail('Book.events must be a non-empty array');
  }

  let towerStartSeen = false;
  let nextBlockOrdinal = 1;
  let currentZoneIdx = 0;
  let blocksInSegment = 0;
  let moonSeen = false;
  let narrativeState: NarrativeState = 'building';

  type SeenResultEvent = { index: number; amount: number };
  let setWinEvt: SeenResultEvent | undefined;
  let setTotalWinEvt: SeenResultEvent | undefined;
  let wincapEvt: SeenResultEvent | undefined;
  let finalWinEvt: SeenResultEvent | undefined;

  const finalizeZoneSegment = (i: number) => {
    if (blocksInSegment < 3 || blocksInSegment > 5) {
      fail(
        `zone "${ZONE_PROGRESSION[currentZoneIdx]}" has ${blocksInSegment} block events, expected 3-5`,
        i,
      );
    }
  };

  events.forEach((rawEvent, i) => {
    if (!isRecord(rawEvent)) fail(`must be an object`, i);
    if (rawEvent.index !== i) fail(`index must equal array position ${i}`, i);

    const type = rawEvent.type;

    switch (type) {
      case 'towerStart': {
        if (i !== 0) fail('towerStart must be at index 0', i);
        if (towerStartSeen) fail('duplicate towerStart', i);
        towerStartSeen = true;
        if (!isInt(rawEvent.visualSeed, 0, 4_294_967_295)) {
          fail('visualSeed must be a uint32', i);
        }
        if (typeof rawEvent.archetype !== 'string' || !ROUND_ARCHETYPES.has(rawEvent.archetype as RoundArchetype)) {
          fail(`unknown archetype "${String(rawEvent.archetype)}"`, i);
        }
        if (typeof rawEvent.pace !== 'string' || !PACES.has(rawEvent.pace as Pace)) {
          fail(`unknown pace "${String(rawEvent.pace)}"`, i);
        }
        break;
      }

      case 'block': {
        if (narrativeState !== 'building') fail('block event after terminal event', i);
        if (rawEvent.ordinal !== nextBlockOrdinal) {
          fail(`ordinal must be ${nextBlockOrdinal} (contiguous from 1)`, i);
        }
        nextBlockOrdinal += 1;
        blocksInSegment += 1;
        if (!isInt(rawEvent.offsetU, -3500, 3500)) fail('offsetU out of range [-3500, 3500]', i);
        if (!isInt(rawEvent.rotationMd, -4000, 4000)) fail('rotationMd out of range [-4000, 4000]', i);
        if (typeof rawEvent.behavior !== 'string' || !BLOCK_BEHAVIORS.has(rawEvent.behavior as BlockBehavior)) {
          fail(`unknown behavior "${String(rawEvent.behavior)}"`, i);
        }
        if (!isInt(rawEvent.intensity, 0, 4)) fail('intensity out of range [0, 4]', i);
        if (rawEvent.direction !== -1 && rawEvent.direction !== 0 && rawEvent.direction !== 1) {
          fail('direction must be -1, 0 or 1', i);
        }
        break;
      }

      case 'zoneChange': {
        if (narrativeState !== 'building') fail('zoneChange after terminal event', i);
        const targetIdx = ZONE_PROGRESSION.indexOf(rawEvent.zone as Zone);
        if (targetIdx !== currentZoneIdx + 1) {
          fail(`zoneChange to "${String(rawEvent.zone)}" does not move exactly one zone forward`, i);
        }
        if (payoutMultiplier === 0 && (rawEvent.zone === 'atmosphere' || rawEvent.zone === 'space')) {
          fail('0x Book cannot reach Atmosphere or Space (GAME-008)', i);
        }
        finalizeZoneSegment(i);
        currentZoneIdx = targetIdx;
        blocksInSegment = 0;
        break;
      }

      case 'collapse': {
        if (narrativeState !== 'building') fail('collapse after terminal event', i);
        if (payoutMultiplier !== 0) fail('collapse only allowed when payoutMultiplier === 0', i);
        if (!COLLAPSE_PROFILES.has(rawEvent.profile as CollapseProfile)) {
          fail(`unknown collapse profile "${String(rawEvent.profile)}"`, i);
        }
        if (!isInt(rawEvent.intensity, 1, 4)) fail('collapse intensity out of range [1, 4]', i);
        finalizeZoneSegment(i);
        narrativeState = 'closed';
        break;
      }

      case 'survive': {
        if (narrativeState !== 'building' && narrativeState !== 'afterMoon') {
          fail('survive after terminal event', i);
        }
        if (payoutMultiplier <= 0) fail('survive only allowed when payoutMultiplier > 0', i);
        if (!isInt(rawEvent.intensity, 0, 4)) fail('survive intensity out of range [0, 4]', i);
        if (narrativeState === 'building') finalizeZoneSegment(i);
        narrativeState = 'closed';
        break;
      }

      case 'moon': {
        if (narrativeState !== 'building') fail('moon after terminal event', i);
        if (payoutMultiplier !== WINCAP_X100) fail('moon only allowed when payoutMultiplier === 10,000x', i);
        if (currentZoneIdx !== ZONE_PROGRESSION.length - 1) fail('moon only allowed after zoneChange:space', i);
        if (moonSeen) fail('duplicate moon', i);
        if (rawEvent.variant !== 0 && rawEvent.variant !== 1 && rawEvent.variant !== 2) {
          fail('moon variant must be 0, 1 or 2', i);
        }
        moonSeen = true;
        finalizeZoneSegment(i);
        narrativeState = 'afterMoon';
        break;
      }

      case 'setWin': {
        if (narrativeState === 'building') fail('setWin before terminal event', i);
        if (setWinEvt) fail('duplicate setWin', i);
        if (typeof rawEvent.amount !== 'number') fail('amount must be a number', i);
        if (typeof rawEvent.winLevel !== 'number') fail('winLevel must be a number', i);
        setWinEvt = { index: i, amount: rawEvent.amount };
        break;
      }

      case 'setTotalWin': {
        if (narrativeState === 'building') fail('setTotalWin before terminal event', i);
        if (setTotalWinEvt) fail('duplicate setTotalWin', i);
        if (typeof rawEvent.amount !== 'number') fail('amount must be a number', i);
        setTotalWinEvt = { index: i, amount: rawEvent.amount };
        break;
      }

      case 'wincap': {
        if (narrativeState === 'building') fail('wincap before terminal event', i);
        if (wincapEvt) fail('duplicate wincap', i);
        if (typeof rawEvent.amount !== 'number') fail('amount must be a number', i);
        wincapEvt = { index: i, amount: rawEvent.amount };
        break;
      }

      case 'finalWin': {
        if (narrativeState === 'building') fail('finalWin before terminal event', i);
        if (finalWinEvt) fail('duplicate finalWin', i);
        if (typeof rawEvent.amount !== 'number') fail('amount must be a number', i);
        finalWinEvt = { index: i, amount: rawEvent.amount };
        break;
      }

      default:
        fail(`unknown event type "${String(type)}"`, i);
    }
  });

  if (!towerStartSeen) fail('missing towerStart');
  if (payoutMultiplier === WINCAP_X100 && !moonSeen) {
    fail('missing moon for a 10,000x Book (BOOK-T008)');
  }

  // Result events: payout-class-conditional presence, per the verified official
  // setWin/wincap/setTotalWin/finalWin shapes (docs/work/TASK-P1-book-contracts.md §1/§2).
  if (!finalWinEvt) fail('missing finalWin');
  if (finalWinEvt.index !== events.length - 1) fail('finalWin must be the last event', finalWinEvt.index);
  if (finalWinEvt.amount !== payoutMultiplier) {
    fail('finalWin.amount must equal payoutMultiplier', finalWinEvt.index);
  }

  if (!setTotalWinEvt) fail('missing setTotalWin');
  if (setTotalWinEvt.amount !== payoutMultiplier) {
    fail('setTotalWin.amount must equal payoutMultiplier', setTotalWinEvt.index);
  }

  if (payoutMultiplier === 0) {
    if (setWinEvt) fail('setWin must be absent for a 0x Book', setWinEvt.index);
    if (wincapEvt) fail('wincap must be absent for a 0x Book', wincapEvt.index);
  } else if (payoutMultiplier === WINCAP_X100) {
    if (setWinEvt) fail('setWin must be absent when wincap applies', setWinEvt.index);
    if (!wincapEvt) fail('missing wincap for a 10,000x Book');
    if (wincapEvt.amount !== payoutMultiplier) {
      fail('wincap.amount must equal payoutMultiplier', wincapEvt.index);
    }
  } else {
    if (wincapEvt) fail('wincap only allowed when payoutMultiplier === 10,000x', wincapEvt.index);
    if (!setWinEvt) fail('missing setWin for a positive, non-wincap Book');
    if (setWinEvt.amount !== payoutMultiplier) {
      fail('setWin.amount must equal payoutMultiplier', setWinEvt.index);
    }
  }

  return input as unknown as Book;
}
