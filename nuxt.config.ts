// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxt/content',
  ],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'VibeFront - AI 前端知识学习平台',
      htmlAttrs: { lang: 'zh-CN', class: 'dark' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'AI 驱动的前端开发者知识学习平台' },
      ],
      link: [
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
        },
      ],
    },
  },

  content: {
    highlight: {
      theme: 'github-dark',
    },
    experimental: {
      sqliteConnector: 'native',
    },
  },
})
