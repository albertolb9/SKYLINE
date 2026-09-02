# ROUND_LIFECYCLE.md — SKYLINE V1

**Status:** Core states ACCEPTED; exact Stake close timing PROVISIONAL until RGS integration re-verification.

## 1. Two runtime modes

### Normal play
Requires session authentication and wallet/RGS communication.

### Replay
Does not require an authenticated player session. Loads a specific published event and disables normal betting controls.

These modes share the same Book Player.

## 2. Normal boot

```text
BOOT
  ↓
PARSE_LAUNCH_PARAMS
  ↓
AUTHENTICATING
  ↓
AUTHENTICATED
  ↓
ACTIVE ROUND?
  ├─ no  → READY
  └─ yes → RECOVERY_DECISION → resume/complete according to current RGS contract
```

Requirements:

- call authenticate before normal wallet endpoints;
- read balance/config/jurisdiction from RGS;
- respect returned play levels;
- inspect returned round instead of assuming idle.

## 3. Replay boot

```text
BOOT
  ↓
DETECT replay=true
  ↓
FETCH_REPLAY
  ↓
REPLAY_READY
  ↓ player presses Replay Play
PLAYING_BOOK
  ↓
REPLAY_RESULT
  ↓
PLAY_AGAIN_READY
```

No authenticate/wallet play calls in Replay.

## 4. Normal single-round state machine

```text
READY
  ↓ PLAY
PLAY_REQUEST
  ↓
WAITING_RGS
  ↓ success
BOOK_RECEIVED
  ↓ validate/classify
SETTLEMENT_PATH
  ↓
PLAYING_BOOK
  ↓
RESULT
  ↓
READY
```

Errors route to an explicit recoverable/non-recoverable error state depending on code.

## 5. Economic classification

Working V1 categories:

- `noWin`: payout 0x.
- `singleRoundWin`: payout >0x.

SKYLINE has no bonus/multi-step economic round in V1.

## 6. End Round timing — platform-sensitive

Current official sources must be read together:

- RGS Basic Flow describes play then end-round as the simplest interaction.
- Current Web SDK FAQ states end-round timing differs by bet type and shows:
  - noWin: no explicit client end-round method in its mapping;
  - singleRoundWin: end-round occurs at the start of the presentation lifecycle, with the returned balance held until animation completion;
  - bonusWin: end-round occurs after the longer feature animation.
- BetMode docs state `auto_close_disabled=False` enables automatic close for efficiency.

### V1 implementation intent

Mirror the current official Web SDK's single-round pattern when RGS is integrated, using `auto_close_disabled=False`, **but re-verify the current SDK/docs immediately before coding this path**.

Do not encode the present description as a permanent Stake invariant.

## 7. Why no mid-animation economic state in V1

SKYLINE has no player action during the build. Therefore block 7 vs block 12 is presentation progress, not a new economic state.

V1 does not call `/bet/event` merely to remember animation position.

If future Stake review/integration demonstrates that a resumable presentation checkpoint is required, supersede D-029 and specify the checkpoint contract before implementation.

## 8. Disconnect scenarios

### A — Before `/play` succeeds
No Book is accepted. UI must not invent a round. Handle request error according to RGS response/session state.

### B — `/play` succeeds, frontend closes during animation
Economic authority remains RGS. On next normal launch authenticate and inspect returned round. Follow the current official active-round contract. Do not infer settlement from local animation completion.

### C — Disconnect during 0x animation
Same rule: browser collapse animation is not economic authority.

### D — Disconnect during Max Win Moon animation
Same rule. The player can later use deterministic Bet Replay; do not keep a transaction open merely for spectacle unless current RGS requirements demand it.

### E — End-round request error where manual call applies
Do not locally mark settlement complete. Surface/handle error through state machine and re-auth/reconcile according to current official client pattern.

## 9. Error mapping

At minimum handle current documented codes:

| Code | V1 handling class |
|---|---|
| ERR_VAL | request/config error; block play and report appropriately |
| ERR_IPB | insufficient balance; return to READY with clear feedback |
| ERR_IS | session invalid; re-auth/session handling |
| ERR_ATE | authentication expired/failed |
| ERR_GLE | limits; do not retry play automatically |
| ERR_LOC | location restriction; block play |
| ERR_GEN | general server error; safe retry/reload UX |
| ERR_MAINTENANCE | maintenance state |

Exact user-facing copy belongs to production UX/localization.

## 10. Balance display

- Normal play balance comes from RGS responses/events.
- Do not calculate wallet balance by subtracting/adding locally as authoritative state.
- If using current Web SDK singleRoundWin pattern, balance returned from end-round may be visually revealed after Book animation, matching the official pattern.

## 11. Prototype lifecycle

Prototype uses no RGS:

```text
READY
  ↓ select fixture
BOOK_READY
  ↓ play
PLAYING_BOOK
  ↓
RESULT
  ↓
READY / PLAY_AGAIN
```

This prototype state machine should retain seams for later normal/replay providers.

## 12. Pre-RGS integration gate

Before implementing network lifecycle:

1. re-open current official RGS docs;
2. re-open current official Web SDK primary machine/end-round mapping;
3. re-open current BetMode docs;
4. update `STAKE_ENGINE_RULES.md` if changed;
5. write integration tests/fixtures for noWin and singleRoundWin;
6. only then connect live/staging RGS.

## Official references

- https://stake-engine.com/docs/rgs
- https://stake-engine.com/docs/rgs/wallet
- https://stake-engine.com/docs/math/game-state-structure/setup/betmode
- https://stake-engine.com/docs/approval-guidelines/game-replay-requirements
- https://github.com/StakeEngine/web-sdk
- https://github.com/StakeEngine/ts-client
