/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { Card, Space, Layout, Tree, message, Modal, Input, Form, Button, Checkbox, Dropdown, Select, Tooltip, Menu } from 'antd';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { MenuFoldOutlined, MenuUnfoldOutlined, FolderOutlined, FileOutlined, GithubOutlined, SettingOutlined, PlusOutlined, CloseOutlined, FolderOpenOutlined, FileAddOutlined, FolderAddOutlined, FileTextOutlined, FileUnknownOutlined } from '@ant-design/icons';
import 'markdown-navbar/dist/navbar.css';
import { MdEditor, MdPreview, type Themes, type ToolbarNames } from 'md-editor-rt';
import 'md-editor-rt/lib/style.css';
import { API_BASE_URL, USE_IPC } from './config';
import './doc.css';
import { docAPI } from './api/doc';
import type { DocFile, GitConfig, DocPathConfig, DocPathItem } from './api/doc';
import mermaid from 'mermaid';

// 初始化 mermaid
mermaid.initialize({
    startOnLoad: true,
    theme: 'default',
    securityLevel: 'loose',
    flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
    },
    suppressErrorRendering: true,
});

const { Sider, Content } = Layout;
const { Option } = Select;

interface Props {
    menuCollapsed?: boolean;
}

// 应用名称
const APP_NAME = 'Talisman';

// 在组件顶部定义共同配置
const mdCommonProps = {
    theme: 'light' as Themes,
    previewTheme: 'github',
    codeTheme: 'github',
    showCodeRowNumber: false,
} as const;

const TXT_TOOLBARS: ToolbarNames[] = [
    'revoke',
    'next',
    'save',
    '=',
    'pageFullscreen',
    'fullscreen'
];

const MD_TOOLBARS: ToolbarNames[] = [
    'bold',
    'underline',
    'italic',
    'strikeThrough',
    '-',
    'title',
    'sub',
    'sup',
    'quote',
    'unorderedList',
    'orderedList',
    'task',
    '-',
    'codeRow',
    'code',
    'link',
    'image',
    'table',
    'mermaid',
    '-',
    'revoke',
    'next',
    'save',
    '=',
    'prettier',
    'pageFullscreen',
    'fullscreen',
    'preview',
    'htmlPreview',
    'catalog'
];

const Doc: React.FC<Props> = ({ menuCollapsed = true }) => {
    const [markdown, setMarkdown] = useState('');
    const [isPreview, setIsPreview] = useState(true);
    const [currentFile, setCurrentFile] = useState('');
    const [docFiles, setDocFiles] = useState<DocFile[]>([]);
    const [isEditTitleModalVisible, setIsEditTitleModalVisible] = useState(false);
    const [docListCollapsed, setDocListCollapsed] = useState(false);
    const [previousDocListState, setPreviousDocListState] = useState(false);
    const [isGitConfigModalVisible, setIsGitConfigModalVisible] = useState(false);
    const [currentDocId, setCurrentDocId] = useState<string>('');
    const [docPaths, setDocPaths] = useState<DocPathItem[]>([]);
    const [autoSave, setAutoSave] = useState(false);
    const [prevMarkdown, setPrevMarkdown] = useState('');
    const [pathModalVisible, setPathModalVisible] = useState(false);
    const [siderWidth, setSiderWidth] = useState(240);
    const [isAddDocPathModalVisible, setIsAddDocPathModalVisible] = useState(false);
    const [isRemoveDocPathModalVisible, setIsRemoveDocPathModalVisible] = useState(false);
    const [docPathToRemove, setDocPathToRemove] = useState<DocPathItem | null>(null);
    const [isPullRequestModalVisible, setIsPullRequestModalVisible] = useState(false);
    const [isTokenSettingModalVisible, setIsTokenSettingModalVisible] = useState(false);
    const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
    const [autoExpandParent, setAutoExpandParent] = useState(true);
    
    const [editTitleForm] = Form.useForm();
    const [gitConfigForm] = Form.useForm();
    const [pathForm] = Form.useForm();
    const [addDocPathForm] = Form.useForm();
    const [tokenSettingForm] = Form.useForm();
    const [isCreateFileModalVisible, setIsCreateFileModalVisible] = useState(false);
    const [isCreateDirModalVisible, setIsCreateDirModalVisible] = useState(false);
    const [createItemPath, setCreateItemPath] = useState<string>('');
    const [createItemForm] = Form.useForm();

    const [pullRequestForm] = Form.useForm();

    // 保存当前设置到用户配置
    const saveCurrentSettings = React.useCallback(async () => {
        if (USE_IPC && (currentDocId || currentFile)) {
            try {
                await window.electronAPI.saveUserSettings({
                    lastDocId: currentDocId,
                    lastFilePath: currentFile
                });
            } catch (error) {
                console.error('保存用户设置失败:', error);
            }
        }
    }, [currentDocId, currentFile]);

    // 确保展开包含当前文件的所有父级目录
    const ensureExpandedKeys = React.useCallback(() => {
        if (!currentFile) return;
        
        // 从当前文件路径提取所有父级目录路径
        const parts = currentFile.split('/');
        const paths: React.Key[] = [];
        let currentPath = '';
        
        // 构建父目录路径
        for (let i = 0; i < parts.length - 1; i++) {
            currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
            paths.push(currentPath);
        }
        
        // 设置展开的节点
        setExpandedKeys(paths);
        setAutoExpandParent(true);
    }, [currentFile]);

    // 更新窗口标题
    const updateWindowTitle = React.useCallback(() => {
        try {
            let title = APP_NAME;
            
            if (currentDocId) {
                // 获取当前目录名称
                const currentDoc = docPaths.find(doc => doc.id === currentDocId);
                if (currentDoc) {
                    // 如果有打开的文件
                    if (currentFile) {
                        const node = findNode(docFiles, currentFile);
                        if (node) {
                            // 格式: 文件名 - 目录名称 - 应用名称
                            title = `${node.title} - ${currentDoc.name} - ${APP_NAME}`;
                        } else {
                            // 格式: 目录名称 - 应用名称
                            title = `${currentDoc.name} - ${APP_NAME}`;
                        }
                    } else {
                        // 格式: 目录名称 - 应用名称
                        title = `${currentDoc.name} - ${APP_NAME}`;
                    }
                }
            }
            
            // 设置窗口标题
            if (USE_IPC) {
                window.electronAPI.setWindowTitle(title);
            } else {
                document.title = title;
            }
        } catch (error) {
            console.error('更新窗口标题失败:', error);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDocId, currentFile, docPaths, docFiles]);

    // 加载 Git 配置
    const loadGitConfig = React.useCallback(async () => {
        try {
            if (USE_IPC && currentDocId) {
                const config = await docAPI.getDocGitConfig(currentDocId);
                if (config) {
                    gitConfigForm.setFieldsValue(config);
                    
                    // 只有当 use_ssh 为 true 但 ssh_key_path 为空或不存在时才自动查找
                    if (config.use_ssh && (!config.ssh_key_path || config.ssh_key_path === '')) {
                        const sshKeyPath = await docAPI.getDefaultSSHKeyPath();
                        if (sshKeyPath) {
                            gitConfigForm.setFieldValue('ssh_key_path', sshKeyPath);
                        }
                    }
                } else {
                    // 如果没有保存的配置，获取默认 SSH 密钥路径
                    const sshKeyPath = await docAPI.getDefaultSSHKeyPath();
                    if (sshKeyPath) {
                        gitConfigForm.setFieldValue('ssh_key_path', sshKeyPath);
                    }
                }
            }
        } catch (error) {
            console.error('加载Git配置失败:', error);
        }
    }, [currentDocId, gitConfigForm]);

    // 保存 markdown 内容
    const saveMarkdown = React.useCallback(async (exitEdit: boolean = true) => {
        try {
            if (USE_IPC) {
                const success = await window.electronAPI.saveDoc(currentFile, markdown);
                if (success) {
                    message.success('保存成功');
                    if (exitEdit) {
                        setIsPreview(true);
                    }
                } else {
                    message.error('保存失败');
                }
            } else {
                message.error('保存失败');
            }
        } catch (error) {
            console.error('保存失败:', error);
            message.error('保存失败');
        }
    }, [currentFile, markdown]);

    useEffect(() => {
        loadDocPaths();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (currentFile && docFiles.length > 0) {
            loadMarkdownFile(currentFile);
            // 当选择新文件时保存用户设置
            saveCurrentSettings();
            
            // 确保展开包含当前文件的所有父目录
            ensureExpandedKeys();
            
            // 更新窗口标题
            updateWindowTitle();
        }
    }, [currentFile, docFiles.length, saveCurrentSettings, ensureExpandedKeys, updateWindowTitle]);

    useEffect(() => {
        if (currentDocId) {
            // 当切换到新的文档目录时保存设置
            saveCurrentSettings();
            
            // 更新窗口标题
            updateWindowTitle();
        }
    }, [currentDocId, saveCurrentSettings, updateWindowTitle]);

    // 监听 isPreview 状态变化
    useEffect(() => {
        if (!isPreview) {
            setPreviousDocListState(docListCollapsed);
            setDocListCollapsed(true);
        } else {
            setDocListCollapsed(previousDocListState);
        }
    }, [isPreview]);

    // 监听 docListCollapsed 状态变化
    useEffect(() => {
        if (isPreview) {
            setPreviousDocListState(docListCollapsed);
        }
    }, [docListCollapsed, isPreview]);

    useEffect(() => {
        if (autoSave && !isPreview && markdown !== prevMarkdown) {
            const timer = setTimeout(() => {
                saveMarkdown(false);
                setPrevMarkdown(markdown);
            }, 60000);

            return () => clearTimeout(timer);
        }
    }, [markdown, autoSave, isPreview, prevMarkdown, saveMarkdown]);

    useEffect(() => {
        if (isGitConfigModalVisible && currentDocId) {
            loadGitConfig();
        }
    }, [isGitConfigModalVisible, currentDocId, loadGitConfig]);

    // 监听currentDocId和currentFile的变化，更新窗口标题
    useEffect(() => {
        // 当currentDocId或currentFile变化时，都需要更新窗口标题
        updateWindowTitle();
    }, [currentDocId, currentFile, docPaths, updateWindowTitle]);

    // 初始化 Mermaid
    useEffect(() => {
        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            securityLevel: 'loose',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            },
            suppressErrorRendering: true,
        });
    }, []);

    const loadDocPaths = async () => {
        try {
            const config = await docAPI.getDocPathConfig();
            
            // 检查每个目录是否存在
            if (config.docs && config.docs.length > 0) {
                const checkedDocs = await Promise.all(config.docs.map(async (doc) => {
                    if (USE_IPC) {
                        try {
                            // 检查目录是否存在
                            const exists = await window.electronAPI.checkPathExists(doc.path);
                            return { ...doc, exists };
                        } catch (error) {
                            return { ...doc, exists: false };
                        }
                    }
                    return { ...doc, exists: true }; // 非 IPC 模式默认存在
                }));
                
                setDocPaths(checkedDocs);
                
                // 获取用户上次的设置
                if (USE_IPC) {
                    const settings = await window.electronAPI.getUserSettings();
                    if (settings.lastDocId) {
                        // 检查该文档目录是否存在
                        const existingDoc = checkedDocs.find(doc => doc.id === settings.lastDocId && doc.exists);
                        
                        if (existingDoc) {
                            setCurrentDocId(settings.lastDocId);
                            await loadDocList(settings.lastDocId);
                            
                            // 如果有上次打开的文件，则加载该文件
                            if (settings.lastFilePath) {
                                setCurrentFile(settings.lastFilePath);
                            }
                            return; // 已经加载了上次的文档，不需要继续
                        }
                    }
                }
                
                // 如果没有上次的设置或上次的文档不存在，则选择第一个存在的目录
                const firstExistingDoc = checkedDocs.find(doc => doc.exists);
                if (firstExistingDoc) {
                    setCurrentDocId(firstExistingDoc.id);
                    loadDocList(firstExistingDoc.id);
                    
                    // 更新窗口标题
                    setTimeout(() => updateWindowTitle(), 100);
                }
            } else {
                setDocPaths([]);
            }
        } catch (error) {
            console.error('加载文档目录配置失败:', error);
            message.error('加载文档目录配置失败');
        }
    };

    const loadDocList = async (docId: string = currentDocId) => {
        if (!docId) return;
        
        try {
            if (USE_IPC) {
                const files = await window.electronAPI.getDocList(docId);
                if (!files || files.length === 0) {
                    setDocFiles([]);
                    setCurrentFile('');
                    setMarkdown('');
                    return;
                }
                setDocFiles(files);
                
                // 展开所有文件夹节点
                const keys: React.Key[] = [];
                const collectFolderKeys = (nodes: DocFile[]) => {
                    for (const node of nodes) {
                        if (node.isDirectory) {
                            keys.push(node.key);
                            if (node.children) {
                                collectFolderKeys(node.children);
                            }
                        }
                    }
                };
                collectFolderKeys(files);
                setExpandedKeys(keys);
                setAutoExpandParent(true);
            } else {
                setDocFiles([]);
                setCurrentFile('');
                setMarkdown('');
            }
        } catch (error) {
            console.error('获取文档列表失败:', error);
            setDocFiles([]);
            setCurrentFile('');
            setMarkdown('');
        }
    };

    const loadMarkdownFile = async (path: string) => {
        if (!path) return;
        
        try {
            if (USE_IPC) {
                const text = await window.electronAPI.getDocContent(path);
                setMarkdown(text);
                setPrevMarkdown(text);
            } else {
                const response = await fetch(`${API_BASE_URL}${path}`);
                if (!response.ok) {
                    return;
                }
                const text = await response.text();
                setMarkdown(text);
                setPrevMarkdown(text);
            }
        } catch (error) {
            console.error('加载文档失败:', error);
        }
    };

    // 判断文件是否为 TXT 格式
    const isTxtFile = (filePath: string): boolean => {
        return filePath.toLowerCase().endsWith('.txt');
    };

    const updateDocConfig = async (values: { title: string }) => {
        try {
            if (USE_IPC) {
                const success = await window.electronAPI.updateDocConfig(currentFile, values.title);
                if (success) {
                    message.success('更新成功');
                    loadDocList();
                    setIsEditTitleModalVisible(false);
                } else {
                    message.error('更新配置失败');
                }
            } else {
                message.error('更新配置失败');
            }
        } catch (error) {
            console.error('更新配置失败:', error);
            message.error('更新配置失败');
        }
    };

    const findNode = (nodes: DocFile[], key: string): DocFile | undefined => {
        for (const node of nodes) {
            if (node.key === key) {
                return node;
            }
            if (node.children) {
                const found = findNode(node.children, key);
                if (found) {
                    return found;
                }
            }
        }
        return undefined;
    };

    // 当 use_ssh 切换时自动获取默认 SSH 密钥路径
    const handleSSHToggle = async (checked: boolean) => {
        if (checked) {
            try {
                const sshKeyPath = await docAPI.getDefaultSSHKeyPath();
                if (sshKeyPath) {
                    gitConfigForm.setFieldValue('ssh_key_path', sshKeyPath);
                }
            } catch (error) {
                console.error('获取默认 SSH 密钥路径失败:', error);
            }
        }
    };

    const handlePullFromGit = async (values: GitConfig) => {
        try {
            setIsGitConfigModalVisible(false);  // 立即关闭弹窗
            message.loading({ content: '正在从 Git 仓库拉取文档...', key: 'gitPull', duration: 0 });
            
            if (USE_IPC && currentDocId) {
                await docAPI.pullDocFromGit(currentDocId, values);
                message.success({ content: '从 Git 仓库拉取文档成功', key: 'gitPull' });
                // 刷新当前文档列表
                loadDocList();
            }
        } catch (error) {
            console.error('从Git拉取文档失败:', error);
            message.error({ content: '从 Git 拉取文档失败', key: 'gitPull' });
        }
    };

    const handlePathConfig = async () => {
        try {
            const config = await docAPI.getDocPathConfig();
            pathForm.setFieldsValue(config);
            setPathModalVisible(true);
        } catch (error) {
            message.error('获取路径配置失败');
        }
    };

    const handlePathModalOk = async () => {
        try {
            const values = await pathForm.validateFields();
            const success = await docAPI.updateDocPathConfig(values);
            if (success) {
                message.success('路径配置已更新');
                setPathModalVisible(false);
                await loadDocPaths();
                if (currentDocId) {
                    loadDocList(currentDocId);
                }
                if (currentFile) {
                    loadMarkdownFile(currentFile);
                }
            } else {
                message.error('更新路径配置失败');
            }
        } catch (error) {
            message.error('表单验证失败');
        }
    };

    const handleAddDocPath = async () => {
        try {
            const values = await addDocPathForm.validateFields();
            
            // 验证路径是否存在
            if (USE_IPC) {
                const exists = await window.electronAPI.checkPathExists(values.path);
                if (!exists) {
                    message.error('路径不存在，请确认路径正确性');
                    return;
                }
            }
            
            // 生成唯一 ID
            const id = `doc_${Date.now()}`;
            
            // 更新文档路径配置
            const config = await docAPI.getDocPathConfig();
            
            // 验证名称和路径是否重复
            const nameExists = config.docs.some((doc: DocPathItem) => doc.name === values.name);
            const pathExists = config.docs.some((doc: DocPathItem) => doc.path === values.path);
            
            if (nameExists) {
                message.error('文档名称已存在');
                return;
            }
            
            if (pathExists) {
                message.error('文档路径已存在');
                return;
            }
            
            config.docs.push({
                id,
                name: values.name,
                path: values.path,
                exists: true
            });
            
            const success = await docAPI.updateDocPathConfig(config);
            
            if (success) {
                message.success('添加文档目录成功');
                setIsAddDocPathModalVisible(false);
                addDocPathForm.resetFields();
                await loadDocPaths();
                
                // 切换到新添加的文档目录
                setCurrentDocId(id);
                loadDocList(id);
                
                // 立即更新窗口标题
                const title = `${values.name} - ${APP_NAME}`;
                if (USE_IPC) {
                    window.electronAPI.setWindowTitle(title);
                } else {
                    document.title = title;
                }
            } else {
                message.error('添加文档目录失败');
            }
        } catch (error) {
            message.error('表单验证失败');
        }
    };

    const handleDocIdChange = (docId: string) => {
        if (docId === 'add') {
            // 显示添加文档目录的弹窗
            setIsAddDocPathModalVisible(true);
        } else {
            // 查找选中的目录
            const selectedDoc = docPaths.find(doc => doc.id === docId);
            
            // 只有当目录存在时才加载
            if (selectedDoc && selectedDoc.exists) {
                setCurrentDocId(docId);
                loadDocList(docId);
                setCurrentFile('');
                setMarkdown('');
                
                // 保存用户设置，但这里只保存目录ID，不保存文件路径
                if (USE_IPC) {
                    window.electronAPI.saveUserSettings({
                        lastDocId: docId,
                        lastFilePath: ''
                    }).catch(err => {
                        console.error('保存用户设置失败:', err);
                    });
                }
                
                // 立即更新窗口标题，使用选中的目录对象而不是依赖状态
                const title = `${selectedDoc.name} - ${APP_NAME}`;
                if (USE_IPC) {
                    window.electronAPI.setWindowTitle(title);
                } else {
                    document.title = title;
                }
            }
        }
    };

    const handleRemoveDocPath = (docPath: DocPathItem) => {
        setDocPathToRemove(docPath);
        setIsRemoveDocPathModalVisible(true);
    };

    const confirmRemoveDocPath = async () => {
        if (!docPathToRemove) return;

        try {
            // 获取当前配置
            const config = await docAPI.getDocPathConfig();
            
            // 过滤掉要删除的目录
            const newConfig: DocPathConfig = {
                docs: config.docs.filter(doc => doc.id !== docPathToRemove.id)
            };
            
            const success = await docAPI.updateDocPathConfig(newConfig);
            if (success) {
                message.success('移除文档目录成功');
                
                // 如果删除的是当前选中的目录，重置当前选中的目录
                if (currentDocId === docPathToRemove.id) {
                    setCurrentDocId('');
                    setCurrentFile('');
                    setMarkdown('');
                    setDocFiles([]);
                }
                
                // 重新加载文档目录列表
                await loadDocPaths();
                
                // 关闭确认弹窗
                setIsRemoveDocPathModalVisible(false);
                setDocPathToRemove(null);
            } else {
                message.error('移除文档目录失败');
            }
        } catch (error) {
            console.error('移除文档目录失败:', error);
            message.error('移除文档目录失败');
        }
    };

    const handleCreatePullRequest = async (values: any) => {
        if (USE_IPC && currentDocId) {
            try {
                setIsPullRequestModalVisible(false);
                message.loading({ content: '正在创建 Pull Request...', key: 'createPR', duration: 0 });
                
                const result = await window.electronAPI.createPullRequest({
                    docId: currentDocId,
                    pr: {
                        title: values.title,
                        description: values.description,
                        branch: values.branch,
                        targetBranch: values.targetBranch
                    }
                });
                
                if (result.success) {
                    if (result.prUrl) {
                        // 使用消息提示，包含可点击的链接
                        message.success({
                            content: (
                                <span>
                                    Pull Request 创建成功！ <a href="#" onClick={(e) => {
                                        e.preventDefault();
                                        // 使用 Electron 的 shell.openExternal 在默认浏览器中打开链接
                                        if (window.electronAPI.openExternal && result.prUrl) {
                                            window.electronAPI.openExternal(result.prUrl);
                                        } else {
                                            // 如果 openExternal 不可用，回退到 window.open
                                            window.open(result.prUrl, '_blank', 'noopener,noreferrer');
                                        }
                                    }}>点击此处</a> 在浏览器中查看
                                </span>
                            ),
                            key: 'createPR',
                            duration: 10 // 延长显示时间，给用户足够时间点击
                        });
                    } else {
                        message.success({ content: 'Pull Request 创建成功!', key: 'createPR' });
                    }
                } else {
                    message.error({ content: `创建 Pull Request 失败: ${result.error}`, key: 'createPR' });
                }
            } catch (error) {
                console.error('创建 Pull Request 失败:', error);
                message.error({ content: '创建 Pull Request 失败', key: 'createPR' });
            }
        }
    };

    const showPullRequestModal = (docId: string) => {
        setCurrentDocId(docId);
        
        // 获取 Git 配置以预填充目标分支
        if (USE_IPC) {
            window.electronAPI.getDocGitConfig(docId).then(gitConfig => {
                if (gitConfig) {
                    pullRequestForm.setFieldsValue({
                        targetBranch: gitConfig.branch || 'main'
                    });
                } else {
                    pullRequestForm.setFieldsValue({
                        targetBranch: 'main'
                    });
                }
            });
        }
        
        setIsPullRequestModalVisible(true);
    };

    const showTokenSettingModal = () => {
        setIsTokenSettingModalVisible(true);
    };

    const handleSaveTokens = async (values: any) => {
        try {
            // 保存 GitHub 令牌
            if (values.githubToken) {
                await window.electronAPI.saveToken('github', values.githubToken);
            }
            
            // 保存 GitLab 令牌
            if (values.gitlabToken) {
                await window.electronAPI.saveToken('gitlab', values.gitlabToken);
            }
            
            message.success('令牌保存成功');
            setIsTokenSettingModalVisible(false);
        } catch (error) {
            console.error('保存令牌失败:', error);
            message.error('保存令牌失败');
        }
    };

    const settingsMenu = {
        items: [
            {
                key: 'pathConfig',
                label: '文档目录设置',
                onClick: () => handlePathConfig()
            },
            {
                key: 'gitPull',
                label: '从 Git 拉取文档',
                icon: <GithubOutlined />,
                onClick: () => setIsGitConfigModalVisible(true),
                disabled: !currentDocId
            },
            {
                key: 'createPR',
                label: '创建 Pull Request',
                icon: <GithubOutlined />,
                onClick: () => {
                    if (currentDocId) {
                        showPullRequestModal(currentDocId);
                    }
                },
                disabled: !currentDocId
            },
            {
                key: 'tokenSetting',
                label: 'Git 令牌设置',
                icon: <SettingOutlined />,
                onClick: () => showTokenSettingModal()
            }
        ]
    };

    // 生成下拉菜单选项
    const generateOptions = () => {
        const options = docPaths.map(doc => (
            <Option 
                key={doc.id} 
                value={doc.id}
                disabled={!doc.exists}
            >
                <Tooltip title={doc.path} placement="right">
                    <div 
                        style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            position: 'relative',
                            textDecoration: doc.exists ? 'none' : 'line-through',
                            color: doc.exists ? 'inherit' : '#999'
                        }}
                        className="doc-option"
                    >
                        <span>{doc.name}</span>
                        <CloseOutlined 
                            className="doc-remove-icon"
                            style={{ 
                                color: '#999',
                                position: 'absolute',
                                right: 0,
                                opacity: 0,
                                transition: 'opacity 0.2s'
                            }} 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveDocPath(doc);
                            }}
                        />
                    </div>
                </Tooltip>
            </Option>
        ));
        
        return options;
    };
    
    // 自定义下拉菜单渲染
    const dropdownRender = (menu: React.ReactElement) => (
        <>
            {docPaths.length > 0 ? menu : null}
            <div style={{ padding: '8px', borderTop: docPaths.length > 0 ? '1px solid #f0f0f0' : 'none' }}>
                <Button 
                    type="text" 
                    icon={<PlusOutlined />} 
                    block 
                    onClick={() => setIsAddDocPathModalVisible(true)}
                >
                    添加文档目录
                </Button>
            </div>
        </>
    );

    // 添加自定义的路径处理函数
    const pathJoin = (...parts: string[]): string => {
        // 过滤空字符串
        const filtered = parts.filter(part => part !== '');
        // 使用正斜杠作为分隔符，并处理多余的斜杠
        return filtered.join('/').replace(/\/+/g, '/');
    };

    // 处理创建文件
    const handleCreateFile = async (values: { name: string }) => {
        if (!values.name || !currentDocId) return;
        
        try {
            // 构建相对路径
            let relativePath = values.name;
            
            // 检查文件名是否已经包含后缀名
            if (!relativePath.includes('.')) {
                relativePath += '.md';
            }
            
            // 如果有父路径，则拼接
            if (createItemPath) {
                relativePath = pathJoin(createItemPath, relativePath);
            }
            
            // 创建文件
            const result = await window.electronAPI.createFile(currentDocId, relativePath, '');
            
            if (result.success) {
                message.success('文件创建成功');
                // 刷新文档列表
                refreshDocList();
            } else {
                message.error(`文件创建失败: ${result.error}`);
            }
        } catch (error) {
            console.error('创建文件失败:', error);
            message.error('创建文件失败');
        } finally {
            setIsCreateFileModalVisible(false);
            createItemForm.resetFields();
        }
    };

    // 处理创建文件夹
    const handleCreateDirectory = async (values: { name: string }) => {
        if (!values.name || !currentDocId) return;
        
        try {
            // 构建相对路径
            let relativePath = values.name;
            
            // 如果有父路径，则拼接
            if (createItemPath) {
                relativePath = pathJoin(createItemPath, relativePath);
            }
            
            // 创建文件夹
            const result = await window.electronAPI.createDirectory(currentDocId, relativePath);
            
            if (result.success) {
                message.success('文件夹创建成功');
                // 刷新文档列表
                refreshDocList();
            } else {
                message.error(`文件夹创建失败: ${result.error}`);
            }
        } catch (error) {
            console.error('创建文件夹失败:', error);
            message.error('创建文件夹失败');
        } finally {
            setIsCreateDirModalVisible(false);
            createItemForm.resetFields();
        }
    };

    // 显示创建文件对话框
    const showCreateFileModal = (nodePath: string = '') => {
        setCreateItemPath(nodePath);
        setIsCreateFileModalVisible(true);
    };

    // 显示创建文件夹对话框
    const showCreateDirModal = (nodePath: string = '') => {
        setCreateItemPath(nodePath);
        setIsCreateDirModalVisible(true);
    };

    // 刷新文档列表
    const refreshDocList = () => {
        if (currentDocId) {
            // 使用已有的 getDocList 函数获取文档列表
            if (USE_IPC) {
                window.electronAPI.getDocList(currentDocId).then(files => {
                    setDocFiles(files);
                }).catch(error => {
                    console.error('获取文档列表失败:', error);
                    setDocFiles([]);
                });
            } else {
                docAPI.getDocList(currentDocId).then(files => {
                    setDocFiles(files);
                }).catch(error => {
                    console.error('获取文档列表失败:', error);
                    setDocFiles([]);
                });
            }
        }
    };

    // 添加一个函数来处理删除文件或文件夹
    const handleDeleteItem = async (nodePath: string, isDirectory: boolean) => {
        if (!nodePath || !currentDocId) return;
        
        try {
            // 构建相对路径
            const relativePath = nodePath.split('/').slice(1).join('/');
            
            // 确认删除
            Modal.confirm({
                title: `确认删除${isDirectory ? '文件夹' : '文件'}`,
                content: `确定要删除${isDirectory ? '文件夹' : '文件'} "${relativePath}" 吗？此操作不可恢复。`,
                okText: '删除',
                okType: 'danger',
                cancelText: '取消',
                onOk: async () => {
                    // 执行删除操作
                    const result = await docAPI.deleteItem(currentDocId, relativePath, isDirectory);
                    
                    if (result.success) {
                        message.success(`${isDirectory ? '文件夹' : '文件'}删除成功`);
                        
                        // 如果删除的是当前打开的文件，需要清空内容
                        if (!isDirectory && nodePath === currentFile) {
                            setCurrentFile('');
                            setMarkdown('');
                        }
                        
                        // 刷新文档列表
                        refreshDocList();
                    } else {
                        message.error(`删除失败: ${result.error}`);
                    }
                }
            });
        } catch (error) {
            console.error('删除失败:', error);
            message.error('删除失败');
        }
    };

    // 更新onRightClick函数，添加删除选项
    const onRightClick = ({ event, node }: any) => {
        event.preventDefault();
        event.stopPropagation();
        
        // 获取节点路径和文档ID
        let nodePath = '';
        let docId = currentDocId;
        let isDirectory = true;
        
        // 如果有节点信息，则使用节点信息
        if (node) {
            nodePath = node.key;
            isDirectory = node.isDirectory;
            docId = node.key.split('/')[0];
            // 设置当前文档 ID
            setCurrentDocId(docId);
        }
        
        // 创建右键菜单项
        const items = [];
        
        // 只有点击的是目录时，才添加创建文件选项
        if (isDirectory) {
            items.push({
                key: 'create-file',
                icon: <FileAddOutlined />,
                label: '创建文件',
                onClick: () => showCreateFileModal(nodePath.split('/').slice(1).join('/')),
                disabled: !docId
            });
        }
        
        // 如果选中了文件或文件夹，添加删除选项
        if (nodePath) {
            items.push({
                key: 'delete',
                icon: <CloseOutlined />,
                label: `删除${isDirectory ? '文件夹' : '文件'}`,
                onClick: () => handleDeleteItem(nodePath, isDirectory),
                disabled: false
            });
        }
        
        // 使用 message.open 显示菜单
        message.open({
            content: (
                <Menu
                    items={items}
                    style={{ 
                        border: '1px solid #f0f0f0',
                        borderRadius: '2px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                    }}
                    className="context-menu"
                />
            ),
            duration: 0,
            style: {
                position: 'absolute',
                left: `${event.clientX}px`,
                top: `${event.clientY}px`,
                pointerEvents: 'auto',
                padding: 0,
                margin: 0,
                background: 'transparent',
                boxShadow: 'none'
            },
            key: 'context-menu'
        });
        
        // 添加点击外部关闭菜单
        const handleClickOutside = () => {
            message.destroy('context-menu');
            document.removeEventListener('click', handleClickOutside);
        };
        
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 100);
    };

    // 添加顶部工具栏按钮
    const renderToolbar = () => {
        return (
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                {/* 工具栏按钮已移除，改为右键菜单 */}
            </div>
        );
    };

    return (
        <Layout style={{ 
            background: '#fff', 
            height: '100vh', 
            margin: 0,
            overflow: 'hidden'
        }}>
            <Card 
                style={{ 
                    borderRadius: 0,
                    position: 'fixed',
                    top: 0,
                    left: menuCollapsed ? '80px' : '200px',
                    right: 0,
                    zIndex: 99,
                    transition: 'left 0.2s'
                }}
                styles={{ body: { padding: 0 } }}
            >
                <div style={{ 
                    padding: '8px 24px',
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    backgroundColor: '#fff'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: isPreview ? 'pointer' : 'not-allowed',
                        paddingLeft: '4px',
                        opacity: isPreview ? 1 : 0.5
                    }} onClick={() => isPreview && setDocListCollapsed(!docListCollapsed)}>
                        {docListCollapsed ? (
                            <MenuUnfoldOutlined style={{ transition: 'transform 0.2s' }} />
                        ) : (
                            <MenuFoldOutlined style={{ transition: 'transform 0.2s' }} />
                        )}
                        <span>目录</span>
                    </div>
                    <div style={{ width: '1px', height: '12px', background: '#f0f0f0' }} />
                    <Select
                        style={{ width: 200 }}
                        value={currentDocId}
                        onChange={handleDocIdChange}
                        disabled={!isPreview}
                        dropdownRender={dropdownRender}
                    >
                        {generateOptions()}
                    </Select>
                    <div style={{ flex: 1 }} />
                    <Space style={{ marginBottom: 16 }}>
                        {isPreview ? (
                            <Button 
                                type="primary" 
                                onClick={() => setIsPreview(false)}
                                disabled={!currentFile}
                            >
                                编辑
                            </Button>
                        ) : (
                            <>
                                <Form 
                                    style={{ marginBottom: 0 }}
                                >
                                    <Form.Item
                                        valuePropName="checked"
                                        style={{ marginBottom: 0 }}
                                    >
                                        <Checkbox
                                            checked={autoSave}
                                            onChange={(e) => setAutoSave(e.target.checked)}
                                        >
                                            自动保存
                                        </Checkbox>
                                    </Form.Item>
                                </Form>
                                <Button 
                                    onClick={() => {
                                        if (currentFile) {
                                            loadMarkdownFile(currentFile);
                                        }
                                        setIsPreview(true);
                                    }}
                                >
                                    取消
                                </Button>
                                <Button 
                                    type="primary" 
                                    onClick={() => saveMarkdown(true)}
                                >
                                    保存
                                </Button>
                            </>
                        )}
                        <Dropdown
                            menu={settingsMenu}
                        >
                            <Button icon={<SettingOutlined />} />
                        </Dropdown>
                    </Space>
                </div>
            </Card>
            <Layout style={{ 
                background: '#fff',
                marginTop: '57px',
                height: 'calc(100vh - 57px)',
                overflow: 'hidden',
                position: 'relative'
            }}>
                <Resizable
                    width={docListCollapsed ? 0 : siderWidth}
                    height={0}
                    onResize={(_e: React.SyntheticEvent, { size }: { size: { width: number } }) => {
                        if (!docListCollapsed) {
                            setSiderWidth(size.width);
                        }
                    }}
                    handle={
                        <div
                            style={{
                                position: 'absolute',
                                right: -5,
                                top: 0,
                                bottom: 0,
                                width: 10,
                                cursor: 'col-resize',
                                zIndex: 99
                            }}
                        />
                    }
                    draggableOpts={{ enableUserSelectHack: false }}
                    minConstraints={[160, 0]}
                    maxConstraints={[400, 0]}
                >
                    <div style={{
                        width: docListCollapsed ? 0 : siderWidth,
                        overflow: 'hidden',
                        height: '100%',
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        zIndex: 98,
                        backgroundColor: '#fff',
                        transition: docListCollapsed ? 'width 0.3s ease-in-out' : 'none',
                        borderRight: docListCollapsed ? 'none' : '1px solid #f0f0f0'
                    }}>
                        <Sider 
                            width={siderWidth}
                            style={{ 
                                background: '#fff',
                                height: '100%',
                                overflow: 'hidden'
                            }}
                        >
                            <div style={{ padding: '16px 16px 0' }}>
                                {renderToolbar()}
                            </div>
                            
                            <div 
                                style={{ height: 'calc(100% - 16px)', overflow: 'auto' }}
                                onContextMenu={(event) => {
                                    // 在空白区域右击时显示菜单
                                    event.preventDefault();
                                    event.stopPropagation();
                                    
                                    // 使用 message.open 显示菜单
                                    message.open({
                                        content: (
                                            <Menu
                                                items={[
                                                    {
                                                        key: 'create-file',
                                                        icon: <FileAddOutlined />,
                                                        label: '创建文件',
                                                        onClick: () => showCreateFileModal(''),
                                                        disabled: !currentDocId
                                                    },
                                                    {
                                                        key: 'create-dir',
                                                        icon: <FolderAddOutlined />,
                                                        label: '创建文件夹',
                                                        onClick: () => showCreateDirModal(''),
                                                        disabled: !currentDocId
                                                    }
                                                ]}
                                                style={{ 
                                                    border: '1px solid #f0f0f0',
                                                    borderRadius: '2px',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                                }}
                                                className="context-menu"
                                            />
                                        ),
                                        duration: 0,
                                        style: {
                                            position: 'absolute',
                                            left: `${event.clientX}px`,
                                            top: `${event.clientY}px`,
                                            pointerEvents: 'auto',
                                            padding: 0,
                                            margin: 0,
                                            background: 'transparent',
                                            boxShadow: 'none'
                                        },
                                        key: 'context-menu'
                                    });
                                    
                                    // 添加点击外部关闭菜单
                                    const handleClickOutside = () => {
                                        message.destroy('context-menu');
                                        document.removeEventListener('click', handleClickOutside);
                                    };
                                    
                                    setTimeout(() => {
                                        document.addEventListener('click', handleClickOutside);
                                    }, 100);
                                }}
                            >
                                <Tree
                                    showLine={{ showLeafIcon: false }}
                                    showIcon
                                    expandedKeys={expandedKeys}
                                    autoExpandParent={autoExpandParent}
                                    onExpand={(keys) => {
                                        setExpandedKeys(keys);
                                        setAutoExpandParent(false);
                                    }}
                                    selectedKeys={currentFile ? [currentFile] : []}
                                    onSelect={(selectedKeys) => {
                                        if (selectedKeys.length > 0) {
                                            const key = selectedKeys[0] as string;
                                            const node = findNode(docFiles, key);
                                            
                                            // 如果是目录，则切换展开/折叠状态
                                            if (node && node.isDirectory) {
                                                const newExpandedKeys = [...expandedKeys];
                                                const index = newExpandedKeys.indexOf(key);
                                                if (index > -1) {
                                                    // 已展开，则折叠
                                                    newExpandedKeys.splice(index, 1);
                                                } else {
                                                    // 未展开，则展开
                                                    newExpandedKeys.push(key);
                                                }
                                                setExpandedKeys(newExpandedKeys);
                                                return;
                                            }
                                            
                                            // 如果是文件，则打开文件
                                            if (node && !node.isDirectory) {
                                                if (node.exists === false) {
                                                    message.error('该文档不存在，无法打开');
                                                    return;
                                                }
                                                if (!isPreview && markdown) {
                                                    saveMarkdown().then(() => {
                                                        setCurrentFile(key);
                                                    });
                                                } else {
                                                    setCurrentFile(key);
                                                }
                                            }
                                        }
                                    }}
                                    onRightClick={onRightClick}
                                    treeData={docFiles}
                                    icon={(props) => {
                                        const { data } = props as any;
                                        const isDirectory = data?.isDirectory;
                                        if (isDirectory) {
                                            return <FolderOutlined />;
                                        } else {
                                            // 获取文件扩展名
                                            const key = String(data?.key || '');
                                            if (key.endsWith('.md')) {
                                                return <FileTextOutlined />;
                                            } else if (key.endsWith('.txt')) {
                                                return <FileOutlined />;
                                            } else {
                                                return <FileUnknownOutlined />;
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </Sider>
                    </div>
                </Resizable>
                <Content style={{ 
                    padding: '16px 24px',
                    marginLeft: docListCollapsed ? 0 : `${siderWidth}px`,
                    transition: docListCollapsed ? 'margin-left 0.3s ease-in-out' : 'none',
                    height: '100%',
                    overflow: 'auto',
                    backgroundColor: '#fff'
                }}>
                    {currentFile ? (
                        isPreview ? (
                            <div style={{ height: '100%', overflow: 'auto' }}>
                                {isTxtFile(currentFile) ? (
                                    // TXT 文件保持原样
                                    <pre style={{ 
                                        whiteSpace: 'pre-wrap', 
                                        wordWrap: 'break-word',
                                        fontFamily: 'inherit',
                                        fontSize: 'inherit',
                                        margin: 0,
                                        padding: 0
                                    }}>
                                        {markdown}
                                    </pre>
                                ) : (
                                    // Markdown 文件使用 MdPreview 替代 ReactMarkdown
                                    <MdPreview 
                                        {...mdCommonProps}
                                        modelValue={markdown}
                                        style={{
                                            backgroundColor: '#fff'
                                        }}
                                    />
                                )}
                            </div>
                        ) : (
                            <MdEditor
                                {...mdCommonProps}
                                modelValue={markdown}
                                onChange={setMarkdown}
                                style={{
                                    height: '100%',
                                    '--md-editor-code-head-display': 'block',
                                    '--md-editor-code-flag-display': 'none'
                                } as any}
                                showCodeRowNumber={false}
                                preview={isTxtFile(currentFile) ? false : true}
                                noPrettier={true}
                                noKatex={true}
                                onSave={() => saveMarkdown(false)}
                                sanitize={(html) => html}
                                formatCopiedText={(text) => text}
                                className="custom-md-editor"
                                toolbars={isTxtFile(currentFile) ? TXT_TOOLBARS : MD_TOOLBARS}
                            />
                        )
                    ) : (
                        <div style={{ height: '100%' }}></div>
                    )}
                </Content>
            </Layout>
            <Modal
                title="修改文档标题"
                open={isEditTitleModalVisible}
                onOk={() => editTitleForm.submit()}
                onCancel={() => setIsEditTitleModalVisible(false)}
            >
                <Form
                    form={editTitleForm}
                    onFinish={updateDocConfig}
                    layout="vertical"
                >
                    <Form.Item
                        name="title"
                        label="文档标题"
                        rules={[{ required: true, message: '请输入文档标题' }]}
                    >
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>
            <Modal
                title="Git仓库配置"
                open={isGitConfigModalVisible}
                onOk={() => gitConfigForm.submit()}
                onCancel={() => setIsGitConfigModalVisible(false)}
            >
                <Form
                    form={gitConfigForm}
                    onFinish={handlePullFromGit}
                    layout="vertical"
                >
                    <Form.Item
                        name="repo_url"
                        label="仓库地址"
                        rules={[{ required: true, message: '请输入仓库地址' }]}
                    >
                        <Input placeholder="例如：https://github.com/user/repo.git 或 git@github.com:user/repo.git" />
                    </Form.Item>
                    <Form.Item
                        name="branch"
                        label="分支"
                        rules={[{ required: true, message: '请输入分支名' }]}
                        initialValue="main"
                    >
                        <Input placeholder="例如：main" />
                    </Form.Item>
                    <Form.Item
                        name="doc_path"
                        label="文档目录"
                        initialValue=""
                    >
                        <Input placeholder="留空表示使用仓库根目录" />
                    </Form.Item>
                    <Form.Item
                        name="use_ssh"
                        valuePropName="checked"
                    >
                        <Checkbox onChange={(e) => handleSSHToggle(e.target.checked)}>使用 SSH 密钥</Checkbox>
                    </Form.Item>
                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) => prevValues.use_ssh !== currentValues.use_ssh}
                    >
                        {({ getFieldValue }) => 
                            getFieldValue('use_ssh') ? (
                                <Form.Item
                                    name="ssh_key_path"
                                    label="SSH 密钥路径"
                                    rules={[{ required: true, message: '请输入 SSH 密钥路径' }]}
                                >
                                    <Input placeholder="例如：C:\Users\username\.ssh\id_rsa" />
                                </Form.Item>
                            ) : null
                        }
                    </Form.Item>
                </Form>
            </Modal>
            <Modal
                title="文档目录设置"
                open={pathModalVisible}
                onOk={handlePathModalOk}
                onCancel={() => setPathModalVisible(false)}
                width={700}
            >
                <Form
                    form={pathForm}
                    layout="vertical"
                >
                    <Form.List name="docs">
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name, ...restField }) => (
                                    <div key={key} style={{ display: 'flex', marginBottom: 8, gap: 8, alignItems: 'baseline' }}>
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'name']}
                                            rules={[{ required: true, message: '请输入名称' }]}
                                            style={{ width: '30%' }}
                                        >
                                            <Input placeholder="名称" />
                                        </Form.Item>
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'path']}
                                            rules={[{ required: true, message: '请输入路径' }]}
                                            style={{ width: '60%' }}
                                        >
                                            <Input 
                                                placeholder="路径" 
                                                addonAfter={
                                                    <Button 
                                                        type="text" 
                                                        icon={<FolderOpenOutlined />} 
                                                        onClick={async () => {
                                                            if (USE_IPC) {
                                                                try {
                                                                    // 获取当前输入框的值
                                                                    const currentPath = pathForm.getFieldValue(['docs', name, 'path']);
                                                                    
                                                                    // 检查当前路径是否有效
                                                                    let initialPath = '';
                                                                    if (currentPath) {
                                                                        const exists = await window.electronAPI.checkPathExists(currentPath);
                                                                        if (exists) {
                                                                            initialPath = currentPath;
                                                                        }
                                                                    }
                                                                    
                                                                    const selectedPath = await window.electronAPI.selectDirectory(initialPath);
                                                                    if (selectedPath) {
                                                                        pathForm.setFields([
                                                                            {
                                                                                name: ['docs', name, 'path'],
                                                                                value: selectedPath
                                                                            }
                                                                        ]);
                                                                    }
                                                                } catch (error) {
                                                                    console.error('选择目录失败:', error);
                                                                    message.error('选择目录失败');
                                                                }
                                                            }
                                                        }}
                                                        style={{ border: 'none' }}
                                                    />
                                                }
                                            />
                                        </Form.Item>
                                        <Button onClick={() => remove(name)} type="text" danger>删除</Button>
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'id']}
                                            hidden
                                        >
                                            <Input />
                                        </Form.Item>
                                    </div>
                                ))}
                                <Form.Item>
                                    <Button type="dashed" onClick={() => add({ id: `doc_${Date.now()}`, name: '', path: '' })} block icon={<PlusOutlined />}>
                                        添加文档目录
                                    </Button>
                                </Form.Item>
                            </>
                        )}
                    </Form.List>
                </Form>
            </Modal>
            <Modal
                title="添加文档目录"
                open={isAddDocPathModalVisible}
                onOk={handleAddDocPath}
                onCancel={() => setIsAddDocPathModalVisible(false)}
            >
                <Form
                    form={addDocPathForm}
                    layout="vertical"
                >
                    <Form.Item
                        name="name"
                        label="名称"
                        rules={[{ required: true, message: '请输入文档目录名称' }]}
                    >
                        <Input placeholder="例如：项目文档" />
                    </Form.Item>
                    <Form.Item
                        name="path"
                        label="路径"
                        rules={[{ required: true, message: '请输入文档目录路径' }]}
                    >
                        <Input 
                            placeholder="例如：D:\Documents\Projects" 
                            addonAfter={
                                <Button 
                                    type="text" 
                                    icon={<FolderOpenOutlined />} 
                                    onClick={async () => {
                                        if (USE_IPC) {
                                            try {
                                                // 获取当前输入框的值
                                                const currentPath = addDocPathForm.getFieldValue('path');
                                                
                                                // 检查当前路径是否有效
                                                let initialPath = '';
                                                if (currentPath) {
                                                    const exists = await window.electronAPI.checkPathExists(currentPath);
                                                    if (exists) {
                                                        initialPath = currentPath;
                                                    }
                                                }
                                                
                                                const selectedPath = await window.electronAPI.selectDirectory(initialPath);
                                                if (selectedPath) {
                                                    addDocPathForm.setFieldValue('path', selectedPath);
                                                }
                                            } catch (error) {
                                                console.error('选择目录失败:', error);
                                                message.error('选择目录失败');
                                            }
                                        }
                                    }}
                                    style={{ border: 'none' }}
                                />
                            }
                        />
                    </Form.Item>
                </Form>
            </Modal>
            <Modal
                title="确认移除"
                open={isRemoveDocPathModalVisible}
                onOk={confirmRemoveDocPath}
                onCancel={() => {
                    setIsRemoveDocPathModalVisible(false);
                    setDocPathToRemove(null);
                }}
                okText="确认移除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
            >
                <p>确定要移除文档目录 "{docPathToRemove?.name}" 吗？</p>
                <p style={{ color: '#ff4d4f' }}>注意：这将从配置中移除该目录，但不会删除磁盘上的文件。</p>
            </Modal>
            <Modal
                title="创建 Pull Request"
                open={isPullRequestModalVisible}
                onCancel={() => setIsPullRequestModalVisible(false)}
                footer={null}
            >
                <Form
                    form={pullRequestForm}
                    layout="vertical"
                    onFinish={handleCreatePullRequest}
                    initialValues={{
                        branch: `pr-${new Date().getTime()}`,
                        targetBranch: 'main'
                    }}
                >
                    <Form.Item
                        name="title"
                        label="PR 标题"
                        rules={[{ required: true, message: '请输入 PR 标题' }]}
                    >
                        <Input placeholder="请输入 PR 标题" />
                    </Form.Item>
                    
                    <Form.Item
                        name="description"
                        label="PR 描述"
                    >
                        <Input.TextArea rows={4} placeholder="请输入 PR 描述" />
                    </Form.Item>
                    
                    <Form.Item
                        name="branch"
                        label="新分支名称"
                        rules={[{ required: true, message: '请输入新分支名称' }]}
                    >
                        <Input placeholder="请输入新分支名称" />
                    </Form.Item>
                    
                    <Form.Item
                        name="targetBranch"
                        label="目标分支"
                        rules={[{ required: true, message: '请输入目标分支' }]}
                    >
                        <Input placeholder="请输入目标分支" />
                    </Form.Item>
                    
                    <Form.Item>
                        <Button type="primary" htmlType="submit">
                            创建 Pull Request
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
            <Modal
                title="Git 令牌设置"
                open={isTokenSettingModalVisible}
                onCancel={() => setIsTokenSettingModalVisible(false)}
                footer={null}
            >
                <Form
                    form={tokenSettingForm}
                    layout="vertical"
                    onFinish={handleSaveTokens}
                >
                    <Form.Item
                        name="githubToken"
                        label="GitHub 个人访问令牌"
                        extra="用于直接创建 GitHub Pull Request"
                    >
                        <Input.Password placeholder="请输入 GitHub 个人访问令牌" />
                    </Form.Item>
                    
                    <Form.Item
                        name="gitlabToken"
                        label="GitLab 个人访问令牌"
                        extra="用于直接创建 GitLab Merge Request"
                    >
                        <Input.Password placeholder="请输入 GitLab 个人访问令牌" />
                    </Form.Item>
                    
                    <Form.Item>
                        <Button type="primary" htmlType="submit">
                            保存
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
            <Modal
                title="创建文件"
                open={isCreateFileModalVisible}
                onCancel={() => setIsCreateFileModalVisible(false)}
                footer={null}
            >
                <Form
                    form={createItemForm}
                    layout="vertical"
                    onFinish={handleCreateFile}
                >
                    <Form.Item
                        name="name"
                        label="文件名"
                        rules={[{ required: true, message: '请输入文件名' }]}
                    >
                        <Input placeholder="请输入文件名，如：document.md" />
                    </Form.Item>
                    
                    <Form.Item>
                        <Button type="primary" htmlType="submit">
                            创建
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
            <Modal
                title="创建文件夹"
                open={isCreateDirModalVisible}
                onCancel={() => setIsCreateDirModalVisible(false)}
                footer={null}
            >
                <Form
                    form={createItemForm}
                    layout="vertical"
                    onFinish={handleCreateDirectory}
                >
                    <Form.Item
                        name="name"
                        label="文件夹名"
                        rules={[{ required: true, message: '请输入文件夹名' }]}
                    >
                        <Input placeholder="请输入文件夹名，如：documents" />
                    </Form.Item>
                    
                    <Form.Item>
                        <Button type="primary" htmlType="submit">
                            创建
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </Layout>
    );
};

export default Doc; 