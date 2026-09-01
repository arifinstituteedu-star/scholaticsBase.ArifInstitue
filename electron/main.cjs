const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

// Disable Windows 11 Modern XAML Print Dialog bugs and force classic/stable printer subsystem
app.commandLine.appendSwitch('disable-features', 'PrintJobManagementApp,Win11ModernPrintDialog,PrintCompositorLPAC');
app.commandLine.appendSwitch('disable-print-preview');

// Ensure Windows uses the 100% stable classic Win32 print dialog
if (process.platform === 'win32') {
  try {
    const { exec } = require('child_process');
    exec('reg add "HKCU\\Software\\Microsoft\\Print\\UnifiedPrintDialog" /v "PreferLegacyPrintDialog" /t REG_DWORD /d 1 /f', (err) => {
      if (err) console.warn('[Registry Setup] Notice:', err.message);
    });
  } catch (e) {
    // Ignore
  }
}

// Keep a global reference of windows to avoid garbage collection
let mainWindow;

function createWindow() {
  const iconPath = process.platform === 'win32' && fs.existsSync(path.join(__dirname, '../public/appicon.ico'))
    ? path.join(__dirname, '../public/appicon.ico')
    : path.join(__dirname, '../public/appicon.png');

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'ScholasticBase',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      plugins: true, // Enable PDF and embed plugins
      preload: path.join(__dirname, 'preload.cjs'),
    },
    backgroundColor: '#064E3B',
    show: false, // Don't show until ready to avoid white flash
  });

  // Load the built React app from the dist folder
  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadURL(
    url.format({
      pathname: indexPath,
      protocol: 'file:',
      slashes: true,
    })
  );

  // Show window once the content is ready (avoids white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    if (openUrl.startsWith('http') || openUrl.startsWith('https')) {
      shell.openExternal(openUrl);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─────────────────────────────────────────────────────────────
// IPC PRINT HANDLERS FOR ELECTRON DESKTOP EXECUTABLE
// ─────────────────────────────────────────────────────────────

ipcMain.on('print-window', (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (!win) return;

  const printOptions = {
    silent: options.silent || false,
    printBackground: options.printBackground !== undefined ? options.printBackground : true,
    color: options.color !== undefined ? options.color : true,
    pageSize: options.pageSize || 'A4',
    landscape: options.landscape || false,
    margins: {
      marginType: 'printableArea',
    },
    ...options,
  };

  win.webContents.print(printOptions, (success, failureReason) => {
    if (!success && failureReason && failureReason !== 'cancelled' && failureReason !== 'user initiated cancel') {
      console.warn('[Electron Print] Print job status:', failureReason);
    }
  });
});

// Return list of available system printers
ipcMain.handle('get-printers', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (!win) return [];
  try {
    return await win.webContents.getPrintersAsync();
  } catch (err) {
    console.error('[Electron Main] Failed to get printers:', err);
    return [];
  }
});

// Direct print to printer or system dialog
ipcMain.handle('print-direct', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (!win) return { success: false, error: 'No window available' };

  return new Promise((resolve) => {
    win.webContents.print(
      {
        silent: options.silent || false,
        printBackground: true,
        color: true,
        deviceName: options.deviceName || '',
        ...options,
      },
      (success, failureReason) => {
        resolve({ success, error: failureReason });
      }
    );
  });
});

ipcMain.handle('print-to-pdf', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (!win) throw new Error('No window available for PDF export');

  const pdfOptions = {
    marginsType: 0,
    printBackground: true,
    printSelectionOnly: false,
    landscape: false,
    pageSize: 'A4',
    ...options,
  };

  try {
    const data = await win.webContents.printToPDF(pdfOptions);
    return data;
  } catch (err) {
    console.error('[Electron Main] Failed to generate PDF:', err);
    throw err;
  }
});

// Build custom application menu
function buildMenu() {
  const template = [
    {
      label: 'ScholasticBase',
      submenu: [
        { label: 'About ScholasticBase', role: 'about' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Print Document...',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.print({ silent: false, printBackground: true });
            }
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App lifecycle hooks
app.whenReady().then(() => {
  buildMenu();
  createWindow();

  // On macOS, re-create the window when the dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

