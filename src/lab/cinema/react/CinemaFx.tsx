import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cinemaCircle, cinemaQuad, cinemaRing, cinemaSphere } from '../core/geometries'
import { cinemaTexture } from '../core/textures'
import type { GlowState, WaveState } from '../core/states'

/**
 * Световые эффекты сцены: сферическая волна образования связи, зона реакции,
 * ореол продукта, вспышка. Все параметры сцена гонит через мутируемые
 * состояния — без ререндеров React.
 *
 * Свет здесь двух видов, и путать их нельзя:
 *   • фронт волны — тонкая сферическая оболочка, светящаяся только по касательной;
 *   • ореол и вспышка — мягкий спрайт с радиальным затуханием.
 * Заливать светом весь объём нельзя ни в том, ни в другом случае: заполненная
 * сфера мгновенно превращает кадр в мутный шар и прячет саму химию.
 */

function createWaveMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uAmt: { value: 0 },
      uColor: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDir = normalize(-viewPos.xyz);
        gl_Position = projectionMatrix * viewPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAmt;
      uniform vec3 uColor;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        // abs(): у задних граней нормаль смотрит от камеры, и без модуля они
        // дают яркость 1 по всей площади — оболочка становится литым шаром.
        float d = abs(dot(normalize(vNormalV), normalize(vViewDir)));
        float rim = pow(1.0 - d, 3.0);
        float fade = (1.0 - uAmt) * (1.0 - uAmt);
        gl_FragColor = vec4(uColor, rim * fade * 0.85);
      }
    `,
  })
}

/**
 * Мягкий световой спрайт, всегда развёрнутый к камере.
 * Им сделаны ореол продукта и вспышка: радиальное затухание текстуры даёт
 * настоящий свет, а не подсвеченный шар.
 */
function GlowSprite({
  stateRef,
  color,
  size,
  gain,
  renderOrder,
  pulse = 0,
  grow = 0,
}: {
  stateRef: { current: GlowState }
  color: number
  /** размер спрайта в мировых единицах при amount = 1 */
  size: number
  /** множитель яркости */
  gain: number
  renderOrder: number
  /** амплитуда «дыхания» размера */
  pulse?: number
  /** насколько спрайт разрастается по мере amount (0 = постоянный размер) */
  grow?: number
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const geo = useMemo(() => cinemaQuad(), [])
  const tex = useMemo(() => cinemaTexture('glow'), [])

  useFrame((s) => {
    const m = mesh.current
    if (!m || !mat.current) return
    const a = stateRef.current.amount
    if (a <= 0.015) {
      m.visible = false
      return
    }
    m.visible = true
    m.position.copy(stateRef.current.center)
    m.quaternion.copy(s.camera.quaternion)
    const breath = pulse > 0 ? 1 + pulse * Math.sin(s.clock.elapsedTime * 1.4) : 1
    m.scale.setScalar(size * breath * (grow > 0 ? 1 - grow + grow * a : 1))
    mat.current.opacity = a * gain
    mat.current.color.setHex(color)
  })

  return (
    <mesh ref={mesh} geometry={geo} visible={false} dispose={null} renderOrder={renderOrder}>
      <meshBasicMaterial
        ref={mat}
        map={tex}
        color={color}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}

/** Сферическая световая волна — импульс образования связи / удар энергии. */
export function CinemaShockwave({ state }: { state: WaveState }) {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => createWaveMaterial(), [])
  const geo = useMemo(() => cinemaSphere(1, 24, 16), [])

  useEffect(() => {
    return () => {
      mat.dispose()
    }
  }, [mat])

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const a = state.amount
    if (a <= 0.001 || a >= 1) {
      m.visible = false
      return
    }
    m.visible = true
    m.position.copy(state.center)
    m.scale.setScalar(0.12 + a * state.radius)
    mat.uniforms.uAmt!.value = a
    ;(mat.uniforms.uColor!.value as THREE.Color).copy(state.color)
  })

  return <mesh ref={mesh} geometry={geo} material={mat} visible={false} dispose={null} renderOrder={4} />
}

/** Подсвеченная зона реакции под молекулами — «стол» сцены. */
export function CinemaReactionZone({
  intensityRef,
  lite = false,
  color = '#5ce0ff',
}: {
  intensityRef: { current: number }
  lite?: boolean
  color?: string
}) {
  const ring = useRef<THREE.Mesh>(null)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null)
  const discMat = useRef<THREE.MeshBasicMaterial>(null)

  useFrame((s) => {
    const u = intensityRef.current
    const pulse = 0.72 + 0.28 * Math.sin(s.clock.elapsedTime * 1.5)
    if (ring.current) {
      ring.current.rotation.z = s.clock.elapsedTime * 0.22
      ring.current.scale.setScalar(1 + u * 0.22)
    }
    if (ringMat.current) ringMat.current.opacity = 0.08 + u * 0.45 * pulse
    if (discMat.current) discMat.current.opacity = 0.02 + u * 0.14
  })

  return (
    <group position={[0, -1.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={cinemaCircle(2.4, lite ? 20 : 32)} dispose={null} renderOrder={-3}>
        <meshBasicMaterial
          ref={discMat}
          color="#1547ff"
          transparent
          opacity={0.04}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={ring} geometry={cinemaRing(1.72, 1.92, lite ? 28 : 44)} dispose={null} renderOrder={-2}>
        <meshBasicMaterial
          ref={ringMat}
          color={color}
          transparent
          opacity={0.14}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

/**
 * Ореол вокруг готовой молекулы (тёплый янтарный у ClO₂).
 * Это подсветка воздуха вокруг продукта: она обязана оставаться прозрачной,
 * иначе молекула тонет в цветном пятне.
 */
export function CinemaHalo({
  stateRef,
  color,
  radius = 0.9,
}: {
  stateRef: { current: GlowState }
  color: number
  radius?: number
}) {
  return (
    <GlowSprite
      stateRef={stateRef}
      color={color}
      size={radius * 3.4}
      gain={0.3}
      pulse={0.05}
      grow={0.35}
      renderOrder={3}
    />
  )
}

/** Вспышка в точке события: разряд, разрыв связи, рождение ионной пары. */
export function CinemaFlash({
  stateRef,
  color = 0xffffff,
}: {
  stateRef: { current: GlowState }
  color?: number
}) {
  return <GlowSprite stateRef={stateRef} color={color} size={1.5} gain={0.5} grow={0.7} renderOrder={5} />
}
