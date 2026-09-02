# BOOK_SPEC.md — SKYLINE Book/Event Contract V1

**Status:** Prototype schema ACCEPTED; production Math SDK event helpers to be reconciled during math integration.

## 1. Principle

Books describe the deterministic narrative state of a round. Handlers can expand one semantic Book Event into multiple visual/audio/camera actions.

Do not store every animation frame.

## 2. Production Book envelope

Stake currently requires production simulations to include at least:

```json
{
  "id": 123,
  "events": [],
  "payoutMultiplier": 2500
}
```

`payoutMultiplier` representation must follow current Math SDK/publication format. The lookup table payout for the same simulation must match exactly.

For the prototype, use the current documented math-file representation consistently: **100 = 1.00x** (therefore 50 = 0.50x and 1,000,000 = 10,000x). Centralize conversion in one helper; do not scatter `/100` arithmetic across UI/renderer code. Re-verify this representation when the production Math SDK revision is frozen.

Prototype fixtures MAY also include non-published metadata such as `name` for developer readability, but adapters must strip/ignore it for production.

## 3. Event common fields

All custom events:

```ts
type BaseEvent = {
  index: number;   // zero-based sequence index, continuous within Book
  type: string;
};
```

Validation rules:

- indices start at 0;
- strictly increase by 1;
- event order is semantic;
- unknown type = development/test failure.

## 4. Custom event vocabulary

V1 custom events:

1. `towerStart`
2. `block`
3. `zoneChange`
4. `collapse`
5. `survive`
6. `moon`

Win/result events should use current official Math SDK-compatible events where practical, particularly `setTotalWin` / `finalWin` and wincap output. Do not invent a second monetary contract until generated SDK output is inspected.

## 5. `towerStart`

Purpose: initialize deterministic round presentation.

```ts
type TowerStartEvent = BaseEvent & {
  type: 'towerStart';
  visualSeed: number;        // uint32, cosmetic PRNG root
  archetype: RoundArchetype;
  pace: 'quick' | 'normal' | 'long' | 'exceptional';
};
```

Constraints:

- exactly one;
- must be event index 0;
- `visualSeed` cannot decide payout/zone/outcome.

## 6. `block`

Purpose: commit one logical block and describe its round-critical behavior.

```ts
type BlockEvent = BaseEvent & {
  type: 'block';
  ordinal: number;            // 1-based block count
  offsetU: number;            // integer logical horizontal offset
  rotationMd: number;         // integer millidegrees
  behavior: 'clean' | 'offset' | 'wobble' | 'slide' | 'nearFall';
  intensity: 0 | 1 | 2 | 3 | 4;
  direction: -1 | 0 | 1;
};
```

Initial V1 validation ranges:

- `offsetU`: `[-3500, +3500]` where block width is 10,000 logical units.
- `rotationMd`: `[-4000, +4000]` (= -4° to +4°).
- `direction`: `0` only where behavior does not require a directional lean/slide.
- `ordinal` increments by one for each block event.

These ranges are prototype tuning bounds, not physical stability thresholds.

### Handler implication

A `block` handler may perform:

`spawn/drop → land → impact → block placement commit → wobble/slide/near-fall → recovery/settle → camera follow → cosmetic VFX/audio`

If the next semantic Book Event is `collapse`, a dangerous block may hold at its critical point and transition into collapse instead of recovering.

## 7. `zoneChange`

Purpose: explicitly change current environmental zone.

```ts
type ZoneChangeEvent = BaseEvent & {
  type: 'zoneChange';
  zone: 'skyline' | 'sky' | 'atmosphere' | 'space';
};
```

Notes:

- Book starts in Street; no initial `zoneChange` to Street is required.
- Moon is not represented as `zoneChange`; use `moon`.
- Handler may trigger background, camera, lighting, environmental actors and audio layers implied by the zone.

## 8. `collapse`

Purpose: terminal visual resolution for 0x.

```ts
type CollapseEvent = BaseEvent & {
  type: 'collapse';
  profile: 'leanLeft' | 'leanRight';
  intensity: 1 | 2 | 3 | 4;
};
```

Prototype begins with only two profiles. No real rigid-body result calculation.

Validation:

- only allowed when Book payout is 0x;
- no later `block`, `zoneChange`, `survive` or `moon` event.

## 9. `survive`

Purpose: terminal tower stabilization for payout >0x.

```ts
type SurviveEvent = BaseEvent & {
  type: 'survive';
  intensity: 0 | 1 | 2 | 3 | 4;
};
```

Validation:

- only allowed when payout >0x;
- Moon Book may use `survive` after `moon` if the final authored sequence requires a stabilization beat; exact ordering must be identical across fixture/generator and handler tests.

## 10. `moon`

Purpose: exclusive Max Win presentation event.

```ts
type MoonEvent = BaseEvent & {
  type: 'moon';
  variant: 0 | 1 | 2; // prototype authored variants; may expand only deliberately
};
```

Validation:

- only valid if Book payout == 10,000x;
- only valid after `zoneChange: space`;
- exactly one per Max Win Book;
- forbidden in all other Books.

## 11. Win events

Current Math SDK exposes reusable win/final/wincap event helpers. Prototype fixtures should mirror the current sample event shapes only after the bootstrap inspects the exact official generated format used by the chosen SDK revision.

Minimum semantic requirement:

- Book ends with final payout data that agrees exactly with `payoutMultiplier`;
- 0x ends with final total 0;
- Max Win emits the official wincap/final-win semantics required by current SDK output.

Do **not** hardcode a custom `skylinePayout` event.

## 12. Example conceptual Book — 0x Cruel Collapse

```json
{
  "id": 101,
  "payoutMultiplier": 0,
  "events": [
    {"index":0,"type":"towerStart","visualSeed":817263,"archetype":"cruelCollapse","pace":"normal"},
    {"index":1,"type":"block","ordinal":1,"offsetU":100,"rotationMd":100,"behavior":"clean","intensity":0,"direction":0},
    {"index":2,"type":"block","ordinal":2,"offsetU":-600,"rotationMd":-500,"behavior":"offset","intensity":1,"direction":-1},
    {"index":3,"type":"block","ordinal":3,"offsetU":750,"rotationMd":700,"behavior":"wobble","intensity":2,"direction":1},
    {"index":4,"type":"zoneChange","zone":"skyline"},
    {"index":5,"type":"block","ordinal":4,"offsetU":-1500,"rotationMd":-1600,"behavior":"nearFall","intensity":3,"direction":-1},
    {"index":6,"type":"block","ordinal":5,"offsetU":300,"rotationMd":300,"behavior":"clean","intensity":0,"direction":0},
    {"index":7,"type":"collapse","profile":"leanRight","intensity":4}
  ]
}
```

Example omits final SDK monetary events for readability; production validation must require them in the generated Book shape.

## 13. Generator rules

Offline generator inputs:

- payout;
- chosen terminal zone from Height Distribution;
- archetype;
- per-zone block counts (3–5);
- deterministic generation seed.

Generator outputs all round-critical events explicitly. Runtime does not regenerate the narrative from payout.

## 14. Validation invariants

- event indices contiguous;
- exactly one towerStart at index 0;
- block ordinals contiguous;
- zone transitions only move forward one official zone at a time;
- normal zones respect chosen 3–5 block plan;
- `collapse` iff payout == 0;
- `survive` iff payout >0;
- `moon` iff payout == 10,000x;
- no events after final monetary resolution;
- Book payout matches final win data;
- no round-critical field can be generated from unseeded runtime randomness.
