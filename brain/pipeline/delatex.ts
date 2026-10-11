/**
 * Формулы LaTeX → обычный текст с индексами. Сайт LaTeX не рисует, а Qwen иногда пишет
 * «\(2\text{KMnO}_4 \rightarrow …\)» вместо «2KMnO₄ → …». Работает по одному предложению
 * (StreamGate), поэтому не требует парных скобок: каждая команда заменяется сама по себе.
 */

const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '(': '₍', ')': '₎', n: 'ₙ', x: 'ₓ' }
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '−': '⁻', n: 'ⁿ' }

const CMD: Record<string, string> = {
  rightarrow: '→', to: '→', longrightarrow: '→', Rightarrow: '⇒', leftarrow: '←', longleftarrow: '←',
  rightleftharpoons: '⇄', leftrightarrow: '⇄', rightleftarrows: '⇄', longleftrightarrow: '⇄', leftrightharpoons: '⇄',
  uparrow: '↑', downarrow: '↓', cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', approx: '≈', sim: '~',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', infty: '∞', degree: '°', circ: '°', deg: '°',
  Delta: 'Δ', delta: 'δ', alpha: 'α', beta: 'β', gamma: 'γ', lambda: 'λ', mu: 'μ', nu: 'ν', pi: 'π',
  sigma: 'σ', Sigma: 'Σ', omega: 'ω', Omega: 'Ω', theta: 'θ', rho: 'ρ', varepsilon: 'ε', epsilon: 'ε', eta: 'η',
  quad: ' ', qquad: ' ', ',': ' ', ';': ' ', ':': ' ', '!': '', ' ': ' ', left: '', right: '', displaystyle: '',
}

const mapAll = (s: string, table: Record<string, string>): string | null => {
  let out = ''
  for (const ch of s) {
    const m = table[ch]
    if (m === undefined) return null
    out += m
  }
  return out
}

/** «2KMnO4 -> K2MnO4 + MnO2 + O2 ^» (mhchem) → «2KMnO₄ → K₂MnO₄ + MnO₂ + O₂↑» */
function mhchem(s: string): string {
  return s
    .replace(/<=>|<->/g, '⇄')
    .replace(/->/g, '→')
    .replace(/<-/g, '←')
    .replace(/\s\^(?=\s|$)/g, '↑')
    .replace(/\s v(?=\s|$)/g, '↓')
    .replace(/\^\{?([0-9]*[+-])\}?/g, (_, c: string) => mapAll(c, SUP) ?? c)
    .replace(/([A-Za-z)\]])(\d+)/g, (_, a: string, d: string) => a + (mapAll(d, SUB) ?? d))
}

export function delatex(text: string): string {
  if (!/[\\$]|_\{|\^\{/.test(text)) return text
  // $…$ / $$…$$ — только если внутри разметка формулы (обычный «$100» не трогаем)
  let s = text.replace(/\$\$?([^$]+?)\$\$?/g, (m, x: string) => (/[\\_^{}]/.test(x) ? x : m))
  // \ce{…} — запись mhchem (внутри бывает один уровень скобок: SO4^{2-})
  s = s.replace(/\\ce\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_, x: string) => mhchem(x))
  // ^\circ / ^{\circ} — градус
  s = s.replace(/\^\s*\{?\s*\\circ\s*\}?/g, '°')
  // индексы и степени раньше \text{…}: в \mathrm{SO_4^{2-}} они — вложенные скобки
  s = s.replace(/_\{([^{}]*)\}/g, (_, c: string) => mapAll(c.replace(/\s+/g, ''), SUB) ?? c)
  s = s.replace(/_([0-9n])/g, (_, c: string) => SUB[c]!)
  s = s.replace(/\^\{([^{}]*)\}/g, (_, c: string) => mapAll(c.replace(/\s+/g, ''), SUP) ?? `^${c}`)
  s = s.replace(/\^([0-9+\-−])/g, (_, c: string) => SUP[c]!)
  // \text{…}, \mathrm{…} и т. п. — только содержимое
  for (let i = 0; i < 3; i++) s = s.replace(/\\(?:text|mathrm|textrm|mathbf|textbf|mathit|textit|operatorname|mbox|ce)\s*\{([^{}]*)\}/g, '$1')
  // \xrightarrow{t°} → «→(t°)» (после \text: подпись уже без вложенных скобок)
  s = s.replace(/\\xrightarrow(?:\[[^\]]*\])?\{([^{}]*)\}/g, (_, c: string) => (c.trim() ? `→(${c.trim()})` : '→'))
  // \frac{a}{b} → a/b
  s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
  // команды-символы; пробел после буквы-команды — разделитель LaTeX («\Delta H» → «ΔH»)
  s = s.replace(/\\([A-Za-z]+)( (?=\p{L}))?|\\([,;:! ])/gu, (m, name: string | undefined, sp: string | undefined, punct: string | undefined) => {
    const key = name ?? punct!
    if (!(key in CMD)) return m
    const v = CMD[key]!
    return v + (sp && !/^\p{L}$/u.test(v) ? sp : '')
  })
  // границы формул: \( \) \[ \]
  s = s.replace(/\\[()[\]]/g, '')
  // оставшиеся фигурные скобки вокруг простого содержимого
  s = s.replace(/\{([^{}]*)\}/g, '$1')
  // неизвестные команды без аргументов — просто убрать обратную косую
  s = s.replace(/\\([A-Za-z]+)/g, '$1')
  // «KMnO₄ ↑» после замен: пробел перед стрелкой газа/осадка лишний
  s = s.replace(/\s+([↑↓])/g, '$1').replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1')
  return s
}
