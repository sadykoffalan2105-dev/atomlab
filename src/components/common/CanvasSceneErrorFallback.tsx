import { useT } from '../../i18n/useT'

/** Fallback для CanvasErrorBoundary (нужен хук useT). */
export function CanvasSceneErrorFallback() {
  const { t } = useT()
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: 12,
        borderRadius: 12,
        color: 'rgba(220,228,255,0.92)',
        background: 'rgba(8,10,26,0.92)',
        border: '1px solid rgba(61,255,236,0.22)',
        textAlign: 'center',
        boxSizing: 'border-box',
      }}
    >
      {t('canvas.sceneFallback')}
    </div>
  )
}
