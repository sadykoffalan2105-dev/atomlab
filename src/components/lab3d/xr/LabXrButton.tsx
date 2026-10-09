/**
 * Кнопка «Войти в VR» в тулбаре видов. Прячется, если WebXR нет или immersive-vr не поддерживается
 * (кроме эмуляции …?xrEmulate=1). Нажатие — вход в сессию (xrSession.enterXr), повторное — выход.
 */
import { useEffect, useState } from 'react'
import type { LabLang } from '../labContract'
import { useT } from '../../../i18n/useT'
import { labXr, useXrState } from './labXrStore'
import { enterXr, exitXr, xrEmulateRequested } from './xrSession'

export function LabXrButton({ lang, className }: { lang: LabLang; className?: string }) {
  const { t } = useT()
  const st = useXrState()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    const xr = typeof navigator !== 'undefined' ? navigator.xr : undefined
    if (!xr) return
    xr.isSessionSupported('immersive-vr')
      .then((ok) => {
        if (alive) labXr.set({ supported: ok })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  if (!st.supported && !xrEmulateRequested()) return null
  const label = failed ? t('lab3d.xr.unsupported') : st.presenting ? t('lab3d.xr.exit') : t('lab3d.xr.enter')
  return (
    <button
      type="button"
      className={className}
      lang={lang}
      data-lab3d-xr-button
      aria-pressed={st.presenting}
      disabled={busy}
      onClick={() => {
        setBusy(true)
        setFailed(false)
        const job = st.presenting ? exitXr() : enterXr().then((ok) => setFailed(!ok))
        job
          .catch((err: unknown) => {
            console.warn('[xr] вход в VR не удался', err)
            setFailed(true)
          })
          .finally(() => setBusy(false))
      }}
    >
      {label}
    </button>
  )
}
