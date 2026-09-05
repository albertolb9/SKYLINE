<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import TowerStage from './TowerStage.svelte';
  import {
    bigClimb100x,
    cleanSurvive150x,
    cruelCollapseSky0x,
    nearDeathWin20x,
    quickCollapseStreet0x,
    standardCollapseSkyline0x,
    weakSurvive050x,
    wobbleWin5x,
  } from '../../test-fixtures/books';
  // Direct import for the one DEV-ONLY synthetic P6->P7 handoff scenario below (P7,
  // docs/work/TASK-P7-collapse.md §W) -- BookBuilder's only import is a type-only import from
  // book/schema (verified before use here), so it carries zero Vitest/test-framework runtime
  // dependency and is already transitively bundled into Storybook today via every real fixture
  // above. This Book is never exported from test-fixtures/books and is not a 12th canonical
  // fixture.
  import { BookBuilder } from '../../test-fixtures/bookBuilder';

  const { Story } = defineMeta({
    title: 'Renderer/TowerStage',
    component: TowerStage,
    parameters: {
      layout: 'fullscreen',
    },
  });

  // DEV ONLY -- not a canonical fixture, not exported from test-fixtures/books, not covered by
  // books.test.ts. Exercises the hardest valid P6->P7 handoff case: nearFall holds toward the
  // LEFT (direction -1) and the following collapse's profile commands the OPPOSITE side
  // (leanRight) -- proving no snap to 0, a continuous reversal from the exact held pose, and that
  // profile (not the nearFall's own direction) authoritatively controls the final macro side.
  const devOnlyNearFallToCollapseHandoff = new BookBuilder()
    .towerStart('cruelCollapse', 'quick', 4242)
    .block({ behavior: 'clean' })
    .block({ behavior: 'clean' })
    .block({ behavior: 'nearFall', offsetU: -1500, rotationMd: -1600, direction: -1, intensity: 4 })
    .collapse('leanRight', 4)
    .setTotalWin(0)
    .finalWin(0)
    .build(9999, 0, 'dev-only-nearfall-to-collapse-handoff'); // id deliberately outside the 1-11 canonical range
</script>

<!-- 0x, 3 blocks, all clean/offset, ends in a real leanLeft/intensity-3 terminal collapse (P7). -->
<Story name="Quick Collapse Street 0x" args={{ book: quickCollapseStreet0x }} />

<!--
  0x, 8 blocks, crosses one zoneChange into Skyline, ends in a real leanRight/intensity-3 terminal
  collapse (P7) -- taller/direct collapse companion to Quick Collapse Street 0x, covering the
  other profile.
-->
<Story name="Standard Collapse Skyline 0x" args={{ book: standardCollapseSkyline0x }} />

<!--
  0x, 13 blocks, reaches Sky. Contains an earlier nearFall (recovers) and an earlier wobble
  (recovers) well before the eventual leanLeft/intensity-4 terminal collapse (P7) -- the strongest
  real regression proof that already-resolved danger beats have zero lingering effect on a later
  unrelated collapse.
-->
<Story name="Cruel Collapse Sky 0x" args={{ book: cruelCollapseSky0x }} />

<!-- 0.5x, 6 blocks, all clean/offset, crosses one zoneChange into Skyline, ends survive. -->
<Story name="Weak Survive 0.50x" args={{ book: weakSurvive050x }} />

<!-- 1.5x, 7 blocks, all clean/offset, crosses into Skyline, ends survive. -->
<Story name="Clean Survive 1.50x" args={{ book: cleanSurvive150x }} />

<!--
  17 blocks, reaches Atmosphere. Tall enough to exercise the minimal camera follow (the safe
  band is crossed at ordinal 17 under the default mobile-viewport tuning — see
  transforms.test.ts), alongside a real P5 wobble block and a real P6 nearFall block. The nearFall
  is the Book's last block event (immediately followed by `survive`), so it classifies as recover
  and settles before the win resolves — never holds, since the next event is not `collapse`.
-->
<Story name="Big Climb 100x (camera follow)" args={{ book: bigClimb100x }} />

<!--
  6 blocks, resolves 5x in Sky. Three wobble beats (direction -1, +1, -1; intensity 2, 2, 3),
  each followed by continued clean/offset construction before the eventual survive — the core P5
  proof: block lands, visibly wobbles, recovers, and the tower keeps building.
-->
<Story name="Wobble Win 5x" args={{ book: wobbleWin5x }} />

<!--
  10 blocks, resolves 20x in Sky. The archetype purpose-built for this exact proof (GAME_SPEC §7:
  "one major near-fall becomes the emotional beat") — one nearFall (intensity 4, direction 1),
  immediately followed by another block (not collapse), so it classifies as recover: critical
  lean -> hold at peak -> counter-swing -> overshoot -> exact settle, clearly stronger than any
  wobble in the Book, before construction continues to the win. P6's primary manual QA target.
  P6 does not yet ship a holdForCollapse Storybook proof — no canonical fixture has a nearFall
  immediately followed by `collapse`; that visual (nearFall -> hold -> actual collapse animation)
  is deferred to P7, when collapse animation exists to consume the held pose.
-->
<Story name="Near Death Win 20x" args={{ book: nearDeathWin20x }} />

<!--
  DEV ONLY -- cross-phase QA scenario, not canonical Book content (P7,
  docs/work/TASK-P7-collapse.md). nearFall holds toward the left (direction -1); the immediately
  following collapse commands leanRight. Manual QA target: the tower must not recover or snap to
  upright at the hold, and the collapse must continue smoothly and reverse from the exact held
  angle into the right side, ending there -- collapse's profile wins, not the nearFall's own
  direction.
-->
<Story name="DEV ONLY - NearFall to Collapse Handoff (opposite direction)" args={{ book: devOnlyNearFallToCollapseHandoff }} />
