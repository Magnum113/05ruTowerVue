import { NuxtConfig } from '@nuxt/types';

const config: NuxtConfig = {
  ssr: true,
  head: {
    title: '05.ru Tech Tower',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        hid: 'description',
        name: 'description',
        content: '05.ru Tech Tower game powered by Nuxt 2 + Vue 2',
      },
    ],
  },
  css: [],
  components: false,
  buildModules: [
    '@nuxt/typescript-build',
    '@nuxtjs/composition-api/module',
  ],
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    SUPABASE_ANON_KEY:
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      '',
  },
  build: {
    transpile: [
      /^@supabase/,
      /^iceberg-js/,
    ],
    postcss: {
      postcssOptions: {
        plugins: {
          autoprefixer: {},
        },
      },
    },
  },
};

export default config;
