"use strict";
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('selectorAPI', {
    send: (channel, data) => {
        ipcRenderer.send(channel, data);
    },
    receive: (channel, func) => {
        const listener = (event, ...args) => func(...args);
        ipcRenderer.on(channel, listener);
        // Optional: return a cleanup function if needed, though for this simple case it might be overkill
        // return () => ipcRenderer.removeListener(channel, listener);
    }
});
//# sourceMappingURL=selectorPreload.js.map