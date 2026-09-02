<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import PixiStage from './PixiStage.svelte';

  const { Story } = defineMeta({
    title: 'Renderer/PixiStage',
    component: PixiStage,
    parameters: {
      layout: 'fullscreen',
    },
  });
</script>

<Story name="Empty Stage" />
