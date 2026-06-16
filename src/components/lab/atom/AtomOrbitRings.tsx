import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import {
  ATOM_MIN_VISUAL_ORBITS,
  ATOM_ORBIT_COLOR,
  ATOM_ORBIT_GLOW,
  buildDecorativeOrbitRadii,
  buildOrbitCurve,
  decorativeOrbitEuler,
  orbitAspect,
  orbitColorsFromAccent,
  shellMajorRadius,
  shellOrbitEuler,
} from './atomCosmicShared'

function ThinOrbitEllipse({
  radius,
  shellIdx,
  segments,
  opacity,
  orbitColor,
  orbitGlow,
  orbitSolid,
  decorative = false,
  eulerOverride,
}: {
  radius: number
  shellIdx: number
  segments: number
  opacity: number
  orbitColor: THREE.Color
  orbitGlow: THREE.Color
  orbitSolid: THREE.Color
  decorative?: boolean
  eulerOverride?: [number, number, number]
}) {
  const aspect = orbitAspect(shellIdx)
  const [eRx, eRy, eRz] = eulerOverride ?? shellOrbitEuler(shellIdx)

  const linePts = useMemo(() => {
    const curve = buildOrbitCurve(radius, segments, aspect)
    return curve.getPoints(segments)
  }, [radius, segments, aspect])

  const glowPts = useMemo(() => {
    const curve = buildOrbitCurve(radius, Math.max(32, Math.floor(segments * 0.6)), aspect)
    return curve.getPoints(Math.max(32, Math.floor(segments * 0.6)))
  }, [radius, segments, aspect])

  const lineOpacity = decorative ? opacity * 0.62 : opacity
  const glowOpacity = decorative ? opacity * 0.26 : opacity * 0.38
  const solidOpacity = decorative ? opacity * 0.88 : Math.min(1, opacity * 1.05)

  return (
    <group rotation={[eRx, eRy, eRz]}>
      <Line
        points={linePts}
        color={orbitSolid}
        transparent
        opacity={solidOpacity}
        depthWrite={false}
        blending={THREE.NormalBlending}
        lineWidth={decorative ? 1.4 : 1.8}
        renderOrder={2}
      />
      <Line
        points={linePts}
        color={orbitColor}
        transparent
        opacity={lineOpacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        lineWidth={decorative ? 1.2 : 1.5}
        renderOrder={1}
      />
      <Line
        points={glowPts}
        color={orbitGlow}
        transparent
        opacity={glowOpacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        lineWidth={decorative ? 2.2 : 2.8}
        renderOrder={0}
      />
    </group>
  )
}

/** Тонкие светящиеся эллиптические орбиты — цвет по CPK элемента. */
export function AtomOrbitRings({
  shells,
  shellMul = 1,
  lite = false,
  synthesisDetail = false,
  accentHex,
}: {
  shells: readonly number[]
  shellMul?: number
  lite?: boolean
  synthesisDetail?: boolean
  electronTotal?: number
  /** CPK / accent — если задан, орбиты совпадают с цветом элемента */
  accentHex?: string
}) {
  const segments = lite ? 48 : synthesisDetail ? 72 : 64
  const opacity = synthesisDetail ? 0.82 : lite ? 0.58 : 0.74

  const { core: orbitColor, glow: orbitGlow, solid: orbitSolid } = useMemo(() => {
    if (accentHex) return orbitColorsFromAccent(accentHex)
    return {
      core: ATOM_ORBIT_COLOR.clone(),
      glow: ATOM_ORBIT_GLOW.clone(),
      solid: ATOM_ORBIT_COLOR.clone(),
    }
  }, [accentHex])

  const orbitSpecs = useMemo(() => {
    const shellRadii: number[] = []
    shells.forEach((count, shellIdx) => {
      if (count > 0) shellRadii.push(shellMajorRadius(shellIdx, shellMul))
    })
    const minOrbits = lite ? 3 : ATOM_MIN_VISUAL_ORBITS
    const radii = buildDecorativeOrbitRadii(shellRadii, minOrbits)
    return radii.map((spec, i) => ({
      ...spec,
      shellIdx: i,
      euler: spec.decorative ? decorativeOrbitEuler(i) : undefined,
    }))
  }, [shells, shellMul, lite])

  return (
    <group>
      {orbitSpecs.map((spec, i) => (
        <ThinOrbitEllipse
          key={`orbit-${i}-${spec.radius.toFixed(3)}`}
          radius={spec.radius}
          shellIdx={spec.shellIdx}
          segments={segments}
          opacity={opacity}
          orbitColor={orbitColor}
          orbitGlow={orbitGlow}
          orbitSolid={orbitSolid}
          decorative={spec.decorative}
          eulerOverride={spec.euler}
        />
      ))}
    </group>
  )
}
