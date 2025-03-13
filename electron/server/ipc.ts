import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'
import simpleGit from 'simple-git'
import { promisify } from 'util'

const globPromise = promisify(glob)

interface DocNodeConfig {
  title: string;
  name: string;  // 文件名或目录名
  type: 'file' | 'directory';
  children?: DocNodeConfig[];  // 改为数组
}

interface DocConfig {
  files: DocNodeConfig[];  // 改为 files
}

interface DocNode {
  title: string;
  key: string;
  isDirectory: boolean;
  children?: DocNode[];
  exists?: boolean;  // 添加文件存在性标记
}

interface GitConfig {
  repoUrl: string;
  branch: string;
  docPath: string;
}

interface PathConfig {
    localPath: string;
    remotePath: string;
}

function checkFileExists(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile();
  } catch (error) {
    return false;
  }
}

function buildDocTree(files: string[], docsPath: string, config: DocConfig): DocNode[] {
  const isRemote = path.basename(docsPath) === 'remote_docs';
  const prefix = isRemote ? '/remote_docs/' : '/docs/';
  const tree: DocNode[] = [];
  const nodeMap = new Map<string, DocNode>();
  const configMap = new Map<string, DocNodeConfig & { index: number }>();

  // 检查文件是否存在
  function checkFileExists(filePath: string): boolean {
    const fullPath = path.join(docsPath, filePath);
    try {
      const stat = fs.statSync(fullPath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  // 检查目录是否存在
  function checkDirExists(dirPath: string): boolean {
    const fullPath = path.join(docsPath, dirPath);
    try {
      const stat = fs.statSync(fullPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  // 构建配置映射
  function buildConfigMap(nodes: DocNodeConfig[], parentPath: string = '') {
    nodes.forEach((node, index) => {
      const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;
      configMap.set(nodePath, { ...node, index });
      
      if (node.type === 'directory' && node.children) {
        buildConfigMap(node.children, nodePath);
      }
    });
  }

  if (config.files) {
    buildConfigMap(config.files);
  }

  // 获取配置的辅助函数
  function getNodeConfig(nodePath: string): (DocNodeConfig & { index: number }) | undefined {
    return configMap.get(nodePath);
  }

  // 创建目录节点的辅助函数
  function ensureDirectoryNode(dirPath: string, parentNode: DocNode[] | undefined = undefined): DocNode[] {
    if (!dirPath) return tree;
    
    const fullKey = prefix + dirPath;
    const existingNode = nodeMap.get(fullKey);
    if (existingNode) {
      return existingNode.children!;
    }

    const parts = dirPath.split('/');
    let currentPath = '';
    let currentParent = parentNode || tree;

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const currentKey = prefix + currentPath;
      
      let node = nodeMap.get(currentKey);
      if (!node) {
        // 检查是否有配置
        const nodeConfig = getNodeConfig(currentPath);
        node = {
          title: nodeConfig?.title || part,
          key: currentKey,
          isDirectory: true,
          children: [],
          exists: checkDirExists(currentPath)  // 使用新的目录检查函数
        };
        nodeMap.set(currentKey, node);
        currentParent.push(node);
      }
      currentParent = node.children!;
    }

    return currentParent;
  }

  // 添加文件节点的辅助函数
  function addFileNode(filePath: string, parentNode: DocNode[]) {
    const fullKey = prefix + filePath;
    if (nodeMap.has(fullKey)) return;

    // 检查是否有配置
    const nodeConfig = getNodeConfig(filePath);
    const fileName = path.basename(filePath);
    
    const node: DocNode = {
      title: nodeConfig?.title || fileName.replace(/\.md$/, ''),
      key: fullKey,
      isDirectory: false,
      exists: checkFileExists(filePath)  // 检查文件是否存在
    };
    nodeMap.set(fullKey, node);
    parentNode.push(node);
  }

  // 首先处理配置中的节点
  if (config.files) {
    config.files.forEach(nodeConfig => {
      const normalizedPath = nodeConfig.name.replace(/\\/g, '/');
      const dirPath = path.dirname(normalizedPath);
      
      if (nodeConfig.type === 'directory') {
        const parentNode = dirPath === '.' ? tree : ensureDirectoryNode(dirPath);
        const fullKey = prefix + normalizedPath;
        
        // 如果目录节点已存在，跳过
        if (nodeMap.has(fullKey)) return;
        
        const exists = checkDirExists(normalizedPath);
        const node: DocNode = {
          title: nodeConfig.title || path.basename(normalizedPath),
          key: fullKey,
          isDirectory: true,
          children: [],
          exists
        };
        nodeMap.set(node.key, node);
        parentNode.push(node);
      } else {
        const parentNode = dirPath === '.' ? tree : ensureDirectoryNode(dirPath);
        const fullKey = prefix + normalizedPath;
        
        // 如果文件节点已存在，跳过
        if (nodeMap.has(fullKey)) return;
        
        const exists = checkFileExists(normalizedPath);
        const node: DocNode = {
          title: nodeConfig.title || path.basename(normalizedPath).replace(/\.md$/, ''),
          key: fullKey,
          isDirectory: false,
          exists
        };
        nodeMap.set(node.key, node);
        parentNode.push(node);
      }
    });
  }

  // 处理未配置的文件
  files.forEach(file => {
    const normalizedPath = file.replace(/\\/g, '/');
    const fullKey = prefix + normalizedPath;
    
    // 如果文件已经在节点映射中，跳过
    if (nodeMap.has(fullKey)) return;

    const dirPath = path.dirname(normalizedPath);
    const parentNode = dirPath === '.' ? tree : ensureDirectoryNode(dirPath);
    addFileNode(normalizedPath, parentNode);
  });

  // 递归排序函数
  function sortNodes(nodes: DocNode[]) {
    nodes.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      
      // 获取节点的配置和索引
      const configA = getNodeConfig(a.key.slice(prefix.length));
      const configB = getNodeConfig(b.key.slice(prefix.length));
      
      // 比较索引
      const indexA = configA?.index ?? Number.MAX_SAFE_INTEGER;
      const indexB = configB?.index ?? Number.MAX_SAFE_INTEGER;
      if (indexA !== indexB) {
        return indexA - indexB;
      }
      
      return a.title.localeCompare(b.title);
    });

    // 递归排序子节点
    nodes.forEach(node => {
      if (node.children) {
        sortNodes(node.children);
      }
    });
  }

  sortNodes(tree);
  return tree;
}

export function setupIpcHandlers(publicPath: string) {
  const git = simpleGit();
  const gitConfigPath = path.join(publicPath, 'docs', 'git-config.json');
  const pathConfigPath = path.join(publicPath, 'path-config.json');

  // 获取文档列表
  ipcMain.handle('doc:list', async (event, basePath = '/docs') => {
    try {
      // 读取路径配置
      let pathConfig: PathConfig = {
        localPath: 'public/docs',
        remotePath: 'public/remote_docs'
      };
      
      try {
        if (fs.existsSync(pathConfigPath)) {
          pathConfig = JSON.parse(fs.readFileSync(pathConfigPath, 'utf-8'));
        }
      } catch (error) {
        console.error('读取路径配置失败:', error);
      }

      // 根据模式选择路径
      const isRemote = basePath === '/remote_docs';
      const configuredPath = isRemote ? pathConfig.remotePath : pathConfig.localPath;
      
      // 处理路径
      let rootPath: string;
      if (path.isAbsolute(configuredPath)) {
        rootPath = configuredPath;
      } else {
        rootPath = path.resolve(publicPath, '..', configuredPath);
      }

      // 如果目录不存在，直接返回空数组
      if (!fs.existsSync(rootPath)) {
        console.error('目录不存在:', rootPath);
        return [];
      }

      const files = await globPromise('**/*.md', { cwd: rootPath });
      const configPath = path.join(rootPath, 'config.json');
      let config: DocConfig = { files: [] };

      if (fs.existsSync(configPath)) {
        try {
          const configContent = await fsPromises.readFile(configPath, 'utf-8');
          const rawConfig = JSON.parse(configContent);
          
          // 如果是旧格式，转换为新格式
          if (!rawConfig.files && !rawConfig.nodes) {
            const newConfig: DocConfig = { files: [] };
            function convertOldConfig(oldConfig: any) {
              Object.entries(oldConfig).forEach(([key, value]: [string, any]) => {
                const isFile = key.endsWith('.md');
                newConfig.files.push({
                  title: value.title || key,
                  name: key,
                  type: isFile ? 'file' : 'directory',
                  ...(isFile ? {} : { children: [] })
                });
              });
            }
            convertOldConfig(rawConfig);
            config = newConfig;
          } else {
            config = {
              files: rawConfig.files || rawConfig.nodes || []
            };
          }
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
      // 读取路径配置
      let pathConfig: PathConfig = {
        localPath: 'public/docs',
        remotePath: 'public/remote_docs'
      };
      
      try {
        if (fs.existsSync(pathConfigPath)) {
          pathConfig = JSON.parse(fs.readFileSync(pathConfigPath, 'utf-8'));
        }
      } catch (error) {
        console.error('读取路径配置失败:', error);
      }

      // 根据路径选择配置
      const isRemote = docPath.startsWith('/remote_docs/');
      const configuredPath = isRemote ? pathConfig.remotePath : pathConfig.localPath;
      const relativePath = docPath.startsWith('/docs/') ? docPath.slice(6) : 
                          docPath.startsWith('/remote_docs/') ? docPath.slice(12) : 
                          docPath;
      
      // 处理路径
      let basePath: string;
      if (path.isAbsolute(configuredPath)) {
        basePath = configuredPath;
      } else {
        basePath = path.resolve(publicPath, '..', configuredPath);
      }
      
      const fullPath = path.join(basePath, relativePath);
      
      if (!fs.existsSync(fullPath)) {
        throw new Error('文档不存在');
      }
      const content = await fsPromises.readFile(fullPath, 'utf-8');
      return content;
    } catch (error) {
      console.error('读取文档失败:', error);
      if (error instanceof Error) {
        throw new Error(error.message.includes('不存在') ? error.message : '读取文档失败');
      }
      throw new Error('读取文档失败');
    }
  });

  // 保存文档
  ipcMain.handle('doc:save', async (event, docPath: string, content: string) => {
    try {
      // 读取路径配置
      let pathConfig: PathConfig = {
        localPath: 'public/docs',
        remotePath: 'public/remote_docs'
      };
      
      try {
        if (fs.existsSync(pathConfigPath)) {
          pathConfig = JSON.parse(fs.readFileSync(pathConfigPath, 'utf-8'));
        }
      } catch (error) {
        console.error('读取路径配置失败:', error);
      }

      // 根据路径选择配置
      const isRemote = docPath.startsWith('/remote_docs/');
      const configuredPath = isRemote ? pathConfig.remotePath : pathConfig.localPath;
      const relativePath = docPath.startsWith('/docs/') ? docPath.slice(6) : 
                          docPath.startsWith('/remote_docs/') ? docPath.slice(12) : 
                          docPath;
      
      // 处理路径
      let basePath: string;
      if (path.isAbsolute(configuredPath)) {
        basePath = configuredPath;
      } else {
        basePath = path.resolve(publicPath, '..', configuredPath);
      }
      
      const fullPath = path.join(basePath, relativePath);
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
      // 读取路径配置
      let pathConfig: PathConfig = {
        localPath: 'public/docs',
        remotePath: 'public/remote_docs'
      };
      
      try {
        if (fs.existsSync(pathConfigPath)) {
          pathConfig = JSON.parse(fs.readFileSync(pathConfigPath, 'utf-8'));
        }
      } catch (error) {
        console.error('读取路径配置失败:', error);
      }

      // 根据路径选择配置
      const isRemote = docPath.startsWith('/remote_docs/');
      const configuredPath = isRemote ? pathConfig.remotePath : pathConfig.localPath;
      
      // 处理路径
      let basePath: string;
      if (path.isAbsolute(configuredPath)) {
        basePath = configuredPath;
      } else {
        basePath = path.resolve(publicPath, '..', configuredPath);
      }
      
      const configPath = path.join(basePath, 'config.json');
      let config: DocConfig = { files: [] };

      if (fs.existsSync(configPath)) {
        try {
          const configContent = await fsPromises.readFile(configPath, 'utf-8');
          const rawConfig = JSON.parse(configContent);
          
          // 如果是旧格式，转换为新格式
          if (!rawConfig.files && !rawConfig.nodes) {
            const newConfig: DocConfig = { files: [] };
            function convertOldConfig(oldConfig: any) {
              Object.entries(oldConfig).forEach(([key, value]: [string, any]) => {
                const isFile = key.endsWith('.md');
                newConfig.files.push({
                  title: value.title || key,
                  name: key,
                  type: isFile ? 'file' : 'directory',
                  ...(isFile ? {} : { children: [] })
                });
              });
            }
            convertOldConfig(rawConfig);
            config = newConfig;
          } else {
            config = {
              files: rawConfig.files || rawConfig.nodes || []
            };
          }
        } catch (error) {
          console.error('读取配置文件失败:', error);
        }
      }

      const relativePath = docPath.startsWith('/docs/') ? docPath.slice(6) : 
                          docPath.startsWith('/remote_docs/') ? docPath.slice(12) : 
                          docPath;

      const isFile = relativePath.endsWith('.md');
      const pathParts = relativePath.split('/');
      let currentConfig = config.files;
      
      // 创建或更新路径上的所有节点
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        const isLastPart = i === pathParts.length - 1;
        
        if (!currentConfig.find(node => node.name === part)) {
          currentConfig.push({
            title: isLastPart ? title : part,
            name: part,
            type: isLastPart ? (isFile ? 'file' : 'directory') : 'directory',
            ...(isLastPart ? {} : { children: [] })
          });
        } else if (isLastPart) {
          const node = currentConfig.find(node => node.name === part);
          if (node) {
            node.title = title;
          }
        }
        
        if (!isLastPart) {
          const node = currentConfig.find(node => node.name === part);
          if (node && node.children) {
            currentConfig = node.children;
          } else {
            currentConfig = [];
          }
        }
      }

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

  // 获取路径配置
  ipcMain.handle('doc:get-path-config', async () => {
    try {
      if (fs.existsSync(pathConfigPath)) {
        const config = JSON.parse(fs.readFileSync(pathConfigPath, 'utf-8'));
        return config;
      }
      return {
        localPath: 'public/docs',
        remotePath: 'public/remote_docs'
      };
    } catch (error) {
      console.error('读取路径配置失败:', error);
      return {
        localPath: 'public/docs',
        remotePath: 'public/remote_docs'
      };
    }
  });

  // 更新路径配置
  ipcMain.handle('doc:update-path-config', async (event, config: PathConfig) => {
    try {
      fs.writeFileSync(pathConfigPath, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error('更新路径配置失败:', error);
      throw error;
    }
  });
} 