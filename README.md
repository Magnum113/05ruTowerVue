# 05.ru Tech Tower (Nuxt 2 + Vue 2)

Проект мигрирован с React/Vite на:
- Nuxt 2 (SPA)
- Vue 2 + Composition API (`setup`)
- TypeScript
- Чистый CSS на PostCSS (`.pcss`) без Tailwind-зависимости
- Canvas game engine (`utils/gameEngine.ts`)
- Supabase leaderboard (`@supabase/supabase-js`)

## Запуск

1. `npm install`
2. Настройте переменные окружения:
   - `SUPABASE_URL` (или `VITE_SUPABASE_URL`)
   - `SUPABASE_ANON_KEY` (или `VITE_SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY`)
3. `npm run dev`

## Сборка

- `npm run build`
- `npm run start`
- `npm run generate`
