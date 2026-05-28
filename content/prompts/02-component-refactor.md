---
title: 组件重构 Prompt
description: 输入一个屎山组件，AI 输出 Composition API 重构版本，自动拆分 composables
tags: ['prompt', 'refactor', 'vue3', 'composition-api']
category: Prompt 库
---

# 组件重构 Prompt

> 好的重构不是"换种写法"，而是提升可维护性和可复用性。

## 使用场景

什么时候该用这个 Prompt？当你遇到以下情况时：

- **屎山组件**：一个 `.vue` 文件超过 300 行，逻辑混杂在一起，看不懂也不想看
- **Options API 遗留代码**：项目从 Vue 2 迁移过来，到处是 `this.xxx`，想改成 Composition API
- **逻辑重复**：多个组件里有相似的数据获取、表单验证、分页逻辑，想提取成 composables
- **类型缺失**：组件全是 `any`，没有 TypeScript 类型，想补上类型
- **样式混乱**：scoped style 和 Tailwind 混用，想统一成 Tailwind CSS

**不适合的场景**：组件本身很简单（少于 50 行）、需要大改业务逻辑（这不是重构，是重写）。

## Prompt 模板

### 模板 1：基础重构

```
## 角色
你是一个 Vue 3 Composition API 重构专家。

## 任务
将以下组件重构为 Composition API + <script setup> 风格。

## 重构要求
1. 将 Options API 转为 <script setup>
2. 使用 TypeScript 强类型（定义 Props 和 Emits 的 interface）
3. 保持功能完全一致（不能改业务逻辑）
4. 使用 Tailwind CSS 替代 scoped style（如果有）

## 原始代码
[粘贴需要重构的组件代码]

## 输出格式
1. 重构后的完整组件代码
2. 重构说明：做了哪些改动，为什么
```

### 模板 2：深度重构 + Composables 提取

适合：大组件需要拆分成多个 composable 的场景。

```
## 角色
你是一个 Vue 3 Composition API 重构专家。

## 任务
将以下组件重构，并提取可复用的 composables。

## 重构要求
1. 将 Options API 转为 <script setup>
2. 提取可复用逻辑到 composables/ 目录
3. 使用 TypeScript 强类型
4. 保持功能完全一致
5. 使用 Tailwind CSS 替代 scoped style

## 组件使用场景
[说明这个组件在哪里用、被谁调用，帮助 AI 做更好的拆分决策]

## 原始代码
[粘贴需要重构的组件代码]

## 输出格式
1. 重构后的组件代码
2. 每个提取出的 composable 代码（独立文件）
3. 重构说明：做了哪些改动，提取了哪些逻辑，为什么
```

### Think 关键词用法

对于特别复杂的大型组件（500 行以上），触发深度推理：

```
ultrathink: 这个组件有 500 行，包含用户认证、数据获取、表单验证、
和复杂的 UI 状态管理。请先分析逻辑依赖关系图，再给出最优的拆分方案。
```

## 实战示例

**你输入：**

```
## 角色
你是一个 Vue 3 Composition API 重构专家。

## 任务
将以下组件重构为 Composition API + <script setup> 风格，并提取可复用的 composables。

## 重构要求
1. 将 Options API 转为 <script setup>
2. 提取可复用逻辑到 composables/
3. 使用 TypeScript 强类型
4. 保持功能完全一致
5. 使用 Tailwind CSS 替代 scoped style

## 原始代码
<script>
export default {
  data() {
    return {
      users: [],
      loading: false,
      search: '',
      page: 1,
      totalPages: 1
    }
  },
  async created() {
    await this.fetchUsers()
  },
  methods: {
    async fetchUsers() {
      this.loading = true
      const res = await fetch(`/api/users?page=${this.page}&q=${this.search}`)
      const data = await res.json()
      this.users = data.users
      this.totalPages = data.totalPages
      this.loading = false
    },
    async onSearch() {
      this.page = 1
      await this.fetchUsers()
    },
    async nextPage() {
      if (this.page < this.totalPages) {
        this.page++
        await this.fetchUsers()
      }
    }
  }
}
</script>

<template>
  <div class="user-list">
    <input v-model="search" @input="onSearch" placeholder="搜索用户..." />
    <div v-if="loading">加载中...</div>
    <ul v-else>
      <li v-for="user in users" :key="user.id">{{ user.name }}</li>
    </ul>
    <button @click="nextPage">下一页</button>
  </div>
</template>
```

**AI 输出：**

重构后的组件代码：

```vue
<!-- UserList.vue -->
<script setup lang="ts">
const search = ref('')
const url = computed(() => `/api/users?q=${search.value}`)
const { data: users, loading, page, totalPages, nextPage, resetPage } = usePaginatedFetch<User>(url)

// 初始化加载
await resetPage()

// 搜索时重置页码并重新加载
let searchTimer: ReturnType<typeof setTimeout>
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(resetPage, 300) // 防抖 300ms
})
</script>

<template>
  <div class="space-y-4">
    <input
      v-model="search"
      placeholder="搜索用户..."
      class="w-full px-4 py-2 rounded-lg bg-zinc-800 text-zinc-100
             border border-zinc-700 focus:border-emerald-500 focus:outline-none"
    />
    <div v-if="loading" class="text-zinc-400">加载中...</div>
    <ul v-else class="space-y-2">
      <li
        v-for="user in users"
        :key="user.id"
        class="px-4 py-2 bg-zinc-900 rounded-lg text-zinc-100"
      >
        {{ user.name }}
      </li>
    </ul>
    <button
      @click="nextPage"
      :disabled="page >= totalPages"
      class="px-4 py-2 rounded-lg bg-emerald-600 text-white
             disabled:opacity-50 disabled:cursor-not-allowed"
    >
      下一页
    </button>
  </div>
</template>
```

提取的 composable：

```typescript
// composables/usePaginatedFetch.ts
interface PaginatedResponse<T> {
  data: T[]
  totalPages: number
}

export function usePaginatedFetch<T>(url: Ref<string>) {
  const data = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const page = ref(1)
  const totalPages = ref(1)

  async function fetch() {
    loading.value = true
    try {
      const separator = url.value.includes('?') ? '&' : '?'
      const fullUrl = `${url.value}${separator}page=${page.value}`
      const res = await $fetch<PaginatedResponse<T>>(fullUrl)
      data.value = res.data
      totalPages.value = res.totalPages
    } finally {
      loading.value = false
    }
  }

  function nextPage() {
    if (page.value < totalPages.value) {
      page.value++
      fetch()
    }
  }

  function resetPage() {
    page.value = 1
    fetch()
  }

  return { data, loading, page, totalPages, fetch, nextPage, resetPage }
}
```

重构说明：
1. **Options API → script setup**：去掉了 `this.xxx`，改用 `ref()` 和 `computed()`
2. **提取 composable**：分页逻辑（fetch、翻页、重置）提取到 `usePaginatedFetch`，其他页面也能复用
3. **添加类型**：`usePaginatedFetch<User>(url)` 支持泛型，返回值有明确类型
4. **搜索防抖**：原来 `@input` 直接触发请求，现在加了 300ms 防抖，减少无效请求
5. **Tailwind 替代 scoped style**：所有样式改用 Tailwind 工具类

## 使用技巧

1. **附带使用场景**：说明组件在哪里用、被谁调用，AI 能做出更好的拆分决策。比如"这个组件只在 Dashboard 页面使用"或"这个逻辑在 3 个页面都重复"
2. **标注性能瓶颈**：如果有卡顿问题，一并说明，比如"列表渲染 1000 条数据时卡顿"，重构时会针对性优化
3. **要求保持 API 兼容**：如果组件被多处引用，明确要求保持 props/emits 接口不变，避免重构后其他地方全要改
4. **要求生成测试**：重构后让 AI 生成测试用例，确保功能不退化。追加一句"请为重构后的组件生成 Vitest 测试用例"

## 变体

### 变体 1：链式重构（大组件安全重构）

对于大型组件，不要一步到位，拆成链式调用：

```
步骤 1：分析这个组件，列出所有独立的逻辑块和它们的依赖关系
```

确认分析正确后：

```
步骤 2：提取第一个 composable（数据获取逻辑），保持组件功能不变
```

验证通过后继续：

```
步骤 3：提取第二个 composable（表单验证逻辑），运行测试确认
```

最后：

```
步骤 4：最终清理，优化类型定义，统一代码风格
```

每一步都验证，比一次性重构安全得多。

### 变体 2：Options API → Composition API 逐行对照

如果你在学习 Composition API，可以让 AI 给出逐行对照：

```
将以下 Options API 代码转为 Composition API，
请给出逐行对照说明，解释每一行 this.xxx 对应 ref/computed/method 的哪种写法。

[粘贴 Options API 代码]
```

AI 会输出类似这样的对照表：
- `data() { return { count: 0 } }` → `const count = ref(0)`
- `computed: { double() { return this.count * 2 } }` → `const double = computed(() => count.value * 2)`
- `methods: { increment() { this.count++ } }` → `function increment() { count.value++ }`

### 变体 3：性能导向重构

如果组件有性能问题，侧重优化而非风格转换：

```
这个组件渲染 5000 条数据时卡顿明显，请重构为高性能版本：
1. 使用虚拟滚动只渲染可视区域
2. 使用 shallowRef 减少深层响应式开销
3. 使用 v-memo 减少不必要的 re-render
4. 保持 props/emits 接口不变

[粘贴组件代码]
```
