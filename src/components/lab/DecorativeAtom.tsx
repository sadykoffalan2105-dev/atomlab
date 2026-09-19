import { CpkAtomModel } from './atom/CpkAtomModel'

/**
 * Декоративный атом свободной лаборатории — кислород в языке CPK-сфер
 * реактора: красный шар (вдв 152 пм), электронное облако, ореол и подпись «O».
 * Масштаб крупный: в свободной сцене атом один и держит центр кадра.
 */
export function DecorativeAtom() {
  return (
    <group scale={3.4}>
      <CpkAtomModel z={8} animate frameSkip={1} />
    </group>
  )
}
