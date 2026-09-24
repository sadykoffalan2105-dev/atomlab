import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useMatch, useParams } from 'react-router-dom'
import { LearnSectionRunner } from '../components/learn/LearnSectionRunner'
import { legacyTopicRedirect } from '../data/learnLegacyRedirects'
import {
  LEARN_GRADES,
  learnChapterById,
  learnGradeById,
  learnSectionById,
  learnSectionPathId,
  learnTotalSectionCount,
} from '../data/learnCurriculumUz'
import { getLearnFgosMeta } from '../data/learnFgosMatrix'
import {
  readLearnProgress,
  sectionProgress,
  type LearnProgressV3,
} from '../learn/learnProgressStorage'
import { useT } from '../i18n/useT'
import type { MessageKey } from '../i18n/messagesRu'
import { LearnTaskRunner } from './LearnTaskRunner'
import { LEARN_TASK_CATEGORY_IDS } from '../data/learnTaskCategories'
import { LearnTasksHub } from './LearnTasksHub'
import { LearnTextbookReader } from '../components/learn/LearnTextbookReader'
import { gradeHasTextbook } from '../data/learnTextbookG7'
import { prefetchLearnSectionHub, prefetchWasmCore } from '../learn/learnHubPrefetch'
import { GradeGlyph } from '../components/learn/hub/GradeGlyph'
import { EmptyStateArt, VrLabArt } from '../components/learn/hub/HubArt'
import {
  IconArrowLeft,
  IconArrowRight,
  IconBook,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconFlask,
  IconLayers,
  IconPathways,
  IconPlay,
  IconResearch,
  IconSparkles,
  IconTasks,
  IconTeacher,
  IconVr,
} from '../components/learn/hub/HubIcons'
import { ProgressRing } from '../components/learn/hub/ProgressRing'
import {
  gradeNumber,
  percent,
  splitChapterTitle,
  splitSectionTitle,
  toRoman,
} from '../components/learn/hub/hubText'
import {
  PRIMARY_TONE,
  gradeTone,
  stripLeadingArrow,
  toneStyle,
} from '../components/learn/hub/hubTone'
import styles from './LearnHubs.module.css'

type QuickAction = {
  to: string
  titleKey: MessageKey
  descKey: MessageKey
  icon: (p: { className?: string }) => ReactNode
  tone: CSSProperties
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    to: '/learn/pathways',
    titleKey: 'learn.pathways.open',
    descKey: 'learn.pathways.lead',
    icon: IconPathways,
    tone: toneStyle('var(--lt-accent-teal)', 'var(--lt-accent-cyan)'),
  },
  {
    to: '/learn/tasks',
    titleKey: 'learn.grades.tasks',
    descKey: 'learn.tasksLead',
    icon: IconTasks,
    tone: toneStyle('var(--lt-g9-a)', 'var(--lt-g9-b)'),
  },
  {
    to: '/learn/teacher',
    titleKey: 'learn.teacher.linkGrades',
    descKey: 'learn.teacher.lead',
    icon: IconTeacher,
    tone: toneStyle('var(--lt-g8-a)', 'var(--lt-g8-b)'),
  },
  {
    to: '/organic',
    titleKey: 'learn.research.open',
    descKey: 'learn.research.openLead',
    icon: IconResearch,
    tone: toneStyle('var(--lt-g10-a)', 'var(--lt-g10-b)'),
  },
  {
    to: '/vr-lab?from=learn',
    titleKey: 'learn.vrLab.title',
    descKey: 'learn.vrLab.lead',
    icon: IconVr,
    tone: toneStyle('var(--lt-g11-a)', 'var(--lt-primary-2)'),
  },
]

function GradesIndex({ progress }: { progress: LearnProgressV3 }) {
  const { t } = useT()
  const total = learnTotalSectionCount()
  const done = progress.completedSectionIds.length
  const resume = progress.last
  const resumeSection = resume?.sectionId
    ? learnSectionById(resume.gradeId, resume.chapterId, resume.sectionId)
    : undefined
  const resumeGrade = resume ? learnGradeById(resume.gradeId) : undefined
  const resumeChapter = resume ? learnChapterById(resume.gradeId, resume.chapterId) : undefined
  const pct = percent(done, total)

  return (
    <PageShell>
      <section className={styles.hero} aria-labelledby="learn-main-title">
        <div className={styles.heroMain}>
          <p className={styles.eyebrow}>
            <IconSparkles />
            {t('learn.title')}
          </p>
          <h1 className={styles.display} id="learn-main-title">
            {t('learn.grades.title')}
          </h1>
          <p className={styles.lead}>{t('learn.grades.lead')}</p>
          <div className={styles.heroCards}>
            <div className={`${styles.glass} ${styles.progressCard}`} style={PRIMARY_TONE}>
              <ProgressRing value={done / Math.max(1, total)} size={76} stroke={8} label={`${pct}%`} className={styles.ring} />
              <div className={styles.statStack}>
                <span className={styles.kicker}>{t('learn.hubUi.overall')}</span>
                <span className={styles.statValue} aria-live="polite">
                  {t('learn.progressSection', { done, total })}
                </span>
                <ProgressBar value={pct} />
              </div>
            </div>
            {resume?.sectionId ? (
              <Link
                className={styles.resumeCard}
                to={`/learn/g/${resume.gradeId}/c/${resume.chapterId}/s/${resume.sectionId}`}
                style={gradeTone(resume.gradeId)}
              >
                <span className={styles.resumePlay}>
                  <IconPlay />
                </span>
                <span className={styles.statStack}>
                  <span className={styles.kicker}>{t('learn.hubUi.resumeEyebrow')}</span>
                  <span className={styles.resumeTitle}>
                    {t('learn.resume', {
                      title: resumeSection ? t(resumeSection.titleKey) : resume.sectionId,
                    })}
                  </span>
                  {resumeGrade ? (
                    <span className={styles.resumeMeta}>
                      {t(resumeGrade.titleKey)}
                      {resumeChapter
                        ? ` · ${splitChapterTitle(t(resumeChapter.titleKey)).prefix ?? toRoman(resumeChapter.order)}`
                        : null}
                    </span>
                  ) : null}
                </span>
                <IconArrowRight className={styles.resumeArrow} />
              </Link>
            ) : null}
          </div>
        </div>

        <Link to="/learn/talk" className={styles.vrBanner}>
          <VrLabArt className={styles.vrArt} />
          <span className={styles.vrBody}>
            <span className={styles.vrBadge}>
              <IconSparkles />
            </span>
            <span className={styles.vrTitle}>{t('learn.talk.title')}</span>
            <span className={styles.vrLead}>{t('learn.talk.lead')}</span>
            <span className={`${styles.btn} ${styles.btnLight}`}>
              {t('learn.talk.open')}
              <IconArrowRight />
            </span>
          </span>
        </Link>
      </section>

      <section aria-labelledby="learn-quick-title">
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle} id="learn-quick-title">
            {t('learn.hubUi.quickTitle')}
          </h2>
        </div>
        <div className={styles.quickGrid}>
          {QUICK_ACTIONS.map((q) => {
            const Icon = q.icon
            return (
              <Link
                key={q.to}
                to={q.to}
                className={`${styles.glass} ${styles.cardLink} ${styles.quickTile}`}
                style={q.tone}
              >
                <span className={styles.quickIcon}>
                  <Icon />
                </span>
                <span className={styles.quickTitle}>{t(q.titleKey)}</span>
                <span className={styles.quickDesc}>{t(q.descKey)}</span>
                <IconArrowRight className={styles.quickArrow} />
              </Link>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="learn-grades-title">
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle} id="learn-grades-title">
            {t('learn.hubUi.gradesTitle')}
          </h2>
        </div>
        <div className={styles.gradeGrid}>
          {LEARN_GRADES.map((grade) => {
            const sectionIds = grade.chapters.flatMap((c) =>
              c.sections.map((s) => learnSectionPathId(s)),
            )
            const { done: gDone, total: gTotal } = sectionProgress(sectionIds, progress)
            const gPct = percent(gDone, gTotal)
            return (
              <Link
                key={grade.id}
                to={`/learn/g/${grade.id}`}
                className={`${styles.glass} ${styles.cardLink} ${styles.gradeCard}`}
                style={gradeTone(grade.id)}
                onMouseEnter={() => prefetchWasmCore()}
              >
                <GradeGlyph gradeId={grade.id} className={styles.gradeGlyph} />
                <span className={styles.gradeNum} aria-hidden>
                  {gradeNumber(grade.id)}
                </span>
                <span className={styles.gradeTitle}>{t(grade.titleKey)}</span>
                <span className={styles.gradeRef}>{t(grade.textbookRefKey)}</span>
                <span className={styles.gradeFoot}>
                  <span className={styles.countRow}>
                    <span>{t('learn.progressSection', { done: gDone, total: gTotal })}</span>
                    <span className={styles.countPct}>{gPct}%</span>
                  </span>
                  <ProgressBar value={gPct} />
                  <span className={styles.gradeCta}>
                    {t('learn.hubUi.open')}
                    <span className={styles.ctaDot}>
                      <IconArrowRight />
                    </span>
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>
    </PageShell>
  )
}

function GradeHub({ gradeId, progress }: { gradeId: string; progress: LearnProgressV3 }) {
  const { t } = useT()
  const grade = learnGradeById(gradeId)
  if (!grade) return null

  const allIds = grade.chapters.flatMap((c) => c.sections.map((s) => learnSectionPathId(s)))
  const { done: gDone, total: gTotal } = sectionProgress(allIds, progress)
  const gPct = percent(gDone, gTotal)

  return (
    <PageShell tone={gradeTone(grade.id)}>
      <Breadcrumbs items={[{ to: '/learn', label: t('nav.learn') }, { label: t(grade.titleKey) }]} />

      <header className={styles.band}>
        <GradeGlyph gradeId={grade.id} className={styles.bandGlyph} />
        <span className={styles.gradeBadge} aria-hidden>
          {gradeNumber(grade.id)}
        </span>
        <div className={styles.bandText}>
          <h1 className={styles.bandTitle}>{t(grade.titleKey)}</h1>
          <p className={styles.bandLead}>{t(grade.textbookRefKey)}</p>
          {gradeHasTextbook(grade.id) || grade.id === 'g10' ? (
            <ToolRow>
              {gradeHasTextbook(grade.id) ? (
                <Link className={`${styles.btn} ${styles.btnPrimary}`} to={`/learn/g/${grade.id}/book`}>
                  <IconBook />
                  {t('learn.textbook.open')}
                </Link>
              ) : null}
              {grade.id === 'g10' ? (
                <Link className={`${styles.btn} ${styles.btnGlass}`} to="/organic">
                  <IconResearch />
                  {t('learn.research.open')}
                </Link>
              ) : null}
            </ToolRow>
          ) : null}
        </div>
        <div className={styles.stats}>
          <Stat value={grade.chapters.length} label={t('learn.chaptersTitle')} />
          <Stat value={gTotal} label={t('learn.sectionsTitle')} />
          <div className={`${styles.stat} ${styles.statRing}`}>
            <ProgressRing value={gTotal ? gDone / gTotal : 0} size={56} stroke={6} label={`${gPct}%`} className={styles.ring} />
            <span className={styles.statLabel} aria-live="polite">
              {t('learn.progressSection', { done: gDone, total: gTotal })}
            </span>
          </div>
        </div>
      </header>

      {grade.id === 'g10' && (
        <Link to="/organic" className={`${styles.glass} ${styles.cardLink} ${styles.featureStrip}`}>
          <span className={styles.quickIcon}>
            <IconFlask />
          </span>
          <span className={styles.featureText}>
            <span className={styles.quickTitle}>{t('learn.research.open')}</span>
            <span className={styles.quickDesc}>{t('learn.research.openLead')}</span>
          </span>
          <span className={styles.ctaDot}>
            <IconArrowRight />
          </span>
        </Link>
      )}

      <section aria-labelledby="learn-chapters-title">
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle} id="learn-chapters-title">
            {t('learn.chaptersTitle')}
          </h2>
        </div>
        {grade.chapters.length === 0 ? (
          <EmptyState title={t('learn.hubUi.emptyGrade')} backTo="/learn" backLabel={t('learn.backGrades')} />
        ) : (
          <ul className={styles.chapterGrid}>
            {grade.chapters.map((ch, i) => {
              const ids = ch.sections.map((s) => learnSectionPathId(s))
              const { done, total } = sectionProgress(ids, progress)
              const chPct = percent(done, total)
              const minutes = ch.sections.reduce((a, s) => a + s.estimatedMin, 0)
              const { title } = splitChapterTitle(t(ch.titleKey))
              const complete = total > 0 && done >= total
              return (
                <li key={ch.id} className={styles.chapterItem}>
                  <Link
                    className={`${styles.glass} ${styles.cardLink} ${styles.chapterCard}`}
                    to={`/learn/g/${grade.id}/c/${ch.id}`}
                  >
                    <span className={styles.chapterTop}>
                      <span className={styles.roman} aria-hidden>
                        {toRoman(i + 1)}
                      </span>
                      <span className={styles.chip}>
                        <IconClock />
                        {t('learn.estimatedMin', { n: minutes })}
                      </span>
                      {complete ? (
                        <span className={styles.doneDot} title={t('learn.lessonDone')}>
                          <IconCheck />
                        </span>
                      ) : null}
                    </span>
                    <span className={styles.chapterTitle}>{title}</span>
                    <span className={styles.chapterSummary}>{t(ch.summaryKey)}</span>
                    <span className={styles.chapterFoot}>
                      <span className={styles.countRow}>
                        <span>{t('learn.progressSection', { done, total })}</span>
                        <IconArrowRight className={styles.chapterArrow} />
                      </span>
                      <ProgressBar value={chPct} />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
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

  const chapterIndex = Math.max(0, grade.chapters.findIndex((c) => c.id === chapter.id))
  const { prefix, title: chapterTitle } = splitChapterTitle(t(chapter.titleKey))
  const ids = chapter.sections.map((s) => learnSectionPathId(s))
  const { done: cDone, total: cTotal } = sectionProgress(ids, progress)
  const cPct = percent(cDone, cTotal)
  const minutes = chapter.sections.reduce((a, s) => a + s.estimatedMin, 0)

  return (
    <PageShell tone={gradeTone(grade.id)}>
      <Breadcrumbs
        items={[
          { to: '/learn', label: t('nav.learn') },
          { to: `/learn/g/${gradeId}`, label: t(grade.titleKey) },
          { label: prefix ?? chapterTitle },
        ]}
      />

      <header className={`${styles.band} ${styles.bandChapter}`}>
        <GradeGlyph gradeId={grade.id} className={styles.bandGlyph} />
        <span className={styles.gradeBadge} aria-hidden>
          {toRoman(chapterIndex + 1)}
        </span>
        <div className={styles.bandText}>
          <p className={styles.bandEyebrow}>{t(grade.titleKey)}</p>
          <h1 className={styles.bandTitle}>{chapterTitle}</h1>
          <p className={styles.bandLead}>{t(chapter.summaryKey)}</p>
          {gradeHasTextbook(gradeId) || gradeId === 'g10' ? (
            <ToolRow>
              {gradeHasTextbook(gradeId) ? (
                <Link
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  to={`/learn/g/${gradeId}/book?chapter=${chapterId}&section=${chapter.sections[0]?.id ?? 's01'}`}
                >
                  <IconBook />
                  {t('learn.textbook.open')}
                </Link>
              ) : null}
              {gradeId === 'g10' ? (
                <Link
                  className={`${styles.btn} ${gradeHasTextbook(gradeId) ? styles.btnGlass : styles.btnPrimary}`}
                  to={`/organic?chapter=${chapterId.replace(/\D/g, '') || '1'}`}
                >
                  <IconFlask />
                  {t('organicLab.openInLab')}
                </Link>
              ) : null}
            </ToolRow>
          ) : null}
        </div>
        <div className={styles.stats}>
          <Stat value={cTotal} label={t('learn.sectionsTitle')} />
          <div className={`${styles.stat} ${styles.statTime}`}>
            <IconClock className={styles.statIcon} />
            <span className={styles.statNumSm}>{t('learn.estimatedMin', { n: minutes })}</span>
          </div>
        </div>
      </header>

      <div className={styles.chapterLayout}>
        <section aria-labelledby="learn-sections-title" className={styles.chapterMain}>
          <div className={styles.blockHead}>
            <h2 className={styles.blockTitle} id="learn-sections-title">
              {t('learn.sectionsTitle')}
            </h2>
            <span className={styles.blockMeta}>{t('learn.progressSection', { done: cDone, total: cTotal })}</span>
          </div>
          {chapter.sections.length === 0 ? (
            <EmptyState
              title={t('learn.hubUi.emptyChapter')}
              backTo={`/learn/g/${gradeId}`}
              backLabel={t('learn.backChapters')}
            />
          ) : (
            <ol className={styles.timeline}>
              {chapter.sections.map((sec) => {
                const pathId = learnSectionPathId(sec)
                const complete = progress.completedSectionIds.includes(pathId)
                const fgos = getLearnFgosMeta(sec.gradeId, chapterId, sec.id)
                const tierKey =
                  fgos.contentTier === 'full'
                    ? 'learn.teacher.contentFull'
                    : fgos.contentTier === 'standard'
                      ? 'learn.teacher.contentStandard'
                      : 'learn.teacher.contentOutline'
                const { title, practicalLabel } = splitSectionTitle(t(sec.titleKey))
                return (
                  <li key={sec.id} className={styles.timelineItem} data-done={complete || undefined}>
                    <Link
                      className={styles.sectionLink}
                      to={`/learn/g/${gradeId}/c/${chapterId}/s/${sec.id}`}
                      onMouseEnter={() => {
                        prefetchLearnSectionHub(sec.defaultVisualId)
                        prefetchWasmCore()
                      }}
                      onFocus={() => prefetchLearnSectionHub(sec.defaultVisualId)}
                    >
                      <span className={styles.kpBadge}>
                        {complete ? <IconCheck className={styles.kpCheck} /> : null}
                        <span className={complete ? styles.kpTextDone : undefined}>
                          {t('learn.section.kp', { n: sec.kpNumber })}
                        </span>
                      </span>
                      <span className={`${styles.glass} ${styles.sectionCard}`}>
                        <span className={styles.sectionMain}>
                          <span className={styles.sectionTitle}>{title}</span>
                          <span className={styles.chips}>
                            {practicalLabel ? (
                              <span className={`${styles.chip} ${styles.chipPractical}`}>
                                <IconFlask />
                                {practicalLabel}
                              </span>
                            ) : null}
                            <span className={styles.chip}>
                              <IconClock />
                              {t('learn.estimatedMin', { n: sec.estimatedMin })}
                            </span>
                            <span className={`${styles.chip} ${styles.chipTier}`} data-tier={fgos.contentTier}>
                              <IconLayers />
                              {t(tierKey)}
                            </span>
                            {complete ? (
                              <span className={`${styles.chip} ${styles.chipDone}`}>
                                <IconCheck />
                                {t('learn.lessonDone')}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className={styles.sectionArrow}>
                          <IconArrowRight />
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        <aside className={styles.aside}>
          <div className={`${styles.glass} ${styles.asideCard} ${styles.asideProgress}`}>
            <ProgressRing value={cTotal ? cDone / cTotal : 0} size={88} stroke={9} label={`${cPct}%`} className={styles.ring} />
            <div className={styles.statStack}>
              <span className={styles.kicker}>{t('learn.hubUi.overall')}</span>
              <span className={styles.statValue} aria-live="polite">
                {t('learn.progressSection', { done: cDone, total: cTotal })}
              </span>
              <ProgressBar value={cPct} />
            </div>
          </div>
          <nav className={`${styles.glass} ${styles.asideCard}`} aria-label={t('learn.chaptersTitle')}>
            <h2 className={styles.asideTitle}>{t('learn.chaptersTitle')}</h2>
            <ol className={styles.chapterNav}>
              {grade.chapters.map((ch, i) => {
                const current = ch.id === chapter.id
                return (
                  <li key={ch.id}>
                    <Link
                      to={`/learn/g/${gradeId}/c/${ch.id}`}
                      className={styles.chapterNavLink}
                      aria-current={current ? 'page' : undefined}
                    >
                      <span className={styles.chapterNavNum} aria-hidden>
                        {toRoman(i + 1)}
                      </span>
                      <span className={styles.chapterNavText}>{splitChapterTitle(t(ch.titleKey)).title}</span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </nav>
        </aside>
      </div>
    </PageShell>
  )
}

function PageShell({ children, tone }: { children: ReactNode; tone?: CSSProperties }) {
  return (
    <div className={styles.page} style={tone}>
      <div className={styles.aurora} aria-hidden />
      <div className={styles.inner}>{children}</div>
    </div>
  )
}

function ToolRow({ children }: { children: ReactNode }) {
  return <div className={styles.toolRow}>{children}</div>
}

function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <span className={styles.bar} aria-hidden>
      <span className={styles.barFill} style={{ width: `${v}%` }} />
    </span>
  )
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statNum}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

function Breadcrumbs({ items }: { items: { to?: string; label: string }[] }) {
  const { t } = useT()
  return (
    <nav className={styles.crumbs} aria-label={t('learn.hubUi.breadcrumb')}>
      <ol className={styles.crumbList}>
        {items.map((it, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${i}-${it.label}`} className={styles.crumbItem}>
              {it.to && !last ? (
                <Link className={styles.crumbLink} to={it.to}>
                  {i === 0 ? <IconArrowLeft className={styles.crumbBack} /> : null}
                  {it.label}
                </Link>
              ) : (
                <span className={styles.crumbCurrent} aria-current="page">
                  {it.label}
                </span>
              )}
              {!last ? <IconChevronRight className={styles.crumbSep} /> : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function EmptyState({
  title,
  hint,
  backTo,
  backLabel,
}: {
  title: string
  hint?: string
  backTo: string
  backLabel: string
}) {
  return (
    <div className={`${styles.glass} ${styles.empty}`}>
      <EmptyStateArt className={styles.emptyArt} />
      <p className={styles.emptyTitle}>{title}</p>
      {hint ? <p className={styles.emptyHint}>{hint}</p> : null}
      <Link className={`${styles.btn} ${styles.btnPrimary}`} to={backTo}>
        <IconArrowLeft />
        {stripLeadingArrow(backLabel)}
      </Link>
    </div>
  )
}

function NotFound({ backTo, backLabel }: { backTo: string; backLabel: string }) {
  const { t } = useT()
  return (
    <PageShell>
      <div className={styles.notFoundWrap} role="status">
        <EmptyState title={t('learn.hubUi.notFound')} hint={t('learn.hubUi.notFoundHint')} backTo={backTo} backLabel={backLabel} />
      </div>
    </PageShell>
  )
}

export function LearnPage() {
  const { t } = useT()
  const bookMatch = useMatch('/learn/g/:gradeId/book')
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

  if (bookMatch?.params.gradeId) {
    const bookGradeId = bookMatch.params.gradeId
    if (!gradeHasTextbook(bookGradeId)) {
      return <NotFound backTo={`/learn/g/${bookGradeId}`} backLabel={t('learn.backGrades')} />
    }
    return <LearnTextbookReader gradeId={bookGradeId} />
  }

  if (params.topicId === 'tasks') {
    if (params.lessonId) {
      if (!LEARN_TASK_CATEGORY_IDS.has(params.lessonId)) {
        return <NotFound backTo="/learn/tasks" backLabel={t('learn.tasksBack')} />
      }
      return <LearnTaskRunner categoryId={params.lessonId} />
    }
    return <LearnTasksHub />
  }

  if (params.topicId && !params.gradeId) {
    const dest = legacyTopicRedirect(params.topicId)
    if (dest) return <Navigate to={dest} replace />
    return <NotFound backTo="/learn" backLabel={t('learn.backGrades')} />
  }

  if (!params.gradeId) {
    return <GradesIndex progress={progress} />
  }

  const grade = learnGradeById(params.gradeId)
  if (!grade) {
    return <NotFound backTo="/learn" backLabel={t('learn.backGrades')} />
  }

  if (!params.chapterId) {
    return <GradeHub gradeId={params.gradeId} progress={progress} />
  }

  const chapter = learnChapterById(params.gradeId, params.chapterId)
  if (!chapter) {
    return <NotFound backTo={`/learn/g/${params.gradeId}`} backLabel={t('learn.backChapters')} />
  }

  if (!params.sectionId) {
    return (
      <ChapterHub gradeId={params.gradeId} chapterId={params.chapterId} progress={progress} />
    )
  }

  const section = learnSectionById(params.gradeId, params.chapterId, params.sectionId)
  if (!section) {
    return (
      <NotFound
        backTo={`/learn/g/${params.gradeId}/c/${params.chapterId}`}
        backLabel={t('learn.backChapters')}
      />
    )
  }

  return (
    <LearnSectionRunner grade={grade} chapter={chapter} section={section} onRefresh={refresh} />
  )
}
