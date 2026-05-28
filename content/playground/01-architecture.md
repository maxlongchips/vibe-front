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
