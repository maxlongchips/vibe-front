---
title: 环境武装：打造你的 AI 开发兵器库
description: Claude Code + Cursor 双工具链配置，Skills 系统、CLAUDE.md 最佳实践、Hooks 安全护栏、成本优化策略
tags: ['环境配置', 'claude-code', 'cursor', 'mcp', 'skills']
category: 学习路线
---

# 环境武装：打造你的 AI 开发兵器库

> 工具用得好，效率翻三倍。工具用不对，AI 就是个高级自动补全。

## 双工具链战略

2026 年的 AI 编程工具格局已经清晰。根据 The Pragmatic Engineer 的调查（906 名开发者），Claude Code 以 46% 的使用率领先，Cursor 19%，GitHub Copilot 9%。

但最佳策略不是二选一，而是**混合使用**：

| 场景 | 工具 | 原因 |
|------|------|------|
| 日常编码 | Cursor | IDE 集成、Tab 补全、内联编辑 |
| 复杂重构 | Claude Code | 终端操作、多文件修改、架构级思考 |
| 代码审查 | Claude Code | 能看到完整 git diff，分析更准确 |
| 快速原型 | Cursor | Cmd+K 即时生成，迭代速度快 |

中文社区有个精准比喻：Cursor 是**"更聪明的副驾驶"**（人类全程操控），Claude Code 是**"自动驾驶"**（描述目的地，回来检查结果）。

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

CLAUDE.md 是 Claude Code 理解你项目的入口。但有个关键事实很多人不知道：

**Claude 会忽略它认为"不相关"的 CLAUDE.md 内容。** Anthropic 注入的系统提示会告诉 Claude："这些上下文可能与你的任务无关，如果无关就不要响应。"

这意味着：**CLAUDE.md 写得越长、越泛，被忽略的概率越高。**

#### 研究支撑的 CLAUDE.md 最佳实践

来自 HumanLayer 的研究（他们用 Claude Code 交付了 3 个真实产品）：

1. **指令数量有上限**：前沿 LLM 能可靠遵循约 150-200 条指令。Claude Code 的系统提示已经占了约 50 条 — 你的 CLAUDE.md 只剩 100-150 条的预算。
2. **指令越多，所有指令的质量都下降** — 不只是新增的那些。
3. **LLM 偏好上下文两端的指令** — 开头和结尾的指令被执行得更好。
4. **300 行以内，越短越好** — HumanLayer 自己的 CLAUDE.md 不到 60 行。

#### WHAT / WHY / HOW 框架

你的 CLAUDE.md 应该覆盖三件事：

```markdown
# 项目：VibeFront

## WHAT — 技术栈和结构
- 框架：Nuxt 3 + Vue 3 Composition API
- 样式：Tailwind CSS（暗黑主题优先）
- 语言：TypeScript（strict 模式）
- AI：Vercel AI SDK + Claude API
- 目录：components/ 按功能模块分，composables/ 可复用逻辑，server/api/ BFF 接口

## WHY — 项目目的
- 教学平台，帮助前端开发者掌握 AI 辅助开发
- 内容在 content/ 目录，用 Nuxt Content 渲染

## HOW — 如何工作
- 构建：`npm run build`
- 开发：`npm run dev`
- 测试：`npm test`
- 验证：修改后必须在浏览器中确认功能正确
```

#### 常见错误

| 错误做法 | 为什么错 | 正确做法 |
|----------|----------|----------|
| 复制 README 到 CLAUDE.md | CLAUDE.md 是给 Claude 的指令，不是项目文档 | 只写 Claude 需要知道的规则 |
| 写大量代码风格规则 | Linter 做得更好更快 | 用 Biome/ESLint + Hooks |
| 用 `/init` 自动生成 | CLAUDE.md 是最高杠杆点，一行坏指令影响所有产出 | 手工打磨 |
| 包含过时的构建命令 | 过时指令会误导 Claude | 定期更新 |

#### 渐进式披露模式

不要把所有信息塞进 CLAUDE.md。把任务特定的指令放在独立文件中：

```
agent_docs/
  ├── building_the_project.md
  ├── running_tests.md
  ├── code_conventions.md
  └── service_architecture.md
```

然后在 CLAUDE.md 中引用：

```markdown
## 参考文档
- @agent_docs/building_the_project.md — 构建和部署流程
- @agent_docs/code_conventions.md — 编码规范详情
```

Claude 会在需要时读取这些文件，而不是一次性加载所有内容。

### Skills 系统：Claude 的"技能树"

Skills 是 SKILL.md 文件，用**三级渐进式披露**扩展 Claude 的能力：

```
Level 1: 元数据（始终加载）
  └─ YAML frontmatter: name + description
  └─ 轻量到可以安装很多 skill 而不影响上下文

Level 2: 指令（触发时加载）
  └─ SKILL.md 的 markdown 正文
  └─ Claude 只在任务相关时读取

Level 3: 资源（按需加载）
  └─ skill 目录中的额外文件
  └─ 只在需要时加载
```

#### 创建自定义 Skill

```markdown
---
name: frontend-design
description: Generate Vue 3 components with Tailwind CSS, dark theme, and Composition API
---

# 前端组件设计 Skill

## 规则
1. 使用 <script setup lang="ts"> 语法
2. Props 使用 defineProps 并提供类型定义
3. 样式使用 Tailwind 类名，zinc 色系暗黑主题
4. 使用 lucide-vue-next 图标库

## 输出格式
完整的 .vue 文件，包含 Props 类型定义和 emits 声明。
```

Skill 文件位置：
- `.claude/skills/` — 项目级，可通过 git 共享
- `~/.claude/skills/` — 用户级，全局生效

#### 关键原则

来自 Anthropic 官方最佳实践：

1. **简洁是关键** — 上下文窗口是共享资源。一个好的 skill 示例约 50 tokens，坏的约 150 tokens。
2. **匹配自由度** — 脆弱操作（数据库迁移）用精确脚本；灵活任务（代码审查）用文本指令。
3. **description 字段最重要** — Claude 用它决定何时调用这个 skill。
4. **测试所有模型** — 在 Opus 上好用的 skill 可能在 Sonnet 上失效。

### Hooks 安全护栏

Hooks 是在 Claude 执行工具调用前后自动运行的 shell 命令。它们是你的**安全护栏**。

```json
// .claude/settings.json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "echo '⚠️ 即将修改文件，请确认'"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write $CLAUDE_FILE_PATH && npx eslint --fix $CLAUDE_FILE_PATH"
          }
        ]
      }
    ]
  }
}
```

**PreToolUse** — 在工具执行前运行：
- 阻止编辑敏感文件（.env、secrets）
- 弹出确认提示

**PostToolUse** — 在工具执行后运行：
- 自动格式化代码
- 自动运行 linter
- 自动运行相关测试

> **核心原则：** "Never send an LLM to do a linter's job." — 能用确定性工具（linter、formatter、type checker）处理的，不要浪费 LLM 的注意力。

### 成本优化策略

Claude Code 不免费。$20/月 Pro，$200/月 Max。成本控制是必修课。

#### 模型切换策略

| 任务类型 | 推荐模型 | 原因 |
|----------|----------|------|
| 架构设计、复杂重构 | Opus | 需要深度推理 |
| 日常编码、组件实现 | Sonnet | 性价比最高 |
| 简单修改、格式调整 | Haiku | 成本最低 |

#### Token 节省技巧

1. **200K 上下文是"甜蜜陷阱"** — 性能在使用 20-40% 时就开始下降，不是满了才降。
2. **按功能切分对话** — 一个功能一个对话，不要把整个项目塞进一个会话。
3. **用 `/compact` 压缩上下文** — 定期压缩，保持上下文精简。
4. **用 `/clear` 清空重新开始** — 切换任务时清空。
5. **用 `/cost` 查看花费** — 随时了解成本。

#### Think 关键词

当 Claude 需要深度思考时，使用关键词触发更多计算时间：

- `think` — 基础思考
- `think hard` — 更深度思考
- `ultrathink` — 最大计算资源

```
# 普通请求
帮我重构这个组件

# 需要深度思考的请求
ultrathink: 分析这个组件的性能瓶颈，给出重构方案，
需要考虑 SSR 兼容性、TypeScript 类型安全、和可测试性
```

### 多 Claude 工作流

Anthropic 工程师的内部实践：**多个 Claude 实例并行工作**。

```
Claude 实例 A：重构 API 路由
Claude 实例 B：更新前端组件
Claude 实例 C：编写测试

三个实例通过 Git Worktree 隔离，互不干扰。
```

高级模式：用 `claude -p`（headless 模式）集成到 CI/CD：

```bash
# 自动代码审查
claude -p "审查这个 PR 的代码质量，只报告问题" < diff.txt

# 自动 Issue 分类
claude -p "这个 issue 属于什么类别？bug/feature/question" < issue.txt
```

## 第二步：Cursor 配置

### 核心配置：.cursorrules

```markdown
你是一个资深的 Nuxt 3 + Vue 3 前端开发专家。

技术栈约束：
- 框架：Nuxt 3，使用 Composition API + <script setup>
- 样式：Tailwind CSS，优先使用暗黑模式类名（zinc 色系）
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

MCP（Model Context Protocol）让 AI 工具能直接访问外部数据源。中文社区把它比喻为**"AI 的 Type-C 接口"** — 一个通用标准，让 AI 连接任何东西。

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
    // Web 搜索
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-key-here"
      }
    },
    // GitHub 操作
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-token"
      }
    }
  }
}
```

### MCP Server 选择原则

来自社区经验：

1. **工具聚焦单一职责** — 每个工具只做一件事
2. **不要装太多** — 每个 server 都有开销，很多能力 Claude 已经内置
3. **优先用内置能力** — 文件搜索、Git 操作等 Claude 已经会了
4. **description 要清晰** — AI 靠描述决定何时使用工具

### 自定义 MCP Server：项目文档查询

```typescript
// mcp-servers/project-docs.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'

const server = new McpServer({
  name: 'project-docs',
  version: '1.0.0',
})

server.tool(
  'search-docs',
  '搜索项目文档和知识库',
  { query: z.string().describe('搜索关键词') },
  async ({ query }) => {
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
)

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
A: 在 `CLAUDE.md` 中明确写出你使用的库版本。不要假设 Claude 知道最新版本。

**Q: CLAUDE.md 写了很多规则但 Claude 不遵守？**
A: 检查是否超过 150-200 条指令上限。精简到核心规则，其他用 Hooks 或 linter 处理。

**Q: Token 消耗太快？**
A: 用 Sonnet 做日常编码，Opus 只用于架构决策。用 `/compact` 定期压缩上下文。

**Q: MCP Server 连接失败？**
A: 检查 npx 是否能正常执行，API Key 是否正确配置。用 `claude mcp list` 查看连接状态。

**Q: Windows 上能用 Claude Code 吗？**
A: 需要 WSL2。在原生 Windows cmd/PowerShell 中无法运行。

---

**下一篇：** [Vercel AI SDK 核心：从 useChat 到流式架构](/roadmap/02-vercel-ai-sdk)
