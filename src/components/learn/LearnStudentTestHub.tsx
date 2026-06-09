import { useCallback, useEffect, useState } from 'react'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import {
  CLASS_ROSTER_CHANGED,
  getActiveStudent,
  type ClassStudent,
} from '../../learn/learnClassRosterStorage'
import { useT } from '../../i18n/useT'
import { LearnStudentTest } from './LearnStudentTest'
import styles from './LearnStudentTestHub.module.css'

type TestMode = 'topic' | 'ai'

type Props = {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  rosterSectionId: string
  /** Если false — можно начать без выбора ученика (режим доски) */
  requireStudent?: boolean
  showMoleculeHint?: boolean
  compact?: boolean
}

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
  const [mode, setMode] = useState<TestMode>('topic')
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

  const modeLabel = (m: TestMode) =>
    t(m === 'topic' ? 'learn.studentTestHub.modeTopic' : 'learn.studentTestHub.modeAi')

  const testDisabled = requireStudent && !activeStudent

  return (
    <div className={compact ? styles.hubCompact : styles.hub}>
      {!compact ? (
        <div className={styles.head}>
          <h3 className={styles.title}>{t('learn.studentTest.title')}</h3>
          <p className={styles.lead}>{t('learn.studentTestHub.leadUnified')}</p>
        </div>
      ) : null}

      <div className={styles.modeRow} role="tablist" aria-label={t('learn.studentTestHub.modeLabel')}>
        {(['topic', 'ai'] as const).map((m) => (
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

      {showMoleculeHint ? (
        <p className={styles.moleculeHint}>{t('learn.studentTestHub.moleculeHint')}</p>
      ) : null}

      <LearnStudentTest
        grade={grade}
        chapter={chapter}
        section={section}
        rosterSectionId={rosterSectionId}
        testKind={mode}
        variant={mode === 'ai' ? 'ai' : 'default'}
        disabled={testDisabled}
        embedded
      />
    </div>
  )
}
