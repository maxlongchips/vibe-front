---
title: TypeScript 类型体操 Prompt
description: 描述数据结构，AI 生成精确的泛型类型定义、Zod Schema、API 响应类型
tags: ['prompt', 'typescript', 'zod', 'types']
category: Prompt 库
---

# TypeScript 类型体操 Prompt

> 类型不是约束，是文档。好的类型定义让代码自解释。

## 使用场景

什么时候该用这个 Prompt？当你遇到以下情况时：

- **定义 API 类型**：后端给了一个 JSON 响应，你需要定义对应的 TypeScript 类型
- **设计数据模型**：规划新的业务模块（用户系统、订单系统等），需要完整的类型定义
- **运行时验证**：TypeScript 类型只在编译时检查，需要 Zod Schema 在运行时也验证数据
- **复杂泛型**：需要写工具类型、条件类型、映射类型等高级类型体操
- **类型报错**：`Type 'X' is not assignable to type 'Y'`，看不懂为什么报错

**不适合的场景**：简单的变量赋值不需要类型定义、纯 CSS 类型问题。

## Prompt 模板

### 模板 1：完整类型体系生成

适合：新模块开发，需要 types + schemas + API 函数一整套。

```
## 角色
你是一个 TypeScript 类型系统专家，精通泛型编程和 Zod。

## 任务
根据以下数据结构描述，生成完整的 TypeScript 类型体系。

## 数据描述
[描述数据的结构、字段、约束条件]
[可以贴一条真实的 JSON 示例]

## 要求
1. 生成 TypeScript interface/type（带 JSDoc 注释）
2. 生成对应的 Zod Schema（用于运行时验证）
3. 生成 API 响应的包装类型（统一格式）
4. 处理可选字段和联合类型

## 输出
三个文件：types.ts / schemas.ts / api-types.ts
```

### 模板 2：从 JSON 生成类型

适合：后端已经返回了 JSON 数据，你需要从中推断类型。

```
根据以下 JSON 数据，生成完整的 TypeScript 类型定义。

要求：
1. 生成 interface（带 JSDoc 注释）
2. 生成对应的 Zod Schema
3. 可选字段用 optional 标记
4. 数组字段推断元素类型

JSON 数据：
[粘贴完整的 JSON 数据]
```

### 模板 3：类型报错修复

适合：遇到看不懂的 TypeScript 类型错误。

```
以下 TypeScript 代码报了类型错误，请解释错误原因并给出修复方案。

报错信息：
[粘贴完整报错]

相关代码：
[粘贴报错附近的代码]

期望行为：
[描述你希望这段代码做什么]
```

## 实战示例

**你输入：**

```
## 角色
你是一个 TypeScript 类型系统专家，精通泛型编程和 Zod。

## 任务
根据以下数据结构描述，生成完整的 TypeScript 类型体系。

## 数据描述
描述一个用户系统：
- 用户有 id(number)、name(string)、email(string)、role('admin' | 'user' | 'guest')
- 用户有可选的 profile，包含 avatar(url)、bio(string)、socialLinks(url 数组)
- API 响应统一格式：{ code: number, data: T, message: string }
- 列表接口支持分页：data 中有 items 数组、total、page、pageSize

## 要求
1. 生成 TypeScript interface（带 JSDoc 注释）
2. 生成对应的 Zod Schema
3. 生成 API 响应的包装类型
4. 生成 API 调用函数（带运行时验证）

## 输出
三个文件：types.ts / schemas.ts / api-types.ts
```

**AI 输出：**

```typescript
// types.ts

/** 用户角色 */
export type UserRole = 'admin' | 'user' | 'guest'

/** 用户资料 */
export interface UserProfile {
  /** 头像 URL */
  avatar?: string
  /** 个人简介，最多 500 字 */
  bio?: string
  /** 社交链接列表 */
  socialLinks?: string[]
}

/** 用户信息 */
export interface User {
  /** 用户 ID，正整数 */
  id: number
  /** 用户名，1-50 字符 */
  name: string
  /** 邮箱地址 */
  email: string
  /** 角色 */
  role: UserRole
  /** 个人资料 */
  profile?: UserProfile
}

/** 分页信息 */
export interface Pagination {
  /** 总记录数 */
  total: number
  /** 当前页码，从 1 开始 */
  page: number
  /** 每页数量，最大 100 */
  pageSize: number
}

/** 分页列表数据 */
export interface PaginatedData<T> extends Pagination {
  /** 数据列表 */
  items: T[]
}

/** API 统一响应格式 */
export interface ApiResponse<T> {
  /** 状态码，0 表示成功 */
  code: number
  /** 响应数据 */
  data: T
  /** 响应消息 */
  message: string
}

/** 分页列表响应 */
export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>

/** 用户列表响应 */
export type UserListResponse = PaginatedResponse<User>

/** 用户详情响应 */
export type UserResponse = ApiResponse<User>
```

```typescript
// schemas.ts
import { z } from 'zod'

/** 用户角色 Schema */
export const userRoleSchema = z.enum(['admin', 'user', 'guest'])

/** 用户资料 Schema */
export const userProfileSchema = z.object({
  avatar: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  socialLinks: z.array(z.string().url()).optional(),
})

/** 用户信息 Schema */
export const userSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(50),
  email: z.string().email(),
  role: userRoleSchema,
  profile: userProfileSchema.optional(),
})

/** 分页信息 Schema */
export const paginationSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(100),
})

/** 生成分页数据 Schema（泛型工厂函数） */
export function paginatedDataSchema<T extends z.ZodType>(itemSchema: T) {
  return paginationSchema.extend({
    items: z.array(itemSchema),
  })
}

/** 生成 API 响应 Schema（泛型工厂函数） */
export function apiResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    code: z.number(),
    data: dataSchema,
    message: z.string(),
  })
}

/** 用户列表响应 Schema */
export const userListResponseSchema = apiResponseSchema(
  paginatedDataSchema(userSchema)
)

/** 用户详情响应 Schema */
export const userResponseSchema = apiResponseSchema(userSchema)
```

```typescript
// api-types.ts
import type { UserListResponse, UserResponse } from './types'
import { userListResponseSchema, userResponseSchema } from './schemas'

/** 获取用户列表（带运行时验证） */
export async function fetchUsers(page = 1, pageSize = 20): Promise<UserListResponse> {
  const res = await $fetch<unknown>('/api/users', {
    query: { page, pageSize },
  })
  // Zod 在运行时验证响应数据结构
  return userListResponseSchema.parse(res)
}

/** 获取单个用户（带运行时验证） */
export async function fetchUser(id: number): Promise<UserResponse> {
  const res = await $fetch<unknown>(`/api/users/${id}`)
  return userResponseSchema.parse(res)
}
```

使用示例：

```vue
<script setup lang="ts">
import { fetchUsers } from '~/api/api-types'

// data 有完整的类型提示：UserListResponse
const { data } = await useAsyncData('users', () => fetchUsers(1, 20))

// 自动补全：data.value.data.items[0].name、data.value.data.items[0].role 等
</script>
```

## 使用技巧

1. **描述约束条件**：字段的最大长度、格式要求、取值范围。比如"bio 最多 500 字"比"bio 是 string"更有用
2. **说明关系**：哪些字段互斥、哪些是条件必填。比如"role 为 admin 时 permissions 必填"
3. **给出示例数据**：贴一条真实的 JSON，AI 能更准确推断类型，比自然语言描述更精确
4. **要求 Zod 验证**：TypeScript 类型只在编译时检查，Zod 在运行时也能验证。API 返回的数据用 Zod parse 一下，能提前发现后端接口变更
5. **要求 JSDoc**：每个字段加注释，IDE 悬浮提示时很有用，团队协作时就是活文档

## 变体

### 变体 1：链式类型生成

对于复杂类型系统，拆成链式调用，每一步确认后再继续：

```
步骤 1：分析以下数据结构，生成基础 interface
[贴 JSON 或数据描述]
```

确认类型正确后：

```
步骤 2：基于这些 interface，生成 Zod Schema
```

```
步骤 3：基于 Schema，生成 API 调用函数（带验证）
```

```
步骤 4：生成 mock 数据用于开发和测试
```

### 变体 2：类型体操练习

如果你在学习 TypeScript 高级类型，可以让 AI 出题教学：

```
请给我出 3 道 TypeScript 类型体操题，难度递增：
1. 基础：Pick 和 Omit 的手写实现
2. 中等：条件类型和 infer
3. 困难：递归类型（如 DeepPartial）

每道题给出题目、提示、和参考答案。
```

### 变体 3：类型报错解释与修复

遇到看不懂的类型错误时：

```
以下 TypeScript 代码报了类型错误，请用简单的语言解释为什么报错，
然后给出 2 种修复方案（一种保守、一种彻底）。

报错信息：
Type '{ id: number; name: string; }' is missing the following properties
from type 'User': email, role

相关代码：
const user: User = { id: 1, name: '张三' }
```
