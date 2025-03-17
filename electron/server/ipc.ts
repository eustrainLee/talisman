import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'
import { promisify } from 'util'
import log from 'electron-log'
import { app, dialog, shell } from 'electron'
import * as gitModule from './git'

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

interface DocPathItem {
  id: string;
  name: string;
  path: string;
  git?: gitModule.GitConfig;
}

interface DocJsonConfig {
  docs?: DocPathItem[];
}

const getConfigDir = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'config');
};

const getDataDir = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'data');
};

export function setupIpcHandlers() {
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
      
      // 获取文档列表，支持 md 和 txt 文件
      const files = await globPromise('**/*.{md,txt}', { cwd: docPath });
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
              title: path.basename(part, path.extname(part)),
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
      log.error('Failed to get document list:', error);
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
      log.error('Failed to get document content:', error);
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
      log.error('Failed to save document:', error);
      return false;
    }
  });

  // 更新文档配置
  ipcMain.handle('doc:config', async (_event, docPath: string, title: string) => {
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
        return { success: false, error: 'Document directory not found' };
      }
      
      const configPath = path.join(basePath, 'config.json');
      let config: DocConfig = { files: [] };

      if (fs.existsSync(configPath)) {
        try {
          const configContent = await fsPromises.readFile(configPath, 'utf-8');
          config = JSON.parse(configContent);
          
          // 确保 files 字段存在
          if (!config.files) {
            config.files = [];
          }
        } catch (error) {
          console.error('Failed to read configuration file:', error);
        }
      }

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
  ipcMain.handle('doc:pull-from-git', async (_event, config: { docId: string, git: gitModule.GitConfig }) => {
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
        return { success: false, error: 'Document directory configuration not found' };
      }
      
      // 更新 Git 配置
      pathItem.git = config.git;
      
      // 保存配置
      await fsPromises.mkdir(configDir, { recursive: true });
      await fsPromises.writeFile(docConfigPath, JSON.stringify(docConfig, null, 2), 'utf-8');
      
      // 检查目标目录是否存在
      if (!fs.existsSync(pathItem.path)) {
        return { success: false, error: 'Target directory does not exist, please create it first' };
      }
      
      // 使用 git 模块的 pullFromGit 函数
      return await gitModule.pullFromGit(tempDir, pathItem.path, config.git);
    } catch (error) {
      log.error('Git pull failed:', error);
      return { success: false, error: String(error) };
    }
  });

  // 创建 Pull Request
  ipcMain.handle('doc:create-pull-request', async (_event, config: { docId: string, pr: gitModule.PullRequestConfig }) => {
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
      
      // 查找指定 ID 的路径配置
      const pathItem = docConfig.docs?.find((p: DocPathItem) => p.id === config.docId);
      if (!pathItem || !pathItem.git) {
        return { success: false, error: 'Git configuration for document directory not found' };
      }
      
      // 使用 git 模块的 createPullRequest 函数
      return await gitModule.createPullRequest(
        configDir,
        tempDir,
        pathItem.path,
        pathItem.git,
        config.pr
      );
    } catch (error) {
      log.error('Failed to create Pull Request:', error);
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
        if (pathItem && pathItem.git) {
          return pathItem.git;
        }
      }
      return null;
    } catch (error) {
      log.error('Failed to get Git configuration:', error);
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
        
        // 直接返回新格式的配置
        if (docConfig.docs) {
          return { docs: docConfig.docs };
        }
        
        // 如果没有 docs 字段，返回空数组
        return { docs: [] };
      }
      
      // 如果配置文件不存在，返回空数组
      return { docs: [] };
    } catch (error) {
      log.error('Failed to get document path configuration:', error);
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
      log.error('Failed to update document path configuration:', error);
      return false;
    }
  });

  // 获取默认 SSH 密钥路径
  ipcMain.handle('doc:get-default-ssh-key-path', async () => {
    try {
      return gitModule.getDefaultSSHKeyPath();
    } catch (error) {
      log.error('Failed to get default SSH key path:', error);
      return '';
    }
  });

  // 检查路径是否存在
  ipcMain.handle('doc:check-path-exists', async (_event, pathToCheck: string) => {
    try {
      return fs.existsSync(pathToCheck);
    } catch (error) {
      log.error('Failed to check if path exists:', error);
      return false;
    }
  });

  // 选择目录
  ipcMain.handle('doc:select-directory', async (_event, initialPath?: string) => {
    try {
      const options: Electron.OpenDialogOptions = {
        properties: ['openDirectory'],
        title: 'Select Document Directory'
      };
      
      // 如果提供了初始路径且该路径存在，则设置为默认路径
      if (initialPath && fs.existsSync(initialPath)) {
        options.defaultPath = initialPath;
      }
      
      const result = await dialog.showOpenDialog(options);
      
      if (result.canceled) {
        return '';
      }
      
      return result.filePaths[0];
    } catch (error) {
      log.error('Failed to select directory:', error);
      return '';
    }
  });

  // 保存 Git 令牌
  ipcMain.handle('doc:save-token', async (_event, platform: string, token: string) => {
    const configDir = getConfigDir();
    return gitModule.saveToken(configDir, platform, token);
  });

  // 在默认浏览器中打开链接
  ipcMain.handle('doc:open-external', async (_event, url: string) => {
    try {
      log.debug('Opening external URL:', url);
      return await shell.openExternal(url);
    } catch (error) {
      log.error('Failed to open external URL:', error);
      return false;
    }
  });

  // 创建文件
  ipcMain.handle('doc:create-file', async (_event, docId: string, relativePath: string, content: string = '') => {
    try {
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
        return { success: false, error: 'Document directory not found' };
      }
      
      // 获取完整文件路径
      const filePath = path.join(basePath, relativePath);
      
      // 确保文件所在的目录存在
      await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
      
      // 创建文件
      await fsPromises.writeFile(filePath, content, 'utf-8');
      
      return { success: true };
    } catch (error) {
      log.error('Failed to create file:', error);
      return { success: false, error: String(error) };
    }
  });

  // 创建文件夹
  ipcMain.handle('doc:create-directory', async (_event, docId: string, relativePath: string) => {
    try {
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
        return { success: false, error: 'Document directory not found' };
      }
      
      // 获取完整目录路径
      const dirPath = path.join(basePath, relativePath);
      
      // 创建目录
      await fsPromises.mkdir(dirPath, { recursive: true });
      
      return { success: true };
    } catch (error) {
      log.error('Failed to create directory:', error);
      return { success: false, error: String(error) };
    }
  });
} 