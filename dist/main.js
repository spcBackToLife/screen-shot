"use strict";
const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, nativeImage, globalShortcut } = require('electron'); // Add dialog
const fs = require('fs'); // Add fs
const path = require('path');
let mainWindow; // Keep a reference to the main window
let selectorWindow;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });
    if (mainWindow) {
        mainWindow.loadFile('index.html');
    }
    // mainWindow.webContents.openDevTools(); // Optional: for debugging
}
app.whenReady().then(() => {
    createWindow();
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
    // Register global shortcut
    const ret = globalShortcut.register('CommandOrControl+Shift+S', () => {
        console.log('Global shortcut CommandOrControl+Shift+S pressed');
        initiateScreenshotSelectionProcess(); // Call the refactored function
    });
    if (!ret) {
        console.error('Failed to register global shortcut CommandOrControl+Shift+S');
    }
});
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin')
        app.quit();
});
// Unregister shortcuts on quit
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
//ipcMain.on('take-screenshot', async (event: Electron.IpcMainEvent) => {
//  console.log('Main process received take-screenshot');
//  try {
//    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: {width: 1920, height: 1080} });
//
//    if (sources.length > 0) {
//      // For now, let's pick the first screen.
//      // In a real app, you might want to let the user choose.
//      const primaryScreen = sources.find((source: Electron.DesktopCapturerSource) => source.display_id) || sources[0]; // Attempt to find primary, fallback to first
//      const dataURL = primaryScreen.thumbnail.toDataURL();
//      console.log('Screenshot captured, sending to renderer.');
//      if (mainWindow) {
//        mainWindow.webContents.send('screenshot-captured', dataURL);
//      }
//    } else {
//      console.error('No screen sources found.');
//      if (mainWindow) {
//        mainWindow.webContents.send('screenshot-captured', null); // Send null or an error message
//      }
//    }
//  } catch (e: any) {
//    console.error('Error capturing screenshot:', e);
//    if (mainWindow) {
//        mainWindow.webContents.send('screenshot-captured', null); // Send null or an error message
//    }
//  }
//});
// ... (existing ipcMain.on for 'take-screenshot')
ipcMain.on('toggle-pin', () => {
    if (mainWindow) {
        const currentState = mainWindow.isAlwaysOnTop();
        mainWindow.setAlwaysOnTop(!currentState);
        console.log(`Window alwaysOnTop set to: ${!currentState}`);
    }
});
// ... (existing IPC handlers)
ipcMain.on('save-screenshot', async (event, dataURL) => {
    if (!dataURL || !dataURL.startsWith('data:image')) {
        console.error('Invalid dataURL received for saving.');
        // Optionally send a response back to renderer: event.sender.send('save-failed', 'Invalid image data');
        return;
    }
    console.log('Main process received save-screenshot');
    if (!mainWindow) {
        console.error('Main window not available for save dialog.');
        return;
    }
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Screenshot',
        defaultPath: `screenshot-${Date.now()}.png`,
        filters: [
            { name: 'PNG Images', extensions: ['png'] },
            { name: 'JPEG Images', extensions: ['jpg', 'jpeg'] }
        ]
    });
    if (filePath) {
        // Data URL is like: "data:image/png;base64,iVBORw0KGgoAA..."
        // We need to remove the "data:image/png;base64," part and then decode.
        const base64Data = dataURL.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFile(filePath, buffer, (err) => {
            if (err) {
                console.error('Failed to save screenshot:', err);
                // Optionally send a response back: event.sender.send('save-failed', err.message);
            }
            else {
                console.log('Screenshot saved to:', filePath);
                // Optionally send a response back: event.sender.send('save-succeeded', filePath);
            }
        });
    }
    else {
        console.log('Save dialog cancelled by user.');
    }
});
let fullScreenShotImage = null;
async function initiateScreenshotSelectionProcess(event) {
    console.log('Initiating screenshot selection process...');
    try {
        const sources = await desktopCapturer.getSources({ types: ['screen'], fetchWindowIcons: false });
        if (sources.length === 0) {
            console.error('No screen sources found for selector.');
            if (event)
                event.reply('screenshot-captured', null); // Or some error signal
            else if (mainWindow)
                mainWindow.webContents.send('screenshot-captured', null);
            return;
        }
        const primarySource = sources.find((s) => s.display_id) || sources[0];
        const display = require('electron').screen.getPrimaryDisplay();
        if (!mainWindow || mainWindow.isDestroyed()) {
            console.error("Main window not available for capture.");
            if (event)
                event.reply('screenshot-captured', null);
            return;
        }
        if (mainWindow.isMinimized())
            mainWindow.restore();
        // await new Promise(resolve => setTimeout(resolve, 100)); // e.g., 100ms
        fullScreenShotImage = await mainWindow.webContents.capturePage();
        if (mainWindow && !selectorWindow) {
            mainWindow.hide();
        }
        selectorWindow = new BrowserWindow({
            x: display.bounds.x,
            y: display.bounds.y,
            width: display.bounds.width,
            height: display.bounds.height,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            webPreferences: {
                preload: path.join(__dirname, 'selectorPreload.js'),
                contextIsolation: true,
                nodeIntegration: false,
            },
            skipTaskbar: true,
        });
        const backgroundImageDataUrl = fullScreenShotImage.toDataURL();
        if (selectorWindow) {
            selectorWindow.loadFile(path.join(__dirname, 'selector.html'));
            selectorWindow.webContents.on('did-finish-load', () => {
                if (selectorWindow) {
                    selectorWindow.webContents.send('set-background', backgroundImageDataUrl, display.scaleFactor);
                }
            });
            selectorWindow.on('closed', () => {
                selectorWindow = null;
                if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
                    // mainWindow.show(); // Reconsider auto-showing
                }
            });
        }
    }
    catch (e) {
        console.error('Error opening selector window:', e);
        if (event && event.sender) {
            event.sender.send('screenshot-captured', null);
        }
        else if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('screenshot-captured', null);
            if (!mainWindow.isVisible())
                mainWindow.show();
        }
    }
}
ipcMain.on('open-selector-window', (event) => {
    initiateScreenshotSelectionProcess(event);
});
ipcMain.on('region-selected', async (event, region) => {
    console.log('Main process received region-selected:', region);
    if (selectorWindow) {
        selectorWindow.close();
        selectorWindow = null;
    }
    try {
        // Adjust region coordinates by scaleFactor for high-DPI displays
        // The region from renderer is in logical pixels. We need physical for capture.
        const physicalRegion = {
            x: Math.floor(region.x * region.scaleFactor),
            y: Math.floor(region.y * region.scaleFactor),
            width: Math.floor(region.width * region.scaleFactor),
            height: Math.floor(region.height * region.scaleFactor),
        };
        // Now capture only the selected region
        // This is tricky with desktopCapturer alone. It captures whole screens/windows.
        // The common way is to take a full screenshot and crop it.
        // We already have `fullScreenShotImage`
        if (!fullScreenShotImage) {
            throw new Error("Full screenshot was not taken or available for cropping.");
        }
        // Crop the full screenshot image
        // Ensure physicalRegion values are integers and within bounds
        const croppedImage = fullScreenShotImage.crop({
            x: physicalRegion.x,
            y: physicalRegion.y,
            width: physicalRegion.width,
            height: physicalRegion.height,
        });
        if (croppedImage.isEmpty()) {
            console.error("Cropped image is empty. Region might be outside bounds or invalid.");
            throw new Error("Cropped image is empty.");
        }
        const dataURL = croppedImage.toDataURL();
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('screenshot-captured', dataURL);
            if (!mainWindow.isVisible())
                mainWindow.show();
        }
    }
    catch (e) {
        console.error('Error processing selected region:', e);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('screenshot-captured', null);
            if (!mainWindow.isVisible())
                mainWindow.show();
        }
    }
});
ipcMain.on('selection-cancelled', () => {
    console.log('Main process received selection-cancelled');
    if (selectorWindow) {
        selectorWindow.close();
        selectorWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        mainWindow.show();
    }
    // Optionally send a message to renderer if needed, or just do nothing for screenshot
});
//# sourceMappingURL=main.js.map