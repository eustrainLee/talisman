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

interface DocPathConfig {
    path: {
        local: string;
        remote: string;
    }
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

interface DocJsonConfig {
  doc?: {
    files: DocNodeConfig[];
  };
  remote_doc?: {
    files: DocNodeConfig[];
  };
  path: {
    local: string;
    remote: string;
  };
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

const fileExists = async (filePath: string): Promise<boolean> => {
    try {
        await fsPromises.access(filePath);
        return true;
    } catch {
        return false;
    }
};

const getConfigDir = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'config');
};

const getDataDir = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'data');
};

const getPathConfig = async () => {
    try {
        const configDir = getConfigDir();
        const configPath = path.join(configDir, 'doc.json');
        await fsPromises.mkdir(configDir, { recursive: true });

        const defaultConfig: DocPathConfig = {
            path: {
                local: path.join(getDataDir(), 'docs'),
                remote: path.join(getDataDir(), 'remote_docs')
            }
        };

        if (!await fileExists(configPath)) {
            await fsPromises.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }

        const configContent = await fsPromises.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        
        // 只有当路径为 undefined 或 null 时才使用默认路径
        return {
            path: {
                local: config.path?.local === undefined || config.path?.local === null ? defaultConfig.path.local : config.path.local,
                remote: config.path?.remote === undefined || config.path?.remote === null ? defaultConfig.path.remote : config.path.remote
            }
        };
    } catch (error) {
        log.error('获取路径配置失败:', error);
        return {
            path: {
                local: path.join(getDataDir(), 'docs'),
                remote: path.join(getDataDir(), 'remote_docs')
            }
        };
    }
};

const updatePathConfig = async (config: DocPathConfig) => {
    try {
        const configDir = getConfigDir();
        const configPath = path.join(configDir, 'doc.json');
        await fsPromises.mkdir(configDir, { recursive: true });

        // 保存原始配置，允许空字符串
        await fsPromises.writeFile(configPath, JSON.stringify(config, null, 2));

        // 获取实际使用的路径（只有 undefined 或 null 会被替换为默认路径）
        const effectiveConfig = await getPathConfig();

        // 确保文档目录存在（如果路径不为空）
        if (effectiveConfig.path.local) {
            await fsPromises.mkdir(effectiveConfig.path.local, { recursive: true });
        }
        if (effectiveConfig.path.remote) {
            await fsPromises.mkdir(effectiveConfig.path.remote, { recursive: true });
        }
        return true;
    } catch (error) {
        log.error('更新路径配置失败:', error);
        return false;
    }
};

export function setupIpcHandlers(publicPath: string) {
  const git = simpleGit();
  const gitConfigPath = path.join(publicPath, 'docs', 'git-config.json');
  const pathConfigPath = path.join(publicPath, 'path-config.json');

  // 获取文档列表
  ipcMain.handle('doc:list', async (_event, basePath = '/docs') => {
    try {
      log.info('Fetching document list for path:', basePath);
      // 读取路径配置
      const pathConfig = await getPathConfig();
      
      // 根据模式选择路径
      const isRemote = basePath === '/remote_docs';
      const configuredPath = isRemote ? pathConfig.path.remote : pathConfig.path.local;
      log.debug('Using configured path:', configuredPath);
      
      // 如果配置的路径为空字符串，使用默认路径
      const defaultConfig = {
        path: {
          local: path.join(getDataDir(), 'docs'),
          remote: path.join(getDataDir(), 'remote_docs')
        }
      };
      
      const effectivePath = configuredPath === '' ? 
        (isRemote ? defaultConfig.path.remote : defaultConfig.path.local) : 
        configuredPath;
      
      // 获取完整路径
      let rootPath: string;
      if (path.isAbsolute(effectivePath)) {
        rootPath = effectivePath;
      } else {
        // 统一处理相对路径：优先相对于 publicPath 的父目录
        rootPath = path.resolve(publicPath, '..', effectivePath);
        log.debug('Resolved root path:', rootPath);
        
        // 如果路径不存在，尝试相对于当前工作目录
        if (!fs.existsSync(rootPath)) {
          rootPath = path.resolve(process.cwd(), effectivePath);
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
      } else {
        // 尝试从 config/doc.json 读取配置
        try {
          const configDir = getConfigDir();
          const docConfigPath = path.join(configDir, 'doc.json');
          
          if (fs.existsSync(docConfigPath)) {
            const docConfig = JSON.parse(fs.readFileSync(docConfigPath, 'utf-8'));
            // 根据是否为远程文档选择对应的配置
            const configField = isRemote ? docConfig.remote_doc : docConfig.doc;
            
            if (configField?.files) {
              config = {
                files: configField.files
              };
              log.info('Using configuration from doc.json');
            }
          }
        } catch (error) {
          log.error('Failed to read doc.json configuration:', error);
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
      const configuredPath = isRemote ? pathConfig.path.remote : pathConfig.path.local;
      
      // 如果配置的路径为空字符串，使用默认路径
      const defaultConfig = {
        path: {
          local: path.join(getDataDir(), 'docs'),
          remote: path.join(getDataDir(), 'remote_docs')
        }
      };
      
      const effectivePath = configuredPath === '' ? 
        (isRemote ? defaultConfig.path.remote : defaultConfig.path.local) : 
        configuredPath;
      
      const relativePath = docPath.startsWith('/docs/') ? docPath.slice(6) : 
                          docPath.startsWith('/remote_docs/') ? docPath.slice(12) : 
                          docPath;
      
      log.debug('Relative path:', relativePath);
      
      // 统一使用正斜杠
      const normalizedRelativePath = normalizePathEncoding(relativePath.split(path.sep).join('/'));
      
      // 获取完整路径
      let fullPath: string;
      if (path.isAbsolute(effectivePath)) {
        fullPath = path.join(effectivePath, normalizedRelativePath);
      } else {
        // 统一处理相对路径：优先相对于 publicPath 的父目录
        const rootPath = path.resolve(publicPath, '..', effectivePath);
        fullPath = path.join(rootPath, normalizedRelativePath);
        
        // 如果路径不存在，尝试相对于当前工作目录
        if (!fs.existsSync(fullPath)) {
          const cwdPath = path.resolve(process.cwd(), effectivePath, normalizedRelativePath);
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
      let pathConfig: DocPathConfig = {
        path: {
          local: path.join(publicPath, 'docs'),
          remote: path.join(publicPath, 'remote_docs')
        }
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
      const configuredPath = isRemote ? pathConfig.path.remote : pathConfig.path.local;
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
      let pathConfig: DocPathConfig = {
        path: {
          local: 'public/docs',
          remote: 'public/remote_docs'
        }
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
      const configuredPath = isRemote ? pathConfig.path.remote : pathConfig.path.local;
      
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

      // 同时更新 doc.json 中的配置
      try {
        const configDir = getConfigDir();
        const docConfigPath = path.join(configDir, 'doc.json');
        
        let docConfig: DocJsonConfig = {
          path: {
            local: '',
            remote: ''
          }
        };
        
        if (fs.existsSync(docConfigPath)) {
          docConfig = JSON.parse(fs.readFileSync(docConfigPath, 'utf-8'));
        }

        // 根据是否为远程文档更新对应的配置
        if (isRemote) {
          docConfig.remote_doc = docConfig.remote_doc || { files: [] };
          docConfig.remote_doc.files = config.files;
        } else {
          docConfig.doc = docConfig.doc || { files: [] };
          docConfig.doc.files = config.files;
        }

        await fsPromises.writeFile(docConfigPath, JSON.stringify(docConfig, null, 2), 'utf-8');
      } catch (error) {
        log.error('Failed to update doc.json configuration:', error);
      }

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
        const configDir = getConfigDir();
        const configPath = path.join(configDir, 'doc.json');
        
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            log.debug('Read path configuration:', config);
            return {
                localPath: config.path?.local || '',
                remotePath: config.path?.remote || ''
            };
        }
        return {
            localPath: '',
            remotePath: ''
        };
    } catch (error) {
        log.error('Failed to read path configuration:', error);
        return {
            localPath: '',
            remotePath: ''
        };
    }
  });

  // 更新路径配置
  ipcMain.handle('doc:update-path-config', async (_event, config: { localPath: string; remotePath: string }) => {
    try {
        log.info('Updating path configuration:', config);
        return await updatePathConfig({
            path: {
                local: config.localPath,
                remote: config.remotePath
            }
        });
    } catch (error) {
        log.error('Failed to update path configuration:', error);
        throw error;
    }
  });
} 