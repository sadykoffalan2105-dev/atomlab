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

type GradeStatus = 'new' | 'progress' | 'done' | 'here'

const STATUS_KEY: Record<GradeStatus, BentoKey> = {
  new: 'stNotStarted',
  progress: 'stInProgress',
  done: 'stDone',
  here: 'stHere',
}

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

  const resumeHref = resume?.sectionId
    ? `/learn/g/${resume.gradeId}/c/${resume.chapterId}/s/${resume.sectionId}`
    : undefined

  const grades = LEARN_GRADES.map((grade) => {
    const ids = grade.chapters.flatMap((c) => c.sections.map((sec) => learnSectionPathId(sec)))
    const { done: gDone, total: gTotal } = sectionProgress(ids, progress)
    const here = resume?.gradeId === grade.id
    const status: GradeStatus =
      gTotal > 0 && gDone >= gTotal ? 'done' : here ? 'here' : gDone > 0 ? 'progress' : 'new'
    return { grade, gDone, gTotal, gPct: percent(gDone, gTotal), here, status }
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
          <h1 className={s.title} id="learn-main-title">
            {t('learn.grades.title')}
          </h1>
          <p className={s.lead}>{t('learn.grades.lead')}</p>
          {/* Телефон: главное действие сразу на первом экране. */}
          <div className={s.heroCtas}>
            <Link className={s.heroPrimary} to={resumeHref ?? '/learn/g/g7'}>
              {resumeHref ? b('heroResume') : b('heroStart')}
              <IconArrowRight />
            </Link>
            <Link className={s.heroSecondary} to="/learn/talk">
              <IconAiChat />
              {b('heroAsk')}
            </Link>
          </div>
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

        {/* Общий прогресс: кольцо + сегментная полоса (ширина отрезка ∝ числу параграфов класса) */}
        <section
          className={`${s.tile} ${s.stat}`}
          data-tile
          style={order(1, PRIMARY_TONE)}
          aria-labelledby="learn-overall-title"
        >
          <div className={s.statRow}>
            <ProgressRing value={done / Math.max(1, total)} size={88} stroke={9} label={`${pct}%`} className={s.ring} />
            <div className={s.statText}>
              <h2 className={s.kicker} id="learn-overall-title">
                {t('learn.hubUi.overall')}
              </h2>
              <p className={s.statValue} aria-live="polite">
                {t('learn.progressSection', { done, total })}
              </p>
              {done === 0 ? <p className={s.hint}>{b('startHint')}</p> : null}
            </div>
          </div>
          <ul className={s.seg} aria-label={b('byGrade')}>
            {grades.map(({ grade, gDone, gTotal, gPct }) => (
              <li
                key={grade.id}
                className={s.segItem}
                style={{ ...gradeTone(grade.id), flexGrow: gTotal }}
                title={`${t(grade.titleKey)} · ${gDone}/${gTotal}`}
              >
                <span className={s.segTrack} aria-hidden>
                  <span className={s.segFill} style={{ width: `${Math.max(gPct, gDone > 0 ? 4 : 0)}%` }} />
                </span>
                <span className={s.segCap} aria-hidden>
                  <span className={s.segNum}>{gradeNumber(grade.id)}</span>
                  <span className={s.segCount}>
                    {gDone}
                    <span className={s.segOf}>/{gTotal}</span>
                  </span>
                </span>
                <span className={s.srOnly}>
                  {b('gradeAria', { title: t(grade.titleKey), done: gDone, total: gTotal, pct: gPct })}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Продолжить с параграфа / начать с 7 класса */}
        {resume?.sectionId ? (
          <Link
            className={`${s.tile} ${s.resume}`}
            data-tile
            to={resumeHref ?? '/learn'}
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
              <span className={s.resumeMeta}>{b('startMeta')}</span>
            </span>
            <span className={`${s.pill} ${s.pillSolid}`} aria-hidden>
              {b('startCta')}
              <IconArrowRight />
            </span>
          </Link>
        )}
      </div>

      <section className={s.gradesBlock} aria-labelledby="learn-grades-title">
        <h2 className={s.blockTitle} id="learn-grades-title">
          <span className={s.blockNum} aria-hidden>
            01
          </span>
          {t('learn.hubUi.gradesTitle')}
        </h2>
        {/* Маршрут 7 → 11 (ПК): узлы по центрам плиток, отрезки — прогресс класса. */}
        <div className={s.route} aria-hidden>
          {grades.map(({ grade, gDone, gPct, here }, i) => (
            <span key={grade.id} className={s.routeCell} style={order(i, gradeTone(grade.id))}>
              {i < grades.length - 1 ? (
                <span className={s.routeSeg}>
                  <span className={s.routeFill} style={{ width: `${gPct}%` }} />
                </span>
              ) : null}
              <span className={s.routeNode} data-on={gDone > 0 || here ? '' : undefined} />
            </span>
          ))}
        </div>
        <ul className={s.grades} onPointerMove={onPointerMove}>
          {grades.map(({ grade, gDone, gTotal, gPct, here, status }, i) => (
            <li key={grade.id} className={s.gradeItem}>
              <Link
                to={`/learn/g/${grade.id}`}
                className={`${s.tile} ${s.grade}`}
                data-tile
                data-grade={grade.id}
                style={order(3 + i, gradeTone(grade.id))}
                onMouseEnter={prefetchWasmCore}
                onFocus={prefetchWasmCore}
              >
                <span className={s.accent} aria-hidden />
                <span className={s.numWrap} data-here={here ? '' : undefined} aria-hidden>
                  <span className={s.gradeNum}>{gradeNumber(grade.id)}</span>
                </span>
                <GradeGlyph gradeId={grade.id} className={s.glyph} />
                <span className={s.gradeBody}>
                  <span className={s.gradeTitleRow}>
                    <span className={s.gradeTitle}>{t(grade.titleKey)}</span>
                    <span className={s.chip}>{b('chaptersShort', { n: grade.chapters.length })}</span>
                    <span className={s.ctaDot} aria-hidden>
                      <IconArrowRight />
                    </span>
                  </span>
                  <span className={s.gradeRef}>{t(grade.textbookRefKey)}</span>
                </span>
                <span className={s.gradeFoot}>
                  <span className={s.countRow}>
                    <span className={s.status} data-status={status}>
                      {b(STATUS_KEY[status])}
                    </span>
                    <span className={s.countNums} aria-hidden>
                      <span className={s.countOf}>
                        {gDone}/{gTotal} {b('sectionsShort')}
                      </span>
                      <span className={s.countPct}>{gPct}%</span>
                    </span>
                    <span className={s.srOnly}>
                      {t('learn.progressSection', { done: gDone, total: gTotal })}, {gPct}%
                    </span>
                  </span>
                  <span className={s.bar} aria-hidden>
                    <span className={s.barFill} style={{ width: `${gPct}%` }} />
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
