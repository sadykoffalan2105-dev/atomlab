/**
 * Огнетушитель: висит на крючке у передней стены под табличкой ТБ «Огнетушитель».
 * Нажатие — снять с крючка (он в «руке» у камеры), затем «Выдернуть чеку» и «Нажать рычаг» (удерживать) —
 * облако порошка/CO₂ (частицы, звук). Если струя попадает в пламя опыта — пламя гаснет: сцена публикует
 * labEvents { type: 'fire', on: false, at } (опыт гасит своё пламя) и подсказку «Пламя потушено».
 * Где горит, сцена узнаёт по событиям опыта: 'fire' { on: true, at } или звук 'flame-on' / 'flame-loop' с точкой at.
 * Заодно предметы рядом с пламенем становятся горячими (labHand.markHot) — без перчаток их не взять.
 */
import { useCursor } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { labAudio } from '../audio/labAudio'
import type { LabExperimentId, LabLang } from '../labContract'
import { labEvents, type Vec3Tuple } from '../labEvents'
import type { LabMaterials } from '../scene/labMaterials'
import { ROOM } from '../scene/labSceneLayout'
import { itemXZ, labHand } from './labHandStore'

/* ───────────── маленький стор огнетушителя ───────────── */
export interface ExtState {
  readonly mode: 'hook' | 'hand'
  readonly pinOut: boolean
  readonly spraying: boolean
  /** Остаток заряда 0…1 (около 12 с струи). */
  readonly charge: number
  /** Сколько очагов сейчас горит (для подсказки в панели). */
  readonly fires: number
}
let ext: ExtState = { mode: 'hook', pinOut: false, spraying: false, charge: 1, fires: 0 }
const extListeners = new Set<() => void>()
function setExt(p: Partial<ExtState>) {
  ext = { ...ext, ...p }
  for (const l of extListeners) l()
}
const subExt = (cb: () => void) => {
  extListeners.add(cb)
  return () => extListeners.delete(cb)
}
export const useExtinguisher = () => useSyncExternalStore(subExt, () => ext, () => ext)
export const labExtinguisher = {
  take() {
    if (labHand.getState().held) labHand.putBack()
    setExt({ mode: 'hand', spraying: false })
    labEvents.emit({ type: 'sound', name: 'click', gain: 0.6 })
  },
  hang() {
    setExt({ mode: 'hook', spraying: false, pinOut: false })
    labEvents.emit({ type: 'sound', name: 'door-close', at: HOOK_AT, gain: 0.4 })
  },
  pullPin() {
    if (ext.mode !== 'hand' || ext.pinOut) return
    setExt({ pinOut: true })
    labEvents.emit({ type: 'sound', name: 'click', gain: 0.9 })
  },
  spray(on: boolean) {
    if (on && (ext.mode !== 'hand' || !ext.pinOut || ext.charge <= 0)) return
    if (ext.spraying !== on) setExt({ spraying: on })
  },
  /** Новый опыт: огнетушитель снова заряжен и на крючке. */
  reset() {
    setExt({ mode: 'hook', pinOut: false, spraying: false, charge: 1, fires: 0 })
  },
  getState: () => ext,
}

/* ───────────── очаги пламени (по событиям опыта) ───────────── */
interface Fire {
  at: THREE.Vector3
  hit: number
}
const fires = new Map<string, Fire>()
const fireKey = (at: Vec3Tuple) => at.map((v) => Math.round(v * 20)).join(',')
const tmpAt = new THREE.Vector3()
function addFire(at: Vec3Tuple) {
  const k = fireKey(at)
  // Один очаг — одна точка: звук 'flame-on' и само пламя ('fire') сообщают о нём в соседних точках
  let near = false
  for (const f of fires.values()) if (f.at.distanceTo(tmpAt.set(...at)) < 0.2) near = true
  if (!fires.has(k) && !near) {
    fires.set(k, { at: new THREE.Vector3(...at), hit: 0 })
    setExt({ fires: fires.size })
  }
  // Предметы рядом с пламенем нагреваются
  for (const [id, [x, z]] of itemXZ) if (Math.hypot(x - at[0], z - at[2]) < 0.3) labHand.markHot(id)
}
function clearFires() {
  fires.clear()
  if (ext.fires) setExt({ fires: 0 })
}

const HOOK_X = -ROOM.w / 2 + 0.36
const HOOK_Z = ROOM.frontZ + 0.1
/** Нижняя точка корпуса на крючке. */
const HOOK_Y = 0.3
const HOOK_AT: Vec3Tuple = [HOOK_X, HOOK_Y + 0.5, HOOK_Z]
const SPRAY_SECONDS = 12
const TEXT = {
  out: { ru: 'Пламя потушено. Зажечь снова — «‹ Назад» к шагу с огнём', en: 'Flame put out. To relight — “‹ Back” to the fire step', uz: 'Alanga o‘chirildi. Qayta yoqish — olovli qadamga «‹ Orqaga»' },
  sign: { ru: 'ОГНЕТУШИТЕЛЬ', en: 'FIRE EXTINGUISHER', uz: 'O‘T O‘CHIRGICH' },
} as const

/** Табличка ТБ: красный знак с силуэтом огнетушителя и подписью. */
function signTexture(lang: LabLang): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 320
  const g = c.getContext('2d')!
  g.fillStyle = '#d42a1e'
  g.fillRect(0, 0, 256, 320)
  g.strokeStyle = '#ffffff'
  g.lineWidth = 8
  g.strokeRect(10, 10, 236, 300)
  // силуэт: корпус, головка, шланг
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.roundRect(98, 92, 60, 150, 18)
  g.fill()
  g.fillRect(114, 64, 28, 30)
  g.fillRect(104, 56, 62, 12)
  g.lineWidth = 10
  g.strokeStyle = '#ffffff'
  g.beginPath()
  g.moveTo(150, 66)
  g.quadraticCurveTo(200, 70, 196, 150)
  g.stroke()
  g.fillStyle = '#ffffff'
  g.font = `bold ${lang === 'ru' ? 28 : 24}px system-ui, sans-serif`
  g.textAlign = 'center'
  g.fillText(TEXT.sign[lang], 128, 286)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

let puffTex: THREE.CanvasTexture | null = null
/** Мягкое круглое пятно для частиц облака (одно на страницу). */
function puffTexture(): THREE.CanvasTexture {
  if (puffTex) return puffTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.45, 'rgba(255,255,255,0.55)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  puffTex = new THREE.CanvasTexture(c)
  return puffTex
}

/** Модель огнетушителя: начало — низ корпуса, сопло раструба смотрит в −Z. */
function ExtinguisherModel({ mats, pinOut }: { mats: LabMaterials; pinOut: boolean }) {
  return (
    <group>
      <mesh position-y={0.26} material={mats.red} castShadow>
        <cylinderGeometry args={[0.07, 0.072, 0.52, 24]} />
      </mesh>
      <mesh position-y={0.52} material={mats.red}>
        <sphereGeometry args={[0.07, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* Этикетка */}
      <mesh position={[0, 0.27, -0.071]} rotation-y={Math.PI} material={mats.whitePlastic}>
        <planeGeometry args={[0.085, 0.13]} />
      </mesh>
      {/* Головка-затвор, ручка и рычаг */}
      <mesh position-y={0.6} material={mats.chrome}>
        <cylinderGeometry args={[0.02, 0.026, 0.07, 12]} />
      </mesh>
      <mesh position={[0, 0.645, 0.045]} rotation-x={0.12} material={mats.blackPlastic}>
        <boxGeometry args={[0.03, 0.012, 0.13]} />
      </mesh>
      <mesh position={[0, 0.672, 0.035]} rotation-x={0.32} material={mats.blackPlastic}>
        <boxGeometry args={[0.028, 0.01, 0.12]} />
      </mesh>
      {/* Чека с кольцом (жёлтая пломба) */}
      {!pinOut && (
        <group position={[0.026, 0.655, 0.0]}>
          <mesh rotation-z={Math.PI / 2} material={mats.steel}>
            <cylinderGeometry args={[0.003, 0.003, 0.05, 6]} />
          </mesh>
          <mesh position-x={0.03} rotation-y={Math.PI / 2}>
            <torusGeometry args={[0.014, 0.0025, 6, 16]} />
            <meshStandardMaterial color="#f2c230" roughness={0.4} metalness={0.3} />
          </mesh>
        </group>
      )}
      {/* Шланг и раструб */}
      <mesh position={[0, 0.62, -0.06]} rotation-x={Math.PI / 2} material={mats.blackPlastic}>
        <cylinderGeometry args={[0.009, 0.009, 0.1, 8]} />
      </mesh>
      <mesh position={[0, 0.62, -0.15]} rotation-x={-Math.PI / 2} material={mats.blackPlastic}>
        <cylinderGeometry args={[0.03, 0.012, 0.09, 14, 1, true]} />
      </mesh>
    </group>
  )
}

const N_HIGH = 220
const N_LOW = 90

export function LabExtinguisher({
  mats,
  lang,
  quality,
  experimentId,
}: {
  mats: LabMaterials
  lang: LabLang
  quality: 'low' | 'high'
  experimentId: LabExperimentId
}) {
  const st = useExtinguisher()
  const camera = useThree((s) => s.camera)
  const [hover, setHover] = useState(false)
  useCursor(hover && st.mode === 'hook')
  const handRef = useRef<THREE.Group>(null)
  const sign = useMemo(() => signTexture(lang), [lang])
  useEffect(() => () => sign.dispose(), [sign])
  useEffect(() => labHand.setLang(lang), [lang])

  // Очаги пламени: события опыта; при смене опыта — заново
  useEffect(() => {
    clearFires()
    labExtinguisher.reset()
    const offS = labEvents.on('sound', (e) => {
      if ((e.name === 'flame-on' || e.name === 'flame-loop') && e.at) addFire(e.at)
    })
    const offF = labEvents.on('fire', (e) => {
      if (e.on && e.at) addFire(e.at)
      else if (!e.on && e.at) {
        const at = tmpAt.set(...e.at)
        for (const [k, f] of fires) if (f.at.distanceTo(at) < 0.2) fires.delete(k)
        setExt({ fires: fires.size })
      }
    })
    // Взяли предмет — огнетушитель возвращается на крючок (рука одна)
    const offP = labEvents.on('picked', () => {
      if (ext.mode === 'hand') labExtinguisher.hang()
    })
    return () => {
      offS()
      offF()
      offP()
    }
  }, [experimentId])

  /* Частицы облака: мировые координаты, без перерисовок React */
  const n = quality === 'high' ? N_HIGH : N_LOW
  const sim = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(n * 3).fill(-99)
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({
      map: puffTexture(),
      size: 0.16,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      color: '#f4f7fb',
      sizeAttenuation: true,
    })
    return { geo, mat, pos, vel: new Float32Array(n * 3), life: new Float32Array(n), next: 0, acc: 0, sound: 0, alive: 0 }
  }, [n])
  useEffect(
    () => () => {
      sim.geo.dispose()
      sim.mat.dispose()
    },
    [sim],
  )
  const pointsRef = useRef<THREE.Points>(null)
  const tmp = useMemo(() => ({ fwd: new THREE.Vector3(), nozzle: new THREE.Vector3(), v: new THREE.Vector3(), off: new THREE.Vector3(), aim: new THREE.Vector3() }), [])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const s = ext
    // В руке: огнетушитель справа внизу кадра, раструб — по направлению взгляда
    const g = handRef.current
    if (g && s.mode === 'hand') {
      tmp.off.set(0.2, -0.62, -0.62).applyQuaternion(camera.quaternion)
      g.position.copy(camera.position).add(tmp.off)
      g.quaternion.copy(camera.quaternion)
      g.updateMatrixWorld()
    }
    const spraying = s.mode === 'hand' && s.spraying && s.pinOut && s.charge > 0
    if (spraying) {
      camera.getWorldDirection(tmp.fwd)
      tmp.nozzle.set(0, 0.62, -0.19)
      g?.localToWorld(tmp.nozzle)
      // Струю направляют на основание пламени: если очаг виден в кадре — раструб смотрит на ближайший к центру
      // (кнопку «Нажать рычаг» держат пальцем — целиться им же нельзя)
      let best = Infinity
      for (const f of fires.values()) {
        tmp.v.copy(f.at).project(camera)
        if (tmp.v.z > 1 || Math.abs(tmp.v.x) > 1.05 || Math.abs(tmp.v.y) > 1.05) continue
        const d = tmp.v.x * tmp.v.x + tmp.v.y * tmp.v.y
        if (d < best) {
          best = d
          tmp.aim.copy(f.at)
        }
      }
      if (best < Infinity) tmp.fwd.copy(tmp.aim).sub(tmp.nozzle).normalize()
      // Выпуск частиц
      sim.acc += dt * n * 1.6
      while (sim.acc >= 1) {
        sim.acc -= 1
        const i = sim.next
        sim.next = (sim.next + 1) % n
        sim.pos[i * 3] = tmp.nozzle.x
        sim.pos[i * 3 + 1] = tmp.nozzle.y
        sim.pos[i * 3 + 2] = tmp.nozzle.z
        const sp = 2.4 + Math.random() * 1.2
        sim.vel[i * 3] = tmp.fwd.x * sp + (Math.random() - 0.5) * 0.5
        sim.vel[i * 3 + 1] = tmp.fwd.y * sp + (Math.random() - 0.5) * 0.4
        sim.vel[i * 3 + 2] = tmp.fwd.z * sp + (Math.random() - 0.5) * 0.5
        sim.life[i] = 1
      }
      // Шипение струи
      sim.sound -= dt
      if (sim.sound <= 0) {
        sim.sound = 0.32
        labAudio.play('fizz', { at: [tmp.nozzle.x, tmp.nozzle.y, tmp.nozzle.z], gain: 0.9 })
      }
      // Расход заряда
      const charge = Math.max(0, s.charge - dt / SPRAY_SECONDS)
      if (Math.floor(charge * 50) !== Math.floor(s.charge * 50) || charge === 0) setExt({ charge, spraying: charge > 0 })
      else ext = { ...ext, charge }
      // Попадание в пламя: точка у оси струи (конус расширяется) ~0,6 с — пламя гаснет
      for (const [k, f] of fires) {
        tmp.v.copy(f.at).sub(tmp.nozzle)
        const along = tmp.v.dot(tmp.fwd)
        const across = Math.sqrt(Math.max(0, tmp.v.lengthSq() - along * along))
        if (along > 0.05 && along < 3.5 && across < 0.22 + along * 0.18) f.hit += dt
        if (f.hit > 0.6) {
          fires.delete(k)
          setExt({ fires: fires.size })
          const at: Vec3Tuple = [f.at.x, f.at.y, f.at.z]
          labEvents.emit({ type: 'fire', on: false, at })
          labEvents.emit({ type: 'hint', at: [at[0], at[1] + 0.25, at[2]], text: TEXT.out[lang] })
          labEvents.emit({ type: 'sound', name: 'sizzle', at, gain: 0.8 })
        }
      }
    }
    // Движение облака: торможение воздухом, всплывание, рост и угасание
    let alive = 0
    for (let i = 0; i < n; i++) {
      if (sim.life[i] <= 0) continue
      alive++
      const k = i * 3
      const drag = Math.exp(-dt * 2.6)
      sim.vel[k] *= drag
      sim.vel[k + 1] = sim.vel[k + 1] * drag + dt * 0.12
      sim.vel[k + 2] *= drag
      sim.pos[k] += sim.vel[k] * dt
      sim.pos[k + 1] = Math.max(0.02, sim.pos[k + 1] + sim.vel[k + 1] * dt)
      sim.pos[k + 2] += sim.vel[k + 2] * dt
      sim.life[i] -= dt / 1.8
      if (sim.life[i] <= 0) sim.pos[k + 1] = -99
    }
    const p = pointsRef.current
    if (p) {
      p.visible = alive > 0
      if (alive > 0 || sim.alive > 0) sim.geo.attributes.position.needsUpdate = true
    }
    sim.alive = alive
  })

  const onTake = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (ext.mode === 'hook') labExtinguisher.take()
  }

  return (
    <>
      {/* Крючок-кронштейн и табличка ТБ на передней стене */}
      <group position={[HOOK_X, 0, ROOM.frontZ + 0.012]}>
        <mesh position={[0, HOOK_Y + 0.5, 0.02]} material={mats.darkMetal}>
          <boxGeometry args={[0.1, 0.05, 0.035]} />
        </mesh>
        <mesh position={[0, HOOK_Y + 0.53, 0.05]} rotation-x={Math.PI / 2} material={mats.darkMetal}>
          <cylinderGeometry args={[0.008, 0.008, 0.06, 8]} />
        </mesh>
        <mesh position={[0, HOOK_Y + 0.88, 0.002]}>
          <planeGeometry args={[0.15, 0.19]} />
          <meshStandardMaterial map={sign} roughness={0.55} />
        </mesh>
      </group>
      {st.mode === 'hook' ? (
        <group
          position={[HOOK_X, HOOK_Y, HOOK_Z]}
          rotation-y={Math.PI}
          onClick={onTake}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHover(true)
          }}
          onPointerOut={() => setHover(false)}
          userData={{ interactive: true }}
        >
          <ExtinguisherModel mats={mats} pinOut={st.pinOut} />
        </group>
      ) : (
        <group ref={handRef} scale={0.62}>
          <ExtinguisherModel mats={mats} pinOut={st.pinOut} />
        </group>
      )}
      <points ref={pointsRef} geometry={sim.geo} material={sim.mat} frustumCulled={false} renderOrder={5} visible={false} />
    </>
  )
}

// Для автоматических кадров (Playwright): …#/vr-lab?debugHand=1 — window.__labExt (взять, чека, струя, очаг пламени)
if (typeof window !== 'undefined' && /[?&]debugHand=1/.test(window.location.hash)) {
  ;(window as unknown as { __labExt?: unknown }).__labExt = { ...labExtinguisher, fire: (at: Vec3Tuple) => addFire(at), fires: () => fires.size }
}
