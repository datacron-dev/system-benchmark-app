interface ElectronAPI {
  getSystemInfo: () => Promise<Record<string, unknown>>;
  readFileSync: (filePath: string) => Promise<string>;
  writeFileSync: (filePath: string, data: string) => Promise<void>;
  execCommand: (command: string, timeout?: number) => Promise<{ stdout: string; stderr: string }>;
  getAppPath: () => Promise<string>;
  isDev: () => Promise<boolean>;
  platform: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
