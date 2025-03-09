import { ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { glob } from 'glob'
import simpleGit from 'simple-git'

interface DocConfig {
  [key: string]: {
    title?: string;
    order?: number;
  };
}

interface DocNode {
  title: string;
  key: string;
  isDirectory?: boolean;
  children?: DocNode[];
}

interface GitConfig {
  repoUrl: string;
  branch: string;
  docPath: string;
}

function buildDocTree(files: string[], docsPath: string, config: DocConfig): DocNode[] {
  const tree: DocNode[] = [];
  const dirMap = new Map<string, DocNode>();

  // 首先创建所有目录节点
  files.forEach(file => {
    const parts = file.split('/');
    let currentPath = '';

    // 处理每一级目录
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!dirMap.has(currentPath)) {
        const node: DocNode = {
          title: config[currentPath]?.title || part,
          key: `/docs/${currentPath}`,
          isDirectory: true,
          children: []
        };
        dirMap.set(currentPath, node);

        if (parentPath) {
          const parentNode = dirMap.get(parentPath);
          parentNode?.children?.push(node);
        } else {
          tree.push(node);
        }
      }
    }
  });

  // 然后添加文件节点
  files.forEach(file => {
    const parts = file.split('/');
    const fileName = parts[parts.length - 1];
    const dirPath = parts.slice(0, -1).join('/');
    
    const node: DocNode = {
      title: config[file]?.title || fileName,
      key: `/docs/${file}`,
      isDirectory: false
    };

    if (dirPath) {
      const dirNode = dirMap.get(dirPath);
      dirNode?.children?.push(node);
    } else {
      tree.push(node);
    }
  });

  // 对每个目录中的内容进行排序
  const sortNodes = (nodes: DocNode[]) => {
    nodes.sort((a, b) => {
      // 目录优先
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      // 同类型按照配置的顺序排序
      const orderA = config[a.key.slice(6)]?.order || 0;
      const orderB = config[b.key.slice(6)]?.order || 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      // 最后按标题字母顺序排序
      return a.title.localeCompare(b.title);
    });
    // 递归排序子目录
    nodes.forEach(node => {
      if (node.children) {
        sortNodes(node.children);
      }
    });
  };
  sortNodes(tree);

  return tree;
}

export function setupIpcHandlers(publicPath: string) {
  const git = simpleGit();
  const gitConfigPath = path.join(publicPath, 'docs', 'git-config.json');

  // 从远程仓库拉取文档
  ipcMain.handle('doc:pull-from-git', async (event, config: GitConfig) => {
    try {
      const docsPath = path.join(publicPath, 'docs');
      const tempPath = path.join(publicPath, 'temp-git');
      
      // 保存 Git 配置
      fs.writeFileSync(gitConfigPath, JSON.stringify(config, null, 2), 'utf-8');

      // 清理临时目录
      if (fs.existsSync(tempPath)) {
        fs.rmSync(tempPath, { recursive: true, force: true });
      }
      fs.mkdirSync(tempPath);

      // 克隆仓库
      await git.clone(config.repoUrl, tempPath);
      await git.cwd(tempPath);
      await git.checkout(config.branch);

      // 指定的文档目录
      const sourceDocPath = path.join(tempPath, config.docPath);
      if (!fs.existsSync(sourceDocPath)) {
        throw new Error('指定的文档目录不存在');
      }

      // 复制文档文件
      const files = glob.sync('**/*.{md,json}', { cwd: sourceDocPath });
      files.forEach(file => {
        const sourcePath = path.join(sourceDocPath, file);
        const targetPath = path.join(docsPath, file);
        
        // 确保目标目录存在
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(sourcePath, targetPath);
      });

      // 清理临时目录
      fs.rmSync(tempPath, { recursive: true, force: true });

      return { success: true };
    } catch (error) {
      console.error('从Git拉取文档失败:', error);
      throw error;
    }
  });

  // 获取 Git 配置
  ipcMain.handle('doc:get-git-config', async () => {
    try {
      if (fs.existsSync(gitConfigPath)) {
        const config = JSON.parse(fs.readFileSync(gitConfigPath, 'utf-8'));
        return config;
      }
      return null;
    } catch (error) {
      console.error('获取Git配置失败:', error);
      throw error;
    }
  });

  // 获取文档列表
  ipcMain.handle('doc:list', async () => {
    try {
      const docsPath = path.join(publicPath, 'docs')
      
      // 确保 docs 目录存在
      if (!fs.existsSync(docsPath)) {
        fs.mkdirSync(docsPath, { recursive: true })
        // 创建默认的 index.md
        const indexPath = path.join(docsPath, 'index.md')
        if (!fs.existsSync(indexPath)) {
          fs.writeFileSync(indexPath, '# 欢迎使用 Talisman\n\n这是您的第一个文档。', 'utf-8')
        }
      }

      // 获取所有目录
      const dirs = glob.sync('**/', { cwd: docsPath }).map(dir => dir.slice(0, -1));
      
      // 获取所有 markdown 文件
      const files = glob.sync('**/*.md', { cwd: docsPath })
      
      // 读取配置文件
      let config: DocConfig = {}
      const configPath = path.join(docsPath, 'config.json')
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      }

      // 构建文档树
      const tree: DocNode[] = [];
      const dirMap = new Map<string, DocNode>();

      // 首先创建所有目录节点
      dirs.forEach(dir => {
        const parts = dir.split('/');
        let currentPath = '';

        // 处理每一级目录
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          const parentPath = currentPath;
          currentPath = currentPath ? `${currentPath}/${part}` : part;

          if (!dirMap.has(currentPath)) {
            const node: DocNode = {
              title: config[currentPath]?.title || part,
              key: `/docs/${currentPath}`,
              isDirectory: true,
              children: []
            };
            dirMap.set(currentPath, node);

            if (parentPath) {
              const parentNode = dirMap.get(parentPath);
              parentNode?.children?.push(node);
            } else {
              tree.push(node);
            }
          }
        }
      });

      // 然后添加文件节点
      files.forEach(file => {
        const parts = file.split('/');
        const fileName = parts[parts.length - 1];
        const dirPath = parts.slice(0, -1).join('/');
        
        const node: DocNode = {
          title: config[file]?.title || fileName,
          key: `/docs/${file}`,
          isDirectory: false
        };

        if (dirPath) {
          const dirNode = dirMap.get(dirPath);
          dirNode?.children?.push(node);
        } else {
          tree.push(node);
        }
      });

      // 对每个目录中的内容进行排序
      const sortNodes = (nodes: DocNode[]) => {
        nodes.sort((a, b) => {
          // 目录优先
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          // 同类型按照配置的顺序排序
          const orderA = config[a.key.slice(6)]?.order || 0;
          const orderB = config[b.key.slice(6)]?.order || 0;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          // 最后按标题字母顺序排序
          return a.title.localeCompare(b.title);
        });
        // 递归排序子目录
        nodes.forEach(node => {
          if (node.children) {
            sortNodes(node.children);
          }
        });
      };
      sortNodes(tree);

      return tree;
    } catch (error) {
      console.error('获取文档列表失败:', error)
      throw error
    }
  })

  // 获取文档内容
  ipcMain.handle('doc:get', async (event, docPath) => {
    try {
      const fullPath = path.join(publicPath, docPath)
      
      if (!fs.existsSync(fullPath)) {
        throw new Error('文档不存在')
      }

      return fs.readFileSync(fullPath, 'utf-8')
    } catch (error) {
      console.error('读取文档失败:', error)
      throw error
    }
  })

  // 保存文档
  ipcMain.handle('doc:save', async (event, docPath, content) => {
    try {
      const fullPath = path.join(publicPath, docPath)
      
      // 确保目录存在
      const dir = path.dirname(fullPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.writeFileSync(fullPath, content, 'utf-8')
    } catch (error) {
      console.error('保存文档失败:', error)
      throw error
    }
  })

  // 更新文档配置
  ipcMain.handle('doc:config', async (event, docPath, title) => {
    try {
      const configPath = path.join(publicPath, 'docs', 'config.json')
      
      // 确保 docs 目录存在
      const docsDir = path.join(publicPath, 'docs')
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true })
      }

      let config: DocConfig = {}
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      }

      const relativePath = docPath.replace('/docs/', '')
      config[relativePath] = {
        ...(config[relativePath] || {}),
        title
      }

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    } catch (error) {
      console.error('更新配置失败:', error)
      throw error
    }
  })
} 