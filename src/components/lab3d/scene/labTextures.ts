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
  // Вид из окна: небо с кучевыми облаками, два плана домов (дальний — голубоватая дымка), деревья кронами, газон.
  const W = 1024
  const H = 512
  const [c, ctx] = makeCanvas(W, H)
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.75)
  sky.addColorStop(0, '#7fb3e6')
  sky.addColorStop(0.6, '#bcdaf3')
  sky.addColorStop(1, '#e6f0f7')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)
  const r = rng(23)
  // Кучевые облака: группы мягких пятен, плоское основание, низ чуть серее
  for (let k = 0; k < 7; k++) {
    const cx = r() * W
    const cy = 50 + r() * 130
    const span = 90 + r() * 120
    for (let j = 0; j < 9; j++) {
      const x = cx + (r() - 0.5) * span
      const y = cy - r() * 26
      const rad = 22 + r() * 34
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
      g.addColorStop(0, 'rgba(255,255,255,0.92)')
      g.addColorStop(0.6, 'rgba(250,252,255,0.55)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
    const base = ctx.createLinearGradient(0, cy, 0, cy + 22)
    base.addColorStop(0, 'rgba(205,214,226,0.35)')
    base.addColorStop(1, 'rgba(205,214,226,0)')
    ctx.fillStyle = base
    ctx.fillRect(cx - span * 0.55, cy, span * 1.1, 22)
  }
  const horizon = H * 0.72
  // Дома: дальний план (дымка) и ближний (тёплые фасады, ряды окон, кровля)
  const houses = (n: number, near: boolean) => {
    for (let k = 0; k < n; k++) {
      const bw = (near ? 90 : 60) + r() * (near ? 110 : 80)
      const bh = (near ? 70 : 90) + r() * (near ? 110 : 120)
      const x = r() * W - 30
      const top = horizon - bh + (near ? 18 : 0)
      const t = r()
      ctx.fillStyle = near
        ? `rgb(${Math.round(214 + t * 22)},${Math.round(200 + t * 18)},${Math.round(178 + t * 14)})`
        : `rgb(${Math.round(188 + t * 14)},${Math.round(200 + t * 12)},${Math.round(214 + t * 10)})`
      ctx.fillRect(x, top, bw, bh + 60)
      ctx.fillStyle = near ? 'rgba(120,96,80,0.55)' : 'rgba(150,166,186,0.6)'
      ctx.fillRect(x - 3, top - 5, bw + 6, 6)
      for (let wy = top + 12; wy < horizon + 10; wy += near ? 22 : 16) {
        for (let wx = x + 9; wx < x + bw - 12; wx += near ? 20 : 14) {
          const lit = r()
          ctx.fillStyle = near
            ? lit > 0.85 ? 'rgba(236,232,210,0.9)' : 'rgba(92,116,140,0.75)'
            : 'rgba(150,172,196,0.55)'
          ctx.fillRect(wx, wy, near ? 10 : 7, near ? 12 : 8)
        }
      }
    }
  }
  houses(8, false)
  // Лёгкая дымка между планами
  const haze = ctx.createLinearGradient(0, horizon - 140, 0, horizon)
  haze.addColorStop(0, 'rgba(225,236,246,0)')
  haze.addColorStop(1, 'rgba(225,236,246,0.45)')
  ctx.fillStyle = haze
  ctx.fillRect(0, horizon - 140, W, 140)
  houses(5, true)
  // Газон и дорожка
  const lawn = ctx.createLinearGradient(0, horizon + 10, 0, H)
  lawn.addColorStop(0, '#8fae6c')
  lawn.addColorStop(1, '#6f9152')
  ctx.fillStyle = lawn
  ctx.fillRect(0, horizon + 10, W, H - horizon)
  ctx.fillStyle = 'rgba(214,206,190,0.9)'
  ctx.beginPath()
  ctx.moveTo(W * 0.58, horizon + 12)
  ctx.lineTo(W * 0.64, horizon + 12)
  ctx.lineTo(W * 0.86, H)
  ctx.lineTo(W * 0.68, H)
  ctx.closePath()
  ctx.fill()
  // Деревья: ствол и крона из нескольких пятен, тень снизу кроны
  for (let k = 0; k < 16; k++) {
    const x = r() * W
    const baseY = horizon + 14 + r() * 26
    const size = 30 + r() * 26
    ctx.fillStyle = '#6b5442'
    ctx.fillRect(x - 3, baseY - size * 0.9, 6, size * 0.9)
    const g0 = 70 + r() * 30
    for (let j = 0; j < 7; j++) {
      const bx = x + (r() - 0.5) * size * 1.1
      const by = baseY - size * 1.15 + (r() - 0.5) * size * 0.8
      const br = size * (0.38 + r() * 0.22)
      const shade = by > baseY - size * 1.1 ? 0.82 : 1
      ctx.fillStyle = `rgb(${Math.round((g0 - 10) * shade)},${Math.round((g0 + 62) * shade)},${Math.round((g0 - 22) * shade)})`
      ctx.beginPath()
      ctx.arc(bx, by, br, 0, Math.PI * 2)
      ctx.fill()
    }
  }
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

/** Химстойкая столешница: светлый «камень» с мелкой крапинкой и лёгкими разводами (без пластикового вида). */
export function benchTopTexture(): THREE.CanvasTexture {
  const S = 512
  const [c, ctx] = makeCanvas(S, S)
  const r = rng(23)
  ctx.fillStyle = '#f3f5f7'
  ctx.fillRect(0, 0, S, S)
  // Мягкие разводы
  for (let i = 0; i < 26; i++) {
    const x = r() * S
    const y = r() * S
    const g = ctx.createRadialGradient(x, y, 0, x, y, 60 + r() * 120)
    const tone = r() > 0.5 ? '228,233,238' : '251,252,253'
    g.addColorStop(0, `rgba(${tone},0.4)`)
    g.addColorStop(1, `rgba(${tone},0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
  }
  // Крапинка
  for (let i = 0; i < 2600; i++) {
    const v = 150 + Math.floor(r() * 80)
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 10},${0.18 + r() * 0.3})`
    const s = r() < 0.92 ? 1 : 2
    ctx.fillRect(r() * S, r() * S, s, s)
  }
  const t = toTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 1.1)
  return t
}
