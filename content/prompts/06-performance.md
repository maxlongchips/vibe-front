---
title: 性能优化 Prompt
description: 输入性能瓶颈描述，AI 分析并给出懒加载、虚拟滚动、缓存策略等具体优化方案
tags: ['prompt', 'performance', 'optimization', 'vue']
category: Prompt 库
---

# 性能优化 Prompt

> 性能优化不是猜，是量。先量化问题，再对症下药。

## 核心 Prompt 模板

```markdown
## 角色
你是一个前端性能优化专家，精通 Vue 3、Nuxt 3 和浏览器渲染机制。

## 任务
分析以下性能问题，给出具体的优化方案和代码。

## 问题描述
[描述性能问题：卡顿、加载慢、内存泄漏等]

## 性能数据
[附上 Lighthouse 分数、Performance 面板截图、内存占用等量化数据]

## 相关代码
[粘贴性能瓶颈相关的代码]

## 技术栈
- 框架：Nuxt 3 / Vue 3
- 构建：Vite
- 部署：Vercel / Cloudflare

## 输出要求
1. 分析性能瓶颈的根本原因
2. 给出优化方案（按优先级排序）
3. 每个方案附带具体代码
4. 预估优化后的性能提升
```

## 场景 1：长列表卡顿

**输入：**

```markdown
问题：渲染 10000 条数据的列表，滚动明显卡顿
当前实现：直接 v-for 渲染所有数据
```

**AI 输出：**

根因：一次性渲染 10000 个 DOM 节点，浏览器重排重绘开销巨大。

方案：虚拟滚动（只渲染可视区域的 DOM）

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
  overscan: 5, // 预渲染上下各 5 行
})

const virtualItems = virtualizer.value.getVirtualItems()
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

预估提升：滚动帧率从 ~15fps → 60fps，DOM 节点从 10000 → ~20。

## 场景 2：首屏加载慢

**输入：**

```markdown
问题：Lighthouse Performance 分数只有 45，LCP 4.2s
当前实现：所有组件在首页一次性加载
```

**AI 输出：**

根因：首屏加载了大量非首屏组件，JS Bundle 过大。

方案组合：

```vue
<script setup lang="ts">
// 1. 懒加载非首屏组件
const HeavyChart = defineAsyncComponent(() =>
  import('./components/HeavyChart.vue')
)

const CommentSection = defineAsyncComponent(() =>
  import('./components/CommentSection.vue')
)
</script>

<template>
  <!-- 首屏内容：直接渲染 -->
  <HeroSection />
  <ArticleContent />

  <!-- 非首屏：Intersection Observer 触发加载 -->
  <LazyHeavyChart v-if="chartVisible" />
  <LazyCommentSection v-if="commentsVisible" />
</template>
```

```typescript
// composables/useLazyVisible.ts
export function useLazyVisible(threshold = 0.1) {
  const isVisible = ref(false)
  const target = ref<HTMLElement | null>(null)

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        isVisible.value = true
        observer.disconnect()
      }
    },
    { threshold }
  )

  onMounted(() => {
    if (target.value) observer.observe(target.value)
  })

  onUnmounted(() => observer.disconnect())

  return { target, isVisible }
}
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true, // 提取 payload，减少 hydration 数据
  },
  nitro: {
    compressPublicAssets: true, // 压缩静态资源
  },
})
```

预估提升：LCP 4.2s → 1.8s，JS Bundle 减少 40%。

## 场景 3：API 响应慢

**输入：**

```markdown
问题：页面有 5 个 API 调用，串行执行，总耗时 3s+
```

**AI 输出：**

方案：并行请求 + 缓存 + SWR

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
      }
    })

    loading.value = false
  })

  return { data, loading, errors }
}

// 使用
const { data, loading } = useParallelFetch({
  user: () => $fetch('/api/user'),
  posts: () => $fetch('/api/posts'),
  stats: () => $fetch('/api/stats'),
  notifications: () => $fetch('/api/notifications'),
  settings: () => $fetch('/api/settings'),
})
```

预估提升：总耗时从 3s（串行）→ 800ms（并行）。

## 使用技巧

1. **先量化再优化**：附上 Performance 面板数据，不要凭感觉
2. **说明瓶颈类型**：是渲染瓶颈、网络瓶颈还是计算瓶颈？
3. **说明优化目标**：要首屏快还是交互流畅？不同目标不同策略
4. **要求可衡量**：让 AI 给出优化前后的对比指标
