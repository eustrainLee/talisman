import React, { useState, useEffect } from 'react';
import { Card, Space, Layout, Tree, message, Modal, Input, Form, Button, Checkbox, Dropdown, Select, Tooltip } from 'antd';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { MenuFoldOutlined, MenuUnfoldOutlined, FolderOutlined, FileOutlined, GithubOutlined, SettingOutlined, PlusOutlined, CloseOutlined, FolderOpenOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import 'markdown-navbar/dist/navbar.css';
import { MdEditor } from 'md-editor-rt';
import 'md-editor-rt/lib/style.css';
import { API_BASE_URL, USE_IPC } from './config';
import './doc.css';
import { docAPI } from './api/doc';
import type { DocFile, GitConfig, DocPathConfig, DocPathItem } from './api/doc';

const { Sider, Content } = Layout;
const { Option } = Select;

interface CodeProps extends React.HTMLAttributes<HTMLElement> {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
    node?: {
        position?: {
            start?: { line: number };
            end?: { line: number };
        };
    };
}

interface Props {
    menuCollapsed?: boolean;
}

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
    const [pullRequestForm] = Form.useForm();

    const [editTitleForm] = Form.useForm();
    const [gitConfigForm] = Form.useForm();
    const [pathForm] = Form.useForm();
    const [addDocPathForm] = Form.useForm();
    const [tokenSettingForm] = Form.useForm();

    useEffect(() => {
        loadDocPaths();
    }, []);

    useEffect(() => {
        if (currentFile && docFiles.length > 0) {
            loadMarkdownFile(currentFile);
        }
    }, [currentFile]);

    useEffect(() => {
        if (!isPreview) {
            setPreviousDocListState(docListCollapsed);
            setDocListCollapsed(true);
        } else {
            setDocListCollapsed(previousDocListState);
        }
    }, [isPreview]);

    useEffect(() => {
        if (autoSave && !isPreview && markdown !== prevMarkdown) {
            const timer = setTimeout(() => {
                saveMarkdown(false);
                setPrevMarkdown(markdown);
            }, 60000);

            return () => clearTimeout(timer);
        }
    }, [markdown, autoSave]);

    useEffect(() => {
        if (isGitConfigModalVisible && currentDocId) {
            loadGitConfig();
        }
    }, [isGitConfigModalVisible, currentDocId]);

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
                
                // 如果有文档目录，选择第一个存在的目录
                const firstExistingDoc = checkedDocs.find(doc => doc.exists);
                if (firstExistingDoc) {
                    setCurrentDocId(firstExistingDoc.id);
                    loadDocList(firstExistingDoc.id);
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

    const saveMarkdown = async (exitEdit: boolean = true) => {
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

    const loadGitConfig = async () => {
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
            
            // 生成唯一ID
            const id = `doc_${Date.now()}`;
            
            // 添加新的文档目录
            const newDocPath: DocPathItem = {
                id,
                name: values.name,
                path: values.path,
                use_git: false
            };
            
            // 更新配置
            const config = await docAPI.getDocPathConfig();
            const newConfig: DocPathConfig = {
                docs: [...(config.docs || []), newDocPath]
            };
            
            const success = await docAPI.updateDocPathConfig(newConfig);
            if (success) {
                message.success('添加文档目录成功');
                setIsAddDocPathModalVisible(false);
                addDocPathForm.resetFields();
                await loadDocPaths();
                
                // 切换到新添加的文档目录
                setCurrentDocId(id);
                loadDocList(id);
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
                            <div style={{
                                padding: '12px',
                                width: siderWidth,
                                height: '100%',
                                opacity: docListCollapsed ? 0 : 1,
                                transform: `translateX(${docListCollapsed ? '-100%' : '0'})`,
                                transition: 'all 0.3s ease-in-out',
                                overflow: 'auto'
                            }}>
                                {docFiles.length > 0 ? (
                                    <Tree
                                        defaultSelectedKeys={[]}
                                        defaultExpandAll
                                        blockNode={false}
                                        showLine={true}
                                        expandAction="click"
                                        fieldNames={{
                                            title: 'title',
                                            key: 'key',
                                            children: 'children'
                                        }}
                                        titleRender={(nodeData: any) => (
                                            <span style={{ 
                                                textDecoration: nodeData.exists === false ? 'line-through' : 'none',
                                                color: nodeData.exists === false ? '#999' : 'inherit'
                                            }}>
                                                {nodeData.title}
                                            </span>
                                        )}
                                        onSelect={(selectedKeys) => {
                                            if (selectedKeys.length > 0) {
                                                const key = selectedKeys[0] as string;
                                                const node = findNode(docFiles, key);
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
                                        treeData={docFiles}
                                        style={{ 
                                            fontSize: '12px',
                                            padding: '0 4px'
                                        }}
                                        icon={(nodeProps: any) => {
                                            if (nodeProps.data?.isDirectory) {
                                                return <FolderOutlined style={{ color: '#1677ff' }} />;
                                            }
                                            return <FileOutlined style={{ color: nodeProps.data?.exists === false ? '#999' : '#666' }} />;
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        color: '#999',
                                        textAlign: 'center',
                                        padding: '20px 0'
                                    }}>
                                        {currentDocId ? '暂无文档' : '请选择文档目录'}
                                    </div>
                                )}
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
                                    // TXT 文件直接显示为纯文本，保留换行
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
                                    // Markdown 文件使用 ReactMarkdown 渲染
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeRaw]}
                                        components={{
                                            code: ({ inline, className, children, node, ...props }: CodeProps) => {
                                                const content = String(children).replace(/\n$/, '');
                                                const isCodeBlock = node?.position?.start?.line !== node?.position?.end?.line;
                                                if (!isCodeBlock) {
                                                    return (
                                                        <code
                                                            style={{
                                                                backgroundColor: '#f5f5f5',
                                                                color: '#d63200',
                                                                padding: '2px 4px',
                                                                borderRadius: '3px',
                                                                fontSize: '0.9em',
                                                                fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace'
                                                            }}
                                                            {...props}
                                                        >
                                                            {content}
                                                        </code>
                                                    );
                                                }
                                                return (
                                                    <div style={{ position: 'relative' }}>
                                                        <SyntaxHighlighter
                                                            style={oneLight as any}
                                                            language={className ? className.replace(/language-/, '') : ''}
                                                            PreTag="div"
                                                            customStyle={{
                                                                margin: '1em 0',
                                                                padding: '1em',
                                                                borderRadius: '6px',
                                                                fontSize: '85%',
                                                                backgroundColor: '#f6f8fa',
                                                                border: '1px solid #eaecef'
                                                            }}
                                                            {...props}
                                                        >
                                                            {content}
                                                        </SyntaxHighlighter>
                                                        {className && (
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: '0',
                                                                    right: '0',
                                                                    padding: '0.2em 0.6em',
                                                                    fontSize: '85%',
                                                                    color: '#57606a',
                                                                    backgroundColor: '#f6f8fa',
                                                                    borderLeft: '1px solid #eaecef',
                                                                    borderBottom: '1px solid #eaecef',
                                                                    borderRadius: '0 6px 0 6px'
                                                                }}
                                                            >
                                                                {className.replace(/language-/, '')}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                        }}
                                    >
                                        {markdown}
                                    </ReactMarkdown>
                                )}
                            </div>
                        ) : (
                            <MdEditor
                                modelValue={markdown}
                                onChange={setMarkdown}
                                style={{
                                    height: '100%',
                                    '--md-editor-code-head-display': 'block',
                                    '--md-editor-code-flag-display': 'none'
                                } as any}
                                theme="light"
                                previewTheme="github"
                                codeTheme="github"
                                showCodeRowNumber={false}
                                preview={isTxtFile(currentFile) ? false : true}
                                noPrettier={true}
                                noMermaid={isTxtFile(currentFile)}
                                noKatex={true}
                                onSave={() => saveMarkdown(false)}
                                sanitize={(html) => html}
                                formatCopiedText={(text) => text}
                                toolbars={isTxtFile(currentFile) ? [
                                    'revoke',
                                    'next',
                                    'save',
                                    '=',
                                    'pageFullscreen',
                                    'fullscreen'
                                ] as any[] : [
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
                                ] as any[]}
                            />
                        )
                    ) : (
                        <div style={{
                            height: '100%'
                        }}>
                        </div>
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
        </Layout>
    );
};

export default Doc; 