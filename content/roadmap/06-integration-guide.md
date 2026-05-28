---
title: AI 全栈集成：从零搭建智能文档助手
description: 把 Vercel AI SDK、RAG、Function Calling、MCP 串成一个完整可运行的项目，从需求分析到端到端联调
tags: ['集成', '全栈', 'ai-sdk', 'rag', 'function-calling', 'mcp']
category: 学习路线
---

# AI 全栈集成：从零搭建智能文档助手

> 前五篇教程你分别学了 AI SDK、RAG、Function Calling、MCP。现在把它们串成一个能跑的完整项目。这是你从"学了技术"到"能做产品"的关键一步。

---

## 零基础起步

开始之前，请确认以下条件全部满足：

| 检查项 | 怎么验证 | 不满足怎么办 |
|--------|---------|-------------|
| 已完成路线图 01-05 | 确认你理解 `useChat`、`streamText`、工具定义、向量检索、MCP Server | 回去补课，每一节都是本节的前置知识 |
| Node.js 18+ | 终端运行 `node -v`，输出 `v18.x.x` 或更高 | 去 [nodejs.org](https://nodejs.org) 下载 LTS 版本 |
| Nuxt 3 项目 | 项目根目录有 `nuxt.config.ts` | 运行 `npx nuxi@latest init smart-docs-assistant` |
| Anthropic API Key | 能正常调用 Claude API | 去 [console.anthropic.com](https://console.anthropic.com) 注册并创建 Key |
| OpenAI API Key | 能正常调用 Embedding API | 去 [platform.openai.com](https://platform.openai.com) 注册并创建 Key |

全部通过？我们开始。

---

## 你将构建什么

一个**智能文档助手**，具备以下能力：

1. **流式对话** — 用户和 AI 实时聊天，打字机效果
2. **知识库检索（RAG）** — 用户上传 Markdown 文档，AI 基于文档内容回答
3. **工具调用（Function Calling）** — AI 能主动搜索知识库、列出文档列表
4. **外部集成（MCP）** — 通过 MCP 协议让 Claude Code 也能访问你的知识库

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器（前端）                         │
│                                                             │
│   pages/index.vue          pages/knowledge.vue              │
│   ┌───────────────┐        ┌──────────────────┐             │
│   │  聊天界面      │        │  文档上传界面      │             │
│   │  useChat()    │        │  上传 .md 文件     │             │
│   │  工具调用渲染  │        │  查看已导入文档     │             │
│   └───────┬───────┘        └────────┬─────────┘             │
└───────────┼─────────────────────────┼───────────────────────┘
            │ fetch (SSE)             │ POST
┌───────────┼─────────────────────────┼───────────────────────┐
│           ▼            Nuxt 服务端   ▼                       │
│                                                             │
│   server/api/               server/utils/                   │
│   ┌───────────────┐        ┌──────────────────┐             │
│   │ rag-chat.post │───────▶│ chunker.ts       │ 文档分块     │
│   │ .ts           │        │ embedding.ts     │ 向量化       │
│   │               │        │ vector.ts        │ Qdrant 客户端│
│   │ - RAG 检索    │        └──────────────────┘             │
│   │ - 工具调用    │                                          │
│   │ - 流式回答    │        ┌──────────────────┐             │
│   └───────────────┘        │ ingest.post.ts   │ 文档导入     │
│                            └──────────────────┘             │
└─────────────────────────────────────────────────────────────┘
            │                           │
            ▼                           ▼
┌───────────────────────┐   ┌───────────────────────────────┐
│   Anthropic Claude    │   │   Qdrant 向量数据库             │
│   (对话 + 工具调用)    │   │   (存储文档向量)                │
└───────────────────────┘   └───────────────────────────────┘
                                        ▲
                                        │
┌───────────────────────────────────────┤
│   OpenAI text-embedding-3-small       │
│   (生成 Embedding 向量)               │
└───────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│   MCP Server（可选）                                         │
│   mcp-server/index.ts                                       │
│   让 Claude Code 也能搜索你的知识库                           │
└─────────────────────────────────────────────────────────────┘
```

**数据流：** 用户提问 → RAG 检索相关文档 → AI 用工具搜索知识库 → 流式生成带引用的回答

---

## 第 1 步：项目初始化

**你在这里：** 终端里，准备创建新项目（或使用已有 Nuxt 3 项目）。

**做什么：** 初始化项目、安装所有依赖、配置环境变量。

### 1.1 创建项目（如果还没有）

```bash
npx nuxi@latest init smart-docs-assistant
cd smart-docs-assistant
```

### 1.2 安装全部依赖

一条命令安装所有需要的包：

```bash
npm install ai @ai-sdk/anthropic @ai-sdk/openai @qdrant/js-client-rest @modelcontextprotocol/sdk zod marked highlight.js
```

每个包的作用：

| 包名 | 作用 | 对应教程 |
|------|------|---------|
| `ai` | Vercel AI SDK 核心，提供 `streamText`、`embed`、`tool` | 路线 02 |
| `@ai-sdk/anthropic` | Claude 模型适配器 | 路线 02 |
| `@ai-sdk/openai` | OpenAI 模型适配器（用于 Embedding） | 路线 04 |
| `@qdrant/js-client-rest` | Qdrant 向量数据库客户端 | 路线 04 |
| `@modelcontextprotocol/sdk` | MCP 协议 SDK | 路线 05 |
| `zod` | 参数校验，定义工具 Schema | 路线 03 |
| `marked` | Markdown 解析器，用于渲染 AI 回答中的 Markdown | 通用工具 |
| `highlight.js` | 代码高亮，配合 marked 渲染代码块 | 通用工具 |

### 1.3 创建环境变量文件

在项目根目录创建 `.env` 文件：

```bash
# .env

# Anthropic（对话 + 工具调用）
ANTHROPIC_API_KEY=sk-ant-api03-你的anthropic密钥

# OpenAI（生成 Embedding 向量）
OPENAI_API_KEY=sk-你的openai密钥

# Qdrant 向量数据库（本地开发用默认值即可）
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
```

把上面的中文替换成你自己的密钥。`QDRANT_URL` 和 `QDRANT_API_KEY` 在本地开发时使用默认值，后面会说明怎么启动 Qdrant。

### 1.4 配置 nuxt.config.ts

打开 `nuxt.config.ts`，替换为以下内容：

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  runtimeConfig: {
    // 以下变量只在服务端可用，不会暴露给浏览器
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
    qdrantApiKey: process.env.QDRANT_API_KEY || '',
  },
})
```

`runtimeConfig` 中的变量只在服务端（`server/` 目录下的代码）可用，浏览器端无法访问，这是保护 API Key 的安全机制。

### 1.5 启动 Qdrant 向量数据库

Qdrant 支持 Docker 一键启动。如果你还没有安装 Docker，去 [docker.com](https://www.docker.com/products/docker-desktop/) 下载安装。

```bash
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

这条命令做了什么：
- `-d` — 后台运行
- `--name qdrant` — 容器名叫 qdrant
- `-p 6333:6333` — 把容器的 6333 端口映射到本机的 6333 端口（REST API）
- `-p 6334:6334` — gRPC 端口（本教程用不到，但开着没坏处）

验证 Qdrant 是否启动成功：

```bash
curl http://localhost:6333/health
```

如果返回类似 `{"status":"ok"}` 的 JSON，说明启动成功。

### 完成这一步后你应该看到

- `package.json` 的 `dependencies` 里有上面列出的所有包
- `.env` 文件存在且包含你的 API Key
- `nuxt.config.ts` 配置了 `runtimeConfig`
- Qdrant 在 `localhost:6333` 正常运行

项目目录结构：

```
smart-docs-assistant/
├── .env                          ← API Key 配置
├── nuxt.config.ts                ← Nuxt 配置
├── package.json                  ← 依赖列表
└── (接下来会创建 server/ 和 pages/ 下的文件)
```

> **卡住了？**
>
> | 问题 | 原因 | 解决方案 |
> |------|------|---------|
> | `npm install` 报 ERESOLVE | 依赖版本冲突 | 运行 `npm install --legacy-peer-deps` |
> | 网络慢或超时 | npm 官方源在国内较慢 | 运行 `npm config set registry https://registry.npmmirror.com` |
> | Docker 命令找不到 | 没装 Docker | 去 docker.com 下载 Docker Desktop |
> | Qdrant 健康检查失败 | Docker 容器没启动 | 运行 `docker ps` 查看容器状态，`docker logs qdrant` 查看日志 |
> | `.env` 文件不生效 | Nuxt 需要重启才能读取新的环境变量 | `Ctrl+C` 停止开发服务器，重新 `npm run dev` |

---

## 第 2 步：对话引擎

**你在这里：** 项目已初始化，依赖已安装，Qdrant 已运行。

**做什么：** 先搭建一个最基础的聊天功能，确认 AI SDK 能正常工作，再逐步添加 RAG 和工具调用。

### 2.1 创建服务端聊天 API

创建文件 `server/api/chat.post.ts`：

```typescript
// server/api/chat.post.ts
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

export default defineLazyEventHandler(async () => {
  const apiKey = useRuntimeConfig().anthropicApiKey

  if (!apiKey) {
    throw new Error('缺少 ANTHROPIC_API_KEY 环境变量')
  }

  return defineEventHandler(async (event) => {
    const { messages } = await readBody(event)

    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: '你是 VibeFront 智能文档助手。你可以帮助用户查阅技术文档、回答前端相关问题。请用中文回答。',
      messages,
      maxTokens: 4096,
    })

    return result.toDataStreamResponse()
  })
})
```

逐行解释：
- `defineLazyEventHandler` — Nuxt 的懒加载处理器，第一次请求时才执行初始化（读取 API Key）
- `readBody(event)` — 从 POST 请求体解析 `{ messages }`
- `streamText(...)` — 调用 Claude API，流式生成回答
- `result.toDataStreamResponse()` — 把流转成浏览器可消费的 SSE 格式

### 2.2 创建前端聊天页面

创建文件 `pages/index.vue`：

```vue
<!-- pages/index.vue -->
<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'

const { messages, input, handleSubmit, isLoading, error, stop } = useChat({
  api: '/api/chat',
  onError: (err) => {
    console.error('聊天出错:', err)
  },
})
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 min-h-screen flex flex-col bg-zinc-950">
    <!-- 页面标题 -->
    <div class="py-6 border-b border-zinc-800 mb-6">
      <h1 class="text-2xl font-bold text-zinc-100">
        智能文档助手
        <span class="text-sm font-normal text-zinc-500 ml-2">v1.0</span>
      </h1>
      <p class="text-sm text-zinc-500 mt-1">
        基于 RAG + Function Calling + MCP 的全栈 AI 应用
      </p>
    </div>

    <!-- 错误提示 -->
    <div
      v-if="error"
      class="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm"
    >
      出错了：{{ error.message }}
    </div>

    <!-- 消息列表 -->
    <div class="flex-1 overflow-y-auto space-y-4 pb-4">
      <!-- 空状态提示 -->
      <div v-if="messages.length === 0" class="text-center py-20">
        <div class="text-4xl mb-4">&#128218;</div>
        <p class="text-zinc-400">你好！我是智能文档助手。</p>
        <p class="text-zinc-500 text-sm mt-1">问我任何技术问题，我会从知识库中检索文档来回答。</p>
      </div>

      <!-- 消息列表 -->
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="msg.role === 'user' ? 'flex justify-end' : ''"
      >
        <!-- 用户消息 -->
        <div
          v-if="msg.role === 'user'"
          class="bg-emerald-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%]"
        >
          {{ msg.content }}
        </div>

        <!-- AI 回答 -->
        <div
          v-else
          class="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[90%]"
        >
          <div class="text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {{ msg.content }}
          </div>
        </div>
      </div>

      <!-- 加载提示 -->
      <div v-if="isLoading" class="text-zinc-500 text-sm animate-pulse">
        AI 正在思考...
      </div>
    </div>

    <!-- 输入框 -->
    <form @submit="handleSubmit" class="flex gap-2 pt-4 border-t border-zinc-800">
      <input
        v-model="input"
        type="text"
        placeholder="输入你的问题..."
        class="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3
               text-zinc-200 placeholder-zinc-600
               focus:outline-none focus:border-emerald-600 transition-colors"
        :disabled="isLoading"
      />
      <button
        type="submit"
        :disabled="isLoading || !input.trim()"
        class="px-6 py-3 bg-emerald-600 text-white rounded-xl
               hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed
               transition-colors font-medium"
      >
        发送
      </button>
      <button
        v-if="isLoading"
        type="button"
        @click="stop"
        class="px-4 py-3 bg-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-600 transition-colors"
      >
        停止
      </button>
    </form>
  </div>
</template>
```

### 2.3 启动并测试

```bash
npm run dev
```

打开浏览器访问 `http://localhost:3000`，在输入框中输入"你好"，你应该看到 AI 的回复逐字出现（打字机效果）。

也可以用 curl 测试：

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"你好，请自我介绍"}]}'
```

如果返回一串流式数据（看起来像乱码），说明 API 工作正常。

### 完成这一步后你应该看到

- 浏览器中有一个深色背景的聊天界面
- 输入消息后 AI 逐字回复（流式效果）
- 生成过程中出现"停止"按钮

> **卡住了？**
>
> | 问题 | 原因 | 解决方案 |
> |------|------|---------|
> | 页面空白 | 可能有编译错误 | 查看终端里 Nuxt 的日志输出 |
> | 请求 404 | 文件路径不对 | 确认文件是 `server/api/chat.post.ts`（不是 `chat.ts`） |
> | 请求 500 | 服务端报错 | 查看终端日志，通常是 API Key 问题 |
> | `ANTHROPIC_API_KEY is undefined` | 环境变量没读到 | 确认 `.env` 文件存在，重启 `npm run dev` |
> | `401 Unauthorized` | API Key 错误或过期 | 去 Anthropic 控制台检查 Key 状态 |

---

## 第 3 步：知识库增强（RAG）

**你在这里：** 基础聊天已跑通。

**做什么：** 实现文档上传、分块、向量化、检索的完整 RAG 管道。

### 3.1 创建 Qdrant 客户端工具

Nuxt 会自动导入 `server/utils/` 下的文件，不需要手动 import。

创建文件 `server/utils/vector.ts`：

```typescript
// server/utils/vector.ts
import { QdrantClient } from '@qdrant/js-client-rest'

// Qdrant 集合名称（相当于数据库中的"表名"）
const COLLECTION_NAME = 'documents'

// 初始化 Qdrant 客户端
// useRuntimeConfig() 是 Nuxt 提供的函数，读取 nuxt.config.ts 中的 runtimeConfig
const config = useRuntimeConfig()
const client = new QdrantClient({
  url: config.qdrantUrl as string,
  apiKey: config.qdrantApiKey as string || undefined,
})

/**
 * 确保 Qdrant 集合存在
 * 如果不存在就创建一个，维度 1536 对应 OpenAI text-embedding-3-small 模型
 */
export async function ensureCollection() {
  try {
    await client.getCollection(COLLECTION_NAME)
  } catch {
    // 集合不存在，创建它
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 1536,        // 向量维度，必须和 Embedding 模型的输出维度一致
        distance: 'Cosine', // 余弦相似度，适合文本语义比较
      },
    })
    console.log(`Qdrant 集合 "${COLLECTION_NAME}" 创建成功`)
  }
}

/**
 * 存入向量
 *
 * @param vectors - 向量数组，每个元素包含 id、embedding、payload
 *   id: 唯一标识
 *   embedding: 1536 维浮点数数组
 *   payload: 附加信息（文档原文、来源文件名、块编号）
 */
export async function upsertVectors(vectors: Array<{
  id: string
  embedding: number[]
  payload: Record<string, unknown>
}>) {
  await ensureCollection()

  await client.upsert(COLLECTION_NAME, {
    points: vectors.map(v => ({
      id: v.id,
      vector: v.embedding,
      payload: v.payload,
    })),
  })
}

/**
 * 查询最相似的向量
 *
 * @param embedding - 用户问题的向量
 * @param topK - 返回最相似的前 K 个结果，默认 5
 * @returns 匹配结果数组，包含相似度分数和 payload（文档原文等）
 */
export async function queryVectors(embedding: number[], topK = 5) {
  await ensureCollection()

  const results = await client.query(COLLECTION_NAME, {
    query: embedding,
    limit: topK,
    with_payload: true,
  })

  return results.points
}

/**
 * 列出所有已导入的文档（去重）
 * 通过查询 payload 中的 source 字段获取
 */
export async function listDocuments() {
  await ensureCollection()

  // 滚动查询获取所有点的 payload
  const results = await client.scroll(COLLECTION_NAME, {
    limit: 1000,
    with_payload: true,
  })

  // 从 payload 中提取唯一的文档来源
  const sources = new Set<string>()
  for (const point of results.points) {
    const source = point.payload?.source
    if (typeof source === 'string') {
      sources.add(source)
    }
  }

  return Array.from(sources).sort()
}
```

### 3.2 创建文档分块工具

创建文件 `server/utils/chunker.ts`：

```typescript
// server/utils/chunker.ts

/**
 * Markdown 感知分块 —— 专门为技术文档设计
 *
 * 工作原理：
 *   1. 按 Markdown 标题（#、##、### 等）把文档切成"章节"
 *   2. 每个章节带上它的标题前缀，保证上下文完整
 *   3. 如果某个章节太长，再按段落细切
 *
 * @param text - Markdown 文档原文
 * @param maxChunkSize - 每块最大字符数，默认 500
 * @returns 分块后的字符串数组
 */
export function chunkMarkdown(text: string, maxChunkSize = 500): string[] {
  const sections: string[] = []
  let current = ''
  let currentHeading = ''

  for (const line of text.split('\n')) {
    if (line.startsWith('#')) {
      // 遇到新标题，先把之前的内容存起来
      if (current.trim()) sections.push(current.trim())
      currentHeading = line
      current = line + '\n'
    } else {
      current += line + '\n'
    }
  }
  // 别忘了最后一段
  if (current.trim()) sections.push(current.trim())

  // 合并过小的块，拆分过大的块
  const chunks: string[] = []
  for (const section of sections) {
    if (section.length <= maxChunkSize) {
      chunks.push(section)
    } else {
      // 章节太长，按段落切分
      let subChunk = ''
      for (const paragraph of section.split('\n\n')) {
        if ((subChunk + paragraph).length > maxChunkSize && subChunk) {
          chunks.push(subChunk.trim())
          subChunk = currentHeading + '\n' + paragraph
        } else {
          subChunk += (subChunk ? '\n\n' : '') + paragraph
        }
      }
      if (subChunk.trim()) chunks.push(subChunk.trim())
    }
  }

  return chunks
}

/**
 * 通用递归字符分块 —— 处理非 Markdown 文本
 *
 * @param text - 原始文本
 * @param chunkSize - 每块最大字符数
 * @param chunkOverlap - 相邻块重叠字符数（防止切分点丢失上下文）
 * @returns 分块后的字符串数组
 */
export function recursiveChunk(
  text: string,
  chunkSize = 500,
  chunkOverlap = 50
): string[] {
  if (text.length <= chunkSize) return [text]

  const separators = ['\n\n', '\n', '。', '，', ' ']
  const chunks: string[] = []
  let current = ''

  for (const paragraph of text.split(separators[0])) {
    if ((current + paragraph).length > chunkSize && current) {
      chunks.push(current.trim())
      current = current.slice(-chunkOverlap) + paragraph
    } else {
      current += (current ? separators[0] : '') + paragraph
    }
  }

  if (current.trim()) chunks.push(current.trim())

  // 如果还有块太长，用下一个分隔符继续切
  return chunks.flatMap(chunk =>
    chunk.length > chunkSize
      ? recursiveChunk(chunk, chunkSize, chunkOverlap)
      : [chunk]
  )
}
```

### 3.3 创建 Embedding 工具

创建文件 `server/utils/embedding.ts`：

```typescript
// server/utils/embedding.ts
import { embed } from 'ai'
import { openai } from '@ai-sdk/openai'

/**
 * 把一段文字转换为向量（Embedding）
 *
 * 使用 OpenAI 的 text-embedding-3-small 模型：
 *   - 输出 1536 维向量
 *   - 速度快、成本低（每百万 token 约 $0.02）
 *   - 质量对大多数场景够用
 *
 * @param text - 要向量化的文字
 * @returns 1536 维的浮点数数组
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text,
  })
  return embedding
}
```

### 3.4 创建文档导入 API

创建文件 `server/api/ingest.post.ts`：

```typescript
// server/api/ingest.post.ts
import { generateEmbedding } from '../utils/embedding'
import { upsertVectors } from '../utils/vector'
import { chunkMarkdown } from '../utils/chunker'
import { randomUUID } from 'crypto'

/**
 * 文档导入 API
 *
 * 接收前端上传的 Markdown 文档，执行以下流程：
 * 1. 把文档按标题切分成块
 * 2. 对每块生成 Embedding 向量
 * 3. 存入 Qdrant 向量数据库
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { content, filename } = body

  if (!content || !filename) {
    throw createError({
      statusCode: 400,
      message: '缺少 content 或 filename 字段',
    })
  }

  // 第 1 步：分块
  const chunks = chunkMarkdown(content, 500)

  // 第 2 步：对每块生成 Embedding
  const vectors = []
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i])
    vectors.push({
      id: randomUUID(),       // 生成唯一 ID
      embedding,
      payload: {
        text: chunks[i],      // 文档原文
        source: filename,     // 来源文件名
        chunk: i,             // 块编号
      },
    })
  }

  // 第 3 步：存入 Qdrant
  await upsertVectors(vectors)

  return {
    success: true,
    message: `文档 "${filename}" 导入成功，共 ${chunks.length} 个分块`,
    chunks: chunks.length,
  }
})
```

### 3.5 创建 RAG 聊天 API

创建文件 `server/api/rag-chat.post.ts`：

```typescript
// server/api/rag-chat.post.ts
import { streamText, embed } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { queryVectors, listDocuments } from '../utils/vector'
import { tool } from 'ai'
import { z } from 'zod'

export default defineLazyEventHandler(async () => {
  return defineEventHandler(async (event) => {
    const { messages } = await readBody(event)
    const lastMessage = messages[messages.length - 1]

    // ──── 第 1 步：把用户问题变成向量 ────
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: lastMessage.content,
    })

    // ──── 第 2 步：去 Qdrant 找最相关的文档块 ────
    const results = await queryVectors(embedding, 5)

    // ──── 第 3 步：构建上下文 ────
    const context = results
      .map((r, i) => {
        const source = r.payload?.source || '未知来源'
        const text = r.payload?.text || ''
        const score = r.score ? (r.score * 100).toFixed(0) : '?'
        return `[来源 ${i + 1}] ${source}（匹配度: ${score}%）\n${text}`
      })
      .join('\n\n---\n\n')

    // ──── 第 4 步：流式生成回答 ────
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: `你是 VibeFront 智能文档助手。你的职责是基于检索到的文档回答用户问题。

规则：
1. 优先基于以下检索到的文档回答，不要凭记忆回答
2. 在回答中用 [来源 N] 标注引用来源
3. 如果文档中没有相关信息，诚实地说"知识库中没有找到相关文档"
4. 用中文回答

检索到的文档:
${context}`,
      messages,
      maxTokens: 4096,
    })

    return result.toDataStreamResponse()
  })
})
```

### 3.6 创建文档上传页面

创建文件 `pages/knowledge.vue`：

```vue
<!-- pages/knowledge.vue -->
<script setup lang="ts">
// 文档列表
const documents = ref<string[]>([])
const isLoadingDocs = ref(false)

// 上传状态
const isUploading = ref(false)
const uploadResult = ref('')
const uploadError = ref('')

// 获取已导入的文档列表
async function fetchDocuments() {
  isLoadingDocs.value = true
  try {
    const data = await $fetch('/api/documents')
    documents.value = data.documents || []
  } catch (err) {
    console.error('获取文档列表失败:', err)
  } finally {
    isLoadingDocs.value = false
  }
}

// 上传文档
async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // 检查文件类型
  if (!file.name.endsWith('.md')) {
    uploadError.value = '只支持 .md（Markdown）文件'
    return
  }

  isUploading.value = true
  uploadResult.value = ''
  uploadError.value = ''

  try {
    // 读取文件内容
    const content = await file.text()

    // 调用导入 API
    const result = await $fetch('/api/ingest', {
      method: 'POST',
      body: { content, filename: file.name },
    })

    uploadResult.value = result.message
    // 刷新文档列表
    await fetchDocuments()
  } catch (err: unknown) {
    uploadError.value = err instanceof Error ? err.message : '上传失败'
  } finally {
    isUploading.value = false
    // 清空 input，允许重复上传同一文件
    input.value = ''
  }
}

// 页面加载时获取文档列表
onMounted(fetchDocuments)
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 min-h-screen bg-zinc-950">
    <!-- 页面标题 -->
    <div class="py-6 border-b border-zinc-800 mb-6">
      <h1 class="text-2xl font-bold text-zinc-100">知识库管理</h1>
      <p class="text-sm text-zinc-500 mt-1">
        上传 Markdown 文档，AI 会基于这些文档回答问题
      </p>
    </div>

    <!-- 上传区域 -->
    <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
      <h2 class="text-lg font-semibold text-zinc-200 mb-4">上传文档</h2>

      <label
        class="block border-2 border-dashed border-zinc-700 rounded-xl p-8
               text-center cursor-pointer hover:border-emerald-600
               transition-colors"
      >
        <input
          type="file"
          accept=".md"
          class="hidden"
          @change="handleFileUpload"
          :disabled="isUploading"
        />
        <div v-if="isUploading" class="text-zinc-400">
          <div class="animate-spin inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mb-2" />
          <p>正在处理文档...</p>
          <p class="text-xs text-zinc-600 mt-1">分块 → 向量化 → 存入数据库</p>
        </div>
        <div v-else class="text-zinc-400">
          <p class="text-lg mb-1">&#128206; 点击或拖拽上传</p>
          <p class="text-xs text-zinc-600">支持 .md（Markdown）格式</p>
        </div>
      </label>

      <!-- 上传结果 -->
      <div
        v-if="uploadResult"
        class="mt-4 p-3 bg-emerald-900/30 border border-emerald-700 rounded-lg text-emerald-300 text-sm"
      >
        {{ uploadResult }}
      </div>
      <div
        v-if="uploadError"
        class="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm"
      >
        {{ uploadError }}
      </div>
    </div>

    <!-- 已导入文档列表 -->
    <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-zinc-200">
          已导入文档
          <span class="text-sm text-zinc-500 font-normal ml-2">
            ({{ documents.length }} 个)
          </span>
        </h2>
        <button
          @click="fetchDocuments"
          class="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          刷新
        </button>
      </div>

      <!-- 加载中 -->
      <div v-if="isLoadingDocs" class="text-zinc-500 text-sm animate-pulse">
        加载中...
      </div>

      <!-- 空状态 -->
      <div v-else-if="documents.length === 0" class="text-center py-8">
        <p class="text-zinc-500">还没有导入任何文档</p>
        <p class="text-zinc-600 text-sm mt-1">上传你的第一个 Markdown 文档吧</p>
      </div>

      <!-- 文档列表 -->
      <div v-else class="space-y-2">
        <div
          v-for="doc in documents"
          :key="doc"
          class="flex items-center gap-3 px-4 py-3 bg-zinc-800/50 rounded-lg"
        >
          <span class="text-emerald-400">&#128196;</span>
          <span class="text-zinc-300 text-sm font-mono flex-1">{{ doc }}</span>
        </div>
      </div>
    </div>

    <!-- 导航链接 -->
    <div class="mt-6 text-center">
      <NuxtLink
        to="/"
        class="text-emerald-500 hover:text-emerald-400 text-sm transition-colors"
      >
        &larr; 返回聊天页面
      </NuxtLink>
    </div>
  </div>
</template>
```

### 3.7 创建文档列表 API

创建文件 `server/api/documents.get.ts`：

```typescript
// server/api/documents.get.ts
import { listDocuments } from '../utils/vector'

/**
 * 获取已导入的文档列表
 * 从 Qdrant 中查询所有 payload.source 字段，去重后返回
 */
export default defineEventHandler(async () => {
  const documents = await listDocuments()
  return { documents }
})
```

### 3.8 更新聊天页面，增加导航

修改 `pages/index.vue`，在标题下方添加导航链接：

在 `<template>` 中的标题区域（`<div class="py-6 border-b ...">` 内部）末尾添加：

```vue
<div class="mt-3 flex gap-4">
  <NuxtLink
    to="/knowledge"
    class="text-sm text-emerald-500 hover:text-emerald-400 transition-colors"
  >
    管理知识库 &rarr;
  </NuxtLink>
</div>
```

### 完成这一步后你应该看到

- 访问 `http://localhost:3000/knowledge`，看到文档上传界面
- 上传一个 `.md` 文件后，显示"导入成功，共 X 个分块"
- 已导入文档列表中出现刚上传的文件名
- 回到聊天页面，问一个和上传文档相关的问题，AI 能基于文档内容回答

> **卡住了？**
>
> | 问题 | 原因 | 解决方案 |
> |------|------|---------|
> | `QdrantConnectionError` | Qdrant 没启动 | 运行 `docker ps` 确认容器在运行 |
> | 上传成功但搜索没结果 | Embedding 生成失败 | 检查 `OPENAI_API_KEY` 是否正确 |
> | `useRuntimeConfig is not defined` | 在测试脚本中使用了 Nuxt API | 只在 `server/` 目录下使用 `useRuntimeConfig` |
> | 向量维度不匹配 | Qdrant 集合维度和 Embedding 模型不一致 | 删除旧集合重建：`curl -X DELETE http://localhost:6333/collections/documents` |
> | 文件上传后页面没反应 | API 报错但前端没捕获 | 打开浏览器 DevTools Console 查看错误 |

---

## 第 4 步：工具调用（Function Calling）

**你在这里：** RAG 管道已跑通，能上传文档和基于文档回答问题。

**做什么：** 给 AI 添加工具能力，让它能主动搜索知识库和列出文档，而不是被动等待 RAG 注入上下文。

### 4.1 更新 RAG 聊天 API，添加工具

用以下内容**完整替换** `server/api/rag-chat.post.ts`：

```typescript
// server/api/rag-chat.post.ts
import { streamText, embed, tool } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { queryVectors, listDocuments } from '../utils/vector'
import { z } from 'zod'

export default defineLazyEventHandler(async () => {
  return defineEventHandler(async (event) => {
    const { messages } = await readBody(event)
    const lastMessage = messages[messages.length - 1]

    // ──── 第 1 步：把用户问题变成向量 ────
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: lastMessage.content,
    })

    // ──── 第 2 步：去 Qdrant 找最相关的文档块 ────
    const results = await queryVectors(embedding, 5)

    // ──── 第 3 步：构建上下文 ────
    const context = results
      .map((r, i) => {
        const source = r.payload?.source || '未知来源'
        const text = r.payload?.text || ''
        const score = r.score ? (r.score * 100).toFixed(0) : '?'
        return `[来源 ${i + 1}] ${source}（匹配度: ${score}%）\n${text}`
      })
      .join('\n\n---\n\n')

    // ──── 第 4 步：定义工具并流式生成回答 ────
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: `你是 VibeFront 智能文档助手。你的职责是基于知识库中的文档回答用户问题。

规则：
1. 优先使用 search_knowledge 工具搜索知识库，找到相关文档后再回答
2. 在回答中用 [来源 N] 标注引用来源
3. 如果工具搜索没有结果，诚实地说"知识库中没有找到相关文档"
4. 用中文回答

以下是系统自动检索到的参考文档（如果和用户问题相关，可以直接使用）:
${context}`,
      messages,
      tools: {
        // 工具 1：搜索知识库
        search_knowledge: tool({
          description: '搜索知识库中的文档。当用户问到技术问题时，使用此工具查找相关文档来回答。',
          parameters: z.object({
            query: z.string().describe('搜索关键词，如 "Vue Composition API"、"Nuxt 路由"'),
          }),
          execute: async ({ query }) => {
            // 把搜索词向量化
            const { embedding: queryEmbedding } = await embed({
              model: openai.embedding('text-embedding-3-small'),
              value: query,
            })

            // 在 Qdrant 中搜索
            const searchResults = await queryVectors(queryEmbedding, 5)

            return {
              count: searchResults.length,
              results: searchResults.map((r, i) => ({
                rank: i + 1,
                source: r.payload?.source || '未知来源',
                text: r.payload?.text || '',
                score: r.score ? `${(r.score * 100).toFixed(0)}%` : '未知',
              })),
            }
          },
        }),

        // 工具 2：列出已导入的文档
        get_document_list: tool({
          description: '获取知识库中已导入的所有文档列表。当用户问"有哪些文档"、"知识库里有什么"时使用。',
          parameters: z.object({}),
          execute: async () => {
            const docs = await listDocuments()
            return {
              count: docs.length,
              documents: docs,
            }
          },
        }),
      },
      maxTokens: 4096,
    })

    return result.toDataStreamResponse()
  })
})
```

### 4.2 更新前端，渲染工具调用

用以下内容**完整替换** `pages/index.vue`：

```vue
<!-- pages/index.vue -->
<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'

const { messages, input, handleSubmit, isLoading, error, stop } = useChat({
  api: '/api/rag-chat',
  onError: (err) => {
    console.error('聊天出错:', err)
  },
})

// 工具名称到中文的映射
const toolNameMap: Record<string, string> = {
  search_knowledge: '搜索知识库',
  get_document_list: '获取文档列表',
}

function formatToolName(name: string) {
  return toolNameMap[name] || name
}
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 min-h-screen flex flex-col bg-zinc-950">
    <!-- 页面标题 -->
    <div class="py-6 border-b border-zinc-800 mb-6">
      <h1 class="text-2xl font-bold text-zinc-100">
        智能文档助手
        <span class="text-sm font-normal text-zinc-500 ml-2">v2.0</span>
      </h1>
      <p class="text-sm text-zinc-500 mt-1">
        基于 RAG + Function Calling 的全栈 AI 应用
      </p>
      <div class="mt-3 flex gap-4">
        <NuxtLink
          to="/knowledge"
          class="text-sm text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          管理知识库 &rarr;
        </NuxtLink>
      </div>
    </div>

    <!-- 错误提示 -->
    <div
      v-if="error"
      class="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm"
    >
      出错了：{{ error.message }}
    </div>

    <!-- 消息列表 -->
    <div class="flex-1 overflow-y-auto space-y-6 pb-4">
      <!-- 空状态 -->
      <div v-if="messages.length === 0" class="text-center py-20">
        <div class="text-4xl mb-4">&#128218;</div>
        <p class="text-zinc-400">你好！我是智能文档助手。</p>
        <p class="text-zinc-500 text-sm mt-1">我会自动搜索知识库来回答你的问题。</p>
        <div class="mt-6 flex flex-wrap gap-2 justify-center">
          <span class="text-xs bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full">
            "知识库里有哪些文档？"
          </span>
          <span class="text-xs bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full">
            "帮我查一下 Vue Composition API"
          </span>
        </div>
      </div>

      <!-- 消息列表 -->
      <div v-for="msg in messages" :key="msg.id">
        <!-- 用户消息 -->
        <div v-if="msg.role === 'user'" class="flex justify-end">
          <div class="bg-emerald-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%]">
            {{ msg.content }}
          </div>
        </div>

        <!-- AI 回答 -->
        <div v-else class="space-y-3">
          <!-- 工具调用展示 -->
          <div
            v-for="invocation in msg.toolInvocations"
            :key="invocation.toolCallId"
            class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
          >
            <!-- 工具标题栏 -->
            <div class="flex items-center gap-2 px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800">
              <span class="text-emerald-400 text-sm">
                {{ formatToolName(invocation.toolName) }}
              </span>
              <span class="text-xs text-zinc-600 font-mono">
                {{ invocation.toolName }}
              </span>
              <span
                v-if="invocation.state === 'call'"
                class="ml-auto text-xs text-amber-400 animate-pulse"
              >
                执行中...
              </span>
              <span v-else class="ml-auto text-xs text-emerald-500">
                完成
              </span>
            </div>

            <!-- 工具参数 -->
            <div class="px-4 py-2 border-b border-zinc-800/50">
              <div class="text-xs text-zinc-500 mb-1">参数</div>
              <pre class="text-xs text-zinc-400 font-mono overflow-x-auto whitespace-pre-wrap">{{
                JSON.stringify(invocation.args, null, 2)
              }}</pre>
            </div>

            <!-- 工具结果 -->
            <div v-if="invocation.state === 'result'" class="px-4 py-2">
              <div class="text-xs text-zinc-500 mb-1">返回结果</div>
              <pre class="text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">{{
                JSON.stringify(invocation.result, null, 2)
              }}</pre>
            </div>
          </div>

          <!-- AI 文本回答 -->
          <div
            v-if="msg.content"
            class="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3"
          >
            <div class="text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {{ msg.content }}
            </div>
          </div>
        </div>
      </div>

      <!-- 加载提示 -->
      <div v-if="isLoading" class="text-zinc-500 text-sm animate-pulse">
        AI 正在思考...
      </div>
    </div>

    <!-- 输入框 -->
    <form @submit="handleSubmit" class="flex gap-2 pt-4 border-t border-zinc-800">
      <input
        v-model="input"
        type="text"
        placeholder="输入你的问题..."
        class="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3
               text-zinc-200 placeholder-zinc-600
               focus:outline-none focus:border-emerald-600 transition-colors"
        :disabled="isLoading"
      />
      <button
        type="submit"
        :disabled="isLoading || !input.trim()"
        class="px-6 py-3 bg-emerald-600 text-white rounded-xl
               hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed
               transition-colors font-medium"
      >
        发送
      </button>
      <button
        v-if="isLoading"
        type="button"
        @click="stop"
        class="px-4 py-3 bg-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-600 transition-colors"
      >
        停止
      </button>
    </form>
  </div>
</template>
```

### 4.3 测试工具调用

重启开发服务器，打开 `http://localhost:3000`：

1. 先去 `http://localhost:3000/knowledge` 上传一个 Markdown 文档
2. 回到聊天页面，输入"知识库里有哪些文档？"
3. 你应该看到：
   - 一个工具调用卡片出现，显示"获取文档列表"
   - 卡片展开显示返回结果（文档列表）
   - AI 基于结果生成回答

4. 再输入一个技术问题，你应该看到"搜索知识库"工具被调用

### 完成这一步后你应该看到

- AI 能主动调用 `search_knowledge` 搜索知识库
- AI 能调用 `get_document_list` 列出已导入的文档
- 工具调用过程在 UI 中完整展示（参数、状态、结果）
- AI 的回答基于工具返回的真实数据，而不是凭记忆

> **卡住了？**
>
> | 问题 | 原因 | 解决方案 |
> |------|------|---------|
> | AI 不调用工具，直接回答 | AI 有时认为自己已经知道答案 | 在 system prompt 中强调"必须使用工具" |
> | 工具调用卡片不显示 | `msg.toolInvocations` 是 undefined | 确认 `useChat` 的 api 路径指向 `rag-chat` |
> | 工具执行报错 | Embedding 生成失败 | 检查 `OPENAI_API_KEY` |
> | 工具结果为空 | 知识库里没有文档 | 先去 knowledge 页面上传文档 |

---

## 第 5 步：外部集成（MCP）

**你在这里：** 聊天、RAG、工具调用全部跑通。

**做什么：** 创建一个 MCP Server，让 Claude Code 也能搜索你的知识库。

### 5.1 创建 MCP Server

创建文件 `mcp-server/index.ts`：

```typescript
// mcp-server/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { QdrantClient } from '@qdrant/js-client-rest'
import { z } from 'zod'

// ============================================
// 1. 创建 Server 实例
// ============================================
const server = new McpServer({
  name: 'smart-docs-assistant',
  version: '1.0.0',
})

// Qdrant 客户端（从环境变量读取配置）
const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333'
const qdrantApiKey = process.env.QDRANT_API_KEY || ''
const COLLECTION_NAME = 'documents'

const qdrant = new QdrantClient({
  url: qdrantUrl,
  apiKey: qdrantApiKey || undefined,
})

// OpenAI 客户端（用原生 fetch 调用，避免引入额外依赖）
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  })

  const data = await response.json()
  return data.data[0].embedding
}

// ============================================
// 2. 工具：搜索知识库
// ============================================
server.tool(
  'search_knowledge',
  '搜索智能文档助手的知识库。输入关键词，返回最相关的文档片段。',
  {
    query: z.string().describe('搜索关键词，例如 "Vue Composition API"'),
    top_k: z.number().optional().default(5).describe('返回结果数量，默认 5'),
  },
  async ({ query, top_k }) => {
    try {
      // 把搜索词向量化
      const embedding = await generateEmbedding(query)

      // 在 Qdrant 中搜索
      const results = await qdrant.query(COLLECTION_NAME, {
        query: embedding,
        limit: top_k,
        with_payload: true,
      })

      if (results.points.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `没有找到与 "${query}" 相关的文档。知识库可能为空，请先通过 Web 界面上传文档。`,
          }],
        }
      }

      const formatted = results.points
        .map((r, i) => {
          const source = r.payload?.source || '未知来源'
          const text = r.payload?.text || ''
          const score = r.score ? `${(r.score * 100).toFixed(0)}%` : '未知'
          return `[${i + 1}] ${source}（匹配度: ${score}）\n${text}`
        })
        .join('\n\n---\n\n')

      return {
        content: [{
          type: 'text',
          text: `找到 ${results.points.length} 个相关文档片段：\n\n${formatted}`,
        }],
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `搜索失败: ${error instanceof Error ? error.message : '未知错误'}。请确认 Qdrant 和 OpenAI 配置正确。`,
        }],
      }
    }
  }
)

// ============================================
// 3. 工具：列出已导入的文档
// ============================================
server.tool(
  'list_documents',
  '列出知识库中已导入的所有文档。无需参数。',
  {},
  async () => {
    try {
      const results = await qdrant.scroll(COLLECTION_NAME, {
        limit: 1000,
        with_payload: true,
      })

      const sources = new Set<string>()
      for (const point of results.points) {
        const source = point.payload?.source
        if (typeof source === 'string') {
          sources.add(source)
        }
      }

      const docs = Array.from(sources).sort()

      return {
        content: [{
          type: 'text',
          text: docs.length
            ? `知识库中共有 ${docs.length} 个文档：\n${docs.map((d, i) => `${i + 1}. ${d}`).join('\n')}`
            : '知识库为空，请先通过 Web 界面上传文档。',
        }],
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `获取文档列表失败: ${error instanceof Error ? error.message : '未知错误'}`,
        }],
      }
    }
  }
)

// ============================================
// 4. 启动 Server
// ============================================
const transport = new StdioServerTransport()
await server.connect(transport)
```

### 5.2 注册 MCP Server

在项目根目录创建（或编辑）`.mcp.json`：

```json
{
  "mcpServers": {
    "smart-docs": {
      "command": "npx",
      "args": ["tsx", "./mcp-server/index.ts"],
      "env": {
        "OPENAI_API_KEY": "${OPENAI_API_KEY}",
        "QDRANT_URL": "http://localhost:6333"
      }
    }
  }
}
```

`${OPENAI_API_KEY}` 是占位符，Claude Code 会自动从你的环境变量中读取。

### 5.3 验证 MCP Server

在终端运行：

```bash
claude mcp list
```

你应该看到：

```
smart-docs: npx tsx ./mcp-server/index.ts
```

然后启动 Claude Code：

```bash
claude
```

试着问它：

```
帮我看看智能文档助手的知识库里有什么文档
```

Claude 会调用你的 `list_documents` 工具。如果返回了文档列表，说明 MCP Server 工作正常。

再试试：

```
搜索知识库里关于 Vue 的文档
```

Claude 会调用 `search_knowledge` 工具，返回相关文档片段。

### 完成这一步后你应该看到

- `claude mcp list` 显示你的 MCP Server
- Claude Code 能调用 `search_knowledge` 搜索知识库
- Claude Code 能调用 `list_documents` 列出文档

> **卡住了？**
>
> | 问题 | 原因 | 解决方案 |
> |------|------|---------|
> | `claude` 命令找不到 | Claude Code 没装 | `npm install -g @anthropic-ai/claude-code` |
> | MCP Server 连接失败 | tsx 没装或路径不对 | `npm install -g tsx`，确认 `.mcp.json` 中路径正确 |
> | 搜索报错 | OpenAI API Key 没传入 | 检查 `.mcp.json` 中的 env 配置 |
> | Qdrant 连接失败 | Qdrant 没启动 | `docker ps` 确认容器在运行 |

---

## 第 6 步：端到端联调

**你在这里：** 所有模块都已单独跑通。

**做什么：** 测试完整流程，排查集成问题，了解性能优化。

### 6.1 完整流程测试

按以下顺序测试：

**测试 1：文档上传**

1. 访问 `http://localhost:3000/knowledge`
2. 上传一个 Markdown 文档（可以是本教程的内容）
3. 确认显示"导入成功"
4. 确认文档列表中出现刚上传的文件

**测试 2：RAG 检索**

1. 访问 `http://localhost:3000`
2. 问一个和上传文档相关的问题
3. 确认 AI 调用了 `search_knowledge` 工具
4. 确认回答中引用了文档内容（有 [来源 N] 标注）

**测试 3：工具调用**

1. 输入"知识库里有哪些文档？"
2. 确认 AI 调用了 `get_document_list` 工具
3. 确认返回了正确的文档列表

**测试 4：MCP 集成**

1. 在终端运行 `claude`
2. 问"搜索知识库里关于 XXX 的文档"
3. 确认 Claude Code 调用了 MCP Server 的工具
4. 确认返回了正确的搜索结果

### 6.2 常见集成问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| RAG 检索结果不相关 | 文档分块太大或太小 | 调整 `chunkMarkdown` 的 `maxChunkSize` 参数（建议 300-800） |
| AI 回答很慢 | 向量检索 + Embedding + LLM 三步串行 | 考虑缓存热门问题的 Embedding |
| 工具调用返回空结果 | 知识库里没文档或 Embedding 维度不匹配 | 先确认 Qdrant 集合维度是 1536 |
| 前端工具卡片闪烁 | 流式传输时 toolInvocations 多次更新 | 这是正常行为，不需要修复 |
| MCP Server 启动超时 | tsx 冷启动慢 | 第一次调用会慢，后续调用会快 |

### 6.3 性能优化建议

| 优化方向 | 具体做法 | 效果 |
|----------|---------|------|
| Embedding 缓存 | 对相同问题缓存 Embedding 结果，避免重复调用 OpenAI | 减少 API 调用，降低成本 |
| 批量 Embedding | 导入文档时一次传入多个文本块 | OpenAI 支持批量，速度更快 |
| Qdrant 索引 | 对 payload 字段建立索引 | 加速过滤查询 |
| 流式工具结果 | 工具执行时间长时，分段返回中间结果 | 改善用户体验 |
| 连接池 | 复用 Qdrant 客户端实例 | 减少连接开销 |

### 完成这一步后你应该看到

- 从文档上传到 RAG 检索到工具调用到流式回答，整个流程顺畅运行
- MCP Server 让 Claude Code 也能访问知识库
- 没有报错，没有卡顿

---

## 动手练习

完成教程后，试试以下练习巩固所学：

### 练习 1：添加"总结文档"工具

给聊天 API 添加一个 `summarize_document` 工具：

- 功能：对指定文档生成摘要
- 参数：`document_name`（文档名称）
- 实现：从 Qdrant 中检索该文档的所有分块，拼接后发给 AI 生成摘要

提示：

```typescript
summarize_document: tool({
  description: '对指定文档生成摘要',
  parameters: z.object({
    document_name: z.string().describe('文档名称'),
  }),
  execute: async ({ document_name }) => {
    // 1. 从 Qdrant 检索该文档的所有分块
    // 2. 拼接分块内容
    // 3. 调用 AI 生成摘要
    // 4. 返回摘要
  },
})
```

### 练习 2：添加对话历史持久化

目前刷新页面后聊天记录会丢失。利用 `useChat` 的 `id` 参数和 `localStorage` 实现持久化：

```typescript
const { messages, input, handleSubmit, isLoading, error, stop } = useChat({
  api: '/api/rag-chat',
  id: 'smart-docs-chat', // 固定 ID，刷新后自动恢复消息
})
```

进一步挑战：把对话历史存到服务端（比如 JSON 文件或数据库），支持多会话切换。

### 练习 3：添加"文档质量评分"功能

创建一个 `score_document` 工具：

- 功能：评估文档的质量（结构完整性、代码示例数量、可读性）
- 参数：`document_name`（文档名称）
- 返回：一个 0-100 的分数和改进建议

实现思路：检索文档所有分块，让 AI 从以下维度打分：
- 是否有清晰的标题结构（10 分）
- 是否有代码示例（20 分）
- 是否有错误处理说明（20 分）
- 内容是否过时（20 分）
- 可读性如何（30 分）

### 练习 4：添加 Reranking 优化检索质量

在 RAG 检索流程中加入 Reranking 步骤：

1. 向量检索取 top 20 个候选
2. 用 Reranking 模型从 20 个中挑出最好的 5 个
3. 用 Reranking 后的结果生成回答

参考路线 04 的 Reranking 章节实现。

---

## 最终项目结构

完成所有步骤后，你的项目目录应该是这样的：

```
smart-docs-assistant/
├── .env                              ← API Key 配置
├── .mcp.json                         ← MCP Server 注册
├── nuxt.config.ts                    ← Nuxt 配置（含 runtimeConfig）
├── package.json                      ← 依赖列表
├── mcp-server/
│   └── index.ts                      ← MCP Server（让 Claude Code 访问知识库）
├── server/
│   ├── api/
│   │   ├── chat.post.ts              ← 基础聊天 API
│   │   ├── rag-chat.post.ts          ← RAG + 工具调用聊天 API
│   │   ├── ingest.post.ts            ← 文档导入 API
│   │   └── documents.get.ts          ← 文档列表 API
│   └── utils/
│       ├── chunker.ts                ← 文档分块工具
│       ├── embedding.ts              ← Embedding 生成工具
│       └── vector.ts                 ← Qdrant 向量数据库客户端
└── pages/
    ├── index.vue                     ← 聊天页面（含工具调用渲染）
    └── knowledge.vue                 ← 知识库管理页面
```

---

## 本节要点

1. **集成的关键是"串"不是"堆"** — 把 RAG、Function Calling、MCP 串成一条数据流，而不是简单地堆在一起
2. **先跑通基础，再逐步增强** — 先做纯聊天，确认能跑，再加 RAG，再加工具，最后加 MCP
3. **RAG 是被动注入，Function Calling 是主动调用** — 两者配合使用效果最好
4. **MCP 让知识库能力跨客户端复用** — 写一次 Server，Claude Code、Cursor、你的应用都能用
5. **分块质量决定检索质量** — 技术文档按 Markdown 标题分块效果最好
6. **工具描述要写清楚** — AI 靠描述决定何时调用，描述不清等于工具没用
7. **Qdrant 是本地友好的向量数据库** — Docker 一键启动，不需要注册云服务

---

## 常见踩坑

**Q: 上传了文档但 RAG 检索不到？**
A: 检查三件事：(1) Qdrant 集合是否存在（`curl http://localhost:6333/collections`）；(2) Embedding 维度是否匹配（必须是 1536）；(3) 检索的 query 和文档内容是否有关联。

**Q: AI 不调用工具，直接凭记忆回答？**
A: 在 system prompt 中明确要求"必须使用 search_knowledge 工具"。也可以在工具描述中加上触发条件。

**Q: MCP Server 启动报错 `Cannot find module`？**
A: 确认 `@modelcontextprotocol/sdk` 和 `@qdrant/js-client-rest` 已安装在主项目的 `package.json` 中。MCP Server 运行时会使用主项目的 `node_modules`。

**Q: 前端工具调用卡片显示"执行中"一直不结束？**
A: 可能是工具执行时间过长或报错了。检查终端里的服务端日志。如果 Qdrant 或 OpenAI 响应慢，考虑添加超时处理。

**Q: Docker 容器重启后数据丢失？**
A: Qdrant 默认把数据存在容器内。要持久化数据，启动时挂载卷：`docker run -d --name qdrant -p 6333:6333 -v qdrant_storage:/qdrant/storage qdrant/qdrant`。

---

**上一篇：** [MCP 协议深度拆解：前端开发者视角](/roadmap/05-mcp-protocol)
**下一篇：** [架构决策与生产部署](/playground/05-architecture-decisions)
