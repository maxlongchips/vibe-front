---
title: RAG 全栈落地：从 Embedding 到向量检索的前端集成
description: 文档分块策略、向量数据库选型、前端实现引用来源展示与置信度 UI
tags: ['rag', 'embedding', 'vector-database', 'ai']
category: 学习路线
---

# RAG 全栈落地：从 Embedding 到向量检索的前端集成

> RAG 是让 AI "知道你的业务"的关键技术。不懂 RAG，你做的就只是套壳 ChatGPT。

## 什么是 RAG？

RAG（Retrieval-Augmented Generation）= 检索增强生成。

```
用户提问: "Vue 3 的 ref 和 reactive 有什么区别？"

传统 LLM: 靠训练数据回答（可能过时、可能幻觉）

RAG 流程:
  1. 把问题转为向量 → [0.12, -0.34, 0.56, ...]
  2. 在向量数据库中搜索相似文档
  3. 找到相关文档片段
  4. 把文档片段 + 用户问题一起发给 LLM
  5. LLM 基于真实文档生成回答
```

## RAG 架构全景

```
索引阶段（离线）:
  文档 → 分块(Chunking) → Embedding → 向量数据库

检索阶段（在线）:
  用户问题 → Embedding → 向量搜索 → Top-K 结果
  → 拼接 Prompt → LLM 生成 → 带引用的回答
```

## 第一步：文档分块策略

分块是 RAG 质量的第一道关。分得太大，检索不精确；分得太小，丢失上下文。

### 推荐：递归字符分块

```typescript
// server/utils/chunking.ts
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

  if (text.length <= chunkSize) return [text]

  const chunks: string[] = []
  let current = ''

  for (const paragraph of text.split(separators[0])) {
    if ((current + paragraph).length > chunkSize && current) {
      chunks.push(current.trim())
      // 保留 overlap
      current = current.slice(-chunkOverlap) + paragraph
    } else {
      current += (current ? separators[0] : '') + paragraph
    }
  }

  if (current.trim()) chunks.push(current.trim())

  // 递归处理超长块
  return chunks.flatMap(chunk =>
    chunk.length > chunkSize
      ? recursiveChunk(chunk, { chunkSize, chunkOverlap, separators: separators.slice(1) })
      : [chunk]
  )
}
```

### Markdown 感知分块

对于技术文档，按标题分块更合理：

```typescript
export function markdownChunk(text: string, maxChunkSize = 500): string[] {
  const sections: string[] = []
  let current = ''
  let currentHeading = ''

  for (const line of text.split('\n')) {
    if (line.startsWith('#')) {
      if (current.trim()) sections.push(current.trim())
      currentHeading = line
      current = line + '\n'
    } else {
      current += line + '\n'
    }
  }
  if (current.trim()) sections.push(current.trim())

  // 合并过小的块，拆分过大的块
  return sections.flatMap(s =>
    s.length > maxChunkSize ? recursiveChunk(s, { chunkSize: maxChunkSize }) : [s]
  )
}
```

## 第二步：向量数据库选型

| 数据库 | 特点 | 适用场景 |
|--------|------|----------|
| **Pinecone** | 全托管、免运维 | 快速上线、不想管基础设施 |
| **Qdrant** | 开源、性能好 | 自部署、需要精细控制 |
| **ChromaDB** | 轻量、Python 生态 | 原型验证、小规模 |
| **pgvector** | PostgreSQL 扩展 | 已有 PG、不想引入新依赖 |

### 使用 Pinecone

```bash
npm install @pinecone-database/pinecone
```

```typescript
// server/utils/vector-store.ts
import { Pinecone } from '@pinecone-database/pinecone'

const pc = new Pinecone({ apiKey: useRuntimeConfig().pineconeApiKey })
const index = pc.index('vibe-front')

export async function upsertVectors(vectors: Array<{
  id: string
  values: number[]
  metadata: { text: string; source: string; chunk: number }
}>) {
  await index.upsert(vectors)
}

export async function queryVectors(embedding: number[], topK = 5) {
  const results = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
  })
  return results.matches
}
```

## 第三步：Embedding 生成

```typescript
// server/utils/embedding.ts
import { embed } from 'ai'
import { openai } from '@ai-sdk/openai'

export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text,
  })
  return embedding
}
```

## 第四步：完整的 RAG API

```typescript
// server/api/rag-chat.post.ts
import { streamText, embed } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'

export default defineEventHandler(async (event) => {
  const { messages } = await readBody(event)
  const lastMessage = messages[messages.length - 1]

  // 1. 生成问题的 embedding
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: lastMessage.content,
  })

  // 2. 向量检索
  const results = await queryVectors(embedding, 5)

  // 3. 构建上下文
  const context = results
    .map((r, i) => `[来源 ${i + 1}] ${r.metadata?.source}\n${r.metadata?.text}`)
    .join('\n\n---\n\n')

  // 4. 流式生成回答
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `你是 VibeFront 知识库助手。基于以下检索到的文档回答用户问题。
如果文档中没有相关信息，诚实地说"我没有找到相关文档"。

检索到的文档:
${context}`,
    messages,
  })

  return result.toDataStreamResponse()
})
```

## 前端：引用来源展示

RAG 的回答必须展示引用来源，否则用户无法验证准确性。

```vue
<script setup lang="ts">
interface Citation {
  id: number
  source: string
  text: string
  score: number
}

const { messages, input, handleSubmit } = useChat({
  api: '/api/rag-chat',
})

// 从消息中提取引用
function extractCitations(msg: any): Citation[] {
  // 假设服务端在 metadata 中返回引用信息
  return msg.annotations?.citations || []
}
</script>

<template>
  <div class="space-y-6">
    <div v-for="msg in messages" :key="msg.id">
      <!-- AI 回答 -->
      <div v-if="msg.role === 'assistant'" class="space-y-4">
        <div class="text-zinc-200 leading-relaxed">{{ msg.content }}</div>

        <!-- 引用来源卡片 -->
        <div v-if="extractCitations(msg).length" class="space-y-2">
          <div class="text-xs text-zinc-500 uppercase tracking-wider">参考来源</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div
              v-for="cite in extractCitations(msg)"
              :key="cite.id"
              class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3
                     hover:border-emerald-500/30 transition-colors"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-emerald-400 font-mono truncate">
                  {{ cite.source }}
                </span>
                <span class="text-xs text-zinc-600">
                  {{ (cite.score * 100).toFixed(0) }}% 匹配
                </span>
              </div>
              <p class="text-xs text-zinc-400 line-clamp-3">{{ cite.text }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

## 置信度 UI

```vue
<template>
  <div class="flex items-center gap-2 text-xs">
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
    <span class="text-zinc-500">
      {{ score > 0.8 ? '高置信' : score > 0.5 ? '中置信' : '低置信' }}
    </span>
  </div>
</template>

<script setup lang="ts">
defineProps<{ score: number }>()
</script>
```

## Reranking：提升检索质量的关键

向量搜索返回的 top-K 结果不一定按相关性排序。Reranking 用更精确的模型重新排序：

```typescript
import { rerank } from 'ai'

// 第一步：向量检索（宽泛，取 20 个候选）
const candidates = await queryVectors(embedding, 20)

// 第二步：Reranking（精确，取 top 5）
const reranked = await rerank({
  model: anthropic('claude-sonnet-4-20250514'),
  query: userQuestion,
  documents: candidates.map(c => c.metadata.text),
  topK: 5,
})

// 第三步：用 reranked 的结果构建上下文
const context = reranked
  .map((r, i) => `[来源 ${i + 1}] ${r.document}`)
  .join('\n\n---\n\n')
```

完整管道：`embed → store → retrieve → rerank → augment prompt → generate`

## 本节要点

1. RAG = 检索 + 生成，让 AI 基于你的知识库回答
2. 分块策略决定检索质量，Markdown 文档按标题分块
3. 向量数据库选型看场景：Pinecone 省心、Qdrant 可控
4. 回答必须附带引用来源，用户需要验证
5. 置信度 UI 帮助用户判断回答可靠性
6. Reranking 是提升检索质量的关键步骤

---

**上一篇：** [Function Calling 前端实战：让 AI 调用你的组件](/roadmap/03-function-calling)
**下一篇：** [MCP 协议深度拆解：前端开发者视角](/roadmap/05-mcp-protocol)
