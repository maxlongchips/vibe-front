---
title: RAG 知识库集成
description: 文档上传、分块、Embedding、向量存储全链路、语义搜索 UI、引用来源卡片
tags: ['实战', 'rag', 'vector-database', 'embedding']
category: 实战演练
---

# 实战 03：RAG 知识库集成

> 让 AI 能"读懂"你的文档，这才是 RAG 的价值。

## 整体流程

```
用户上传文档
  ↓
分块 (Chunking)
  ↓
生成 Embedding
  ↓
存入向量数据库
  ↓
用户提问 → 向量检索 → 拼接上下文 → LLM 生成回答
```

## 第一步：文档上传 API

```typescript
// server/api/ingest.post.ts
import { readFile } from 'fs/promises'
import { join } from 'path'
import { markdownChunk } from '../utils/chunker'
import { generateEmbedding } from '../utils/embedding'
import { upsertVectors } from '../utils/vector'

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  const file = formData?.find(f => f.name === 'file')

  if (!file || !file.filename) {
    throw createError({ statusCode: 400, message: '请上传文件' })
  }

  // 1. 读取文件内容
  const content = file.data.toString('utf-8')

  // 2. 分块
  const chunks = markdownChunk(content, { chunkSize: 500, chunkOverlap: 50 })

  // 3. 为每个分块生成 Embedding
  const vectors = await Promise.all(
    chunks.map(async (chunk, index) => {
      const embedding = await generateEmbedding(chunk)
      return {
        id: `${file.filename}-${index}`,
        values: embedding,
        metadata: {
          text: chunk,
          source: file.filename,
          chunk: index,
          totalChunks: chunks.length,
        },
      }
    })
  )

  // 4. 存入向量数据库
  await upsertVectors(vectors)

  return {
    success: true,
    message: `已处理 ${chunks.length 个分块`,
    chunks: chunks.length,
  }
})
```

## 第二步：文档分块工具

```typescript
// server/utils/chunker.ts
interface ChunkOptions {
  chunkSize?: number
  chunkOverlap?: number
  separators?: string[]
}

export function markdownChunk(text: string, options: ChunkOptions = {}): string[] {
  const { chunkSize = 500, chunkOverlap = 50 } = options

  // 按标题分割
  const sections: { heading: string; content: string }[] = []
  let currentHeading = ''
  let currentContent = ''

  for (const line of text.split('\n')) {
    if (line.startsWith('#')) {
      if (currentContent.trim()) {
        sections.push({ heading: currentHeading, content: currentContent.trim() })
      }
      currentHeading = line
      currentContent = line + '\n'
    } else {
      currentContent += line + '\n'
    }
  }
  if (currentContent.trim()) {
    sections.push({ heading: currentHeading, content: currentContent.trim() })
  }

  // 合并过小的块，拆分过大的块
  const chunks: string[] = []
  let buffer = ''

  for (const section of sections) {
    if (buffer.length + section.content.length > chunkSize && buffer) {
      chunks.push(buffer.trim())
      buffer = buffer.slice(-chunkOverlap) + section.content
    } else {
      buffer += (buffer ? '\n\n' : '') + section.content
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim())

  // 递归拆分超长块
  return chunks.flatMap(chunk =>
    chunk.length > chunkSize
      ? splitBySize(chunk, chunkSize, chunkOverlap)
      : [chunk]
  )
}

function splitBySize(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    chunks.push(text.slice(start, start + size))
    start += size - overlap
  }
  return chunks
}
```

## 第三步：向量数据库集成

```typescript
// server/utils/vector.ts
import { QdrantClient } from '@qdrant/js-client-rest'

const config = useRuntimeConfig()
const client = new QdrantClient({ url: config.vectorDbUrl })

const COLLECTION_NAME = 'knowledge-base'

// 初始化集合
export async function initCollection() {
  try {
    await client.getCollection(COLLECTION_NAME)
  } catch {
    await client.createCollection(COLLECTION_NAME, {
      vectors: { size: 1536, distance: 'Cosine' },
    })
  }
}

// 写入向量
export async function upsertVectors(vectors: Array<{
  id: string
  values: number[]
  metadata: Record<string, any>
}>) {
  await client.upsert(COLLECTION_NAME, {
    points: vectors.map(v => ({
      id: v.id,
      vector: v.values,
      payload: v.metadata,
    })),
  })
}

// 查询向量
export async function queryVectors(embedding: number[], topK = 5) {
  const results = await client.search(COLLECTION_NAME, {
    vector: embedding,
    limit: topK,
    with_payload: true,
  })
  return results
}
```

## 第四步：RAG Chat API（带引用）

```typescript
// server/api/rag-chat.post.ts
import { streamText, embed } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'

export default defineEventHandler(async (event) => {
  const { messages } = await readBody(event)
  const lastMessage = messages[messages.length - 1]

  // 1. 生成问题的 Embedding
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: lastMessage.content,
  })

  // 2. 向量检索
  const results = await queryVectors(embedding, 5)

  // 3. 构建上下文
  const context = results
    .map((r, i) => `[来源 ${i + 1}: ${r.payload?.source}]\n${r.payload?.text}`)
    .join('\n\n---\n\n')

  // 4. 生成回答（附带引用信息）
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `你是知识库助手。基于以下文档回答问题。

规则：
1. 只基于提供的文档回答，不要编造
2. 在回答末尾列出引用来源，格式：[来源 N] 文件名
3. 如果文档中没有相关信息，说"知识库中没有找到相关内容"

检索到的文档：
${context}`,
    messages,
    maxTokens: 4096,
  })

  return result.toDataStreamResponse()
})
```

## 第五步：引用来源 UI

```vue
<!-- components/chat/CitationPanel.vue -->
<script setup lang="ts">
import { FileText, ExternalLink } from 'lucide-vue-next'

interface Citation {
  source: string
  text: string
  score: number
}

defineProps<{ citations: Citation[] }>()
</script>

<template>
  <div v-if="citations.length" class="mt-4 space-y-2">
    <div class="text-xs text-zinc-500 uppercase tracking-wider flex items-center gap-2">
      <FileText class="w-3 h-3" />
      参考来源
    </div>
    <div class="grid grid-cols-1 gap-2">
      <div
        v-for="(cite, index) in citations"
        :key="index"
        class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3
               hover:border-emerald-500/30 transition-colors group"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono">
              来源 {{ index + 1 }}
            </span>
            <span class="text-xs text-emerald-400 font-mono truncate">
              {{ cite.source }}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <div
              class="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden"
            >
              <div
                class="h-full rounded-full"
                :class="{
                  'bg-emerald-500': cite.score > 0.8,
                  'bg-yellow-500': cite.score > 0.5,
                  'bg-red-500': cite.score <= 0.5,
                }"
                :style="{ width: `${cite.score * 100}%` }"
              />
            </div>
            <span class="text-xs text-zinc-600">
              {{ (cite.score * 100).toFixed(0) }}%
            </span>
          </div>
        </div>
        <p class="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
          {{ cite.text }}
        </p>
      </div>
    </div>
  </div>
</template>
```

## 知识库管理页面

```vue
<!-- pages/knowledge.vue -->
<script setup lang="ts">
import { Upload, File, Trash2 } from 'lucide-vue-next'

const uploading = ref(false)
const files = ref<string[]>([])

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    await $fetch('/api/ingest', { method: 'POST', body: formData })
    files.value.push(file.name)
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto p-8">
    <h1 class="text-2xl font-bold text-zinc-100 mb-6">知识库管理</h1>

    <!-- 上传区域 -->
    <label
      class="block border-2 border-dashed border-zinc-700 rounded-xl p-8
             text-center cursor-pointer hover:border-emerald-500/50 transition-colors"
    >
      <Upload class="w-8 h-8 text-zinc-500 mx-auto mb-3" />
      <p class="text-zinc-400">
        {{ uploading ? '上传中...' : '点击或拖拽上传 Markdown 文件' }}
      </p>
      <input
        type="file"
        accept=".md,.txt"
        class="hidden"
        @change="handleUpload"
        :disabled="uploading"
      />
    </label>

    <!-- 文件列表 -->
    <div class="mt-8 space-y-2">
      <div
        v-for="file in files"
        :key="file"
        class="flex items-center justify-between px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg"
      >
        <div class="flex items-center gap-3">
          <File class="w-4 h-4 text-zinc-500" />
          <span class="text-sm text-zinc-300">{{ file }}</span>
        </div>
        <button class="text-zinc-500 hover:text-red-400 transition-colors">
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>
```

## 本节成果

- 文档上传 → 分块 → Embedding 全链路
- 向量数据库读写
- RAG Chat API（带引用信息）
- 引用来源 UI（置信度展示）
- 知识库管理页面

**上一步：** [对话引擎核心](/playground/02-chat-engine)
**下一步：** [Agent 能力扩展与上线部署](/playground/04-agent-deploy)
