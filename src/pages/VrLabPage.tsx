import { useState } from 'react'
import { Link } from 'react-router-dom'
import { VrLabCanvas } from '../components/vrLab/VrLabCanvas'
import { VrLabSubstancePicker } from '../components/vrLab/VrLabSubstancePicker'
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
        <VrLabCanvas bench={state} onSelectTube={selectTube} />
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
