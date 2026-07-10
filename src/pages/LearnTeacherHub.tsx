import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LEARN_GRADES,
  learnSectionById,
  learnSectionPathId,
} from '../data/learnCurriculumUz'
import { getLearnFgosMeta } from '../data/learnFgosMatrix'
import { exportSectionLessonMarkdown, downloadTextFile } from '../learn/learnLessonExport'
import {
  deleteTeacherAssignment,
  deleteTeacherClass,
  newTeacherId,
  readTeacherAssignments,
  readTeacherClasses,
  saveTeacherAssignment,
  saveTeacherClass,
  type TeacherAssignment,
  type TeacherClass,
} from '../learn/learnTeacherStorage'
import { readLearnProgress } from '../learn/learnProgressStorage'
import { useT } from '../i18n/useT'
import styles from './LearnPage.module.css'

export function LearnTeacherHub() {
  const { t } = useT()
  const [classes, setClasses] = useState(readTeacherClasses)
  const [assignments, setAssignments] = useState(readTeacherAssignments)
  const [className, setClassName] = useState('')
  const [gradeId, setGradeId] = useState('g8')
  const [assignTitle, setAssignTitle] = useState('')
  const [dueLabel, setDueLabel] = useState('')
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [pickedSections, setPickedSections] = useState<Set<string>>(new Set())

  const refresh = useCallback(() => {
    setClasses(readTeacherClasses())
    setAssignments(readTeacherAssignments())
  }, [])

  const allSections = useMemo(
    () =>
      LEARN_GRADES.flatMap((g) =>
        g.chapters.flatMap((ch) =>
          ch.sections.map((s) => ({
            pathId: learnSectionPathId(s),
            gradeId: g.id,
            chapterId: ch.id,
            sectionId: s.id,
            title: t(s.titleKey),
            kp: s.kpNumber,
          })),
        ),
      ),
    [t],
  )

  const onCreateClass = () => {
    if (!className.trim()) return
    const cls: TeacherClass = {
      id: newTeacherId(),
      name: className.trim(),
      gradeId,
      createdAt: Date.now(),
    }
    saveTeacherClass(cls)
    setClassName('')
    refresh()
    setSelectedClassId(cls.id)
  }

  const onCreateAssignment = () => {
    if (!selectedClassId || !assignTitle.trim() || pickedSections.size === 0) return
    const a: TeacherAssignment = {
      id: newTeacherId(),
      classId: selectedClassId,
      sectionPathIds: [...pickedSections],
      title: assignTitle.trim(),
      dueLabel: dueLabel.trim() || undefined,
      createdAt: Date.now(),
    }
    saveTeacherAssignment(a)
    setAssignTitle('')
    setDueLabel('')
    setPickedSections(new Set())
    refresh()
  }

  const exportProgress = () => {
    downloadTextFile(
      `atomlab-progress-${Date.now()}.json`,
      JSON.stringify(readLearnProgress(), null, 2),
      'application/json',
    )
  }

  const toggleSection = (pathId: string) => {
    setPickedSections((prev) => {
      const next = new Set(prev)
      if (next.has(pathId)) next.delete(pathId)
      else next.add(pathId)
      return next
    })
  }

  const classAssignments = assignments.filter((a) => a.classId === selectedClassId)

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} to="/learn">
        {t('learn.teacher.back')}
      </Link>
      <h1 className={styles.h}>{t('learn.teacher.title')}</h1>
      <p className={styles.lead}>{t('learn.teacher.lead')}</p>

      <div className={styles.indexToolRow}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={exportProgress}>
          {t('learn.teacher.exportProgress')}
        </button>
      </div>

      <section className={styles.teacherBlock}>
        <h2 className={styles.h}>{t('learn.teacher.newClass')}</h2>
        <div className={styles.teacherFormRow}>
          <input
            className={styles.teacherInput}
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder={t('learn.teacher.className')}
          />
          <select
            className={styles.teacherInput}
            value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
            aria-label={t('learn.teacher.grade')}
          >
            <option value="g7">7</option>
            <option value="g8">8</option>
            <option value="g9">9</option>
            <option value="g10">10</option>
            <option value="g11">11</option>
          </select>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onCreateClass}>
            {t('learn.teacher.newClass')}
          </button>
        </div>
        <ul className={styles.lessonList}>
          {classes.map((c) => (
            <li key={c.id} className={styles.lessonRow}>
              <button
                type="button"
                className={selectedClassId === c.id ? styles.lessonLinkOn : styles.lessonLink}
                onClick={() => setSelectedClassId(c.id)}
              >
                {c.name} ({c.gradeId})
              </button>
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  deleteTeacherClass(c.id)
                  if (selectedClassId === c.id) setSelectedClassId(null)
                  refresh()
                }}
              >
                {t('learn.teacher.deleteClass')}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selectedClassId ? (
        <section className={styles.teacherBlock}>
          <h2 className={styles.h}>{t('learn.teacher.newAssignment')}</h2>
          <div className={styles.teacherFormRow}>
            <input
              className={styles.teacherInput}
              value={assignTitle}
              onChange={(e) => setAssignTitle(e.target.value)}
              placeholder={t('learn.teacher.assignmentTitle')}
            />
            <input
              className={styles.teacherInput}
              value={dueLabel}
              onChange={(e) => setDueLabel(e.target.value)}
              placeholder={t('learn.teacher.dueLabel')}
            />
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onCreateAssignment}>
              {t('learn.teacher.newAssignment')}
            </button>
          </div>
          <p className={styles.lead}>{t('learn.teacher.pickSections')}</p>
          <div className={styles.teacherSectionGrid}>
            {allSections
              .filter((s) => s.gradeId === classes.find((c) => c.id === selectedClassId)?.gradeId)
              .map((s) => (
                <label key={s.pathId} className={styles.teacherCheck}>
                  <input
                    type="checkbox"
                    checked={pickedSections.has(s.pathId)}
                    onChange={() => toggleSection(s.pathId)}
                  />
                  §{s.kp} {s.title}
                </label>
              ))}
          </div>

          <h3 className={styles.h}>{t('learn.teacher.assignments')}</h3>
          <ul className={styles.lessonList}>
            {classAssignments.map((a) => (
              <li key={a.id} className={styles.teacherAssignCard}>
                <strong>{a.title}</strong>
                {a.dueLabel ? <span className={styles.lessonMeta}> — {a.dueLabel}</span> : null}
                <ul>
                  {a.sectionPathIds.map((pid) => {
                    const [g, ch, sec] = pid.split('-')
                    const section = learnSectionById(g!, ch!, sec!)
                    if (!section) return null
                    return (
                      <li key={pid}>
                        <Link to={`/learn/g/${g}/c/${ch}/s/${sec}`}>{t('learn.teacher.openSection')}</Link>
                        {' · '}
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() =>
                            downloadTextFile(
                              `${pid}-lesson.md`,
                              exportSectionLessonMarkdown(g!, ch!, section),
                            )
                          }
                        >
                          {t('learn.teacher.exportLesson')}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    deleteTeacherAssignment(a.id)
                    refresh()
                  }}
                >
                  {t('learn.teacher.deleteClass')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.teacherBlock}>
        <h2 className={styles.h}>{t('learn.teacher.fgosLabel')}</h2>
        <ul className={styles.lessonList}>
          {allSections.slice(0, 12).map((s) => {
            const meta = getLearnFgosMeta(s.gradeId as import('../types/learn').LearnGradeId, s.chapterId, s.sectionId)
            const tierKey =
              meta.contentTier === 'full'
                ? 'learn.teacher.contentFull'
                : meta.contentTier === 'standard'
                  ? 'learn.teacher.contentStandard'
                  : 'learn.teacher.contentOutline'
            return (
              <li key={s.pathId} className={styles.lessonRow}>
                <span>{s.title}</span>
                <span className={styles.lessonMeta}>
                  {t(tierKey)} · {t('learn.teacher.hours', { n: meta.hours })}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
