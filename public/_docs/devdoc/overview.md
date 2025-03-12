# Talisman 项目概述

Talisman 是一个基于 Electron + React 的现代化文档管理系统，专注于提供简洁、高效的文档编写和管理体验。

## 主要特性

1. **多级目录支持**
   - 支持无限层级的文档目录结构
   - 可配置的目录和文档标题
   - 灵活的目录展开/折叠功能

2. **Markdown 编辑器**
   - 实时预览功能
   - 代码高亮支持
   - 自动保存功能

3. **Git 集成**
   - 支持从远程 Git 仓库拉取文档
   - 可配置仓库地址、分支和文档目录
   - 文档版本管理

4. **用户界面**
   - 现代化的 UI 设计
   - 响应式布局
   - 可折叠的侧边栏
   - 暗色主题支持

## 技术栈

- **前端框架**: React + TypeScript
- **UI 组件**: Ant Design (antd)
- **编辑器**: md-editor-rt
- **构建工具**: Vite
- **桌面框架**: Electron
- **版本控制**: Git

## 开发环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0
- Git

## 快速开始

1. 克隆项目
```bash
git clone [项目地址]
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm run dev
```

4. 构建应用
```bash
npm run build
``` 