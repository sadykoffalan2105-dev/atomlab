/**
 * Маленький модуль падежей для русских названий элементов и веществ каталога (без зависимостей):
 * «свойства натрия», «способы получения кислорода», «получение серной кислоты», «молярная масса оксида меди(II)».
 *
 * Склоняется только «голова» названия: ведущие прилагательные (серная, углекислый, негашёная) и первое
 * существительное после них (кислота, газ, оксид). Остальное уже стоит в нужной форме («оксид кальция» →
 * «оксида кальция», «хлорид натрия» → «хлорида натрия») или неизменяемо (формулы, «(II)», «(t°)»).
 * Падежи: родительный (gen) и предложный (prep: «о натрии», «в кислороде»).
 */

export type RuCase = 'gen' | 'prep'

/** Существительные женского рода на -ь (иначе -ь — мужской род: никель → никеля). */
const FEM_SOFT = new Set(['медь', 'ртуть', 'соль', 'сталь', 'известь', 'щёлочь', 'щелочь', 'накипь', 'нефть', 'смесь', 'взвесь', 'окись', 'закись', 'ржавь', 'гарь', 'тушь'])

/** Слова с беглой гласной и прочие исключения: именительный → [родительный, предложный]. */
const IRREGULAR: Record<string, [string, string]> = {
  свинец: ['свинца', 'свинце'],
  уголь: ['угля', 'угле'],
  лёд: ['льда', 'льде'],
  лед: ['льда', 'льде'],
  песок: ['песка', 'песке'],
  купорос: ['купороса', 'купоросе'],
  кофе: ['кофе', 'кофе'],
  какао: ['какао', 'какао'],
  метро: ['метро', 'метро'],
}

const ADJ_RE = /(ый|ой|ий|ая|яя|ое|ее|ые|ие)$/u
const HUSH = /[гкхжшчщ]$/u

function keepCase(src: string, out: string): string {
  if (src === src.toUpperCase() && src.length > 1) return out.toUpperCase()
  return /^\p{Lu}/u.test(src) ? out.charAt(0).toUpperCase() + out.slice(1) : out
}

type Gender = 'm' | 'f' | 'n' | 'pl'

function nounGender(w: string): Gender {
  const s = w.toLowerCase()
  if (IRREGULAR[s]) return 'm'
  if (/[ая]$/u.test(s)) return 'f'
  if (/ь$/u.test(s)) return FEM_SOFT.has(s) || /(ость|есть|чь|шь|щь|жь)$/u.test(s) ? 'f' : 'm'
  if (/[ое]$/u.test(s)) return 'n'
  if (/[ыи]$/u.test(s)) return 'pl'
  return 'm'
}

/** Падеж существительного в именительном падеже единственного числа. */
export function declineNoun(word: string, c: RuCase): string {
  const s = word.toLowerCase()
  const irr = IRREGULAR[s]
  if (irr) return keepCase(word, c === 'gen' ? irr[0] : irr[1])
  const g = nounGender(s)
  let out = s
  if (g === 'pl') out = s // множественное (квасцы) — без изменений: в каталоге редкость
  else if (/ия$/u.test(s)) out = s.slice(0, -1) + 'и' // магнезия → магнезии (оба падежа)
  else if (/ий$/u.test(s)) out = s.slice(0, -1) + (c === 'gen' ? 'я' : 'и') // натрий → натрия / натрии
  else if (/ие$/u.test(s)) out = s.slice(0, -1) + (c === 'gen' ? 'я' : 'и') // соединение → соединения / соединении
  else if (/а$/u.test(s)) out = s.slice(0, -1) + (c === 'gen' ? (HUSH.test(s.slice(0, -1)) ? 'и' : 'ы') : 'е') // кислота → кислоты / кислоте
  else if (/я$/u.test(s)) out = s.slice(0, -1) + (c === 'gen' ? 'и' : 'е')
  else if (/ь$/u.test(s)) out = s.slice(0, -1) + (g === 'f' ? 'и' : c === 'gen' ? 'я' : 'е') // медь → меди; никель → никеля / никеле
  else if (/й$/u.test(s)) out = s.slice(0, -1) + (c === 'gen' ? 'я' : 'е')
  else if (/[ое]$/u.test(s)) out = s.slice(0, -1) + (c === 'gen' ? 'а' : 'е') // железо → железа / железе
  else if (/[бвгдзклмнпрстфхцжшчщ]$/u.test(s)) out = s + (c === 'gen' ? 'а' : 'е') // кислород → кислорода / кислороде
  return keepCase(word, out)
}

/** Падеж прилагательного, согласованного с существительным рода g. */
export function declineAdjective(word: string, g: Gender, c: RuCase): string {
  const s = word.toLowerCase()
  const gen = c === 'gen'
  let out = s
  const stem = s.slice(0, -2)
  if (/(ов|ев|ин|ын)а$/u.test(s)) out = s.slice(0, -1) + 'ой' // бертолетова соль → бертолетовой соли
  else if (g === 'f') {
    if (/ая$/u.test(s)) out = stem + (/[жшчщ]$/u.test(stem) ? 'ей' : 'ой')
    else if (/яя$/u.test(s)) out = stem + 'ей'
  } else if (g === 'pl') {
    if (/ые$/u.test(s)) out = stem + 'ых'
    else if (/ие$/u.test(s)) out = stem + 'их'
  } else if (/(ый|ой|ое)$/u.test(s)) out = stem + (gen ? 'ого' : 'ом')
  else if (/ий$/u.test(s)) out = stem + (/[гкх]$/u.test(stem) ? (gen ? 'ого' : 'ом') : gen ? 'его' : 'ем')
  else if (/ее$/u.test(s)) out = stem + (gen ? 'его' : 'ем')
  return keepCase(word, out)
}

/**
 * Название вещества/элемента в нужном падеже: «Кислород» → «кислорода» (lower = true), «Серная кислота» →
 * «серной кислоты», «Оксид меди(II)» → «оксида меди(II)», «Углекислый газ» → «углекислого газа».
 * Формулы и скобки не трогаются; незнакомые формы остаются как есть.
 */
export function declineName(name: string, c: RuCase, lower = false): string {
  const src = lower ? lowerName(name) : name
  const words = src.split(/(\s+)/)
  const idx: number[] = []
  for (let i = 0; i < words.length; i++) if (words[i]!.trim()) idx.push(i)
  if (!idx.length) return src
  // ведущие прилагательные (только кириллица) — до первого существительного
  let head = -1
  const adjs: number[] = []
  for (let k = 0; k < idx.length; k++) {
    const w = words[idx[k]!]!
    if (!/^[\p{Script=Cyrillic}-]+$/u.test(w)) break
    const isLast = k === idx.length - 1
    if (!isLast && (ADJ_RE.test(w.toLowerCase()) || /(ов|ев|ин|ын)а$/u.test(w.toLowerCase())) && w.length > 3) {
      adjs.push(idx[k]!)
      continue
    }
    head = idx[k]!
    break
  }
  if (head < 0) return src
  const noun = words[head]!
  const g = nounGender(noun)
  words[head] = declineNoun(noun, c)
  for (const a of adjs) words[a] = declineAdjective(words[a]!, g, c)
  return words.join('')
}

/** Строчная первая буква, кроме аббревиатур и формул («ДНК», «H₂O»). */
export function lowerName(name: string): string {
  const first = name.split(/\s+/)[0] ?? ''
  if (first.length > 1 && first === first.toUpperCase()) return name
  if (/^[A-Z]/.test(first)) return name
  return name.charAt(0).toLowerCase() + name.slice(1)
}

export const genitive = (name: string, lower = true) => declineName(name, 'gen', lower)
export const prepositional = (name: string, lower = true) => declineName(name, 'prep', lower)
