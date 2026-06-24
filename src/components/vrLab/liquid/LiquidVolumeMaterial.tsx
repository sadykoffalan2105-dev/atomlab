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
  uniform float uDensityA;
  uniform float uDensityB;
  uniform float uConcentration;

  varying vec3 vLocalPos;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    float fillH = max(0.02, uFill * uMaxHeight);
    float plane = uTilt.x * vLocalPos.x + uTilt.y * vLocalPos.z + uSlosh.x;
    float surfaceY = uBaseY + fillH + plane;

    float dist = length(vec2(vLocalPos.x, vLocalPos.z)) / max(uRadius, 0.001);
    float meniscus = 0.014 * (1.0 - dist) * max(0.0, dist);

    if (vLocalPos.y > surfaceY + meniscus) discard;
    if (vLocalPos.y < uBaseY - 0.002) discard;

    float depth = clamp((vLocalPos.y - uBaseY) / fillH, 0.0, 1.0);
    float fresnel = pow(1.0 - max(dot(normalize(vNormalW), vViewDir), 0.0), 2.5);

    float swirl = 0.0;
    if (uMixing > 0.5) {
      float angle = atan(vLocalPos.z, vLocalPos.x) + uTime * 3.5;
      swirl = sin(angle * 3.0 + depth * 8.0 + uTime * 4.0) * 0.5 + 0.5;
    }
    float mixT = clamp(uMixRatio + swirl * uMixing * 0.35, 0.0, 1.0);

    float stratify = step(depth, uDensityB / max(uDensityA + uDensityB, 0.001));
    vec3 col = mix(uColorA, uColorB, mix(stratify, mixT, uMixing > 0.5 ? 0.65 : 1.0));

    float wave = sin(vLocalPos.x * 18.0 + uTime * 3.0) * sin(vLocalPos.z * 16.0 + uTime * 2.6);
    float surfaceGlow = smoothstep(surfaceY - 0.025, surfaceY, vLocalPos.y) * (0.35 + wave * 0.08);

    float boil = 0.0;
    float tempNorm = clamp((uTemperature - 20.0) / 80.0, 0.0, 1.0);
    if (tempNorm > 0.15) {
      boil = smoothstep(0.55, 1.0, sin(vLocalPos.x * 24.0 + uTime * 5.0) * sin(vLocalPos.z * 22.0 + uTime * 4.2));
      boil *= tempNorm * 0.45;
    }

    float freeze = 0.0;
    if (uTemperature < 5.0) {
      freeze = smoothstep(5.0, -10.0, uTemperature) * 0.25;
    }

    float caustic = 0.0;
    if (depth < 0.12) {
      vec2 cuv = vec2(vLocalPos.x, vLocalPos.z) * 12.0 + uTime * 0.8;
      caustic = noise(cuv) * noise(cuv * 1.7 + 1.3) * uFill * (0.4 + uConcentration * 0.3);
    }

    vec3 emissive = col * uGlow * (0.35 + depth * 0.45 + surfaceGlow);
    emissive += vec3(1.0, 0.92, 0.75) * boil;
    emissive += vec3(0.85, 0.95, 1.0) * caustic;
    emissive += col * fresnel * 0.18;
    emissive *= 1.0 - freeze;

    float foam = 0.0;
    if (uMixing > 0.5 && vLocalPos.y > surfaceY - 0.018) {
      foam = 0.35 + sin(uTime * 10.0 + vLocalPos.x * 30.0) * 0.12;
    }

    vec3 finalCol = mix(col * 0.55 + emissive, vec3(1.0), foam * 0.35);
    float alpha = uOpacity * (0.88 + fresnel * 0.1) * (0.85 + uConcentration * 0.1);
    if (uMixing > 0.5) {
      finalCol *= 1.0 + sin(uTime * 8.0) * 0.08;
    }

    gl_FragColor = vec4(finalCol, alpha);
  }
`

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
  densityA?: number
  densityB?: number
  concentration?: number
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
  temperature = 20,
  densityA = 1,
  densityB = 1,
  concentration = 0.5,
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
          uDensityA: { value: densityA },
          uDensityB: { value: densityB },
          uConcentration: { value: concentration },
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: true,
      }),
    [
      baseY,
      colorA,
      colorB,
      concentration,
      densityA,
      densityB,
      maxHeight,
      mixRatio,
      mixing,
      radius,
      targetFill,
      temperature,
      visual.glow,
      visual.opacity,
    ],
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
    material.uniforms.uDensityA!.value = densityA
    material.uniforms.uDensityB!.value = densityB
    material.uniforms.uConcentration!.value = concentration
  })

  if (targetFill < 0.008) return null

  return (
    <mesh ref={meshRef} material={material}>
      <cylinderGeometry args={[radiusTop, radiusBottom, maxHeight, 32, 8]} />
    </mesh>
  )
}
