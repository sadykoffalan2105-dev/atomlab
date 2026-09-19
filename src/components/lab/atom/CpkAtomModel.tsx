import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import {
  getAtomCpkMaterial,
  getNucleusGlowMaterial,
  getSharedSphereGeometry,
} from '../preview/previewSharedResources'
import { getCpkCloudMaterial, getCpkLabelMaterial } from './cpkAtomResources'
import {
  cpkBreathPhase,
  cpkBreathScale,
  cpkCloudRadius,
  cpkHaloSize,
  cpkLabelOffsetY,
  cpkLabelSize,
  cpkSpecies,
} from './cpkAtomVisual'

/**
 * CPK-сфера реагента в реакторе — тот же визуальный язык, что в кино-сценах:
 * шар в цвете CPK, радиус — настоящий ван-дер-ваальсов (для иона — Шеннона),
 * мягкое электронное облако по силуэту, аддитивный ореол, подпись символом
 * (с надстрочным зарядом у ионов) и медленное «дыхание».
 *
 * Bohr-модель (ядро с протонами/нейтронами и оболочками) осталась там, где она
 * учит строению: карточка элемента таблицы Менделеева, модалка элемента,
 * свободная сцена при выборе элемента — см. AtomStructureModel.
 *
 * Производительность: геометрия — ОДНА единичная сфера на всех (радиус задаёт
 * scale меша), материалы — module-level кэш по цвету, текстура подписи — одна
 * на (символ, заряд). Двенадцать атомов кислорода в K₂Cr₂O₇ делят один материал
 * и одну текстуру, шейдерная программа у всех общая → +/- коэффициента не
 * компилирует ничего заново.
 */

/** Единичная сфера: радиус задаётся scale, чтобы геометрия была общей. */
const SPHERE_SEGMENTS_FULL = { w: 28, h: 20 } as const
const SPHERE_SEGMENTS_LITE = { w: 16, h: 12 } as const

export type CpkAtomModelProps = {
  /** Атомный номер. */
  z: number
  /** Заряд частицы: 0 — атом, ±n — ион (радиус Шеннона + бейдж). */
  charge?: number
  /** Дыхание сферы и пульс ореола. */
  animate?: boolean
  /** Полностью статичный кадр (полёт атомов, «продукт владеет экраном»). */
  previewStatic?: boolean
  /** Дешёвые материалы: меньше сегментов, без электронного облака. */
  lite?: boolean
  /** Подпись символом элемента. */
  showLabel?: boolean
  /** Пропуск кадров анимации — тот же бюджет, что у электронов Bohr. */
  frameSkip?: number
  /** Индекс слота — разводит фазы дыхания, чтобы кластер не пульсировал разом. */
  slotIndex?: number
}

function CpkAtomModelInner({
  z,
  charge = 0,
  animate = true,
  previewStatic = false,
  lite = false,
  showLabel = true,
  frameSkip = 1,
  slotIndex = 0,
}: CpkAtomModelProps) {
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
  const cloudMaterial = useMemo(
    () => getCpkCloudMaterial(species.colorHex, 0.16),
    [species.colorHex],
  )
  const haloMaterial = useMemo(
    () => getNucleusGlowMaterial(species.colorHex, lite ? 0.2 : 0.3),
    [species.colorHex, lite],
  )
  const labelMaterial = useMemo(
    () => getCpkLabelMaterial(species.symbol, species.chargeLabel, species.colorHex),
    [species.symbol, species.chargeLabel, species.colorHex],
  )

  const radius = species.radius
  const haloSize = cpkHaloSize(radius)
  const labelSize = cpkLabelSize(radius)
  const labelY = cpkLabelOffsetY(radius)
  const phase = useMemo(() => cpkBreathPhase(z, slotIndex), [z, slotIndex])

  const rootRef = useRef<THREE.Group>(null)
  const breathRef = useRef<THREE.Group>(null)
  const haloRef = useRef<THREE.Sprite>(null)
  const tickRef = useRef(0)

  useFrame((s) => {
    if (previewStatic || !animate) return
    const root = rootRef.current
    if (!root) return
    // Скрытые слоты пула не дышат — тот же закон, что у электронов Bohr.
    if (!root.visible) return
    let parent: THREE.Object3D | null = root.parent
    while (parent) {
      if (!parent.visible) return
      parent = parent.parent
    }
    tickRef.current += 1
    const skip = Math.max(1, Math.floor(frameSkip))
    if (tickRef.current % skip !== 0) return

    const t = s.clock.elapsedTime
    const k = cpkBreathScale(t, phase)
    const breath = breathRef.current
    if (breath) breath.scale.setScalar(k)
    // Ореол пульсирует масштабом, а НЕ opacity: материал общий для всех атомов
    // этого цвета, мутировать его нельзя.
    const halo = haloRef.current
    if (halo) {
      const hk = haloSize * (1 + (k - 1) * 1.8)
      halo.scale.set(hk, hk, 1)
    }
  })

  return (
    <group ref={rootRef}>
      <group ref={breathRef}>
        <mesh
          geometry={sphereGeometry}
          material={sphereMaterial}
          scale={radius}
          frustumCulled={false}
          renderOrder={4}
        />
        {!lite ? (
          <mesh
            geometry={sphereGeometry}
            material={cloudMaterial}
            scale={cpkCloudRadius(radius)}
            frustumCulled={false}
            renderOrder={5}
          />
        ) : null}
      </group>
      <sprite
        ref={haloRef}
        material={haloMaterial}
        scale={haloSize}
        renderOrder={3}
        frustumCulled={false}
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
