import { Fragment } from 'react'
import { getElementByZ } from '../../data/elements'
import { countFilledReactorSlots, type ReactorSlot } from '../../chemistry/reactorSlots'
import panelStyles from './SynthesisReactorPanel.module.css'

function slotLabel(z: number | null | undefined): string {
  if (z == null) return '—'
  const e = getElementByZ(z)
  return e ? e.symbol : '—'
}

export function SynthesisReactorPanel({
  open,
  slots,
  onSlotTap,
  onClearSlots,
  onRequestRun,
  message,
  dimInCatalogHeroView = false,
}: {
  open: boolean
  slots: readonly ReactorSlot[]
  onSlotTap?: (index: number) => void
  onClearSlots: () => void
  onRequestRun: () => void
  message: string | null
  dimInCatalogHeroView?: boolean
}) {
  const canRun = countFilledReactorSlots(slots) >= 2
  const filledSlots = slots.filter((s): s is Exclude<ReactorSlot, null> => s != null)

  return (
    <div
      className={dimInCatalogHeroView ? `${panelStyles.reactor} ${panelStyles.reactorDimHero}` : panelStyles.reactor}
      data-open={open}
      data-dim-hero={dimInCatalogHeroView && open}
      role="region"
      aria-label="Реактор синтеза"
    >
      <div className={panelStyles.reactorHead}>
        <span className={panelStyles.reactorTitle}>Реактор</span>
        <div className={panelStyles.reactorActions}>
          <button type="button" className={panelStyles.reactorBtnSecondary} onClick={onClearSlots}>
            Сбросить слоты
          </button>
        </div>
      </div>
      <div className={panelStyles.slotsRow} aria-label="Набор атомов слева направо, до 4">
        {filledSlots.length === 0 ? (
          <div className={panelStyles.slotsEmpty} role="note">
            Выберите элементы из таблицы — ячейки появятся здесь
          </div>
        ) : null}
        {filledSlots.map((s, i) => (
          <Fragment key={`${s.z}-${i}`}>
            {i > 0 ? (
              <span className={panelStyles.slotJoin} aria-hidden>
                +
              </span>
            ) : null}
            <button
              type="button"
              className={panelStyles.slot}
              onClick={() => onSlotTap?.(i)}
              aria-label={`Слот ${i + 1}: ${slotLabel(s.z)}${s.count > 1 ? `, количество ${s.count}` : ''}. Нажмите чтобы уменьшить`}
            >
              <span className={panelStyles.slotLabel}>{i + 1}</span>
              <span className={panelStyles.slotSym}>
                {slotLabel(s.z)}
                {s.count > 1 ? <span className={panelStyles.slotCount}>{s.count}</span> : null}
              </span>
            </button>
          </Fragment>
        ))}
      </div>
      <div className={panelStyles.canvasBox}>
        <div className={panelStyles.canvasPlaceholder} role="note">
          Выберите 2–4 атома (повторный выбор увеличивает счётчик, например H₂O: H×2 и O×1), затем нажмите «Запустить синтез».
        </div>
      </div>
      <div className={panelStyles.reactorFooter}>
        <button
          type="button"
          className={panelStyles.reactorBtnPrimary}
          onClick={onRequestRun}
          disabled={!canRun}
        >
          Запустить синтез
        </button>
        {message ? (
          <p className={panelStyles.reactorMsg} role="status">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  )
}
