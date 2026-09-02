# MATH_SPEC.md — SKYLINE Math Specification V1

**Status:** Math Distribution V1 LOCKED  
**RTP:** 96.00%  
**Max Win:** 10,000x  
**Current base modes:** one V1 economic mode  
**Distribution:** B2

## 1. Economic model

SKYLINE is a discrete-outcome game. Stake Engine selects a static simulation/Book according to its lookup weight. The selected Book has a fixed payout multiplier; frontend tower behavior does not calculate or change it.

## 2. Payout Ladder V1 — LOCKED

`0x, 0.25x, 0.50x, 0.75x, 1x, 1.25x, 1.50x, 2x, 2.5x, 3x, 4x, 5x, 7.5x, 10x, 15x, 20x, 30x, 50x, 75x, 100x, 150x, 250x, 500x, 1,000x, 2,500x, 5,000x, 10,000x`

No additional payout values may be introduced without superseding D-008/D-009.

## 3. Math Distribution V1 (B2) — LOCKED

The `Canonical weight` column is a normalized analytical representation on a total weight of 10,000,000. It is useful for exact checks and initial generation design; the production optimizer may use different uint64 weight magnitudes only if the resulting exact distribution remains compliant with the locked model or is deliberately superseded.

`Stake payoutMultiplier` below follows the current official math-file example convention where 1150 represents 11.5x. Re-check the current SDK representation during implementation rather than duplicating conversion logic ad hoc.

| Payout | Probability | Canonical weight / 10M | Stake payoutMultiplier | Approx. individual frequency |
|---:|---:|---:|---:|---:|
| 0x | 44.00000% | 4,400,000 | 0 | 1 / 2.27 |
| 0.25x | 8.68436% | 868,436 | 25 | 1 / 11.51 |
| 0.5x | 8.66844% | 866,844 | 50 | 1 / 11.54 |
| 0.75x | 8.64720% | 864,720 | 75 | 1 / 11.56 |
| 1x | 6.67905% | 667,905 | 100 | 1 / 14.97 |
| 1.25x | 6.66844% | 666,844 | 125 | 1 / 15.00 |
| 1.5x | 6.65251% | 665,251 | 150 | 1 / 15.03 |
| 2x | 1.93509% | 193,509 | 200 | 1 / 51.68 |
| 2.5x | 1.92872% | 192,872 | 250 | 1 / 51.85 |
| 3x | 1.92234% | 192,234 | 300 | 1 / 52.02 |
| 4x | 1.91385% | 191,385 | 400 | 1 / 52.25 |
| 5x | 0.75213% | 75,213 | 500 | 1 / 133 |
| 7.5x | 0.74787% | 74,787 | 750 | 1 / 134 |
| 10x | 0.18250% | 18,250 | 1,000 | 1 / 548 |
| 15x | 0.18165% | 18,165 | 1,500 | 1 / 551 |
| 20x | 0.18079% | 18,079 | 2,000 | 1 / 553 |
| 30x | 0.18006% | 18,006 | 3,000 | 1 / 555 |
| 50x | 0.03029% | 3,029 | 5,000 | 1 / 3,301 |
| 75x | 0.01700% | 1,700 | 7,500 | 1 / 5,882 |
| 100x | 0.01100% | 1,100 | 10,000 | 1 / 9,091 |
| 150x | 0.00650% | 650 | 15,000 | 1 / 15,385 |
| 250x | 0.00400% | 400 | 25,000 | 1 / 25,000 |
| 500x | 0.00300% | 300 | 50,000 | 1 / 33,333 |
| 1000x | 0.00200% | 200 | 100,000 | 1 / 50,000 |
| 2500x | 0.00100% | 100 | 250,000 | 1 / 100,000 |
| 5000x | 0.00020% | 20 | 500,000 | 1 / 500,000 |
| 10000x | 0.00001% | 1 | 1,000,000 | 1 / 10,000,000 |

### Exact checks

- Sum of probabilities = **100.00000%**.
- Weighted mean payout = **0.9600000000x**.
- RTP = **96.00000%**.
- 0x = **44.00000%**.
- 0 < payout < 1x = **26.00000%**.
- payout ≥1x = **30.00000%**.
- payout ≥2x = **10.00000%**.
- payout ≥5x = **2.30000%**.
- payout ≥10x = **0.80000%**.
- Moon / 10,000x = **0.00001% = 1 in 10,000,000**.

## 4. Threshold hit rates

| Threshold | Probability | Approx. frequency |
|---:|---:|---:|
| ≥1x | 30.00000% | ~1 / 3 |
| ≥2x | 10.00000% | ~1 / 10 |
| ≥5x | 2.30000% | ~1 / 43 |
| ≥10x | 0.80000% | ~1 / 125 |
| ≥50x | 0.07500% | ~1 / 1,333 |
| ≥100x | 0.02771% | ~1 / 3,609 |
| ≥250x | 0.01021% | ~1 / 9,794 |
| ≥500x | 0.00621% | ~1 / 16,103 |
| ≥1,000x | 0.00321% | ~1 / 31,153 |
| ≥2,500x | 0.00121% | ~1 / 82,645 |
| ≥5,000x | 0.00021% | ~1 / 476,190 |
| ≥10,000x | 0.00001% | ~1 / 10,000,000 |

These values supersede any rough threshold frequencies previously discussed in chat.

## 5. Monotonicity rule

For the locked B2 ladder, every successive larger payout has an individual probability less than or equal to the preceding smaller payout. This prevents cases such as 100x being easier to hit than 50x.

Automated validation SHALL assert this property unless a future distribution deliberately supersedes it.

## 6. RTP contribution by range

| Range | Probability mass | RTP contribution |
|---|---:|---:|
| 0x | 44.00000% | 0.00000% |
| 0–<1x | 26.00000% | 12.99071% |
| 1–<2x | 20.00000% | 24.993365% |
| 2–<5x | 7.70000% | 22.11440% |
| 5–<10x | 1.50000% | 9.369675% |
| 10–<50x | 0.72500% | 13.56735% |
| 50–<250x | 0.06479% | 4.86450% |
| 250–<1,000x | 0.00700% | 2.50000% |
| 1,000–<10,000x | 0.00320% | 5.50000% |
| 10,000x | 0.00001% | 0.10000% |
| **TOTAL** | **100.00000%** | **96.00000%** |

## 7. Max Win / wincap

- Game wincap target: 10,000x.
- 10,000x Books SHALL be recorded/identified as max-win criteria through the current official Math SDK mechanisms.
- Moon presentation is separate from mathematical wincap authority.
- Math SDK final win/wincap events remain the economic source; `moon` is a custom presentation event.

## 8. Height is not math

Height Distribution V1 allocates payout outcomes to narrative terminal zones after the economic payout is known. It MUST NOT alter the payout probability table.

A 100x Book may end in different allowed zones/visual narratives while remaining exactly 100x economically.

## 9. Simulation/generation strategy

Production intent:

1. define criteria covering 0x, max win and useful payout/visual classes;
2. generate many static simulations/Books with varied deterministic tower narratives;
3. ensure Books contain enough visual variety per common payout;
4. optimize/assign lookup weights;
5. run exact probability/RTP analysis;
6. verify Book ↔ lookup payout integrity;
7. publish only after all math tests pass.

Current official Stake documentation recommends beginning with small uncompressed simulation sets for debugging and typically 100k+ simulations per mode for production-ready diversity. This is guidance, not a fixed SKYLINE Book count requirement.

## 10. Required automated math checks

- `sum(probabilities) == 1` within exact integer/decimal representation.
- `sum(probability * payout) == 0.96`.
- Max payout == 10,000x.
- No payout outside Payout Ladder V1.
- B2 monotonic individual probability rule.
- 10,000x probability target == 1/10,000,000 under locked model.
- Lookup payout values exactly match Book payout values.
- Every lookup ID resolves to one Book.
- Every published Book ID has the required lookup record.

## 11. Official references

- https://stake-engine.com/docs/math
- https://stake-engine.com/docs/math/math-file-format
- https://stake-engine.com/docs/math/quick-start
- https://stake-engine.com/docs/math/game-state-structure/setup/distribution
- https://stake-engine.com/docs/math/source-files/outputs
- https://stake-engine.com/docs/math/source-files/events
- https://github.com/StakeEngine/math-sdk
