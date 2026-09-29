/**
 * Стиль единого школьного 3D-вида (герой лаборатории и каталог) — тот же, что у школьных сцен
 * (scenes/school/SchoolReactionScene): CPK-цвета с поправками сцены (C графитовый 0x6a707c, H × 0,9),
 * матовые шары, серые палочки связей (радиус и шаг — SCHOOL_DRAW), в светлой теме палочки темнее.
 *
 * Освещение — матовый matcap (view-space): картинка не зависит от света сцены, в которую встроен вид
 * (у лаборатории голубой точечный свет перед реактором красил бы шары), свет всегда спереди-сверху-справа,
 * без бликов. Цвет шара (instanceColor) умножается на matcap.
 */
import * as THREE from 'three'
import type { ElementSymbol } from '../../../chemistry/data'
import { cpkHex } from '../../../lab/cinema/scenes/kit/cpkAtoms'

/** Углерод CPK почти чёрный и пропадает на тёмном фоне — графитово-серый, как в школьной сцене. */
export const SCHOOL_CARBON_HEX = 0x6a707c
/** Водород: белый CPK × 0,9 (матовый шар под светом иначе «выгорает»). */
export const SCHOOL_HYDROGEN_DIM = 0.9
/** Палочки связей: тёмная тема — как в сцене, светлая — темнее (на светлом фоне светлая палочка теряется). */
export const SCHOOL_STICK_HEX = { dark: 0xd4dce6, light: 0x8792a4 } as const
/** Рёбра ячеек кристалла. */
export const SCHOOL_EDGE_HEX = { dark: 0x9fb4d0, light: 0x5d6b80 } as const

/** Цвет шара, sRGB hex (для DOM и теста): ровно правило школьной сцены. */
export function schoolAtomHex(el: ElementSymbol | string): number {
  if (el === 'C') return SCHOOL_CARBON_HEX
  const hex = cpkHex(el as ElementSymbol)
  if (el !== 'H') return hex
  // × 0,9 в линейном пространстве (как col.setHex(...).multiplyScalar(0.9) у сцены) → обратно в sRGB.
  const c = new THREE.Color(hex).multiplyScalar(SCHOOL_HYDROGEN_DIM)
  return c.getHex()
}

/** Цвет шара (линейное рабочее пространство three) — как у SchoolReactionScene. */
export function schoolAtomColor(el: ElementSymbol | string, out = new THREE.Color()): THREE.Color {
  if (el === 'C') return out.setHex(SCHOOL_CARBON_HEX)
  out.setHex(cpkHex(el as ElementSymbol))
  if (el === 'H') out.multiplyScalar(SCHOOL_HYDROGEN_DIM)
  return out
}

/** Относительная яркость sRGB (0…1) — светлый шар получает тёмную букву. */
export function schoolLabelDark(hex: number): boolean {
  const r = ((hex >> 16) & 255) / 255
  const g = ((hex >> 8) & 255) / 255
  const b = (hex & 255) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5
}

// ─── Матовый matcap ───

let matcap: THREE.CanvasTexture | null = null

const srgb = (v: number) => {
  const x = Math.min(1, Math.max(0, v))
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
}

function norm3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1
  return [x / l, y / l, z / l]
}

/**
 * Текстура matcap: полусфера в пространстве вида. Ключевой свет сверху-справа-спереди (как key 3.5, 5, 6
 * у сцены), слабый заполняющий снизу-слева, рассеянный холодный фон, мягкое затенение к краю и чуть
 * светлее самый край (кромка сцены). Блика нет — только очень широкая мягкая подсветка.
 */
export function schoolMatcapTexture(): THREE.Texture {
  if (matcap) return matcap
  const N = 256
  const canvas = document.createElement('canvas')
  canvas.width = N
  canvas.height = N
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(N, N)
  const L = norm3(0.45, 0.62, 0.64)
  const F = norm3(-0.6, -0.35, 0.72)
  const Hh = norm3(L[0], L[1], L[2] + 1)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      let x = ((i + 0.5) / N) * 2 - 1
      let y = 1 - ((j + 0.5) / N) * 2
      const r2 = x * x + y * y
      if (r2 > 0.999) {
        const k = Math.sqrt(0.999 / r2)
        x *= k
        y *= k
      }
      const z = Math.sqrt(Math.max(0, 1 - x * x - y * y))
      const ndl = x * L[0] + y * L[1] + z * L[2]
      const wrap = Math.max(0, (ndl + 0.3) / 1.3)
      const fill = Math.max(0, x * F[0] + y * F[1] + z * F[2])
      const soft = Math.pow(Math.max(0, x * Hh[0] + y * Hh[1] + z * Hh[2]), 10)
      const edge = 1 - z
      const v = 0.3 + 0.6 * wrap + 0.1 * fill + 0.07 * soft + 0.1 * Math.pow(edge, 3) - 0.1 * edge * (1 - wrap)
      const o = (j * N + i) * 4
      img.data[o] = Math.round(srgb(v * 0.97) * 255)
      img.data[o + 1] = Math.round(srgb(v * 0.99) * 255)
      img.data[o + 2] = Math.round(srgb(v * 1.02) * 255)
      img.data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  matcap = new THREE.CanvasTexture(canvas)
  matcap.colorSpace = THREE.SRGBColorSpace
  matcap.needsUpdate = true
  return matcap
}

/** Материал шаров/палочек: matcap × цвет (instanceColor у шаров). Прозрачность — только для «рождения». */
export function createSchoolMatteMaterial(color: THREE.ColorRepresentation = 0xffffff): THREE.MeshMatcapMaterial {
  return new THREE.MeshMatcapMaterial({ color, matcap: schoolMatcapTexture(), fog: false })
}

let sphereHi: THREE.SphereGeometry | null = null
let sphereLo: THREE.SphereGeometry | null = null
let stick: THREE.CylinderGeometry | null = null

export function schoolSphereGeometry(lowPower = false): THREE.SphereGeometry {
  if (lowPower) return (sphereLo ??= new THREE.SphereGeometry(1, 20, 14))
  return (sphereHi ??= new THREE.SphereGeometry(1, 36, 24))
}

/** Единичный цилиндр палочки (ось Y, длина 1) — общий, как у сцены. */
export function schoolStickGeometry(): THREE.CylinderGeometry {
  return (stick ??= new THREE.CylinderGeometry(1, 1, 1, 14, 1, true))
}
