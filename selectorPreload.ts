const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('selectorAPI', {
  send: (channel: string, data: any) => {
    ipcRenderer.send(channel, data);
  },
  receive: (channel: string, func: (...args: any[]) => void) => {
    const listener = (event: Electron.IpcRendererEvent, ...args: any[]) => func(...args);
    ipcRenderer.on(channel, listener);
    // Optional: return a cleanup function if needed, though for this simple case it might be overkill
    // return () => ipcRenderer.removeListener(channel, listener);
  }
});
