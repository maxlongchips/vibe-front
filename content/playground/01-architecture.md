---
title: 架构设计与项目初始化
description: Nuxt 3 + Vercel AI SDK + Tailwind 项目搭建、BFF 架构设计、API Key 安全方案
tags: ['实战', 'architecture', 'nuxt3', 'project-setup']
category: 实战演练
---

# 实战 01：架构设计与项目初始化

> 好的架构是成功的一半。这一步做对了，后面全是顺风局。

## 项目目标

构建一个 **AI 驱动的智能文档助手**，功能包括：

- 对话式问答（流式输出）
- 知识库检索（RAG）
- 工具调用（Function Calling）
- 暗黑主题 UI

## 技术栈

```
前端：Nuxt 3 + Vue 3 + Tailwind CSS + TypeScript
AI：Vercel AI SDK + @ai-sdk/anthropic
存储：向量数据库（Qdrant / Pinecone）
部署：Vercel / Cloudflare
```

## 第一步：初始化项目

```bash
npx nuxi@latest init ai-doc-assistant
cd ai-doc-assistant

# 安装依赖
npm install ai @ai-sdk/anthropic @ai-sdk/openai
npm install -D @tailwindcss/typography
```

## 第二步：BFF 架构设计

为什么需要 BFF（Backend for Frontend）？

**绝对不能在前端直接调用 AI API。** 原因：

1. **安全**：API Key 暴露在浏览器中
2. **成本**：无法做服务端限流和计费
3. **灵活**：服务端可以做缓存、重试、降级

```
浏览器
  ↓ fetch('/api/chat')
Nuxt Server (BFF)
  ↓ SDK 调用
Claude API
```

### 目录结构

```
ai-doc-assistant/
├── components/
│   ├── chat/              # 对话相关组件
│   │   ├── ChatWindow.vue
│   │   ├── MessageBubble.vue
│   │   ├── ToolCallCard.vue
│   │   └── CitationPanel.vue
│   └── ui/                # 通用 UI 组件
│       ├── Button.vue
│       └── Loading.vue
├── composables/
│   ├── useChat.ts         # 对话逻辑
│   └── useRag.ts          # RAG 逻辑
├── server/
│   ├── api/
│   │   ├── chat.post.ts   # 对话 API
│   │   └── ingest.post.ts # 文档导入 API
│   └── utils/
│       ├── llm.ts         # LLM 配置
│       ├── vector.ts      # 向量数据库
│       └── chunker.ts     # 文档分块
├── content/               # 知识库文档
├── nuxt.config.ts
└── .env                   # 环境变量
```

## 第三步：环境变量与安全

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx        # 用于 Embedding
VECTOR_DB_URL=http://localhost:6333
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    // 仅服务端可访问
    anthropicApiKey: '',
    openaiApiKey: '',
    vectorDbUrl: '',

    // 客户端可访问
    public: {
      appName: 'AI Doc Assistant',
    },
  },
})
```

### API Key 安全方案

```typescript
// server/utils/llm.ts
import { createAnthropic } from '@ai-sdk/anthropic'

export function getAnthropicProvider() {
  const config = useRuntimeConfig()

  if (!config.anthropicApiKey) {
    throw createError({
      statusCode: 500,
      message: 'ANTHROPIC_API_KEY 未配置',
    })
  }

  return createAnthropic({
    apiKey: config.anthropicApiKey,
  })
}
```

## 第四步：全局暗黑主题 UI 框架

```vue
<!-- layouts/default.vue -->
<script setup lang="ts">
import { Zap, MessageSquare, Database, Settings } from 'lucide-vue-next'
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-300">
    <!-- 侧边栏 -->
    <aside class="fixed left-0 top-0 bottom-0 w-64 bg-zinc-900/50 border-r border-zinc-800 p-4">
      <div class="flex items-center gap-2 mb-8">
        <Zap class="w-5 h-5 text-emerald-400" />
        <span class="font-semibold text-zinc-100">AI Doc Assistant</span>
      </div>

      <nav class="space-y-1">
        <a href="/" class="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50">
          <MessageSquare class="w-4 h-4" />
          <span>对话</span>
        </a>
        <a href="/knowledge" class="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50">
          <Database class="w-4 h-4" />
          <span>知识库</span>
        </a>
        <a href="/settings" class="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50">
          <Settings class="w-4 h-4" />
          <span>设置</span>
        </a>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <main class="ml-64">
      <slot />
    </main>
  </div>
</template>
```

## 本节成果

- Nuxt 3 项目初始化完成
- BFF 架构设计清晰
- API Key 安全存储在服务端
- 暗黑主题 UI 框架搭好

**下一步：** [对话引擎核心：流式 Chat UI 开发](/playground/02-chat-engine)
