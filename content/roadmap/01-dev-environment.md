---
title: 环境武装：打造你的 AI 开发兵器库
description: Claude Code + Cursor 双工具链配置，自定义 Rules 和 MCP Server，让 AI 真正理解你的项目
tags: ['环境配置', 'claude-code', 'cursor', 'mcp']
category: 学习路线
---

# 环境武装：打造你的 AI 开发兵器库

> 工具用得好，效率翻三倍。工具用不对，AI 就是个高级自动补全。

## 为什么环境配置如此重要？

大多数前端开发者用 AI 的方式是：打开 ChatGPT，粘贴代码，复制回答。这种方式**丢失了 90% 的上下文**，AI 只能给你泛泛而谈的答案。

真正的 AI 辅助开发，是让 AI **直接理解你的项目结构、技术栈、编码规范**，然后给出精准到可以直接 commit 的代码。

## 双工具链战略

我们不押注单一工具，而是构建 **Claude Code + Cursor** 的双工具链：

| 场景 | 工具 | 原因 |
|------|------|------|
| 日常编码 | Cursor | IDE 集成、Tab 补全、内联编辑 |
| 复杂重构 | Claude Code | 终端操作、多文件修改、架构级思考 |
| 代码审查 | Claude Code | 能看到完整 git diff，分析更准确 |
| 快速原型 | Cursor | Cmd+K 即时生成，迭代速度快 |

## 第一步：Claude Code 配置

### 安装与初始化

```bash
# 全局安装
npm install -g @anthropic-ai/claude-code

# 进入项目目录，启动
cd your-project
claude
```

### 核心配置：CLAUDE.md

在项目根目录创建 `CLAUDE.md`，这是 Claude Code 理解你项目的"说明书"：

```markdown
# 项目技术栈
- 框架：Nuxt 3 + Vue 3 Composition API
- 样式：Tailwind CSS（暗黑主题优先）
- 语言：TypeScript（strict 模式）
- AI：Vercel AI SDK + Claude API

# 编码规范
- 组件使用 `<script setup>` 语法
- 命名规范：PascalCase 组件，camelCase 函数
- 状态管理：Pinia + composables
- 错误处理：统一使用 Nuxt 的 showError

# 目录约定
- components/ — 按功能模块分子目录
- composables/ — 可复用逻辑
- server/api/ — BFF 接口
- content/ — Markdown 文档
```

### 自定义 Rules

在 `.claude/rules/` 目录下创建规则文件：

```markdown
# .claude/rules/vue-components.md
所有 Vue 组件必须：
1. 使用 <script setup lang="ts"> 语法
2. Props 使用 defineProps 并提供类型定义
3. Emits 使用 defineEmits 声明
4. 样式使用 Tailwind 类名，禁止 scoped style
```

## 第二步：Cursor 配置

### 核心配置：.cursorrules

```markdown
你是一个资深的 Nuxt 3 + Vue 3 前端开发专家。

技术栈约束：
- 框架：Nuxt 3，使用 Composition API + <script setup>
- 样式：Tailwind CSS，优先使用暗黑模式类名
- 类型：TypeScript strict 模式
- AI SDK：@ai-sdk/vue

编码要求：
- 组件名使用 PascalCase
- 使用 useAsyncData / useFetch 做数据获取
- API 路由放在 server/api/ 下
- 错误处理使用 Nuxt 的 createError
- 禁止使用 Options API
```

### 快捷键速查

| 快捷键 | 功能 | 使用场景 |
|--------|------|----------|
| `Cmd+K` | 内联编辑 | 选中代码后描述修改 |
| `Cmd+L` | AI Chat | 多轮对话、架构讨论 |
| `Cmd+I` | Composer | 跨文件修改、新功能开发 |
| `Tab` | 接受补全 | AI 代码补全 |

## 第三步：MCP Server 配置

MCP（Model Context Protocol）让 AI 工具能直接访问外部数据源。对前端开发者最有用的 MCP Server：

### 必装 MCP Server

```jsonc
// .claude/mcp.json
{
  "mcpServers": {
    // 文件系统访问
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    },
    // Web 搜索（需要 API Key）
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-key-here"
      }
    },
    // Nuxt DevTools
    "nuxt-devtools": {
      "command": "npx",
      "args": ["-y", "@nuxt/devtools-mcp"]
    }
  }
}
```

### 自定义 MCP Server：项目文档查询

```typescript
// mcp-servers/project-docs.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'

const server = new Server(
  { name: 'project-docs', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

// 注册工具：搜索项目文档
server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'search-docs') {
    const query = request.params.arguments?.query as string
    const contentDir = join(process.cwd(), 'content')
    const files = await readdir(contentDir, { recursive: true })

    const results = []
    for (const file of files) {
      if (typeof file === 'string' && file.endsWith('.md')) {
        const content = await readFile(join(contentDir, file), 'utf-8')
        if (content.toLowerCase().includes(query.toLowerCase())) {
          results.push({ file, snippet: content.substring(0, 200) })
        }
      }
    }

    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
```

## 验证你的环境

跑完以上配置后，用这个命令验证 Claude Code 能否正确理解你的项目：

```bash
claude "请分析这个项目的目录结构和技术栈，列出你认为最需要优化的 3 个地方"
```

如果 AI 给出的回答**涉及你项目具体的文件和代码**，而不是泛泛的通用建议，说明环境配置成功。

## 常见踩坑

**Q: Claude Code 总是给出过时的 API 用法？**
A: 在 `CLAUDE.md` 中明确写出你使用的库版本，并加一句"请使用当前版本的 API，不要使用已废弃的方法"。

**Q: Cursor 的 .cursorrules 不生效？**
A: 确保文件在项目根目录，且编码为 UTF-8。重启 Cursor 后生效。

**Q: MCP Server 连接失败？**
A: 检查 npx 是否能正常执行，API Key 是否正确配置。用 `claude mcp list` 查看连接状态。

---

**下一篇：** [Vercel AI SDK 核心：从 useChat 到流式架构](/roadmap/02-vercel-ai-sdk)
