# 架构设计

## 整体架构

Talisman 采用 Electron 作为桌面应用框架，使用 React 作为前端框架，实现了一个现代化的文档管理系统。

### 核心组件

```
talisman/
├── electron/                 # Electron 主进程
│   ├── main/                # 主进程入口
│   ├── preload/             # 预加载脚本
│   └── server/              # IPC 通信处理
├── src/                     # React 渲染进程
│   ├── components/          # React 组件
│   ├── App.tsx             # 应用入口
│   ├── layout.tsx          # 布局组件
│   └── doc.tsx             # 文档管理组件
└── public/                  # 静态资源
    └── docs/               # 文档存储目录
```

## 通信机制

### IPC 通信

系统使用 Electron 的 IPC (进程间通信) 机制实现主进程和渲染进程之间的通信：

1. **文档操作**
   - `doc:list`: 获取文档列表
   - `doc:get`: 获取文档内容
   - `doc:save`: 保存文档
   - `doc:config`: 更新文档配置

2. **Git 操作**
   - `doc:pull-from-git`: 从 Git 仓库拉取文档
   - `doc:get-git-config`: 获取 Git 配置

## 数据流

1. **文档数据流**
   ```
   文件系统 <-> 主进程 <-> IPC <-> 渲染进程 <-> React 组件
   ```

2. **Git 数据流**
   ```
   远程仓库 <-> Git 操作 <-> 主进程 <-> IPC <-> 渲染进程
   ```

## 关键实现

### 文档树构建

```typescript
interface DocNode {
  title: string;
  key: string;
  isDirectory?: boolean;
  children?: DocNode[];
}

function buildDocTree(files: string[], config: DocConfig): DocNode[] {
  // 1. 创建目录节点
  // 2. 添加文件节点
  // 3. 排序处理
}
```

### Git 集成

```typescript
interface GitConfig {
  repoUrl: string;
  branch: string;
  docPath: string;
}

async function pullFromGit(config: GitConfig) {
  // 1. 克隆/拉取仓库
  // 2. 复制文档
  // 3. 清理临时文件
}
```

## 扩展性设计

1. **插件系统**
   - 预留了插件扩展接口
   - 支持自定义文档处理器

2. **主题系统**
   - 支持自定义主题
   - 提供暗色模式支持

3. **文档格式**
   - 目前支持 Markdown
   - 可扩展支持其他格式 