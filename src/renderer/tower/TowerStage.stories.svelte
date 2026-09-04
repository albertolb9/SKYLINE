<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import TowerStage from './TowerStage.svelte';
  import {
    bigClimb100x,
    cleanSurvive150x,
    quickCollapseStreet0x,
    weakSurvive050x,
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
  17 blocks, reaches Atmosphere. Tall enough to exercise P4's minimal camera follow (the safe
  band is crossed at ordinal 17 under the default mobile-viewport tuning — see
  transforms.test.ts). Also contains wobble/nearFall blocks, which P4 renders as plain drops to
  their authored placement with no drama — a deliberate, documented temporary greybox policy
  (docs/work/TASK-P4-basic-renderer.md), not a bug.
-->
<Story name="Big Climb 100x (camera follow)" args={{ book: bigClimb100x }} />
