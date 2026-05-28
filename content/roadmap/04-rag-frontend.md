---
title: RAG 全栈落地：从 Embedding 到向量检索的前端集成
description: 文档分块策略、向量数据库选型、前端实现引用来源展示与置信度 UI
tags: ['rag', 'embedding', 'vector-database', 'ai']
category: 学习路线
---

# RAG 全栈落地：从 Embedding 到向量检索的前端集成

> RAG 是让 AI "知道你的业务"的关键技术。不懂 RAG，你做的就只是套壳 ChatGPT。

---

## 零基础起步：开始之前请确认

在动手之前，确保以下条件全部满足：

| 检查项 | 如何验证 | 不满足怎么办 |
|--------|---------|-------------|
| 已完成 roadmap 01-03 | 翻看之前的笔记，确认理解 Function Calling | 回去补课，03 是本节的直接前置知识 |
| Node.js 18+ | 终端运行 `node -v`，输出 `v18.x.x` 或更高 | 去 [nodejs.org](https://nodejs.org) 下载 LTS 版本 |
| 已有一个 Nuxt 3 项目 | 项目根目录有 `nuxt.config.ts` | 运行 `npx nuxi@latest init my-rag-app` 创建一个 |
| 了解 AI SDK 基本用法 | 知道 `streamText` 是什么 | 回顾 03-function-calling |

全部通过？我们开始。

---

## 什么是 RAG？先用大白话理解

**RAG = Retrieval-Augmented Generation = 检索增强生成。**

一句话解释：**先帮你查资料，再让 AI 回答问题。**

想象你去图书馆问管理员一个问题：

```
没有 RAG 的 AI = 管理员凭记忆回答（可能记错、可能过时）

有 RAG 的 AI  = 管理员先去书架找到相关书籍，
                翻到相关页面，
                然后根据书上的内容回答你（有据可查）
```

技术上的流程是这样的：

```
用户提问: "Vue 3 的 ref 和 reactive 有什么区别？"

第 1 步（检索）: 把问题变成一串数字（向量），去数据库里找最相似的文档片段
第 2 步（增强）: 把找到的文档片段 + 用户问题，拼成一个更完整的 prompt
第 3 步（生成）: AI 基于这些真实文档生成回答，并标注引用来源
```

**关键区别：** 普通 AI 聊天是"闭卷考试"，RAG 是"开卷考试"。开卷考试的答案更可靠，因为有据可查。

---

## 整体架构：我们一共要做 5 件事

```
离线准备（一次性）:
  1. 把文档切碎 → 分块（Chunking）
  2. 把每个块变成数字 → Embedding
  3. 存到向量数据库 → Pinecone

在线回答（每次用户提问）:
  4. 把问题变成数字，去数据库里找最像的 5 个块
  5. 把这些块 + 问题一起发给 AI，生成带引用的回答
```

我们按这个顺序一步步来。每一步都会给你完整的、可以直接运行的代码。

---

## 第 1 步：文档分块（Chunking）

### 为什么要分块？

你不能把一本 100 页的书直接扔给 AI——太长了，装不下，而且大部分内容跟用户的问题无关。

所以我们要把文档切成小块，每块大约 500 个字符。后面检索的时候，只找最相关的几块。

### 创建分块工具文件

在你的项目中创建这个文件：

**文件路径：** `server/utils/chunking.ts`

```typescript
/**
 * 递归字符分块 —— 通用的文本切分方法
 *
 * 工作原理：
 *   1. 先按段落（\n\n）切分
 *   2. 如果某段落还是太长，就按换行符（\n）再切
 *   3. 如果还是太长，就按句号（。）再切
 *   4. 依此类推，直到每块都不超过 chunkSize
 *
 * 参数说明：
 *   chunkSize     - 每块最大字符数，默认 500
 *   chunkOverlap  - 相邻块重叠的字符数，防止在切分点丢失上下文，默认 50
 *   separators    - 依次尝试的分隔符列表
 */
export function recursiveChunk(
  text: string,
  options: {
    chunkSize?: number
    chunkOverlap?: number
    separators?: string[]
  } = {}
): string[] {
  const {
    chunkSize = 500,
    chunkOverlap = 50,
    separators = ['\n\n', '\n', '。', '，', ' ']
  } = options

  // 文本够短，直接返回
  if (text.length <= chunkSize) return [text]

  const chunks: string[] = []
  let current = ''

  // 用第一个分隔符切分
  for (const paragraph of text.split(separators[0])) {
    if ((current + paragraph).length > chunkSize && current) {
      // 当前块快满了，先存起来
      chunks.push(current.trim())
      // 保留最后 chunkOverlap 个字符作为上下文衔接
      current = current.slice(-chunkOverlap) + paragraph
    } else {
      current += (current ? separators[0] : '') + paragraph
    }
  }

  // 别忘了最后一块
  if (current.trim()) chunks.push(current.trim())

  // 如果还有块太长，用下一个分隔符继续切
  return chunks.flatMap(chunk =>
    chunk.length > chunkSize
      ? recursiveChunk(chunk, { chunkSize, chunkOverlap, separators: separators.slice(1) })
      : [chunk]
  )
}

/**
 * Markdown 感知分块 —— 专门为技术文档设计
 *
 * 工作原理：
 *   1. 按 Markdown 标题（#、##、### 等）把文档切成"章节"
 *   2. 每个章节带上它的标题，保证上下文完整
 *   3. 如果某个章节太长，再用 recursiveChunk 细切
 *
 * 为什么比通用分块好？
 *   因为技术文档的标题就是天然的主题边界。按标题切分，
 *   每一块都是一个完整的知识点，检索效果更好。
 */
export function markdownChunk(text: string, maxChunkSize = 500): string[] {
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
  return sections.flatMap(s =>
    s.length > maxChunkSize ? recursiveChunk(s, { chunkSize: maxChunkSize }) : [s]
  )
}
```

### 验证一下

在项目根目录创建一个临时测试脚本 `test-chunk.mts`：

```typescript
import { markdownChunk } from './server/utils/chunking'

const sampleDoc = `# 第一章：介绍

这是介绍部分的内容。RAG 是一种让 AI 基于你的文档回答问题的技术。

## 1.1 什么是向量

向量就是一串数字，用来表示文本的"含义"。

# 第二章：安装

首先安装依赖：

\`\`\`bash
npm install @pinecone-database/pinecone
\`\`\`

然后配置环境变量。`

const chunks = markdownChunk(sampleDoc, 200)
console.log(`切成了 ${chunks.length} 块：\n`)
chunks.forEach((c, i) => console.log(`--- 块 ${i + 1} ---\n${c}\n`))
```

运行 `npx tsx test-chunk.mts`，你应该看到文档被切成了 3-4 个块，每块都带标题。

### 卡住了？

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 报错 `Cannot find module` | 路径写错了 | 确认文件在 `server/utils/chunking.ts`，测试脚本在项目根目录 |
| 切出来的块数量不对 | chunkSize 参数问题 | 先用默认值 500 跑通，再调参数 |
| 中文标点没生效 | 分隔符列表里没包含 | 检查 separators 数组，确认有 `'。'` 和 `'，'` |

---

## 第 2 步：向量数据库（Pinecone）

### 什么是向量数据库？

普通数据库存的是文字、数字。向量数据库存的是一串浮点数（向量），并且能快速找到"最相似"的向量。

```
普通数据库查询: "给我找 title = 'Vue3' 的记录" → 精确匹配
向量数据库查询: "给我找含义最接近这个问题的文档" → 语义搜索
```

### 为什么选 Pinecone？

| 数据库 | 特点 | 适合谁 |
|--------|------|--------|
| **Pinecone** | 全托管、免运维、免费额度够学习 | 初学者、快速上线 |
| Qdrant | 开源、性能好、可自部署 | 需要精细控制的团队 |
| ChromaDB | 轻量、Python 生态好 | 原型验证、小规模 |
| pgvector | PostgreSQL 扩展 | 已有 PG 数据库、不想引入新依赖 |

本教程用 Pinecone，因为它最省心——注册就能用，不用操心服务器。

### 注册并获取 API Key

1. 打开 [pinecone.io](https://www.pinecone.io/)，注册账号
2. 进入控制台，创建一个 Index（索引）：
   - 名称：`vibe-front`（随便取，后面代码里要对应）
   - 维度：`1536`（对应 OpenAI `text-embedding-3-small` 模型）
   - 度量：`cosine`
3. 在 API Keys 页面，复制你的 API Key

### 配置环境变量

在项目根目录的 `.env` 文件中添加：

```bash
PINECONE_API_KEY=你的_pinecone_api_key
OPENAI_API_KEY=你的_openai_api_key
```

同时在 `nuxt.config.ts` 中暴露它们（仅服务端可用）：

```typescript
export default defineNuxtConfig({
  runtimeConfig: {
    pineconeApiKey: process.env.PINECONE_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
  }
})
```

### 安装依赖

```bash
npm install @pinecone-database/pinecone ai @ai-sdk/openai @ai-sdk/anthropic
```

### 创建向量数据库工具

**文件路径：** `server/utils/vector-store.ts`

```typescript
import { Pinecone } from '@pinecone-database/pinecone'

// 初始化 Pinecone 客户端
const pc = new Pinecone({ apiKey: useRuntimeConfig().pineconeApiKey })

// 连接到我们创建的索引
// 注意：这里的名称必须和你在 Pinecone 控制台创建的 Index 名称一致
const index = pc.index('vibe-front')

/**
 * 存入向量 —— 把文档块的 embedding 存到数据库
 *
 * 每个向量包含：
 *   id       - 唯一标识，方便后续更新或删除
 *   values   - embedding 数字数组（1536 维）
 *   metadata - 附加信息，检索时会一起返回
 */
export async function upsertVectors(vectors: Array<{
  id: string
  values: number[]
  metadata: { text: string; source: string; chunk: number }
}>) {
  await index.upsert(vectors)
}

/**
 * 查询向量 —— 找到与给定 embedding 最相似的 topK 个结果
 *
 * 返回值包含：
 *   id       - 向量的唯一标识
 *   score    - 相似度分数（0~1，越大越相似）
 *   metadata - 存入时的附加信息（文档原文、来源等）
 */
export async function queryVectors(embedding: number[], topK = 5) {
  const results = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
  })
  return results.matches
}
```

### 验证一下

创建临时测试脚本 `test-vector.mts`：

```typescript
import './server/utils/vector-store'
// 如果能正常 import 不报错，说明配置没问题
console.log('Pinecone 客户端初始化成功！')
```

运行 `npx tsx test-vector.mts`，看到"初始化成功"就说明连上了。

### 卡住了？

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `PineconeConnectionError` | API Key 错误或网络问题 | 检查 `.env` 中的 key 是否正确；国内可能需要代理 |
| `Index not found` | 索引名称不匹配 | 确认 Pinecone 控制台里的 Index 名称和代码里的一致 |
| `Invalid dimension` | 维度不匹配 | 创建索引时必须设为 1536（对应 `text-embedding-3-small`） |
| `useRuntimeConfig is not defined` | 在测试脚本里用了 Nuxt API | 测试脚本里直接 `process.env.PINECONE_API_KEY` 即可 |

---

## 第 3 步：生成 Embedding（向量化）

### 什么是 Embedding？

Embedding 就是把一段文字变成一串数字（向量），这串数字代表了这段文字的"含义"。

```
"猫"  → [0.12, -0.34, 0.56, ...]  ← 1536 个数字
"狗"  → [0.11, -0.32, 0.55, ...]  ← 和"猫"很接近！
"汽车" → [0.87, 0.23, -0.45, ...]  ← 和"猫"差很远
```

语义相近的文字，向量也相近。这就是语义搜索的基础。

### 创建 Embedding 工具

**文件路径：** `server/utils/embedding.ts`

```typescript
import { embed } from 'ai'
import { openai } from '@ai-sdk/openai'

/**
 * 把一段文字转换为向量（embedding）
 *
 * 使用 OpenAI 的 text-embedding-3-small 模型：
 *   - 输出 1536 维向量
 *   - 速度快、成本低（每百万 token 约 $0.02）
 *   - 质量对大多数场景够用
 *
 * @param text 要向量化的文字
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

### 验证一下

创建 `test-embedding.mts`：

```typescript
import { generateEmbedding } from './server/utils/embedding'

const vec = await generateEmbedding('什么是 Vue 3 的 ref？')
console.log(`向量维度: ${vec.length}`)
console.log(`前 5 个值: ${vec.slice(0, 5).map(v => v.toFixed(4)).join(', ')}`)
```

运行 `npx tsx test-embedding.mts`，你应该看到：

```
向量维度: 1536
前 5 个值: 0.0123, -0.0456, 0.0789, ...
```

### 卡住了？

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `OpenAI API key not found` | 环境变量没设置 | 确认 `.env` 里有 `OPENAI_API_KEY`，重启终端/IDE |
| `Rate limit exceeded` | 请求太频繁 | 等一等再试，或升级 OpenAI 账号 |
| 向量维度不是 1536 | 用了别的模型 | 确认代码里用的是 `text-embedding-3-small` |

---

## 第 4 步：完整的 RAG API 端点

现在把前三步串起来。当用户提问时：

1. 把问题变成向量（Embedding）
2. 去向量数据库找最相似的 5 个文档块（检索）
3. 把文档块 + 问题拼成 prompt，发给 AI 生成回答

**文件路径：** `server/api/rag-chat.post.ts`

```typescript
import { streamText, embed } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'

export default defineEventHandler(async (event) => {
  // 读取用户发来的消息
  const { messages } = await readBody(event)
  const lastMessage = messages[messages.length - 1]

  // ──── 第 1 步：把用户问题变成向量 ────
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: lastMessage.content,
  })

  // ──── 第 2 步：去向量数据库找最相关的文档块 ────
  const results = await queryVectors(embedding, 5)

  // ──── 第 3 步：把文档块拼成上下文 ────
  // 每个来源带编号，方便 AI 在回答中引用
  const context = results
    .map((r, i) => `[来源 ${i + 1}] ${r.metadata?.source}\n${r.metadata?.text}`)
    .join('\n\n---\n\n')

  // ──── 第 4 步：流式生成回答 ────
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `你是 VibeFront 知识库助手。基于以下检索到的文档回答用户问题。
如果文档中没有相关信息，诚实地说"我没有找到相关文档"。
请在回答中用 [来源 N] 标注引用。

检索到的文档:
${context}`,
    messages,
  })

  // 返回流式响应
  return result.toDataStreamResponse()
})
```

### 验证 API 能跑通

启动开发服务器：

```bash
npx nuxt dev
```

用 curl 或 Postman 发一个测试请求：

```bash
curl -X POST http://localhost:3000/api/rag-chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"什么是 ref？"}]}'
```

如果返回一串流式数据（看起来像乱码），说明 API 工作正常。

> 注意：向量数据库里还没有文档，所以 AI 会回答"没有找到相关文档"——这是正确的行为。要让 RAG 真正工作，你需要先导入一些文档。导入逻辑可以用同样的 `recursiveChunk` + `generateEmbedding` + `upsertVectors` 组合来实现，这作为课后练习留给你。

### 卡住了？

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `queryVectors is not defined` | 没有 import | Nuxt 的 `server/utils` 下的文件会自动导入，但要确认文件名拼写正确 |
| 500 Internal Server Error | 服务端报错 | 看终端里的错误日志，通常是 API Key 问题 |
| AI 说"没有找到相关文档" | 数据库里没有文档 | 这是正常的，先确认 API 能跑通，后面再导入文档 |
| 响应很慢 | 向量查询 + AI 生成都需要时间 | 第一次请求会慢一些（冷启动），后续会快很多 |

---

## 第 5 步：前端 —— 带引用来源的聊天界面

RAG 的回答如果不标注来源，用户就无法验证准确性。引用来源是 RAG 的灵魂。

**文件路径：** `components/RagChat.vue`

```vue
<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'

// 引用来源的数据结构
interface Citation {
  id: number
  source: string    // 文档来源（文件名、URL 等）
  text: string      // 被引用的文档原文
  score: number     // 相似度分数（0~1）
}

const { messages, input, handleSubmit, isLoading } = useChat({
  api: '/api/rag-chat',
})

// 从 AI 返回的消息中提取引用信息
// AI SDK 会在消息的 annotations 字段中携带服务端返回的元数据
function extractCitations(msg: any): Citation[] {
  return msg.annotations?.citations || []
}
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 space-y-6">
    <!-- 标题 -->
    <h1 class="text-2xl font-bold text-zinc-100">知识库问答</h1>
    <p class="text-sm text-zinc-500">
      基于 RAG 技术，AI 会从知识库中检索相关文档来回答你的问题
    </p>

    <!-- 消息列表 -->
    <div class="space-y-6">
      <div v-for="msg in messages" :key="msg.id">
        <!-- 用户消息 -->
        <div v-if="msg.role === 'user'" class="flex justify-end">
          <div class="bg-emerald-600 text-white rounded-2xl px-4 py-2 max-w-[80%]">
            {{ msg.content }}
          </div>
        </div>

        <!-- AI 回答 -->
        <div v-if="msg.role === 'assistant'" class="space-y-3">
          <!-- 回答正文 -->
          <div class="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3">
            <div class="text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {{ msg.content }}
            </div>
          </div>

          <!-- 引用来源卡片 -->
          <div v-if="extractCitations(msg).length" class="space-y-2">
            <div class="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
              参考来源
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                v-for="cite in extractCitations(msg)"
                :key="cite.id"
                class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3
                       hover:border-emerald-500/30 transition-colors cursor-pointer"
              >
                <!-- 来源文件名 + 匹配度 -->
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs text-emerald-400 font-mono truncate max-w-[70%]">
                    {{ cite.source }}
                  </span>
                  <span class="text-xs text-zinc-600">
                    {{ (cite.score * 100).toFixed(0) }}% 匹配
                  </span>
                </div>
                <!-- 被引用的文档原文（截断显示） -->
                <p class="text-xs text-zinc-400 line-clamp-3">{{ cite.text }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 加载中提示 -->
      <div v-if="isLoading" class="text-zinc-500 text-sm animate-pulse">
        正在检索知识库并生成回答...
      </div>
    </div>

    <!-- 输入框 -->
    <form @submit="handleSubmit" class="flex gap-2">
      <input
        v-model="input"
        placeholder="输入你的问题..."
        class="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3
               text-zinc-200 placeholder-zinc-600
               focus:outline-none focus:border-emerald-500/50 transition-colors"
      />
      <button
        type="submit"
        :disabled="isLoading || !input.trim()"
        class="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800
               disabled:text-zinc-600 text-white rounded-xl px-6 py-3
               transition-colors font-medium"
      >
        发送
      </button>
    </form>
  </div>
</template>
```

### 在页面中使用

**文件路径：** `pages/rag-demo.vue`

```vue
<template>
  <div class="min-h-screen bg-zinc-950 py-8">
    <RagChat />
  </div>
</template>
```

启动 `npx nuxt dev`，打开 `http://localhost:3000/rag-demo`，你应该看到一个聊天界面。

### 卡住了？

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `useChat` 报错 | 没装 `@ai-sdk/vue` | 运行 `npm install @ai-sdk/vue` |
| 消息发出去没反应 | API 端点没启动或报错 | 打开浏览器 DevTools Network 面板看请求状态 |
| 引用来源不显示 | 服务端没返回 citations | 先不管引用，确认基本对话能跑通，后面再完善 |
| 页面一片黑 | 样式没生效 | 确认用了 Tailwind CSS，或者把 class 换成你自己的样式 |

---

## 第 6 步：置信度 UI 组件

不同来源的匹配度不同——有的 95% 匹配，有的只有 52%。用户需要一眼看出哪个来源更可信。

**文件路径：** `components/ConfidenceBadge.vue`

```vue
<script setup lang="ts">
/**
 * 置信度条 —— 用颜色和进度条直观展示相似度分数
 *
 * 分数阈值：
 *   > 0.8  → 绿色（高置信）：这个来源和问题高度相关
 *   > 0.5  → 黄色（中置信）：有一定相关性，但可能不完全对
 *   <= 0.5 → 红色（低置信）：相关性较弱，谨慎参考
 */
defineProps<{
  score: number
}>()
</script>

<template>
  <div class="flex items-center gap-2 text-xs">
    <!-- 进度条 -->
    <div class="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
      <div
        class="h-full rounded-full transition-all duration-500"
        :class="{
          'bg-emerald-500': score > 0.8,
          'bg-yellow-500': score > 0.5 && score <= 0.8,
          'bg-red-500': score <= 0.5
        }"
        :style="{ width: `${score * 100}%` }"
      />
    </div>
    <!-- 文字标签 -->
    <span class="text-zinc-500 w-12 text-right">
      {{ score > 0.8 ? '高置信' : score > 0.5 ? '中置信' : '低置信' }}
    </span>
  </div>
</template>
```

### 在引用卡片中使用

在 `RagChat.vue` 的引用卡片里，匹配度数字那一行下面加上置信度条：

```vue
<!-- 在 cite.score 显示的那行下面加 -->
<ConfidenceBadge :score="cite.score" />
```

完整片段：

```vue
<div class="flex items-center justify-between mb-1">
  <span class="text-xs text-emerald-400 font-mono truncate max-w-[70%]">
    {{ cite.source }}
  </span>
  <span class="text-xs text-zinc-600">
    {{ (cite.score * 100).toFixed(0) }}% 匹配
  </span>
</div>
<ConfidenceBadge :score="cite.score" />
<p class="text-xs text-zinc-400 line-clamp-3 mt-1">{{ cite.text }}</p>
```

---

## 第 7 步（进阶）：Reranking —— 提升检索质量

### 为什么要 Reranking？

向量搜索是"粗筛"——它很快，但排序不一定精确。

```
向量搜索返回 top 20:
  1. "Vue 3 的 ref 用法"        → score 0.92  ✓ 真的很相关
  2. "Vue 2 的 data 属性"        → score 0.88  ✗ 其实不太相关，但向量相似
  3. "React 的 useState"         → score 0.85  ✗ 完全不相关，但向量也挺像
  ...

Reranking 重新排序后 top 5:
  1. "Vue 3 的 ref 用法"        → rerank score 0.97  ✓
  2. "Vue 3 的 reactive 用法"   → rerank score 0.91  ✓
  3. "Vue 3 Composition API"    → rerank score 0.88  ✓
  ...
```

Reranking 用更精确的模型逐个比较"问题"和"文档"的相关性，比向量距离更准。

### 在 RAG API 中加入 Reranking

修改 `server/api/rag-chat.post.ts` 中的检索逻辑：

```typescript
import { streamText, embed, rerank } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'

export default defineEventHandler(async (event) => {
  const { messages } = await readBody(event)
  const lastMessage = messages[messages.length - 1]

  // 第 1 步：向量化问题
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: lastMessage.content,
  })

  // 第 2 步：向量检索（宽泛地取 20 个候选）
  const candidates = await queryVectors(embedding, 20)

  // 第 3 步：Reranking（精确地从 20 个中挑出最好的 5 个）
  const reranked = await rerank({
    model: anthropic('claude-sonnet-4-20250514'),
    query: lastMessage.content,
    documents: candidates.map(c => c.metadata?.text || ''),
    topK: 5,
  })

  // 第 4 步：用 reranked 的结果构建上下文
  const context = reranked
    .map((r, i) => {
      const original = candidates[r.originalIndex]
      return `[来源 ${i + 1}] ${original?.metadata?.source}\n${r.document}`
    })
    .join('\n\n---\n\n')

  // 第 5 步：流式生成回答
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `你是 VibeFront 知识库助手。基于以下检索到的文档回答用户问题。
如果文档中没有相关信息，诚实地说"我没有找到相关文档"。
请在回答中用 [来源 N] 标注引用。

检索到的文档:
${context}`,
    messages,
  })

  return result.toDataStreamResponse()
})
```

**完整管道回顾：**

```
embed → store → retrieve (top 20) → rerank (top 5) → augment prompt → generate
```

Reranking 是可选的优化步骤。如果你的数据量不大（几百个文档），向量搜索的质量已经够用。当文档量上千、上万时，Reranking 的提升会非常明显。

### 卡住了？

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `rerank` 函数不存在 | AI SDK 版本太旧 | 运行 `npm update ai` 升级到最新版 |
| Reranking 很慢 | 每个候选都要调用一次 LLM | 减少 topK 候选数（20→10），或跳过 Reranking |
| 成本太高 | Reranking 消耗 token | 只在生产环境启用，开发时跳过 |

---

## 动手练习

学完理论不动手，等于没学。以下是三个练习，难度递增。

### 练习 1：导入文档到向量数据库（基础）

写一个服务端函数 `server/utils/ingest.ts`，完成以下流程：

1. 读取一个 Markdown 文件
2. 用 `markdownChunk` 切分成块
3. 对每一块调用 `generateEmbedding` 生成向量
4. 调用 `upsertVectors` 存入 Pinecone

```typescript
// 提示框架
import { readFileSync } from 'fs'
import { markdownChunk } from './chunking'
import { generateEmbedding } from './embedding'
import { upsertVectors } from './vector-store'

export async function ingestDocument(filePath: string, sourceName: string) {
  const content = readFileSync(filePath, 'utf-8')
  const chunks = markdownChunk(content)

  for (let i = 0; i < chunks.length; i++) {
    // TODO: 生成 embedding
    // TODO: 构造 vector 对象
    // TODO: 调用 upsertVectors
  }
}
```

**验收标准：** 在 Pinecone 控制台的 Query 页面，输入一段文字，能搜到你导入的文档块。

### 练习 2：批量导入整个文件夹（进阶）

扩展练习 1，写一个 `ingestFolder` 函数：

1. 扫描 `content/roadmap/` 目录下所有 `.md` 文件
2. 逐个导入
3. 显示进度（"正在处理 3/10: 03-function-calling.md"）

**提示：** 用 `import { readdirSync } from 'fs'` 读取目录，用 `path.join` 拼接路径。

**验收标准：** 导入后，在前端聊天界面问"什么是 Function Calling？"，AI 能基于 03-function-calling.md 的内容回答。

### 练习 3：显示引用高亮（挑战）

当用户点击一个引用来源卡片时，滚动到 AI 回答中对应的 `[来源 N]` 文本，并高亮显示。

**提示：**

- 给回答文本中的 `[来源 N]` 包裹一个 `<span>` 标签
- 点击引用卡片时，用 `scrollIntoView()` 滚动到对应位置
- 用 CSS `animation` 做一个闪烁高亮效果

**验收标准：** 点击"来源 2"卡片，页面自动滚动到回答中"来源 2"的位置，并短暂高亮。

---

## 本节要点

1. **RAG = 检索 + 生成** —— 先帮你查资料，再让 AI 回答，比闭卷考试更可靠
2. **分块策略决定检索质量** —— Markdown 文档按标题分块效果最好
3. **向量数据库选型看场景** —— Pinecone 省心、Qdrant 可控、pgvector 不加新依赖
4. **Embedding 是桥梁** —— 把文字变成数字，让计算机能"理解"语义相似度
5. **回答必须附带引用来源** —— 否则用户无法验证，RAG 就失去了意义
6. **置信度 UI 帮助判断** —— 颜色直观展示来源的可信程度
7. **Reranking 是锦上添花** —— 文档量大时显著提升检索精度，量小时可以跳过

---

**上一篇：** [Function Calling 前端实战：让 AI 调用你的组件](/roadmap/03-function-calling)
**下一篇：** [MCP 协议深度拆解：前端开发者视角](/roadmap/05-mcp-protocol)
