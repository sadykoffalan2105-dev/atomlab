import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LabDomainTabs } from '../components/lab/LabDomainTabs'
import { OrganicMoleculeViewer } from '../components/organicLab/OrganicMoleculeViewer'
import { OrganicNomenclatureMode } from '../components/organicLab/OrganicNomenclatureMode'
import { ResearchBuilderMode } from '../components/learn/research/ResearchBuilderMode'
import { ResearchEquationBuilder } from '../components/learn/research/ResearchEquationBuilder'
import { ResearchIsomersMode } from '../components/learn/research/ResearchIsomersMode'
import {
  defaultMolForLesson,
  lessonForChallengeId,
  lessonForMoleculeId,
  lessonHasBuild,
  lessonHasEquation,
  lessonHasIsomer,
  lessonHasName,
  ORGANIC_CURRICULUM,
  ORGANIC_CURRICULUM_BY_ID,
  pickChapterLabel,
  pickLessonGoal,
  pickLessonTitle,
  resolveOrganicLessonFromLearn,
  type OrganicLesson,
  type OrganicLessonMode,
} from '../data/organicLab/organicCurriculum'
import {
  getLessonProgress,
  isLessonComplete,
  loadOrganicCurriculumProgress,
  markLessonProgress,
  type OrganicCurriculumProgressMap,
} from '../data/organicLab/organicCurriculumProgress'
import {
  ORGANIC_BUILD_CHALLENGES,
  challengeBuildStage,
} from '../data/researchLab/organicBuildCatalog'
import {
  organicMoleculeById,
  pickOrganicClassLabel,
} from '../data/organicLab/organicMoleculeRegistry'
import type { OrganicDisplayMode, OrganicMoleculeDef } from '../data/organicLab/organicMoleculeTypes'
import { useLocale } from '../i18n/useLocale'
import { useT } from '../i18n/useT'
import { sanitizeBackHref } from '../lab/reactorDeepLink'
import labStyles from './LaboratoryPage.module.css'
import styles from './OrganicLabPage.module.css'

function pickName(m: OrganicMoleculeDef, locale: string) {
  if (locale === 'en') return m.nameEn
  if (locale === 'uz') return m.nameUz
  return m.nameRu
}

function pickDesc(m: OrganicMoleculeDef, locale: string) {
  if (locale === 'en') return m.descriptionEn
  if (locale === 'uz') return m.descriptionUz
  return m.descriptionRu
}

function pickEq(m: OrganicMoleculeDef, locale: string) {
  if (locale === 'en') return m.equationEn
  if (locale === 'uz') return m.equationUz
  return m.equationRu
}

function buildableIds(lesson: OrganicLesson): string[] {
  const catalog = new Set(
    ORGANIC_BUILD_CHALLENGES.filter((c) => challengeBuildStage(c) !== 'cage').map((c) => c.id),
  )
  return lesson.challengeIds.filter((id) => catalog.has(id))
}

function parseMode(raw: string | null): OrganicLessonMode | null {
  if (raw === 'view' || raw === 'build' || raw === 'equation' || raw === 'isomer' || raw === 'name') {
    return raw
  }
  return null
}

export function OrganicLabPage() {
  const { t } = useT()
  const { locale } = useLocale()
  const [params, setParams] = useSearchParams()
  /** Пришли из интерактивного учебника (src=): ссылка «назад к учебнику» переживает смену урока/режима в URL. */
  const srcBack = sanitizeBackHref(params.get('src'))
  const [backHref, setBackHref] = useState(srcBack)
  if (srcBack && srcBack !== backHref) setBackHref(srcBack)

  const initialLesson = useMemo(() => {
    const lessonParam = params.get('lesson')
    if (lessonParam && ORGANIC_CURRICULUM_BY_ID[lessonParam]) {
      return ORGANIC_CURRICULUM_BY_ID[lessonParam]!
    }
    const ch = Number(params.get('chapter'))
    if (Number.isFinite(ch) && ch >= 1) {
      const secRaw = params.get('section')
      const sec = secRaw != null ? Number(secRaw) : undefined
      return resolveOrganicLessonFromLearn(ch, sec)
    }
    const challenge = params.get('challenge')
    if (challenge) {
      const fromCh = lessonForChallengeId(challenge)
      if (fromCh) return fromCh
    }
    const mol = params.get('mol')
    if (mol) {
      const fromMol = lessonForMoleculeId(mol)
      if (fromMol) return fromMol
    }
    return ORGANIC_CURRICULUM[0]!
  }, [params])

  const [lessonId, setLessonId] = useState(initialLesson.id)
  const lesson = ORGANIC_CURRICULUM_BY_ID[lessonId] ?? ORGANIC_CURRICULUM[0]!

  const canBuild = lessonHasBuild(lesson) && buildableIds(lesson).length > 0
  const canEquation = lessonHasEquation(lesson)
  const canIsomer = lessonHasIsomer(lesson)
  const canName = lessonHasName(lesson)

  const resolvedMode = useMemo((): OrganicLessonMode => {
    const m = parseMode(params.get('mode'))
    const buildOk = lessonHasBuild(initialLesson) && buildableIds(initialLesson).length > 0
    const eqOk = lessonHasEquation(initialLesson)
    const isoOk = lessonHasIsomer(initialLesson)
    const nameOk = lessonHasName(initialLesson)
    if (m === 'build' && buildOk) return 'build'
    if (m === 'equation' && eqOk) return 'equation'
    if (m === 'isomer' && isoOk) return 'isomer'
    if (m === 'name' && nameOk) return 'name'
    if (m === 'view') return 'view'
    if (params.get('challenge') && buildOk) return 'build'
    return 'view'
  }, [params, initialLesson])

  const [mode, setMode] = useState<OrganicLessonMode>(resolvedMode)
  const [displayMode, setDisplayMode] = useState<OrganicDisplayMode>('ballStick')
  const [showMoreModes, setShowMoreModes] = useState(false)
  /** Телефон: список уроков свёрнут (на широком экране колонка открыта всегда). */
  const [lessonsOpen, setLessonsOpen] = useState(false)
  const [progressMap, setProgressMap] = useState<OrganicCurriculumProgressMap>(() =>
    loadOrganicCurriculumProgress(),
  )

  const molCandidates = useMemo(() => {
    return lesson.challengeIds
      .map((id) => organicMoleculeById[id])
      .filter((m): m is OrganicMoleculeDef => Boolean(m))
  }, [lesson])

  const resolvedMolId = useMemo(() => {
    const mol = params.get('mol')
    if (mol && initialLesson.challengeIds.includes(mol) && organicMoleculeById[mol]) return mol
    const challenge = params.get('challenge')
    if (
      challenge &&
      initialLesson.challengeIds.includes(challenge) &&
      organicMoleculeById[challenge]
    ) {
      return challenge
    }
    return defaultMolForLesson(initialLesson)
  }, [params, initialLesson])

  const [browseMolId, setBrowseMolId] = useState(resolvedMolId)

  useEffect(() => {
    setLessonId(initialLesson.id)
    setBrowseMolId(resolvedMolId)
    setMode(resolvedMode)
  }, [initialLesson.id, resolvedMolId, resolvedMode])
  const displayMol = organicMoleculeById[browseMolId] ?? molCandidates[0] ?? null
  /** Формулы, которые в уроке встречаются больше одного раза (изомеры): у таких чипов — название. */
  const dupFormulas = useMemo(() => {
    const seen = new Map<string, number>()
    for (const m of molCandidates) seen.set(m.formula, (seen.get(m.formula) ?? 0) + 1)
    return new Set([...seen].filter(([, n]) => n > 1).map(([f]) => f))
  }, [molCandidates])
  /** Строка чипов прокручивается: активная молекула всегда в поле зрения (терефталевая кислота — 13-я из 15). */
  const chipsRef = useRef<HTMLDivElement>(null)
  const displayMolId = displayMol?.id
  useEffect(() => {
    const box = chipsRef.current
    const el = box?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!box || !el) return
    if (box.scrollWidth <= box.clientWidth) return
    box.scrollLeft = Math.max(0, el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2)
  }, [displayMolId, mode, lessonId])

  const buildIds = useMemo(() => buildableIds(lesson), [lesson])
  const buildInitialId = useMemo(() => {
    const challenge = params.get('challenge')
    if (challenge && buildIds.includes(challenge)) return challenge
    if (buildIds.includes(browseMolId)) return browseMolId
    return buildIds[0]
  }, [params, buildIds, browseMolId])

  const syncParams = useCallback(
    (next: { lessonId: string; mode: OrganicLessonMode; molId: string }) => {
      const p = new URLSearchParams()
      p.set('lesson', next.lessonId)
      p.set('mode', next.mode)
      p.set('mol', next.molId)
      setParams(p, { replace: true })
    },
    [setParams],
  )

  const selectLesson = useCallback(
    (next: OrganicLesson) => {
      const molId = defaultMolForLesson(next)
      setLessonId(next.id)
      setBrowseMolId(molId)
      setMode('view')
      setDisplayMode('ballStick')
      syncParams({ lessonId: next.id, mode: 'view', molId })
    },
    [syncParams],
  )

  const selectMode = useCallback(
    (next: OrganicLessonMode) => {
      if (next === 'build' && !canBuild) return
      if (next === 'equation' && !canEquation) return
      if (next === 'isomer' && !canIsomer) return
      if (next === 'name' && !canName) return
      setMode(next)
      const molId = browseMolId || defaultMolForLesson(lesson)
      syncParams({ lessonId: lesson.id, mode: next, molId })
    },
    [canBuild, canEquation, canIsomer, canName, browseMolId, lesson, syncParams],
  )

  const selectMol = useCallback(
    (id: string) => {
      if (!organicMoleculeById[id]) return
      setBrowseMolId(id)
      syncParams({ lessonId: lesson.id, mode, molId: id })
    },
    [lesson.id, mode, syncParams],
  )

  const patchProgress = useCallback((lessonKey: string, patch: Parameters<typeof markLessonProgress>[1]) => {
    setProgressMap(markLessonProgress(lessonKey, patch))
  }, [])

  useEffect(() => {
    if (mode === 'view') {
      patchProgress(lesson.id, { viewed: true })
    }
  }, [mode, lesson.id, patchProgress])

  const lessonProgress = getLessonProgress(progressMap, lesson.id)
  const lessonDone = isLessonComplete(lessonProgress, {
    requireBuild: canBuild,
    requireEquation: canEquation,
    requireIsomer: canIsomer,
    requireName: canName,
  })

  const primaryModes: { id: OrganicDisplayMode; label: string }[] = [
    { id: 'ballStick', label: t('organicLab.modeBallStick') },
    { id: 'skeleton2d', label: t('organicLab.modeSkeleton') },
  ]
  const extraModes: { id: OrganicDisplayMode; label: string }[] = [
    { id: 'spaceFill', label: t('organicLab.modeSpaceFill') },
    { id: 'hybridization', label: t('organicLab.modeHybrid') },
  ]

  const chapters = [1, 2, 3, 4] as const

  const modeTab = (id: OrganicLessonMode, label: string, icon: ReactNode, disabled = false) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === id}
      disabled={disabled}
      className={`${styles.modeTab} ${mode === id ? styles.modeTabActive : ''}`}
      onClick={() => selectMode(id)}
    >
      <span className={styles.modeTabIcon} aria-hidden>
        {icon}
      </span>
      <span className={styles.modeTabLabel}>{label}</span>
    </button>
  )

  return (
    <div className={`${labStyles.wrap} ${styles.programWrap}`}>
      <div className={styles.programLayout}>
        <aside
          className={styles.pathPanel}
          aria-label={t('organicLab.programAria')}
          data-open={lessonsOpen ? 'true' : undefined}
        >
          {backHref ? (
            <Link
              className={labStyles.backToBook}
              style={{ position: 'static', alignSelf: 'flex-start', marginBottom: 8 }}
              to={backHref}
              data-lab-back-to-book=""
            >
              {t('lab.deepLink.backToBook')}
            </Link>
          ) : null}
          <div className={styles.domainTabsSlot}>
            <LabDomainTabs active="organic" />
          </div>
          {/* Телефон: программа свёрнута в строку «глава · текущий урок», список раскрывается по нажатию. */}
          <button
            type="button"
            className={styles.pathToggle}
            aria-expanded={lessonsOpen}
            aria-controls="organic-lesson-path"
            onClick={() => setLessonsOpen((v) => !v)}
          >
            <span className={styles.pathToggleIcon} aria-hidden>
              <PathIcon />
            </span>
            <span className={styles.pathToggleText}>
              <span className={styles.pathToggleKicker}>{pickChapterLabel(lesson.chapter, locale)}</span>
              <span className={styles.pathToggleTitle}>{pickLessonTitle(lesson, locale)}</span>
            </span>
            <span className={styles.pathToggleChevron} aria-hidden>
              <ChevronIcon />
            </span>
          </button>
          <div id="organic-lesson-path" className={styles.pathBody}>
            <p className={styles.pathLead}>{t('organicLab.programLead')}</p>
            {chapters.map((ch) => (
              <div key={ch} className={styles.chapterBlock}>
                <h2 className={styles.chapterTitle}>{pickChapterLabel(ch, locale)}</h2>
                <ul className={styles.lessonList}>
                  {ORGANIC_CURRICULUM.filter((l) => l.chapter === ch).map((l) => {
                    const prog = getLessonProgress(progressMap, l.id)
                    const done = isLessonComplete(prog, {
                      requireBuild: lessonHasBuild(l) && buildableIds(l).length > 0,
                      requireEquation: lessonHasEquation(l),
                      requireIsomer: lessonHasIsomer(l),
                      requireName: lessonHasName(l),
                    })
                    const active = l.id === lesson.id
                    return (
                      <li key={l.id}>
                        <button
                          type="button"
                          className={`${styles.lessonBtn} ${active ? styles.lessonBtnActive : ''} ${done ? styles.lessonBtnDone : ''}`}
                          aria-current={active ? 'true' : undefined}
                          onClick={() => {
                            selectLesson(l)
                            setLessonsOpen(false)
                          }}
                        >
                          <span
                            className={styles.lessonCheck}
                            data-state={done ? 'done' : prog.viewed ? 'viewed' : undefined}
                            aria-hidden
                          >
                            {done ? <CheckIcon /> : null}
                          </span>
                          <span className={styles.lessonTitle}>{pickLessonTitle(l, locale)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <div className={styles.mainCol}>
          <header className={styles.lessonHeader}>
            <div className={styles.lessonIntro}>
              <p className={styles.lessonKicker}>{pickChapterLabel(lesson.chapter, locale)}</p>
              <div className={styles.headingRow}>
                <h1 className={styles.lessonHeading}>{pickLessonTitle(lesson, locale)}</h1>
                {lessonDone ? (
                  <p className={styles.lessonComplete}>
                    <CheckIcon />
                    {t('organicLab.progressDone')}
                  </p>
                ) : null}
              </div>
              <p className={styles.lessonGoal}>
                <span className={styles.goalLabel}>{t('organicLab.lessonGoal')}</span>{' '}
                {pickLessonGoal(lesson, locale)}
              </p>
            </div>
            <div className={styles.modeTabs} role="tablist" aria-label={t('organicLab.activityAria')}>
              {modeTab('view', t('organicLab.modeView'), <ViewIcon />)}
              {modeTab('build', t('organicLab.modeBuild'), <BuildIcon />, !canBuild)}
              {modeTab('equation', t('organicLab.modeEquation'), <EquationIcon />, !canEquation)}
              {canIsomer ? modeTab('isomer', t('organicLab.modeIsomer'), <IsomerIcon />) : null}
              {canName ? modeTab('name', t('organicLab.modeName'), <NameIcon />) : null}
            </div>
          </header>

          {mode === 'view' && displayMol ? (
            // data-app-night: 3D-вьюпорт и его HUD задуманы тёмными в обеих темах
            // (ночные токены — src/theme/appTheme.css); шапка и список уроков — по теме.
            <div
              className={styles.viewStage}
              data-app-night=""
              style={{ ['--synth-glow' as string]: displayMol.accentColor ?? '#0a0c18' }}
            >
              <div
                ref={chipsRef}
                className={styles.molChips}
                role="listbox"
                aria-label={t('organicLab.moleculesAria')}
              >
                {molCandidates.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={m.id === displayMol.id}
                    className={`${styles.molChip} ${m.id === displayMol.id ? styles.molChipActive : ''}`}
                    title={`${pickName(m, locale)} · ${m.formula}`}
                    onClick={() => selectMol(m.id)}
                  >
                    {dupFormulas.has(m.formula) ? pickName(m, locale) : m.formula}
                  </button>
                ))}
              </div>

              <OrganicMoleculeViewer mol={displayMol} mode={displayMode} fillParent key={displayMol.id}>
                <div className={styles.hudTop}>
                  <div className={styles.titleCard}>
                    <div className={styles.titleRow}>
                      <strong className={styles.molName}>{pickName(displayMol, locale)}</strong>
                      <span className={styles.molFormula}>{displayMol.formula}</span>
                    </div>
                    <p className={styles.molDesc}>
                      <span className={styles.molClass}>{pickOrganicClassLabel(displayMol.classId, locale)}</span>
                      <span>{pickDesc(displayMol, locale)}</span>
                    </p>
                  </div>
                </div>

                {/* Док HUD: на широком экране дети позиционируются по сцене (display: contents), на телефоне — колонка внизу. */}
                <div className={styles.hudDock}>
                  <div className={styles.modeCol} role="group" aria-label={t('organicLab.modeAria')}>
                    {primaryModes.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={displayMode === m.id}
                        className={`${styles.modeBtn} ${displayMode === m.id ? styles.modeBtnActive : ''}`}
                        onClick={() => setDisplayMode(m.id)}
                      >
                        {m.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-expanded={showMoreModes}
                      className={`${styles.modeBtn} ${styles.modeBtnMore}`}
                      onClick={() => setShowMoreModes((v) => !v)}
                    >
                      {t('organicLab.moreModes')}
                      <ChevronIcon />
                    </button>
                    {showMoreModes
                      ? extraModes.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            aria-pressed={displayMode === m.id}
                            className={`${styles.modeBtn} ${displayMode === m.id ? styles.modeBtnActive : ''}`}
                            onClick={() => setDisplayMode(m.id)}
                          >
                            {m.label}
                          </button>
                        ))
                      : null}
                  </div>

                  {displayMode === 'hybridization' && displayMol.viewHints?.hybridFocus ? (
                    <div className={styles.hybridPanel}>
                      <span className={styles.hybridBadge}>{displayMol.viewHints.hybridFocus}</span>
                      <span>{t('organicLab.hybridHint', { h: displayMol.viewHints.hybridFocus })}</span>
                    </div>
                  ) : null}

                  <div className={styles.hudBottom}>
                    <div className={styles.eqBar}>
                      <span className={styles.eqLabel}>{t('organicLab.equation')}</span>
                      <code className={styles.eqCode}>{pickEq(displayMol, locale)}</code>
                    </div>
                    {canBuild ? (
                      <button type="button" className={styles.primaryLink} onClick={() => selectMode('build')}>
                        <BuildIcon />
                        {t('organicLab.modeBuild')}
                      </button>
                    ) : null}
                  </div>
                </div>
              </OrganicMoleculeViewer>
            </div>
          ) : null}

          {mode === 'build' && canBuild ? (
            <div className={styles.buildStage} data-app-night="">
              <ResearchBuilderMode
                key={`${lesson.id}-${buildInitialId ?? 'build'}`}
                allowedChallengeIds={buildIds}
                initialChallengeId={buildInitialId}
                onMacro={() => {}}
                onBuildComplete={() => patchProgress(lesson.id, { built: true, viewed: true })}
              />
            </div>
          ) : null}

          {mode === 'equation' && canEquation ? (
            <div className={styles.equationStage} data-app-night="">
              <ResearchEquationBuilder
                key={lesson.id}
                onMacro={() => {}}
                allowedEquationIds={lesson.equationIds}
                hideGradeFilters
                onSolved={() => patchProgress(lesson.id, { equation: true, viewed: true })}
              />
            </div>
          ) : null}

          {mode === 'isomer' && canIsomer ? (
            <div className={styles.equationStage} data-app-night="">
              <ResearchIsomersMode
                key={lesson.id}
                allowedChallengeIds={lesson.isomerChallengeIds}
                onComplete={() => patchProgress(lesson.id, { isomer: true, viewed: true })}
              />
            </div>
          ) : null}

          {mode === 'name' && canName && lesson.nomenclatureQuizId ? (
            <div className={styles.equationStage} data-app-night="">
              <OrganicNomenclatureMode
                key={lesson.id}
                quizId={lesson.nomenclatureQuizId}
                quizIds={[lesson.nomenclatureQuizId, ...(lesson.extraQuizIds ?? [])]}
                onComplete={() => patchProgress(lesson.id, { named: true, viewed: true })}
              />
            </div>
          ) : null}

          {mode === 'equation' && !canEquation ? (
            <p className={styles.emptyNote} data-app-night="">{t('organicLab.eqEmpty')}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* ── Иконки (SVG, currentColor) ─────────────────────────── */

function Svg({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

function ViewIcon() {
  return (
    <Svg>
      <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="2" />
    </Svg>
  )
}

function BuildIcon() {
  return (
    <Svg>
      <circle cx="4" cy="4.5" r="2" />
      <circle cx="12" cy="4.5" r="2" />
      <circle cx="8" cy="12" r="2" />
      <path d="M6 4.5h4M5 6.3l2 3.9M11 6.3l-2 3.9" />
    </Svg>
  )
}

function EquationIcon() {
  return (
    <Svg>
      <path d="M2 8h9M8.5 5 11.5 8l-3 3" />
      <path d="M13.5 4.5v7" />
    </Svg>
  )
}

function IsomerIcon() {
  return (
    <Svg>
      <path d="M2.5 5h10M10 2.5 12.5 5 10 7.5" />
      <path d="M13.5 11h-10M6 8.5 3.5 11 6 13.5" />
    </Svg>
  )
}

function NameIcon() {
  return (
    <Svg>
      <path d="M2 3.5v4.1c0 .4.2.8.4 1l5 5c.6.6 1.5.6 2.1 0l3.9-3.9c.6-.6.6-1.5 0-2.1l-5-5c-.3-.3-.6-.4-1-.4H3.5C2.7 2.2 2 2.8 2 3.5Z" />
      <circle cx="5.2" cy="5.4" r="1" />
    </Svg>
  )
}

function PathIcon() {
  return (
    <Svg size={18}>
      <path d="M3 2.5h7.5a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2v-9Z" />
      <path d="M3 11.5a2 2 0 0 1 2-2h7.5M6 5.5h4" />
    </Svg>
  )
}

function ChevronIcon() {
  return (
    <Svg size={14}>
      <path d="M4 6.5 8 10.5l4-4" />
    </Svg>
  )
}

function CheckIcon() {
  return (
    <Svg size={12}>
      <path d="M3.5 8.4 6.6 11.4 12.5 4.8" strokeWidth="2" />
    </Svg>
  )
}
