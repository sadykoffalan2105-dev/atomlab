/**
 * Посуда и эффекты практических работ (реальные размеры, м): штатив с кольцом, воронка, фильтровальная бумага
 * (складывается вчетверо и раскрывается конусом), фарфоровая чашка (кристаллы соли растут по краям), ступка
 * с пестиком, стеклянная палочка, пипетка-капельница и склянка-капельница, пробирка с «расплывающейся» окраской,
 * лакмусовая бумажка в пинцете, поднос со средствами защиты, изогнутая газоотводная трубка,
 * облака частиц (пар, белый дым NH₄Cl), падающие капли и крупинки.
 * Всё — функции прогресса p (rigCore): анимация обратима и не «телепортирует» предметы.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LAB_COLORS, labLiquidMaterial } from '../../labContract'
import { clamp01, seg, smooth, useRig, type PFn, type V3 } from '../rigCore'
import { sharedGlass, sharedGlassEdge, TUBE_H, TUBE_R } from './glassware'

const porcelainMat = () => new THREE.MeshStandardMaterial({ color: '#fbfbf8', roughness: 0.32, metalness: 0 })

/* ── Штатив с кольцом ── */
export function RingStand({ rodX, ringX, ringY, ringR, rodH = 0.36 }: { rodX: number; ringX: number; ringY: number; ringR: number; rodH?: number }) {
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4f5b68', roughness: 0.55, metalness: 0.2 }), [])
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: LAB_COLORS.metal, roughness: 0.28, metalness: 0.85 }), [])
  const dir = ringX >= rodX ? 1 : -1
  const armEnd = ringX - dir * ringR
  const armLen = Math.abs(armEnd - rodX)
  return (
    <group>
      <mesh position={[rodX + dir * 0.03, 0.007, 0]} material={paint} castShadow receiveShadow>
        <boxGeometry args={[0.18, 0.014, 0.12]} />
      </mesh>
      <mesh position={[rodX, 0.014 + rodH / 2, 0]} material={steel} castShadow>
        <cylinderGeometry args={[0.0055, 0.0055, rodH, 14]} />
      </mesh>
      <mesh position={[rodX, ringY, 0]} material={paint} castShadow>
        <boxGeometry args={[0.022, 0.024, 0.022]} />
      </mesh>
      <mesh position={[rodX, ringY, 0.015]} rotation={[Math.PI / 2, 0, 0]} material={steel}>
        <cylinderGeometry args={[0.0025, 0.0025, 0.014, 8]} />
      </mesh>
      <mesh position={[(rodX + armEnd) / 2, ringY, 0]} rotation={[0, 0, Math.PI / 2]} material={steel} castShadow>
        <cylinderGeometry args={[0.003, 0.003, armLen, 8]} />
      </mesh>
      <mesh position={[ringX, ringY, 0]} rotation={[Math.PI / 2, 0, 0]} material={steel} castShadow>
        <torusGeometry args={[ringR, 0.0026, 8, 40]} />
      </mesh>
    </group>
  )
}

/* ── Воронка (начало — место перехода конуса в трубку; конус вверх до 6 см, трубка вниз 11 см) ── */
export const FUNNEL = { coneH: 0.06, rimR: 0.038, stem: 0.11 } as const
export function Funnel() {
  const { quality } = useRig()
  const geo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.0031, -FUNNEL.stem),
      new THREE.Vector2(0.0035, -0.02),
      new THREE.Vector2(0.0052, 0),
      new THREE.Vector2(FUNNEL.rimR, FUNNEL.coneH - 0.002),
      new THREE.Vector2(FUNNEL.rimR + 0.002, FUNNEL.coneH),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 36 : 20)
  }, [quality])
  return (
    <group>
      <mesh geometry={geo} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={geo} material={sharedGlassEdge()} renderOrder={4} />
    </group>
  )
}

/**
 * Фильтровальная бумага: квадрат на столе → сложен пополам → вчетверо → конус (fold 0…1).
 * Конус: начало — вершина; wet — бумага намокает (сереет), fill — уровень мутного раствора в фильтре (0…1),
 * dirt — слой песка на стенках.
 */
const PAPER_S = 0.075
export const FILTER_CONE = { r: 0.032, h: 0.05 } as const
export function FilterPaper({ fold, wet, fill, dirt, liquidColor = '#cdbf9e', dirtColor = '#a88a5c' }: { fold: PFn; wet: PFn; fill: PFn; dirt: PFn; liquidColor?: string; /** Цвет слоя на фильтре: песок, белый AgCl/BaSO₄, голубой Cu(OH)₂, красная медь. */ dirtColor?: string }) {
  const { p } = useRig()
  const paper = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fbfbf9', roughness: 0.95, side: THREE.DoubleSide }), [])
  const cone = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fbfbf9', roughness: 0.95, side: THREE.DoubleSide, transparent: true }), [])
  const liq = useMemo(() => labLiquidMaterial(liquidColor, 0.8), [liquidColor])
  const sand = useMemo(() => new THREE.MeshStandardMaterial({ color: dirtColor, roughness: 1, side: THREE.DoubleSide }), [dirtColor])
  const flat = useRef<THREE.Group>(null)
  const h1l = useRef<THREE.Group>(null)
  const h1r = useRef<THREE.Group>(null)
  const h2 = useRef<THREE.Group>(null)
  const coneG = useRef<THREE.Group>(null)
  const liqM = useRef<THREE.Mesh>(null)
  const sandM = useRef<THREE.Mesh>(null)
  const dry = useMemo(() => new THREE.Color('#fbfbf9'), [])
  const wetC = useMemo(() => new THREE.Color('#d9dcdf'), [])
  useFrame(() => {
    const pv = p.current ?? 0
    const f = fold(pv)
    const k1 = smooth(seg(f, 0, 0.38))
    const k2 = smooth(seg(f, 0.38, 0.72))
    const k3 = smooth(seg(f, 0.72, 1))
    if (h1l.current) h1l.current.rotation.x = Math.PI * k1
    if (h1r.current) h1r.current.rotation.x = Math.PI * k1
    if (h2.current) h2.current.rotation.z = Math.PI * k2
    if (flat.current) {
      flat.current.visible = k3 < 0.5
      flat.current.scale.setScalar(1 - 0.3 * k3)
    }
    if (coneG.current) {
      coneG.current.visible = k3 > 0.02
      coneG.current.scale.set(0.4 + 0.6 * k3, k3, 0.4 + 0.6 * k3)
    }
    const w = wet(pv)
    cone.color.copy(dry).lerp(wetC, w)
    cone.opacity = 1 - 0.12 * w
    const fl = clamp01(fill(pv))
    // слой и раствор — конусы вершиной вниз от вершины фильтра (внутри бумаги, а не под ней)
    if (liqM.current) {
      liqM.current.visible = fl > 0.02
      liqM.current.scale.set(fl, fl, fl)
      liqM.current.position.y = (FILTER_CONE.h * 0.92 * fl) / 2
    }
    const d = dirt(pv)
    if (sandM.current) {
      sandM.current.visible = d > 0.02
      // подобный фильтру конус (чуть уже — не сквозь бумагу): слой растёт от вершины вверх
      const k = Math.max(0.01, 0.75 * d)
      sandM.current.scale.set(0.97 * k, k, 0.97 * k)
      sandM.current.position.y = (FILTER_CONE.h * 0.55 * k) / 2
    }
  })
  const q = PAPER_S / 2
  const quad = (x: number, z: number, y: number) => (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} material={paper} castShadow receiveShadow>
      <planeGeometry args={[q, q]} />
    </mesh>
  )
  return (
    <group>
      {/* плоский лист со сгибами */}
      <group ref={flat} position={[0, 0.0012, 0]}>
        {quad(-q / 2, q / 2, 0)}
        <group ref={h1l}>{quad(-q / 2, -q / 2, 0.0004)}</group>
        <group ref={h2}>
          {quad(q / 2, q / 2, 0.0008)}
          <group ref={h1r}>{quad(q / 2, -q / 2, 0.0012)}</group>
        </group>
      </group>
      {/* конус фильтра (вершина в начале координат) */}
      <group ref={coneG}>
        <mesh position={[0, FILTER_CONE.h / 2, 0]} rotation={[Math.PI, 0, 0]} material={cone} castShadow>
          <coneGeometry args={[FILTER_CONE.r, FILTER_CONE.h, 32, 1, true]} />
        </mesh>
        {/* песок на стенках — тонкий тёмный конус у вершины */}
        <mesh ref={sandM} rotation={[Math.PI, 0, 0]} material={sand}>
          <coneGeometry args={[FILTER_CONE.r * 0.55, FILTER_CONE.h * 0.55, 24, 1, true]} />
        </mesh>
        {/* раствор в фильтре: конус, подобный фильтру */}
        <group>
          <mesh ref={liqM} rotation={[Math.PI, 0, 0]} material={liq} renderOrder={2}>
            <coneGeometry args={[FILTER_CONE.r * 0.92, FILTER_CONE.h * 0.92, 24, 1, false]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

/* ── Фарфоровая чашка для выпаривания (начало — дно; сферическая чаша) ── */
const DISH_R = 0.05
export const DISH_H = 0.027
const dishRadiusAt = (y: number) => Math.sqrt(Math.max(0, DISH_R * DISH_R - (DISH_R - y) * (DISH_R - y)))
export function PorcelainDish({ level, crystals, boil, liquidColor = '#e8f3ff' }: { level: PFn; crystals: PFn; boil: PFn; liquidColor?: string }) {
  const { quality, p, time } = useRig()
  const mat = useMemo(porcelainMat, [])
  const geo = useMemo(() => {
    const pts: THREE.Vector2[] = [new THREE.Vector2(0.0001, -0.002), new THREE.Vector2(0.012, -0.002)]
    for (let i = 0; i <= 12; i++) {
      const y = 0.002 + (i / 12) * (DISH_H - 0.002)
      pts.push(new THREE.Vector2(dishRadiusAt(y) + 0.0022, y))
    }
    pts.push(new THREE.Vector2(dishRadiusAt(DISH_H) + 0.001, DISH_H + 0.0012))
    for (let i = 12; i >= 0; i--) {
      const y = 0.002 + (i / 12) * (DISH_H - 0.002)
      pts.push(new THREE.Vector2(Math.max(0.0001, dishRadiusAt(y)), y))
    }
    return new THREE.LatheGeometry(pts, quality === 'high' ? 40 : 22)
  }, [quality])
  const liq = useMemo(() => labLiquidMaterial(liquidColor, 0.62), [liquidColor])
  const liqRef = useRef<THREE.Mesh>(null)
  // кристаллы: сначала по краю у мениска, потом на дне
  const n = quality === 'high' ? 90 : 40
  const crystalData = useMemo(() => {
    const arr: { pos: THREE.Vector3; rot: THREE.Euler; s: number; thr: number }[] = []
    for (let i = 0; i < n; i++) {
      const a = (i * 2.399963) % (Math.PI * 2)
      const edge = i < n * 0.6
      const y = edge ? 0.012 + ((i * 7) % 10) * 0.0011 : 0.0035 + ((i * 3) % 4) * 0.0008
      const rr = edge ? dishRadiusAt(y) - 0.0012 : ((i * 13) % 17) / 17 * dishRadiusAt(0.006) * 0.8
      arr.push({
        pos: new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr),
        rot: new THREE.Euler(i * 0.7, i * 1.3, i * 0.4),
        s: 0.0016 + ((i * 5) % 7) * 0.00028,
        thr: edge ? (i / (n * 0.6)) * 0.55 : 0.45 + ((i - n * 0.6) / (n * 0.4)) * 0.5,
      })
    }
    return arr
  }, [n])
  const inst = useRef<THREE.InstancedMesh>(null)
  const bubbles = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const nb = quality === 'high' ? 24 : 10
  useFrame(() => {
    const pv = p.current ?? 0
    const lv = level(pv)
    const m = liqRef.current
    if (m) {
      m.visible = lv > 0.0008
      const r = dishRadiusAt(Math.max(0.0005, lv))
      m.scale.set(r, 1, r)
      m.position.y = lv
    }
    const c = crystals(pv)
    const im = inst.current
    if (im) {
      crystalData.forEach((d, i) => {
        const k = smooth(clamp01((c - d.thr) / 0.18))
        dummy.position.copy(d.pos)
        dummy.rotation.copy(d.rot)
        dummy.scale.setScalar(Math.max(1e-4, d.s * k))
        dummy.updateMatrix()
        im.setMatrixAt(i, dummy.matrix)
      })
      im.instanceMatrix.needsUpdate = true
    }
    const b = boil(pv)
    const bm = bubbles.current
    if (bm) {
      const t = time.current ?? 0
      const r = dishRadiusAt(Math.max(0.0005, lv)) * 0.85
      for (let i = 0; i < nb; i++) {
        const ph = (t * (1.6 + (i % 5) * 0.3) + i * 0.37) % 1
        const a = i * 2.1 + Math.floor(t * 1.3 + i) * 1.7
        const rr = r * (((i * 7) % 10) / 10)
        dummy.position.set(Math.cos(a) * rr, lv + 0.0006, Math.sin(a) * rr)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(Math.max(1e-4, b * 0.0016 * Math.sin(ph * Math.PI)))
        dummy.updateMatrix()
        bm.setMatrixAt(i, dummy.matrix)
      }
      bm.instanceMatrix.needsUpdate = true
      bm.visible = b > 0.02 && lv > 0.002
    }
  })
  return (
    <group>
      <mesh geometry={geo} material={mat} castShadow receiveShadow />
      <mesh ref={liqRef} rotation={[-Math.PI / 2, 0, 0]} material={liq} renderOrder={2}>
        <circleGeometry args={[1, 32]} />
      </mesh>
      <instancedMesh ref={inst} args={[undefined, undefined, n]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.25} metalness={0} emissive="#f2f6fa" emissiveIntensity={0.15} />
      </instancedMesh>
      <instancedMesh ref={bubbles} args={[undefined, undefined, nb]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.65} roughness={0.05} depthWrite={false} />
      </instancedMesh>
    </group>
  )
}

/* ── Ступка с пестиком ── */
export const MORTAR = { r: 0.042, h: 0.042 } as const
export function Mortar({ powder, mix }: { powder: PFn; mix: PFn }) {
  const { quality, p } = useRig()
  const mat = useMemo(porcelainMat, [])
  const geo = useMemo(() => {
    const R = MORTAR.r
    const H = MORTAR.h
    const pts = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(R * 0.62, 0),
      new THREE.Vector2(R * 0.66, 0.006),
      new THREE.Vector2(R * 0.92, H * 0.55),
      new THREE.Vector2(R, H),
      new THREE.Vector2(R - 0.004, H + 0.001),
    ]
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2)
      pts.push(new THREE.Vector2(Math.max(0.0001, (R - 0.005) * Math.sin(Math.PI / 2 - a)), H - (H - 0.012) * Math.sin(a)))
    }
    return new THREE.LatheGeometry(pts, quality === 'high' ? 40 : 22)
  }, [quality])
  const white = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f7f7f4', roughness: 1 }), [])
  const grey = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e7e9ec', roughness: 1 }), [])
  const a = useRef<THREE.Mesh>(null)
  const b = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const pv = p.current ?? 0
    const k = powder(pv)
    const m = mix(pv)
    for (const [ref, side] of [[a, -1], [b, 1]] as const) {
      const o = ref.current
      if (!o) continue
      o.visible = k > 0.02
      o.position.set(side * 0.011 * (1 - m), 0.014 + 0.004 * k, 0)
      o.scale.set(0.017 * (1 + 0.5 * m) * k + 1e-4, 0.0075 * k * (1 - 0.35 * m) + 1e-4, 0.017 * (1 + 0.3 * m) * k + 1e-4)
    }
  })
  return (
    <group>
      <mesh geometry={geo} material={mat} castShadow receiveShadow />
      <mesh ref={a} material={white}>
        <sphereGeometry args={[1, 16, 10]} />
      </mesh>
      <mesh ref={b} material={grey}>
        <sphereGeometry args={[1, 16, 10]} />
      </mesh>
    </group>
  )
}

/** Пестик (начало — низ головки). */
export function Pestle() {
  const mat = useMemo(porcelainMat, [])
  return (
    <group>
      <mesh position={[0, 0.009, 0]} material={mat} castShadow>
        <sphereGeometry args={[0.011, 16, 12]} />
      </mesh>
      <mesh position={[0, 0.05, 0]} material={mat} castShadow>
        <cylinderGeometry args={[0.006, 0.009, 0.08, 16]} />
      </mesh>
    </group>
  )
}

/* ── Стеклянная палочка (начало — нижний конец, вдоль +Y) ── */
export function GlassRod({ length = 0.2, wetColor }: { length?: number; wetColor?: string }) {
  const { quality } = useRig()
  return (
    <group>
      <mesh position={[0, length / 2, 0]} material={sharedGlass(quality)} renderOrder={3}>
        <cylinderGeometry args={[0.0028, 0.0028, length, 10]} />
      </mesh>
      <mesh position={[0, length / 2, 0]} material={sharedGlassEdge()} renderOrder={4}>
        <cylinderGeometry args={[0.0028, 0.0028, length, 10]} />
      </mesh>
      {wetColor ? (
        <mesh position={[0, 0.003, 0]}>
          <sphereGeometry args={[0.0036, 10, 8]} />
          <meshStandardMaterial color={wetColor} transparent opacity={0.6} roughness={0.05} />
        </mesh>
      ) : null}
    </group>
  )
}

/* ── Пипетка-капельница (начало — кончик) и склянка-капельница ── */
export function Pipette({ color, squeeze }: { color: string; squeeze: PFn }) {
  const { quality, p } = useRig()
  const geo = useMemo(() => {
    const pts = [new THREE.Vector2(0.0009, 0), new THREE.Vector2(0.0013, 0.0005), new THREE.Vector2(0.0034, 0.02), new THREE.Vector2(0.0034, 0.07)]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 16 : 10)
  }, [quality])
  const liq = useMemo(() => labLiquidMaterial(color, 0.75), [color])
  const bulb = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const k = squeeze(p.current ?? 0)
    if (bulb.current) bulb.current.scale.set(1 - 0.35 * k, 1 + 0.12 * k, 1 - 0.35 * k)
  })
  return (
    <group>
      <mesh geometry={geo} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={geo} material={sharedGlassEdge()} renderOrder={4} />
      <mesh position={[0, 0.018, 0]} material={liq} renderOrder={2}>
        <cylinderGeometry args={[0.0026, 0.0012, 0.03, 10]} />
      </mesh>
      <mesh ref={bulb} position={[0, 0.082, 0]} castShadow>
        <capsuleGeometry args={[0.0062, 0.012, 6, 14]} />
        <meshStandardMaterial color="#c0392b" roughness={0.55} />
      </mesh>
    </group>
  )
}

/** Склянка-капельница (начало — дно): тёмное стекло для бромной воды, светлое — для остальных. */
export const DROPPER_H = 0.062
export function DropperBottle({ color, label, amber = false }: { color: string; label: string; amber?: boolean }) {
  const { quality } = useRig()
  const geo = useMemo(() => {
    const r = 0.019
    const pts = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(r - 0.002, 0),
      new THREE.Vector2(r, 0.003),
      new THREE.Vector2(r, 0.04),
      new THREE.Vector2(0.008, 0.052),
      new THREE.Vector2(0.0075, DROPPER_H),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 28 : 16)
  }, [quality])
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 96
    const g = c.getContext('2d')
    if (g) {
      g.fillStyle = '#fbfaf6'
      g.fillRect(0, 0, 256, 96)
      g.fillStyle = LAB_COLORS.accent
      g.fillRect(0, 0, 256, 12)
      g.fillStyle = '#1d2733'
      g.textAlign = 'center'
      g.font = '700 46px system-ui, "Segoe UI", Arial, sans-serif'
      g.fillText(label, 128, 70)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [label])
  const glass = useMemo(() => {
    if (!amber) return sharedGlass(quality)
    return new THREE.MeshStandardMaterial({ color: '#8a5a2b', transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide })
  }, [amber, quality])
  const liq = useMemo(() => labLiquidMaterial(color, 0.7), [color])
  return (
    <group>
      <mesh geometry={geo} material={glass} renderOrder={3} castShadow />
      <mesh geometry={geo} material={sharedGlassEdge()} renderOrder={4} />
      <mesh position={[0, 0.019, 0]} material={liq} renderOrder={2}>
        <cylinderGeometry args={[0.0168, 0.0168, 0.034, 20]} />
      </mesh>
      <mesh position={[0, 0.022, 0]} rotation={[0, -0.9, 0]}>
        <cylinderGeometry args={[0.0193, 0.0193, 0.02, 20, 1, true, 0, 1.8]} />
        <meshStandardMaterial map={tex} roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/**
 * Пробирка, в которой окраска расплывается сверху вниз: stages — [начало, конец, цвет]; на отрезке новый цвет
 * спускается от поверхности (полоса растёт), после конца — весь раствор этого цвета. level — уровень (м).
 */
export type ColorStage = readonly [number, number, string]
export function ColorTube({ base, stages, level }: { base: string; stages: readonly ColorStage[]; level: PFn }) {
  const { quality, p } = useRig()
  const glassGeo = useMemo(() => {
    const r = TUBE_R
    const h = TUBE_H
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * (Math.PI / 2)
      pts.push(new THREE.Vector2(Math.max(0.0001, r * Math.cos(a)), r + r * Math.sin(a)))
    }
    pts.push(new THREE.Vector2(r, h - 0.003), new THREE.Vector2(r * 1.14, h - 0.0008), new THREE.Vector2(r * 1.12, h), new THREE.Vector2(r * 0.97, h))
    return new THREE.LatheGeometry(pts, quality === 'high' ? 32 : 18)
  }, [quality])
  const lowMat = useMemo(() => labLiquidMaterial(base, 0.66), [base])
  const topMat = useMemo(() => labLiquidMaterial(base, 0.8), [base])
  const cols = useMemo(() => [new THREE.Color(base), ...stages.map((s) => new THREE.Color(s[2]))], [base, stages])
  const low = useRef<THREE.Mesh>(null)
  const hemi = useRef<THREE.Mesh>(null)
  const top = useRef<THREE.Mesh>(null)
  const ri = TUBE_R * 0.86
  useFrame(() => {
    const pv = p.current ?? 0
    const lv = level(pv)
    // текущий цвет «внизу» — последний завершённый этап; «сверху» — идущий этап
    let done = 0
    let frac = 0
    let blend = 0
    stages.forEach((s, i) => {
      if (pv >= s[1]) done = i + 1
      else if (pv > s[0]) {
        const k = (pv - s[0]) / (s[1] - s[0])
        frac = smooth(clamp01(k / 0.75))
        blend = smooth(clamp01((k - 0.6) / 0.4))
        done = Math.max(done, i)
      }
    })
    const cur = cols[done]!
    const next = cols[Math.min(cols.length - 1, done + 1)]!
    const going = frac > 0 && done < stages.length
    lowMat.color.copy(cur)
    if (going) lowMat.color.lerp(next, blend)
    topMat.color.copy(going ? next : cur)
    const has = lv > 0.002
    if (hemi.current) hemi.current.visible = has
    const hh = Math.max(lv - TUBE_R, 0.0001)
    const topH = going ? Math.max(0.0001, hh * frac * 0.9) : 0.0001
    if (low.current) {
      low.current.visible = lv > TUBE_R
      const lh = Math.max(0.0001, hh - (going ? topH : 0))
      low.current.scale.set(1, lh, 1)
      low.current.position.y = TUBE_R + lh / 2
    }
    if (top.current) {
      top.current.visible = going && lv > TUBE_R
      top.current.scale.set(1, topH, 1)
      top.current.position.y = lv - topH / 2
    }
  })
  return (
    <group>
      <mesh geometry={glassGeo} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={glassGeo} material={sharedGlassEdge()} renderOrder={4} />
      <mesh ref={hemi} position={[0, TUBE_R, 0]} material={lowMat} renderOrder={2}>
        <sphereGeometry args={[ri, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
      </mesh>
      <mesh ref={low} material={lowMat} renderOrder={2}>
        <cylinderGeometry args={[ri, ri, 1, 24]} />
      </mesh>
      <mesh ref={top} material={topMat} renderOrder={2}>
        <cylinderGeometry args={[ri, ri, 1, 24]} />
      </mesh>
    </group>
  )
}

/* ── Лакмусовая бумажка в пинцете (начало — кончик бумажки; бумажка вниз от пинцета) ── */
export function LitmusStrip({ blue }: { blue: PFn }) {
  const { p } = useRig()
  const tipMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d4455a', roughness: 0.9, side: THREE.DoubleSide }), [])
  const upMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d4455a', roughness: 0.9, side: THREE.DoubleSide }), [])
  const red = useMemo(() => new THREE.Color('#d4455a'), [])
  const blueC = useMemo(() => new THREE.Color('#3557c9'), [])
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: LAB_COLORS.metal, roughness: 0.3, metalness: 0.85 }), [])
  useFrame(() => {
    const b = blue(p.current ?? 0)
    tipMat.color.copy(red).lerp(blueC, smooth(clamp01(b * 1.6)))
    upMat.color.copy(red).lerp(blueC, smooth(clamp01((b - 0.35) * 1.6)))
  })
  return (
    <group>
      <mesh position={[0, 0.0125, 0]} material={tipMat}>
        <planeGeometry args={[0.012, 0.025]} />
      </mesh>
      <mesh position={[0, 0.0375, 0]} material={upMat}>
        <planeGeometry args={[0.012, 0.025]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.085, s * 0.0016]} rotation={[s * 0.03, 0, 0]} material={steel} castShadow>
          <boxGeometry args={[0.005, 0.085, 0.0012]} />
        </mesh>
      ))}
    </group>
  )
}

/* ── Поднос со средствами защиты: очки, перчатки (и халат на крючке — цветная пометка) ── */
export function PpeTray({ worn, gloves = true, coat = false }: { worn: PFn; gloves?: boolean; coat?: boolean }) {
  const { p } = useRig()
  const items = useRef<THREE.Group>(null)
  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2f7cf6', roughness: 0.4 }), [])
  const lens = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.45, roughness: 0.05, depthWrite: false }), [])
  const nitrile = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5b8de8', roughness: 0.6 }), [])
  useFrame(() => {
    const g = items.current
    if (!g) return
    const k = worn(p.current ?? 0)
    // надели — предметы поднимаются к ученику и исчезают
    g.position.set(0, 0.25 * smooth(k), 0.25 * smooth(k))
    g.scale.setScalar(Math.max(1e-4, 1 - smooth(clamp01((k - 0.3) / 0.7))))
    g.visible = k < 0.999
  })
  return (
    <group>
      <mesh position={[0, 0.004, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.008, 0.1]} />
        <meshStandardMaterial color="#e9eef4" roughness={0.6} />
      </mesh>
      <group ref={items}>
        {/* очки */}
        <group position={[-0.035, 0.018, 0]}>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.016, 0, 0]}>
              <mesh rotation={[Math.PI / 2.3, 0, 0]} material={frame} castShadow>
                <torusGeometry args={[0.013, 0.0022, 8, 24]} />
              </mesh>
              <mesh rotation={[Math.PI / 2.3, 0, 0]} material={lens}>
                <circleGeometry args={[0.013, 20]} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, -0.006, -0.012]} rotation={[0, 0, Math.PI / 2]} material={frame}>
            <cylinderGeometry args={[0.0015, 0.0015, 0.065, 6]} />
          </mesh>
        </group>
        {/* перчатки */}
        {gloves
          ? [0, 1].map((i) => (
              <group key={i} position={[0.035 + i * 0.022, 0.012, 0.004 - i * 0.008]} rotation={[-Math.PI / 2, 0, 0.3 - i * 0.5]}>
                <mesh material={nitrile} castShadow>
                  <capsuleGeometry args={[0.009, 0.026, 4, 10]} />
                </mesh>
                {[-1.5, -0.5, 0.5, 1.5].map((f) => (
                  <mesh key={f} position={[f * 0.0045, 0.026, 0]} material={nitrile}>
                    <capsuleGeometry args={[0.0021, 0.012, 3, 6]} />
                  </mesh>
                ))}
              </group>
            ))
          : null}
        {coat ? (
          <mesh position={[0, 0.011, 0.036]} castShadow>
            <boxGeometry args={[0.07, 0.006, 0.018]} />
            <meshStandardMaterial color="#ffffff" roughness={0.9} />
          </mesh>
        ) : null}
      </group>
    </group>
  )
}

/* ── Изогнутая стеклянная трубка по точкам ── */
export function GlassPath({ points, radius = 0.003 }: { points: readonly V3[]; radius?: number }) {
  const { quality } = useRig()
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((v) => new THREE.Vector3(v[0], v[1], v[2])), false, 'catmullrom', 0.1)
    return new THREE.TubeGeometry(curve, quality === 'high' ? 64 : 28, radius, 10, false)
  }, [points, radius, quality])
  return (
    <group>
      <mesh geometry={geo} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={geo} material={sharedGlassEdge()} renderOrder={4} />
    </group>
  )
}

/**
 * Облако частиц: пар, белый дым, запах (едва видимые струйки). Частицы рождаются у origin, поднимаются
 * (rise), расходятся (spread) и сносятся (drift); rate(p) — интенсивность 0…1.
 */
export function Puffs({
  origin,
  rate,
  color = '#ffffff',
  count,
  rise = 0.12,
  spread = 0.03,
  drift = [0, 0, 0],
  size = 0.01,
  opacity = 0.5,
  life = 1.6,
}: {
  origin: V3
  rate: PFn
  color?: string
  count: number
  rise?: number
  spread?: number
  drift?: V3
  size?: number
  opacity?: number
  life?: number
}) {
  const { p, time, quality } = useRig()
  const n = quality === 'high' ? count : Math.max(6, Math.round(count * 0.45))
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(() => Array.from({ length: n }, (_, i) => [Math.sin(i * 12.9898) * 0.5 + 0.5, Math.sin(i * 78.233) * 0.5 + 0.5, Math.sin(i * 39.425) * 0.5 + 0.5] as const), [n])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 1, depthWrite: false }), [color, opacity])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const k = rate(p.current ?? 0)
    m.visible = k > 0.01
    if (!m.visible) return
    const t = time.current ?? 0
    for (let i = 0; i < n; i++) {
      const s = seeds[i]!
      const ph = (t / life + i / n) % 1
      const alive = s[2] < k ? 1 : 0
      const a = s[0] * Math.PI * 2 + t * 0.4
      const r = spread * (0.3 + ph) * s[1]
      dummy.position.set(
        origin[0] + Math.cos(a) * r + drift[0] * ph,
        origin[1] + rise * ph + drift[1] * ph,
        origin[2] + Math.sin(a) * r + drift[2] * ph,
      )
      const sc = size * (0.4 + 1.6 * ph) * Math.sin(Math.PI * Math.min(1, ph * 1.15)) * alive
      dummy.scale.setScalar(Math.max(1e-4, sc))
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} material={mat} renderOrder={8} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
    </instancedMesh>
  )
}

/**
 * Падающие капли или крупинки: n штук падают из from в to по очереди на отрезке прогресса [a, b].
 */
export function Falling({ from, toY, a, b, n, color, size = 0.0022, box = false, jitter = 0.004 }: { from: V3; toY: PFn; a: number; b: number; n: number; color: string; size?: number; box?: boolean; jitter?: number }) {
  const { p } = useRig()
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const pv = p.current ?? 0
    const ty = toY(pv)
    m.visible = pv > a && pv < b + 0.05
    if (!m.visible) return
    for (let i = 0; i < n; i++) {
      const start = a + ((b - a) * i) / n
      const k = (pv - start) / ((b - a) / n + 0.06)
      const on = k > 0 && k < 1
      const fall = clamp01(k)
      const jx = Math.sin(i * 7.1) * jitter
      const jz = Math.cos(i * 3.3) * jitter
      dummy.position.set(from[0] + jx * fall, from[1] + (ty - from[1]) * fall * fall, from[2] + jz * fall)
      dummy.rotation.set(i, i * 2, 0)
      dummy.scale.set(size, box ? size : size * 1.35, size)
      if (!on) dummy.scale.setScalar(1e-4)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} frustumCulled={false}>
      {box ? <boxGeometry args={[1, 1, 1]} /> : <sphereGeometry args={[1, 8, 6]} />}
      <meshStandardMaterial color={color} roughness={box ? 0.8 : 0.05} transparent={!box} opacity={box ? 1 : 0.85} />
    </instancedMesh>
  )
}

/** Столбик жидкости в стакане (начало — дно): уровень, цвет и муть меняются с p. */
export function LiquidColumn({ r, level, color, cloud, cloudColor = '#b9a77f' }: { r: number; level: PFn; color: string; cloud?: PFn; cloudColor?: string }) {
  const { p } = useRig()
  const mat = useMemo(() => labLiquidMaterial(color, 0.6), [color])
  const base = useMemo(() => new THREE.Color(color), [color])
  const murk = useMemo(() => new THREE.Color(cloudColor), [cloudColor])
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const pv = p.current ?? 0
    const lv = level(pv)
    const m = ref.current
    if (!m) return
    m.visible = lv > 0.001
    m.scale.set(1, Math.max(0.0001, lv), 1)
    m.position.y = 0.0015 + lv / 2
    const c = cloud ? cloud(pv) : 0
    mat.color.copy(base).lerp(murk, c)
    mat.opacity = 0.55 + 0.35 * c
  })
  return (
    <mesh ref={ref} material={mat} renderOrder={2}>
      <cylinderGeometry args={[r, r, 1, 28]} />
    </mesh>
  )
}

/** Рука ученика (стилизованная ладонь) — для помахивания «запах к себе». Начало — центр ладони. */
export function WaftHand() {
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5b8de8', roughness: 0.6 }), [])
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh material={skin} scale={[1, 1, 0.35]} castShadow>
        <sphereGeometry args={[0.022, 14, 10]} />
      </mesh>
      {[-1.5, -0.5, 0.5, 1.5].map((f) => (
        <mesh key={f} position={[f * 0.0095, 0.03, 0]} material={skin} castShadow>
          <capsuleGeometry args={[0.0042, 0.022, 4, 8]} />
        </mesh>
      ))}
      <mesh position={[0.024, 0.006, 0]} rotation={[0, 0, -0.9]} material={skin}>
        <capsuleGeometry args={[0.0045, 0.016, 4, 8]} />
      </mesh>
    </group>
  )
}

/* ── Рука ученика в нитриловой перчатке, держащая предмет ── */
let gloveMat: THREE.MeshStandardMaterial | null = null
let sleeveMat: THREE.MeshStandardMaterial | null = null
/**
 * Кисть в синей нитриловой перчатке и манжета халата: пальцы обхватывают предмет вокруг локальной оси Y
 * (радиус r), ладонь и запястье — со стороны +X. Видна, пока hold(p) > 0: предмет в руке, а не висит в воздухе.
 */
export function GripHand({ r, hold }: { r: number; hold: PFn }) {
  const { p } = useRig()
  const ref = useRef<THREE.Group>(null)
  const glove = (gloveMat ??= new THREE.MeshStandardMaterial({ color: '#4d79cf', roughness: 0.48, metalness: 0 }))
  const sleeve = (sleeveMat ??= new THREE.MeshStandardMaterial({ color: '#f1f1ec', roughness: 0.85, metalness: 0 }))
  useFrame(() => {
    const g = ref.current
    if (g) g.visible = hold(p.current ?? 0) > 0.02
  })
  const fr = 0.0047
  const wrap = r + fr * 0.95
  return (
    <group ref={ref} userData={{ labHand: true }}>
      {/* ладонь */}
      <mesh position={[wrap + 0.009, -0.004, -0.004]} scale={[0.5, 1, 0.85]} material={glove} castShadow>
        <sphereGeometry args={[0.021, 14, 10]} />
      </mesh>
      {/* четыре пальца обхватывают предмет спереди */}
      {[0.013, 0.004, -0.005, -0.014].map((y, i) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={glove} castShadow>
          <torusGeometry args={[wrap, fr * (i === 3 ? 0.85 : 1), 6, 12, Math.PI * (0.95 - i * 0.04)]} />
        </mesh>
      ))}
      {/* большой палец — сзади */}
      <mesh position={[wrap * 0.35, 0.006, -wrap - 0.002]} rotation={[0, 0, 0.5]} material={glove} castShadow>
        <capsuleGeometry args={[fr * 1.05, 0.016, 4, 8]} />
      </mesh>
      {/* запястье и манжета халата */}
      <mesh position={[wrap + 0.03, -0.012, -0.006]} rotation={[0, 0, 1.25]} material={glove} castShadow>
        <capsuleGeometry args={[0.0125, 0.03, 4, 10]} />
      </mesh>
      <mesh position={[wrap + 0.058, -0.022, -0.008]} rotation={[0, 0, 1.25]} material={sleeve} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.03, 14]} />
      </mesh>
    </group>
  )
}

/* ── Белый экран для сравнения окрасок ── */
/**
 * Белая карточка на двух деревянных ножках-прорезях (начало — середина низа): стоит на столе за штативом
 * с пробирками, чуть откинута назад; на её фоне окраски растворов читаются лучше. Ничего не висит в воздухе.
 */
export function WhiteCard({ w, h = 0.15 }: { w: number; h?: number }) {
  const paper = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fbfbf8', roughness: 0.92 }), [])
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: LAB_COLORS.wood, roughness: 0.62 }), [])
  return (
    <group>
      <mesh position={[0, h / 2 + 0.003, 0]} rotation={[-0.06, 0, 0]} material={paper} receiveShadow>
        <boxGeometry args={[w, h, 0.0016]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - 0.035), 0.006, 0]} material={wood} castShadow receiveShadow>
          <boxGeometry args={[0.04, 0.012, 0.026]} />
        </mesh>
      ))}
    </group>
  )
}
