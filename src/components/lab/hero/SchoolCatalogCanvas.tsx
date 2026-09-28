import { useLayoutEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type * as THREE from 'three'
import { CanvasErrorBoundary } from '../../common/CanvasErrorBoundary'
import { CanvasSceneErrorFallback } from '../../common/CanvasSceneErrorFallback'
import { buildSchoolHeroModel, type CatalogShape } from './schoolHeroModel'
import { SchoolMoleculeView } from './SchoolMoleculeView'

/**
 * 3D карточки каталога — тот же школьный вид, что у героя лаборатории (SchoolMoleculeView):
 * молекула крупно (занимает кадр), символы в шарах, палочки по кратности. Без ауры, колец, искр
 * и свечения — спокойный тёмный фон карточки. Вращение мышью / пальцем (без зума и сдвига).
 */

/** Доля меньшей стороны кадра, которую занимает описанная сфера молекулы. */
const FILL = 0.86
const FOV = 38
export const SCHOOL_CATALOG_BG = '#0b0e1a'

function FitCamera({ radius }: { radius: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height)
    const tanH = Math.tan((camera.fov * Math.PI) / 360)
    const dist = radius / (FILL * tanH * Math.min(1, aspect))
    const len = camera.position.length()
    if (len > 1e-6) camera.position.multiplyScalar(dist / len)
    else camera.position.set(0, 0, dist)
    camera.near = Math.max(0.01, dist - radius * 3)
    camera.far = dist + radius * 6
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, size.width, size.height, radius, invalidate])
  return null
}

export function SchoolCatalogCanvas({ shape }: { shape: CatalogShape }) {
  const model = useMemo(() => buildSchoolHeroModel(shape), [shape])
  if (!model) return null
  return (
    <CanvasErrorBoundary fallback={<CanvasSceneErrorFallback />} resetKey={shape.id}>
      <Canvas
        camera={{ position: [0, 0, 4], fov: FOV }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 1.75]}
        frameloop="always"
        data-school-catalog-3d={model.source}
      >
        <color attach="background" args={[SCHOOL_CATALOG_BG]} />
        <FitCamera radius={1} />
        <SchoolMoleculeView model={model} fitRadius={1} showLabels tone="dark" caption={false} />
        <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.6} />
      </Canvas>
    </CanvasErrorBoundary>
  )
}
