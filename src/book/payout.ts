// Centralized ×100 fixed-point <-> multiplier conversion (BOOK_SPEC.md §2: "100 = 1.00x").
// Do not scatter this arithmetic elsewhere — every payout-adjacent module imports from here.

/** Payout Ladder V1 (MATH_SPEC.md §2), expressed in the ×100 fixed-point Book convention. */
export const PAYOUT_LADDER_X100: readonly number[] = [
  0, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000,
  7500, 10000, 15000, 25000, 50000, 100000, 250000, 500000, 1_000_000,
];

export const WINCAP_X100 = 1_000_000;

export function isOnPayoutLadder(payoutMultiplierX100: number): boolean {
  return PAYOUT_LADDER_X100.includes(payoutMultiplierX100);
}

/** ×100 fixed-point Book value -> actual multiplier, e.g. 250 -> 2.5. */
export function toMultiplier(payoutMultiplierX100: number): number {
  return payoutMultiplierX100 / 100;
}

/** Actual multiplier -> ×100 fixed-point Book value, e.g. 2.5 -> 250. */
export function fromMultiplier(multiplier: number): number {
  return Math.round(multiplier * 100);
}
