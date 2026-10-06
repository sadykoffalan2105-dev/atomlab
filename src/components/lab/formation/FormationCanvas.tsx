import { useMemo, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type * as THREE from 'three'
import { formationPlan } from '../../../chemistry/formationPlan'
import { easeInOut, formationStoryFor, type FormationStory, type StageKey } from './formationStory'
import { CanvasErrorBoundary } from '../../common/CanvasErrorBoundary'
import { CanvasSceneErrorFallback } from '../../common/CanvasSceneErrorFallback'
import { SCHOOL_CATALOG_BG } from '../hero/SchoolCatalogCanvas'
import { buildSchoolHeroModel, type CatalogShape } from '../hero/schoolHeroModel'
import { FormationMoleculeView } from './FormationMoleculeView'
import type { FormationClock } from './formationTimeline'
import { formationScript } from '../../../chemistry/formationScripts'
import { FormationClouds } from './FormationClouds'
import { useCloudsOn } from './board/cloudsStore'
import { FormationHud, type HudLayout } from './FormationHud'
import hudStyles from './FormationHud.module.css'

/** Доля меньшей стороны кадра под описанную сферу — как у SchoolCatalogCanvas. */
const FILL = 0.86
const FOV = 38

/** Приближение камеры по этапам: к реакционному центру на разрыве / переходе e⁻, отдаление на решётке. */
function stageZoom(key: StageKey, crystal: boolean): number {
  if (key === 'transfer') return crystal ? 1.28 : 1.06
  if (key === 'break' || key === 'release') return 1.06
  if (key === 'heat') return 1.04
  if (key === 'lattice') return 0.94
  return 1
}
/** Целевой зум в момент t: между этапами — плавный переход ease-in-out (1,2 с) — без рывков. */
function zoomAt(story: FormationStory, t: number, crystal: boolean): number {
  const st = story.stages
  let k = 0
  for (let i = 0; i < st.length; i++) if (t >= st[i]!.t0) k = i
  const cur = stageZoom(st[k]!.key, crystal)
  if (k === 0) return cur
  const prev = stageZoom(st[k - 1]!.key, crystal)
  return prev + (cur - prev) * easeInOut((t - st[k]!.t0) / 1.2)
}

/**
 * Камера: вписывает модель в 3D-окно за вычетом HUD (смещение вида — центр кадра в свободной части), зум по этапам.
 * Всё сглажено (экспонента ~0,25 с): перемотка ползунком не даёт рывков.
 */
function CameraRig({ story, layout, clock, crystal }: { story: FormationStory; layout: MutableRefObject<HudLayout>; clock: MutableRefObject<FormationClock>; crystal: boolean }) {
  const cur = useRef<{ dx: number; dy: number; z: number } | null>(null)
  useFrame((state, dt) => {
    const camera = state.camera as THREE.PerspectiveCamera
    const W = Math.max(1, state.size.width)
    const H = Math.max(1, state.size.height)
    const hud = layout.current
    // Свободная часть: слева от HUD или под ним — где больше места для модели.
    const left = Math.min(W - hud.dx, H)
    const below = Math.min(W, H - hud.dy)
    // Без «урезания» места под HUD: атомы никогда не заходят под фактический прямоугольник карточек.
    const tdx = hud.dx > 0 && left >= below ? Math.min(hud.dx, W - 60) : 0
    const tdy = hud.dy > 0 && left < below ? Math.min(hud.dy, H - 60) : 0
    const tz = zoomAt(story, clock.current.t, crystal)
    const c = cur.current ?? (cur.current = { dx: tdx, dy: tdy, z: tz })
    const k = 1 - Math.exp(-Math.min(0.1, Math.max(0.001, dt)) * 4)
    c.dx += (tdx - c.dx) * k
    c.dy += (tdy - c.dy) * k
    c.z += (tz - c.z) * k
    const aW = W - c.dx
    const aH = H - c.dy
    const fullW = W + c.dx
    const fullH = H + c.dy
    const tanH = Math.tan((camera.fov * Math.PI) / 360)
    const dist = fullH / (FILL * tanH * Math.min(aW, aH) * c.z)
    const len = camera.position.length()
    if (len > 1e-6) camera.position.multiplyScalar(dist / len)
    else camera.position.set(0, 0, dist)
    camera.near = Math.max(0.01, dist - 3)
    camera.far = dist + 6
    // HUD справа: центр кадра — в левой части (x = dx); HUD сверху: центр — в нижней части (y = 0).
    if (c.dx > 0.5 || c.dy > 0.5) camera.setViewOffset(fullW, fullH, c.dx, 0, W, H)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
  })
  return null
}

/** 3D «Как образуется» в карточке каталога (вместо обычного вида, пока идёт показ) + HUD-карточка формул. */
export function FormationCanvas({ shape, clock, lowPower }: { shape: CatalogShape; clock: MutableRefObject<FormationClock>; lowPower: boolean }) {
  const model = useMemo(() => buildSchoolHeroModel(shape), [shape])
  const plan = useMemo(() => formationPlan(shape.id), [shape.id])
  const story = useMemo(() => formationStoryFor(shape.id), [shape.id])
  const cloudsOn = useCloudsOn()
  const ftype = useMemo(() => formationScript(shape.id)?.type ?? null, [shape.id])
  const layout = useRef<HudLayout>({ dx: 0, dy: 0 })
  if (!model || !plan || !story) return null
  return (
    <div className={hudStyles.wrap} data-formation-3d={plan.mode}>
      <div className={hudStyles.stage}>
        <CanvasErrorBoundary fallback={<CanvasSceneErrorFallback />} resetKey={`formation-${shape.id}`}>
          <Canvas
            camera={{ position: [0, 0, 4], fov: FOV }}
            gl={{ antialias: !lowPower, alpha: false, powerPreference: lowPower ? 'default' : 'high-performance' }}
            dpr={lowPower ? [1, 1.25] : [1, 1.75]}
            frameloop="always"
          >
            <color attach="background" args={[SCHOOL_CATALOG_BG]} />
            <CameraRig story={story} layout={layout} clock={clock} crystal={model.kind === 'crystal'} />
            {/* Кристалл на экране меньше описанной сферы — как в SchoolCatalogCanvas. */}
            <FormationMoleculeView model={model} plan={plan} story={story} clock={clock} fitRadius={model.kind === 'crystal' ? 1.1 : 1} lowPower={lowPower} />
            {/* Электронные облака — после вида атомов: читают ту же группу и те же часы (переключатель на доске). */}
            {cloudsOn ? <FormationClouds model={model} story={story} clock={clock} type={ftype} lowPower={lowPower} /> : null}
            <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.6} />
          </Canvas>
        </CanvasErrorBoundary>
      </div>
      <FormationHud story={story} plan={plan} clock={clock} layout={layout} />
    </div>
  )
}
