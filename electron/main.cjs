/**
 * ATOMLAB — Electron main process.
 * Оптимизация под Three.js / WebGL / VR: GPU rasterization, без throttling фона.
 */
const {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  Menu,
} = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('node:path')
const fs = require('node:fs')

const isDev = !app.isPackaged
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'

/** GitHub Releases — автообновление (electron-updater). */
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowDowngrade = false

let mainWindow = null
/** Последний статус обновления для renderer. */
let lastUpdateStatus = { state: 'idle', info: null, error: null }

// ── GPU / WebGL ─────────────────────────────────────────────────────────────
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch(
  'enable-features',
  'CanvasOopRasterization,Vulkan,UseSkiaRenderer',
)
// Не отключаем hardware acceleration — критично для Three.js.
if (process.env.ATOMLAB_DISABLE_HW_ACCEL === '1') {
  app.disableHardwareAcceleration()
}

function sendUpdateStatus(payload) {
  lastUpdateStatus = payload
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('atomlab:update-status', payload)
  }
}

function distIndexPath() {
  return path.join(__dirname, '..', 'dist', 'index.html')
}

function loadProduction(window) {
  const indexHtml = distIndexPath()
  if (!fs.existsSync(indexHtml)) {
    dialog.showErrorBox(
      'ATOMLAB',
      'Не найден dist/index.html.\nСначала выполните: npm run build:electron',
    )
    app.quit()
    return
  }
  window.loadFile(indexHtml)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'ATOMLAB',
    show: false,
    fullscreen: true,
    backgroundColor: '#0a0c18',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webgl: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
    if (!mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(true)
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isDev) return
    const filePrefix = 'file://'
    if (!url.startsWith(filePrefix)) {
      event.preventDefault()
    }
  })

  if (isDev) {
    mainWindow.loadURL(DEV_URL)
    if (process.env.ATOMLAB_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    loadProduction(mainWindow)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function buildAppMenu() {
  const template = [
    {
      label: 'ATOMLAB',
      submenu: [
        {
          label: 'Проверить обновления…',
          click: () => checkForUpdates(true),
        },
        { type: 'separator' },
        {
          label: 'О программе',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'ATOMLAB',
              message: `ATOMLAB v${app.getVersion()}`,
              detail:
                'Виртуальная химическая лаборатория (7–11 класс).\n\nF11 — полноэкранный режим\nEsc — выход из полноэкранного режима',
            })
          },
        },
        { role: 'quit', label: 'Выход' },
      ],
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'togglefullscreen', label: 'Полный экран' },
        { role: 'reload', label: 'Перезагрузить' },
        { role: 'forceReload', label: 'Жёсткая перезагрузка' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function wireAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus({ state: 'checking', info: null, error: null })
  })

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus({ state: 'available', info, error: null })
  })

  autoUpdater.on('update-not-available', (info) => {
    sendUpdateStatus({ state: 'not-available', info, error: null })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus({ state: 'downloading', info: progress, error: null })
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({ state: 'downloaded', info, error: null })
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'ATOMLAB — обновление',
        message: `Версия ${info.version} загружена.`,
        detail: 'Перезапустить приложение сейчас?',
        buttons: ['Перезапустить', 'Позже'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall(false, true)
        }
      })
  })

  autoUpdater.on('error', (error) => {
    sendUpdateStatus({
      state: 'error',
      info: null,
      error: error?.message || String(error),
    })
  })
}

function checkForUpdates(manual = false) {
  if (isDev) {
    if (manual) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'ATOMLAB',
        message: 'Режим разработки',
        detail: 'Автообновление работает только в собранном .exe.',
      })
    }
    return
  }
  autoUpdater.checkForUpdates().catch((err) => {
    if (manual) {
      dialog.showErrorBox('ATOMLAB — обновление', err?.message || String(err))
    }
  })
}

function registerIpc() {
  ipcMain.handle('atomlab:get-version', () => ({
    version: app.getVersion(),
    name: app.getName(),
    isPackaged: app.isPackaged,
    platform: process.platform,
  }))

  ipcMain.handle('atomlab:check-updates', async () => {
    if (isDev) {
      return { state: 'dev', info: null, error: null }
    }
    try {
      await autoUpdater.checkForUpdates()
      return lastUpdateStatus
    } catch (error) {
      return {
        state: 'error',
        info: null,
        error: error?.message || String(error),
      }
    }
  })

  ipcMain.handle('atomlab:get-update-status', () => lastUpdateStatus)

  ipcMain.handle('atomlab:install-update', () => {
    if (lastUpdateStatus.state === 'downloaded') {
      autoUpdater.quitAndInstall(false, true)
      return true
    }
    return false
  })

  ipcMain.handle('atomlab:toggle-fullscreen', () => {
    if (!mainWindow) return false
    mainWindow.setFullScreen(!mainWindow.isFullScreen())
    return mainWindow.isFullScreen()
  })
}

// ── App lifecycle ───────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    buildAppMenu()
    wireAutoUpdater()
    registerIpc()
    createWindow()

    if (!isDev) {
      setTimeout(() => checkForUpdates(false), 4000)
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
