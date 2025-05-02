import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

interface DocFile {
  title: string;
  key: string;
  children?: DocFile[];
  isDirectory?: boolean;
  exists?: boolean;
}

interface DocPathConfig {
  docs: DocPathItem[];
}

interface DocPathItem {
  id: string;
  name: string;
  path: string;
  use_git?: boolean;
  git?: GitConfig;
  exists?: boolean;
}

interface GitConfig {
  repo_url: string;
  branch: string;
  doc_path?: string;
  use_ssh?: boolean;
  ssh_key_path?: string;
}

interface PullRequestConfig {
  title: string;
  description: string;
  branch: string;
  targetBranch: string;
}

// 开支计划接口
interface ExpensePlan {
  id: number;
  name: string;
  amount: number;
  period: string;
  created_at: string;
  updated_at: string;
}

// 开支记录接口
interface ExpenseRecord {
  id: number;
  plan_id: number;
  date: string;
  budget_amount: number;
  actual_amount: number;
  balance: number;
  opening_cumulative_balance: number;
  closing_cumulative_balance: number;
  opening_cumulative_expense: number;
  closing_cumulative_expense: number;
  created_at: string;
  updated_at: string;
}

// 用户设置接口
interface UserSettings {
  lastDocId?: string;
  lastFilePath?: string;
}

// 自定义的 API 接口
interface IElectronAPI {
  getDocList: (docId: string) => Promise<DocFile[]>;
  getDocContent: (path: string) => Promise<string>;
  saveDoc: (path: string, content: string) => Promise<boolean>;
  updateDocConfig: (path: string, title: string) => Promise<boolean>;
  pullDocFromGit: (config: { docId: string, git: GitConfig }) => Promise<{ success: boolean, error?: string }>;
  createPullRequest: (config: { docId: string, pr: PullRequestConfig }) => Promise<{ success: boolean, prUrl?: string, error?: string }>;
  getDocGitConfig: (docId: string) => Promise<GitConfig | null>;
  getDocPathConfig: () => Promise<DocPathConfig>;
  updateDocPathConfig: (config: DocPathConfig) => Promise<boolean>;
  getDefaultSSHKeyPath: () => Promise<string>;
  checkPathExists: (path: string) => Promise<boolean>;
  selectDirectory: (initialPath?: string) => Promise<string>;
  saveToken: (platform: string, token: string) => Promise<boolean>;
  openExternal: (url: string) => Promise<boolean>;
  createFile: (docId: string, relativePath: string, content?: string) => Promise<{ success: boolean, error?: string }>;
  createDirectory: (docId: string, relativePath: string) => Promise<{ success: boolean, error?: string }>;
  deleteItem: (docId: string, relativePath: string, isDirectory: boolean) => Promise<{ success: boolean, error?: string }>;
  getUserSettings: () => Promise<UserSettings>;
  saveUserSettings: (settings: UserSettings) => Promise<boolean>;
  setWindowTitle: (title: string) => Promise<void>;
  on: (channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) => void;
  // 财务相关 API
  getExpensePlans: () => Promise<ExpensePlan[]>;
  createExpensePlan: (plan: { name: string; amount: number; period: string }) => Promise<ExpensePlan>;
  deleteExpensePlan: (id: number) => Promise<void>;
  getExpenseRecords: (planId: number) => Promise<ExpenseRecord[]>;
  createExpenseRecord: (record: {
    plan_id: number;
    date: string;
    budget_amount: number;
    actual_amount: number;
    balance: number;
    opening_cumulative_balance: number;
    closing_cumulative_balance: number;
    opening_cumulative_expense: number;
    closing_cumulative_expense: number;
  }) => Promise<ExpenseRecord>;
  invoke: (channel: string, ...args: any[]) => Promise<void>;
}

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  getDocList: (docId: string) => ipcRenderer.invoke('doc:list', docId),
  getDocContent: (path: string) => ipcRenderer.invoke('doc:get', path),
  saveDoc: (path: string, content: string) => ipcRenderer.invoke('doc:save', path, content),
  updateDocConfig: (path: string, title: string) => ipcRenderer.invoke('doc:config', path, title),
  pullDocFromGit: (config: { docId: string, git: GitConfig }) => ipcRenderer.invoke('doc:pull-from-git', config),
  createPullRequest: (config: { docId: string, pr: PullRequestConfig }) => ipcRenderer.invoke('doc:create-pull-request', config),
  getDocGitConfig: (docId: string) => ipcRenderer.invoke('doc:get-git-config', docId),
  getDocPathConfig: () => ipcRenderer.invoke('doc:get-path-config'),
  updateDocPathConfig: (config: DocPathConfig) => ipcRenderer.invoke('doc:update-path-config', config),
  getDefaultSSHKeyPath: () => ipcRenderer.invoke('doc:get-default-ssh-key-path'),
  checkPathExists: (path: string) => ipcRenderer.invoke('doc:check-path-exists', path),
  selectDirectory: (initialPath?: string) => ipcRenderer.invoke('doc:select-directory', initialPath),
  saveToken: (platform: string, token: string) => ipcRenderer.invoke('doc:save-token', platform, token),
  openExternal: (url: string) => ipcRenderer.invoke('doc:open-external', url),
  createFile: (docId: string, relativePath: string, content?: string) => ipcRenderer.invoke('doc:create-file', docId, relativePath, content),
  createDirectory: (docId: string, relativePath: string) => ipcRenderer.invoke('doc:create-directory', docId, relativePath),
  deleteItem: (docId: string, relativePath: string, isDirectory: boolean) => ipcRenderer.invoke('doc:delete-item', docId, relativePath, isDirectory),
  getUserSettings: () => ipcRenderer.invoke('settings:get'),
  saveUserSettings: (settings: UserSettings) => ipcRenderer.invoke('settings:save', settings),
  setWindowTitle: (title: string) => ipcRenderer.invoke('window:set-title', title),
  on: (channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on(channel, callback);
  },
  // 财务相关 API
  getExpensePlans: () => ipcRenderer.invoke('finance:get-expense-plans'),
  createExpensePlan: (plan: { name: string; amount: number; period: string }) => ipcRenderer.invoke('finance:create-expense-plan', plan),
  deleteExpensePlan: (id: number) => ipcRenderer.invoke('finance:delete-expense-plan', id),
  getExpenseRecords: (planId: number) => ipcRenderer.invoke('finance:get-expense-records', planId),
  createExpenseRecord: (record: {
    plan_id: number;
    date: string;
    budget_amount: number;
    actual_amount: number;
    balance: number;
    opening_cumulative_balance: number;
    closing_cumulative_balance: number;
    opening_cumulative_expense: number;
    closing_cumulative_expense: number;
  }) => ipcRenderer.invoke('finance:create-expense-record', record),
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },
})

// 声明全局类型
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
