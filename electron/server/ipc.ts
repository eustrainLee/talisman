import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'
import simpleGit from 'simple-git'
import { promisify } from 'util'
import log from 'electron-log'
import { app } from 'electron'

// 配置日志
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';

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

// 简单的路径处理函数
function normalizePathEncoding(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function checkFileExists(filePath: string, basePath: string): boolean {
  try {
    // 使用提供的基准路径来构建完整路径
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(basePath, filePath);
    log.debug('Checking file exists:', fullPath);
    const stat = fs.statSync(fullPath);
    const exists = stat.isFile();
    log.debug('File exists:', exists);
    return exists;
  } catch (error) {
    log.debug('File does not exist:', filePath, error);
    return false;
  }
}

function buildDocTree(files: string[], docsPath: string, config: DocConfig): DocNode[] {
  const isRemote = path.basename(docsPath) === 'remote_docs';
  const prefix = isRemote ? '/remote_docs/' : '/docs/';
  const tree: DocNode[] = [];
  const nodeMap = new Map<string, DocNode>();
  const configMap = new Map<string, DocNodeConfig & { index: number }>();

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
      exists: checkFileExists(filePath, docsPath)  // 传入 docsPath 作为基准路径
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
        
        const exists = checkFileExists(normalizedPath, docsPath);  // 传入 docsPath 作为基准路径
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

  // 获取路径配置的辅助函数
  async function getPathConfig(): Promise<PathConfig> {
    try {
      // 获取用户数据目录
      const userDataPath = app.getPath('userData');
      const configFilePath = path.join(userDataPath, 'path-config.json');
      
      log.info('Config file path:', configFilePath);
      
      // 尝试读取配置文件
      if (fs.existsSync(configFilePath)) {
        const config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
        log.info('Successfully read path configuration:', config);
        return config;
      }

      // 如果配置文件不存在，创建默认配置
      const defaultConfig: PathConfig = {
        localPath: path.join(userDataPath, 'docs'),
        remotePath: path.join(userDataPath, 'remote_docs')
      };

      // 确保目录存在
      const configDir = path.dirname(configFilePath);
      if (!fs.existsSync(configDir)) {
        await fsPromises.mkdir(configDir, { recursive: true });
        log.info('Created config directory:', configDir);
      }

      // 写入默认配置
      await fsPromises.writeFile(configFilePath, JSON.stringify(defaultConfig, null, 2));
      log.info('Created default path configuration:', defaultConfig);
      return defaultConfig;
    } catch (error) {
      log.error('Failed to handle path configuration:', error);
      // 返回默认配置作为后备
      const userDataPath = app.getPath('userData');
      return {
        localPath: path.join(userDataPath, 'docs'),
        remotePath: path.join(userDataPath, 'remote_docs')
      };
    }
  }

  // 获取文档列表
  ipcMain.handle('doc:list', async (_event, basePath = '/docs') => {
    try {
      log.info('Fetching document list for path:', basePath);
      // 读取路径配置
      const pathConfig = await getPathConfig();
      
      // 根据模式选择路径
      const isRemote = basePath === '/remote_docs';
      const configuredPath = isRemote ? pathConfig.remotePath : pathConfig.localPath;
      log.debug('Using configured path:', configuredPath);
      
      // 获取完整路径
      let rootPath: string;
      if (path.isAbsolute(configuredPath)) {
        rootPath = configuredPath;
      } else {
        // 统一处理相对路径：优先相对于 publicPath 的父目录
        rootPath = path.resolve(publicPath, '..', configuredPath);
        log.debug('Resolved root path:', rootPath);
        
        // 如果路径不存在，尝试相对于当前工作目录
        if (!fs.existsSync(rootPath)) {
          rootPath = path.resolve(process.cwd(), configuredPath);
          log.debug('Using CWD-relative path:', rootPath);
        }
      }

      // 如果目录不存在，创建它
      if (!fs.existsSync(rootPath)) {
        await fsPromises.mkdir(rootPath, { recursive: true });
        log.info('Created root directory:', rootPath);
      }

      // 使用绝对路径模式进行文件搜索
      const files = await globPromise('**/*.md', { 
        cwd: rootPath,
        absolute: true,
        follow: true,
        nodir: true,
        dot: false
      });
      log.debug('Found files:', files);

      // 将绝对路径转换回相对路径
      const relativeFiles = files.map(file => {
        const relativePath = path.relative(rootPath, file);
        return normalizePathEncoding(relativePath.split(path.sep).join('/'));
      });
      log.debug('Relative paths:', relativeFiles);

      const configPath = path.join(rootPath, 'config.json');
      let config: DocConfig = { files: [] };

      if (fs.existsSync(configPath)) {
        try {
          const configContent = await fsPromises.readFile(configPath, 'utf-8');
          const rawConfig = JSON.parse(configContent);
          log.debug('Read config file:', rawConfig);
          
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
            log.info('Converted old config format to new format');
          } else {
            config = {
              files: rawConfig.files || rawConfig.nodes || []
            };
          }
        } catch (error) {
          log.error('Failed to read configuration file:', error);
        }
      }

      return buildDocTree(relativeFiles, rootPath, config);
    } catch (error) {
      log.error('Failed to get document list:', error);
      throw error;
    }
  });

  // 获取文档内容
  ipcMain.handle('doc:get', async (_event, docPath: string) => {
    try {
      log.info('Getting document content for:', docPath);
      const pathConfig = await getPathConfig();
      
      // 根据路径选择配置
      const isRemote = docPath.startsWith('/remote_docs/');
      const configuredPath = isRemote ? pathConfig.remotePath : pathConfig.localPath;
      const relativePath = docPath.startsWith('/docs/') ? docPath.slice(6) : 
                          docPath.startsWith('/remote_docs/') ? docPath.slice(12) : 
                          docPath;
      
      log.debug('Relative path:', relativePath);
      
      // 统一使用正斜杠
      const normalizedRelativePath = normalizePathEncoding(relativePath.split(path.sep).join('/'));
      
      // 获取完整路径
      let fullPath: string;
      if (path.isAbsolute(configuredPath)) {
        fullPath = path.join(configuredPath, normalizedRelativePath);
      } else {
        // 统一处理相对路径：优先相对于 publicPath 的父目录
        const rootPath = path.resolve(publicPath, '..', configuredPath);
        fullPath = path.join(rootPath, normalizedRelativePath);
        
        // 如果路径不存在，尝试相对于当前工作目录
        if (!fs.existsSync(fullPath)) {
          const cwdPath = path.resolve(process.cwd(), configuredPath, normalizedRelativePath);
          if (fs.existsSync(cwdPath)) {
            fullPath = cwdPath;
          }
        }
      }
      
      log.debug('Full path:', fullPath);
      
      if (!fs.existsSync(fullPath)) {
        log.error('File does not exist:', fullPath);
        throw new Error('Document does not exist');
      }

      const content = await fsPromises.readFile(fullPath, 'utf-8');
      return content;
    } catch (error) {
      log.error('Failed to read document:', error);
      if (error instanceof Error) {
        throw new Error(error.message.includes('not exist') ? error.message : 'Failed to read document');
      }
      throw new Error('Failed to read document');
    }
  });

  // 保存文档
  ipcMain.handle('doc:save', async (_event, docPath: string, content: string) => {
    try {
      // 读取路径配置
      let pathConfig: PathConfig = {
        localPath: path.join(publicPath, 'docs'),
        remotePath: path.join(publicPath, 'remote_docs')
      };
      
      try {
        if (fs.existsSync(pathConfigPath)) {
          pathConfig = JSON.parse(fs.readFileSync(pathConfigPath, 'utf-8'));
        }
      } catch (error) {
        console.error('Failed to read path configuration:', error);
      }

      // 根据路径选择配置
      const isRemote = docPath.startsWith('/remote_docs/');
      const configuredPath = isRemote ? pathConfig.remotePath : pathConfig.localPath;
      const relativePath = docPath.startsWith('/docs/') ? docPath.slice(6) : 
                          docPath.startsWith('/remote_docs/') ? docPath.slice(12) : 
                          docPath;
      
      // 处理路径
      let rootPath: string;
      if (path.isAbsolute(configuredPath)) {
        rootPath = configuredPath;
      } else {
        rootPath = path.join(publicPath, configuredPath);
      }

      const fullPath = path.join(rootPath, relativePath);
      
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        await fsPromises.mkdir(dir, { recursive: true });
      }

      await fsPromises.writeFile(fullPath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('Failed to save document:', error);
      throw error;
    }
  });

  // 更新文档配置
  ipcMain.handle('doc:config', async (_event, docPath: string, title: string) => {
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
        console.error('Failed to read path configuration:', error);
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
          console.error('Failed to read configuration file:', error);
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
      console.error('Failed to update configuration:', error);
      throw error;
    }
  });

  // 从远程仓库拉取文档
  ipcMain.handle('doc:pull-from-git', async (_event, config: GitConfig) => {
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
      log.info('Getting path configuration');
      if (fs.existsSync(pathConfigPath)) {
        const config = JSON.parse(fs.readFileSync(pathConfigPath, 'utf-8'));
        log.debug('Read path configuration:', config);
        return config;
      }
      const defaultConfig = {
        localPath: 'docs',
        remotePath: 'remote_docs'
      };
      log.debug('Using default configuration:', defaultConfig);
      return defaultConfig;
    } catch (error) {
      log.error('Failed to read path configuration:', error);
      return {
        localPath: 'docs',
        remotePath: 'remote_docs'
      };
    }
  });

  // 更新路径配置
  ipcMain.handle('doc:update-path-config', async (_event, config: PathConfig) => {
    try {
      log.info('Updating path configuration:', config);
      
      // 获取用户数据目录
      const userDataPath = app.getPath('userData');
      const configFilePath = path.join(userDataPath, 'path-config.json');
      
      // 确保配置目录存在
      const configDir = path.dirname(configFilePath);
      if (!fs.existsSync(configDir)) {
        await fsPromises.mkdir(configDir, { recursive: true });
        log.debug('Created config directory:', configDir);
      }

      // 验证并规范化路径
      const normalizedConfig = {
        localPath: path.isAbsolute(config.localPath) 
          ? config.localPath 
          : path.join(userDataPath, config.localPath),
        remotePath: path.isAbsolute(config.remotePath)
          ? config.remotePath
          : path.join(userDataPath, config.remotePath)
      };
      log.debug('Normalized config:', normalizedConfig);

      // 写入配置文件
      await fsPromises.writeFile(
        configFilePath,
        JSON.stringify(normalizedConfig, null, 2),
        'utf-8'
      );

      // 确保文档目录存在
      const createDirIfNeeded = async (dirPath: string) => {
        try {
          if (!fs.existsSync(dirPath)) {
            await fsPromises.mkdir(dirPath, { recursive: true });
            log.debug('Created directory:', dirPath);
          }
        } catch (error) {
          log.error(`Failed to create directory ${dirPath}:`, error);
          throw error;
        }
      };

      await createDirIfNeeded(normalizedConfig.localPath);
      await createDirIfNeeded(normalizedConfig.remotePath);

      log.info('Successfully updated path configuration');
      return true;
    } catch (error) {
      log.error('Failed to update path configuration:', error);
      throw error;
    }
  });
} 