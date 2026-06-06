import { Stars } from '@react-three/drei'

/** Единый фон реактора / синтеза — без скачка при смене фаз. */
export const LAB_COSMIC_BG = '#0a0c18'

/**
 * Фон реактора: только звёздное небо (без туманностей, колец и sparkles).
 * Один и тот же слой на idle, синтез и settled — без мигания.
 */
export function LabSynthesisCosmicBackdrop() {
  return (
    <>
      <color attach="background" args={[LAB_COSMIC_BG]} />
      <Stars
        radius={120}
        depth={70}
        count={900}
        factor={3.2}
        saturation={0.12}
        fade
        speed={0.45}
      />
    </>
  )
}
