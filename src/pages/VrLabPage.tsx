import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { VrLabCanvasShell } from '../components/vrLab/VrLabCanvas'
import { VrLabSubstancePicker } from '../components/vrLab/VrLabSubstancePicker'
import { webglSupported } from '../components/vrLab/vrLabPerformance'
import { compoundById } from '../data/compounds'
import { useT, type MessageKey } from '../i18n/useT'
import { VR_LAB_PALETTE } from '../vrLab/colorPalette'
import { vrLabReactionCount } from '../vrLab/mixEngine'
import { useVrLabBench } from '../vrLab/useVrLabBench'
import styles from './VrLabPage.module.css'

export function VrLabPage() {
  const { t } = useT()
  const benchApi = useVrLabBench()
  const { state, selectTube, fillSelectedTube, emptyAll, mixSelectedPair, emptyTube } = benchApi
  const [pickId, setPickId] = useState<string | null>('hcl')

  const selectedTube = state.tubes.find((tube) => tube.id === state.selectedTubeId)
  const last = state.lastMix
  const busy = state.animPhase !== 'idle'

  const [canvasMount, setCanvasMount] = useState(false)
  const [canvasState, setCanvasState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!webglSupported()) {
      setCanvasState('error')
      return
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setCanvasMount(true))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const onCanvasReady = useCallback(() => setCanvasState('ready'), [])
  const onCanvasFail = useCallback(() => setCanvasState('error'), [])

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} to="/">
            {t('vrLab.backLab')}
          </Link>
          <h1 className={styles.h}>{t('vrLab.title')}</h1>
          <p className={styles.lead}>{t('vrLab.lead')}</p>
        </div>
        <div className={styles.meta}>
          <span className={styles.chip}>{t('vrLab.stats.reactions', { n: vrLabReactionCount() })}</span>
          <span className={styles.chip}>{t('vrLab.stats.colors', { n: VR_LAB_PALETTE.length })}</span>
        </div>
      </header>

      <div className={styles.canvasWrap}>
        {canvasState !== 'ready' ? (
          <div className={styles.canvasOverlay} aria-live="polite">
            {canvasState === 'error' ? (
              <p className={styles.canvasError}>
                3D-сцена недоступна. Обновите страницу или откройте в другом браузере с поддержкой WebGL.
              </p>
            ) : (
              <p className={styles.canvasLoader}>Загрузка лаборатории…</p>
            )}
          </div>
        ) : null}
        <VrLabCanvasShell
          mount={canvasMount && canvasState !== 'error'}
          bench={state}
          onSelectTube={selectTube}
          onReady={onCanvasReady}
          onFail={onCanvasFail}
        />
      </div>

      <aside className={styles.side}>
        <div className={styles.controls}>
          <p className={styles.controlsTitle}>
            {t('vrLab.tube.selected', { n: selectedTube?.label ?? '—' })}
          </p>
          <div className={styles.tubeRow}>
            {state.tubes.map((tube) => (
              <button
                key={tube.id}
                type="button"
                className={state.selectedTubeId === tube.id ? styles.tubeBtnOn : styles.tubeBtn}
                onClick={() => selectTube(tube.id)}
              >
                {tube.label}
                {tube.content
                  ? ` · ${compoundById[tube.content.compoundId]?.formulaUnicode ?? '?'}`
                  : ''}
              </button>
            ))}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!pickId || busy}
              onClick={() => pickId && fillSelectedTube(pickId)}
            >
              {t('vrLab.action.pour')}
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={busy}
              onClick={mixSelectedPair}
            >
              {t('vrLab.action.mix')}
            </button>
            <button
              type="button"
              className={styles.btn}
              disabled={!state.selectedTubeId}
              onClick={() => state.selectedTubeId && emptyTube(state.selectedTubeId)}
            >
              {t('vrLab.action.emptyTube')}
            </button>
            <button type="button" className={styles.btn} onClick={emptyAll}>
              {t('vrLab.action.empty')}
            </button>
          </div>

          <div className={styles.result}>
            <strong>{t('vrLab.result.title')}</strong>
            {last?.equationUnicode ? (
              <>
                <p className={styles.resultEq}>{last.equationUnicode}</p>
                <p className={styles.resultMsg}>{t(last.messageKey as MessageKey)}</p>
              </>
            ) : (
              <p className={styles.resultMsg}>{t('vrLab.result.none')}</p>
            )}
          </div>
        </div>

        <div className={styles.pickerWrap}>
          <VrLabSubstancePicker
            selectedCompoundId={pickId}
            onSelect={(id) => {
              setPickId(id)
            }}
          />
        </div>
      </aside>
    </div>
  )
}
