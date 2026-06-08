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
}

export function LearnStudentTestHub({ grade, chapter, section, rosterSectionId }: Props) {
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

  return (
    <div className={styles.hub}>
      <div className={styles.head}>
        <h3 className={styles.title}>{t('learn.studentTest.title')}</h3>
        <p className={styles.lead}>{t('learn.studentTestHub.lead')}</p>
      </div>

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

      {activeStudent ? (
        <p className={styles.studentLine}>
          {t('learn.molecules.structure.testForStudent', { name: activeStudent.name })}
        </p>
      ) : (
        <p className={styles.studentHint}>{t('learn.molecules.structure.testNoStudent')}</p>
      )}

      <p className={styles.moleculeHint}>{t('learn.studentTestHub.moleculeHint')}</p>

      <LearnStudentTest
        grade={grade}
        chapter={chapter}
        section={section}
        rosterSectionId={rosterSectionId}
        testKind={mode}
        variant={mode === 'ai' ? 'ai' : 'default'}
        disabled={!activeStudent}
        embedded
      />
    </div>
  )
}
