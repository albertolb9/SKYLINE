<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Application } from 'pixi.js';
  import { createPixiStage, type PixiStageHandle } from './createPixiStage';

  let {
    onReady,
    onBeforeDestroy,
  }: {
    /** Called once the stage is ready, with the live Application — lets a caller (e.g.
     * TowerStage) do its own setup without this component knowing anything about towers. */
    onReady?: (app: Application) => void;
    /** Called before the underlying Application is destroyed, so a caller can tear down its
     * own state (e.g. cancel an in-flight animation) deterministically first. This component
     * remains the sole owner of Application destruction itself. */
    onBeforeDestroy?: () => void;
  } = $props();

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
      onReady?.(created.app);
    });
  });

  onDestroy(() => {
    destroyed = true;
    onBeforeDestroy?.();
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
