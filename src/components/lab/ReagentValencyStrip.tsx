import { schoolValencyRoman, valencyBondDots } from '../../data/elementValencySchool'
import { useT } from '../../i18n/useT'
import panelStyles from './SynthesisReactorPanel.module.css'

export function ReagentValencyStrip({ z, symbol }: { z: number; symbol: string }) {
  const { t } = useT()
  const roman = schoolValencyRoman(z)
  const dots = valencyBondDots(z)

  if (!roman && dots === 0) return null

  return (
    <div className={panelStyles.valencyStrip} title={t('reactor.valencyHint', { symbol, valency: roman ?? '—' })}>
      {roman ? <span className={panelStyles.valencyRoman}>{roman}</span> : null}
      <span className={panelStyles.valencyBonds} aria-hidden>
        {Array.from({ length: dots }, (_, i) => (
          <span key={i} className={panelStyles.valencyDot} />
        ))}
      </span>
    </div>
  )
}
