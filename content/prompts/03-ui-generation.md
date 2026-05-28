---
title: UI 生成 Prompt
description: 用自然语言描述需求，AI 生成 Tailwind CSS + Vue 3 组件代码
tags: ['prompt', 'ui', 'tailwind', 'vue3']
category: Prompt 库
---

# UI 生成 Prompt

> 描述越精确，生成越准确。告诉 AI "什么样式"不如告诉它"什么感觉"。

## 使用场景

什么时候该用这个 Prompt？当你遇到以下情况时：

- **新页面开发**：需要从零搭建一个页面，有设计稿或参考截图
- **组件开发**：需要一个通用组件（卡片、表格、表单、弹窗等）
- **样式还原**：有一张参考图，想用 Tailwind CSS 实现出来
- **原型验证**：快速出一个 UI 原型，验证想法可行性
- **响应式适配**：组件需要兼容移动端和桌面端

**不适合的场景**：已有组件的 Bug 修复（用 Bug 排查 Prompt）、纯逻辑组件无 UI（用组件重构 Prompt）。

## Prompt 模板

### 模板 1：五层架构版（推荐）

```
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
- 这个组件会被谁使用？[说明父组件或页面]
- 需要 emit 哪些事件？[如 @select、@delete]
- Props 从哪里来？[如 API 返回、父组件传入]

## 第 5 层：输出
完整的 .vue 文件代码，包含：
- Props 类型定义（interface）
- Emits 声明
- 加载态和空状态处理
```

### 模板 2：快速版（简单组件）

适合：组件逻辑简单，不需要复杂的状态管理。

```
生成一个 [组件名] 组件：
- [功能描述 1]
- [功能描述 2]
- [外观描述]
- [交互描述]
- 支持暗黑模式
- 响应式设计

技术栈：Vue 3 + TypeScript + Tailwind CSS
```

### 模板 3：参考截图版

适合：有设计稿或参考图片时。

```
请根据以下描述生成组件代码，风格参考截图中的设计：

[粘贴截图或图片链接]

技术栈：Vue 3 + TypeScript + Tailwind CSS
设计系统：暗黑主题，zinc 色系背景，emerald 强调色

组件功能：
[描述组件的功能需求]

注意：
1. 还原截图中的布局和间距
2. 保持色彩风格一致
3. 补充截图中没有的交互状态（hover、loading、empty）
```

## 实战示例

**你输入：**

```
## 第 1 层：上下文
技术栈：Nuxt 3 + Vue 3 <script setup> + TypeScript + Tailwind CSS
设计系统：zinc 色系暗黑主题，emerald 作为强调色
图标库：lucide-vue-next

## 第 2 层：需求
生成一个知识卡片组件：
- 卡片有标题、描述、标签列表
- 标签用彩色胶囊样式（不同标签不同颜色）
- 卡片 hover 时有绿色边框光晕效果
- 底部有"查看详情"按钮

## 第 3 层：约束
- 响应式设计（移动端优先）
- 支持加载态（骨架屏）
- 支持空状态提示
- 可访问性（aria 属性）

## 第 4 层：集成
- 父组件：知识列表页，从 API 获取数据后传入
- Emits：@view 用于跳转详情页
- Props：title、description、tags 从 API 返回

## 第 5 层：输出
完整的 .vue 文件代码
```

**AI 输出：**

```vue
<!-- KnowledgeCard.vue -->
<script setup lang="ts">
interface Tag {
  label: string
  color: 'emerald' | 'blue' | 'purple' | 'amber'
}

interface Props {
  title: string
  description: string
  tags: Tag[]
  loading?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  view: []
}>()

const colorMap: Record<string, string> = {
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

  <!-- 空状态 -->
  <div
    v-else-if="!title"
    class="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center"
    role="status"
    aria-label="暂无数据"
  >
    <p class="text-zinc-500 text-sm">暂无知识内容</p>
  </div>

  <!-- 正常态 -->
  <div
    v-else
    class="group bg-zinc-900 border border-zinc-800 rounded-xl p-5
           hover:border-emerald-500/50 transition-all duration-300
           hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]"
    role="article"
    :aria-label="title"
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
             hover:text-emerald-400 hover:border-emerald-500/50 transition-all
             focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
      aria-label="查看详情"
    >
      查看详情
    </button>
  </div>
</template>
```

父组件使用示例：

```vue
<!-- pages/knowledge/index.vue -->
<script setup lang="ts">
const { data, loading } = await useFetch('/api/knowledge')
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
    <KnowledgeCard
      v-for="item in data"
      :key="item.id"
      :title="item.title"
      :description="item.description"
      :tags="item.tags"
      :loading="loading"
      @view="navigateTo(`/knowledge/${item.id}`)"
    />
  </div>
</template>
```

## 使用技巧

1. **描述感受而非像素**：说"科技感、暗黑风"比说"border-radius: 12px"更好。AI 理解意图比理解数值更准确
2. **附上参考截图**：如果能贴一张参考图（设计稿、竞品截图），AI 生成的还原度会高很多
3. **指定交互细节**：hover 效果、点击反馈、过渡动画要明确说。比如"hover 时有绿色光晕"比"hover 时变色"更精确
4. **要求可组合**：让 AI 把大组件拆成 Headless 逻辑 + 样式组件，方便后续复用
5. **说明数据来源**：Props 的数据从哪来（API、父组件、store），AI 能设计更合理的接口
6. **要求骨架屏**：加上"支持加载态"这四个字，AI 就会生成 skeleton 屏代码，不用你自己补

## 变体

### 变体 1：表单组件生成

```
生成一个用户注册表单组件：
- 字段：用户名、邮箱、密码、确认密码
- 实时验证：邮箱格式、密码强度、两次密码一致
- 错误提示显示在输入框下方
- 提交按钮有 loading 状态
- 提交成功后显示成功提示

技术栈：Vue 3 + TypeScript + Tailwind CSS
表单验证：使用 VeeValidate 或手写验证逻辑
```

### 变体 2：数据表格组件生成

```
生成一个用户管理表格组件：
- 列：姓名、邮箱、角色、状态、操作
- 支持排序（点击列头）
- 支持搜索过滤
- 支持分页
- 操作列有编辑、删除按钮
- 空数据时显示占位图

技术栈：Vue 3 + TypeScript + Tailwind CSS
设计风格：暗黑主题，zinc 色系
```

### 变体 3：弹窗/对话框组件生成

```
生成一个通用的确认弹窗组件：
- 居中显示，背景半透明遮罩
- 支持自定义标题、内容、按钮文字
- 支持 danger/warning/info 三种类型（不同颜色）
- 点击遮罩或按 ESC 关闭
- 有打开/关闭的过渡动画
- 支持键盘操作（Tab 焦点切换、Enter 确认）

技术栈：Vue 3 + TypeScript + Tailwind CSS
使用 Teleport 渲染到 body
```
