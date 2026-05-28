---
title: Bug 排查 Prompt
description: 粘贴报错 + 相关代码，让 AI 定位根因并给出修复方案
tags: ['prompt', 'debugging', 'bug']
category: Prompt 库
---

# Bug 排查 Prompt

> 80% 的 Bug 可以通过正确的 Prompt 在 1 分钟内定位。

## 两种 Debugging 哲学

### 哲学 1：Karpathy 式 — 直接粘贴报错

Andrej Karpathy 的方法 — 直接粘贴错误信息，不加任何解释：

```
[粘贴完整的错误信息]
```

他声称"通常这样就能修复"。这在简单 Bug 上确实有效，因为 LLM 能从错误信息中推断出上下文。

**适用场景：** TypeScript 类型错误、简单的 undefined 错误、导入路径错误。
**不适用：** 竞态条件、内存泄漏、SSR hydration 不匹配。

### 哲学 2：五层架构式 — 结构化上下文

来自 Stanford HAI 的研究：使用结构化 Prompt 模板的开发者，首次代码准确率比随意提问高 **60%**。

```markdown
## 第 1 层：上下文
技术栈：Nuxt 3 + Vue 3 + TypeScript strict + Vercel AI SDK
运行环境：Chrome 120+ / Node.js 22.x
项目类型：AI 驱动的前端应用

## 第 2 层：任务
分析以下报错信息，定位根因并给出修复方案。

## 第 3 层：报错信息
[粘贴完整的控制台报错，包括堆栈]

## 第 4 层：相关代码
[粘贴报错相关的代码文件，包含上下文]
[说明这段代码如何与系统其他部分交互]

## 第 5 层：输出要求
1. 根因分析（不是表象，是底层原因）
2. 具体的修复代码
3. 2-3 个可能的边界情况
4. 如果涉及异步操作，分析时序问题
5. 修复后的验证步骤
```

**适用场景：** 复杂的多文件 Bug、生产环境问题、性能相关的 Bug。

## 实战示例

### 示例 1：简单 Bug（Karpathy 式就够）

**输入：**

```
[Vue warn]: Unhandled error during execution of setup function
TypeError: Cannot read properties of undefined (reading 'data')
```

**AI 输出：**

根因：`useFetch` 返回的 `data` 在 SSR 模式下初始值为 `null`，首次渲染时 `data.value` 还未赋值。

修复：

```vue
<script setup lang="ts">
const route = useRoute()
const { data } = await useFetch(`/api/posts/${route.params.id}`)

// 方案 1：可选链
const title = computed(() => data.value?.title ?? '')

// 方案 2：条件渲染（模板中）
// <div v-if="data">{{ data.title }}</div>
</script>
```

### 示例 2：复杂 Bug（需要五层架构）

**输入：**

```markdown
## 上下文
Nuxt 3 + Vercel AI SDK，流式对话功能

## 报错信息
没有控制台报错，但用户反馈：
- 有时 AI 回答到一半就停了
- 有时同一个问题回答两次
- 偶尔出现 "Network Error"

## 相关代码
[server/api/chat.post.ts 和前端 useChat 配置]

## 复现条件
高并发时更容易出现（5+ 用户同时对话）
```

**AI 输出：**

根因分析：
1. "回答到一半停了" — `maxTokens` 设置太小，长回答被截断
2. "同一个问题回答两次" — 前端 `handleSubmit` 没有防重复提交
3. "Network Error" — 没有超时重试机制

修复方案：
```typescript
// 服务端：增加 maxTokens + 超时处理
const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  messages,
  maxTokens: 8192,  // 从 4096 增加到 8192
})

// 前端：防重复提交
const { messages, input, handleSubmit, isLoading } = useChat({
  api: '/api/chat',
  onError: (err) => {
    if (err.message.includes('timeout')) {
      // 自动重试一次
      handleSubmit(new Event('submit'))
    }
  },
})
```

## 高级技巧

### Think 关键词：复杂 Bug 的杀手锏

对于难以定位的 Bug，触发 Claude 的深度推理：

```
ultrathink: 这个 Bug 只在生产环境出现，开发环境无法复现。
可能是 SSR hydration 不匹配、时序问题、或环境变量差异。
请逐步分析每种可能性，并给出排查步骤。
```

### 链式 Debugging

对于复杂问题，拆成多步：

```
步骤 1：只分析报错信息，列出 3 个最可能的原因
步骤 2：我提供相关代码，你缩小到 1 个原因
步骤 3：给出修复代码和验证步骤
```

每一步都比一步到位更精准。这和人类 debug 的过程一样 — 先缩小范围，再定位根因。

### 让 AI 先解释再修复

一个被低估的技巧：要求 AI 在修复前先解释 Bug。

```
不要直接给我修复代码。先解释这个 Bug 是怎么发生的，
用 5 岁小孩能听懂的方式。然后我确认你的理解是对的，
再给修复代码。
```

这强制 AI 进行推理（Chain-of-Thought），而不是直接跳到可能错误的修复。

## 使用技巧

1. **报错信息要完整**：不要只贴 "xxx is undefined"，要贴完整的堆栈
2. **代码要包含上下文**：不要只贴报错行，要贴整个函数/组件
3. **说明复现条件**：是偶现还是必现？在什么操作下触发？
4. **附带网络请求**：如果是 API 相关，附上 Network 面板的请求/响应
5. **说明已尝试的方案**：避免 AI 重复你已经试过的方法
6. **说明环境差异**：开发环境和生产环境有什么不同？
