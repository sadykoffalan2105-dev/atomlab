import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import type { ReaderReaction } from '../../../data/textbook/bookReader'
import { useT } from '../../../i18n/useT'
import { useDialogFocus } from '../../lab/useDialogFocus'
import { IconBook, IconClose, IconFlask, IconGrid, IconInfo, IconScale, IconSpark } from './BookIcons'
import {
  catalogReactionHref,
  isOrganicLabHref,
  reactionBalanceHref,
  reactionLabel,
  reactionQuickHref,
  reactionTypeKey,
  reasonKey,
  rxAnchorId,
} from './bookUi'
import styles from './LearnBook.module.css'

type ChipProps = {
  rx: ReaderReaction
  index: number
  open: boolean
  flash: boolean
  onOpen: (index: number, anchor: HTMLElement) => void
}

/**
 * Уравнение в тексте учебника: кнопка открывает карточку реакции, иконка колбы — сразу лабораторию
 * (для органики — органическую лабораторию). Задание («KOH + CO₂ → ...») показано как в книге, без колбы.
 */
export function ReactionChip({ rx, index, open, flash, onOpen }: ChipProps) {
  const { t } = useT()
  const quick = reactionQuickHref(rx)
  const label = reactionLabel(rx, t)
  const state = rx.exercise ? 'task' : rx.lab.ok ? 'ok' : quick ? 'alt' : 'off'
  return (
    <span
      id={rxAnchorId(rx.id)}
      className={styles.rxChip}
      data-state={state}
      data-open={open || undefined}
      data-flash={flash || undefined}
      data-rx-id={rx.id}
    >
      <button
        type="button"
        className={styles.rxChipMain}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          rx.exercise
            ? t('learn.book.rx.exerciseChipAria', { text: label })
            : t('learn.book.rx.chipAria', { equation: rx.equation })
        }
        data-rx-toggle={rx.id}
        onClick={(e) => onOpen(index, e.currentTarget.parentElement ?? e.currentTarget)}
      >
        {rx.exercise ? (
          <span className={styles.rxChipTask} aria-hidden>
            ?
          </span>
        ) : null}
        <span className={styles.rxChipEq}>{label}</span>
      </button>
      {quick ? (
        <Link
          className={styles.rxChipLab}
          to={quick}
          aria-label={
            rx.lab.ok
              ? t('learn.book.rx.openLabAria', { equation: rx.equation })
              : t('learn.book.rx.openOrganicAria', { equation: rx.equation })
          }
          title={rx.lab.ok ? t('learn.book.rx.openLab') : t('learn.book.rx.openOrganic')}
          data-rx-lab-link={rx.id}
        >
          <IconFlask />
        </Link>
      ) : null}
    </span>
  )
}

type CardProps = {
  rx: ReaderReaction | null
  /** Класс и параграф — для ссылки «В каталоге реакций» (/catalog?view=reactions&grade=&unit=&rx=). */
  gradeId: string
  unitId: string | null
  anchor: HTMLElement | null
  /** Узкий экран: нижний лист с затемнением; иначе поповер у чипа. */
  sheet: boolean
  contextLabel: string | null
  onClose: () => void
}

/**
 * Карточка реакции: тип, условия, страница, «Открыть в лаборатории», «Уравнять самому», «В каталоге реакций».
 * Задание учебника сначала показывает только текст из книги и «Показать ответ».
 */
export function ReactionCard({ rx, gradeId, unitId, anchor, sheet, contextLabel, onClose }: CardProps) {
  const { t } = useT()
  const titleId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLElement | null>(null)
  const open = rx != null
  /** Реакция, для которой ученик открыл ответ (другая карточка — снова скрыт). */
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const rxId = rx?.id ?? null
  const hidden = !!rx?.exercise && revealedId !== rxId
  const revealed = !!rx?.exercise && revealedId === rxId

  useDialogFocus(open, cardRef, { initialFocus: primaryRef, trap: sheet })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (cardRef.current?.contains(target)) return
      if (anchor?.contains(target)) return
      // повторное нажатие на ту же реакцию (строка списка «В параграфе») закрывает карточку своим click
      const toggle = target instanceof Element ? target.closest('[data-rx-toggle]') : null
      if (toggle && toggle.getAttribute('data-rx-toggle') === rxId) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    if (!sheet) document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open, anchor, sheet, onClose, rxId])

  /*
   * Нижний лист: страница под затемнением не прокручивается.
   * Только <html>: если скрыть overflow и у <body> (высота 100%), body станет своим контейнером прокрутки,
   * документ «сожмётся» до экрана и окно прыгнет к началу параграфа.
   */
  useEffect(() => {
    if (!open || !sheet) return
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prev
    }
  }, [open, sheet])

  /* Ответ открыт — фокус на главное действие карточки (кнопка «Показать ответ» исчезла). */
  useEffect(() => {
    if (revealed) primaryRef.current?.focus()
  }, [revealed])

  /* Поповер: координаты документа (едет вместе со страницей при прокрутке), с поправкой у краёв экрана. */
  useLayoutEffect(() => {
    if (!open || sheet) return
    const card = cardRef.current
    if (!card) return
    const place = () => {
      const vw = document.documentElement.clientWidth
      const vh = window.innerHeight
      const w = card.offsetWidth
      const h = card.offsetHeight
      const r = anchor?.getBoundingClientRect()
      if (!r || (r.width === 0 && r.height === 0)) {
        card.style.left = `${window.scrollX + Math.max(12, (vw - w) / 2)}px`
        card.style.top = `${window.scrollY + Math.max(12, (vh - h) / 2)}px`
        return
      }
      const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), Math.max(12, vw - w - 12))
      const fitsBelow = r.bottom + 10 + h <= vh - 12
      const fitsAbove = r.top - 10 - h >= 12
      const above = !fitsBelow && fitsAbove
      const top = above ? r.top - 10 - h : r.bottom + 10
      card.style.left = `${window.scrollX + left}px`
      card.style.top = `${window.scrollY + top}px`
      card.dataset.side = above ? 'top' : 'bottom'
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, sheet, anchor, rx, hidden])

  if (!rx || typeof document === 'undefined') return null

  const balanceHref = reactionBalanceHref(rx)
  const catalogHref = unitId ? catalogReactionHref(gradeId, unitId, rx.id) : null
  const pageLabel = rx.page != null ? t('learn.book.page', { n: rx.page }) : null
  const setPrimary = (el: HTMLElement | null) => {
    primaryRef.current = el
  }
  const cardClass = sheet ? `${styles.rxCard} ${styles.rxCardSheet}` : `${styles.rxCard} ${styles.rxCardPop}`

  const header = (
    <header className={styles.rxCardHead}>
      <span className={styles.rxCardType}>
        <span className={styles.rxCardDot} aria-hidden />
        {hidden ? t('learn.book.rx.exerciseBadge') : t(reactionTypeKey(rx.type))}
      </span>
      {revealed ? <span className={styles.rxCardTag}>{t('learn.book.rx.exerciseBadge')}</span> : null}
      {!hidden && rx.isIonic ? <span className={styles.rxCardTag}>{t('learn.book.rx.ionicBadge')}</span> : null}
      {!hidden && rx.isGeneralScheme ? <span className={styles.rxCardTag}>{t('learn.book.rx.schemeBadge')}</span> : null}
      <span className={styles.rxCardMeta}>{[contextLabel, pageLabel].filter(Boolean).join(' · ')}</span>
      <button type="button" className={styles.iconBtn} onClick={onClose} aria-label={t('learn.book.close')}>
        <IconClose />
      </button>
    </header>
  )

  const card = hidden ? (
    <div
      ref={cardRef}
      className={cardClass}
      role="dialog"
      aria-modal={sheet ? true : undefined}
      aria-labelledby={titleId}
      tabIndex={-1}
      data-state="task"
      data-book-rx-card={rx.id}
    >
      {sheet ? <span className={styles.sheetGrip} aria-hidden /> : null}
      {header}
      <p id={titleId} className={styles.rxCardEq}>
        {reactionLabel(rx, t)}
      </p>
      <div className={styles.rxCardNotice} data-tone="task" role="note">
        <IconBook />
        <div>
          <p className={styles.rxCardNoticeTitle}>{t('learn.book.rx.exerciseTitle')}</p>
          <p className={styles.rxCardNoticeText}>{t('learn.book.rx.exerciseHint')}</p>
        </div>
      </div>
      <div className={styles.rxCardActions}>
        <button
          ref={setPrimary}
          type="button"
          className={styles.btnPrimary}
          onClick={() => setRevealedId(rx.id)}
          data-book-rx-reveal={rx.id}
        >
          <IconSpark />
          {t('learn.book.rx.showAnswer')}
        </button>
      </div>
    </div>
  ) : (
    <div
      ref={cardRef}
      className={cardClass}
      role="dialog"
      aria-modal={sheet ? true : undefined}
      aria-labelledby={titleId}
      tabIndex={-1}
      data-state={rx.lab.ok ? 'ok' : 'off'}
      data-book-rx-card={rx.id}
    >
      {sheet ? <span className={styles.sheetGrip} aria-hidden /> : null}
      {header}

      {revealed && rx.asInBook ? (
        <p className={styles.rxCardCond}>
          <span className={styles.rxCardCondLabel}>{t('learn.book.rx.asInBook')}</span>
          {rx.asInBook}
        </p>
      ) : null}

      {revealed ? (
        <div className={styles.rxCardAnswer}>
          <span className={styles.rxCardCondLabel}>{t('learn.book.rx.answer')}</span>
          <p id={titleId} className={styles.rxCardEq}>
            {rx.equation}
          </p>
        </div>
      ) : (
        <p id={titleId} className={styles.rxCardEq}>
          {rx.equation}
        </p>
      )}

      {rx.conditions ? (
        <p className={styles.rxCardCond}>
          <span className={styles.rxCardCondLabel}>{t('learn.book.rx.conditions')}</span>
          {rx.conditions}
        </p>
      ) : null}

      {rx.lab.ok ? (
        <>
          <p className={styles.rxCardReady}>
            <IconSpark />
            {t('learn.book.rx.labReady')}
          </p>
          <div className={styles.rxCardActions}>
            <Link ref={setPrimary} className={styles.btnPrimary} to={rx.lab.href} data-book-rx-open-lab={rx.id}>
              <IconFlask />
              {t('learn.book.rx.openLab')}
            </Link>
          </div>
          <div className={styles.rxCardSecondary}>
            {balanceHref ? (
              <Link className={styles.btnGlass} to={balanceHref}>
                <IconScale />
                {t('learn.book.rx.balanceSelf')}
              </Link>
            ) : null}
            {catalogHref ? (
              <Link className={styles.btnGlass} to={catalogHref} data-book-rx-catalog={rx.id}>
                <IconGrid />
                {t('learn.book.rx.inCatalog')}
              </Link>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className={styles.rxCardNotice} role="note">
            <IconInfo />
            <div>
              <p className={styles.rxCardNoticeTitle}>{t('learn.book.rx.unsupportedTitle')}</p>
              <p className={styles.rxCardNoticeText}>{t(reasonKey(rx.lab.reason))}</p>
            </div>
          </div>
          {rx.lab.altHref ? (
            <div className={styles.rxCardActions}>
              <Link ref={setPrimary} className={styles.btnPrimary} to={rx.lab.altHref}>
                <IconFlask />
                {isOrganicLabHref(rx.lab.altHref) ? t('learn.book.rx.openOrganic') : t('learn.book.rx.openAlt')}
              </Link>
            </div>
          ) : null}
        </>
      )}

      {!rx.lab.ok && catalogHref ? (
        <Link className={styles.rxCardCatalog} to={catalogHref} data-book-rx-catalog={rx.id}>
          <IconGrid />
          {t('learn.book.rx.inCatalog')}
        </Link>
      ) : null}
    </div>
  )

  return createPortal(
    sheet ? (
      <div className={styles.sheetBackdrop} role="presentation" onClick={onClose}>
        <div className={styles.sheetHost} onClick={(e) => e.stopPropagation()}>
          {card}
        </div>
      </div>
    ) : (
      card
    ),
    document.body,
  )
}
