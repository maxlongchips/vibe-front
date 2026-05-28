---
title: 组件重构 Prompt
description: 输入一个屎山组件，AI 输出 Composition API 重构版本，自动拆分 composables
tags: ['prompt', 'refactor', 'vue3', 'composition-api']
category: Prompt 库
---

# 组件重构 Prompt

> 好的重构不是"换种写法"，而是提升可维护性和可复用性。

## 核心 Prompt 模板

```markdown
## 角色
你是一个 Vue 3 Composition API 重构专家。

## 任务
将以下组件重构为 Composition API + <script setup> 风格，并拆分为可复用的 composables。

## 重构要求
1. 将 Options API 转为 <script setup>
2. 提取可复用逻辑到 composables/
3. 使用 TypeScript 强类型
4. 保持功能完全一致
5. 使用 Tailwind CSS 替代 scoped style

## 原始代码
[粘贴需要重构的组件代码]

## 输出格式
1. 重构后的组件代码
2. 提取的 composables 代码
3. 重构说明：做了哪些改动，为什么
```

## 实战示例

**输入（屎山组件）：**

```vue
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
```

**AI 输出（重构后）：**

```typescript
// composables/usePaginatedFetch.ts
export function usePaginatedFetch<T>(url: Ref<string>) {
  const data = ref<T[]>([])
  const loading = ref(false)
  const page = ref(1)
  const totalPages = ref(1)

  async function fetch() {
    loading.value = true
    try {
      const separator = url.value.includes('?') ? '&' : '?'
      const fullUrl = `${url.value}${separator}page=${page.value}`
      const res = await $fetch<{ data: T[], totalPages: number }>(fullUrl)
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

```vue
<script setup lang="ts">
const search = ref('')
const url = computed(() => `/api/users?q=${search.value}`)
const { data: users, loading, nextPage, resetPage } = usePaginatedFetch(url)

// 初始化
await resetPage()

// 搜索时重置页码
watch(search, debounce(resetPage, 300))
</script>
```

## 链式重构模式

对于大型组件，不要一步到位。拆成链式调用：

```
步骤 1：分析组件，列出所有独立的逻辑块
步骤 2：提取第一个 composable，保持组件功能不变
步骤 3：提取第二个 composable，运行测试确认
步骤 4：最终清理，优化类型定义
```

每一步都验证，比一次性重构安全得多。

## Think 关键词

复杂重构时触发深度推理：

```
ultrathink: 这个组件有 500 行，包含用户认证、数据获取、表单验证、
和复杂的 UI 状态管理。请先分析逻辑依赖关系，再给出最优的拆分方案。
```

## 使用技巧

1. **附带使用场景**：说明组件在哪里用、被谁调用，AI 能做出更好的拆分决策
2. **标注性能瓶颈**：如果有卡顿问题，一并说明，重构时会针对性优化
3. **要求保持 API 兼容**：如果组件被多处引用，要求保持 props/emits 接口不变
4. **要求生成测试**：重构后要求 AI 生成测试用例，确保功能不退化
