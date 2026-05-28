---
title: 对话引擎核心：流式 Chat UI 开发
description: useChat 接入 Claude API、Markdown 实时渲染、消息操作栏、打字机效果与中断控制
tags: ['实战', 'chat', 'streaming', 'vue3']
category: 实战演练
---

# 实战 02：对话引擎核心：流式 Chat UI 开发

> 对话 UI 是 AI 应用的脸面。用户体验好不好，全看这一步。

---

## 零基础起步

开始本节之前，确认你已经完成以下准备：

```bash
# 1. 确认你在正确的项目目录下
pwd
# 期望输出包含：ai-doc-assistant

# 2. 确认 AI SDK 已安装
npm ls ai @ai-sdk/anthropic
# 不应该报错，应该显示版本号

# 3. 确认 .env 中有 API Key
cat .env | grep ANTHROPIC_API_KEY
# 应该看到：ANTHROPIC_API_KEY=sk-ant-...

# 4. 确认开发服务器能启动
npm run dev
# 打开 http://localhost:3000 能看到暗黑主题布局
```

**如果上面任何一步失败**：请先回去完成 [实战 01：架构设计与项目初始化](/playground/01-architecture)。

全部就绪后，我们开始构建对话引擎。

---

## 第一步：创建 Chat API（服务端）

这是整个对话功能的核心——服务端接口。它接收用户消息，调用 Claude API，以流式方式返回 AI 回复。

创建文件 `server/api/chat.post.ts`：

```typescript
// server/api/chat.post.ts
import { streamText } from 'ai'
import { getAnthropicProvider } from '../utils/llm'

export default defineEventHandler(async (event) => {
  // 1. 从请求体中读取用户发送的消息列表
  const { messages } = await readBody(event)

  // 2. 获取 Anthropic 提供者（从 .env 读取 API Key）
  const anthropic = getAnthropicProvider()

  // 3. 调用 Claude API，以流式方式返回
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `你是一个专业的前端开发助手。回答要简洁、准确、有代码示例。
如果不确定，诚实说"我不确定"。`,
    messages,
    maxTokens: 4096,
  })

  // 4. 返回流式响应（浏览器会一块一块地接收数据）
  return result.toDataStreamResponse()
})
```

**代码解释：**
- `streamText` 是 Vercel AI SDK 提供的函数，它会把 AI 的回复分成一小块一小块地发回来（流式输出），用户不用等完整回复生成就能看到内容
- `system` 是系统提示词，告诉 AI 该怎么表现
- `toDataStreamResponse()` 把结果转成浏览器能理解的流式 HTTP 响应

**完成这一步后你应该看到：**
- `server/api/chat.post.ts` 文件已创建
- 文件没有语法错误

### 验证 API 是否工作

启动开发服务器（如果还没启动）：

```bash
npm run dev
```

用 curl 测试 API：

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"你好"}]}'
```

**你应该看到：** 一堆流式数据返回（类似 `0:"你"0:"好"0:"！"`），这说明 API 工作正常。

### 卡住了？

| 问题 | 解决办法 |
|------|----------|
| 返回 `500 ANTHROPIC_API_KEY 未配置` | 检查 `.env` 文件是否存在且格式正确，重启开发服务器 |
| 返回 `401` 或 `AuthenticationError` | API Key 不对，去 Anthropic 控制台重新获取 |
| 返回 `ECONNREFUSED` | 开发服务器没启动，先运行 `npm run dev` |
| curl 报错 `command not found`（Windows） | 用 Git Bash 运行，或者用 Postman 发 POST 请求 |

---

## 架构决策：为什么用 SSE 不用 WebSocket？

在实现流式输出时，你有三种实时通信方案可选。这里详细对比，帮你理解为什么 SSE（Server-Sent Events）是 AI 流式场景的最佳选择。

### 三种方案对比

| 特性 | SSE | WebSocket | Long Polling |
|------|-----|-----------|--------------|
| **通信方向** | 服务端 -> 客户端（单向） | 双向 | 客户端 -> 服务端（模拟推送） |
| **协议** | HTTP/1.1 或 HTTP/2 | 独立协议（ws://） | HTTP |
| **自动重连** | 浏览器内置支持 | 需手动实现 | 需手动实现 |
| **负载均衡兼容** | 完全兼容（基于 HTTP） | 需要 sticky session | 完全兼容 |
| **防火墙/代理兼容** | 完全兼容 | 可能被拦截 | 完全兼容 |
| **服务端复杂度** | 低（普通 HTTP 响应） | 高（需维护连接状态） | 中（需管理超时和重试） |
| **典型延迟** | 低（~ms） | 极低（~ms） | 高（取决于轮询间隔） |
| **浏览器原生支持** | `EventSource` API | `WebSocket` API | 无（需 `fetch`/`XMLHttpRequest`） |

### 什么时候用哪个？

**SSE 适合的场景：**
- 服务端向客户端推送数据（AI 回复、股票行情、通知推送）
- 不需要客户端频繁向服务端发消息
- 需要简单可靠的实现

**WebSocket 适合的场景：**
- 双向实时通信（在线聊天室、多人协作编辑、游戏）
- 客户端需要高频发送数据（鼠标位置、键盘输入）
- 对延迟极其敏感（毫秒级）

**Long Polling 适合的场景：**
- 需要兼容非常老的浏览器或网络环境
- 推送频率很低（几分钟一次）
- 无法使用 SSE 或 WebSocket 的受限环境

### 为什么 SSE 最适合 AI 流式输出？

AI 对话场景有一个关键特点：**数据流是单方向的**。用户发一条消息，AI 返回一大段回复。整个过程中，客户端只需要接收数据，不需要在流式传输过程中向服务端发消息。

这恰好是 SSE 的最佳使用场景：

1. **单向推送**：AI 回复从服务端流向客户端，不需要双向通信
2. **HTTP 兼容**：不需要升级协议，与现有的 REST API、中间件、CDN 完全兼容
3. **自动重连**：浏览器的 `EventSource` API 内置重连机制，网络抖动时自动恢复
4. **负载均衡友好**：每个请求都是标准 HTTP 请求，普通的负载均衡器就能处理

### 代码对比：SSE vs WebSocket 实现同一个功能

**SSE 方案（我们使用的）：**

```typescript
// 服务端：普通 HTTP 响应，设置 Content-Type 即可
// server/api/chat.post.ts
export default defineEventHandler(async (event) => {
  const { messages } = await readBody(event)
  const result = streamText({ model: anthropic('claude-sonnet-4-20250514'), messages })
  return result.toDataStreamResponse()
  // AI SDK 自动设置 Content-Type: text/event-stream
})

// 客户端：用 fetch 就能接收流式数据
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages }),
})
const reader = response.body.getReader()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  // 处理每一块数据
}
```

**WebSocket 方案（不推荐，仅作对比）：**

```typescript
// 服务端：需要专门的 WebSocket 服务器
// 需要额外的库（如 ws、socket.io），不能用普通的 HTTP handler
import { WebSocketServer } from 'ws'
const wss = new WebSocketServer({ port: 8080 })
wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    const { messages } = JSON.parse(data)
    const result = streamText({ model: anthropic('claude-sonnet-4-20250514'), messages })
    for await (const chunk of result.textStream) {
      ws.send(JSON.stringify({ type: 'chunk', content: chunk }))
    }
    ws.send(JSON.stringify({ type: 'done' }))
  })
})

// 客户端：需要管理连接生命周期
const ws = new WebSocket('ws://localhost:8080')
ws.onopen = () => ws.send(JSON.stringify({ messages }))
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  // 处理数据...
}
// 还需要处理 onclose、onerror、手动重连...
```

WebSocket 方案需要：额外的服务器进程、手动管理连接状态、手动实现重连逻辑、处理 sticky session（多实例部署时）。对于 AI 流式输出这种单向推送场景，这些额外复杂度完全没有必要。

---

## 第二步：创建 Chat 窗口组件

这个组件是聊天界面的主体——包含消息列表和输入框。

创建文件 `components/chat/ChatWindow.vue`：

```vue
<!-- components/chat/ChatWindow.vue -->
<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'
import { Send, Square } from 'lucide-vue-next'

// useChat 是 Vercel AI SDK 提供的核心 Hook
// 它自动处理：发送消息、接收流式回复、管理消息列表
const { messages, input, handleSubmit, isLoading, stop } = useChat({
  api: '/api/chat',
  initialMessages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是 AI 文档助手，有什么可以帮你的？',
    },
  ],
})

// 消息列表的 DOM 引用，用于自动滚动
const messagesContainer = ref<HTMLElement | null>(null)

// 每当消息列表变化，自动滚动到底部
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
    <!-- 消息列表区域 -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-6 space-y-6">
      <MessageBubble
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
      />
    </div>

    <!-- 底部输入区域 -->
    <div class="border-t border-zinc-800 p-4">
      <form @submit="handleSubmit" class="flex gap-3">
        <!-- 输入框 -->
        <input
          v-model="input"
          placeholder="输入你的问题..."
          class="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl
                 text-zinc-200 placeholder-zinc-500
                 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20
                 transition-colors"
          :disabled="isLoading"
        />

        <!-- 发送按钮（AI 没在回复时显示） -->
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

        <!-- 停止按钮（AI 正在回复时显示） -->
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

**代码解释：**
- `useChat` 自动管理所有状态：`messages`（消息列表）、`input`（输入框内容）、`isLoading`（是否在等待回复）
- `handleSubmit` 是提交表单的函数，点击发送按钮或按回车都会触发
- `stop` 可以中断 AI 正在生成的回复

**完成这一步后你应该看到：**
- `components/chat/ChatWindow.vue` 文件已创建
- 编辑器中 `MessageBubble` 组件可能显示红色（因为还没创建，下一步会创建）

---

## 第三步：创建消息气泡组件

每个消息（不管是用户发的还是 AI 回复的）都用这个组件来显示。AI 的回复支持 Markdown 渲染和代码高亮。

先安装必要的依赖：

```bash
npm install marked highlight.js
npm install -D @types/marked
```

创建文件 `components/chat/MessageBubble.vue`：

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

// 复制状态
const copied = ref(false)

// 把 Markdown 文本转成 HTML（AI 消息用）
const renderedContent = computed(() => {
  // 用户消息不渲染 Markdown，直接显示纯文本
  if (props.message.role === 'user') return props.message.content

  // 配置代码高亮
  marked.setOptions({
    highlight: (code: string, lang: string) => {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value
      }
      return hljs.highlightAuto(code).value
    },
  })

  return marked(props.message.content)
})

// 复制消息内容到剪贴板
async function copyContent() {
  await navigator.clipboard.writeText(props.message.content)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <div class="flex gap-3" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
    <!-- AI 头像（左侧） -->
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
        <!-- 用户消息：纯文本 -->
        <div v-if="message.role === 'user'" class="whitespace-pre-wrap">
          {{ message.content }}
        </div>

        <!-- AI 消息：Markdown 渲染 -->
        <div
          v-else
          class="prose prose-invert prose-zinc max-w-none text-sm
                 prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800
                 prose-code:text-emerald-400"
          v-html="renderedContent"
        />
      </div>

      <!-- AI 消息的操作栏 -->
      <div v-if="message.role === 'assistant'" class="flex items-center gap-2 px-1">
        <button
          @click="copyContent"
          class="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <component :is="copied ? Check : Copy" class="w-3 h-3" />
          {{ copied ? '已复制' : '复制' }}
        </button>
      </div>
    </div>

    <!-- 用户头像（右侧） -->
    <div v-if="message.role === 'user'" class="flex-shrink-0">
      <div class="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center">
        <User class="w-4 h-4 text-zinc-400" />
      </div>
    </div>
  </div>
</template>
```

**完成这一步后你应该看到：**
- `components/chat/MessageBubble.vue` 文件已创建
- 之前 `ChatWindow.vue` 中 `MessageBubble` 的红色波浪线应该消失了

---

## 架构决策：Markdown 渲染方案对比

AI 回复的核心特征是包含 Markdown 格式（标题、列表、代码块、表格等）。选择合适的 Markdown 渲染方案直接影响用户体验和应用性能。

### 四种主流方案对比

| 方案 | 包体积（minified） | 代码高亮 | 渲染速度 | 生态插件 | 学习成本 |
|------|-------------------|----------|----------|----------|----------|
| **marked + highlight.js** | ~45KB + ~30KB | highlight.js（300+ 语言） | 快 | 少 | 低 |
| **markdown-it + highlight.js** | ~55KB + ~30KB | highlight.js（300+ 语言） | 快 | 丰富（100+ 插件） | 中 |
| **remark（unified 生态）** | ~150KB+（含插件） | 需额外配置 | 中 | 极其丰富 | 高 |
| **shiki** | ~200KB+（含主题和语言包） | 内置（TextMate 语法） | 慢（首次加载） | 少 | 低 |

### 包体积对比（gzip 后的实际传输大小）

```
marked + highlight.js   ████████░░░░░░░░░░░░  ~35KB gzipped
markdown-it + highlight  █████████░░░░░░░░░░░  ~40KB gzipped
remark (full setup)      ████████████████░░░░  ~80KB gzipped
shiki                    ██████████████████░░  ~100KB gzipped
```

### 为什么选择 marked + highlight.js？

在这个项目中，我们选择 `marked + highlight.js` 组合，原因如下：

1. **体积最小**：两者合计 gzip 后约 35KB，对首屏加载影响最小
2. **性能最好**：marked 的渲染速度在所有方案中最快，流式场景下每收到一个 chunk 都需要重新渲染，性能至关重要
3. **功能够用**：AI 回复主要用到 Markdown 的核心语法（标题、列表、代码块、粗体、链接），marked 全部支持
4. **highlight.js 语言覆盖广**：内置 300+ 种编程语言的语法高亮，覆盖 AI 回复中可能出现的所有代码语言
5. **API 简单**：`marked(text)` 一行代码就能用，不需要复杂的 unified pipeline 配置

**什么时候该换其他方案？**
- 需要自定义 Markdown 语法（如自定义容器、脚注）-> 换 `markdown-it`，它的插件系统更灵活
- 需要 AST 操作（如提取文章目录、修改链接）-> 换 `remark`，它提供完整的 AST 访问
- 对代码高亮的视觉效果要求极高（精确到每个 token 的颜色）-> 换 `shiki`，它使用 VS Code 的 TextMate 语法，效果最好

### 安全警告：XSS 风险与 v-html

代码中使用了 Vue 的 `v-html` 指令来渲染 Markdown 生成的 HTML：

```vue
<div v-html="renderedContent" />
```

**这是一个已知的安全风险**。`v-html` 会直接插入原始 HTML，如果 AI 回复中包含恶意脚本（比如 `<script>alert('xss')</script>`），就会执行。

在我们的场景中，风险相对可控：
- AI 模型本身不会主动生成恶意脚本
- 内容来源是受信任的 Claude API，不是用户输入

但在生产环境中，你应该额外做一层防护：

```typescript
import DOMPurify from 'dompurify'

const renderedContent = computed(() => {
  if (props.message.role === 'user') return props.message.content
  const rawHtml = marked(props.message.content)
  // 用 DOMPurify 过滤掉危险的 HTML 标签和属性
  return DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: ['pre', 'code'],  // 允许代码标签
    ADD_ATTR: ['class'],         // 允许 class 属性（用于语法高亮）
  })
})
```

安装 DOMPurify：

```bash
npm install dompurify
npm install -D @types/dompurify
```

---

## 第四步：创建首页

把 Chat 窗口放到首页上。

创建文件 `pages/index.vue`（如果不存在的话）：

```bash
mkdir -p pages
```

```vue
<!-- pages/index.vue -->
<script setup lang="ts">
import ChatWindow from '~/components/chat/ChatWindow.vue'
</script>

<template>
  <ChatWindow />
</template>
```

**完成这一步后你应该看到：**
- `pages/index.vue` 文件已创建

---

## 第五步：运行并测试

启动开发服务器：

```bash
npm run dev
```

打开浏览器访问 `http://localhost:3000`，你应该看到：
1. 左侧深色导航栏（上一节搭建的）
2. 右侧有一个聊天界面，底部有输入框
3. 第一条消息是 AI 的欢迎语："你好！我是 AI 文档助手，有什么可以帮你的？"

**测试对话功能：**
1. 在输入框中输入 "你好"，按回车
2. 你应该看到 AI 的回复**逐字出现**（流式输出，像打字一样）
3. 输入一段代码相关的问题，比如 "用 Vue 3 写一个计数器组件"
4. AI 回复中的代码块应该有语法高亮

**测试中断功能：**
1. 输入一个复杂问题，让 AI 开始回复
2. 在 AI 还在回复时，点击红色停止按钮
3. AI 应该停止生成，已生成的内容保留

### 卡住了？

| 问题 | 解决办法 |
|------|----------|
| 页面报错 `Cannot find module '@ai-sdk/vue'` | 运行 `npm install @ai-sdk/vue` 安装 |
| 输入后点发送没反应 | 检查浏览器控制台（F12），看有没有报错。确认 `server/api/chat.post.ts` 存在 |
| AI 回复是乱码或空白 | 检查 API Key 是否正确，用 curl 测试一下 API |
| 消息气泡不显示 | 确认 `components/chat/MessageBubble.vue` 文件路径正确 |
| 代码没有高亮 | 确认 `highlight.js` 已安装：`npm ls highlight.js` |
| 样式错乱 | 确认 `@tailwindcss/typography` 已安装，检查 Tailwind 配置 |
| 输入框禁用了 | 说明 `isLoading` 卡在 true，刷新页面重试 |

---

## 第六步：添加打字机光标效果

流式输出时，给 AI 回复加一个闪烁的光标，让用户知道 AI 还在"打字"。

在全局样式文件中添加以下 CSS。如果你还没有全局样式文件，创建 `assets/css/main.css`：

```bash
mkdir -p assets/css
```

```css
/* assets/css/main.css */

/* 打字机光标 */
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

在 `nuxt.config.ts` 中引入这个样式：

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    anthropicApiKey: '',
    public: {
      appName: 'AI Doc Assistant',
    },
  },
})
```

**完成这一步后你应该看到：**
- AI 回复时末尾有一个绿色的闪烁光标

---

## 成本控制

AI API 按 token 计费，不控制成本会收到意外账单。这一节帮你理解 token 计费逻辑，并给出实用的成本控制策略。

### 什么是 Token？

Token 是 AI 模型处理文本的基本单位。粗略换算：
- 英文：1 个 token 约等于 4 个字符，或 0.75 个单词
- 中文：1 个 token 约等于 1-2 个汉字（中文的 token 效率比英文低）

```
"Hello, world!"     -> 4 tokens
"你好，世界！"       -> 6 tokens
一段 1000 字的中文文章 -> 约 800-1200 tokens
```

### Claude API 定价（以 Claude Sonnet 4 为例）

| 计费项 | 价格 |
|--------|------|
| 输入 token | $3 / 百万 token |
| 输出 token | $15 / 百万 token |

注意：**输出 token 的单价是输入的 5 倍**。这意味着让 AI 生成长回复比发送长提示词贵得多。

### 如何估算一次对话的成本

一次完整的对话请求包含三部分 token 消耗：

```
总 token = 系统提示词 + 历史消息 + AI 回复
         (固定成本)    (随对话增长)   (输出成本)
```

**实际估算示例（10 轮对话）：**

```
系统提示词：     ~200 tokens（固定，每轮都算）
第 1 轮：用户 30 tokens + AI 200 tokens
第 2 轮：用户 20 tokens + AI 300 tokens + 前 2 轮历史 250 tokens
...
第 10 轮：用户 25 tokens + AI 400 tokens + 前 9 轮历史 ~2500 tokens

总输入 token（累计）：约 12,000 tokens
总输出 token（累计）：约 3,000 tokens

成本 = 12,000 × $3/1M + 3,000 × $15/1M
     = $0.036 + $0.045
     = $0.081（约 0.6 元人民币）
```

一个 10 轮的深度对话，成本不到 1 块钱。但如果并发用户多（比如 1000 人同时对话），成本就会变成 $81/轮，需要认真控制。

### maxTokens 策略：为什么是 4096？

代码中的 `maxTokens: 4096` 限制了 AI 单次回复的最大长度：

```typescript
const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  messages,
  maxTokens: 4096,  // 最多生成 4096 个 output token
})
```

**4096 是一个平衡点：**
- 太小（如 1024）：AI 回复会被截断，代码示例写不完
- 太大（如 16384）：AI 可能生成冗长回复，浪费 token 和用户时间
- 4096 约等于 3000 个中文字，足够回答大部分技术问题

**什么时候调整：**
- 代码生成场景（需要长代码）-> 提高到 8192
- 简单问答场景（FAQ、客服）-> 降低到 1024
- 翻译场景（输入输出长度接近）-> 设为输入长度的 1.5 倍

### 流式 vs 非流式：成本一样，体验不同

一个常见的误解：流式输出会不会更贵？

**答案：不会。** 流式和非流式消耗的 token 数完全相同，区别只在于数据的传输方式。

```
非流式：等 AI 生成完所有 token -> 一次性返回 -> 用户等待 10 秒
流式：  AI 每生成一个 token 就返回 -> 逐字显示 -> 用户 0.5 秒后就开始看到内容
```

两者消耗的 token 一模一样，计费也一模一样。但流式让用户的**感知等待时间**从 10 秒降到 0.5 秒，这是纯 UX 优化，不增加成本。

### 成本控制实战建议

1. **设置 maxTokens 上限**：防止单次请求消耗过多 output token
2. **限制历史消息轮数**：只发送最近 N 轮对话，而不是全部历史
3. **压缩系统提示词**：系统提示词每轮都算输入 token，越短越省
4. **监控用量**：Anthropic 控制台可以查看 API 用量和账单
5. **设置用量上限**：在 Anthropic 控制台设置月度预算上限，防止意外超支

```typescript
// 限制历史消息轮数的示例
const MAX_HISTORY_ROUNDS = 10

const trimmedMessages = messages.slice(-MAX_HISTORY_ROUNDS * 2)
// 每轮包含 1 条用户消息 + 1 条 AI 回复，所以乘 2

const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  system: systemPrompt,
  messages: trimmedMessages,
  maxTokens: 4096,
})
```

---

## 动手练习

完成了上面的步骤后，试试下面的练习来巩固知识：

**练习 1：自定义欢迎语**

修改 `ChatWindow.vue` 中的 `initialMessages`，把欢迎语改成你自己想要的内容。比如加上使用提示："你可以问我前端相关的问题，比如 React、Vue、CSS 等"。

**练习 2：添加重新生成按钮**

在 `MessageBubble.vue` 的操作栏中添加一个"重新生成"按钮。提示：
1. 从 `lucide-vue-next` 导入 `RotateCcw` 图标
2. 在复制按钮旁边添加一个按钮
3. 点击时 emit 一个 `regenerate` 事件

**练习 3：修改 AI 人设**

修改 `server/api/chat.post.ts` 中的 `system` 提示词，让 AI 变成一个别的角色。比如：
- 一个 Python 教学助手
- 一个产品经理，用中文回答技术问题
- 一个代码审查专家，专门挑代码问题

修改后重启服务器，对比 AI 回复风格的变化。

**练习 4：添加消息时间戳**

在 `MessageBubble.vue` 中，给每条消息添加一个发送时间。提示：在消息气泡下方用小号灰色文字显示当前时间。

---

**上一步：** [架构设计与项目初始化](/playground/01-architecture)
**下一步：** [RAG 知识库集成](/playground/03-rag-integration)
