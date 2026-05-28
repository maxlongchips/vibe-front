---
title: Agent 能力扩展与上线部署
description: AI SDK 6 ToolLoopAgent、工具调用 UI、消息分片渲染、成本监控、安全部署
tags: ['实战', 'agent', 'function-calling', 'deployment', 'ai-sdk-6']
category: 实战演练
---

# 实战 04：Agent 能力扩展与上线部署

> 从"能聊天"到"能做事"，这是最后一步。

---

## 零基础起步

开始本节之前，确认以下准备工作已完成：

```bash
# 1. 确认你在正确的项目目录下
pwd
# 期望输出包含：ai-doc-assistant

# 2. 确认前三节的代码能正常运行
npm run dev
# 打开 http://localhost:3000 能正常对话和使用 RAG 功能

# 3. 确认所有依赖都已安装
npm ls ai @ai-sdk/anthropic @qdrant/js-client-rest
# 不应该报错
```

**如果前三节还没完成**：请先完成 [实战 03：RAG 知识库集成](/playground/03-rag-integration)。

全部就绪后，我们开始给 AI 加上"做事"的能力。

---

## 第一步：理解什么是 Agent

到目前为止，我们的 AI 只能"聊天"——用户问，AI 答。

Agent 不同，它能**主动调用工具**来完成任务：

```
普通对话：用户问 "知识库里有什么文档？" → AI 说 "我不知道"
Agent：  用户问 "知识库里有什么文档？" → AI 调用 list_documents 工具 → 拿到结果 → 告诉用户
```

AI SDK 提供了 `ToolLoopAgent`，它会自动处理这个循环：

```
调用 LLM → AI 决定用什么工具 → 执行工具 → 把结果告诉 AI → AI 继续回答
```

最多循环 10 步，防止 AI 陷入死循环。

---

## 第二步：创建工具函数

在创建 Agent 之前，先准备好 Agent 能使用的工具。

确保以下工具函数已存在（在前面的章节中创建的）：

```bash
# 检查这些文件是否存在
ls server/utils/vector.ts server/utils/embedding.ts
```

如果存在，跳到下一步。如果不存在，回去完成前面的章节。

---

## 第三步：创建 Agent

这是本节的核心——创建一个有工具调用能力的 Agent。

创建文件 `server/utils/agent.ts`：

```typescript
// server/utils/agent.ts
import { generateText } from 'ai'
import { getAnthropicProvider } from './llm'
import { z } from 'zod'
import { queryVectors, getAllDocuments } from './vector'
import { generateEmbedding } from './embedding'

// 工具 1：搜索知识库
const searchKnowledgeTool = {
  description: '搜索知识库中的文档，返回最相关的内容',
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

// 工具 2：列出所有文档
const listDocumentsTool = {
  description: '列出知识库中的所有文档',
  parameters: z.object({}),
  execute: async () => {
    const docs = await getAllDocuments()
    return docs.map(d => ({ name: d.name, chunks: d.chunkCount }))
  },
}

// 把所有工具打包成一个对象
export const agentTools = {
  search_knowledge: searchKnowledgeTool,
  list_documents: listDocumentsTool,
}

// 创建一个带工具的对话函数
export async function agentChat(messages: Array<{ role: string; content: string }>) {
  const anthropic = getAnthropicProvider()

  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `你是知识库助手，可以：
1. 使用 search_knowledge 工具搜索知识库回答问题
2. 使用 list_documents 工具列出所有可用文档

回答要简洁、准确，基于检索到的文档。如果文档中没有相关信息，诚实说明。`,
    messages,
    tools: agentTools,
    maxSteps: 10, // 最多执行 10 步工具调用
  })

  return result
}
```

**代码解释：**
- 每个工具都有 `description`（告诉 AI 这个工具做什么）、`parameters`（用 zod 定义参数格式）、`execute`（实际执行逻辑）
- `generateText` 配合 `tools` 使用时，AI 会自动决定要不要调用工具、调用哪个
- `maxSteps: 10` 防止 AI 无限循环调用工具

**完成这一步后你应该看到：**
- `server/utils/agent.ts` 文件已创建
- `zod` 应该已经随 `ai` 包一起安装了（如果没有：`npm install zod`）

---

## 第四步：创建 Agent Chat API

创建文件 `server/api/agent-chat.post.ts`：

```typescript
// server/api/agent-chat.post.ts
import { streamText } from 'ai'
import { getAnthropicProvider } from '../utils/llm'
import { agentTools } from '../utils/agent'

export default defineEventHandler(async (event) => {
  const { messages } = await readBody(event)
  const anthropic = getAnthropicProvider()

  // 使用 streamText + tools 实现流式 Agent 对话
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `你是知识库助手，可以：
1. 使用 search_knowledge 工具搜索知识库回答问题
2. 使用 list_documents 工具列出所有可用文档

回答要简洁、准确，基于检索到的文档。如果文档中没有相关信息，诚实说明。`,
    messages,
    tools: agentTools,
    maxSteps: 10,
  })

  return result.toDataStreamResponse()
})
```

**完成这一步后你应该看到：**
- `server/api/agent-chat.post.ts` 文件已创建

### 验证 Agent API

```bash
# 重启开发服务器（Ctrl+C 后重新运行）
npm run dev
```

测试 Agent 是否能调用工具：

```bash
curl -X POST http://localhost:3000/api/agent-chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"列出知识库中的所有文档"}]}'
```

**你应该看到：** 流式返回中包含工具调用的信息（类似 `tool-call` 和 `tool-result`），说明 Agent 正在调用工具。

### 卡住了？

| 问题 | 解决办法 |
|------|----------|
| 报 `zod` 找不到 | 运行 `npm install zod` |
| 工具没有被调用 | 检查 `tools` 对象的 key 是否和 `system` 提示词中提到的一致 |
| AI 一直调用工具不停 | 检查 `maxSteps` 是否设置正确 |
| 报 `generateText` 或 `streamText` 参数错误 | 检查 AI SDK 版本，不同版本 API 可能不同 |

---

## 第五步：创建消息分片渲染组件

Agent 对话和普通对话不一样——消息中会有"工具调用"和"工具结果"。你必须渲染这些部分，否则用户看不到 AI 在做什么。

创建文件 `components/chat/MessageParts.vue`：

```vue
<!-- components/chat/MessageParts.vue -->
<script setup lang="ts">
import { User, Bot, Wrench, Search, FileList, Loader2, Check, ChevronDown } from 'lucide-vue-next'
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

// 工具名称对应的图标
const toolIcons: Record<string, any> = {
  search_knowledge: Search,
  list_documents: FileList,
}

// 工具名称对应的中文标签
const toolLabels: Record<string, string> = {
  search_knowledge: '搜索知识库',
  list_documents: '列出文档',
}

// 记录哪些工具卡片是展开状态
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

    <!-- 消息内容：遍历每个 part -->
    <div class="max-w-[80%] space-y-2">
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

        <!-- 工具调用部分（AI 决定调用工具时显示） -->
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

        <!-- 工具结果部分（工具执行完成后显示） -->
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
          <!-- 点击展开查看工具返回的详细数据 -->
          <div
            v-if="expandedTools.has(`result-${index}`)"
            class="px-4 py-2 border-t border-zinc-800/50"
          >
            <pre class="text-xs text-zinc-400 font-mono bg-zinc-950 rounded p-2 overflow-x-auto max-h-48">{{
              JSON.stringify(part.result, null, 2)
            }}</pre>
          </div>
        </div>

        <!-- 推理部分（AI 的思考过程） -->
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

**代码解释：**
- `message.parts` 是一个数组，每个元素代表消息的一部分（文本、工具调用、工具结果、推理过程）
- 工具调用时显示一个带图标的卡片，带旋转加载动画
- 工具结果可以点击展开查看 JSON 数据
- 如果不渲染 `tool-call` 和 `tool-result`，用户就看不到 AI 在调用工具

**完成这一步后你应该看到：**
- `components/chat/MessageParts.vue` 文件已创建

---

## 第六步：创建 Agent 对话页面

创建一个新的页面，专门用于 Agent 对话。

创建文件 `pages/agent.vue`：

```vue
<!-- pages/agent.vue -->
<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'
import { Send, Square } from 'lucide-vue-next'
import MessageParts from '~/components/chat/MessageParts.vue'

const { messages, input, handleSubmit, isLoading, stop } = useChat({
  api: '/api/agent-chat',
  initialMessages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是知识库 Agent 助手。我可以帮你搜索知识库、列出文档。试试问我"知识库里有什么文档？"',
    },
  ],
})

const messagesContainer = ref<HTMLElement | null>(null)

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
      <MessageParts
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
          placeholder="试试问：知识库里有什么文档？"
          class="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl
                 text-zinc-200 placeholder-zinc-500
                 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20
                 transition-colors"
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

在侧边栏中添加 Agent 页面的导航链接。打开 `layouts/default.vue`，在 `<nav>` 中添加：

```vue
<!-- 在 knowledge 链接后面添加 -->
<a
  href="/agent"
  class="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
>
  <Wrench class="w-4 h-4" />
  <span>Agent</span>
</a>
```

记得在 `<script setup>` 中导入 `Wrench` 图标：

```typescript
import { Zap, MessageSquare, Database, Settings, Wrench } from 'lucide-vue-next'
```

**完成这一步后你应该看到：**
- `pages/agent.vue` 文件已创建
- 侧边栏多了一个 "Agent" 导航链接

---

## 第七步：运行并测试 Agent

重启开发服务器：

```bash
npm run dev
```

打开浏览器访问 `http://localhost:3000/agent`，你应该看到：
1. 一个新的对话界面
2. 欢迎语提到可以搜索知识库

**测试 Agent 的工具调用：**

1. 先确保你在知识库里上传过文档（上一节的步骤）
2. 输入："列出知识库中的所有文档"
3. 你应该看到：
   - AI 先显示一个"列出文档"的工具调用卡片（带旋转动画）
   - 然后显示"工具执行完成"
   - 最后 AI 用文字总结了知识库中的文档

4. 再输入："Vue 3 的 ref 怎么用？"
5. 你应该看到：
   - AI 调用"搜索知识库"工具
   - 搜索完成后，AI 基于搜索结果回答

**点击展开工具结果：**
- 点击"工具执行完成"旁边的箭头
- 应该看到一个 JSON 数据块，显示工具返回的原始数据

### 卡住了？

| 问题 | 解决办法 |
|------|----------|
| AI 不调用工具，直接回答"我不知道" | 检查 `system` 提示词中是否明确提到了工具名称 |
| 工具卡片不显示 | 确认使用了 `MessageParts` 组件而不是 `MessageBubble` |
| 工具调用报错 | 检查 Qdrant 是否在运行，知识库是否有数据 |
| 页面报错 `Cannot find module` | 检查所有 import 路径是否正确 |
| AI 一直在调工具不停 | `maxSteps` 可能太大，改成 5 试试 |

---

## 第八步：创建成本监控面板

AI API 是按 Token 计费的，你需要一个面板来监控每天花了多少钱。

创建文件 `server/utils/cost-tracker.ts`：

```typescript
// server/utils/cost-tracker.ts

interface UsageRecord {
  timestamp: number
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
}

// 各模型的价格（美元 / 百万 Token）
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'text-embedding-3-small': { input: 0.02, output: 0 },
}

// 计算一次调用的费用
export function calculateCost(model: string, inputTokens: number, outputTokens: number) {
  const pricing = PRICING[model]
  if (!pricing) return 0
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}

// 内存存储（生产环境建议用 Redis 或数据库）
const usageLog: UsageRecord[] = []

// 记录一次使用
export function trackUsage(record: UsageRecord) {
  usageLog.push(record)
}

// 获取今日使用记录
export function getTodayUsage(): UsageRecord[] {
  const today = new Date().toISOString().slice(0, 10)
  return usageLog.filter(r => new Date(r.timestamp).toISOString().slice(0, 10) === today)
}
```

创建 API 接口 `server/api/usage.get.ts`：

```typescript
// server/api/usage.get.ts
import { getTodayUsage } from '../utils/cost-tracker'

export default defineEventHandler(() => {
  return getTodayUsage()
})
```

创建成本面板组件 `components/dashboard/CostPanel.vue`：

```vue
<!-- components/dashboard/CostPanel.vue -->
<script setup lang="ts">
const { data: usage } = await useFetch('/api/usage')

const totalCost = computed(() =>
  usage.value?.reduce((sum, u) => sum + u.cost, 0) ?? 0
)

const totalTokens = computed(() =>
  usage.value?.reduce((s, u) => s + u.inputTokens + u.outputTokens, 0) ?? 0
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
          {{ totalTokens }}
        </div>
        <div class="text-xs text-zinc-500">总 Token 数</div>
      </div>
    </div>
  </div>
</template>
```

**完成这一步后你应该看到：**
- `server/utils/cost-tracker.ts` 文件已创建
- `server/api/usage.get.ts` 文件已创建
- `components/dashboard/CostPanel.vue` 文件已创建

---

## 第九步：部署到 Vercel

所有功能开发完成后，让我们把项目部署到线上。

**准备 1：安装 Vercel CLI**

```bash
npm i -g vercel
```

**准备 2：确认 `nuxt.config.ts` 的生产配置**

打开 `nuxt.config.ts`，确保有以下配置：

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  css: ['~/assets/css/main.css'],

  // 生产环境优化
  nitro: {
    compressPublicAssets: true,
    minify: true,
  },

  // 运行时配置（从环境变量读取）
  runtimeConfig: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    vectorDbUrl: process.env.VECTOR_DB_URL,
    public: {
      appName: 'AI Doc Assistant',
    },
  },
})
```

**准备 3：部署**

```bash
# 第一次部署（会引导你登录和配置项目）
vercel

# 设置环境变量
vercel env add ANTHROPIC_API_KEY
vercel env add OPENAI_API_KEY
vercel env add VECTOR_DB_URL
```

**完成这一步后你应该看到：**
- Vercel 给你一个线上地址（类似 `https://ai-doc-assistant.vercel.app`）
- 打开这个地址，功能和本地一样

### 卡住了？

| 问题 | 解决办法 |
|------|----------|
| `vercel` 命令不存在 | 运行 `npm i -g vercel` 安装 |
| 部署后 API 报错 | 检查 Vercel 环境变量是否正确设置：`vercel env ls` |
| Qdrant 连接失败 | 本地的 Qdrant（localhost:6333）线上访问不到，需要用 Qdrant Cloud 或改用 Pinecone |
| 部署超时 | 检查 `node_modules` 是否在 `.gitignore` 中，Vercel 会自动安装依赖 |

---

## 安全检查清单

在正式上线前，逐项检查：

- [ ] `.env` 文件没有提交到 Git（检查 `.gitignore`）
- [ ] API Key 没有硬编码在代码中
- [ ] 向量数据库不是 localhost（生产环境用 Qdrant Cloud 或 Pinecone）
- [ ] 已设置 API 限流（防止被人滥用导致天价账单）
- [ ] 错误处理完善（不会把内部错误信息暴露给用户）

---

## 动手练习

完成了上面的步骤后，试试下面的练习来巩固知识：

**练习 1：添加一个新工具**

给 Agent 添加一个 `get_weather` 工具，让它能查询天气。提示：
1. 在 `server/utils/agent.ts` 中定义新工具
2. 使用免费天气 API（如 `wttr.in`）
3. 把新工具加到 `agentTools` 中
4. 测试问 "北京今天天气怎么样？"

**练习 2：添加反馈工具**

创建一个 `submit_feedback` 工具，让用户可以对 AI 的回答打分。提示：
1. 参数包括 `messageId`、`rating`（good/bad）、`comment`
2. 用一个内存数组存储反馈数据
3. 在 `MessageParts.vue` 的操作栏中添加"好评"和"差评"按钮

**练习 3：部署到 Cloudflare**

如果你不想用 Vercel，试试部署到 Cloudflare Pages：
1. 运行 `npx nuxi build --preset cloudflare_pages`
2. 用 `wrangler` CLI 部署
3. 对比两种部署方式的优缺点

**练习 4：添加错误边界**

在 `pages/agent.vue` 中添加错误处理：
1. 如果 API 返回错误，显示一个友好的错误提示
2. 添加一个"重试"按钮
3. 记录错误到控制台方便调试

---

## 项目总结

通过这 4 个实战环节，你已经从零构建了一个完整的 AI 应用：

1. **架构设计**：BFF 模式、安全方案、目录结构
2. **对话引擎**：流式输出、Markdown 渲染、交互设计
3. **RAG 集成**：文档处理、向量检索、引用展示
4. **Agent 能力**：工具调用、消息分片、成本控制、部署上线

这些技术组合在一起，就是 2026 年 AI 前端开发的**完整技术栈**。

**上一步：** [RAG 知识库集成](/playground/03-rag-integration)
