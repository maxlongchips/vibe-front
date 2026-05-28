---
title: Function Calling 前端实战：让 AI 调用你的组件
description: Tool Use 协议解析、前端定义工具 Schema、多轮调用的状态机设计、工具调用过程的 UI 渲染
tags: ['function-calling', 'tool-use', 'ai-sdk', 'vue']
category: 学习路线
---

# Function Calling 前端实战：让 AI 调用你的组件

> 跟着这篇教程走，你将从零搭建一个能调用工具的 AI 聊天应用。每一步都有完整代码，复制粘贴即可运行。

---

## 零基础起步

开始之前，请确认你已经准备好了以下环境。

**已完成的学习内容：**
- [路线 01：AI 基础概念](/roadmap/01-ai-basics) -- 了解 LLM 是什么
- [路线 02：Vercel AI SDK 核心](/roadmap/02-vercel-ai-sdk) -- 已经跑通 `useChat` 的基础聊天

**开发环境检查：**

打开终端，逐条运行：

```bash
# 检查 Node.js 版本（需要 18+）
node --version
# 预期输出: v18.x.x 或更高

# 检查项目是否存在
ls package.json
# 预期输出: package.json（应该在你的 Nuxt 3 项目根目录下）

# 检查 AI SDK 是否已安装
cat package.json | grep ai
# 预期输出: "@ai-sdk/vue": "..." 和 "ai": "..."
```

如果 AI SDK 还没安装：

```bash
npm install ai @ai-sdk/vue @ai-sdk/openai zod
```

**当前位置：** 你有一个能跑通基础聊天的 Nuxt 3 项目，`useChat` 已经能用。现在我们要给 AI 装上"手脚"，让它能调用函数。

---

## 第一步：理解 Function Calling 是什么

### 没有 Function Calling 时

```
用户: "帮我查一下 Vue 3 Composition API 的用法"
AI:   "Composition API 是 Vue 3 的新特性，主要包括 ref、reactive..."（凭记忆回答，可能过时）
```

AI 只能"说"，不能"做"。

### 有了 Function Calling 后

```
用户: "帮我查一下 Vue 3 Composition API 的用法"
AI 思考: 我应该调用 search_docs 工具来搜索真实文档
AI 输出: { "tool": "search_docs", "args": { "query": "Vue 3 Composition API" } }
系统执行: 真正去搜索知识库，返回结果
AI 回答: "根据最新文档，Composition API 的核心用法是..."（基于真实数据回答）
```

**核心区别：** AI 从"只能聊天"变成了"能干活"。它能决定什么时候调用什么工具，拿到结果后再组织回答。

**关键概念：**
- **工具（Tool）**：你定义的函数，告诉 AI "你有这些能力可以用"
- **参数（Parameters）**：每个工具需要什么输入
- **执行（Execute）**：工具被调用时真正运行的代码
- **结果（Result）**：工具执行完返回给 AI 的数据

---

## 第二步：定义你的第一个工具

我们要创建一个 `search_docs` 工具，让 AI 能搜索文档。

### 你在哪里

你的项目结构大概是这样的：

```
your-nuxt-project/
├── server/
│   └── api/
│       └── chat.post.ts      ← 路线 02 已经创建的基础聊天接口
├── pages/
│   └── index.vue              ← 聊天页面
├── nuxt.config.ts
└── package.json
```

### 你要做什么

打开 `server/api/chat.post.ts`，用以下内容替换：

```typescript
// server/api/chat.post.ts
import { streamText, tool } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// 模拟的文档数据（实际项目中可以接数据库或文件系统）
const docs = [
  { title: 'Vue 3 Composition API', content: 'ref() 用于创建响应式基本类型，reactive() 用于对象...', category: 'api' },
  { title: 'Vue 3 组件基础', content: '组件通过 defineComponent 或 <script setup> 定义...', category: 'guide' },
  { title: 'Nuxt 3 路由', content: 'Nuxt 3 基于文件的路由系统，pages/ 目录自动生成路由...', category: 'guide' },
  { title: 'Pinia 状态管理', content: 'defineStore() 定义 store，支持 Composition API 风格...', category: 'api' },
  { title: 'Vercel AI SDK useChat', content: 'useChat() 提供 messages、input、handleSubmit 等响应式状态...', category: 'tutorial' },
]

export default defineEventHandler(async (event) => {
  const { messages } = await readBody(event)

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: `你是一个前端开发助手。你可以搜索项目文档来回答问题。
当用户问到技术问题时，优先使用 search_docs 工具搜索文档，而不是凭记忆回答。
回答时引用文档来源。`,
    messages,
    tools: {
      search_docs: tool({
        description: '搜索项目文档和知识库，查找技术文档、教程、API 说明',
        parameters: z.object({
          query: z.string().describe('搜索关键词，如 "Composition API"'),
          category: z.enum(['api', 'guide', 'tutorial']).optional()
            .describe('文档分类：api=API参考, guide=使用指南, tutorial=教程'),
        }),
        execute: async ({ query, category }) => {
          // 简单的关键词匹配搜索
          const results = docs.filter((doc) => {
            const matchesQuery = doc.title.toLowerCase().includes(query.toLowerCase())
              || doc.content.toLowerCase().includes(query.toLowerCase())
            const matchesCategory = !category || doc.category === category
            return matchesQuery && matchesCategory
          })

          return {
            count: results.length,
            results: results.map((r) => ({
              title: r.title,
              content: r.content,
              category: r.category,
            })),
          }
        },
      }),
    },
    maxTokens: 2048,
  })

  return result.toDataStreamResponse()
})
```

### 你应该看到什么

文件保存后，代码没有红色报错。我们来测试一下接口是否正常。

在终端运行：

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"帮我查一下 Composition API"}]}'
```

你应该看到流式输出，其中包含工具调用的 JSON 数据，类似：

```
{"toolCallId":"call_xxx","toolName":"search_docs","args":{"query":"Composition API"}}
```

然后是工具执行结果，最后是 AI 基于搜索结果的回答。

**恭喜！** AI 已经学会"动手"了。

### 卡住了？

**问题：报错 `OPENAI_API_KEY is not defined`**
解决：在项目根目录创建 `.env` 文件：
```
OPENAI_API_KEY=sk-你的key
```
然后重启开发服务器 `npm run dev`。

**问题：报错 `Cannot find module 'zod'`**
解决：`npm install zod`

**问题：curl 没有输出或超时**
解决：确认 Nuxt 开发服务器正在运行（`npm run dev`），确认端口是 3000。

**问题：输出中没有工具调用，AI 直接回答了**
解决：这是正常的 -- AI 有时会认为自己已经知道答案。你可以追问"请用 search_docs 工具搜索一下"来强制触发。

---

## 第三步：前端渲染工具调用

现在后端已经能调用工具了，我们要让前端展示工具调用的过程。

### 你在哪里

你的 `pages/index.vue` 应该已经有基础聊天界面（路线 02 的成果）。

### 你要做什么

用以下内容替换 `pages/index.vue`：

```vue
<!-- pages/index.vue -->
<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'

const { messages, input, handleSubmit, isLoading } = useChat({
  api: '/api/chat',
})

// 工具名称到中文的映射
const toolNameMap: Record<string, string> = {
  search_docs: '搜索文档',
}

// 格式化工具名称
function formatToolName(name: string) {
  return toolNameMap[name] || name
}
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 min-h-screen flex flex-col">
    <h1 class="text-2xl font-bold text-zinc-100 mb-6">
      AI 助手 <span class="text-sm font-normal text-zinc-500">（支持工具调用）</span>
    </h1>

    <!-- 消息列表 -->
    <div class="flex-1 space-y-6 overflow-y-auto pb-4">
      <div v-for="msg in messages" :key="msg.id">
        <!-- 用户消息 -->
        <div v-if="msg.role === 'user'" class="flex justify-end">
          <span class="bg-emerald-600 text-white px-4 py-2 rounded-2xl rounded-br-sm max-w-[80%]">
            {{ msg.content }}
          </span>
        </div>

        <!-- AI 回复 -->
        <div v-else class="space-y-3">
          <!-- 工具调用展示 -->
          <div
            v-for="invocation in msg.toolInvocations"
            :key="invocation.toolCallId"
            class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
          >
            <!-- 工具标题栏 -->
            <div class="flex items-center gap-2 px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800">
              <span class="text-emerald-400 text-sm">
                {{ formatToolName(invocation.toolName) }}
              </span>
              <span class="text-xs text-zinc-600 font-mono">
                {{ invocation.toolName }}
              </span>
              <!-- 状态指示 -->
              <span
                v-if="invocation.state === 'call'"
                class="ml-auto text-xs text-amber-400 animate-pulse"
              >
                执行中...
              </span>
              <span v-else class="ml-auto text-xs text-emerald-500">
                完成
              </span>
            </div>

            <!-- 工具参数 -->
            <div class="px-4 py-2 border-b border-zinc-800/50">
              <div class="text-xs text-zinc-500 mb-1">参数</div>
              <pre class="text-xs text-zinc-400 font-mono overflow-x-auto whitespace-pre-wrap">{{
                JSON.stringify(invocation.args, null, 2)
              }}</pre>
            </div>

            <!-- 工具结果 -->
            <div v-if="invocation.state === 'result'" class="px-4 py-2">
              <div class="text-xs text-zinc-500 mb-1">返回结果</div>
              <pre class="text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">{{
                JSON.stringify(invocation.result, null, 2)
              }}</pre>
            </div>
          </div>

          <!-- AI 文本回答 -->
          <div v-if="msg.content" class="text-zinc-200 leading-relaxed px-1">
            {{ msg.content }}
          </div>
        </div>
      </div>

      <!-- 加载指示 -->
      <div v-if="isLoading && messages[messages.length - 1]?.role === 'user'" class="text-zinc-500 text-sm animate-pulse">
        AI 正在思考...
      </div>
    </div>

    <!-- 输入框 -->
    <form @submit="handleSubmit" class="flex gap-2 pt-4 border-t border-zinc-800">
      <input
        v-model="input"
        type="text"
        placeholder="问我任何前端问题..."
        class="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-600"
        :disabled="isLoading"
      />
      <button
        type="submit"
        :disabled="isLoading || !input.trim()"
        class="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        发送
      </button>
    </form>
  </div>
</template>
```

### 你应该看到什么

1. 打开浏览器访问 `http://localhost:3000`
2. 输入："帮我查一下 Composition API"
3. 你应该依次看到：
   - 用户消息出现在右侧
   - 一个工具调用卡片出现，显示"搜索文档"、参数、状态为"执行中..."
   - 卡片展开显示返回结果，状态变为"完成"
   - AI 基于搜索结果生成回答

### 卡住了？

**问题：页面空白或报错**
解决：确认 `@ai-sdk/vue` 已安装：`npm ls @ai-sdk/vue`

**问题：`msg.toolInvocations` 是 undefined**
解决：这是正常的 -- 用户消息没有 `toolInvocations`。模板中的 `v-for` 在 undefined 时不会渲染，不会报错。

**问题：工具调用卡片不出现，AI 直接回答**
解决：AI 模型有时不调用工具。在 `system` prompt 中强调"必须使用工具"，或者尝试不同的提问方式。

**问题：样式不生效**
解决：确认项目安装了 Tailwind CSS。如果没有：`npm install -D tailwindcss postcss autoprefixer` 并配置。

---

## 第四步：理解多轮工具调用

AI 有时候需要连续调用多个工具才能完成任务。Vercel AI SDK 会自动处理这个流程，你不需要手动管理。

### 调用流程图解

```
用户: "帮我查 Pinia 的用法，然后看看我们项目里怎么用的"

AI 第 1 步: 调用 search_docs({ query: "Pinia" })
             → 返回文档结果

AI 第 2 步: 调用 view_component({ name: "useStore" })  （如果我们定义了这个工具）
             → 返回组件源码

AI 第 3 步: 综合两个工具的结果，生成最终回答
             → "根据文档，Pinia 的用法是... 你项目中的 useStore 组件..."
```

### 前端如何感知

每一轮工具调用都会在消息的 `toolInvocations` 数组中追加一条记录。你的前端代码不需要改动 -- 第三步的模板已经能正确渲染多个工具调用。

验证方法：在聊天中输入一个复杂问题，观察是否出现多个工具调用卡片。

---

## 第五步：更好的 UI -- 折叠面板和时间线

当工具调用很多时，平铺展示会很长。我们来实现两种更好的展示方式。

### 方式 A：折叠面板

适合"工具调用是细节，用户主要看回答"的场景。

创建新文件 `components/ToolCallsCollapse.vue`：

```vue
<!-- components/ToolCallsCollapse.vue -->
<script setup lang="ts">
defineProps<{
  toolInvocations: Array<{
    toolCallId: string
    toolName: string
    args: Record<string, unknown>
    state: string
    result?: unknown
  }>
}>()

const toolNameMap: Record<string, string> = {
  search_docs: '搜索文档',
  view_component: '查看组件',
  run_code: '运行代码',
}

function formatToolName(name: string) {
  return toolNameMap[name] || name
}
</script>

<template>
  <details class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group">
    <summary class="px-4 py-3 cursor-pointer text-sm text-zinc-400 hover:text-zinc-300 flex items-center gap-2 select-none">
      <svg
        class="w-4 h-4 transition-transform group-open:rotate-90"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      <span>调用了 {{ toolInvocations.length }} 个工具</span>
      <span class="text-xs text-zinc-600 ml-auto">
        点击展开详情
      </span>
    </summary>
    <div class="px-4 pb-3 space-y-3 border-t border-zinc-800">
      <div
        v-for="inv in toolInvocations"
        :key="inv.toolCallId"
        class="pt-3"
      >
        <div class="flex items-center gap-2 mb-1">
          <span class="text-emerald-400 text-sm font-medium">{{ formatToolName(inv.toolName) }}</span>
          <span class="text-xs text-zinc-600 font-mono">{{ inv.toolName }}</span>
          <span v-if="inv.state === 'result'" class="text-xs text-emerald-600 ml-auto">完成</span>
          <span v-else class="text-xs text-amber-500 animate-pulse ml-auto">执行中</span>
        </div>
        <pre class="text-xs text-zinc-500 font-mono overflow-x-auto whitespace-pre-wrap">{{
          JSON.stringify(inv.args, null, 2)
        }}</pre>
        <div v-if="inv.state === 'result'" class="mt-1">
          <pre class="text-xs text-zinc-400 font-mono overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">{{
            JSON.stringify(inv.result, null, 2)
          }}</pre>
        </div>
      </div>
    </div>
  </details>
</template>
```

使用方式 -- 在 `pages/index.vue` 的工具调用部分替换为：

```vue
<!-- 替换原来的 v-for 工具调用展示 -->
<ToolCallsCollapse
  v-if="msg.toolInvocations?.length"
  :tool-invocations="msg.toolInvocations"
/>
```

### 方式 B：时间线

适合"想看执行顺序和进度"的场景。

创建新文件 `components/ToolCallsTimeline.vue`：

```vue
<!-- components/ToolCallsTimeline.vue -->
<script setup lang="ts">
defineProps<{
  toolInvocations: Array<{
    toolCallId: string
    toolName: string
    args: Record<string, unknown>
    state: string
    result?: unknown
  }>
}>()

const toolNameMap: Record<string, string> = {
  search_docs: '搜索文档',
  view_component: '查看组件',
  run_code: '运行代码',
}

function formatToolName(name: string) {
  return toolNameMap[name] || name
}
</script>

<template>
  <div class="relative pl-8 space-y-4 py-2">
    <!-- 时间线竖线 -->
    <div class="absolute left-3 top-0 bottom-0 w-px bg-zinc-800" />

    <div
      v-for="(inv, index) in toolInvocations"
      :key="inv.toolCallId"
      class="relative"
    >
      <!-- 时间线节点 -->
      <div
        class="absolute -left-5 top-1 w-3 h-3 rounded-full border-2 transition-colors"
        :class="inv.state === 'result'
          ? 'bg-emerald-500 border-emerald-500'
          : 'bg-zinc-800 border-amber-500 animate-pulse'"
      />

      <!-- 步骤编号 -->
      <span class="absolute -left-11 top-0.5 text-xs text-zinc-600 font-mono">
        {{ index + 1 }}
      </span>

      <!-- 工具信息 -->
      <div class="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
        <div class="flex items-center gap-2">
          <span class="text-emerald-400 text-sm">{{ formatToolName(inv.toolName) }}</span>
          <span class="text-xs text-zinc-600 font-mono">{{ inv.toolName }}</span>
          <span v-if="inv.state === 'result'" class="text-xs text-emerald-600 ml-auto">完成</span>
          <span v-else class="text-xs text-amber-500 animate-pulse ml-auto">执行中...</span>
        </div>
        <pre class="text-xs text-zinc-500 font-mono mt-1 overflow-x-auto">{{ JSON.stringify(inv.args) }}</pre>
        <div v-if="inv.state === 'result'" class="mt-2 pt-2 border-t border-zinc-800">
          <pre class="text-xs text-zinc-400 font-mono overflow-x-auto whitespace-pre-wrap max-h-24 overflow-y-auto">{{
            JSON.stringify(inv.result, null, 2)
          }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
```

使用方式 -- 在 `pages/index.vue` 中替换：

```vue
<ToolCallsTimeline
  v-if="msg.toolInvocations?.length"
  :tool-invocations="msg.toolInvocations"
/>
```

### 你应该看到什么

- **折叠面板**：默认收起，只显示"调用了 X 个工具"，点击展开看详情
- **时间线**：左侧有竖线和圆点节点，从上到下展示工具调用的顺序，完成的节点是绿色，执行中的是橙色闪烁

### 卡住了？

**问题：组件没有显示**
解决：确认文件名和路径正确，Nuxt 3 会自动导入 `components/` 目录下的组件。

**问题：时间线的竖线和节点没对齐**
解决：检查 `pl-8`（padding-left）和 `-left-5`（节点位置）的值，它们需要配合。Tailwind 的间距单位是 0.25rem，`pl-8` = 2rem，`-left-5` = -1.25rem。

---

## 第六步：危险操作的确认机制

有些工具（比如删除文件、执行代码）不应该自动执行，需要用户确认。

### 后端：定义需要确认的工具

在 `server/api/chat.post.ts` 的 `tools` 对象中添加：

```typescript
// 在 search_docs 后面添加
delete_file: tool({
  description: '删除指定的项目文件（危险操作，需要用户确认）',
  parameters: z.object({
    path: z.string().describe('要删除的文件路径，如 "components/OldButton.vue"'),
    reason: z.string().describe('删除原因'),
  }),
  // execute 不直接删除，而是返回确认请求
  execute: async ({ path, reason }) => {
    return {
      needsConfirmation: true,
      action: 'delete_file',
      message: `即将删除文件: ${path}`,
      detail: `原因: ${reason}`,
      path,
    }
  },
}),
```

### 前端：添加确认对话框

创建新文件 `components/ConfirmDialog.vue`：

```vue
<!-- components/ConfirmDialog.vue -->
<script setup lang="ts">
defineProps<{
  show: boolean
  title: string
  message: string
  detail?: string
  confirmText?: string
  cancelText?: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="show"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        @click.self="emit('cancel')"
      >
        <div class="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md mx-4 shadow-2xl">
          <div class="flex items-center gap-3 mb-3">
            <span class="text-2xl">&#x26A0;&#xFE0F;</span>
            <h3 class="text-zinc-100 font-semibold text-lg">{{ title }}</h3>
          </div>
          <p class="text-zinc-400">{{ message }}</p>
          <p v-if="detail" class="text-zinc-500 text-sm mt-1">{{ detail }}</p>
          <div class="flex gap-3 mt-6 justify-end">
            <button
              class="px-4 py-2 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
              @click="emit('cancel')"
            >
              {{ cancelText || '取消' }}
            </button>
            <button
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
              @click="emit('confirm')"
            >
              {{ confirmText || '确认执行' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

### 在聊天页面中集成确认逻辑

在 `pages/index.vue` 的 `<script setup>` 中添加确认相关的逻辑：

```vue
<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'
import { ref } from 'vue'

const { messages, input, handleSubmit, isLoading, addToolResult } = useChat({
  api: '/api/chat',
  maxSteps: 5, // 允许多轮工具调用
})

// 确认对话框状态
const confirmDialog = ref({
  show: false,
  toolCallId: '',
  title: '',
  message: '',
  detail: '',
})

// 监听需要确认的工具结果
function handleToolResult(invocation: { toolCallId: string; toolName: string; result?: { needsConfirmation?: boolean; message?: string; detail?: string } }) {
  if (invocation.result?.needsConfirmation) {
    confirmDialog.value = {
      show: true,
      toolCallId: invocation.toolCallId,
      title: '操作确认',
      message: invocation.result.message || '确认执行此操作？',
      detail: invocation.result.detail || '',
    }
  }
}

// 用户确认
function onConfirm() {
  addToolResult({
    toolCallId: confirmDialog.value.toolCallId,
    result: { confirmed: true },
  })
  confirmDialog.value.show = false
}

// 用户取消
function onCancel() {
  addToolResult({
    toolCallId: confirmDialog.value.toolCallId,
    result: { confirmed: false, message: '用户取消了操作' },
  })
  confirmDialog.value.show = false
}

const toolNameMap: Record<string, string> = {
  search_docs: '搜索文档',
  delete_file: '删除文件',
}

function formatToolName(name: string) {
  return toolNameMap[name] || name
}
</script>
```

在 `<template>` 的末尾（`</div>` 之前）添加确认对话框：

```vue
<ConfirmDialog
  :show="confirmDialog.show"
  :title="confirmDialog.title"
  :message="confirmDialog.message"
  :detail="confirmDialog.detail"
  confirm-text="确认删除"
  cancel-text="再想想"
  @confirm="onConfirm"
  @cancel="onCancel"
/>
```

### 你应该看到什么

1. 输入："帮我删除 components/OldButton.vue 这个废弃组件"
2. AI 调用 `delete_file` 工具
3. 弹出确认对话框，显示"即将删除文件: components/OldButton.vue"
4. 点击"再想想" -- AI 收到取消通知，会回复你
5. 点击"确认删除" -- AI 收到确认，继续执行

### 卡住了？

**问题：确认对话框不弹出**
解决：检查工具的 `execute` 函数是否返回了 `{ needsConfirmation: true }`。

**问题：`addToolResult` 报错**
解决：确认 `useChat` 的导入版本正确，`addToolResult` 是 AI SDK 较新版本的功能。运行 `npm list ai` 检查版本。

**问题：确认后 AI 没有继续**
解决：确认 `maxSteps` 设置足够大（至少 5），否则 SDK 会在工具调用后停止。

---

## 第七步：AI SDK 6 Strict Mode

AI SDK 6 引入了按工具独立控制的 strict mode。

### 什么是 Strict Mode？

开启 strict mode 后，工具的参数会严格按照 JSON Schema 校验，不会有多余字段或类型错误。这在对接外部 API 或需要精确类型时很有用。

### 怎么用

在定义工具时加上 `strict: true`：

```typescript
tools: {
  // 这个工具开启 strict mode -- 参数严格校验
  search_docs: tool({
    description: '搜索文档',
    parameters: z.object({
      query: z.string(),
      category: z.enum(['api', 'guide', 'tutorial']).optional(),
    }),
    strict: true,  // 严格模式
    execute: async ({ query, category }) => {
      // ...
    },
  }),

  // 这个工具不开启 -- 参数灵活
  chat: tool({
    description: '自由对话',
    parameters: z.object({
      message: z.string(),
    }),
    // 不设置 strict，默认为 false
    execute: async ({ message }) => {
      // ...
    },
  }),
}
```

### 什么时候用？

| 场景 | 是否开启 strict |
|------|----------------|
| 参数结构固定，如搜索、查数据库 | 开启 |
| 参数可能有变体，如自由格式输入 | 不开启 |
| 对接外部 API，参数必须精确 | 开启 |
| 原型阶段，快速迭代 | 不开启 |

### 工具调用输入流式传输

AI SDK 6 中，工具调用的参数默认流式传输。这意味着当 AI 生成大参数（比如一大段代码）时，前端不会卡住等待，而是实时看到参数的生成过程。

---

## 动手练习

完成教程后，试试以下练习巩固所学：

### 练习 1：添加一个新工具

给你的聊天添加 `view_component` 工具，功能是读取项目中 Vue 组件的源代码。

提示：
```typescript
view_component: tool({
  description: '查看 Vue 组件的源代码',
  parameters: z.object({
    name: z.string().describe('组件名称，如 UserProfile'),
  }),
  execute: async ({ name }) => {
    // 用 fs.readFile 读取文件
    // 记得处理文件不存在的情况
  },
})
```

### 练习 2：自定义工具图标

给每个工具调用卡片添加不同的图标：
- search_docs 用放大镜图标
- delete_file 用垃圾桶图标
- view_component 用代码图标

提示：可以用 SVG inline 或者 icon 库如 `lucide-vue-next`。

### 练习 3：添加"执行中"动画

当工具正在执行时（`state === 'call'`），显示一个带动画的加载条或骨架屏，而不是简单的文字"执行中..."。

### 练习 4：工具调用计数器

在页面顶部显示统计信息：
- 本次对话总共调用了几次工具
- 最常用的工具是什么
- 工具调用的平均耗时

---

## 本节要点

1. **Function Calling 让 AI 从"聊天"进化为"行动"** -- AI 能决定何时调用什么工具
2. **用 `tool()` + Zod Schema 定义工具** -- 类型安全，AI SDK 自动生成 JSON Schema
3. **`msg.toolInvocations` 包含所有工具调用信息** -- 状态、参数、结果都在里面
4. **多轮工具调用由 SDK 自动编排** -- 前端只需渲染，不需要管理调用顺序
5. **UI 可以用折叠面板或时间线** -- 根据场景选择合适的展示方式
6. **危险操作必须加确认机制** -- 用 `needsConfirmation` 标记，前端弹框拦截
7. **AI SDK 6 的 strict mode 按工具独立控制** -- 需要精确参数时开启，灵活场景不开

---

**上一篇：** [Vercel AI SDK 核心：从 useChat 到流式架构](/roadmap/02-vercel-ai-sdk)
**下一篇：** [RAG 全栈落地：从 Embedding 到向量检索的前端集成](/roadmap/04-rag-frontend)
