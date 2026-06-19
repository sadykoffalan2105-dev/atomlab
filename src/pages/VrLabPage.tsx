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
  const {
    state,
    selectShelfFlask,
    selectVat,
    fillSelectedFlask,
    pourSelectedToVat,
    emptyAll,
    emptyShelfFlask,
    emptyVat,
    moveShelfFlask,
  } = benchApi
  const [pickId, setPickId] = useState<string | null>('hcl')

  const target = state.selectedTarget
  const selectedShelf =
    target?.kind === 'shelf' ? state.shelfFlasks.find((f) => f.id === target.id) : null
  const last = state.lastMix
  const busy = state.animPhase !== 'idle'

  const canPourVat = selectedShelf?.content != null && !busy
  const canFillFlask = target?.kind === 'shelf' && !busy

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

  const targetLabel =
    target?.kind === 'vat'
      ? t('vrLab.vat.selected')
      : t('vrLab.shelf.selected', { n: selectedShelf?.label ?? '—' })

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
          onSelectShelfFlask={selectShelfFlask}
          onSelectVat={selectVat}
          onMoveShelfFlask={moveShelfFlask}
          onReady={onCanvasReady}
          onFail={onCanvasFail}
        />
      </div>

      <aside className={styles.side}>
        <div className={styles.controls}>
          <p className={styles.controlsTitle}>{targetLabel}</p>
          <p className={styles.dragHint}>{t('vrLab.shelf.dragHint')}</p>

          {state.vatReagentA ? (
            <p className={styles.vatHint}>
              {t('vrLab.vat.waitSecond', {
                formula:
                  compoundById[state.vatReagentA.compoundId]?.formulaUnicode ??
                  state.vatReagentA.compoundId,
              })}
            </p>
          ) : null}

          <p className={styles.sectionLabel}>{t('vrLab.section.shelf')}</p>
          <div className={styles.shelfRow}>
            {state.shelfFlasks.map((flask) => (
              <button
                key={flask.id}
                type="button"
                className={
                  target?.kind === 'shelf' && target.id === flask.id ? styles.shelfBtnOn : styles.shelfBtn
                }
                onClick={() => selectShelfFlask(flask.id)}
                title={flask.onShelf ? t('vrLab.shelf.onWall') : t('vrLab.shelf.onBench')}
              >
                {flask.label}
                {flask.content
                  ? ` · ${compoundById[flask.content.compoundId]?.formulaUnicode ?? '?'}`
                  : ''}
              </button>
            ))}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!pickId || !canFillFlask}
              onClick={() => pickId && fillSelectedFlask(pickId)}
            >
              {t('vrLab.action.pourShelf')}
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!canPourVat}
              onClick={pourSelectedToVat}
            >
              {t('vrLab.action.pourVat')}
            </button>
            <button type="button" className={styles.btn} disabled={busy} onClick={selectVat}>
              {t('vrLab.action.selectVat')}
            </button>
            <button
              type="button"
              className={styles.btn}
              disabled={!target || busy}
              onClick={() => {
                if (target?.kind === 'shelf') emptyShelfFlask(target.id)
                else emptyVat()
              }}
            >
              {target?.kind === 'vat' ? t('vrLab.action.emptyVat') : t('vrLab.action.emptyShelf')}
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
