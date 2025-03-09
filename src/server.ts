import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

interface DocConfig {
    docs: {
        [key: string]: {
            title: string;
            order?: number;
        };
    };
}

// 读取配置文件
async function loadConfig(): Promise<DocConfig> {
    try {
        const configPath = path.join(__dirname, '../public/docs/config.json');
        const configContent = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(configContent);
    } catch (error) {
        console.error('加载配置文件失败:', error);
        return { docs: {} };
    }
}

// 允许跨域请求
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// 解析 JSON 请求体
app.use(express.json());

// 静态文件服务
app.use('/docs', express.static(path.join(__dirname, '../public/docs')));

// 递归获取目录下的所有 markdown 文件
async function getMarkdownFiles(dir: string, config: DocConfig): Promise<any[]> {
    const files = await fs.readdir(dir);
    const result = [];

    for (const file of files) {
        if (file === 'config.json') continue; // 跳过配置文件

        const fullPath = path.join(dir, file);
        const stat = await fs.stat(fullPath);
        const relativePath = fullPath.replace(path.join(__dirname, '../public'), '').replace(/\\/g, '/');

        if (stat.isDirectory()) {
            const children = await getMarkdownFiles(fullPath, config);
            if (children.length > 0) {
                result.push({
                    title: file,
                    key: relativePath,
                    children: children.sort((a, b) => {
                        const orderA = config.docs[a.key]?.order || 999;
                        const orderB = config.docs[b.key]?.order || 999;
                        return orderA - orderB;
                    })
                });
            }
        } else if (file.endsWith('.md')) {
            result.push({
                title: config.docs[relativePath]?.title || file.replace('.md', ''),
                key: relativePath
            });
        }
    }

    return result;
}

// API 路由
app.get('/api/docs/list', async (req, res) => {
    try {
        const config = await loadConfig();
        const docsPath = path.join(__dirname, '../public/docs');
        const files = await getMarkdownFiles(docsPath, config);
        
        // 根据配置的 order 排序
        const sortedFiles = files.sort((a, b) => {
            const orderA = config.docs[a.key]?.order || 999;
            const orderB = config.docs[b.key]?.order || 999;
            return orderA - orderB;
        });

        res.json(sortedFiles);
    } catch (error) {
        console.error('Error reading docs directory:', error);
        res.status(500).json({ error: 'Failed to read docs directory' });
    }
});

// 保存 Markdown 文件
app.post('/api/docs/save', async (req, res) => {
    try {
        const { path: filePath, content } = req.body;
        if (!filePath || !content) {
            return res.status(400).json({ error: '文件路径和内容不能为空' });
        }

        const absolutePath = path.join(__dirname, '../public', filePath);
        
        // 确保文件在 public/docs 目录下
        if (!absolutePath.startsWith(path.join(__dirname, '../public/docs'))) {
            return res.status(403).json({ error: '不允许在 docs 目录外保存文件' });
        }

        await fs.writeFile(absolutePath, content, 'utf-8');
        res.json({ success: true });
    } catch (error) {
        console.error('保存文件失败:', error);
        res.status(500).json({ error: '保存文件失败' });
    }
});

// 更新文档配置
app.post('/api/docs/config', async (req, res) => {
    try {
        const { path: filePath, title, order } = req.body;
        const configPath = path.join(__dirname, '../public/docs/config.json');
        const config = await loadConfig();

        config.docs[filePath] = {
            title: title || config.docs[filePath]?.title,
            order: order ?? config.docs[filePath]?.order
        };

        await fs.writeFile(configPath, JSON.stringify(config, null, 4), 'utf-8');
        res.json({ success: true });
    } catch (error) {
        console.error('更新配置失败:', error);
        res.status(500).json({ error: '更新配置失败' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}); 