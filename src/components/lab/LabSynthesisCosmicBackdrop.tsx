import { memo } from 'react'
import { Stars } from '@react-three/drei'

/** Единый фон реактора / синтеза — без скачка при смене фаз. */
export const LAB_COSMIC_BG = '#0a0c18'

/**
 * Фон реактора: звёздное небо.
 * memo + без fade — при hitch +/- кадры не «съедают» звёзды в сплошной синий clear.
 */
export const LabSynthesisCosmicBackdrop = memo(function LabSynthesisCosmicBackdrop() {
  return (
    <>
      <color attach="background" args={[LAB_COSMIC_BG]} />
      <Stars
        radius={120}
        depth={70}
        count={900}
        factor={3.2}
        saturation={0.12}
        fade={false}
        speed={0.35}
      />
    </>
  )
})
