import { schoolValencyRoman, valencyBondDots } from '../../data/elementValencySchool'
import { useT } from '../../i18n/useT'
import panelStyles from './SynthesisReactorPanel.module.css'

export function ReagentValencyInteract({
  termId,
  z,
  symbol,
  activeBonds,
  onChange,
}: {
  termId: string
  z: number
  symbol: string
  activeBonds: number
  onChange: (termId: string, bonds: number) => void
}) {
  const { t } = useT()
  const roman = schoolValencyRoman(z)
  const dots = valencyBondDots(z)

  if (!roman && dots === 0) return null

  const complete = activeBonds >= dots

  return (
    <div
      className={`${panelStyles.valencyStrip} ${complete ? panelStyles.valencyStripComplete : ''}`}
      title={t('reactor.valencyHint', { symbol, valency: roman ?? '—' })}
    >
      {roman ? <span className={panelStyles.valencyRoman}>{roman}</span> : null}
      <span className={panelStyles.valencyBonds} role="group" aria-label={t('reactor.valencyBondsAria', { symbol })}>
        {Array.from({ length: dots }, (_, i) => {
          const on = i < activeBonds
          return (
            <button
              key={`${termId}-bond-${i}`}
              type="button"
              className={`${panelStyles.valencyDotBtn} ${on ? panelStyles.valencyDotBtnOn : ''}`}
              aria-pressed={on}
              aria-label={t('reactor.valencyBondToggle', { symbol, index: i + 1, total: dots })}
              onClick={(e) => {
                e.stopPropagation()
                if (on) onChange(termId, i)
                else if (i === activeBonds) onChange(termId, activeBonds + 1)
              }}
            />
          )
        })}
      </span>
    </div>
  )
}
