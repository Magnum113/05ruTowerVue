<template>
  <canvas
    ref="canvasRef"
    class="block w-full h-full touch-none"
  />
</template>

<script lang="ts">
import {
  defineComponent,
  onBeforeUnmount,
  onMounted,
  PropType,
  ref,
} from '@nuxtjs/composition-api';
import { GameEngine } from '~/utils/gameEngine';

export default defineComponent({
  name: 'GameCanvas',
  props: {
    onScoreUpdate: {
      type: Function as PropType<(score: number) => void>,
      required: true,
    },
    onGameOver: {
      type: Function as PropType<(score: number) => void>,
      required: true,
    },
    boxStyle: {
      type: String as PropType<'legacy' | 'v2'>,
      default: 'legacy',
    },
  },
  setup(props) {
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const engineRef = ref<GameEngine | null>(null);

    const startGame = () => {
      engineRef.value?.start();
    };

    const handleTap = () => {
      engineRef.value?.handleInput();
    };

    onMounted(() => {
      if (!canvasRef.value) {
        return;
      }

      engineRef.value = new GameEngine(
        canvasRef.value,
        {
          onScoreUpdate: props.onScoreUpdate,
          onGameOver: props.onGameOver,
        },
        {
          boxStyle: props.boxStyle,
        }
      );
    });

    onBeforeUnmount(() => {
      engineRef.value?.cleanup();
    });

    return {
      canvasRef,
      handleTap,
      startGame,
    };
  },
});
</script>
