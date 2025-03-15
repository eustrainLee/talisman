import { API_BASE_URL, USE_IPC } from '../config';

export interface DocFile {
    title: string;
    key: string;
    children?: DocFile[];
    isDirectory?: boolean;
    exists?: boolean;
}

export interface GitConfig {
    repoUrl: string;
    branch: string;
    docPath: string;
    useSSH?: boolean;
    sshKeyPath?: string;
}

export interface DocConfig {
    localPath: string;
    remotePath: string;
}

class DocAPI {
    async getDocList(basePath: string = '/docs'): Promise<DocFile[]> {
        if (USE_IPC) {
            return window.electronAPI.getDocList(basePath);
        }

        const response = await fetch(`${API_BASE_URL}/api/docs/list?noCreate=true`);
        if (!response.ok) {
            return [];
        }
        return response.json();
    }

    async getDocContent(path: string): Promise<string> {
        if (USE_IPC) {
            return window.electronAPI.getDocContent(path);
        }

        const response = await fetch(`${API_BASE_URL}${path}`);
        if (!response.ok) {
            throw new Error('文档不存在');
        }
        return response.text();
    }

    async saveDoc(path: string, content: string): Promise<void> {
        if (USE_IPC) {
            return window.electronAPI.saveDoc(path, content);
        }

        const response = await fetch(`${API_BASE_URL}/api/docs/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path, content }),
        });

        if (!response.ok) {
            throw new Error('保存失败');
        }
    }

    async updateDocConfig(path: string, title: string): Promise<void> {
        if (USE_IPC) {
            return window.electronAPI.updateDocConfig(path, title);
        }

        const response = await fetch(`${API_BASE_URL}/api/docs/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path, title }),
        });

        if (!response.ok) {
            throw new Error('更新配置失败');
        }
    }

    async getDocGitConfig(): Promise<GitConfig | null> {
        if (USE_IPC) {
            return window.electronAPI.getDocGitConfig();
        }
        return null;
    }

    async pullDocFromGit(config: GitConfig): Promise<void> {
        if (USE_IPC) {
            return window.electronAPI.pullDocFromGit(config);
        }
        throw new Error('不支持从 Git 拉取');
    }

    async getDocPathConfig(): Promise<DocConfig> {
        if (USE_IPC) {
            return window.electronAPI.getDocPathConfig();
        }
        return {
            localPath: '',
            remotePath: ''
        };
    }

    async updateDocPathConfig(config: DocConfig): Promise<boolean> {
        if (USE_IPC) {
            return window.electronAPI.updateDocPathConfig(config);
        }
        throw new Error('不支持更新路径配置');
    }

    async getDefaultSSHKeyPath(): Promise<string> {
        if (USE_IPC) {
            return window.electronAPI.getDefaultSSHKeyPath();
        }
        return '';
    }
}

export const docAPI = new DocAPI(); 