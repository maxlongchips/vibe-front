---
title: Vercel AI SDK 核心：从 useChat 到 Agent 架构
description: AI SDK 6 的 useChat、ToolLoopAgent、消息分片模型、流式架构、Reranking、MCP 集成
tags: ['vercel-ai-sdk', 'streaming', 'ai-sdk-6', 'agent']
category: 学习路线
---

# Vercel AI SDK 核心：从 useChat 到 Agent 架构

> 本教程带你从零搭建一个带流式输出的 AI 聊天功能。跟着做，你会得到一个能跑的真实项目。

## 为什么选 Vercel AI SDK？

2026 年的 AI 前端开发，SDK 选择已经收敛。Vercel AI SDK 月下载量超过 2000 万次。

- **框架无关**：支持 Vue、React、Svelte
- **流式一等公民**：从底层就为流式设计
- **TypeScript 原生**：类型推导精确到每一个 token
- **多模型支持**：Claude、GPT、Gemini、Mistral、xAI 一个接口搞定
- **Agent 原生**：AI SDK 6 提供了一等公民的 Agent 抽象

真实案例：Thomson Reuters 用 3 个开发者、2 个月时间，基于 Vercel AI SDK 构建了 CoCounsel（AI 法律助手），服务 1300 家会计事务所。

---

## 零基础起步

在动手之前，确认你的环境满足以下条件。逐条检查，缺少任何一项都会导致后续步骤失败。

### 检查清单

打开终端，逐条运行：

```bash
# 1. Node.js 版本 >= 18.17
node -v
# 期望输出: v18.17.0 或更高（推荐 v20+）

# 2. npm 版本 >= 9
npm -v
# 期望输出: 9.x.x 或更高

# 3. 确认你有一个 Nuxt 3 项目
ls nuxt.config.ts
# 应该能看到 nuxt.config.ts 文件
```

### 没有 Nuxt 项目？

如果你还没有 Nuxt 项目，用以下命令快速创建一个：

```bash
npx nuxi@latest init my-ai-chat
cd my-ai-chat
npm install
```

### Anthropic API Key

本教程使用 Claude 作为 AI 模型。你需要一个 Anthropic API Key：

1. 访问 [console.anthropic.com](https://console.anthropic.com) 注册账号
2. 创建一个 API Key
3. 在项目根目录创建 `.env` 文件：

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
```

把上面的 `sk-ant-api03-xxxxxxxxxxxxx` 替换成你自己的 key。

> **卡住了？** 如果 `node -v` 提示找不到命令，说明 Node.js 没有安装。去 [nodejs.org](https://nodejs.org) 下载 LTS 版本安装。如果 `ls nuxt.config.ts` 报错"没有那个文件"，说明你不在 Nuxt 项目目录里，先 `cd` 到你的项目目录。

---

## 第一步：安装依赖

**你在这里：** 终端里，位于 Nuxt 项目根目录。

**做什么：** 安装三个包。

```bash
npm install ai @ai-sdk/vue @ai-sdk/anthropic
```

- `ai` — Vercel AI SDK 核心库，提供 `streamText`、`ToolLoopAgent` 等
- `@ai-sdk/vue` — Vue/Nuxt 的前端集成，提供 `useChat` 组合式函数
- `@ai-sdk/anthropic` — Anthropic Claude 模型的 Provider 适配器

**你应该看到：** `package.json` 的 `dependencies` 里多了这三条：

```json
{
  "dependencies": {
    "ai": "^4.x.x",
    "@ai-sdk/vue": "^1.x.x",
    "@ai-sdk/anthropic": "^1.x.x"
  }
}
```

> **卡住了？**
> - 如果 npm 报 `ERESOLVE unable to resolve dependency tree`，运行 `npm install --legacy-peer-deps`。
> - 如果网络慢，换成国内镜像：`npm config set registry https://registry.npmmirror.com`，然后重新安装。

---

## 第二步：配置 API Key

**你在这里：** 依赖已安装完毕。

**做什么：** 在 Nuxt 配置中声明 API Key，让服务端代码可以访问。

打开 `nuxt.config.ts`，添加 `runtimeConfig`：

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  // ... 你已有的配置
  runtimeConfig: {
    // 服务端专用，不会暴露给浏览器
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  },
})
```

**你应该看到：** 配置文件保存后没有红色报错。

> **卡住了？**
> - 如果 TypeScript 报 `process is not defined`，确认你的 `nuxt.config.ts` 顶部没有 `import process from 'process'`（Nuxt 会自动注入 `process`）。
> - 确认 `.env` 文件在项目根目录（和 `nuxt.config.ts` 同级），文件名是 `.env` 不是 `.env.txt`。

---

## 第三步：创建服务端 API 路由

**你在这里：** 配置已就绪。

**做什么：** 创建一个 API 端点，接收前端发来的消息，调用 Claude，以流式方式返回响应。

创建文件 `server/api/chat.post.ts`：

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

**你应该看到：** 文件保存后没有报错。目录结构如下：

```
your-project/
├── server/
│   └── api/
│       └── chat.post.ts    <-- 你刚创建的文件
├── nuxt.config.ts
├── .env
└── package.json
```

### 这段代码在做什么？

逐行解释：

1. **`import { streamText } from 'ai'`** — 引入 AI SDK 的流式文本生成函数
2. **`import { anthropic } from '@ai-sdk/anthropic'`** — 引入 Anthropic 的模型适配器
3. **`defineLazyEventHandler`** — Nuxt 的懒加载事件处理器，只在第一次请求时执行初始化（这里从 runtimeConfig 读取 API Key）
4. **`readBody(event)`** — 从 POST 请求体中解析出 `{ messages }` 对象
5. **`streamText({...})`** — 调用 Claude API，以流式方式逐 token 生成文本
6. **`result.toDataStreamResponse()`** — 将流式结果转为浏览器可消费的 Response 格式

> **卡住了？**
> - 如果报 `Cannot find module 'ai'`，确认你已经运行了第二步的 `npm install`。
> - 如果报 `ANTHROPIC_API_KEY is undefined`，确认 `.env` 文件存在且 `nuxt.config.ts` 中的 `runtimeConfig` 配置正确。重启 Nuxt 开发服务器（`Ctrl+C` 后重新 `npm run dev`）。
> - 如果报 `401 Unauthorized`，检查你的 API Key 是否正确，是否过期。

---

## 第四步：创建前端聊天组件

**你在这里：** 服务端 API 已就绪。

**做什么：** 创建一个 Vue 组件，使用 `useChat` 连接后端，实现完整的聊天界面。

创建文件 `components/ChatBox.vue`：

```vue
<!-- components/ChatBox.vue -->
<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'

const { messages, input, handleSubmit, isLoading, error, stop } = useChat({
  api: '/api/chat',
  onError: (err) => {
    console.error('Chat error:', err)
  },
  onFinish: (message) => {
    console.log('Message completed:', message)
  }
})
</script>

<template>
  <div class="flex flex-col h-screen bg-zinc-950">
    <!-- 错误提示 -->
    <div
      v-if="error"
      class="mx-4 mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm"
    >
      出错了：{{ error.message }}
    </div>

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

**你应该看到：** 文件保存后没有报错。

### `useChat` 返回了什么？

解构出来的每个值都有明确用途：

| 返回值 | 类型 | 用途 |
|--------|------|------|
| `messages` | `Ref<Message[]>` | 所有消息的响应式数组，自动更新 |
| `input` | `Ref<string>` | 输入框的双向绑定值 |
| `handleSubmit` | `(e: Event) => void` | 表单提交处理函数 |
| `isLoading` | `Ref<boolean>` | 是否正在等待 AI 响应 |
| `error` | `Ref<Error \| null>` | 最近一次错误 |
| `stop` | `() => void` | 中断当前流式请求 |

> **卡住了？**
> - 如果 `useChat` 报 `useChat is not a function`，确认你安装了 `@ai-sdk/vue`（不是 `@ai-sdk/react`）。
> - 如果组件不渲染，确认文件放在 `components/` 目录下，Nuxt 会自动注册。

---

## 第五步：运行并测试

**你在这里：** 前后端代码都已就绪。

**做什么：** 启动开发服务器，测试聊天功能。

在页面中使用组件。编辑你的页面文件（比如 `pages/index.vue`）：

```vue
<!-- pages/index.vue -->
<template>
  <ChatBox />
</template>
```

然后启动开发服务器：

```bash
npm run dev
```

打开浏览器访问 `http://localhost:3000`。

**你应该看到：**
1. 一个深色背景的聊天界面
2. 底部有输入框和发送按钮
3. 输入"你好"后点击发送，AI 的回复会像打字机一样逐字出现
4. 生成过程中出现"停止"按钮

**恭喜！** 你已经完成了一个带流式输出的 AI 聊天功能。

> **卡住了？**
> - **页面空白：** 打开浏览器开发者工具（F12），查看 Console 标签页是否有红色错误。
> - **请求 404：** 确认 `server/api/chat.post.ts` 文件路径正确，文件名是 `chat.post.ts`（不是 `chat.ts`）。
> - **请求 500：** 查看终端里 Nuxt 的服务端日志，通常会显示具体错误信息。
> - **没有流式效果，而是等全部生成完才显示：** 检查浏览器 Network 标签，确认请求的 Response 类型是 `text/event-stream`。

---

## 深入理解：SSE 流式传输原理

你刚才看到的"打字机效果"不是 WebSocket，而是 **SSE（Server-Sent Events）**。

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

当浏览器从服务器接收流式数据时，实际传输格式长这样：

```
data: {"type":"text","text":"你"}

data: {"type":"text","text":"好"}

data: [DONE]
```

每个 `data:` 行是一个 chunk（数据块）。浏览器可以**边接收边渲染**，不需要等整个响应完成。最后的 `data: [DONE]` 表示流结束。

**为什么不用 WebSocket？** WebSocket 是双向通信，适合聊天室、游戏等需要服务器主动推送的场景。AI 聊天是典型的"请求-响应"模式——用户发一条消息，服务器返回一段流式文本。SSE 是单向的、基于 HTTP 的，更简单、更可靠、不需要额外的协议握手。

---

## 深入理解：消息分片模型（Message Parts）

AI SDK 6 的杀手特性。消息不再是纯文本，而是**交错的 parts**：

```
一条消息可以包含：
├── text part: "根据搜索结果..."
├── tool-call part: { name: "search_docs", args: { query: "..." } }
├── tool-result part: { results: [...] }
├── reasoning part: { text: "让我分析一下..." }
└── text part: "总结如下..."
```

**为什么这很重要？** 因为当 AI 调用工具（比如搜索、数据库查询）时，你需要在 UI 中展示"AI 正在搜索..."、"搜索结果如下..."这样的中间状态。如果消息只有纯文本，你就无法区分哪些是思考、哪些是工具调用、哪些是最终回答。

**你必须渲染每一种 part 类型**，否则工具调用的 UI 会丢失。

在后续的 [Function Calling 实战](/roadmap/03-function-calling) 教程中，你会亲手实现 parts 的渲染逻辑。

---

## 深入理解：stop() 的中断机制

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

---

## 错误处理：真实场景中的坑

### 网络超时

在 `useChat` 中监听超时错误：

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

在服务端设置 `maxTokens` 防止单次请求消耗过多 token：

```typescript
// server/api/chat.post.ts
const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  messages,
  maxTokens: 4096,
})
```

### 限流（Rate Limiting）

防止用户频繁调用 API 导致账单飙升：

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

> **卡住了？**
> - 如果 `useStorage('redis')` 报错，你没有配置 Redis。对于开发阶段，可以用内存 Map 替代。生产环境建议使用 Redis 或 Upstash。
> - 如果不知道怎么配置 Redis，在 `nuxt.config.ts` 中添加 `modules: ['@nuxtjs/redis']`，然后安装 `@nuxtjs/redis` 并配置连接信息。

---

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

我们会在 [Agent 架构详解](/roadmap/05-agent-architecture) 中深入讲解 ToolLoopAgent 的完整用法。

---

## Provider Adapter：一行代码切换模型

Vercel AI SDK 的 Provider 让你用同一套代码切换不同的 AI 供应商：

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

---

## 本节要点

1. `useChat` 是完整的聊天状态管理器，不只是"发消息"
2. 消息分片模型（message-parts）是 AI SDK 6 的杀手特性，必须渲染每种 part 类型
3. `ToolLoopAgent` 提供一等公民的 Agent 抽象，定义一次到处复用
4. 流式传输基于 SSE，不是 WebSocket
5. `stop()` 是彻底中断，不是暂停
6. Provider Adapter 让你一行代码切换 AI 供应商

---

## 动手练习

完成教程后，试试这些练习巩固所学：

### 练习 1：添加消息历史持久化

目前刷新页面后消息会丢失。利用 `useChat` 的 `id` 参数和 localStorage 实现消息持久化：

```typescript
const { messages, input, handleSubmit, isLoading, error, stop } = useChat({
  api: '/api/chat',
  id: 'my-chat', // 固定 ID，刷新后会自动恢复消息
})
```

试试看：发送几条消息，刷新页面，消息是否还在？

### 练习 2：显示 token 用量

在 `onFinish` 回调中，`message` 对象包含 `usage` 信息。把它显示在 UI 上：

```typescript
const tokenUsage = ref<{ promptTokens: number; completionTokens: number } | null>(null)

const { messages, input, handleSubmit, isLoading, error, stop } = useChat({
  api: '/api/chat',
  onFinish: (message) => {
    tokenUsage.value = message.usage
  }
})
```

在模板中显示：`<div>本次消耗: {{ tokenUsage?.completionTokens }} tokens</div>`

### 练习 3：切换模型

把服务端的模型从 `claude-sonnet-4-20250514` 换成 `claude-haiku-4-20250414`，观察响应速度和质量的变化。也可以尝试安装 `@ai-sdk/openai` 用 GPT-4o。

### 练习 4：添加系统提示词实验

修改 `server/api/chat.post.ts` 中的 `system` 字段，让 AI 扮演不同角色（翻译官、代码审查员、产品经理），观察输出风格的变化。

---

**上一篇：** [环境武装：打造你的 AI 开发兵器库](/roadmap/01-dev-environment)
**下一篇：** [Function Calling 前端实战：让 AI 调用你的组件](/roadmap/03-function-calling)
