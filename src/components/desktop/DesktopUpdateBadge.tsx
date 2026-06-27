import { useCallback, useEffect, useState } from 'react'
import {
  getAtomlabDesktop,
  isAtomlabDesktop,
  type AtomlabUpdateStatus,
  type AtomlabVersionInfo,
} from '../../electronBridge.types'
import styles from './DesktopUpdateBadge.module.css'

/** Компактный индикатор версии + ручная проверка обновлений (Electron). */
export function DesktopUpdateBadge() {
  const [version, setVersion] = useState<string | null>(null)
  const [status, setStatus] = useState<AtomlabUpdateStatus | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!isAtomlabDesktop()) return
    const api = getAtomlabDesktop()
    if (!api) return

    void api.getVersion().then((info: AtomlabVersionInfo) => setVersion(info.version))
    void api.getUpdateStatus().then((s: AtomlabUpdateStatus) => setStatus(s))

    return api.onUpdateStatus((next: AtomlabUpdateStatus) => setStatus(next))
  }, [])

  const onCheck = useCallback(async () => {
    const api = getAtomlabDesktop()
    if (!api) return
    setChecking(true)
    try {
      const next = await api.checkForUpdates()
      setStatus(next)
    } finally {
      setChecking(false)
    }
  }, [])

  const onInstall = useCallback(async () => {
    const api = getAtomlabDesktop()
    if (!api) return
    await api.installUpdate()
  }, [])

  if (!isAtomlabDesktop() || !version) return null

  const label =
    status?.state === 'downloaded'
      ? `v${version} · обновление готово`
      : status?.state === 'downloading'
        ? `v${version} · загрузка…`
        : status?.state === 'available'
          ? `v${version} · новая версия`
          : `v${version}`

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.badge}
        onClick={onCheck}
        disabled={checking}
        title="Проверить обновления ATOMLAB"
      >
        {checking ? '…' : label}
      </button>
      {status?.state === 'downloaded' ? (
        <button type="button" className={styles.install} onClick={onInstall}>
          Перезапустить
        </button>
      ) : null}
    </div>
  )
}
