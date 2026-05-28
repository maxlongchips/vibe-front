---
title: 对话引擎核心：流式 Chat UI 开发
description: useChat 接入 Claude API、Markdown 实时渲染、消息操作栏、打字机效果与中断控制
tags: ['实战', 'chat', 'streaming', 'vue3']
category: 实战演练
---

# 实战 02：对话引擎核心：流式 Chat UI 开发

> 对话 UI 是 AI 应用的脸面。用户体验好不好，全看这一步。

## 服务端：Chat API

```typescript
// server/api/chat.post.ts
import { streamText } from 'ai'
import { getAnthropicProvider } from '../utils/llm'

export default defineEventHandler(async (event) => {
  const { messages } = await readBody(event)

  const anthropic = getAnthropicProvider()

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `你是一个专业的前端开发助手。回答要简洁、准确、有代码示例。
如果不确定，诚实说"我不确定"。`,
    messages,
    maxTokens: 4096,
  })

  return result.toDataStreamResponse()
})
```

## 前端：useChat 接入

```vue
<!-- components/chat/ChatWindow.vue -->
<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'
import { Send, Square, RotateCcw } from 'lucide-vue-next'

const { messages, input, handleSubmit, isLoading, stop, reload } = useChat({
  api: '/api/chat',
  initialMessages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是 AI 文档助手，有什么可以帮你的？',
    },
  ],
})

const messagesContainer = ref<HTMLElement | null>(null)

// 自动滚动到底部
watch(messages, () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}, { deep: true })
</script>

<template>
  <div class="flex flex-col h-screen">
    <!-- 消息列表 -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-6 space-y-6">
      <MessageBubble
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
      />
    </div>

    <!-- 输入区域 -->
    <div class="border-t border-zinc-800 p-4">
      <form @submit="handleSubmit" class="flex gap-3">
        <input
          v-model="input"
          placeholder="输入你的问题..."
          class="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl
                 text-zinc-200 placeholder-zinc-500
                 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
          :disabled="isLoading"
        />
        <button
          v-if="!isLoading"
          type="submit"
          :disabled="!input.trim()"
          class="px-4 py-3 bg-emerald-600 text-white rounded-xl
                 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed
                 transition-colors"
        >
          <Send class="w-5 h-5" />
        </button>
        <button
          v-else
          type="button"
          @click="stop"
          class="px-4 py-3 bg-red-600/20 text-red-400 border border-red-500/30 rounded-xl
                 hover:bg-red-600/30 transition-colors"
        >
          <Square class="w-5 h-5" />
        </button>
      </form>
    </div>
  </div>
</template>
```

## 消息气泡组件

```vue
<!-- components/chat/MessageBubble.vue -->
<script setup lang="ts">
import { User, Bot, Copy, Check, RotateCcw } from 'lucide-vue-next'
import { marked } from 'marked'
import hljs from 'highlight.js'

const props = defineProps<{
  message: {
    id: string
    role: 'user' | 'assistant'
    content: string
    toolInvocations?: any[]
  }
}>()

const copied = ref(false)

// Markdown 渲染
const renderedContent = computed(() => {
  if (props.message.role === 'user') return props.message.content

  marked.setOptions({
    highlight: (code, lang) => {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value
      }
      return hljs.highlightAuto(code).value
    },
  })

  return marked(props.message.content)
})

// 复制功能
async function copyContent() {
  await navigator.clipboard.writeText(props.message.content)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <div class="flex gap-3" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
    <!-- AI 头像 -->
    <div v-if="message.role === 'assistant'" class="flex-shrink-0">
      <div class="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center">
        <Bot class="w-4 h-4 text-emerald-400" />
      </div>
    </div>

    <!-- 消息内容 -->
    <div class="max-w-[80%] space-y-2">
      <div
        :class="[
          'rounded-2xl px-4 py-3',
          message.role === 'user'
            ? 'bg-emerald-600 text-white'
            : 'bg-zinc-900 border border-zinc-800'
        ]"
      >
        <!-- 用户消息 -->
        <div v-if="message.role === 'user'" class="whitespace-pre-wrap">
          {{ message.content }}
        </div>

        <!-- AI 消息（Markdown 渲染） -->
        <div
          v-else
          class="prose prose-invert prose-zinc max-w-none text-sm
                 prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800
                 prose-code:text-emerald-400"
          v-html="renderedContent"
        />
      </div>

      <!-- 操作栏（仅 AI 消息） -->
      <div v-if="message.role === 'assistant'" class="flex items-center gap-2 px-1">
        <button
          @click="copyContent"
          class="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <component :is="copied ? Check : Copy" class="w-3 h-3" />
          {{ copied ? '已复制' : '复制' }}
        </button>
        <button
          @click="$emit('regenerate', message.id)"
          class="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <RotateCcw class="w-3 h-3" />
          重新生成
        </button>
      </div>
    </div>

    <!-- 用户头像 -->
    <div v-if="message.role === 'user'" class="flex-shrink-0">
      <div class="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center">
        <User class="w-4 h-4 text-zinc-400" />
      </div>
    </div>
  </div>
</template>
```

## 打字机效果

流式输出本身就是打字机效果，但我们可以加一个光标闪烁：

```css
/* 全局样式 */
.typing-cursor::after {
  content: '▊';
  animation: blink 1s step-end infinite;
  color: #10b981;
  font-size: 0.8em;
}

@keyframes blink {
  50% { opacity: 0; }
}
```

## 本节成果

- 流式对话 UI 完整实现
- Markdown 实时渲染（代码高亮）
- 消息操作栏（复制、重新生成）
- 打字机效果 + 中断控制

**上一步：** [架构设计与项目初始化](/playground/01-architecture)
**下一步：** [RAG 知识库集成](/playground/03-rag-integration)
