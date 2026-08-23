import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let nextJsProcess: ReturnType<typeof spawn> | null = null;

function getStandalonePath(): string | null {
  if (app.isPackaged) {
    const candidates = [
      path.join(process.resourcesPath, 'standalone'),
      path.join(app.getAppPath(), 'standalone'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(path.join(p, 'server.js'))) return p;
    }
    return null;
  }

  const projectRoot = path.resolve(__dirname, '..');
  const standalone = path.join(projectRoot, '.next', 'standalone');
  return fs.existsSync(path.join(standalone, 'server.js')) ? standalone : null;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
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
  } else {
    const standalone = getStandalonePath();
    if (!standalone) {
      console.error('Next.js standalone output not found. Run `next build` first.');
      app.quit();
      return;
    }

    const port = process.env.NEXT_SERVER_PORT || '3000';
    const dbPath = path.join(app.getPath('userData'), 'benchmarks.db');

    nextJsProcess = spawn('node', ['server.js'], {
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
      if (mainWindow) mainWindow.close();
    });

    mainWindow.loadURL(`http://127.0.0.1:${port}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: system utilities accessible from renderer via preload
ipcMain.handle('get-system-info', async () => {
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

ipcMain.handle('read-file', (_event, filePath: string) => {
  return fs.readFileSync(filePath, 'utf-8');
});

ipcMain.handle('write-file', (_event, filePath: string, data: string) => {
  fs.writeFileSync(filePath, data, 'utf-8');
});

ipcMain.handle('exec-command', async (_event, command: string, timeout = 10000) => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  try {
    const { stdout, stderr } = await execAsync(command, { timeout });
    return { stdout, stderr };
  } catch (e: any) {
    return { stdout: '', stderr: e.message };
  }
});

ipcMain.handle('get-app-path', () => app.getPath('userData'));

ipcMain.handle('is-dev', () => process.env.ELECTRON_MODE === 'dev');

app.whenReady().then(() => {
  if (!app.isPackaged && process.env.ELECTRON_MODE !== 'dev') {
    const standalone = getStandalonePath();
    if (!standalone) {
      console.error('Next.js standalone output not found. Run `next build` first.');
      app.quit();
      return;
    }
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (nextJsProcess) nextJsProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (nextJsProcess) nextJsProcess.kill();
});
