---
title: Bug 排查 Prompt
description: 粘贴报错 + 相关代码，让 AI 定位根因并给出修复方案
tags: ['prompt', 'debugging', 'bug']
category: Prompt 库
---

# Bug 排查 Prompt

> 80% 的 Bug 可以通过正确的 Prompt 在 1 分钟内定位。

## 核心 Prompt 模板

```markdown
## 角色
你是一个资深前端调试专家，擅长 Vue 3 + Nuxt 3 + TypeScript 技术栈。

## 任务
分析以下报错信息，定位根因并给出修复方案。

## 报错信息
[粘贴完整的控制台报错]

## 相关代码
[粘贴报错相关的代码文件]

## 环境信息
- 框架版本：Nuxt 3.x / Vue 3.x
- 浏览器：Chrome 120+
- Node.js：22.x

## 要求
1. 分析报错的根本原因（不是表象）
2. 给出具体的修复代码
3. 列出 2-3 个可能的边界情况
4. 如果涉及异步操作，分析时序问题
```

## 实战示例

**输入：**

```markdown
## 报错信息
[Vue warn]: Unhandled error during execution of setup function
TypeError: Cannot read properties of undefined (reading 'data')

## 相关代码
```vue
<script setup lang="ts">
const route = useRoute()
const { data } = await useFetch(`/api/posts/${route.params.id}`)

const title = data.value.title // 报错行
</script>
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

边界情况：
1. 路由参数 `id` 为 undefined 时（直接访问 /api/posts/undefined）
2. API 返回 404 时 data 的结构
3. SSR 和 CSR 混合渲染时的 hydration mismatch

## 使用技巧

1. **报错信息要完整**：不要只贴 "xxx is undefined"，要贴完整的堆栈
2. **代码要包含上下文**：不要只贴报错行，要贴整个函数/组件
3. **说明复现条件**：是偶现还是必现？在什么操作下触发？
4. **附带网络请求**：如果是 API 相关，附上 Network 面板的请求/响应
