import { useCallback, useEffect, useMemo, useState } from 'react'
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
import styles from './MoleculeStructureGameHub.module.css'

type Mode = 'learn' | 'test'
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

function ScoreRing({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? score / max : 0
  const circumference = 283
  const offset = circumference * (1 - pct)

  return (
    <div className={styles.scoreRing}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id="molScoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5cffd4" />
            <stop offset="100%" stopColor="#2a9d8a" />
          </linearGradient>
        </defs>
        <circle className={styles.scoreRingBg} cx="50" cy="50" r="45" />
        <circle
          className={styles.scoreRingFill}
          cx="50"
          cy="50"
          r="45"
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
          >
            {t(`learn.molecules.structure.tab.${id}`)}
          </button>
        ))}
      </div>
      {tab === 'structure' ? (
        <>
          <p className={styles.infoText}>{t('learn.molecules.structure.structureIntro')}</p>
          <div className={styles.statsRow}>
            <span className={styles.statChip}>
              {t('learn.molecules.structure.atoms', { count: String(atomCount(compound)) })}
            </span>
            <span className={styles.statChip}>
              {t('learn.molecules.structure.bonds', { count: String(bondCount(compound)) })}
            </span>
            <span className={styles.statChip}>{formatComposition(compound.composition)}</span>
            <span className={styles.statChip}>{t(categoryKey(compound.category))}</span>
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
}: {
  presentationMode: boolean
  sectionId?: string
  viewedCount: number
  minViewed: number
}) {
  const { locale, t } = useT()
  const [phase, setPhase] = useState<TestPhase>('setup')
  const [length, setLength] = useState<StudentTestLength>(5)
  const [questions, setQuestions] = useState<MoleculeTestQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [correctFlags, setCorrectFlags] = useState<boolean[]>([])
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
    setAnswered(false)
    setPickedId(null)
    setFeedback(null)
    setPhase('running')
  }, [length])

  const finishAndSave = useCallback(
    (flags: boolean[]) => {
      const correct = flags.filter(Boolean).length
      const finalScore = computeStudentTestScore(correct, length)
      if (sectionId && activeStudent) {
        recordStudentTestResult(sectionId, activeStudent.id, {
          score: finalScore,
          total: length,
          correct,
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
  }

  const goNext = () => {
    if (!question) return
    if (index + 1 >= total) {
      finishAndSave(correctFlags)
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
    setAnswered(false)
    setPickedId(null)
    setFeedback(null)
  }

  if (!testUnlocked) {
    return (
      <div className={styles.quizLayout}>
        <p className={styles.lockedHint}>
          {t('learn.molecules.structure.testLocked', {
            viewed: String(viewedCount),
            need: String(minViewed),
          })}
        </p>
      </div>
    )
  }

  if (phase === 'setup') {
    return (
      <div className={`${styles.testSetup} ${presentationMode ? styles.testSetupPresent : ''}`}>
        <h3 className={styles.testSetupTitle}>{t('learn.molecules.structure.testSetupTitle')}</h3>
        <p className={styles.testSetupLead}>{t('learn.molecules.structure.testSetupLead')}</p>
        {activeStudent ? (
          <p className={styles.testStudent}>
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
          >
            {t('learn.studentTest.questions5')}
          </button>
          <button
            type="button"
            className={length === 10 ? styles.countBtnActive : styles.countBtn}
            onClick={() => setLength(10)}
          >
            {t('learn.studentTest.questions10')}
          </button>
        </div>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={startTest}>
          {t('learn.studentTest.start')}
        </button>
      </div>
    )
  }

  if (phase === 'results') {
    return (
      <div className={`${styles.testResults} ${presentationMode ? styles.testResultsPresent : ''}`}>
        <ScoreRing score={score} max={length} />
        <h3 className={styles.resultsTitle}>{t('learn.studentTest.resultsTitle')}</h3>
        {activeStudent ? (
          <p className={styles.testStudent}>{activeStudent.name}</p>
        ) : null}
        <p className={styles.resultsGrade}>{gradeMessage}</p>
        <div className={styles.resultsStats}>
          <div className={styles.resultStat}>
            <span className={styles.resultStatValue}>{correctCount}</span>
            <span className={styles.resultStatLabel}>{t('learn.studentTest.correctCount')}</span>
          </div>
          <div className={styles.resultStat}>
            <span className={styles.resultStatValue}>{length - correctCount}</span>
            <span className={styles.resultStatLabel}>{t('learn.studentTest.wrongCount')}</span>
          </div>
        </div>
        <p className={styles.scoringHint}>{t('learn.studentTest.scoringHint', { max: length })}</p>
        <div className={styles.quizActions}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={restart}>
            {t('learn.studentTest.retry')}
          </button>
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
      <div className={styles.quizViewer}>
        <MoleculeStructureCanvas compound={question.correct} quizMode compact />
      </div>
      <p className={styles.quizPrompt}>{t('learn.molecules.structure.quizPrompt')}</p>
      <div className={styles.quizOptions} role="group" aria-label={t('learn.molecules.structure.quizQuestion')}>
        {question.options.map((opt) => {
          const loc = getCompoundLocaleStrings(opt, locale, t)
          let cls = styles.quizOption
          if (answered && opt.id === question.correct.id) cls += ` ${styles.quizOptionCorrect}`
          else if (answered && pickedId === opt.id && opt.id !== question.correct.id)
            cls += ` ${styles.quizOptionWrong}`
          return (
            <button
              key={`${index}-${opt.id}`}
              type="button"
              className={cls}
              disabled={answered}
              onClick={() => onPick(opt.id)}
            >
              {loc.name}
              <span className={styles.quizOptionFormula}>{opt.formulaUnicode}</span>
            </button>
          )
        })}
      </div>
      <div
        className={`${styles.quizFeedback} ${
          feedback === 'ok' ? styles.quizFeedbackOk : feedback === 'bad' ? styles.quizFeedbackBad : ''
        }`}
      >
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
      >
        {presentationMode ? `← ${t('learn.molecules.structure.modeLearn')}` : t('learn.molecules.structure.modeLearn')}
      </button>
      <button
        type="button"
        className={`${styles.modeBtn} ${mode === 'test' ? styles.modeBtnActive : ''}`}
        onClick={() => setMode('test')}
      >
        {presentationMode
          ? `${t('learn.molecules.structure.modeTest')} →`
          : t('learn.molecules.structure.modeTest')}
      </button>
    </div>
  )

  return (
    <div className={rootClass} style={{ ['--mol-accent' as string]: '#5cffd4' }}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.badge}>{t('learn.molecules.structure.badge')}</span>
          <h2 className={styles.title}>
            {mode === 'test'
              ? t('learn.molecules.structure.modeTest')
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
                <input
                  type="search"
                  className={styles.search}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('learn.molecules.structure.search')}
                  aria-label={t('learn.molecules.structure.search')}
                />
                <span className={styles.progress}>
                  {t('learn.molecules.structure.viewed', {
                    count: String(viewed.size),
                    total: String(MOLECULE_GAME_COMPOUNDS.length),
                  })}
                </span>
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
                      >
                        <span className={styles.itemName}>{loc.name}</span>
                        <span className={styles.itemFormula}>{c.formulaUnicode}</span>
                        <span className={styles.itemCat}>{t(categoryKey(c.category))}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className={styles.detailPane}>
              {selected ? (
                <>
                  <div className={styles.viewerBox}>
                    <MoleculeStructureCanvas compound={selected} />
                  </div>
                  {!presentationMode ? <CompoundInfoPanel compound={selected} /> : null}
                </>
              ) : (
                <div className={styles.emptyDetail}>{t('learn.molecules.structure.pickCompound')}</div>
              )}
            </div>
          </div>
        ) : (
          <MoleculeStructureTest
            presentationMode={presentationMode}
            sectionId={sectionId}
            viewedCount={viewed.size}
            minViewed={MIN_VIEWED_FOR_TEST}
          />
        )}
      </div>
    </div>
  )
}
