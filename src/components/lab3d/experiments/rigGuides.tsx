/**
 * Подсказки установки: «призрачная» рука, которая показывает траекторию жеста (перетащить / провести),
 * пока ученик не начал, и стеклянные 3D-подписи наблюдений у места события (исчезают через 3 с).
 */
import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { LAB_COLORS, type LabExperimentId } from '../labContract'
import { HandIcon, smooth, useRig } from './rigCore'
import { RIG_LABELS, type RigGesture } from './rigTargets'
import { isPointOccluded, LabLabel } from '../scene/labOccluders'

const ghostStyle: CSSProperties = {
  color: LAB_COLORS.accent,
  filter: 'drop-shadow(0 2px 6px rgba(31,76,160,0.35))',
  pointerEvents: 'none',
  userSelect: 'none',
  transform: 'translate(2px, 8px) scale(1.5)',
  transition: 'opacity 0.12s linear',
}

const gw = new THREE.Vector3()

/** Призрачная рука движется по пути жеста; у цели — пульсирующий «магнит», путь — пунктир со стрелкой. */
export function GestureGhost({ gesture }: { gesture: Extract<RigGesture, { kind: 'drag' | 'swipe' }> }) {
  const { time } = useRig()
  const hand = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const dom = useRef<HTMLDivElement>(null)
  const root = useRef<THREE.Group>(null)
  const tick = useRef(0)
  const from = useMemo(() => new THREE.Vector3(...gesture.from), [gesture])
  const to = useMemo(() => new THREE.Vector3(...gesture.to), [gesture])
  const dir = useMemo(() => to.clone().sub(from).normalize(), [from, to])
  const arrowQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), [dir])
  const points = useMemo(() => {
    // путь чуть выгнут вверх — как переносят предмет рукой
    const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, gesture.kind === 'drag' ? 0.03 : 0, 0))
    return new THREE.QuadraticBezierCurve3(from, mid, to).getPoints(24)
  }, [from, to, gesture.kind])
  useFrame(({ camera }) => {
    // путь жеста рисуется поверх всего (depthTest off) — за непрозрачной мебелью прячем его целиком
    if (root.current && ++tick.current % 4 === 0) {
      root.current.visible = !isPointOccluded(camera, root.current.localToWorld(gw.copy(to)))
    }
    const t = (time.current ?? 0) % 2.2
    const k = smooth(Math.min(1, Math.max(0, (t - 0.35) / 1.25)))
    const idx = k * (points.length - 1)
    const i0 = Math.floor(idx)
    const a = points[i0]!
    const b = points[Math.min(points.length - 1, i0 + 1)]!
    hand.current?.position.lerpVectors(a, b, idx - i0)
    const fade = t < 0.25 ? t / 0.25 : t > 1.85 ? Math.max(0, 1 - (t - 1.85) / 0.3) : 1
    if (dom.current) dom.current.style.opacity = String(0.85 * fade)
    if (ring.current) {
      const s = 1 + 0.25 * Math.sin((time.current ?? 0) * 5)
      ring.current.scale.setScalar(s)
    }
  })
  return (
    <group ref={root}>
      <Line points={points} color={LAB_COLORS.accent} lineWidth={2} dashed dashSize={0.008} gapSize={0.006} transparent opacity={0.75} depthTest={false} renderOrder={20} />
      <mesh position={to} quaternion={arrowQuat} renderOrder={20}>
        <coneGeometry args={[0.006, 0.016, 12]} />
        <meshBasicMaterial color={LAB_COLORS.accent} transparent opacity={0.85} depthTest={false} />
      </mesh>
      <mesh ref={ring} position={to} renderOrder={19}>
        <sphereGeometry args={[0.018, 20, 14]} />
        <meshBasicMaterial color={LAB_COLORS.accent} transparent opacity={0.13} depthWrite={false} depthTest={false} />
      </mesh>
      <group ref={hand}>
        <LabLabel position={[0, 0, 0]} center zIndexRange={[28, 10]}>
          <div ref={dom} style={ghostStyle} data-lab3d-ghost={gesture.kind}>
            <HandIcon />
          </div>
        </LabLabel>
      </group>
    </group>
  )
}

const labelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  padding: '7px 13px 7px 10px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(8px) saturate(1.4)',
  WebkitBackdropFilter: 'blur(8px) saturate(1.4)',
  border: '1px solid rgba(255,255,255,0.9)',
  boxShadow: '0 8px 22px rgba(24, 40, 70, 0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
  color: '#16304f',
  font: '650 14px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  userSelect: 'none',
  animation: 'lab3dObsIn 0.35s ease-out both',
}
const dotStyle: CSSProperties = { width: 9, height: 9, borderRadius: 99, background: LAB_COLORS.accent, boxShadow: '0 0 0 3px rgba(47,124,246,0.25)' }

let obsCss = false
function ensureObsCss() {
  if (obsCss || typeof document === 'undefined') return
  obsCss = true
  const st = document.createElement('style')
  st.textContent = '@keyframes lab3dObsIn{from{opacity:0;transform:translateY(8px) scale(.94)}to{opacity:1;transform:none}}'
  document.head.appendChild(st)
}

/** Подписи наблюдений: появляются, когда прогресс проходит отметку вперёд, и через 3 с исчезают. */
export function ObsLabels({ experimentId }: { experimentId: LabExperimentId }) {
  const { p, time, lang } = useRig()
  const labels = RIG_LABELS[experimentId]
  const shown = useRef<number[]>(labels.map(() => -1e9))
  const prev = useRef<number | null>(null)
  const [vis, setVis] = useState<readonly boolean[]>(() => labels.map(() => false))
  ensureObsCss()
  useFrame(() => {
    const v = p.current ?? 0
    const t = time.current ?? 0
    const pv = prev.current
    prev.current = v
    let changed = false
    const next = labels.map((l, i) => {
      if (pv != null && pv < l.at && v >= l.at && v - pv < 0.2) shown.current[i] = t
      const on = t - shown.current[i]! < 3
      if (on !== vis[i]) changed = true
      return on
    })
    if (changed) setVis(next)
  })
  return (
    <>
      {labels.map((l, i) =>
        vis[i] ? (
          <LabLabel key={i} position={l.pos} center zIndexRange={[26, 10]}>
            <div style={labelStyle} data-lab3d-obs={i}>
              <span style={dotStyle} />
              {l.text[lang]}
            </div>
          </LabLabel>
        ) : null,
      )}
    </>
  )
}
