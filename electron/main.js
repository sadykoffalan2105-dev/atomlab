import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const APP_DIST_DIR = path.join(__dirname, '..', 'dist')
const INDEX_HTML = path.join(APP_DIST_DIR, 'index.html')

app.setName('ATOMLAB')

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

/** @type {BrowserWindow | null} */
let mainWindow = null

function createWindow() {
  const win = new BrowserWindow({
    title: 'ATOMLAB',
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#03040a',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow = win

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (VITE_DEV_SERVER_URL) return
    if (!url.startsWith('file://')) {
      event.preventDefault()
      return
    }
    const normalized = url.replace(/\\/g, '/').toLowerCase()
    const indexNorm = `file:///${INDEX_HTML.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase()}`
    if (!normalized.startsWith(indexNorm.split('#')[0])) {
      event.preventDefault()
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(INDEX_HTML)
  }

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
}

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('second-instance', () => {
    if (!mainWindow) {
      createWindow()
      return
    }
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
