import { memo } from 'react'
import { Stars } from '@react-three/drei'

/** Спокойная сине-фиолетовая пустота idle-лаборатории. */
export const LAB_IDLE_COSMIC_BG = '#07061a'

/**
 * Фон лаборатории: чистая пустота + движущиеся звёзды.
 * Без туманностей, колец и пыли — чтобы не спорили с атомом.
 */
export const LabIdleCosmicBackdrop = memo(function LabIdleCosmicBackdrop({
  lite = false,
}: {
  lite?: boolean
}) {
  return (
    <>
      <color attach="background" args={[LAB_IDLE_COSMIC_BG]} />
      <fog attach="fog" args={[LAB_IDLE_COSMIC_BG, 18, 42]} />
      <Stars
        radius={140}
        depth={80}
        count={lite ? 500 : 900}
        factor={lite ? 2.6 : 3.2}
        saturation={0.28}
        fade={false}
        speed={lite ? 0.35 : 0.55}
      />
      {!lite ? (
        <Stars radius={70} depth={36} count={160} factor={4.2} saturation={0.2} fade={false} speed={0.22} />
      ) : null}
    </>
  )
})
