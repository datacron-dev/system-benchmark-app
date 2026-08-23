import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  readFileSync: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  writeFileSync: (filePath: string, data: string) =>
    ipcRenderer.invoke('write-file', filePath, data),
  execCommand: (command: string, timeout?: number) =>
    ipcRenderer.invoke('exec-command', command, timeout),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  isDev: () => ipcRenderer.invoke('is-dev'),
  platform: process.platform,
});
