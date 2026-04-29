/**
 * Раскрытие сокращённой записи (ядро благородного газа) в полную орбитальную
 * в соответствии с данными periodicTableRaw (аномалии — как в исходной строке).
 */

const NOBLE_BASE: Record<string, string> = {
  he: '1s2',
  ne: '1s2 2s2 2p6',
  ar: '1s2 2s2 2p6 3s2 3p6',
  kr: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6',
  xe: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 5s2 5p6',
  rn: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 5s2 5p6 4f14 5d10 6s2 6p6',
}

function noteHintRu(english: string): string {
  const t = english.trim().toLowerCase()
  if (t.includes('predicted')) return ' (предсказуемо, по оценкам)'
  if (t.includes('expected to be')) return ' (оценка)'
  return ` (${english})`
}

/**
 * @returns полная строка конфигурации; в конце может быть пометка на русском/из исходника
 */
export function toFullElectronConfiguration(abbrev: string | undefined | null): string {
  if (abbrev == null) return '—'
  const trimmed = abbrev.replace(/\s+/g, ' ').trim()
  if (trimmed === '' || trimmed === '—') return '—'

  const tailNotes: string[] = []
  let s = trimmed

  const paren = /\s*\(([^)]+)\)\s*$/
  for (;;) {
    const m = s.match(paren)
    if (!m) break
    tailNotes.unshift(m[1]!.trim())
    s = s.slice(0, m.index).trim()
  }
  s = s.replace(/\s+/g, ' ').trim()

  const mNoble = /^\[([A-Za-z][A-Za-z]*)\]/.exec(s)
  if (mNoble) {
    const key = mNoble[1]!.toLowerCase()
    const core = NOBLE_BASE[key]
    if (!core) {
      return trimmed
    }
    const rest = s.slice(mNoble[0].length).replace(/^\s*/, '').replace(/\s+/g, ' ').trim()
    if (rest) {
      return `${core} ${rest}` + (tailNotes.length ? tailNotes.map((n) => noteHintRu(n)).join('') : '')
    }
    return core + (tailNotes.length ? tailNotes.map((n) => noteHintRu(n)).join('') : '')
  }

  return s + (tailNotes.length ? tailNotes.map((n) => noteHintRu(n)).join('') : '')
}
