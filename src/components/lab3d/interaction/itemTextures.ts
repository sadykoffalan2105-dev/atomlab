/**
 * Текстуры предметов «руки» (процедурно, без сети): этикетка склянки с формулой, названием и пиктограммой
 * опасности (как на школьных склянках: «едкое» у кислот и щелочей, «огнеопасно» у спирта, «токсично» у солей бария),
 * этикетка коробка спичек.
 */
import * as THREE from 'three'
import type { LabLang, LabText } from '../labContract'
import type { Hazard, ReagentInfo } from './labItems'

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2d canvas недоступен')
  return [c, ctx]
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Ромб GHS: белое поле, красная рамка, чёрный символ. */
function hazardDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, kind: Hazard) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#e0261b'
  ctx.lineWidth = s * 0.12
  ctx.beginPath()
  ctx.moveTo(0, -s)
  ctx.lineTo(s, 0)
  ctx.lineTo(0, s)
  ctx.lineTo(-s, 0)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#111'
  ctx.strokeStyle = '#111'
  ctx.lineWidth = s * 0.06
  if (kind === 'flammable') {
    // Пламя
    ctx.beginPath()
    ctx.moveTo(0, s * 0.45)
    ctx.bezierCurveTo(-s * 0.42, s * 0.42, -s * 0.36, -s * 0.05, -s * 0.05, -s * 0.5)
    ctx.bezierCurveTo(-s * 0.02, -s * 0.15, s * 0.22, -s * 0.12, s * 0.12, -s * 0.38)
    ctx.bezierCurveTo(s * 0.42, -s * 0.05, s * 0.4, s * 0.4, 0, s * 0.45)
    ctx.fill()
    ctx.fillRect(-s * 0.4, s * 0.5, s * 0.8, s * 0.08)
  } else if (kind === 'corrosive') {
    // Две пробирки льют капли на поверхность и руку
    ctx.save()
    ctx.rotate(-0.5)
    ctx.strokeRect(-s * 0.48, -s * 0.5, s * 0.14, s * 0.4)
    ctx.restore()
    ctx.save()
    ctx.rotate(0.5)
    ctx.strokeRect(s * 0.34, -s * 0.5, s * 0.14, s * 0.4)
    ctx.restore()
    for (const [x, y] of [
      [-s * 0.2, -s * 0.02],
      [s * 0.2, -s * 0.02],
      [-s * 0.18, s * 0.16],
      [s * 0.22, s * 0.16],
    ]) {
      ctx.beginPath()
      ctx.arc(x, y, s * 0.045, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillRect(-s * 0.5, s * 0.3, s * 0.42, s * 0.08)
    ctx.beginPath()
    ctx.ellipse(s * 0.3, s * 0.36, s * 0.2, s * 0.08, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // Череп и скрещённые кости
    ctx.beginPath()
    ctx.arc(0, -s * 0.12, s * 0.26, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(-s * 0.15, s * 0.05, s * 0.3, s * 0.16)
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(-s * 0.1, -s * 0.13, s * 0.07, 0, Math.PI * 2)
    ctx.arc(s * 0.1, -s * 0.13, s * 0.07, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#111'
    ctx.lineWidth = s * 0.08
    ctx.beginPath()
    ctx.moveTo(-s * 0.42, s * 0.22)
    ctx.lineTo(s * 0.42, s * 0.52)
    ctx.moveTo(s * 0.42, s * 0.22)
    ctx.lineTo(-s * 0.42, s * 0.52)
    ctx.stroke()
  }
  ctx.restore()
}

/** Этикетка склянки: цветная полоса, формула крупно, название, пиктограмма опасности справа. */
export function reagentLabelTexture(info: ReagentInfo, name: LabText, lang: LabLang): THREE.CanvasTexture {
  const W = 640
  const H = 256
  const [c, ctx] = canvas(W, H)
  ctx.fillStyle = '#fbfaf5'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = info.band
  ctx.fillRect(0, 0, W, 40)
  ctx.fillRect(0, H - 14, W, 14)
  const textW = info.hazard ? W - 170 : W
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 24px ${FONT}`
  const head = { ru: 'РЕАКТИВ', en: 'REAGENT', uz: 'REAKTIV' } as const
  ctx.fillText(head[lang], W / 2, 21)
  ctx.fillStyle = '#141b24'
  let fs = 96
  ctx.font = `800 ${fs}px ${FONT}`
  while (ctx.measureText(info.formula).width > textW - 40 && fs > 50) {
    fs -= 4
    ctx.font = `800 ${fs}px ${FONT}`
  }
  ctx.fillText(info.formula, textW / 2, 108)
  ctx.fillStyle = '#3f4a57'
  let ns = 32
  ctx.font = `600 ${ns}px ${FONT}`
  while (ctx.measureText(name[lang]).width > textW - 30 && ns > 18) {
    ns -= 2
    ctx.font = `600 ${ns}px ${FONT}`
  }
  ctx.fillText(name[lang], textW / 2, 188)
  if (info.hazard) hazardDiamond(ctx, W - 88, 132, 66, info.hazard)
  return toTexture(c)
}

/** Этикетка на крышке коробка спичек. */
export function matchboxTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 160)
  ctx.fillStyle = '#e8d9b0'
  ctx.fillRect(0, 0, 256, 160)
  ctx.fillStyle = '#c0392b'
  ctx.fillRect(10, 10, 236, 140)
  ctx.fillStyle = '#f7e9c5'
  ctx.beginPath()
  ctx.moveTo(128, 30)
  ctx.bezierCurveTo(90, 70, 100, 120, 128, 130)
  ctx.bezierCurveTo(156, 120, 166, 70, 128, 30)
  ctx.fill()
  ctx.fillStyle = '#f39c12'
  ctx.beginPath()
  ctx.moveTo(128, 60)
  ctx.bezierCurveTo(110, 85, 115, 118, 128, 122)
  ctx.bezierCurveTo(141, 118, 146, 85, 128, 60)
  ctx.fill()
  return toTexture(c)
}
