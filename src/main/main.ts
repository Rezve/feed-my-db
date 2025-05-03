import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerHandlers } from './ipc-handlers';
import { resolveHtmlPath } from '../renderer/utils/path';

function createWindow(): void {
  const mainWindow: BrowserWindow = new BrowserWindow({
    show: false,
    frame: false,
    backgroundColor: '#f3f4f6',
    webPreferences: {
      nodeIntegration: false, // Disable direct Node.js access in renderer
      contextIsolation: true, // Enable context isolation for security
      sandbox: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  registerHandlers(mainWindow);

  mainWindow.loadURL(resolveHtmlPath('index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'Reason:', reason);
});
