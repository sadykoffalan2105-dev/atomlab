/**
 * Наручный HUD: плоскость 0,16 × 0,09 м на рукоятке левого контроллера (повёрнута к лицу) — инструкция шага
 * в 2 строки, «n/N» и подсказка жеста. В эмуляции без шлема рукоятки нет — HUD висит слева внизу перед камерой.
 */
import { useEffect, useMemo, useRef } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { LabLang } from '../labContract'
import { useXrState } from './labXrStore'
import { HUD_TEX, drawHud } from './xrBoardDraw'

const tmp = new THREE.Vector3()

export function XrWristHud({ grip }: { grip: THREE.Object3D | null }) {
  const st = useXrState()
  const experimentId = st.run?.experimentId ?? ''
  const step = st.run?.step ?? 0
  const lang: LabLang = st.run?.lang ?? 'ru'
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = HUD_TEX.w
    c.height = HUD_TEX.h
    return c
  }, [])
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [canvas])
  useEffect(() => () => texture.dispose(), [texture])
  useEffect(() => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawHud(ctx, experimentId, step, lang)
    texture.needsUpdate = true
  }, [canvas, texture, experimentId, step, lang])
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const m = ref.current
    if (!m) return
    if (grip) {
      // над запястьем, плоскостью к глазам
      m.position.set(0, 0.06, 0.04)
      m.parent?.updateWorldMatrix(true, false)
      // lookAt — в мировых координатах: передняя сторона плоскости (+Z) к голове
      m.lookAt(camera.position)
    } else {
      // эмуляция: слева внизу перед камерой
      tmp.set(-0.2, -0.13, -0.55)
      camera.localToWorld(tmp)
      m.position.copy(tmp)
      m.quaternion.copy(camera.quaternion)
    }
  })
  const hud = (
    <mesh ref={ref} renderOrder={60} name="xr-wrist-hud">
      <planeGeometry args={[0.16, 0.09]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent depthTest={false} depthWrite={false} />
    </mesh>
  )
  return grip ? createPortal(hud, grip) : createPortal(hud, scene)
}
