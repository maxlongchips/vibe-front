---
title: MCP 协议深度拆解：前端开发者视角
description: MCP 架构、Tools/Resources/Prompts 三板斧、TypeScript 实战、安全最佳实践、常见踩坑
tags: ['mcp', 'model-context-protocol', 'typescript', 'nuxt']
category: 学习路线
---

# MCP 协议深度拆解：前端开发者视角

> MCP 是 AI 工具的"Type-C 接口" — 一个通用标准，让 AI 连接任何东西。

---

## 零基础起步

开始之前，请确认以下条件全部满足：

| 检查项 | 怎么验证 | 不满足怎么办 |
|--------|---------|-------------|
| 完成路线图 01 | 确认你已经跑通了 [01-dev-environment](/roadmap/01-dev-environment) | 先回去完成它 |
| Node.js 18+ | 终端运行 `node -v`，输出 `v18.x.x` 或更高 | 去 [nodejs.org](https://nodejs.org) 下载 LTS 版本 |
| Claude Code 已安装 | 终端运行 `claude --version`，有版本号输出 | 运行 `npm install -g @anthropic-ai/claude-code` |
| TypeScript 基础 | 你知道 `interface` 和 `zod` 是什么 | 不影响跟教程，遇到不懂的再查 |

全部打勾？继续往下。

---

## 第一站：搞懂 MCP 是什么

### 一句话解释

MCP（Model Context Protocol）是 Anthropic 发布的开放协议，定义了 AI 模型与外部工具/数据源之间的通信标准。

### Type-C 类比

你用过 Type-C 接口吧？一根线连手机、连显示器、连硬盘，什么都能连。

MCP 就是 AI 世界的 Type-C：

- **没有 MCP 之前：** 每个 AI 工具各自实现文件访问、Git 操作、数据库查询，互不兼容。就像以前每部手机一种充电线。
- **有了 MCP 之后：** 一个 MCP Server 可以被 Claude Code、Cursor、任何支持 MCP 的客户端使用。一根线搞定。

这个协议已经被 OpenAI、Google 等公司采纳，正在成为行业标准。阿里云、腾讯云都在构建 MCP 生态市场。

**你现在学的东西，未来几年都用得上。**

---

## 第二站：理解架构（5 分钟）

MCP 用的是客户端-服务器架构，一共有四个角色：

```
┌─────────────────────────────────────────┐
│  MCP Host（Claude Code / Cursor / 你的应用）│
│   ┌──────────────┐                       │
│   │ MCP Client   │ ← 负责和 Server 通信  │
│   └──────┬───────┘                       │
└──────────┼──────────────────────────────┘
           │ JSON-RPC 2.0（一种标准消息格式）
┌──────────┼──────────────────────────────┐
│  MCP Server（你要写的工具提供方）          │
│   ┌──────┴───────┐                       │
│   │ Tools        │ ← AI 可以调用的函数    │
│   │ Resources    │ ← AI 可以读取的数据    │
│   │ Prompts      │ ← 预定义的提示模板     │
│   └──────┬───────┘                       │
└──────────┼──────────────────────────────┘
           │
     外部资源（文件系统 / 数据库 / API）
```

**用人话说：**
- **Host** 是你打开的 AI 应用（比如 Claude Code）
- **Client** 是 Host 内部的"翻译官"，负责跟 Server 对话
- **Server** 是你写的工具程序，它提供能力给 AI 用
- **Resources** 是 Server 能访问的外部数据

### 两种传输方式

| 传输方式 | 怎么通信 | 适用场景 |
|----------|---------|---------|
| **stdio** | 通过标准输入/输出，本地进程 | 本地开发，Claude Code 默认方式 |
| **SSE / streamable-http** | 通过网络请求 | 远程部署，团队共享的 Server |

**初学者先只管 stdio，够用了。** SSE 等你需要部署远程服务时再学。

---

## 第三站：三种核心能力

MCP Server 能提供三种能力，我们一个一个看。

### 1. Tools（工具）— AI 能调用的函数

这是最常用的能力。AI 判断什么时候该调用，然后执行。

```typescript
// 定义一个工具
server.tool(
  'search_docs',           // 工具名（AI 通过这个名字调用）
  '搜索项目文档',            // 描述（AI 靠这段话决定何时调用它）
  {                         // 参数 Schema（用 zod 定义）
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

**关键点：** 描述写得好不好，直接决定 AI 能不能正确使用你的工具。把它当作给一个新同事写的函数文档。

### 2. Resources（资源）— AI 能读取的数据

类似 REST API 的 GET 端点。AI 按需读取，不触发副作用。

```typescript
server.resource(
  'project-config',        // 资源名
  'config://nuxt',         // URI 模板（唯一标识这个资源）
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

### 3. Prompts（提示模板）— 预定义的对话模板

客户端可以列出可用的 Prompt，用户选择后直接使用。

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

**三者对比：**

| 能力 | 谁发起 | 有没有副作用 | 类比 |
|------|-------|-------------|------|
| Tools | AI 决定调用 | 有（执行操作） | POST 请求 |
| Resources | AI 读取数据 | 无（只读） | GET 请求 |
| Prompts | 用户选择使用 | 无（只是模板） | 快捷指令 |

---

## 第四站：动手写一个 MCP Server

接下来我们要写一个完整的 MCP Server，让 AI 工具能直接查询你的 Nuxt 项目信息。

这个 Server 有三个能力：
- **search_components 工具** — 搜索 Vue 组件文件
- **list_routes 工具** — 列出所有页面路由
- **nuxt-config 资源** — 读取项目配置文件

### 步骤 1：创建项目目录

在你的项目根目录下运行：

```bash
mkdir -p mcp-server
```

你应该看到项目里多了一个 `mcp-server/` 文件夹。

**卡住了？** 如果报错 `command not found: mkdir`，说明你不在 bash 环境。试试在 VS Code 的终端里操作，或者用 PowerShell 的 `New-Item -ItemType Directory -Path mcp-server`。

### 步骤 2：安装依赖

```bash
npm install @modelcontextprotocol/sdk zod
```

等待安装完成。成功后 `package.json` 的 `dependencies` 里应该有这两个包。

**卡住了？** 如果报 `EACCES` 权限错误，不要用 `sudo`。检查你的 Node.js 是否用 nvm 安装的，或者换个有写权限的目录。

### 步骤 3：创建 MCP Server 入口文件

创建文件 `mcp-server/index.ts`，把下面的代码完整复制进去：

```typescript
// mcp-server/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readFile, readdir } from 'fs/promises'
import { join, resolve } from 'path'

// ============================================
// 1. 创建 Server 实例
// ============================================
const server = new McpServer({
  name: 'nuxt-project',
  version: '1.0.0',
})

// 项目根目录（MCP Server 会从项目根目录启动）
const PROJECT_ROOT = process.cwd()

// ============================================
// 2. 工具：搜索 Vue 组件
// ============================================
server.tool(
  'search_components',
  '搜索项目中的 Vue 组件文件。根据关键词匹配文件名。',
  { query: z.string().describe('组件名或关键词，例如 "button"、"header"') },
  async ({ query }) => {
    try {
      const componentsDir = join(PROJECT_ROOT, 'components')
      const files = await readdir(componentsDir, { recursive: true })

      const matches = files
        .filter((f): f is string => typeof f === 'string' && f.endsWith('.vue'))
        .filter(f => f.toLowerCase().includes(query.toLowerCase()))

      return {
        content: [{
          type: 'text',
          text: matches.length
            ? `找到 ${matches.length} 个匹配组件:\n${matches.join('\n')}`
            : `未找到匹配 "${query}" 的组件。可用组件目录: ${componentsDir}`
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `搜索失败: ${error instanceof Error ? error.message : '未知错误'}。请确认 components 目录存在。`
        }]
      }
    }
  }
)

// ============================================
// 3. 工具：列出页面路由
// ============================================
server.tool(
  'list_routes',
  '列出 Nuxt 项目的所有页面路由。无需参数。',
  {},
  async () => {
    try {
      const pagesDir = join(PROJECT_ROOT, 'pages')
      const files = await readdir(pagesDir, { recursive: true })

      const routes = files
        .filter((f): f is string => typeof f === 'string' && f.endsWith('.vue'))
        .map(f => {
          // 把文件路径转成路由格式
          // pages/index.vue       -> /
          // pages/about.vue       -> /about
          // pages/blog/[id].vue   -> /blog/:id
          const route = '/' + f
            .replace(/\.vue$/, '')
            .replace(/\/index$/, '')
            .replace(/\[([^\]]+)\]/g, ':$1')
          return route
        })
        .sort()

      return {
        content: [{
          type: 'text',
          text: routes.length
            ? `项目共 ${routes.length} 个路由:\n${routes.join('\n')}`
            : `pages 目录为空或不存在: ${pagesDir}`
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `读取路由失败: ${error instanceof Error ? error.message : '未知错误'}`
        }]
      }
    }
  }
)

// ============================================
// 4. 资源：读取 nuxt.config.ts
// ============================================
server.resource(
  'nuxt-config',
  'config://nuxt',
  async (uri) => {
    const configPath = join(PROJECT_ROOT, 'nuxt.config.ts')
    const config = await readFile(configPath, 'utf-8')
    return {
      contents: [{
        uri: uri.href,
        text: config,
        mimeType: 'text/typescript'
      }]
    }
  }
)

// ============================================
// 5. 启动 Server（通过 stdio 通信）
// ============================================
const transport = new StdioServerTransport()
await server.connect(transport)
```

**你应该看到：** 没有报错，文件创建成功。这时候 Server 还不会运行，它需要被 Host（比如 Claude Code）启动。

**卡住了？**
- 如果编辑器显示红色波浪线，运行 `npm install` 确保依赖已安装
- 如果 TypeScript 报类型错误，确认你的 `tsconfig.json` 里有 `"moduleResolution": "bundler"` 或 `"node16"`

### 步骤 4：配置 package.json

在 `mcp-server/` 目录下创建 `package.json`：

```json
{
  "name": "nuxt-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  }
}
```

如果你是把 MCP Server 放在主项目的子目录里，依赖装在主项目的 `package.json` 里就行，这个文件可以省略。

### 步骤 5：在 Claude Code 中注册 Server

在项目根目录创建（或编辑）`.mcp.json` 文件：

```json
{
  "mcpServers": {
    "nuxt-project": {
      "command": "npx",
      "args": ["tsx", "./mcp-server/index.ts"]
    }
  }
}
```

这段配置告诉 Claude Code：
- 用 `npx tsx` 来运行你的 TypeScript 文件
- 给这个 Server 起名叫 `nuxt-project`

### 步骤 6：验证注册

在终端运行：

```bash
claude mcp list
```

你应该看到类似这样的输出：

```
nuxt-project: npx tsx ./mcp-server/index.ts
```

**卡住了？**
- 如果报 `command not found: claude`，确认 Claude Code 已安装（`npm install -g @anthropic-ai/claude-code`）
- 如果列表是空的，检查 `.mcp.json` 是否在项目根目录，JSON 格式是否正确
- 如果报 `spawn tsx ENOENT`，运行 `npm install -g tsx` 安装 tsx

### 步骤 7：测试 Server

启动 Claude Code：

```bash
claude
```

然后试着问它：

```
帮我看看这个项目有哪些 Vue 组件
```

Claude 会自动调用你的 `search_components` 工具。如果它列出了组件文件，恭喜你，MCP Server 工作正常！

再试试：

```
帮我列出所有页面路由
```

Claude 应该会调用 `list_routes` 工具，返回路由列表。

**卡住了？**
- 如果 Claude 说"没有可用的工具"，运行 `/mcp` 查看 Server 状态
- 如果报连接错误，检查 `mcp-server/index.ts` 的路径是否正确
- 用 `claude --debug` 启动可以看到详细的 MCP 通信日志

---

## 第五站：在 Nuxt 3 中集成 MCP Client

如果你想在自己的 Nuxt 应用里连接一个 MCP Server（而不是让 Claude Code 连接），可以用 Client SDK。

创建文件 `server/utils/mcp-client.ts`：

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

// 使用示例：通过 MCP 搜索组件
export async function searchComponentsViaMcp(query: string) {
  const mcp = await getMcpClient()
  const result = await mcp.callTool({
    name: 'search_components',
    arguments: { query }
  })
  return result
}

// 使用示例：通过 MCP 列出路由
export async function listRoutesViaMcp() {
  const mcp = await getMcpClient()
  const result = await mcp.callTool({
    name: 'list_routes',
    arguments: {}
  })
  return result
}
```

然后在 API 路由中使用：

```typescript
// server/api/components.get.ts
import { searchComponentsViaMcp } from '~/server/utils/mcp-client'

export default defineEventHandler(async (event) => {
  const query = getQuery(event).q as string
  if (!query) {
    throw createError({ statusCode: 400, message: '缺少搜索参数 q' })
  }
  return await searchComponentsViaMcp(query)
})
```

**什么时候需要 Client 集成？** 当你想在自己的 Web 应用中调用 MCP Server 的能力时。大多数情况下，你只需要让 Claude Code 连接 Server 就够了。

---

## 第六站：MCP vs Function Calling

如果你用过 OpenAI 的 Function Calling，可能会问：这俩有什么区别？

| 维度 | Function Calling | MCP |
|------|-----------------|-----|
| 定义位置 | 在 API 路由中硬编码 | 独立的 Server 进程 |
| 复用性 | 单个项目内 | 跨项目、跨客户端通用 |
| 动态发现 | 不支持，调用前必须知道函数签名 | 客户端自动发现 Server 提供了哪些工具 |
| 生态 | 各自为政 | 标准化生态（社区已有 1000+ Server） |
| 传输 | 在 HTTP 请求内 | stdio / SSE / streamable-http |

**简单说：** Function Calling 是"本地函数"，MCP 是"微服务"。Function Calling 绑死在一个 AI 提供商上，MCP 任何支持的客户端都能用。

---

## 五大常见踩坑

### 踩坑 1：装太多 MCP Server

每个 Server 启动都是一个进程，有内存和 CPU 开销。Claude Code 本身已经内置了很多能力（文件搜索、Git 操作、终端命令），不需要再装 MCP Server 来做同样的事。

**规则：只装你真正需要的。** 先问自己"Claude Code 自带的功能能不能做这件事？"

### 踩坑 2：工具职责太宽泛

```typescript
// ❌ 一个工具干太多事
server.tool('do_everything', '搜索文件、读取内容、修改代码', ...)
// AI 不知道什么时候该用它

// ✅ 每个工具只做一件事
server.tool('search_components', '搜索 Vue 组件文件名', ...)
server.tool('read_component', '读取指定组件的源码', ...)
```

**规则：一个工具 = 一个职责。** 就像写函数一样，单一职责原则。

### 踩坑 3：错误信息太模糊

```typescript
// ❌ 坏的 — AI 看到这个什么都做不了
return { content: [{ type: 'text', text: 'Error' }] }

// ✅ 好的 — AI 能理解问题并尝试恢复
return {
  content: [{
    type: 'text',
    text: `搜索失败：目录 "${dir}" 不存在。请检查路径是否正确，或确认 components 目录已创建。`
  }]
}
```

**规则：错误信息要包含"发生了什么"和"怎么修"。** 清晰的错误让 AI 能自动重试或给出替代方案。

### 踩坑 4：暴露敏感信息

```json
// ❌ 绝对不要这样做
{
  "mcpServers": {
    "db": {
      "command": "npx",
      "args": ["tsx", "./mcp-server/db.ts"],
      "env": {
        "DB_PASSWORD": "super-secret"
      }
    }
  }
}
```

`.mcp.json` 通常会提交到 Git。密码一旦进去，所有人都能看到。

**规则：永远不要在 MCP 配置中硬编码密码。** 让 Server 从环境变量读取。

### 踩坑 5：没有输入验证

```typescript
// ❌ 不验证 — path 可能是 ../../../etc/passwd
server.tool('read_file', '读取文件', { path: z.string() }, async ({ path }) => {
  const content = await readFile(path, 'utf-8')
  return { content: [{ type: 'text', text: content }] }
})

// ✅ 验证 — 确保路径不超出项目范围
server.tool('read_file', '读取文件', { path: z.string() }, async ({ path }) => {
  const resolved = resolve(PROJECT_ROOT, path)
  if (!resolved.startsWith(PROJECT_ROOT)) {
    return {
      content: [{ type: 'text', text: '错误：路径超出项目范围，拒绝访问。' }]
    }
  }
  const content = await readFile(resolved, 'utf-8')
  return { content: [{ type: 'text', text: content }] }
})
```

**规则：所有来自客户端的输入都要验证。** 路径遍历攻击、SQL 注入、XSS，一个都不少。

---

## 安全最佳实践

1. **最小权限原则** — 只暴露你需要的能力，不要开放整个文件系统
2. **参数化查询** — 数据库操作永远用参数化查询，不要拼接 SQL
3. **只读连接** — 如果只需要读数据，用只读数据库连接
4. **OAuth 2.1 + PKCE** — 远程 MCP Server 用标准认证协议
5. **输入验证** — 所有来自客户端的输入都要验证，参考上面的踩坑 5

---

## 动手练习

学完理论不动手等于没学。完成以下练习巩固知识：

### 练习 1：给 MCP Server 加一个新工具（基础）

给 `mcp-server/index.ts` 添加一个 `count_components` 工具：
- 功能：统计 `components/` 目录下有多少个 `.vue` 文件
- 参数：无
- 返回格式：`"项目共有 X 个 Vue 组件"`

提示：复用 `search_components` 里的 `readdir` 逻辑。

### 练习 2：添加一个新资源（基础）

添加一个 `package-json` 资源：
- URI：`config://package`
- 功能：读取并返回 `package.json` 的内容
- mimeType：`application/json`

### 练习 3：路径安全加固（进阶）

修改 `search_components` 工具，加入路径验证：
- 确保 `componentsDir` 解析后不超出 `PROJECT_ROOT`
- 如果超出，返回清晰的错误信息而不是抛异常

### 练习 4：构建一个独立的 MCP Server（综合）

从零开始，为你自己的项目写一个 MCP Server，至少包含：
- 2 个 Tools
- 1 个 Resource
- 完善的错误处理
- 输入验证

然后在 Claude Code 中注册并测试。

---

## 本节要点

1. MCP 是 AI 工具的标准化协议，就像 Type-C 接口一样通用
2. 架构四角色：Host → Client → Server → Resources
3. 三种能力：Tools（调用）、Resources（读取）、Prompts（模板）
4. 两种传输：stdio（本地开发）、SSE/HTTP（远程部署）
5. 用 `@modelcontextprotocol/sdk` 写 MCP Server，用 zod 做参数校验
6. 在 `.mcp.json` 中注册 Server，用 `claude mcp list` 验证
7. 安全第一：最小权限、输入验证、不暴露敏感信息
8. 不要装太多 Server，每个都有开销；不要让一个工具干太多事

---

**上一篇：** [RAG 全栈落地：从 Embedding 到向量检索的前端集成](/roadmap/04-rag-frontend)
**下一篇：** [AI 全栈集成：从零搭建智能文档助手](/roadmap/06-integration-guide)
