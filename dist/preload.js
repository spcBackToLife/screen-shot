"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, data) => electron_1.ipcRenderer.send(channel, data),
    receive: (channel, func) => {
        // Deliberately strip event as it includes `sender`
        const safeFunc = (...args) => func(...args);
        electron_1.ipcRenderer.on(channel, (event, ...args) => safeFunc(...args));
    }
});
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element && text)
            element.innerText = text;
    };
    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type]);
    }
});
//# sourceMappingURL=preload.js.map