<script lang="ts">
  import type { Application } from 'pixi.js';
  import PixiStage from '../pixi-stage/PixiStage.svelte';
  import { playBookEvents } from '../../book/player';
  import type { Book } from '../../book/schema';
  import { createTowerRenderer, TowerRenderCancelledError, type TowerRenderer } from './createTowerRenderer';
  import { createTowerEventHandlers } from './createTowerEventHandlers';

  let { book }: { book: Book } = $props();

  // Stays undefined until onReady fires; onBeforeDestroy may run before that ever happens
  // (component torn down while the Pixi Application is still initializing) — the optional
  // chaining below is the whole safety mechanism for that race, deliberately not a larger
  // lifecycle framework. See docs/work/TASK-P4-basic-renderer.md.
  let renderer: TowerRenderer | undefined;

  function handleReady(app: Application) {
    renderer = createTowerRenderer(app);
    const handlers = createTowerEventHandlers(renderer);
    playBookEvents(book, handlers).catch((error: unknown) => {
      if (error instanceof TowerRenderCancelledError) return; // expected on intentional teardown
      console.error('SKYLINE: tower playback failed', error);
    });
  }

  function handleBeforeDestroy() {
    renderer?.cancel();
  }
</script>

<PixiStage onReady={handleReady} onBeforeDestroy={handleBeforeDestroy} />
