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

// 自定义的 API 接口
interface IElectronAPI {
  getDocList: (docId: string) => Promise<DocFile[]>;
  getDocContent: (path: string) => Promise<string>;
  saveDoc: (path: string, content: string) => Promise<boolean>;
  updateDocConfig: (path: string, title: string) => Promise<boolean>;
  pullDocFromGit: (config: { docId: string, git: GitConfig }) => Promise<{ success: boolean, error?: string }>;
  getDocGitConfig: (docId: string) => Promise<GitConfig | null>;
  getDocPathConfig: () => Promise<DocPathConfig>;
  updateDocPathConfig: (config: DocPathConfig) => Promise<boolean>;
  getDefaultSSHKeyPath: () => Promise<string>;
  checkPathExists: (path: string) => Promise<boolean>;
  selectDirectory: (initialPath?: string) => Promise<string>;
  on: (channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) => void;
}

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  getDocList: (docId: string) => ipcRenderer.invoke('doc:list', docId),
  getDocContent: (path: string) => ipcRenderer.invoke('doc:get', path),
  saveDoc: (path: string, content: string) => ipcRenderer.invoke('doc:save', path, content),
  updateDocConfig: (path: string, title: string) => ipcRenderer.invoke('doc:config', path, title),
  pullDocFromGit: (config: { docId: string, git: GitConfig }) => ipcRenderer.invoke('doc:pull-from-git', config),
  getDocGitConfig: (docId: string) => ipcRenderer.invoke('doc:get-git-config', docId),
  getDocPathConfig: () => ipcRenderer.invoke('doc:get-path-config'),
  updateDocPathConfig: (config: DocPathConfig) => ipcRenderer.invoke('doc:update-path-config', config),
  getDefaultSSHKeyPath: () => ipcRenderer.invoke('doc:get-default-ssh-key-path'),
  checkPathExists: (path: string) => ipcRenderer.invoke('doc:check-path-exists', path),
  selectDirectory: (initialPath?: string) => ipcRenderer.invoke('doc:select-directory', initialPath),
  on: (channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) => {
    ipcRenderer.on(channel, callback);
  }
})

// 声明全局类型
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
