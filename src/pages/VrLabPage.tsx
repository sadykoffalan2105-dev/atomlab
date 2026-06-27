import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { VrLabLessonPanel } from '../components/vrLab/education/VrLabLessonPanel'
import { VrLabReactionCatalog, reactionIdFromPair } from '../components/vrLab/education/VrLabReactionCatalog'
import { VrLabCanvasShell } from '../components/vrLab/VrLabCanvas'
import { prefetchVrLabPhysics } from '../components/vrLab/VrLabPhysicsWorld'
import { VrLabExperimentParams } from '../components/vrLab/VrLabExperimentParams'
import { VrLabSubstancePicker } from '../components/vrLab/VrLabSubstancePicker'
import { detectVrLabQuality, webglSupported, type VrLabQualityTier } from '../components/vrLab/vrLabPerformance'
import { useGraphicsSettingsOptional } from '../perf/GraphicsSettingsProvider'
import { useVrLabSoundFx } from '../vrLab/useVrLabSoundFx'
import { canAutoMix } from '../vrLab/vrLabAutoMix'
import { readLessonProgress, vrLabLessonSummary } from '../vrLab/lessons/vrLabLessonProgress'
import { vrLabLessonById } from '../vrLab/lessons/vrLabLessonModules'
import { curatedReactionById, type CuratedReactionId } from '../vrLab/reactions/curatedReactions'
import { compoundById } from '../data/compounds'
import { useT, type MessageKey } from '../i18n/useT'
import { VR_LAB_PALETTE } from '../vrLab/colorPalette'
import { vrLabReactionCount } from '../vrLab/mixEngine'
import { useVrLabBench } from '../vrLab/useVrLabBench'
import styles from './VrLabPage.module.css'

const TIER_LABEL: Record<VrLabQualityTier, MessageKey> = {
  high: 'vrLab.stats.tier.high',
  medium: 'vrLab.stats.tier.medium',
  low: 'vrLab.stats.tier.low',
}

export function VrLabPage() {
  const { t } = useT()
  const benchApi = useVrLabBench()
  const {
    state,
    selectShelfFlask,
    selectVat,
    fillSelectedFlask,
    pourSelectedToVat,
    pourFlaskToVat,
    emptyAll,
    emptyShelfFlask,
    emptyVat,
    moveShelfFlask,
    autoMix,
    setActiveLesson,
    setTimeScale,
    setConcentration,
    setExperimentTemperature,
  } = benchApi
  const [searchParams] = useSearchParams()
  const [pickId, setPickId] = useState<string | null>('hcl')
  const [practiceTick, setPracticeTick] = useState(0)
  const [practiceTarget, setPracticeTarget] = useState<{ a: string; b: string } | null>(null)
  const [activeReactionId, setActiveReactionId] = useState<CuratedReactionId | null>(null)

  const lessonIdFromUrl = searchParams.get('lesson')
  const reactionIdFromUrl = searchParams.get('reaction')
  const fromLearn = searchParams.get('from') === 'learn'

  useEffect(() => {
    if (lessonIdFromUrl) setActiveLesson(lessonIdFromUrl)
  }, [lessonIdFromUrl, setActiveLesson])

  useEffect(() => {
    if (!reactionIdFromUrl) return
    const r = curatedReactionById(reactionIdFromUrl as CuratedReactionId)
    if (!r) return
    setActiveLesson(r.lessonId)
    setActiveReactionId(r.id)
    setPracticeTarget({ a: r.a, b: r.b })
    setPickId(r.a)
  }, [reactionIdFromUrl, setActiveLesson])

  const activeLessonId = state.activeLessonId ?? lessonIdFromUrl ?? 'vr-lesson-neutralization'
  const lessonProgress = useMemo(
    () => readLessonProgress(activeLessonId),
    [activeLessonId, practiceTick, state.lastMix],
  )

  const target = state.selectedTarget
  const selectedShelf =
    target?.kind === 'shelf' ? state.shelfFlasks.find((f) => f.id === target.id) : null
  const last = state.lastMix
  const busy = state.animPhase !== 'idle' || state.autoMixFlaskId != null

  const canPourVat = selectedShelf?.content != null && !busy
  const canFillFlask = target?.kind === 'shelf' && !busy
  const canAutoMixNow = canAutoMix(
    state.shelfFlasks,
    state.vatReagentA,
    target?.kind === 'shelf' ? target.id : null,
    busy,
  )

  const [canvasMount, setCanvasMount] = useState(false)
  const [canvasState, setCanvasState] = useState<'loading' | 'ready' | 'error'>('loading')
  const gfx = useGraphicsSettingsOptional()
  const qualityTier = gfx?.vrTier ?? detectVrLabQuality()

  useVrLabSoundFx(state)

  useEffect(() => {
    if (qualityTier === 'high') prefetchVrLabPhysics()
  }, [qualityTier])

  useEffect(() => {
    if (state.lastMix?.kind === 'reaction') setPracticeTick((n) => n + 1)
  }, [state.lastMix])

  useEffect(() => {
    if (lessonProgress.practiceDone) setPracticeTarget(null)
  }, [lessonProgress.practiceDone])

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

  const labSummary = useMemo(
    () => vrLabLessonSummary(),
    [practiceTick, state.lastMix],
  )

  const startReactionPractice = useCallback(
    (lessonId: string, compoundA: string, compoundB: string) => {
      setActiveLesson(lessonId)
      setActiveReactionId(reactionIdFromPair(compoundA, compoundB))
      setPracticeTarget({ a: compoundA, b: compoundB })
      setPickId(compoundA)
      const empty = state.shelfFlasks.find((f) => !f.content)
      if (empty) {
        selectShelfFlask(empty.id)
        requestAnimationFrame(() => fillSelectedFlask(compoundA))
      }
      setPracticeTick((n) => n + 1)
    },
    [fillSelectedFlask, selectShelfFlask, setActiveLesson, state.shelfFlasks],
  )

  const activeLesson = vrLabLessonById(activeLessonId)
  const practiceMissionText = activeLesson
    ? t(activeLesson.practiceMissionKey as MessageKey)
    : ''

  const targetLabel =
    target?.kind === 'vat'
      ? t('vrLab.vat.selected')
      : t('vrLab.shelf.selected', { n: selectedShelf?.label ?? '—' })

  const interactionHint = useMemo((): MessageKey => {
    if (busy) return 'vrLab.hint.busy'
    if (canFillFlask && !selectedShelf?.content) return 'vrLab.hint.fillFromCatalog'
    if (canPourVat) return 'vrLab.hint.pourToVat'
    return 'vrLab.hint.dragAndPour'
  }, [busy, canFillFlask, canPourVat, selectedShelf?.content])

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} to={fromLearn ? '/learn' : '/'}>
            {fromLearn ? t('learn.vrLab.backLearn') : t('vrLab.backLab')}
          </Link>
          <h1 className={styles.h}>{t('vrLab.title')}</h1>
          <p className={styles.lead}>{t('vrLab.lead')}</p>
        </div>
        <div className={styles.meta}>
          <span className={styles.chip}>{t('vrLab.stats.reactions', { n: vrLabReactionCount() })}</span>
          <span className={styles.chip}>{t('vrLab.stats.colors', { n: VR_LAB_PALETTE.length })}</span>
          <span className={styles.chip}>
            {t('vrLab.stats.curated', {
              done: labSummary.reactionsDone,
              total: labSummary.reactionTotal,
            })}
          </span>
          <span className={styles.chip}>{t(TIER_LABEL[qualityTier])}</span>
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
        {practiceTarget && !lessonProgress.practiceDone ? (
          <div className={styles.practiceBanner} aria-live="polite">
            {t('vrLab.lesson.practiceActive', { mission: practiceMissionText })}
          </div>
        ) : null}
        {canvasState === 'ready' ? (
          <div className={styles.interactionBanner} aria-live="polite">
            {t(interactionHint)}
          </div>
        ) : null}
        <VrLabCanvasShell
          mount={canvasMount && canvasState !== 'error'}
          bench={state}
          practiceTarget={practiceTarget}
          onSelectShelfFlask={selectShelfFlask}
          onSelectVat={selectVat}
          onMoveShelfFlask={moveShelfFlask}
          onPourFlaskToVat={pourFlaskToVat}
          onReady={onCanvasReady}
          onFail={onCanvasFail}
        />
      </div>

      <aside className={styles.side}>
        <div className={styles.controls}>
          <p className={styles.controlsTitle}>{targetLabel}</p>
          <p className={styles.controlsHint}>{t('vrLab.controlsHint')}</p>
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
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!canAutoMixNow}
              onClick={autoMix}
            >
              {t('vrLab.action.autoMix')}
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

        <VrLabLessonPanel
          activeLessonId={activeLessonId}
          focusReactionId={activeReactionId}
          practiceCompounds={practiceTarget}
          onSelectLesson={setActiveLesson}
          practiceDone={lessonProgress.practiceDone}
          onStartPractice={startReactionPractice}
        />

        <VrLabReactionCatalog onTryReaction={startReactionPractice} />

        <VrLabExperimentParams
          timeScale={state.timeScale}
          concentration={state.concentration}
          experimentTemperature={state.experimentTemperature}
          onTimeScale={setTimeScale}
          onConcentration={setConcentration}
          onTemperature={setExperimentTemperature}
        />

        <div className={styles.pickerWrap}>
          <VrLabSubstancePicker
            selectedCompoundId={pickId}
            onSelect={(id) => {
              setPickId(id)
              if (canFillFlask && target?.kind === 'shelf') {
                fillSelectedFlask(id)
              }
            }}
          />
        </div>
      </aside>
    </div>
  )
}
