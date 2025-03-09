import React, { useState, useEffect } from 'react';
import { Card, Space, Layout, Tree, message, Modal, Input, Form } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import MarkNav from 'markdown-navbar';
import 'markdown-navbar/dist/navbar.css';
import { MdEditor } from 'md-editor-rt';
import 'md-editor-rt/lib/style.css';
import { API_BASE_URL, USE_IPC } from './config';

const { Sider, Content } = Layout;

interface CodeProps {
    node?: any;
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
    [key: string]: any;
}

interface DocFile {
    title: string;
    key: string;
    children?: DocFile[];
}

const Doc: React.FC = () => {
    const [markdown, setMarkdown] = useState('');
    const [isPreview, setIsPreview] = useState(true);
    const [currentFile, setCurrentFile] = useState('/docs/index.md');
    const [docFiles, setDocFiles] = useState<DocFile[]>([]);
    const [isEditTitleModalVisible, setIsEditTitleModalVisible] = useState(false);
    const [docListCollapsed, setDocListCollapsed] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        loadMarkdownFile(currentFile);
        loadDocList();
    }, [currentFile]);

    const loadDocList = async () => {
        try {
            if (USE_IPC) {
                const files = await window.electronAPI.getDocList();
                setDocFiles(files);
            } else {
                const response = await fetch(`${API_BASE_URL}/api/docs/list`);
                if (!response.ok) {
                    throw new Error('获取文档列表失败');
                }
                const files = await response.json();
                setDocFiles(files);
            }
        } catch (error) {
            console.error('获取文档列表失败:', error);
            message.error('获取文档列表失败');
            setDocFiles([
                {
                    title: '文档',
                    key: '/docs/index.md',
                    children: []
                }
            ]);
        }
    };

    const loadMarkdownFile = async (path: string) => {
        try {
            if (USE_IPC) {
                const text = await window.electronAPI.getDocContent(path);
                setMarkdown(text);
            } else {
                const response = await fetch(`${API_BASE_URL}${path}`);
                if (!response.ok) {
                    throw new Error('文件加载失败');
                }
                const text = await response.text();
                setMarkdown(text);
            }
        } catch (error) {
            console.error('加载文档失败:', error);
            message.error('文档加载失败');
        }
    };

    const saveMarkdown = async () => {
        try {
            if (USE_IPC) {
                await window.electronAPI.saveDoc(currentFile, markdown);
                message.success('保存成功');
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
            }
        } catch (error) {
            console.error('保存失败:', error);
            message.error('保存失败');
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isPreview && markdown) {
                saveMarkdown();
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, [markdown, isPreview]);

    const updateDocConfig = async (values: { title: string }) => {
        try {
            if (USE_IPC) {
                await window.electronAPI.updateDocConfig(currentFile, values.title);
                message.success('更新成功');
                loadDocList();
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
                loadDocList();
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

    return (
        <Layout style={{ background: '#fff', height: '100%', margin: '-24px -16px' }}>
            <Sider 
                width={docListCollapsed ? 0 : 160}
                style={{ 
                    background: '#fff',
                    borderRight: '1px solid #f0f0f0',
                    position: 'fixed',
                    height: '100vh',
                    left: docListCollapsed ? -160 : 80,
                    top: 0,
                    overflowY: 'auto',
                    transition: 'all 0.2s'
                }}
            >
                <div style={{ 
                    padding: '20px',
                    display: docListCollapsed ? 'none' : 'block'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px'
                    }}>
                        <h3 style={{ margin: 0 }}>文档列表</h3>
                        <MenuFoldOutlined 
                            onClick={() => setDocListCollapsed(true)}
                            style={{ 
                                cursor: 'pointer',
                                fontSize: '16px',
                                padding: '8px',
                                margin: '-8px'
                            }}
                        />
                    </div>
                    <Tree
                        defaultSelectedKeys={['/docs/index.md']}
                        defaultExpandAll
                        onSelect={(selectedKeys) => {
                            if (selectedKeys.length > 0) {
                                if (!isPreview && markdown) {
                                    saveMarkdown().then(() => {
                                        setCurrentFile(selectedKeys[0] as string);
                                    });
                                } else {
                                    setCurrentFile(selectedKeys[0] as string);
                                }
                            }
                        }}
                        treeData={docFiles}
                    />
                </div>
            </Sider>
            <Layout style={{ 
                marginLeft: docListCollapsed ? 0 : 160,
                transition: 'margin-left 0.2s',
                background: '#fff'
            }}>
                {docListCollapsed && (
                    <div style={{
                        position: 'fixed',
                        left: 80,
                        top: 0,
                        padding: '8px 12px',
                        background: '#fff',
                        borderRadius: '0 4px 4px 0',
                        boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
                        cursor: 'pointer',
                        zIndex: 100,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }} onClick={() => setDocListCollapsed(false)}>
                        <MenuUnfoldOutlined />
                        <span>文档列表</span>
                    </div>
                )}
                <Content style={{ 
                    padding: '24px', 
                    minHeight: 'calc(100vh - 64px)',
                    overflow: 'initial'
                }}>
                    {isPreview ? (
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Card 
                                title="文档预览" 
                                extra={
                                    <Space>
                                        <a onClick={showEditTitleModal}>修改标题</a>
                                        <a onClick={() => setIsPreview(false)}>切换到编辑模式</a>
                                    </Space>
                                }
                            >
                                <Layout>
                                    <Content style={{ padding: '0 24px' }}>
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeRaw]}
                                            components={{
                                                code: ({ inline, className, children, ...props }: CodeProps) => {
                                                    const match = /language-(\w+)/.exec(className || '');
                                                    return !inline && match ? (
                                                        <SyntaxHighlighter
                                                            style={vscDarkPlus}
                                                            language={match[1]}
                                                            PreTag="div"
                                                            {...props}
                                                        >
                                                            {String(children).replace(/\n$/, '')}
                                                        </SyntaxHighlighter>
                                                    ) : (
                                                        <code className={className} {...props}>
                                                            {children}
                                                        </code>
                                                    );
                                                }
                                            }}
                                        >
                                            {markdown}
                                        </ReactMarkdown>
                                    </Content>
                                    <Sider 
                                        width={160} 
                                        style={{ 
                                            background: '#fff',
                                            padding: '20px',
                                            borderLeft: '1px solid #f0f0f0'
                                        }}
                                    >
                                        <div style={{ position: 'sticky', top: 84 }}>
                                            <h3>目录</h3>
                                            <MarkNav
                                                className="article-menu"
                                                source={markdown}
                                                ordered={false}
                                            />
                                        </div>
                                    </Sider>
                                </Layout>
                            </Card>
                        </Space>
                    ) : (
                        <Card 
                            title="文档编辑" 
                            extra={
                                <Space>
                                    <a onClick={saveMarkdown}>保存</a>
                                    <a onClick={showEditTitleModal}>修改标题</a>
                                    <a onClick={() => setIsPreview(true)}>切换到预览模式</a>
                                </Space>
                            }
                        >
                            <MdEditor
                                modelValue={markdown}
                                onChange={setMarkdown}
                                style={{ height: 'calc(100vh - 200px)' }}
                            />
                        </Card>
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
        </Layout>
    );
};

export default Doc; 