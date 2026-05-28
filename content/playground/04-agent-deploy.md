---
title: Agent 能力扩展与上线部署
description: Function Calling 实现工具调用、思维链展示 UI、成本监控面板、部署上线
tags: ['实战', 'agent', 'function-calling', 'deployment']
category: 实战演练
---

# 实战 04：Agent 能力扩展与上线部署

> 从"能聊天"到"能做事"，这是最后一步。

## 第一步：Function Calling 工具定义

```typescript
// server/api/agent-chat.post.ts
import { streamText, tool } from 'ai'
import { getAnthropicProvider } from '../utils/llm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { messages } = await readBody(event)
  const anthropic = getAnthropicProvider()

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `你是知识库助手，可以：
1. 搜索知识库回答问题
2. 列出所有可用文档
3. 查看特定文档的详细内容
4. 收集用户反馈以改进回答质量`,
    messages,
    tools: {
      // 工具 1：搜索知识库
      search_knowledge: tool({
        description: '搜索知识库中的文档',
        parameters: z.object({
          query: z.string().describe('搜索关键词'),
          topK: z.number().optional().default(5).describe('返回结果数量'),
        }),
        execute: async ({ query, topK }) => {
          const embedding = await generateEmbedding(query)
          const results = await queryVectors(embedding, topK)
          return results.map(r => ({
            source: r.payload?.source,
            text: r.payload?.text,
            score: r.score,
          }))
        },
      }),

      // 工具 2：列出文档
      list_documents: tool({
        description: '列出知识库中的所有文档',
        parameters: z.object({}),
        execute: async () => {
          const docs = await getAllDocuments()
          return docs.map(d => ({ name: d.name, chunks: d.chunkCount }))
        },
      }),

      // 工具 3：反馈收集
      submit_feedback: tool({
        description: '收集用户对回答的反馈',
        parameters: z.object({
          messageId: z.string(),
          rating: z.enum(['good', 'bad']),
          comment: z.string().optional(),
        }),
        execute: async ({ messageId, rating, comment }) => {
          await saveFeedback({ messageId, rating, comment })
          return { success: true, message: '感谢你的反馈！' }
        },
      }),
    },
    maxTokens: 4096,
  })

  return result.toDataStreamResponse()
})
```

## 第二步：工具调用 UI 组件

```vue
<!-- components/chat/ToolCallCard.vue -->
<script setup lang="ts">
import { Wrench, Search, FileList, ThumbsUp, Loader2, Check } from 'lucide-vue-next'

const props = defineProps<{
  invocation: {
    toolName: string
    args: Record<string, any>
    state: 'call' | 'result'
    result?: any
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
</script>

<template>
  <div class="bg-zinc-900/80 border border-zinc-800 rounded-lg overflow-hidden">
    <!-- 工具头部 -->
    <div class="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/50">
      <component
        :is="toolIcons[invocation.toolName] || Wrench"
        class="w-4 h-4 text-emerald-400"
      />
      <span class="text-sm text-zinc-300">
        {{ toolLabels[invocation.toolName] || invocation.toolName }}
      </span>
      <span class="ml-auto">
        <Loader2
          v-if="invocation.state === 'call'"
          class="w-4 h-4 text-zinc-500 animate-spin"
        />
        <Check v-else class="w-4 h-4 text-emerald-400" />
      </span>
    </div>

    <!-- 工具参数 -->
    <div class="px-4 py-2">
      <div class="text-xs text-zinc-500 mb-1">参数</div>
      <pre class="text-xs text-zinc-400 font-mono bg-zinc-950 rounded p-2 overflow-x-auto">{{
        JSON.stringify(invocation.args, null, 2)
      }}</pre>
    </div>

    <!-- 工具结果 -->
    <div v-if="invocation.state === 'result' && invocation.result" class="px-4 py-2 border-t border-zinc-800/50">
      <div class="text-xs text-zinc-500 mb-1">结果</div>
      <pre class="text-xs text-zinc-300 font-mono bg-zinc-950 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">{{
        JSON.stringify(invocation.result, null, 2)
      }}</pre>
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

### 部署检查清单

- [ ] 环境变量已配置（ANTHROPIC_API_KEY 等）
- [ ] 向量数据库可访问（Qdrant Cloud / Pinecone）
- [ ] API 限流已配置
- [ ] 错误监控已接入（Sentry）
- [ ] 域名和 SSL 已配置

## 本节成果

- Function Calling 工具调用完整实现
- 工具调用 UI（折叠面板 + 状态指示）
- 成本监控面板
- Vercel 部署配置

## 项目总结

通过这 4 个实战环节，你已经从零构建了一个完整的 AI 应用：

1. **架构设计**：BFF 模式、安全方案、目录结构
2. **对话引擎**：流式输出、Markdown 渲染、交互设计
3. **RAG 集成**：文档处理、向量检索、引用展示
4. **Agent 能力**：工具调用、成本控制、部署上线

这些技术组合在一起，就是 2026 年 AI 前端开发的**完整技术栈**。

**上一步：** [RAG 知识库集成](/playground/03-rag-integration)
