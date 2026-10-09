/**
 * 3D-слой сцены «Как образуется» в реакторе: шары и палочки в школьном стиле (matcap, как в каталоге и реакторе),
 * подписи на шарах (DOM, меняются во времени: Cl → Cl⁻, H → H⁺ → H, O → O²⁻), электроны со следом.
 * Всё читается из модели (чистые функции t) — перемотка и скорость без состояния.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createSchoolMatteMaterial, schoolAtomHex, schoolLabelDark, schoolSphereGeometry, schoolStickGeometry, SCHOOL_STICK_HEX } from '../../hero/schoolHeroStyle'
import { Electron, useClockCtx } from '../showcase/kit/core'
import { clamp01, labelAt, pm, type RouteModel } from './geom'

const STICK_R = pm(5.2)
const STICK_STEP = pm(15)
const E_TONE = { c: '#fde68a', o: '#fdba74', h: '#e0f2fe', cl: '#86efac' } as const
const DECOR_DIM = 0.42

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _ax = new THREE.Vector3()
const _side = new THREE.Vector3()
const _cam = new THREE.Vector3()
const _camL = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _w = new THREE.Vector3()
const _f = new THREE.Vector3()

export function RouteAtoms({ model, lowPower }: { model: RouteModel; lowPower: boolean }) {
  const clock = useClockCtx()
  const atoms = useRef<THREE.InstancedMesh>(null)
  const sticks = useRef<THREE.InstancedMesh>(null)
  const sticksDim = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => schoolSphereGeometry(lowPower), [lowPower])
  const stickGeo = useMemo(() => schoolStickGeometry(), [])
  const atomMat = useMemo(() => createSchoolMatteMaterial(), [])
  const stickMat = useMemo(() => createSchoolMatteMaterial(SCHOOL_STICK_HEX.dark), [])
  const dim = model.decorDim ?? DECOR_DIM
  const stickDimMat = useMemo(() => createSchoolMatteMaterial(new THREE.Color(SCHOOL_STICK_HEX.dark).multiplyScalar(0.45 * (dim / DECOR_DIM))), [dim])
  const n = model.particles.length
  const real = useMemo(() => model.bonds.filter((b) => !b.decor), [model])
  const decor = useMemo(() => model.bonds.filter((b) => b.decor), [model])
  const idx = useMemo(() => new Map(model.particles.map((p, i) => [p.id, i])), [model])

  // цвета шаров (фон — притушен)
  useEffect(() => {
    const m = atoms.current
    if (!m) return
    const c = new THREE.Color()
    model.particles.forEach((p, i) => {
      c.setHex(schoolAtomHex(p.el))
      if (p.decor) c.multiplyScalar(dim)
      m.setColorAt(i, c)
    })
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [model, dim])

  useFrame(({ camera }) => {
    const t = clock()
    const am = atoms.current
    if (am) {
      model.particles.forEach((p, i) => {
        const k = clamp01(p.k(t))
        const P = p.pos(t)
        const r = k > 0.005 ? p.r(t) * (0.2 + 0.8 * k) : 1e-5
        _m.compose(_p.set(P[0], P[1], P[2]), _q.identity(), _s.setScalar(r))
        am.setMatrixAt(i, _m)
      })
      am.instanceMatrix.needsUpdate = true
    }
    camera.getWorldPosition(_cam)
    const draw = (mesh: THREE.InstancedMesh | null, list: typeof real) => {
      if (!mesh) return
      // камера — в координатах сетки: группа сцены может быть повёрнута и масштабирована (показ в лаборатории)
      mesh.updateWorldMatrix(true, false)
      const camLocal = mesh.worldToLocal(_camL.copy(_cam))
      let c = 0
      for (const b of list) {
        const g = clamp01(b.k(t))
        const ia = idx.get(b.a)
        const ib = idx.get(b.b)
        if (g < 0.01 || ia == null || ib == null) continue
        const pa = model.particles[ia]!
        const pb = model.particles[ib]!
        if (pa.k(t) < 0.3 || pb.k(t) < 0.3) continue
        _a.set(...pa.pos(t))
        _b.set(...pb.pos(t))
        _ax.copy(_b).sub(_a)
        const L = _ax.length()
        if (L < 1e-6) continue
        _ax.divideScalar(L)
        _q.setFromUnitVectors(_up, _ax)
        // кратная связь — палочки рядом, в плоскости, обращённой к камере
        _side.copy(_a).add(_b).multiplyScalar(0.5)
        _side.copy(camLocal).sub(_side).cross(_ax).normalize()
        for (let s = 0; s < b.n; s++) {
          _p.copy(_a).add(_b).multiplyScalar(0.5)
          if (b.n > 1) _p.addScaledVector(_side, (s - (b.n - 1) / 2) * STICK_STEP)
          const rr = STICK_R * Math.min(1, 0.4 + g)
          _m.compose(_p, _q, _s.set(rr, L * g, rr))
          mesh.setMatrixAt(c++, _m)
        }
      }
      mesh.count = c
      mesh.instanceMatrix.needsUpdate = true
    }
    draw(sticks.current, real)
    draw(sticksDim.current, decor)
  })

  const maxSticks = (list: typeof real) => list.reduce((s, b) => s + b.n, 0) || 1
  return (
    <group>
      <instancedMesh ref={atoms} args={[geo, atomMat, n]} frustumCulled={false} />
      <instancedMesh ref={sticks} args={[stickGeo, stickMat, maxSticks(real)]} frustumCulled={false} />
      <instancedMesh ref={sticksDim} args={[stickGeo, stickDimMat, maxSticks(decor)]} frustumCulled={false} />
      {model.electrons.map((e) => (
        <Electron key={e.id} pos={e.pos} k={e.k} r={pm(9)} color={E_TONE[e.tone]} trail={!lowPower} />
      ))}
      <RouteLabels model={model} />
    </group>
  )
}

type Node = { el: HTMLDivElement; text: string; shown: boolean; x: number; y: number; fs: number }

function fontK(label: string): number {
  const n = [...label].length
  return n <= 1 ? 0.8 : n === 2 ? 0.6 : n === 3 ? 0.5 : 0.42
}

/** Символы на шарах (только частицы реакции, не фон): прячутся, если шар мал или закрыт более близким шаром. */
function RouteLabels({ model }: { model: RouteModel }) {
  const clock = useClockCtx()
  const group = useRef<THREE.Group>(null)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const nodes = useRef<(Node | null)[]>([])
  const scr = useMemo(() => ({ x: new Float32Array(model.particles.length), y: new Float32Array(model.particles.length), d: new Float32Array(model.particles.length), r: new Float32Array(model.particles.length) }), [model])

  useEffect(() => {
    const host = gl.domElement.parentElement
    if (!host) return
    const layer = document.createElement('div')
    layer.setAttribute('aria-hidden', 'true')
    layer.style.cssText = 'position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:2; contain:strict;'
    nodes.current = model.particles.map((p) => {
      if (p.decor) return null
      const el = document.createElement('div')
      const dark = schoolLabelDark(schoolAtomHex(p.el))
      el.style.cssText =
        'position:absolute; left:0; top:0; white-space:nowrap; will-change:transform; display:none;' +
        'font-family:"Inter", system-ui, sans-serif; font-weight:700; line-height:1;' +
        (dark ? 'color:#101722; text-shadow:0 0 3px rgba(255,255,255,0.6);' : 'color:#ffffff; text-shadow:0 1px 2px rgba(0,0,0,0.75), 0 0 6px rgba(0,0,0,0.35);')
      layer.appendChild(el)
      return { el, text: '', shown: false, x: NaN, y: NaN, fs: NaN }
    })
    host.appendChild(layer)
    return () => {
      nodes.current = []
      layer.remove()
    }
  }, [gl, model])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const t = clock()
    const cam = camera as THREE.PerspectiveCamera
    const w = size.width
    const h = size.height
    g.updateWorldMatrix(true, false)
    _cam.setFromMatrixPosition(cam.matrixWorld)
    const pxK = h / 2 / Math.tan(((cam.fov || 38) * Math.PI) / 360)
    const ps = model.particles
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]!
      const k = clamp01(p.k(t))
      const P = p.pos(t)
      _w.set(P[0], P[1], P[2]).applyMatrix4(g.matrixWorld)
      const d = _cam.distanceTo(_w)
      const rw = p.r(t) * (0.2 + 0.8 * k)
      _f.copy(_cam).sub(_w).normalize().multiplyScalar(rw).add(_w).project(cam)
      scr.x[i] = (_f.x * 0.5 + 0.5) * w
      scr.y[i] = (-_f.y * 0.5 + 0.5) * h
      scr.d[i] = d
      scr.r[i] = k > 0.5 && d > 1e-6 && _f.z < 1 ? (rw / d) * pxK : 0
    }
    for (let i = 0; i < ps.length; i++) {
      const node = nodes.current[i]
      if (!node) continue
      let show = scr.r[i]! >= 8
      if (show)
        for (let j = 0; j < ps.length; j++) {
          if (j === i || scr.r[j]! <= 0 || scr.d[j]! >= scr.d[i]! - 1e-6) continue
          if (Math.hypot(scr.x[j]! - scr.x[i]!, scr.y[j]! - scr.y[i]!) < scr.r[j]! + 0.35 * scr.r[i]!) {
            show = false
            break
          }
        }
      const text = show ? labelAt(ps[i]!, t) : ''
      if (!show || !text) {
        if (node.shown) {
          node.el.style.display = 'none'
          node.shown = false
        }
        continue
      }
      if (text !== node.text) {
        node.el.textContent = text
        node.text = text
      }
      if (!node.shown) {
        node.el.style.display = 'block'
        node.shown = true
      }
      const fs = Math.round(Math.max(11, Math.min(40, scr.r[i]! * fontK(text))) * 2) / 2
      if (fs !== node.fs) {
        node.el.style.fontSize = `${fs}px`
        node.fs = fs
      }
      const x = Math.round(scr.x[i]! * 2) / 2
      const y = Math.round(scr.y[i]! * 2) / 2
      if (x !== node.x || y !== node.y) {
        node.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
        node.x = x
        node.y = y
      }
    }
  })
  return <group ref={group} />
}
