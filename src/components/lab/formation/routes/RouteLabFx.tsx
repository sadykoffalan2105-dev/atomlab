/**
 * «Как образуется» в самой лаборатории: сцена пути получения играет в 3D-сцене лаборатории после «Проверить и
 * запустить синтез» (вместо общей анимации). Камеру лаборатории не трогаем: группа сцены вписывается в свободную от
 * панелей часть кадра и поворачивается так, чтобы ракурс был как задумано (yaw/pitch ключей модели). Время — общее
 * с панелью этапов (routeLabStore): пауза, скорость, перемотка. В конце — продукт (embryo → birth → complete).
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { ScientificSynthesisFxProps } from '../../../../lab/scientificSynthesis/types'
import { ShowcaseBounds, ShowcaseClock } from '../showcase/kit/core'
import { camAt } from './geom'
import { ROUTE_SCENES } from './registry'
import type { ReactorRouteId } from './routeIndex'
import { routeLab } from './routeLabStore'
import { ROUTE_TEXTS } from './texts/co2Routes'

const FILL = 0.84
const _dir = new THREE.Vector3()
const _want = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const ORIGIN = new THREE.Vector3()

/** Сколько px кадра занимают панели: справа (панель этапов), сверху (она же на телефоне), снизу (реактор). */
function overlaps(canvas: HTMLCanvasElement): { dx: number; dy: number; db: number } {
  const c = canvas.getBoundingClientRect()
  const out = { dx: 0, dy: 0, db: 0 }
  const p = routeLab.panelRect
  if (p && p.width > 0) {
    if (p.left > c.left + c.width / 2) out.dx = Math.max(0, c.right - p.left + 12)
    else out.dy = Math.max(0, p.bottom - c.top + 8)
  }
  const r = document.querySelector('[data-lab-reactor][data-open="true"]')?.getBoundingClientRect()
  if (r && r.height > 0 && r.top < c.bottom) out.db = Math.max(0, c.bottom - r.top + 8)
  return out
}

export default function RouteLabFx({ routeId, lowPower, onEmbryoReady, onBirthReady, onComplete }: ScientificSynthesisFxProps & { routeId: ReactorRouteId }) {
  const def = ROUTE_SCENES[routeId]
  const model = useMemo(() => def.model(), [def])
  const L: 0 | 1 | 2 = useMemo(() => {
    const l = typeof document !== 'undefined' ? document.documentElement.lang : 'ru'
    return l === 'en' ? 1 : l === 'uz' ? 2 : 0
  }, [])
  const root = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const gl = useThree((s) => s.gl)
  const bounds = useRef({ dx: 0, dy: 0 })
  const ov = useRef({ dx: 0, dy: 0, db: 0, at: 0 })
  const sm = useRef<{ z: number; f: THREE.Vector3; q: THREE.Quaternion } | null>(null)
  const end = useRef({ at: 0, done: false })
  const clockFn = useMemo(() => () => routeLab.clock.t, [])
  const total = model.stages.total

  useEffect(() => {
    routeLab.start(routeId, model.stages)
    return () => routeLab.stop(routeId)
  }, [routeId, model])

  useFrame((state, dt) => {
    const c = routeLab.clock
    const d = Math.min(0.1, Math.max(0.001, dt))
    if (c.playing) {
      c.t = Math.min(total, c.t + d * c.speed)
      if (c.t >= total) c.playing = false
    }
    routeLab.tick()
    // конец показа: 1,2 с на последнем кадре, затем продукт
    if (!end.current.done && c.t >= total - 1e-3) {
      const now = performance.now()
      if (!end.current.at) end.current.at = now
      if (now - end.current.at > 1200) {
        end.current.done = true
        onEmbryoReady?.()
        onBirthReady?.()
        onComplete()
      }
    } else if (c.t < total - 1e-3) end.current.at = 0

    const g = root.current
    const gi = inner.current
    if (!g || !gi) return
    const cam = state.camera as THREE.PerspectiveCamera
    const target = (state.controls as unknown as { target?: THREE.Vector3 } | null)?.target ?? ORIGIN
    const now = performance.now()
    if (now - ov.current.at > 400) {
      Object.assign(ov.current, overlaps(gl.domElement), { at: now })
      bounds.current = { dx: ov.current.dx, dy: ov.current.dy }
    }
    const k = camAt(model.cam, c.t)
    const s0 = sm.current ?? (sm.current = { z: k.zoom, f: new THREE.Vector3(...k.focus), q: new THREE.Quaternion() })
    const kk = 1 - Math.exp(-d * 3)
    s0.z += (k.zoom - s0.z) * kk
    s0.f.lerp(_want.set(...k.focus), kk)
    // поворот группы: задуманное направление взгляда (yaw/pitch) → фактическое направление камеры лаборатории
    const yaw = k.yaw + 0.08 * Math.sin(0.33 * c.t)
    const pitch = Math.max(-1.2, Math.min(1.2, k.pitch + 0.03 * Math.sin(0.27 * c.t + 1)))
    _want.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
    _dir.copy(cam.position).sub(target)
    const dist = _dir.length() || 1
    _dir.divideScalar(dist)
    _q.setFromUnitVectors(_want, _dir)
    s0.q.slerp(_q, 1 - Math.exp(-d * 2.2))
    g.quaternion.copy(s0.q)
    // масштаб: модель вписана в свободную часть кадра (без панели этапов и реактора)
    const W = Math.max(1, state.size.width)
    const H = Math.max(1, state.size.height)
    const { dx, dy, db } = ov.current
    const aW = Math.max(120, W - dx)
    const aH = Math.max(120, H - dy - db)
    const fov = cam.isPerspectiveCamera ? cam.fov : 40
    const wpp = (2 * dist * Math.tan((fov * Math.PI) / 360)) / H
    const s = ((FILL * Math.min(aW, aH)) / 2) * wpp * Math.max(0.5, s0.z) / model.fit
    g.scale.setScalar(s)
    _right.setFromMatrixColumn(cam.matrixWorld, 0)
    _up.setFromMatrixColumn(cam.matrixWorld, 1)
    g.position.copy(target).addScaledVector(_right, (-dx / 2) * wpp).addScaledVector(_up, ((db - dy) / 2) * wpp)
    gi.position.set(-s0.f.x, -s0.f.y, -s0.f.z)
  })

  const Scene = def.Scene
  return (
    <ShowcaseClock value={clockFn}>
      <ShowcaseBounds value={bounds}>
        <group ref={root} name="route-lab-fx">
          <group ref={inner}>
            <Scene model={model} L={L} tags={ROUTE_TEXTS[routeId].tags} lowPower={!!lowPower} />
          </group>
        </group>
      </ShowcaseBounds>
    </ShowcaseClock>
  )
}
