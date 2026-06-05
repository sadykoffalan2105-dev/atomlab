import hsStyles from './CyberHotspot.module.css'

export function CyberHotspot({
  id,
  cx,
  cy,
  r,
  active,
  onFocus,
}: {
  id: string
  cx: number
  cy: number
  r: number
  active: boolean
  onFocus: (id: string) => void
}) {
  return (
    <g
      className={`${hsStyles.group} ${active ? hsStyles.groupActive : ''}`}
      role="button"
      tabIndex={0}
      aria-label={id}
      onClick={(e) => {
        e.stopPropagation()
        onFocus(id)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onFocus(id)
        }
      }}
    >
      <circle className={hsStyles.hit} cx={cx} cy={cy} r={r} />
      <circle className={hsStyles.ring} cx={cx} cy={cy} r={r + 4} />
      {active ? <circle className={hsStyles.pulse} cx={cx} cy={cy} r={r + 2} /> : null}
    </g>
  )
}
