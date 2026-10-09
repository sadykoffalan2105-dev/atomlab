/**
 * Новая 3D-лаборатория (маршрут /vr-lab): светлая реалистичная школьная лаборатория без VR-очков —
 * мышь на компьютере, пальцы на телефоне/планшете/интерактивной доске. Опыты из Kimyo 7 (§ 2.12 и практическое § 5.2).
 * Состояние опыта (LabRunState) живёт здесь; ?exp=<id> в адресе выбирает опыт.
 */
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { labAudio } from '../components/lab3d/audio/labAudio'
import { LAB_EXPERIMENTS } from '../components/lab3d/experiments'
import { LabExtinguisherBar, LabHandBar } from '../components/lab3d/interaction/LabHandBar'
import { labHand } from '../components/lab3d/interaction/labHandStore'
import { labEvents } from '../components/lab3d/labEvents'
import { isLabTaskId, type LabTaskId, type LabExperimentId, type LabLang, type LabReactionKind, type LabRunState } from '../components/lab3d/labContract'
import { LAB_TASKS, getLabTask } from '../data/labTasks/labTasks'
import { labTaskSession, useLabTaskSession } from '../components/lab3d/measure/labTaskSession'
import { journalLines, TaskJournal, TaskSolve, TaskStatement, TaskTeacherTip } from '../components/lab3d/tasks/LabTaskUi'
import { TaskAiCoach } from '../components/learn/TaskAiCoach'
import type { LearnTaskNumericProblem } from '../learn/learnTaskProblems'
import { createLabSceneBridge } from '../components/lab3d/scene/labBridge'
import { labCameraInsets } from '../components/lab3d/scene/labCameraInsets'
import { LabWidgets } from '../components/lab3d/scene/LabWidgets'
import { labUiMode, useLabUiMode } from '../components/lab3d/scene/labUiMode'
import { resolveLabUiMode } from '../components/lab3d/scene/labUiPrefs'
import { LabXrButton } from '../components/lab3d/xr/LabXrButton'
import type { LabViewId } from '../components/lab3d/scene/labSceneLayout'
import { detectVrLabQuality, webglSupported } from '../components/vrLab/vrLabPerformance'
import { useT, type MessageKey } from '../i18n/useT'
import styles from './Lab3DPage.module.css'

const Lab3DCanvas = lazy(() => import('../components/lab3d/scene/Lab3DCanvas'))

const LAB_WORK_IDS: readonly LabExperimentId[] = ['baso4', 'ch4-burn', 'zn-hcl', 'h2-practical', 'salt-purify', 'nh3', 'halogens', 'water-oxides', 'co2', 'metals-acids']
/** Опыты и задачи-опыты (готовые задачи из src/data/labTasks). */
const EXPERIMENT_IDS: readonly LabExperimentId[] = [...LAB_WORK_IDS, ...LAB_TASKS.map((t) => t.id)]
const TASK_FALLBACK = Object.fromEntries(LAB_TASKS.map((t) => [t.id, t.equation])) as Record<LabTaskId, string>
const TASK_KIND = Object.fromEntries(LAB_TASKS.map((t) => [t.id, t.kind])) as Record<LabTaskId, LabReactionKind>
/** Уравнения по учебнику — запасной вариант, пока часть «опыты» не отдала свои описания. */
const FALLBACK_EQUATION: Readonly<Record<LabExperimentId, string>> = {
  ...TASK_FALLBACK,
  baso4: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl',
  'ch4-burn': 'CH₄ + 2O₂ → CO₂ + 2H₂O',
  'zn-hcl': 'Zn + 2HCl → ZnCl₂ + H₂↑',
  'h2-practical': 'Zn + 2HCl → ZnCl₂ + H₂↑',
  'salt-purify': 'NaCl (+ SiO₂) → NaCl',
  nh3: '2NH₄Cl + Ca(OH)₂ → CaCl₂ + 2NH₃↑ + 2H₂O',
  halogens: 'Cl₂ + 2NaBr → 2NaCl + Br₂',
  'water-oxides': 'CaO + H₂O → Ca(OH)₂',
  co2: 'CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑',
  'metals-acids': 'Mg + H₂SO₄ → MgSO₄ + H₂↑',
}
const KIND: Readonly<Record<LabExperimentId, LabReactionKind>> = {
  ...TASK_KIND,
  baso4: 'exchange',
  'ch4-burn': 'combustion',
  'zn-hcl': 'substitution',
  'h2-practical': 'substitution',
  'salt-purify': 'physical',
  nh3: 'exchange',
  halogens: 'substitution',
  'water-oxides': 'combination',
  co2: 'exchange',
  'metals-acids': 'substitution',
}
const VIEWS: ReadonlyArray<{ id: LabViewId; key: MessageKey }> = [
  { id: 'desk', key: 'lab3d.view.desk' },
  { id: 'board', key: 'lab3d.view.board' },
  { id: 'shelves', key: 'lab3d.view.shelves' },
  { id: 'hood', key: 'lab3d.view.hood' },
  { id: 'cabinets', key: 'lab3d.scene.view.cabinets' },
]

const noop = () => {}
const TASK_UI = {
  works: { ru: 'Опыты', en: 'Experiments', uz: 'Tajribalar' },
  tasks: { ru: 'Задачи-опыты', en: 'Lab problems', uz: 'Masala-tajribalar' },
  back: { ru: 'Вернуться к задачам', en: 'Back to problems', uz: 'Masalalarga qaytish' },
  coach: { ru: 'Спросить учителя (ИИ) — без готового ответа', en: 'Ask the teacher (AI): no ready answers', uz: 'O‘qituvchidan so‘rash (SI) — tayyor javobsiz' },
  fullscreen: { ru: 'Во весь экран', en: 'Full screen', uz: 'Toʻliq ekran' },
  fullscreenExit: { ru: 'Выйти из полноэкранного режима', en: 'Exit full screen', uz: 'Toʻliq ekrandan chiqish' },
} satisfies Record<string, Record<LabLang, string>>

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

const NARROW_QUERY = '(max-width: 820px)'
function subscribeNarrow(cb: () => void): () => void {
  const mq = window.matchMedia?.(NARROW_QUERY)
  mq?.addEventListener('change', cb)
  return () => mq?.removeEventListener('change', cb)
}
const isNarrowNow = () => (typeof window !== 'undefined' ? !!window.matchMedia?.(NARROW_QUERY).matches : false)

/** Полноэкранный режим (интерактивная доска, проектор): есть ли он в браузере и включён ли сейчас. */
function subscribeFullscreen(cb: () => void): () => void {
  document.addEventListener('fullscreenchange', cb)
  return () => document.removeEventListener('fullscreenchange', cb)
}
const isFullscreenNow = () => (typeof document !== 'undefined' ? !!document.fullscreenElement : false)
const fullscreenAvailable = () => typeof document !== 'undefined' && !!document.fullscreenEnabled && !!document.documentElement.requestFullscreen
function toggleFullscreen() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
    else void document.documentElement.requestFullscreen?.().catch(() => {})
  } catch {
    /* браузер запретил — ничего не делаем */
  }
}

export function Lab3DPage() {
  const { t, locale } = useT()
  const lang: LabLang = locale
  const [params, setParams] = useSearchParams()
  // ?task=<id> — задача-опыт (ссылка из тренажёра задач); ?exp=<id> — опыт или задача
  const taskFromUrl = params.get('task')
  const expFromUrl = isLabTaskId(taskFromUrl) && isExperimentId(taskFromUrl) ? taskFromUrl : params.get('exp')
  const urlExperiment: LabExperimentId = isExperimentId(expFromUrl) ? expFromUrl : 'baso4'

  const [run, setRun] = useState<LabRunState>({ experimentId: urlExperiment, step: 0 })
  const taskId = isLabTaskId(run.experimentId) ? run.experimentId : null
  const task = taskId ? getLabTask(taskId) : null
  const taskSession = useLabTaskSession(taskId)
  const backHref = params.get('from')
  const [tab, setTab] = useState<'works' | 'tasks'>(() => (isLabTaskId(urlExperiment) ? 'tasks' : 'works'))
  // задача-опыт: новая попытка (новые показания приборов) — при выборе задачи и при «начать сначала»
  const prevStepRef = useRef(run.step)
  useEffect(() => {
    if (taskId) labTaskSession.restart(taskId)
  }, [taskId])
  useEffect(() => {
    if (taskId && run.step === 0 && prevStepRef.current > 0) labTaskSession.restart(taskId)
    prevStepRef.current = run.step
  }, [taskId, run.step])
  // Адрес сменился (назад/вперёд в браузере) — опыт начинается сначала
  if (run.experimentId !== urlExperiment) setRun({ experimentId: urlExperiment, step: 0 })

  const [view, setView] = useState<LabViewId>('desk')
  const [viewNonce, setViewNonce] = useState(0)
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrowNow, () => false)
  // На телефоне панель снизу и свёрнута — сцена видна целиком
  const [panelOpen, setPanelOpen] = useState(() => !isNarrowNow())
  const panelRef = useRef<HTMLElement>(null)
  const [leftInset, setLeftInset] = useState(0)
  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    const measure = () => setLeftInset(!narrow && panelOpen ? el.offsetLeft + el.offsetWidth : 0)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [narrow, panelOpen])
  // Телефон: сколько холста закрыто сверху (виды, «Приборы») и снизу (подсказка руки, панель опыта) — крупный план
  // камеры ставит предмет в середину свободной полосы (раскрыл панель — предмет поднимается над ней)
  const wrapRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !narrow) {
      labCameraInsets.set(0, 0)
      return
    }
    const measure = () => {
      const stage = wrap.querySelector<HTMLElement>(`.${styles.stage}`)
      if (!stage) return
      const c = stage.getBoundingClientRect()
      const mid = (c.top + c.bottom) / 2
      let top = 0
      let bottom = 0
      for (const el of wrap.children) {
        if (el === stage) continue
        const r = el.getBoundingClientRect()
        // пустые и во весь экран (слои-подложки) не в счёт
        if (r.width < 1 || r.height < 1 || r.height > c.height * 0.6 || r.bottom <= c.top || r.top >= c.bottom) continue
        if ((r.top + r.bottom) / 2 < mid) top = Math.max(top, r.bottom - c.top)
        else bottom = Math.max(bottom, c.bottom - r.top)
      }
      labCameraInsets.set(top, bottom)
    }
    const ro = new ResizeObserver(measure)
    const observeAll = () => {
      ro.disconnect()
      for (const el of wrap.children) ro.observe(el)
      measure()
    }
    // подсказка руки и «Приборы» появляются и пропадают (раскрыта панель) — пересчёт по составу
    const mo = new MutationObserver(observeAll)
    mo.observe(wrap, { childList: true })
    observeAll()
    return () => {
      ro.disconnect()
      mo.disconnect()
      labCameraInsets.set(0, 0)
    }
  }, [narrow])
  // Смена опыта: предметы возвращаются на полки и в шкафы, рука пуста; опыт «под тягой» — рабочее место
  // в вытяжке и камера летит к ней; нужные средства защиты подсвечиваются (опыт может уточнить через 'needGear')
  useEffect(() => {
    labHand.reset()
    const d = LAB_EXPERIMENTS.find((e) => e.id === run.experimentId)
    const hood = d?.place === 'hood'
    labHand.setSite(hood ? 'hood' : 'bench')
    labHand.setGearNeed(d?.gear ?? [])
    if (hood) {
      setView('hood')
      setViewNonce((n) => n + 1)
    }
  }, [run.experimentId])
  // Звук: включается после первого действия пользователя (политика автозапуска), уходя со страницы — тишина
  useEffect(() => {
    const off = labAudio.attachUnlock()
    return () => {
      off()
      labAudio.suspend()
    }
  }, [])
  const [ready, setReady] = useState(false)
  // Качество — состояние: VR-часть может временно понизить его командой 'quality' (мобильный шлем)
  const [quality, setQuality] = useState<'low' | 'high'>(resolveQuality)
  // Режим электронной доски: ?board=1, ручной выбор в виджетах или большой сенсорный экран
  useLayoutEffect(() => {
    labUiMode.set(resolveLabUiMode())
  }, [])
  const uiMode = useLabUiMode()
  const boardMode = uiMode.mode === 'board'
  const fullscreen = useSyncExternalStore(subscribeFullscreen, isFullscreenNow, () => false)
  const canFullscreen = useMemo(fullscreenAvailable, [])
  const hasWebgl = useMemo(() => webglSupported(), [])
  const bridge = useMemo(() => createLabSceneBridge(), [])

  const def = LAB_EXPERIMENTS.find((e) => e.id === run.experimentId)
  const totalSteps = def?.steps.length ?? 0
  const current = def && run.step < totalSteps ? def.steps[run.step] : undefined
  const finished = !!def && totalSteps > 0 && run.step >= totalSteps
  useEffect(() => {
    if (finished) labAudio.play('success', { gain: 0.8 })
  }, [finished])
  const viewLabel = (id: LabViewId) => t(VIEWS.find((v) => v.id === id)?.key ?? 'lab3d.view.desk')

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
  // кнопка «Далее» без действия руками — пропуск шага (в задаче-опыте снимает звезду за аккуратность)
  const skipStep = useCallback(() => {
    if (taskId) labTaskSession.noteSkip(taskId)
    advance()
  }, [advance, taskId])
  const coachProblem = useMemo<LearnTaskNumericProblem | null>(
    () =>
      task && taskSession
        ? { kind: 'numeric', categoryId: 'lab_task', compoundId: '', questionKey: '', answerLabelKey: '', params: { ...taskSession.values }, correct: Number.NaN, decimals: 2 }
        : null,
    [task, taskSession],
  )
  const chooseView = (id: LabViewId) => {
    if (narrow) setPanelOpen(false)
    setView(id)
    setViewNonce((n) => n + 1)
  }
  // Команды интерфейсу от VR-доски/HUD: те же действия, что у кнопок панели (последние значения — через ref)
  const commandRef = useRef({ skipStep, setStep, step: run.step, chooseView, selectExperiment })
  commandRef.current = { skipStep, setStep, step: run.step, chooseView, selectExperiment }
  useEffect(
    () =>
      labEvents.on('uiCommand', (e) => {
        const c = commandRef.current
        if (e.cmd === 'next') c.skipStep()
        else if (e.cmd === 'back') c.setStep(c.step - 1)
        else if (e.cmd === 'restart') c.setStep(0)
        else if (e.cmd === 'view' && e.view) c.chooseView(e.view)
        else if (e.cmd === 'select' && e.experimentId && isExperimentId(e.experimentId)) c.selectExperiment(e.experimentId)
        else if (e.cmd === 'quality' && (e.quality === 'low' || e.quality === 'high')) setQuality(e.quality)
      }),
    [],
  )

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
    <div ref={wrapRef} className={styles.wrap} data-lab-board={boardMode ? '' : undefined} style={{ '--lab-ui': uiMode.scale } as CSSProperties}>
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
              leftInsetPx={leftInset}
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

      {/* «Рука»: подсказка о взятии и слот «В руке» (на телефоне — пока панель опыта свёрнута) */}
      {hasWebgl && ready && !(narrow && panelOpen) && <LabHandBar lang={lang} leftInsetPx={leftInset} />}
      {/* Огнетушитель в руке: чека, рычаг, вернуть на крючок */}
      {hasWebgl && ready && !(narrow && panelOpen) && <LabExtinguisherBar leftInsetPx={leftInset} />}

      {/* Виджеты: секундомер, журнал наблюдений, средства защиты, звук, план; «очки на лице»; правила ТБ */}
      {hasWebgl && ready && (
        <LabWidgets
          hidden={narrow && panelOpen}
          experimentId={run.experimentId}
          step={run.step}
          finished={finished}
          lang={lang}
          view={view}
          onView={chooseView}
          viewLabel={viewLabel}
          narrow={narrow}
        />
      )}

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
        {canFullscreen && !narrow && (
          <button
            type="button"
            className={fullscreen ? styles.chipActive : styles.chip}
            aria-pressed={fullscreen}
            aria-label={fullscreen ? TASK_UI.fullscreenExit[lang] : TASK_UI.fullscreen[lang]}
            title={fullscreen ? TASK_UI.fullscreenExit[lang] : TASK_UI.fullscreen[lang]}
            onClick={toggleFullscreen}
            data-lab3d-fullscreen=""
          >
            <FullscreenIcon on={fullscreen} />
          </button>
        )}
        <LabXrButton lang={lang} className={styles.xrBtn} />
      </div>

      {/* Панель опыта */}
      <aside ref={panelRef} className={panelOpen ? styles.panel : `${styles.panel} ${styles.panelClosed}`} aria-label={t('lab3d.title')}>
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
          {backHref ? (
            <Link className={styles.back} to={backHref}>
              ← {TASK_UI.back[lang]}
            </Link>
          ) : null}
          <p className={styles.lead}>{t('lab3d.subtitle')}</p>
          <div className={styles.tabs} role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'works'} className={tab === 'works' ? styles.tabOn : styles.tab} onClick={() => setTab('works')}>
              {TASK_UI.works[lang]}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'tasks'} className={tab === 'tasks' ? styles.tabOn : styles.tab} onClick={() => setTab('tasks')} data-lab3d-tab="tasks">
              {TASK_UI.tasks[lang]} · {LAB_TASKS.length}
            </button>
          </div>
          <div className={styles.cards} role="list">
            {(tab === 'tasks' ? LAB_TASKS.map((x) => x.id) : LAB_WORK_IDS).map((id) => {
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

          {task ? <TaskStatement task={task} lang={lang} variant="panel" /> : null}
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
                onClick={skipStep}
                disabled={!def || run.step >= totalSteps}
              >
                {t('lab3d.next')}
              </button>
              <button type="button" className={styles.btn} onClick={() => setStep(0)} disabled={run.step === 0}>
                {t('lab3d.restart')}
              </button>
            </div>
          </section>
          {task && taskSession ? (
            <>
              {!finished ? <TaskTeacherTip task={task} step={run.step} lang={lang} /> : null}
              <TaskJournal task={task} step={run.step} lang={lang} variant="panel" />
              {finished ? <TaskSolve taskId={task.id} step={run.step} lang={lang} variant="panel" onRepeat={() => setStep(0)} /> : null}
              {coachProblem ? (
                <details className={styles.coach}>
                  <summary>{TASK_UI.coach[lang]}</summary>
                  <TaskAiCoach
                    problem={coachProblem}
                    categoryId="lab_task"
                    categoryTitle={task.title[lang]}
                    questionText={task.statement[lang]}
                    answerLabel={task.answers.map((a) => a.label).join(', ')}
                    staticHintsRevealed={0}
                    feedback={taskSession.solved ? 'correct' : taskSession.checks ? 'wrong' : 'idle'}
                    userAttempt={task.answers.map((a) => `${a.label} = ${taskSession.answers[a.key] ?? ''}`).join('; ')}
                    onAiHintsChange={noop}
                    lab={{ taskId: task.id, measurements: journalLines(task, taskSession, run.step, lang), currentStep: current?.instruction[lang] }}
                  />
                </details>
              ) : null}
            </>
          ) : null}
          <p className={styles.hint}>{t('lab3d.hint')}</p>
          <Link className={styles.classic} to="/vr-lab-classic">
            {t('lab3d.classic')}
          </Link>
        </div>
      </aside>
    </div>
  )
}

/** Значок «во весь экран» / «выйти» (SVG — одинаково на всех устройствах). */
function FullscreenIcon({ on }: { on: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {on ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
    </svg>
  )
}
