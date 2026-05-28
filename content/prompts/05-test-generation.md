---
title: 测试用例生成 Prompt
description: 输入组件代码，AI 输出 Vitest 单元测试 + Testing Library 集成测试
tags: ['prompt', 'testing', 'vitest', 'vue']
category: Prompt 库
---

# 测试用例生成 Prompt

> 测试不是为了覆盖率数字，而是为了让你放心重构。

## 核心 Prompt 模板

```markdown
## 角色
你是一个前端测试专家，精通 Vitest + Vue Test Utils + Testing Library。

## 任务
为以下组件/函数生成完整的测试用例。

## 被测代码
[粘贴组件或函数代码]

## 测试要求
1. 使用 Vitest 作为测试框架
2. Vue 组件使用 @vue/test-utils
3. 覆盖正常流程、边界情况、错误处理
4. 测试命名使用中文描述
5. Mock 外部依赖（API 调用、路由等）
6. 每个测试用例附带注释说明测试意图

## 测试维度
- 正常渲染：组件是否正确显示
- 用户交互：点击、输入、提交等操作
- 异步行为：API 调用、加载态、错误态
- 边界条件：空数据、超长文本、特殊字符
```

## 实战示例

**输入（组件）：**

```vue
<script setup lang="ts">
const props = defineProps<{
  min?: number
  max?: number
  step?: number
}>()

const value = ref(props.min ?? 0)

function increment() {
  const max = props.max ?? Infinity
  value.value = Math.min(value.value + (props.step ?? 1), max)
}

function decrement() {
  const min = props.min ?? -Infinity
  value.value = Math.max(value.value - (props.step ?? 1), min)
}
</script>

<template>
  <div>
    <button @click="decrement" data-testid="decrement">-</button>
    <span data-testid="value">{{ value }}</span>
    <button @click="increment" data-testid="increment">+</button>
  </div>
</template>
```

**AI 输出（测试）：**

```typescript
// Counter.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Counter from './Counter.vue'

describe('Counter 计数器组件', () => {
  describe('正常渲染', () => {
    it('默认显示初始值 0', () => {
      const wrapper = mount(Counter)
      expect(wrapper.find('[data-testid="value"]').text()).toBe('0')
    })

    it('使用 min 属性作为初始值', () => {
      const wrapper = mount(Counter, { props: { min: 10 } })
      expect(wrapper.find('[data-testid="value"]').text()).toBe('10')
    })
  })

  describe('递增操作', () => {
    it('点击 + 按钮，值增加 1', async () => {
      const wrapper = mount(Counter)
      await wrapper.find('[data-testid="increment"]').trigger('click')
      expect(wrapper.find('[data-testid="value"]').text()).toBe('1')
    })

    it('使用自定义 step', async () => {
      const wrapper = mount(Counter, { props: { step: 5 } })
      await wrapper.find('[data-testid="increment"]').trigger('click')
      expect(wrapper.find('[data-testid="value"]').text()).toBe('5')
    })

    it('不超过 max 限制', async () => {
      const wrapper = mount(Counter, { props: { max: 3 } })
      // 连续点击 5 次
      for (let i = 0; i < 5; i++) {
        await wrapper.find('[data-testid="increment"]').trigger('click')
      }
      expect(wrapper.find('[data-testid="value"]').text()).toBe('3')
    })
  })

  describe('递减操作', () => {
    it('点击 - 按钮，值减少 1', async () => {
      const wrapper = mount(Counter, { props: { min: 5 } })
      await wrapper.find('[data-testid="decrement"]').trigger('click')
      expect(wrapper.find('[data-testid="value"]').text()).toBe('4')
    })

    it('不低于 min 限制', async () => {
      const wrapper = mount(Counter, { props: { min: 0 } })
      // 连续点击 5 次
      for (let i = 0; i < 5; i++) {
        await wrapper.find('[data-testid="decrement"]').trigger('click')
      }
      expect(wrapper.find('[data-testid="value"]').text()).toBe('0')
    })
  })

  describe('边界情况', () => {
    it('min 和 max 相同时，值不变', async () => {
      const wrapper = mount(Counter, { props: { min: 5, max: 5 } })
      await wrapper.find('[data-testid="increment"]').trigger('click')
      expect(wrapper.find('[data-testid="value"]').text()).toBe('5')
      await wrapper.find('[data-testid="decrement"]').trigger('click')
      expect(wrapper.find('[data-testid="value"]').text()).toBe('5')
    })

    it('step 为 0 时，值不变', async () => {
      const wrapper = mount(Counter, { props: { step: 0 } })
      await wrapper.find('[data-testid="increment"]').trigger('click')
      expect(wrapper.find('[data-testid="value"]').text()).toBe('0')
    })

    it('负数 step 正常工作', async () => {
      const wrapper = mount(Counter, { props: { step: -1 } })
      await wrapper.find('[data-testid="increment"]').trigger('click')
      expect(wrapper.find('[data-testid="value"]').text()).toBe('-1')
    })
  })
})
```

## 使用技巧

1. **指定测试策略**：告诉 AI 你偏好单元测试还是集成测试
2. **说明 Mock 策略**：哪些依赖需要 Mock，哪些用真实实现
3. **要求覆盖回归**：如果这个 Bug 以前出现过，要求专门写回归测试
4. **要求可运行**：让 AI 生成的代码可以直接跑通，而不是伪代码
