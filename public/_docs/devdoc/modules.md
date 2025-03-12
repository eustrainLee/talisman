# 功能模块说明

## 文档管理模块

### 文档编辑器 (src/doc.tsx)

核心功能组件，负责文档的编辑和预览：

1. **布局设计**
   ```typescript
   <Layout>
     <Card>
       <Toolbar /> {/* 顶部工具栏 */}
       <Layout>
         <Sider /> {/* 文档目录树 */}
         <Content /> {/* 编辑器/预览区域 */}
       </Layout>
     </Card>
   </Layout>
   ```

2. **状态管理**
   ```typescript
   const [markdown, setMarkdown] = useState('');
   const [isPreview, setIsPreview] = useState(true);
   const [currentFile, setCurrentFile] = useState('/docs/index.md');
   const [docFiles, setDocFiles] = useState<DocFile[]>([]);
   ```

3. **自动保存**
   ```typescript
   useEffect(() => {
     const timer = setTimeout(() => {
       if (!isPreview && markdown !== prevMarkdown) {
         saveMarkdown();
       }
     }, 2000);
     return () => clearTimeout(timer);
   }, [markdown]);
   ```

### 文档目录树

1. **数据结构**
   ```typescript
   interface DocFile {
     title: string;
     key: string;
     children?: DocFile[];
     isDirectory?: boolean;
   }
   ```

2. **配置系统**
   ```typescript
   interface DocConfig {
     [key: string]: {
       title?: string;
       order?: number;
     };
   }
   ```

## Git 集成模块

### 配置管理

1. **配置存储**
   - 位置：`docs/git-config.json`
   - 格式：
     ```json
     {
       "repoUrl": "https://github.com/user/repo.git",
       "branch": "main",
       "docPath": "docs"
     }
     ```

2. **操作流程**
   ```typescript
   async function handlePullFromGit(config: GitConfig) {
     // 1. 保存配置
     // 2. 克隆仓库
     // 3. 复制文档
     // 4. 更新目录树
   }
   ```

## IPC 通信模块

### 预加载脚本 (electron/preload.ts)

```typescript
interface IElectronAPI {
  getDocList: () => Promise<DocFile[]>;
  getDocContent: (path: string) => Promise<string>;
  saveDoc: (path: string, content: string) => Promise<void>;
  updateDocConfig: (path: string, title: string) => Promise<void>;
  pullFromGit: (config: GitConfig) => Promise<{ success: boolean }>;
  getGitConfig: () => Promise<GitConfig | null>;
}
```

### 主进程处理 (electron/server/ipc.ts)

1. **文档操作处理器**
   ```typescript
   ipcMain.handle('doc:list', async () => {
     // 获取文档列表
   });

   ipcMain.handle('doc:save', async (event, path, content) => {
     // 保存文档
   });
   ```

2. **Git 操作处理器**
   ```typescript
   ipcMain.handle('doc:pull-from-git', async (event, config) => {
     // 处理 Git 拉取请求
   });
   ```

## 用户界面模块

### 布局组件 (src/layout.tsx)

1. **侧边栏管理**
   ```typescript
   const [collapsed, setCollapsed] = useState(true);
   ```

2. **路由配置**
   ```typescript
   <Routes>
     <Route path="/" element={<Home />} />
     <Route path="/doc" element={<Doc />} />
     <Route path="/account" element={<Account />} />
   </Routes>
   ```

### 主题和样式

1. **全局样式**
   - 使用 Ant Design 主题系统
   - 支持明暗主题切换
   - 响应式布局适配

2. **组件样式**
   - 文档树样式优化
   - 编辑器主题定制
   - 工具栏布局优化 