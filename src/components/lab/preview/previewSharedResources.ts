/**
 * Общие GPU-ресурсы превью реактора: одна геометрия/материал на всех вместо
 * «каждый атом и каждая связь строит свои».
 *
 * Правила:
 * - Ресурсы живут весь сеанс (module-level) и НЕ диспоузятся компонентами —
 *   их передают в mesh через args/props, R3F такие объекты не уничтожает.
 * - Материалы не мутируются потребителями (иначе поменяется у всех).
 * - Ключ программы шейдера у всех экземпляров одинаковый → +/- коэффициента
 *   не порождает новых программ.
 */
import * as THREE from 'three'
import { ATOM_NEUTRON_COLOR, ATOM_PROTON_COLOR } from '../atom/atomCosmicShared'

// ---------------------------------------------------------------------------
// Стержни связей
// ---------------------------------------------------------------------------

const bondGeometryCache = new Map<string, THREE.CylinderGeometry>()

/** Единичный цилиндр (высота 1) — длину задаёт scale.y меша. */
export function getUnitBondCylinderGeometry(radius: number, radialSegments: number): THREE.CylinderGeometry {
  const key = `${radius}|${radialSegments}`
  let geo = bondGeometryCache.get(key)
  if (!geo) {
    geo = new THREE.CylinderGeometry(radius, radius, 1, radialSegments, 1)
    bondGeometryCache.set(key, geo)
  }
  return geo
}

const bondMaterialCache = new Map<string, THREE.MeshStandardMaterial>()

/** Материал стержня по цвету и пресету — кэш, один экземпляр на цвет. */
export function getBondStickMaterial(color: string, hero: boolean): THREE.MeshStandardMaterial {
  const key = `${hero ? 'h' : 'd'}|${color}`
  let mat = bondMaterialCache.get(key)
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: hero ? 0.72 : 0.25,
      metalness: hero ? 0.55 : 0.3,
      roughness: hero ? 0.22 : 0.35,
    })
    bondMaterialCache.set(key, mat)
  }
  return mat
}

const atomCpkMaterialCache = new Map<string, THREE.MeshStandardMaterial>()

/** CPK-сфера атома (не hero): кэш по цвету, силе свечения и режиму space-fill. */
export function getAtomCpkMaterial(color: string, emissiveIntensity: number, spaceFill: boolean): THREE.MeshStandardMaterial {
  const key = `${color}|${emissiveIntensity}|${spaceFill ? 1 : 0}`
  let mat = atomCpkMaterialCache.get(key)
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity,
      metalness: 0.2,
      roughness: 0.38,
      transparent: spaceFill,
      opacity: spaceFill ? 0.92 : 1,
    })
    atomCpkMaterialCache.set(key, mat)
  }
  return mat
}

const sphereGeometryCache = new Map<string, THREE.SphereGeometry>()

/** Сфера по радиусу/сегментам — кэш (радиусов в каталоге единицы). */
export function getSharedSphereGeometry(radius: number, widthSegments: number, heightSegments: number): THREE.SphereGeometry {
  const key = `${radius}|${widthSegments}|${heightSegments}`
  let geo = sphereGeometryCache.get(key)
  if (!geo) {
    geo = new THREE.SphereGeometry(radius, widthSegments, heightSegments)
    sphereGeometryCache.set(key, geo)
  }
  return geo
}

// ---------------------------------------------------------------------------
// Ядро Bohr-модели
// ---------------------------------------------------------------------------

export type NucleonMaterials = {
  prot: THREE.MeshStandardMaterial
  neut: THREE.MeshStandardMaterial
}

const nucleonMaterialCache = new Map<string, NucleonMaterials>()
const WHITE = new THREE.Color('#ffffff')

/**
 * Материалы протонов/нейтронов.
 * glow=true — режим без точечного света в ядре: тёплое свечение ядра переносим
 * в emissive (раньше его давал pointLight #ff7a55 в центре).
 */
export function getNucleonMaterials(cosmic: boolean, glow: boolean): NucleonMaterials {
  const key = `${cosmic ? 1 : 0}|${glow ? 1 : 0}`
  let mats = nucleonMaterialCache.get(key)
  if (!mats) {
    // Свет ядра не столько «краснил», сколько высветлял нуклоны — emissive чуть к белому.
    const boost = glow ? 1.1 : 1
    const lift = glow ? 0.05 : 0
    mats = {
      prot: new THREE.MeshStandardMaterial({
        color: ATOM_PROTON_COLOR,
        emissive: ATOM_PROTON_COLOR.clone().lerp(WHITE, lift),
        emissiveIntensity: (cosmic ? 0.62 : 0.4) * boost,
        metalness: 0.1,
        roughness: cosmic ? 0.48 : 0.6,
      }),
      neut: new THREE.MeshStandardMaterial({
        color: ATOM_NEUTRON_COLOR,
        emissive: ATOM_NEUTRON_COLOR.clone().lerp(WHITE, lift),
        emissiveIntensity: (cosmic ? 0.45 : 0.25) * boost,
        metalness: 0.1,
        roughness: cosmic ? 0.52 : 0.64,
      }),
    }
    nucleonMaterialCache.set(key, mats)
  }
  return mats
}

/** Геометрия нуклона — радиусов всего пять, сегментов два варианта. */
export function getNucleonGeometry(radius: number, segments: number): THREE.SphereGeometry {
  return getSharedSphereGeometry(radius, segments, Math.max(6, segments - 2))
}

// ---------------------------------------------------------------------------
// Свечение ядра: аддитивный спрайт вместо pointLight
// ---------------------------------------------------------------------------

/** Тёплый цвет бывшего точечного света ядра. */
export const NUCLEUS_GLOW_WARM_HEX = '#ff7a55'

let glowTexture: THREE.Texture | null | undefined

function getGlowTexture(): THREE.Texture | null {
  if (glowTexture !== undefined) return glowTexture
  if (typeof document === 'undefined') {
    glowTexture = null
    return glowTexture
  }
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    glowTexture = null
    return glowTexture
  }
  const c = size / 2
  const g = ctx.createRadialGradient(c, c, 0, c, c, c)
  // Мягкий спад ≈ 1/(1+r²) — похоже на ореол от точечного источника.
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.18, 'rgba(255,255,255,0.62)')
  g.addColorStop(0.42, 'rgba(255,255,255,0.2)')
  g.addColorStop(0.7, 'rgba(255,255,255,0.05)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  glowTexture = tex
  return glowTexture
}

const glowMaterialCache = new Map<string, THREE.SpriteMaterial>()

/**
 * Аддитивный спрайт-ореол ядра. Один материал на цвет, одна текстура на всех.
 * Не освещается и не зависит от числа источников света — программа одна.
 */
export function getNucleusGlowMaterial(colorHex: string, opacity: number): THREE.SpriteMaterial {
  const key = `${colorHex}|${opacity}`
  let mat = glowMaterialCache.get(key)
  if (!mat) {
    mat = new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: colorHex,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    glowMaterialCache.set(key, mat)
  }
  return mat
}
