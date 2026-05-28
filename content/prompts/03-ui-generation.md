---
title: UI 生成 Prompt
description: 用自然语言描述需求，AI 生成 Tailwind CSS + Vue 3 组件代码
tags: ['prompt', 'ui', 'tailwind', 'vue3']
category: Prompt 库
---

# UI 生成 Prompt

> 描述越精确，生成越准确。告诉 AI "什么样式"不如告诉它"什么感觉"。

## 核心 Prompt 模板（五层架构版）

```markdown
## 第 1 层：上下文
技术栈：Nuxt 3 + Vue 3 <script setup> + TypeScript + Tailwind CSS
设计系统：zinc 色系暗黑主题，emerald 作为强调色
图标库：lucide-vue-next

## 第 2 层：需求
[用自然语言描述组件的功能和外观]
[描述"感受"而非"像素" — "科技感、暗黑风" 比 "border-radius: 12px" 更好]

## 第 3 层：约束
- 响应式设计（移动端优先）
- 支持加载态（骨架屏）
- 支持空状态
- 可访问性（aria 属性）

## 第 4 层：集成
- 这个组件会被谁使用？
- 需要 emit 哪些事件？
- Props 从哪里来？

## 第 5 层：输出
完整的 .vue 文件代码，包含：
- Props 类型定义（interface）
- Emits 声明
- 加载态和空状态处理
```

## 实战示例

**输入：**

```markdown
生成一个知识卡片组件：
- 卡片有标题、描述、标签列表
- 标签用彩色胶囊样式
- 卡片 hover 时有绿色边框光晕效果
- 支持加载态（骨架屏）
- 底部有"查看详情"按钮
```

**AI 输出：**

```vue
<script setup lang="ts">
interface Props {
  title: string
  description: string
  tags: Array<{ label: string; color: 'emerald' | 'blue' | 'purple' | 'amber' }>
  loading?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  view: []
}>()

const colorMap = {
  emerald: 'bg-emerald-500/10 text-emerald-400',
  blue: 'bg-blue-500/10 text-blue-400',
  purple: 'bg-purple-500/10 text-purple-400',
  amber: 'bg-amber-500/10 text-amber-400',
}
</script>

<template>
  <!-- 加载态骨架屏 -->
  <div v-if="loading" class="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-pulse">
    <div class="h-5 bg-zinc-800 rounded w-2/3 mb-3" />
    <div class="h-4 bg-zinc-800 rounded w-full mb-2" />
    <div class="h-4 bg-zinc-800 rounded w-4/5 mb-4" />
    <div class="flex gap-2">
      <div class="h-6 w-16 bg-zinc-800 rounded-full" />
      <div class="h-6 w-20 bg-zinc-800 rounded-full" />
    </div>
  </div>

  <!-- 正常态 -->
  <div
    v-else
    class="group bg-zinc-900 border border-zinc-800 rounded-xl p-5
           hover:border-emerald-500/50 transition-all duration-300
           hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]"
  >
    <h3 class="text-zinc-100 font-semibold text-lg mb-2 group-hover:text-emerald-400 transition-colors">
      {{ title }}
    </h3>
    <p class="text-zinc-400 text-sm leading-relaxed mb-4 line-clamp-2">
      {{ description }}
    </p>
    <div class="flex flex-wrap gap-2 mb-4">
      <span
        v-for="tag in tags"
        :key="tag.label"
        :class="colorMap[tag.color]"
        class="text-xs px-2.5 py-1 rounded-full font-medium"
      >
        {{ tag.label }}
      </span>
    </div>
    <button
      @click="emit('view')"
      class="w-full py-2 text-sm text-zinc-400 border border-zinc-700 rounded-lg
             hover:text-emerald-400 hover:border-emerald-500/50 transition-all"
    >
      查看详情
    </button>
  </div>
</template>
```

## 使用技巧

1. **描述感受而非像素**：说"科技感、暗黑风"比说"border-radius: 12px"更好
2. **附上参考截图**：如果能贴一张参考图，AI 生成的还原度会高很多
3. **指定交互细节**：hover 效果、点击反馈、过渡动画要明确说
4. **要求可组合**：让 AI 把大组件拆成 Headless 逻辑 + 样式组件
