/**
 * Лабораторная посуда и подставки в реальных размерах (м): пробирка Ø18 × 150 мм, химстакан 100 мл,
 * склянка с реактивом, штатив для пробирок, лабораторный штатив с лапкой, часовое стекло, стеклянная пластинка.
 */
import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LAB_COLORS, labGlassMaterial, labLiquidMaterial } from '../../labContract'
import { useRig, type PFn, type Quality } from '../rigCore'

const glassCache = new Map<Quality, THREE.MeshPhysicalMaterial>()
/** Одно стекло на всю установку (одинаковый вид посуды, меньше материалов). */
export function sharedGlass(q: Quality): THREE.MeshPhysicalMaterial {
  let m = glassCache.get(q)
  if (!m) {
    m = labGlassMaterial(q)
    if (q === 'low') {
      m.opacity = 0.22
      m.color.set('#eaf3fb')
    } else {
      m.color.set('#f6fbff')
      m.roughness = 0.03
    }
    glassCache.set(q, m)
  }
  return m
}

let edgeMat: THREE.ShaderMaterial | null = null
/**
 * Контур стекла (френель): края посуды чуть темнее и голубее — на светлом фоне лаборатории
 * прозрачная посуда остаётся читаемой. Рисуется вторым слоем той же геометрии.
 */
export function sharedGlassEdge(): THREE.ShaderMaterial {
  edgeMat ??= new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color('#5d7690') } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 2.6) * 0.62; gl_FragColor = vec4(uColor, a); }',
  })
  return edgeMat
}

export const TUBE_R = 0.009
export const TUBE_H = 0.15

function tubeProfile(r: number, h: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * (Math.PI / 2)
    pts.push(new THREE.Vector2(Math.max(0.0001, r * Math.cos(a)), r + r * Math.sin(a)))
  }
  pts.push(new THREE.Vector2(r, h - 0.003), new THREE.Vector2(r * 1.14, h - 0.0008), new THREE.Vector2(r * 1.12, h), new THREE.Vector2(r * 0.97, h))
  return pts
}

/**
 * Пробирка (начало координат — дно). level — высота жидкости от дна (м), cloud — муть 0…1 (белая взвесь),
 * liquidColor — цвет раствора.
 */
export function TestTube({
  level,
  liquidColor = '#cfe6fb',
  cloud,
  liquidOpacity = 0.62,
}: {
  level?: PFn
  liquidColor?: THREE.ColorRepresentation
  cloud?: PFn
  liquidOpacity?: number
}) {
  const { quality, p } = useRig()
  const glassGeo = useMemo(() => new THREE.LatheGeometry(tubeProfile(TUBE_R, TUBE_H), quality === 'high' ? 32 : 18), [quality])
  const liqMat = useMemo(() => labLiquidMaterial(liquidColor, liquidOpacity), [liquidColor, liquidOpacity])
  const base = useMemo(() => new THREE.Color(liquidColor), [liquidColor])
  const milk = useMemo(() => new THREE.Color('#dde3ea'), [])
  const hemi = useRef<THREE.Mesh>(null)
  const cyl = useRef<THREE.Mesh>(null)
  const men = useRef<THREE.Mesh>(null)
  const ri = TUBE_R * 0.86
  useFrame(() => {
    const pv = p.current ?? 0
    const lv = level ? level(pv) : 0
    const has = lv > 0.002
    if (hemi.current) hemi.current.visible = has
    if (cyl.current) {
      cyl.current.visible = lv > TUBE_R
      const hh = Math.max(lv - TUBE_R, 0.0001)
      cyl.current.scale.set(1, hh, 1)
      cyl.current.position.y = TUBE_R + hh / 2
    }
    if (men.current) {
      men.current.visible = lv > TUBE_R
      men.current.position.y = lv - 0.0007
    }
    const c = cloud ? cloud(pv) : 0
    liqMat.color.copy(base).lerp(milk, c)
    liqMat.opacity = liquidOpacity + (0.94 - liquidOpacity) * c
    liqMat.roughness = 0.08 + 0.6 * c
  })
  return (
    <group>
      <mesh geometry={glassGeo} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={glassGeo} material={sharedGlassEdge()} renderOrder={4} />
      <mesh ref={hemi} position={[0, TUBE_R, 0]} material={liqMat} renderOrder={2}>
        <sphereGeometry args={[ri, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
      </mesh>
      <mesh ref={cyl} material={liqMat} renderOrder={2}>
        <cylinderGeometry args={[ri, ri, 1, 24]} />
      </mesh>
      <mesh ref={men} rotation={[Math.PI / 2, 0, 0]} material={liqMat} renderOrder={2}>
        <torusGeometry args={[ri * 0.93, 0.0011, 6, 24]} />
      </mesh>
    </group>
  )
}

export const BEAKER_R = 0.026
export const BEAKER_H = 0.072

/** Химический стакан 100 мл (начало — дно). Шкала нанесена белой краской. */
export function Beaker({ children }: { children?: ReactNode }) {
  const { quality } = useRig()
  const geo = useMemo(() => {
    const r = BEAKER_R
    const h = BEAKER_H
    const pts = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(r - 0.003, 0),
      new THREE.Vector2(r, 0.003),
      new THREE.Vector2(r, h - 0.002),
      new THREE.Vector2(r + 0.0025, h),
      new THREE.Vector2(r - 0.0006, h),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 40 : 22)
  }, [quality])
  return (
    <group>
      <mesh geometry={geo} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={geo} material={sharedGlassEdge()} renderOrder={4} />
      {[0.022, 0.034, 0.046, 0.058].map((y, i) => (
        <mesh key={y} position={[0, y, BEAKER_R + 0.0004]}>
          <planeGeometry args={[i % 2 ? 0.006 : 0.011, 0.0011]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
        </mesh>
      ))}
      {children}
    </group>
  )
}

/** Надпись на этикетке — CanvasTexture (без шрифтов из сети). */
function useLabelTexture(formula: string, name: string) {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 160
    const g = c.getContext('2d')
    if (g) {
      g.fillStyle = '#fbfaf6'
      g.fillRect(0, 0, 256, 160)
      g.fillStyle = LAB_COLORS.accent
      g.fillRect(0, 0, 256, 18)
      g.fillStyle = '#1d2733'
      g.textAlign = 'center'
      g.font = '700 64px system-ui, "Segoe UI", Arial, sans-serif'
      g.fillText(formula, 128, 92)
      g.font = '500 24px system-ui, "Segoe UI", Arial, sans-serif'
      g.fillStyle = '#4c5866'
      g.fillText(name, 128, 134)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }, [formula, name])
}

export const BOTTLE_H = 0.118

/**
 * Склянка с реактивом. Начало координат — горлышко (удобно наклонять при переливании):
 * склянка стоит на столе, когда группа поднята на BOTTLE_H.
 */
export function ReagentBottle({ formula, name, level, color = '#e3f2ff' }: { formula: string; name: string; level?: PFn; color?: string }) {
  const { quality, p } = useRig()
  const geo = useMemo(() => {
    const r = 0.028
    const pts = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(r - 0.003, 0),
      new THREE.Vector2(r, 0.004),
      new THREE.Vector2(r, 0.078),
      new THREE.Vector2(r * 0.86, 0.09),
      new THREE.Vector2(0.012, 0.098),
      new THREE.Vector2(0.011, BOTTLE_H - 0.004),
      new THREE.Vector2(0.0128, BOTTLE_H),
      new THREE.Vector2(0.0102, BOTTLE_H),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 36 : 20)
  }, [quality])
  const tex = useLabelTexture(formula, name)
  const liq = useMemo(() => labLiquidMaterial(color, 0.5), [color])
  const liqRef = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const m = liqRef.current
    if (!m) return
    const k = level ? level(p.current ?? 0) : 1
    m.scale.y = Math.max(0.0001, k)
    m.position.y = -BOTTLE_H + 0.003 + (0.058 * k) / 2
    m.visible = k > 0.01
  })
  return (
    <group>
      <group position={[0, -BOTTLE_H, 0]}>
        <mesh geometry={geo} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={geo} material={sharedGlassEdge()} renderOrder={4} />
        <mesh position={[0, 0.045, 0]} rotation={[0, -0.8, 0]}>
          <cylinderGeometry args={[0.0284, 0.0284, 0.042, 24, 1, true, 0, 1.6]} />
          <meshStandardMaterial map={tex} roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <mesh ref={liqRef} material={liq} renderOrder={2}>
        <cylinderGeometry args={[0.025, 0.025, 0.058, 24]} />
      </mesh>
    </group>
  )
}

/** Штатив для пробирок (светлое дерево) с отверстиями на позициях xs. */
export function TubeRack({ xs, holeTop = 0.075 }: { xs: readonly number[]; holeTop?: number }) {
  const w = Math.max(0.16, (Math.max(...xs) - Math.min(...xs)) + 0.08)
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: LAB_COLORS.wood, roughness: 0.62 }), [])
  return (
    <group>
      <mesh position={[cx, 0.006, 0]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[w, 0.012, 0.06]} />
      </mesh>
      <mesh position={[cx, holeTop - 0.004, 0]} material={wood} castShadow>
        <boxGeometry args={[w, 0.008, 0.05]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[cx + (s * (w - 0.012)) / 2, holeTop / 2, 0]} material={wood} castShadow>
          <boxGeometry args={[0.012, holeTop, 0.05]} />
        </mesh>
      ))}
      {xs.map((x) => (
        <mesh key={x} position={[x, holeTop + 0.0002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[TUBE_R * 1.3, 20]} />
          <meshStandardMaterial color="#7a5a3c" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Лабораторный штатив: основание, стержень, муфта и лапка (зажим с пробковыми накладками).
 * rodX — стержень, clampX — центр зажатой пробирки, clampY — высота лапки.
 */
export function LabStand({ rodX, clampX, clampY, rodH = 0.42 }: { rodX: number; clampX: number; clampY: number; rodH?: number }) {
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4f5b68', roughness: 0.55, metalness: 0.2 }), [])
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: LAB_COLORS.metal, roughness: 0.28, metalness: 0.85 }), [])
  const cork = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c49a6c', roughness: 0.9 }), [])
  const armLen = clampX - rodX
  return (
    <group>
      <mesh position={[rodX + 0.03, 0.007, 0]} material={paint} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.014, 0.13]} />
      </mesh>
      <mesh position={[rodX, 0.014 + rodH / 2, 0]} material={steel} castShadow>
        <cylinderGeometry args={[0.0055, 0.0055, rodH, 14]} />
      </mesh>
      {/* муфта */}
      <mesh position={[rodX, clampY, 0]} material={paint} castShadow>
        <boxGeometry args={[0.022, 0.026, 0.022]} />
      </mesh>
      <mesh position={[rodX, clampY, 0.016]} rotation={[Math.PI / 2, 0, 0]} material={steel}>
        <cylinderGeometry args={[0.0025, 0.0025, 0.016, 8]} />
      </mesh>
      {/* стержень лапки */}
      <mesh position={[rodX + armLen / 2 - 0.006, clampY, 0]} rotation={[0, 0, Math.PI / 2]} material={steel} castShadow>
        <cylinderGeometry args={[0.0035, 0.0035, armLen - 0.012, 10]} />
      </mesh>
      {/* губки лапки с пробковыми накладками */}
      {[-1, 1].map((s) => (
        <group key={s} position={[clampX, clampY, s * (TUBE_R + 0.004)]}>
          <mesh material={paint}>
            <boxGeometry args={[0.03, 0.016, 0.004]} />
          </mesh>
          <mesh position={[0, 0, -s * 0.0028]} material={cork}>
            <boxGeometry args={[0.022, 0.014, 0.002]} />
          </mesh>
        </group>
      ))}
      <mesh position={[clampX - 0.019, clampY, 0]} material={paint}>
        <boxGeometry args={[0.008, 0.016, 2 * (TUBE_R + 0.006)]} />
      </mesh>
    </group>
  )
}

/** Часовое стекло (для гранул цинка). */
export function WatchGlass() {
  const { quality } = useRig()
  const geo = useMemo(() => {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 8; i++) {
      const x = 0.0001 + (i / 8) * 0.036
      pts.push(new THREE.Vector2(x, 0.002 + (x * x) / 0.11))
    }
    return new THREE.LatheGeometry(pts, quality === 'high' ? 32 : 18)
  }, [quality])
  return (
    <>
      <mesh geometry={geo} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={geo} material={sharedGlassEdge()} renderOrder={4} />
    </>
  )
}

/** Стеклянная пластинка 9 × 6 см (начало — центр). */
export function GlassPlate() {
  const { quality } = useRig()
  return (
    <mesh material={sharedGlass(quality)} renderOrder={3} castShadow={false}>
      <boxGeometry args={[0.09, 0.003, 0.06]} />
    </mesh>
  )
}

/** Гранула цинка: неровный серебристо-серый комочек. */
export function ZnGranule({ size = 0.0055, seed = 1 }: { size?: number; seed?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(size, 1)
    const pos = g.attributes.position as THREE.BufferAttribute
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const n = Math.sin(v.x * 900 * seed + v.y * 1300) * 0.5 + Math.sin(v.z * 1100 + seed * 3) * 0.5
      v.multiplyScalar(1 + 0.22 * n)
      v.y *= 0.72
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [size, seed])
  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial color="#a7b0b8" metalness={0.85} roughness={0.38} flatShading />
    </mesh>
  )
}

/** Бумажная наклейка с формулой на пробирке (начало — высота наклейки на оси пробирки, лицом к +Z). */
export function TubeTag({ text }: { text: string }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 96
    const g = c.getContext('2d')
    if (g) {
      g.fillStyle = '#fffdf7'
      g.fillRect(0, 0, 128, 96)
      g.strokeStyle = '#d5dbe2'
      g.lineWidth = 4
      g.strokeRect(2, 2, 124, 92)
      g.fillStyle = '#1d2733'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = `700 ${text.length > 4 ? 34 : 42}px system-ui, "Segoe UI", Arial, sans-serif`
      g.fillText(text, 64, 50)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [text])
  return (
    <mesh>
      <cylinderGeometry args={[TUBE_R + 0.0006, TUBE_R + 0.0006, 0.02, 16, 1, true, -0.95, 1.9]} />
      <meshStandardMaterial map={tex} roughness={0.8} side={THREE.DoubleSide} />
    </mesh>
  )
}
