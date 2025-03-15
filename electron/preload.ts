import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

interface DocFile {
  title: string;
  key: string;
  children?: DocFile[];
  isDirectory?: boolean;
}

interface GitConfig {
  repoUrl: string;
  branch: string;
  docPath: string;
  useSSH?: boolean;
  sshKeyPath?: string;
}

interface DocPathConfig {
    localPath: string;
    remotePath: string;
}

// 自定义的 API 接口
interface IElectronAPI {
  getDocList: (basePath?: string) => Promise<DocFile[]>;
  getDocContent: (path: string) => Promise<string>;
  saveDoc: (path: string, content: string) => Promise<void>;
  updateDocConfig: (path: string, title: string) => Promise<void>;
  pullDocFromGit: (config: GitConfig) => Promise<void>;
  getDocGitConfig: () => Promise<GitConfig | null>;
  getDocPathConfig: () => Promise<DocPathConfig>;
  updateDocPathConfig: (config: DocPathConfig) => Promise<boolean>;
  getDefaultSSHKeyPath: () => Promise<string>;
  on: (channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) => void;
}

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  getDocList: (basePath: string) => ipcRenderer.invoke('doc:list', basePath),
  getDocContent: (path: string) => ipcRenderer.invoke('doc:get', path),
  saveDoc: (path: string, content: string) => ipcRenderer.invoke('doc:save', path, content),
  updateDocConfig: (path: string, title: string) => ipcRenderer.invoke('doc:config', path, title),
  pullDocFromGit: (config: GitConfig) => ipcRenderer.invoke('doc:pull-from-git', config),
  getDocGitConfig: () => ipcRenderer.invoke('doc:get-git-config'),
  getDocPathConfig: () => ipcRenderer.invoke('doc:get-path-config'),
  updateDocPathConfig: (config: DocPathConfig) => ipcRenderer.invoke('doc:update-path-config', config),
  getDefaultSSHKeyPath: () => ipcRenderer.invoke('doc:get-default-ssh-key-path'),
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
