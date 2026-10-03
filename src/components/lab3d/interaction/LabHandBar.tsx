/**
 * Интерфейс «руки» поверх сцены: подсказка «Нажмите на склянку, чтобы взять» (до первого взятия),
 * слот «В руке: …» с кнопками «Положить на место» и «Поставить на рабочее место».
 */
import type { LabLang } from '../labContract'
import { useT } from '../../../i18n/useT'
import { LAB_ITEM_BY_ID } from './labItems'
import { labHand, useHand } from './labHandStore'
import css from './LabHandBar.module.css'

export function LabHandBar({ lang, leftInsetPx = 0 }: { lang: LabLang; leftInsetPx?: number }) {
  const { t } = useT()
  const hand = useHand()
  const held = hand.held ? LAB_ITEM_BY_ID.get(hand.held) : undefined
  if (!held && hand.pickedOnce) return null
  return (
    <div className={css.wrap} style={{ left: leftInsetPx }}>
      {held ? (
        <div className={css.bar} role="group" aria-label={t('lab3d.grab.handAria')}>
          <span className={css.what}>
            <span className={css.icon} aria-hidden>
              ✋
            </span>
            <span className={css.label}>{t('lab3d.grab.inHand', { name: held.name[lang] })}</span>
          </span>
          <span className={css.btns}>
            <button type="button" className={css.btn} onClick={() => labHand.putBack()}>
              {t('lab3d.grab.putBack')}
            </button>
            <button type="button" className={css.btnPrimary} onClick={() => labHand.place('work')}>
              {t('lab3d.grab.toWork')}
            </button>
          </span>
        </div>
      ) : (
        <div className={css.tip} role="note">
          {t('lab3d.grab.hint')}
        </div>
      )}
    </div>
  )
}
