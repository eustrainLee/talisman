import { ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { glob } from 'glob'

interface DocConfig {
  [key: string]: {
    title?: string;
    order?: number;
  };
}

export function setupIpcHandlers(publicPath: string) {
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

      // 使用 glob.sync 替代回调形式
      const files = glob.sync('**/*.md', { cwd: docsPath })
      
      // 读取配置文件
      let config: DocConfig = {}
      const configPath = path.join(docsPath, 'config.json')
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      }

      // 构建文档树
      return [{
        title: config['index.md']?.title || '文档',
        key: '/docs/index.md',
        children: files
          .filter(file => file !== 'index.md')
          .map(file => ({
            title: config[file]?.title || file,
            key: `/docs/${file}`
          }))
          .sort((a, b) => {
            const orderA = config[a.key.slice(6)]?.order || 0
            const orderB = config[b.key.slice(6)]?.order || 0
            return orderA - orderB
          })
      }]
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