/**
 * Огонь и нагревательные приборы: живое пламя (шейдер), спиртовка (сосуд, диск, фитиль, колпачок),
 * газовая горелка с газовым краном и шлангом, спичка.
 * Пламя рисуется обычным смешиванием (не аддитивным) — на светлом фоне лаборатории оно остаётся видимым.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LAB_COLORS } from '../../labContract'
import { labEvents, type Vec3Tuple } from '../../labEvents'
import { useRig, type PFn } from '../rigCore'
import { sharedGlass, sharedGlassEdge } from './glassware'

const FLAME_VERT = /* glsl */ `
uniform float uTime;
uniform float uSeed;
varying float vH;
varying vec3 vN;
varying vec3 vV;
void main() {
  vec3 p = position;
  float h = clamp(p.y * 0.5 + 0.5, 0.0, 1.0);
  float taper = mix(1.0, 0.08, pow(h, 1.25));
  p.xz *= taper;
  float w = sin(uTime * 13.0 + uSeed + h * 5.0) * 0.07 + sin(uTime * 7.3 + uSeed * 2.1) * 0.05;
  p.x += w * h * h;
  p.z += sin(uTime * 9.7 + uSeed * 1.3) * 0.04 * h * h;
  p.y = h * (1.0 + 0.1 * sin(uTime * 11.0 + uSeed));
  vH = h;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`

const FLAME_FRAG = /* glsl */ `
uniform vec3 uCore;
uniform vec3 uEdge;
uniform float uIntensity;
uniform float uAlpha;
varying float vH;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = abs(dot(normalize(vN), normalize(vV)));
  float body = pow(f, 1.3);
  float a = body * smoothstep(1.02, 0.45, vH) * smoothstep(0.0, 0.06, vH) * uIntensity * uAlpha;
  vec3 c = mix(uEdge, uCore, body * body);
  if (a < 0.01) discard;
  gl_FragColor = vec4(c, a);
}
`

/**
 * Огнетушитель: сцена шлёт labEvents { type: 'fire', on: false, at } — горящее пламя ближе 0,25 м к точке гаснет
 * и не горит, пока опыт сам его не погасит и не зажжёт снова. Само пламя (высотой от 3 см — спиртовка, горелка,
 * водород у трубки; спичка — нет) сообщает сцене, где горит: 'fire' on: true / on: false.
 */
let douseSeq = 0
const doused: THREE.Vector3[] = []
let selfEmit = false
let douseSubscribed = false
function subscribeDouse() {
  if (douseSubscribed) return
  douseSubscribed = true
  labEvents.on('fire', (e) => {
    if (e.on || !e.at || selfEmit) return
    doused.push(new THREE.Vector3(...e.at))
    if (doused.length > 8) doused.shift()
    douseSeq++
  })
}
const tmpW = new THREE.Vector3()
function useDouse(report: boolean) {
  subscribeDouse()
  const st = useRef({ seq: douseSeq, dead: false, on: false, at: null as Vec3Tuple | null })
  return (raw: number, obj: THREE.Object3D | null, lift = 0): number => {
    const s = st.current
    if (raw < 0.01) {
      s.dead = false
      if (s.on && s.at) {
        selfEmit = true
        labEvents.emit({ type: 'fire', on: false, at: s.at })
        selfEmit = false
      }
      s.on = false
      s.seq = douseSeq
      return raw
    }
    if (s.seq !== douseSeq && obj) {
      obj.getWorldPosition(tmpW)
      for (let i = Math.max(0, doused.length - (douseSeq - s.seq)); i < doused.length; i++) {
        if (tmpW.distanceTo(doused[i]!) < 0.25) s.dead = true
      }
      s.seq = douseSeq
    }
    if (s.dead) {
      s.on = false
      return 0
    }
    if (report && !s.on && raw > 0.3 && obj) {
      obj.getWorldPosition(tmpW)
      s.at = [tmpW.x, tmpW.y + lift, tmpW.z]
      s.on = true
      labEvents.emit({ type: 'fire', on: true, at: s.at })
    }
    return raw
  }
}

/** Пламя: начало — основание, высота height (м), ширина width. intensity(p) — 0 погашено … 1 горит. */
export function Flame({
  height,
  width,
  core,
  edge,
  intensity,
  alpha = 0.85,
  seed = 1,
}: {
  height: number
  width: number
  core: string
  edge: string
  intensity: PFn
  alpha?: number
  seed?: number
}) {
  const { p, time } = useRig()
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: FLAME_VERT,
        fragmentShader: FLAME_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: seed },
          uCore: { value: new THREE.Color(core) },
          uEdge: { value: new THREE.Color(edge) },
          uIntensity: { value: 0 },
          uAlpha: { value: alpha },
        },
      }),
    [core, edge, alpha, seed],
  )
  const ref = useRef<THREE.Mesh>(null)
  const douse = useDouse(height >= 0.03)
  useFrame(() => {
    const k = douse(intensity(p.current ?? 0), ref.current, height * 0.4)
    mat.uniforms.uTime!.value = time.current ?? 0
    mat.uniforms.uIntensity!.value = k
    const m = ref.current
    if (m) {
      m.visible = k > 0.01
      const s = 0.35 + 0.65 * k
      m.scale.set(width * (0.6 + 0.4 * k), height * s, width * (0.6 + 0.4 * k))
    }
  })
  return (
    <mesh ref={ref} material={mat} renderOrder={8}>
      <sphereGeometry args={[0.5, 18, 14]} />
    </mesh>
  )
}

/** Тёплый свет от пламени (только на компьютере). */
export function FlameLight({ intensity, color, power = 0.6 }: { intensity: PFn; color: string; power?: number }) {
  const { p, time, quality } = useRig()
  const ref = useRef<THREE.PointLight>(null)
  const douse = useDouse(false)
  useFrame(() => {
    const l = ref.current
    if (!l) return
    const t = time.current ?? 0
    l.intensity = douse(intensity(p.current ?? 0), l) * power * (0.9 + 0.1 * Math.sin(t * 17))
  })
  if (quality === 'low') return null
  return <pointLight ref={ref} color={color} distance={0.6} decay={2} intensity={0} />
}

/** Спиртовка: сосуд со спиртом, металлический диск, фитиль, колпачок. Начало — центр дна. */
export function SpiritLamp({ flame, capOff }: { flame: PFn; capOff: PFn }) {
  const { quality, p } = useRig()
  const body = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(0.034, 0),
      new THREE.Vector2(0.037, 0.006),
      new THREE.Vector2(0.036, 0.04),
      new THREE.Vector2(0.026, 0.055),
      new THREE.Vector2(0.012, 0.06),
      new THREE.Vector2(0.011, 0.066),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 36 : 20)
  }, [quality])
  const cap = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.016, 0),
      new THREE.Vector2(0.016, 0.03),
      new THREE.Vector2(0.012, 0.038),
      new THREE.Vector2(0.0001, 0.04),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 28 : 16)
  }, [quality])
  const capRef = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = capRef.current
    if (!g) return
    const k = capOff(p.current ?? 0)
    // колпачок поднимается и откладывается в сторону, на стол
    const up = Math.sin(Math.min(1, k) * Math.PI) * 0.06
    g.position.set(0.075 * k, 0.062 + up - 0.062 * k, 0.012 * k)
    g.rotation.set(0, 0, 0)
  })
  return (
    <group>
      <mesh geometry={body} material={sharedGlass(quality)} renderOrder={3} />
        <mesh geometry={body} material={sharedGlassEdge()} renderOrder={4} />
      <mesh position={[0, 0.017, 0]} renderOrder={2}>
        <cylinderGeometry args={[0.033, 0.034, 0.028, 28]} />
        <meshPhysicalMaterial color="#e9f4ff" transparent opacity={0.35} roughness={0.1} depthWrite={false} />
      </mesh>
      {/* металлический диск с трубкой фитиля */}
      <mesh position={[0, 0.066, 0]} castShadow>
        <cylinderGeometry args={[0.0125, 0.0125, 0.003, 22]} />
        <meshStandardMaterial color={LAB_COLORS.metal} metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.072, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.01, 12]} />
        <meshStandardMaterial color={LAB_COLORS.metal} metalness={0.9} roughness={0.25} />
      </mesh>
      {/* фитиль */}
      <mesh position={[0, 0.078, 0]}>
        <cylinderGeometry args={[0.003, 0.0034, 0.008, 10]} />
        <meshStandardMaterial color="#efe9dc" roughness={1} />
      </mesh>
      <mesh position={[0, 0.03, 0]} renderOrder={1}>
        <cylinderGeometry args={[0.0028, 0.0028, 0.05, 8]} />
        <meshStandardMaterial color="#efe9dc" roughness={1} transparent opacity={0.6} />
      </mesh>
      <group position={[0, 0.081, 0]}>
        <Flame height={0.05} width={0.013} core="#fff1c4" edge="#ff9a1f" intensity={flame} seed={2.3} />
        <Flame height={0.014} width={0.008} core="#9cc4ff" edge="#3d76ff" intensity={flame} alpha={0.55} seed={4.1} />
        <group position={[0, 0.02, 0]}>
          <FlameLight intensity={flame} color="#ffb35c" />
        </group>
      </group>
      <group ref={capRef}>
        <mesh geometry={cap} material={sharedGlass(quality)} renderOrder={4} />
        <mesh geometry={cap} material={sharedGlassEdge()} renderOrder={5} />
      </group>
    </group>
  )
}

export const BURNER_TOP = 0.14

/** Газовая горелка (природный газ — метан): основание, трубка, кольцо подачи воздуха, штуцер. Начало — центр основания. */
export function GasBurner({ flame }: { flame: PFn }) {
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: LAB_COLORS.metal, metalness: 0.9, roughness: 0.25 }), [])
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3e4752', metalness: 0.4, roughness: 0.5 }), [])
  return (
    <group>
      <mesh position={[0, 0.006, 0]} material={dark} castShadow receiveShadow>
        <cylinderGeometry args={[0.04, 0.046, 0.012, 32]} />
      </mesh>
      <mesh position={[0, 0.02, 0]} material={steel} castShadow>
        <cylinderGeometry args={[0.012, 0.016, 0.018, 20]} />
      </mesh>
      <mesh position={[0, 0.08, 0]} material={steel} castShadow>
        <cylinderGeometry args={[0.0065, 0.0065, 0.12, 20]} />
      </mesh>
      {/* кольцо подачи воздуха с окошками */}
      <mesh position={[0, 0.04, 0]} material={dark}>
        <cylinderGeometry args={[0.0085, 0.0085, 0.014, 20]} />
      </mesh>
      {/* штуцер для шланга */}
      <mesh position={[0, 0.022, -0.026]} rotation={[Math.PI / 2, 0, 0]} material={steel}>
        <cylinderGeometry args={[0.0035, 0.0035, 0.028, 10]} />
      </mesh>
      <group position={[0, BURNER_TOP, 0]}>
        <Flame height={0.085} width={0.019} core="#cfe0ff" edge="#5a8cff" intensity={flame} alpha={0.55} seed={1.7} />
        <Flame height={0.032} width={0.011} core="#e8f0ff" edge="#1d55ff" intensity={flame} alpha={0.9} seed={3.9} />
        <group position={[0, 0.04, 0]}>
          <FlameLight intensity={flame} color="#8fb5ff" power={0.45} />
        </group>
      </group>
    </group>
  )
}

/** Газовый кран на столе: стойка и красный рычаг (open(p): 0 закрыт … 1 открыт). Начало — основание. */
export function GasTap({ open }: { open: PFn }) {
  const { p } = useRig()
  const lever = useRef<THREE.Group>(null)
  useFrame(() => {
    if (lever.current) lever.current.rotation.y = (-Math.PI / 2) * open(p.current ?? 0)
  })
  return (
    <group>
      <mesh position={[0, 0.006, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.022, 0.012, 20]} />
        <meshStandardMaterial color="#c7cdd4" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.007, 0.007, 0.06, 14]} />
        <meshStandardMaterial color="#c7cdd4" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.06, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.026, 12]} />
        <meshStandardMaterial color="#c7cdd4" metalness={0.8} roughness={0.3} />
      </mesh>
      <group ref={lever} position={[0, 0.074, 0]}>
        <mesh position={[0.018, 0, 0]} castShadow>
          <boxGeometry args={[0.04, 0.007, 0.011]} />
          <meshStandardMaterial color="#e2483d" roughness={0.45} />
        </mesh>
      </group>
    </group>
  )
}

/** Резиновый шланг по точкам (м, локальные координаты установки). */
export function Hose({ points, radius = 0.0045 }: { points: readonly (readonly [number, number, number])[]; radius?: number }) {
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((v) => new THREE.Vector3(v[0], v[1], v[2])))
    return new THREE.TubeGeometry(curve, 48, radius, 10, false)
  }, [points, radius])
  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial color="#d8653f" roughness={0.6} />
    </mesh>
  )
}

/** Спичка: начало — конец палочки, головка в +X. lit(p) — горит. */
export function Match({ lit }: { lit: PFn }) {
  return (
    <group>
      <mesh position={[0.024, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <boxGeometry args={[0.0022, 0.048, 0.0022]} />
        <meshStandardMaterial color="#e6c58f" roughness={0.9} />
      </mesh>
      <mesh position={[0.049, 0, 0]} scale={[1.3, 1, 1]}>
        <sphereGeometry args={[0.0022, 10, 8]} />
        <meshStandardMaterial color="#b3261e" roughness={0.7} />
      </mesh>
      <group position={[0.05, 0.001, 0]}>
        <Flame height={0.022} width={0.008} core="#fff3cf" edge="#ff8a1c" intensity={lit} seed={5.5} />
      </group>
    </group>
  )
}

/** Коробок спичек. */
export function Matchbox() {
  return (
    <group>
      <mesh position={[0, 0.008, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.052, 0.016, 0.036]} />
        <meshStandardMaterial color="#f3efe6" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.008, 0.0182]}>
        <planeGeometry args={[0.048, 0.012]} />
        <meshStandardMaterial color="#6d4b3a" roughness={1} />
      </mesh>
      <mesh position={[0, 0.0162, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.044, 0.028]} />
        <meshStandardMaterial color={LAB_COLORS.accent} roughness={0.6} />
      </mesh>
    </group>
  )
}
