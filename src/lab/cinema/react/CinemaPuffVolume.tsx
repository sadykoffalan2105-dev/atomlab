import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cinemaQuad } from '../core/geometries'
import { cinemaTexture } from '../core/textures'
import type { PuffVolumeState } from '../core/states'

/**
 * Объёмный газ / туман микромира.
 *
 * Клубы — инстансы одного квада: положение, дрейф, турбулентность и разворот
 * считает вершинный шейдер, поэтому CPU не участвует вообще, а всё облако
 * рисуется одним draw call. Так можно держать зелёное облако Cl₂, янтарный
 * газ ClO₂ и туман под сценой одновременно без просадки кадра.
 */

function buildGeometry(count: number, seed: number): THREE.InstancedBufferGeometry {
  const quad = cinemaQuad()
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = quad.index
  geo.attributes.position = quad.attributes.position!
  geo.attributes.uv = quad.attributes.uv!
  geo.instanceCount = count

  const dirs = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  const scales = new Float32Array(count)

  // Детерминированный генератор: облако выглядит одинаково при каждом запуске урока.
  let s = 9781 + seed * 131
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }

  for (let i = 0; i < count; i++) {
    const theta = rnd() * Math.PI * 2
    const phi = Math.acos(2 * rnd() - 1)
    // Куб радиуса — плотнее к центру, как настоящий клуб газа.
    const r = Math.cbrt(rnd())
    dirs[i * 3] = Math.sin(phi) * Math.cos(theta) * r
    dirs[i * 3 + 1] = Math.cos(phi) * r * 0.72
    dirs[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r
    seeds[i] = rnd()
    scales[i] = 0.6 + rnd() * 0.85
  }

  geo.setAttribute('aDir', new THREE.InstancedBufferAttribute(dirs, 3))
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
  geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1))
  // Инстансы движутся в шейдере — авто-culling по исходному bbox не годится.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40)
  return geo
}

function buildMaterial(blend: 'normal' | 'additive'): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: blend === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uSpread: { value: 1 },
      uRise: { value: 0 },
      uTurb: { value: 0.12 },
      uSize: { value: 0.5 },
      uColor: { value: new THREE.Color(0xffffff) },
      uMap: { value: cinemaTexture('puff') },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aDir;
      attribute float aSeed;
      attribute float aScale;
      uniform float uTime;
      uniform float uSpread;
      uniform float uRise;
      uniform float uTurb;
      uniform float uSize;
      varying vec2 vUv;
      varying float vAlpha;

      void main() {
        float s = aSeed;
        vec3 base = aDir * uSpread;

        // Медленное всплывание/оседание с разбросом по клубам.
        base.y += uRise * (0.45 + s * 1.1);

        // Завихрения: три несинхронных гармоники — рисунок не повторяется.
        base += vec3(
          sin(uTime * 0.62 + s * 11.0),
          cos(uTime * 0.48 + s * 7.3),
          sin(uTime * 0.55 + s * 5.1)
        ) * uTurb;

        vec4 viewPos = modelViewMatrix * vec4(base, 1.0);

        // Родительская группа сцены масштабируется — компенсируем размер клуба,
        // иначе газ «отклеится» от молекул при наезде камеры.
        float mscale = length(modelMatrix[0].xyz);
        float breathe = 0.78 + 0.32 * sin(uTime * 0.7 + s * 6.28);
        float size = uSize * aScale * breathe * mscale;

        float ang = s * 6.2831 + uTime * 0.22 * (s - 0.5);
        vec2 p = vec2(
          position.x * cos(ang) - position.y * sin(ang),
          position.x * sin(ang) + position.y * cos(ang)
        );
        viewPos.xy += p * size;

        // Клубы у края облака бледнее — объём вместо «шариков».
        vAlpha = 1.0 - 0.45 * length(aDir);
        vUv = uv;
        gl_Position = projectionMatrix * viewPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        float m = texture2D(uMap, vUv).a;
        float a = m * uOpacity * vAlpha;
        if (a < 0.002) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  })
}

export function CinemaPuffVolume({
  state,
  count,
  size = 0.5,
  blend = 'normal',
  seed = 0,
  renderOrder = -2,
}: {
  state: PuffVolumeState
  count: number
  /** базовый экранный размер одного клуба */
  size?: number
  blend?: 'normal' | 'additive'
  seed?: number
  renderOrder?: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => buildGeometry(Math.max(1, count), seed), [count, seed])
  const mat = useMemo(() => buildMaterial(blend), [blend])

  useEffect(() => {
    mat.uniforms.uSize!.value = size
  }, [mat, size])

  useEffect(() => {
    return () => {
      geo.dispose()
      mat.dispose()
    }
  }, [geo, mat])

  useFrame((s) => {
    const m = meshRef.current
    if (!m) return
    if (state.opacity <= 0.004) {
      m.visible = false
      return
    }
    m.visible = true
    m.position.copy(state.center)
    const u = mat.uniforms
    u.uTime!.value = s.clock.elapsedTime
    u.uOpacity!.value = state.opacity
    u.uSpread!.value = state.spread
    u.uRise!.value = state.rise
    u.uTurb!.value = state.turbulence
    ;(u.uColor!.value as THREE.Color).copy(state.color)
  })

  return (
    <mesh
      ref={meshRef}
      geometry={geo}
      material={mat}
      frustumCulled={false}
      renderOrder={renderOrder}
      dispose={null}
    />
  )
}
