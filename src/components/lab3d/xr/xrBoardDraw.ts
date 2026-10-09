/**
 * Рисование VR-доски (1280 × 720) и наручного HUD (512 × 288) на canvas: те же данные, что на HTML-доске
 * (опыт, шаг, инструкция, наблюдение, уравнение), кнопки «◀ Назад» «Далее ▶» «Сначала» и лента опытов.
 * Координаты кнопок — в px канвы; XrBoardPanel переводит их в метры для невидимых зон нажатия.
 */
import type { LabExperimentId, LabLang } from '../labContract'
import { getLabExperiment, isLabExperimentId, LAB_EXPERIMENT_GROUPS } from '../../../data/labWorks/labExperiments'
import { RIG_GESTURES } from '../experiments/rigTargets'
import { roundRect, wrapText, XR_FONT } from './xrText'

export const BOARD_TEX = { w: 1280, h: 720 } as const
export const HUD_TEX = { w: 512, h: 288 } as const

export interface BoardBox {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly cmd: 'next' | 'back' | 'restart' | 'select' | 'page'
  readonly experimentId?: string
  readonly page?: number
}

const UI: Record<string, Record<LabLang, string>> = {
  step: { ru: 'Шаг {n} из {N}', en: 'Step {n} of {N}', uz: '{n}-qadam / {N}' },
  done: { ru: 'Опыт завершён', en: 'Experiment complete', uz: 'Tajriba yakunlandi' },
  back: { ru: '◀ Назад', en: '◀ Back', uz: '◀ Orqaga' },
  next: { ru: 'Далее ▶', en: 'Next ▶', uz: 'Keyingi ▶' },
  restart: { ru: '↺ Сначала', en: '↺ Restart', uz: '↺ Boshidan' },
  obs: { ru: 'Наблюдение: ', en: 'Observation: ', uz: 'Kuzatish: ' },
  tap: { ru: 'Наведите луч и нажмите курок', en: 'Point the ray and pull the trigger', uz: 'Nurni qarating va tugmani bosing' },
  drag: { ru: 'Нажмите курок и ведите луч', en: 'Hold the trigger and move the ray', uz: 'Tugmani bosib, nurni yurgizing' },
  swipe: { ru: 'Нажмите курок и проведите лучом', en: 'Hold the trigger and swipe the ray', uz: 'Tugmani bosib, nur bilan suring' },
}
const tr = (k: string, lang: LabLang, n?: number, N?: number) => UI[k]![lang].replace('{n}', String(n ?? '')).replace('{N}', String(N ?? ''))

export const CARDS_PER_PAGE = 5
/** 10 работ + задачи-опыты класса текущего опыта. */
export function boardList(experimentId: string): readonly LabExperimentId[] {
  const grade = isLabExperimentId(experimentId) ? getLabExperiment(experimentId).grade : 7
  const works = LAB_EXPERIMENT_GROUPS.filter((g) => g.id === 'signs' || g.id === 'practical').flatMap((g) => g.ids)
  const tasks = LAB_EXPERIMENT_GROUPS.find((g) => g.id === `tasks${grade}`)?.ids ?? []
  return [...works, ...tasks]
}

export function boardBoxes(experimentId: string, page: number): BoardBox[] {
  const boxes: BoardBox[] = [
    { id: 'back', x: 940, y: 140, w: 300, h: 96, cmd: 'back' },
    { id: 'next', x: 940, y: 256, w: 300, h: 96, cmd: 'next' },
    { id: 'restart', x: 940, y: 372, w: 300, h: 96, cmd: 'restart' },
  ]
  const list = boardList(experimentId)
  const pages = Math.max(1, Math.ceil(list.length / CARDS_PER_PAGE))
  const pg = Math.min(page, pages - 1)
  list.slice(pg * CARDS_PER_PAGE, pg * CARDS_PER_PAGE + CARDS_PER_PAGE).forEach((id, i) => {
    boxes.push({ id: `card:${id}`, x: 24 + i * 248, y: 590, w: 240, h: 110, cmd: 'select', experimentId: id })
  })
  if (pages > 1) {
    boxes.push({ id: 'prev-page', x: 1040, y: 528, w: 90, h: 52, cmd: 'page', page: (pg + pages - 1) % pages })
    boxes.push({ id: 'next-page', x: 1150, y: 528, w: 90, h: 52, cmd: 'page', page: (pg + 1) % pages })
  }
  return boxes
}

function button(ctx: CanvasRenderingContext2D, b: BoardBox, label: string, hover: boolean, primary = false) {
  roundRect(ctx, b.x, b.y, b.w, b.h, 22)
  ctx.fillStyle = primary ? (hover ? '#1f63d6' : '#2f7cf6') : hover ? '#dbe8ff' : '#eef3fb'
  ctx.fill()
  ctx.lineWidth = hover ? 5 : 2
  ctx.strokeStyle = hover ? '#ffb020' : '#b8c7df'
  ctx.stroke()
  ctx.fillStyle = primary ? '#ffffff' : '#0f172a'
  ctx.font = `700 40px ${XR_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 2)
}

export function drawBoard(ctx: CanvasRenderingContext2D, experimentId: string, step: number, lang: LabLang, page: number, hover: string | null) {
  const { w, h } = BOARD_TEX
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#f8fafc'
  roundRect(ctx, 0, 0, w, h, 28)
  ctx.fill()
  if (!isLabExperimentId(experimentId)) return
  const def = getLabExperiment(experimentId)
  const total = def.steps.length
  const s = Math.min(step, total)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#2f7cf6'
  ctx.font = `700 44px ${XR_FONT}`
  ctx.fillText(wrapText(ctx, `${def.source[lang]} · ${def.title[lang]}`, 860, 1)[0] ?? '', 40, 70)
  ctx.fillStyle = '#475569'
  ctx.font = `600 36px ${XR_FONT}`
  ctx.fillText(s >= total ? tr('done', lang) : tr('step', lang, s + 1, total), 40, 122)
  // инструкция текущего шага (≤ 4 строк)
  ctx.fillStyle = '#0f172a'
  ctx.font = `600 48px ${XR_FONT}`
  const instr = s < total ? def.steps[s]!.instruction[lang] : def.conclusion[lang]
  const lines = wrapText(ctx, instr, 860, 4)
  lines.forEach((l, i) => ctx.fillText(l, 40, 190 + i * 58))
  // наблюдение прошлого шага (что ученик только что увидел)
  const prev = s > 0 ? def.steps[s - 1]?.observation?.[lang] : undefined
  let y = 190 + lines.length * 58 + 18
  if (prev) {
    ctx.fillStyle = '#334155'
    ctx.font = `italic 500 36px ${XR_FONT}`
    const ol = wrapText(ctx, tr('obs', lang) + prev, 860, 2)
    ol.forEach((l, i) => ctx.fillText(l, 40, y + i * 44))
    y += ol.length * 44 + 10
  }
  ctx.fillStyle = '#0f172a'
  ctx.font = `700 56px ${XR_FONT}`
  ctx.fillText(wrapText(ctx, def.equation, 1180, 1)[0] ?? '', 40, Math.max(y + 46, 520))
  const boxes = boardBoxes(experimentId, page)
  for (const b of boxes) {
    if (b.cmd === 'back') button(ctx, b, tr('back', lang), hover === b.id)
    else if (b.cmd === 'next') button(ctx, b, tr('next', lang), hover === b.id, true)
    else if (b.cmd === 'restart') button(ctx, b, tr('restart', lang), hover === b.id)
    else if (b.cmd === 'page') button(ctx, b, b.id === 'prev-page' ? '◀' : '▶', hover === b.id)
    else if (b.cmd === 'select' && b.experimentId && isLabExperimentId(b.experimentId)) {
      const d = getLabExperiment(b.experimentId)
      const cur = b.experimentId === experimentId
      roundRect(ctx, b.x, b.y, b.w, b.h, 18)
      ctx.fillStyle = cur ? '#dbe8ff' : hover === b.id ? '#fff4dc' : '#ffffff'
      ctx.fill()
      ctx.lineWidth = cur || hover === b.id ? 4 : 2
      ctx.strokeStyle = cur ? '#2f7cf6' : hover === b.id ? '#ffb020' : '#cbd5e1'
      ctx.stroke()
      ctx.fillStyle = '#0f172a'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.font = `600 26px ${XR_FONT}`
      wrapText(ctx, d.title[lang], b.w - 24, 3).forEach((l, i) => ctx.fillText(l, b.x + 12, b.y + 36 + i * 31))
    }
  }
}

/** Наручный HUD: инструкция (2 строки), «n/N» и подсказка жеста. */
export function drawHud(ctx: CanvasRenderingContext2D, experimentId: string, step: number, lang: LabLang) {
  const { w, h } = HUD_TEX
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(15,23,42,0.88)'
  roundRect(ctx, 0, 0, w, h, 26)
  ctx.fill()
  if (!isLabExperimentId(experimentId)) return
  const def = getLabExperiment(experimentId)
  const total = def.steps.length
  const s = Math.min(step, total)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#7fb0ff'
  ctx.font = `700 34px ${XR_FONT}`
  ctx.fillText(s >= total ? '✓' : `${s + 1}/${total}`, 24, 50)
  ctx.fillStyle = '#ffffff'
  ctx.font = `600 34px ${XR_FONT}`
  const text = s < total ? def.steps[s]!.instruction[lang] : def.conclusion[lang]
  wrapText(ctx, text, w - 48, 2).forEach((l, i) => ctx.fillText(l, 24, 112 + i * 44))
  const g = s < total ? RIG_GESTURES[experimentId][s] : null
  ctx.fillStyle = '#ffb020'
  ctx.font = `600 28px ${XR_FONT}`
  if (g) ctx.fillText(wrapText(ctx, `✋ ${tr(g.kind, lang)}`, w - 48, 1)[0] ?? '', 24, h - 34)
}
