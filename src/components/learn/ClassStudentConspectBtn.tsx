import type { MouseEvent } from 'react'
import { useT } from '../../i18n/useT'
import type { ClassStudent } from '../../learn/learnClassRosterStorage'
import { issueStudentGapConspect } from '../../learn/learnStudentGapConspect'
import rosterStyles from './LearnClassRosterPanel.module.css'
import sidebarStyles from './LearnLessonSidebar.module.css'

type Props = {
  student: ClassStudent
  rosterSectionId: string
  sectionTitle: string
  gradeId?: string
  chapterId?: string
  sectionId?: string
  className?: string
  /** Компактный вид для узкой боковой панели урока */
  compact?: boolean
  onIssued?: () => void
}

export function ClassStudentConspectBtn({
  student,
  rosterSectionId,
  sectionTitle,
  gradeId,
  chapterId,
  sectionId,
  className,
  compact = false,
  onIssued,
}: Props) {
  const { t, locale } = useT()

  const onClick = (e: MouseEvent) => {
    e.stopPropagation()
    issueStudentGapConspect({
      student,
      sectionTitle,
      locale,
      gradeId,
      chapterId,
      sectionId,
      className,
      rosterSectionId,
    })
    onIssued?.()
  }

  return (
    <button
      type="button"
      className={compact ? sidebarStyles.conspectBtn : rosterStyles.conspectBtn}
      onClick={onClick}
      title={t('learn.studentStats.conspect.generate')}
      aria-label={t('learn.studentStats.conspect.generate')}
    >
      {compact ? '📄' : t('learn.studentStats.conspect.short')}
    </button>
  )
}
