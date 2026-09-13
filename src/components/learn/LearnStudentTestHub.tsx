import { useCallback, useEffect, useState } from 'react'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import {
  CLASS_ROSTER_CHANGED,
  getActiveStudent,
  type ClassStudent,
} from '../../learn/learnClassRosterStorage'
import { useT, type MessageKey } from '../../i18n/useT'
import { FormulaLearningPanel } from './FormulaLearningPanel'
import { ChemProblemTutor } from './ChemProblemTutor'
import { LearnOralExamPanel } from './LearnOralExamPanel'
import { LearnStudentTest } from './LearnStudentTest'
import { LearnWrittenExamPanel } from './LearnWrittenExamPanel'
import { ValencyBalanceTutor } from './ValencyBalanceTutor'
import { LearnRosterAvatar } from './LearnRosterAvatar'
import { LearnSidebarIcon, type LearnSidebarIconName } from './LearnSidebarIcon'
import styles from './TeacherExamShell.module.css'

type ExamMode = 'mcq' | 'oral' | 'written' | 'balance' | 'formulas' | 'problems'

type Props = {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  rosterSectionId: string
  requireStudent?: boolean
  showMoleculeHint?: boolean
  compact?: boolean
  /** Открыть список класса (например, переключить вкладку боковой панели) */
  onPickStudent?: () => void
}

const MODE_HINT: Record<ExamMode, MessageKey> = {
  mcq: 'learn.teacherExam.mcqHint',
  oral: 'learn.teacherExam.oralHint',
  written: 'learn.teacherExam.writtenHint',
  balance: 'learn.teacherExam.balanceHint',
  formulas: 'learn.teacherExam.formulasHint',
  problems: 'learn.teacherExam.problemsHint',
}

const MODE_ICON: Record<ExamMode, LearnSidebarIconName> = {
  mcq: 'mcq',
  oral: 'oral',
  written: 'written',
  balance: 'balance',
  formulas: 'formulas',
  problems: 'problems',
}

const MODE_TONE: Record<ExamMode, string | undefined> = {
  mcq: styles.toneMcq,
  oral: styles.toneOral,
  written: styles.toneWritten,
  balance: styles.toneBalance,
  formulas: styles.toneFormulas,
  problems: styles.toneProblems,
}

const START_KEY: Partial<Record<ExamMode, MessageKey>> = {
  mcq: 'learn.studentTest.start',
  oral: 'learn.teacherExam.startOral',
  written: 'learn.teacherExam.startWritten',
}

const MODES: ExamMode[] = ['mcq', 'oral', 'written', 'balance', 'formulas', 'problems']

type StepState = 'done' | 'current' | 'idle'

export function LearnStudentTestHub({
  grade,
  chapter,
  section,
  rosterSectionId,
  requireStudent = true,
  showMoleculeHint = true,
  compact = false,
  onPickStudent,
}: Props) {
  const { t } = useT()
  const [mode, setMode] = useState<ExamMode>('mcq')
  const [activeStudent, setActiveStudent] = useState<ClassStudent | null>(() =>
    getActiveStudent(rosterSectionId),
  )

  const reload = useCallback(() => {
    setActiveStudent(getActiveStudent(rosterSectionId))
  }, [rosterSectionId])

  useEffect(() => {
    reload()
    const onChange = () => reload()
    window.addEventListener(CLASS_ROSTER_CHANGED, onChange)
    return () => window.removeEventListener(CLASS_ROSTER_CHANGED, onChange)
  }, [reload])

  const modeLabel = (m: ExamMode) => {
    if (m === 'mcq') return t('learn.teacherExam.modeMcq')
    if (m === 'oral') return t('learn.teacherExam.modeOral')
    if (m === 'written') return t('learn.teacherExam.modeWritten')
    if (m === 'balance') return t('learn.teacherExam.modeBalance')
    if (m === 'formulas') return t('learn.teacherExam.modeFormulas')
    return t('learn.teacherExam.modeProblems')
  }

  const testDisabled = requireStudent && !activeStudent
  const hubClass = compact ? styles.hubCompact : styles.hub
  const startKey = START_KEY[mode]

  const studentStep: StepState = activeStudent ? 'done' : requireStudent ? 'current' : 'idle'
  const afterStudent: StepState = studentStep === 'current' ? 'idle' : 'current'
  const steps: { key: string; label: string; state: StepState }[] = startKey
    ? [
        { key: 'student', label: t('learn.classRoster.title'), state: studentStep },
        { key: 'count', label: t('learn.studentTest.pickCount'), state: afterStudent },
        { key: 'start', label: t(startKey), state: 'idle' },
        { key: 'result', label: t('learn.studentTest.resultsTitle'), state: 'idle' },
      ]
    : []

  return (
    <div className={hubClass}>
      {!compact ? (
        <div className={styles.head}>
          <span className={styles.badge}>
            <LearnSidebarIcon name="sparkle" size={12} />
            {t('learn.teacherExam.hubBadge')}
          </span>
          <h3 className={styles.title}>{t('learn.teacherExam.hubTitle')}</h3>
          <p className={styles.lead}>{t('learn.teacherExam.hubLead')}</p>
        </div>
      ) : null}

      <div className={styles.modeRow} role="tablist" aria-label={t('learn.teacherExam.modeLabel')}>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`${mode === m ? styles.modeBtnActive : styles.modeBtn} ${MODE_TONE[m] ?? ''}`}
            onClick={() => setMode(m)}
          >
            <span className={styles.modeIcon}>
              <LearnSidebarIcon name={MODE_ICON[m]} size={18} />
            </span>
            <span className={styles.modeName}>{modeLabel(m)}</span>
            {mode === m ? (
              <span className={styles.modeCheck} aria-hidden="true">
                <LearnSidebarIcon name="check" size={11} />
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <p className={`${styles.featureHint} ${MODE_TONE[mode] ?? ''}`}>
        <LearnSidebarIcon name="sparkle" size={16} className={styles.featureHintIcon} />
        <span>{t(MODE_HINT[mode])}</span>
      </p>

      {showMoleculeHint && mode === 'mcq' ? (
        <p className={styles.featureHint}>
          <LearnSidebarIcon name="info" size={16} className={styles.featureHintIcon} />
          <span>{t('learn.studentTestHub.moleculeHint')}</span>
        </p>
      ) : null}

      {activeStudent ? (
        <div className={styles.studentLine}>
          <LearnRosterAvatar name={activeStudent.name} size="sm" />
          <span className={styles.studentLineText}>
            {t('learn.molecules.structure.testForStudent', { name: activeStudent.name })}
          </span>
          {onPickStudent ? (
            <button type="button" className={styles.studentLink} onClick={onPickStudent}>
              <LearnSidebarIcon name="users" size={14} />
              <span>{t('learn.classRoster.title')}</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div
          className={requireStudent ? styles.studentHint : styles.studentHintOptional}
          role="note"
        >
          <span className={styles.calloutIcon}>
            <LearnSidebarIcon name="info" size={16} />
          </span>
          <div className={styles.calloutBody}>
            <p className={styles.calloutText}>
              {requireStudent
                ? t('learn.molecules.structure.testNoStudent')
                : t('learn.studentTestHub.classMode')}
            </p>
            {onPickStudent ? (
              <button type="button" className={styles.calloutBtn} onClick={onPickStudent}>
                <span>{t('learn.classRoster.title')}</span>
                <LearnSidebarIcon name="arrowRight" size={14} />
              </button>
            ) : null}
          </div>
        </div>
      )}

      {mode === 'mcq' ? (
        <LearnStudentTest
          grade={grade}
          chapter={chapter}
          section={section}
          rosterSectionId={rosterSectionId}
          testKind="topic"
          variant="default"
          disabled={testDisabled}
          embedded
        />
      ) : null}

      {mode === 'oral' ? (
        <LearnOralExamPanel
          grade={grade}
          chapter={chapter}
          section={section}
          rosterSectionId={rosterSectionId}
          disabled={testDisabled}
          embedded
        />
      ) : null}

      {mode === 'written' ? (
        <LearnWrittenExamPanel
          grade={grade}
          chapter={chapter}
          section={section}
          rosterSectionId={rosterSectionId}
          disabled={testDisabled}
          embedded
        />
      ) : null}

      {mode === 'balance' ? (
        <ValencyBalanceTutor
          gradeId={grade.id}
          chapterId={chapter.id}
          sectionId={section.id}
          embedded
        />
      ) : null}

      {mode === 'formulas' ? <FormulaLearningPanel embedded /> : null}

      {mode === 'problems' ? <ChemProblemTutor embedded /> : null}

      {compact && steps.length > 0 ? (
        <section className={`${styles.steps} ${MODE_TONE[mode] ?? ''}`} aria-label={t('learn.teacherExam.hubTitle')}>
          <h4 className={styles.stepsHead}>
            <LearnSidebarIcon name="test" size={14} />
            {t('learn.teacherExam.hubTitle')}
          </h4>
          <ol className={styles.stepList}>
            {steps.map((step, i) => (
              <li
                key={step.key}
                className={`${styles.step} ${
                  step.state === 'done'
                    ? styles.stepDone
                    : step.state === 'current'
                      ? styles.stepCurrent
                      : ''
                }`}
              >
                <span className={styles.stepNum} aria-hidden="true">
                  {step.state === 'done' ? <LearnSidebarIcon name="check" size={12} /> : i + 1}
                </span>
                <span className={styles.stepLabel}>
                  {step.label}
                  {step.key === 'student' && activeStudent ? (
                    <span className={styles.stepSub}>{activeStudent.name}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
          {mode === 'mcq' ? (
            <p className={styles.stepsNote}>{t('learn.studentTest.scoringHint', { max: 5 })}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
