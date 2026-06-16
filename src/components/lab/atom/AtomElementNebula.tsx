import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  buildSmokeSpriteLayout,
  createAtomVolumetricCloudMaterial,
  smokeVolumeLayers,
} from './atomNebulaMaterial'
import { createSmokePuffTexture, createSmokeWispTexture } from './smokeSoftTexture'
import { hexToThreeColor } from './atomCosmicShared'

function deformCloudGeometry(geo: THREE.BufferGeometry, seed: number): THREE.BufferGeometry {
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let j = 0; j < pos.count; j++) {
    const x = pos.getX(j)
    const y = pos.getY(j)
    const z = pos.getZ(j)
    const n =
      Math.sin(x * 3.8 + seed) * 0.14 +
      Math.cos(y * 3.2 + seed * 1.4) * 0.12 +
      Math.sin(z * 4.5 + seed * 0.6) * 0.13
    const len = Math.sqrt(x * x + y * y + z * z) || 1
    const s = 1 + n
    pos.setXYZ(j, (x / len) * s, (y / len) * s * 0.88, (z / len) * s * 0.94)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/** Полноценное объёмное облако: шейдерные слои + мягкие спрайты (без квадратных пикселей). */
export function AtomElementNebula({
  accentHex,
  lite = false,
  outerOrbitR = 1,
}: {
  accentHex: string
  lite?: boolean
  scale?: number
  outerOrbitR?: number
}) {
  const groupRef = useRef<THREE.Group>(null)
  const spread = Math.min(outerOrbitR * 0.5, lite ? 0.36 : 0.46)
  const baseColor = useMemo(() => hexToThreeColor(accentHex), [accentHex])

  const puffTex = useMemo(() => createSmokePuffTexture(128), [])
  const wispTex = useMemo(() => createSmokeWispTexture(256), [])

  const layers = useMemo(() => smokeVolumeLayers(lite), [lite])

  const volumeMats = useMemo(
    () => layers.map((l) => createAtomVolumetricCloudMaterial(accentHex, l.seed, l.layer)),
    [accentHex, layers],
  )

  const volumeGeos = useMemo(
    () =>
      layers.map((l) =>
        deformCloudGeometry(
          new THREE.IcosahedronGeometry(1, lite ? 3 : 4),
          l.seed,
        ),
      ),
    [layers, lite],
  )

  const sprites = useMemo(() => {
    const count = lite ? 22 : 38
    return buildSmokeSpriteLayout(count, spread, accentHex.length * 13)
  }, [accentHex, lite, spread])

  useEffect(() => {
    return () => {
      volumeMats.forEach((m) => m.dispose())
      volumeGeos.forEach((g) => g.dispose())
      puffTex.dispose()
      wispTex.dispose()
    }
  }, [volumeMats, volumeGeos, puffTex, wispTex])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    volumeMats.forEach((m) => {
      m.uniforms.uTime.value = t
    })
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.035
    }
  })

  return (
    <group ref={groupRef} renderOrder={-5}>
      {layers.map((layer, i) => (
        <mesh
          key={`vol-${i}`}
          geometry={volumeGeos[i]}
          position={[
            layer.offset[0] * spread,
            layer.offset[1] * spread,
            layer.offset[2] * spread,
          ]}
          scale={[
            spread * layer.scale * layer.stretch[0],
            spread * layer.scale * layer.stretch[1],
            spread * layer.scale * layer.stretch[2],
          ]}
          renderOrder={-4}
        >
          <primitive object={volumeMats[i]!} attach="material" />
        </mesh>
      ))}

      {sprites.map((s, i) => (
        <sprite
          key={`wisp-${i}`}
          position={s.position}
          scale={[s.scale, s.scale * (0.75 + (i % 5) * 0.06), 1]}
          renderOrder={-3}
        >
          <spriteMaterial
            map={i % 3 === 0 ? wispTex : puffTex}
            color={baseColor}
            transparent
            opacity={s.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            rotation={s.rot}
            sizeAttenuation
          />
        </sprite>
      ))}
    </group>
  )
}
