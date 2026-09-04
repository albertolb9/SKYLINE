<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import TowerStage from './TowerStage.svelte';
  import {
    bigClimb100x,
    cleanSurvive150x,
    quickCollapseStreet0x,
    weakSurvive050x,
    wobbleWin5x,
  } from '../../test-fixtures/books';

  const { Story } = defineMeta({
    title: 'Renderer/TowerStage',
    component: TowerStage,
    parameters: {
      layout: 'fullscreen',
    },
  });
</script>

<!-- 0x, 3 blocks, all clean/offset, ends collapse (model advances but P4 has no collapse visual). -->
<Story name="Quick Collapse Street 0x" args={{ book: quickCollapseStreet0x }} />

<!-- 0.5x, 6 blocks, all clean/offset, crosses one zoneChange into Skyline, ends survive. -->
<Story name="Weak Survive 0.50x" args={{ book: weakSurvive050x }} />

<!-- 1.5x, 7 blocks, all clean/offset, crosses into Skyline, ends survive. -->
<Story name="Clean Survive 1.50x" args={{ book: cleanSurvive150x }} />

<!--
  17 blocks, reaches Atmosphere. Tall enough to exercise the minimal camera follow (the safe
  band is crossed at ordinal 17 under the default mobile-viewport tuning — see
  transforms.test.ts) alongside a real P5 wobble block. Also contains a nearFall block, which
  still renders as a plain drop with no drama — a deliberate, documented P6 deferral
  (docs/work/TASK-P5-wobble-recovery.md), not a bug.
-->
<Story name="Big Climb 100x (camera follow)" args={{ book: bigClimb100x }} />

<!--
  6 blocks, resolves 5x in Sky. Three wobble beats (direction -1, +1, -1; intensity 2, 2, 3),
  each followed by continued clean/offset construction before the eventual survive — the core P5
  proof: block lands, visibly wobbles, recovers, and the tower keeps building.
-->
<Story name="Wobble Win 5x" args={{ book: wobbleWin5x }} />
