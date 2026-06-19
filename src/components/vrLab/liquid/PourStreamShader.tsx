import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clamp01, easeOutCubic } from '../../../vrLab/vrLabAnimation'
import type { LiquidVisual } from '../VrLabLiquid'

const SEGMENTS = 16
const VERTEX_SHADER = /* glsl */ `
  attribute float aAlong;
  attribute float aSide;
  uniform float uProgress;
  uniform vec3 uFrom;
  uniform vec3 uTo;
  uniform float uArc;
  uniform float uWidth;
  varying float vAlong;
  varying float vAlpha;

  void main() {
    vAlong = aAlong;
    float t = aAlong * uProgress;
    vec3 p = mix(uFrom, uTo, t);
    p.y += sin(t * 3.14159265) * uArc;
    vec3 tangent = normalize(uTo - uFrom + vec3(0.001, 0.001, 0.001));
    vec3 binormal = normalize(cross(tangent, vec3(0.0, 1.0, 0.0)));
    if (length(binormal) < 0.01) binormal = vec3(1.0, 0.0, 0.0);
    float w = uWidth * (1.0 - t * 0.45);
    p += binormal * aSide * w;
    vAlpha = smoothstep(0.0, 0.07, t) * smoothstep(1.0, 0.85, t);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uEmissive;
  uniform float uGlow;
  uniform float uOpacity;
  varying float vAlong;
  varying float vAlpha;

  void main() {
    float alpha = vAlpha * uOpacity;
    if (alpha < 0.02) discard;
    vec3 col = mix(uColor, uEmissive, 0.45) * (0.75 + uGlow * 0.35);
    gl_FragColor = vec4(col, alpha);
  }
`

function buildRibbonGeometry(): THREE.BufferGeometry {
  const vertCount = (SEGMENTS + 1) * 2
  const positions = new Float32Array(vertCount * 3)
  const along = new Float32Array(vertCount)
  const side = new Float32Array(vertCount)
  const indices: number[] = []

  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS
    const base = i * 2
    along[base] = t
    along[base + 1] = t
    side[base] = -1
    side[base + 1] = 1
    if (i < SEGMENTS) {
      const a = base
      const b = base + 1
      const c = base + 2
      const d = base + 3
      indices.push(a, b, c, b, d, c)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1))
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1))
  geo.setIndex(indices)
  return geo
}

const FROM = new THREE.Vector3()
const TO = new THREE.Vector3()
const DROP_POS = new THREE.Vector3()

type Props = {
  active: boolean
  visual: LiquidVisual
  from: [number, number, number]
  to: [number, number, number]
  progress: number
  /** Скорость потока 0..1 от computePourFlow; при наличии заменяет progress для визуала. */
  flowRate?: number
  arc?: number
  radius?: number
}

/** Шейдерная струя — 32 вершины вместо TubeGeometry. */
export function PourStreamShader({
  active,
  visual,
  from,
  to,
  progress,
  flowRate,
  arc = 0.12,
  radius = 0.013,
}: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const dropRef = useRef<THREE.Mesh>(null)
  const streamT = flowRate != null ? clamp01(flowRate) : clamp01(progress)
  const t = streamT

  const geometry = useMemo(() => buildRibbonGeometry(), [])

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uFrom: { value: new THREE.Vector3() },
      uTo: { value: new THREE.Vector3() },
      uArc: { value: arc },
      uWidth: { value: radius * 1.8 },
      uColor: { value: new THREE.Color(visual.liquidColor) },
      uEmissive: { value: new THREE.Color(visual.emissive) },
      uGlow: { value: visual.glow },
      uOpacity: { value: visual.opacity },
    }),
    [arc, radius, visual.emissive, visual.glow, visual.liquidColor, visual.opacity],
  )

  useFrame(() => {
    if (!active) return
    const eased = flowRate != null ? clamp01(0.12 + streamT * 0.88) : easeOutCubic(t)
    if (flowRate != null && streamT < 0.02) return
    if (flowRate == null && (t >= 1 || t <= 0.01)) return

    if (matRef.current) {
      matRef.current.uniforms.uProgress.value = Math.max(0.08, eased)
      FROM.set(from[0], from[1], from[2])
      TO.set(to[0], to[1], to[2])
      matRef.current.uniforms.uFrom.value.copy(FROM)
      matRef.current.uniforms.uTo.value.copy(TO)
      matRef.current.uniforms.uArc.value = arc
      const flowMul = flowRate != null ? 0.55 + streamT * 0.65 : 1
      matRef.current.uniforms.uWidth.value = radius * 1.8 * flowMul
      matRef.current.uniforms.uOpacity.value =
        visual.opacity * (flowRate != null ? 0.45 + streamT * 0.5 : 0.92 - eased * 0.15)
    }

    if (dropRef.current) {
      const p = Math.min(0.98, eased)
      DROP_POS.lerpVectors(FROM, TO, p)
      DROP_POS.y += Math.sin(p * Math.PI) * arc
      dropRef.current.position.copy(DROP_POS)
      dropRef.current.visible = eased > 0.05 && eased < 0.98
      const scale = radius * (2.2 + Math.sin(eased * Math.PI) * 0.8)
      dropRef.current.scale.setScalar(scale / radius)
    }
  })

  if (!active) return null
  if (flowRate == null && (t >= 1 || t <= 0.01)) return null
  if (flowRate != null && streamT < 0.02) return null

  return (
    <group>
      <mesh geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          ref={matRef}
          vertexShader={VERTEX_SHADER}
          fragmentShader={FRAGMENT_SHADER}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={dropRef}>
        <sphereGeometry args={[radius, 8, 8]} />
        <meshStandardMaterial
          color={visual.liquidColor}
          emissive={visual.emissive}
          emissiveIntensity={visual.glow * 1.6}
          transparent
          opacity={0.95}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/** Локальная струя из горлышка колбы. */
export function PourStreamShaderLocal({
  active,
  visual,
  progress,
  tiltMix = 0,
}: {
  active: boolean
  visual: LiquidVisual
  progress: number
  tiltMix?: number
}) {
  const spoutY = 0.14 + tiltMix * 0.04
  const spoutX = 0.02 + tiltMix * 0.06
  const endY = spoutY - easeOutCubic(clamp01(progress)) * (spoutY - 0.02)

  return (
    <PourStreamShader
      active={active}
      visual={visual}
      from={[spoutX, spoutY, 0.02]}
      to={[spoutX * 0.5, endY, 0]}
      progress={progress}
      arc={0.04}
      radius={0.009}
    />
  )
}
