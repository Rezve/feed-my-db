import { contextBridge, ipcRenderer } from 'electron';
import { BatchConfig } from '../renderer/components/DataInsertionPanel';

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, data: any) => {
    const validChannels = ['storage:loadConfig', 'app:start', 'app:version'];

    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    throw new Error(`Invalid channel: ${channel}`);
  },
  on: (channel: string, callback: any) => {
    const validChannels = [
      'app:status',
      'app:log',
      'app:progress',
      'app:complete',
      'app:connect:result',
      'app:code:result',
      'app:fetch-tables:result',
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  start: (channel: string, batchConfig: BatchConfig) =>
    ipcRenderer.send(channel, batchConfig),
  stop: (channel: string) => ipcRenderer.send(channel),
  send: (channel: string, data: any) => {
    const validChannels = [
      'window:minimize',
      'window:maximize',
      'window:close',
      'app:code',
      'app:connect',
    ];

    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
});
