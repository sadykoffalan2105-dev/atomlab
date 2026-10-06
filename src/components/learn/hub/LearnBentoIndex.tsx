import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  LEARN_GRADES,
  learnChapterById,
  learnGradeById,
  learnSectionById,
  learnSectionPathId,
  learnTotalSectionCount,
} from '../../../data/learnCurriculumUz'
import { sectionProgress, type LearnProgressV3 } from '../../../learn/learnProgressStorage'
import { prefetchWasmCore } from '../../../learn/learnHubPrefetch'
import { useT } from '../../../i18n/useT'
import { GradeGlyph } from './GradeGlyph'
import { AiTeacherArt } from './HubArt'
import { IconAiChat, IconArrowRight, IconPlay, IconSparkles } from './HubIcons'
import { ProgressRing } from './ProgressRing'
import { gradeNumber, percent, splitChapterTitle, splitSectionTitle, toRoman } from './hubText'
import { PRIMARY_TONE, gradeTone } from './hubTone'
import { bentoText, type BentoKey } from './bentoHubI18n'
import s from './LearnBentoIndex.module.css'

/** Порядковый номер плитки для каскадного появления (--i). */
function order(i: number, tone?: CSSProperties): CSSProperties {
  return { ...(tone ?? {}), ['--i' as string]: i } as CSSProperties
}

/**
 * Хаб «Обучение» (#/learn) в виде bento-сетки: крупная плитка ИИ-учителя,
 * плитка общего прогресса (кольцо + полосы по классам), плитка «продолжить / начать»
 * и пять плиток классов. Только CSS/SVG; подсветка под курсором — CSS-переменные --mx/--my.
 */
export function LearnBentoIndex({ progress }: { progress: LearnProgressV3 }) {
  const { t, locale } = useT()
  const b = useCallback(
    (key: BentoKey, params?: Readonly<Record<string, string | number>>) => bentoText(locale, key, params),
    [locale],
  )

  const total = learnTotalSectionCount()
  const done = progress.completedSectionIds.length
  const pct = percent(done, total)
  const chaptersTotal = LEARN_GRADES.reduce((acc, g) => acc + g.chapters.length, 0)

  const resume = progress.last
  const resumeSection = resume?.sectionId
    ? learnSectionById(resume.gradeId, resume.chapterId, resume.sectionId)
    : undefined
  const resumeGrade = resume ? learnGradeById(resume.gradeId) : undefined
  const resumeChapter = resume ? learnChapterById(resume.gradeId, resume.chapterId) : undefined
  const resumeTitle = resumeSection
    ? splitSectionTitle(t(resumeSection.titleKey))
    : { title: resume?.sectionId ?? '', practicalLabel: null }
  const resumeNum = resumeSection ? /^§\s*\d+[a-zа-я]?/i.exec(t(resumeSection.titleKey))?.[0] : undefined

  const grades = LEARN_GRADES.map((grade) => {
    const ids = grade.chapters.flatMap((c) => c.sections.map((sec) => learnSectionPathId(sec)))
    const { done: gDone, total: gTotal } = sectionProgress(ids, progress)
    return { grade, gDone, gTotal, gPct: percent(gDone, gTotal) }
  })

  /* Подсветка под курсором: одна делегированная запись CSS-переменных на плитку. */
  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return
    const tile = (e.target as HTMLElement).closest<HTMLElement>('[data-tile]')
    if (!tile) return
    const r = tile.getBoundingClientRect()
    tile.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`)
    tile.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`)
  }, [])

  return (
    <div className={s.root}>
      <header className={s.head}>
        <div className={s.headMain}>
          <p className={s.eyebrow}>
            <IconSparkles />
            {t('learn.title')}
          </p>
          <h1 className={s.title} id="learn-main-title">
            {t('learn.grades.title')}
          </h1>
          <p className={s.lead}>{t('learn.grades.lead')}</p>
        </div>
        <dl className={s.facts}>
          <div className={s.fact}>
            <dt>{b('grades')}</dt>
            <dd>{LEARN_GRADES.length}</dd>
          </div>
          <div className={s.fact}>
            <dt>{t('learn.chaptersTitle')}</dt>
            <dd>{chaptersTotal}</dd>
          </div>
          <div className={s.fact}>
            <dt>{t('learn.sectionsTitle')}</dt>
            <dd>{total}</dd>
          </div>
        </dl>
      </header>

      <div className={s.bento} onPointerMove={onPointerMove}>
        {/* ИИ-учитель — главная плитка */}
        <Link to="/learn/talk" className={`${s.tile} ${s.ai}`} data-tile style={order(0)}>
          <span className={s.aiGrid} aria-hidden />
          <AiTeacherArt className={s.aiArt} />
          <span className={s.aiBody}>
            <span className={s.aiTop}>
              <span className={s.aiBadge}>
                <IconAiChat />
              </span>
              <span className={s.aiStatus}>
                <span className={s.aiDot} aria-hidden />
                {t('learn.talk.status')}
              </span>
            </span>
            <span className={s.aiTitle}>{t('learn.talk.title')}</span>
            <span className={s.aiLead}>{t('learn.talk.lead')}</span>
            <span className={s.chat} aria-hidden>
              <span className={`${s.bubble} ${s.bubbleMe}`}>{b('askSample')}</span>
              <span className={`${s.bubble} ${s.bubbleAi}`}>
                <IconSparkles />
                {b('answerSample')}
              </span>
            </span>
            <span className={s.aiCta}>
              {t('learn.talk.open')}
              <IconArrowRight />
            </span>
          </span>
        </Link>

        {/* Общий прогресс */}
        <section
          className={`${s.tile} ${s.stat}`}
          data-tile
          style={order(1, PRIMARY_TONE)}
          aria-labelledby="learn-overall-title"
        >
          <div className={s.statRow}>
            <ProgressRing value={done / Math.max(1, total)} size={96} stroke={9} label={`${pct}%`} className={s.ring} />
            <div className={s.statText}>
              <h2 className={s.kicker} id="learn-overall-title">
                {t('learn.hubUi.overall')}
              </h2>
              <p className={s.statValue} aria-live="polite">
                {t('learn.progressSection', { done, total })}
              </p>
              <span className={s.bar} aria-hidden>
                <span className={s.barFill} style={{ width: `${pct}%` }} />
              </span>
            </div>
          </div>
          <div className={s.mini}>
            <span className={s.miniLabel}>{b('byGrade')}</span>
            <ul className={s.miniList}>
              {grades.map(({ grade, gDone, gTotal, gPct }) => (
                <li
                  key={grade.id}
                  className={s.miniItem}
                  style={gradeTone(grade.id)}
                  title={`${t(grade.titleKey)} · ${gDone}/${gTotal}`}
                >
                  <span className={s.miniTrack} aria-hidden>
                    <span className={s.miniFill} style={{ width: `${Math.max(gPct, gDone > 0 ? 4 : 0)}%` }} />
                  </span>
                  <span className={s.miniNum}>
                    <span aria-hidden>{gradeNumber(grade.id)}</span>
                    <span className={s.srOnly}>
                      {b('gradeAria', { title: t(grade.titleKey), done: gDone, total: gTotal, pct: gPct })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Продолжить с параграфа / начать с 7 класса */}
        {resume?.sectionId ? (
          <Link
            className={`${s.tile} ${s.resume}`}
            data-tile
            to={`/learn/g/${resume.gradeId}/c/${resume.chapterId}/s/${resume.sectionId}`}
            style={order(2, gradeTone(resume.gradeId))}
          >
            <span className={s.play} aria-hidden>
              <IconPlay />
            </span>
            <span className={s.resumeText}>
              <span className={s.kicker}>{t('learn.hubUi.resumeEyebrow')}</span>
              <span className={s.resumeTitle}>
                {resumeNum ? <span className={s.secNum}>{resumeNum}</span> : null}
                {resumeTitle.title}
              </span>
              {resumeGrade ? (
                <span className={s.resumeMeta}>
                  {t(resumeGrade.titleKey)}
                  {resumeChapter
                    ? ` · ${splitChapterTitle(t(resumeChapter.titleKey)).prefix ?? toRoman(resumeChapter.order)}`
                    : null}
                </span>
              ) : null}
            </span>
            <span className={s.pill} aria-hidden>
              {b('resumeCta')}
              <IconArrowRight />
            </span>
          </Link>
        ) : (
          <Link className={`${s.tile} ${s.resume}`} data-tile to="/learn/g/g7" style={order(2, gradeTone('g7'))}>
            <span className={s.play} aria-hidden>
              <IconPlay />
            </span>
            <span className={s.resumeText}>
              <span className={s.kicker}>{b('startEyebrow')}</span>
              <span className={s.resumeTitle}>{b('startTitle')}</span>
              <span className={s.resumeMeta}>{t('learn.g7.textbook')}</span>
            </span>
            <span className={s.pill} aria-hidden>
              {b('startCta')}
              <IconArrowRight />
            </span>
          </Link>
        )}
      </div>

      <section className={s.gradesBlock} aria-labelledby="learn-grades-title">
        <h2 className={s.blockTitle} id="learn-grades-title">
          {t('learn.hubUi.gradesTitle')}
        </h2>
        <ul className={s.grades} onPointerMove={onPointerMove}>
          {grades.map(({ grade, gDone, gTotal, gPct }, i) => (
            <li key={grade.id} className={s.gradeItem}>
              <Link
                to={`/learn/g/${grade.id}`}
                className={`${s.tile} ${s.grade}`}
                data-tile
                data-grade={grade.id}
                style={order(3 + i, gradeTone(grade.id))}
                onMouseEnter={() => prefetchWasmCore()}
              >
                <span className={s.gradeNum} aria-hidden>
                  {gradeNumber(grade.id)}
                </span>
                <GradeGlyph gradeId={grade.id} className={s.glyph} />
                <span className={s.gradeBody}>
                  <span className={s.gradeTitleRow}>
                    <span className={s.gradeTitle}>{t(grade.titleKey)}</span>
                    <span className={s.chip}>{b('chaptersShort', { n: grade.chapters.length })}</span>
                  </span>
                  <span className={s.gradeRef}>{t(grade.textbookRefKey)}</span>
                </span>
                <span className={s.gradeFoot}>
                  <span className={s.countRow}>
                    <span>{t('learn.progressSection', { done: gDone, total: gTotal })}</span>
                    <span className={s.countPct}>{gPct}%</span>
                  </span>
                  <span className={s.bar} aria-hidden>
                    <span className={s.barFill} style={{ width: `${gPct}%` }} />
                  </span>
                </span>
                <span className={s.gradeCta} aria-hidden>
                  {t('learn.hubUi.open')}
                  <span className={s.ctaDot}>
                    <IconArrowRight />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
