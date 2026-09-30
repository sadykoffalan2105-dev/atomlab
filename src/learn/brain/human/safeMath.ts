/**
 * Безопасный калькулятор для учителя: рекурсивный спуск, без eval/Function.
 * Поддерживает + − × ÷ ^, скобки, унарный минус, проценты «15% от 200», корень «корень из 16».
 */
export type MathLang = 'ru' | 'en' | 'uz'

const WORD_OPS: [RegExp, string][] = [
  [/(?<!\p{L})(плюс|plus|qo'?sh(?:ilgan)?)(?!\p{L})/giu, '+'],
  [/(?<!\p{L})(минус|minus|ayir(?:ilgan)?)(?!\p{L})/giu, '-'],
  [/(?<!\p{L})(умножить\s+на|умноженное\s+на|помножить\s+на|times|multiplied\s+by|ko'?paytir(?:ilgan)?|karra)(?!\p{L})/giu, '*'],
  [/(?<!\p{L})(разделить\s+на|делить\s+на|поделить\s+на|делённое\s+на|деленное\s+на|divided\s+by|over|bo'?lin(?:gan)?)(?!\p{L})/giu, '/'],
  [/(?<!\p{L})(в\s+степени|to\s+the\s+power\s+of|darajasi)(?!\p{L})/giu, '^'],
  [/(?<!\p{L})(в\s+квадрате|squared|kvadrati)(?!\p{L})/giu, '^2'],
  [/(?<!\p{L})(корень\s+(?:квадратный\s+)?из|квадратный\s+корень\s+из|square\s+root\s+of|sqrt|ildiz)(?!\p{L})/giu, '√'],
]

/** Выделить из реплики арифметическое выражение (или null, если это не вычисление). */
export function extractArithmetic(raw: string): string | null {
  let t = raw.toLowerCase().replace(/ё/g, 'е').replace(/[ʻʼ‘’`]/g, "'")
  const pct = t.match(/(\d+(?:[.,]\d+)?)\s*(?:%|процент\p{L}*|percent|foiz)\s*(?:от|of|dan)\s*(\d+(?:[.,]\d+)?)/u)
  if (pct) return `${pct[1]!.replace(',', '.')}/100*${pct[2]!.replace(',', '.')}`
  for (const [re, op] of WORD_OPS) t = t.replace(re, ` ${op} `)
  t = t.replace(/[×·]/g, '*').replace(/[÷:]/g, '/').replace(/−/g, '-').replace(/(\d),(\d)/g, '$1.$2')
  // Только «вопросительная обвязка» + выражение: «сколько будет 2+2», «посчитай (3+4)*5», «2^10=?».
  const shell = t
    .replace(/^(а|и|ну|and|so|va)\s+/u, ' ')
    .replace(/(сколько\s+будет|сколько|посчитай|вычисли|подсчитай|реши\s+пример|реши|чему\s+равно|what\s+is|what's|calculate|compute|how\s+much\s+is|hisobla|necha\s+bo'?ladi|qancha)/gu, ' ')
    .replace(/[?=!.\s]+$/g, '')
    .trim()
  if (!/^[\d\s+\-*/^().√]+$/.test(shell)) return null
  if (!/\d/.test(shell) || !/[+\-*/^√]/.test(shell.replace(/^\s*-/, ''))) return null
  // Номер параграфа («§ 2-3») или дата — не пример: нужна хотя бы одна операция между числами.
  if (!/\d\s*[+\-*/^]\s*[\d(√]|√\s*[\d(]|\)\s*[+\-*/^]/.test(shell)) return null
  return shell
}

type Tok = { k: 'n'; v: number } | { k: 'op'; v: string }

function tokenize(expr: string): Tok[] | null {
  const out: Tok[] = []
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]!
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (/[\d.]/.test(ch)) {
      let j = i
      while (j < expr.length && /[\d.]/.test(expr[j]!)) j++
      const num = Number(expr.slice(i, j))
      if (!Number.isFinite(num)) return null
      out.push({ k: 'n', v: num })
      i = j
      continue
    }
    if ('+-*/^()√'.includes(ch)) {
      out.push({ k: 'op', v: ch })
      i++
      continue
    }
    return null
  }
  return out.length > 60 ? null : out
}

/** Вычислить выражение; null — если выражение некорректно (деление на ноль тоже null). */
export function evaluateArithmetic(expr: string): number | null {
  const toks = tokenize(expr)
  if (!toks?.length) return null
  let pos = 0
  let depth = 0
  const peek = () => toks[pos]
  const isOp = (v: string) => {
    const t = peek()
    return t?.k === 'op' && t.v === v
  }
  const primary = (): number => {
    const t = peek()
    if (!t) throw new Error('eof')
    if (t.k === 'n') {
      pos++
      return t.v
    }
    if (t.v === '(') {
      pos++
      if (++depth > 20) throw new Error('deep')
      const v = sum()
      depth--
      if (!isOp(')')) throw new Error('paren')
      pos++
      return v
    }
    if (t.v === '-') {
      pos++
      return -unary()
    }
    if (t.v === '+') {
      pos++
      return unary()
    }
    if (t.v === '√') {
      pos++
      const v = unary()
      if (v < 0) throw new Error('sqrt')
      return Math.sqrt(v)
    }
    throw new Error('tok')
  }
  const unary = (): number => {
    const base = primary()
    if (isOp('^')) {
      pos++
      const exp = unary()
      if (Math.abs(exp) > 64) throw new Error('big')
      return base ** exp
    }
    return base
  }
  const product = (): number => {
    let v = unary()
    while (isOp('*') || isOp('/')) {
      const op = (peek() as { v: string }).v
      pos++
      const r = unary()
      if (op === '/') {
        if (r === 0) throw new Error('div0')
        v /= r
      } else v *= r
    }
    return v
  }
  const sum = (): number => {
    let v = product()
    while (isOp('+') || isOp('-')) {
      const op = (peek() as { v: string }).v
      pos++
      const r = product()
      v = op === '+' ? v + r : v - r
    }
    return v
  }
  try {
    const v = sum()
    if (pos !== toks.length || !Number.isFinite(v)) return null
    return v
  } catch {
    return null
  }
}

/** Красивое число: до 6 значащих знаков после запятой, десятичная запятая для ru/uz. */
export function formatNumber(value: number, lang: MathLang): string {
  const rounded = Math.abs(value) >= 1e12 || (Math.abs(value) < 1e-6 && value !== 0) ? Number(value.toPrecision(6)) : Math.round(value * 1e6) / 1e6
  let s = Math.abs(rounded) >= 1e12 || (Math.abs(rounded) < 1e-6 && rounded !== 0) ? rounded.toExponential(4) : String(rounded)
  if (lang !== 'en') s = s.replace('.', ',')
  return s
}

/** Выражение для показа ученику: «2 + 2 × 3». */
export function prettyExpression(expr: string): string {
  return expr
    .replace(/\s+/g, '')
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ')
    .replace(/(?<=[\d)])\+/g, ' + ')
    .replace(/(?<=[\d)])-/g, ' − ')
    .replace(/\^/g, '^')
    .trim()
}
