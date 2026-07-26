import { memo } from 'react'
import { Stars } from '@react-three/drei'

/** Единый фон реактора / синтеза — без скачка при смене фаз. */
export const LAB_COSMIC_BG = '#0a0818'

/**
 * Фон реактора: звёздное небо.
 * memo + без fade — при hitch +/- кадры не «съедают» звёзды в сплошной синий clear.
 * settled / lowPower / collapse — меньше Stars (GPU рядом с искрами).
 */
export const LabSynthesisCosmicBackdrop = memo(function LabSynthesisCosmicBackdrop({
  lite = false,
  frozen = false,
  collapseActive = false,
}: {
  lite?: boolean
  /** Синтез / collapse — не крутить Stars (лишний GPU рядом с искрами). */
  frozen?: boolean
  /** Пик collapse: ещё меньше точек (декор не читается за FX). */
  collapseActive?: boolean
}) {
  const count = collapseActive ? 48 : lite ? 110 : 480
  return (
    <>
      <color attach="background" args={[LAB_COSMIC_BG]} />
      <Stars
        radius={120}
        depth={70}
        count={count}
        factor={collapseActive ? 1.8 : lite ? 2.4 : 3.2}
        saturation={0.22}
        fade={false}
        speed={frozen || collapseActive ? 0 : lite ? 0.18 : 0.28}
      />
    </>
  )
})
