// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxt/content',
  ],

  css: ['~/assets/css/main.css'],

  // GitHub Pages 部署配置
  app: {
    baseURL: '/vibe-front/',
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

  // 静态站点生成
  nitro: {
    prerender: {
      routes: [
        '/',
        '/roadmap',
        '/prompts',
        '/playground',
        '/roadmap/01-dev-environment',
        '/roadmap/02-vercel-ai-sdk',
        '/roadmap/03-function-calling',
        '/roadmap/04-rag-frontend',
        '/roadmap/05-mcp-protocol',
        '/prompts/01-bug-debugging',
        '/prompts/02-component-refactor',
        '/prompts/03-ui-generation',
        '/prompts/04-typescript-types',
        '/prompts/05-test-generation',
        '/prompts/06-performance',
        '/playground/01-architecture',
        '/playground/02-chat-engine',
        '/playground/03-rag-integration',
        '/playground/04-agent-deploy',
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
