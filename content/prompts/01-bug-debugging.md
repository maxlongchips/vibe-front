---
title: Bug 排查 Prompt
description: 粘贴报错 + 相关代码，让 AI 定位根因并给出修复方案
tags: ['prompt', 'debugging', 'bug']
category: Prompt 库
---

# Bug 排查 Prompt

> 80% 的 Bug 可以通过正确的 Prompt 在 1 分钟内定位。

## 使用场景

什么时候该用这个 Prompt？当你遇到以下情况时：

- **控制台报红**：TypeError、ReferenceError、Uncaught Promise 等，不知道为什么报错
- **行为异常**：代码不报错但结果不对，比如数据没渲染、点击没反应、页面白屏
- **偶发 Bug**：时好时坏，开发环境没问题但线上出错
- **SSR 问题**：Hydration mismatch、服务端和客户端渲染结果不一致
- **异步 Bug**：请求顺序错乱、竞态条件、数据加载时序问题

**不适合的场景**：纯 CSS 样式问题（用 UI 生成 Prompt 更合适）、代码审查（用 code-review 工具）。

## Prompt 模板

### 模板 1：简单 Bug（直接粘贴报错）

适合：TypeScript 类型错误、undefined 错误、导入路径错误等一眼能看出问题的 Bug。

```
[直接粘贴完整的控制台报错信息，包括堆栈]
```

就这么简单。AI 能从错误信息中推断出上下文并给出修复建议。

### 模板 2：结构化 Bug 排查（五层架构版）

适合：复杂 Bug、多文件 Bug、生产环境问题、偶发问题。

```
## 第 1 层：上下文
技术栈：[你的技术栈，如 Nuxt 3 + Vue 3 + TypeScript strict]
运行环境：[浏览器版本 / Node.js 版本]
项目类型：[项目类型简述]

## 第 2 层：问题描述
[用一句话描述问题现象，如"用户列表页点击翻页后数据没更新"]

## 第 3 层：报错信息
[粘贴完整的控制台报错，包括堆栈。如果没有报错，写"无控制台报错"]

## 第 4 层：相关代码
[粘贴报错相关的代码文件，包含上下文]
[说明这段代码如何与系统其他部分交互]

## 第 5 层：补充信息
- 复现条件：[必现 / 偶现，在什么操作下触发]
- 已尝试方案：[你已经试过什么，避免 AI 重复]
- 环境差异：[开发和生产环境有什么不同]

## 输出要求
1. 根因分析（不是表象，是底层原因）
2. 具体的修复代码
3. 2-3 个可能的边界情况
4. 修复后的验证步骤
```

### Think 关键词用法

对于难以定位的 Bug，在 Prompt 开头加上关键词触发深度推理：

```
ultrathink: [粘贴上面的结构化 Prompt]
```

适用场景：生产环境偶发 Bug、竞态条件、内存泄漏、SSR hydration 不匹配。

## 实战示例

### 示例 1：简单 Bug

**你输入：**

```
[Vue warn]: Unhandled error during execution of setup function
TypeError: Cannot read properties of undefined (reading 'data')
  at setup (UserProfile.vue:15:23)
  at callWithErrorHandling (runtime-core.esm-bundler.js:199:19)
```

**AI 输出：**

根因：`useFetch` 返回的 `data` 在 SSR 模式下初始值为 `null`，首次渲染时 `data.value` 还未赋值，你直接访问了 `data.value.data`。

修复方案：

```vue
<script setup lang="ts">
const route = useRoute()
const { data } = await useFetch(`/api/posts/${route.params.id}`)

// 方案 1：可选链 + 空值合并（推荐）
const title = computed(() => data.value?.title ?? '')

// 方案 2：模板中条件渲染
// <div v-if="data">{{ data.title }}</div>
</script>
```

验证步骤：
1. 重新运行 `npm run dev`
2. 访问一个存在的文章页面，确认标题正常显示
3. 访问一个不存在的文章页面，确认不会报错

### 示例 2：复杂 Bug（需要五层架构）

**你输入：**

```markdown
## 第 1 层：上下文
技术栈：Nuxt 3 + Vercel AI SDK + Vue 3
运行环境：Chrome 120+ / Node.js 22.x
项目类型：AI 驱动的在线客服系统

## 第 2 层：问题描述
流式对话功能出现三个问题：
1. 有时 AI 回答到一半就停了
2. 有时同一个问题回答两次
3. 偶尔出现 "Network Error"

## 第 3 层：报错信息
无控制台报错，只有用户反馈。

## 第 4 层：相关代码
[server/api/chat.post.ts]
export default defineEventHandler(async (event) => {
  const { messages } = await readBody(event)
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    messages,
    maxTokens: 4096,
  })
  return result.toDataStreamResponse()
})

[前端 useChat 配置]
const { messages, input, handleSubmit } = useChat({
  api: '/api/chat',
})

## 第 5 层：补充信息
- 复现条件：高并发时更容易出现（5+ 用户同时对话）
- 已尝试方案：未尝试任何方案
- 环境差异：开发环境单用户测试无问题

## 输出要求
1. 根因分析（不是表象，是底层原因）
2. 具体的修复代码
3. 2-3 个可能的边界情况
4. 修复后的验证步骤
```

**AI 输出：**

根因分析：
1. **"回答到一半停了"** — `maxTokens` 设置为 4096，长回答被截断。AI 客服的回答通常包含代码示例，容易超过限制。
2. **"同一个问题回答两次"** — 前端 `handleSubmit` 没有防重复提交，用户快速点击或网络延迟时会触发两次请求。
3. **"Network Error"** — 没有超时重试机制，Vercel 函数默认 10 秒超时，长回答可能超时。

修复方案：

```typescript
// server/api/chat.post.ts
export default defineEventHandler(async (event) => {
  const { messages } = await readBody(event)
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    messages,
    maxTokens: 8192,  // 从 4096 增加到 8192
  })
  return result.toDataStreamResponse()
})

// 前端：防重复提交 + 错误重试
const { messages, input, handleSubmit, isLoading } = useChat({
  api: '/api/chat',
  onError: (err) => {
    if (err.message.includes('timeout') || err.message.includes('Network')) {
      // 自动重试一次
      setTimeout(() => handleSubmit(new Event('submit')), 1000)
    }
  },
})

// 防重复提交：在模板中
// <button :disabled="isLoading" @click="handleSubmit">发送</button>
```

边界情况：
1. 用户在网络不稳定环境下对话
2. AI 回答特别长（超过 8192 tokens）
3. 多标签页同时打开同一个对话

验证步骤：
1. 模拟慢网络（Chrome DevTools → Network → Slow 3G），发送一条消息，确认不出现截断
2. 快速连续点击发送按钮，确认只发出一次请求
3. 使用长文本测试，确认超过限制时有优雅降级

## 使用技巧

1. **报错信息要完整**：不要只贴 `xxx is undefined`，要贴完整的堆栈信息，包括文件名和行号
2. **代码要包含上下文**：不要只贴报错的那一行，要贴整个函数或组件，让 AI 理解前后逻辑
3. **说明复现条件**：是偶现还是必现？在什么操作下触发？这能帮助 AI 缩小排查范围
4. **附带网络请求**：如果是 API 相关 Bug，附上浏览器 Network 面板的请求/响应数据
5. **说明已尝试方案**：告诉 AI 你已经试过什么，避免它重复建议你已经排除的方向
6. **说明环境差异**：开发环境和生产环境有什么不同（域名、Node 版本、环境变量等）

## 变体

### 变体 1：链式 Debugging（分步排查）

对于特别复杂的 Bug，不要一步到位，拆成多步：

```
步骤 1：只分析报错信息，列出 3 个最可能的原因
```

等 AI 回复后，你提供相关代码，继续：

```
步骤 2：这是相关代码 [粘贴代码]，请缩小到 1 个最可能的原因
```

确认方向正确后：

```
步骤 3：确认是这个原因，请给出修复代码和验证步骤
```

每一步都比一步到位更精准，和人类 debug 的过程一样 — 先缩小范围，再定位根因。

### 变体 2：让 AI 先解释再修复

一个被低估的技巧：要求 AI 在修复前先解释 Bug 的成因。

```
不要直接给我修复代码。先用简单的语言解释这个 Bug 是怎么发生的，
我确认你的理解是对的之后，再给修复代码。
```

这能强制 AI 进行推理（Chain-of-Thought），而不是直接跳到可能错误的修复方案。适合你不确定 Bug 根因时使用。

### 变体 3：生产环境专属排查

```
这个 Bug 只在生产环境出现，开发环境无法复现。
请分析以下可能的原因：
1. SSR hydration 不匹配
2. 环境变量差异
3. CDN 缓存问题
4. 浏览器兼容性
5. 第三方服务超时

针对每种可能，给出排查步骤和修复方案。
```
