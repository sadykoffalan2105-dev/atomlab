import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  getTextbookConfig,
  textbookPdfUrl,
  textbookSectionPage,
} from '../../data/learnTextbook'
import { learnChapterById, learnGradeById, learnSectionById } from '../../data/learnCurriculumUz'
import {
  isReaderGradeId,
  loadReaderGrade,
  readerUnitById,
  type ReaderGrade,
  type ReaderUnit,
} from '../../data/textbook/bookReader'
import { buildSectionOutlineBlock } from '../../learn/learnSectionKnowledge'
import { useT } from '../../i18n/useT'
import type { MessageKey } from '../../i18n/messagesRu'
import { LearnAssistantPanel } from './LearnAssistantPanel'
import { BookEquationsPanel } from './book/BookEquationsPanel'
import { appSectionFromKey, useMediaQuery } from './book/bookUi'
import styles from './LearnTextbookReader.module.css'

type Props = {
  gradeId: string
}

type PanelTab = 'equations' | 'teacher'

/** На телефонах и узких планшетах iframe с PDF пустой — показываем панель уравнений и ссылку на сам PDF. */
const PHONE_QUERY = '(max-width: 899px)'

function TextbookPdfFrame({ page, title, src }: { page: number; title: string; src: string }) {
  return <iframe key={page} className={styles.frame} title={title} src={src} />
}

export function LearnTextbookReader({ gradeId }: Props) {
  const { t, locale } = useT()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const grade = learnGradeById(gradeId)
  const textbook = getTextbookConfig(gradeId)
  const phone = useMediaQuery(PHONE_QUERY)

  /* Уравнения учебника (панель справа) — отдельный чанк, нужен и для ?unit= → глава/раздел. */
  const readerGradeId = isReaderGradeId(gradeId) ? gradeId : null
  const [readerGrade, setReaderGrade] = useState<ReaderGrade | null>(null)
  useEffect(() => {
    if (!readerGradeId) return
    let alive = true
    loadReaderGrade(readerGradeId).then(
      (g) => {
        if (alive) setReaderGrade(g)
      },
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [readerGradeId])

  const unitParam = search.get('unit')
  const rxParam = search.get('rx')
  const selectedUnit = readerGrade && unitParam ? readerUnitById(readerGrade, unitParam) : null
  const unitSection = useMemo(() => {
    if (!selectedUnit) return null
    for (const key of selectedUnit.appSections) {
      const hit = appSectionFromKey(gradeId, key)
      if (hit) return hit
    }
    return null
  }, [gradeId, selectedUnit])

  const chapterId = search.get('chapter') ?? unitSection?.chapterId ?? grade?.chapters[0]?.id ?? 'c1'
  const sectionId = search.get('section') ?? unitSection?.sectionId ?? ''
  const chapter = learnChapterById(gradeId, chapterId)

  const defaultPage = useMemo(() => {
    if (!textbook) return 1
    if (sectionId && chapter) {
      return textbookSectionPage(gradeId, chapterId, sectionId)
    }
    if (chapter) {
      const first = chapter.sections[0]
      return first ? textbookSectionPage(gradeId, chapterId, first.id) : 1
    }
    return 1
  }, [chapter, chapterId, gradeId, sectionId, textbook])

  const totalPages = textbook?.totalPages ?? 1
  const frameTitleKey = (textbook?.frameTitleKey ?? 'learn.textbook.frameTitle') as MessageKey

  const pageParam = search.get('page')
  const page = pageParam ? Math.min(totalPages, Math.max(1, Number(pageParam) || defaultPage)) : defaultPage

  const [pageInput, setPageInput] = useState(String(page))
  const [bookFullscreen, setBookFullscreen] = useState(false)
  const [tab, setTab] = useState<PanelTab>('equations')

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
      const clamped = Math.min(totalPages, Math.max(1, next))
      const nextParams = new URLSearchParams(search)
      nextParams.set('page', String(clamped))
      if (chapterId) nextParams.set('chapter', chapterId)
      if (sectionId) nextParams.set('section', sectionId)
      setSearch(nextParams, { replace: true })
    },
    [chapterId, search, sectionId, setSearch, totalPages],
  )

  const openSection = useCallback(
    (chId: string, secId: string) => {
      const p = textbookSectionPage(gradeId, chId, secId)
      navigate(`/learn/g/${gradeId}/book?chapter=${chId}&section=${secId}&page=${p}`)
    },
    [gradeId, navigate],
  )

  /* Параграф из панели уравнений: страница PDF, оглавление и ?unit= (без ?rx=). */
  const openUnit = useCallback(
    (unit: ReaderUnit) => {
      const hits = unit.appSections
        .map((key) => appSectionFromKey(gradeId, key))
        .filter((h): h is NonNullable<typeof h> => h != null)
      const pick = hits.find((h) => h.chapterId === chapterId) ?? hits[0] ?? null
      const q = new URLSearchParams()
      if (pick) {
        q.set('chapter', pick.chapterId)
        q.set('section', pick.sectionId)
      } else {
        q.set('chapter', chapterId)
      }
      const p = unit.pageStart ?? (pick ? textbookSectionPage(gradeId, pick.chapterId, pick.sectionId) : page)
      q.set('page', String(Math.min(totalPages, Math.max(1, p))))
      q.set('unit', unit.unitId)
      navigate(`/learn/g/${gradeId}/book?${q.toString()}`)
    },
    [chapterId, gradeId, navigate, page, totalPages],
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

  const pdfSrc = textbookPdfUrl(gradeId, page)
  const frameTitle = t(frameTitleKey)

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
        <span className={styles.pageTotal}>/ {totalPages}</span>
        <button type="submit" className={styles.toolBtn}>
          {t('learn.textbook.go')}
        </button>
      </form>
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => setPage(page + 1)}
        disabled={page >= totalPages}
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

  if (!grade || !chapter || !textbook) {
    return (
      <div className={styles.shell}>
        <p>{t('compound.notFound')}</p>
        <Link className={styles.backLink} to={`/learn/g/${gradeId}`}>
          {t('learn.backGrades')}
        </Link>
      </div>
    )
  }

  const teacherAvailable = !!section
  const activeTab: PanelTab = tab === 'teacher' && teacherAvailable ? 'teacher' : readerGradeId ? 'equations' : 'teacher'

  const sidePanel = (
    <div className={styles.teacherCol} data-book-side-panel>
      <div className={styles.tabs} role="tablist" aria-label={t('learn.bookPanel.tabsAria')}>
        {readerGradeId ? (
          <button
            type="button"
            role="tab"
            className={activeTab === 'equations' ? styles.tabOn : styles.tab}
            aria-selected={activeTab === 'equations'}
            onClick={() => setTab('equations')}
            data-book-tab="equations"
          >
            {t('learn.bookPanel.tabEquations')}
          </button>
        ) : null}
        <button
          type="button"
          role="tab"
          className={activeTab === 'teacher' ? styles.tabOn : styles.tab}
          aria-selected={activeTab === 'teacher'}
          onClick={() => setTab('teacher')}
          disabled={!teacherAvailable}
          data-book-tab="teacher"
        >
          {t('learn.bookPanel.tabTeacher')}
        </button>
      </div>
      {activeTab === 'equations' && readerGradeId ? (
        <BookEquationsPanel
          gradeId={readerGradeId}
          chapterId={chapterId}
          activeSectionId={activeSectionId}
          selectedUnitId={selectedUnit?.unitId ?? null}
          highlightRxId={rxParam}
          narrow={phone}
          onOpenUnit={openUnit}
        />
      ) : section ? (
        <LearnAssistantPanel
          gradeId={gradeId}
          chapterId={chapterId}
          section={section}
          slideIndex={0}
          slideTitle={sectionTitle}
          slideBody={slideBody}
        />
      ) : null}
    </div>
  )

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
          <Link
            className={styles.lessonLink}
            to={`/learn/g/${gradeId}/c/${chapterId}/s/${activeSectionId}?from=book`}
          >
            {t('learn.textbook.openLesson')}
          </Link>
        </div>
      </div>

      {phone ? (
        <div className={styles.phoneLayout}>
          <div className={styles.phoneBar}>
            <label className={styles.tocSelectLabel}>
              <span className={styles.tocSelectText}>{t('learn.bookPanel.tocSelect')}</span>
              <select
                className={styles.tocSelect}
                value={`${chapterId}/${activeSectionId}`}
                onChange={(e) => {
                  const [chId, secId] = e.target.value.split('/')
                  if (chId && secId) openSection(chId, secId)
                }}
              >
                {grade.chapters.map((ch) => (
                  <optgroup key={ch.id} label={t(ch.titleKey)}>
                    {ch.sections.map((sec) => (
                      <option key={sec.id} value={`${ch.id}/${sec.id}`}>
                        {t('learn.section.kp', { n: sec.kpNumber })} · {t(sec.titleKey)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <a className={styles.pdfLink} href={pdfSrc} target="_blank" rel="noreferrer" data-book-open-pdf>
              {t('learn.bookPanel.openPdf')} · {t('learn.textbook.page')} {page}
            </a>
          </div>
          {sidePanel}
        </div>
      ) : (
        <div className={`${styles.layout} ${styles.layoutWithTeacher}`}>
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
              <TextbookPdfFrame page={page} title={frameTitle} src={pdfSrc} />
            </div>
          </div>

          {sidePanel}
        </div>
      )}

      {bookFullscreen
        ? createPortal(
            <div className={styles.fsOverlay} role="dialog" aria-modal="true">
              <header className={styles.fsToolbar}>
                <span className={styles.fsTitle}>
                  {t('learn.textbook.title')} · {t('learn.textbook.page')} {page}
                </span>
                <div className={styles.fsToolbarActions}>{pageToolbar}</div>
                <button type="button" className={styles.fsClose} onClick={() => setBookFullscreen(false)}>
                  {t('learn.textbook.fullscreenClose')}
                </button>
              </header>
              <div className={styles.fsFrameWrap}>
                <TextbookPdfFrame page={page} title={frameTitle} src={pdfSrc} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
