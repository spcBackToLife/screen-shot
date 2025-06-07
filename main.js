const { app, BrowserWindow, ipcMain, desktopCapturer, dialog } = require('electron'); // Add dialog
const fs = require('fs'); // Add fs
const path = require('path');

let mainWindow; // Keep a reference to the main window

function createWindow () {
  mainWindow = new BrowserWindow({ // Assign to mainWindow
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  // mainWindow.webContents.openDevTools(); // Optional: for debugging
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('take-screenshot', async (event) => {
  console.log('Main process received take-screenshot');
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: {width: 1920, height: 1080} });

    if (sources.length > 0) {
      // For now, let's pick the first screen.
      // In a real app, you might want to let the user choose.
      const primaryScreen = sources.find(source => source.display_id) || sources[0]; // Attempt to find primary, fallback to first
      const dataURL = primaryScreen.thumbnail.toDataURL();
      console.log('Screenshot captured, sending to renderer.');
      mainWindow.webContents.send('screenshot-captured', dataURL);
    } else {
      console.error('No screen sources found.');
      mainWindow.webContents.send('screenshot-captured', null); // Send null or an error message
    }
  } catch (e) {
    console.error('Error capturing screenshot:', e);
    if (mainWindow) {
        mainWindow.webContents.send('screenshot-captured', null); // Send null or an error message
    }
  }
});

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
      } else {
        console.log('Screenshot saved to:', filePath);
        // Optionally send a response back: event.sender.send('save-succeeded', filePath);
      }
    });
  } else {
    console.log('Save dialog cancelled by user.');
  }
});
