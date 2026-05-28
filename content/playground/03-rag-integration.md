---
title: RAG 知识库集成
description: 文档上传、分块、Embedding、向量存储全链路、语义搜索 UI、引用来源卡片
tags: ['实战', 'rag', 'vector-database', 'embedding']
category: 实战演练
---

# 实战 03：RAG 知识库集成

> 让 AI 能"读懂"你的文档，这才是 RAG 的价值。

---

## 零基础起步

开始本节之前，确认以下准备工作已完成：

```bash
# 1. 确认你在正确的项目目录下
pwd
# 期望输出包含：ai-doc-assistant

# 2. 确认前两节的代码能正常运行
npm run dev
# 打开 http://localhost:3000 能正常对话

# 3. 确认有 OpenAI API Key（用于生成 Embedding）
cat .env | grep OPENAI_API_KEY
# 应该看到：OPENAI_API_KEY=sk-...
```

**还没有 OpenAI API Key？** 去 [platform.openai.com](https://platform.openai.com) 注册获取。这个 Key 用来把文本转成向量（Embedding），不是用来聊天的。

**Qdrant 向量数据库还没装？** 下面会教你用 Docker 安装。

确认以上全部就绪后，我们开始构建 RAG 知识库。

---

## 第一步：安装向量数据库（Qdrant）

我们用 Qdrant 作为向量数据库，它负责存储和检索文档向量。

```bash
# 用 Docker 启动 Qdrant（确保你已安装 Docker）
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

**验证 Qdrant 是否启动成功：**

```bash
curl http://localhost:6333/healthz
```

**你应该看到：** 返回 `ok` 或空响应（HTTP 200），说明 Qdrant 运行正常。

**完成这一步后你应该看到：**
- Docker 中有一个名为 `qdrant` 的容器在运行
- `http://localhost:6333` 可以访问

### 卡住了？

| 问题 | 解决办法 |
|------|----------|
| `docker` 命令不存在 | 去 [docker.com](https://www.docker.com/products/docker-desktop) 安装 Docker Desktop |
| 容器启动失败 | 检查端口是否被占用：`netstat -ano | findstr 6333`（Windows）或 `lsof -i :6333`（Mac/Linux） |
| Docker 下载镜像很慢 | 配置 Docker 镜像加速器，搜索 "Docker 中国镜像加速" |

---

## 第二步：安装依赖并配置环境变量

```bash
# 安装 Qdrant 客户端和 OpenAI SDK（用于 Embedding）
npm install @qdrant/js-client-rest @ai-sdk/openai
```

在 `.env` 文件中添加 OpenAI API Key 和 Qdrant 地址：

```
# .env（追加以下内容）
OPENAI_API_KEY=sk-proj-你的OpenAI密钥
VECTOR_DB_URL=http://localhost:6333
```

更新 `nuxt.config.ts`，让 Nuxt 读取新变量：

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    anthropicApiKey: '',
    openaiApiKey: '',        // 新增
    vectorDbUrl: '',         // 新增
    public: {
      appName: 'AI Doc Assistant',
    },
  },
})
```

**完成这一步后你应该看到：**
- `.env` 文件中有 3 个 Key
- `nuxt.config.ts` 已更新

---

## 第三步：创建向量数据库工具

这个文件封装了所有和 Qdrant 交互的逻辑：初始化集合、写入向量、查询向量。

创建文件 `server/utils/vector.ts`：

```typescript
// server/utils/vector.ts
import { QdrantClient } from '@qdrant/js-client-rest'

const config = useRuntimeConfig()
const client = new QdrantClient({ url: config.vectorDbUrl })

const COLLECTION_NAME = 'knowledge-base'

// 初始化集合（如果不存在就创建）
export async function initCollection() {
  try {
    await client.getCollection(COLLECTION_NAME)
    console.log(`集合 ${COLLECTION_NAME} 已存在`)
  } catch {
    await client.createCollection(COLLECTION_NAME, {
      vectors: { size: 1536, distance: 'Cosine' },
    })
    console.log(`集合 ${COLLECTION_NAME} 创建成功`)
  }
}

// 写入向量数据
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

// 查询相似向量
export async function queryVectors(embedding: number[], topK = 5) {
  const results = await client.search(COLLECTION_NAME, {
    vector: embedding,
    limit: topK,
    with_payload: true,
  })
  return results
}

// 获取所有文档列表
export async function getAllDocuments() {
  const collection = await client.getCollection(COLLECTION_NAME)
  // 简化实现：返回集合信息
  return [{
    name: 'knowledge-base',
    chunkCount: collection.points_count || 0,
  }]
}
```

**代码解释：**
- `initCollection` 创建一个叫 `knowledge-base` 的集合，向量维度 1536（和 OpenAI `text-embedding-3-small` 模型匹配）
- `upsertVectors` 把向量数据写入数据库
- `queryVectors` 根据一个向量，找出最相似的 topK 条记录

**完成这一步后你应该看到：**
- `server/utils/vector.ts` 文件已创建

### 卡住了？

| 问题 | 解决办法 |
|------|----------|
| `QdrantClient` 报连接错误 | 确认 Qdrant Docker 容器在运行：`docker ps` |
| 报 `useRuntimeConfig is not defined` | 这是 Nuxt 的自动导入，IDE 可能误报，实际运行不会出错 |

---

## 第四步：创建文档分块工具

长文档不能直接塞给 AI，需要先切成小块（Chunk）。这个工具按 Markdown 标题和长度来切分。

创建文件 `server/utils/chunker.ts`：

```typescript
// server/utils/chunker.ts
interface ChunkOptions {
  chunkSize?: number
  chunkOverlap?: number
}

export function markdownChunk(text: string, options: ChunkOptions = {}): string[] {
  const { chunkSize = 500, chunkOverlap = 50 } = options

  // 第一步：按 Markdown 标题（#）分割成段落
  const sections: { heading: string; content: string }[] = []
  let currentHeading = ''
  let currentContent = ''

  for (const line of text.split('\n')) {
    if (line.startsWith('#')) {
      // 遇到新标题，把之前的内容存起来
      if (currentContent.trim()) {
        sections.push({ heading: currentHeading, content: currentContent.trim() })
      }
      currentHeading = line
      currentContent = line + '\n'
    } else {
      currentContent += line + '\n'
    }
  }
  // 别忘了最后一段
  if (currentContent.trim()) {
    sections.push({ heading: currentHeading, content: currentContent.trim() })
  }

  // 第二步：合并过小的段落，拆分过大的段落
  const chunks: string[] = []
  let buffer = ''

  for (const section of sections) {
    if (buffer.length + section.content.length > chunkSize && buffer) {
      // 当前缓冲区加上新内容会超长，先把缓冲区存起来
      chunks.push(buffer.trim())
      // 保留一部分重叠内容，保持上下文连贯
      buffer = buffer.slice(-chunkOverlap) + section.content
    } else {
      buffer += (buffer ? '\n\n' : '') + section.content
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim())

  // 第三步：对仍然超长的块做二次切分
  return chunks.flatMap(chunk =>
    chunk.length > chunkSize
      ? splitBySize(chunk, chunkSize, chunkOverlap)
      : [chunk]
  )
}

// 按固定长度切分文本
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

**完成这一步后你应该看到：**
- `server/utils/chunker.ts` 文件已创建

---

## 第五步：创建 Embedding 工具

Embedding 就是把文本变成一组数字（向量），这样就能用数学方法计算"两段话有多像"。

创建文件 `server/utils/embedding.ts`：

```typescript
// server/utils/embedding.ts
import { embed } from 'ai'
import { openai } from '@ai-sdk/openai'

// 把一段文本转成向量
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text,
  })
  return embedding
}

// 批量生成向量（一次最多处理一批文本）
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const results = await Promise.all(texts.map(t => generateEmbedding(t)))
  return results
}
```

**完成这一步后你应该看到：**
- `server/utils/embedding.ts` 文件已创建

---

## 第六步：创建文档上传 API

这个 API 接收上传的 Markdown 文件，然后：读取内容 -> 切块 -> 生成向量 -> 存入数据库。

创建文件 `server/api/ingest.post.ts`：

```typescript
// server/api/ingest.post.ts
import { markdownChunk } from '../utils/chunker'
import { generateEmbedding } from '../utils/embedding'
import { upsertVectors, initCollection } from '../utils/vector'

export default defineEventHandler(async (event) => {
  // 1. 读取上传的文件
  const formData = await readMultipartFormData(event)
  const file = formData?.find(f => f.name === 'file')

  if (!file || !file.filename) {
    throw createError({ statusCode: 400, message: '请上传文件' })
  }

  // 2. 确保向量数据库集合已初始化
  await initCollection()

  // 3. 读取文件内容
  const content = file.data.toString('utf-8')

  // 4. 切分成小块
  const chunks = markdownChunk(content, { chunkSize: 500, chunkOverlap: 50 })

  // 5. 为每个块生成向量
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

  // 6. 存入向量数据库
  await upsertVectors(vectors)

  return {
    success: true,
    message: `已处理 ${chunks.length} 个分块`,
    chunks: chunks.length,
  }
})
```

**完成这一步后你应该看到：**
- `server/api/ingest.post.ts` 文件已创建

---

## 第七步：创建 RAG Chat API

和普通的 Chat API 不同，RAG 版本会先检索知识库，把相关内容拼进提示词，再让 AI 回答。

创建文件 `server/api/rag-chat.post.ts`：

```typescript
// server/api/rag-chat.post.ts
import { streamText, embed } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { queryVectors } from '../utils/vector'

export default defineEventHandler(async (event) => {
  const { messages } = await readBody(event)
  const lastMessage = messages[messages.length - 1]

  // 1. 把用户的问题转成向量
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: lastMessage.content,
  })

  // 2. 在向量数据库中搜索最相关的 5 条内容
  const results = await queryVectors(embedding, 5)

  // 3. 把搜索到的内容拼成上下文
  const context = results
    .map((r, i) => `[来源 ${i + 1}: ${r.payload?.source}]\n${r.payload?.text}`)
    .join('\n\n---\n\n')

  // 4. 调用 AI，把上下文塞进系统提示词
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

**代码解释：**
- 第 1 步：把用户问题变成向量
- 第 2 步：用这个向量去数据库找最相似的文档块
- 第 3 步：把找到的文档块拼成一段"参考资料"
- 第 4 步：让 AI 根据这些资料来回答，而不是凭空编造

**完成这一步后你应该看到：**
- `server/api/rag-chat.post.ts` 文件已创建

---

## 第八步：创建引用来源 UI 组件

当 AI 回答时，显示它参考了哪些文档片段，以及相似度有多高。

创建文件 `components/chat/CitationPanel.vue`：

```vue
<!-- components/chat/CitationPanel.vue -->
<script setup lang="ts">
import { FileText } from 'lucide-vue-next'

interface Citation {
  source: string
  text: string
  score: number
}

defineProps<{ citations: Citation[] }>()
</script>

<template>
  <div v-if="citations.length" class="mt-4 space-y-2">
    <!-- 标题 -->
    <div class="text-xs text-zinc-500 uppercase tracking-wider flex items-center gap-2">
      <FileText class="w-3 h-3" />
      参考来源
    </div>

    <!-- 来源卡片列表 -->
    <div class="grid grid-cols-1 gap-2">
      <div
        v-for="(cite, index) in citations"
        :key="index"
        class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3
               hover:border-emerald-500/30 transition-colors"
      >
        <!-- 来源编号和文件名 -->
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono">
              来源 {{ index + 1 }}
            </span>
            <span class="text-xs text-emerald-400 font-mono truncate">
              {{ cite.source }}
            </span>
          </div>

          <!-- 相似度进度条 -->
          <div class="flex items-center gap-1">
            <div class="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
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

        <!-- 文档片段预览 -->
        <p class="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
          {{ cite.text }}
        </p>
      </div>
    </div>
  </div>
</template>
```

**完成这一步后你应该看到：**
- `components/chat/CitationPanel.vue` 文件已创建

---

## 第九步：创建知识库管理页面

用户通过这个页面上传文档到知识库。

创建文件 `pages/knowledge.vue`：

```vue
<!-- pages/knowledge.vue -->
<script setup lang="ts">
import { Upload, File, Trash2 } from 'lucide-vue-next'

const uploading = ref(false)
const files = ref<string[]>([])

// 处理文件上传
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
    alert(`文件 ${file.name} 上传成功！`)
  } catch (error: any) {
    alert(`上传失败：${error.data?.message || error.message}`)
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
      <p class="text-xs text-zinc-600 mt-2">支持 .md 和 .txt 文件</p>
      <input
        type="file"
        accept=".md,.txt"
        class="hidden"
        @change="handleUpload"
        :disabled="uploading"
      />
    </label>

    <!-- 已上传文件列表 -->
    <div class="mt-8 space-y-2">
      <h2 class="text-sm text-zinc-500 mb-3">已上传文件</h2>
      <div v-if="files.length === 0" class="text-sm text-zinc-600">
        还没有上传任何文件
      </div>
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

**完成这一步后你应该看到：**
- `pages/knowledge.vue` 文件已创建

---

## 第十步：运行并测试 RAG 功能

重启开发服务器（因为改了环境变量）：

```bash
# 先停掉之前的服务器（Ctrl+C），然后重启
npm run dev
```

**测试 1：上传文档**

1. 打开浏览器访问 `http://localhost:3000/knowledge`
2. 你应该看到知识库管理页面，有一个虚线框的上传区域
3. 创建一个测试文件 `test-doc.md`，内容如下：

```markdown
# Vue 3 组合式 API

Vue 3 引入了组合式 API（Composition API），使用 `setup()` 函数来组织组件逻辑。

## ref 和 reactive

`ref` 用于创建基本类型的响应式数据：
```javascript
import { ref } from 'vue'
const count = ref(0)
```

`reactive` 用于创建对象类型的响应式数据：
```javascript
import { reactive } from 'vue'
const state = reactive({ name: '张三', age: 25 })
```

## computed 计算属性

计算属性会自动追踪依赖，只在依赖变化时重新计算。
```

4. 上传这个文件
5. 你应该看到 "文件 test-doc.md 上传成功！" 的提示

**测试 2：用知识库对话**

1. 打开 `http://localhost:3000`
2. 在对话框中输入："Vue 3 的 ref 和 reactive 有什么区别？"
3. AI 应该基于你刚上传的文档来回答
4. 回答中应该包含引用来源

### 卡住了？

| 问题 | 解决办法 |
|------|----------|
| 上传文件后报 `500` 错误 | 检查 Qdrant 和 OpenAI 是否正常。查看终端的错误信息 |
| 上传成功但 AI 回答"没有找到相关内容" | 确认你用的是 RAG Chat API（`/api/rag-chat`），不是普通 Chat API（`/api/chat`） |
| Qdrant 连接超时 | 确认 Docker 容器在运行：`docker ps`，如果不在运行：`docker start qdrant` |
| OpenAI API 报 `insufficient_quota` | OpenAI 账户余额不足，去 platform.openai.com 充值 |
| `readMultipartFormData` 返回 null | 确认前端用 `FormData` 发送，Content-Type 不能手动设置 |

---

## 动手练习

完成了上面的步骤后，试试下面的练习来巩固知识：

**练习 1：上传真实文档**

找一篇你写的 Markdown 文档（技术笔记、项目文档等），上传到知识库，然后用对话功能问它问题。观察 AI 的回答是否准确引用了文档内容。

**练习 2：调整分块大小**

修改 `server/api/ingest.post.ts` 中的 `chunkSize` 参数：
- 改成 `200`（更小的块），重新上传文档，观察搜索结果的变化
- 改成 `1000`（更大的块），对比效果

思考：块太大和太小分别有什么问题？

**练习 3：显示更多搜索结果**

修改 `server/api/rag-chat.post.ts` 中的 `queryVectors(embedding, 5)`，把 `5` 改成 `10`，看看搜索更多结果会不会让 AI 回答更好。

**练习 4：创建一个简单文档**

创建一个 `content/vue3-guide.md` 文件，写上你学到的 Vue 3 知识（至少 500 字），上传到知识库，然后问 AI 问题来验证。

---

**上一步：** [对话引擎核心](/playground/02-chat-engine)
**下一步：** [Agent 能力扩展与上线部署](/playground/04-agent-deploy)
