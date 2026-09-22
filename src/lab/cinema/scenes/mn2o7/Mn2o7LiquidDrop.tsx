import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { LiquidDropState } from './mn2o7LiquidDropState'

/**
 * Капля жидкого Mn₂O₇ — материал с ДИХРОИЗМОМ (шаг 5 урока).
 *
 * Маслянистая жидкость выглядит по-разному в двух светах:
 *   • в ПРОХОДЯЩЕМ свете (взгляд сквозь толщу, центр капли) — тёмно-красно-бурая;
 *   • в ОТРАЖЁННОМ свете (скользящие углы по Френелю и блик) — зелёная с металлическим блеском.
 * Поэтому цвет не смешивается в одно «грязное» среднее: тело капли и отражение считаются раздельно,
 * отражение растёт к краю по Френелю. Собственного свечения нет (emissive 0): это вещество,
 * а не огонь — закон «никакого свечения внутри вещества».
 *
 * Цвета ниже — ПАРАМЕТРЫ РЕНДЕРА (как цвет ореола электрона у NaCl), а не химические константы:
 * в ядре нет спектров Mn₂O₇; окраска — перенос заряда O → Mn (сказано в тексте урока).
 *
 * Прогрев: меш всегда смонтирован (visible), «нет капли» — нулевой масштаб и прозрачность 0,
 * поэтому программа компилируется прогревом сцены до шага 0. В кадре без аллокаций.
 */

/** Тело капли в проходящем свете: тёмный красно-бурый (sRGB). */
const TRANSMIT_SRGB = 0x6a1c12
/** Отражённый свет: зелёный металлический блеск (sRGB). */
const SHEEN_SRGB = 0x3fbf6a

function createDichroicMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTransmit: { value: new THREE.Color(TRANSMIT_SRGB) },
      uSheen: { value: new THREE.Color(SHEEN_SRGB) },
      uOpacity: { value: 0 },
      uLight: { value: new THREE.Vector3(0.45, 0.8, 0.6).normalize() },
    },
    transparent: true,
    depthWrite: true,
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTransmit;
      uniform vec3 uSheen;
      uniform float uOpacity;
      uniform vec3 uLight;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        if (uOpacity <= 0.002) discard;
        vec3 n = normalize(vN);
        vec3 v = normalize(vV);
        float ndv = clamp(dot(n, v), 0.0, 1.0);
        // Проходящий свет: чем толще слой (центр капли), тем темнее и краснее.
        vec3 body = uTransmit * (0.35 + 0.75 * ndv);
        // Отражённый свет: зелёный металлический блеск по Френелю (Шлик) и узкий блик.
        float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
        vec3 h = normalize(uLight + v);
        float spec = pow(max(dot(n, h), 0.0), 90.0);
        float sheen = clamp(fres * 1.6 + spec * 1.2, 0.0, 1.0);
        vec3 col = mix(body, uSheen, sheen);
        gl_FragColor = vec4(col, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
}

type DropGpu = { geo: THREE.SphereGeometry; mat: THREE.ShaderMaterial }

function syncDrop(mesh: THREE.Mesh | null, gpu: DropGpu, s: LiquidDropState): void {
  if (!mesh) return
  mesh.position.copy(s.pos)
  const r = s.radius > 1e-4 ? s.radius : 1e-4
  // Лёгкая сплюснутость — капля маслянистой жидкости, а не стеклянный шар.
  mesh.scale.set(r, r * 0.86, r)
  ;(gpu.mat.uniforms.uOpacity as { value: number }).value = s.radius > 1e-4 ? s.opacity : 0
}

export function Mn2o7LiquidDrop({ state }: { state: LiquidDropState }) {
  const gpu = useMemo<DropGpu>(() => ({ geo: new THREE.SphereGeometry(1, 48, 32), mat: createDichroicMaterial() }), [])
  const mesh = useRef<THREE.Mesh>(null)
  useEffect(
    () => () => {
      gpu.geo.dispose()
      gpu.mat.dispose()
    },
    [gpu],
  )
  useFrame(() => syncDrop(mesh.current, gpu, state))
  return <mesh ref={mesh} geometry={gpu.geo} material={gpu.mat} frustumCulled={false} renderOrder={1} />
}
