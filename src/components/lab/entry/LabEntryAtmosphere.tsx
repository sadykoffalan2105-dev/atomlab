import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { AppThemeId } from '../../../theme/appTheme'
import { ENTRY_SKY } from './labEntryPalette'

/**
 * Глубина кадра входа: вертикальный градиент + мягкое ядро за реакцией.
 *
 * Это НЕ подсветка поверх сцены, а само небо: сфера рисуется первой
 * (renderOrder −10, непрозрачно, без записи глубины) и закрывает собой фон
 * канваса целиком. Отсюда и берётся цвет экрана входа в обеих темах.
 *
 * Аддитивного блендинга здесь больше нет намеренно. Пока фон был тёмным в обеих
 * темах, «добавить света» хватало; в светлой теме добавление к почти белому
 * фону не даёт ничего, а ядро за реакцией обязано, наоборот, ПРИГЛУШАТЬ фон —
 * иначе белые атомы водорода теряются в белом. Поэтому ядро — это подмешивание
 * акцента (в тёмной теме он светлее фона, в светлой темнее), а вспышка —
 * отдельное слагаемое, которое всегда светлеет.
 *
 * Материал module-level и один на весь сеанс: тема идёт uniform'ом, а не новым
 * материалом — иначе переключение темы пересоздаёт шейдерную программу и даёт
 * hitch ровно на входе в лабораторию.
 */

const VERT = /* glsl */ `
varying vec3 vDir;
varying vec2 vNdc;
void main() {
  vDir = normalize(position);
  vec4 mvp = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vNdc = mvp.xy / mvp.w;
  gl_Position = mvp;
}
`

const FRAG = /* glsl */ `
precision mediump float;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uAccent;
uniform vec3 uFlash;
uniform float uGlow;
uniform float uCore;
uniform float uRing;
uniform float uAspect;
varying vec3 vDir;
varying vec2 vNdc;
void main() {
  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 base = mix(uBottom, uTop, h * h);
  float r = length(vNdc * vec2(uAspect, 1.0));
  // Ядро за реакцией: широкое дежурное пятно + узкое кольцо-ореол.
  float core = exp(-r * r * 2.6);
  float ring = exp(-pow(r - 0.58, 2.0) * 11.0);
  float k = clamp(core * uCore + ring * uRing, 0.0, 1.0);
  vec3 col = mix(base, uAccent, k);
  // Вспышка связывания светлеет всегда — в любой теме.
  col += uFlash * uGlow * (core * 0.62 + ring * 0.22);
  gl_FragColor = vec4(col, 1.0);
}
`

type Uniforms = {
  uTop: { value: THREE.Color }
  uBottom: { value: THREE.Color }
  uAccent: { value: THREE.Color }
  uFlash: { value: THREE.Color }
  uGlow: { value: number }
  uCore: { value: number }
  uRing: { value: number }
  uAspect: { value: number }
}

let material: THREE.ShaderMaterial | null = null
let uniforms: Uniforms | null = null

function getAtmosphereMaterial(): { material: THREE.ShaderMaterial; uniforms: Uniforms } {
  if (!material || !uniforms) {
    uniforms = {
      uTop: { value: new THREE.Color(0x0b1236) },
      uBottom: { value: new THREE.Color(0x030309) },
      uAccent: { value: new THREE.Color(0x1d2f6b) },
      uFlash: { value: new THREE.Color(0xfff0c8) },
      uGlow: { value: 0 },
      uCore: { value: 0.6 },
      uRing: { value: 0.12 },
      uAspect: { value: 1.6 },
    }
    material = new THREE.ShaderMaterial({
      uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      transparent: false,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
    })
  }
  return { material, uniforms }
}

/*
 * Палитра темы — ENTRY_SKY из labEntryPalette.ts (единственный источник):
 *   dark  — ночь: ядро СВЕТЛЕЕ фона, кадр «горит» изнутри;
 *   light — дневной холодный воздух средней светлоты, ядро ТЕМНЕЕ фона.
 * Там же entryBackdropHex повторяет этот шейдер, и тест проверяет по нему
 * контраст атомов (scripts/test-lab-entry-scenario.mts).
 */

let geometry: THREE.SphereGeometry | null = null

function getAtmosphereGeometry(): THREE.SphereGeometry {
  if (!geometry) geometry = new THREE.SphereGeometry(26, 24, 16)
  return geometry
}

export function LabEntryAtmosphere({
  theme,
  flashRef,
}: {
  theme: AppThemeId
  flashRef: { current: number }
}) {
  const size = useThree((s) => s.size)
  const { material: mat, uniforms: u } = useMemo(() => getAtmosphereMaterial(), [])
  const geo = useMemo(() => getAtmosphereGeometry(), [])
  const lastAspect = useRef(-1)

  useMemo(() => {
    const p = ENTRY_SKY[theme]
    u.uTop.value.setHex(p.top)
    u.uBottom.value.setHex(p.bottom)
    u.uAccent.value.setHex(p.accent)
    u.uFlash.value.setHex(p.flash)
    u.uCore.value = p.core
    u.uRing.value = p.ring
  }, [theme, u])

  useFrame(() => {
    const aspect = size.height > 0 ? size.width / size.height : 1.6
    if (aspect !== lastAspect.current) {
      u.uAspect.value = aspect
      lastAspect.current = aspect
    }
    const glow = flashRef.current
    if (glow !== u.uGlow.value) u.uGlow.value = glow
  })

  return <mesh geometry={geo} material={mat} renderOrder={-10} frustumCulled={false} />
}
