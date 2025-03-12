import React, { useState, useEffect } from 'react';
import { Card, Space, Layout, Tree, message, Modal, Input, Form, Button, Checkbox } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, FolderOutlined, FileOutlined, GithubOutlined, SwapOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import MarkNav from 'markdown-navbar';
import 'markdown-navbar/dist/navbar.css';
import { MdEditor } from 'md-editor-rt';
import 'md-editor-rt/lib/style.css';
import { API_BASE_URL, USE_IPC } from './config';
import './doc.css';

const { Sider, Content } = Layout;

interface CodeProps extends React.HTMLAttributes<HTMLElement> {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
    node?: any;
}

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
    const [form] = Form.useForm();
    const [isGitConfigModalVisible, setIsGitConfigModalVisible] = useState(false);
    const [gitConfigForm] = Form.useForm();
    const [isRemoteMode, setIsRemoteMode] = useState(false);
    const [autoSave, setAutoSave] = useState(false);
    const [prevMarkdown, setPrevMarkdown] = useState('');
    const [collapsed, setCollapsed] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

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
        loadGitConfig();
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

    const showEditTitleModal = () => {
        const currentDoc = docFiles.find(file => file.key === currentFile);
        form.setFieldsValue({ title: currentDoc?.title });
        setIsEditTitleModalVisible(true);
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
                const config = await window.electronAPI.getGitConfig();
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
            if (USE_IPC) {
                await window.electronAPI.pullFromGit(values);
                message.success('从Git仓库拉取文档成功');
                setIsGitConfigModalVisible(false);
                handleModeChange();
            }
        } catch (error) {
            console.error('从Git拉取文档失败:', error);
            message.error('从Git拉取文档失败');
        }
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
                    left: menuCollapsed ? '80px' : '160px',
                    right: 0,
                    zIndex: 99,
                    transition: 'left 0.2s'
                }}
                bodyStyle={{ padding: 0 }}
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
                        <Button
                            icon={<GithubOutlined />}
                            onClick={() => setIsGitConfigModalVisible(true)}
                        >
                            从 Git 拉取
                        </Button>
                    </Space>
                </div>
            </Card>
            <Layout style={{ 
                background: '#fff',
                marginTop: '57px',
                height: 'calc(100vh - 57px)',
                overflow: 'hidden'
            }}>
                <div style={{
                    width: docListCollapsed ? 0 : 200,
                    overflow: 'hidden',
                    height: '100%',
                    position: 'fixed',
                    left: menuCollapsed ? '80px' : '160px',
                    top: '57px',
                    bottom: 0,
                    zIndex: 98,
                    backgroundColor: '#fff',
                    transition: 'left 0.2s, width 0.3s ease-in-out'
                }}>
                    <Sider 
                        width={200}
                        style={{ 
                            background: '#fff',
                            borderRight: '1px solid #f0f0f0',
                            height: '100%',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{ 
                            padding: '12px',
                            width: 200,
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
                                    onSelect={(selectedKeys) => {
                                        if (selectedKeys.length > 0) {
                                            const key = selectedKeys[0] as string;
                                            const node = findNode(docFiles, key);
                                            if (node && !node.isDirectory) {
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
                                        return <FileOutlined style={{ color: '#666' }} />;
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
                <Content style={{ 
                    padding: '16px',
                    marginLeft: docListCollapsed ? 0 : '200px',
                    transition: 'margin-left 0.3s ease-in-out',
                    height: '100%',
                    overflow: 'auto'
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
                onOk={() => form.submit()}
                onCancel={() => setIsEditTitleModalVisible(false)}
            >
                <Form
                    form={form}
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
        </Layout>
    );
};

export default Doc; 