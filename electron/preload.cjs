const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rwWindow', {
  minimize: () => ipcRenderer.send('win:minimize'),
  toggleMaximize: () => ipcRenderer.send('win:toggle-maximize'),
  close: () => ipcRenderer.send('win:close'),
  getAutoLaunch: () => ipcRenderer.invoke('app:get-auto-launch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('app:set-auto-launch', enabled),
  getCloseToTray: () => ipcRenderer.invoke('app:get-close-to-tray'),
  setCloseToTray: (enabled) => ipcRenderer.invoke('app:set-close-to-tray', enabled),
});
