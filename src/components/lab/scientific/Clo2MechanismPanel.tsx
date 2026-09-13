import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useT } from '../../../i18n/useT'
import { CLO2_STEP_IDS, type Clo2StepId } from '../../../lab/cinema/scenes/clo2/clo2Steps'
import { clo2StepStore, type Clo2StepStatus } from '../../../lab/cinema/scenes/clo2/clo2StepStore'
import { getClo2MechanismText, type Clo2Locale } from '../../../lab/cinema/scenes/clo2/clo2MechanismText'
import { getLabTeacherNarrator } from '../../../lab/teacher'
import styles from './Clo2MechanismPanel.module.css'

/**
 * DOM-панель пошагового урока «механизм ClO₂»: текст шага, уравнение стадии,
 * легенда стрелок и управление (Далее / Повторить / Автоплей).
 * Перерисовывается только на смене снимка clo2StepStore — не на кадр.
 */

/** Минимальная пауза перед автопереходом, даже если учитель молчит. */
const AUTOPLAY_MIN_PAUSE_MS = 1400
/** subscribeSpeaking держит одного слушателя (его занимает док) — опрашиваем. */
const SPEAKING_POLL_MS = 200

const COLLAPSED_KEY = 'atomlab-clo2-panel-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function toClo2Locale(locale: string): Clo2Locale {
  return locale === 'en' || locale === 'uz' ? locale : 'ru'
}

function stepIdAt(index: number): Clo2StepId {
  const i = Math.min(Math.max(index, 0), CLO2_STEP_IDS.length - 1)
  return CLO2_STEP_IDS[i]!
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

type NarrationMark = { runId: number; step: number; status: Clo2StepStatus }

export function Clo2MechanismPanel({ active }: { active: boolean }) {
  const snapshot = useSyncExternalStore(clo2StepStore.subscribe, clo2StepStore.getSnapshot)
  const { t, locale } = useT()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const narrationMark = useRef<NarrationMark | null>(null)

  const { runId, step, stepCount, status, autoplay } = snapshot
  const visible = active && runId > 0
  const clo2Locale = toClo2Locale(locale)

  // Док тоже ставит язык, но панель может жить без него; эффект стоит до озвучки.
  // Смена языка прерывает текущую реплику — повторяем шаг уже на новом языке.
  const lastLocale = useRef<Clo2Locale | null>(null)
  useEffect(() => {
    if (!visible) {
      lastLocale.current = null
      return
    }
    const narrator = getLabTeacherNarrator()
    narrator.setLocale(clo2Locale)
    const prev = lastLocale.current
    lastLocale.current = clo2Locale
    if (prev === null || prev === clo2Locale) return
    const s = clo2StepStore.getSnapshot()
    if (s.runId > 0 && (s.status === 'playing' || narrator.isSpeaking())) narrator.speakStep(stepIdAt(s.step))
  }, [visible, clo2Locale])

  // Озвучка: новый шаг / новый прогон / повтор (paused → playing на том же шаге).
  useEffect(() => {
    if (!visible) {
      narrationMark.current = null
      return
    }
    const prev = narrationMark.current
    narrationMark.current = { runId, step, status }
    if (status !== 'playing') return
    const fresh = !prev || prev.runId !== runId || prev.step !== step || prev.status !== 'playing'
    if (fresh) getLabTeacherNarrator().speakStep(stepIdAt(step))
  }, [visible, runId, step, status])

  // Автоплей: пауза ≥ 1,4 с и учитель договорил.
  useEffect(() => {
    if (!visible || status !== 'paused' || !autoplay) return
    const narrator = getLabTeacherNarrator()
    let timer = 0
    const tick = () => {
      if (narrator.isSpeaking()) {
        timer = window.setTimeout(tick, SPEAKING_POLL_MS)
        return
      }
      clo2StepStore.next()
    }
    timer = window.setTimeout(tick, AUTOPLAY_MIN_PAUSE_MS)
    return () => window.clearTimeout(timer)
  }, [visible, runId, step, status, autoplay])

  // Клавиатура: → / Пробел — далее, R — повтор.
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return
      if (isTypingTarget(e.target)) return
      const isSpace = e.code === 'Space' || e.key === ' '
      if (e.key === 'ArrowRight' || isSpace) {
        // Пробел на сфокусированной кнопке сам вызовет click — не дублируем.
        if (isSpace && e.target instanceof HTMLElement && e.target.closest('button, a, [role="button"]')) return
        e.preventDefault()
        if (!e.repeat) clo2StepStore.next()
        return
      }
      if (e.code === 'KeyR' && !e.shiftKey) {
        e.preventDefault()
        if (!e.repeat) replayStep()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible])

  if (!visible) return null

  const text = getClo2MechanismText(clo2Locale)
  const stepId = stepIdAt(step)
  const stepText = text.steps[stepId]
  const isLast = step >= stepCount - 1
  const busy = status === 'playing' || status === 'finishing'
  const canNext = status === 'paused'
  const canReplay = status === 'playing' || status === 'paused'
  const counter = t('lab.mechanism.stepOf', { n: step + 1, total: stepCount })
  const equationParts = stepText.equation.split(/\s*;\s*/).filter(Boolean)

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* private mode */
      }
      return next
    })
  }

  return (
    <section
      className={styles.panel}
      data-lab-lesson-panel=""
      role="region"
      aria-label={t('lab.mechanism.panelAria')}
      data-status={status}
      data-collapsed={collapsed ? '1' : undefined}
    >
      <header className={styles.head}>
        <span className={styles.badge}>
          {text.intro.title}
          {busy ? (
            <span className={styles.playing}>
              <span className={styles.playingDot} aria-hidden />
              <span className={styles.srOnly}>{t('lab.mechanism.playing')}</span>
            </span>
          ) : null}
        </span>
        <span className={styles.counter}>{counter}</span>
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          title={collapsed ? t('lab.mechanism.showDetails') : t('lab.mechanism.hideDetails')}
          aria-label={collapsed ? t('lab.mechanism.showDetails') : t('lab.mechanism.hideDetails')}
        >
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div
        className={styles.progress}
        role="progressbar"
        aria-label={t('lab.mechanism.progressAria')}
        aria-valuemin={1}
        aria-valuemax={stepCount}
        aria-valuenow={step + 1}
        aria-valuetext={counter}
      >
        {Array.from({ length: stepCount }, (_, i) => (
          <span
            key={i}
            className={styles.seg}
            data-state={i < step || status === 'done' ? 'done' : i === step ? 'current' : 'todo'}
          />
        ))}
      </div>

      <div className={styles.scroll}>
        <div aria-live="polite" aria-atomic="true">
          <h3 className={styles.title}>{stepText.title}</h3>
          <p className={`${styles.body} ${styles.details}`}>{stepText.body}</p>
        </div>

        <p className={styles.equation} translate="no">
          {equationParts.map((part, i) => (
            <span key={i} className={styles.equationLine}>
              {part}
            </span>
          ))}
        </p>

        {stepText.note ? (
          <p className={`${styles.note} ${styles.details}`}>
            <span className={styles.noteMark} aria-hidden>
              i
            </span>
            <span className={styles.srOnly}>{t('lab.mechanism.note')}: </span>
            <span>{stepText.note}</span>
          </p>
        ) : null}

        {stepId === 'products' ? (
          <p className={`${styles.safety} ${styles.details}`}>
            <span className={styles.safetyMark} aria-hidden>
              !
            </span>
            <span className={styles.srOnly}>{t('lab.mechanism.safety')}: </span>
            <span>{text.safety}</span>
          </p>
        ) : null}

        <ul className={`${styles.legend} ${styles.details}`} aria-label={t('lab.mechanism.legend')}>
          <li>
            <ElectronIcon />
            <span>{text.legend.electron}</span>
          </li>
          <li>
            <PairArrowIcon />
            <span>{text.legend.pairArrow}</span>
          </li>
          <li>
            <SingleArrowIcon />
            <span>{text.legend.singleArrow}</span>
          </li>
          <li className={styles.legendWater}>
            <WaterIcon />
            <span>{text.legend.water}</span>
          </li>
        </ul>
      </div>

      <footer className={styles.controls}>
        <button type="button" className={styles.secondaryBtn} onClick={replayStep} disabled={!canReplay}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <path
              d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path d="M4.4 1.8v3h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('lab.mechanism.replay')}
        </button>
        <button
          type="button"
          className={styles.autoplayBtn}
          onClick={() => clo2StepStore.setAutoplay(!autoplay)}
          aria-pressed={autoplay}
          title={t('lab.mechanism.autoplayHint')}
        >
          <span className={styles.switch} aria-hidden />
          {t('lab.mechanism.autoplay')}
        </button>
        <button type="button" className={styles.primaryBtn} onClick={() => clo2StepStore.next()} disabled={!canNext}>
          {isLast ? t('lab.mechanism.finish') : t('lab.mechanism.next')}
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <path d="M3 8h9M8.5 4 12.5 8l-4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </footer>
      <p className={styles.keysHint} aria-hidden>
        {t('lab.mechanism.keysHint')}
      </p>
    </section>
  )
}

/**
 * Повтор шага. Из паузы сцена сама перейдёт в playing и озвучка сработает по
 * снимку; во время проигрывания снимок не меняется — озвучиваем вручную.
 */
function replayStep(): void {
  const s = clo2StepStore.getSnapshot()
  if (s.runId === 0) return
  clo2StepStore.replay()
  if (s.status === 'playing') getLabTeacherNarrator().speakStep(stepIdAt(s.step))
}

function ElectronIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 28 14" aria-hidden>
      <circle cx="14" cy="7" r="5.5" className={styles.electronHalo} />
      <circle cx="14" cy="7" r="2.4" className={styles.electronCore} />
    </svg>
  )
}

/** Двойная линия + полная головка: движется пара электронов. */
function PairArrowIcon() {
  return (
    <svg className={`${styles.icon} ${styles.pairArrow}`} viewBox="0 0 28 14" aria-hidden>
      <path d="M2 10.4C7 3.2 15 2.6 21 5.6" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M2.4 12.6C7.6 5.6 15 5 20.2 8" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M26.5 8.6 19 3.4l-.6 7.6z" fill="currentColor" />
    </svg>
  )
}

/** Одна линия + полуголовка («рыболовный крючок»): движется один электрон. */
function SingleArrowIcon() {
  return (
    <svg className={`${styles.icon} ${styles.singleArrow}`} viewBox="0 0 28 14" aria-hidden>
      <path d="M2 11.5C7.4 4 15.4 3.4 24.5 7.6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M24.5 7.6 17.6 2.6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function WaterIcon() {
  return (
    <svg className={`${styles.icon} ${styles.waterIcon}`} viewBox="0 0 28 14" aria-hidden>
      <circle cx="14" cy="7.6" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="8.6" cy="4" r="1.9" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="19.4" cy="4" r="1.9" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M5 13 23 1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}
