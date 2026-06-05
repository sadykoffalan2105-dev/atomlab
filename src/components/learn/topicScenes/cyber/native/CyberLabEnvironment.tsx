import envStyles from './CyberLabEnvironment.module.css'

export function CyberLabEnvironment() {
  return (
    <div className={envStyles.wrap} aria-hidden>
      <div className={envStyles.depth} />
      <div className={envStyles.wires}>
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className={envStyles.wire} style={{ ['--wi' as string]: i }} />
        ))}
      </div>
      <div className={envStyles.racks}>
        <span className={envStyles.rack} />
        <span className={envStyles.rack} />
      </div>
      <div className={envStyles.cityGlow} />
      <div className={envStyles.floor} />
      <div className={envStyles.floorReflect} />
      <div className={envStyles.vignette} />
      <div className={envStyles.scan} />
    </div>
  )
}
