import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import './index.css'
import { IpcRendererEvent } from 'electron'

// 设置 IPC 监听器
if (window.electronAPI) {
  window.electronAPI.on('main-process-message', (_event: IpcRendererEvent, message: string) => {
    console.log('[Receive Main-process message]:', message)
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <HashRouter>
        <App />
      </HashRouter>
    </ConfigProvider>
  </React.StrictMode>,
)
