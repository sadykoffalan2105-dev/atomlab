/**
 * Общие GPU-ресурсы CPK-сфер превью реактора.
 *
 * Правила те же, что в preview/previewSharedResources.ts:
 *  - ресурсы живут весь сеанс (module-level кэш) и НЕ диспоузятся компонентами;
 *  - потребители материалы не мутируют (иначе изменится у всех атомов сразу);
 *  - ключ шейдерной программы одинаков у всех экземпляров → +/- коэффициента
 *    не порождает новых программ и не даёт hitch на пересборке материалов.
 */
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Электронное облако — мягкая аддитивная оболочка поверх CPK-сферы
// ---------------------------------------------------------------------------

const cloudMaterialCache = new Map<string, THREE.MeshBasicMaterial>()

/**
 * Полупрозрачная «шуба» электронной плотности: BackSide + аддитивное смешение
 * даёт френелевский ободок по силуэту, а внутри почти не светится —
 * сфера остаётся читаемой, а атом не выглядит бильярдным шаром.
 */
export function getCpkCloudMaterial(colorHex: string, opacity: number): THREE.MeshBasicMaterial {
  const key = `${colorHex}|${opacity}`
  let mat = cloudMaterialCache.get(key)
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    cloudMaterialCache.set(key, mat)
  }
  return mat
}

// ---------------------------------------------------------------------------
// Подпись: символ элемента + надстрочный бейдж заряда
// ---------------------------------------------------------------------------

const LABEL_TEXTURE_SIZE = 192
const labelMaterialCache = new Map<string, THREE.SpriteMaterial>()

function drawLabelTexture(symbol: string, chargeLabel: string, colorHex: string): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const size = LABEL_TEXTURE_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const symFont = `700 ${Math.round(size * 0.44)}px "Inter", "Segoe UI", system-ui, sans-serif`
  const supFont = `700 ${Math.round(size * 0.24)}px "Inter", "Segoe UI", system-ui, sans-serif`
  const gap = size * 0.03

  ctx.textBaseline = 'alphabetic'
  ctx.font = symFont
  const wSym = ctx.measureText(symbol).width
  ctx.font = supFont
  const wSup = chargeLabel ? ctx.measureText(chargeLabel).width : 0
  const total = wSym + (wSup > 0 ? wSup + gap : 0)
  const x0 = (size - total) / 2
  const baseY = size * 0.66
  const supY = baseY - size * 0.22

  // Тёмный контур — подпись читается и на светлой теме приложения.
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.055
  ctx.strokeStyle = 'rgba(6,10,22,0.62)'
  ctx.font = symFont
  ctx.strokeText(symbol, x0, baseY)
  if (wSup > 0) {
    ctx.font = supFont
    ctx.strokeText(chargeLabel, x0 + wSym + gap, supY)
  }

  // Заливка с мягким свечением в цвете CPK элемента.
  ctx.shadowColor = colorHex
  ctx.shadowBlur = size * 0.12
  ctx.fillStyle = '#ffffff'
  ctx.font = symFont
  ctx.fillText(symbol, x0, baseY)
  if (wSup > 0) {
    ctx.font = supFont
    ctx.fillText(chargeLabel, x0 + wSym + gap, supY)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/**
 * Спрайт-подпись «Na», «Cl⁻», «Fe³⁺». Один материал на (символ, заряд):
 * в уравнении 12 атомов кислорода делят одну текстуру.
 */
export function getCpkLabelMaterial(
  symbol: string,
  chargeLabel: string,
  colorHex: string,
): THREE.SpriteMaterial {
  const key = `${symbol}|${chargeLabel}|${colorHex}`
  let mat = labelMaterialCache.get(key)
  if (!mat) {
    mat = new THREE.SpriteMaterial({
      map: drawLabelTexture(symbol, chargeLabel, colorHex),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    labelMaterialCache.set(key, mat)
  }
  return mat
}
