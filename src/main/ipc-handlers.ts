import { app, BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import { DataGeneratorManager } from './data-generator.manager';
import { loadConfig } from './storage';

function registerHandlers(mainWindow: BrowserWindow) {
  ipcMain.handle('storage:loadConfig', async () => {
    return await loadConfig();
  });

  ipcMain.handle('app:version', async () => {
    return app.getVersion();
  });

  ipcMain.on('app:connect', (event, dbConfig) => {
    DataGeneratorManager.connectToDatabaseAndSaveConfig(
      mainWindow,
      event,
      dbConfig,
    );
  });

  ipcMain.on('app:start', (event, batchConfig) => {
    DataGeneratorManager.start(mainWindow, batchConfig);
  });

  ipcMain.on('app:stop', () => {
    DataGeneratorManager.stop(mainWindow);
  });

  ipcMain.on('app:code', (event, code) => {
    DataGeneratorManager.setDataSchemaEditorPanel(mainWindow, code);
  });

  ipcMain.on('window:minimize', () => mainWindow.minimize());
  ipcMain.on('window:maximize', () =>
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(),
  );
  ipcMain.on('window:close', () => mainWindow.close());
}

export { registerHandlers };
