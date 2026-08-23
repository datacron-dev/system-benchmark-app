"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
let mainWindow = null;
let nextJsProcess = null;
function getStandalonePath() {
    if (electron_1.app.isPackaged) {
        const candidates = [
            path.join(process.resourcesPath, 'standalone'),
            path.join(electron_1.app.getAppPath(), 'standalone'),
        ];
        for (const p of candidates) {
            if (fs.existsSync(path.join(p, 'server.js')))
                return p;
        }
        return null;
    }
    const projectRoot = path.resolve(__dirname, '..');
    const standalone = path.join(projectRoot, '.next', 'standalone');
    return fs.existsSync(path.join(standalone, 'server.js')) ? standalone : null;
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        title: 'System Benchmark App',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    if (process.env.ELECTRON_MODE === 'dev') {
        mainWindow.loadURL('http://localhost:8585');
    }
    else {
        const standalone = getStandalonePath();
        if (!standalone) {
            console.error('Next.js standalone output not found. Run `next build` first.');
            electron_1.app.quit();
            return;
        }
        const port = process.env.NEXT_SERVER_PORT || '3000';
        const dbPath = path.join(electron_1.app.getPath('userData'), 'benchmarks.db');
        nextJsProcess = (0, child_process_1.spawn)('node', ['server.js'], {
            cwd: standalone,
            env: {
                ...process.env,
                PORT: port,
                DATABASE_URL: `file:${dbPath}`,
            },
            stdio: 'inherit',
        });
        nextJsProcess.on('error', (err) => {
            console.error('Failed to start Next.js standalone server:', err);
        });
        nextJsProcess.on('exit', (code) => {
            console.log(`Next.js standalone server exited with code ${code}`);
            if (mainWindow)
                mainWindow.close();
        });
        mainWindow.loadURL(`http://127.0.0.1:${port}`);
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// IPC: system utilities accessible from renderer via preload
electron_1.ipcMain.handle('get-system-info', async () => {
    const si = require('systeminformation');
    const os = require('os');
    const cpuInfo = await si.currentLoad();
    const mem = await si.mem();
    return {
        cpuPercent: Math.round((cpuInfo.currentLoad ?? 0) * 10) / 10,
        ramTotal: Math.round(mem.total / (1024 ** 3)),
        ramUsed: Math.round((mem.total - mem.available) / (1024 ** 3)),
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
    };
});
electron_1.ipcMain.handle('read-file', (_event, filePath) => {
    return fs.readFileSync(filePath, 'utf-8');
});
electron_1.ipcMain.handle('write-file', (_event, filePath, data) => {
    fs.writeFileSync(filePath, data, 'utf-8');
});
electron_1.ipcMain.handle('exec-command', async (_event, command, timeout = 10000) => {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    try {
        const { stdout, stderr } = await execAsync(command, { timeout });
        return { stdout, stderr };
    }
    catch (e) {
        return { stdout: '', stderr: e.message };
    }
});
electron_1.ipcMain.handle('get-app-path', () => electron_1.app.getPath('userData'));
electron_1.ipcMain.handle('is-dev', () => process.env.ELECTRON_MODE === 'dev');
electron_1.app.whenReady().then(() => {
    if (!electron_1.app.isPackaged && process.env.ELECTRON_MODE !== 'dev') {
        const standalone = getStandalonePath();
        if (!standalone) {
            console.error('Next.js standalone output not found. Run `next build` first.');
            electron_1.app.quit();
            return;
        }
    }
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (nextJsProcess)
        nextJsProcess.kill();
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('will-quit', () => {
    if (nextJsProcess)
        nextJsProcess.kill();
});
//# sourceMappingURL=main.js.map