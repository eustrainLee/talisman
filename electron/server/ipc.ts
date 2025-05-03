import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import * as path from 'path'
import log from 'electron-log'
import { app, dialog, shell, BrowserWindow } from 'electron'
import * as gitModule from './git'
import { getDatabase } from './db'

// 配置日志
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';

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

// 用户设置接口，用于保存上次打开的文档目录和文件
interface UserSettings {
  lastDocId?: string;
  lastFilePath?: string;
}

interface ExpensePlan {
  id: number;
  name: string;
  amount: number;
  period: string;
  parent_id?: number;
  sub_period?: string;
  budget_allocation: string;
  created_at: string;
  updated_at: string;
}

interface ExpenseRecord {
  id: number;
  plan_id: number;
  parent_record_id?: number;
  date: string;
  budget_amount: number;
  actual_amount: number;
  balance: number;
  opening_cumulative_balance: number;
  closing_cumulative_balance: number;
  opening_cumulative_expense: number;
  closing_cumulative_expense: number;
  is_sub_record: boolean;
  sub_period_index?: number;
  created_at: string;
  updated_at: string;
}

const getConfigDir = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'config');
};

// 获取用户设置文件路径
const getUserSettingsPath = () => {
    return path.join(getConfigDir(), 'user_settings.json');
};

// 获取用户设置
const getUserSettings = (): UserSettings => {
    try {
        const configDir = getConfigDir();
        const settingsPath = getUserSettingsPath();
        
        // 确保配置目录存在
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        // 读取设置文件
        if (fs.existsSync(settingsPath)) {
            const settingsData = fs.readFileSync(settingsPath, 'utf-8');
            return JSON.parse(settingsData);
        }
    } catch (error) {
        log.error('读取用户设置失败:', error);
    }
    
    // 默认返回空对象
    return {};
};

// 保存用户设置
const saveUserSettings = (settings: UserSettings): boolean => {
    try {
        const configDir = getConfigDir();
        const settingsPath = getUserSettingsPath();
        
        // 确保配置目录存在
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        // 保存设置
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
        return true;
    } catch (error) {
        log.error('保存用户设置失败:', error);
        return false;
    }
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
      
      
      // 递归扫描目录函数
      const scanDirectory = (dirPath: string): DocNode[] => {
        const result: DocNode[] = [];
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const item of items) {
          const itemPath = path.join(dirPath, item.name);
          const relativePath = path.relative(docPath, itemPath).replace(/\\/g, '/');
          const itemKey = `${docId}/${relativePath}`;
          
          if (item.isDirectory()) {
            // 目录节点 - 无论是否为空目录都正确标记为目录
            const children = scanDirectory(itemPath);
            result.push({
              title: item.name,
              key: itemKey,
              isDirectory: true,
              children: children.length > 0 ? children : [], // 空数组表示空目录
              exists: true
            });
          } else if (item.isFile() && (item.name.endsWith('.md') || item.name.endsWith('.txt'))) {
            // 文件节点 (仅包含 md 和 txt 文件)
            result.push({
              title: item.name,
              key: itemKey,
              isDirectory: false,
              exists: true
            });
          }
        }
        
        return result;
      };
      
      // 开始扫描根目录
      return scanDirectory(docPath);
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
      
      // 获取完整文件夹路径
      const dirPath = path.join(basePath, relativePath);
      
      // 创建文件夹
      await fsPromises.mkdir(dirPath, { recursive: true });
      
      return { success: true };
    } catch (error) {
      log.error('Failed to create directory:', error);
      return { success: false, error: String(error) };
    }
  });

  // 删除文件或文件夹
  ipcMain.handle('doc:delete-item', async (_event, docId: string, relativePath: string, isDirectory: boolean) => {
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
      
      // 获取完整路径
      const itemPath = path.join(basePath, relativePath);
      
      // 检查路径是否存在
      if (!fs.existsSync(itemPath)) {
        return { success: false, error: 'Path does not exist' };
      }
      
      // 删除文件或文件夹
      if (isDirectory) {
        // 递归删除文件夹及其内容
        await fsPromises.rm(itemPath, { recursive: true, force: true });
      } else {
        // 删除文件
        await fsPromises.unlink(itemPath);
      }
      
      return { success: true };
    } catch (error) {
      log.error('Failed to delete item:', error);
      return { success: false, error: String(error) };
    }
  });

  // 获取用户设置
  ipcMain.handle('settings:get', async () => {
    try {
      return getUserSettings();
    } catch (error) {
      log.error('获取用户设置失败:', error);
      return {};
    }
  });

  // 保存用户设置
  ipcMain.handle('settings:save', async (_event, settings: UserSettings) => {
    try {
      return saveUserSettings(settings);
    } catch (error) {
      log.error('保存用户设置失败:', error);
      return false;
    }
  });

  // 设置窗口标题
  ipcMain.handle('window:set-title', (_event, title: string) => {
    try {
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (mainWindow) {
        mainWindow.setTitle(title);
      }
      return true;
    } catch (error) {
      log.error('设置窗口标题失败:', error);
      return false;
    }
  });

  // 获取开支计划列表
  ipcMain.handle('finance:get-expense-plans', async () => {
    try {
      const stmt = getDatabase().prepare(`
        SELECT * FROM expense_plans 
        ORDER BY parent_id IS NULL DESC, created_at DESC
      `);
      return stmt.all();
    } catch (error) {
      log.error('获取开支计划失败:', error);
      throw error;
    }
  });

  // 创建开支计划
  ipcMain.handle('finance:create-expense-plan', async (_event, plan: { 
    name: string; 
    amount: number; 
    period: string;
    parent_id?: number;
    sub_period?: string;
    budget_allocation?: string;
  }) => {
    try {
      const stmt = getDatabase().prepare(`
        INSERT INTO expense_plans (
          name, amount, period, parent_id, sub_period, budget_allocation
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        plan.name,
        plan.amount,
        plan.period,
        plan.parent_id || null,
        plan.sub_period || null,
        plan.budget_allocation || 'NONE'
      );
      return { id: result.lastInsertRowid, ...plan };
    } catch (error) {
      log.error('创建开支计划失败:', error);
      throw error;
    }
  });

  // 更新开支计划
  ipcMain.handle('finance:update-expense-plan', async (_event, id: number, data: Partial<ExpensePlan>) => {
    try {
      const db = getDatabase();
      const plan = db.prepare('SELECT * FROM expense_plans WHERE id = ?').get(id) as ExpensePlan | undefined;
      if (!plan) {
        throw new Error('计划不存在');
      }

      // 检查是否可以修改子周期类型
      if (data.sub_period && plan.sub_period !== data.sub_period) {
        const hasSubPlans = db.prepare('SELECT COUNT(*) as count FROM expense_plans WHERE parent_id = ?').get(id) as { count: number };
        if (hasSubPlans.count > 0) {
          throw new Error('已存在子计划，不能修改子周期类型');
        }
      }

      // 更新计划
      db.prepare(`
        UPDATE expense_plans 
        SET name = ?, 
            amount = ?, 
            period = ?,
            sub_period = ?,
            budget_allocation = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        data.name || plan.name,
        data.amount || plan.amount,
        data.period || plan.period,
        data.sub_period || plan.sub_period,
        data.budget_allocation || plan.budget_allocation,
        id
      );
      return true;
    } catch (error) {
      log.error('更新开支计划失败:', error);
      throw error;
    }
  });

  // 删除开支计划
  ipcMain.handle('finance:delete-expense-plan', async (_event, id: number) => {
    try {
      const db = getDatabase();
      
      // 检查是否存在子计划
      const hasSubPlans = db.prepare('SELECT COUNT(*) as count FROM expense_plans WHERE parent_id = ?').get(id) as { count: number };
      if (hasSubPlans.count > 0) {
        throw new Error('请先删除子计划');
      }
      
      // 检查是否存在记录
      const hasRecords = db.prepare('SELECT COUNT(*) as count FROM expense_records WHERE plan_id = ?').get(id) as { count: number };
      if (hasRecords.count > 0) {
        throw new Error('请先删除相关记录');
      }
      
      const stmt = db.prepare('DELETE FROM expense_plans WHERE id = ?');
      stmt.run(id);
      return true;
    } catch (error) {
      log.error('删除开支计划失败:', error);
      throw error;
    }
  });

  // 获取开支记录列表
  ipcMain.handle('finance:get-expense-records', async (_event, planId: number) => {
    try {
      const stmt = getDatabase().prepare(`
        SELECT * FROM expense_records 
        WHERE plan_id = ? 
        ORDER BY is_sub_record ASC, date DESC
      `);
      return stmt.all(planId);
    } catch (error) {
      log.error('获取开支记录失败:', error);
      throw error;
    }
  });

  // 创建开支记录
  ipcMain.handle('finance:create-expense-record', async (_event, record: {
    plan_id: number;
    parent_record_id?: number;
    date: string;
    budget_amount: number;
    actual_amount: number;
    balance: number;
    opening_cumulative_balance: number;
    closing_cumulative_balance: number;
    opening_cumulative_expense: number;
    closing_cumulative_expense: number;
    is_sub_record: boolean;
    sub_period_index?: number;
  }) => {
    try {
      const db = getDatabase();
      
      // 如果是子记录，检查父记录是否存在
      if (record.is_sub_record && record.parent_record_id) {
        const parentRecord = db.prepare('SELECT * FROM expense_records WHERE id = ?').get(record.parent_record_id) as ExpenseRecord | undefined;
        if (!parentRecord) {
          throw new Error('父记录不存在');
        }
      }
      
      // 如果是子记录，检查时间是否重叠
      if (record.is_sub_record) {
        const overlappingRecord = db.prepare(`
          SELECT * FROM expense_records 
          WHERE plan_id = ? AND is_sub_record = 1 AND date = ?
        `).get(record.plan_id, record.date) as ExpenseRecord | undefined;
        if (overlappingRecord) {
          throw new Error('该时间已存在子记录');
        }
      }
      
      const stmt = db.prepare(`
        INSERT INTO expense_records (
          plan_id,
          parent_record_id,
          date,
          budget_amount,
          actual_amount,
          balance,
          opening_cumulative_balance,
          closing_cumulative_balance,
          opening_cumulative_expense,
          closing_cumulative_expense,
          is_sub_record,
          sub_period_index
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        record.plan_id,
        record.parent_record_id || null,
        record.date,
        record.budget_amount,
        record.actual_amount,
        record.balance,
        record.opening_cumulative_balance,
        record.closing_cumulative_balance,
        record.opening_cumulative_expense,
        record.closing_cumulative_expense,
        record.is_sub_record ? 1 : 0,
        record.sub_period_index || null
      );
      
      // 如果是子记录，更新父记录的汇总数据
      if (record.is_sub_record && record.parent_record_id) {
        updateParentRecordSummary(record.parent_record_id);
      }
      
      return {
        id: result.lastInsertRowid,
        ...record,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      log.error('创建开支记录失败:', error);
      throw error;
    }
  });

  // 更新开支记录
  ipcMain.handle('finance:update-expense-record', async (_event, recordId: number, data: Partial<ExpenseRecord>) => {
    try {
      const db = getDatabase();
      const record = db.prepare('SELECT * FROM expense_records WHERE id = ?').get(recordId) as ExpenseRecord | undefined;
      if (!record) {
        throw new Error('记录不存在');
      }

      // 如果是子记录，检查时间是否重叠
      if (record.is_sub_record && data.date && data.date !== record.date) {
        const overlappingRecord = db.prepare(`
          SELECT * FROM expense_records 
          WHERE plan_id = ? AND is_sub_record = 1 AND date = ? AND id != ?
        `).get(record.plan_id, data.date, recordId) as ExpenseRecord | undefined;
        if (overlappingRecord) {
          throw new Error('该时间已存在子记录');
        }
      }

      // 更新记录
      db.prepare(`
        UPDATE expense_records 
        SET date = ?, 
            budget_amount = ?, 
            actual_amount = ?, 
            balance = ?,
            opening_cumulative_balance = ?,
            closing_cumulative_balance = ?,
            opening_cumulative_expense = ?,
            closing_cumulative_expense = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        data.date || record.date,
        data.budget_amount || record.budget_amount,
        data.actual_amount || record.actual_amount,
        data.balance || record.balance,
        data.opening_cumulative_balance || record.opening_cumulative_balance,
        data.closing_cumulative_balance || record.closing_cumulative_balance,
        data.opening_cumulative_expense || record.opening_cumulative_expense,
        data.closing_cumulative_expense || record.closing_cumulative_expense,
        recordId
      );

      // 如果是子记录，更新父记录的汇总数据
      if (record.is_sub_record && record.parent_record_id) {
        updateParentRecordSummary(record.parent_record_id);
      }

      return true;
    } catch (error) {
      log.error('更新开支记录失败:', error);
      throw error;
    }
  });

  // 删除开支记录
  ipcMain.handle('finance:delete-expense-record', async (_event, recordId: number) => {
    try {
      const db = getDatabase();
      
      // 检查是否是父记录
      const hasSubRecords = db.prepare('SELECT COUNT(*) as count FROM expense_records WHERE parent_record_id = ?').get(recordId) as { count: number };
      if (hasSubRecords.count > 0) {
        throw new Error('请先删除子记录');
      }
      
      const stmt = db.prepare('DELETE FROM expense_records WHERE id = ?');
      const result = stmt.run(recordId) as { changes: number };
      
      if (result.changes === 0) {
        throw new Error('记录不存在');
      }
      
      return true;
    } catch (error) {
      log.error('删除开支记录失败:', error);
      throw error;
    }
  });

  // 更新父记录汇总数据
  function updateParentRecordSummary(parentRecordId: number) {
    const db = getDatabase();
    const subRecords = db.prepare(`
      SELECT * FROM expense_records 
      WHERE parent_record_id = ? 
      ORDER BY date ASC
    `).all(parentRecordId) as ExpenseRecord[];
    
    if (subRecords.length > 0) {
      const firstRecord = subRecords[0];
      const lastRecord = subRecords[subRecords.length - 1];
      
      db.prepare(`
        UPDATE expense_records 
        SET opening_cumulative_balance = ?,
            closing_cumulative_balance = ?,
            opening_cumulative_expense = ?,
            closing_cumulative_expense = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        firstRecord.opening_cumulative_balance,
        lastRecord.closing_cumulative_balance,
        firstRecord.opening_cumulative_expense,
        lastRecord.closing_cumulative_expense,
        parentRecordId
      );
    }
  }
} 