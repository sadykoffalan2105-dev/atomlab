/**
 * Диалог «Нарисовать»: темы учебника (48 пресетов сервера, класс ±1) или свой запрос (учитель / владелец),
 * размер, стиль, «Подпись формулой» и подпись (накладывает сайт — модель текст не рисует), прогресс по фазам
 * сервера, результат с действиями «Сохранить PNG / Вставить в чат / Ещё раз / Копировать».
 * Ошибки — по-доброму и без «не знаю»: недоступно → «Могу описать словами» (вопрос уходит в чат учителя).
 *
 * Портал поверх страницы (в 3D-лаборатории на весь экран — внутрь полноэкранного элемента), role=dialog,
 * фокус не уходит из окна (Tab по кругу), Esc закрывает и отменяет рисование.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT, type MessageKey } from '../../../i18n/useT'
import { brainGradeId } from '../../../learn/brain/remote/brainClient'
import {
  fetchPresets,
  generateImage,
  hasImageKey,
  ImageError,
  randomSeed,
  setImageKey,
  useImageInfo,
  useImageRole,
  type ImageLang,
  type ImagePhase,
  type ImagePreset,
  type ImageResult,
  type ImageSize,
  type ImageStyle,
} from '../../../learn/brain/remote/imageClient'
import { formulaToUnicode, renderOverlaySvg } from '../../../learn/brain/image/formulaSvg'
import { canCopyImage, composePng, copyImageBlob, downloadBlob, pngFileName } from '../../../learn/brain/image/overlayCompose'
import type { DrawContext, DrawInsert, DrawPlace } from './DrawButton'
import s from './DrawDialog.module.css'

interface DrawDialogProps {
  place: DrawPlace
  context: DrawContext
  /** Тема из фразы «нарисуй …» в чате. */
  initialSubject?: string
  /** Открыто только для ввода ключа (?draw=key). */
  keyEntry?: boolean
  onClose: () => void
  onInsert?: (msg: DrawInsert) => void
  onDescribeInstead?: (text: string) => void
}

type Tab = 'presets' | 'custom'
type RunState =
  | { kind: 'idle' }
  | { kind: 'running'; phase: ImagePhase; pct: number; queue: number | null }
  | { kind: 'done' }
  | { kind: 'error'; err: ImageError }

const SIZES: readonly ImageSize[] = ['square', 'wide', 'tall']
const STYLES: readonly ImageStyle[] = ['illustration', 'diagram', 'photo', 'poster']
const SIZE_KEY: Record<ImageSize, MessageKey> = {
  square: 'learn.assistant.drawSizeSquare',
  wide: 'learn.assistant.drawSizeWide',
  tall: 'learn.assistant.drawSizeTall',
}
const STYLE_KEY: Record<ImageStyle, MessageKey> = {
  illustration: 'learn.assistant.drawStyleIllustration',
  diagram: 'learn.assistant.drawStyleDiagram',
  photo: 'learn.assistant.drawStylePhoto',
  poster: 'learn.assistant.drawStylePoster',
}
/** Пропорции для предпросмотра подписи до рисования (как sizes в config.image сервера). */
const SIZE_PX: Record<ImageSize, [number, number]> = { square: [1024, 1024], wide: [1216, 832], tall: [832, 1216] }

function langOf(locale: string): ImageLang {
  return locale === 'en' || locale === 'uz' ? locale : 'ru'
}

function appTheme(): 'light' | 'dark' {
  try {
    return document.documentElement.getAttribute('data-app-theme') === 'light' ? 'light' : 'dark'
  } catch {
    return 'light'
  }
}

/** Основа слова для поиска: нижний регистр, первые 5 букв (кислота/кислоты, apparati/apparatini), у коротких — без окончания (вода/воды). */
function stems(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).map((w) => (w.length <= 5 ? w.slice(0, Math.max(3, w.length - 1)) : w.slice(0, 5)))
}

function presetHaystack(p: ImagePreset): string {
  return [p.title, p.titles?.ru, p.titles?.uz, p.titles?.en, p.topic, p.id].filter(Boolean).join(' ').toLowerCase()
}

/** Насколько тема похожа на «то, что на экране» (число совпавших основ). */
function matchScore(p: ImagePreset, words: string[]): number {
  if (!words.length) return 0
  const hay = presetHaystack(p)
  return words.reduce((n, w) => (hay.includes(w) ? n + 1 : n), 0)
}

function gradeNum(g: string): number {
  const n = Number(g.replace(/\D/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Классы пресета коротко: «7–8 кл.». */
function gradesLabel(p: ImagePreset, t: (k: MessageKey, v?: Record<string, string | number>) => string): string {
  const ns = p.grades.map(gradeNum).filter((n) => n > 0).sort((a, b) => a - b)
  if (!ns.length) return ''
  const txt = ns.length > 1 && ns[ns.length - 1] !== ns[0] ? `${ns[0]}–${ns[ns.length - 1]}` : String(ns[0])
  return t('learn.assistant.drawGradeShort', { n: txt })
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function DrawDialog({ place, context, initialSubject, keyEntry, onClose, onInsert, onDescribeInstead }: DrawDialogProps) {
  const { t, locale } = useT()
  const lang = langOf(locale)
  const info = useImageInfo()
  const r = useImageRole()
  const canFree = r !== 'student'
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)

  const grade = brainGradeId(context.gradeId)
  const gradeN = gradeNum(grade)
  const subjectHint = (initialSubject || context.subject || '').trim()

  const [tab, setTab] = useState<Tab>(() => (keyEntry || (initialSubject && r !== 'student') ? 'custom' : 'presets'))
  const [presets, setPresets] = useState<ImagePreset[] | null>(null)
  const [allGrades, setAllGrades] = useState(false)
  const [search, setSearch] = useState('')
  const [presetId, setPresetId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState(() => (r !== 'student' ? subjectHint : ''))
  const [size, setSize] = useState<ImageSize>('square')
  const [style, setStyle] = useState<ImageStyle | ''>('')
  const [formula, setFormula] = useState(() => (context.formula ?? '').slice(0, 80))
  const [caption, setCaption] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [run, setRun] = useState<RunState>({ kind: 'idle' })
  const [result, setResult] = useState<{ img: ImageResult; presetId: string | null; subject: string } | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [keyOwner, setKeyOwner] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  // темы — все 48 (фильтр «класс ±1» здесь: ученикам сервер всё равно не даст чужой класс)
  useEffect(() => {
    let alive = true
    void fetchPresets('', lang).then((list) => {
      if (!alive) return
      setPresets(list)
      // тема «с экрана» (лаборатория, «нарисуй …») — сразу выбрана, если нашлась
      const words = stems(subjectHint)
      if (words.length) {
        let best: ImagePreset | null = null
        let bestScore = 0
        for (const p of list) {
          const sc = matchScore(p, words)
          if (sc > bestScore) {
            best = p
            bestScore = sc
          }
        }
        if (best && bestScore >= Math.min(2, words.length)) {
          setPresetId(best.id)
          setSize(best.size)
        }
      }
    })
    return () => {
      alive = false
    }
  }, [lang, subjectHint])

  // прогресс, ошибка и подсказка — в поле зрения (они под формой); готовая картинка — наверху окна
  const runKind = run.kind
  useEffect(() => {
    if (runKind === 'done') bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    else if (runKind !== 'idle' || hint) statusRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [runKind, hint])

  // закрытие окна отменяет рисование
  useEffect(() => () => abortRef.current?.abort(), [])

  // фокус в окно при открытии
  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  const visiblePresets = useMemo(() => {
    if (!presets) return []
    const near = (p: ImagePreset) => !gradeN || allGrades || p.grades.some((g) => Math.abs(gradeNum(g) - gradeN) <= 1)
    const q = stems(search)
    const words = stems(subjectHint)
    return presets
      .filter(near)
      .filter((p) => !q.length || q.every((w) => presetHaystack(p).includes(w)))
      .map((p, i) => ({ p, i, sc: matchScore(p, words) }))
      .sort((a, b) => b.sc - a.sc || a.i - b.i)
      .map((x) => x.p)
  }, [presets, gradeN, allGrades, search, subjectHint])

  const selected = presets?.find((p) => p.id === presetId) ?? null
  const running = run.kind === 'running'

  const overlayFor = useCallback(
    (w: number, h: number) => renderOverlaySvg({ width: w, height: h, formula, caption, position: 'bottom', theme: appTheme() }),
    [formula, caption],
  )
  const resultSvg = useMemo(() => (result ? overlayFor(result.img.width, result.img.height) : ''), [result, overlayFor])
  const previewSvg = useMemo(() => (formula.trim() || caption.trim() ? overlayFor(...SIZE_PX[size]) : ''), [formula, caption, size, overlayFor])

  const subjectNow = (): string => (tab === 'custom' ? prompt.trim() : selected?.title || '') || subjectHint || context.sectionTitle || ''

  const start = useCallback(
    async (seed?: number) => {
      setHint(null)
      const useCustom = tab === 'custom' && canFree
      if (!useCustom && !selected) {
        setHint(t('learn.assistant.drawNeedPreset'))
        return
      }
      if (useCustom && prompt.trim().length < 3) {
        setHint(t('learn.assistant.drawNeedPrompt'))
        return
      }
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setCopied(false)
      setRun({ kind: 'running', phase: 'checking', pct: 3, queue: null })
      const subject = useCustom ? prompt.trim() : (selected?.title ?? '')
      try {
        const img = await generateImage(
          {
            lang,
            ...(useCustom ? { prompt: prompt.trim().slice(0, 500) } : { presetId: selected!.id }),
            size,
            ...(style ? { style } : {}),
            ...(seed !== undefined ? { seed } : {}),
            overlay: { formula: formula.trim(), caption: caption.trim() },
            context: { gradeId: context.gradeId, sectionTitle: context.sectionTitle, place: place === 'chat' ? 'chat' : 'lab' },
          },
          {
            signal: ctrl.signal,
            onQueue: (pos) => setRun((cur) => (cur.kind === 'running' ? { ...cur, phase: 'waiting_gpu', pct: Math.max(cur.pct, 8), queue: pos } : cur)),
            onProgress: (phase, pct) => setRun((cur) => (cur.kind === 'running' ? { ...cur, phase, pct: Math.max(cur.pct, pct) } : cur)),
          },
        )
        if (ctrl.signal.aborted) return
        setResult({ img, presetId: useCustom ? null : (selected?.id ?? null), subject })
        setRun({ kind: 'done' })
      } catch (e) {
        if (ctrl.signal.aborted) return
        const err = e instanceof ImageError ? e : new ImageError('network')
        setRun(err.code === 'aborted' ? { kind: 'idle' } : { kind: 'error', err })
      }
    },
    [canFree, caption, context.gradeId, context.sectionTitle, formula, lang, place, prompt, selected, size, style, t, tab],
  )

  const cancel = () => {
    abortRef.current?.abort()
    setRun({ kind: 'idle' })
  }

  const close = useCallback(() => {
    abortRef.current?.abort()
    onClose()
  }, [onClose])

  // Esc и Tab ловим на документе: фокус может «упасть» на body, когда исчезает нажатая кнопка (сохранили ключ)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current
      if (!panel) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
        return
      }
      if (e.key !== 'Tab') return
      const list = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (!list.length) return
      const first = list[0]!
      const last = list[list.length - 1]!
      const active = document.activeElement
      if (!active || !panel.contains(active)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [close])

  const altText = (subject: string): string => {
    const f = formula.trim() ? formulaToUnicode(formula.trim()) : ''
    return [t('learn.assistant.drawResultAlt', { subject: subject || t('learn.assistant.draw') }), f, caption.trim()].filter(Boolean).join(' · ')
  }

  const savePng = async () => {
    if (!result) return
    setSaving(true)
    try {
      const blob = await composePng(result.img.dataUrl, resultSvg, { width: result.img.width, height: result.img.height })
      downloadBlob(blob, pngFileName(result.presetId, result.img.seed))
    } catch {
      setHint(t('learn.assistant.drawErr.failed'))
    } finally {
      setSaving(false)
    }
  }

  const copyPng = async () => {
    if (!result) return
    try {
      const blob = await composePng(result.img.dataUrl, resultSvg, { width: result.img.width, height: result.img.height })
      if (await copyImageBlob(blob)) {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      }
    } catch {
      // буфер обмена недоступен — молча, кнопка «Сохранить PNG» остаётся
    }
  }

  const insert = () => {
    if (!result || !onInsert) return
    onInsert({
      dataUrl: result.img.dataUrl,
      alt: altText(result.subject),
      ...(resultSvg ? { overlaySvg: resultSvg } : {}),
      width: result.img.width,
      height: result.img.height,
    })
    close()
  }

  const saveKey = () => {
    const v = keyInput.trim()
    if (v.length < 8) return
    setImageKey(keyOwner ? 'owner' : 'teacher', v)
    setKeyInput('')
    setKeySaved(true)
    setTab('custom')
    // кнопка «Сохранить ключ» исчезает — фокус в окно, а не на body
    window.setTimeout(() => panelRef.current?.focus(), 0)
  }

  const forgetKey = () => {
    setImageKey('owner', '')
    setImageKey('teacher', '')
    setKeySaved(false)
    setTab('presets')
    window.setTimeout(() => panelRef.current?.focus(), 0)
  }

  /** Текст ошибки и можно ли предложить «описать словами». */
  const errorView = (err: ImageError): { text: string; describe: boolean } => {
    const badKey = hasImageKey() && err.role === 'student' && (err.code === 'forbidden' || err.code === 'bad_request')
    if (badKey) return { text: t('learn.assistant.drawErr.badKey'), describe: false }
    switch (err.code) {
      case 'disabled':
      case 'not_ready':
      case 'offline':
        return place === 'chat' && onDescribeInstead
          ? { text: t('learn.assistant.drawErr.unavailable'), describe: true }
          : { text: t('learn.assistant.drawErr.unavailableLab'), describe: false }
      case 'rate':
        return { text: t('learn.assistant.drawErr.rate', { n: err.retryAfterSec ?? 60 }), describe: false }
      case 'busy':
        return { text: t('learn.assistant.drawErr.busy'), describe: false }
      case 'unsafe_prompt':
        return { text: err.message && err.message !== err.code ? err.message : t('learn.assistant.drawErr.unsafePrompt'), describe: false }
      case 'unsafe_image':
        return { text: t('learn.assistant.drawErr.unsafeImage'), describe: false }
      case 'forbidden':
        return { text: t('learn.assistant.drawErr.forbidden'), describe: false }
      case 'bad_request':
        return { text: err.message && err.message !== err.code ? err.message : t('learn.assistant.drawErr.failed'), describe: false }
      default:
        return { text: t('learn.assistant.drawErr.failed'), describe: false }
    }
  }

  const phaseText = (st: Extract<RunState, { kind: 'running' }>): string => {
    switch (st.phase) {
      case 'checking':
        return t('learn.assistant.drawPhase.checking')
      case 'waiting_gpu':
        return t('learn.assistant.drawPhase.waiting', { n: st.queue ?? 1 })
      case 'switching':
        return t('learn.assistant.drawPhase.switching')
      case 'loading':
        return t('learn.assistant.drawPhase.loading')
      case 'sampling':
        return t('learn.assistant.drawPhase.sampling', { pct: Math.round(st.pct) })
      default:
        return t('learn.assistant.drawPhase.finishing')
    }
  }

  const describe = () => {
    const subject = subjectNow()
    onDescribeInstead?.(t('learn.assistant.drawDescribePrompt', { subject: subject || t('learn.assistant.draw') }))
    close()
  }

  const host = typeof document !== 'undefined' ? ((document.fullscreenElement as HTMLElement | null) ?? document.body) : null
  if (!host) return null
  const err = run.kind === 'error' ? errorView(run.err) : null
  const title = place === 'chat' ? t('learn.assistant.drawTitle') : t('lab.draw.title')

  return createPortal(
    <div className={s.backdrop} onMouseDown={(e) => e.target === e.currentTarget && close()} data-draw-dialog={place}>
      <div ref={panelRef} className={s.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className={s.head}>
          <h2 id={titleId} className={s.title}>
            {title}
          </h2>
          <button type="button" className={s.closeBtn} onClick={close} aria-label={t('learn.assistant.drawClose')} title={t('learn.assistant.drawClose')}>
            <span aria-hidden>×</span>
          </button>
        </div>

        <div ref={bodyRef} className={s.body}>
          {result ? (
            <section className={s.resultBlock} aria-live="polite">
              <figure className={s.result}>
                <div
                  className={s.resultFrame}
                  // ширина по высоте окна — пропорции картинки сохраняются (без белых полей по бокам)
                  style={{ aspectRatio: `${result.img.width} / ${result.img.height}`, width: `min(100%, calc(56dvh * ${(result.img.width / result.img.height).toFixed(4)}))` }}
                >
                  <img src={result.img.dataUrl} alt={altText(result.subject)} width={result.img.width} height={result.img.height} />
                  {resultSvg ? <div className={s.overlay} aria-hidden dangerouslySetInnerHTML={{ __html: resultSvg }} /> : null}
                </div>
              </figure>
              <div className={s.resultActions}>
                <button type="button" className={s.btnPrimary} onClick={() => void savePng()} disabled={saving} data-draw-save="">
                  {t('learn.assistant.drawSave')}
                </button>
                {place === 'chat' && onInsert ? (
                  <button type="button" className={s.btn} onClick={insert} data-draw-insert="">
                    {t('learn.assistant.drawInsert')}
                  </button>
                ) : null}
                <button type="button" className={s.btn} onClick={() => void start(randomSeed())} disabled={running}>
                  {t('learn.assistant.drawAgain')}
                </button>
                {canCopyImage() ? (
                  <button type="button" className={s.btn} onClick={() => void copyPng()}>
                    {copied ? t('learn.assistant.drawCopied') : t('learn.assistant.drawCopy')}
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          <div className={s.tabs} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'presets'}
              className={tab === 'presets' ? `${s.tab} ${s.tabOn}` : s.tab}
              onClick={() => setTab('presets')}
            >
              {t('learn.assistant.drawPresets')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'custom'}
              className={tab === 'custom' ? `${s.tab} ${s.tabOn}` : s.tab}
              onClick={() => setTab('custom')}
            >
              {t('learn.assistant.drawCustom')}
            </button>
          </div>

          {tab === 'presets' ? (
            <div className={s.presets} role="tabpanel">
              <div className={s.searchRow}>
                <input
                  type="search"
                  className={s.input}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('learn.assistant.drawSearch')}
                  aria-label={t('learn.assistant.drawSearch')}
                />
                {gradeN && canFree ? (
                  <label className={s.check}>
                    <input type="checkbox" checked={allGrades} onChange={(e) => setAllGrades(e.target.checked)} />
                    <span>{t('learn.assistant.drawAllGrades')}</span>
                  </label>
                ) : null}
              </div>
              {presets === null ? (
                <div className={s.grid} aria-busy="true">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={`${s.tile} ${s.tileSkeleton}`} />
                  ))}
                </div>
              ) : !presets.length ? (
                <p className={s.note}>{t('learn.assistant.drawNoPresets')}</p>
              ) : !visiblePresets.length ? (
                <p className={s.note}>{t('learn.assistant.drawNoMatch')}</p>
              ) : (
                <div className={s.grid} role="listbox" aria-label={t('learn.assistant.drawPresets')}>
                  {visiblePresets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={presetId === p.id}
                      className={presetId === p.id ? `${s.tile} ${s.tileOn}` : s.tile}
                      onClick={() => {
                        setPresetId(p.id)
                        setSize(p.size)
                        setHint(null)
                      }}
                      data-preset={p.id}
                    >
                      <span className={s.tileTitle}>{p.title}</span>
                      <span className={s.tileMeta}>
                        {gradesLabel(p, t)}
                        {gradesLabel(p, t) ? ' · ' : ''}
                        {t(STYLE_KEY[p.style])}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={s.custom} role="tabpanel">
              {canFree ? (
                <>
                  <label className={s.label} htmlFor={`${titleId}-prompt`}>
                    {t('learn.assistant.drawPromptLabel')}
                  </label>
                  <textarea
                    id={`${titleId}-prompt`}
                    className={`${s.input} ${s.textarea}`}
                    value={prompt}
                    maxLength={500}
                    rows={3}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={t('learn.assistant.drawPromptPlaceholder')}
                  />
                  <div className={s.keyRow}>
                    {keySaved ? <span className={s.ok}>{t('learn.assistant.drawKeySaved')}</span> : <span />}
                    <button type="button" className={s.linkBtn} onClick={forgetKey}>
                      {t('learn.assistant.drawKeyForget')}
                    </button>
                  </div>
                </>
              ) : (
                <div className={s.keyBox}>
                  <p className={s.note}>{t('learn.assistant.drawKeyHint')}</p>
                  <label className={s.label} htmlFor={`${titleId}-key`}>
                    {t('learn.assistant.drawKey')}
                  </label>
                  <div className={s.keyRow}>
                    <input
                      id={`${titleId}-key`}
                      type="password"
                      className={s.input}
                      value={keyInput}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(e) => setKeyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          saveKey()
                        }
                      }}
                    />
                    <button type="button" className={s.btn} onClick={saveKey} disabled={keyInput.trim().length < 8}>
                      {t('learn.assistant.drawKeySave')}
                    </button>
                  </div>
                  <label className={s.check}>
                    <input type="checkbox" checked={keyOwner} onChange={(e) => setKeyOwner(e.target.checked)} />
                    <span>{t('learn.assistant.drawKeyOwner')}</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {tab === 'presets' || canFree ? (
            <div className={s.options}>
              <div className={s.optGroup} role="group" aria-label={t('learn.assistant.drawSize')}>
                <span className={s.label}>{t('learn.assistant.drawSize')}</span>
                <div className={s.seg}>
                  {SIZES.map((z) => (
                    <button key={z} type="button" className={size === z ? `${s.segBtn} ${s.segOn}` : s.segBtn} aria-pressed={size === z} onClick={() => setSize(z)}>
                      {t(SIZE_KEY[z])}
                    </button>
                  ))}
                </div>
              </div>
              <div className={s.optGroup} role="group" aria-label={t('learn.assistant.drawStyle')}>
                <span className={s.label}>{t('learn.assistant.drawStyle')}</span>
                <div className={s.seg}>
                  <button type="button" className={style === '' ? `${s.segBtn} ${s.segOn}` : s.segBtn} aria-pressed={style === ''} onClick={() => setStyle('')}>
                    {t('learn.assistant.drawStyleAuto')}
                  </button>
                  {STYLES.map((z) => (
                    <button key={z} type="button" className={style === z ? `${s.segBtn} ${s.segOn}` : s.segBtn} aria-pressed={style === z} onClick={() => setStyle(z)}>
                      {t(STYLE_KEY[z])}
                    </button>
                  ))}
                </div>
              </div>
              <div className={s.optRow}>
                <div className={s.optField}>
                  <label className={s.label} htmlFor={`${titleId}-formula`}>
                    {t('learn.assistant.drawFormula')}
                  </label>
                  <input
                    id={`${titleId}-formula`}
                    className={s.input}
                    value={formula}
                    maxLength={80}
                    onChange={(e) => setFormula(e.target.value)}
                    placeholder="2H2 + O2 -> 2H2O"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <span className={s.small}>{t('learn.assistant.drawFormulaHint')}</span>
                </div>
                <div className={s.optField}>
                  <label className={s.label} htmlFor={`${titleId}-caption`}>
                    {t('learn.assistant.drawCaption')}
                  </label>
                  <input id={`${titleId}-caption`} className={s.input} value={caption} maxLength={120} onChange={(e) => setCaption(e.target.value)} />
                </div>
              </div>
              {previewSvg && !result ? (
                <div className={s.previewWrap}>
                  <span className={s.small}>{t('learn.assistant.drawPreview')}</span>
                  <div className={s.preview} style={{ aspectRatio: `${SIZE_PX[size][0]} / ${SIZE_PX[size][1]}` }}>
                    <div className={s.overlay} aria-hidden dangerouslySetInnerHTML={{ __html: previewSvg }} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div ref={statusRef} className={s.statusSlot}>
          {run.kind === 'running' ? (
            <div className={s.progress} role="status" aria-live="polite">
              <div className={s.bar} aria-hidden>
                <span className={s.barFill} style={{ width: `${Math.max(3, Math.min(100, run.pct))}%` }} />
              </div>
              <span className={s.phase}>{phaseText(run)}</span>
            </div>
          ) : null}
          {err ? (
            <div className={s.error} role="alert">
              <p>{err.text}</p>
              {err.describe ? (
                <button type="button" className={s.btn} onClick={describe}>
                  {t('learn.assistant.drawDescribeInstead')}
                </button>
              ) : null}
            </div>
          ) : null}
          {hint ? (
            <p className={s.hint} role="alert">
              {hint}
            </p>
          ) : null}
          </div>
        </div>

        <div className={s.foot}>
          <span className={s.small}>{info && !info.ready ? t('learn.assistant.drawPreparing') : t('learn.assistant.drawSafetyNote')}</span>
          {running ? (
            <button type="button" className={s.btn} onClick={cancel}>
              {t('learn.assistant.drawCancel')}
            </button>
          ) : tab === 'presets' || canFree ? (
            <button type="button" className={s.btnPrimary} onClick={() => void start()} disabled={!!info && !info.ready} data-draw-go="">
              {t('learn.assistant.drawGo')}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    host,
  )
}
