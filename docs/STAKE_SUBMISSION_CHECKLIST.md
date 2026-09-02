# STAKE_SUBMISSION_CHECKLIST.md — SKYLINE

**Status:** Living pre-submit checklist.  
**Important:** Stake approval guidance changes. Re-check the authenticated/current approval checklist immediately before submission; this file is not a substitute for ACP/current docs.

## A. Product / approval

- [ ] Game is final enough for submission; no planned math/gameplay/mode changes after approval.
- [ ] Original game design/assets; no Stake sample assets shipped.
- [ ] No underage/child-like gambling imagery.
- [ ] Stateless behavior verified.
- [ ] No jackpot/gamble/continuation/early cashout.
- [ ] Game description/blurb prepared.

## B. Math

- [ ] RTP 96.00% validated from published lookup.
- [ ] Max Win 10,000x validated.
- [ ] Payout Ladder/Distribution production decision frozen.
- [ ] Book ↔ lookup payout integrity passes.
- [ ] Required math publication files generated.
- [ ] Max Win/wincap criteria and event IDs identified.
- [ ] PAR/analysis generated: hit rates, RTP contributions, payout ranges.
- [ ] Production simulation diversity reviewed.

## C. RGS

- [ ] Authenticate before normal wallet APIs.
- [ ] RGS play levels/min/max/default respected.
- [ ] Play request mode/cost correct.
- [ ] End-round/auto-close behavior re-verified against current official SDK.
- [ ] Active round from authenticate handled.
- [ ] Error codes handled.
- [ ] Balance display authoritative from RGS.
- [ ] Currency handling tested.
- [ ] Jurisdiction/social flags handled.

## D. Replay

- [ ] `replay=true` detected.
- [ ] Replay data fetched from required RGS endpoint.
- [ ] Replay makes no authenticated session calls.
- [ ] Normal betting controls removed/disabled.
- [ ] Replay Play control provided after load.
- [ ] Play Again provided.
- [ ] Final replay result remains visible.
- [ ] Loss event ID documented.
- [ ] Normal win event ID documented.
- [ ] Big win event ID documented.
- [ ] Win cap / Moon event ID documented.
- [ ] Same Book Player used as normal game.

## E. Rules/UI

- [ ] Detailed game rules accessible.
- [ ] RTP displayed.
- [ ] Max Win displayed.
- [ ] Payout/result explanation correct.
- [ ] Required RGS/browser disclaimer present.
- [ ] UI guide describes controls.
- [ ] All RGS-returned play levels selectable.
- [ ] Balance shown in normal mode.
- [ ] Non-zero final win clearly shown.
- [ ] Sound toggle included.
- [ ] Spacebar mapped to PLAY.
- [ ] Autoplay, if added, meets current confirmation rules.
- [ ] Fastplay, if added, preserves result/win legibility.

## F. Responsive/performance

- [ ] Common mobile sizes tested.
- [ ] Stake popout/mini-player tested.
- [ ] Desktop tested.
- [ ] No critical tower/UI clipping.
- [ ] Performance acceptable on target mobile.
- [ ] Repeated rounds do not leak memory/listeners.

## G. Assets/build/security

- [ ] Static production build.
- [ ] No external runtime asset/font requests outside allowed Stake hosting/CDN.
- [ ] No console/network errors.
- [ ] No sensitive or unnecessary game data logging.
- [ ] Audio/visual assets original and licensed.
- [ ] Required tile assets prepared (background, foreground, provider logo) to current spec.

## H. Localization / social

- [ ] Supported languages tested.
- [ ] Long strings do not overflow.
- [ ] `social=true` terminology verified for Stake US/social requirements.
- [ ] Currency/token displays verified.

## I. Final review

- [ ] Re-open current Stake approval guidelines.
- [ ] Re-open current submission checklist in authenticated ACP/docs.
- [ ] Re-open current Replay requirements.
- [ ] Re-open current RGS communication rules.
- [ ] Re-open current Math publication format.
- [ ] Run full regression suite.
- [ ] Freeze git commit/tag and record math/frontend versions submitted.

## Official public references

- https://stake-engine.com/docs/approval-guidelines
- https://stake-engine.com/docs/approval-guidelines/front-end-communication
- https://stake-engine.com/docs/approval-guidelines/rgs-communication
- https://stake-engine.com/docs/approval-guidelines/game-replay-requirements
- https://stake-engine.com/docs/approval-guidelines/general-disclaimer
- https://stake-engine.com/docs/approval-guidelines/jurisdiction-requirements
- https://stake-engine.com/docs/approval-guidelines/game-tile-requirements
- https://stake-engine.com/docs/math/math-file-format
- https://stake-engine.com/docs/rgs
