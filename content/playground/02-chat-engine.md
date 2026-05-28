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
