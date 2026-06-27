/**
 * Preload — безопасный мост renderer ↔ main (contextIsolation).
 */
const { contextBridge, ipcRenderer } = require('electron')

/** @type {import('../src/electronBridge.types').AtomlabDesktopApi} */
const api = {
  getVersion: () => ipcRenderer.invoke('atomlab:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('atomlab:check-updates'),
  getUpdateStatus: () => ipcRenderer.invoke('atomlab:get-update-status'),
  installUpdate: () => ipcRenderer.invoke('atomlab:install-update'),
  toggleFullscreen: () => ipcRenderer.invoke('atomlab:toggle-fullscreen'),
  reloadApp: () => ipcRenderer.invoke('atomlab:reload-app'),
  synthesizeTeacherTts: (text, locale) =>
    ipcRenderer.invoke('atomlab:synthesize-teacher-tts', { text, locale }),
  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('atomlab:update-status', listener)
    return () => ipcRenderer.removeListener('atomlab:update-status', listener)
  },
  isDesktop: true,
}

contextBridge.exposeInMainWorld('atomlabDesktop', api)
