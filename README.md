<p align="center">
  <img src="https://img.shields.io/badge/VibeFront-AI%20前端知识学习平台-10b981?style=for-the-badge&labelColor=09090b" alt="VibeFront" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Nuxt%203-3.21-00dc82?style=flat-square&logo=nuxt.js" />
  <img src="https://img.shields.io/badge/Vue%203-3.5-42b883?style=flat-square&logo=vue.js" />
  <img src="https://img.shields.io/badge/Tailwind%20CSS-3.4-38bdf8?style=flat-square&logo=tailwindcss" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript" />
  <img src="https://img.shields.io/badge/Content%20v3-3.14-10b981?style=flat-square" />
</p>

---

## VibeFront

**VibeFront** 是一个面向前端开发者的 **AI 知识学习平台**，采用极客暗黑风设计，基于 Nuxt 3 + @nuxt/content 构建的静态文档系统。

拒绝水分，拒绝过时知识。每一篇文章都是**可以直接写进代码的实战内容**。

### 特性

- **暗黑极客风** — `zinc-950` 深色主题 + 毛玻璃导航栏 + Shiki `github-dark` 代码高亮
- **Markdown 驱动** — @nuxt/content v3 解析，Tailwind typography 排版
- **零废话内容** — 19 篇实战文章，全部直击痛点
- **TypeScript 全栈** — 类型安全的代码示例
- **静态部署** — `nuxt generate` 一键生成，GitHub Pages 直接上线

### 内容矩阵

#### 学习路线（5 篇）

AI 前端工程师进化指南，从环境武装到流式架构。

| # | 标题 | 核心内容 |
|---|------|---------|
| 01 | 环境武装 | Claude Code + Cursor 双工具链、MCP Server 配置 |
| 02 | Vercel AI SDK | `useChat` / `useCompletion` 源码级拆解、SSE 流式原理 |
| 03 | Function Calling | Tool Use 协议、前端定义工具 Schema、多轮调用状态机 |
| 04 | RAG 全栈落地 | Embedding + 向量检索 + 引用来源 UI |
| 05 | MCP 协议 | 自定义 MCP Server + Client 集成 |

#### Prompt 库（6 篇）

前端专用 Prompt 模板，复制即用。

| # | 场景 | 用途 |
|---|------|------|
| 01 | Bug 排查 | 粘贴报错，定位根因 |
| 02 | 组件重构 | 屎山 → Composition API |
| 03 | UI 生成 | 自然语言 → Tailwind 组件 |
| 04 | TypeScript | 数据结构 → Zod Schema |
| 05 | 测试生成 | 组件代码 → Vitest 测试 |
| 06 | 性能优化 | 瓶颈描述 → 优化方案 |

#### 实战演练（4 篇）

从 0 到 1 构建 AI 驱动的智能文档助手。

| # | 阶段 | 内容 |
|---|------|------|
| 01 | 架构设计 | Nuxt 3 项目搭建、BFF 架构、API Key 安全方案 |
| 02 | 对话引擎 | 流式 Chat UI、Markdown 渲染、中断控制 |
| 03 | RAG 集成 | 文档上传 → 分块 → Embedding → 向量存储 |
| 04 | Agent + 部署 | Function Calling、成本监控、Vercel 部署 |

### 技术栈

| 技术 | 用途 |
|------|------|
| **Nuxt 3** | 框架，SSR/SSG 双模式 |
| **@nuxt/content v3** | Markdown 解析引擎 |
| **Tailwind CSS** | 原子化样式 |
| **@tailwindcss/typography** | Markdown 排版美化 |
| **Shiki** | 代码高亮（github-dark 主题） |
| **Lucide Vue** | 图标库 |
| **TypeScript** | 类型安全 |

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/maxlongchips/vibe-front.git
cd vibe-front

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 `http://localhost:3000`。

### 构建与部署

```bash
# 静态站点生成（用于 GitHub Pages）
npm run generate

# 预览构建产物
npm run preview
```

### 项目结构

```
vibe-front/
├── assets/css/main.css          # 全局样式
├── content/                     # Markdown 内容
│   ├── index.md                 # 首页
│   ├── roadmap/                 # 学习路线（5 篇）
│   ├── prompts/                 # Prompt 库（6 篇）
│   └── playground/              # 实战演练（4 篇）
├── content.config.ts            # Content v3 集合配置
├── layouts/default.vue          # 暗黑主题布局
├── pages/[...slug].vue          # 动态路由文档渲染器
├── nuxt.config.ts               # Nuxt 配置
└── tailwind.config.js           # Tailwind 配置
```

### License

MIT
