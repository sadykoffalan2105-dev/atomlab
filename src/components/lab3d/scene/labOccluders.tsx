/**
 * HTML-подписи сцены («Возьмите», «Горячо», «Наденьте», «Рабочее место») — поверх холста, и 3D-геометрия их не закрывает.
 * Здесь — общий корень комнаты (стены, вытяжка, шкафы, полки) и подпись, которая прячется, когда между камерой и её
 * точкой стоит непрозрачная мебель. Прозрачное (стекло дверец, створка вытяжки) подпись не прячет.
 * Луч — раз в 4 кадра на подпись, только по комнате (без установки опыта): дёшево и без новых шейдеров.
 */
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, type CSSProperties, type ReactNode } from 'react'
import * as THREE from 'three'
import { useXrPresenting } from '../xr/labXrStore'

/** Корень комнаты; Lab3DCanvas подставляет сюда группу LabRoom. */
export const labRoomOccluder: { current: THREE.Object3D | null } = { current: null }

const ray = new THREE.Raycaster()
const hits: THREE.Intersection[] = []
const wp = new THREE.Vector3()
const dir = new THREE.Vector3()

function isOpaqueHit(h: THREE.Intersection): boolean {
  const o = h.object as THREE.Mesh
  if (!o.visible || !(o as { isMesh?: boolean }).isMesh) return false
  const m = Array.isArray(o.material) ? o.material[0] : o.material
  return !!m && m.visible && !m.transparent
}

/** Закрыта ли точка мебелью комнаты для этой камеры. */
export function isPointOccluded(camera: THREE.Camera, point: THREE.Vector3): boolean {
  const root = labRoomOccluder.current
  if (!root) return false
  dir.copy(point).sub(camera.position)
  const dist = dir.length()
  if (dist < 0.05) return false
  ray.set(camera.position, dir.multiplyScalar(1 / dist))
  ray.near = 0
  ray.far = dist - 0.03
  hits.length = 0
  ray.intersectObject(root, true, hits)
  for (const h of hits) if (isOpaqueHit(h)) return true
  return false
}

interface LabelProps {
  readonly position: THREE.Vector3Tuple | readonly [number, number, number]
  readonly center?: boolean
  readonly zIndexRange?: [number, number]
  readonly style?: CSSProperties
  readonly children: ReactNode
}

/**
 * Нижняя граница z-index подписей: холст лежит на z-index 10 над HTML-доской (LabBoard, occlude="blending"),
 * поэтому подпись ниже 11 спряталась бы под холстом. Диапазон подписи сдвигается вверх, порядок «ближе — выше» сохраняется.
 */
export const LABEL_Z_MIN = 11

/** drei <Html> без pointer-событий, который прячется за непрозрачной мебелью комнаты. */
export function LabLabel({ position, center, zIndexRange = [30, LABEL_Z_MIN], style, children }: LabelProps) {
  const zr: [number, number] = [Math.max(zIndexRange[0], LABEL_Z_MIN + 1), Math.max(zIndexRange[1], LABEL_Z_MIN)]
  const anchor = useRef<THREE.Group>(null)
  const box = useRef<HTMLDivElement>(null)
  const tick = useRef(Math.floor(Math.random() * 4))
  const hidden = useRef(false)
  useFrame(({ camera }) => {
    if (++tick.current % 4) return
    const a = anchor.current
    const el = box.current
    if (!a || !el) return
    a.getWorldPosition(wp)
    const occ = isPointOccluded(camera, wp)
    if (occ !== hidden.current) {
      hidden.current = occ
      el.style.visibility = occ ? 'hidden' : 'visible'
    }
  })
  // в VR DOM-подписи не видны (и только тратят кадр) — не монтируем; подсказки целей там — спрайты (xr/XrHintSprite)
  const xr = useXrPresenting()
  return (
    <group ref={anchor} position={position as THREE.Vector3Tuple}>
      {xr ? null : (
        <Html center={center} zIndexRange={zr} style={{ pointerEvents: 'none', ...style }}>
          <div ref={box}>{children}</div>
        </Html>
      )}
    </group>
  )
}
