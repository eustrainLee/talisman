import { defineConfig } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import renderer from 'vite-plugin-electron-renderer'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3'],
              output: {
                format: 'cjs',
              }
            }
          }
        }
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3'],
            }
          }
        }
      },
      // Ployfill the Electron and Node.js API for Renderer process.
      // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer: process.env.NODE_ENV === 'test'
        // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
        ? undefined
        : {},
    }),
    renderer(),
    copyConfigFiles()
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/docs': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
})

function copyConfigFiles() {
  return {
    name: 'copy-config-files',
    closeBundle() {
      const configDir = path.join('dist', 'config')
      fs.mkdirSync(configDir, { recursive: true })
      
      const defaultConfig = {
        path: {
          local: path.join('data', 'docs'),
          remote: path.join('data', 'remote_docs')
        }
      }
      
      fs.writeFileSync(
        path.join(configDir, 'doc.json'),
        JSON.stringify(defaultConfig, null, 2)
      )
    }
  }
}
