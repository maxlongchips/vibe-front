---
title: MCP 协议深度拆解：前端开发者视角
description: MCP 的 Tools/Resources/Prompts 三板斧、用 TypeScript 写一个自定义 MCP Server、在 Nuxt 3 中集成 MCP Client
tags: ['mcp', 'model-context-protocol', 'typescript', 'nuxt']
category: 学习路线
---

# MCP 协议深度拆解：前端开发者视角

> MCP 是 AI 工具的"USB 协议"。理解它，你就能让 AI 连接任何东西。

## MCP 是什么？

MCP（Model Context Protocol）是 Anthropic 发布的开放协议，定义了 AI 模型与外部工具/数据源之间的通信标准。

**没有 MCP 之前：** 每个 AI 工具各自实现文件访问、Git 操作、数据库查询，互不兼容。

**有了 MCP 之后：** 一个 MCP Server 可以被 Claude Code、Cursor、任何支持 MCP 的客户端使用。

## 核心架构

```
MCP Client (Claude Code / Cursor / 你的应用)
    ↕ JSON-RPC 2.0
MCP Server (工具提供方)
    ↕
外部资源 (文件系统 / 数据库 / API)
```

## 三种核心能力

### 1. Tools（工具）

AI 可以调用的函数。类似 Function Calling，但是标准化的。

```typescript
// 定义一个工具
server.tool(
  'search_docs',           // 工具名
  '搜索项目文档',            // 描述
  {                         // 参数 Schema
    query: z.string().describe('搜索关键词'),
    limit: z.number().optional().default(10),
  },
  async ({ query, limit }) => {  // 执行函数
    const results = await search(query, limit)
    return {
      content: [{ type: 'text', text: JSON.stringify(results) }]
    }
  }
)
```

### 2. Resources（资源）

AI 可以读取的数据源。类似 REST API 的 GET 端点。

```typescript
server.resource(
  'project-config',        // 资源名
  'config://nuxt',         // URI 模板
  async (uri) => {
    const config = await readFile('nuxt.config.ts', 'utf-8')
    return {
      contents: [{
        uri: uri.href,
        text: config,
        mimeType: 'text/typescript'
      }]
    }
  }
)
```

### 3. Prompts（提示模板）

预定义的 Prompt 模板，客户端可以列出并使用。

```typescript
server.prompt(
  'code-review',           // Prompt 名
  '代码审查',               // 描述
  { code: z.string() },    // 参数
  ({ code }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `请审查以下代码，指出潜在问题：\n\n${code}`
      }
    }]
  })
)
```

## 实战：写一个 Nuxt 项目 MCP Server

这个 MCP Server 让 AI 工具能直接查询你的 Nuxt 项目信息。

```typescript
// mcp-server/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readFile, readdir } from 'fs/promises'
import { join, relative } from 'path'

const server = new McpServer({
  name: 'nuxt-project',
  version: '1.0.0',
})

const PROJECT_ROOT = process.cwd()

// 工具 1：搜索组件
server.tool(
  'search_components',
  '搜索 Vue 组件',
  { query: z.string().describe('组件名或关键词') },
  async ({ query }) => {
    const componentsDir = join(PROJECT_ROOT, 'components')
    const files = await readdir(componentsDir, { recursive: true })

    const matches = files
      .filter(f => typeof f === 'string' && f.endsWith('.vue'))
      .filter(f => f.toLowerCase().includes(query.toLowerCase()))

    return {
      content: [{
        type: 'text',
        text: matches.length
          ? `找到 ${matches.length} 个组件:\n${matches.join('\n')}`
          : `未找到匹配 "${query}" 的组件`
      }]
    }
  }
)

// 工具 2：读取路由结构
server.tool(
  'list_routes',
  '列出所有页面路由',
  {},
  async () => {
    const pagesDir = join(PROJECT_ROOT, 'pages')
    const files = await readdir(pagesDir, { recursive: true })

    const routes = files
      .filter(f => typeof f === 'string' && f.endsWith('.vue'))
      .map(f => {
        const route = '/' + f
          .replace(/\.vue$/, '')
          .replace(/\/index$/, '')
          .replace(/\[([^\]]+)\]/g, ':$1')
        return route
      })

    return {
      content: [{
        type: 'text',
        text: `项目路由:\n${routes.join('\n')}`
      }]
    }
  }
)

// 资源：项目配置
server.resource(
  'nuxt-config',
  'config://nuxt',
  async (uri) => {
    const config = await readFile(join(PROJECT_ROOT, 'nuxt.config.ts'), 'utf-8')
    return {
      contents: [{
        uri: uri.href,
        text: config,
        mimeType: 'text/typescript'
      }]
    }
  }
)

// 启动
const transport = new StdioServerTransport()
await server.connect(transport)
```

### 配置 package.json

```json
{
  "name": "nuxt-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "nuxt-mcp": "./index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  }
}
```

### 在 Claude Code 中注册

```json
// .claude/mcp.json
{
  "mcpServers": {
    "nuxt-project": {
      "command": "npx",
      "args": ["tsx", "./mcp-server/index.ts"]
    }
  }
}
```

## 在 Nuxt 3 应用中集成 MCP Client

如果你想在自己的 Nuxt 应用中连接 MCP Server：

```typescript
// server/utils/mcp-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

let client: Client | null = null

export async function getMcpClient() {
  if (client) return client

  client = new Client(
    { name: 'vibe-front', version: '1.0.0' },
    { capabilities: {} }
  )

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', './mcp-server/index.ts'],
  })

  await client.connect(transport)
  return client
}

// 使用示例
export async function searchComponentsViaMcp(query: string) {
  const mcp = await getMcpClient()
  const result = await mcp.callTool({
    name: 'search_components',
    arguments: { query }
  })
  return result
}
```

## MCP vs Function Calling

| 维度 | Function Calling | MCP |
|------|-----------------|-----|
| 定义位置 | 在 API 路由中硬编码 | 独立的 Server 进程 |
| 复用性 | 单个项目 | 跨项目、跨客户端 |
| 动态发现 | 不支持 | 客户端自动发现工具 |
| 生态 | 各自为政 | 标准化生态 |

**简单说：** Function Calling 是"本地函数"，MCP 是"微服务"。

## 本节要点

1. MCP 是 AI 工具的标准化协议，类似 USB
2. 三种能力：Tools（调用）、Resources（读取）、Prompts（模板）
3. 用 `@modelcontextprotocol/sdk` 写 MCP Server
4. 一个 MCP Server 可以被所有支持 MCP 的客户端使用
5. 前端应用也可以作为 MCP Client 连接外部工具

---

**上一篇：** [RAG 全栈落地：从 Embedding 到向量检索的前端集成](/roadmap/04-rag-frontend)
