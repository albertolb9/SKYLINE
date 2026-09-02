<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { createPixiStage, type PixiStageHandle } from './createPixiStage';

  let container: HTMLDivElement;
  let handle: PixiStageHandle | undefined;
  let destroyed = false;

  onMount(() => {
    createPixiStage(container, () => destroyed).then((created) => {
      if (!created) return;
      if (destroyed) {
        created.destroy();
        return;
      }
      handle = created;
    });
  });

  onDestroy(() => {
    destroyed = true;
    handle?.destroy();
  });
</script>

<div class="pixi-stage" bind:this={container}></div>

<style>
  .pixi-stage {
    width: 100%;
    height: 100%;
  }
</style>
