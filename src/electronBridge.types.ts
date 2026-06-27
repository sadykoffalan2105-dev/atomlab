/** Статус автообновления (electron-updater). */
export type AtomlabUpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'dev'

export type AtomlabUpdateStatus = {
  state: AtomlabUpdateState
  info: unknown
  error: string | null
}

export type AtomlabVersionInfo = {
  version: string
  name: string
  isPackaged: boolean
  platform: string
}

export type AtomlabDesktopApi = {
  isDesktop: true
  getVersion: () => Promise<AtomlabVersionInfo>
  checkForUpdates: () => Promise<AtomlabUpdateStatus>
  getUpdateStatus: () => Promise<AtomlabUpdateStatus>
  installUpdate: () => Promise<boolean>
  toggleFullscreen: () => Promise<boolean>
  reloadApp: () => Promise<boolean>
  synthesizeTeacherTts: (
    text: string,
    locale: 'ru' | 'en',
  ) => Promise<{ audioBase64: string; mimeType: string } | null>
  onUpdateStatus: (callback: (status: AtomlabUpdateStatus) => void) => () => void
}

declare global {
  interface Window {
    atomlabDesktop?: AtomlabDesktopApi
  }
}

export function isAtomlabDesktop(): boolean {
  return typeof window !== 'undefined' && window.atomlabDesktop?.isDesktop === true
}

export function getAtomlabDesktop(): AtomlabDesktopApi | null {
  return window.atomlabDesktop ?? null
}
