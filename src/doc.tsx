import React, { useState, useEffect } from 'react';
import { Card, Space, Layout, Tree, message, Modal, Input, Form, Button, Checkbox, Dropdown } from 'antd';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { MenuFoldOutlined, MenuUnfoldOutlined, FolderOutlined, FileOutlined, GithubOutlined, SwapOutlined, SettingOutlined } from '@ant-design/icons';
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
import type { DocFile, GitConfig } from './api/doc';

const { Sider, Content } = Layout;

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
    const [isRemoteMode, setIsRemoteMode] = useState(false);
    const [autoSave, setAutoSave] = useState(false);
    const [prevMarkdown, setPrevMarkdown] = useState('');
    const [pathModalVisible, setPathModalVisible] = useState(false);
    const [siderWidth, setSiderWidth] = useState(240);

    const [editTitleForm] = Form.useForm();
    const [gitConfigForm] = Form.useForm();
    const [pathForm] = Form.useForm();

    const handleModeChange = async (mode?: boolean) => {
        const newMode = mode !== undefined ? mode : !isRemoteMode;
        setIsRemoteMode(newMode);
        try {
            const basePath = newMode ? '/remote_docs' : '/docs';
            if (USE_IPC) {
                const files = await window.electronAPI.getDocList(basePath);
                if (!files || files.length === 0) {
                    setDocFiles([]);
                    setCurrentFile('');
                    setMarkdown('');
                    return;
                }
                setDocFiles(files);
            } else {
                const response = await fetch(`${API_BASE_URL}/api/docs/list?noCreate=true`);
                if (!response.ok) {
                    setDocFiles([]);
                    setCurrentFile('');
                    setMarkdown('');
                    return;
                }
                const files = await response.json();
                if (!files || files.length === 0) {
                    setDocFiles([]);
                    setCurrentFile('');
                    setMarkdown('');
                    return;
                }
                setDocFiles(files);
            }
        } catch (error) {
            console.error('获取文档列表失败:', error);
            setDocFiles([]);
            setCurrentFile('');
            setMarkdown('');
        }
    };

    useEffect(() => {
        handleModeChange(false);
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
        const removeDecorations = () => {
            const decorations = document.querySelectorAll('.md-editor-code-flag');
            decorations.forEach(el => {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
        };

        removeDecorations();

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(() => {
                removeDecorations();
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return () => {
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        if (isGitConfigModalVisible) {
            loadGitConfig();
        }
    }, [isGitConfigModalVisible]);

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

    const saveMarkdown = async (exitEdit: boolean = true) => {
        try {
            if (USE_IPC) {
                await window.electronAPI.saveDoc(currentFile, markdown);
                message.success('保存成功');
                if (exitEdit) {
                    setIsPreview(true);
                }
            } else {
                const response = await fetch(`${API_BASE_URL}/api/docs/save`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        path: currentFile,
                        content: markdown,
                    }),
                });

                if (!response.ok) {
                    throw new Error('保存失败');
                }

                message.success('保存成功');
                if (exitEdit) {
                    setIsPreview(true);
                }
            }
        } catch (error) {
            console.error('保存失败:', error);
            message.error('保存失败');
        }
    };

    const updateDocConfig = async (values: { title: string }) => {
        try {
            if (USE_IPC) {
                await window.electronAPI.updateDocConfig(currentFile, values.title);
                message.success('更新成功');
                handleModeChange();
                setIsEditTitleModalVisible(false);
            } else {
                const response = await fetch(`${API_BASE_URL}/api/docs/config`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        path: currentFile,
                        title: values.title,
                    }),
                });

                if (!response.ok) {
                    throw new Error('更新配置失败');
                }

                message.success('更新成功');
                handleModeChange();
                setIsEditTitleModalVisible(false);
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
            if (USE_IPC) {
                const config = await window.electronAPI.getDocGitConfig();
                if (config) {
                    gitConfigForm.setFieldsValue(config);
                }
            }
        } catch (error) {
            console.error('加载Git配置失败:', error);
        }
    };

    const handlePullFromGit = async (values: GitConfig) => {
        try {
            setIsGitConfigModalVisible(false);  // 立即关闭弹窗
            message.loading({ content: '正在从 Git 仓库拉取文档...', key: 'gitPull', duration: 0 });
            
            if (USE_IPC) {
                await window.electronAPI.pullDocFromGit(values);
                message.success({ content: '从 Git 仓库拉取文档成功', key: 'gitPull' });
                handleModeChange();
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

    const loadDocList = async () => {
        try {
            const basePath = isRemoteMode ? '/remote_docs' : '/docs';
            if (USE_IPC) {
                const files = await window.electronAPI.getDocList(basePath);
                if (!files || files.length === 0) {
                    setDocFiles([]);
                    setCurrentFile('');
                    setMarkdown('');
                    return;
                }
                setDocFiles(files);
            } else {
                const response = await fetch(`${API_BASE_URL}/api/docs/list?noCreate=true`);
                if (!response.ok) {
                    setDocFiles([]);
                    setCurrentFile('');
                    setMarkdown('');
                    return;
                }
                const files = await response.json();
                if (!files || files.length === 0) {
                    setDocFiles([]);
                    setCurrentFile('');
                    setMarkdown('');
                    return;
                }
                setDocFiles(files);
            }
        } catch (error) {
            console.error('获取文档列表失败:', error);
            setDocFiles([]);
            setCurrentFile('');
            setMarkdown('');
        }
    };

    const handlePathModalOk = async () => {
        try {
            const values = await pathForm.validateFields();
            const success = await window.electronAPI.updateDocPathConfig(values);
            if (success) {
                message.success('路径配置已更新');
                setPathModalVisible(false);
                loadDocList();
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

    const settingsMenu = {
        items: [
            {
                key: 'pathConfig',
                label: '文档目录设置',
                onClick: () => handlePathConfig()
            }
        ]
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
                        <Button
                            icon={<SwapOutlined />}
                            type={isRemoteMode ? "primary" : "default"}
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleModeChange();
                            }}
                            style={{ marginLeft: '8px' }}
                            disabled={!isPreview}
                        >
                            {isRemoteMode ? '远程文档' : '本地文档'}
                        </Button>
                    </div>
                    <div style={{ width: '1px', height: '12px', background: '#f0f0f0' }} />
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
                        {isRemoteMode && (
                            <Button
                                icon={<GithubOutlined />}
                                onClick={() => setIsGitConfigModalVisible(true)}
                            >
                                从Git拉取
                            </Button>
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
                                        {isRemoteMode ? '暂无远程文档' : '暂无本地文档'}
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
                                preview={true}
                                noPrettier={true}
                                noMermaid={false}
                                noKatex={true}
                                onSave={() => saveMarkdown(false)}
                                sanitize={(html) => html}
                                formatCopiedText={(text) => text}
                                toolbars={[
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
                        name="repoUrl"
                        label="仓库地址"
                        rules={[{ required: true, message: '请输入仓库地址' }]}
                    >
                        <Input placeholder="例如：https://github.com/user/repo.git" />
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
                        name="docPath"
                        label="文档目录"
                        rules={[{ required: true, message: '请输入文档目录' }]}
                        initialValue="docs"
                    >
                        <Input placeholder="例如：docs" />
                    </Form.Item>
                </Form>
            </Modal>
            <Modal
                title="文档目录设置"
                open={pathModalVisible}
                onOk={handlePathModalOk}
                onCancel={() => setPathModalVisible(false)}
            >
                <Form
                    form={pathForm}
                    layout="vertical"
                >
                    <Form.Item
                        name="localPath"
                        label="本地文档目录"
                    >
                        <Input placeholder="请输入本地文档目录路径" />
                    </Form.Item>
                    <Form.Item
                        name="remotePath"
                        label="远程文档目录"
                    >
                        <Input placeholder="请输入远程文档目录路径" />
                    </Form.Item>
                </Form>
            </Modal>
        </Layout>
    );
};

export default Doc; 