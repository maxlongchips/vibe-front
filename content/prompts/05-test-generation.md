---
title: 测试用例生成 Prompt
description: 输入组件代码，AI 输出 Vitest 单元测试 + Testing Library 集成测试
tags: ['prompt', 'testing', 'vitest', 'vue']
category: Prompt 库
---

# 测试用例生成 Prompt

> 测试不是为了覆盖率数字，而是为了让你放心重构。

## 使用场景

什么时候该用这个 Prompt？当你遇到以下情况时：

- **新组件缺测试**：刚写完一个组件，需要补测试但不知道从哪写起
- **重构前保底**：要重构一个组件，想先写测试确保重构后功能不退化
- **Bug 回归测试**：修了一个 Bug，想写测试防止以后再出现
- **测试覆盖不足**：项目测试覆盖率低，想快速补充关键路径的测试
- **不熟悉测试框架**：刚接触 Vitest / Testing Library，不知道 API 怎么用

**不适合的场景**：E2E 端到端测试（需要 Playwright/Cypress）、性能测试。

## Prompt 模板

### 模板 1：基础测试生成

```
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

### 模板 2：回归测试生成

适合：修完 Bug 后，专门写测试防止复现。

```
## 角色
你是一个前端测试专家。

## 任务
为以下 Bug 修复编写回归测试，确保这个 Bug 不会再次出现。

## Bug 描述
[描述 Bug 的现象和根因]

## 修复的代码
[粘贴修复后的代码]

## 测试要求
1. 测试要能精确复现 Bug 的触发条件
2. 测试命名要包含 Bug 编号或描述
3. 覆盖 Bug 修复前后两种行为
```

### Think 关键词用法

对于包含复杂逻辑（异步、竞态、缓存）的组件，触发深度推理：

```
ultrathink: 这个 composable 包含异步操作、竞态条件、和缓存逻辑。
请分析所有可能的执行路径，为每条路径生成测试用例。
特别关注：并发请求、缓存过期、错误重试。

[粘贴代码]
```

## 实战示例

**你输入：**

```
## 角色
你是一个前端测试专家，精通 Vitest + Vue Test Utils + Testing Library。

## 任务
为以下组件生成完整的测试用例。

## 被测代码
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

## 测试要求
1. 使用 Vitest
2. 使用 @vue/test-utils
3. 覆盖正常流程、边界情况
4. 测试命名使用中文描述
```

**AI 输出：**

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

    it('渲染加减按钮', () => {
      const wrapper = mount(Counter)
      expect(wrapper.find('[data-testid="increment"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="decrement"]').exists()).toBe(true)
    })
  })

  describe('递增操作', () => {
    it('点击 + 按钮，值增加 1', async () => {
      const wrapper = mount(Counter)
      await wrapper.find('[data-testid="increment"]').trigger('click')
      expect(wrapper.find('[data-testid="value"]').text()).toBe('1')
    })

    it('连续点击多次，值正确累加', async () => {
      const wrapper = mount(Counter)
      for (let i = 0; i < 5; i++) {
        await wrapper.find('[data-testid="increment"]').trigger('click')
      }
      expect(wrapper.find('[data-testid="value"]').text()).toBe('5')
    })

    it('使用自定义 step=5', async () => {
      const wrapper = mount(Counter, { props: { step: 5 } })
      await wrapper.find('[data-testid="increment"]').trigger('click')
      expect(wrapper.find('[data-testid="value"]').text()).toBe('5')
    })

    it('不超过 max 限制', async () => {
      const wrapper = mount(Counter, { props: { max: 3 } })
      // 连续点击 5 次，应该停在 3
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
      // 连续点击 5 次，应该停在 0
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

    it('不传任何 props 时正常工作', async () => {
      const wrapper = mount(Counter)
      // 默认从 0 开始，步长 1
      await wrapper.find('[data-testid="increment"]').trigger('click')
      expect(wrapper.find('[data-testid="value"]').text()).toBe('1')
      await wrapper.find('[data-testid="decrement"]').trigger('click')
      expect(wrapper.find('[data-testid="value"]').text()).toBe('0')
    })
  })
})
```

运行方式：

```bash
npx vitest run Counter.spec.ts
```

## 使用技巧

1. **指定测试策略**：告诉 AI 你偏好单元测试还是集成测试，或者两者都要
2. **说明 Mock 策略**：哪些依赖需要 Mock（API 调用、路由、store），哪些用真实实现
3. **要求覆盖回归**：如果这个组件以前出过 Bug，要求 AI 专门写回归测试，贴上 Bug 描述
4. **要求可运行**：明确要求"生成的测试代码可以直接跑通，不要伪代码"
5. **要求测试命名清晰**：中文描述测试意图，失败时能快速定位问题。比如"点击加按钮后值增加 1"比"test increment"好

## 变体

### 变体 1：链式测试生成

对于复杂组件，拆成链式调用：

```
步骤 1：分析这个组件，列出所有需要测试的行为清单
```

确认清单完整后：

```
步骤 2：为正常流程生成测试用例（渲染、基础交互）
```

```
步骤 3：为边界情况和错误处理生成测试用例
```

```
步骤 4：为异步行为生成测试用例（API 调用、加载态）
```

### 变体 2：Composable 测试生成

测试纯逻辑的 composable，不需要 DOM：

```
为以下 composable 生成 Vitest 测试用例。

测试要求：
1. 纯函数逻辑测试，不需要 mount 组件
2. Mock API 调用（使用 vi.fn()）
3. 测试异步行为（loading 状态、错误处理）
4. 测试边界条件

[粘贴 composable 代码]
```

### 变体 3：快照测试 + 可视化回归

```
为以下组件生成测试用例，包含：
1. 常规功能测试
2. 快照测试（toMatchSnapshot）
3. 不同 props 组合的渲染测试
4. 可访问性测试（aria 属性、键盘操作）

[粘贴组件代码]
```
