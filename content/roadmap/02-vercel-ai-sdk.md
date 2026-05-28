---
title: Vercel AI SDK 核心：从 useChat 到流式架构
description: @ai-sdk/vue 的 useChat / useCompletion 源码级拆解，SSE 原理、ReadableStream 处理、中断与恢复策略
tags: ['vercel-ai-sdk', 'streaming', 'sse', 'vue']
category: 学习路线
---

# Vercel AI SDK 核心：从 useChat 到流式架构

> 流式输出不是"打字机效果"那么简单。理解底层机制，你才能处理真实场景中的各种边界情况。

## 为什么选 Vercel AI SDK？

2026 年的 AI 前端开发，SDK 选择已经收敛。Vercel AI SDK 的优势：

- **框架无关**：支持 Vue、React、Svelte
- **流式一等公民**：不是事后加的 streaming，而是从底层就为流式设计
- **TypeScript 原生**：类型推导精确到每一个 token
- **多模型支持**：Claude、GPT、Gemini 一个接口搞定

## 安装

```bash
npm install ai @ai-sdk/vue @ai-sdk/anthropic
```

## 核心概念：useChat

`useChat` 是整个 SDK 的核心。它不是一个简单的"发送消息"函数，而是一个**完整的聊天状态管理器**。

### 基础用法

```vue
<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'

const { messages, input, handleSubmit, isLoading, error, stop } = useChat({
  api: '/api/chat',
  // 可选：自定义请求头
  headers: {
    'Authorization': `Bearer ${useRuntimeConfig().public.apiToken}`
  },
  // 可选：请求体附加数据
  body: {
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7
  },
  // 可选：错误处理
  onError: (error) => {
    console.error('Chat error:', error)
  },
  // 可选：消息发送完成回调
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

    // 返回流式响应
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

## useCompletion：非聊天场景的流式输出

如果你不需要聊天历史，只需要"输入 → 生成"的模式：

```vue
<script setup lang="ts">
import { useCompletion } from '@ai-sdk/vue'

const { completion, input, handleSubmit, isLoading } = useCompletion({
  api: '/api/generate',
})
</script>

<template>
  <div>
    <textarea v-model="input" placeholder="描述你需要的组件..." />
    <button @click="handleSubmit" :disabled="isLoading">
      生成代码
    </button>
    <pre v-if="completion"><code>{{ completion }}</code></pre>
  </div>
</template>
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
    // 逐 chunk 更新 messages
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
  // 关键：设置 abortSignal 超时
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

## 高级：自定义 Stream 处理

如果你需要在前端对流式数据做特殊处理：

```typescript
// server/api/chat.post.ts
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'

export default defineEventHandler(async (event) => {
  const { messages } = await readBody(event)

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    messages,
  })

  // 自定义：在流式输出中注入元数据
  const stream = result.toDataStreamResponse({
    getErrorMessage: (error) => {
      if (error instanceof Error) return error.message
      return '未知错误'
    },
  })

  return stream
})
```

## 性能优化：减少首 Token 延迟

```typescript
// 使用 generateId 减少客户端计算
import { generateId } from 'ai'

const { messages } = useChat({
  id: 'chat-1', // 固定 ID，支持会话持久化
  generateId, // 使用 SDK 内置 ID 生成器
})
```

## 本节要点

1. `useChat` 是完整的聊天状态管理器，不只是"发消息"
2. 流式传输基于 SSE，不是 WebSocket
3. `stop()` 是彻底中断，不是暂停
4. 错误处理必须覆盖：网络超时、Token 超限、限流
5. 服务端用 `streamText` + `toDataStreamResponse` 返回流式响应

---

**上一篇：** [环境武装：打造你的 AI 开发兵器库](/roadmap/01-dev-environment)
**下一篇：** [Function Calling 前端实战：让 AI 调用你的组件](/roadmap/03-function-calling)
