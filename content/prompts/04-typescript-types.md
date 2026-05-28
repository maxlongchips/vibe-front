---
title: TypeScript 类型体操 Prompt
description: 描述数据结构，AI 生成精确的泛型类型定义、Zod Schema、API 响应类型
tags: ['prompt', 'typescript', 'zod', 'types']
category: Prompt 库
---

# TypeScript 类型体操 Prompt

> 类型不是约束，是文档。好的类型定义让代码自解释。

## 核心 Prompt 模板

```markdown
## 角色
你是一个 TypeScript 类型系统专家，精通泛型编程和 Zod。

## 任务
根据以下数据结构描述，生成完整的 TypeScript 类型定义。

## 数据描述
[描述数据的结构、字段、约束条件]

## 要求
1. 生成 TypeScript interface/type
2. 生成对应的 Zod Schema（用于运行时验证）
3. 生成 API 响应的包装类型
4. 类型要有 JSDoc 注释说明每个字段
5. 处理可选字段和联合类型

## 输出
三个文件：types.ts / schemas.ts / api-types.ts
```

## 实战示例

**输入：**

```markdown
描述一个用户系统：
- 用户有 id(number)、name(string)、email(string)、role('admin' | 'user' | 'guest')
- 用户有可选的 profile，包含 avatar(url)、bio(string)、socialLinks(url数组)
- API 响应统一格式：{ code: number, data: T, message: string }
- 列表接口支持分页：data 中有 items 数组、total、page、pageSize
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
  /** 个人简介 */
  bio?: string
  /** 社交链接 */
  socialLinks?: string[]
}

/** 用户信息 */
export interface User {
  /** 用户 ID */
  id: number
  /** 用户名 */
  name: string
  /** 邮箱 */
  email: string
  /** 角色 */
  role: UserRole
  /** 个人资料 */
  profile?: UserProfile
}

/** 分页信息 */
export interface Pagination {
  /** 总数 */
  total: number
  /** 当前页 */
  page: number
  /** 每页数量 */
  pageSize: number
}

/** 分页列表数据 */
export interface PaginatedData<T> extends Pagination {
  /** 数据列表 */
  items: T[]
}

/** API 统一响应格式 */
export interface ApiResponse<T> {
  /** 状态码 */
  code: number
  /** 数据 */
  data: T
  /** 消息 */
  message: string
}

/** 分页列表响应 */
export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>

/** 用户列表响应 */
export type UserListResponse = PaginatedResponse<User>
```

```typescript
// schemas.ts
import { z } from 'zod'

export const userRoleSchema = z.enum(['admin', 'user', 'guest'])

export const userProfileSchema = z.object({
  avatar: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  socialLinks: z.array(z.string().url()).optional(),
})

export const userSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(50),
  email: z.string().email(),
  role: userRoleSchema,
  profile: userProfileSchema.optional(),
})

export const paginationSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(100),
})

export function paginatedDataSchema<T extends z.ZodType>(itemSchema: T) {
  return paginationSchema.extend({
    items: z.array(itemSchema),
  })
}

export function apiResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    code: z.number(),
    data: dataSchema,
    message: z.string(),
  })
}

// 运行时验证
export const userResponseSchema = apiResponseSchema(userSchema)
export const userListResponseSchema = apiResponseSchema(
  paginatedDataSchema(userSchema)
)
```

```typescript
// api-types.ts
import type { User, ApiResponse, PaginatedResponse } from './types'
import { userListResponseSchema, userResponseSchema } from './schemas'

/** 获取用户列表 */
export async function fetchUsers(page = 1, pageSize = 20) {
  const res = await $fetch<unknown>('/api/users', {
    query: { page, pageSize },
  })
  // 运行时验证
  return userListResponseSchema.parse(res)
}

/** 获取单个用户 */
export async function fetchUser(id: number) {
  const res = await $fetch<unknown>(`/api/users/${id}`)
  return userResponseSchema.parse(res)
}
```

## 使用技巧

1. **描述约束条件**：字段的最大长度、格式要求、取值范围
2. **说明关系**：哪些字段互斥、哪些是条件必填
3. **给出示例数据**：贴一条真实的 JSON，AI 能更准确推断类型
4. **要求 Zod 验证**：TypeScript 类型只在编译时检查，Zod 在运行时也能验证
