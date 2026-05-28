---
title: 架构设计与项目初始化
description: Nuxt 3 + Vercel AI SDK + Tailwind 项目搭建、BFF 架构设计、API Key 安全方案
tags: ['实战', 'architecture', 'nuxt3', 'project-setup']
category: 实战演练
---

# 实战 01：架构设计与项目初始化

> 好的架构是成功的一半。这一步做对了，后面全是顺风局。

---

## 零基础起步

在开始之前，请确认你的电脑已经准备好了以下工具。打开终端，逐个输入命令检查：

```bash
# 检查 Node.js 版本（需要 18 或更高）
node -v
# 期望输出：v18.x.x 或 v20.x.x 或更高

# 检查 npm 版本（需要 9 或更高）
npm -v
# 期望输出：9.x.x 或更高

# 检查 Git
git --version
# 期望输出：git version 2.x.x
```

**如果 node 命令报错**：说明你还没安装 Node.js。去 [nodejs.org](https://nodejs.org) 下载 LTS 版本安装，安装完重新打开终端再试。

**如果版本太低**：推荐用 [nvm](https://github.com/nvm-sh/nvm) 管理 Node.js 版本，执行 `nvm install 20` 升级。

你还需要准备：
- 一个 Anthropic API Key（去 [console.anthropic.com](https://console.anthropic.com) 注册获取）
- 一个代码编辑器（推荐 VS Code）

全部就绪后，我们开始。

---

## 第一步：创建项目

打开终端，执行以下命令：

```bash
npx nuxi@latest init ai-doc-assistant
```

执行过程中会提示你选择配置，选择以下选项：
- Package manager: **npm**
- Initialize git repository: **Yes**
- Install dependencies: **Yes**

```bash
# 进入项目目录
cd ai-doc-assistant

# 安装 AI SDK 核心依赖
npm install ai @ai-sdk/anthropic

# 安装 Tailwind CSS 插件
npm install -D @tailwindcss/typography
```

**完成这一步后你应该看到：**
- 项目文件夹 `ai-doc-assistant` 已创建
- `node_modules` 文件夹已存在
- `package.json` 中有 `ai` 和 `@ai-sdk/anthropic` 依赖

验证一下：

```bash
# 确认依赖安装成功
cat package.json | grep -E '"ai"|"@ai-sdk/anthropic"'
```

你应该看到类似这样的输出：

```json
"@ai-sdk/anthropic": "^4.x.x",
"ai": "^4.x.x",
```

### 卡住了？

| 问题 | 解决办法 |
|------|----------|
| `npx nuxi` 报错 `command not found` | 先运行 `npm install -g nuxi` 再试 |
| `npm install` 很慢或超时 | 换淘宝镜像：`npm config set registry https://registry.npmmirror.com` |
| 出现 `ERESOLVE unable to resolve` | 加 `--legacy-peer-deps` 参数：`npm install ai @ai-sdk/anthropic --legacy-peer-deps` |
| Windows 上出现权限错误 | 用管理员身份打开终端再试 |

---

## 第二步：理解 BFF 架构

在写代码之前，先搞清楚我们的架构：

```
用户的浏览器
  ↓ 发送请求 fetch('/api/chat')
Nuxt Server（BFF 层，运行在服务端）
  ↓ 用 SDK 调用 AI API
Claude API（Anthropic 的服务器）
```

**为什么不让浏览器直接调 Claude API？**

1. **安全**：API Key 会暴露在浏览器的网络请求里，别人拿到就能用你的额度
2. **成本**：你无法限制别人调用多少次，可能收到天价账单
3. **灵活**：服务端可以做缓存、重试、限流

简单记：**前端只和自己的后端通信，后端再去调 AI**。

---

## 架构决策：为什么这样设计？

上面介绍了 BFF 架构的基本思路，但在实际项目中，你有三种主流方案可选。我们先对比一下，再看看为什么 BFF 是这个项目的最佳选择。

### 三种方案对比

| 维度 | BFF（Backend for Frontend） | 直连 API（前端直调 Claude） | Edge Function（Vercel/Cloudflare） |
|------|---------------------------|--------------------------|----------------------------------|
| **安全性** | 高：API Key 只在服务端，前端完全不接触 | 低：API Key 暴露在浏览器中，极易泄露 | 高：Key 存在边缘节点，不暴露给客户端 |
| **灵活性** | 高：可自由添加缓存、限流、日志、RAG 逻辑 | 低：前端只能做简单调用，复杂逻辑难以实现 | 中：有运行时限制（如 Vercel Edge 10s 超时） |
| **成本控制** | 强：可在服务端做请求频率限制、Token 用量监控 | 弱：无法防止恶意调用，可能产生天价账单 | 中：有免费额度，但高流量时按请求数计费 |
| **冷启动** | 无：Nuxt Server 常驻运行 | 不适用 | 有：首次请求可能有 100-500ms 延迟 |
| **部署复杂度** | 低：Nuxt 内置支持，`npm run build` 即可 | 最低：纯前端，静态部署 | 中：需要配置 Edge Runtime、环境变量 |
| **适合场景** | 需要复杂后端逻辑（RAG、多轮对话、知识库） | 纯原型验证、demo | 简单的 API 代理、轻量级中间件 |

### 真实成本参考（2025-2026）

在做架构决策前，你需要了解 AI API 的真实成本。以下是 Claude 和 Embedding 模型的定价：

| 服务 | 模型 | 输入价格 | 输出价格 |
|------|------|---------|---------|
| Anthropic | Claude Sonnet | $3.00 / 1M tokens | $15.00 / 1M tokens |
| Anthropic | Claude Haiku | $0.80 / 1M tokens | $4.00 / 1M tokens |
| OpenAI | text-embedding-3-small | $0.02 / 1M tokens | - |
| OpenAI | text-embedding-3-large | $0.13 / 1M tokens | - |

**如何估算月度成本？**

以 Claude Sonnet 为例，一次典型的对话请求：
- 输入（系统提示 + 用户消息 + 上下文）：约 2000 tokens
- 输出（AI 回复）：约 500 tokens

单次请求成本 = 2000 / 1,000,000 x $3 + 500 / 1,000,000 x $15 = $0.006 + $0.0075 = **$0.0135**

如果你每天 100 次对话，月成本约 $0.0135 x 100 x 30 = **$40.5/月**

> 提示：这些是公开定价，实际使用时请以 [Anthropic 官网](https://www.anthropic.com/pricing) 和 [OpenAI 官网](https://openai.com/api/pricing) 为准。使用 Prompt Caching 可以大幅降低重复上下文的成本（缓存命中时输入价格低至 $0.30/1M tokens）。

### 为什么选择 BFF？

综合以上对比，BFF 是这个项目的最优解，原因如下：

1. **安全第一**：API Key 永远不出现在浏览器中。直连 API 方案中，Key 会暴露在浏览器的 Network 面板里，任何人打开 F12 就能看到。
2. **RAG 扩展性**：我们的知识库检索（RAG）逻辑需要在服务端运行——读取文档、调用 Embedding 模型、做向量搜索。这些在纯前端无法完成。
3. **成本可控**：BFF 层可以实现请求限流（比如每用户每分钟 10 次）、Token 用量监控、超时兜底，避免意外的高额账单。
4. **Nuxt 零成本**：Nuxt 的 `server/` 目录天然就是 BFF，不需要额外搭建后端服务、不需要单独部署。`npm run build` 一键搞定。

---

## 第三步：创建目录结构

在项目根目录下，创建以下文件夹和文件：

```bash
# 创建组件目录
mkdir -p components/chat
mkdir -p components/ui

# 创建 composable 目录
mkdir -p composables

# 创建服务端目录
mkdir -p server/api
mkdir -p server/utils

# 创建内容目录
mkdir -p content

# 验证目录结构
ls -la components/ server/
```

**完成这一步后你应该看到这样的目录结构：**

```
ai-doc-assistant/
├── components/
│   ├── chat/              # 对话相关组件
│   └── ui/                # 通用 UI 组件
├── composables/           # 前端逻辑复用
├── server/
│   ├── api/               # API 接口
│   └── utils/             # 服务端工具函数
├── content/               # 知识库文档
├── nuxt.config.ts         # Nuxt 配置文件
└── package.json
```

### 卡住了？

| 问题 | 解决办法 |
|------|----------|
| `mkdir` 报错 | Windows 用 Git Bash 或 WSL 来运行这些命令，不要用 CMD |
| 看不到 `server/` 目录 | 确认你在 `ai-doc-assistant` 目录下，运行 `pwd` 检查 |

---

## 第四步：配置环境变量

在项目根目录创建 `.env` 文件：

```bash
# 创建 .env 文件
touch .env
```

用编辑器打开 `.env`，填入以下内容（替换成你自己的 Key）：

```
# .env
ANTHROPIC_API_KEY=sk-ant-api03-你的密钥在这里
```

> 重要：这个文件存放你的密钥，**千万不要**把它提交到 Git。

确认 `.gitignore` 里已经忽略了 `.env`：

```bash
grep ".env" .gitignore
```

如果没输出，手动添加：

```bash
echo ".env" >> .gitignore
```

**完成这一步后你应该看到：**
- 项目根目录有 `.env` 文件
- `.gitignore` 里包含 `.env`

### 卡住了？

| 问题 | 解决办法 |
|------|----------|
| 没有 API Key | 去 [console.anthropic.com](https://console.anthropic.com) 注册，在 API Keys 页面创建一个 |
| 不确定 `.env` 对不对 | 运行 `cat .env`，应该看到 `ANTHROPIC_API_KEY=sk-ant-...` 开头的内容 |

---

## 架构决策：API Key 安全方案对比

上面我们用 `.env` 文件存放 API Key，这是最简单的方案。但在不同阶段，你应该选择不同的安全策略。先来对比一下主流方案：

### 四种方案对比

| 方案 | 原理 | 安全性 | 运维成本 | 适合谁 |
|------|------|--------|---------|--------|
| **.env 文件** | Key 写在本地文件中，`.gitignore` 排除提交 | 中：依赖开发者自觉，容易误提交 | 最低：零配置 | 个人开发、原型验证 |
| **Vercel Secrets** | Key 加密存储在 Vercel 平台，通过环境变量注入 | 高：Key 不落盘，平台级加密 | 低：CLI 一条命令 | 个人/小团队，已用 Vercel 部署 |
| **AWS Secrets Manager** | Key 存在 AWS 托管的加密存储中，IAM 控制访问 | 很高：企业级加密 + 审计日志 | 中：需要 AWS 账号和 IAM 配置 | 中大型团队，已有 AWS 基础设施 |
| **HashiCorp Vault** | 自托管密钥管理服务，支持动态密钥轮换 | 最高：零信任架构，密钥自动轮换 | 高：需要部署和维护 Vault 服务 | 企业级，合规要求高（金融/医疗） |

### 各场景推荐

| 你在什么阶段？ | 推荐方案 | 理由 |
|--------------|---------|------|
| 独立开发者，刚起步 | `.env` 文件 | 简单直接，一个人不会误提交 |
| 准备部署到线上 | Vercel Secrets | 一条命令搞定：`vercel secrets add anthropic-api-key sk-ant-...` |
| 团队协作开发 | Vercel Secrets 或 AWS Secrets Manager | 避免 Key 在团队成员间明文传递 |
| 企业级生产环境 | AWS Secrets Manager 或 HashiCorp Vault | 需要审计日志、权限控制、密钥轮换 |

### API Key 泄露的真实代价

假设你的 Claude API Key 被泄露，攻击者用它疯狂调用：

| 场景 | 调用量 | 预估费用 |
|------|--------|---------|
| 轻度滥用 | 10,000 次请求/天，持续 3 天 | 约 $405 |
| 中度滥用 | 100,000 次请求/天，持续 1 天 | 约 $1,350 |
| 恶意刷量 | 1,000,000 次请求，密集调用 | 约 $13,500 |

> 这不是危言耸听。2024 年就有多个开发者因 GitHub 上误提交 API Key 而收到数千美元账单的案例。

**防护建议：**
1. 在 [console.anthropic.com](https://console.anthropic.com) 设置 **月度支出上限**（Billing > Usage Limits）
2. 为不同环境（开发/生产）创建不同的 API Key
3. 定期轮换 Key，尤其是在团队成员变动时
4. 生产环境务必使用平台级密钥管理（Vercel Secrets / AWS Secrets Manager）

---

## 第五步：配置 Nuxt 运行时变量

打开 `nuxt.config.ts`，将内容替换为：

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    // 这些变量只有服务端能访问（安全！）
    anthropicApiKey: '',

    // 这些变量客户端也能访问
    public: {
      appName: 'AI Doc Assistant',
    },
  },
})
```

Nuxt 会自动从 `.env` 文件读取 `ANTHROPIC_API_KEY`，但你需要在 `runtimeConfig` 里声明它。

> 注意：Nuxt 会自动把 `.env` 里的 `ANTHROPIC_API_KEY` 映射到 `runtimeConfig.anthropicApiKey`（驼峰命名）。

**完成这一步后你应该看到：**
- `nuxt.config.ts` 文件已更新
- 没有红色报错

---

## 第六步：创建 LLM 工具函数

这个文件封装了 AI 模型的初始化逻辑，后续所有 API 都会用到它。

```bash
# 创建文件
touch server/utils/llm.ts
```

把以下代码写入 `server/utils/llm.ts`：

```typescript
// server/utils/llm.ts
import { createAnthropic } from '@ai-sdk/anthropic'

export function getAnthropicProvider() {
  const config = useRuntimeConfig()

  if (!config.anthropicApiKey) {
    throw createError({
      statusCode: 500,
      message: 'ANTHROPIC_API_KEY 未配置，请检查 .env 文件',
    })
  }

  return createAnthropic({
    apiKey: config.anthropicApiKey,
  })
}
```

**完成这一步后你应该看到：**
- `server/utils/llm.ts` 文件已创建
- 编辑器没有红色波浪线（如果有，先不用管，装完依赖就好了）

---

## 第七步：搭建暗黑主题 UI 框架

创建布局文件，这是整个应用的外壳：

```bash
# 如果 layouts 目录不存在，先创建
mkdir -p layouts
```

创建 `layouts/default.vue`：

```vue
<!-- layouts/default.vue -->
<script setup lang="ts">
import { Zap, MessageSquare, Database, Settings } from 'lucide-vue-next'
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-300">
    <!-- 左侧导航栏 -->
    <aside class="fixed left-0 top-0 bottom-0 w-64 bg-zinc-900/50 border-r border-zinc-800 p-4">
      <!-- Logo -->
      <div class="flex items-center gap-2 mb-8">
        <Zap class="w-5 h-5 text-emerald-400" />
        <span class="font-semibold text-zinc-100">AI Doc Assistant</span>
      </div>

      <!-- 导航链接 -->
      <nav class="space-y-1">
        <a
          href="/"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
        >
          <MessageSquare class="w-4 h-4" />
          <span>对话</span>
        </a>
        <a
          href="/knowledge"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
        >
          <Database class="w-4 h-4" />
          <span>知识库</span>
        </a>
        <a
          href="/settings"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
        >
          <Settings class="w-4 h-4" />
          <span>设置</span>
        </a>
      </nav>
    </aside>

    <!-- 右侧主内容区 -->
    <main class="ml-64">
      <slot />
    </main>
  </div>
</template>
```

安装图标库（如果还没装的话）：

```bash
npm install lucide-vue-next
```

**完成这一步后你应该看到：**
- `layouts/default.vue` 文件已创建
- `lucide-vue-next` 已安装到 `node_modules`

---

## 成本估算

在正式开始开发之前，先了解一下 AI API 的真实成本，做好预算规划。

### 核心服务定价（2025-2026）

| 用途 | 模型 | 单价 |
|------|------|------|
| 对话生成 | Claude Sonnet（输入） | $3.00 / 1M tokens |
| 对话生成 | Claude Sonnet（输出） | $15.00 / 1M tokens |
| 对话生成 | Claude Haiku（输入） | $0.80 / 1M tokens |
| 对话生成 | Claude Haiku（输出） | $4.00 / 1M tokens |
| 知识库向量化 | OpenAI text-embedding-3-small | $0.02 / 1M tokens |

### 单次对话成本拆解

一次典型的 AI 对话请求，Token 消耗如下：

| 组成部分 | Token 数量 | 说明 |
|---------|-----------|------|
| 系统提示词 | ~500 tokens | 角色设定、行为规范 |
| 知识库检索结果 | ~1000 tokens | RAG 返回的相关文档片段 |
| 用户消息 | ~200 tokens | 用户输入的问题 |
| **输入合计** | **~1700 tokens** | |
| AI 回复 | ~500 tokens | 一段中等长度的回答 |
| **输出合计** | **~500 tokens** | |

**单次请求费用（Claude Sonnet）：**
- 输入：1,700 / 1,000,000 x $3.00 = $0.0051
- 输出：500 / 1,000,000 x $15.00 = $0.0075
- **合计：约 $0.0126（不到 1 美分）**

### 月度成本预估

| 使用规模 | 日均对话数 | 月成本（Sonnet） | 月成本（Haiku） |
|---------|-----------|-----------------|----------------|
| 个人学习 | 20 次/天 | ~$7.6 | ~$2.1 |
| 小团队日常使用 | 100 次/天 | ~$37.8 | ~$10.3 |
| 中等流量 | 500 次/天 | ~$189 | ~$51.5 |
| 高流量生产 | 2000 次/天 | ~$756 | ~$206 |

> 以上为粗略估算。实际费用取决于系统提示词长度、知识库检索结果大小、用户问题复杂度等因素。使用 Prompt Caching 可降低约 60-90% 的输入成本。

### Embedding 成本

知识库向量化是一次性成本：

| 文档规模 | Token 数量 | Embedding 费用 |
|---------|-----------|---------------|
| 50 篇文档 | ~500K tokens | ~$0.01 |
| 500 篇文档 | ~5M tokens | ~$0.10 |
| 5000 篇文档 | ~50M tokens | ~$1.00 |

Embedding 成本几乎可以忽略不计，主要成本在对话生成上。

### 如何跟踪实际花费

1. **Anthropic 控制台**：登录 [console.anthropic.com](https://console.anthropic.com)，在 Usage 页面查看实时用量和费用
2. **设置支出上限**：在 Billing > Usage Limits 中设置月度上限，防止意外超支
3. **开发阶段的 Vercel AI SDK**：在代码中可以通过 `usage` 对象获取每次请求的 Token 消耗：

```typescript
// 在 API 路由中获取用量
const result = await streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  messages,
})

// result.usage 包含 { promptTokens, completionTokens, totalTokens }
```

4. **省钱小技巧**：
   - 开发调试用 Claude Haiku（价格是 Sonnet 的 1/4）
   - 上线后对普通用户用 Haiku，高级功能才用 Sonnet
   - 利用 Prompt Caching 缓存系统提示词和知识库内容
   - 设置合理的 `maxTokens` 限制，避免回复过长

---

## 第八步：验证项目能运行

启动开发服务器：

```bash
npm run dev
```

**你应该看到类似这样的输出：**

```
  > Local:    http://localhost:3000/
  > Network:  http://192.168.x.x:3000/
```

打开浏览器访问 `http://localhost:3000`，你应该看到：
- 左侧有一个深色的导航栏
- 导航栏顶部有 "AI Doc Assistant" 标题和闪电图标
- 有三个导航链接：对话、知识库、设置
- 右侧是空白的主内容区

### 卡住了？

| 问题 | 解决办法 |
|------|----------|
| `npm run dev` 报端口被占用 | 换个端口：`npx nuxi dev --port 3001` |
| 页面白屏 | 打开浏览器控制台（F12）看报错，通常是 import 路径问题 |
| 图标不显示 | 确认 `lucide-vue-next` 已安装：`npm ls lucide-vue-next` |
| 样式没生效 | 确认 Tailwind 已配置，检查 `nuxt.config.ts` 是否有 `@nuxtjs/tailwindcss` 模块 |
| 报错 `defineNuxtConfig is not defined` | 这是正常的，Nuxt 会自动导入，IDE 可能会误报 |

---

## 动手练习

完成了上面的步骤后，试试下面的练习来巩固知识：

**练习 1：添加一个新导航链接**

在 `layouts/default.vue` 的 `<nav>` 中添加一个 "帮助" 链接。你需要：
1. 从 `lucide-vue-next` 导入一个合适的图标（比如 `HelpCircle`）
2. 添加一个 `<a>` 标签，链接到 `/help`
3. 运行 `npm run dev`，确认导航栏里出现了新链接

**练习 2：修改主题色**

当前主题色是绿色（`emerald`），试着改成蓝色（`blue`）：
1. 在 `layouts/default.vue` 中，把所有 `emerald` 替换成 `blue`
2. 刷新浏览器，确认颜色变了

**练习 3：添加环境变量**

在 `.env` 中添加一个新变量 `APP_DEBUG=true`，然后在 `nuxt.config.ts` 的 `runtimeConfig.public` 中读取它，在布局页面中用 `{{ $config.public.appDebug }}` 显示出来。

---

**下一步：** [对话引擎核心：流式 Chat UI 开发](/playground/02-chat-engine)
