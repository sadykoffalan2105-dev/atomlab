import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { filterCompoundsForCatalog } from '../../../data/compoundCatalogFilter'
import {
  atomCount,
  bondCount,
  formatComposition,
  MOLECULE_GAME_COMPOUNDS,
} from '../../../data/moleculeStructureGame'
import { getCompoundLocaleStrings, compoundSearchBlob } from '../../../i18n/compoundLocale'
import type { MessageKey } from '../../../i18n/messagesRu'
import { useT } from '../../../i18n/useT'
import {
  CLASS_ROSTER_CHANGED,
  getActiveStudent,
  recordStudentTestResult,
  type ClassStudent,
} from '../../../learn/learnClassRosterStorage'
import {
  buildMoleculeTest,
  type MoleculeTestQuestion,
} from '../../../learn/moleculeQuizEngine'
import {
  computeStudentTestScore,
  studentTestGradeLabel,
  type StudentTestLength,
} from '../../../learn/studentTestScoring'
import type { CompoundDef } from '../../../types/chemistry'
import { MoleculeStructureCanvas } from './MoleculeStructureCanvas'
import { ValencyBalanceTutor } from '../ValencyBalanceTutor'
import styles from './MoleculeStructureGameHub.module.css'

type Mode = 'learn' | 'test' | 'balance'
type InfoTab = 'structure' | 'about' | 'recipe'
type TestPhase = 'setup' | 'running' | 'results'

const VIEWED_KEY = 'atomlab.moleculeStructure.viewed'
const MIN_VIEWED_FOR_TEST = 3

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
  localStorage.setItem(VIEWED_KEY, JSON.stringify([...set]))
}

function categoryKey(cat: CompoundDef['category']): MessageKey {
  const m: Record<CompoundDef['category'], MessageKey> = {
    oxide: 'category.kind.oxide',
    acid: 'category.kind.acid',
    base: 'category.kind.base',
    salt: 'category.kind.salt',
    other: 'category.kind.other',
  }
  return m[cat]
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

function IconArrowLeft({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
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
          <stop offset="0%" stopColor="#5b8cff" />
          <stop offset="55%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#d946ef" />
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
          <path d="M26 50 40 32l14 16" stroke="#8793b8" strokeWidth="3" fill="none" />
          <circle cx="40" cy="32" r="8" fill="#5b8cff" />
          <circle cx="26" cy="50" r="6" fill="#2dd4bf" />
          <circle cx="54" cy="48" r="6" fill="#f472b6" />
        </g>
      )}
    </svg>
  )
}

/** Декоративная полоса прогресса: текстовое значение всегда рядом. */
function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className={className ? `${styles.progressTrack} ${className}` : styles.progressTrack} aria-hidden>
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
            <stop offset="0%" stopColor="#5b8cff" />
            <stop offset="55%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#d946ef" />
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
  const [tab, setTab] = useState<InfoTab>('structure')
  const loc = getCompoundLocaleStrings(compound, locale, t)

  return (
    <div className={styles.infoPanel}>
      <div className={styles.infoHeadRow}>
        <div className={styles.infoHead}>
          <h3 className={styles.infoTitle}>{loc.name}</h3>
          <p className={styles.infoFormula}>{compound.formulaUnicode}</p>
        </div>
        <div className={styles.infoTabs}>
          {(['structure', 'about', 'recipe'] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={`${styles.infoTab} ${tab === id ? styles.infoTabActive : ''}`}
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
            >
              {t(`learn.molecules.structure.tab.${id}`)}
            </button>
          ))}
        </div>
      </div>
      {tab === 'structure' ? (
        <>
          <p className={styles.infoText}>{t('learn.molecules.structure.structureIntro')}</p>
          <div className={styles.statsRow}>
            <span className={styles.statChip}>
              <IconAtom />
              {t('learn.molecules.structure.atoms', { count: String(atomCount(compound)) })}
            </span>
            <span className={styles.statChip}>
              <IconBond />
              {t('learn.molecules.structure.bonds', { count: String(bondCount(compound)) })}
            </span>
            <span className={`${styles.statChip} ${styles.statChipMono}`}>
              {formatComposition(compound.composition)}
            </span>
            <span className={styles.catChip} data-cat={compound.category}>
              {t(categoryKey(compound.category))}
            </span>
          </div>
        </>
      ) : null}
      {tab === 'about' ? <p className={styles.infoText}>{loc.description}</p> : null}
      {tab === 'recipe' ? <p className={styles.infoText}>{loc.laboratoryRecipe}</p> : null}
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
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onGoLearn}>
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
              {t('learn.molecules.structure.testForStudent', { name: activeStudent.name })}
            </p>
          ) : (
            <p className={styles.testStudentHint}>{t('learn.molecules.structure.testNoStudent')}</p>
          )}
          <div className={styles.countPicker} role="group" aria-label={t('learn.studentTest.pickCount')}>
            <button
              type="button"
              className={length === 5 ? styles.countBtnActive : styles.countBtn}
              onClick={() => setLength(5)}
              aria-pressed={length === 5}
            >
              {t('learn.studentTest.questions5')}
            </button>
            <button
              type="button"
              className={length === 10 ? styles.countBtnActive : styles.countBtn}
              onClick={() => setLength(10)}
              aria-pressed={length === 10}
            >
              {t('learn.studentTest.questions10')}
            </button>
          </div>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={startTest}>
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
          <p className={styles.scoringHint}>{t('learn.studentTest.scoringHint', { max: length })}</p>
          <div className={styles.quizActions}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={restart}>
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
      <div className={styles.quizOptions} role="group" aria-label={t('learn.molecules.structure.quizQuestion')}>
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
          feedback === 'ok' ? styles.quizFeedbackOk : feedback === 'bad' ? styles.quizFeedbackBad : ''
        }`}
      >
        {feedback === 'ok' ? <IconCheck /> : feedback === 'bad' ? <IconCross /> : null}
        {feedback === 'ok'
          ? t('learn.molecules.structure.quizCorrect')
          : feedback === 'bad'
            ? t('learn.molecules.structure.quizWrong', {
                name: correctLoc.name,
                formula: question.correct.formulaUnicode,
              })
            : '\u00a0'}
      </div>
      <div className={styles.quizActions}>
        {answered ? (
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={goNext}>
            {index + 1 >= total
              ? t('learn.studentTest.seeResults')
              : t('learn.studentTest.next')}
            <IconArrowRight />
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function MoleculeStructureGameHub({
  presentationMode = false,
  sectionId,
}: {
  presentationMode?: boolean
  sectionId?: string
}) {
  const { locale, t } = useT()
  const [mode, setMode] = useState<Mode>('learn')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(MOLECULE_GAME_COMPOUNDS[0]?.id ?? null)
  const [viewed, setViewed] = useState<Set<string>>(() => loadViewed())

  useEffect(() => {
    if (!presentationMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setMode('learn')
      if (e.key === 'ArrowRight') setMode('test')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [presentationMode])

  const searchBlob = useCallback(
    (c: CompoundDef) => compoundSearchBlob(c, locale, t),
    [locale, t],
  )

  const filtered = useMemo(
    () => filterCompoundsForCatalog(MOLECULE_GAME_COMPOUNDS, search, 'all', searchBlob),
    [search, searchBlob],
  )

  const selected = selectedId ? MOLECULE_GAME_COMPOUNDS.find((c) => c.id === selectedId) : null

  const markViewed = useCallback((id: string) => {
    setViewed((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      saveViewed(next)
      return next
    })
  }, [])

  const selectCompound = (id: string) => {
    markViewed(id)
    setSelectedId(id)
  }

  const rootClass = [
    styles.moleculeGame,
    presentationMode ? styles.moleculeGamePresent : '',
    mode === 'test' ? styles.moleculeGameQuiz : '',
    presentationMode && mode === 'learn' ? styles.moleculeGamePresentLearn : '',
  ]
    .filter(Boolean)
    .join(' ')

  const modeTabs = (
    <div className={styles.modeTabs}>
      <button
        type="button"
        className={`${styles.modeBtn} ${mode === 'learn' ? styles.modeBtnActive : ''}`}
        onClick={() => setMode('learn')}
        aria-pressed={mode === 'learn'}
      >
        {presentationMode ? <IconArrowLeft /> : <IconCube />}
        {t('learn.molecules.structure.modeLearn')}
      </button>
      <button
        type="button"
        className={`${styles.modeBtn} ${mode === 'balance' ? styles.modeBtnActive : ''}`}
        onClick={() => setMode('balance')}
        aria-pressed={mode === 'balance'}
      >
        <IconScale />
        {t('learn.molecules.structure.modeBalance')}
      </button>
      <button
        type="button"
        className={`${styles.modeBtn} ${mode === 'test' ? styles.modeBtnActive : ''}`}
        onClick={() => setMode('test')}
        aria-pressed={mode === 'test'}
      >
        {presentationMode ? null : <IconQuiz />}
        {t('learn.molecules.structure.modeTest')}
        {presentationMode ? <IconArrowRight /> : null}
      </button>
    </div>
  )

  return (
    <div className={rootClass}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.badge}>{t('learn.molecules.structure.badge')}</span>
          <h2 className={styles.title}>
            {mode === 'test'
              ? t('learn.molecules.structure.modeTest')
              : mode === 'balance'
                ? t('learn.balance.title')
                : t('learn.molecules.structure.title')}
          </h2>
          {!presentationMode ? (
            <p className={styles.subtitle}>{t('learn.molecules.structure.subtitle')}</p>
          ) : null}
        </div>
        {modeTabs}
      </header>

      <div className={styles.body}>
        {mode === 'learn' ? (
          <div className={styles.learnSplit}>
            <div className={styles.listPane}>
              <div className={styles.listToolbar}>
                <div className={styles.searchWrap}>
                  <IconSearch className={styles.searchIcon} />
                  <input
                    type="search"
                    className={styles.search}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('learn.molecules.structure.search')}
                    aria-label={t('learn.molecules.structure.search')}
                  />
                </div>
                <div className={styles.progressBlock}>
                  <span className={styles.progress}>
                    {t('learn.molecules.structure.viewed', {
                      count: String(viewed.size),
                      total: String(MOLECULE_GAME_COMPOUNDS.length),
                    })}
                  </span>
                  <ProgressBar value={viewed.size} max={MOLECULE_GAME_COMPOUNDS.length} />
                </div>
              </div>
              <ul className={styles.compoundList}>
                {filtered.map((c) => {
                  const loc = getCompoundLocaleStrings(c, locale, t)
                  const active = c.id === selectedId
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`${styles.compoundItem} ${active ? styles.compoundItemActive : ''}`}
                        onClick={() => selectCompound(c.id)}
                        data-cat={c.category}
                        aria-current={active ? 'true' : undefined}
                        title={loc.name}
                      >
                        <span className={styles.itemName}>
                          <span className={styles.itemNameText}>{loc.name}</span>
                          {viewed.has(c.id) ? <IconCheck className={styles.itemViewed} /> : null}
                        </span>
                        <span className={styles.itemFormula}>{c.formulaUnicode}</span>
                        <span className={styles.itemCat}>{t(categoryKey(c.category))}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {filtered.length === 0 ? (
                <div className={styles.listEmpty} role="status">
                  <StateArt />
                  <span>«{search}»</span>
                </div>
              ) : null}
            </div>
            <div className={styles.detailPane}>
              {selected ? (
                <>
                  <div className={styles.viewerBox}>
                    <div className={styles.viewerInner}>
                      <MoleculeStructureCanvas compound={selected} />
                      {presentationMode ? (
                        <div className={styles.viewerTag}>
                          <span className={styles.viewerTagName}>
                            {getCompoundLocaleStrings(selected, locale, t).name}
                          </span>
                          <span className={styles.viewerTagFormula}>{selected.formulaUnicode}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {!presentationMode ? <CompoundInfoPanel compound={selected} /> : null}
                </>
              ) : (
                <div className={styles.emptyDetail}>
                  <StateArt />
                  {t('learn.molecules.structure.pickCompound')}
                </div>
              )}
            </div>
          </div>
        ) : mode === 'balance' ? (
          <div className={styles.balancePane}>
            <ValencyBalanceTutor embedded />
          </div>
        ) : (
          <MoleculeStructureTest
            presentationMode={presentationMode}
            sectionId={sectionId}
            viewedCount={viewed.size}
            minViewed={MIN_VIEWED_FOR_TEST}
            onGoLearn={() => setMode('learn')}
          />
        )}
      </div>
    </div>
  )
}
