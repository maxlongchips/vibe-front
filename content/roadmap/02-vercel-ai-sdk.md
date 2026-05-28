---
title: Vercel AI SDK 核心：从 useChat 到 Agent 架构
description: AI SDK 6 的 useChat、ToolLoopAgent、消息分片模型、流式架构、Reranking、MCP 集成
tags: ['vercel-ai-sdk', 'streaming', 'ai-sdk-6', 'agent']
category: 学习路线
---

# Vercel AI SDK 核心：从 useChat 到 Agent 架构

> 流式输出不是"打字机效果"那么简单。理解底层机制，你才能处理真实场景中的各种边界情况。

## 为什么选 Vercel AI SDK？

2026 年的 AI 前端开发，SDK 选择已经收敛。Vercel AI SDK 月下载量超过 2000 万次。

- **框架无关**：支持 Vue、React、Svelte
- **流式一等公民**：从底层就为流式设计
- **TypeScript 原生**：类型推导精确到每一个 token
- **多模型支持**：Claude、GPT、Gemini、Mistral、xAI 一个接口搞定
- **Agent 原生**：AI SDK 6 提供了一等公民的 Agent 抽象

真实案例：Thomson Reuters 用 3 个开发者、2 个月时间，基于 Vercel AI SDK 构建了 CoCounsel（AI 法律助手），服务 1300 家会计事务所。

## 安装

```bash
npm install ai @ai-sdk/vue @ai-sdk/anthropic
```

## 核心概念：useChat

`useChat` 是整个 SDK 的核心。它不是一个简单的"发送消息"函数，而是一个**完整的聊天状态管理器**。

### 消息分片模型（Message Parts）

AI SDK 6 的杀手特性。消息不再是纯文本，而是**交错的 parts**：

```
一条消息可以包含：
├── text part: "根据搜索结果..."
├── tool-call part: { name: "search_docs", args: { query: "..." } }
├── tool-result part: { results: [...] }
├── reasoning part: { text: "让我分析一下..." }
└── text part: "总结如下..."
```

**你必须渲染每一种 part 类型**，否则工具调用的 UI 会丢失。

### 基础用法

```vue
<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'

const { messages, input, handleSubmit, isLoading, error, stop } = useChat({
  api: '/api/chat',
  headers: {
    'Authorization': `Bearer ${useRuntimeConfig().public.apiToken}`
  },
  body: {
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7
  },
  onError: (error) => {
    console.error('Chat error:', error)
  },
  onFinish: (message) => {
    console.log('Message completed:', message)
  }
})
</script>

<template>
  <div class="flex flex-col h-screen bg-zinc-950">
    <!-- 消息列表 -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="msg.role === 'user' ? 'text-right' : 'text-left'"
      >
        <div
          :class="[
            'inline-block max-w-[80%] rounded-lg px-4 py-2',
            msg.role === 'user'
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-800 text-zinc-200'
          ]"
        >
          {{ msg.content }}
        </div>
      </div>
    </div>

    <!-- 输入框 -->
    <form @submit="handleSubmit" class="p-4 border-t border-zinc-800">
      <div class="flex gap-2">
        <input
          v-model="input"
          placeholder="输入消息..."
          class="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg
                 text-zinc-200 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          :disabled="isLoading"
          class="px-4 py-2 bg-emerald-600 text-white rounded-lg
                 hover:bg-emerald-500 disabled:opacity-50"
        >
          {{ isLoading ? '生成中...' : '发送' }}
        </button>
        <button
          v-if="isLoading"
          type="button"
          @click="stop"
          class="px-4 py-2 bg-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-600"
        >
          停止
        </button>
      </div>
    </form>
  </div>
</template>
```

## 服务端：流式 API 路由

```typescript
// server/api/chat.post.ts
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

export default defineLazyEventHandler(async () => {
  const apiKey = useRuntimeConfig().anthropicApiKey

  return defineEventHandler(async (event) => {
    const { messages } = await readBody(event)

    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: '你是一个专业的前端开发助手，擅长 Vue 3、Nuxt 3、TypeScript。',
      messages,
      maxTokens: 4096,
    })

    return result.toDataStreamResponse()
  })
})
```

## SSE 原理：流式传输到底怎么回事？

很多人以为流式输出是 WebSocket，其实是 **SSE（Server-Sent Events）**。

### 数据流路径

```
Claude API (streaming)
    ↓ SSE
Nuxt Server (streamText)
    ↓ ReadableStream
浏览器 (EventSource / fetch)
    ↓ 逐 chunk 渲染
用户看到打字机效果
```

### SSE 协议格式

```
data: {"type":"text","text":"你"}

data: {"type":"text","text":"好"}

data: [DONE]
```

每个 `data:` 行是一个 chunk，浏览器可以**边接收边渲染**，不需要等整个响应完成。

## AI SDK 6：Agent 抽象

AI SDK 6 引入了一等公民的 `ToolLoopAgent` — 处理完整的工具执行循环：

```
调用 LLM → 执行工具调用 → 把结果加回消息 → 重复（最多 20 步）
```

```typescript
import { ToolLoopAgent } from 'ai'

const weatherAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4-20250514',
  instructions: '你是一个天气助手。',
  tools: { weather: weatherTool },
})

// 在 API 路由中使用
const result = await weatherAgent.generate({ prompt: '旧金山天气怎么样？' })
```

**核心优势：** 定义一次，可以在聊天 UI、后台任务、API 端点中复用，完整类型安全。

## Call Options：类型安全的请求参数

```typescript
// 定义 call options schema
import { z } from 'zod'

const callOptionsSchema = z.object({
  context: z.string().optional().describe('RAG 检索到的上下文'),
  model: z.enum(['sonnet', 'opus']).optional(),
})

// 在 agent 中使用
const agent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4-20250514',
  callOptionsSchema,
  tools: { /* ... */ },
})

// 每次调用可以注入不同的上下文
const result = await agent.generate({
  prompt: '用户的问题',
  options: {
    context: '从向量数据库检索到的相关文档...',
    model: 'opus',
  }
})
```

## 中断与恢复：stop() 的底层实现

`stop()` 调用时发生了什么？

```typescript
// useChat 内部简化逻辑
const abortController = ref<AbortController | null>(null)

async function handleSubmit(e: Event) {
  abortController.value = new AbortController()

  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
    signal: abortController.value.signal, // 关键：传入 AbortSignal
  })

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    appendChunk(chunk)
  }
}

function stop() {
  abortController.value?.abort() // 中断 fetch 请求
}
```

**关键点：** `stop()` 不是"暂停"，而是**彻底中断**。已生成的内容保留，但无法从断点继续。如果需要"续写"，需要把已生成内容作为上下文重新发起请求。

## 错误处理：真实场景中的坑

### 网络超时

```typescript
const { messages, error } = useChat({
  api: '/api/chat',
  onError: (err) => {
    if (err.message.includes('timeout')) {
      // 提示用户网络问题，建议重试
    }
  },
})
```

### Token 超限

```typescript
// server/api/chat.post.ts
const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  messages,
  maxTokens: 4096,
})
```

### 限流（Rate Limiting）

```typescript
// server/api/chat.post.ts
const rateLimit = useStorage('redis')

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event)
  const key = `rate:${ip}`
  const count = (await rateLimit.getItem<number>(key)) || 0

  if (count > 10) {
    throw createError({ statusCode: 429, message: '请求过于频繁' })
  }

  await rateLimit.setItem(key, count + 1, { ttl: 60 })
  // ... 继续处理
})
```

## Reranking：RAG 管道的关键一环

AI SDK 6 新增了 Reranking 支持 — 对检索到的文档按相关性重新排序：

```typescript
import { rerank } from 'ai'

// 从向量数据库检索到的候选文档
const candidates = await queryVectors(embedding, 20)

// 用 reranker 重新排序，取 top 5
const reranked = await rerank({
  model: anthropic('claude-sonnet-4-20250514'),
  query: userQuestion,
  documents: candidates,
  topK: 5,
})
```

完整的 RAG 管道：`embed → store → retrieve → rerank → augment prompt → generate`

## Provider Adapter：一行代码切换模型

```typescript
// 切换到 OpenAI
const result = streamText({
  model: openai('gpt-4o'),
  messages,
})

// 切换到 Google
const result = streamText({
  model: google('gemini-2.5-pro'),
  messages,
})

// 切换到 Mistral
const result = streamText({
  model: mistral('mistral-large'),
  messages,
})
```

一个环境变量就能切换供应商，不需要改代码。

## 本节要点

1. `useChat` 是完整的聊天状态管理器，不只是"发消息"
2. 消息分片模型（message-parts）是 AI SDK 6 的杀手特性，必须渲染每种 part 类型
3. `ToolLoopAgent` 提供一等公民的 Agent 抽象，定义一次到处复用
4. 流式传输基于 SSE，不是 WebSocket
5. `stop()` 是彻底中断，不是暂停
6. Reranking 是 RAG 管道的质量关键
7. Provider Adapter 让你一行代码切换 AI 供应商

---

**上一篇：** [环境武装：打造你的 AI 开发兵器库](/roadmap/01-dev-environment)
**下一篇：** [Function Calling 前端实战：让 AI 调用你的组件](/roadmap/03-function-calling)
