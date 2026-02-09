<template>
  <div
    class="designv2 relative w-full h-screen overflow-hidden bg-[#15252B] select-none"
    @pointerdown="handleScreenTap"
  >
    <canvas
      ref="canvasRef"
      class="block w-full h-full touch-none"
    />
  <div>
    <template v-if="gameState === GameState.START">
    <div
      v-if="onboardingStep === 1"
      data-overlay="start-step1"
      class="absolute inset-0 z-50 flex flex-col items-center justify-start bg-black/70 backdrop-blur-sm p-4 sm:p-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto"
      :style="startOverlayStyle"
    >
      <div
        class="my-auto w-full max-w-md rounded-2xl bg-[#f2f5f6] p-5 sm:p-6 shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]"
        :style="startCardStyle"
      >
        <div class="mb-4 text-center">
          <p
            class="text-[14px] leading-5 font-medium text-[#15252b]"
            :style="{ color: '#15252b', fontSize: '14px', lineHeight: '20px', fontWeight: 500 }"
          >
            Рамадан — время заботы и добрых дел
          </p>
          <h1
            data-name="h1.relative"
            class="mt-2 text-[42px] leading-[40px] font-medium text-[#ff2c00]"
            :style="{
              letterSpacing: '-0.75px',
              color: '#ff2c00',
              fontSize: 'clamp(40px, 12vw, 56px)',
              lineHeight: 0.95,
              fontWeight: 500,
            }"
          >
            Башня доброты
          </h1>
        </div>

        <div
          class="mb-5 space-y-2 text-center text-[14px] leading-[20px] text-[#15252b]"
          :style="{ color: '#15252b', fontSize: '14px', lineHeight: '20px' }"
        >
          <p>Эта игра — ваш небольшой, но значимый вклад.</p>
          <p>Постройте ровную и высокую башню из коробок и зарабатывайте баллы.</p>
          <p>В конце месяца Рамадан все набранные баллы будут направлены на благотворительные цели.</p>
          <p>
            Будьте терпеливы, и всё обязательно
            <em>сложится</em>.
          </p>
        </div>

        <div class="flex flex-col gap-3">
          <button
            type="button"
            data-name="button.w-full"
            class="w-full rounded-[12px] px-6 py-4 text-white"
            :style="[
              primaryButtonStyle,
              { color: '#ffffff', borderRadius: '12px', padding: '16px 24px' }
            ]"
            @click="goToOnboardingStep2"
          >
            <span
              class="flex items-center justify-center gap-2 text-[18px] leading-7 font-medium"
              :style="{ color: '#ffffff', fontSize: '18px', lineHeight: '28px', fontWeight: 500 }"
            >
              <span data-name="Frame" class="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                  <path
                    :d="svgPaths.p1d055380"
                    fill="white"
                    stroke="white"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.66667"
                  />
                </svg>
              </span>
              Построить башню!
            </span>
          </button>

          <button
            type="button"
            data-name="button.mt-4"
            class="w-full rounded-[12px] border border-white/10 bg-[#b4d3ff] px-4 py-[13px] shadow-[2px_2px_12px_rgba(0,0,0,0.05)]"
            :style="[
              secondaryButtonStyle,
              { borderRadius: '12px', padding: '13px 16px' }
            ]"
            @click="emitOpenLeaderboard"
          >
            <span
              class="flex items-center justify-center gap-2 text-[14px] leading-5 font-medium text-[#15252b]"
              :style="{ color: '#15252b', fontSize: '14px', lineHeight: '20px', fontWeight: 500 }"
            >
              <span data-name="Frame" class="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                <svg width="18" height="18" fill="none" viewBox="0 0 18 18">
                  <path
                    :d="svgPaths.p34d63080"
                    stroke="#15252B"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                  />
                  <path
                    d="M3.75 15.75H14.25"
                    stroke="#15252B"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                  />
                </svg>
              </span>
              Посмотреть рейтинг игроков
            </span>
          </button>

          <button
            type="button"
            data-name="button.mt-3"
            class="w-full bg-transparent text-center text-xs leading-4 text-[#15252B]"
            :style="{ color: '#15252B', fontSize: '12px', lineHeight: '16px' }"
            @click="openParticipationRules"
          >
            Правила участия
          </button>
        </div>
      </div>

      <div
        v-if="showParticipationRules"
        class="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      >
        <div class="w-full max-w-md rounded-2xl bg-[#f2f5f6] p-5 shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]">
          <div class="mb-3 flex items-start justify-between gap-4">
            <h3 class="text-lg font-medium text-[#15252b]">Правила участия</h3>
            <button
              type="button"
              class="text-xs text-[#15252b]/60"
              @click="closeParticipationRules"
            >
              Закрыть
            </button>
          </div>
          <div class="space-y-3 text-sm leading-5 text-[#15252b]/70">
            <p>
              <strong>Правила участия в промо-игре «Башня доброты»</strong>
            </p>
            <div class="max-h-[55vh] overflow-y-auto pr-1">
              <ol class="list-decimal list-inside space-y-2 pl-1">
                <li
                  v-for="rule in participationRules"
                  :key="rule"
                >
                  {{ rule }}
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else
      data-overlay="start-step2"
      class="absolute inset-0 z-50 flex flex-col items-center justify-start bg-black/70 backdrop-blur-sm p-4 sm:p-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto"
      :style="startOverlayStyle"
    >
      <div
        class="my-auto w-full max-w-md rounded-2xl bg-[#f2f5f6] p-5 sm:p-6 shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]"
        :style="startCardStyle"
      >
        <div class="mb-4 text-center">
          <p
            class="text-[10px] leading-[15px] tracking-[1px] uppercase text-[#15252b]"
            :style="{ color: '#15252b', fontSize: '10px', lineHeight: '15px', letterSpacing: '1px' }"
          >
            Шаг 2 из 2
          </p>
          <h2
            class="mt-2 text-[24px] leading-8 font-medium text-[#15252b]"
            :style="{ color: '#15252b', fontSize: '24px', lineHeight: '32px', fontWeight: 500 }"
          >
            Правила и награды
          </h2>
        </div>

        <div class="mb-3 rounded-xl bg-[#b4d3ff] p-4 shadow-[2px_2px_12px_rgba(0,0,0,0.05)]">
          <p class="mb-2 text-[14px] leading-4 font-medium text-[#15252b]">Какие же правила?</p>
          <div class="space-y-2">
            <div
              v-for="(rule, index) in rules"
              :key="rule"
              class="flex items-start gap-2.5"
            >
              <span class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f2f5f6] text-[12px] leading-5 font-bold text-[#ff2c00]">
                {{ index + 1 }}
              </span>
              <span class="text-[12px] leading-[16px] text-[#15252b]">{{ rule }}</span>
            </div>
          </div>
        </div>

        <div class="mb-3 rounded-xl bg-white p-4 shadow-[2px_2px_12px_rgba(0,0,0,0.05)]">
          <p class="mb-2 text-[14px] leading-4 font-medium text-[#15252b]">Награды за уровни</p>
          <div class="space-y-2">
            <div
              v-for="reward in PROMO_REWARDS"
              :key="reward.score"
              class="flex items-center justify-between rounded-lg bg-[rgba(180,211,255,0.2)] px-3 py-2"
            >
              <span class="text-[12px] leading-4 text-[#15252b]">{{ reward.score }} очков</span>
              <span class="text-[14px] leading-5 font-medium text-[#ff2c00]">Скидка {{ reward.discount }} ₽</span>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2.5">
          <button
            type="button"
            data-name="button.w-full"
            class="w-full rounded-[12px] px-6 py-4 text-white"
            :style="[
              primaryButtonStyle,
              { color: '#ffffff', borderRadius: '12px', padding: '16px 24px' }
            ]"
            @click="emitStart"
          >
            <span
              class="flex items-center justify-center gap-2 text-[18px] leading-7 font-medium"
              :style="{ color: '#ffffff', fontSize: '18px', lineHeight: '28px', fontWeight: 500 }"
            >
              <span data-name="Frame" class="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                  <path
                    :d="svgPaths.p1d055380"
                    fill="white"
                    stroke="white"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.66667"
                  />
                </svg>
              </span>
              Начать игру
            </span>
          </button>

          <button
            type="button"
            data-name="button.mt-4"
            class="w-full rounded-[12px] border border-white/10 bg-[#b4d3ff] px-4 py-[13px] text-[14px] leading-5 font-medium text-[#15252b] shadow-[2px_2px_12px_rgba(0,0,0,0.05)]"
            :style="[
              secondaryButtonStyle,
              {
                color: '#15252b',
                borderRadius: '12px',
                padding: '13px 16px',
                fontSize: '14px',
                lineHeight: '20px',
                fontWeight: 500,
              }
            ]"
            @click="goToOnboardingStep1"
          >
            Назад
          </button>
        </div>
      </div>
    </div>
    </template>

    <div
      v-else-if="gameState === GameState.LEADERBOARD"
      class="absolute inset-0 z-50 flex flex-col items-center justify-start bg-black/70 backdrop-blur-sm p-4 sm:p-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto"
    >
      <div class="my-auto w-full max-w-md rounded-3xl bg-[#f2f5f6] p-5 sm:p-6 shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]">
        <div class="mb-5 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(255,212,102,0.3)]">
              <svg class="h-[22px] w-[22px]" fill="none" viewBox="0 0 22 22">
                <path
                  :d="svgPaths.p2f60c500"
                  stroke="#FFD466"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.83333"
                />
                <path
                  d="M4.58333 19.25H17.4167"
                  stroke="#FFD466"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.83333"
                />
              </svg>
            </div>
            <div>
              <p class="text-[10px] leading-[15px] tracking-[1px] uppercase text-[#15252b]">Топ игроков</p>
              <h2 class="text-[24px] leading-8 font-medium text-[#15252b]">Рейтинг игроков</h2>
            </div>
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-[#15252b]/60"
            @click="emitCloseLeaderboard"
          >
            <svg class="h-[14px] w-[14px]" fill="none" viewBox="0 0 14 14">
              <path
                :d="svgPaths.p2c0cbc0"
                opacity="0.5"
                stroke="#15252B"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.16667"
              />
              <path
                d="M11.0833 7H2.91667"
                opacity="0.5"
                stroke="#15252B"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.16667"
              />
            </svg>
            Назад
          </button>
        </div>

        <div
          v-if="leaderboardStatus === 'error'"
          class="rounded-2xl bg-[#ffd466] px-4 py-6 text-center text-[14px] leading-5 text-[#15252b]"
        >
          Рейтинг игроков пока недоступен
        </div>
        <div
          v-else-if="sortedLeaderboardEntries.length === 0"
          class="rounded-2xl bg-[#ffd466] px-4 py-6 text-center text-[14px] leading-5 text-[#15252b]"
        >
          Игроков в списке пока нет, но вы можете стать первым :)
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="(entry, index) in sortedLeaderboardEntries"
            :key="`${entry.nickname}-${entry.score}-${entry.id || index}`"
            :class="[
              entry.nickname === nickname ? 'bg-[#FFD466]' : 'bg-[#F6E4B7]',
              'flex items-center justify-between rounded-2xl px-4 py-3 shadow-[2px_2px_12px_0px_rgba(0,0,0,0.05)]'
            ]"
          >
            <div class="flex min-w-0 items-center gap-3">
              <div class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2f5f6] text-[12px] leading-4 font-medium text-[#15252b]">
                {{ index + 1 }}
              </div>
              <div class="flex min-w-0 items-center gap-2">
                <span class="truncate text-[16px] leading-6 font-medium text-[#15252b]">{{ entry.nickname }}</span>
                <span
                  v-if="entry.nickname === nickname"
                  class="whitespace-nowrap text-[10px] leading-[15px] tracking-[1px] uppercase text-[rgba(21,37,43,0.5)]"
                >
                  это вы
                </span>
              </div>
            </div>
            <span class="ml-3 shrink-0 text-[14px] leading-5 font-medium text-[#15252b]">{{ entry.score }}</span>
          </div>
        </div>

        <div class="mt-3 rounded-2xl bg-[#b4d3ff] px-4 py-3 shadow-[2px_2px_12px_0px_rgba(0,0,0,0.05)]">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-1 text-[14px] leading-5 text-[#15252b]">
              <span class="font-medium">Ваш ник:</span>
              <span class="max-w-[42vw] truncate font-bold sm:max-w-[220px]">{{ nickname || '—' }}</span>
            </div>
            <div class="flex items-center gap-1 text-[14px] leading-5 text-[#15252b]">
              <span class="font-normal">Рекорд:</span>
              <span class="font-medium">{{ score.best }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template v-else-if="gameState === GameState.GAME_OVER">
    <div
      v-if="score.current > 0"
      class="absolute inset-0 z-40 flex flex-col items-center justify-start bg-black/70 backdrop-blur-sm p-4 sm:p-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto"
    >
      <div class="my-auto w-full max-w-md rounded-3xl bg-[#f2f5f6] p-5 sm:p-6 shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(255,44,0,0.2)]">
              <svg class="h-[26px] w-[26px]" fill="none" viewBox="0 0 26 26">
                <path
                  :d="svgPaths.p10c19f00"
                  fill="#FF2C00"
                  stroke="#FF2C00"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.16667"
                />
              </svg>
            </div>
            <div>
              <p class="text-[10px] leading-[15px] tracking-[1.5px] uppercase text-[#15252b]">Благотворительность</p>
              <h2 class="text-[24px] leading-[26px] font-medium text-[#15252b]">Каждая игра — шаг к добру</h2>
            </div>
          </div>
          <div
            v-if="score.current >= score.best"
            class="inline-flex items-center gap-2 rounded-full border border-[#ffd466] bg-[rgba(255,212,102,0.2)] px-3 py-1"
          >
            <svg class="h-[14px] w-[12px]" fill="none" viewBox="0 0 11.47 14.0015">
              <path
                :d="svgPaths.p17d743e8"
                stroke="#FFD466"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="0.955833"
              />
              <path
                :d="svgPaths.p2a89eb80"
                stroke="#FFD466"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="0.955833"
              />
              <path
                :d="svgPaths.p54eb100"
                stroke="#FFD466"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="0.955833"
              />
              <path
                d="M1.91167 11.7799H9.55753"
                stroke="#FFD466"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="0.955833"
              />
              <path
                :d="svgPaths.p57a9b00"
                stroke="#FFD466"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="0.955833"
              />
              <path
                :d="svgPaths.p17482af0"
                stroke="#FFD466"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="0.955833"
              />
            </svg>
            <span class="text-[12px] leading-4 font-medium text-[#ffd466]">Новый рекорд</span>
          </div>
        </div>

        <div class="mb-4 rounded-2xl bg-[#b4d3ff] p-4 shadow-[2px_2px_12px_0px_rgba(0,0,0,0.05)]">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-[11px] leading-[16.5px] tracking-[1px] uppercase text-[#15252b]">Очки</span>
            <span class="text-[30px] leading-9 font-medium text-[#15252b]">{{ score.current }}</span>
          </div>
          <div class="mb-2 flex items-center justify-between">
            <span class="text-[11px] leading-[16.5px] tracking-[1px] uppercase text-[#15252b]">Пожертвование</span>
            <span class="text-[36px] leading-10 font-medium text-[#ff2c00]">{{ donation }} ₽</span>
          </div>
          <p class="text-[12px] leading-[14px] text-[#15252b]">В конце Рамадана эта сумма будет направлена на благотворительность</p>
        </div>

        <div class="mb-4 rounded-2xl bg-[rgba(255,255,255,0.5)] p-4 shadow-[2px_2px_12px_0px_rgba(0,0,0,0.05)]">
          <div class="flex items-start gap-3">
            <svg class="mt-[2px] h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 17.7 17.9968">
              <path
                :d="svgPaths.p3f949880"
                stroke="#FFD466"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.475"
              />
              <path
                d="M14.75 1.62342V4.57394"
                stroke="#FFD466"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.475"
              />
              <path
                d="M16.2255 3.09842H13.275"
                stroke="#FFD466"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.475"
              />
              <path
                :d="svgPaths.p2491c700"
                stroke="#FFD466"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.475"
              />
            </svg>
            <div>
              <p class="text-[14px] leading-5 font-medium text-[#15252b]">Каждый балл — вклад в копилку добра.</p>
              <p class="text-[14px] leading-5 text-[#15252b]">Можно сыграть ещё раз и увеличить сумму пожертвования</p>
            </div>
          </div>
        </div>

        <div
          v-if="earnedReward"
          class="mb-4 rounded-2xl bg-white p-4 shadow-[2px_2px_12px_0px_rgba(0,0,0,0.05)]"
        >
          <div class="mb-3 flex items-start gap-3">
            <svg class="mt-[2px] h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 18 18">
              <path
                :d="svgPaths.p34d63080"
                stroke="#FFD466"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
              />
              <path
                d="M3.75 15.75H14.25"
                stroke="#FFD466"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
              />
            </svg>
            <div>
              <p class="text-[14px] leading-5 font-medium text-[#15252b]">Ваша награда:</p>
              <p class="text-[14px] leading-5 text-[#15252b]">
                <span>Скидка на {{ earnedReward.discount }} ₽ </span>
                <span class="whitespace-nowrap">при покупке от 25 000 ₽</span>
              </p>
              <p class="text-[12px] leading-4 text-[#15252b]/70">(не действует на технику Apple)</p>
            </div>
          </div>
          <button
            type="button"
            class="relative w-full rounded-xl border border-dashed border-[rgba(255,255,255,0.2)] bg-[#b4d3ff] p-3"
            @click="copyCode"
          >
            <p class="text-center text-[10px] leading-5 tracking-[1px] uppercase text-[#15252b]">Промокод</p>
            <div class="mt-1 flex items-center justify-center gap-2">
              <span class="font-['Menlo:Bold',sans-serif] text-[20px] leading-7 tracking-[2px] text-[#15252b]">{{ earnedReward.code }}</span>
              <svg class="h-4 w-4" fill="none" viewBox="0 0 16 16">
                <path
                  :d="svgPaths.p216f800"
                  opacity="0.2"
                  stroke="#15252B"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.33333"
                />
                <path
                  :d="svgPaths.p13e4b3c0"
                  opacity="0.2"
                  stroke="#15252B"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.33333"
                />
              </svg>
            </div>
            <div
              v-if="copied"
              class="absolute inset-0 flex items-center justify-center rounded-xl bg-[#15252b]/90 text-sm font-semibold text-white"
            >
              СКОПИРОВАНО!
            </div>
          </button>
        </div>

        <div :class="['flex flex-col gap-3', gameOverCooldown ? 'pointer-events-none opacity-70' : '']">
          <button
            type="button"
            data-name="button.w-full"
            class="w-full rounded-[12px] px-6 py-3 text-[16px] leading-6 font-medium text-white"
            :style="primaryButtonStyle"
            :disabled="gameOverCooldown"
            @click="emitRestart"
          >
            Сыграть ещё раз
          </button>
          <button
            type="button"
            data-name="button.w-full"
            class="flex w-full items-center justify-center gap-2 rounded-[12px] border border-white/10 bg-[#b4d3ff] px-6 py-3 text-[14px] leading-5 font-medium text-[#15252b]"
            :disabled="gameOverCooldown"
            @click="emitOpenLeaderboard"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 16 16">
              <path
                :d="svgPaths.p10a7d900"
                stroke="#15252B"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.33333"
              />
              <path
                d="M3.33333 14H12.6667"
                stroke="#15252B"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.33333"
              />
            </svg>
            Посмотреть рейтинг игроков
          </button>
        </div>
      </div>
    </div>

    <div
      v-else
      class="absolute inset-0 z-40 flex flex-col items-center justify-start bg-black/70 backdrop-blur-sm p-4 sm:p-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto"
    >
      <div class="my-auto w-full max-w-md text-center">
        <h2 class="text-[36px] leading-10 font-medium text-[#ff2c00]">Ваша башня упала</h2>
        <p class="mt-1 text-[16px] leading-6 text-white/60">Но можно попробовать ещё раз</p>

        <div class="mt-3 flex items-center justify-center gap-3 text-center">
          <span class="text-[18px] leading-7 text-white/60">Высота:</span>
          <span class="text-[48px] leading-[48px] font-medium text-[#ff2c00]">{{ score.current }}</span>
        </div>

        <div :class="['mt-6 flex flex-col items-center gap-3', gameOverCooldown ? 'pointer-events-none opacity-70' : '']">
          <button
            type="button"
            data-name="button.px-8"
            class="inline-flex items-center gap-2 rounded-full px-8 py-3 text-[18px] leading-7 text-[#f2f5f6]"
            :style="primaryButtonStyle"
            :disabled="gameOverCooldown"
            @click="emitRestart"
          >
            <span class="inline-flex h-5 w-5 shrink-0 items-center justify-center" data-name="Frame">
              <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                <path
                  :d="svgPaths.pd0f9a00"
                  stroke="#F2F5F6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.66667"
                />
                <path
                  d="M17.5 2.5V6.66667H13.3333"
                  stroke="#F2F5F6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.66667"
                />
              </svg>
            </span>
            Попробовать снова
          </button>
          <button
            type="button"
            data-name="button.px-6"
            class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-[9px] text-[14px] leading-5 text-[#f2f5f6]"
            :disabled="gameOverCooldown"
            @click="emitOpenLeaderboard"
          >
            <span class="inline-flex h-4 w-4 shrink-0 items-center justify-center" data-name="Frame">
              <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
                <path
                  :d="svgPaths.p10a7d900"
                  stroke="#F2F5F6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.33333"
                />
                <path
                  d="M3.33333 14H12.6667"
                  stroke="#F2F5F6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.33333"
                />
              </svg>
            </span>
            Посмотреть рейтинг игроков
          </button>
        </div>
      </div>
    </div>
    </template>

    <template v-else-if="gameState === GameState.PLAYING">
    <div
      data-overlay="hud"
      class="absolute top-0 left-0 z-20 flex w-full items-start justify-between p-4 pointer-events-none"
    >
      <div class="flex flex-col">
        <span class="text-[12px] font-['PP_Right_Grotesk:Bold',sans-serif] uppercase text-[rgba(255,255,255,0.6)] leading-[16px]">
          Этаж
        </span>
        <span class="text-white text-[36px] leading-[40px] font-['PP_Right_Grotesk:Medium',sans-serif]">
          {{ score.current }}
        </span>
      </div>
      <div class="flex flex-col items-end">
        <span class="text-[12px] font-['PP_Right_Grotesk:Bold',sans-serif] uppercase text-[rgba(255,255,255,0.6)] leading-[16px]">
          Рекорд
        </span>
        <span class="text-[#ffd466] text-[24px] leading-[32px] font-['PP_Right_Grotesk:Bold',sans-serif]">
          {{ score.best }}
        </span>
      </div>
    </div>

    <div
      data-overlay="progress"
      class="absolute top-20 left-1/2 -translate-x-1/2 z-20 w-[min(92vw,560px)] pointer-events-none bg-[#15252B]"
      :style="{ backgroundColor: '#15252B' }"
    >
      <div
        v-if="nextReward"
        data-name="div.rounded-2xl"
        class="backdrop-blur-[4px] bg-[#15252B] relative rounded-[16px] shrink-0 w-full"
      >
        <div
          aria-hidden="true"
          class="absolute border border-[rgba(255,255,255,0.1)] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_10px_30px_0px_rgba(0,0,0,0.35)]"
        />
        <div class="content-stretch flex flex-col gap-[8px] items-start pb-[13px] pt-[12px] px-[17px] relative w-full">
          <div class="relative w-full" data-name="div.flex">
            <div class="content-stretch flex items-center justify-between relative w-full">
              <div class="content-stretch flex flex-col items-start relative" data-name="span">
                <div class="flex flex-col font-['PP_Right_Grotesk:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-[rgba(255,255,255,0.6)] uppercase whitespace-nowrap">
                  <p class="leading-[16.5px]">До награды</p>
                </div>
              </div>
              <div class="content-stretch flex flex-col items-start relative" data-name="span">
                <div class="flex flex-col font-['PP_Right_Grotesk:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-[rgba(255,255,255,0.6)] uppercase whitespace-nowrap">
                  <p class="leading-[16.5px]">{{ remainingToReward }} этажей</p>
                </div>
              </div>
            </div>
          </div>

          <div class="relative w-full" data-name="div.mt-2">
            <div class="content-stretch flex items-center justify-between relative w-full">
              <div class="content-stretch flex flex-col items-start relative" data-name="span.font-semibold">
                <div class="flex flex-col font-['PP_Right_Grotesk:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-white whitespace-nowrap">
                  <p>
                    <span class="leading-[20px]">Скидка </span>
                    <span class="leading-[20px] text-[#ffd466]">{{ nextReward.discount }} ₽</span>
                  </p>
                </div>
              </div>
              <div class="content-stretch flex flex-col items-start relative" data-name="span">
                <div class="flex flex-col font-['PP_Right_Grotesk:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-[rgba(255,255,255,0.7)] whitespace-nowrap">
                  <p class="leading-[20px]">{{ score.current }}/{{ nextReward.score }}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="relative w-full mt-1" data-name="div.mt-3">
            <div class="grid grid-cols-3 gap-1 relative w-full">
              <div
                v-for="(reward, index) in PROMO_REWARDS"
                :key="reward.score"
                class="bg-[rgba(255,255,255,0.1)] h-[8px] overflow-clip relative rounded-[9999px] w-full"
                data-name="div.relative"
              >
                <div
                  data-name="div.h-full"
                  class="h-full rounded-[9999px]"
                  :class="{ 'bg-[#f2f5f6]': score.current < reward.score }"
                  :style="{ width: `${Math.round(segmentProgress(index) * 100)}%` }"
                />
              </div>
            </div>
          </div>

          <div class="relative w-full" data-name="div.mt-2">
            <div class="content-stretch flex items-center justify-between relative w-full">
              <div class="content-stretch flex flex-col items-start relative" data-name="span">
                <div class="flex flex-col font-['PP_Right_Grotesk:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-[rgba(255,255,255,0.5)] whitespace-nowrap">
                  <p class="leading-[15px]">Прогресс</p>
                </div>
              </div>
              <div class="content-stretch flex flex-col items-start relative" data-name="span">
                <div class="flex flex-col font-['PP_Right_Grotesk:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-[rgba(255,255,255,0.5)] whitespace-nowrap">
                  <p class="leading-[15px]">{{ Math.round(overallProgress * 100) }}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        data-name="div.rounded-full"
        class="backdrop-blur-[4px] bg-[#ffd466] content-stretch flex flex-col items-center px-[17px] py-[9px] relative rounded-[9999px] shrink-0 w-full"
      >
        <div
          aria-hidden="true"
          class="absolute border border-[#ffd466] border-solid inset-0 pointer-events-none rounded-[9999px]"
        />
        <div class="flex flex-col font-['PP_Right_Grotesk:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#15252b] text-[12px] text-center whitespace-nowrap">
          <p class="leading-[16px]">Все награды получены. Продолжайте играть!</p>
        </div>
      </div>
    </div>
    </template>

    <div
      v-else
      data-overlay="hud"
      class="absolute top-0 left-0 z-20 flex w-full items-start justify-between p-4 pointer-events-none"
    >
      <div class="flex flex-col">
        <span class="text-[12px] font-['PP_Right_Grotesk:Bold',sans-serif] uppercase text-[rgba(255,255,255,0.6)] leading-[16px]">
          Этаж
        </span>
        <span class="text-white text-[36px] leading-[40px] font-['PP_Right_Grotesk:Medium',sans-serif]">
          {{ score.current }}
        </span>
      </div>
      <div class="flex flex-col items-end">
        <span class="text-[12px] font-['PP_Right_Grotesk:Bold',sans-serif] uppercase text-[rgba(255,255,255,0.6)] leading-[16px]">
          Рекорд
        </span>
        <span class="text-[#ffd466] text-[24px] leading-[32px] font-['PP_Right_Grotesk:Bold',sans-serif]">
          {{ score.best }}
        </span>
      </div>
    </div>
  </div>
  </div>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from '@nuxtjs/composition-api';
import { GameEngine } from '~/utils/gameEngine';
import { PROMO_REWARDS } from '~/constants';
import {
  GameScore,
  GameState,
  LeaderboardEntry,
  LeaderboardStatus,
  PromoReward,
} from '~/types';
import {
  fetchLeaderboard,
  getOrCreateNickname,
  submitScore,
} from '~/utils/leaderboard';
import svgPaths from '~/utils/svgPaths';

const STORAGE_KEY = '05ru_tech_tower_best';

export default defineComponent({
  name: 'IndexPage',
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

    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const engineRef = ref<GameEngine | null>(null);

    const copied = ref(false);
    const onboardingStep = ref(1);
    const gameOverCooldown = ref(false);
    const showParticipationRules = ref(false);

    const copyTimer = ref<number | null>(null);
    const cooldownTimer = ref<number | null>(null);

    const rules = [
      '«Отпускайте» ящик, когда он окажется над башней, одним нажатием на экран.',
      'Старайтесь собирать башню ровно. Если края выйдут за границы, они будут обрезаны.',
      'Чем выше башня, тем больше баллов будет направлено на благотворительность.',
    ];

    const participationRules = [
      'Организатор акции — магазин электроники 05.ru.',
      'Период проведения акции: с 17 февраля 2026 года по 19 марта 2026 года включительно.',
      'К участию допускаются физические лица старше 18 лет.',
      'Участник играет в «Башню доброты» и получает баллы за успешную установку блоков.',
      'Каждый балл учитывается как 1 ₽ в благотворительную копилку акции.',
      'В конце Рамадана организатор перечисляет сумму, эквивалентную сумме баллов, на благотворительные цели.',
      'Баллы не являются денежными средствами, не подлежат выводу, передаче третьим лицам и не могут использоваться для оплаты товаров.',
      'Промокоды по уровням: 10 баллов — 500 ₽, 20 баллов — 1000 ₽, 30 баллов — 1500 ₽.',
      'Все промокоды действуют до 19 марта 2026 года включительно.',
      'Скидка применяется при покупке от 25 000 ₽ и не действует на технику Apple.',
      'Организатор вправе исключать результаты, полученные с использованием ботов, автоматизации и иных недобросовестных методов участия.',
      'Организатор вправе досрочно завершить акцию и/или изменить правила, включая сроки. Актуальная редакция размещается на сайте 05.ru в разделе «Акции».',
      'Участвуя в акции, участник подтверждает согласие на обработку персональных данных в объеме, необходимом для проведения акции.',
      'Акция не является лотереей и не требует обязательной покупки.',
    ];

    const nextReward = computed(() => {
      return PROMO_REWARDS.find((reward) => reward.score > score.value.current) || null;
    });

    const remainingToReward = computed(() => {
      if (!nextReward.value) {
        return 0;
      }

      return Math.max(0, nextReward.value.score - score.value.current);
    });

    const earnedReward = computed<PromoReward | null>(() => {
      const copy = [...PROMO_REWARDS].reverse();
      return copy.find((reward) => reward.score <= score.value.current) || null;
    });

    const activePromoCode = computed(() => {
      return earnedReward.value?.code || null;
    });

    const totalGoal = computed(() => {
      return PROMO_REWARDS[PROMO_REWARDS.length - 1]?.score || 0;
    });

    const overallProgress = computed(() => {
      if (!totalGoal.value) {
        return 0;
      }

      return Math.min(1, score.value.current / totalGoal.value);
    });

    const sortedLeaderboardEntries = computed(() => {
      return [...leaderboardEntries.value].sort((a, b) => b.score - a.score);
    });

    const donation = computed(() => score.value.current);

    const segmentProgress = (index: number) => {
      if (!totalGoal.value || PROMO_REWARDS.length === 0) {
        return 0;
      }

      const segmentSize = totalGoal.value / PROMO_REWARDS.length;
      const segmentStart = index * segmentSize;
      const segmentEnd = segmentStart + segmentSize;

      if (score.value.current <= segmentStart) {
        return 0;
      }

      if (score.value.current >= segmentEnd) {
        return 1;
      }

      return (score.value.current - segmentStart) / segmentSize;
    };

    const copyCode = async () => {
      if (!activePromoCode.value || typeof navigator === 'undefined') {
        return;
      }

      await navigator.clipboard.writeText(activePromoCode.value);

      copied.value = true;

      if (copyTimer.value !== null) {
        window.clearTimeout(copyTimer.value);
      }

      copyTimer.value = window.setTimeout(() => {
        copied.value = false;
      }, 2000);
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
      engineRef.value?.start();
    };

    const restartGame = () => {
      gameState.value = GameState.PLAYING;
      engineRef.value?.start();
    };

    const handleScreenTap = () => {
      if (gameState.value === GameState.PLAYING) {
        engineRef.value?.handleInput();
      }
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
        engineRef.value?.handleInput();
      }
    };

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

    watch(
      gameState,
      (state) => {
        if (state !== GameState.START) {
          onboardingStep.value = 1;
          showParticipationRules.value = false;
        }

        if (cooldownTimer.value !== null) {
          window.clearTimeout(cooldownTimer.value);
          cooldownTimer.value = null;
        }

        if (state === GameState.GAME_OVER) {
          gameOverCooldown.value = true;
          cooldownTimer.value = window.setTimeout(() => {
            gameOverCooldown.value = false;
          }, 1200);
          return;
        }

        gameOverCooldown.value = false;
      },
      { immediate: true }
    );

    const emitStart = () => startGame();
    const emitRestart = () => restartGame();
    const emitOpenLeaderboard = () => {
      void openLeaderboard();
    };
    const emitCloseLeaderboard = () => closeLeaderboard();

    const goToOnboardingStep1 = () => {
      onboardingStep.value = 1;
    };

    const goToOnboardingStep2 = () => {
      onboardingStep.value = 2;
    };

    const openParticipationRules = () => {
      showParticipationRules.value = true;
    };

    const closeParticipationRules = () => {
      showParticipationRules.value = false;
    };

    const primaryButtonStyle = {
      background:
        'radial-gradient(408.24% 368.51% at 67.25% 87.2%, #FF0000 0%, rgba(255, 92, 0, 0) 100%), #FF5C00',
      boxShadow: '0px 4px 20px rgba(255, 44, 0, 0.4)',
      border: '1px solid rgba(255,255,255,0.1)',
    };

    const secondaryButtonStyle = {
      border: '1px solid rgba(255,255,255,0.1)',
      background: '#B4D3FF',
      boxShadow: '2px 2px 12px rgba(0,0,0,0.05)',
    };

    const startOverlayStyle = {
      position: 'absolute',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(4px)',
      padding: 'max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom))',
      overflowY: 'auto',
    };

    const startCardStyle = {
      width: '100%',
      maxWidth: '448px',
      margin: 'auto 0',
      borderRadius: '16px',
      background: '#f2f5f6',
      boxShadow: '0px 25px 50px -12px rgba(0,0,0,0.25)',
      padding: '20px',
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

      if (canvasRef.value) {
        engineRef.value = new GameEngine(
          canvasRef.value,
          {
            onScoreUpdate: updateScore,
            onGameOver: handleGameOver,
          },
          {
            boxStyle: 'v2',
          }
        );
      }
    });

    onBeforeUnmount(() => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';

      if (copyTimer.value !== null) {
        window.clearTimeout(copyTimer.value);
      }

      if (cooldownTimer.value !== null) {
        window.clearTimeout(cooldownTimer.value);
      }

      engineRef.value?.cleanup();
    });

    return {
      GameState,
      PROMO_REWARDS,
      canvasRef,
      closeParticipationRules,
      copied,
      copyCode,
      donation,
      earnedReward,
      emitCloseLeaderboard,
      emitOpenLeaderboard,
      emitRestart,
      emitStart,
      gameOverCooldown,
      gameState,
      goToOnboardingStep1,
      goToOnboardingStep2,
      handleScreenTap,
      leaderboardEntries,
      leaderboardStatus,
      nextReward,
      nickname,
      onboardingStep,
      openParticipationRules,
      overallProgress,
      participationRules,
      primaryButtonStyle,
      remainingToReward,
      rules,
      score,
      secondaryButtonStyle,
      segmentProgress,
      showParticipationRules,
      sortedLeaderboardEntries,
      startCardStyle,
      startOverlayStyle,
      svgPaths,
    };
  },
});
</script>
