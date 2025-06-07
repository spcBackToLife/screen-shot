import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, data: any) => ipcRenderer.send(channel, data),
  receive: (channel: string, func: (...args: any[]) => void) => {
    // Deliberately strip event as it includes `sender`
    const safeFunc = (...args: any[]) => func(...args);
    ipcRenderer.on(channel, (event: Electron.IpcRendererEvent, ...args: any[]) => safeFunc(...args));
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector: string, text: string | undefined) => {
    const element = document.getElementById(selector);
    if (element && text) element.innerText = text;
  };

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type as keyof NodeJS.ProcessVersions]);
  }
});
