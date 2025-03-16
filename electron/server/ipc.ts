import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'
import simpleGit from 'simple-git'
import { promisify } from 'util'
import log from 'electron-log'
import { app } from 'electron'
import * as os from 'os'

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
  repo_url: string;
  branch: string;
  doc_path?: string;
  use_ssh?: boolean;
  ssh_key_path?: string;
}

interface DocPathItem {
  id: string;
  name: string;
  path: string;
  use_git?: boolean;
  git?: GitConfig;
}

interface DocJsonConfig {
  docs?: DocPathItem[];
  // 保留旧配置字段以兼容旧版本
  doc?: {
    files: DocNodeConfig[];
  };
  remote_doc?: {
    files: DocNodeConfig[];
    git?: {
      repo_url: string;
      branch: string;
      doc_path: string;
      use_ssh?: boolean;
      ssh_key_path?: boolean;
    };
  };
  path?: {
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

// 获取默认 SSH 密钥路径
function getDefaultSSHKeyPath(): string {
  try {
    const homeDir = os.homedir();
    const sshDir = path.join(homeDir, '.ssh');
    
    // 检查常见的 SSH 密钥文件
    const commonKeyFiles = ['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'];
    
    for (const keyFile of commonKeyFiles) {
      const keyPath = path.join(sshDir, keyFile);
      if (fs.existsSync(keyPath)) {
        return keyPath;
      }
    }
    
    // 如果没有找到密钥文件，返回默认路径
    return path.join(sshDir, 'id_rsa');
  } catch (error) {
    log.error('获取默认 SSH 密钥路径失败:', error);
    return '';
  }
}

export function setupIpcHandlers(publicPath: string) {
  const git = simpleGit();
  const gitConfigPath = path.join(publicPath, 'docs', 'git-config.json');
  const pathConfigPath = path.join(publicPath, 'path-config.json');

  // 获取文档列表
  ipcMain.handle('doc:list', async (_event, docId: string) => {
    try {
      // 获取文档路径配置
      const configDir = getConfigDir();
      const docConfigPath = path.join(configDir, 'doc.json');
      let docPath = '';
      
      if (fs.existsSync(docConfigPath)) {
        const docConfig = JSON.parse(fs.readFileSync(docConfigPath, 'utf-8'));
        
        // 查找指定 ID 的路径配置
        const pathItem = docConfig.docs?.find((p: DocPathItem) => p.id === docId);
        if (pathItem && pathItem.path) {
          docPath = pathItem.path;
        }
      }
      
      // 如果找不到指定路径，返回空数组
      if (!docPath) {
        return [];
      }
      
      // 检查目录是否存在，不存在则返回空数组
      if (!fs.existsSync(docPath)) {
        return [];
      }
      
      // 获取文档列表
      const files = await globPromise('**/*.md', { cwd: docPath });
      const docFiles: DocNode[] = [];
      
      // 构建文档树
      for (const file of files) {
        const filePath = path.join(docPath, file);
        const relativePath = file;
        const parts = relativePath.split('/');
        
        let currentLevel = docFiles;
        let currentPath = '';
        
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          currentPath = currentPath ? path.join(currentPath, part) : part;
          
          if (i === parts.length - 1) {
            // 文件节点
            currentLevel.push({
              title: path.basename(part, '.md'),
              key: `${docId}/${relativePath}`,
              isDirectory: false,
              exists: fs.existsSync(filePath)
            });
          } else {
            // 目录节点
            let found = false;
            for (const item of currentLevel) {
              if (item.isDirectory && item.title === part) {
                found = true;
                currentLevel = item.children || [];
                break;
              }
            }
            
            if (!found) {
              const newDir: DocNode = {
                title: part,
                key: `${docId}/${currentPath}`,
                isDirectory: true,
                children: []
              };
              currentLevel.push(newDir);
              currentLevel = newDir.children || [];
            }
          }
        }
      }
      
      return docFiles;
    } catch (error) {
      log.error('获取文档列表失败:', error);
      return [];
    }
  });

  // 获取文档内容
  ipcMain.handle('doc:get', async (_event, docPath: string) => {
    try {
      // 解析路径 ID 和相对路径
      const [docId, ...relativeParts] = docPath.split('/');
      const relativePath = relativeParts.join('/');
      
      // 获取文档路径配置
      const configDir = getConfigDir();
      const docConfigPath = path.join(configDir, 'doc.json');
      let basePath = '';
      
      if (fs.existsSync(docConfigPath)) {
        const docConfig = JSON.parse(fs.readFileSync(docConfigPath, 'utf-8'));
        
        // 查找指定 ID 的路径配置
        const pathItem = docConfig.docs?.find((p: DocPathItem) => p.id === docId);
        if (pathItem && pathItem.path) {
          basePath = pathItem.path;
        }
      }
      
      // 如果找不到指定路径，返回空内容
      if (!basePath) {
        return '';
      }
      
      // 获取完整文件路径
      const filePath = path.join(basePath, relativePath);
      
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return '';
      }
      
      // 读取文件内容
      const content = await fsPromises.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      log.error('获取文档内容失败:', error);
      return '';
    }
  });

  // 保存文档
  ipcMain.handle('doc:save', async (_event, docPath: string, content: string) => {
    try {
      // 解析路径 ID 和相对路径
      const [docId, ...relativeParts] = docPath.split('/');
      const relativePath = relativeParts.join('/');
      
      // 获取文档路径配置
      const configDir = getConfigDir();
      const docConfigPath = path.join(configDir, 'doc.json');
      let basePath = '';
      
      if (fs.existsSync(docConfigPath)) {
        const docConfig = JSON.parse(fs.readFileSync(docConfigPath, 'utf-8'));
        
        // 查找指定 ID 的路径配置
        const pathItem = docConfig.docs?.find((p: DocPathItem) => p.id === docId);
        if (pathItem && pathItem.path) {
          basePath = pathItem.path;
        }
      }
      
      // 如果找不到指定路径，返回失败
      if (!basePath) {
        return false;
      }
      
      // 检查基础目录是否存在
      if (!fs.existsSync(basePath)) {
        return false;
      }
      
      // 获取完整文件路径
      const filePath = path.join(basePath, relativePath);
      
      // 确保文件所在的目录存在（这是保存文件所必需的）
      await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
      
      // 保存文件内容
      await fsPromises.writeFile(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      log.error('保存文档失败:', error);
      return false;
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
  ipcMain.handle('doc:pull-from-git', async (_event, config: { docId: string, git: GitConfig }) => {
    const tempDir = path.join(getDataDir(), 'temp_git');
    
    try {
      // 获取文档路径配置
      const configDir = getConfigDir();
      const docConfigPath = path.join(configDir, 'doc.json');
      let docConfig: DocJsonConfig = {
        docs: []
      };
      
      if (fs.existsSync(docConfigPath)) {
        docConfig = JSON.parse(fs.readFileSync(docConfigPath, 'utf-8'));
      }
      
      // 确保 docs 数组存在
      if (!docConfig.docs) {
        docConfig.docs = [];
      }
      
      // 查找或创建指定 ID 的路径配置
      let pathItem = docConfig.docs.find(p => p.id === config.docId);
      if (!pathItem) {
        // 如果找不到指定 ID 的配置，返回失败
        return { success: false, error: '找不到指定的文档目录配置' };
      }
      
      // 更新 Git 配置
      pathItem.use_git = true;
      pathItem.git = config.git;
      
      // 保存配置
      await fsPromises.mkdir(configDir, { recursive: true });
      await fsPromises.writeFile(docConfigPath, JSON.stringify(docConfig, null, 2), 'utf-8');
      
      // 检查目标目录是否存在
      if (!fs.existsSync(pathItem.path)) {
        return { success: false, error: '目标目录不存在，请先创建目录' };
      }
      
      // 清理旧的临时目录（如果存在）
      if (await fileExists(tempDir)) {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
      }
      
      // 确保临时目录存在（这是临时操作目录，需要创建）
      await fsPromises.mkdir(tempDir, { recursive: true });
      
      // 配置 Git
      const gitOptions: any = {};
      if (config.git.use_ssh && config.git.ssh_key_path) {
        gitOptions.env = {
          ...process.env,
          GIT_SSH_COMMAND: `ssh -i "${config.git.ssh_key_path}" -o StrictHostKeyChecking=no`
        };
      }
      
      // 克隆仓库到临时目录
      const git = simpleGit(gitOptions);
      await git.clone(config.git.repo_url, tempDir);
      
      // 切换到指定分支
      const tempGit = simpleGit(tempDir, gitOptions);
      await tempGit.checkout(config.git.branch);
      
      // 清理目标目录中的内容（保留目录本身）
      const entries = await fsPromises.readdir(pathItem.path);
      for (const entry of entries) {
        const entryPath = path.join(pathItem.path, entry);
        await fsPromises.rm(entryPath, { recursive: true, force: true });
      }
      
      // 复制文档
      const sourceDir = config.git.doc_path ? path.join(tempDir, config.git.doc_path) : tempDir;
      const files = await globPromise('**/*.{md,json}', { cwd: sourceDir });
      for (const file of files) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(pathItem.path, file);
        // 确保文件所在的目录存在（这是复制文件所必需的）
        await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
        await fsPromises.copyFile(sourcePath, targetPath);
      }
      
      // 清理临时克隆目录
      await fsPromises.rm(tempDir, { recursive: true, force: true });
      
      return { success: true };
    } catch (error) {
      log.error('Git 拉取失败:', error);
      // 清理临时目录
      try {
        if (await fileExists(tempDir)) {
          await fsPromises.rm(tempDir, { recursive: true, force: true });
        }
      } catch (e) {
        log.error('清理临时目录失败:', e);
      }
      return { success: false, error: String(error) };
    }
  });

  // 获取 Git 配置
  ipcMain.handle('doc:get-git-config', async (_event, docId: string) => {
    try {
      const configDir = getConfigDir();
      const docConfigPath = path.join(configDir, 'doc.json');
      
      if (fs.existsSync(docConfigPath)) {
        const docConfig = JSON.parse(fs.readFileSync(docConfigPath, 'utf-8'));
        
        // 查找指定 ID 的路径配置
        const pathItem = docConfig.docs?.find((p: DocPathItem) => p.id === docId);
        if (pathItem && pathItem.use_git && pathItem.git) {
          return pathItem.git;
        }
      }
      return null;
    } catch (error) {
      log.error('获取 Git 配置失败:', error);
      return null;
    }
  });

  // 获取文档路径配置
  ipcMain.handle('doc:get-path-config', async () => {
    try {
      const configDir = getConfigDir();
      const docConfigPath = path.join(configDir, 'doc.json');
      
      if (fs.existsSync(docConfigPath)) {
        const docConfig = JSON.parse(fs.readFileSync(docConfigPath, 'utf-8'));
        
        // 如果已经有新格式的配置，直接返回
        if (docConfig.docs) {
          return { docs: docConfig.docs };
        }
        
        // 兼容旧版配置，转换为新格式
        const docs: DocPathItem[] = [];
        
        // 如果有旧的本地路径配置，转换为新格式
        if (docConfig.path?.local) {
          docs.push({
            id: 'local',
            name: '本地文档',
            path: docConfig.path.local,
            use_git: false
          });
        }
        
        // 如果有旧的远程路径配置，转换为新格式
        if (docConfig.path?.remote) {
          docs.push({
            id: 'remote',
            name: '远程文档',
            path: docConfig.path.remote,
            use_git: docConfig.remote_doc?.git ? true : false,
            git: docConfig.remote_doc?.git
          });
        }
        
        // 保存新格式配置
        docConfig.docs = docs;
        fs.writeFileSync(docConfigPath, JSON.stringify(docConfig, null, 2), 'utf-8');
        
        return { docs };
      }
      
      // 如果配置文件不存在，返回空数组
      return { docs: [] };
    } catch (error) {
      log.error('获取文档路径配置失败:', error);
      return { docs: [] };
    }
  });

  // 更新文档路径配置
  ipcMain.handle('doc:update-path-config', async (_event, config: { docs: DocPathItem[] }) => {
    try {
      const configDir = getConfigDir();
      const docConfigPath = path.join(configDir, 'doc.json');
      
      let docConfig: DocJsonConfig = {
        docs: []
      };
      
      if (fs.existsSync(docConfigPath)) {
        docConfig = JSON.parse(fs.readFileSync(docConfigPath, 'utf-8'));
      }
      
      // 更新路径配置
      docConfig.docs = config.docs;
      
      // 不再自动创建目录
      // 只确保配置目录存在
      await fsPromises.mkdir(configDir, { recursive: true });
      
      await fsPromises.writeFile(docConfigPath, JSON.stringify(docConfig, null, 2), 'utf-8');
      return true;
    } catch (error) {
      log.error('更新文档路径配置失败:', error);
      return false;
    }
  });

  // 获取默认 SSH 密钥路径
  ipcMain.handle('doc:get-default-ssh-key-path', async () => {
    try {
      return getDefaultSSHKeyPath();
    } catch (error) {
      log.error('获取默认 SSH 密钥路径失败:', error);
      return '';
    }
  });

  // 检查路径是否存在
  ipcMain.handle('doc:check-path-exists', async (_event, pathToCheck: string) => {
    try {
      return fs.existsSync(pathToCheck);
    } catch (error) {
      log.error('检查路径是否存在失败:', error);
      return false;
    }
  });
} 