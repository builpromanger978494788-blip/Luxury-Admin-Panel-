const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

// Catch any unhandled errors and show them in a popup instead of crashing silently
process.on('uncaughtException', (error) => {
  dialog.showErrorBox('Application Error', `An unexpected error occurred:\n\n${error.message}\n\n${error.stack}`);
});

// Start the existing Express server
const server = require('./server.js');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false
    },
    autoHideMenuBar: true, // Hides the default File/Edit menu
    show: false
  });

  // Load the Express server URL dynamically
  const loadUI = () => {
    try {
      const address = server.address();
      if (!address) {
        throw new Error("Server failed to start or address is null.");
      }
      const port = address.port;
      mainWindow.loadURL(`http://localhost:${port}`);
      mainWindow.once('ready-to-show', () => {
        mainWindow.show();
      });
    } catch (err) {
      dialog.showErrorBox("Server Error", `Failed to load UI: ${err.message}`);
    }
  };

  if (server.listening) {
    loadUI();
  } else {
    server.on('listening', loadUI);
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  // Quit the app completely when all windows are closed
  if (process.platform !== 'darwin') app.quit();
});
