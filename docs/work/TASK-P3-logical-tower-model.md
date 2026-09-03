# TASK-P3-logical-tower-model

**Scope:** `PROTOTYPE_V1.md` §7 P3 — Logical Tower Model only. The deterministic,
framework-independent state derived from a validated Book's events, plus two fingerprint
functions for determinism testing. No Pixi, no rendering, no animation/timing, no camera, no
RGS, no P4+.

**Requirement IDs:** TOWER-001, TOWER-002, TOWER-004, TOWER-005, BOOK-002, BOOK-004, BOOK-005,
QA-003. Governing spec: `docs/ARCHITECTURE.md` §6 (Logical Tower Model), `docs/TOWER_SYSTEM.md`
(units/placement/fingerprint), `docs/GAME_SPEC.md` §8 (terminal events).

## Two nuances resolved rather than left implicit

1. **Moon is itself a terminal event, not a survive-dependent waypoint.** `GAME_SPEC.md` §8
   (LOCKED): "Terminal events: `collapse`; `survive`; `moon` followed by Max Win resolution."
   `BOOK_SPEC.md` §9's "Moon Book may use `survive` after `moon`... for a stabilization beat"
   describes an optional additional presentation beat riding on an already-terminal round, not
   a requirement for reaching terminal status — confirmed structurally in `validate.ts` (the
   `moon` case requires `narrativeState === 'building'`; the `survive` case explicitly permits
   firing from `'afterMoon'`, i.e. after `moon` has already advanced state). `TowerTerminalState`
   therefore has a 4th variant, `{status:'moon', variant}`, set unconditionally by `moon`; a
   subsequent `survive` is a full no-op once `terminal.status === 'moon'` ("once moon, always
   moon") — the only conditional in `applyTowerEvent`, and the only order P1's validator can
   ever produce between the two.
2. **Two fingerprint functions, not one.** `TOWER_SYSTEM.md` §17 explicitly lists Book id and
   payoutMultiplier as fingerprint content — normative, not optional. But folding them into a
   function meant to represent a Tower Model's *logical* identity would make two Books with
   identical tower geometry report different "model" fingerprints purely from bookkeeping
   metadata, and would make cross-fixture distinctness trivially true from id alone rather than
   proving anything about tower content. Resolution: `fingerprintTowerModel(model)` (no Book —
   logical-content-only identity) and `fingerprintTowerPlayback(book, model)` (satisfies §17
   literally) are separate, separately-named, separately-tested functions; neither substitutes
   for the other.

## Chosen state shape

```ts
type TowerTerminalState =
  | { status: 'building' }
  | { status: 'collapsed'; profile: CollapseProfile }
  | { status: 'survived' }
  | { status: 'moon'; variant: MoonVariant };

interface LogicalBlock {
  ordinal: number; offsetU: number; rotationMd: number;
  behavior: BlockBehavior; intensity: Intensity; direction: Direction;
}

interface TowerModel {
  blocks: readonly LogicalBlock[];
  currentZone: Zone;
  zoneHistory: readonly Zone[];
  terminal: TowerTerminalState;
}
```

`LogicalBlock` is exactly the 6 fields `TOWER_SYSTEM.md` §17 lists for the fingerprint.
`zoneHistory` (ordered, starts `['street']`) satisfies §17's "ordered zones"; `currentZone`
(always `zoneHistory`'s last entry) is kept as its own field because `ARCHITECTURE.md` §6 names
"current zone" directly — a small deliberate redundancy, not an oversight, traced to two
different locked passages. **`currentZone` is not duplicated inside either fingerprint's
serialized output** — both fingerprints serialize `zoneHistory` only, since it's the canonical
ordered representation and `currentZone` is always its last element for valid model state; this
is intentional, not an omission.

Deliberately excluded, each traced rather than assumed: `archetype`/`pace`/`visualSeed` (not in
`ARCHITECTURE.md` §6's list or §17's fingerprint list; remain reachable via the Book itself),
resting lean (`TOWER_SYSTEM.md` §9: "Do not finalize the numerical formula until greybox
tuning"), any pixel/Y-coordinate field (a pure function of `ordinal` alone, zero P3 consumers,
deferred to whichever phase first renders), collapse/survive `intensity` on `terminal` (§17 says
"terminal event/profile" — profile only; a real P4 handler already receives the full event
directly from the Book Player).

## Event → model transitions

| Event | Effect |
|---|---|
| `towerStart` | no-op |
| `block` | append `{ordinal, offsetU, rotationMd, behavior, intensity, direction}` |
| `zoneChange` | `currentZone = event.zone`; append to `zoneHistory` |
| `collapse` | `terminal = {status:'collapsed', profile: event.profile}` |
| `survive` | no-op if `terminal.status === 'moon'` already; else `terminal = {status:'survived'}` |
| `moon` | `terminal = {status:'moon', variant: event.variant}`; `currentZone = 'moon'`; append `'moon'` to `zoneHistory` |
| `setWin` / `setTotalWin` / `wincap` / `finalWin` | no-op |

Every valid Book (P1's validator already mandates `moon` for every 10,000x Book via BOOK-T008)
is guaranteed to reach a non-`building` terminal status: 0x Books via `collapse`, positive
non-wincap Books via `survive`, 10,000x Books via `moon` — each is the *only* exit from
`'building'` available to its payout class, so there is no reachable "stuck at `building`"
state.

Collapse/survive/Moon are read only from their own explicit events — `applyTowerEvent` never
inspects `offsetU`/`rotationMd`/`intensity` to decide terminal state (tested explicitly with an
event at the schema's own extreme range: `nearFall`, intensity 4, `offsetU` 3500, `rotationMd`
4000, which still leaves `terminal` at `building`).

## P2 relationship

`applyTowerEvent(state, event)` is the production logical-transition primitive. `buildTowerModel
(book)` (`= book.events.reduce(applyTowerEvent, INITIAL_TOWER_MODEL)`) is a whole-Book
convenience fold for tests/tooling — **not** a second production playback engine; the live round
path does not call it. Event *order* remains owned exclusively by `src/book/player.ts`'s
`playBookEvents` in production: P4's real rendering handlers (registered into that Book Player's
handler map) will call `applyTowerEvent` once per event as `playBookEvents` dispatches it,
advancing a running model alongside animation. `src/book/player.ts` and `BookEventContext` are
unmodified by P3.

## Fingerprints

- `fingerprintTowerModel(model): string` — logical state only (`zoneHistory`, `blocks`,
  `terminal`). No Book. Proves same-logical-model → same fingerprint, and is independent of
  which Book (id/payoutMultiplier) produced the model.
- `fingerprintTowerPlayback(book, model): string` — adds `bookId`/`payoutMultiplier` ahead of
  the same three fields, satisfying `TOWER_SYSTEM.md` §17 literally (Book id, payoutMultiplier,
  ordered zones, block fields, terminal event/profile, Moon variant via `terminal`).

Both use plain `JSON.stringify` on an object built with the same literal key order on every
call — no hashing/crypto/stable-stringify dependency, no object-identity dependency, no
timestamps, no randomness.

## Files

- `src/tower/model.ts` — `TowerTerminalState`, `LogicalBlock`, `TowerModel`,
  `INITIAL_TOWER_MODEL`, `applyTowerEvent`, `buildTowerModel`, `fingerprintTowerModel`,
  `fingerprintTowerPlayback`.
- `src/tower/model.test.ts` — the full test matrix below.

## Test matrix → requirement coverage

| # | Describe block | Proves |
|---|---|---|
| 1 | `applyTowerEvent — initial/towerStart` | Independent replays agree at every step; `towerStart` is a full no-op |
| 2 | `applyTowerEvent — block commitment` | Each `block` event adds exactly one `LogicalBlock` with fields copied from that event; final ordinal order is contiguous and matches event order |
| 3 | `applyTowerEvent — zoneChange` | `currentZone`/`zoneHistory` update correctly |
| 4 | `applyTowerEvent — terminal state` | `collapse`/`survive` set `terminal` from the event alone; an extreme block at the schema's own range boundary cannot independently collapse the model |
| 5 | `applyTowerEvent — moon` | `moon` alone (no `survive` needed) sets `terminal` to `{status:'moon', variant}` and `currentZone`/`zoneHistory` to `'moon'`; the real fixture's subsequent `survive` is a full no-op |
| 6 | `applyTowerEvent — economic/result events are no-ops` | `setWin`/`setTotalWin`/`wincap`/`finalWin` each leave the model unchanged |
| 7 | `buildTowerModel — all 11 fixtures` | All 11 build without throwing; `spaceRun5000x` → Space/survived, never Moon; `moonRun10000x` → Moon/variant 0; 0x fixtures → collapsed; positive non-Max fixtures → survived |
| 8 | `buildTowerModel — no Book/event mutation` | `JSON.stringify(book)` unchanged before/after |
| 9 | `fingerprintTowerModel — logical identity (no Book)` | Same model → same fingerprint; independent of Book id/payoutMultiplier; sensitive to block/zone/terminal field changes; per-event snapshot fingerprints identical across independent replays |
| 10 | `fingerprintTowerPlayback — §17 literal compliance` | 100 repeated replays → byte-identical; parsed output contains exact `bookId`/`payoutMultiplier`; changing either (identical model) changes the fingerprint |

## Exit criteria

- All 11 fixture Books build a `TowerModel` without throwing.
- `fingerprintTowerPlayback` is byte-identical across 100 repeated replays of the same Book;
  `fingerprintTowerModel` is independently stable and Book-metadata-independent.
- `collapse`/`survive`/`moon` set terminal state only from their own events, never from
  geometry.
- Moon represented only via `moon` (never reachable through `zoneChange`, enforced at the type
  level by `ZoneChangeTarget` excluding `'moon'`).
- No Pixi/renderer/RGS/timing/RNG dependency in `src/tower/`.
- No Book/event mutation.
- `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm lint` all pass.

## Out of scope (not built here)

Pixi rendering, animation/easing/timing, camera, environment assets, audio, cosmetic PRNG
(xorshift32), resting-lean formula, logical Y/pixel placement, RGS/replay integration, round
state machine, payout UI, Storybook stories, changes to `src/book/player.ts` or
`BookEventContext`, P4+.
