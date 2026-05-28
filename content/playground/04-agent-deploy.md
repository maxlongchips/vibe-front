---
title: Agent 能力扩展与上线部署
description: AI SDK 6 ToolLoopAgent、工具调用 UI、消息分片渲染、成本监控、安全部署
tags: ['实战', 'agent', 'function-calling', 'deployment', 'ai-sdk-6']
category: 实战演练
---

# 实战 04：Agent 能力扩展与上线部署

> 从"能聊天"到"能做事"，这是最后一步。

## 第一步：用 AI SDK 6 的 Agent 抽象

AI SDK 6 提供了一等公民的 `ToolLoopAgent` — 自动处理工具调用循环：

```
调用 LLM → 执行工具 → 把结果加回消息 → 重复（最多 20 步）
```

```typescript
// server/utils/agent.ts
import { ToolLoopAgent } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

// 定义工具
const searchKnowledgeTool = {
  description: '搜索知识库中的文档',
  parameters: z.object({
    query: z.string().describe('搜索关键词'),
    topK: z.number().optional().default(5).describe('返回结果数量'),
  }),
  execute: async ({ query, topK }: { query: string; topK: number }) => {
    const embedding = await generateEmbedding(query)
    const results = await queryVectors(embedding, topK)
    return results.map(r => ({
      source: r.payload?.source,
      text: r.payload?.text,
      score: r.score,
    }))
  },
}

const listDocumentsTool = {
  description: '列出知识库中的所有文档',
  parameters: z.object({}),
  execute: async () => {
    const docs = await getAllDocuments()
    return docs.map(d => ({ name: d.name, chunks: d.chunkCount }))
  },
}

const submitFeedbackTool = {
  description: '收集用户对回答的反馈',
  parameters: z.object({
    messageId: z.string(),
    rating: z.enum(['good', 'bad']),
    comment: z.string().optional(),
  }),
  execute: async ({ messageId, rating, comment }: any) => {
    await saveFeedback({ messageId, rating, comment })
    return { success: true, message: '感谢你的反馈！' }
  },
}

// 创建 Agent — 定义一次，到处复用
export const knowledgeAgent = new ToolLoopAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  instructions: `你是知识库助手，可以：
1. 搜索知识库回答问题
2. 列出所有可用文档
3. 收集用户反馈以改进回答质量

回答要简洁、准确，基于检索到的文档。如果文档中没有相关信息，诚实说明。`,
  tools: {
    search_knowledge: searchKnowledgeTool,
    list_documents: listDocumentsTool,
    submit_feedback: submitFeedbackTool,
  },
  maxSteps: 10, // 最多 10 步工具调用
})
```

```typescript
// server/api/agent-chat.post.ts
import { knowledgeAgent } from '../utils/agent'

export default defineEventHandler(async (event) => {
  const { messages } = await readBody(event)

  // Agent 自动处理工具调用循环
  const result = await knowledgeAgent.generate({
    prompt: messages[messages.length - 1].content,
    options: {
      // 可以注入 RAG 上下文
      context: '从向量数据库检索到的相关文档...',
    }
  })

  return result.toDataStreamResponse()
})
```

## 第二步：消息分片渲染（Message Parts）

AI SDK 6 的杀手特性 — 消息不再是纯文本，而是交错的 parts。**你必须渲染每种 part 类型**，否则工具调用 UI 会丢失。

```vue
<!-- components/chat/MessageParts.vue -->
<script setup lang="ts">
import { User, Bot, Wrench, Search, FileList, ThumbsUp, Loader2, Check, ChevronDown } from 'lucide-vue-next'
import { marked } from 'marked'

const props = defineProps<{
  message: {
    id: string
    role: 'user' | 'assistant'
    content: string
    parts?: Array<{
      type: 'text' | 'tool-call' | 'tool-result' | 'reasoning'
      text?: string
      toolName?: string
      args?: Record<string, any>
      result?: any
    }>
  }
}>()

const toolIcons: Record<string, any> = {
  search_knowledge: Search,
  list_documents: FileList,
  submit_feedback: ThumbsUp,
}

const toolLabels: Record<string, string> = {
  search_knowledge: '搜索知识库',
  list_documents: '列出文档',
  submit_feedback: '提交反馈',
}

const expandedTools = ref<Set<string>>(new Set())

function toggleTool(toolId: string) {
  if (expandedTools.value.has(toolId)) {
    expandedTools.value.delete(toolId)
  } else {
    expandedTools.value.add(toolId)
  }
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
      <!-- 遍历消息的每个 part -->
      <template v-for="(part, index) in message.parts" :key="index">

        <!-- 文本部分 -->
        <div
          v-if="part.type === 'text'"
          :class="[
            'rounded-2xl px-4 py-3',
            message.role === 'user'
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-900 border border-zinc-800'
          ]"
        >
          <div
            v-if="message.role === 'assistant'"
            class="prose prose-invert prose-zinc max-w-none text-sm
                   prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800
                   prose-code:text-emerald-400"
            v-html="marked(part.text || '')"
          />
          <div v-else class="whitespace-pre-wrap">{{ part.text }}</div>
        </div>

        <!-- 工具调用部分 -->
        <div
          v-else-if="part.type === 'tool-call'"
          class="bg-zinc-900/80 border border-zinc-800 rounded-lg overflow-hidden"
        >
          <div
            class="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-zinc-800/50"
            @click="toggleTool(`call-${index}`)"
          >
            <component
              :is="toolIcons[part.toolName || ''] || Wrench"
              class="w-4 h-4 text-emerald-400"
            />
            <span class="text-sm text-zinc-300">
              {{ toolLabels[part.toolName || ''] || part.toolName }}
            </span>
            <Loader2 class="w-4 h-4 text-zinc-500 animate-spin ml-auto" />
          </div>
        </div>

        <!-- 工具结果部分 -->
        <div
          v-else-if="part.type === 'tool-result'"
          class="bg-zinc-900/80 border border-zinc-800 rounded-lg overflow-hidden"
        >
          <div
            class="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-zinc-800/50"
            @click="toggleTool(`result-${index}`)"
          >
            <Check class="w-4 h-4 text-emerald-400" />
            <span class="text-sm text-zinc-300">工具执行完成</span>
            <ChevronDown class="w-4 h-4 text-zinc-500 ml-auto" />
          </div>
          <div
            v-if="expandedTools.has(`result-${index}`)"
            class="px-4 py-2 border-t border-zinc-800/50"
          >
            <pre class="text-xs text-zinc-400 font-mono bg-zinc-950 rounded p-2 overflow-x-auto max-h-48">{{
              JSON.stringify(part.result, null, 2)
            }}</pre>
          </div>
        </div>

        <!-- 推理部分（思维链） -->
        <div
          v-else-if="part.type === 'reasoning'"
          class="bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-4 py-3"
        >
          <div class="text-xs text-zinc-500 mb-1">思考过程</div>
          <div class="text-sm text-zinc-400 italic">{{ part.text }}</div>
        </div>

      </template>
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

## 第三步：成本监控面板

```typescript
// server/utils/cost-tracker.ts
import { useStorage } from '#imports'

interface UsageRecord {
  timestamp: number
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
}

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3, output: 15 },   // $/M tokens
  'text-embedding-3-small': { input: 0.02, output: 0 },
}

export async function trackUsage(record: UsageRecord) {
  const storage = useStorage('redis')
  const key = `usage:${new Date().toISOString().slice(0, 10)}`

  const daily = await storage.getItem<UsageRecord[]>(key) || []
  daily.push(record)
  await storage.setItem(key, daily)
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number) {
  const pricing = PRICING[model]
  if (!pricing) return 0
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}
```

```vue
<!-- components/dashboard/CostPanel.vue -->
<script setup lang="ts">
const { data: usage } = await useFetch('/api/usage')

const totalCost = computed(() =>
  usage.value?.reduce((sum, u) => sum + u.cost, 0) ?? 0
)
</script>

<template>
  <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
    <h3 class="text-zinc-100 font-semibold mb-4">今日用量</h3>
    <div class="grid grid-cols-3 gap-4">
      <div>
        <div class="text-2xl font-bold text-emerald-400">
          ${{ totalCost.toFixed(4) }}
        </div>
        <div class="text-xs text-zinc-500">总花费</div>
      </div>
      <div>
        <div class="text-2xl font-bold text-zinc-200">
          {{ usage?.length ?? 0 }}
        </div>
        <div class="text-xs text-zinc-500">API 调用次数</div>
      </div>
      <div>
        <div class="text-2xl font-bold text-zinc-200">
          {{ usage?.reduce((s, u) => s + u.inputTokens + u.outputTokens, 0) ?? 0 }}
        </div>
        <div class="text-xs text-zinc-500">总 Token 数</div>
      </div>
    </div>
  </div>
</template>
```

## 第四步：部署上线

### Vercel 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel

# 设置环境变量
vercel env add ANTHROPIC_API_KEY
vercel env add OPENAI_API_KEY
```

### nuxt.config.ts 生产配置

```typescript
export default defineNuxtConfig({
  // 生产环境优化
  nitro: {
    compressPublicAssets: true,
    minify: true,
  },

  // 实验性优化
  experimental: {
    payloadExtraction: true,
    renderJsonPayloads: true,
  },

  // 运行时配置（从环境变量读取）
  runtimeConfig: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    vectorDbUrl: process.env.VECTOR_DB_URL,
  },
})
```

### 安全检查清单

- [ ] 环境变量已配置（ANTHROPIC_API_KEY 等），不要硬编码
- [ ] 向量数据库可访问（Qdrant Cloud / Pinecone）
- [ ] API 限流已配置（防止滥用和天价账单）
- [ ] 错误监控已接入（Sentry）
- [ ] 域名和 SSL 已配置
- [ ] 敏感文件（.env、secrets）没有暴露给 AI 工具
- [ ] MCP Server 的工具都有输入验证

## 本节成果

- AI SDK 6 ToolLoopAgent 完整实现
- 消息分片渲染（text / tool-call / tool-result / reasoning）
- 成本监控面板
- Vercel 部署配置

## 项目总结

通过这 4 个实战环节，你已经从零构建了一个完整的 AI 应用：

1. **架构设计**：BFF 模式、安全方案、目录结构
2. **对话引擎**：流式输出、Markdown 渲染、交互设计
3. **RAG 集成**：文档处理、向量检索、引用展示
4. **Agent 能力**：ToolLoopAgent、消息分片、成本控制、部署上线

这些技术组合在一起，就是 2026 年 AI 前端开发的**完整技术栈**。

**上一步：** [RAG 知识库集成](/playground/03-rag-integration)
