import * as THREE from 'three'
import { ELEMENT_NAMES_RU } from '../../data/elementNamesRu'
import { massDisplay } from '../../data/elementDisplay'
import { ELEMENTS } from '../../data/elements'
import {
  CENTER_PANEL_COL_END,
  CENTER_PANEL_COL_START,
  CENTER_PANEL_ROW,
  ELEMENT_FIRST_COL,
  F_BLOCK_GAP_ROW,
  getRuGridPos,
  ruElementGridColumn,
  ruFBlockGridRow,
  ruMainGridRow,
  ruMainVoidCells,
  ruPeriodLabelForRow,
  triadGridColumn,
} from '../../data/ruElementGrid'
import { RU_GROUP_LABELS } from '../../data/ruGroupLabels'
import { textbookBlockClass, type TextbookBlockClass } from '../../data/mendeleevTextbookBlock'
import type { ElementViewModel } from '../../types/chemistry'

/** Цвета блоков — как в PeriodicTableTextbook.module.css */
export const CYBER_BLOCK: Record<
  TextbookBlockClass,
  { neon: string; bg: string; border: string; glow: string }
> = {
  tbS: {
    neon: '#00ffaa',
    bg: 'rgba(2,10,8,0.92)',
    border: 'rgba(0,255,170,0.42)',
    glow: 'rgba(0,255,170,0.4)',
  },
  tbP: {
    neon: '#ff6eb4',
    bg: 'rgba(12,4,10,0.92)',
    border: 'rgba(255,45,149,0.42)',
    glow: 'rgba(255,45,149,0.4)',
  },
  tbD: {
    neon: '#4da6ff',
    bg: 'rgba(4,8,18,0.92)',
    border: 'rgba(77,166,255,0.42)',
    glow: 'rgba(77,166,255,0.4)',
  },
  tbF: {
    neon: '#c77dff',
    bg: 'rgba(8,4,16,0.92)',
    border: 'rgba(199,125,255,0.42)',
    glow: 'rgba(199,125,255,0.4)',
  },
  tbNoble: {
    neon: '#a8e8ff',
    bg: 'rgba(4,10,18,0.92)',
    border: 'rgba(168,232,255,0.38)',
    glow: 'rgba(168,232,255,0.35)',
  },
}

const BG = '#080412'
const GRID_COLS = 12
const GRID_ROWS = 16
const CELL_W = 42
const CELL_H = 30
const GAP = 2
const PAD = 10
const TITLE_H = 46
const GROUPS_H = 12
const FONT = 'ui-monospace, Consolas, "Cascadia Code", monospace'

const LAW_TITLE = 'Периодический закон Д. И. Менделеева'
const LAW_TEXT =
  'Свойства элементов, в том числе валентность и строение атомов, периодически меняются с ростом заряда ядра.'
const MAIN_TITLE = 'Периодическая система химических элементов'
const GROUPS_LABEL = 'Г р у п п ы   э л е м е н т о в'

function gridOrigin(): { ox: number; oy: number; gridW: number; totalW: number } {
  const gridW = GRID_COLS * (CELL_W + GAP) - GAP
  const totalW = gridW + PAD * 2
  const ox = PAD
  const oy = PAD + TITLE_H + GROUPS_H
  return { ox, oy, gridW, totalW }
}

function cellRect(col: number, row: number): { x: number; y: number; w: number; h: number } {
  const { ox, oy } = gridOrigin()
  return {
    x: ox + (col - 1) * (CELL_W + GAP),
    y: oy + (row - 1) * (CELL_H + GAP),
    w: CELL_W,
    h: CELL_H,
  }
}

function cellRectSpan(
  colStart: number,
  colEnd: number,
  rowStart: number,
  rowEnd?: number,
): { x: number; y: number; w: number; h: number } {
  const tl = cellRect(colStart, rowStart)
  const br = cellRect(colEnd - 1, (rowEnd ?? rowStart + 1) - 1)
  return {
    x: tl.x,
    y: tl.y,
    w: br.x + br.w - tl.x,
    h: br.y + br.h - tl.y,
  }
}

function drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save()
  ctx.globalAlpha = 0.06
  ctx.strokeStyle = '#00e5ff'
  ctx.lineWidth = 1
  for (let y = 0; y < h; y += 4) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  ctx.restore()
}

function drawPanelGlow(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g1 = ctx.createRadialGradient(w * 0.15, h * 0.12, 0, w * 0.15, h * 0.12, w * 0.35)
  g1.addColorStop(0, 'rgba(0,229,255,0.08)')
  g1.addColorStop(1, 'transparent')
  ctx.fillStyle = g1
  ctx.fillRect(0, 0, w, h)

  const g2 = ctx.createRadialGradient(w * 0.85, h * 0.1, 0, w * 0.85, h * 0.1, w * 0.32)
  g2.addColorStop(0, 'rgba(255,45,149,0.09)')
  g2.addColorStop(1, 'transparent')
  ctx.fillStyle = g2
  ctx.fillRect(0, 0, w, h)
}

function drawAxisCell(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  text: string,
  opts?: { fontSize?: number; tint?: string },
) {
  const { x, y, w, h } = cellRect(col, row)
  ctx.fillStyle = 'rgba(2,6,16,0.82)'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = 'rgba(0,229,255,0.14)'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)

  ctx.fillStyle = opts?.tint ?? 'rgba(200,230,255,0.92)'
  ctx.font = `700 ${opts?.fontSize ?? 11}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + w / 2, y + h / 2)
}

function drawSubHeadGroup(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const { x, y, w, h } = cellRect(col, row)
  ctx.fillStyle = 'rgba(2,6,16,0.82)'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = 'rgba(0,229,255,0.14)'
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)

  ctx.strokeStyle = 'rgba(60,90,140,0.3)'
  ctx.beginPath()
  ctx.moveTo(x + w / 2, y)
  ctx.lineTo(x + w / 2, y + h)
  ctx.stroke()

  ctx.fillStyle = 'rgba(130,160,210,0.8)'
  ctx.font = `700 9px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('A', x + w / 4, y + h / 2)
  ctx.fillText('B', x + (w * 3) / 4, y + h / 2)
}

function drawElementCell(ctx: CanvasRenderingContext2D, el: ElementViewModel, col: number, row: number) {
  const block = textbookBlockClass(el)
  const style = CYBER_BLOCK[block]
  const { x, y, w, h } = cellRect(col, row)
  const r = 3

  ctx.fillStyle = style.bg
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()

  ctx.strokeStyle = style.border
  ctx.lineWidth = 1
  ctx.shadowColor = style.glow
  ctx.shadowBlur = 6
  ctx.beginPath()
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r)
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(100,140,180,0.75)'
  ctx.font = `600 7px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(String(el.z), x + 3, y + 2)

  ctx.textAlign = 'right'
  ctx.fillText(massDisplay(el.atomicMass), x + w - 3, y + 2)

  ctx.fillStyle = style.neon
  ctx.font = `800 ${h > 28 ? 13 : 11}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = style.glow
  ctx.shadowBlur = 10
  ctx.fillText(el.symbol, x + w / 2, y + h * 0.48)
  ctx.shadowBlur = 0

  const ruName = ELEMENT_NAMES_RU[el.z - 1] ?? el.symbol
  const shortName = ruName.length > 9 ? `${ruName.slice(0, 8)}…` : ruName
  ctx.fillStyle = 'rgba(160,190,220,0.72)'
  ctx.font = `600 6px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(shortName, x + w / 2, y + h - 2)

  if (el.z === 57 || el.z === 89) {
    ctx.fillStyle = style.neon
    ctx.font = `700 8px ${FONT}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(el.z === 57 ? '*' : '**', x + w - 2, y + 1)
  }
}

function drawVoidCell(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const { x, y, w, h } = cellRect(col, row)
  ctx.fillStyle = 'rgba(4,8,18,0.55)'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = 'rgba(40,60,100,0.25)'
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
}

function drawCenterLawPanel(ctx: CanvasRenderingContext2D) {
  const r = cellRectSpan(CENTER_PANEL_COL_START, CENTER_PANEL_COL_END, CENTER_PANEL_ROW)
  ctx.fillStyle = 'rgba(2,8,20,0.88)'
  ctx.strokeStyle = 'rgba(0,229,255,0.22)'
  ctx.lineWidth = 1
  ctx.fillRect(r.x, r.y, r.w, r.h)
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1)

  ctx.fillStyle = 'rgba(0,229,255,0.9)'
  ctx.font = `800 7px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.shadowColor = 'rgba(0,229,255,0.45)'
  ctx.shadowBlur = 8
  const titleLines = LAW_TITLE.split(' ')
  ctx.fillText(titleLines.slice(0, 3).join(' '), r.x + r.w / 2, r.y + 4)
  ctx.fillText(titleLines.slice(3).join(' '), r.x + r.w / 2, r.y + 12)
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(140,170,210,0.78)'
  ctx.font = `600 6px ${FONT}`
  const words = LAW_TEXT.split(' ')
  let line = ''
  let ly = r.y + 22
  const maxW = r.w - 8
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, r.x + r.w / 2, ly)
      line = word
      ly += 7
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, r.x + r.w / 2, ly)
}

function drawHeaders(ctx: CanvasRenderingContext2D) {
  drawAxisCell(ctx, 1, 1, 'П', { fontSize: 9 })
  drawAxisCell(ctx, 2, 1, 'Р', { fontSize: 9 })

  for (let i = 0; i < 7; i++) {
    drawAxisCell(ctx, 3 + i, 1, RU_GROUP_LABELS[i]!)
  }
  const viii = cellRectSpan(10, 12, 1)
  ctx.fillStyle = 'rgba(2,6,16,0.82)'
  ctx.fillRect(viii.x, viii.y, viii.w, viii.h)
  ctx.strokeStyle = 'rgba(0,229,255,0.14)'
  ctx.strokeRect(viii.x + 0.5, viii.y + 0.5, viii.w - 1, viii.h - 1)
  ctx.fillStyle = 'rgba(200,230,255,0.92)'
  ctx.font = `700 11px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('VIII', viii.x + viii.w / 2, viii.y + viii.h / 2)

  for (let g = 1; g <= 7; g++) {
    drawSubHeadGroup(ctx, 2 + g, 2)
  }
  drawAxisCell(ctx, 10, 2, 'A', { fontSize: 9 })
  drawAxisCell(ctx, triadGridColumn(1), 2, 'B', { fontSize: 9 })
  drawAxisCell(ctx, triadGridColumn(2), 2, 'B', { fontSize: 9 })

  const periodRowStarts = new Set([1, 2, 3, 4, 6, 8, 10])
  for (let y = 1; y <= 11; y++) {
    const gridRow = ruMainGridRow(y)
    if (periodRowStarts.has(y)) {
      const period = ruPeriodLabelForRow(y)
      const span = y === 4 || y === 6 || y === 8 || y === 10 ? 2 : 1
      const pr =
        span === 2
          ? cellRectSpan(1, 2, gridRow, gridRow + span)
          : cellRect(1, gridRow)
      ctx.fillStyle = 'rgba(2,6,16,0.82)'
      ctx.fillRect(pr.x, pr.y, pr.w, pr.h)
      ctx.strokeStyle = 'rgba(0,229,255,0.14)'
      ctx.strokeRect(pr.x + 0.5, pr.y + 0.5, pr.w - 1, pr.h - 1)
      ctx.fillStyle = 'rgba(110,140,190,0.85)'
      ctx.font = `700 9px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(period, pr.x + pr.w / 2, pr.y + pr.h / 2)
    }
    drawAxisCell(ctx, 2, gridRow, String(y), { fontSize: 9 })
  }

  for (const [label, y] of [
    ['ЛАНТАНОИДЫ*', 12],
    ['АКТИНОИДЫ**', 13],
  ] as const) {
    const r = cellRectSpan(1, 3, ruFBlockGridRow(y))
    ctx.fillStyle = 'rgba(2,6,16,0.82)'
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.strokeStyle = 'rgba(199,125,255,0.25)'
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1)
    ctx.fillStyle = 'rgba(199,125,255,0.9)'
    ctx.font = `700 6px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2)
  }
}

function drawFBlockBackdrop(ctx: CanvasRenderingContext2D) {
  const top = cellRect(ELEMENT_FIRST_COL, ruFBlockGridRow(12)).y
  const bottom = cellRect(GRID_COLS, ruFBlockGridRow(13)).y + CELL_H
  const left = cellRect(ELEMENT_FIRST_COL, ruFBlockGridRow(12)).x
  const right = cellRect(GRID_COLS, ruFBlockGridRow(13)).x + CELL_W
  ctx.fillStyle = 'rgba(8,4,16,0.35)'
  ctx.fillRect(left, top, right - left, bottom - top)
}

function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(0,229,255,0.35)'
  ctx.lineWidth = 2
  ctx.shadowColor = 'rgba(0,229,255,0.3)'
  ctx.shadowBlur = 12
  ctx.strokeRect(4, 4, w - 8, h - 8)
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(255,45,149,0.55)'
  ctx.font = `700 7px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('PSХЭ·118', 10, h - 6)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(0,229,255,0.55)'
  ctx.fillText('ATOMLAB', w - 10, h - 6)
}

export function createCyberPeriodicTableTexture(): THREE.CanvasTexture {
  const { gridW, totalW } = gridOrigin()
  const gridH = GRID_ROWS * (CELL_H + GAP) - GAP
  const w = totalW
  const h = PAD + TITLE_H + GROUPS_H + gridH + PAD
  const scale = 3

  const canvas = document.createElement('canvas')
  canvas.width = w * scale
  canvas.height = h * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, w, h)
  drawPanelGlow(ctx, w, h)
  drawScanlines(ctx, w, h)

  ctx.fillStyle = 'rgba(210,230,255,0.92)'
  ctx.font = `800 11px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.shadowColor = 'rgba(0,229,255,0.35)'
  ctx.shadowBlur = 14
  ctx.fillText(`⟨ ${MAIN_TITLE} ⟩`, w / 2, PAD + 4)
  ctx.shadowBlur = 0

  const lineY = PAD + 20
  const lineW = Math.min(80, gridW * 0.18)
  ctx.strokeStyle = 'rgba(0,229,255,0.55)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(w / 2 - lineW - 12, lineY)
  ctx.lineTo(w / 2 - 12, lineY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(w / 2 + 12, lineY)
  ctx.lineTo(w / 2 + lineW + 12, lineY)
  ctx.stroke()
  ctx.fillStyle = 'rgba(0,229,255,0.8)'
  ctx.font = `700 6px ${FONT}`
  ctx.fillText('◆', w / 2, lineY - 3)

  ctx.fillStyle = 'rgba(0,229,255,0.42)'
  ctx.font = `600 7px ${FONT}`
  ctx.fillText(GROUPS_LABEL, w / 2, PAD + TITLE_H - 10)

  const colBackdrop = cellRectSpan(3, GRID_COLS + 1, 3, 14)
  ctx.fillStyle = 'rgba(255,45,149,0.04)'
  ctx.fillRect(colBackdrop.x, colBackdrop.y, colBackdrop.w, colBackdrop.h)

  drawHeaders(ctx)
  drawCenterLawPanel(ctx)

  for (const { col, row } of ruMainVoidCells()) {
    drawVoidCell(ctx, col, row)
  }

  const gapRow = cellRect(1, F_BLOCK_GAP_ROW)
  ctx.fillStyle = BG
  ctx.fillRect(gapRow.x, gapRow.y, gridW, gapRow.h)

  drawFBlockBackdrop(ctx)

  for (const el of ELEMENTS) {
    const pos = getRuGridPos(el.z)
    if (!pos) continue

    if (pos.f != null) {
      const col = ELEMENT_FIRST_COL + pos.f
      const row = ruFBlockGridRow(pos.y)
      drawElementCell(ctx, el, col, row)
      continue
    }

    const col = ruElementGridColumn(pos)
    const row = ruMainGridRow(pos.y)
    if (col == null) continue
    drawElementCell(ctx, el, col, row)
  }

  drawFrame(ctx, w, h)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 8
  return tex
}
