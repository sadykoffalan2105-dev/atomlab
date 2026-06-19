import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { LiquidVisual } from '../VrLabLiquid'

export type SloshState = { tiltX: number; tiltZ: number; sloshX: number; sloshZ: number }

const vertexShader = /* glsl */ `
  varying vec3 vLocalPos;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    vLocalPos = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const fragmentShader = /* glsl */ `
  uniform float uFill;
  uniform vec2 uTilt;
  uniform vec2 uSlosh;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uMixRatio;
  uniform float uGlow;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uMaxHeight;
  uniform float uBaseY;
  uniform float uRadius;
  uniform float uMixing;
  uniform float uTemperature;

  varying vec3 vLocalPos;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    float fillH = max(0.02, uFill * uMaxHeight);
    float plane = uTilt.x * vLocalPos.x + uTilt.y * vLocalPos.z + uSlosh.x;
    float surfaceY = uBaseY + fillH + plane;

    float dist = length(vec2(vLocalPos.x, vLocalPos.z)) / max(uRadius, 0.001);
    float meniscus = 0.014 * (1.0 - dist) * max(0.0, dist);

    if (vLocalPos.y > surfaceY + meniscus) discard;
    if (vLocalPos.y < uBaseY - 0.002) discard;

    vec3 col = mix(uColorA, uColorB, uMixRatio);
    float depth = clamp((vLocalPos.y - uBaseY) / fillH, 0.0, 1.0);
    float fresnel = pow(1.0 - max(dot(normalize(vNormalW), vViewDir), 0.0), 2.5);

    float wave = sin(vLocalPos.x * 18.0 + uTime * 3.0) * sin(vLocalPos.z * 16.0 + uTime * 2.6);
    float surfaceGlow = smoothstep(surfaceY - 0.025, surfaceY, vLocalPos.y) * (0.35 + wave * 0.08);

    float boil = 0.0;
    if (uTemperature > 0.15) {
      boil = smoothstep(0.55, 1.0, sin(vLocalPos.x * 24.0 + uTime * 5.0) * sin(vLocalPos.z * 22.0 + uTime * 4.2));
      boil *= uTemperature * 0.35;
    }

    vec3 emissive = col * uGlow * (0.35 + depth * 0.45 + surfaceGlow);
    emissive += vec3(1.0, 0.92, 0.75) * boil;
    emissive += col * fresnel * 0.18;

    float alpha = uOpacity * (0.88 + fresnel * 0.1);
    if (uMixing > 0.5) {
      emissive *= 1.0 + sin(uTime * 8.0) * 0.12;
    }

    gl_FragColor = vec4(col * 0.55 + emissive, alpha);
  }
`

export type LiquidVolumeUniforms = {
  uFill: number
  uTilt: THREE.Vector2
  uSlosh: THREE.Vector2
  uColorA: THREE.Color
  uColorB: THREE.Color
  uMixRatio: number
  uGlow: number
  uOpacity: number
  uMaxHeight: number
  uBaseY: number
  uRadius: number
  uMixing: number
  uTemperature: number
}

type Props = {
  visual: LiquidVisual
  visualB?: LiquidVisual
  mixRatio?: number
  targetFill: number
  radiusTop: number
  radiusBottom: number
  maxHeight: number
  baseY: number
  tiltX?: number
  tiltZ?: number
  sloshX?: number
  sloshZ?: number
  mixing?: boolean
  temperature?: number
  animateIn?: boolean
  sloshRef?: RefObject<SloshState>
}

export function LiquidVolumeMaterialMesh({
  visual,
  visualB,
  mixRatio = 0,
  targetFill,
  radiusTop,
  radiusBottom,
  maxHeight,
  baseY,
  tiltX = 0,
  tiltZ = 0,
  sloshX = 0,
  sloshZ = 0,
  mixing = false,
  temperature = 0,
  animateIn = false,
  sloshRef,
}: Props) {
  const meshRef = useRef<THREE.Mesh>(null)
  const fillRef = useRef(animateIn ? 0 : targetFill)
  const colorA = useMemo(() => new THREE.Color(visual.liquidColor), [visual.liquidColor])
  const colorB = useMemo(
    () => new THREE.Color(visualB?.liquidColor ?? visual.liquidColor),
    [visualB?.liquidColor, visual.liquidColor],
  )
  const tilt = useMemo(() => new THREE.Vector2(), [])
  const slosh = useMemo(() => new THREE.Vector2(), [])
  const radius = (radiusTop + radiusBottom) * 0.5

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uFill: { value: targetFill },
          uTilt: { value: new THREE.Vector2() },
          uSlosh: { value: new THREE.Vector2() },
          uColorA: { value: colorA.clone() },
          uColorB: { value: colorB.clone() },
          uMixRatio: { value: mixRatio },
          uGlow: { value: visual.glow },
          uOpacity: { value: visual.opacity },
          uTime: { value: 0 },
          uMaxHeight: { value: maxHeight },
          uBaseY: { value: baseY },
          uRadius: { value: radius },
          uMixing: { value: mixing ? 1 : 0 },
          uTemperature: { value: temperature },
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: true,
      }),
    [baseY, colorA, colorB, maxHeight, mixRatio, mixing, radius, targetFill, temperature, visual.glow, visual.opacity],
  )

  useFrame((state, dt) => {
    fillRef.current += (targetFill - fillRef.current) * Math.min(1, dt * (animateIn ? 2.2 : 4.5))
    if (fillRef.current < 0.008 && targetFill < 0.008) {
      if (meshRef.current) meshRef.current.visible = false
      return
    }
    if (meshRef.current) meshRef.current.visible = true

    tilt.set(sloshRef?.current?.tiltX ?? tiltX, sloshRef?.current?.tiltZ ?? tiltZ)
    slosh.set(sloshRef?.current?.sloshX ?? sloshX, sloshRef?.current?.sloshZ ?? sloshZ)
    material.uniforms.uFill!.value = fillRef.current
    material.uniforms.uTilt!.value.copy(tilt)
    material.uniforms.uSlosh!.value.copy(slosh)
    material.uniforms.uColorA!.value.set(visual.liquidColor)
    material.uniforms.uColorB!.value.set(visualB?.liquidColor ?? visual.liquidColor)
    material.uniforms.uMixRatio!.value = mixRatio
    material.uniforms.uGlow!.value = visual.glow
    material.uniforms.uOpacity!.value = visual.opacity
    material.uniforms.uTime!.value = state.clock.elapsedTime
    material.uniforms.uMixing!.value = mixing ? 1 : 0
    material.uniforms.uTemperature!.value = temperature
  })

  if (targetFill < 0.008) return null

  return (
    <mesh ref={meshRef} material={material}>
      <cylinderGeometry args={[radiusTop, radiusBottom, maxHeight, 32, 8]} />
    </mesh>
  )
}
