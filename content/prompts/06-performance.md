---
title: 性能优化 Prompt
description: 输入性能瓶颈描述，AI 分析并给出懒加载、虚拟滚动、缓存策略等具体优化方案
tags: ['prompt', 'performance', 'optimization', 'vue']
category: Prompt 库
---

# 性能优化 Prompt

> 性能优化不是猜，是量。先量化问题，再对症下药。

## 使用场景

什么时候该用这个 Prompt？当你遇到以下情况时：

- **页面卡顿**：列表滚动掉帧、输入框打字延迟、动画不流畅
- **加载缓慢**：首屏白屏时间长、Lighthouse 分数低、用户反馈"太慢了"
- **内存泄漏**：页面长时间使用后越来越卡，刷新后恢复
- **API 慢**：页面有多个 API 串行调用，总耗时过长
- **Bundle 过大**：打包后 JS 文件太大，首屏加载时间超标

**不适合的场景**：后端性能问题（数据库慢查询、服务器负载高）、网络问题（带宽不足）。

## Prompt 模板

### 模板 1：结构化性能分析

```
## 角色
你是一个前端性能优化专家，精通 Vue 3、Nuxt 3 和浏览器渲染机制。

## 任务
分析以下性能问题，给出具体的优化方案和代码。

## 问题描述
[描述性能问题：卡顿、加载慢、内存泄漏等]

## 性能数据
[附上 Lighthouse 分数、Performance 面板数据、内存占用等量化数据]
[如果没有量化数据，写"暂无量化数据"]

## 相关代码
[粘贴性能瓶颈相关的代码]

## 技术栈
- 框架：[Nuxt 3 / Vue 3]
- 构建：[Vite]
- 部署：[Vercel / Cloudflare / 自建服务器]

## 输出要求
1. 分析性能瓶颈的根本原因（不是表象）
2. 给出优化方案（按优先级排序，先做投入产出比最高的）
3. 每个方案附带具体代码
4. 预估优化后的性能提升
```

### 模板 2：快速诊断

适合：不确定问题在哪，需要 AI 帮忙定位。

```
我的页面性能有问题，请帮我诊断：
- 现象：[描述具体症状]
- 技术栈：[你的技术栈]
- 页面 URL：[如果是线上页面]
- 相关代码：[贴可疑的代码片段]

请列出最可能的 3 个原因，按可能性排序，并给出每个原因的排查步骤。
```

### Think 关键词用法

对于复杂的系统性性能问题，触发深度推理：

```
ultrathink: 这个页面有 50 个组件，首屏加载 4 秒。
请系统性分析可能的性能瓶颈：
1. JS Bundle 大小
2. 组件渲染顺序和懒加载
3. API 请求串行 vs 并行
4. 图片和静态资源优化
5. SSR/Hydration 开销
给出按优先级排序的优化方案，每个方案附带代码。
```

## 实战示例

### 示例 1：长列表卡顿

**你输入：**

```
## 角色
你是一个前端性能优化专家。

## 任务
分析以下性能问题，给出具体的优化方案和代码。

## 问题描述
渲染 10000 条数据的列表，滚动明显卡顿，帧率只有 15fps 左右。

## 相关代码
<template>
  <div class="h-[600px] overflow-auto">
    <div v-for="item in items" :key="item.id" class="p-4 border-b">
      <h3>{{ item.title }}</h3>
      <p>{{ item.content }}</p>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  items: Array // 10000 条数据
})
</script>

## 技术栈
- 框架：Nuxt 3 + Vue 3
- 构建：Vite

## 输出要求
1. 分析根本原因
2. 给出优化方案和代码
3. 预估优化效果
```

**AI 输出：**

根本原因：一次性渲染 10000 个 DOM 节点，每个节点包含多个子元素，浏览器需要计算布局、绘制所有节点，导致重排重绘开销巨大。

优化方案：虚拟滚动（Virtual Scroll），只渲染可视区域内的 DOM 节点。

```vue
<script setup lang="ts">
import { useVirtualizer } from '@tanstack/vue-virtual'

const props = defineProps<{
  items: Array<{ id: number; title: string; content: string }>
}>()

const parentRef = ref<HTMLElement | null>(null)

const virtualizer = useVirtualizer({
  count: props.items.length,
  getScrollElement: () => parentRef.value,
  estimateSize: () => 80, // 每行预估高度
  overscan: 5, // 预渲染上下各 5 行（防止快速滚动白屏）
})

const virtualItems = computed(() => virtualizer.value.getVirtualItems())
</script>

<template>
  <div ref="parentRef" class="h-[600px] overflow-auto">
    <div
      class="relative w-full"
      :style="{ height: `${virtualizer.value.getTotalSize()}px` }"
    >
      <div
        v-for="item in virtualItems"
        :key="item.key"
        class="absolute top-0 left-0 w-full"
        :style="{
          height: `${item.size}px`,
          transform: `translateY(${item.start}px)`
        }"
      >
        <div class="p-4 border-b border-zinc-800">
          <h3 class="text-zinc-100">{{ items[item.index].title }}</h3>
          <p class="text-zinc-400 text-sm">{{ items[item.index].content }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
```

安装依赖：

```bash
npm install @tanstack/vue-virtual
```

预估提升：
- DOM 节点数：10000 → ~20（只渲染可视区域 + overscan）
- 滚动帧率：~15fps → 60fps
- 内存占用：大幅降低

### 示例 2：首屏加载慢

**你输入：**

```
问题：Lighthouse Performance 分数只有 45，LCP 4.2s
当前实现：所有组件在首页一次性加载
技术栈：Nuxt 3 + Vue 3 + Vite

请给出具体的优化方案和代码。
```

**AI 输出：**

根因分析：首屏加载了大量非首屏组件（图表、评论区、侧边栏），JS Bundle 过大，阻塞了首屏渲染。

优化方案组合（按优先级排序）：

**方案 1：懒加载非首屏组件**

```vue
<script setup lang="ts">
// 1. 懒加载非首屏组件
const HeavyChart = defineAsyncComponent(() =>
  import('./components/HeavyChart.vue')
)

const CommentSection = defineAsyncComponent(() =>
  import('./components/CommentSection.vue')
)

// 2. Intersection Observer 控制何时加载
const chartRef = ref<HTMLElement | null>(null)
const commentsRef = ref<HTMLElement | null>(null)
const chartVisible = ref(false)
const commentsVisible = ref(false)

onMounted(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (entry.target === chartRef.value) chartVisible.value = true
          if (entry.target === commentsRef.value) commentsVisible.value = true
        }
      })
    },
    { rootMargin: '200px' } // 提前 200px 开始加载
  )

  if (chartRef.value) observer.observe(chartRef.value)
  if (commentsRef.value) observer.observe(commentsRef.value)
})
</script>

<template>
  <!-- 首屏内容：直接渲染 -->
  <HeroSection />
  <ArticleContent />

  <!-- 非首屏：进入可视区域才加载 -->
  <div ref="chartRef">
    <HeavyChart v-if="chartVisible" />
    <div v-else class="h-[400px] bg-zinc-900 animate-pulse rounded-lg" />
  </div>

  <div ref="commentsRef">
    <CommentSection v-if="commentsVisible" />
    <div v-else class="h-[300px] bg-zinc-900 animate-pulse rounded-lg" />
  </div>
</template>
```

**方案 2：Nuxt 配置优化**

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true, // 提取 payload，减少 hydration 数据
  },
  nitro: {
    compressPublicAssets: true, // 压缩静态资源
  },
  // 路由级别代码分割
  routeRules: {
    '/dashboard': { prerender: true },
    '/api/**': { cors: true },
  },
})
```

**方案 3：图片优化**

```vue
<template>
  <!-- 使用 Nuxt Image 自动优化 -->
  <NuxtImg
    src="/hero.jpg"
    width="1200"
    height="600"
    loading="eager"
    format="webp"
    quality="80"
    alt="首页图片"
  />
</template>
```

预估提升：
- LCP：4.2s → 1.8s
- JS Bundle：减少 40%（非首屏组件不再阻塞）
- Lighthouse Performance：45 → 80+

### 示例 3：API 串行调用慢

**你输入：**

```
问题：页面有 5 个 API 调用，串行执行，总耗时 3s+
每个 API 平均耗时 600ms，但它们之间没有依赖关系
请给出并行请求的方案。
```

**AI 输出：**

方案：将串行请求改为并行请求，使用 `Promise.allSettled`。

```typescript
// composables/useParallelFetch.ts
export function useParallelFetch<T extends Record<string, unknown>>(
  fetchers: { [K in keyof T]: () => Promise<T[K]> }
) {
  const data = ref<T>({} as T)
  const loading = ref(true)
  const errors = ref<Record<string, Error>>({})

  onMounted(async () => {
    const keys = Object.keys(fetchers) as Array<keyof T>
    const results = await Promise.allSettled(
      keys.map(key => fetchers[key]())
    )

    results.forEach((result, index) => {
      const key = keys[index]
      if (result.status === 'fulfilled') {
        (data.value as any)[key] = result.value
      } else {
        errors.value[key as string] = result.reason
        console.error(`[useParallelFetch] ${String(key)} failed:`, result.reason)
      }
    })

    loading.value = false
  })

  return { data, loading, errors }
}

// 使用示例
const { data, loading, errors } = useParallelFetch({
  user: () => $fetch('/api/user'),
  posts: () => $fetch('/api/posts'),
  stats: () => $fetch('/api/stats'),
  notifications: () => $fetch('/api/notifications'),
  settings: () => $fetch('/api/settings'),
})

// data.value.user、data.value.posts 等都有完整类型
// 单个请求失败不影响其他请求
```

如果使用 Nuxt 3，更简单的方案：

```vue
<script setup lang="ts">
// Nuxt 3 的 useAsyncData 支持并行
const { data: user } = await useAsyncData('user', () => $fetch('/api/user'))
const { data: posts } = await useAsyncData('posts', () => $fetch('/api/posts'))
const { data: stats } = await useAsyncData('stats', () => $fetch('/api/stats'))

// Nuxt 会自动并行执行这三个请求
</script>
```

预估提升：
- 总耗时：3s（串行）→ 800ms（并行，取决于最慢的单个请求）
- 提升幅度：约 73%

## 使用技巧

1. **先量化再优化**：附上 Performance 面板数据、Lighthouse 分数、内存占用等量化数据。不要说"页面很慢"，要说"LCP 4.2s，Performance 分数 45"
2. **说明瓶颈类型**：是渲染瓶颈（卡顿）、网络瓶颈（加载慢）还是计算瓶颈（JS 执行慢）？不同类型不同策略
3. **说明优化目标**：要首屏快还是交互流畅？不同目标不同策略。首屏快优先做懒加载，交互流畅优先做虚拟滚动
4. **要求可衡量**：让 AI 给出优化前后的对比指标，比如"LCP 从 4.2s 降到 1.8s"
5. **要求渐进式优化**：先做投入产出比最高的优化，不要一次性改太多。改一个验证一个

## 变体

### 变体 1：链式性能优化

对于复杂性能问题，拆成链式调用：

```
步骤 1：分析以下 Performance 面板数据，列出 Top 3 性能瓶颈
[贴 Performance 面板截图或数据]
```

确认瓶颈后：

```
步骤 2：针对第一个瓶颈，给出优化方案和代码
```

验证效果后：

```
步骤 3：优化后 LCP 从 4.2s 降到 2.5s，请继续分析下一个瓶颈
```

```
步骤 4：综合评估整体提升，给出剩余优化建议
```

### 变体 2：Bundle 体积分析

```
我的打包产物太大，请帮我分析并优化：

当前打包大小：
[贴 build 输出或 bundle 分析结果]

技术栈：Nuxt 3 + Vite

请分析：
1. 哪些依赖占用了最多空间
2. 有哪些可以 tree-shake 的
3. 有哪些可以动态导入的
4. 给出优化后的配置
```

### 变体 3：内存泄漏排查

```
页面长时间使用后越来越卡，怀疑有内存泄漏。

相关代码：
[贴可疑的代码片段]

可疑行为：
1. 页面打开 10 分钟后明显变卡
2. 切换页面再回来，内存没有释放
3. 关闭弹窗后，弹窗里的数据还在内存中

请分析可能的内存泄漏原因，给出修复代码。
```
