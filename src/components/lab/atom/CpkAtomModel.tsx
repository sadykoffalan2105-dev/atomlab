import { memo, useMemo } from 'react'
import {
  getAtomCpkMaterial,
  getSharedSphereGeometry,
} from '../preview/previewSharedResources'
import { getCpkLabelMaterial } from './cpkAtomResources'
import { cpkLabelOffsetY, cpkLabelSize, cpkSpecies } from './cpkAtomVisual'

/**
 * CPK-сфера атома — цвет CPK и честный радиус (для иона — Шеннона), подпись
 * символом (с надстрочным зарядом у ионов).
 *
 * «Дыхание» радиуса, неподписанный аддитивный ореол и электронное облако убраны
 * (документ OPUS-3D-FORMATION-11: радиус меняется только в момент перехода электрона,
 * в кадре нет неподписанных объектов). Реактор на этапе балансировки эту модель
 * больше не использует — там ReactorParticleField на InstancedAtoms; здесь она
 * осталась для сцен входа и старого пути синтеза.
 *
 * Производительность: геометрия — одна единичная сфера на всех (радиус задаёт
 * scale меша), материалы — module-level кэш по цвету, текстура подписи — одна
 * на (символ, заряд).
 */

/** Единичная сфера: радиус задаётся scale, чтобы геометрия была общей. */
const SPHERE_SEGMENTS_FULL = { w: 28, h: 20 } as const
const SPHERE_SEGMENTS_LITE = { w: 16, h: 12 } as const

export type CpkAtomModelProps = {
  /** Атомный номер. */
  z: number
  /** Заряд частицы: 0 — атом, ±n — ион (радиус Шеннона + бейдж). */
  charge?: number
  /** Устарело: дыхания больше нет; проп оставлен для совместимости вызовов. */
  animate?: boolean
  /** Устарело: модель всегда статична. */
  previewStatic?: boolean
  /** Дешёвые материалы: меньше сегментов. */
  lite?: boolean
  /** Подпись символом элемента. */
  showLabel?: boolean
  /** Устарело: анимации нет. */
  frameSkip?: number
  /** Устарело: фазы дыхания больше нет. */
  slotIndex?: number
}

function CpkAtomModelInner({ z, charge = 0, lite = false, showLabel = true }: CpkAtomModelProps) {
  const species = useMemo(() => cpkSpecies(z, charge), [z, charge])
  const segments = lite ? SPHERE_SEGMENTS_LITE : SPHERE_SEGMENTS_FULL

  const sphereGeometry = useMemo(
    () => getSharedSphereGeometry(1, segments.w, segments.h),
    [segments.w, segments.h],
  )
  const sphereMaterial = useMemo(
    () => getAtomCpkMaterial(species.colorHex, lite ? 0.26 : 0.4, false),
    [species.colorHex, lite],
  )
  const labelMaterial = useMemo(
    () => getCpkLabelMaterial(species.symbol, species.chargeLabel, species.colorHex),
    [species.symbol, species.chargeLabel, species.colorHex],
  )

  const radius = species.radius
  const labelSize = cpkLabelSize(radius)
  const labelY = cpkLabelOffsetY(radius)

  return (
    <group>
      <mesh
        geometry={sphereGeometry}
        material={sphereMaterial}
        scale={radius}
        frustumCulled={false}
        renderOrder={4}
      />
      {showLabel ? (
        <sprite
          material={labelMaterial}
          position={[0, labelY, 0]}
          scale={labelSize}
          renderOrder={7}
          frustumCulled={false}
        />
      ) : null}
    </group>
  )
}

export const CpkAtomModel = memo(CpkAtomModelInner)
