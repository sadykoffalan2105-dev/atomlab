// Разбор химической формулы в состав (общий для скриптов инвентаризации учебников).
const SUB_DIGITS: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
export const ascii = (s: string) => s.replace(/[₀-₉]/g, (c) => SUB_DIGITS[c] ?? c).replace(/[↑↓\s]/g, '')

/** Состав формулы: скобки, гидраты (·, *), заряды отбрасываются. null — не формула. */
export function parseComposition(raw: string): Record<string, number> | null {
  let f = ascii(raw).replace(/\^?[0-9]*[+-]$/, '').replace(/[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/g, '')
  if (!/^[A-Z(\[]/.test(f)) return null
  const parts = f.split(/[·*]/)
  const total: Record<string, number> = {}
  for (let part of parts) {
    let mult = 1
    const m = part.match(/^(\d+)(.*)$/)
    if (m) {
      mult = Number(m[1])
      part = m[2]!
    }
    const stack: Record<string, number>[] = [{}]
    let i = 0
    while (i < part.length) {
      const ch = part[i]!
      if (ch === '(' || ch === '[') {
        stack.push({})
        i++
      } else if (ch === ')' || ch === ']') {
        i++
        let num = ''
        while (i < part.length && /\d/.test(part[i]!)) num += part[i++]
        const top = stack.pop()
        if (!top || stack.length === 0) return null
        const k = num ? Number(num) : 1
        for (const [el, n] of Object.entries(top)) stack[stack.length - 1]![el] = (stack[stack.length - 1]![el] ?? 0) + n * k
      } else if (/[A-Z]/.test(ch)) {
        let el = ch
        i++
        while (i < part.length && /[a-z]/.test(part[i]!)) el += part[i++]
        let num = ''
        while (i < part.length && /\d/.test(part[i]!)) num += part[i++]
        const cur = stack[stack.length - 1]!
        cur[el] = (cur[el] ?? 0) + (num ? Number(num) : 1)
      } else {
        return null
      }
    }
    if (stack.length !== 1) return null
    for (const [el, n] of Object.entries(stack[0]!)) total[el] = (total[el] ?? 0) + n * mult
  }
  return Object.keys(total).length ? total : null
}

