const { contextBridge, ipcRenderer } = require('electron');

// Expose secure Electron APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  print: (options = {}) => {
    ipcRenderer.send('print-window', {
      silent: false,
      printBackground: true,
      deviceName: '',
      ...options,
    });
  },
  printToPDF: async (options = {}) => {
    return await ipcRenderer.invoke('print-to-pdf', options);
  },
});
