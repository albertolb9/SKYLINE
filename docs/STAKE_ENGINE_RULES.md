# STAKE_ENGINE_RULES.md — Verified Platform Rules for SKYLINE

**Verified:** 2026-09-02  
**Authority:** Current official Stake Engine documentation and official Stake Engine repositories only.  
**Rule:** Re-verify the relevant entry immediately before implementing platform-sensitive code.

This document contains platform facts, not Bodega preferences. Product decisions belong in `DECISIONS.md`.

## SE-001 — Stateless bets

**Rule:** Stake Engine games are strictly stateless; each bet is independent. The current approval guidelines prohibit jackpots, gamble features, continuation and early cashout.  
**SKYLINE impact:** no cashout, continuation, persistent bet-dependent state or gamble feature.  
**Source:** https://stake-engine.com/docs/approval-guidelines

## SE-002 — Static outcome model

**Rule:** All possible game outcomes are contained in static game files; RGS selects a simulation according to lookup weighting and returns its events through play.  
**SKYLINE impact:** outcome is preselected; tower runtime does not decide money.  
**Source:** https://stake-engine.com/docs

## SE-003 — Minimum math publication files

**Rule:** A one-mode game requires `index.json`, a lookup CSV, and zStandard-compressed JSONL game logic. Each simulation must contain at least `id`, `events`, `payoutMultiplier`. The lookup payout must exactly match the Book payout.  
**Source:** https://stake-engine.com/docs/math/math-file-format

## SE-004 — Book events are frontend truth

**Rule:** Events returned from RGS contain the information required for frontend display; information not contained or implied by Events cannot be shown as game state. Event examples use `index`, `type`, plus custom fields.  
**SKYLINE impact:** important tower narrative state belongs in or is deterministically implied by Book Events.  
**Source:** https://stake-engine.com/docs/math/game-state-structure/events

## SE-005 — Math SDK output

**Rule:** `book.events` is what is returned to frontend from play; lookup files are optimized via weights; output config files support frontend/backend/math.  
**Source:** https://stake-engine.com/docs/math/source-files/outputs

## SE-006 — Reproducible math simulations

**Rule:** Current Math SDK state resets RNG from simulation number for reproducibility.  
**SKYLINE impact:** offline sequence generation should be reproducible and recorded into Books.  
**Source:** https://stake-engine.com/docs/math/high-level-structure/game-format

## SE-007 — Authenticate first for normal sessions

**Rule:** `/wallet/authenticate` must be called before normal wallet endpoints; otherwise session errors occur. Authenticate returns balance/config and a round that may be active or last completed; active rounds should be continued.  
**Source:** https://stake-engine.com/docs/rgs/wallet

## SE-008 — Respect RGS play amount configuration

**Rule:** Frontend must respect returned min/max/default/allowed play levels and jurisdiction configuration.  
**Source:** https://stake-engine.com/docs/rgs/wallet  
**Approval source:** https://stake-engine.com/docs/approval-guidelines/rgs-communication

## SE-009 — Play and End Round

**Rule:** `/wallet/play` initiates the round and debits the amount. `/wallet/end-round` completes a round and triggers payout/closure when manual closing applies. Exact timing can vary by bet type.  
**Sources:**
- https://stake-engine.com/docs/rgs
- https://stake-engine.com/docs/rgs/wallet
- https://github.com/StakeEngine/web-sdk

**Important nuance:** The current official Web SDK FAQ explicitly shows different `end-round` timing for `noWin`, `singleRoundWin`, and `bonusWin`. Re-verify the current SDK implementation before coding SKYLINE RGS lifecycle.

## SE-010 — `auto_close_disabled`

**Rule:** Current BetMode docs state `auto_close_disabled=False` is the default. With auto-close enabled, the RGS can close bets automatically for efficiency; closed bets cannot be resumed. Setting it `True` can be useful where interrupted play must remain resumable, and then frontend must manually close.  
**Source:** https://stake-engine.com/docs/math/game-state-structure/setup/betmode

## SE-011 — `/bet/event`

**Rule:** `/bet/event` tracks in-progress player actions and can support resume after disconnect.  
**SKYLINE impact:** available, but not required by the platform merely because animation has multiple blocks.  
**Source:** https://stake-engine.com/docs/rgs/wallet

## SE-012 — Bet Replay mandatory

**Rule:** Bet Replay is mandatory for new games seeking approval. Replay does not require a player session. Normal betting controls must be disabled/hidden in replay mode; the game must load the specified event and replay the full round.  
**Endpoint:** `GET {rgs_url}/bet/replay/{game}/{version}/{mode}/{event}`  
**Source:** https://stake-engine.com/docs/approval-guidelines/game-replay-requirements

## SE-013 — Replay review cases

**Rule:** Review may request event IDs for normal win, big win, win cap, loss and bonus trigger if applicable.  
**Source:** https://stake-engine.com/docs/approval-guidelines/game-replay-requirements

## SE-014 — RGS error codes

Current wallet docs include:

- `ERR_VAL` invalid request
- `ERR_IPB` insufficient player balance
- `ERR_IS` invalid session/session timeout
- `ERR_ATE` authentication/token issue
- `ERR_GLE` gambling limits exceeded
- `ERR_LOC` invalid player location
- `ERR_GEN` general server error
- `ERR_MAINTENANCE` planned maintenance

**Source:** https://stake-engine.com/docs/rgs/wallet

## SE-015 — General browser/RGS disclaimer

**Rule:** Rules/info must explain that frontend display is illustrative and winnings are settled according to RGS, not browser events.  
**Source:** https://stake-engine.com/docs/approval-guidelines/general-disclaimer

## SE-016 — Frontend UI requirements

Current public approval guidance includes:

- rules accessible from UI;
- RTP clearly communicated;
- Max Win clearly displayed;
- ability to change play amount;
- all RGS-returned play levels available;
- balance displayed in normal play;
- final non-zero win clearly shown;
- sound-disable control;
- spacebar mapped to play/bet action;
- autoplay, if present, requires confirmation;
- fastplay, if present, must preserve legibility;
- mobile support;
- popout/mini-player support.

**Source:** https://stake-engine.com/docs/approval-guidelines/front-end-communication

## SE-017 — Original assets

**Rule:** Submitted games must use unique visual/audio assets; sample Web SDK game assets will not be approved.  
**Source:** https://stake-engine.com/docs/approval-guidelines/front-end-communication

## SE-018 — Static build / external resource restrictions

**Rule:** Production frontend must be static and should not reach external runtime sources; approval guidance calls out external fonts/resources as an XSS/build issue.  
**Source:** https://stake-engine.com/docs/approval-guidelines/rgs-communication

## SE-019 — Social jurisdiction terminology

**Rule:** `social=true` can require alternative text for Stake US/social casino language; current jurisdiction guidance lists restricted gambling terminology and replacements.  
**Source:** https://stake-engine.com/docs/approval-guidelines/jurisdiction-requirements

## SE-020 — Post-release changes restricted

**Rule:** Current approval guidelines state that after approval, only minor visual updates are normally permitted unless requested; changes to math, new modes or gameplay mechanics are not normally allowed.  
**SKYLINE impact:** product/math/modes must be considered production decisions before submission.  
**Source:** https://stake-engine.com/docs/approval-guidelines

## SE-021 — Official Web SDK baseline

Current official Web SDK describes itself as optional and currently uses Svelte 5, PixiJS 8 and TurboRepo; it also uses Storybook and XState in its dependency/pattern stack. It can be used as a base or selectively adopted; any framework is acceptable if it builds to a compatible static site.  
**Source:** https://github.com/StakeEngine/web-sdk

At verification date, the README specifies Node `22.16.0` and pnpm `10.5.0`. Re-check rather than assuming these stay current.

## SE-022 — Storybook/event pattern

**Rule/pattern:** Current official Web SDK runs Books and individual Book Events in Storybook and processes Book Events sequentially through handlers.  
**SKYLINE impact:** isolate each custom Book Event and complete fixture Books in Storybook/tests.  
**Source:** https://github.com/StakeEngine/web-sdk

## SE-023 — Official TS RGS client

Stake Engine provides an official TypeScript RGS client package/repository. Prefer official client/contracts over hand-rolled assumptions when integration begins.  
**Source:** https://github.com/StakeEngine/ts-client

## Pre-implementation verification rule

Any engineer/agent touching RGS, Math SDK, Replay, publication or approval code must update the relevant rule's `Verified` date if it has been more than 30 days or if current docs/repo behavior differs from this file.
