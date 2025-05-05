import { BatchConfig } from '../components/DataInsertionPanel';

export class IPCService {
  static listenForUpdates(callback: any) {
    window.electronAPI.on('update:status', (data: any) => callback(data));
  }

  static cleanup() {
    window.electronAPI.removeAllListeners('update:status');
  }

  static connectToDatabase(dbConfig: any) {
    try {
      window.electronAPI.send('app:connect', dbConfig);
    } catch (error) {
      console.error('IPC Error:', error);
    }
  }

  static async loadConfig() {
    return await window.electronAPI.invoke('storage:loadConfig', '');
  }

  static start(batchConfig: BatchConfig) {
    window.electronAPI.start('app:start', batchConfig);
  }

  static stop() {
    window.electronAPI.stop('app:stop');
  }
}
