---
title: Function Calling 前端实战：让 AI 调用你的组件
description: Tool Use 协议解析、前端定义工具 Schema、多轮调用的状态机设计、工具调用过程的 UI 渲染
tags: ['function-calling', 'tool-use', 'ai-sdk', 'vue']
category: 学习路线
---

# Function Calling 前端实战：让 AI 调用你的组件

> Function Calling 是 AI 从"聊天机器人"进化为"智能代理"的关键能力。

## 什么是 Function Calling？

普通 LLM 调用：用户提问 → AI 生成文本回答

Function Calling：用户提问 → AI **决定调用哪个函数** → 执行函数 → AI 基于结果生成回答

```
用户: "帮我查一下 Vue 3 的 Composition API 文档"

AI 思考: 需要调用 search_docs 工具

AI 输出: { "tool": "search_docs", "args": { "query": "Vue 3 Composition API" } }

系统执行: 返回搜索结果

AI 回答: "根据文档，Composition API 的核心是..."
```

## 前端定义工具 Schema

用 Vercel AI SDK 定义工具非常直观：

```typescript
// server/api/chat.post.ts
import { streamText, tool } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { messages } = await readBody(event)

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: '你是一个前端开发助手。可以搜索文档、查看组件源码、运行代码。',
    messages,
    tools: {
      // 工具 1：搜索文档
      search_docs: tool({
        description: '搜索项目文档和知识库',
        parameters: z.object({
          query: z.string().describe('搜索关键词'),
          category: z.enum(['api', 'guide', 'tutorial']).optional(),
        }),
        execute: async ({ query, category }) => {
          // 实际调用搜索逻辑
          const results = await searchKnowledgeBase(query, category)
          return results
        },
      }),

      // 工具 2：查看组件源码
      view_component: tool({
        description: '查看 Vue 组件的源代码',
        parameters: z.object({
          name: z.string().describe('组件名称，如 UserProfile'),
          path: z.string().optional().describe('组件路径'),
        }),
        execute: async ({ name, path }) => {
          const componentPath = path || `components/${name}.vue`
          const source = await readFile(componentPath, 'utf-8')
          return { name, source, path: componentPath }
        },
      }),

      // 工具 3：运行代码
      run_code: tool({
        description: '在沙箱中运行 JavaScript/Vue 代码',
        parameters: z.object({
          code: z.string().describe('要运行的代码'),
          language: z.enum(['javascript', 'typescript', 'vue']),
        }),
        execute: async ({ code, language }) => {
          const result = await runInSandbox(code, language)
          return result
        },
      }),
    },
    maxTokens: 4096,
  })

  return result.toDataStreamResponse()
})
```

## 前端接收工具调用

`useChat` 会自动处理工具调用的结果，消息中会包含 `toolInvocations` 字段：

```vue
<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'

const { messages, input, handleSubmit, isLoading } = useChat({
  api: '/api/chat',
})
</script>

<template>
  <div class="space-y-4">
    <div v-for="msg in messages" :key="msg.id">
      <!-- 普通文本消息 -->
      <div v-if="msg.role === 'user'" class="text-right">
        <span class="bg-emerald-600 text-white px-4 py-2 rounded-lg">
          {{ msg.content }}
        </span>
      </div>

      <!-- AI 回复 -->
      <div v-else class="space-y-2">
        <!-- 工具调用展示 -->
        <div
          v-for="invocation in msg.toolInvocations"
          :key="invocation.toolCallId"
          class="bg-zinc-900 border border-zinc-800 rounded-lg p-3"
        >
          <div class="flex items-center gap-2 text-sm text-zinc-500">
            <component :is="getToolIcon(invocation.toolName)" class="w-4 h-4" />
            <span>调用工具: {{ invocation.toolName }}</span>
          </div>

          <!-- 工具参数 -->
          <pre class="mt-2 text-xs text-zinc-400 overflow-x-auto">{{ JSON.stringify(invocation.args, null, 2) }}</pre>

          <!-- 工具结果 -->
          <div v-if="invocation.state === 'result'" class="mt-2 pt-2 border-t border-zinc-800">
            <div class="text-xs text-emerald-400">结果:</div>
            <pre class="text-xs text-zinc-300 mt-1">{{ JSON.stringify(invocation.result, null, 2) }}</pre>
          </div>

          <!-- 加载状态 -->
          <div v-else class="mt-2 text-xs text-zinc-500 animate-pulse">
            执行中...
          </div>
        </div>

        <!-- AI 最终回答 -->
        <div v-if="msg.content" class="text-zinc-200">
          {{ msg.content }}
        </div>
      </div>
    </div>
  </div>
</template>
```

## 多轮工具调用：状态机设计

AI 可能会在一次对话中连续调用多个工具。Vercel AI SDK 自动处理这个流程：

```
用户提问
  → AI 调用 search_docs → 获取结果
  → AI 调用 view_component → 获取源码
  → AI 综合两个工具的结果，生成最终回答
```

### 前端状态管理

```typescript
// composables/useToolExecution.ts
import { computed } from 'vue'
import type { Message } from 'ai'

export function useToolExecution(messages: Ref<Message[]>) {
  // 当前正在执行的工具
  const activeToolCalls = computed(() => {
    const lastMsg = messages.value[messages.value.length - 1]
    if (!lastMsg?.toolInvocations) return []

    return lastMsg.toolInvocations.filter(
      (inv) => inv.state === 'call'
    )
  })

  // 已完成的工具调用
  const completedToolCalls = computed(() => {
    return messages.value
      .flatMap((msg) => msg.toolInvocations || [])
      .filter((inv) => inv.state === 'result')
  })

  // 工具调用历史（用于展示执行链）
  const toolChain = computed(() => {
    return messages.value
      .flatMap((msg) => msg.toolInvocations || [])
      .map((inv) => ({
        id: inv.toolCallId,
        name: inv.toolName,
        args: inv.args,
        state: inv.state,
        result: inv.state === 'result' ? inv.result : null,
      }))
  })

  return { activeToolCalls, completedToolCalls, toolChain }
}
```

## 工具调用的 UI 渲染模式

### 模式 1：折叠面板

```vue
<template>
  <details class="bg-zinc-900 border border-zinc-800 rounded-lg">
    <summary class="px-4 py-2 cursor-pointer text-sm text-zinc-400">
      <span class="inline-flex items-center gap-2">
        <Wrench class="w-4 h-4" />
        调用了 {{ toolChain.length }} 个工具
      </span>
    </summary>
    <div class="px-4 pb-3 space-y-2">
      <div v-for="tool in toolChain" :key="tool.id" class="text-xs">
        <span class="text-emerald-400">{{ tool.name }}</span>
        <span class="text-zinc-500 ml-2">{{ tool.state }}</span>
      </div>
    </div>
  </details>
</template>
```

### 模式 2：时间线

```vue
<template>
  <div class="relative pl-6 border-l border-zinc-800 space-y-4">
    <div
      v-for="(tool, index) in toolChain"
      :key="tool.id"
      class="relative"
    >
      <!-- 时间线节点 -->
      <div
        class="absolute -left-[25px] w-3 h-3 rounded-full border-2"
        :class="tool.state === 'result'
          ? 'bg-emerald-500 border-emerald-500'
          : 'bg-zinc-800 border-zinc-600 animate-pulse'"
      />

      <!-- 工具信息 -->
      <div class="text-sm">
        <span class="text-zinc-300 font-mono">{{ tool.name }}</span>
        <span class="text-zinc-500 ml-2 text-xs">
          {{ tool.state === 'result' ? '✓ 完成' : '⏳ 执行中' }}
        </span>
      </div>
    </div>
  </div>
</template>
```

## 确认机制：危险操作需要用户确认

某些工具（如删除文件、执行代码）需要用户确认：

```typescript
// server/api/chat.post.ts
tools: {
  delete_file: tool({
    description: '删除指定文件',
    parameters: z.object({
      path: z.string(),
    }),
    // 不自动执行，返回确认请求
    execute: async ({ path }) => {
      return {
        needsConfirmation: true,
        message: `即将删除文件: ${path}`,
        action: 'delete',
        target: path,
      }
    },
  }),
}
```

```vue
<!-- 前端确认对话框 -->
<template>
  <div v-if="needsConfirmation" class="fixed inset-0 bg-black/50 flex items-center justify-center">
    <div class="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-md">
      <h3 class="text-zinc-100 font-medium">确认操作</h3>
      <p class="text-zinc-400 mt-2">{{ confirmationMessage }}</p>
      <div class="flex gap-3 mt-4 justify-end">
        <button @click="reject" class="px-4 py-2 text-zinc-400 hover:text-zinc-200">
          取消
        </button>
        <button @click="confirm" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500">
          确认执行
        </button>
      </div>
    </div>
  </div>
</template>
```

## 本节要点

1. Function Calling 让 AI 从"聊天"进化为"行动"
2. 用 Zod Schema 定义工具参数，类型安全
3. 多轮工具调用由 SDK 自动编排，前端只需渲染状态
4. 危险操作必须加确认机制
5. UI 上用折叠面板或时间线展示工具执行链

---

**上一篇：** [Vercel AI SDK 核心：从 useChat 到流式架构](/roadmap/02-vercel-ai-sdk)
**下一篇：** [RAG 全栈落地：从 Embedding 到向量检索的前端集成](/roadmap/04-rag-frontend)
