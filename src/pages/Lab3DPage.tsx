/**
 * Новая 3D-лаборатория (маршрут /vr-lab): светлая реалистичная школьная лаборатория без VR-очков —
 * мышь на компьютере, пальцы на телефоне/планшете/интерактивной доске. Опыты из Kimyo 7 (§ 2.12 и практическое § 5.2).
 * Состояние опыта (LabRunState) живёт здесь; ?exp=<id> в адресе выбирает опыт.
 */
import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LAB_EXPERIMENTS } from '../components/lab3d/experiments'
import type { LabExperimentId, LabLang, LabRunState } from '../components/lab3d/labContract'
import { createLabSceneBridge } from '../components/lab3d/scene/labBridge'
import type { LabViewId } from '../components/lab3d/scene/labSceneLayout'
import { detectVrLabQuality, webglSupported } from '../components/vrLab/vrLabPerformance'
import { useT, type MessageKey } from '../i18n/useT'
import styles from './Lab3DPage.module.css'

const Lab3DCanvas = lazy(() => import('../components/lab3d/scene/Lab3DCanvas'))

const EXPERIMENT_IDS: readonly LabExperimentId[] = ['baso4', 'ch4-burn', 'zn-hcl', 'h2-practical']
/** Уравнения по учебнику — запасной вариант, пока часть «опыты» не отдала свои описания. */
const FALLBACK_EQUATION: Readonly<Record<LabExperimentId, string>> = {
  baso4: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl',
  'ch4-burn': 'CH₄ + 2O₂ → CO₂ + 2H₂O',
  'zn-hcl': 'Zn + 2HCl → ZnCl₂ + H₂↑',
  'h2-practical': 'Zn + 2HCl → ZnCl₂ + H₂↑',
}
const KIND: Readonly<Record<LabExperimentId, 'exchange' | 'combustion' | 'substitution'>> = {
  baso4: 'exchange',
  'ch4-burn': 'combustion',
  'zn-hcl': 'substitution',
  'h2-practical': 'substitution',
}
const VIEWS: ReadonlyArray<{ id: LabViewId; key: MessageKey }> = [
  { id: 'desk', key: 'lab3d.view.desk' },
  { id: 'board', key: 'lab3d.view.board' },
  { id: 'shelves', key: 'lab3d.view.shelves' },
  { id: 'hood', key: 'lab3d.view.hood' },
]

function isExperimentId(v: string | null): v is LabExperimentId {
  return !!v && (EXPERIMENT_IDS as readonly string[]).includes(v)
}

function resolveQuality(): 'low' | 'high' {
  if (typeof window === 'undefined') return 'high'
  try {
    const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('q')
    if (q === 'low' || q === 'high') return q
  } catch {
    /* адрес без параметров */
  }
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const small = Math.min(window.innerWidth, window.innerHeight) < 700
  if (coarse && small) return 'low'
  return detectVrLabQuality() === 'high' ? 'high' : 'low'
}

export function Lab3DPage() {
  const { t, locale } = useT()
  const lang: LabLang = locale
  const [params, setParams] = useSearchParams()
  const expFromUrl = params.get('exp')
  const urlExperiment: LabExperimentId = isExperimentId(expFromUrl) ? expFromUrl : 'baso4'

  const [run, setRun] = useState<LabRunState>({ experimentId: urlExperiment, step: 0 })
  // Адрес сменился (назад/вперёд в браузере) — опыт начинается сначала
  if (run.experimentId !== urlExperiment) setRun({ experimentId: urlExperiment, step: 0 })

  const [view, setView] = useState<LabViewId>('desk')
  const [viewNonce, setViewNonce] = useState(0)
  const [panelOpen, setPanelOpen] = useState(true)
  const [ready, setReady] = useState(false)
  const quality = useMemo(resolveQuality, [])
  const hasWebgl = useMemo(() => webglSupported(), [])
  const bridge = useMemo(() => createLabSceneBridge(), [])

  const def = LAB_EXPERIMENTS.find((e) => e.id === run.experimentId)
  const totalSteps = def?.steps.length ?? 0
  const current = def && run.step < totalSteps ? def.steps[run.step] : undefined
  const finished = !!def && totalSteps > 0 && run.step >= totalSteps

  const selectExperiment = useCallback(
    (id: LabExperimentId) => {
      setRun({ experimentId: id, step: 0 })
      const next = new URLSearchParams(params)
      next.set('exp', id)
      setParams(next, { replace: true })
    },
    [params, setParams],
  )
  const setStep = useCallback(
    (step: number) => setRun((r) => ({ ...r, step: Math.max(0, Math.min(step, totalSteps || 0)) })),
    [totalSteps],
  )
  const advance = useCallback(() => setRun((r) => ({ ...r, step: Math.min(r.step + 1, totalSteps) })), [totalSteps])
  const chooseView = (id: LabViewId) => {
    setView(id)
    setViewNonce((n) => n + 1)
  }

  const cardTitle = (id: LabExperimentId) => {
    const d = LAB_EXPERIMENTS.find((e) => e.id === id)
    return {
      source: d?.source[lang] ?? t(`lab3d.exp.${id}.source` as MessageKey),
      title: d?.title[lang] ?? t(`lab3d.exp.${id}.title` as MessageKey),
      equation: d?.equation ?? FALLBACK_EQUATION[id],
      kind: d?.kind ?? KIND[id],
    }
  }
  const active = cardTitle(run.experimentId)

  return (
    <div className={styles.wrap}>
      <div className={styles.stage}>
        {hasWebgl ? (
          <Suspense
            fallback={
              <div className={styles.loading} role="status">
                <span className={styles.spinner} aria-hidden />
                {t('lab3d.loading')}
              </div>
            }
          >
            <Lab3DCanvas
              experimentId={run.experimentId}
              step={run.step}
              lang={lang}
              quality={quality}
              view={view}
              viewNonce={viewNonce}
              bridge={bridge}
              onAdvance={advance}
              onSelectExperiment={selectExperiment}
              onStep={setStep}
              onReady={() => setReady(true)}
              ariaLabel={t('lab3d.canvasAria')}
            />
            {!ready && (
              <div className={styles.loading} role="status">
                <span className={styles.spinner} aria-hidden />
                {t('lab3d.loading')}
              </div>
            )}
          </Suspense>
        ) : (
          <div className={styles.noWebgl} role="alert">
            <strong>{t('lab3d.title')}</strong>
            <p>{t('lab3d.noWebgl')}</p>
          </div>
        )}
      </div>

      {/* Чипы камеры */}
      <div className={styles.views} role="toolbar" aria-label={t('lab3d.viewAria')}>
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={view === v.id ? styles.chipActive : styles.chip}
            aria-pressed={view === v.id}
            onClick={() => chooseView(v.id)}
          >
            {t(v.key)}
          </button>
        ))}
        {view === 'board' && (
          <span className={styles.boardNav}>
            <button type="button" className={styles.chip} aria-label={t('lab3d.boardLeft')} onClick={() => bridge.shiftBoard?.(-1)}>
              ◀
            </button>
            <button type="button" className={styles.chip} aria-label={t('lab3d.boardRight')} onClick={() => bridge.shiftBoard?.(1)}>
              ▶
            </button>
          </span>
        )}
      </div>

      {/* Панель опыта */}
      <aside className={panelOpen ? styles.panel : `${styles.panel} ${styles.panelClosed}`} aria-label={t('lab3d.title')}>
        <button
          type="button"
          className={styles.panelHead}
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((o) => !o)}
        >
          <span className={styles.headText}>
            <span className={styles.kicker}>{t('lab3d.title')}</span>
            <span className={styles.headTitle}>{active.title}</span>
          </span>
          <span className={styles.toggle} aria-hidden>
            {panelOpen ? '▾' : '▴'}
          </span>
          <span className={styles.srOnly}>{panelOpen ? t('lab3d.panelClose') : t('lab3d.panelOpen')}</span>
        </button>

        <div className={styles.panelBody}>
          <p className={styles.lead}>{t('lab3d.subtitle')}</p>
          <div className={styles.cards} role="list">
            {EXPERIMENT_IDS.map((id) => {
              const c = cardTitle(id)
              const on = id === run.experimentId
              return (
                <button
                  key={id}
                  type="button"
                  role="listitem"
                  className={on ? `${styles.card} ${styles.cardActive}` : styles.card}
                  aria-current={on}
                  onClick={() => selectExperiment(id)}
                >
                  <span className={`${styles.badge} ${styles[`kind_${c.kind}`]}`}>{c.source}</span>
                  <span className={styles.cardTitle}>{c.title}</span>
                  <span className={styles.eq}>{c.equation}</span>
                </button>
              )
            })}
          </div>

          <section className={styles.stepBox} aria-live="polite">
            {def && totalSteps > 0 ? (
              <>
                <div className={styles.stepCount}>
                  {finished ? t('lab3d.done') : t('lab3d.step', { n: run.step + 1, total: totalSteps })}
                </div>
                <div className={styles.progress} aria-hidden>
                  <span style={{ width: `${Math.round((Math.min(run.step, totalSteps) / totalSteps) * 100)}%` }} />
                </div>
                <p className={styles.instruction}>{finished ? def.conclusion[lang] : current?.instruction[lang]}</p>
                {current?.observation && (
                  <p className={styles.observation}>
                    <b>{t('lab3d.observation')}:</b> {current.observation[lang]}
                  </p>
                )}
              </>
            ) : (
              <p className={styles.instruction}>{t('lab3d.stepsSoon')}</p>
            )}
            <div className={styles.stepBtns}>
              <button type="button" className={styles.btn} onClick={() => setStep(run.step - 1)} disabled={run.step === 0}>
                {t('lab3d.back')}
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={advance}
                disabled={!def || run.step >= totalSteps}
              >
                {t('lab3d.next')}
              </button>
              <button type="button" className={styles.btn} onClick={() => setStep(0)} disabled={run.step === 0}>
                {t('lab3d.restart')}
              </button>
            </div>
          </section>
          <p className={styles.hint}>{t('lab3d.hint')}</p>
          <Link className={styles.classic} to="/vr-lab-classic">
            {t('lab3d.classic')}
          </Link>
        </div>
      </aside>
    </div>
  )
}
