<template>
  <div
    class="designv2 relative w-full h-screen overflow-hidden bg-[#15252B] select-none"
    @pointerdown="handleScreenTap"
  >
    <GameCanvas
      ref="canvasRef"
      :on-score-update="updateScore"
      :on-game-over="handleGameOver"
      box-style="v2"
    />

    <UIOverlayDesignV2
      :game-state="gameState"
      :score="score"
      :leaderboard-entries="leaderboardEntries"
      :leaderboard-status="leaderboardStatus"
      :nickname="nickname"
      @start="startGame"
      @restart="restartGame"
      @open-leaderboard="openLeaderboard"
      @close-leaderboard="closeLeaderboard"
    />
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from '@nuxtjs/composition-api';
import GameCanvas from '~/components/GameCanvas.vue';
import UIOverlayDesignV2 from '~/components/UIOverlayDesignV2.vue';
import {
  GameScore,
  GameState,
  LeaderboardEntry,
  LeaderboardStatus,
} from '~/types';
import {
  fetchLeaderboard,
  getOrCreateNickname,
  submitScore,
} from '~/utils/leaderboard';

const STORAGE_KEY = '05ru_tech_tower_best';

export default defineComponent({
  name: 'AppDesignV2',
  components: {
    GameCanvas,
    UIOverlayDesignV2,
  },
  setup() {
    const gameState = ref<GameState>(GameState.START);
    const leaderboardReturnState = ref<GameState>(GameState.START);
    const leaderboardEntries = ref<LeaderboardEntry[]>([]);
    const leaderboardStatus = ref<LeaderboardStatus>('ok');
    const nickname = ref('');
    const score = ref<GameScore>({
      current: 0,
      best: 0,
    });

    const canvasRef = ref<{ startGame: () => void; handleTap: () => void } | null>(null);

    const handleScreenTap = () => {
      if (gameState.value === GameState.PLAYING) {
        canvasRef.value?.handleTap();
      }
    };

    const updateScore = (newScore: number) => {
      score.value = {
        ...score.value,
        current: newScore,
      };
    };

    const handleGameOver = (finalScore: number) => {
      gameState.value = GameState.GAME_OVER;

      const newBest = Math.max(score.value.best, finalScore);

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, String(newBest));
      }

      score.value = {
        current: finalScore,
        best: newBest,
      };

      if (finalScore <= 0) {
        return;
      }

      if (nickname.value) {
        submitScore(nickname.value, finalScore);
        return;
      }

      getOrCreateNickname().then((created) => {
        nickname.value = created;
        submitScore(created, finalScore);
      });
    };

    const openLeaderboard = async () => {
      leaderboardReturnState.value = gameState.value;
      gameState.value = GameState.LEADERBOARD;

      const { entries, status } = await fetchLeaderboard();
      leaderboardEntries.value = entries;
      leaderboardStatus.value = status;
    };

    const closeLeaderboard = () => {
      gameState.value = leaderboardReturnState.value;
    };

    const startGame = () => {
      gameState.value = GameState.PLAYING;
      canvasRef.value?.startGame();
    };

    const restartGame = () => {
      gameState.value = GameState.PLAYING;
      canvasRef.value?.startGame();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }

      if (gameState.value === GameState.START) {
        startGame();
        return;
      }

      if (gameState.value === GameState.GAME_OVER) {
        restartGame();
        return;
      }

      if (gameState.value === GameState.PLAYING) {
        canvasRef.value?.handleTap();
      }
    };

    onMounted(() => {
      if (typeof localStorage !== 'undefined') {
        const best = Number.parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
        score.value = {
          ...score.value,
          best: Number.isFinite(best) ? best : 0,
        };
      }

      window.addEventListener('keydown', handleKeyDown);

      if (!nickname.value) {
        getOrCreateNickname().then((created) => {
          nickname.value = created;
        });
      }
    });

    watch(
      gameState,
      (state) => {
        const allowScroll = state !== GameState.PLAYING;

        document.body.style.overflow = allowScroll ? 'auto' : 'hidden';
        document.body.style.touchAction = allowScroll ? 'auto' : 'none';
        document.documentElement.style.overflow = allowScroll ? 'auto' : 'hidden';
      },
      { immediate: true }
    );

    onBeforeUnmount(() => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
    });

    return {
      canvasRef,
      closeLeaderboard,
      gameState,
      handleGameOver,
      handleScreenTap,
      leaderboardEntries,
      leaderboardStatus,
      nickname,
      openLeaderboard,
      restartGame,
      score,
      startGame,
      updateScore,
    };
  },
});
</script>
