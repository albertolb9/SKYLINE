# TOWER_SYSTEM.md — Deterministic Tower System V1

**Status:** ACCEPTED for greybox.

## 1. Goal

Create a tower that feels physically unstable while remaining completely deterministic and independent of economic outcome calculation.

## 2. Non-goal

This is not a realistic structural physics simulator. It is a controlled animation system designed for tension, Replay and mobile performance.

## 3. Logical coordinate system

- Logical block width: **10,000 units**.
- Logical block height: **4,000 units**.
- Tower horizontal origin: `0`.
- Event `offsetU` is an integer horizontal placement relative to the intended center/support position.
- Renderer maps logical units to device pixels from current viewport scale.

A Book therefore has identical logical geometry on mobile and desktop.

## 4. Rotation units

`rotationMd` = integer millidegrees.

Examples:

- `1000` = +1.000°
- `-2500` = -2.500°

Prototype Book validation range: ±4,000 md.

## 5. Block placement

When a `block` event is committed:

1. create logical block with ordinal;
2. assign deterministic logical Y from ordinal/block height;
3. apply explicit `offsetU` and `rotationMd`;
4. append to Tower Model;
5. renderer animates into that committed pose.

Runtime collisions may be visual aids only and may not rewrite the committed pose.

## 6. Behaviors

### `clean`
Fast, readable drop/land/settle. Intensity normally 0–1.

### `offset`
Visible off-center placement with mild corrective tower response.

### `wobble`
Landing produces deterministic TowerRoot oscillation. The logical blocks remain committed.

### `slide`
Block visually slides toward its committed endpoint or danger pose using deterministic curve.

### `nearFall`
Largest non-terminal danger behavior. It can transition into recovery if Book continues, or into collapse when the next semantic event is `collapse`.

## 7. Intensity presets

`0 none/clean, 1 low, 2 medium, 3 high, 4 extreme`.

Exact animation timings/angles are prototype-tunable, but values must be centralized in versioned presets rather than scattered magic numbers.

Recommended preset structure:

```ts
type MotionPreset = {
  durationMs: number;
  rootLeanMd: number;
  overshootMd: number;
  cameraImpulseU: number;
  settleMs: number;
};
```

These are visual values only.

## 8. TowerRoot wobble

For cost/performance/control, most global instability is applied to a `TowerRoot` transform around a deterministic pivot rather than simulated across independent rigid bodies.

A wobble curve is a normalized authored function of progress `t ∈ [0,1]`.

Example conceptual phases:

- 0.00 stable
- 0.20 lean toward danger
- 0.45 maximum lean
- 0.70 counter swing
- 0.90 small overshoot
- 1.00 settle

The exact curve will be tuned in prototype and snapshot-tested.

## 9. Resting lean

The tower may retain a small deterministic resting lean derived from its explicit accumulated offsets/rotations. This is presentation only.

Requirements:

- deterministic pure function;
- clamped to safe visual range;
- cannot trigger collapse;
- same Book gives same resting lean;
- formula centralized/tested.

Do not finalize the numerical formula until greybox tuning, but add tests when selected.

## 10. Recovery

Recovery is not necessarily its own Book Event. When a dangerous `block` is followed by continued construction, its handler may execute a deterministic recovery phase before resolving.

Recovery shape:

`critical lean → counter motion → overshoot → small wobble → settle`

A pause near critical lean is allowed to sell danger but must not be so long that the game appears frozen.

## 11. Collapse

Prototype profiles:

- `leanLeft`
- `leanRight`

Collapse is a deterministic presentation sequence. Suggested implementation:

1. increase TowerRoot lean;
2. move/rotate tower out of stability;
3. optionally detach a limited visual subset of blocks for chaos after outcome is already terminal;
4. finish on readable 0x state.

If secondary detached blocks use physics for visual debris, their paths must not affect logical outcome or Replay-critical tower state; seeded deterministic debris is preferred for exact visual Replay.

## 12. Camera

Camera follows tower top using deterministic target positions.

Principles:

- keep current top/next block in safe mobile focus area;
- smooth camera motion independent of frame rate;
- zoneChange may alter camera framing/scale;
- camera does not write Tower Model state;
- quality scaling may reduce shake/noise, not progression.

## 13. Cosmetic PRNG V1

Round-critical behavior is explicit. Cosmetic variation may use a deterministic PRNG.

Initial algorithm: **xorshift32**, unsigned 32-bit semantics.

Pseudo-definition:

```text
if state == 0: state = 0x6D2B79F5
state ^= state << 13
state ^= state >> 17
state ^= state << 5
(all operations uint32)
```

Test vector from seed `123456789`:

1. `2714967881`
2. `2238813396`
3. `1250077441`
4. `3820100336`
5. `3177519686`

Both TypeScript and any offline helper using this algorithm must pass this vector.

Derive event-local cosmetic streams from `towerStart.visualSeed` plus stable event index/key mixing, documented and tested before production generator/frontend share it.

## 14. Cosmetic-only examples

Allowed seeded variation:

- equivalent block skin variant;
- car/bird/satellite variant;
- dust particle positions;
- tiny ambient timing variation;
- micro camera noise within a defined preset.

Not allowed:

- block count;
- terminal zone;
- offsetU/rotationMd for round-critical construction;
- behavior/intensity;
- collapse/survive;
- Moon;
- payout.

## 15. Offline Tower Sequence Generator

The generator builds Book narratives before publication/runtime.

Inputs:

- payout value;
- target terminal zone;
- archetype;
- 3–5 block count per traversed zone;
- generation seed.

Constraints:

- avoid long repeated same-direction offsets unless archetype explicitly wants it;
- ensure quiet blocks between major danger beats;
- limit near-fall count by archetype;
- prevent impossible schema transitions;
- keep terminal event compatible with payout;
- Moon only for 10,000x;
- output explicit round-critical Book fields.

## 16. Archetype danger guidance

| Archetype class | Wobbles | Near-falls | Recovery beats |
|---|---:|---:|---:|
| Quick | 0–1 | 0 | 0 |
| Normal | 1–2 | 0–1 | 0–1 |
| Medium | 2–3 | ~1 | 1–2 |
| Big | 3–4 | 1–2 | 2–3 |
| Huge | 4–6 | 2–3 | 3–4 |
| Moon | authored | authored | authored |

These are content-generation guidelines, not hard economic rules.

## 17. Determinism fingerprint

For tests, the logical playback should serialize a stable fingerprint containing at least:

- Book id;
- payoutMultiplier;
- ordered zones;
- each block ordinal/offsetU/rotationMd/behavior/intensity/direction;
- terminal event/profile;
- Moon variant if present.

Playing the same Book repeatedly must produce the same fingerprint byte-for-byte.

## 18. Forbidden implementation patterns

- `Math.random()` in Book playback.
- physics body falling deciding `collapse`.
- rounding logical positions differently by device and writing them back to state.
- reading FPS to choose behavior.
- visual seed altering payout or Book path.
- renderer silently correcting invalid Book fields.
