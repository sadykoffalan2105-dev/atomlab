import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { resolveBohrReactVisible } from '../../lab/coeffEditAtomPin'
import { buildReactorParticles } from '../../lab/reactorParticles'
import { resolvePreviewExternalAtomControl } from '../../lab/synthesisPreviewEngine/previewExternalControl'
import { ReactorParticleField } from './ReactorParticleField'
import { PREVIEW_ATOM_SCALE } from './reactorPreviewLayout'

/** Собственный свет превью (когда нет sharedLighting) — базовые интенсивности. */
const OWN_LIGHT = { ambient: 0.28, directional: 0.65, point: 0.9 } as const

/**
 * Превью реагентов на этапе балансировки: «частица = формульная единица».
 *
 * Раньше здесь рисовался слой «один шар на единицу коэффициента» и поверх него —
 * оверлей молекулы; четыре императивных сторожа каждый кадр включали скрытый слот,
 * и у Cl₂ появлялся третий, призрачный атом. Теперь атомы рисует только
 * ReactorParticleField (настоящие молекулы, фрагменты решёток, формульные единицы),
 * а слот-группы atomGroupRefs остались ПУСТЫМИ якорями полёта: внешние pin/guard
 * могут включать им visible сколько угодно — в них нечего показывать.
 *
 * Контракт с LabScene/SynthesisConvergeStreams: atomGroupRefs[i] — i-я формульная
 * единица (порядок членов уравнения, затем экземпляры), atomScaleGroupRefs[i] — её
 * масштабная группа; до запуска слоты стоят в центрах частиц.
 */
export function ReactorTermsPreview({
  terms,
  visible = true,
  flightActive = false,
  poseLocked = false,
  sharedLighting = false,
  forceLite = false,
  coeffEditBurst = false,
  coeffEditing = coeffEditBurst,
  previewOnlyMode = false,
  synthHoldPreview = false,
  lowPower = false,
  productOwnsScreen: productOwnsScreenProp,
  atomGroupRefs: atomGroupRefsExternal,
  atomScaleGroupRefs: atomScaleGroupRefsExternal,
  previewRootRef,
  interactive = true,
}: {
  terms: readonly ReactorEquationTerm[]
  visible?: boolean
  flightActive?: boolean
  poseLocked?: boolean
  sharedLighting?: boolean
  forceLite?: boolean
  qualityLevel?: import('../../lab/synthesisQualityLadder').SynthesisQualityLevel
  synthesisGlass?: boolean
  coeffEditBurst?: boolean
  coeffEditing?: boolean
  previewOnlyMode?: boolean
  synthHoldPreview?: boolean
  productPrewarm?: boolean
  lowPower?: boolean
  frameBudgetLite?: boolean
  /** Явный сигнал LabScene: молекула владеет экраном — превью гасим. */
  productOwnsScreen?: boolean
  atomGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  atomScaleGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  previewRootRef?: MutableRefObject<THREE.Group | null>
  /** Наведение/касание на атом — карточка валентного слоя (по умолчанию включено). */
  interactive?: boolean
}) {
  const termsSig = terms.map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}:${t.compoundId ?? ''}`).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- набор частиц зависит только от подписи членов
  const particleSet = useMemo(() => buildReactorParticles(terms), [termsSig])

  /** Слотов столько же, сколько формульных единиц (LabScene считает так же: сумма коэффициентов). */
  const slotCount = useMemo(() => terms.reduce((s, t) => s + Math.max(0, Math.floor(t.coeff)), 0), [terms])
  /** Якорей ровно по числу формульных единиц: они пустые, ± их (до)монтирует без визуального следа. */
  const mountCount = slotCount

  const groupRef = useRef<THREE.Group>(null)
  const lightRigRef = useRef<THREE.Group>(null)
  const atomGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomScaleGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomGroupRefs = atomGroupRefsExternal ?? atomGroupRefsLocal
  const atomScaleGroupRefs = atomScaleGroupRefsExternal ?? atomScaleGroupRefsLocal

  const hasActiveTerms = slotCount > 0
  const holdAtoms = previewOnlyMode || coeffEditing || synthHoldPreview
  const productOwnsScreen = productOwnsScreenProp === true || (!holdAtoms && !visible)
  const reactGroupVisible =
    resolveBohrReactVisible({
      visible: Boolean(visible),
      previewOnlyMode,
      coeffEditing,
      synthHoldPreview,
      atomsOnScreen: hasActiveTerms,
      hasActiveTerms,
      stickySlotCount: slotCount,
      productOwnsScreen,
    }) && !productOwnsScreen

  /** Полёт синтеза: слоты двигает GSAP, частицы следуют за ними. */
  const externalAtomControl = resolvePreviewExternalAtomControl({
    flightActive,
    poseLocked,
    previewOnlyMode,
    synthHoldPreview,
  })
  const syncSlots = !externalAtomControl && !synthHoldPreview && !poseLocked

  useLayoutEffect(() => {
    if (previewRootRef) previewRootRef.current = groupRef.current
  }, [previewRootRef])

  useLayoutEffect(() => {
    const g = groupRef.current
    if (!g) return
    g.visible = reactGroupVisible
  }, [reactGroupVisible])

  /** Свет копирует позу корня превью (постоянный набор источников — без перекомпиляции). */
  useFrame(() => {
    const rig = lightRigRef.current
    const root = groupRef.current
    if (!rig || !root) return
    rig.position.copy(root.position)
    rig.quaternion.copy(root.quaternion)
    rig.scale.copy(root.scale)
  })

  const ownLightK = reactGroupVisible ? 1 : 0
  const labelsAllowed = reactGroupVisible && syncSlots && !flightActive

  return (
    <>
      {!sharedLighting ? (
        <group ref={lightRigRef}>
          <ambientLight intensity={OWN_LIGHT.ambient * ownLightK} />
          <directionalLight position={[4, 6, 2]} intensity={OWN_LIGHT.directional * ownLightK} color="#b8c8ff" />
          <pointLight position={[0, 0.5, 2.5]} intensity={OWN_LIGHT.point * ownLightK} distance={12} color="#7afcff" />
        </group>
      ) : null}
      <group ref={groupRef} visible={reactGroupVisible} frustumCulled={false}>
        {/* Якоря полёта: пустые группы, без геометрии (см. комментарий компонента). */}
        {Array.from({ length: mountCount }, (_, i) => (
          <group
            key={`slot-${i}`}
            ref={(el) => {
              atomGroupRefs.current[i] = el
            }}
          >
            <group
              ref={(el) => {
                atomScaleGroupRefs.current[i] = el
              }}
              scale={PREVIEW_ATOM_SCALE}
            />
          </group>
        ))}
        <ReactorParticleField
          set={particleSet}
          visible={reactGroupVisible && hasActiveTerms}
          lowPower={lowPower || forceLite}
          syncSlots={syncSlots}
          atomGroupRefs={atomGroupRefs}
          atomScaleGroupRefs={atomScaleGroupRefs}
          showLabels={labelsAllowed}
          interactive={interactive && labelsAllowed}
        />
      </group>
    </>
  )
}
