import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { useT } from '../../../i18n/useT'
import { CLO2_STEP_IDS, type Clo2StepId } from '../../../lab/cinema/scenes/clo2/clo2Steps'
import { clo2StepStore, type Clo2StepStatus } from '../../../lab/cinema/scenes/clo2/clo2StepStore'
import type { Clo2Locale } from '../../../lab/cinema/scenes/clo2/clo2MechanismText'
import { getCinemaLesson, lessonStepIdAt } from '../../../lab/cinema/scenes/lessons'
import { CaoEnergyPanel } from '../../../lab/cinema/scenes/cao/CaoEnergyPanel'
import { Co2EnergyPanel } from '../../../lab/cinema/scenes/co2/Co2EnergyPanel'
import { FesEnergyPanel } from '../../../lab/cinema/scenes/fes/FesEnergyPanel'
import { H2oEnergyPanel } from '../../../lab/cinema/scenes/h2o/H2oEnergyPanel'
import { HclEnergyPanel } from '../../../lab/cinema/scenes/hcl/HclEnergyPanel'
import { MgoEnergyPanel } from '../../../lab/cinema/scenes/mgo/MgoEnergyPanel'
import { NaclEnergyPanel } from '../../../lab/cinema/scenes/nacl/NaclEnergyPanel'
import { Nh3EnergyPanel } from '../../../lab/cinema/scenes/nh3/Nh3EnergyPanel'
import { So2EnergyPanel } from '../../../lab/cinema/scenes/so2/So2EnergyPanel'
import { Zncl2EnergyPanel } from '../../../lab/cinema/scenes/zncl2/Zncl2EnergyPanel'
import { getLabTeacherNarrator } from '../../../lab/teacher'
import styles from './Clo2MechanismPanel.module.css'
import { Clo2ElectronLedger } from './Clo2ElectronLedger'
import { Clo2EnergyProfile } from './Clo2EnergyProfile'

/**
 * DOM-панель пошагового урока «механизм ClO₂»: текст шага, уравнение стадии,
 * легенда стрелок и управление (Далее / Повторить / Автоплей).
 * Перерисовывается только на смене снимка clo2StepStore — не на кадр.
 *
 * Вёрстка «Aurora Lab»: шапка (урок · шаг · прогресс), заголовок и текст шага,
 * уравнение, затем сворачиваемые разделы (энергетический профиль, обозначения).
 * Широкий экран — колонка слева над холстом; ≤720px — нижний лист над реактором,
 * не выше полосы .rightHud. Кнопка «свернуть» оставляет заголовок, уравнение и
 * управление — холст остаётся свободным.
 */

/** Минимальная пауза перед автопереходом, даже если учитель молчит. */
const AUTOPLAY_MIN_PAUSE_MS = 1400
/** subscribeSpeaking держит одного слушателя (его занимает док) — опрашиваем. */
const SPEAKING_POLL_MS = 200

const COLLAPSED_KEY = 'atomlab-clo2-panel-collapsed'
const SECTION_KEY_PREFIX = 'atomlab-clo2-section-'

const MOBILE_QUERY = '(max-width: 720px)'
/** Узкий телефон: панель урока живёт нижним листом с ручкой перетаскивания. */
const SHEET_QUERY = '(max-width: 480px)'
/** Высокий широкий экран: профиль энергии помещается без прокрутки — открыт по умолчанию. */
const ROOMY_QUERY = '(min-width: 721px) and (min-height: 900px)'

/** Нижний лист: минимальная и максимальная высота перетаскивания, px. */
const SHEET_MIN_PX = 132
/** Доля высоты холста, выше которой лист не растёт даже вручную. */
const SHEET_MAX_RATIO = 0.62
/** Шаг клавиатурного изменения высоты листа, px. */
const SHEET_STEP_PX = 32
const SHEET_H_VAR = '--mech-sheet-h'

function mediaMatches(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches
}

function readFlag(key: string): boolean | null {
  try {
    const v = localStorage.getItem(key)
    return v === '1' ? true : v === '0' ? false : null
  } catch {
    return null
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    /* private mode */
  }
}

/** Без сохранённого выбора телефон открывает урок свёрнутым: 3D и реактор важнее текста. */
function readCollapsed(): boolean {
  return readFlag(COLLAPSED_KEY) ?? mediaMatches(MOBILE_QUERY)
}

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => mediaMatches(query),
    () => false,
  )
}

/** Зазор между панелью и верхом реактора, px. */
const REACTOR_GAP_PX = 10
/** Реактор скрыт кнопкой «Скрыть»: на телефоне внизу остаются круглые FAB (≈ 48 px + отступ). */
const COLLAPSED_REACTOR_GAP_MOBILE_PX = 76
const BOTTOM_GAP_VAR = '--clo2-panel-bottom-gap'

/**
 * Отложенное чтение раскладки «после кадра». Колбэк MutationObserver, transitionend,
 * resize и ResizeObserver приходят в момент, когда DOM грязный (React только что
 * закоммитил шаг, кино пишет подписи): чтение геометрии там = принудительная
 * раскладка посреди кадра. Здесь чтение уходит в задачу сразу после отрисовки
 * (rAF → MessageChannel): раскладка к этому моменту уже посчитана браузером, чтение
 * бесплатно, а запись стиля попадает в следующий кадр без второго прохода.
 * Повторные вызовы до срабатывания склеиваются в одно чтение.
 */
function createAfterPaint(run: () => void): { schedule: () => void; cancel: () => void } {
  let raf = 0
  let queued = false
  let alive = true
  const ch = typeof MessageChannel === 'function' ? new MessageChannel() : null
  const fire = () => {
    queued = false
    if (alive) run()
  }
  if (ch) ch.port1.onmessage = fire
  return {
    schedule() {
      if (queued || !alive) return
      queued = true
      raf = requestAnimationFrame(() => {
        raf = 0
        if (ch) ch.port2.postMessage(0)
        else window.setTimeout(fire, 0)
      })
    },
    cancel() {
      alive = false
      queued = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      if (ch) {
        ch.port1.onmessage = null
        ch.port1.close()
      }
    },
  }
}

/**
 * Реальная высота реактора меняется без resize окна (балансировка, запуск синтеза),
 * а --lab-reactor-clearance пересчитывается только по resize .wrap. Панель меряет
 * [data-lab-reactor] сама и пишет --clo2-panel-bottom-gap (CSS берёт его первым).
 *
 * Горячий путь («Далее», «Завершить», анимация дока) не читает раскладку синхронно:
 * все поводы (ResizeObserver, мутации атрибутов дока, transitionend, resize) только
 * планируют одно чтение после кадра (createAfterPaint). Вычисленный стиль дока
 * (position/bottom) кэшируется и перечитывается лишь при мутации атрибутов или resize.
 * Верх реактора берётся без учёта transform — анимация открытия не дёргает панель.
 */
function useReactorBottomGap(panelRef: RefObject<HTMLElement | null>, enabled: boolean, isMobile: boolean): void {
  useLayoutEffect(() => {
    const panel = panelRef.current
    const host = panel?.parentElement
    const reactor = document.querySelector<HTMLElement>('[data-lab-reactor]')
    if (!enabled || !panel || !host || !reactor) return
    let last = Number.NaN
    let settleTimer = 0
    let styleDirty = true
    let fixedBottom = Number.NaN
    const measure = () => {
      let gap = REACTOR_GAP_PX
      if (reactor.getAttribute('data-collapsed') === 'true') {
        if (isMobile) gap = COLLAPSED_REACTOR_GAP_MOBILE_PX
      } else {
        const h = reactor.offsetHeight
        if (h > 0) {
          if (styleDirty) {
            const cs = getComputedStyle(reactor)
            const bottom = parseFloat(cs.bottom)
            fixedBottom = cs.position === 'fixed' && Number.isFinite(bottom) ? bottom : Number.NaN
            styleDirty = false
          }
          const top = Number.isFinite(fixedBottom) ? window.innerHeight - fixedBottom - h : reactor.getBoundingClientRect().top
          gap += Math.max(0, host.getBoundingClientRect().bottom - top)
        }
      }
      gap = Math.round(gap)
      if (gap === last) return
      last = gap
      panel.style.setProperty(BOTTOM_GAP_VAR, `${gap}px`)
    }
    const later = createAfterPaint(measure)
    const onStyleChange = () => {
      styleDirty = true
      later.schedule()
      // Док может доехать CSS-переходом высоты — перемер после его конца.
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(later.schedule, 480)
    }
    // Первый замер — синхронно при монтировании (до первой отрисовки панели, без скачка).
    // Это один раз на показ панели, а не на шаг урока.
    measure()
    const ro = new ResizeObserver(later.schedule)
    ro.observe(reactor)
    ro.observe(host)
    const mo = new MutationObserver(onStyleChange)
    mo.observe(reactor, { attributes: true, attributeFilter: ['data-collapsed', 'data-open', 'class'] })
    reactor.addEventListener('transitionend', later.schedule)
    window.addEventListener('resize', onStyleChange)
    return () => {
      later.cancel()
      ro.disconnect()
      mo.disconnect()
      window.clearTimeout(settleTimer)
      reactor.removeEventListener('transitionend', later.schedule)
      window.removeEventListener('resize', onStyleChange)
      panel.style.removeProperty(BOTTOM_GAP_VAR)
    }
  }, [panelRef, enabled, isMobile])
}

/**
 * Узкий телефон: док реактора занимает до 63 % высоты холста (замер 390×844:
 * канва 143…844, реактор 405…844). Вместе с листом урока на 3D не оставалось
 * и 30 px — сцену было не видно ни на одном шаге. Пока идёт пошаговый урок,
 * док сворачивается один раз своей же кнопкой «Скрыть реактор»; вернуть его
 * можно кнопкой «Показать реактор», которую док рисует в свёрнутом виде.
 * Кнопку ищем по подписи (aria-label), поэтому перевёрстка дока нас не ломает:
 * не нашли — ничего не делаем.
 */
function useCollapseReactorForLesson(enabled: boolean, hideLabel: string): void {
  useEffect(() => {
    if (!enabled) return
    let mo: MutationObserver | null = null
    let timer = 0
    let done = false
    const stop = () => {
      done = true
      mo?.disconnect()
      mo = null
      window.clearTimeout(timer)
      timer = 0
    }
    const collapse = () => {
      if (done) return
      const reactor = document.querySelector<HTMLElement>('[data-lab-reactor]')
      if (!reactor || reactor.offsetHeight === 0) return
      if (reactor.getAttribute('data-collapsed') === 'true') {
        stop()
        return
      }
      const buttons = Array.from(reactor.querySelectorAll<HTMLButtonElement>('button'))
      const btn =
        buttons.find((b) => (b.getAttribute('aria-label') ?? '') === hideLabel) ??
        buttons.filter((b) => /reactorBtnIcon/.test(b.className)).pop()
      if (!btn) return
      stop()
      btn.click()
    }
    collapse()
    if (!done) {
      // Док может появиться позже урока (анимация запуска синтеза) — ждём его,
      // но наблюдаем только до первого срабатывания: кино идёт, мутаций много.
      mo = new MutationObserver(collapse)
      mo.observe(document.body, { childList: true, subtree: true })
      timer = window.setTimeout(collapse, 900)
    }
    return stop
  }, [enabled, hideLabel])
}

/**
 * Затухание у кромок прокрутки. Текст шага длиннее окна — срез посреди строки
 * читается как сломанная вёрстка; градиент сверху/снизу показывает, что
 * содержимое продолжается. Флаги ставим на обёртке, CSS их только показывает.
 */
function useScrollFade(
  wrapRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
  deps: unknown,
): void {
  // Наблюдатели живут, пока живут узлы; смена шага (deps) только подписывает новых
  // детей — без синхронного чтения scrollHeight сразу после коммита React (это была
  // принудительная раскладка на каждый «Далее»).
  const liveRef = useRef<{ wrap: HTMLElement; box: HTMLElement; ro: ResizeObserver; dispose: () => void } | null>(null)
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const box = scrollRef.current
    const live = liveRef.current
    if (live && live.wrap === wrap && live.box === box) {
      // Тот же узел, новый шаг: React мог заменить детей — подписываем их. observe()
      // раскладку не читает; первое уведомление о новом узле придёт после раскладки и
      // запустит замер. Смена текста той же высоты геометрию не меняет — флаги верны.
      for (const child of Array.from(box.children)) live.ro.observe(child)
      return
    }
    live?.dispose()
    liveRef.current = null
    if (!wrap || !box) return
    // Прошлое записанное состояние: в DOM уходят только изменения (атрибуты data-*
    // перезапускают стиль обёртки, лишние записи — лишний пересчёт).
    let fadeTop = ''
    let fadeBottom = ''
    let scrollable = ''
    let sbH = ''
    let sbTop = ''
    // Кэш геометрии: высоты читаются только после кадра, scrollTop — в событии прокрутки.
    let scrollH = 0
    let clientH = 0
    let scrollTop = 0
    const write = () => {
      const rest = scrollH - clientH - scrollTop
      const ft = scrollTop > 2 ? '1' : '0'
      const fb = rest > 2 ? '1' : '0'
      // Собственный индикатор прокрутки: на телефоне системная полоса
      // наложенная и показывается только во время скролла — читателю не видно,
      // что текст продолжается. Доля и положение ползунка — в процентах.
      const full = scrollH || 1
      const sc = scrollH - clientH > 2 ? '1' : '0'
      const h = `${Math.max(12, (clientH / full) * 100)}%`
      const tp = `${(scrollTop / full) * 100}%`
      if (ft !== fadeTop) wrap.dataset.fadeTop = fadeTop = ft
      if (fb !== fadeBottom) wrap.dataset.fadeBottom = fadeBottom = fb
      if (sc !== scrollable) wrap.dataset.scrollable = scrollable = sc
      if (h !== sbH) wrap.style.setProperty('--mech-sb-h', (sbH = h))
      if (tp !== sbTop) wrap.style.setProperty('--mech-sb-top', (sbTop = tp))
    }
    const measure = () => {
      scrollH = box.scrollHeight
      clientH = box.clientHeight
      scrollTop = box.scrollTop
      write()
    }
    const later = createAfterPaint(measure)
    let scrollRaf = 0
    const onScroll = () => {
      // Прокрутка раскладку не пачкает — scrollTop читается дёшево; запись — раз в кадр.
      scrollTop = box.scrollTop
      if (!scrollRaf)
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = 0
          write()
        })
    }
    box.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(later.schedule)
    ro.observe(box)
    for (const child of Array.from(box.children)) ro.observe(child)
    liveRef.current = {
      wrap,
      box,
      ro,
      dispose: () => {
        later.cancel()
        if (scrollRaf) cancelAnimationFrame(scrollRaf)
        box.removeEventListener('scroll', onScroll)
        ro.disconnect()
      },
    }
  }, [wrapRef, scrollRef, deps])
  useLayoutEffect(
    () => () => {
      liveRef.current?.dispose()
      liveRef.current = null
    },
    [],
  )
}

/** Предел высоты листа: не выше SHEET_MAX_RATIO от холста, но и не ниже минимума. */
function sheetMaxPx(panel: HTMLElement): number {
  const host = panel.parentElement
  const h = host ? host.getBoundingClientRect().height : window.innerHeight
  return Math.max(SHEET_MIN_PX, Math.round(h * SHEET_MAX_RATIO))
}

function setSheetHeight(panel: HTMLElement, px: number): number {
  const clamped = Math.min(Math.max(px, SHEET_MIN_PX), sheetMaxPx(panel))
  panel.style.setProperty(SHEET_H_VAR, `${clamped}px`)
  return clamped
}

function toClo2Locale(locale: string): Clo2Locale {
  return locale === 'en' || locale === 'uz' ? locale : 'ru'
}

function stepIdAt(index: number): Clo2StepId {
  const i = Math.min(Math.max(index, 0), CLO2_STEP_IDS.length - 1)
  return CLO2_STEP_IDS[i]!
}

/** Озвучка преподавателя: сценарий реплик есть только у урока ClO₂. */
function narrateStep(index: number): void {
  if (!getCinemaLesson(clo2StepStore.getSnapshot().lesson).narrated) return
  getLabTeacherNarrator().speakStep(stepIdAt(index))
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
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const isSheet = useMediaQuery(SHEET_QUERY)

  const panelRef = useRef<HTMLElement>(null)
  const scrollWrapRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: number; y0: number; h0: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)

  const { runId, step, stepCount, status, autoplay } = snapshot
  const visible = active && runId > 0
  const clo2Locale = toClo2Locale(locale)

  useReactorBottomGap(panelRef, visible, isMobile)
  useCollapseReactorForLesson(visible && isSheet, t('reactor.hidePanel'))
  useScrollFade(scrollWrapRef, scrollRef, `${visible ? 1 : 0}:${runId}:${step}:${collapsed ? 1 : 0}:${locale}`)

  // Ручная высота листа живёт только на узком телефоне: на широком экране
  // панель снова колонка слева, инлайновый размер там только мешает.
  useEffect(() => {
    if (isSheet) return
    panelRef.current?.style.removeProperty(SHEET_H_VAR)
  }, [isSheet])

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
    if (s.runId > 0 && (s.status === 'playing' || narrator.isSpeaking())) narrateStep(s.step)
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
    if (fresh) narrateStep(step)
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
        if (isSpace && e.target instanceof HTMLElement && e.target.closest('button, a, [role="button"], summary')) return
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

  const lesson = getCinemaLesson(snapshot.lesson)
  const text = lesson.getText(clo2Locale)
  const stepId = lessonStepIdAt(lesson, step)
  const stepText = text.steps[stepId]!
  const isLast = step >= stepCount - 1
  const busy = status === 'playing' || status === 'finishing'
  const canNext = status === 'paused'
  const canReplay = status === 'playing' || status === 'paused'
  const counter = t('lab.mechanism.stepOf', { n: step + 1, total: stepCount })
  const equationParts = stepText.equation.split(/\s*;\s*/).filter(Boolean)
  const collapseLabel = collapsed ? t('lab.mechanism.showDetails') : t('lab.mechanism.hideDetails')
  const replayLabel = t('lab.mechanism.replay')

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c
      writeFlag(COLLAPSED_KEY, next)
      return next
    })
  }

  /* ── Ручка нижнего листа: тянем высоту, короткий тап — свернуть/развернуть ── */

  const onGripDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const panel = panelRef.current
    if (!panel) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { id: e.pointerId, y0: e.clientY, h0: panel.offsetHeight, moved: false }
  }

  const onGripMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    const panel = panelRef.current
    if (!drag || !panel || drag.id !== e.pointerId) return
    const dy = drag.y0 - e.clientY
    if (!drag.moved && Math.abs(dy) < 4) return
    drag.moved = true
    if (collapsed) {
      // Свёрнутую полосу тянут вверх — разворачиваем и продолжаем с минимума.
      if (dy < 16) return
      setCollapsed(false)
      writeFlag(COLLAPSED_KEY, false)
      drag.h0 = SHEET_MIN_PX
      drag.y0 = e.clientY
      return
    }
    setSheetHeight(panel, drag.h0 + dy)
  }

  const onGripUp = () => {
    const drag = dragRef.current
    const panel = panelRef.current
    dragRef.current = null
    if (!drag) return
    suppressClick.current = drag.moved
    // Дотянули почти до минимума — считаем это жестом «свернуть».
    if (drag.moved && !collapsed && panel && panel.offsetHeight <= SHEET_MIN_PX + 24) {
      setCollapsed(true)
      writeFlag(COLLAPSED_KEY, true)
    }
  }

  const onGripClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    toggleCollapsed()
  }

  const onGripKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const panel = panelRef.current
    if (!panel || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    if (collapsed) {
      if (e.key !== 'ArrowUp') return
      setCollapsed(false)
      writeFlag(COLLAPSED_KEY, false)
      return
    }
    setSheetHeight(panel, panel.offsetHeight + (e.key === 'ArrowUp' ? SHEET_STEP_PX : -SHEET_STEP_PX))
  }

  return (
    <section
      ref={panelRef}
      className={styles.panel}
      data-lab-lesson-panel=""
      role="region"
      aria-label={t('lab.mechanism.panelAria')}
      data-status={status}
      data-collapsed={collapsed ? '1' : undefined}
    >
      {isSheet ? (
        <button
          type="button"
          className={styles.grip}
          aria-label={collapseLabel}
          title={collapseLabel}
          aria-expanded={!collapsed}
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          onPointerCancel={onGripUp}
          onClick={onGripClick}
          onKeyDown={onGripKey}
        />
      ) : null}
      <header className={styles.head}>
        <div className={styles.headRow}>
          <span className={styles.kicker}>
            <span className={styles.kickerIcon} aria-hidden>
              <MechanismIcon />
            </span>
            <span className={styles.kickerText} title={text.intro.title}>
              {text.intro.title}
            </span>
          </span>
          <span className={styles.counter} data-busy={busy ? '1' : undefined}>
            {busy ? (
              <span className={styles.playing}>
                <span className={styles.playingDot} aria-hidden />
                <span className={styles.srOnly}>{t('lab.mechanism.playing')}</span>
              </span>
            ) : null}
            {counter}
          </span>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            title={collapseLabel}
            aria-label={collapseLabel}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
              <path d="M4 6.5 8 10.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

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
      </header>

      <div className={styles.scrollWrap} ref={scrollWrapRef}>
        {/* постоянно видимый индикатор прокрутки (телефон: системная полоса наложенная) */}
        <span className={styles.rail} aria-hidden />
        <div className={styles.scroll} ref={scrollRef}>
          {/* Шапка шага: заголовок и уравнение стадии — видны и в свёрнутой панели; объяснение ниже. */}
          <div className={styles.stepText} aria-live="polite" aria-atomic="true">
            <h3 className={styles.title}>{stepText.title}</h3>
            <p className={styles.equation} translate="no">
              {equationParts.map((part, i) => (
                <span key={i} className={styles.equationLine}>
                  {part}
                </span>
              ))}
            </p>
            <p className={`${styles.body} ${styles.details}`}>{stepText.body}</p>
          </div>

          {stepText.note ? (
            <p className={`${styles.note} ${styles.details}`}>
              <span className={styles.noteMark} aria-hidden>
                <InfoIcon />
              </span>
              <span className={styles.srOnly}>{t('lab.mechanism.note')}: </span>
              <span>{stepText.note}</span>
            </p>
          ) : null}

          {stepId === lesson.safetyStepId ? (
            <p className={`${styles.safety} ${styles.details}`}>
              <span className={styles.safetyMark} aria-hidden>
                <WarningIcon />
              </span>
              <span className={styles.srOnly}>{t('lab.mechanism.safety')}: </span>
              <span>{text.safety}</span>
            </p>
          ) : null}

          {lesson.id === 'clo2' ? (
            <div className={`${styles.ledgerRow} ${styles.details}`}>
              <Clo2ElectronLedger locale={clo2Locale} />
            </div>
          ) : null}

          {/* NaCl — школьная версия (8 класс): энергетики (цикл Борна — Габера) в уроке нет. */}
          {lesson.id !== 'nacl' ? (
            <LessonSection
              id="energy"
              className={styles.details}
              title={text.energy.title}
              meta={text.energy.axisG}
              icon={<EnergyIcon />}
              defaultOpen={mediaMatches(ROOMY_QUERY)}
            >
              {lesson.id === 'nacl' ? (
                <NaclEnergyPanel locale={clo2Locale} compact={isMobile} />
              ) : lesson.id === 'cao' ? (
                <CaoEnergyPanel locale={clo2Locale} compact={isMobile} />
              ) : lesson.id === 'nh3' ? (
                <Nh3EnergyPanel locale={clo2Locale} compact={isMobile} />
              ) : lesson.id === 'so2' ? (
                <So2EnergyPanel locale={clo2Locale} compact={isMobile} />
              ) : lesson.id === 'mgo' ? (
                <MgoEnergyPanel locale={clo2Locale} compact={isMobile} />
              ) : lesson.id === 'fes' ? (
                <FesEnergyPanel locale={clo2Locale} compact={isMobile} />
              ) : lesson.id === 'hcl' ? (
                <HclEnergyPanel locale={clo2Locale} compact={isMobile} />
              ) : lesson.id === 'h2o' ? (
                <H2oEnergyPanel locale={clo2Locale} compact={isMobile} />
              ) : lesson.id === 'co2' ? (
                <Co2EnergyPanel locale={clo2Locale} compact={isMobile} />
              ) : lesson.id === 'zncl2' ? (
                <Zncl2EnergyPanel locale={clo2Locale} compact={isMobile} />
              ) : (
                <Clo2EnergyProfile locale={clo2Locale} compact={isMobile} caption={false} />
              )}
            </LessonSection>
          ) : null}

          <LessonSection
            id="legend"
            className={styles.details}
            title={t('lab.mechanism.legend')}
            icon={<LegendIcon />}
            defaultOpen={false}
          >
            <ul className={styles.legend} aria-label={t('lab.mechanism.legend')}>
              <li>
                <ElectronIcon />
                <span>{text.legend.electron}</span>
              </li>
              {text.legend.pairArrow ? (
                <li>
                  <PairArrowIcon />
                  <span>{text.legend.pairArrow}</span>
                </li>
              ) : null}
              {text.legend.singleArrow ? (
                <li>
                  <SingleArrowIcon />
                  <span>{text.legend.singleArrow}</span>
                </li>
              ) : null}
              {text.legend.orbitalPhase ? (
                <li>
                  <OrbitalPhaseIcon />
                  <span>{text.legend.orbitalPhase}</span>
                </li>
              ) : null}
              {text.legend.vibration ? (
                <li>
                  <VibrationIcon />
                  <span>{text.legend.vibration}</span>
                </li>
              ) : null}
              {text.legend.water ? (
                <li className={styles.legendWater}>
                  <WaterIcon />
                  <span>{text.legend.water}</span>
                </li>
              ) : null}
            </ul>
          </LessonSection>
        </div>
      </div>

      <footer className={styles.controls}>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={replayStep}
          disabled={!canReplay}
          aria-label={replayLabel}
          title={replayLabel}
        >
          <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden>
            <path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M4.4 1.8v3h3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
        {/* aria-disabled, а не disabled: отключение кнопки в фокусе (её только что нажали) сбрасывает
            фокус и пересчитывает стили всей страницы — худший кадр после «Далее»; фокус с клавиатуры
            тоже не теряется. */}
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => {
            if (canNext) clo2StepStore.next()
          }}
          aria-disabled={!canNext}
        >
          {isLast ? t('lab.mechanism.finish') : t('lab.mechanism.next')}
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
            {isLast ? (
              <path d="M3.5 8.5 6.6 11.5 12.5 4.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M3 8h9M8.5 4 12.5 8l-4 4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
      </footer>
      <p className={styles.keysHint} aria-hidden>
        {t('lab.mechanism.keysHint')}
      </p>
    </section>
  )
}

/** Сворачиваемый раздел урока; открытость запоминается в localStorage. */
function LessonSection({
  id,
  title,
  meta,
  icon,
  defaultOpen,
  className,
  children,
}: {
  id: string
  title: string
  meta?: string
  icon: ReactNode
  defaultOpen: boolean
  className?: string
  children: ReactNode
}) {
  const key = SECTION_KEY_PREFIX + id
  const [open, setOpen] = useState(() => readFlag(key) ?? defaultOpen)
  return (
    <details
      className={`${styles.section} ${className ?? ''}`}
      open={open}
      onToggle={(e) => {
        const next = e.currentTarget.open
        if (next === open) return
        setOpen(next)
        writeFlag(key, next)
      }}
    >
      <summary className={styles.sectionHead}>
        <span className={styles.sectionIcon} aria-hidden>
          {icon}
        </span>
        <span className={styles.sectionTitle}>{title}</span>
        {meta ? <span className={styles.sectionMeta}>{meta}</span> : null}
        <svg className={styles.sectionChevron} viewBox="0 0 16 16" width="16" height="16" aria-hidden>
          <path d="M4 6.5 8 10.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className={styles.sectionBody}>{children}</div>
    </details>
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
  if (s.status === 'playing') narrateStep(s.step)
}

/* ── Иконки интерфейса ─────────────────────────────────── */

function MechanismIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <circle cx="4" cy="11.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="4.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.2 9.4C6 6.4 8 5 10 4.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="m8.6 3.4 1.7 1.3-1.3 1.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EnergyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path d="M1.8 10.5h2.4c1.6 0 1.8-6 3.6-6s2 8.6 3.9 8.6h2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LegendIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <circle cx="3.2" cy="4" r="1.4" fill="currentColor" />
      <circle cx="3.2" cy="8" r="1.4" fill="currentColor" />
      <circle cx="3.2" cy="12" r="1.4" fill="currentColor" />
      <path d="M6.6 4h7M6.6 8h7M6.6 12h5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
      <circle cx="8" cy="4.2" r="1.3" fill="currentColor" />
      <path d="M8 7.2v5.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
      <path d="M8 3.2v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="12.6" r="1.3" fill="currentColor" />
    </svg>
  )
}

/* ── Иконки легенды (цвета совпадают с обозначениями в 3D-сцене) ── */

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

/** Два лепестка p-орбитали разной фазы (цвета как в сцене: янтарь +, голубой −). */
function OrbitalPhaseIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 28 14" aria-hidden>
      <ellipse cx="9" cy="7" rx="6.2" ry="4.2" fill="#ffa640" fillOpacity="0.55" stroke="#ffc27a" strokeWidth="0.9" />
      <ellipse cx="19" cy="7" rx="6.2" ry="4.2" fill="#4fa8ff" fillOpacity="0.55" stroke="#8cc8ff" strokeWidth="0.9" />
      <circle cx="14" cy="7" r="1.3" fill="#e9f3ff" />
    </svg>
  )
}

function VibrationIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 28 14" aria-hidden>
      <path d="M2 7c2-4 4-4 6 0s4 4 6 0 4-4 6 0 4 4 6 0" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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
