import * as THREE from 'three'
import { compoundById } from '../../data/compounds'
import { getElementBySymbol } from '../../data/elements'
import type { CompoundDef } from '../../types/chemistry'
import { getCachedCanvasTexture } from './vrLabTextureCache'

const BG = '#060818'
const GRID = 'rgba(0,229,255,0.06)'

function cpkHex(symbol: string): string {
  const e = getElementBySymbol(symbol)
  return e ? `#${e.cpkHex}` : '#8899aa'
}

function projectMolecule(compound: CompoundDef, w: number, h: number) {
  const atoms = compound.atoms
  const bonds = compound.bonds ?? []
  if (atoms.length === 0) return { nodes: [] as Array<{ x: number; y: number; r: number; color: string; sym: string }>, edges: [] as Array<[number, number]> }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const a of atoms) {
    minX = Math.min(minX, a.pos[0])
    maxX = Math.max(maxX, a.pos[0])
    minY = Math.min(minY, a.pos[1])
    maxY = Math.max(maxY, a.pos[1])
  }
  const spanX = Math.max(0.01, maxX - minX)
  const spanY = Math.max(0.01, maxY - minY)
  const scale = Math.min((w * 0.72) / spanX, (h * 0.62) / spanY)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  const nodes = atoms.map((a) => ({
    x: w / 2 + (a.pos[0] - cx) * scale,
    y: h / 2 - (a.pos[1] - cy) * scale,
    r: Math.max(7, Math.min(14, 9 + (a.symbol.length > 1 ? 1 : 0))),
    color: cpkHex(a.symbol),
    sym: a.symbol,
  }))

  return { nodes, edges: bonds as Array<[number, number]> }
}

export function createCatalogMoleculeTexture(compoundId: string): THREE.CanvasTexture {
  const compound = compoundById[compoundId]
  const w = 512
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = GRID
  ctx.lineWidth = 1
  for (let i = 0; i < w; i += 32) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, h)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(w, i)
    ctx.stroke()
  }

  const accent = compound?.accentColor ?? '#00e5ff'
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.45)
  g.addColorStop(0, `${accent}18`)
  g.addColorStop(1, 'transparent')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  if (!compound) {
    ctx.fillStyle = 'rgba(0,229,255,0.5)'
    ctx.font = '600 14px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('ATOMLAB', w / 2, h / 2 - 8)
    ctx.fillStyle = 'rgba(140,170,210,0.65)'
    ctx.font = '500 11px ui-monospace, monospace'
    ctx.fillText('КАТАЛОГ ВЕЩЕСТВ', w / 2, h / 2 + 12)
  } else {
    const { nodes, edges } = projectMolecule(compound, w, h)

    ctx.lineCap = 'round'
    for (const [i, j] of edges) {
      const a = nodes[i]
      const b = nodes[j]
      if (!a || !b) continue
      ctx.strokeStyle = 'rgba(168,232,255,0.35)'
      ctx.lineWidth = 3
      ctx.shadowColor = accent
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    for (const n of nodes) {
      ctx.fillStyle = n.color
      ctx.shadowColor = n.color
      ctx.shadowBlur = 14
      ctx.beginPath()
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'
      ctx.lineWidth = 1.2
      ctx.stroke()
    }

    ctx.fillStyle = accent
    ctx.font = '800 18px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.shadowColor = accent
    ctx.shadowBlur = 12
    ctx.fillText(compound.formulaUnicode, w / 2, 36)
    ctx.shadowBlur = 0

    ctx.fillStyle = 'rgba(140,170,210,0.75)'
    ctx.font = '600 10px ui-monospace, monospace'
    const name = compound.nameRu.length > 28 ? `${compound.nameRu.slice(0, 26)}…` : compound.nameRu
    ctx.fillText(name.toUpperCase(), w / 2, h - 22)
    ctx.fillStyle = 'rgba(0,229,255,0.45)'
    ctx.font = '500 9px ui-monospace, monospace'
    ctx.fillText('КАТАЛОГ · СМЕШИВАНИЕ', w / 2, h - 8)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  return tex
}

export function getCatalogMoleculeTexture(compoundId: string): THREE.CanvasTexture {
  return getCachedCanvasTexture(`vr-molecule-${compoundId}`, () => createCatalogMoleculeTexture(compoundId))
}
