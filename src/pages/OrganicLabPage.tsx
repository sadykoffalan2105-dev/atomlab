/**
 * #/organic — органика v2 (план docs/plans/organic-v2.md): путь по учебнику Kimyo 10 слева, вкладки режимов
 * «Молекула · Конструктор · Изомеры · Синтез · Реакции · Название», сцена режима в центре.
 * Состояние — только в URL (organicUrl.ts): lesson, mode, mol, rx, task, f, src (ссылка назад к учебнику).
 * Данные молекул и реакций (RDKit) грузятся отдельными чанками; геометрия в браузере не пересчитывается.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LabDomainTabs } from '../components/lab/LabDomainTabs'
import { OrganicNomenclatureMode } from '../components/organicLab/OrganicNomenclatureMode'
import type { ConstructorSolved, ConstructorTask, OV2Lang } from '../components/organicV2/contracts'
import { MiniSkeleton } from '../components/organicV2/shell/MiniSkeleton'
import { patchOrganicParams, resolveOrganicUrl } from '../components/organicV2/shell/organicUrl'
import { shellText, type ShellDict } from '../components/organicV2/shell/shellI18n'
import shell from '../components/organicV2/shell/OrganicShell.module.css'
import {
  ORGANIC_CHAPTER_LABELS,
  pickLessonGoal,
  pickLessonTitle,
  type OrganicLesson,
} from '../data/organicLab/organicCurriculum'
import {
  isLessonDoneV2,
  lessonShareV2,
  loadProgressV2,
  markModeDone,
  modeDone,
  type OV2ProgressMap,
} from '../data/organicLab/organicCurriculumProgress'
import { ORGANIC_REACTION_LABELS } from '../data/organicLab/organicLessonReactions.gen'
import {
  asciiFormula,
  lessonConstructorTasks,
  lessonGoalV2,
  lessonIsomerSets,
  lessonModesV2,
  lessonMoleculeIds,
  lessonReactionIds,
  ORGANIC_CURRICULUM,
  taskKey,
  type OV2Mode,
} from '../data/organicLab/organicLessonsV2'
import { organicMoleculeById } from '../data/organicLab/organicMoleculeRegistry'
import { loadOrganicV2Molecules } from '../data/organicV2/molecules'
import { loadOrganicV2Reactions } from '../data/organicV2/reactions'
import type { OV2Molecule, OV2Reaction, OV2ReactionsFile } from '../data/organicV2/types'
import { useLocale } from '../i18n/useLocale'
import { sanitizeBackHref } from '../lab/reactorDeepLink'

const MoleculeViewer = lazy(() => import('../components/organicV2/MoleculeViewer').then((m) => ({ default: m.MoleculeViewer })))
const OrganicConstructor = lazy(() =>
  import('../components/organicV2/OrganicConstructor').then((m) => ({ default: m.OrganicConstructor })),
)
const IsomerGallery = lazy(() => import('../components/organicV2/IsomerGallery').then((m) => ({ default: m.IsomerGallery })))
const SynthesisPlayer = lazy(() =>
  import('../components/organicV2/SynthesisPlayer').then((m) => ({ default: m.SynthesisPlayer })),
)

type MolMap = Readonly<Record<string, OV2Molecule>>

const subscript = (f: string) => f.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[+d]!)

function molName(id: string, lang: OV2Lang): string {
  const m = organicMoleculeById[id]
  if (!m) return id
  return lang === 'en' ? m.nameEn : lang === 'uz' ? m.nameUz : m.nameRu
}

/** Данные v2 грузятся один раз; ошибка сети — кнопка «Повторить». */
function useAsyncData<T>(enabled: boolean, load: () => Promise<T>): { data: T | null; error: boolean; retry: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled || data) return
    let alive = true
    load().then(
      (d) => alive && setData(d),
      () => alive && setError(true),
    )
    return () => {
      alive = false
    }
    // load — стабильная функция модуля
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, attempt, data])
  return { data, error, retry: () => (setError(false), setAttempt((a) => a + 1)) }
}

export function OrganicLabPage() {
  const { locale } = useLocale()
  const lang: OV2Lang = locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru'
  const T = shellText(lang)
  const [params, setParams] = useSearchParams()
  const url = useMemo(() => resolveOrganicUrl(params), [params])
  const { lesson } = url
  const backHref = sanitizeBackHref(params.get('src'))

  const molsQ = useAsyncData<MolMap>(true, loadOrganicV2Molecules)
  const mols = molsQ.data
  const formulaOf = useCallback(
    (id: string) => mols?.[id]?.formula ?? (organicMoleculeById[id] ? asciiFormula(organicMoleculeById[id]!.formula) : undefined),
    [mols],
  )
  const isoSets = useMemo(() => lessonIsomerSets(lesson, formulaOf), [lesson, formulaOf])
  const lessonRx = lessonReactionIds(lesson)
  const modes = useMemo(() => {
    const m = lessonModesV2(lesson, isoSets)
    if (url.mode === 'reactions' && url.rxId && !m.includes('reactions')) m.splice(m.indexOf('synthesis') + 1, 0, 'reactions')
    return m
  }, [lesson, isoSets, url.mode, url.rxId])
  const mode: OV2Mode = modes.includes(url.mode) ? url.mode : 'molecule'
  const rxQ = useAsyncData<OV2ReactionsFile>(mode === 'synthesis' || mode === 'reactions', loadOrganicV2Reactions)

  const molIds = useMemo(() => {
    const ids = lessonMoleculeIds(lesson)
    return ids.includes(url.molId) ? ids : [url.molId, ...ids]
  }, [lesson, url.molId])
  const molId = url.molId
  const mol = mols?.[molId]

  const [progress, setProgress] = useState<OV2ProgressMap>(() => loadProgressV2())
  const done = useCallback((m: OV2Mode) => setProgress(markModeDone(lesson.id, m)), [lesson.id])
  useEffect(() => {
    if ((mode === 'molecule' && mol) || mode === 'isomers') done(mode)
  }, [mode, mol, done])

  const go = useCallback(
    (patch: Parameters<typeof patchOrganicParams>[1]) => {
      const base = { lesson: lesson.id, mode, mol: molId, task: url.task, ...patch }
      setParams(patchOrganicParams(params, base), { replace: true })
    },
    [lesson.id, mode, molId, url.task, params, setParams],
  )

  const [pathOpen, setPathOpen] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)
  useEffect(() => centerSelected(tabsRef.current), [mode, lesson.id])
  const lessonIndex = ORGANIC_CURRICULUM.indexOf(lesson)
  const doneCount = ORGANIC_CURRICULUM.filter((l) => isLessonDoneV2(progress[l.id], modesOfLesson(l, formulaOf))).length
  const lessonDone = isLessonDoneV2(progress[lesson.id], modes)
  const goal = lessonGoalV2(lesson, lang) ?? pickLessonGoal(lesson, lang)
  const showStrip = mode === 'molecule' || mode === 'synthesis' || mode === 'reactions'

  const selectLesson = (l: OrganicLesson) => {
    setPathOpen(false)
    setParams(patchOrganicParams(params, { lesson: l.id, mode: 'molecule', mol: null, rx: null, task: null, f: null }), {
      replace: true,
    })
    window.scrollTo({ top: 0 })
  }

  return (
    <div className={shell.page} data-ov2-shell="" data-mode={mode}>
      <div
        className={shell.backdrop}
        data-open={pathOpen ? 'true' : undefined}
        onClick={() => setPathOpen(false)}
        aria-hidden
      />
      <aside className={shell.path} data-open={pathOpen ? 'true' : undefined} aria-label={T.path} id="ov2-path">
        <div className={shell.pathTop}>
          {backHref ? (
            <Link className={shell.back} to={backHref} data-lab-back-to-book="">
              {T.back}
            </Link>
          ) : null}
          <div className={shell.domainTabs}>
            <LabDomainTabs active="organic" />
          </div>
          <button type="button" className={shell.pathClose} onClick={() => setPathOpen(false)} aria-label={T.close}>
            ×
          </button>
        </div>
        <div className={shell.pathHead}>
          <h2 className={shell.pathTitle}>{T.path}</h2>
          <p className={shell.pathLead}>{T.pathLead}</p>
          <div className={shell.overall} aria-label={T.progress}>
            <div className={shell.overallBar}>
              <span style={{ width: `${(doneCount / ORGANIC_CURRICULUM.length) * 100}%` }} />
            </div>
            <span className={shell.overallText}>{T.lessonsDone(doneCount, ORGANIC_CURRICULUM.length)}</span>
          </div>
        </div>
        <nav className={shell.pathList}>
          {([1, 2, 3, 4] as const).map((ch) => (
            <section key={ch} className={shell.chapter}>
              <h3 className={shell.chapterTitle}>{ORGANIC_CHAPTER_LABELS[ch][lang]}</h3>
              <ol className={shell.lessons}>
                {ORGANIC_CURRICULUM.filter((l) => l.chapter === ch).map((l) => {
                  const lm = modesOfLesson(l, formulaOf)
                  const share = lessonShareV2(progress[l.id], lm)
                  const active = l.id === lesson.id
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        className={shell.lessonBtn}
                        data-active={active ? 'true' : undefined}
                        data-lesson={l.id}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => selectLesson(l)}
                      >
                        <ProgressRing share={share} n={ORGANIC_CURRICULUM.indexOf(l) + 1} />
                        <span className={shell.lessonName}>{pickLessonTitle(l, lang)}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </nav>
      </aside>

      <main className={shell.main}>
        <header className={shell.head}>
          <div className={shell.headTop}>
            <button
              type="button"
              className={shell.pathToggle}
              aria-expanded={pathOpen}
              aria-controls="ov2-path"
              onClick={() => setPathOpen(true)}
            >
              <PathIcon />
              {T.openPath}
            </button>
            <p className={shell.kicker}>
              {ORGANIC_CHAPTER_LABELS[lesson.chapter][lang]} · {T.lessonOf(lessonIndex + 1, ORGANIC_CURRICULUM.length)}
            </p>
            {backHref ? (
              <Link className={`${shell.back} ${shell.backInline}`} to={backHref}>
                {T.back}
              </Link>
            ) : null}
          </div>
          <div className={shell.titleRow}>
            <h1 className={shell.title}>{pickLessonTitle(lesson, lang)}</h1>
            {lessonDone ? <span className={shell.doneBadge}>✓ {T.done}</span> : null}
          </div>
          <p className={shell.goal}>
            <b>{T.goal}:</b> {goal}
          </p>
          <div className={shell.tabs} role="tablist" aria-label={T.stepsOfLesson} ref={tabsRef}>
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                data-mode-tab={m}
                aria-selected={m === mode}
                className={shell.tab}
                onClick={() =>
                  go({
                    mode: m,
                    rx: m === mode || m === 'reactions' ? url.rxId : null,
                    // Конструктор с вкладки: собрать молекулу, которую смотрели (если она по силам), иначе первое задание урока
                    task: m === 'constructor' && mode !== 'constructor' ? constructorTaskFor(lesson, isoSets, molId) : url.task,
                  })
                }
                title={T.modeHints[m]}
              >
                <ModeIcon mode={m} />
                <span>{T.modes[m]}</span>
                {modeDone(progress[lesson.id], m) ? <span className={shell.tabDone} aria-label={T.done}>✓</span> : null}
              </button>
            ))}
          </div>
        </header>

        {showStrip ? (
          <MoleculeStrip ids={molIds} active={molId} mols={mols} lang={lang} T={T} onPick={(id) => go({ mol: id, rx: mode === 'reactions' ? url.rxId : null })} />
        ) : null}

        <section className={shell.stage} data-stage={mode}>
          {molsQ.error ? (
            <LoadError T={T} retry={molsQ.retry} />
          ) : !mols && mode !== 'name' ? (
            <StageLoading text={T.loading} />
          ) : (
            <Suspense fallback={<StageLoading text={T.loading} />}>
              {mode === 'molecule' && mol ? <MoleculeViewer key={mol.id} mol={mol} lang={lang} className={shell.fill} /> : null}
              {mode === 'constructor' && mols ? (
                <ConstructorStage lesson={lesson} isoSets={isoSets} taskParam={url.task} mols={mols} lang={lang} T={T}
                  onTask={(k) => go({ task: k })} onSolved={() => done('constructor')} />
              ) : null}
              {mode === 'isomers' && mols ? (
                <IsomerStage sets={isoSets} active={url.formula} mols={mols} lang={lang} T={T}
                  onFormula={(f) => go({ f })} onOpen={(id) => go({ mode: 'molecule', mol: id })} />
              ) : null}
              {(mode === 'synthesis' || mode === 'reactions') && mols ? (
                rxQ.error ? (
                  <LoadError T={T} retry={rxQ.retry} />
                ) : !rxQ.data ? (
                  <StageLoading text={T.loadingRx} />
                ) : (
                  <ReactionStage
                    mode={mode}
                    file={rxQ.data}
                    lessonRx={lessonRx}
                    rxId={url.rxId}
                    molId={molId}
                    lang={lang}
                    T={T}
                    onPick={(id) => go({ rx: id })}
                    onDone={() => done(mode)}
                  />
                )
              ) : null}
              {mode === 'name' && lesson.nomenclatureQuizId ? (
                <div className={shell.quizWrap}>
                  <OrganicNomenclatureMode
                    key={lesson.id}
                    quizId={lesson.nomenclatureQuizId}
                    quizIds={[lesson.nomenclatureQuizId, ...(lesson.extraQuizIds ?? [])]}
                    onComplete={() => done('name')}
                  />
                </div>
              ) : null}
            </Suspense>
          )}
        </section>

        <footer className={shell.lessonNav}>
          {lessonIndex > 0 ? (
            <button type="button" className={shell.navBtn} onClick={() => selectLesson(ORGANIC_CURRICULUM[lessonIndex - 1]!)}>
              ← {pickLessonTitle(ORGANIC_CURRICULUM[lessonIndex - 1]!, lang)}
            </button>
          ) : <span />}
          {lessonIndex < ORGANIC_CURRICULUM.length - 1 ? (
            <button type="button" className={`${shell.navBtn} ${shell.navNext}`} onClick={() => selectLesson(ORGANIC_CURRICULUM[lessonIndex + 1]!)}>
              {pickLessonTitle(ORGANIC_CURRICULUM[lessonIndex + 1]!, lang)} →
            </button>
          ) : null}
        </footer>
      </main>
    </div>
  )
}

function constructorTaskFor(lesson: OrganicLesson, isoSets: ReturnType<typeof lessonIsomerSets>, molId: string): string {
  const tasks = lessonConstructorTasks(lesson, isoSets)
  const own = tasks.find((t) => t.kind === 'build' && t.targetId === molId)
  return taskKey(own ?? tasks[0]!)
}

function modesOfLesson(l: OrganicLesson, formulaOf: (id: string) => string | undefined): OV2Mode[] {
  return lessonModesV2(l, lessonIsomerSets(l, formulaOf))
}

/* ── Полоса молекул урока ─────────────────────────────────────────── */

function MoleculeStrip({ ids, active, mols, lang, T, onPick }: {
  ids: readonly string[]; active: string; mols: MolMap | null; lang: OV2Lang; T: ShellDict; onPick: (id: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    centerSelected(ref.current)
  }, [active])
  return (
    <div className={shell.strip}>
      <span className={shell.stripLabel}>
        {T.molecules} <small>{T.moleculesCount(ids.length)}</small>
      </span>
      <div className={shell.chips} ref={ref} role="listbox" aria-label={T.pickMol}>
        {ids.map((id) => {
          const m = mols?.[id]
          const reg = organicMoleculeById[id]
          return (
            <button key={id} type="button" role="option" aria-selected={id === active} className={shell.chip} data-mol={id} onClick={() => onPick(id)}>
              <span className={shell.chipIcon}>{m ? <MiniSkeleton mol={m} size={40} /> : null}</span>
              <span className={shell.chipText}>
                <span className={shell.chipName}>{molName(id, lang)}</span>
                <span className={shell.chipFormula}>{reg?.formula ?? (m ? subscript(m.formula) : '')}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Конструктор ──────────────────────────────────────────────────── */

function ConstructorStage({ lesson, isoSets, taskParam, mols, lang, T, onTask, onSolved }: {
  lesson: OrganicLesson
  isoSets: ReturnType<typeof lessonIsomerSets>
  taskParam: string | null
  mols: MolMap
  lang: OV2Lang
  T: ShellDict
  onTask: (key: string) => void
  onSolved: () => void
}) {
  const tasks = useMemo(() => lessonConstructorTasks(lesson, isoSets), [lesson, isoSets])
  const fromParam = useMemo((): ConstructorTask | null => {
    if (!taskParam) return null
    const known = tasks.find((t) => taskKey(t) === taskParam)
    if (known) return known
    if (taskParam.startsWith('build:') && mols[taskParam.slice(6)]) return { kind: 'build', targetId: taskParam.slice(6) }
    if (taskParam.startsWith('iso:')) return { kind: 'isomers', formula: taskParam.slice(4) }
    return taskParam === 'free' ? { kind: 'free' } : null
  }, [taskParam, tasks, mols])
  const task = fromParam ?? tasks[0]!
  const list = fromParam && !tasks.some((t) => taskKey(t) === taskKey(fromParam)) ? [fromParam, ...tasks] : tasks
  const [solved, setSolved] = useState<string | null>(null)
  const key = taskKey(task)
  const label = (t: ConstructorTask) =>
    t.kind === 'build' ? molName(t.targetId, lang) : t.kind === 'isomers' ? T.taskIso(subscript(t.formula)) : T.taskFree
  return (
    <div className={shell.split}>
      <div className={shell.taskBar} role="tablist" aria-label={T.tasks}>
        {list.map((t) => (
          <button key={taskKey(t)} type="button" role="tab" aria-selected={taskKey(t) === key} className={shell.taskChip}
            data-task={taskKey(t)} data-kind={t.kind} onClick={() => onTask(taskKey(t))}>
            {t.kind === 'build' && mols[t.targetId] ? <MiniSkeleton mol={mols[t.targetId]!} size={26} /> : null}
            {t.kind === 'isomers' ? <span className={shell.taskGlyph}>⇄</span> : null}
            {t.kind === 'free' ? <span className={shell.taskGlyph}>✎</span> : null}
            <span>{label(t)}</span>
            {solved === taskKey(t) ? <span className={shell.tabDone}>✓</span> : null}
          </button>
        ))}
      </div>
      <OrganicConstructor
        key={key}
        task={task}
        lang={lang}
        molecules={mols}
        className={shell.fill}
        onSolved={(r: ConstructorSolved) => {
          void r
          setSolved(key)
          onSolved()
        }}
      />
    </div>
  )
}

/* ── Изомеры ──────────────────────────────────────────────────────── */

function IsomerStage({ sets, active, mols, lang, T, onFormula, onOpen }: {
  sets: ReturnType<typeof lessonIsomerSets>
  active: string | null
  mols: MolMap
  lang: OV2Lang
  T: ShellDict
  onFormula: (f: string) => void
  onOpen: (id: string) => void
}) {
  const formula = sets.find((s) => s.formula === active)?.formula ?? sets[0]?.formula ?? ''
  const list = useMemo(() => Object.values(mols).filter((m) => m.formula === formula), [mols, formula])
  return (
    <div className={shell.split}>
      {sets.length > 1 ? (
        <div className={shell.taskBar} role="tablist" aria-label={T.formulas}>
          {sets.map((s) => (
            <button key={s.formula} type="button" role="tab" aria-selected={s.formula === formula} className={shell.taskChip}
              data-formula={s.formula} onClick={() => onFormula(s.formula)}>
              <b>{subscript(s.formula)}</b>
              <small>{Object.values(mols).filter((m) => m.formula === s.formula).length}</small>
            </button>
          ))}
        </div>
      ) : null}
      <IsomerGallery key={formula} formula={formula} molecules={list} lang={lang} onOpen={onOpen} className={shell.fill} />
    </div>
  )
}

/* ── Синтез и реакции ─────────────────────────────────────────────── */

function ReactionStage({ mode, file, lessonRx, rxId, molId, lang, T, onPick, onDone }: {
  mode: 'synthesis' | 'reactions'
  file: OV2ReactionsFile
  lessonRx: readonly string[]
  rxId: string | null
  molId: string
  lang: OV2Lang
  T: ShellDict
  onPick: (id: string) => void
  onDone: () => void
}) {
  const byId = useMemo(() => new Map(file.reactions.map((r) => [r.id, r])), [file])
  const groups = useMemo(() => {
    const pick = (ids: readonly string[] | undefined) => (ids ?? []).map((id) => byId.get(id)).filter((r): r is OV2Reaction => !!r)
    if (mode === 'synthesis') return [{ title: T.routesOf(molName(molId, lang)), items: pick(file.routes[molId]) }]
    const lessonItems = pick(lessonRx)
    if (rxId && byId.has(rxId) && !lessonRx.includes(rxId)) lessonItems.unshift(byId.get(rxId)!)
    return [
      { title: T.lessonRx, items: lessonItems },
      { title: T.molRx(molName(molId, lang)), items: pick(file.uses[molId]).filter((r) => !lessonItems.includes(r)) },
    ].filter((g) => g.items.length > 0)
  }, [mode, file, byId, lessonRx, rxId, molId, lang, T])
  const all = groups.flatMap((g) => g.items)
  const current = (rxId ? all.find((r) => r.id === rxId) : undefined) ?? all[0]
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [current?.id])
  if (!current) return <p className={shell.empty}>{mode === 'synthesis' ? T.noRoutes : T.noRx}</p>
  return (
    <div className={shell.rxLayout}>
      <div className={shell.rxList} ref={listRef}>
        {groups.map((g) => (
          <section key={g.title} className={shell.rxGroup}>
            <h3 className={shell.rxGroupTitle}>
              {g.title} <small>{g.items.length}</small>
            </h3>
            <ul>
              {g.items.map((r) => {
                const lbl = ORGANIC_REACTION_LABELS[r.id]
                return (
                  <li key={r.id}>
                    <button type="button" className={shell.rxItem} aria-current={r.id === current.id ? 'true' : undefined}
                      data-rx={r.id} onClick={() => onPick(r.id)}>
                      <span className={shell.rxEq}>{r.equation}</span>
                      <span className={shell.rxMeta}>
                        {r.typeRu ?? lbl?.[1] ?? ''}
                        {r.source.page ? ` · ${T.page(r.source.page)}` : ''} · {T.grade(r.source.grade)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      <div className={shell.rxStage} data-rx-current={current.id}>
        <SynthesisPlayer key={current.id} reaction={current} lang={lang} focusMoleculeId={molId} onDone={onDone} className={shell.fill} />
      </div>
    </div>
  )
}

/* ── Мелочи ───────────────────────────────────────────────────────── */

/** Прокрутить строку (чипы, вкладки) так, чтобы выбранный элемент был по центру; страница не дёргается. */
function centerSelected(box: HTMLElement | null) {
  const el = box?.querySelector<HTMLElement>('[aria-selected="true"]')
  if (!box || !el || box.scrollWidth <= box.clientWidth) return
  const b = box.getBoundingClientRect()
  const e = el.getBoundingClientRect()
  box.scrollLeft = Math.max(0, box.scrollLeft + (e.left - b.left) - (b.width - e.width) / 2)
}

function StageLoading({ text }: { text: string }) {
  return (
    <div className={shell.loading} role="status">
      <span className={shell.spinner} aria-hidden />
      {text}
    </div>
  )
}

function LoadError({ T, retry }: { T: ShellDict; retry: () => void }) {
  return (
    <div className={shell.loading} role="alert">
      {T.loadError}
      <button type="button" className={shell.navBtn} onClick={retry}>
        {T.retry}
      </button>
    </div>
  )
}

function ProgressRing({ share, n }: { share: number; n: number }) {
  const r = 13
  const c = 2 * Math.PI * r
  return (
    <span className={shell.ring} data-done={share >= 1 ? 'true' : undefined} aria-hidden>
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r={r} className={shell.ringBg} />
        {share > 0 ? (
          <circle cx="16" cy="16" r={r} className={shell.ringFg} strokeDasharray={`${c * share} ${c}`} transform="rotate(-90 16 16)" />
        ) : null}
      </svg>
      <span className={shell.ringNum}>{share >= 1 ? '✓' : n}</span>
    </span>
  )
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

function PathIcon() {
  return (
    <Svg>
      <path d="M4 6h16M4 12h10M4 18h7" />
    </Svg>
  )
}

function ModeIcon({ mode }: { mode: OV2Mode }) {
  switch (mode) {
    case 'molecule':
      return (
        <Svg>
          <circle cx="12" cy="12" r="3" />
          <circle cx="5" cy="6" r="2" />
          <circle cx="19" cy="6" r="2" />
          <circle cx="12" cy="20" r="2" />
          <path d="M10 10.5 6.5 7.3M14 10.5l3.5-3.2M12 15v3" />
        </Svg>
      )
    case 'constructor':
      return (
        <Svg>
          <path d="m4 17 5-9 6 0 5 9" />
          <path d="M9 8 6 3M15 8l3-5" />
          <circle cx="4" cy="17" r="1.6" />
          <circle cx="20" cy="17" r="1.6" />
        </Svg>
      )
    case 'isomers':
      return (
        <Svg>
          <path d="M3 8h7l3 4M3 16h5l3-4h4l3-4h3M15 12l3 4h3" />
        </Svg>
      )
    case 'synthesis':
      return (
        <Svg>
          <path d="M3 12h13M12 7l5 5-5 5" />
          <circle cx="20" cy="12" r="2" />
        </Svg>
      )
    case 'reactions':
      return (
        <Svg>
          <path d="M9 3v6l-5 9a2 2 0 0 0 1.8 3h12.4A2 2 0 0 0 20 18l-5-9V3" />
          <path d="M8 3h8M7 14h10" />
        </Svg>
      )
    case 'name':
      return (
        <Svg>
          <path d="M4 7V5h16v2M9 19h6M12 5v14" />
        </Svg>
      )
  }
}
