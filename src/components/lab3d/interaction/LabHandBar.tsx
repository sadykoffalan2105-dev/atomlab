/**
 * Интерфейс «руки» поверх сцены: подсказка «Нажмите на склянку, чтобы взять» (до первого взятия),
 * слот «В руке: …» с кнопками «Положить на место» и «Поставить на рабочее место».
 */
import type { LabLang } from '../labContract'
import { useT } from '../../../i18n/useT'
import { LAB_ITEM_BY_ID } from './labItems'
import { labHand, useHand } from './labHandStore'
import { labExtinguisher, useExtinguisher } from './LabExtinguisher'
import css from './LabHandBar.module.css'

export function LabHandBar({ lang, leftInsetPx = 0 }: { lang: LabLang; leftInsetPx?: number }) {
  const { t } = useT()
  const hand = useHand()
  const ext = useExtinguisher()
  const held = hand.held ? LAB_ITEM_BY_ID.get(hand.held) : undefined
  if ((!held && hand.pickedOnce) || ext.mode === 'hand') return null
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

/**
 * Огнетушитель в руке: «Выдернуть чеку», «Нажать рычаг» (удерживать — струя), «Повесить на место», остаток заряда.
 */
export function LabExtinguisherBar({ leftInsetPx = 0 }: { leftInsetPx?: number }) {
  const { t } = useT()
  const ext = useExtinguisher()
  if (ext.mode !== 'hand') return null
  const press = (on: boolean) => (e: React.PointerEvent) => {
    e.preventDefault()
    labExtinguisher.spray(on)
  }
  return (
    <div className={css.wrap} style={{ left: leftInsetPx }}>
      <div className={css.bar} role="group" aria-label={t('lab3d.safety.extAria')}>
        <span className={css.what}>
          <span className={css.icon} aria-hidden>
            🧯
          </span>
          <span className={css.label}>
            {t('lab3d.safety.extInHand', { n: Math.round(ext.charge * 100) })}
            {ext.fires > 0 && <b className={css.fire}> {t('lab3d.safety.extFire')}</b>}
          </span>
        </span>
        <span className={css.btns}>
          <button type="button" className={css.btn} onClick={() => labExtinguisher.hang()}>
            {t('lab3d.safety.extHang')}
          </button>
          {!ext.pinOut ? (
            <button type="button" className={css.btnPrimary} onClick={() => labExtinguisher.pullPin()}>
              {t('lab3d.safety.extPin')}
            </button>
          ) : (
            <button
              type="button"
              className={ext.spraying ? `${css.btnPrimary} ${css.pressed}` : css.btnPrimary}
              disabled={ext.charge <= 0}
              aria-pressed={ext.spraying}
              onPointerDown={press(true)}
              onPointerUp={press(false)}
              onPointerCancel={press(false)}
              onPointerLeave={press(false)}
              onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && labExtinguisher.spray(true)}
              onKeyUp={() => labExtinguisher.spray(false)}
              style={{ touchAction: 'none' }}
            >
              {ext.charge <= 0 ? t('lab3d.safety.extEmpty') : t('lab3d.safety.extSpray')}
            </button>
          )}
        </span>
      </div>
    </div>
  )
}
