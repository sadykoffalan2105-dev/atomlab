import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  G7_TEXTBOOK_TOTAL_PAGES,
  g7TextbookPdfUrl,
  g7TextbookSectionPage,
} from '../../data/learnTextbookG7'
import { learnChapterById, learnGradeById, learnSectionById } from '../../data/learnCurriculumUz'
import { buildSectionOutlineBlock } from '../../learn/learnSectionKnowledge'
import { useT } from '../../i18n/useT'
import { LearnAssistantPanel } from './LearnAssistantPanel'
import styles from './LearnTextbookReader.module.css'

type Props = {
  gradeId: string
}

function TextbookPdfFrame({ page, title }: { page: number; title: string }) {
  return (
    <iframe
      key={page}
      className={styles.frame}
      title={title}
      src={g7TextbookPdfUrl(page)}
    />
  )
}

export function LearnTextbookReader({ gradeId }: Props) {
  const { t, locale } = useT()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const grade = learnGradeById(gradeId)

  const chapterId = search.get('chapter') ?? grade?.chapters[0]?.id ?? 'c1'
  const sectionId = search.get('section') ?? ''
  const chapter = learnChapterById(gradeId, chapterId)

  const defaultPage = useMemo(() => {
    if (sectionId && chapter) {
      return g7TextbookSectionPage(chapterId, sectionId)
    }
    if (chapter) {
      const first = chapter.sections[0]
      return first ? g7TextbookSectionPage(chapterId, first.id) : 1
    }
    return 1
  }, [chapter, chapterId, sectionId])

  const pageParam = search.get('page')
  const page = pageParam ? Math.min(G7_TEXTBOOK_TOTAL_PAGES, Math.max(1, Number(pageParam) || defaultPage)) : defaultPage

  const [pageInput, setPageInput] = useState(String(page))
  const [bookFullscreen, setBookFullscreen] = useState(false)
  const [showTeacher, setShowTeacher] = useState(true)

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  useEffect(() => {
    if (!bookFullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBookFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [bookFullscreen])

  const setPage = useCallback(
    (next: number) => {
      const clamped = Math.min(G7_TEXTBOOK_TOTAL_PAGES, Math.max(1, next))
      const nextParams = new URLSearchParams(search)
      nextParams.set('page', String(clamped))
      if (chapterId) nextParams.set('chapter', chapterId)
      if (sectionId) nextParams.set('section', sectionId)
      setSearch(nextParams, { replace: true })
    },
    [chapterId, search, sectionId, setSearch],
  )

  const openSection = useCallback(
    (chId: string, secId: string) => {
      const p = g7TextbookSectionPage(chId, secId)
      navigate(`/learn/g/${gradeId}/book?chapter=${chId}&section=${secId}&page=${p}`)
    },
    [gradeId, navigate],
  )

  const activeSectionId = sectionId || chapter?.sections[0]?.id || ''
  const section = learnSectionById(gradeId, chapterId, activeSectionId)
  const sectionTitle = section ? t(section.titleKey) : ''
  const slideBody = useMemo(() => {
    if (!section) return ''
    return buildSectionOutlineBlock(
      {
        locale: locale === 'en' ? 'en' : 'ru',
        gradeId,
        chapterId,
        sectionId: activeSectionId,
        sectionTitle,
        slideTitle: sectionTitle,
        slideBody: '',
        mode: 'teacher',
        kpNumber: section.kpNumber,
        curriculumOnly: false,
      },
      1200,
    )
  }, [activeSectionId, chapterId, gradeId, locale, section, sectionTitle])

  const pageToolbar = (
    <>
      <button type="button" className={styles.toolBtn} onClick={() => setPage(page - 1)} disabled={page <= 1}>
        {t('learn.textbook.prevPage')}
      </button>
      <form
        className={styles.pageForm}
        onSubmit={(e) => {
          e.preventDefault()
          setPage(Number(pageInput) || page)
        }}
      >
        <label className={styles.pageLabel}>
          {t('learn.textbook.page')}
          <input
            className={styles.pageInput}
            inputMode="numeric"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            aria-label={t('learn.textbook.page')}
          />
        </label>
        <span className={styles.pageTotal}>/ {G7_TEXTBOOK_TOTAL_PAGES}</span>
        <button type="submit" className={styles.toolBtn}>
          {t('learn.textbook.go')}
        </button>
      </form>
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => setPage(page + 1)}
        disabled={page >= G7_TEXTBOOK_TOTAL_PAGES}
      >
        {t('learn.textbook.nextPage')}
      </button>
      <button
        type="button"
        className={`${styles.toolBtn} ${styles.toolBtnAccent}`}
        onClick={() => setBookFullscreen(true)}
        title={t('learn.textbook.fullscreen')}
      >
        {t('learn.textbook.fullscreen')}
      </button>
    </>
  )

  if (!grade || !chapter) {
    return (
      <div className={styles.shell}>
        <p>{t('compound.notFound')}</p>
        <Link className={styles.backLink} to={`/learn/g/${gradeId}`}>
          {t('learn.backGrades')}
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <div className={styles.topBar}>
        <Link className={styles.backLink} to={`/learn/g/${gradeId}`}>
          {t('learn.backGrades')}
        </Link>
        <div className={styles.topBarTitle}>
          <h1 className={styles.title}>{t('learn.textbook.title')}</h1>
          <p className={styles.subtitle}>{t(grade.textbookRefKey)}</p>
        </div>
        <div className={styles.topBarActions}>
          <button
            type="button"
            className={showTeacher ? styles.toggleOn : styles.toggleBtn}
            onClick={() => setShowTeacher((v) => !v)}
          >
            {t('learn.textbook.teacherToggle')}
          </button>
          <Link
            className={styles.lessonLink}
            to={`/learn/g/${gradeId}/c/${chapterId}/s/${activeSectionId}?from=book`}
          >
            {t('learn.textbook.openLesson')}
          </Link>
        </div>
      </div>

      <div className={`${styles.layout}${showTeacher && section ? ` ${styles.layoutWithTeacher}` : ''}`}>
        <aside className={styles.sidebar} aria-label={t('learn.textbook.toc')}>
          {grade.chapters.map((ch) => {
            const open = ch.id === chapterId
            return (
              <div key={ch.id} className={styles.chapterBlock}>
                <button
                  type="button"
                  className={`${styles.chapterBtn} ${open ? styles.chapterBtnOpen : ''}`}
                  onClick={() => {
                    const first = ch.sections[0]
                    if (first) openSection(ch.id, first.id)
                  }}
                  aria-expanded={open}
                >
                  {t(ch.titleKey)}
                </button>
                {open ? (
                  <ul className={styles.sectionList}>
                    {ch.sections.map((sec) => {
                      const active = sec.id === activeSectionId
                      return (
                        <li key={sec.id}>
                          <button
                            type="button"
                            className={`${styles.sectionBtn} ${active ? styles.sectionBtnActive : ''}`}
                            onClick={() => openSection(ch.id, sec.id)}
                          >
                            <span className={styles.sectionKp}>{t('learn.section.kp', { n: sec.kpNumber })}</span>
                            <span className={styles.sectionTitle}>{t(sec.titleKey)}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
            )
          })}
        </aside>

        <div className={styles.readerCol}>
          <div className={styles.toolbar} role="toolbar" aria-label={t('learn.textbook.toolbar')}>
            {pageToolbar}
          </div>
          <div className={styles.frameWrap}>
            <TextbookPdfFrame page={page} title={t('learn.textbook.frameTitle')} />
          </div>
        </div>

        {showTeacher && section ? (
          <div className={styles.teacherCol}>
            <LearnAssistantPanel
              gradeId={gradeId}
              chapterId={chapterId}
              section={section}
              slideIndex={0}
              slideTitle={sectionTitle}
              slideBody={slideBody}
            />
          </div>
        ) : null}
      </div>

      {bookFullscreen
        ? createPortal(
            <div className={styles.fsOverlay} role="dialog" aria-modal="true">
              <header className={styles.fsToolbar}>
                <span className={styles.fsTitle}>{t('learn.textbook.title')} · {t('learn.textbook.page')} {page}</span>
                <div className={styles.fsToolbarActions}>{pageToolbar}</div>
                <button type="button" className={styles.fsClose} onClick={() => setBookFullscreen(false)}>
                  {t('learn.textbook.fullscreenClose')}
                </button>
              </header>
              <div className={styles.fsFrameWrap}>
                <TextbookPdfFrame page={page} title={t('learn.textbook.frameTitle')} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
