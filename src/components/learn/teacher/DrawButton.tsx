/**
 * Кнопка «Нарисовать» (чат ИИ-учителя, лаборатория, 3D-лаборатория) и картинка в пузыре чата.
 *
 * Видна, только если сервер мозга умеет рисовать (/health → image.enabled) и роль позволяет: владелец
 * (ключ X-Brain-Admin) и учитель (ключ учителя) — всегда, ученик — только когда владелец включил пресеты.
 * Сервер ещё готовится (image.ready = false) — кнопка видна, но неактивна. Ключ владельца / учителя вводят
 * во вкладке «Свой запрос»: если кнопки ещё нет (ученикам выключено), откройте страницу с «?draw=key»
 * в адресе (например #/learn?draw=key) — кнопка появится только для ввода ключа (сам ключ в адрес не пишем).
 *
 * Диалог грузится отдельным куском (lazy) — на страницы без рисования он не попадает.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useT } from '../../../i18n/useT'
import { useImageInfo, useImageRole } from '../../../learn/brain/remote/imageClient'
import s from './DrawDialog.module.css'

const DrawDialog = lazy(() => import('./DrawDialog').then((m) => ({ default: m.DrawDialog })))

export type DrawPlace = 'chat' | 'lab' | 'lab3d'

export interface DrawContext {
  gradeId?: string
  sectionTitle?: string
  /** Что сейчас на экране: продукт реакции, название опыта — тема по умолчанию. */
  subject?: string
  /** Уравнение / формула для «Подписи формулой» (лаборатория). */
  formula?: string
}

/** Картинка для пузыря чата («Вставить в чат»). */
export interface DrawInsert {
  dataUrl: string
  alt: string
  overlaySvg?: string
  width: number
  height: number
}

interface DrawButtonProps {
  place: DrawPlace
  context: DrawContext
  onInsert?: (msg: DrawInsert) => void
  /** «Описать словами» вместо картинки (чат): текст вопроса учителю. */
  onDescribeInstead?: (text: string) => void
  className?: string
  /** Подпись рядом с иконкой (лаборатории); без неё — только иконка (поле чата). */
  label?: string
  /** Чат открывает диалог сам — по фразе «нарисуй …» (тема подставляется). */
  openRef?: MutableRefObject<((subject?: string) => void) | null>
}

/** «?draw=key» в адресе (до или после #) — показать кнопку для ввода ключа учителя / владельца. */
function wantsKeyEntry(): boolean {
  try {
    if (typeof window === 'undefined') return false
    const { search, hash } = window.location
    const hq = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    return new URLSearchParams(search).get('draw') === 'key' || new URLSearchParams(hq).get('draw') === 'key'
  } catch {
    return false
  }
}

/** Кисть с каплей краски — в стиле TeacherIcons (контур, currentColor). */
function IconBrush() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d="M14.5 4.5 19.5 9.5 11 18l-5-5z" />
      <path d="M6 13c-2 0-3 1.4-3 3.2 0 1.2-.4 2.2-1 2.8 2.6.6 6.2.2 7-2.5" />
      <path d="m16.5 2.5 5 5" />
    </svg>
  )
}

export function DrawButton({ place, context, onInsert, onDescribeInstead, className, label, openRef }: DrawButtonProps) {
  const { t } = useT()
  const info = useImageInfo()
  const r = useImageRole()
  const [keyEntry] = useState(wantsKeyEntry)
  const [open, setOpen] = useState<{ subject?: string; key?: boolean } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!openRef) return
    openRef.current = (subject?: string) => setOpen({ subject })
    return () => {
      openRef.current = null
    }
  }, [openRef])

  const close = useCallback(() => {
    setOpen(null)
    // фокус — обратно на кнопку (если она ещё есть)
    window.setTimeout(() => btnRef.current?.focus(), 0)
  }, [])

  const allowed = !!info?.enabled && (r !== 'student' || info.students)
  const visible = allowed || (!!info?.enabled && keyEntry)
  const ready = !!info?.ready
  const title = !ready ? t('learn.assistant.drawPreparing') : place === 'chat' ? t('learn.assistant.draw') : t('lab.draw.title')

  return (
    <>
      {visible ? (
        <button
          ref={btnRef}
          type="button"
          className={className ? `${className} ${s.drawBtn}` : s.drawBtn}
          onClick={() => setOpen(allowed ? {} : { key: true })}
          disabled={!ready}
          aria-haspopup="dialog"
          aria-label={label ? undefined : title}
          title={title}
          data-draw-btn={place}
        >
          <IconBrush />
          {label ? <span className={s.drawBtnLabel}>{label}</span> : null}
        </button>
      ) : null}
      {open ? (
        <Suspense fallback={null}>
          <DrawDialog
            place={place}
            context={context}
            initialSubject={open.subject}
            keyEntry={!!open.key}
            onClose={close}
            onInsert={onInsert}
            onDescribeInstead={onDescribeInstead}
          />
        </Suspense>
      ) : null}
    </>
  )
}

/** Картинка в пузыре ассистента: <img> и поверх — SVG-слой формулы (как в диалоге). */
export function DrawChatImage({ image }: { image: DrawInsert }) {
  return (
    <figure className={s.botImage} data-chat-image="">
      <div className={s.botImageFrame} style={{ aspectRatio: `${image.width} / ${image.height}` }}>
        <img src={image.dataUrl} alt={image.alt} loading="lazy" width={image.width} height={image.height} />
        {image.overlaySvg ? <div className={s.overlay} aria-hidden dangerouslySetInnerHTML={{ __html: image.overlaySvg }} /> : null}
      </div>
    </figure>
  )
}
