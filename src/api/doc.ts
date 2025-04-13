import { API_BASE_URL, USE_IPC } from '../config';

export interface DocFile {
    title: string;
    key: string;
    children?: DocFile[];
    isDirectory?: boolean;
    exists?: boolean;
}

export interface DocPathConfig {
    docs: DocPathItem[];
}

export interface DocPathItem {
    id: string;
    name: string;
    path: string;
    use_git?: boolean;
    git?: GitConfig;
    exists?: boolean;
}

export interface GitConfig {
    repo_url: string;
    branch: string;
    doc_path?: string;
    use_ssh?: boolean;
    ssh_key_path?: string;
}

export interface DocConfig {
    localPath: string;
    remotePath: string;
}

export interface UserSettings {
    lastDocId?: string;
    lastFilePath?: string;
}

export interface DocFrontMatter {
    title?: string;
    description?: string;
    tags?: string[];
    author?: string;
    date?: string;
    [key: string]: any;
}

export interface DocContent {
    frontMatter: DocFrontMatter;
    content: string;
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

    async saveDoc(path: string, content: string): Promise<boolean> {
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
        
        return true;
    }

    async updateDocConfig(path: string, title: string): Promise<boolean> {
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
        
        return true;
    }

    async getDocPathConfig(): Promise<DocPathConfig> {
        if (USE_IPC) {
            return window.electronAPI.getDocPathConfig();
        }
        return {
            docs: []
        };
    }

    async updateDocPathConfig(config: DocPathConfig): Promise<boolean> {
        if (USE_IPC) {
            return window.electronAPI.updateDocPathConfig(config);
        }
        throw new Error('不支持更新路径配置');
    }

    async getDocGitConfig(docId: string): Promise<GitConfig | null> {
        if (USE_IPC) {
            return window.electronAPI.getDocGitConfig(docId);
        }
        return null;
    }

    async pullDocFromGit(docId: string, config: GitConfig): Promise<{ success: boolean, error?: string }> {
        if (USE_IPC) {
            return window.electronAPI.pullDocFromGit({ docId, git: config });
        }
        throw new Error('不支持从 Git 拉取');
    }

    async getDefaultSSHKeyPath(): Promise<string> {
        if (USE_IPC) {
            return window.electronAPI.getDefaultSSHKeyPath();
        }
        return '';
    }

    async checkPathExists(path: string): Promise<boolean> {
        if (USE_IPC) {
            return window.electronAPI.checkPathExists(path);
        }
        return true; // 非 IPC 模式默认返回 true
    }

    async getUserSettings(): Promise<UserSettings> {
        if (USE_IPC) {
            return window.electronAPI.getUserSettings();
        }
        return {}; // 非 IPC 模式默认返回空对象
    }

    async saveUserSettings(settings: UserSettings): Promise<boolean> {
        if (USE_IPC) {
            return window.electronAPI.saveUserSettings(settings);
        }
        return false; // 非 IPC 模式默认返回 false
    }

    async setWindowTitle(title: string): Promise<void> {
        if (USE_IPC) {
            return window.electronAPI.setWindowTitle(title);
        }
        // 如果不是在Electron环境，则尝试设置浏览器标题
        document.title = title;
    }

    async deleteItem(docId: string, relativePath: string, isDirectory: boolean): Promise<{ success: boolean, error?: string }> {
        if (USE_IPC) {
            return window.electronAPI.deleteItem(docId, relativePath, isDirectory);
        }
        return { success: false, error: '非Electron环境不支持删除操作' };
    }
}

export const docAPI = new DocAPI(); 