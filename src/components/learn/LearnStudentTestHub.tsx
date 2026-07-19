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
}

const MODE_HINT: Record<ExamMode, MessageKey> = {
  mcq: 'learn.teacherExam.mcqHint',
  oral: 'learn.teacherExam.oralHint',
  written: 'learn.teacherExam.writtenHint',
  balance: 'learn.teacherExam.balanceHint',
  formulas: 'learn.teacherExam.formulasHint',
  problems: 'learn.teacherExam.problemsHint',
}

const MODES: ExamMode[] = ['mcq', 'oral', 'written', 'balance', 'formulas', 'problems']

export function LearnStudentTestHub({
  grade,
  chapter,
  section,
  rosterSectionId,
  requireStudent = true,
  showMoleculeHint = true,
  compact = false,
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

  return (
    <div className={hubClass}>
      {!compact ? (
        <div className={styles.head}>
          <span className={styles.badge}>{t('learn.teacherExam.hubBadge')}</span>
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
            className={mode === m ? styles.modeBtnActive : styles.modeBtn}
            onClick={() => setMode(m)}
          >
            {modeLabel(m)}
          </button>
        ))}
      </div>

      {requireStudent ? (
        activeStudent ? (
          <p className={styles.studentLine}>
            {t('learn.molecules.structure.testForStudent', { name: activeStudent.name })}
          </p>
        ) : (
          <p className={styles.studentHint}>{t('learn.molecules.structure.testNoStudent')}</p>
        )
      ) : activeStudent ? (
        <p className={styles.studentLine}>
          {t('learn.molecules.structure.testForStudent', { name: activeStudent.name })}
        </p>
      ) : (
        <p className={styles.studentHintOptional}>{t('learn.studentTestHub.classMode')}</p>
      )}

      <p className={styles.featureHint}>{t(MODE_HINT[mode])}</p>

      {showMoleculeHint && mode === 'mcq' ? (
        <p className={styles.featureHint}>{t('learn.studentTestHub.moleculeHint')}</p>
      ) : null}

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
    </div>
  )
}
