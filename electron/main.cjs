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
let previewWindow = null;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'ScholasticBase',
    icon: path.join(__dirname, '../public/appicon.png'),
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

// Open dedicated Print Preview Window with interactive preview
async function openPdfPreview(parentWin, pdfPath) {
  if (previewWindow && !previewWindow.isDestroyed()) {
    previewWindow.close();
  }

  previewWindow = new BrowserWindow({
    parent: parentWin || mainWindow,
    modal: false,
    width: 1080,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'ScholasticBase - Print Preview',
    icon: path.join(__dirname, '../public/appicon.png'),
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      plugins: true,
      webSecurity: false,
    },
  });

  const pdfUrl = url.format({
    pathname: pdfPath,
    protocol: 'file:',
    slashes: true,
  });

  const previewHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>ScholasticBase - Print Preview</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #0f172a; height: 100vh; display: flex; flex-direction: column; overflow: hidden; color: #f8fafc; }
        .preview-header { height: 56px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; flex-shrink: 0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15); z-index: 10; }
        .title-box { display: flex; align-items: center; gap: 10px; }
        .title-box h2 { font-size: 15px; font-weight: 600; color: #f1f5f9; }
        .actions { display: flex; align-items: center; gap: 10px; }
        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; }
        .btn-print { background: #059669; color: white; }
        .btn-print:hover { background: #047857; }
        .btn-close { background: #475569; color: white; }
        .btn-close:hover { background: #334155; }
        .viewer-container { flex: 1; width: 100%; height: calc(100vh - 56px); background: #334155; }
        embed, iframe { width: 100%; height: 100%; border: none; }
      </style>
    </head>
    <body>
      <div class="preview-header">
        <div class="title-box">
          <span style="font-size: 18px;">📄</span>
          <h2>ScholasticBase - Print Preview</h2>
        </div>
        <div class="actions">
          <button class="btn btn-print" onclick="window.print()">🖨️ Print Document</button>
          <button class="btn btn-close" onclick="window.close()">✖ Close</button>
        </div>
      </div>
      <div class="viewer-container">
        <embed src="${pdfUrl}#toolbar=1&navpanes=0&view=FitH" type="application/pdf" width="100%" height="100%">
      </div>
    </body>
    </html>
  `;

  await previewWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(previewHtml));

  previewWindow.once('ready-to-show', () => {
    previewWindow.show();
    previewWindow.focus();
  });

  previewWindow.on('closed', () => {
    previewWindow = null;
    // Clean up temporary PDF file after closing preview
    fs.unlink(pdfPath, (err) => {
      if (err && err.code !== 'ENOENT') {
        console.warn('[Electron Main] Temp PDF cleanup notice:', err.message);
      }
    });
  });
}

ipcMain.on('print-window', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (!win) return;

  // If user requested silent direct printing to a specific device
  if (options.silent && options.deviceName) {
    win.webContents.print(
      {
        silent: true,
        deviceName: options.deviceName,
        printBackground: true,
        color: true,
        ...options,
      },
      (success, failureReason) => {
        if (!success) console.warn('[Electron Main] Silent print failed:', failureReason);
      }
    );
    return;
  }

  try {
    // Generate high-resolution PDF for preview & print
    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: options.pageSize || 'A4',
      landscape: options.landscape || false,
      marginsType: 0,
      printSelectionOnly: false,
      ...options,
    });

    const tempDir = app.getPath('temp');
    const pdfPath = path.join(tempDir, `ScholasticBase_Print_${Date.now()}.pdf`);
    await fs.promises.writeFile(pdfPath, pdfData);

    await openPdfPreview(win, pdfPath);
  } catch (err) {
    console.warn('[Electron Main] PDF preview generation fallback to standard print:', err);
    win.webContents.print({
      silent: false,
      printBackground: true,
      color: true,
      margin: { marginType: 'printableArea' },
      ...options,
    });
  }
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

