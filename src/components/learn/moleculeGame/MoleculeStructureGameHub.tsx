import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { filterCompoundsForCatalog } from '../../../data/compoundCatalogFilter'
import {
  atomCount,
  bondCount,
  formatComposition,
  MOLECULE_GAME_COMPOUNDS,
} from '../../../data/moleculeStructureGame'
import {
  formatGradeRange,
  inorganicGradesForId,
  isSchoolGrade,
  SCHOOL_GRADES,
  type SchoolGrade,
} from '../../../data/curriculum/compoundGradeIndex'
import { isCatalogVisibleId } from '../../../data/textbook/catalogWhitelist'
import { getCompoundLocaleStrings, compoundSearchBlob } from '../../../i18n/compoundLocale'
import type { MessageKey } from '../../../i18n/messagesRu'
import { useT } from '../../../i18n/useT'
import {
  CLASS_ROSTER_CHANGED,
  getActiveStudent,
  recordStudentTestResult,
  type ClassStudent,
} from '../../../learn/learnClassRosterStorage'
import { buildMoleculeTest, type MoleculeTestQuestion } from '../../../learn/moleculeQuizEngine'
import {
  computeStudentTestScore,
  studentTestGradeLabel,
  type StudentTestLength,
} from '../../../learn/studentTestScoring'
import type { CompoundDef } from '../../../types/chemistry'
import { LearnShellIcon } from '../LearnShellIcon'
import { Kbd, StudioEmptyState } from '../studio/StudioKit'
import kit from '../studio/StudioKit.module.css'
import { MoleculeStructureCanvas } from './MoleculeStructureCanvas'
import { ValencyBalanceTutor } from '../ValencyBalanceTutor'
import styles from './MoleculeStructureGameHub.module.css'

type Mode = 'learn' | 'test' | 'balance'
type InfoTab = 'structure' | 'about' | 'recipe'
type TestPhase = 'setup' | 'running' | 'results'
type Category = CompoundDef['category']
type GradeFilter = SchoolGrade | 'all'

const VIEWED_KEY = 'atomlab.moleculeStructure.viewed'
const MIN_VIEWED_FOR_TEST = 3
/** Сколько строк списка рисуем за раз («показать ещё» добавляет столько же). */
const LIST_PAGE = 60
const CATEGORIES: readonly Category[] = ['oxide', 'acid', 'base', 'salt', 'other']

/** В каталоге и списках выбора — только видимые вещества учебника. */
const VISIBLE_COMPOUNDS: readonly CompoundDef[] = MOLECULE_GAME_COMPOUNDS.filter((c) =>
  isCatalogVisibleId(c.id),
)

function loadViewed(): Set<string> {
  try {
    const raw = localStorage.getItem(VIEWED_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveViewed(set: Set<string>) {
  try {
    localStorage.setItem(VIEWED_KEY, JSON.stringify([...set]))
  } catch {
    /* приватный режим — прогресс живёт только в памяти */
  }
}

function categoryKey(cat: Category): MessageKey {
  const m: Record<Category, MessageKey> = {
    oxide: 'category.kind.oxide',
    acid: 'category.kind.acid',
    base: 'category.kind.base',
    salt: 'category.kind.salt',
    other: 'category.kind.other',
  }
  return m[cat]
}

function categoryPluralKey(cat: Category): MessageKey {
  const m: Record<Category, MessageKey> = {
    oxide: 'learn.studio.viz.cat.oxide',
    acid: 'learn.studio.viz.cat.acid',
    base: 'learn.studio.viz.cat.base',
    salt: 'learn.studio.viz.cat.salt',
    other: 'learn.studio.viz.cat.other',
  }
  return m[cat]
}

function compoundsForGrade(grade: GradeFilter): readonly CompoundDef[] {
  if (grade === 'all') return VISIBLE_COMPOUNDS
  return VISIBLE_COMPOUNDS.filter((c) => inorganicGradesForId(c.id).includes(grade))
}

/** Класс урока из id сцены (`topic_g7_c1_s01`) — фильтр по умолчанию; иначе «все». */
function gradeFromSection(sectionId?: string): GradeFilter {
  const m = sectionId?.match(/^topic_g(\d{1,2})_/i)
  const n = m ? Number(m[1]) : Number.NaN
  if (!isSchoolGrade(n)) return 'all'
  return compoundsForGrade(n).length > 0 ? n : 'all'
}

/* ——— Иконки (inline SVG, декоративные) ——— */

type IconProps = { className?: string }

function Icon({ children, className }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className ?? styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  )
}

function IconCube({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 2.8 20 7.2v9.6l-8 4.4-8-4.4V7.2z" />
      <path d="M4 7.2 12 11.6l8-4.4M12 11.6v9.6" />
    </Icon>
  )
}

function IconScale({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z" />
    </Icon>
  )
}

function IconQuiz({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="m8 9 1.5 1.5L12 8M8 15.5l1.5 1.5L12 14.5M14.5 9.5H16M14.5 16H16" />
    </Icon>
  )
}

function IconArrowRight({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  )
}

function IconSearch({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </Icon>
  )
}

function IconCheck({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  )
}

function IconCross({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  )
}

function IconAtom({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="1.6" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(120 12 12)" />
    </Icon>
  )
}

function IconBond({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="12" r="3" />
      <path d="M9 10.5h6M9 13.5h6" />
    </Icon>
  )
}

function IconRetry({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
    </Icon>
  )
}

function IconUser({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Icon>
  )
}

function IconRotate({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M20 12a8 8 0 1 1-2.35-5.65M20 4v4.5h-4.5" />
    </Icon>
  )
}

function IconTarget({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Icon>
  )
}

function IconShuffle({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M3 7h3.5c1.4 0 2.7.7 3.5 1.8L14 15.2a4.3 4.3 0 0 0 3.5 1.8H21M3 17h3.5c1.4 0 2.7-.7 3.5-1.8M14 8.8A4.3 4.3 0 0 1 17.5 7H21" />
      <path d="m18.5 4.5 2.5 2.5-2.5 2.5M18.5 14.5l2.5 2.5-2.5 2.5" />
    </Icon>
  )
}

function IconHand({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11M11 10V5a1.5 1.5 0 0 1 3 0v6M14 10.5V7a1.5 1.5 0 0 1 3 0v6.5a6.5 6.5 0 0 1-6.5 6.5h-.3a6 6 0 0 1-4.6-2.2L3.5 14.8a1.5 1.5 0 0 1 2.3-1.9L8 15" />
    </Icon>
  )
}

/** Иллюстрация для пустых состояний (градиентный круг + сюжет). */
function StateArt({
  className,
  variant = 'molecule',
}: {
  className?: string
  variant?: 'molecule' | 'lock' | 'test'
}) {
  const gid = `molArt${useId().replace(/:/g, '')}`
  const paint = `url(#${gid})`
  return (
    <svg className={className} viewBox="0 0 80 80" aria-hidden focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--studio-tone, #22d3ee)" />
          <stop offset="55%" stopColor="var(--lt-primary, #5b8cff)" />
          <stop offset="100%" stopColor="var(--lt-primary-2, #8b5cf6)" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill={paint} opacity="0.16" />
      <circle cx="40" cy="40" r="37.5" fill="none" stroke={paint} strokeOpacity="0.55" />
      {variant === 'lock' ? (
        <g fill="none" stroke={paint} strokeWidth="3.2" strokeLinecap="round">
          <rect x="26" y="36" width="28" height="22" rx="6" />
          <path d="M31 36v-6a9 9 0 0 1 18 0v6" />
          <path d="M40 45v5" />
        </g>
      ) : variant === 'test' ? (
        <g fill="none" stroke={paint} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="25" y="20" width="30" height="40" rx="6" />
          <path d="m31 32 3 3 5-5M31 46l3 3 5-5M44 33h5M44 47h5" />
        </g>
      ) : (
        <g>
          <path
            d="M26 50 40 32l14 16"
            stroke="var(--lt-text-3, #8793b8)"
            strokeWidth="3"
            fill="none"
          />
          <circle cx="40" cy="32" r="8" fill="var(--lt-primary, #5b8cff)" />
          <circle cx="26" cy="50" r="6" fill="var(--lt-accent-teal, #2dd4bf)" />
          <circle cx="54" cy="48" r="6" fill="var(--lt-accent-pink, #f472b6)" />
        </g>
      )}
    </svg>
  )
}

/** Декоративная полоса прогресса: текстовое значение всегда рядом. */
function ProgressBar({
  value,
  max,
  className,
}: {
  value: number
  max: number
  className?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div
      className={className ? `${styles.progressTrack} ${className}` : styles.progressTrack}
      aria-hidden
    >
      <span className={styles.progressFill} style={{ width: `${pct}%` }} />
    </div>
  )
}

function ScoreRing({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? score / max : 0
  const circumference = 283
  const offset = circumference * (1 - pct)
  const gradId = `molScoreGrad${useId().replace(/:/g, '')}`

  return (
    <div className={styles.scoreRing}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--studio-tone, #22d3ee)" />
            <stop offset="55%" stopColor="var(--lt-primary, #5b8cff)" />
            <stop offset="100%" stopColor="var(--lt-primary-2, #8b5cf6)" />
          </linearGradient>
        </defs>
        <circle className={styles.scoreRingBg} cx="50" cy="50" r="45" />
        <circle
          className={styles.scoreRingFill}
          cx="50"
          cy="50"
          r="45"
          stroke={`url(#${gradId})`}
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <div className={styles.scoreValue}>
        <span className={styles.scoreNumber}>{score}</span>
        <span className={styles.scoreOf}>/ {max}</span>
      </div>
    </div>
  )
}

function CompoundInfoPanel({ compound }: { compound: CompoundDef }) {
  const { locale, t } = useT()
  const uid = useId().replace(/:/g, '')
  const [tab, setTab] = useState<InfoTab>('structure')
  const loc = getCompoundLocaleStrings(compound, locale, t)
  const tabs: readonly InfoTab[] = ['structure', 'about', 'recipe']

  const onTabsKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const i = tabs.indexOf(tab)
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]!
    setTab(next)
    document.getElementById(`${uid}-tab-${next}`)?.focus()
  }

  return (
    <div className={styles.infoPanel} data-info-tab={tab}>
      <div className={styles.infoHead}>
        <h3 className={styles.infoTitle} title={loc.name}>
          {loc.name}
        </h3>
        <span className={styles.infoFormula}>{compound.formulaUnicode}</span>
        <span className={styles.catChip} data-cat={compound.category}>
          {t(categoryKey(compound.category))}
        </span>
      </div>
      <div className={`${kit.tabs} ${styles.infoTabs}`} role="tablist" onKeyDown={onTabsKeyDown}>
        {tabs.map((id) => (
          <button
            key={id}
            id={`${uid}-tab-${id}`}
            type="button"
            role="tab"
            className={`${kit.tab} ${tab === id ? kit.tabActive : ''} ${styles.infoTab}`}
            onClick={() => setTab(id)}
            aria-selected={tab === id}
            aria-controls={`${uid}-panel`}
            tabIndex={tab === id ? 0 : -1}
          >
            {t(`learn.molecules.structure.tab.${id}`)}
          </button>
        ))}
      </div>
      <div
        id={`${uid}-panel`}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${tab}`}
        className={`${kit.scrollArea} ${styles.infoBody}`}
      >
        {tab === 'structure' ? (
          <>
            <p className={styles.infoText}>{t('learn.molecules.structure.structureIntro')}</p>
            <div className={styles.statsGrid}>
              <div className={`${kit.stat} ${styles.stat}`}>
                <span className={`${kit.statValue} ${styles.statValue}`}>
                  <IconAtom className={styles.statIcon} />
                  {atomCount(compound)}
                </span>
                <span className={kit.statLabel}>{t('learn.studio.viz.statAtoms')}</span>
              </div>
              <div className={`${kit.stat} ${styles.stat}`}>
                <span className={`${kit.statValue} ${styles.statValue}`}>
                  <IconBond className={styles.statIcon} />
                  {bondCount(compound)}
                </span>
                <span className={kit.statLabel}>
                  {t('learn.molecules.structure.bonds', { count: '' }).replace(/[:\s]+$/, '')}
                </span>
              </div>
              <div className={`${kit.stat} ${styles.stat}`}>
                <span className={`${kit.statValue} ${styles.statValue} ${styles.statMono}`}>
                  {formatComposition(compound.composition)}
                </span>
                <span className={kit.statLabel}>{t('learn.studio.viz.statFormula')}</span>
              </div>
              <div
                className={`${kit.stat} ${styles.stat} ${styles.statCat}`}
                data-cat={compound.category}
              >
                <span className={`${kit.statValue} ${styles.statValue} ${styles.statCatValue}`}>
                  {t(categoryKey(compound.category))}
                </span>
                <span className={kit.statLabel}>{t('learn.studio.viz.statCategory')}</span>
              </div>
            </div>
          </>
        ) : null}
        {tab === 'about' ? <p className={styles.infoText}>{loc.description}</p> : null}
        {tab === 'recipe' ? <p className={styles.infoText}>{loc.laboratoryRecipe}</p> : null}
      </div>
    </div>
  )
}

function MoleculeStructureTest({
  presentationMode,
  sectionId,
  viewedCount,
  minViewed,
  onGoLearn,
}: {
  presentationMode: boolean
  sectionId?: string
  viewedCount: number
  minViewed: number
  /** CTA пустого состояния «тест закрыт»: вернуться к каталогу */
  onGoLearn?: () => void
}) {
  const { locale, t } = useT()
  const [phase, setPhase] = useState<TestPhase>('setup')
  const [length, setLength] = useState<StudentTestLength>(5)
  const [questions, setQuestions] = useState<MoleculeTestQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [correctFlags, setCorrectFlags] = useState<boolean[]>([])
  const [wrongIds, setWrongIds] = useState<string[]>([])
  const [answered, setAnswered] = useState(false)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<'ok' | 'bad' | null>(null)
  const [activeStudent, setActiveStudent] = useState<ClassStudent | null>(() =>
    sectionId ? getActiveStudent(sectionId) : null,
  )

  useEffect(() => {
    if (!sectionId) return
    const reload = () => setActiveStudent(getActiveStudent(sectionId))
    reload()
    window.addEventListener(CLASS_ROSTER_CHANGED, reload)
    return () => window.removeEventListener(CLASS_ROSTER_CHANGED, reload)
  }, [sectionId])

  const testUnlocked = presentationMode || viewedCount >= minViewed
  const question = questions[index] ?? null
  const total = questions.length
  const correctCount = correctFlags.filter(Boolean).length
  const score = computeStudentTestScore(correctCount, length)
  const gradeKey = studentTestGradeLabel(score, length)
  const gradeMessage = t(`learn.studentTest.grade.${gradeKey}` as MessageKey)

  const startTest = useCallback(() => {
    setQuestions(buildMoleculeTest(length))
    setIndex(0)
    setCorrectFlags([])
    setWrongIds([])
    setAnswered(false)
    setPickedId(null)
    setFeedback(null)
    setPhase('running')
  }, [length])

  const finishAndSave = useCallback(
    (flags: boolean[], wrong: string[]) => {
      const correct = flags.filter(Boolean).length
      const finalScore = computeStudentTestScore(correct, length)
      if (sectionId && activeStudent) {
        recordStudentTestResult(sectionId, activeStudent.id, {
          kind: 'molecule',
          score: finalScore,
          total: length,
          correct,
          wrongQuestionIds: wrong.length > 0 ? wrong : undefined,
        })
      }
      setPhase('results')
    },
    [activeStudent, length, sectionId],
  )

  const onPick = (id: string) => {
    if (!question || answered) return
    setPickedId(id)
    setAnswered(true)
    const ok = id === question.correct.id
    setFeedback(ok ? 'ok' : 'bad')
    const nextFlags = [...correctFlags, ok]
    setCorrectFlags(nextFlags)
    if (!ok) setWrongIds((prev) => [...prev, question.correct.id])
  }

  const goNext = () => {
    if (!question) return
    if (index + 1 >= total) {
      finishAndSave(correctFlags, wrongIds)
      return
    }
    setIndex((i) => i + 1)
    setAnswered(false)
    setPickedId(null)
    setFeedback(null)
  }

  const restart = () => {
    setPhase('setup')
    setQuestions([])
    setIndex(0)
    setCorrectFlags([])
    setWrongIds([])
    setAnswered(false)
    setPickedId(null)
    setFeedback(null)
  }

  if (!testUnlocked) {
    return (
      <div className={styles.quizLayout}>
        <div className={styles.stateCard}>
          <StateArt className={styles.stateArt} variant="lock" />
          <p className={styles.lockedHint}>
            {t('learn.molecules.structure.testLocked', {
              viewed: String(viewedCount),
              need: String(minViewed),
            })}
          </p>
          <ProgressBar value={viewedCount} max={minViewed} className={styles.lockedProgress} />
          {onGoLearn ? (
            <button type="button" className={`${kit.btnPrimary} ${styles.btn}`} onClick={onGoLearn}>
              <IconCube />
              {t('learn.molecules.structure.modeLearn')}
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  if (phase === 'setup') {
    return (
      <div className={`${styles.testSetup} ${presentationMode ? styles.testSetupPresent : ''}`}>
        <div className={styles.stateCard}>
          <StateArt className={styles.stateArt} variant="test" />
          <h3 className={styles.testSetupTitle}>{t('learn.molecules.structure.testSetupTitle')}</h3>
          <p className={styles.testSetupLead}>{t('learn.molecules.structure.testSetupLead')}</p>
          {activeStudent ? (
            <p className={styles.testStudent}>
              <IconUser />
              {t('learn.molecules.structure.testForStudent', {
                name: activeStudent.name,
              })}
            </p>
          ) : (
            <p className={styles.testStudentHint}>{t('learn.molecules.structure.testNoStudent')}</p>
          )}
          <div
            className={`${kit.segmented} ${styles.countPicker}`}
            role="group"
            aria-label={t('learn.studentTest.pickCount')}
          >
            <button
              type="button"
              className={`${kit.segmentedItem} ${length === 5 ? kit.segmentedItemActive : ''} ${styles.countBtn}`}
              onClick={() => setLength(5)}
              aria-pressed={length === 5}
            >
              {t('learn.studentTest.questions5')}
            </button>
            <button
              type="button"
              className={`${kit.segmentedItem} ${length === 10 ? kit.segmentedItemActive : ''} ${styles.countBtn}`}
              onClick={() => setLength(10)}
              aria-pressed={length === 10}
            >
              {t('learn.studentTest.questions10')}
            </button>
          </div>
          <button type="button" className={`${kit.btnPrimary} ${styles.btn}`} onClick={startTest}>
            {t('learn.studentTest.start')}
            <IconArrowRight />
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'results') {
    return (
      <div className={`${styles.testResults} ${presentationMode ? styles.testResultsPresent : ''}`}>
        <div className={styles.stateCard}>
          <ScoreRing score={score} max={length} />
          <h3 className={styles.resultsTitle}>{t('learn.studentTest.resultsTitle')}</h3>
          {activeStudent ? (
            <p className={styles.testStudent}>
              <IconUser />
              {activeStudent.name}
            </p>
          ) : null}
          <p className={styles.resultsGrade}>{gradeMessage}</p>
          <div className={styles.resultsStats}>
            <div className={`${styles.resultStat} ${styles.resultStatOk}`}>
              <span className={styles.resultStatValue}>{correctCount}</span>
              <span className={styles.resultStatLabel}>{t('learn.studentTest.correctCount')}</span>
            </div>
            <div className={`${styles.resultStat} ${styles.resultStatBad}`}>
              <span className={styles.resultStatValue}>{length - correctCount}</span>
              <span className={styles.resultStatLabel}>{t('learn.studentTest.wrongCount')}</span>
            </div>
          </div>
          <p className={styles.scoringHint}>
            {t('learn.studentTest.scoringHint', { max: length })}
          </p>
          <div className={styles.quizActions}>
            <button type="button" className={`${kit.btnPrimary} ${styles.btn}`} onClick={restart}>
              <IconRetry />
              {t('learn.studentTest.retry')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!question) return null

  const correctLoc = getCompoundLocaleStrings(question.correct, locale, t)

  return (
    <div className={`${styles.quizLayout} ${presentationMode ? styles.quizLayoutPresent : ''}`}>
      <div className={styles.quizTopRow}>
        <p className={styles.quizQuestion}>{t('learn.molecules.structure.quizQuestion')}</p>
        <span className={styles.quizScore}>
          {t('learn.molecules.structure.testProgress', {
            current: String(index + 1),
            total: String(total),
            correct: String(correctCount),
          })}
        </span>
      </div>
      <ProgressBar value={index + (answered ? 1 : 0)} max={total} className={styles.quizBar} />
      <div className={`${styles.viewerBox} ${styles.quizViewer}`}>
        <div className={styles.viewerInner}>
          <MoleculeStructureCanvas compound={question.correct} quizMode compact />
        </div>
      </div>
      <p className={styles.quizPrompt}>{t('learn.molecules.structure.quizPrompt')}</p>
      <div
        className={styles.quizOptions}
        role="group"
        aria-label={t('learn.molecules.structure.quizQuestion')}
      >
        {question.options.map((opt, optIndex) => {
          const loc = getCompoundLocaleStrings(opt, locale, t)
          const isCorrect = answered && opt.id === question.correct.id
          const isWrong = answered && pickedId === opt.id && opt.id !== question.correct.id
          let cls = styles.quizOption
          if (isCorrect) cls += ` ${styles.quizOptionCorrect}`
          else if (isWrong) cls += ` ${styles.quizOptionWrong}`
          return (
            <button
              key={`${index}-${opt.id}`}
              type="button"
              className={cls}
              disabled={answered}
              onClick={() => onPick(opt.id)}
            >
              <span className={styles.quizOptionLetter} aria-hidden>
                {String.fromCharCode(65 + optIndex)}
              </span>
              <span className={styles.quizOptionBody}>
                {loc.name}
                <span className={styles.quizOptionFormula}>{opt.formulaUnicode}</span>
              </span>
              {isCorrect ? <IconCheck className={styles.quizOptionMark} /> : null}
              {isWrong ? <IconCross className={styles.quizOptionMark} /> : null}
            </button>
          )
        })}
      </div>
      <div
        className={`${styles.quizFeedback} ${
          feedback === 'ok'
            ? styles.quizFeedbackOk
            : feedback === 'bad'
              ? styles.quizFeedbackBad
              : ''
        }`}
        role="status"
      >
        {feedback === 'ok' ? <IconCheck /> : feedback === 'bad' ? <IconCross /> : null}
        {feedback === 'ok'
          ? t('learn.molecules.structure.quizCorrect')
          : feedback === 'bad'
            ? t('learn.molecules.structure.quizWrong', {
                name: correctLoc.name,
                formula: question.correct.formulaUnicode,
              })
            : ' '}
      </div>
      <div className={styles.quizActions}>
        {answered ? (
          <button type="button" className={`${kit.btnPrimary} ${styles.btn}`} onClick={goNext}>
            {index + 1 >= total ? t('learn.studentTest.seeResults') : t('learn.studentTest.next')}
            <IconArrowRight />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function MoleculeStructureGameHub({
  presentationMode = false,
  sectionId,
}: {
  presentationMode?: boolean
  sectionId?: string
}) {
  const { locale, t } = useT()
  const uid = useId().replace(/:/g, '')
  const [mode, setMode] = useState<Mode>('learn')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [grade, setGrade] = useState<GradeFilter>(() => gradeFromSection(sectionId))
  const [limit, setLimit] = useState(LIST_PAGE)
  const [selectedId, setSelectedId] = useState<string | null>(
    () => compoundsForGrade(gradeFromSection(sectionId))[0]?.id ?? VISIBLE_COMPOUNDS[0]?.id ?? null,
  )
  const [viewed, setViewed] = useState<Set<string>>(() => loadViewed())
  const [autoRotate, setAutoRotate] = useState(true)
  const [resetToken, setResetToken] = useState(0)
  const [hintSeen, setHintSeen] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!presentationMode) return
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.altKey || e.ctrlKey || e.metaKey) return
      if (e.key === 'ArrowLeft') setMode('learn')
      if (e.key === 'ArrowRight') setMode('test')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [presentationMode])

  const searchBlob = useCallback((c: CompoundDef) => compoundSearchBlob(c, locale, t), [locale, t])

  const byGrade = useMemo(() => compoundsForGrade(grade), [grade])
  /** Совпадения по поиску без учёта класса вещества — для счётчиков на чипах. */
  const bySearch = useMemo(
    () => filterCompoundsForCatalog(byGrade, search, 'all', searchBlob),
    [byGrade, search, searchBlob],
  )
  const filtered = useMemo(
    () => (category === 'all' ? bySearch : bySearch.filter((c) => c.category === category)),
    [bySearch, category],
  )
  const categoryCounts = useMemo(() => {
    const counts: Record<Category, number> = {
      oxide: 0,
      acid: 0,
      base: 0,
      salt: 0,
      other: 0,
    }
    for (const c of bySearch) counts[c.category] += 1
    return counts
  }, [bySearch])

  const shown = filtered.length > limit ? filtered.slice(0, limit) : filtered
  const hiddenCount = filtered.length - shown.length

  const selected = selectedId ? (VISIBLE_COMPOUNDS.find((c) => c.id === selectedId) ?? null) : null
  const selectedPos = selectedId ? filtered.findIndex((c) => c.id === selectedId) : -1

  const viewedCount = useMemo(
    () => VISIBLE_COMPOUNDS.reduce((n, c) => n + (viewed.has(c.id) ? 1 : 0), 0),
    [viewed],
  )
  const total = VISIBLE_COMPOUNDS.length

  const markViewed = useCallback((id: string) => {
    setViewed((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      saveViewed(next)
      return next
    })
  }, [])

  const rowId = (id: string) => `${uid}-row-${id}`

  const selectCompound = (id: string, reveal = false) => {
    markViewed(id)
    setSelectedId(id)
    if (reveal) {
      window.requestAnimationFrame(() => {
        document.getElementById(rowId(id))?.scrollIntoView({ block: 'nearest' })
      })
    }
  }

  const step = (delta: number) => {
    if (filtered.length === 0) return
    const base = selectedPos < 0 ? (delta > 0 ? -1 : 0) : selectedPos
    const next = (base + delta + filtered.length) % filtered.length
    selectCompound(filtered[next]!.id, true)
  }

  const pickRandom = () => {
    if (filtered.length === 0) return
    if (filtered.length === 1) {
      selectCompound(filtered[0]!.id, true)
      return
    }
    let i = Math.floor(Math.random() * filtered.length)
    if (filtered[i]!.id === selectedId) i = (i + 1) % filtered.length
    selectCompound(filtered[i]!.id, true)
  }

  const onSearchChange = (value: string) => {
    setSearch(value)
    setLimit(LIST_PAGE)
  }
  const onCategory = (value: Category | 'all') => {
    setCategory(value)
    setLimit(LIST_PAGE)
  }
  const onGrade = (value: GradeFilter) => {
    setGrade(value)
    setLimit(LIST_PAGE)
  }
  const resetFilters = () => {
    setSearch('')
    setCategory('all')
    setGrade('all')
    setLimit(LIST_PAGE)
  }

  const focusRow = (index: number) => {
    const rows = listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-row]')
    if (!rows || rows.length === 0) return
    const i = Math.max(0, Math.min(rows.length - 1, index))
    rows[i]?.focus()
    rows[i]?.scrollIntoView({ block: 'nearest' })
  }

  const onListKeyDown = (e: ReactKeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-row]') ?? [],
    )
    if (rows.length === 0) return
    const current = rows.indexOf(document.activeElement as HTMLButtonElement)
    e.preventDefault()
    if (e.key === 'Home') focusRow(0)
    else if (e.key === 'End') focusRow(rows.length - 1)
    else if (e.key === 'ArrowDown') focusRow(current + 1)
    else if (current <= 0) searchRef.current?.focus()
    else focusRow(current - 1)
  }

  const onSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusRow(Math.max(0, selectedPos))
    } else if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault()
      selectCompound(filtered[0]!.id, true)
    } else if (e.key === 'Escape' && search) {
      e.preventDefault()
      onSearchChange('')
    }
  }

  const rootClass = [
    styles.moleculeGame,
    presentationMode ? styles.moleculeGamePresent : '',
    mode === 'test' ? styles.moleculeGameQuiz : '',
    presentationMode && mode === 'learn' ? styles.moleculeGamePresentLearn : '',
  ]
    .filter(Boolean)
    .join(' ')

  const modeItems: { id: Mode; label: string; icon: ReactNode }[] = [
    {
      id: 'learn',
      label: t('learn.molecules.structure.modeLearn'),
      icon: <IconCube className={styles.modeIcon} />,
    },
    {
      id: 'balance',
      label: t('learn.molecules.structure.modeBalance'),
      icon: <IconScale className={styles.modeIcon} />,
    },
    {
      id: 'test',
      label: t('learn.molecules.structure.modeTest'),
      icon: <IconQuiz className={styles.modeIcon} />,
    },
  ]

  const title =
    mode === 'test'
      ? t('learn.molecules.structure.testSetupTitle')
      : mode === 'balance'
        ? t('learn.balance.title')
        : t('learn.molecules.structure.title')
  const hint =
    mode === 'test'
      ? t('learn.studio.viz.hintTest')
      : mode === 'balance'
        ? t('learn.studio.viz.hintBalance')
        : t('learn.studio.viz.hintLearn')

  const filtersActive = search.trim() !== '' || category !== 'all' || grade !== 'all'

  return (
    <div className={rootClass}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={`${kit.iconTile} ${styles.titleTile}`} aria-hidden="true">
            {mode === 'test' ? <IconQuiz /> : mode === 'balance' ? <IconScale /> : <IconCube />}
          </span>
          <div className={styles.titleText}>
            <h2 className={styles.title} title={title}>
              {title}
            </h2>
            {!presentationMode ? <p className={styles.subtitle}>{hint}</p> : null}
          </div>
        </div>
        <div
          className={`${kit.segmented} ${styles.modeTabs}`}
          role="group"
          aria-label={t('learn.studio.viz.modes')}
        >
          {modeItems.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`${kit.segmentedItem} ${mode === m.id ? kit.segmentedItemActive : ''} ${styles.modeBtn}`}
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              aria-label={m.label}
              title={m.label}
            >
              {m.icon}
              <span className={styles.modeLabel}>{m.label}</span>
            </button>
          ))}
        </div>
      </header>

      <div className={styles.body}>
        {mode === 'learn' ? (
          <div className={styles.learnSplit}>
            <section className={styles.detailPane} aria-label={t('learn.studio.viz.viewer')}>
              {selected ? (
                <>
                  <div className={styles.viewerBox} onPointerDownCapture={() => setHintSeen(true)}>
                    <div className={styles.viewerInner}>
                      <MoleculeStructureCanvas
                        compound={selected}
                        autoRotate={autoRotate}
                        resetToken={resetToken}
                        onInteract={() => setHintSeen(true)}
                        showHint={false}
                      />
                    </div>
                    {presentationMode ? (
                      <div className={styles.viewerTag}>
                        <span className={styles.viewerTagName}>
                          {getCompoundLocaleStrings(selected, locale, t).name}
                        </span>
                        <span className={styles.viewerTagFormula}>{selected.formulaUnicode}</span>
                      </div>
                    ) : (
                      <div className={styles.viewerTagMini} data-cat={selected.category}>
                        <span className={styles.viewerTagMiniFormula}>
                          {selected.formulaUnicode}
                        </span>
                      </div>
                    )}
                    <div
                      className={styles.viewerTools}
                      role="toolbar"
                      aria-label={t('learn.studio.viz.viewer')}
                    >
                      <button
                        type="button"
                        className={`${kit.iconBtn} ${styles.viewerBtn}`}
                        onClick={() => setAutoRotate((v) => !v)}
                        aria-pressed={autoRotate}
                        aria-label={t('learn.studio.viz.autoRotate')}
                        title={t('learn.studio.viz.autoRotate')}
                      >
                        <IconRotate className={styles.viewerBtnIcon} />
                      </button>
                      <button
                        type="button"
                        className={`${kit.iconBtn} ${styles.viewerBtn}`}
                        onClick={() => setResetToken((n) => n + 1)}
                        aria-label={t('learn.studio.viz.resetView')}
                        title={t('learn.studio.viz.resetView')}
                      >
                        <IconTarget className={styles.viewerBtnIcon} />
                      </button>
                      {!presentationMode ? (
                        <span className={styles.viewerKbd} title={t('learn.studio.viz.fsHint')}>
                          <LearnShellIcon name="maximize" size={13} strokeWidth={2.2} />
                          <Kbd>F</Kbd>
                        </span>
                      ) : null}
                    </div>
                    <div className={styles.viewerFoot}>
                      <div
                        className={styles.viewerNav}
                        role="group"
                        aria-label={t('learn.studio.viz.navigate')}
                      >
                        <button
                          type="button"
                          className={`${kit.iconBtn} ${styles.viewerBtn}`}
                          onClick={() => step(-1)}
                          disabled={filtered.length === 0}
                          aria-label={t('learn.studio.viz.prev')}
                          title={t('learn.studio.viz.prev')}
                        >
                          <LearnShellIcon name="arrowLeft" size={15} strokeWidth={2.2} />
                        </button>
                        <span className={styles.viewerPos} aria-live="polite">
                          {selectedPos >= 0
                            ? `${selectedPos + 1} / ${filtered.length}`
                            : `— / ${filtered.length}`}
                        </span>
                        <button
                          type="button"
                          className={`${kit.iconBtn} ${styles.viewerBtn}`}
                          onClick={() => step(1)}
                          disabled={filtered.length === 0}
                          aria-label={t('learn.studio.viz.next')}
                          title={t('learn.studio.viz.next')}
                        >
                          <LearnShellIcon name="arrowRight" size={15} strokeWidth={2.2} />
                        </button>
                        <button
                          type="button"
                          className={`${kit.iconBtn} ${styles.viewerBtn}`}
                          onClick={pickRandom}
                          disabled={filtered.length === 0}
                          aria-label={t('learn.studio.viz.random')}
                          title={t('learn.studio.viz.random')}
                        >
                          <IconShuffle className={styles.viewerBtnIcon} />
                        </button>
                      </div>
                      <p
                        className={`${styles.floatHint} ${hintSeen ? styles.floatHintHidden : ''}`}
                        aria-hidden={hintSeen}
                      >
                        <IconHand className={styles.floatHintIcon} />
                        <span className={styles.floatHintText}>
                          {t('learn.molecules.structure.rotateHint')}
                        </span>
                      </p>
                    </div>
                  </div>
                  {!presentationMode ? <CompoundInfoPanel compound={selected} /> : null}
                </>
              ) : (
                <StudioEmptyState
                  icon="cube"
                  className={styles.emptyDetail}
                  title={t('learn.molecules.structure.pickCompound')}
                />
              )}
            </section>

            <section className={styles.listPane} aria-label={t('learn.studio.viz.listTitle')}>
              <div className={styles.listToolbar}>
                <div className={`${kit.searchField} ${styles.searchField}`}>
                  <IconSearch className={styles.searchIcon} />
                  <input
                    ref={searchRef}
                    type="search"
                    className={`${kit.input} ${styles.search}`}
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onKeyDown={onSearchKeyDown}
                    placeholder={t('learn.molecules.structure.search')}
                    aria-label={t('learn.molecules.structure.search')}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <span
                    className={styles.searchCount}
                    title={t('learn.studio.viz.results', {
                      count: String(filtered.length),
                    })}
                  >
                    {filtered.length}
                  </span>
                  {search ? (
                    <button
                      type="button"
                      className={`${kit.iconBtn} ${styles.searchClear}`}
                      onClick={() => {
                        onSearchChange('')
                        searchRef.current?.focus()
                      }}
                      aria-label={t('learn.studio.viz.clear')}
                      title={t('learn.studio.viz.clear')}
                    >
                      <LearnShellIcon name="close" size={13} strokeWidth={2.4} />
                    </button>
                  ) : null}
                </div>
              </div>
              {/* Фильтры и прогресс живут отдельным блоком: в узкой колонке он
                    уезжает вместе со списком, а поле поиска остаётся на месте. */}
              <div className={styles.listFilters}>
                <div
                  className={`${styles.filterRow} ${styles.filterRowWrap}`}
                  role="group"
                  aria-label={t('learn.studio.viz.categories')}
                >
                  <button
                    type="button"
                    className={`${category === 'all' ? kit.chipTone : kit.chip} ${styles.chip}`}
                    onClick={() => onCategory('all')}
                    aria-pressed={category === 'all'}
                  >
                    {t('learn.studio.viz.filterAll')}
                    <span className={styles.chipCount}>{bySearch.length}</span>
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`${category === cat ? kit.chipTone : kit.chip} ${styles.chip} ${styles.chipCat}`}
                      data-cat={cat}
                      onClick={() => onCategory(category === cat ? 'all' : cat)}
                      aria-pressed={category === cat}
                    >
                      <span className={styles.catDot} aria-hidden="true" />
                      {t(categoryPluralKey(cat))}
                      <span className={styles.chipCount}>{categoryCounts[cat]}</span>
                    </button>
                  ))}
                </div>
                <div
                  className={styles.filterRow}
                  role="group"
                  aria-label={t('learn.studio.viz.grades')}
                >
                  <span className={styles.filterLabel}>{t('learn.studio.viz.gradeShort')}</span>
                  <button
                    type="button"
                    className={`${grade === 'all' ? kit.chipTone : kit.chip} ${styles.chip} ${styles.chipGrade}`}
                    onClick={() => onGrade('all')}
                    aria-pressed={grade === 'all'}
                    aria-label={t('learn.studio.viz.gradeAll')}
                    title={t('learn.studio.viz.gradeAll')}
                  >
                    {t('learn.studio.viz.filterAll')}
                  </button>
                  {SCHOOL_GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`${grade === g ? kit.chipTone : kit.chip} ${styles.chip} ${styles.chipGrade}`}
                      onClick={() => onGrade(grade === g ? 'all' : g)}
                      aria-pressed={grade === g}
                      aria-label={t('learn.studio.viz.grade', { n: String(g) })}
                      title={t('learn.studio.viz.grade', { n: String(g) })}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <div className={styles.progressBlock}>
                  <span className={styles.progressLabel}>{t('learn.studio.viz.studied')}</span>
                  <span className={styles.progressValue}>
                    <b>{viewedCount}</b> / {total}
                  </span>
                  <ProgressBar value={viewedCount} max={total} className={styles.progressBar} />
                </div>
              </div>

              {filtered.length > 0 ? (
                <ul
                  ref={listRef}
                  className={`${kit.scrollArea} ${styles.compoundList}`}
                  onKeyDown={onListKeyDown}
                >
                  {shown.map((c) => {
                    const loc = getCompoundLocaleStrings(c, locale, t)
                    const active = c.id === selectedId
                    const grades = inorganicGradesForId(c.id)
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          id={rowId(c.id)}
                          data-row
                          className={`${styles.compoundItem} ${active ? styles.compoundItemActive : ''}`}
                          onClick={() => selectCompound(c.id)}
                          data-cat={c.category}
                          aria-current={active ? 'true' : undefined}
                          title={loc.name}
                        >
                          <span className={styles.itemFormula}>{c.formulaUnicode}</span>
                          <span className={styles.itemMain}>
                            <span className={styles.itemName}>{loc.name}</span>
                            <span className={styles.itemMeta}>
                              <span className={styles.itemCat}>{t(categoryKey(c.category))}</span>
                              {grades.length > 0 ? (
                                <span className={styles.itemGrade}>
                                  {t('learn.studio.viz.gradeRange', {
                                    range: formatGradeRange(grades),
                                  })}
                                </span>
                              ) : null}
                            </span>
                          </span>
                          {viewed.has(c.id) ? (
                            <span
                              className={styles.itemViewed}
                              title={t('learn.studio.viz.studied')}
                            >
                              <IconCheck className={styles.itemViewedIcon} />
                            </span>
                          ) : (
                            <span className={styles.itemDot} aria-hidden="true" />
                          )}
                        </button>
                      </li>
                    )
                  })}
                  {hiddenCount > 0 ? (
                    <li className={styles.listMore}>
                      <button
                        type="button"
                        className={`${kit.btn} ${styles.moreBtn}`}
                        onClick={() => setLimit((n) => n + LIST_PAGE)}
                      >
                        {t('learn.studio.viz.showMore', {
                          count: String(Math.min(LIST_PAGE, hiddenCount)),
                        })}
                      </button>
                      <button
                        type="button"
                        className={`${kit.btnGhost} ${styles.moreBtn}`}
                        onClick={() => setLimit(filtered.length)}
                      >
                        {t('learn.studio.viz.showAll', {
                          count: String(filtered.length),
                        })}
                      </button>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <div className={styles.listEmptyWrap} role="status">
                  <StudioEmptyState
                    icon="list"
                    className={styles.listEmpty}
                    title={t('learn.studio.viz.noResults')}
                    lead={search ? `«${search}»` : t('learn.studio.viz.noResultsLead')}
                    actions={
                      filtersActive ? (
                        <button type="button" className={kit.btn} onClick={resetFilters}>
                          <LearnShellIcon name="close" size={14} strokeWidth={2.2} />
                          {t('learn.studio.viz.resetFilters')}
                        </button>
                      ) : undefined
                    }
                  />
                </div>
              )}
              <p className={styles.keysHint} aria-hidden="true">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                <span>{t('learn.studio.viz.keysList')}</span>
                <Kbd>↵</Kbd>
                <span>{t('learn.studio.viz.keysOpen')}</span>
              </p>
            </section>
          </div>
        ) : mode === 'balance' ? (
          <div className={`${kit.scrollArea} ${styles.balancePane}`}>
            <ValencyBalanceTutor embedded />
          </div>
        ) : (
          <MoleculeStructureTest
            presentationMode={presentationMode}
            sectionId={sectionId}
            viewedCount={viewedCount}
            minViewed={MIN_VIEWED_FOR_TEST}
            onGoLearn={() => setMode('learn')}
          />
        )}
      </div>
    </div>
  )
}
