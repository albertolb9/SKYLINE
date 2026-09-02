<script lang="ts">
  import PixiStage from '../renderer/pixi-stage/PixiStage.svelte';
</script>

<main>
  <PixiStage />
</main>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    background: #0a0a0f;
  }

  main {
    width: 100vw;
    height: 100vh;
  }
</style>
