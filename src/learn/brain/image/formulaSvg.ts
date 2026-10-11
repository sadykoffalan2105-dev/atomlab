/**
 * Подписи на картинке «Нарисовать»: модель картинок текст не рисует (буквы у неё выходят мусором), поэтому
 * формулу и подпись накладывает сайт — SVG-слоем поверх <img> и тем же SVG при склейке PNG (overlayCompose.ts).
 *
 *  • parseFormula('Fe2(SO4)3') → токены normal/sub/sup/arrow/state: индексы после элемента и «)» — sub,
 *    коэффициенты — normal, заряды «^2-», «Na+», «Fe3+», «SO42-» — sup (знак и число вместе, «-» → «−»),
 *    стрелки -> => <=> ⇌ ↑ ↓ — arrow (→ ⇄ ↑ ↓), (г) (ж) (тв) (aq) (s) (l) (g) — state, «*» / «·» → «·»;
 *  • renderOverlaySvg(): плашка (белая 78 % / тёмная 70 %), формула width/26, подпись width/40 (≤ 3 строк, «…»);
 *    шрифт только системный ("Segoe UI", Roboto, Arial) — внешний шрифт canvas не отрисует;
 *  • formulaToUnicode('H2SO4') → 'H₂SO₄' (alt-текст и пузырь чата).
 *
 * Индексы сдвигаются через dy (а не baseline-shift): Firefox и отрисовка SVG на canvas понимают dy одинаково.
 */

export type FormulaTokenKind = 'normal' | 'sub' | 'sup' | 'arrow' | 'state'

export interface FormulaToken {
  text: string
  kind: FormulaTokenKind
}

const SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉'
const SUP_MAP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '−' }
const STATE_RE = /^\((?:г|ж|тв|р-р|р|aq|s|l|g)\)/u
const MINUS = '−'

function isLatinLetter(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z]/.test(ch)
}
const isDigit = (ch: string | undefined): boolean => !!ch && ch >= '0' && ch <= '9'

/** Конец иона: дальше пусто, пробел, запятая, скобка, стрелка, точка с запятой. */
function ionEndAt(s: string, i: number): boolean {
  const ch = s[i]
  return ch === undefined || /[\s,;)\]→⇄⇌↑↓=]/u.test(ch) || s.startsWith('->', i) || s.startsWith('=>', i) || s.startsWith('<=>', i)
}

/** Разобрать формулу / уравнение на токены (соседние токены одного вида склеены). */
export function parseFormula(input: string): FormulaToken[] {
  const s = (input ?? '').replace(/\s+/g, ' ').trim()
  const out: FormulaToken[] = []
  const push = (text: string, kind: FormulaTokenKind) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last && last.kind === kind && kind !== 'arrow' && kind !== 'state') last.text += text
    else out.push({ text, kind })
  }
  /** Предыдущий значимый символ — для решения «индекс или коэффициент». */
  let prev = ''
  let i = 0
  while (i < s.length) {
    const ch = s[i]!
    // стрелки
    if (s.startsWith('<=>', i) || s.startsWith('<->', i)) {
      push('⇄', 'arrow')
      i += 3
      prev = '⇄'
      continue
    }
    if (s.startsWith('->', i) || s.startsWith('=>', i)) {
      push('→', 'arrow')
      i += 2
      prev = '→'
      continue
    }
    if (ch === '→' || ch === '⇄' || ch === '⇌' || ch === '↑' || ch === '↓') {
      push(ch === '⇌' ? '⇄' : ch, 'arrow')
      i += 1
      prev = ch
      continue
    }
    // агрегатное состояние
    if (ch === '(') {
      const st = STATE_RE.exec(s.slice(i))
      if (st) {
        push(st[0], 'state')
        i += st[0].length
        prev = ')s'
        continue
      }
    }
    // заряд через «^»: ^2-, ^+, ^3+; «H2^» без заряда — газ, стрелка ↑
    if (ch === '^') {
      const m = /^\^(\d*)([+\-−])/u.exec(s.slice(i))
      if (m) {
        push(`${m[1]}${m[2] === '+' ? '+' : MINUS}`, 'sup')
        i += m[0].length
        prev = '^'
        continue
      }
      push('↑', 'arrow')
      i += 1
      prev = '↑'
      continue
    }
    // юникодные индексы и степени
    const subIdx = SUB_DIGITS.indexOf(ch)
    if (subIdx >= 0) {
      push(String(subIdx), 'sub')
      i += 1
      prev = '1'
      continue
    }
    if (SUP_MAP[ch]) {
      push(SUP_MAP[ch]!, 'sup')
      i += 1
      prev = '^'
      continue
    }
    // цифры
    if (isDigit(ch)) {
      let j = i
      while (isDigit(s[j])) j++
      const digits = s.slice(i, j)
      const afterFormula = isLatinLetter(prev) || prev === ')' || prev === ']'
      const sign = s[j]
      // «Fe3+», «SO42-», «Cu2+» — заряд в конце иона
      if (afterFormula && (sign === '+' || sign === '-' || sign === '−') && ionEndAt(s, j + 1)) {
        const charge = digits.length >= 2 ? digits.slice(-1) : digits
        const index = digits.length >= 2 ? digits.slice(0, -1) : ''
        if (index) push(index, 'sub')
        push(`${charge}${sign === '+' ? '+' : MINUS}`, 'sup')
        i = j + 1
        prev = '^'
        continue
      }
      push(digits, afterFormula ? 'sub' : 'normal')
      i = j
      prev = afterFormula ? '1' : 'coef'
      continue
    }
    // заряд без цифры: «Na+», «Cl-», «(NH4)+»
    if ((ch === '+' || ch === '-' || ch === '−') && (isLatinLetter(prev) || prev === ')' || prev === '1') && ionEndAt(s, i + 1)) {
      push(ch === '+' ? '+' : MINUS, 'sup')
      i += 1
      prev = '^'
      continue
    }
    // точка кристаллогидрата
    if (ch === '*' || ch === '·' || ch === '•') {
      push('·', 'normal')
      i += 1
      prev = '·'
      continue
    }
    push(ch, 'normal')
    i += 1
    prev = ch === ' ' ? ' ' : ch
  }
  return out
}

const SUB_OF: Record<string, string> = Object.fromEntries([...'0123456789'].map((d, k) => [d, SUB_DIGITS[k]!]))
const SUP_OF: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '−': '⁻', '-': '⁻' }

/** «H2SO4» → «H₂SO₄», «SO4^2-» → «SO₄²⁻» (alt-текст, пузырь чата). */
export function formulaToUnicode(s: string): string {
  return parseFormula(s)
    .map((t) =>
      t.kind === 'sub'
        ? [...t.text].map((c) => SUB_OF[c] ?? c).join('')
        : t.kind === 'sup'
          ? [...t.text].map((c) => SUP_OF[c] ?? c).join('')
          : t.text,
    )
    .join('')
}

/* ------------------------------------------------------------------ SVG-слой */

export interface OverlayOptions {
  width: number
  height: number
  formula?: string
  caption?: string
  position?: 'bottom' | 'top'
  theme?: 'light' | 'dark'
}

const FONT = '"Segoe UI", Roboto, Arial, sans-serif'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** Примерная ширина строки (средняя буква ≈ 0,56 кегля) — для переноса и подбора кегля без DOM. */
function approxWidth(text: string, fontSize: number): number {
  let w = 0
  for (const ch of text) w += /[\s.,:;·()[\]|'’‘]/u.test(ch) ? 0.32 : /[A-ZА-ЯЁ0-9→⇄]/u.test(ch) ? 0.66 : 0.56
  return w * fontSize
}

function tokensWidth(tokens: FormulaToken[], fs: number): number {
  return tokens.reduce((acc, t) => acc + approxWidth(t.text, t.kind === 'normal' || t.kind === 'arrow' ? fs : fs * 0.7) + (t.kind === 'arrow' ? fs * 0.3 : 0), 0)
}

/** Подпись по словам: не больше maxLines строк, лишнее — «…». */
function wrapCaption(text: string, fontSize: number, maxWidth: number, maxLines = 3): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (approxWidth(next, fontSize) <= maxWidth || !cur) cur = next
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    let last = `${kept[maxLines - 1]!} ${lines.slice(maxLines).join(' ')}`
    while (last.length > 1 && approxWidth(`${last}…`, fontSize) > maxWidth) last = last.slice(0, -1)
    kept[maxLines - 1] = `${last.trimEnd()}…`
    return kept
  }
  // одно слово длиннее строки — режем
  return lines.map((l) => {
    if (approxWidth(l, fontSize) <= maxWidth) return l
    let cut = l
    while (cut.length > 1 && approxWidth(`${cut}…`, fontSize) > maxWidth) cut = cut.slice(0, -1)
    return `${cut}…`
  })
}

/** Формула → <tspan>: индексы ниже и мельче (0,7 кегля), заряды выше, состояние мельче. */
function formulaTspans(tokens: FormulaToken[], fs: number): string {
  const subDy = r1(fs * 0.3)
  const supDy = r1(-fs * 0.42)
  let offset = 0
  const parts: string[] = []
  for (const t of tokens) {
    const want = t.kind === 'sub' ? subDy : t.kind === 'sup' ? supDy : 0
    const dy = r1(want - offset)
    offset = want
    const small = t.kind === 'sub' || t.kind === 'sup' || t.kind === 'state'
    const attrs = [
      dy ? `dy="${dy}"` : '',
      small ? `font-size="${r1(fs * 0.7)}"` : '',
      t.kind === 'sub' ? 'data-k="sub"' : t.kind === 'sup' ? 'data-k="sup"' : t.kind === 'arrow' ? 'data-k="arrow"' : t.kind === 'state' ? 'data-k="state"' : '',
    ]
      .filter(Boolean)
      .join(' ')
    const text = t.kind === 'arrow' && t.text !== '↑' && t.text !== '↓' ? ` ${t.text} ` : t.text
    parts.push(`<tspan ${attrs}>${esc(text).replace(/ /g, '&#160;')}</tspan>`.replace('<tspan >', '<tspan>'))
  }
  return parts.join('')
}

/**
 * SVG-слой подписи размером с картинку (viewBox 0 0 width height). Пусто (нет ни формулы, ни подписи) — ''.
 * Строка безопасна для innerHTML: весь текст экранирован, внешних ссылок нет.
 */
export function renderOverlaySvg(o: OverlayOptions): string {
  const width = Math.max(64, Math.round(o.width))
  const height = Math.max(64, Math.round(o.height))
  const formula = (o.formula ?? '').trim().slice(0, 80)
  const caption = (o.caption ?? '').trim().slice(0, 120)
  if (!formula && !caption) return ''
  const dark = o.theme === 'dark'
  const fill = dark ? 'rgba(15,23,42,0.70)' : 'rgba(255,255,255,0.78)'
  const ink = dark ? '#f8fafc' : '#0f172a'
  const ink2 = dark ? '#cbd5e1' : '#334155'
  const margin = width * 0.03
  const plateW = width - margin * 2
  const pad = width * 0.022
  const textW = plateW - pad * 2

  const tokens = formula ? parseFormula(formula) : []
  let fs = width / 26
  // длинное уравнение — уменьшаем кегль, чтобы влезло в одну строку (не меньше width/52)
  if (tokens.length) {
    const need = tokensWidth(tokens, fs)
    if (need > textW) fs = Math.max(width / 52, (fs * textW) / need)
  }
  const cs = width / 40
  const lines = caption ? wrapCaption(caption, cs, textW) : []
  const formulaH = tokens.length ? fs * 1.45 : 0
  const lineH = cs * 1.32
  const gap = tokens.length && lines.length ? cs * 0.35 : 0
  const plateH = pad * 1.6 + formulaH + gap + lines.length * lineH
  const plateY = o.position === 'top' ? margin : height - margin - plateH
  const cx = width / 2

  const out: string[] = []
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" role="img">`,
  )
  out.push(
    `<rect x="${r1(margin)}" y="${r1(plateY)}" width="${r1(plateW)}" height="${r1(plateH)}" rx="${r1(Math.min(fs, cs * 1.6) * 0.45)}" fill="${fill}"/>`,
  )
  let y = plateY + pad * 0.8
  if (tokens.length) {
    y += fs * 1.05
    out.push(
      `<text x="${r1(cx)}" y="${r1(y)}" text-anchor="middle" font-family='${FONT}' font-size="${r1(fs)}" font-weight="600" fill="${ink}">${formulaTspans(tokens, fs)}</text>`,
    )
    y += fs * 0.4 + gap
  }
  for (const line of lines) {
    y += lineH * 0.82
    out.push(`<text x="${r1(cx)}" y="${r1(y)}" text-anchor="middle" font-family='${FONT}' font-size="${r1(cs)}" fill="${ink2}">${esc(line)}</text>`)
    y += lineH * 0.18
  }
  out.push('</svg>')
  return out.join('')
}
