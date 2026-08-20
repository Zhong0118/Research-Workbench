# Research Workbench · 科研工作台

> 这是 [Zhong0118](https://github.com/Zhong0118) 对 [Layman-art/Research-Workbench](https://github.com/Layman-art/Research-Workbench) 的 **macOS 适配 fork**：将原项目的 Electron/Windows 实现迁移至 Tauri 2，面向 Apple Silicon 构建原生 macOS 应用，并完善了科研方向、项目、待办、日程、文献等研究工作流。
>
> 预构建安装包见 [Releases](https://github.com/Zhong0118/Research-Workbench/releases/latest)，可直接下载 `.dmg` 安装。

面向个人研究生与科研人员的本地优先 macOS 工作台，用一处界面管理科研项目、研究方向、待办、日程、文献笔记与实验记录。

## 主要能力

- Tauri 2 原生 macOS 外壳，Apple Silicon arm64 构建
- SQLite 本地存储、事务回滚和异常退出草稿恢复
- Markdown 编辑/预览、代码块、表格、链接与安全渲染
- 科研项目列表与四状态看板，关联“下一步行动”
- 日/周/月周期待办、优先级、截止日期与完成动画
- 原生到期提醒、跨重启去重和 Dock 过期数量角标
- 轻量文献笔记：作者、年份、DOI、链接和阅读状态
- 浅色纸墨、深色月夜、跟随系统与减少动效
- JSON 完整备份，以及 Markdown、CSV、HTML 导出
- 批量归档、移动工作区和删除

应用没有账号和云同步。科研数据保存在本机，外链只允许 HTTPS。

## macOS 安装

**直接安装（推荐）**：前往 [Releases](https://github.com/Zhong0118/Research-Workbench/releases/latest) 下载最新 `.dmg`，双击打开后把 `Research Workbench.app` 拖入「应用程序」即可。

完整安装、升级与数据说明见 [macOS 安装、升级与数据说明](./docs/macos-installation.md)。

从源码本地构建：

```bash
pnpm install
pnpm check
pnpm dist
```

生成文件：

```text
src-tauri/target/release/bundle/macos/Research Workbench.app
src-tauri/target/release/bundle/dmg/Research Workbench_1.0.11_aarch64.dmg
```

将 `.app` 拖入 `/Applications`，首次启动时在 Finder 中右键选择“打开”。

## 开发环境

- Apple Silicon Mac
- Node.js 22.12–22.x
- pnpm 11
- Rust stable 与 Xcode Command Line Tools

```bash
pnpm dev          # 浏览器预览
pnpm dev:desktop  # Tauri 开发版
pnpm check        # ESLint + Vitest + TypeScript + Vite
pnpm test:e2e     # Playwright
pnpm build:desktop
pnpm dist          # 生成 arm64 .app 与 .dmg
```

## 数据与隐私

数据库通常位于：

```text
~/Library/Application Support/com.researchworkbench.desktop/research-workbench.db
```

建议定期从“设置与数据”导出 JSON。通知正文只包含待办标题和截止提示，不包含研究笔记正文。

## 技术栈

- Tauri 2 + Rust
- React 19 + TypeScript + Vite
- Zustand
- SQLite
- Vitest + Playwright

项目采用 [MIT License](./LICENSE)。版本变化见 [CHANGELOG.md](./CHANGELOG.md)。
