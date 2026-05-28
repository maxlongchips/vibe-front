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

## 架构决策：Agent vs 直接 Function Calling

创建 Agent 之前，先想清楚一个问题：**你真的需要 Agent 吗？**

AI SDK 提供了三种使用工具的方式，复杂度和成本递增：

| 方式 | 原理 | 适用场景 | Token 消耗 |
|------|------|----------|------------|
| **直接 tool calls** | 一次 LLM 调用，AI 输出工具调用，你手动执行并返回结果 | 简单的单步操作，如"查天气"、"算汇率" | 低（1 次 LLM 调用） |
| **ToolLoopAgent（本节用的）** | 自动循环：LLM → 工具 → LLM → 工具 → ... 直到完成 | 需要多步推理的任务，如"搜索文档然后总结" | 中（2-5 次 LLM 调用） |
| **多 Agent 编排** | 多个 Agent 各司其职，互相协作 | 复杂工作流，如"一个 Agent 搜索，一个 Agent 写报告，一个 Agent 审核" | 高（每个 Agent 独立消耗 Token） |

**决策规则：**

1. **简单任务用直接调用**：用户问"今天天气"，你只需要调一次天气 API，不需要循环。直接用 `generateText` + `tools` 但不设 `maxSteps`（或设为 1）。
2. **复杂循环用 Agent**：用户问"帮我找所有关于 Vue 3 的文档并总结要点"，AI 需要先搜索、再阅读、再总结，这是典型的多步任务。
3. **多角色用多 Agent**：如果你发现一个 Agent 的 system prompt 越写越长、工具越加越多（超过 8 个），考虑拆分成多个专职 Agent。

**成本陷阱：Agent 循环可以快速烧掉 Token**

一个 Agent 循环的 Token 消耗大致如下（以 Claude Sonnet 为例）：

```
第 1 步：system prompt (500 tokens) + 用户消息 (100 tokens) + 工具定义 (300 tokens) → LLM 输出 (200 tokens)
第 2 步：上面所有上下文 + 工具结果 (500 tokens) → LLM 输出 (300 tokens)
第 3 步：上面所有上下文 + 工具结果 (500 tokens) → LLM 输出 (200 tokens)
```

3 步循环下来，实际消耗约 4,000+ input tokens。如果 `maxSteps` 设成 20，最坏情况可能消耗 30,000+ tokens（约 $0.09），这还只是单轮对话。

**maxSteps 策略：为什么限制在 10-20 步**

- `maxSteps: 1-3`：适合简单查询，Agent 只需要调用 1-2 个工具就能完成
- `maxSteps: 5-10`：大多数场景的合理上限（本节用的是 10）
- `maxSteps: 15-20`：复杂的多工具协作任务，但需要配合成本告警
- `maxSteps: >20`：几乎不需要。如果真的需要，说明你的任务设计有问题，应该拆分成多个步骤

**实际建议**：先设 `maxSteps: 5`，观察日志中 Agent 平均执行几步，再决定是否放宽。

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

## 成本监控与优化

面板建好了，但光看数字不够——你需要一套**主动控制成本**的策略。

### 用 /cost 跟踪 Claude Code 开发花费

如果你在开发过程中使用 Claude Code，可以用 `/cost` 命令查看当前会话的 Token 消耗和费用。这能帮你判断哪些操作最烧钱：

```bash
# 在 Claude Code 中输入
/cost
# 会显示当前会话的 input/output tokens 和估算费用
```

### Token 预算：给每个功能设上限

不要让 Agent 无限制地消耗 Token。在代码中加预算检查：

```typescript
// server/utils/token-budget.ts
const TOKEN_BUDGETS: Record<string, number> = {
  'agent-chat': 8000,       // 单次 Agent 对话最多 8000 output tokens
  'rag-query': 2000,        // RAG 查询最多 2000 output tokens
  'document-summary': 4000, // 文档摘要最多 4000 output tokens
}

export function getMaxTokens(feature: string): number {
  return TOKEN_BUDGETS[feature] || 4000 // 默认 4000
}
```

在 API 调用时使用：

```typescript
const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  messages,
  tools: agentTools,
  maxSteps: 10,
  maxTokens: getMaxTokens('agent-chat'), // 加上 Token 上限
})
```

### 缓存策略：哪些回答可以缓存

不是每次请求都需要调 LLM。以下场景可以缓存：

| 场景 | 缓存方式 | 缓存时长 |
|------|----------|----------|
| `list_documents` 工具结果 | 内存缓存 | 5 分钟（文档不会频繁变化） |
| 相同问题的 RAG 搜索结果 | Redis 或内存 | 10 分钟 |
| 系统提示词 + 常见问题 | Anthropic prompt caching | 自动（AI SDK 内置支持） |

```typescript
// 简单的内存缓存示例
const cache = new Map<string, { data: any; expiry: number }>()

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry || Date.now() > entry.expiry) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

function setCache(key: string, data: any, ttlMs: number) {
  cache.set(key, { data, expiry: Date.now() + ttlMs })
}
```

### 模型降级：不同场景用不同模型

Claude 有多个模型，价格差异很大（Haiku 约为 Sonnet 的 1/10）。根据任务复杂度选择模型：

```typescript
// server/utils/model-selector.ts
import { getAnthropicProvider } from './llm'

export function selectModel(taskType: 'simple' | 'complex' | 'agent') {
  const anthropic = getAnthropicProvider()

  switch (taskType) {
    case 'simple':
      // 简单问答、格式化、翻译 → 用 Haiku，便宜快速
      return anthropic('claude-haiku-3-20240307')
    case 'complex':
      // 长文分析、代码生成 → 用 Sonnet，能力均衡
      return anthropic('claude-sonnet-4-20250514')
    case 'agent':
      // 多步推理、工具调用 → 用 Sonnet，需要更强的推理能力
      return anthropic('claude-sonnet-4-20250514')
  }
}
```

**经验法则**：
- 短对话（< 500 tokens 输入）、不需要工具调用 → Haiku
- 长对话、需要工具调用、需要推理 → Sonnet
- 不要用 Opus 做 Agent 循环——太贵，且 Sonnet 已经够用

---

## 架构决策：部署平台选型

部署 AI 应用不只是"把代码传上去"——不同平台对 serverless 函数的限制直接影响 Agent 的可用性。

### 平台对比

| 维度 | Vercel | Cloudflare Workers | Railway | 自建服务器 |
|------|--------|--------------------|---------|------------|
| **冷启动时间** | 250ms-2s（Edge 快，Serverless 慢） | < 5ms（几乎无冷启动） | 无（长驻进程） | 无 |
| **价格** | 免费额度 100GB 带宽/Hobby；Pro $20/月 | 免费 10 万次请求/天；Workers Paid $5/月 | $5/月起（按用量） | 自己控制（VPS $5-20/月） |
| **适合场景** | Nuxt/Next.js 全栈应用 | API 代理、边缘计算 | 长驻服务、数据库 | 高度定制化需求 |
| **函数超时限制** | Hobby 10s，Pro 60s（Edge 30s） | 免费 10ms CPU，Paid 30s | 无限制 | 无限制 |
| **最大请求体** | 4.5MB | 100MB | 无限制 | 无限制 |
| **WebSocket 支持** | 不支持（需第三方） | 支持（Durable Objects） | 支持 | 支持 |

### 为什么选 Vercel

对于本项目（Nuxt + AI SDK），Vercel 是最省事的选择：

1. **Nuxt 原生支持**：Nuxt 3 的 Nitro 引擎内置 Vercel preset，零配置部署
2. **边缘函数**：静态页面走 Edge Network，全球加速
3. **免费额度足够**：Hobby 账号每月 100GB 带宽、无限 Serverless 调用（有 fair use 限制）
4. **AI SDK 集成**：Vercel 是 AI SDK 的开发方，部署兼容性最好

### Serverless 的坑：你需要知道的三件事

**坑 1：函数超时**

Agent 循环可能执行 10 步，每步 2-3 秒，总耗时 20-30 秒。Vercel Hobby 账号的函数超时是 10 秒——Agent 会被强制终止。

```typescript
// 解决方案：用流式响应，边执行边返回
const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  messages,
  tools: agentTools,
  maxSteps: 10,
})
// streamText 会边执行边推送数据，不会因为总耗时超时
return result.toDataStreamResponse()
```

如果必须用 `generateText`（非流式），升级到 Vercel Pro（60 秒超时）或改用 Railway。

**坑 2：冷启动**

Serverless 函数在无请求时会被回收，下次请求需要重新初始化（加载依赖、建立数据库连接）。首次请求可能慢 1-2 秒。

```typescript
// 解决方案：复用连接（Nuxt/Nitro 自动处理，但你需要确保没有在每次请求时重新创建客户端）
// 错误做法：
export default defineEventHandler(async () => {
  const qdrant = new QdrantClient({ url: '...' }) // 每次请求都创建新连接
})

// 正确做法：用全局单例
let qdrant: QdrantClient
function getQdrant() {
  if (!qdrant) qdrant = new QdrantClient({ url: '...' })
  return qdrant
}
```

**坑 3：状态管理**

Serverless 函数是无状态的——内存中的数据（如本节的 `usageLog` 数组）在函数回收后会丢失。

```typescript
// 本教程的成本追踪用内存存储，仅适合开发演示
// 生产环境必须换成持久化存储：
// - 简单方案：Vercel KV（Redis）
// - 正式方案：PostgreSQL / Supabase
// - 临时方案：JSON 文件 + Vercel Blob Storage
```

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

## 生产环境安全检查清单

上面的"安全检查清单"只是基础。上线前，你需要一份更完整的安全审查：

### 1. API Key 轮换策略

API Key 泄露是 AI 应用最常见的安全事故。不要指望"不泄露"——要做好"泄露后能快速轮换"的准备。

```bash
# 在 Vercel 中轮换 Key 的步骤：
# 1. 去 Anthropic 控制台生成新 Key
# 2. 更新 Vercel 环境变量
vercel env rm ANTHROPIC_API_KEY
vercel env add ANTHROPIC_API_KEY  # 输入新 Key
# 3. 重新部署
vercel --prod
# 4. 确认新 Key 生效后，在 Anthropic 控制台删除旧 Key
```

**建议**：每 90 天轮换一次 API Key。用 Anthropic 的 Admin API 可以管理多个 Key，实现无缝切换。

### 2. Rate Limiting 实现

没有人调你的 API？不可能。爬虫、脚本、恶意用户都会来。必须加限流：

```typescript
// server/utils/rate-limit.ts
const requestCounts = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 20,
  windowMs: number = 60_000 // 1 分钟
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const record = requestCounts.get(identifier)

  if (!record || now > record.resetTime) {
    requestCounts.set(identifier, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  record.count++
  return { allowed: true, remaining: maxRequests - record.count }
}
```

在 API 中使用：

```typescript
// server/api/agent-chat.post.ts
import { checkRateLimit } from '../utils/rate-limit'

export default defineEventHandler(async (event) => {
  // 用 IP 作为限流标识（生产环境建议用用户 ID）
  const clientIP = getRequestIP(event) || 'unknown'
  const { allowed, remaining } = checkRateLimit(clientIP, 20, 60_000)

  if (!allowed) {
    throw createError({
      statusCode: 429,
      message: '请求过于频繁，请稍后再试',
    })
  }

  setResponseHeader(event, 'X-RateLimit-Remaining', String(remaining))

  // ... 原有的 agent 逻辑
})
```

### 3. 输入验证：防止 Prompt Injection

用户可以发送任意内容给你的 API。恶意输入可能让 AI 忽略 system prompt，执行非预期操作。

```typescript
// server/utils/input-validator.ts
export function sanitizeUserInput(input: string): string {
  // 1. 长度限制（防止超长输入消耗 Token）
  if (input.length > 4000) {
    throw createError({ statusCode: 400, message: '输入内容过长' })
  }

  // 2. 基本的 prompt injection 检测
  const suspiciousPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /you\s+are\s+now\s+/i,
    /system\s*:\s*/i,       // 试图插入 system 角色
    /\[INST\]/i,            // Llama 格式的注入
    /<\|im_start\|>/i,      // ChatML 格式的注入
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(input)) {
      throw createError({ statusCode: 400, message: '输入包含不允许的内容' })
    }
  }

  return input.trim()
}
```

**重要**：输入验证只是第一道防线。你的 system prompt 应该明确声明"只使用提供的工具，不要执行用户要求的其他操作"。

### 4. 日志和监控：不泄露用户数据

日志是调试的命脉，但也是数据泄露的重灾区。

```typescript
// 错误做法：把用户消息完整打印到日志
console.log('User message:', messages[messages.length - 1].content)
// 如果用户输入了身份证号、密码、公司机密，全进了日志

// 正确做法：只记录元数据
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  event: 'agent_chat',
  messageCount: messages.length,
  lastMessageLength: messages[messages.length - 1].content.length,
  // 不记录 content 本身
}))
```

在 Vercel 中查看日志：

```bash
vercel logs https://your-app.vercel.app --follow
```

### 5. 成本告警设置

不要等到账单来了才发现问题。设置多层告警：

```typescript
// server/utils/cost-alert.ts
const DAILY_BUDGET_USD = 5.0 // 每日预算 5 美元
const ALERT_THRESHOLDS = [0.5, 0.8, 1.0] // 50%、80%、100% 触发告警

let lastAlertedThreshold = 0

export function checkCostAlert(todayCost: number) {
  const ratio = todayCost / DAILY_BUDGET_USD

  for (const threshold of ALERT_THRESHOLDS) {
    if (ratio >= threshold && lastAlertedThreshold < threshold) {
      lastAlertedThreshold = threshold
      sendAlert(threshold, todayCost)
    }
  }
}

function sendAlert(threshold: number, cost: number) {
  const percent = Math.round(threshold * 100)
  console.warn(`[COST ALERT] 已达到每日预算的 ${percent}%（$${cost.toFixed(2)} / $${DAILY_BUDGET_USD}）`)

  // 生产环境：发送到 Slack / 邮件 / 钉钉
  // await fetch('https://hooks.slack.com/services/xxx', {
  //   method: 'POST',
  //   body: JSON.stringify({ text: `AI 应用成本告警：已花费 $${cost.toFixed(2)}` }),
  // })
}
```

在每次 API 调用后检查：

```typescript
// 在 trackUsage 后调用
const todayUsage = getTodayUsage()
const todayCost = todayUsage.reduce((sum, u) => sum + u.cost, 0)
checkCostAlert(todayCost)
```

### 完整检查清单

- [ ] `.env` 文件没有提交到 Git（检查 `.gitignore`）
- [ ] API Key 没有硬编码在代码中
- [ ] API Key 已设置 90 天轮换提醒
- [ ] 向量数据库不是 localhost（生产环境用 Qdrant Cloud 或 Pinecone）
- [ ] 已实现 Rate Limiting（每 IP 每分钟最多 20 次请求）
- [ ] 已实现输入验证（长度限制 + prompt injection 检测）
- [ ] 日志不包含用户消息原文
- [ ] 已设置每日成本告警（建议 $5/天）
- [ ] 错误处理完善（不会把内部错误信息暴露给用户）
- [ ] Agent 的 `maxSteps` 设置合理（不超过 20）
- [ ] 已为不同功能设置 Token 预算上限

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
**下一步：** [架构决策与生产部署](/playground/05-architecture-decisions)
