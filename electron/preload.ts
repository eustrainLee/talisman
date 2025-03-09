import { ipcRenderer, contextBridge, IpcRendererEvent } from 'electron'

interface GitConfig {
  repoUrl: string;
  branch: string;
  docPath: string;
}

// 自定义的 API 接口
export interface IElectronAPI {
  getDocList: () => Promise<any>;
  getDocContent: (path: string) => Promise<string>;
  saveDoc: (path: string, content: string) => Promise<void>;
  updateDocConfig: (path: string, title: string) => Promise<void>;
  pullFromGit: (config: GitConfig) => Promise<{ success: boolean }>;
  getGitConfig: () => Promise<GitConfig | null>;
  on: (channel: 'main-process-message', callback: (event: IpcRendererEvent, message: string) => void) => void;
}

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  getDocList: () => ipcRenderer.invoke('doc:list'),
  getDocContent: (path: string) => ipcRenderer.invoke('doc:get', path),
  saveDoc: (path: string, content: string) => ipcRenderer.invoke('doc:save', path, content),
  updateDocConfig: (path: string, title: string) => ipcRenderer.invoke('doc:config', path, title),
  pullFromGit: (config: GitConfig) => ipcRenderer.invoke('doc:pull-from-git', config),
  getGitConfig: () => ipcRenderer.invoke('doc:get-git-config'),
  on: (channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) => ipcRenderer.on(channel, callback),
})

// 声明全局类型
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
