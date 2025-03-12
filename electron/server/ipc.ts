import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'
import simpleGit from 'simple-git'
import { promisify } from 'util'

const globPromise = promisify(glob)

interface DocConfig {
  [key: string]: {
    title?: string;
    order?: number;
  };
}

interface DocNode {
  title: string;
  key: string;
  isDirectory?: boolean;
  children?: DocNode[];
}

interface GitConfig {
  repoUrl: string;
  branch: string;
  docPath: string;
}

function buildDocTree(files: string[], docsPath: string, config: DocConfig): DocNode[] {
  const tree: DocNode[] = [];
  const dirMap = new Map<string, DocNode>();
  const isRemote = path.basename(docsPath) === 'remote_docs';

  // 首先创建所有目录节点
  files.forEach(file => {
    const parts = file.split('/');
    let currentPath = '';

    // 处理每一级目录
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!dirMap.has(currentPath)) {
        const configKey = currentPath;
        const node: DocNode = {
          title: config[configKey]?.title || part,
          key: isRemote ? `/remote_docs/${currentPath}` : `/docs/${currentPath}`,
          isDirectory: true,
          children: []
        };
        dirMap.set(currentPath, node);

        if (parentPath) {
          const parentNode = dirMap.get(parentPath);
          parentNode?.children?.push(node);
        } else {
          tree.push(node);
        }
      }
    }
  });

  // 然后添加文件节点
  files.forEach(file => {
    const parts = file.split('/');
    const fileName = parts[parts.length - 1];
    const dirPath = parts.slice(0, -1).join('/');
    const configKey = file;
    
    const node: DocNode = {
      title: config[configKey]?.title || fileName,
      key: isRemote ? `/remote_docs/${file}` : `/docs/${file}`,
      isDirectory: false
    };

    if (dirPath) {
      const dirNode = dirMap.get(dirPath);
      dirNode?.children?.push(node);
    } else {
      tree.push(node);
    }
  });

  // 对每个目录中的内容进行排序
  const sortNodes = (nodes: DocNode[]) => {
    nodes.sort((a, b) => {
      // 目录优先
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      // 同类型按照配置的顺序排序
      const configKeyA = a.key.slice(isRemote ? 12 : 6);
      const configKeyB = b.key.slice(isRemote ? 12 : 6);
      const orderA = config[configKeyA]?.order || 0;
      const orderB = config[configKeyB]?.order || 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      // 最后按标题字母顺序排序
      return a.title.localeCompare(b.title);
    });
    // 递归排序子目录
    nodes.forEach(node => {
      if (node.children) {
        sortNodes(node.children);
      }
    });
  };
  sortNodes(tree);

  return tree;
}

export function setupIpcHandlers(publicPath: string) {
  const git = simpleGit();
  const gitConfigPath = path.join(publicPath, 'docs', 'git-config.json');

  // 获取文档列表
  ipcMain.handle('doc:list', async (event, basePath = '/docs') => {
    const rootPath = path.join(publicPath, basePath.slice(1));
    const isRemote = basePath === '/remote_docs';

    try {
      // 如果目录不存在，直接返回空数组
      if (!fs.existsSync(rootPath)) {
        return [];
      }

      const files = await globPromise('**/*.md', { cwd: rootPath });
      const configPath = path.join(publicPath, isRemote ? 'remote_docs/config.json' : 'docs/config.json');
      let config: DocConfig = {};

      if (fs.existsSync(configPath)) {
        try {
          const configContent = await fsPromises.readFile(configPath, 'utf-8');
          config = JSON.parse(configContent);
        } catch (error) {
          console.error('读取配置文件失败:', error);
        }
      }

      return buildDocTree(files, rootPath, config);
    } catch (error) {
      console.error('获取文档列表失败:', error);
      throw error;
    }
  });

  // 获取文档内容
  ipcMain.handle('doc:get', async (event, docPath: string) => {
    try {
      const fullPath = path.join(publicPath, docPath.slice(1));
      if (!fs.existsSync(fullPath)) {
        throw new Error('文档不存在');
      }
      const content = await fsPromises.readFile(fullPath, 'utf-8');
      return content;
    } catch (error) {
      console.error('读取文档失败:', error);
      throw error;
    }
  });

  // 保存文档
  ipcMain.handle('doc:save', async (event, docPath: string, content: string) => {
    try {
      const fullPath = path.join(publicPath, docPath.slice(1));
      const dir = path.dirname(fullPath);
      
      if (!fs.existsSync(dir)) {
        await fsPromises.mkdir(dir, { recursive: true });
      }

      await fsPromises.writeFile(fullPath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('保存文档失败:', error);
      throw error;
    }
  });

  // 更新文档配置
  ipcMain.handle('doc:config', async (event, docPath: string, title: string) => {
    try {
      const configPath = path.join(publicPath, 'docs', 'config.json');
      let config: DocConfig = {};

      if (fs.existsSync(configPath)) {
        try {
          const configContent = await fsPromises.readFile(configPath, 'utf-8');
          config = JSON.parse(configContent);
        } catch (error) {
          console.error('读取配置文件失败:', error);
        }
      }

      const relativePath = docPath.startsWith('/docs/') ? docPath.slice(6) : 
                          docPath.startsWith('/remote_docs/') ? docPath.slice(12) : 
                          docPath;

      config[relativePath] = {
        ...config[relativePath],
        title
      };

      await fsPromises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('更新配置失败:', error);
      throw error;
    }
  });

  // 从远程仓库拉取文档
  ipcMain.handle('doc:pull-from-git', async (event, config: GitConfig) => {
    const tempDir = path.join(publicPath, 'temp_git');
    const gitConfigPath = path.join(publicPath, 'docs', 'git-config.json');

    try {
      // 保存配置
      await fsPromises.writeFile(gitConfigPath, JSON.stringify(config, null, 2), 'utf-8');

      // 确保临时目录存在
      await fsPromises.mkdir(tempDir, { recursive: true });

      // 克隆仓库到临时目录
      await git.clone(config.repoUrl, tempDir);
      
      // 切换到指定分支
      const tempGit = simpleGit(tempDir);
      await tempGit.checkout(config.branch);

      // 复制文档到与 docs 平级的 remote_docs 目录
      const docSourcePath = path.join(tempDir, config.docPath);
      const remoteDocsPath = path.join(publicPath, 'remote_docs');
      
      // 确保 remote_docs 目录存在
      await fsPromises.mkdir(remoteDocsPath, { recursive: true });

      // 复制文档
      const files = await globPromise('**/*.{md,json}', { cwd: docSourcePath });
      for (const file of files) {
        const sourcePath = path.join(docSourcePath, file);
        const targetPath = path.join(remoteDocsPath, file);
        await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
        await fsPromises.copyFile(sourcePath, targetPath);
      }

      // 清理临时克隆目录
      await fsPromises.rm(tempDir, { recursive: true, force: true });

      return { success: true };
    } catch (error) {
      console.error('Git pull failed:', error);
      // 清理临时目录
      try {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.error('Failed to clean up temp directory:', e);
      }
      throw error;
    }
  });

  // 获取 Git 配置
  ipcMain.handle('doc:get-git-config', async () => {
    try {
      if (fs.existsSync(gitConfigPath)) {
        const configContent = await fsPromises.readFile(gitConfigPath, 'utf-8');
        return JSON.parse(configContent);
      }
      return null;
    } catch (error) {
      console.error('获取Git配置失败:', error);
      throw error;
    }
  });
} 