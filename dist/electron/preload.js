"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    getSystemInfo: () => electron_1.ipcRenderer.invoke('get-system-info'),
    readFileSync: (filePath) => electron_1.ipcRenderer.invoke('read-file', filePath),
    writeFileSync: (filePath, data) => electron_1.ipcRenderer.invoke('write-file', filePath, data),
    execCommand: (command, timeout) => electron_1.ipcRenderer.invoke('exec-command', command, timeout),
    getAppPath: () => electron_1.ipcRenderer.invoke('get-app-path'),
    isDev: () => electron_1.ipcRenderer.invoke('is-dev'),
    platform: process.platform,
});
//# sourceMappingURL=preload.js.map