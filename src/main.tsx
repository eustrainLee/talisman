import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { IpcRendererEvent } from 'electron'
// import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Use contextBridge
window.electronAPI.on('main-process-message', (event: IpcRendererEvent, message: string) => {
  console.log(message)
})
