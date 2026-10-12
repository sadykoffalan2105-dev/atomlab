/**
 * Режим «🎨 Картинка» в чате ИИ-учителя — рисование как полноценный режим ввода, а не отдельное окно:
 *
 *  • ChatModeSwitch — переключатель «💬 Вопрос | 🎨 Картинка» над полем ввода (радиогруппа: стрелки, Home/End,
 *    один Tab-стоп). Виден всем; «Картинка» недоступна (aria-disabled + подсказка), пока сервер не рисует
 *    (/health → image.enabled && ready);
 *  • DrawComposer — вместо поля ввода: ученик выбирает тему своего класса ±1 (/image/presets, свой текст нельзя),
 *    учитель / владелец (ключ на устройстве) — свой запрос или тему; этапы сервера вживую (очередь → освобождаю
 *    видеокарту → рисую… N с → проверяю → готово), карточка результата с формулой поверх (SVG сайта),
 *    «Сохранить PNG», «Вставить в урок», «Спросить учителя про картинку», «Ещё вариант» и галерея картинок вкладки.
 *
 * Чистая логика — src/learn/brain/image/drawMode.ts (самопроверка — imageClient.selftest.ts).
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useT, type MessageKey } from '../../../i18n/useT'
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
  type ImageSize,
} from '../../../learn/brain/remote/imageClient'
import {
  addToGallery,
  askAboutImageText,
  cleanFormulaInput,
  drawAvailability,
  DRAW_STAGES,
  filterPresets,
  galleryItems,
  gradeNum,
  nearestPreset,
  presetsForGrade,
  stageIndex,
  stageOf,
  subscribeGallery,
  waitLabel,
  type ChatComposeMode,
  type DrawGalleryItem,
  type DrawStage,
} from '../../../learn/brain/image/drawMode'
import { formulaToUnicode, renderOverlaySvg } from '../../../learn/brain/image/formulaSvg'
import { composePng, downloadBlob, pngFileName } from '../../../learn/brain/image/overlayCompose'
import type { DrawInsert } from './DrawButton'
import { onRadioGroupKeyDown } from './radioGroupKeys'
import s from './DrawMode.module.css'

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

/* ================================================================== переключатель режима */

interface ChatModeSwitchProps {
  mode: ChatComposeMode
  onChange: (mode: ChatComposeMode) => void
}

export function ChatModeSwitch({ mode, onChange }: ChatModeSwitchProps) {
  const { t } = useT()
  const info = useImageInfo()
  const role = useImageRole()
  const avail = drawAvailability(info, role)
  const [tip, setTip] = useState(false)
  const tipId = useId()
  const offText = avail.reason ? t(`learn.drawMode.off.${avail.reason}` as MessageKey) : ''

  useEffect(() => {
    if (!tip) return
    const id = window.setTimeout(() => setTip(false), 4000)
    return () => window.clearTimeout(id)
  }, [tip])

  const pick = (m: ChatComposeMode) => {
    if (m === 'image' && !avail.selectable) {
      setTip(true)
      return
    }
    setTip(false)
    onChange(m)
  }

  return (
    <div className={s.switchRow}>
      <div className={s.switch} role="radiogroup" aria-label={t('learn.drawMode.label')} onKeyDown={onRadioGroupKeyDown} data-chat-mode={mode}>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'ask'}
          tabIndex={mode === 'ask' ? 0 : -1}
          className={mode === 'ask' ? `${s.switchBtn} ${s.switchOn}` : s.switchBtn}
          onClick={() => pick('ask')}
          data-chat-mode-btn="ask"
        >
          <span aria-hidden className={s.switchIcon}>
            💬
          </span>
          <span>{t('learn.drawMode.ask')}</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'image'}
          aria-disabled={!avail.selectable || undefined}
          aria-describedby={!avail.selectable ? tipId : undefined}
          tabIndex={mode === 'image' ? 0 : -1}
          className={`${mode === 'image' ? `${s.switchBtn} ${s.switchOn}` : s.switchBtn}${avail.selectable ? '' : ` ${s.switchOff}`}`}
          onClick={() => pick('image')}
          title={offText || undefined}
          data-chat-mode-btn="image"
        >
          <span aria-hidden className={s.switchIcon}>
            🎨
          </span>
          <span>{t('learn.drawMode.image')}</span>
        </button>
      </div>
      {/* подсказка «почему нельзя»: и для мыши (title), и для экранного диктора / касания (видимый текст по нажатию) */}
      <span id={tipId} className={tip ? s.switchTip : s.srOnly} role={tip ? 'status' : undefined}>
        {offText}
      </span>
    </div>
  )
}

/* ================================================================== режим «Картинка» */

type RunState =
  | { kind: 'idle' }
  | { kind: 'running'; stage: DrawStage; pct: number; queue: number | null; drawAt: number | null; startedAt: number }
  | { kind: 'error'; err: ImageError }

interface DrawComposerProps {
  gradeId?: string
  sectionTitle?: string
  /** Фраза «нарисуй …» из режима «Вопрос»: тема (nonce — чтобы одинаковая фраза сработала снова). */
  request?: { subject: string; nonce: number } | null
  onInsert: (image: DrawInsert) => void
  /** Вопрос учителю (режим «Вопрос», обычный чат). */
  onAsk: (text: string) => void
}

const SIZE_OF_STYLE: ImageSize = 'square'

export function DrawComposer({ gradeId, sectionTitle, request, onInsert, onAsk }: DrawComposerProps) {
  const { t, locale } = useT()
  const lang = langOf(locale)
  const info = useImageInfo()
  const role = useImageRole()
  const avail = drawAvailability(info, role)
  const canFree = role !== 'student'
  const uid = useId()
  const abortRef = useRef<AbortController | null>(null)
  const goRef = useRef<HTMLButtonElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  const [presets, setPresets] = useState<ImagePreset[] | null>(null)
  const [presetId, setPresetId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [prompt, setPrompt] = useState('')
  const [formula, setFormula] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [run, setRun] = useState<RunState>({ kind: 'idle' })
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [inserted, setInserted] = useState<ReadonlySet<string>>(() => new Set())
  const [saving, setSaving] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [keyOwner, setKeyOwner] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const gallery = useSyncExternalStore(subscribeGallery, galleryItems, galleryItems)
  const current = gallery.find((g) => g.id === currentId) ?? null

  // все 48 тем (ученику показываем свой класс ±1: сервер чужой класс всё равно не примет)
  useEffect(() => {
    let alive = true
    void fetchPresets('', lang).then((list) => {
      if (alive) setPresets(list)
    })
    return () => {
      alive = false
    }
  }, [lang])

  const gradeN = gradeNum(gradeId)
  const pool = useMemo(() => {
    if (!presets) return []
    if (!canFree) return presetsForGrade(presets, gradeId)
    // учитель: все темы, свой класс ±1 — первыми
    const near = new Set(presetsForGrade(presets, gradeId).map((p) => p.id))
    return [...presets].sort((a, b) => Number(near.has(b.id)) - Number(near.has(a.id)))
  }, [presets, canFree, gradeId])
  const visible = useMemo(() => filterPresets(pool, search), [pool, search])
  const selected = pool.find((p) => p.id === presetId) ?? null

  // «нарисуй …» из режима «Вопрос»: учителю — текст запроса (и сразу рисуем), ученику — ближайшая тема класса
  const handledNonce = useRef<number | null>(null)
  const startRef = useRef<(seed?: number) => void>(() => undefined)
  useEffect(() => {
    if (!request || handledNonce.current === request.nonce) return
    if (canFree) {
      handledNonce.current = request.nonce
      setPrompt(request.subject.slice(0, 500))
      setPresetId(null)
      if (avail.canDraw) window.setTimeout(() => startRef.current(), 0)
      return
    }
    if (!presets) return // темы ещё грузятся — вернёмся, когда придут
    handledNonce.current = request.nonce
    const best = nearestPreset(request.subject, pool)
    if (best) {
      setPresetId(best.id)
      setSearch('')
      setHint(t('learn.drawMode.nearest', { subject: request.subject.slice(0, 60) }))
      window.setTimeout(() => goRef.current?.focus(), 0)
    } else {
      setHint(t('learn.drawMode.nearestNone', { subject: request.subject.slice(0, 60) }))
    }
  }, [request, canFree, presets, pool, avail.canDraw, t])

  // секунды «рисую… N с»
  const running = run.kind === 'running'
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [running])

  // уход из режима — рисование отменяется
  useEffect(() => () => abortRef.current?.abort(), [])

  const start = useCallback(
    async (seed?: number, again?: DrawGalleryItem) => {
      setHint(null)
      const useFree = canFree && !again?.presetId && (again ? !!again.description : !!prompt.trim() && !presetId)
      const preset = again?.presetId ? pool.find((p) => p.id === again.presetId) ?? presets?.find((p) => p.id === again.presetId) ?? null : selected
      const freeText = again ? again.description : prompt.trim()
      if (!useFree && !preset) {
        setHint(canFree ? t('learn.drawMode.needPrompt') : t('learn.drawMode.needPreset'))
        return
      }
      if (useFree && freeText.length < 3) {
        setHint(t('learn.drawMode.needPrompt'))
        return
      }
      const f = again ? again.formula : canFree ? formula.trim().slice(0, 80) : cleanFormulaInput(formula).trim()
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const startedAt = Date.now()
      setNow(startedAt)
      setRun({ kind: 'running', stage: 'request', pct: 3, queue: null, drawAt: null, startedAt })
      const subject = useFree ? freeText : (preset?.title ?? '')
      const toStage = (phase: ImagePhase | 'queue', pct: number, queue?: number) =>
        setRun((cur) => {
          if (cur.kind !== 'running') return cur
          const stage = stageOf(phase)
          // этапы только вперёд (очередь после «принял» — да, назад из «рисую» — нет)
          const next = stageIndex(stage) >= stageIndex(cur.stage) ? stage : cur.stage
          return {
            ...cur,
            stage: next,
            pct: Math.max(cur.pct, pct),
            queue: queue ?? cur.queue,
            drawAt: next === 'draw' && cur.drawAt === null ? Date.now() : cur.drawAt,
          }
        })
      try {
        const img = await generateImage(
          {
            lang,
            ...(useFree ? { prompt: freeText.slice(0, 500) } : { presetId: preset!.id }),
            size: useFree ? SIZE_OF_STYLE : preset!.size,
            ...(seed !== undefined ? { seed } : {}),
            ...(f ? { overlay: { formula: f } } : {}),
            context: { gradeId, sectionTitle, place: 'chat' },
          },
          {
            signal: ctrl.signal,
            onQueue: (pos) => toStage('queue', 8, pos),
            onProgress: (phase, pct) => toStage(phase, pct),
          },
        )
        if (ctrl.signal.aborted) return
        const item: DrawGalleryItem = {
          id: img.jobId || `img-${Date.now()}`,
          dataUrl: img.dataUrl,
          width: img.width,
          height: img.height,
          subject,
          presetId: useFree ? null : preset!.id,
          seed: img.seed,
          formula: f,
          caption: '',
          description: useFree ? freeText : '',
          at: Date.now(),
        }
        addToGallery(item)
        setCurrentId(item.id)
        setRun({ kind: 'idle' })
        setHint(t('learn.drawMode.st.done'))
      } catch (e) {
        if (ctrl.signal.aborted) return
        const err = e instanceof ImageError ? e : new ImageError('network')
        setRun(err.code === 'aborted' ? { kind: 'idle' } : { kind: 'error', err })
      }
    },
    [canFree, formula, gradeId, lang, pool, presetId, presets, prompt, sectionTitle, selected, t],
  )
  startRef.current = (seed?: number) => void start(seed)

  const cancel = () => {
    abortRef.current?.abort()
    setRun({ kind: 'idle' })
  }

  const overlayOf = (g: DrawGalleryItem): string =>
    g.formula || g.caption ? renderOverlaySvg({ width: g.width, height: g.height, formula: g.formula, caption: g.caption, position: 'bottom', theme: appTheme() }) : ''

  const altOf = (g: DrawGalleryItem): string =>
    [t('learn.drawMode.alt', { subject: g.subject || t('learn.drawMode.image') }), g.formula ? formulaToUnicode(g.formula) : ''].filter(Boolean).join(' · ')

  const savePng = async (g: DrawGalleryItem) => {
    setSaving(true)
    try {
      const blob = await composePng(g.dataUrl, overlayOf(g), { width: g.width, height: g.height })
      downloadBlob(blob, pngFileName(g.presetId, g.seed))
    } catch {
      setHint(t('learn.assistant.drawErr.failed'))
    } finally {
      setSaving(false)
    }
  }

  const insert = (g: DrawGalleryItem) => {
    const svg = overlayOf(g)
    onInsert({ dataUrl: g.dataUrl, alt: altOf(g), ...(svg ? { overlaySvg: svg } : {}), width: g.width, height: g.height })
    setInserted((cur) => new Set(cur).add(g.id))
  }

  const ask = (g: DrawGalleryItem) => onAsk(askAboutImageText(lang, { subject: g.subject, formula: g.formula ? formulaToUnicode(g.formula) : '', description: g.description }))

  const describeInstead = () => {
    const subject = (canFree ? prompt.trim() : '') || selected?.title || sectionTitle || t('learn.drawMode.image')
    onAsk(t('learn.assistant.drawDescribePrompt', { subject }))
  }

  const saveKey = () => {
    const v = keyInput.trim()
    if (v.length < 8) return
    setImageKey(keyOwner ? 'owner' : 'teacher', v)
    setKeyInput('')
    setKeyOpen(false)
    window.setTimeout(() => promptRef.current?.focus(), 0)
  }

  const forgetKey = () => {
    setImageKey('owner', '')
    setImageKey('teacher', '')
    setPrompt('')
  }

  /** Текст ошибки и можно ли «описать словами». */
  const errorView = (err: ImageError): { text: string; describe: boolean } => {
    if (hasImageKey() && err.role === 'student' && (err.code === 'forbidden' || err.code === 'bad_request')) return { text: t('learn.assistant.drawErr.badKey'), describe: false }
    switch (err.code) {
      case 'disabled':
      case 'not_ready':
      case 'offline':
      case 'network':
      case 'timeout':
        return { text: t('learn.assistant.drawErr.unavailable'), describe: true }
      case 'rate':
        return { text: t('learn.drawMode.rate', { wait: waitLabel(err.retryAfterSec ?? 60, lang) }), describe: false }
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
        return { text: t('learn.assistant.drawErr.failed'), describe: true }
    }
  }

  const stageText = (st: Extract<RunState, { kind: 'running' }>, withSeconds: boolean): string => {
    switch (st.stage) {
      case 'request':
        return t('learn.drawMode.st.request')
      case 'queue':
        return t('learn.drawMode.st.queue', { n: Math.max(1, st.queue ?? 1) })
      case 'gpu':
        return t('learn.drawMode.st.gpu')
      case 'draw':
        return withSeconds
          ? t('learn.drawMode.st.draw', { s: Math.max(0, Math.round((now - (st.drawAt ?? now)) / 1000)) })
          : t('learn.drawMode.short.draw')
      case 'check':
        return t('learn.drawMode.st.check')
      default:
        return t('learn.drawMode.st.done')
    }
  }

  const err = run.kind === 'error' ? errorView(run.err) : null
  const showForm = avail.canDraw
  const stIdx = run.kind === 'running' ? stageIndex(run.stage) : -1

  return (
    <div className={s.wrap} data-draw-mode={role}>
      {current ? (
        <section className={s.card} aria-labelledby={`${uid}-res`} data-draw-result={current.id}>
          <h3 id={`${uid}-res`} className={s.srOnly}>
            {altOf(current)}
          </h3>
          <figure className={s.figure}>
            <div
              className={s.frame}
              style={{ aspectRatio: `${current.width} / ${current.height}`, width: `min(100%, calc(var(--frame-h) * ${(current.width / current.height).toFixed(4)}))` }}
            >
              <img src={current.dataUrl} alt={altOf(current)} width={current.width} height={current.height} />
              {overlayOf(current) ? <div className={s.overlay} aria-hidden dangerouslySetInnerHTML={{ __html: overlayOf(current) }} /> : null}
            </div>
            <figcaption className={s.caption}>{current.subject}</figcaption>
          </figure>
          <div className={s.actions}>
            <button type="button" className={s.btnPrimary} onClick={() => void savePng(current)} disabled={saving} data-draw-save="">
              {t('learn.drawMode.save')}
            </button>
            <button type="button" className={s.btn} onClick={() => insert(current)} disabled={inserted.has(current.id)} data-draw-insert="">
              {inserted.has(current.id) ? t('learn.drawMode.inserted') : t('learn.drawMode.insert')}
            </button>
            <button type="button" className={s.btn} onClick={() => ask(current)} data-draw-ask="">
              {t('learn.drawMode.askTeacher')}
            </button>
            <button type="button" className={s.btn} onClick={() => void start(randomSeed(), current)} disabled={running || !avail.canDraw} data-draw-again="">
              {t('learn.drawMode.again')}
            </button>
          </div>
        </section>
      ) : null}

      {gallery.length > 1 ? (
        <div className={s.gallery} role="group" aria-label={t('learn.drawMode.gallery')} data-draw-gallery="">
          <span className={s.small}>{t('learn.drawMode.gallery')}</span>
          <div className={s.thumbs}>
            {gallery.map((g) => (
              <button
                key={g.id}
                type="button"
                className={g.id === currentId ? `${s.thumb} ${s.thumbOn}` : s.thumb}
                aria-pressed={g.id === currentId}
                aria-label={t('learn.drawMode.open', { subject: g.subject })}
                title={g.subject}
                onClick={() => setCurrentId(g.id)}
              >
                <img src={g.dataUrl} alt="" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {run.kind === 'running' ? (
        <div className={s.progress} data-draw-stage={run.stage}>
          <ol className={s.steps} aria-label={t('learn.drawMode.stages')}>
            {DRAW_STAGES.map((st, i) => (
              <li key={st} className={i < stIdx ? s.stepDone : i === stIdx ? s.stepOn : s.step} aria-current={i === stIdx ? 'step' : undefined}>
                {t(`learn.drawMode.short.${st}` as MessageKey)}
              </li>
            ))}
          </ol>
          <div className={s.bar} aria-hidden>
            <span className={s.barFill} style={{ width: `${Math.max(3, Math.min(100, run.pct))}%` }} />
          </div>
          {/* видимая строка со счётчиком секунд — без озвучки каждую секунду; диктору — только смена этапа */}
          <p className={s.stageLine} aria-hidden>
            {stageText(run, true)}
          </p>
          <span className={s.srOnly} role="status" aria-live="polite">
            {stageText(run, false)}
          </span>
        </div>
      ) : null}

      {err ? (
        <div className={s.error} role="alert">
          <p>{err.text}</p>
          {err.describe ? (
            <button type="button" className={s.btn} onClick={describeInstead}>
              {t('learn.assistant.drawDescribeInstead')}
            </button>
          ) : null}
        </div>
      ) : null}
      {hint ? (
        <p className={s.hint} role="status">
          {hint}
        </p>
      ) : null}

      {avail.studentsOff ? <p className={s.note}>{t('learn.drawMode.studentsOff')}</p> : null}
      {avail.reason && !running ? <p className={s.note}>{t(`learn.drawMode.off.${avail.reason}` as MessageKey)}</p> : null}

      {showForm ? (
        <div className={s.form}>
          {canFree ? (
            <>
              <label className={s.label} htmlFor={`${uid}-prompt`}>
                {t('learn.drawMode.prompt')}
              </label>
              <textarea
                ref={promptRef}
                id={`${uid}-prompt`}
                className={`${s.input} ${s.textarea}`}
                value={prompt}
                rows={2}
                maxLength={500}
                placeholder={t('learn.drawMode.promptPh')}
                onChange={(e) => {
                  setPrompt(e.target.value)
                  if (e.target.value.trim()) setPresetId(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    if (!running) void start()
                  }
                }}
                data-draw-prompt=""
              />
            </>
          ) : null}

          <TopicPicker
            title={canFree ? t('learn.drawMode.orTopic') : t('learn.drawMode.topic')}
            hintText={canFree ? null : t('learn.drawMode.topicHint')}
            loading={presets === null}
            empty={!!presets && !presets.length}
            items={visible}
            total={pool.length}
            selectedId={presetId}
            search={search}
            onSearch={setSearch}
            onPick={(p) => {
              setPresetId(p.id)
              setHint(null)
              if (canFree) setPrompt('')
            }}
            gradeN={gradeN}
            collapsible={canFree}
          />

          <div className={s.formulaRow}>
            <label className={s.label} htmlFor={`${uid}-formula`}>
              {t('learn.drawMode.formula')}
            </label>
            <input
              id={`${uid}-formula`}
              className={s.input}
              value={formula}
              maxLength={80}
              onChange={(e) => setFormula(canFree ? e.target.value : cleanFormulaInput(e.target.value))}
              placeholder={t('learn.drawMode.formulaPh')}
              aria-describedby={`${uid}-fhint`}
              spellCheck={false}
              autoComplete="off"
              data-draw-formula=""
            />
            <span id={`${uid}-fhint`} className={s.small}>
              {t('learn.drawMode.formulaHint')}
            </span>
          </div>
        </div>
      ) : null}

      {/* ключ учителя / владельца: ученик может ввести, учитель — забыть */}
      {canFree ? (
        <div className={s.keyRow}>
          <span className={s.small}>{role === 'owner' ? t('learn.drawMode.roleOwner') : t('learn.drawMode.roleTeacher')}</span>
          <button type="button" className={s.linkBtn} onClick={forgetKey}>
            {t('learn.drawMode.keyForget')}
          </button>
        </div>
      ) : (
        <div className={s.keyRow}>
          <button type="button" className={s.linkBtn} aria-expanded={keyOpen} aria-controls={`${uid}-key`} onClick={() => setKeyOpen((v) => !v)}>
            {t('learn.drawMode.keyToggle')}
          </button>
        </div>
      )}
      {!canFree && keyOpen ? (
        <div id={`${uid}-key`} className={s.keyBox}>
          <label className={s.label} htmlFor={`${uid}-keyin`}>
            {t('learn.drawMode.key')}
          </label>
          <div className={s.keyLine}>
            <input
              id={`${uid}-keyin`}
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
              {t('learn.drawMode.keySave')}
            </button>
          </div>
          <label className={s.check}>
            <input type="checkbox" checked={keyOwner} onChange={(e) => setKeyOwner(e.target.checked)} />
            <span>{t('learn.drawMode.keyOwner')}</span>
          </label>
        </div>
      ) : null}

      <div className={s.foot}>
        <span className={s.small}>{t('learn.drawMode.safety')}</span>
        {running ? (
          <button type="button" className={s.btn} onClick={cancel} data-draw-cancel="">
            {t('learn.drawMode.cancel')}
          </button>
        ) : showForm ? (
          <button ref={goRef} type="button" className={s.btnPrimary} onClick={() => void start()} data-draw-go="">
            <span aria-hidden>🎨</span> {t('learn.drawMode.go')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

/* ================================================================== выбор темы */

interface TopicPickerProps {
  title: string
  hintText: string | null
  loading: boolean
  empty: boolean
  items: readonly ImagePreset[]
  total: number
  selectedId: string | null
  search: string
  onSearch: (v: string) => void
  onPick: (p: ImagePreset) => void
  gradeN: number
  /** Учитель: темы свёрнуты под «или тема учебника». */
  collapsible: boolean
}

function TopicPicker({ title, hintText, loading, empty, items, total, selectedId, search, onSearch, onPick, gradeN, collapsible }: TopicPickerProps) {
  const { t } = useT()
  const labelId = useId()
  const [open, setOpen] = useState(!collapsible)
  const selectedVisible = items.some((p) => p.id === selectedId)
  const body = (
    <>
      {hintText ? <p className={s.small}>{hintText}</p> : null}
      {total > 6 ? (
        <input
          type="search"
          className={s.input}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t('learn.drawMode.search')}
          aria-label={t('learn.drawMode.search')}
        />
      ) : null}
      {loading ? (
        <div className={s.chips} aria-busy="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`${s.chip} ${s.chipSkeleton}`} />
          ))}
        </div>
      ) : empty ? (
        <p className={s.note}>{t('learn.drawMode.noPresets')}</p>
      ) : !items.length ? (
        <p className={s.note}>{t('learn.drawMode.noMatch')}</p>
      ) : (
        <div className={s.chips} role="radiogroup" aria-labelledby={labelId} onKeyDown={onRadioGroupKeyDown} data-draw-topics="">
          {items.map((p, i) => {
            const on = p.id === selectedId
            const near = gradeN > 0 && p.grades.some((g) => Math.abs(gradeNum(g) - gradeN) <= 1)
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on || (!selectedVisible && i === 0) ? 0 : -1}
                className={on ? `${s.chip} ${s.chipOn}` : s.chip}
                onClick={() => onPick(p)}
                data-preset={p.id}
                data-near={near ? '1' : undefined}
              >
                {p.title}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
  if (!collapsible) {
    return (
      <div className={s.topics}>
        <span id={labelId} className={s.label}>
          {title}
        </span>
        {body}
      </div>
    )
  }
  return (
    <div className={s.topics}>
      <button type="button" className={s.linkBtn} aria-expanded={open} onClick={() => setOpen((v) => !v)} id={labelId}>
        {open ? '▾' : '▸'} {title}
      </button>
      {open ? body : null}
    </div>
  )
}
