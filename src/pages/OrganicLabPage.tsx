import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LabDomainTabs } from '../components/lab/LabDomainTabs'
import { OrganicMoleculeViewer } from '../components/organicLab/OrganicMoleculeViewer'
import { ResearchBuilderMode } from '../components/learn/research/ResearchBuilderMode'
import { ResearchEquationBuilder } from '../components/learn/research/ResearchEquationBuilder'
import {
  defaultMolForLesson,
  lessonForChallengeId,
  lessonForMoleculeId,
  lessonHasBuild,
  lessonHasEquation,
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
  if (raw === 'view' || raw === 'build' || raw === 'equation') return raw
  return null
}

export function OrganicLabPage() {
  const { t } = useT()
  const { locale } = useLocale()
  const [params, setParams] = useSearchParams()

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

  const resolvedMode = useMemo((): OrganicLessonMode => {
    const m = parseMode(params.get('mode'))
    const buildOk = lessonHasBuild(initialLesson) && buildableIds(initialLesson).length > 0
    const eqOk = lessonHasEquation(initialLesson)
    if (m === 'build' && buildOk) return 'build'
    if (m === 'equation' && eqOk) return 'equation'
    if (m === 'view') return 'view'
    if (params.get('challenge') && buildOk) return 'build'
    return 'view'
  }, [params, initialLesson])

  const [mode, setMode] = useState<OrganicLessonMode>(resolvedMode)
  const [displayMode, setDisplayMode] = useState<OrganicDisplayMode>('ballStick')
  const [showMoreModes, setShowMoreModes] = useState(false)
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
      setMode(next)
      const molId = browseMolId || defaultMolForLesson(lesson)
      syncParams({ lessonId: lesson.id, mode: next, molId })
    },
    [canBuild, canEquation, browseMolId, lesson, syncParams],
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

  return (
    <div className={`${labStyles.wrap} ${styles.programWrap}`}>
      <div className={labStyles.domainBar}>
        <LabDomainTabs active="organic" />
      </div>

      <div className={styles.programLayout}>
        <aside className={styles.pathPanel} aria-label={t('organicLab.programAria')}>
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
                  })
                  const active = l.id === lesson.id
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        className={`${styles.lessonBtn} ${active ? styles.lessonBtnActive : ''} ${done ? styles.lessonBtnDone : ''}`}
                        onClick={() => selectLesson(l)}
                      >
                        <span className={styles.lessonCheck} aria-hidden>
                          {done ? '✓' : prog.viewed ? '·' : ''}
                        </span>
                        <span>{pickLessonTitle(l, locale)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </aside>

        <div className={styles.mainCol}>
          <header className={styles.lessonHeader}>
            <div>
              <h1 className={styles.lessonHeading}>{pickLessonTitle(lesson, locale)}</h1>
              <p className={styles.lessonGoal}>
                <span className={styles.goalLabel}>{t('organicLab.lessonGoal')}</span>{' '}
                {pickLessonGoal(lesson, locale)}
              </p>
              {lessonDone ? (
                <p className={styles.lessonComplete}>{t('organicLab.progressDone')}</p>
              ) : null}
            </div>
            <div className={styles.modeTabs} role="tablist" aria-label={t('organicLab.activityAria')}>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'view'}
                className={`${styles.modeTab} ${mode === 'view' ? styles.modeTabActive : ''}`}
                onClick={() => selectMode('view')}
              >
                {t('organicLab.modeView')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'build'}
                disabled={!canBuild}
                className={`${styles.modeTab} ${mode === 'build' ? styles.modeTabActive : ''}`}
                onClick={() => selectMode('build')}
              >
                {t('organicLab.modeBuild')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'equation'}
                disabled={!canEquation}
                className={`${styles.modeTab} ${mode === 'equation' ? styles.modeTabActive : ''}`}
                onClick={() => selectMode('equation')}
              >
                {t('organicLab.modeEquation')}
              </button>
            </div>
          </header>

          {mode === 'view' && displayMol ? (
            <div
              className={styles.viewStage}
              style={{ ['--synth-glow' as string]: displayMol.accentColor ?? '#0a0c18' }}
            >
              <div className={styles.molChips} role="listbox" aria-label={t('organicLab.moleculesAria')}>
                {molCandidates.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={m.id === displayMol.id}
                    className={`${styles.molChip} ${m.id === displayMol.id ? styles.molChipActive : ''}`}
                    onClick={() => selectMol(m.id)}
                  >
                    {m.formula}
                  </button>
                ))}
              </div>

              <OrganicMoleculeViewer mol={displayMol} mode={displayMode} fillParent key={displayMol.id}>
                <div className={styles.hudTop}>
                  <div className={styles.titleCard}>
                    <strong>
                      {pickName(displayMol, locale)} | {displayMol.formula}
                    </strong>
                    <p>
                      {pickOrganicClassLabel(displayMol.classId, locale)} · {pickDesc(displayMol, locale)}
                    </p>
                  </div>
                  <div className={styles.modeCol} role="group" aria-label={t('organicLab.modeAria')}>
                    {primaryModes.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`${styles.modeBtn} ${displayMode === m.id ? styles.modeBtnActive : ''}`}
                        onClick={() => setDisplayMode(m.id)}
                      >
                        {m.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={styles.modeBtn}
                      onClick={() => setShowMoreModes((v) => !v)}
                    >
                      {t('organicLab.moreModes')}
                    </button>
                    {showMoreModes
                      ? extraModes.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className={`${styles.modeBtn} ${displayMode === m.id ? styles.modeBtnActive : ''}`}
                            onClick={() => setDisplayMode(m.id)}
                          >
                            {m.label}
                          </button>
                        ))
                      : null}
                  </div>
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
                      {t('organicLab.modeBuild')}
                    </button>
                  ) : null}
                </div>
              </OrganicMoleculeViewer>
            </div>
          ) : null}

          {mode === 'build' && canBuild ? (
            <div className={styles.buildStage}>
              <ResearchBuilderMode
                key={`${lesson.id}-${buildInitialId ?? 'build'}`}
                variant="labBuild"
                allowedChallengeIds={buildIds}
                initialChallengeId={buildInitialId}
                hideEquationAside
                onMacro={() => {}}
                onBuildComplete={() => patchProgress(lesson.id, { built: true, viewed: true })}
              />
            </div>
          ) : null}

          {mode === 'equation' && canEquation ? (
            <div className={styles.equationStage}>
              <ResearchEquationBuilder
                key={lesson.id}
                onMacro={() => {}}
                allowedEquationIds={lesson.equationIds}
                hideGradeFilters
                onSolved={() => patchProgress(lesson.id, { equation: true, viewed: true })}
              />
            </div>
          ) : null}

          {mode === 'equation' && !canEquation ? (
            <p className={styles.emptyNote}>{t('organicLab.eqEmpty')}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
