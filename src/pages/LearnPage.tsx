import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { LearnSectionRunner } from '../components/learn/LearnSectionRunner'
import { compoundById } from '../data/compounds'
import { legacyTopicRedirect } from '../data/learnLegacyRedirects'
import {
  LEARN_GRADES,
  learnChapterById,
  learnGradeById,
  learnSectionById,
  learnSectionPathId,
  learnTotalSectionCount,
} from '../data/learnCurriculumUz'
import {
  readLearnProgress,
  sectionProgress,
  type LearnProgressV3,
} from '../learn/learnProgressStorage'
import { useT } from '../i18n/useT'
import { LearnTaskRunner } from './LearnTaskRunner'
import { LEARN_TASK_CATEGORY_IDS } from '../data/learnTaskCategories'
import { LearnTasksHub } from './LearnTasksHub'
import styles from './LearnPage.module.css'

function GradesIndex({ progress }: { progress: LearnProgressV3 }) {
  const { t } = useT()
  const total = learnTotalSectionCount()
  const done = progress.completedSectionIds.length
  const resume = progress.last

  return (
    <PageShell>
      <h1 className={styles.h} id="learn-main-title">
        {t('learn.grades.title')}
      </h1>
      <p className={styles.lead}>{t('learn.grades.lead')}</p>
      <p className={styles.globalProgress} aria-live="polite">
        {t('learn.progressSection', { done, total })}
      </p>
      <ToolRow>
        <Link className={`${styles.btn} ${styles.btnPrimary}`} to="/learn/tasks">
          {t('learn.grades.tasks')}
        </Link>
        {resume?.sectionId ? (
          <Link
            className={styles.resumeLink}
            to={`/learn/g/${resume.gradeId}/c/${resume.chapterId}/s/${resume.sectionId}`}
          >
            {t('learn.resume', { title: resume.sectionId })}
          </Link>
        ) : null}
      </ToolRow>
      <div className={styles.topicGrid}>
        {LEARN_GRADES.map((grade) => {
          const sectionIds = grade.chapters.flatMap((c) =>
            c.sections.map((s) => learnSectionPathId(s)),
          )
          const { done: gDone, total: gTotal } = sectionProgress(sectionIds, progress)
          const accent = compoundById[grade.chapters[0]?.totemCompoundId ?? 'h2o']?.accentColor ?? '#3dffec'
          return (
            <Link
              key={grade.id}
              to={`/learn/g/${grade.id}`}
              className={styles.topicCard}
              style={{ ['--learn-accent' as string]: accent }}
            >
              <div className={styles.topicCardVisual} aria-hidden />
              <h2 className={styles.topicCardTitle}>{t(grade.titleKey)}</h2>
              <p className={styles.topicCardSummary}>{t(grade.textbookRefKey)}</p>
              <span className={styles.topicCardMeta}>
                {t('learn.progressSection', { done: gDone, total: gTotal })}
              </span>
            </Link>
          )
        })}
      </div>
    </PageShell>
  )
}

function GradeHub({ gradeId, progress }: { gradeId: string; progress: LearnProgressV3 }) {
  const { t } = useT()
  const grade = learnGradeById(gradeId)
  if (!grade) return null

  return (
    <PageShell>
      <Link className={styles.backLink} to="/learn">
        {t('learn.backGrades')}
      </Link>
      <h1 className={styles.h}>{t(grade.titleKey)}</h1>
      <p className={styles.lead}>{t(grade.textbookRefKey)}</p>
      <h2 className={styles.h}>{t('learn.chaptersTitle')}</h2>
      <ul className={styles.lessonList}>
        {grade.chapters.map((ch) => {
          const ids = ch.sections.map((s) => learnSectionPathId(s))
          const { done, total } = sectionProgress(ids, progress)
          return (
            <li key={ch.id} className={styles.lessonRow}>
              <Link className={styles.lessonLink} to={`/learn/g/${grade.id}/c/${ch.id}`}>
                {t(ch.titleKey)}
              </Link>
              <span className={styles.lessonMeta}>{t('learn.progressSection', { done, total })}</span>
            </li>
          )
        })}
      </ul>
    </PageShell>
  )
}

function ChapterHub({
  gradeId,
  chapterId,
  progress,
}: {
  gradeId: string
  chapterId: string
  progress: LearnProgressV3
}) {
  const { t } = useT()
  const chapter = learnChapterById(gradeId, chapterId)
  const grade = learnGradeById(gradeId)
  if (!chapter || !grade) return null

  return (
    <PageShell>
      <Link className={styles.backLink} to={`/learn/g/${gradeId}`}>
        {t('learn.backGrades')}
      </Link>
      <h1 className={styles.h}>{t(chapter.titleKey)}</h1>
      <p className={styles.lead}>{t(chapter.summaryKey)}</p>
      <h2 className={styles.h}>{t('learn.sectionsTitle')}</h2>
      <ul className={styles.lessonList}>
        {chapter.sections.map((sec) => {
          const pathId = learnSectionPathId(sec)
          const complete = progress.completedSectionIds.includes(pathId)
          return (
            <li key={sec.id} className={styles.lessonRow}>
              <Link
                className={styles.lessonLink}
                to={`/learn/g/${gradeId}/c/${chapterId}/s/${sec.id}`}
              >
                {t('learn.section.kp', { n: sec.kpNumber })} — {t(sec.titleKey)}
              </Link>
              <span className={styles.lessonMeta}>{t('learn.estimatedMin', { n: sec.estimatedMin })}</span>
              {complete ? <span className={styles.doneBadge}>{t('learn.lessonDone')}</span> : null}
            </li>
          )
        })}
      </ul>
    </PageShell>
  )
}

function PageShell({ children }: { children: ReactNode }) {
  return <div className={styles.page}>{children}</div>
}

function ToolRow({ children }: { children: ReactNode }) {
  return <div className={styles.indexToolRow}>{children}</div>
}

export function LearnPage() {
  const { t } = useT()
  const params = useParams<{
    gradeId?: string
    chapterId?: string
    sectionId?: string
    topicId?: string
    lessonId?: string
    categoryId?: string
  }>()

  const [progress, setProgress] = useState(readLearnProgress)
  const refresh = useCallback(() => setProgress(readLearnProgress()), [])

  useEffect(() => {
    setProgress(readLearnProgress())
  }, [params.gradeId, params.chapterId, params.sectionId, params.topicId, params.lessonId])

  if (params.topicId === 'tasks') {
    if (params.lessonId) {
      if (!LEARN_TASK_CATEGORY_IDS.has(params.lessonId)) {
        return (
          <PageShell>
            <p className={styles.notFound}>{t('compound.notFound')}</p>
            <Link className={styles.backLink} to="/learn/tasks">
              {t('learn.tasksBack')}
            </Link>
          </PageShell>
        )
      }
      return <LearnTaskRunner categoryId={params.lessonId} />
    }
    return <LearnTasksHub />
  }

  if (params.topicId && !params.gradeId) {
    const dest = legacyTopicRedirect(params.topicId)
    if (dest) return <Navigate to={dest} replace />
    return (
      <PageShell>
        <p className={styles.notFound}>{t('compound.notFound')}</p>
        <Link className={styles.backLink} to="/learn">
          {t('learn.backGrades')}
        </Link>
      </PageShell>
    )
  }

  if (!params.gradeId) {
    return <GradesIndex progress={progress} />
  }

  const grade = learnGradeById(params.gradeId)
  if (!grade) {
    return (
      <PageShell>
        <p className={styles.notFound}>{t('compound.notFound')}</p>
        <Link className={styles.backLink} to="/learn">
          {t('learn.backGrades')}
        </Link>
      </PageShell>
    )
  }

  if (!params.chapterId) {
    return <GradeHub gradeId={params.gradeId} progress={progress} />
  }

  const chapter = learnChapterById(params.gradeId, params.chapterId)
  if (!chapter) {
    return (
      <PageShell>
        <p className={styles.notFound}>{t('compound.notFound')}</p>
        <Link className={styles.backLink} to={`/learn/g/${params.gradeId}`}>
          {t('learn.backGrades')}
        </Link>
      </PageShell>
    )
  }

  if (!params.sectionId) {
    return (
      <ChapterHub gradeId={params.gradeId} chapterId={params.chapterId} progress={progress} />
    )
  }

  const section = learnSectionById(params.gradeId, params.chapterId, params.sectionId)
  if (!section) {
    return (
      <PageShell>
        <p className={styles.notFound}>{t('compound.notFound')}</p>
        <Link className={styles.backLink} to={`/learn/g/${params.gradeId}/c/${params.chapterId}`}>
          {t('learn.backChapters')}
        </Link>
      </PageShell>
    )
  }

  return (
    <LearnSectionRunner grade={grade} chapter={chapter} section={section} onRefresh={refresh} />
  )
}
