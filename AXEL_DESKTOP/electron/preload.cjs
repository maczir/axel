const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('axel', {
  saveFile: async ({ data, defaultPath, filters }) => {
    return ipcRenderer.invoke('axel:saveFile', { data, defaultPath, filters });
  }
});
