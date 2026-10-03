/**
 * Процедурные текстуры светлой лаборатории (CanvasTexture, без загрузок из сети):
 * плитка пола, потолок, вид из окна, этикетки банок, плакаты (техника безопасности, таблица Менделеева), дисплей весов.
 */
import * as THREE from 'three'
import type { LabLang } from '../labContract'

const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif'

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2d context')
  return [c, ctx]
}

function toTexture(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c)
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

/** Детерминированный шум — одинаковая картинка при каждом открытии. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Пол: светлая виниловая плитка 60 см (в текстуре 4×4 плитки = 2,4 м). */
export function floorTexture(): THREE.CanvasTexture {
  const S = 1024
  const [c, ctx] = makeCanvas(S, S)
  const r = rng(7)
  const n = 4
  const cell = S / n
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = 206 + Math.floor(r() * 12)
      ctx.fillStyle = `rgb(${v - 4},${v - 1},${v + 3})`
      ctx.fillRect(i * cell, j * cell, cell, cell)
    }
  }
  // Мелкая крошка винила
  for (let k = 0; k < 9000; k++) {
    const x = r() * S
    const y = r() * S
    const g = r() < 0.5 ? 200 + r() * 20 : 236 + r() * 15
    ctx.fillStyle = `rgba(${g},${g},${g + 4},0.55)`
    ctx.fillRect(x, y, 1.5 + r() * 2, 1.5 + r() * 2)
  }
  ctx.strokeStyle = 'rgba(160,168,180,0.9)'
  ctx.lineWidth = 3
  for (let i = 0; i <= n; i++) {
    ctx.beginPath()
    ctx.moveTo(i * cell, 0)
    ctx.lineTo(i * cell, S)
    ctx.moveTo(0, i * cell)
    ctx.lineTo(S, i * cell)
    ctx.stroke()
  }
  const tex = toTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** Потолок: акустические плиты «Армстронг» 60×60. */
export function ceilingTexture(): THREE.CanvasTexture {
  const S = 512
  const [c, ctx] = makeCanvas(S, S)
  const r = rng(11)
  ctx.fillStyle = '#f5f6f8'
  ctx.fillRect(0, 0, S, S)
  for (let k = 0; k < 5000; k++) {
    ctx.fillStyle = `rgba(150,155,165,${0.08 + r() * 0.12})`
    ctx.fillRect(r() * S, r() * S, 1.6, 1.6)
  }
  ctx.strokeStyle = '#d5d9df'
  ctx.lineWidth = 6
  ctx.strokeRect(0, 0, S, S)
  const tex = toTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** Вид из окна: светлое небо, облака, деревья и дома вдали (яркий, без тон-маппинга). */
export function windowViewTexture(): THREE.CanvasTexture {
  const W = 1024
  const H = 512
  const [c, ctx] = makeCanvas(W, H)
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#9fcaf4')
  sky.addColorStop(0.55, '#d8ecfb')
  sky.addColorStop(1, '#f4f8fb')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)
  const r = rng(23)
  for (let k = 0; k < 14; k++) {
    const x = r() * W
    const y = 40 + r() * 160
    const rad = 40 + r() * 70
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
    g.addColorStop(0, 'rgba(255,255,255,0.85)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  // Дома вдали
  for (let k = 0; k < 9; k++) {
    const bw = 60 + r() * 90
    const bh = 60 + r() * 120
    const x = r() * W
    ctx.fillStyle = `rgb(${206 + r() * 20},${210 + r() * 18},${218 + r() * 14})`
    ctx.fillRect(x, H * 0.72 - bh, bw, bh + 40)
    ctx.fillStyle = 'rgba(160,185,210,0.55)'
    for (let wy = H * 0.72 - bh + 10; wy < H * 0.72; wy += 18) {
      for (let wx = x + 8; wx < x + bw - 10; wx += 16) ctx.fillRect(wx, wy, 8, 9)
    }
  }
  // Кроны деревьев
  for (let k = 0; k < 60; k++) {
    const x = r() * W
    const y = H * 0.74 + r() * 30
    const rad = 26 + r() * 34
    ctx.fillStyle = `rgb(${96 + r() * 40},${150 + r() * 40},${92 + r() * 30})`
    ctx.beginPath()
    ctx.arc(x, y, rad, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#b9c7a4'
  ctx.fillRect(0, H * 0.85, W, H * 0.15)
  return toTexture(c)
}

export interface JarLabel {
  readonly formula: string
  readonly name: LabTextLike
  /** Цвет полосы-предупреждения: кислоты — красный, щёлочи — синий, соли — зелёный, металлы — серый. */
  readonly band: string
}
type LabTextLike = Readonly<Record<LabLang, string>>

/** Этикетка банки: белая с цветной полосой, формула крупно, название мелко. */
export function jarLabelTexture(label: JarLabel, lang: LabLang): THREE.CanvasTexture {
  const W = 512
  const H = 256
  const [c, ctx] = makeCanvas(W, H)
  ctx.fillStyle = '#fbfbf8'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = label.band
  ctx.fillRect(0, 0, W, 46)
  ctx.fillRect(0, H - 18, W, 18)
  ctx.fillStyle = '#ffffff'
  ctx.font = `600 26px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ATOMLAB · REAGENT', W / 2, 24)
  ctx.fillStyle = '#18202a'
  ctx.font = `700 92px ${FONT}`
  ctx.fillText(label.formula, W / 2, 112)
  ctx.fillStyle = '#4a5562'
  ctx.font = `500 30px ${FONT}`
  ctx.fillText(label.name[lang], W / 2, 190)
  return toTexture(c)
}

const SAFETY: Readonly<Record<LabLang, { title: string; rules: string[] }>> = {
  ru: {
    title: 'Техника безопасности',
    rules: [
      'Опыты — только по заданию учителя',
      'Работай в очках и перчатках',
      'Пробирку нагревай под углом, отверстием от себя',
      'Спиртовку гаси колпачком, не задувай',
      'Сначала вода, потом кислота',
      'Водород проверяй на чистоту',
      'Вещества не пробуй на вкус',
    ],
  },
  en: {
    title: 'Lab safety rules',
    rules: [
      'Experiments only as the teacher says',
      'Wear goggles and gloves',
      'Heat a test tube at an angle, mouth away',
      'Put out a spirit lamp with its cap',
      'Water first, then acid',
      'Test hydrogen for purity',
      'Never taste chemicals',
    ],
  },
  uz: {
    title: 'Xavfsizlik texnikasi',
    rules: [
      'Tajriba — faqat o‘qituvchi topshirig‘i bilan',
      'Ko‘zoynak va qo‘lqopda ishlang',
      'Probirkani qiya, og‘zini o‘zingizdan nari qizdiring',
      'Spirt lampani qalpoqcha bilan o‘chiring',
      'Avval suv, keyin kislota',
      'Vodorodni tozalikka tekshiring',
      'Moddalarni tatib ko‘rmang',
    ],
  },
}

/** Плакат «Техника безопасности» (как в § 1.4 учебника). */
export function safetyPosterTexture(lang: LabLang): THREE.CanvasTexture {
  const W = 600
  const H = 840
  const [c, ctx] = makeCanvas(W, H)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#e8483b'
  ctx.fillRect(0, 0, W, 120)
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 40px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(SAFETY[lang].title, W / 2, 62)
  ctx.textAlign = 'left'
  const rules = SAFETY[lang].rules
  rules.forEach((rule, i) => {
    const y = 175 + i * 94
    ctx.fillStyle = i % 2 === 0 ? '#2f7cf6' : '#18a058'
    ctx.beginPath()
    ctx.arc(58, y, 26, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 28px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(String(i + 1), 58, y + 1)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#1d2733'
    ctx.font = `500 27px ${FONT}`
    wrapText(ctx, rule, 102, y, W - 130, 32)
  })
  return toTexture(c)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, yCenter: number, maxW: number, lh: number): void {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  const y0 = yCenter - ((lines.length - 1) * lh) / 2
  lines.forEach((l, i) => ctx.fillText(l, x, y0 + i * lh))
}

const SYMBOLS =
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(
    ' ',
  )

/** Позиция элемента (период, группа) в длинной форме; лантаноиды/актиноиды — отдельными рядами 8 и 9. */
function cellOf(z: number): [number, number] {
  if (z === 1) return [0, 0]
  if (z === 2) return [0, 17]
  const periods = [
    [3, 10],
    [11, 18],
    [19, 36],
    [37, 54],
    [55, 86],
    [87, 118],
  ]
  for (let p = 0; p < periods.length; p++) {
    const [a, b] = periods[p]
    if (z < a || z > b) continue
    const row = p + 1
    const i = z - a
    if (row <= 2) return [row, i < 2 ? i : i + 10]
    if (row <= 4) return [row, i]
    // 6–7 периоды: 57–71 и 89–103 вынесены вниз
    const fStart = row === 5 ? 57 : 89
    if (z >= fStart && z <= fStart + 14) return [row === 5 ? 8 : 9, 2 + (z - fStart)]
    if (z < fStart) return [row, i]
    return [row, z - fStart - 15 + 3]
  }
  return [0, 0]
}

/** Плакат «Периодическая система» — сетка ячеек с символами, цвет по типу элемента. */
export function periodicPosterTexture(): THREE.CanvasTexture {
  const W = 1280
  const H = 800
  const [c, ctx] = makeCanvas(W, H)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#1d2733'
  ctx.font = `700 40px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('D. I. Mendeleyev · Periodic Table', W / 2, 44)
  const cw = 66
  const ch = 66
  const x0 = (W - cw * 18) / 2
  const y0 = 92
  const metalloids = new Set([5, 14, 32, 33, 51, 52])
  const nonmetals = new Set([1, 6, 7, 8, 9, 15, 16, 17, 34, 35, 53, 85])
  const noble = new Set([2, 10, 18, 36, 54, 86, 118])
  SYMBOLS.forEach((sym, idx) => {
    const z = idx + 1
    const [row, col] = cellOf(z)
    const x = x0 + col * cw
    const y = y0 + row * ch + (row >= 8 ? 18 : 0)
    let fill = '#cfe3ff'
    if (z <= 2 || [3, 11, 19, 37, 55, 87].includes(z)) fill = z === 1 ? '#c8f0d4' : '#ffd6cc'
    if ([4, 12, 20, 38, 56, 88].includes(z)) fill = '#ffe8c2'
    if (nonmetals.has(z)) fill = '#c8f0d4'
    if (metalloids.has(z)) fill = '#e6dcff'
    if (noble.has(z)) fill = '#d7f1f7'
    if (row >= 8) fill = '#fbe0ef'
    ctx.fillStyle = fill
    ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4)
    ctx.fillStyle = '#7a8594'
    ctx.font = `500 13px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(String(z), x + 7, y + 13)
    ctx.fillStyle = '#18202a'
    ctx.font = `700 26px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(sym, x + cw / 2, y + ch / 2 + 6)
  })
  return toTexture(c)
}

/** Дисплей электронных весов «0.00 g». */
export function scalesDisplayTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 96)
  ctx.fillStyle = '#c9e2c4'
  ctx.fillRect(0, 0, 256, 96)
  ctx.fillStyle = '#1f2b1d'
  ctx.font = `600 60px "Consolas", monospace`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText('0.00 g', 240, 50)
  return toTexture(c)
}

/** Маленькая табличка (вытяжной шкаф, аптечка и т. п.). */
export function signTexture(text: string, bg: string, fg = '#ffffff', w = 512, h = 128): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(w, h)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = fg
  ctx.font = `700 ${Math.round(h * 0.42)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2 + 2)
  return toTexture(c)
}
