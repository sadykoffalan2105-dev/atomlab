import { memo } from 'react'
import { Stars } from '@react-three/drei'

/** Единый фон реактора / синтеза — без скачка при смене фаз. */
export const LAB_COSMIC_BG = '#0a0c18'

/**
 * Фон реактора: звёздное небо.
 * memo + без fade — при hitch +/- кадры не «съедают» звёзды в сплошной синий clear.
 * settled / lowPower — меньше Stars (слабые ПК + чистый кадр продукта).
 */
export const LabSynthesisCosmicBackdrop = memo(function LabSynthesisCosmicBackdrop({
  lite = false,
}: {
  lite?: boolean
}) {
  const count = lite ? 140 : 480
  return (
    <>
      <color attach="background" args={[LAB_COSMIC_BG]} />
      <Stars
        radius={120}
        depth={70}
        count={count}
        factor={lite ? 2.4 : 3.2}
        saturation={0.12}
        fade={false}
        speed={lite ? 0.2 : 0.35}
      />
    </>
  )
})
