import { useLayoutEffect, useMemo, type MutableRefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type * as THREE from 'three'
import { formationPlan } from '../../../chemistry/formationPlan'
import { CanvasErrorBoundary } from '../../common/CanvasErrorBoundary'
import { CanvasSceneErrorFallback } from '../../common/CanvasSceneErrorFallback'
import { SCHOOL_CATALOG_BG } from '../hero/SchoolCatalogCanvas'
import { buildSchoolHeroModel, type CatalogShape } from '../hero/schoolHeroModel'
import { FormationMoleculeView } from './FormationMoleculeView'
import type { FormationClock } from './formationTimeline'

/** Доля меньшей стороны кадра под описанную сферу — как у SchoolCatalogCanvas. */
const FILL = 0.86
const FOV = 38

function FitCamera() {
  const get = useThree((s) => s.get)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  useLayoutEffect(() => {
    const camera = get().camera as THREE.PerspectiveCamera
    const aspect = size.width / Math.max(1, size.height)
    const tanH = Math.tan((camera.fov * Math.PI) / 360)
    const dist = 1 / (FILL * tanH * Math.min(1, aspect))
    const len = camera.position.length()
    if (len > 1e-6) camera.position.multiplyScalar(dist / len)
    else camera.position.set(0, 0, dist)
    camera.near = Math.max(0.01, dist - 3)
    camera.far = dist + 6
    camera.updateProjectionMatrix()
    invalidate()
  }, [get, size.width, size.height, invalidate])
  return null
}

/** 3D «Как образуется» в карточке каталога (вместо обычного вида, пока идёт показ). */
export function FormationCanvas({ shape, clock, lowPower }: { shape: CatalogShape; clock: MutableRefObject<FormationClock>; lowPower: boolean }) {
  const model = useMemo(() => buildSchoolHeroModel(shape), [shape])
  const plan = useMemo(() => formationPlan(shape.id), [shape.id])
  if (!model || !plan) return null
  return (
    <CanvasErrorBoundary fallback={<CanvasSceneErrorFallback />} resetKey={`formation-${shape.id}`}>
      <Canvas
        camera={{ position: [0, 0, 4], fov: FOV }}
        gl={{ antialias: !lowPower, alpha: false, powerPreference: lowPower ? 'default' : 'high-performance' }}
        dpr={lowPower ? [1, 1.25] : [1, 1.75]}
        frameloop="always"
        data-formation-3d={plan.mode}
      >
        <color attach="background" args={[SCHOOL_CATALOG_BG]} />
        <FitCamera />
        {/* Кристалл на экране меньше описанной сферы — как в SchoolCatalogCanvas. */}
        <FormationMoleculeView model={model} plan={plan} clock={clock} fitRadius={model.kind === 'crystal' ? 1.1 : 1} lowPower={lowPower} />
        <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.6} />
      </Canvas>
    </CanvasErrorBoundary>
  )
}
