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
}

interface PathConfig {
    localPath: string;
    remotePath: string;
}

// 自定义的 API 接口
interface IElectronAPI {
  getDocList: (basePath?: string) => Promise<DocFile[]>;
  getDocContent: (path: string) => Promise<string>;
  saveDoc: (path: string, content: string) => Promise<void>;
  updateDocConfig: (path: string, title: string) => Promise<void>;
  pullFromGit: (config: GitConfig) => Promise<void>;
  getGitConfig: () => Promise<GitConfig | null>;
  getPathConfig: () => Promise<PathConfig>;
  updatePathConfig: (config: PathConfig) => Promise<boolean>;
  on: (channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) => void;
}

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  getDocList: (basePath: string) => ipcRenderer.invoke('doc:list', basePath),
  getDocContent: (path: string) => ipcRenderer.invoke('doc:get', path),
  saveDoc: (path: string, content: string) => ipcRenderer.invoke('doc:save', path, content),
  updateDocConfig: (path: string, title: string) => ipcRenderer.invoke('doc:config', path, title),
  pullFromGit: (config: GitConfig) => ipcRenderer.invoke('doc:pull-from-git', config),
  getGitConfig: () => ipcRenderer.invoke('doc:get-git-config'),
  getPathConfig: () => ipcRenderer.invoke('doc:get-path-config'),
  updatePathConfig: (config: PathConfig) => ipcRenderer.invoke('doc:update-path-config', config),
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
