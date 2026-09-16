/**
 * r10: точные ответы по «указателю учебника» (фрагменты базы знаний type 'index' — scripts/kb/lib/bookIndex.mts,
 * собраны из проверенной инвентаризации учебников «Химия 7–11»):
 *
 *   • formula   «Какая формула серной кислоты?»        → «Серная кислота — формула H₂SO₄.» + где в учебнике;
 *   • name      «Как называется вещество CaC2?»          → «CaC₂ — это карбид кальция.»;
 *   • products  «Что получится при реакции CaO с водой?» → уравнение из учебника + продукты + тип + § и страница;
 *   • section   «Какие реакции есть в § 2?»              → список уравнений этого § (класс — из вопроса или урока);
 *   • location  «Где в учебнике говорится о малахите?»  → §, название и страницы (для темы без вещества — по
 *                найденным страницам учебника).
 *
 * Правило то же, что у всего локального учителя: ничего не выдумываем. Формулы и уравнения — только из указателя
 * (не OCR-текст), каждое вещество/реакция сопоставляется с вопросом строго (все слова названия или формула), иначе
 * путь не срабатывает и отвечает обычный составитель ответа. Чистый модуль.
 */
import { foldText, type StemLang } from './textStems'

export interface BookHitLike {
  title: string
  text: string
  type?: string
  citation?: string
}

export type BookIntentKind = 'formula' | 'name' | 'products' | 'section' | 'location'
export type BookIntent = { kind: BookIntentKind; grade?: number; kp?: string; wants?: 'reactions' | 'substances' | 'labs' }

export type BookAnswer = { sentences: string[]; usedCitations: string[]; usedTitles: string[] }

const ELEMENTS = new Set(
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pt Au Hg Tl Pb Bi Po Rn Fr Ra U Pu'.split(' '),
)

/* ------------------------------------------------------------------ intent */

const KP_Q_RE =
  /§\s*(\d{1,2}(?:\.\d{1,2})?)|параграф\S*\s*(?:№\s*)?(\d{1,2}(?:\.\d{1,2})?)|тем[аеуы]\s*(?:№\s*)?(\d{1,2}\.\d{1,2})|(\d{1,2}(?:\.\d{1,2})?)\s*-?\s*(?:[ймо]\s+)?(?:тем[аеы]|параграф\S*)/iu
const GRADE_Q_RE = /(?<!\d)(7|8|9|10|11)\s*-?\s*(?:[ао]?го|[ыо]?м|[ыо]?й)?\s*класс|(?:хими\S*|kimyo|учебник\S*)\s*(?:для\s*)?(7|8|9|10|11)(?!\d)|класс\S*\s*(7|8|9|10|11)(?!\d)/iu
const LIST_WORD_RE = /(какие|какая|какой|каких|перечисл|назови|список|сколько|что\s+за|есть\s+ли|покажи)/iu
const SECTION_WHAT_RE = /(реакци|уравнени|вещест|опыт|лаборатор|практическ)/iu

const PRODUCTS_RE =
  /((что|какие\s+вещества|какое\s+вещество|какой\s+газ|какая\s+соль|какие\s+продукты)\s+(получ\S*|образу\S*|образо\S*|выдел\S*|будет|станет|выйдет)|продукт\S*\s+(реакци|взаимодейств)|допиш\S*|законч\S*\s+(уравнени|реакци)|(=|→|->)\s*\?|напиш\S*\s+(уравнени\S*\s+)?реакци\S*\s+\S+\s+(с|со)\s|как\s+реагиру\S*\s+\S+\s+(с|со)\s|что\s+будет,?\s+если\s+(смешать|добавить|прилить|опустить|нагреть|сжечь))/iu
const LOCATION_RE =
  /((где|в\s+как\S+|на\s+как\S+)\s+(\S+\s+){0,4}(учебник\S*|параграф\S*|§|страниц\S*|тем[еауы]|глав\S*|класс\S*|раздел\S*)|где\s+(в\s+учебнике\s+|в\s+книге\s+)?(говорится|рассказывается|написано|сказано|описан\S*|изуча\S*|проход\S*|упомина\S*|можно\s+(найти|прочитать|почитать)|почитать|прочитать|найти)|в\s+каком\s+параграфе|на\s+какой\s+странице)/iu
const FORMULA_RE = /формул\S*/iu
const NOT_SUBSTANCE_FORMULA_RE =
  /(по\s+как\S+\s+формул|формул\S*\s+(для|расч[её]т|вычислен|нахожд|массов|объ[её]м|количеств|плотн|молярн|скорост|концентрац|закон|связи|вещества\s+по)|структурн\S*\s+формул|электронн\S*\s+формул|общ\S*\s+формул|графическ\S*\s+формул|формул\S*\s+строени)/iu
const NAME_RE = /(как\s+называ\S*|назови\S*\s+вещество|название\s+вещества|что\s+(это\s+)?за\s+вещество|что\s+такое|что\s+означает\s+формула|чья\s+формула|какое\s+вещество\s+(имеет|обознача|записыва))/iu

const SUB_DIGITS: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ₙ': 'n' }
/** «H₂SO₄» / «2H2SO4» / «Ca(OH)₂↓» → «H2SO4» (без коэффициента, стрелок и зарядов). */
export function normFormula(s: string): string {
  return s
    .replace(/[₀-₉ₙ]/g, (c) => SUB_DIGITS[c] ?? c)
    .replace(/[↑↓\s]/g, '')
    .replace(/^\d+(?=[A-Z(])/, '')
    .replace(/[·*•]/g, '·')
}

/**
 * Ключ состава для сравнения формул одного вещества в разной записи: «CH₂=CH₂» = «C2H4», «CH₃-CH₂-OH» = «C2H5OH»,
 * «CuSO₄·5H₂O» = «CuSO4*5H2O». Нечитаемая формула сравнивается как есть.
 */
export function fkey(raw: string): string {
  const f = normFormula(raw).replace(/[–=≡-]/g, '').replace(/[⁰-⁹⁺⁻]+$/g, '')
  const total = new Map<string, number>()
  for (const part0 of f.split('·')) {
    const m = /^(\d+)(.*)$/.exec(part0)
    const mult = m ? Number(m[1]) : 1
    const part = m ? m[2]! : part0
    const stack: Map<string, number>[] = [new Map()]
    let i = 0
    while (i < part.length) {
      const ch = part[i]!
      if (ch === '(' || ch === '[') {
        stack.push(new Map())
        i += 1
      } else if (ch === ')' || ch === ']') {
        i += 1
        let num = ''
        while (i < part.length && /\d/.test(part[i]!)) num += part[i++]
        const top = stack.pop()
        if (!top || !stack.length) return f
        top.forEach((n, el) => stack[stack.length - 1]!.set(el, (stack[stack.length - 1]!.get(el) ?? 0) + n * (num ? Number(num) : 1)))
      } else if (/[A-Z]/.test(ch)) {
        let el = ch
        i += 1
        while (i < part.length && /[a-z]/.test(part[i]!)) el += part[i++]
        let num = ''
        while (i < part.length && /\d/.test(part[i]!)) num += part[i++]
        stack[stack.length - 1]!.set(el, (stack[stack.length - 1]!.get(el) ?? 0) + (num ? Number(num) : 1))
      } else return f
    }
    if (stack.length !== 1) return f
    stack[0]!.forEach((n, el) => total.set(el, (total.get(el) ?? 0) + n * mult))
  }
  return [...total.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([el, n]) => `${el}${n}`).join('') || f
}

function validFormula(f: string): boolean {
  const body = f.replace(/[()[\]·\d n]/g, '')
  if (!body || !/^[A-Z]/.test(body)) return false
  const syms = body.match(/[A-Z][a-z]?/g) ?? []
  return syms.join('') === body && syms.every((s) => ELEMENTS.has(s))
}

/** Формулы в тексте вопроса (латиница; «Zn», «CaO», «H2SO4», «Ca(OH)2»). */
export function formulasInText(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/(?<![A-Za-zА-Яа-яЁё])\d*(?:\(?[A-Z][a-z]?[\d₀-₉]*\)?[\d₀-₉]*)+(?:[·*•]\d*(?:[A-Z][a-z]?[\d₀-₉]*)+)?(?![A-Za-zА-Яа-яЁё])/g)) {
    const f = normFormula(m[0])
    if (f.length >= 1 && validFormula(f) && (/\d|[A-Z].*[A-Z]/.test(f) || ELEMENTS.has(f))) out.push(f)
  }
  return [...new Set(out)]
}

const WHAT_IS_SUBSTANCE_RE = /^(а\s+)?(что\s+(такое|это\s+за)|что\s+за\s+вещество|расскажи\S*\s+(про|о|об))\s+\S/u

/** Нужен ли поиск по указателю учебника: вопрос указателя, о свойствах вещества или «что такое X» (запасной ответ). */
export function wantsBookIndex(query: string, lang: StemLang): BookIntent | null {
  return (
    detectBookIntent(query, lang) ??
    (lang === 'ru' &&
    (WHAT_IS_SUBSTANCE_RE.test(foldText(query)) || detectPropertyQuestion(query, lang) || OBTAIN_Q_RE.test(foldText(query).replace(/[?!.]+$/u, '')) || EXAMPLE_TYPE_RE.test(foldText(query)) || TYPE_ONLY_RE.test(foldText(query).replace(/[?!.]+$/u, "")))
      ? { kind: 'formula' }
      : null)
  )
}

/* ------------------------------------------------------------- properties */

export type PropertyQuestion = { type: 'physical' | 'chemical' | 'any'; subject: string; words: string[] }

const PROPERTY_Q_RE =
  /(как(ими|ие|ое|ого|ой|ая|ов|овы)\s+(\S+\s+){0,2}(свойств\S*|цвет\S*|запах\S*|вкус\S*)|какого\s+цвета|(физическ|химическ)\S*\s+свойств|свойств\S*\s+(у|для)\s)/iu
const PROPERTY_FILLER_RE =
  /^(как\S*|каков\S*|обладает|обладают|свойств\S*|физическ\S*|химическ\S*|характерн\S*|для|у|цвет\S*|запах\S*|вкус\S*|име(ет|ют)|веществ\S*|что|это|его|ее|её|их|так\S*|есть|по|учебник\S*|с|со|в|во|и|а|же|ли|бывают|проявля\S*|перечисли\S*|назови\S*|расскажи\S*|опиши\S*)$/u

/** «Какими физическими свойствами обладает кислород?», «Какого цвета хлор?», «Какие химические свойства у метана?» */
export function detectPropertyQuestion(query: string, lang: StemLang): PropertyQuestion | null {
  if (lang !== 'ru') return null
  const q = foldText(query)
  if (!PROPERTY_Q_RE.test(q) || /^(а\s+)?(почему|зачем|как\s+(влия|измен|завис))/u.test(q)) return null
  const words = (q.match(/[а-я]{2,}/g) ?? []).filter((w) => !PROPERTY_FILLER_RE.test(w))
  if (!words.length || words.length > 4) return null
  const type = /химическ/.test(q) ? 'chemical' : /физическ|цвет|запах|вкус/.test(q) ? 'physical' : 'any'
  return { type, subject: words.join(' '), words }
}

const OBTAIN_Q_RE = /^(а\s+)?(как|каким\s+образом|какими\s+способами)\s+(можно\s+)?(получа\S*|получить|получ\S+)\s+(.+?)\??$/u

/** «Приведи пример реакции присоединения» → тип реакции как в строке «Тип: …» указателя. */
const EXAMPLE_TYPE_RE =
  /пример\S*\s+(?:(?:реакци\S*|уравнени\S*)\s+)?(соединени|разложени|замещени|обмен|нейтрализаци|горени|присоединени|полимеризаци|гидролиз|окислительно-восстановительн)/u
const TYPE_ONLY_RE =
  /^(?:реакци\S*\s+)?(соединени|разложени|замещени|обмен|нейтрализаци|горени|присоединени|полимеризаци|гидролиз|окислительно-восстановительн)\S*(?:\s+реакци\S*)?$/u
const EXAMPLE_TYPE_TEXT: Record<string, RegExp> = {
  соединени: /^реакция соединения$/u,
  разложени: /^реакция разложения$/u,
  замещени: /^реакция замещения$/u,
  обмен: /^реакция (обмена|нейтрализации \(обмена\))$/u,
  нейтрализаци: /^реакция нейтрализации/u,
  горени: /^реакция горения$/u,
  присоединени: /^реакция присоединения$/u,
  полимеризаци: /^реакция полимеризации$/u,
  гидролиз: /^гидролиз$/u,
  'окислительно-восстановительн': /^окислительно-восстановительная реакция$/u,
}

/** «Приведи пример реакции присоединения», когда в найденном тексте нет уравнения этого типа: пример из указателя. */
export function exampleFromBookIndex(query: string, hits: readonly BookHitLike[], lang: StemLang, wantExample = false): BookAnswer | null {
  if (lang !== 'ru') return null
  // после разбора реплики «Приведи пример реакции присоединения» приходит как «реакции присоединения» + wantExample
  const m = EXAMPLE_TYPE_RE.exec(foldText(query)) ?? (wantExample ? TYPE_ONLY_RE.exec(foldText(query).replace(/[?!.]+$/u, '')) : null)
  if (!m) return null
  const typeRe = EXAMPLE_TYPE_TEXT[m[1]!]
  if (!typeRe) return null
  const reactions = hits
    .filter((h) => h.type === 'index')
    .map(parseReaction)
    .filter((r): r is ReactionEntry => !!r && !!r.type && typeRe.test(r.type) && !/[⁺⁻]|ē/u.test(r.equation) && r.reagents.length <= 3)
  const best = reactions.sort((a, b) => a.equation.length - b.equation.length)[0]
  if (!best) return null
  const where = best.where ? best.where.replace(/^«Химия (\d+)» \(Kimyo \d+\): /, '«Химия $1», ').split('; ')[0]! : `«Химия ${best.grade}»`
  return {
    sentences: [`Например, из учебника ${where}: ${best.equation} — ${best.type}.`, 'Сможешь привести ещё один пример сам?'],
    usedCitations: best.hit.citation ? [best.hit.citation] : [],
    usedTitles: [best.hit.title],
  }
}

/**
 * «Как получают уксусную кислоту?», когда в тексте учебника нет фразы о получении: реакции указателя, где это вещество
 * среди продуктов (честно: «образуется в реакциях …», без «в промышленности/в лаборатории», если вопрос не называет).
 */
export function obtainFromBookIndex(query: string, hits: readonly BookHitLike[], lang: StemLang, channel: 'chat' | 'voice' = 'chat'): BookAnswer | null {
  if (lang !== 'ru') return null
  const m = OBTAIN_Q_RE.exec(foldText(query).replace(/[?!.]+$/u, ''))
  if (!m) return null
  const subject = m[5]!.replace(/\s+(в|на)\s+(лаборатор|промышлен|природ)\S*.*$/u, '').trim()
  if (/(лаборатор|промышлен)/u.test(m[5]!)) return null
  const words = ruWords(subject)
  if (!words.length || words.length > 3) return null
  const found: { r: ReactionEntry; name: string }[] = []
  const seen = new Set<string>()
  for (const r of hits.filter((h) => h.type === 'index').map(parseReaction).filter((x): x is ReactionEntry => !!x)) {
    const product = r.products.find((p) => p.names.some((n) => { const mm = matchName(n, subject, { heads: false }); return !!mm && mm.words === words.length }))
    if (!product || r.reagents.some((s) => fkey(s.formula) === fkey(product.formula))) continue
    const key = eqKey(r.equation)
    if (seen.has(key)) continue
    seen.add(key)
    found.push({ r, name: product.names[0]! })
    if (found.length >= (channel === 'voice' ? 1 : 2)) break
  }
  if (!found.length) return null
  const first = found[0]!
  const where = (r: ReactionEntry) => (r.where ? r.where.replace(/^«Химия (\d+)» \(Kimyo \d+\): /, '«Химия $1», ').split('; ')[0]! : `«Химия ${r.grade}»`)
  const sentences = [`В учебнике ${where(first.r)} вещество «${first.name}» образуется в реакции: ${first.r.equation}.`]
  if (found[1]) sentences.push(`Ещё одна реакция из учебника ${where(found[1].r)}: ${found[1].r.equation}.`)
  sentences.push(CHECK.products)
  return { sentences: sentences.map((s) => capital(s)), usedCitations: [...new Set(found.map((f) => f.r.hit.citation ?? '').filter(Boolean))], usedTitles: found.map((f) => f.r.hit.title) }
}

/** Реакции указателя, где вещество вопроса — реагент: химические свойства «по учебнику». */
export function reactionsWithReagent(subject: string, hits: readonly BookHitLike[], max = 3): { equation: string; type: string | null; grade: number; name: string; citation?: string; title: string }[] {
  const out: { equation: string; type: string | null; grade: number; name: string; citation?: string; title: string }[] = []
  const seen = new Set<string>()
  for (const r of hits.filter((h) => h.type === 'index').map(parseReaction).filter((x): x is ReactionEntry => !!x)) {
    const reagent = r.reagents.find((s) => s.names.some((n) => { const m = matchName(n, subject, { heads: false }); return !!m && m.words === ruWords(subject).length }))
    if (!reagent) continue
    const key = eqKey(r.equation)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ equation: r.equation, type: r.type, grade: r.grade, name: reagent.names[0] ?? reagent.formula, citation: r.hit.citation, title: r.hit.title })
    if (out.length >= max) break
  }
  return out
}

export function detectBookIntent(query: string, lang: StemLang): BookIntent | null {
  if (lang !== 'ru') return null
  const q = foldText(query)
  const kpM = KP_Q_RE.exec(query)
  const kp = kpM ? kpM.slice(1).find(Boolean) : undefined
  const gM = GRADE_Q_RE.exec(q)
  const grade = gM ? Number(gM.slice(1).find(Boolean)) : undefined
  if (kp && LIST_WORD_RE.test(q) && SECTION_WHAT_RE.test(q)) {
    const wants = /вещест/.test(q) && !/реакци|уравнени/.test(q) ? 'substances' : /опыт|лаборатор|практическ/.test(q) && !/реакци|уравнени/.test(q) ? 'labs' : 'reactions'
    return { kind: 'section', kp, grade, wants }
  }
  if (PRODUCTS_RE.test(q) || /(=|→|->)\s*\?|\+\s*\S+\s*(=|→|->)\s*$/.test(query.trim())) return { kind: 'products', grade }
  if (LOCATION_RE.test(q)) return { kind: 'location', grade }
  if (FORMULA_RE.test(q) && !NOT_SUBSTANCE_FORMULA_RE.test(q)) {
    // «Что означает формула H2SO4» — это вопрос о названии
    if (formulasInText(query).length && NAME_RE.test(q)) return { kind: 'name', grade }
    return { kind: 'formula', grade }
  }
  if (NAME_RE.test(q) && formulasInText(query).length === 1 && q.replace(/[^а-я]+/g, ' ').trim().split(/\s+/).length <= 5) return { kind: 'name', grade }
  return null
}

/* ------------------------------------------------------------ word matching */

const RU_ENDINGS = new Set([
  '', 'а', 'я', 'ы', 'и', 'у', 'ю', 'е', 'о', 'ь', 'й', 'ом', 'ем', 'ой', 'ей', 'ий', 'ый', 'ая', 'яя', 'ое', 'ее', 'ую', 'юю',
  'ые', 'ие', 'ых', 'их', 'ым', 'им', 'ыми', 'ими', 'ами', 'ями', 'ах', 'ях', 'ам', 'ям', 'ов', 'ев', 'ого', 'его', 'ому',
  'ему', 'ия', 'ию', 'ии', 'ие', 'ье', 'ья', 'ью', 'ьи', 'иями', 'иях', 'ием',
])

/** Одно и то же слово в другой форме («кальция» ~ «кальций», «серной» ~ «серная»; «хлорид» ≠ «хлорат», «вода» ≠ «водород»). */
export function sameWord(a: string, b: string): boolean {
  const x = foldText(a)
  const y = foldText(b)
  if (x === y) return true
  let p = 0
  while (p < x.length && p < y.length && x[p] === y[p]) p += 1
  if (p < 3) return false
  // «соль/соли», «медь/меди»: у коротких основ хватает 3 общих букв, у длинных — от 4
  if (p === 3 && Math.max(x.length, y.length) > 5) return false
  return RU_ENDINGS.has(x.slice(p)) && RU_ENDINGS.has(y.slice(p))
}

const ROMAN_RE = /\(\s*(I{1,3}|IV|V|VI{1,3}|VIII|IX|X)\s*\)|\(\s*([1-8])\s*\)/g
const ARABIC_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
function romans(text: string): string[] {
  return [...text.matchAll(ROMAN_RE)].map((m) => m[1] ?? ARABIC_ROMAN[Number(m[2])]!)
}

const ruWords = (text: string) => foldText(text).replace(/\([^)]*\)/g, ' ').match(/[а-я]{2,}/g) ?? []

/** Слова вопроса, которые должны войти в название найденного вещества (класс вещества и его «прилагательное»). */
const HEAD_RE =
  /^(оксид|гидроксид|пероксид|хлорид|бромид|иодид|йодид|фторид|сульфид|сульфат|сульфит|гидросульфат|нитрат|нитрит|нитрид|карбонат|гидрокарбонат|фосфат|гидрофосфат|дигидрофосфат|силикат|карбид|гидрид|ацетат|перманганат|манганат|хромат|дихромат|хлорат|перхлорат|кислот|соль|сол|ион|гидроксокарбонат)/u

type NameMatch = { words: number; ambiguousRoman: boolean; at: number[] }

/** Все слова названия есть в вопросе; римские цифры совпадают; класс вещества из вопроса покрыт названием. */
function matchName(name: string, query: string, opts: { heads?: boolean } = {}): NameMatch | null {
  const nameWords = ruWords(name)
  if (!nameWords.length) return null
  const qWords = ruWords(query)
  const at: number[] = []
  for (const w of nameWords) {
    const i = qWords.findIndex((q, k) => !at.includes(k) && sameWord(q, w))
    if (i < 0) return null
    at.push(i)
  }
  if (opts.heads === false) {
    // в реакции: римская цифра вопроса относится к веществу с тем же названием, не ко всем реагентам
    const nr = romans(name)
    if (nr.length && !nr.every((r) => romans(query).includes(r))) return null
    return { words: nameWords.length, ambiguousRoman: false, at }
  }
  {
    const qHeads = qWords.filter((q) => HEAD_RE.test(q))
    for (const h of qHeads) if (!nameWords.some((w) => sameWord(w, h))) return null
    // прилагательное перед классом («азотной кислоты», «серной кислоты») тоже должно быть в названии
    const qi = qWords.findIndex((q) => /^кислот/.test(q))
    if (qi > 0 && /(ой|ая|ую)$/.test(qWords[qi - 1]!) && !nameWords.some((w) => sameWord(w, qWords[qi - 1]!))) return null
  }
  const nr = romans(name)
  const qr = romans(query)
  if (nr.length && qr.length && !nr.every((r) => qr.includes(r))) return null
  if (!nr.length && qr.length) return null
  return { words: nameWords.length, ambiguousRoman: nr.length > 0 && qr.length === 0, at }
}

/* --------------------------------------------------------------- parsing */

type SubstanceEntry = { hit: BookHitLike; grade: number; name: string; synonyms: string[]; formula: string | null; lines: string[] }
type ReactionEntry = {
  hit: BookHitLike
  grade: number
  equation: string
  reagents: { names: string[]; formula: string }[]
  products: { names: string[]; formula: string }[]
  type: string | null
  where: string | null
}
type SectionEntry = { hit: BookHitLike; grade: number; kp: string; title: string; lines: string[] }

function parseSubstance(hit: BookHitLike): SubstanceEntry | null {
  const t = /^(.*?)(?: \((\S+)\))? — где в учебнике Kimyo (\d+)$/.exec(hit.title)
  if (!t) return null
  const lines = hit.text.split('\n')
  const name = t[1]!
  const head = lines[0] ?? ''
  const namesPart = head.split(/ — |; химическая/)[0] ?? ''
  const rest = namesPart.startsWith(name) ? namesPart.slice(name.length).trim() : ''
  const synonyms = /^\((.*)\)$/.exec(rest)?.[1]?.split(/,\s*/).filter(Boolean) ?? []
  return { hit, grade: Number(t[3]), name, synonyms, formula: t[2] ?? null, lines }
}

function parseSpecies(list: string): { names: string[]; formula: string }[] {
  return list
    .replace(/\.$/, '')
    .split(/;\s*/)
    .map((part) => {
      const m = /^(.*?)\s*\((\S+)\)$/.exec(part.trim())
      if (m) return { names: m[1]!.split(/,\s*/).filter(Boolean), formula: m[2]! }
      return { names: [], formula: part.trim() }
    })
}

function parseReaction(hit: BookHitLike): ReactionEntry | null {
  const lines = hit.text.split('\n')
  const eq = /^Реакция из учебника «Химия (\d+)»: (.*)\.$/.exec(lines[0] ?? '')
  if (!eq) return null
  const get = (prefix: string) => lines.find((l) => l.startsWith(prefix))?.slice(prefix.length) ?? null
  const reagents = get('Реагенты: ')
  const products = get('Продукты: ')
  if (!reagents || !products) return null
  return {
    hit,
    grade: Number(eq[1]),
    equation: eq[2]!,
    reagents: parseSpecies(reagents),
    products: parseSpecies(products),
    type: get('Тип: ')?.replace(/\.$/, '') ?? null,
    where: get('Где в учебнике ')?.replace(/\.$/, '') ?? null,
  }
}

function parseSection(hit: BookHitLike): SectionEntry | null {
  const t = /^(§ (\S+)|Практические работы) «(.*)» — реакции и вещества \(Kimyo (\d+)\)$/.exec(hit.title)
  if (!t) return null
  return { hit, grade: Number(t[4]), kp: t[2] ?? 'lab', title: t[3]!, lines: hit.text.split('\n') }
}

/* ---------------------------------------------------------------- answers */

const CHECK = {
  formula: 'Сможешь сам записать эту формулу и назвать вещество?',
  products: 'Сможешь сам записать это уравнение и назвать продукты?',
  section: 'Какую из этих реакций разберём подробнее?',
  location: 'Откроешь этот параграф — разберём его вместе?',
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function pickSubstances(query: string, entries: SubstanceEntry[]): SubstanceEntry[] {
  const qFormulas = formulasInText(query)
  const scored: { e: SubstanceEntry; score: number; ambiguous: boolean }[] = []
  for (const e of entries) {
    if (e.formula && qFormulas.map(fkey).includes(fkey(e.formula))) {
      scored.push({ e, score: 100, ambiguous: false })
      continue
    }
    let best: NameMatch | null = null
    for (const n of [e.name, ...e.synonyms]) {
      const m = matchName(n, query)
      if (m && (!best || m.words > best.words)) best = m
    }
    if (best) scored.push({ e, score: best.words, ambiguous: best.ambiguousRoman })
  }
  if (!scored.length) return []
  const top = Math.max(...scored.map((s) => s.score))
  return scored.filter((s) => s.score === top).map((s) => s.e)
}

/** «Какая формула X» / «Как называется F» / «Где в учебнике X». */
function answerSubstance(intent: BookIntent, query: string, hits: readonly BookHitLike[], channel: 'chat' | 'voice'): BookAnswer | null {
  const entries = hits.filter((h) => h.type === 'index').map(parseSubstance).filter((e): e is SubstanceEntry => !!e)
  let matched = pickSubstances(query, entries)
  if (intent.kind === 'name') matched = matched.filter((e) => e.formula && formulasInText(query).map(fkey).includes(fkey(e.formula)))
  if (!matched.length) return null
  // разные вещества с одинаковым совпадением («оксид железа» без степени окисления): называем до 3 вариантов
  // запись без формулы при такой же записи с формулой — то же вещество
  const named = new Set(matched.filter((e) => e.formula).map((e) => e.name.toLowerCase()))
  matched = matched.filter((e) => e.formula || !named.has(e.name.toLowerCase()))
  const distinct = [...new Map(matched.map((e) => [(e.formula ?? e.name).toLowerCase(), e])).values()]
  const preferGrade = intent.grade
  const ordered = (list: SubstanceEntry[]) => [...list].sort((a, b) => Number(b.grade === preferGrade) - Number(a.grade === preferGrade))
  const first = ordered(matched)[0]!
  const sentences: string[] = []
  const used: SubstanceEntry[] = []
  if (intent.kind === 'formula' || intent.kind === 'name') {
    if (distinct.length > 1 && distinct.length <= 3) {
      sentences.push(`В учебниках есть несколько таких веществ: ${distinct.map((e) => `${e.name}${e.formula ? ` — ${e.formula}` : ''}`).join('; ')}.`)
      used.push(...distinct)
    } else {
      if (distinct.length > 3) return null
      const line = intent.kind === 'name' ? first.lines[1] : first.lines[0]
      if (!line) return null
      sentences.push(line)
      used.push(first)
    }
    const where = first.lines.find((l) => /^(Подробнее всего|В учебнике «Химия)/.test(l))
    if (where && distinct.length === 1) sentences.push(where)
  } else {
    if (distinct.length > 3) return null
    const byGrade = ordered(matched.filter((e) => (e.formula ?? e.name).toLowerCase() === (first.formula ?? first.name).toLowerCase()))
    const main = byGrade[0]!
    const mainLine = main.lines.find((l) => /^(Подробнее всего|В учебнике «Химия)/.test(l))
    if (!mainLine) return null
    sentences.push(mainLine)
    used.push(main)
    const more = main.lines.find((l) => l.startsWith('Ещё вещество'))
    if (more && channel === 'chat') sentences.push(more)
    // другие учебники — только другие классы (записи того же класса уже в «Ещё …»), по одной на класс
    const otherBooks = [...new Map(byGrade.filter((e) => e.grade !== main.grade).map((e) => [e.grade, e])).values()]
    const otherGrades = otherBooks.slice(0, 2).map((e) => {
      const c = /\[Kimyo (\d+), §([^,\]]+)(?:, стр\. ([^\]]+))?\]/.exec(e.hit.citation ?? '')
      used.push(e)
      return c ? `«Химия ${c[1]}» — § ${c[2]}${c[3] ? ` (стр. ${c[3]})` : ''}` : `«Химия ${e.grade}»`
    })
    if (otherGrades.length) sentences.push(`Также оно есть в других учебниках: ${otherGrades.join('; ')}.`)
  }
  sentences.push(intent.kind === 'location' ? CHECK.location : CHECK.formula)
  return { sentences, usedCitations: [...new Set(used.map((e) => e.hit.citation ?? '').filter(Boolean))], usedTitles: used.map((e) => e.hit.title) }
}

/** ««Химия 9», § 19 «Электролиз…» (стр. 96); § 34 «Железо» (стр. 159)» → место, где название § — о веществе реакции. */
function pickPlace(whereText: string, r: ReactionEntry, topicHint?: string): string {
  const head = /^(«Химия \d+», )/.exec(whereText)?.[1] ?? ''
  const places = whereText.slice(head.length).split('; ')
  // урок ученика («Химические свойства воды») — первым, если реакция есть в его §
  const hint = topicHint ? foldText(topicHint).replace(/\s+/g, ' ').trim() : ''
  const lesson = hint ? places.find((p) => foldText(/«([^»]+)»/.exec(p)?.[1] ?? '').replace(/\s+/g, ' ').trim() === hint) : undefined
  if (lesson) return `${head}${lesson}`
  const names = [...r.reagents, ...r.products].flatMap((s) => s.names).flatMap(ruWords).filter((w) => w.length >= 4)
  const titled = places.find((p) => {
    const title = /«([^»]+)»/.exec(p)?.[1] ?? ''
    return ruWords(title).some((t) => names.some((n) => sameWord(t, n)))
  })
  return `${head}${titled ?? places[0]!}`
}

/** Класс вещества из вопроса («оксида», «кислотой») должен быть в названии одного из веществ реакции. */
function headsCovered(r: ReactionEntry, query: string): boolean {
  const names = [...r.reagents, ...r.products].flatMap((x) => x.names).flatMap(ruWords)
  return ruWords(query)
    .filter((q) => HEAD_RE.test(q))
    .every((h) => names.some((w) => sameWord(w, h)))
}

/** Одно и то же уравнение с другой стрелкой или записью условий над стрелкой. */
const eqKey = (eq: string) =>
  normFormula(eq.replace(/\s+/g, ''))
    .replace(/⇌|⇄|=|->/g, '→')
    .replace(/→(\([^)]*\)|\[[^\]]*\])/g, '→')

const IMPLIED: { re: RegExp; formula: string }[] = [
  { re: /(горени|сгора|сжига|сжечь|сжигани|горит|горят)/iu, formula: 'O2' },
  { re: /(гидролиз)/iu, formula: 'H2O' },
]

/**
 * Вещества, названные в вопросе (по всем реакциям указателя): формулой или названием; слова, занятые более длинным
 * названием («оксида кальция»), не считаются упоминанием более короткого («кальций»).
 */
type Mentions = { all: Set<string>; groups: Set<string>[] }

function mentionedFormulas(query: string, reactions: readonly ReactionEntry[], qFormulas: readonly string[]): Mentions {
  const found: { formula: string; at: number[] }[] = []
  for (const r of reactions) {
    for (const s of [...r.reagents, ...r.products]) {
      for (const n of s.names) {
        const m = matchName(n, query, { heads: false })
        if (m) found.push({ formula: fkey(s.formula), at: m.at })
      }
    }
  }
  // одно упоминание («хлор») может означать разные записи (Cl₂ и атом Cl): группа по занятым словам вопроса
  const groups = new Map<string, Set<string>>()
  for (const f of qFormulas.map(fkey)) groups.set(`f:${f}`, new Set([f]))
  for (const f of found) {
    const inside = found.some((g) => g.at.length > f.at.length && f.at.every((i) => g.at.includes(i)))
    if (inside) continue
    const key = [...f.at].sort((a, b) => a - b).join(',')
    const set = groups.get(key) ?? new Set<string>()
    set.add(f.formula)
    groups.set(key, set)
  }
  const list = [...groups.values()]
  return { all: new Set(list.flatMap((s) => [...s])), groups: list }
}

function answerProducts(intent: BookIntent, query: string, hits: readonly BookHitLike[], channel: 'chat' | 'voice', topicHint?: string): BookAnswer | null {
  const qFormulas = formulasInText(query)
  const implied = IMPLIED.filter((i) => i.re.test(query)).map((i) => i.formula)
  const reactions = hits.filter((h) => h.type === 'index').map(parseReaction).filter((r): r is ReactionEntry => !!r)
  const named = mentionedFormulas(query, reactions, qFormulas)
  const score = new Map<ReactionEntry, number>()
  const fits = reactions.filter((r) => {
    let explicit = 0
    let impliedUsed = 0
    for (const s of r.reagents) {
      if (named.all.has(fkey(s.formula))) explicit += 1
      else if (implied.includes(fkey(s.formula))) impliedUsed += 1
      else return false
    }
    if (!explicit || !headsCovered(r, query)) return false
    // «горение метана»: реакция без кислорода — не горение; «горение железа в хлоре» называет окислитель сам
    if (implied.length && explicit < 2 && !r.reagents.some((s) => implied.includes(fkey(s.formula)))) return false
    // вещество из вопроса (формулой или названием), которого нет в реакции, — это другая реакция
    const species = [...r.reagents, ...r.products].map((s) => fkey(s.formula))
    if (!named.groups.every((g) => [...g].some((f) => species.includes(f)))) return false
    score.set(r, explicit * 2 + impliedUsed)
    return true
  })
  if (!fits.length) return null
  const byEquation = new Map<string, ReactionEntry>()
  const ranked = fits.sort((a, b) => score.get(b)! - score.get(a)! || Number(b.grade === intent.grade) - Number(a.grade === intent.grade))
  for (const r of ranked) {
    const key = eqKey(r.equation)
    if (!byEquation.has(key)) byEquation.set(key, r)
  }
  const list = [...byEquation.values()]
  // вопрос называет и продукт — оставляем реакции с ним («… чтобы получить сульфат натрия»)
  const withProduct = list.filter((r) => r.products.some((p) => named.all.has(fkey(p.formula))))
  const pool = withProduct.length ? withProduct : list
  const setOf = (xs: ReactionEntry['reagents']) => xs.map((s) => fkey(s.formula)).sort().join('+')
  // второй вариант — те же исходные вещества, но другие продукты (другое соотношение, условия), не та же реакция ×2
  const alt = pool.slice(1).find((r) => setOf(r.reagents) === setOf(pool[0]!.reagents) && setOf(r.products) !== setOf(pool[0]!.products))
  const chosen = [pool[0]!, ...(alt ? [alt] : [])].slice(0, channel === 'voice' ? 1 : 2)
  const main = chosen[0]!
  const names = (xs: ReactionEntry['products']) => xs.map((p) => (p.names[0] ? `${p.names[0]} (${p.formula})` : p.formula))
  const prod = names(main.products)
  // первое место в учебнике: «Химия 8», § 2 «…» (стр. 13)
  // место в учебнике: § о веществе реакции («Железо», «Химические свойства воды»), иначе первое по книге
  const where = main.where ? pickPlace(main.where.replace(/^«Химия (\d+)» \(Kimyo \d+\): /, '«Химия $1», '), main, topicHint) : `«Химия ${main.grade}»`
  const sentences = [
    `По учебнику ${where}: ${main.equation}.`,
    prod.length === 1 ? `Продукт реакции — ${prod[0]}.` : `Продукты реакции — ${prod.slice(0, -1).join(', ')} и ${prod[prod.length - 1]}.`,
  ]
  if (main.type) sentences.push(`Это ${main.type}.`)
  if (chosen[1]) sentences.push(`В учебнике есть и другой вариант с теми же веществами: ${chosen[1].equation}.`)
  sentences.push(CHECK.products)
  return { sentences, usedCitations: [...new Set(chosen.map((r) => r.hit.citation ?? '').filter(Boolean))], usedTitles: chosen.map((r) => r.hit.title) }
}

function answerSection(intent: BookIntent, hits: readonly BookHitLike[], channel: 'chat' | 'voice'): BookAnswer | null {
  const sections = hits.filter((h) => h.type === 'index').map(parseSection).filter((s): s is SectionEntry => !!s)
  const same = sections.filter((s) => s.kp === intent.kp && (!intent.grade || s.grade === intent.grade))
  const sec = same[0]
  if (!sec) return null
  const book = `«Химия ${sec.grade}»`
  const pages = /стр\. ([\d–]+)/.exec(sec.lines[0] ?? '')?.[1]
  const head = `§ ${sec.kp} «${sec.title}» учебника ${book}${pages ? ` (стр. ${pages})` : ''}`
  const sentences: string[] = []
  if (intent.wants === 'substances') {
    const line = sec.lines.find((l) => l.startsWith(`Вещества § ${sec.kp}:`))
    if (!line) return null
    sentences.push(`${head}. ${line}`)
  } else if (intent.wants === 'labs') {
    const line = sec.lines.find((l) => l.startsWith(`Опыты и практические работы § ${sec.kp}:`))
    if (!line) return null
    sentences.push(`${head}. ${line}`)
  } else {
    const eqs = sec.lines
      .filter((l) => l.startsWith(`Реакции § ${sec.kp}`))
      .flatMap((l) => l.replace(/^[^:]*:\s*/, '').replace(/\.$/, '').split(/;\s*/))
    if (!eqs.length) {
      const none = sec.lines.find((l) => l.startsWith('Уравнений реакций'))
      if (!none) return null
      sentences.push(`${none.replace(/\.$/, '')} (${head}).`)
    } else {
      const max = channel === 'voice' ? 4 : 8
      sentences.push(`В ${head} ${eqs.length} ${plural(eqs.length, 'уравнение реакции', 'уравнения реакций', 'уравнений реакций')}: ${eqs.slice(0, max).join('; ')}${eqs.length > max ? ` — и ещё ${eqs.length - max}` : ''}.`)
    }
  }
  sentences.push(intent.wants === 'reactions' ? CHECK.section : CHECK.location)
  return { sentences, usedCitations: sec.hit.citation ? [sec.hit.citation] : [], usedTitles: [sec.hit.title] }
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

const LOCATION_FILLER_RE =
  /^(где|в|во|на|о|об|обо|про|учебник\S*|книг\S*|говорит\S*|рассказыва\S*|написан\S*|сказан\S*|описан\S*|изуча\S*|проход\S*|упомина\S*|можно|найти|прочитать|почитать|каком|какой|каких|какую|параграф\S*|страниц\S*|тем\S*|глав\S*|класс\S*|раздел\S*|есть|про|этом|этой|химии|химия|мне|нам|посмотреть|узнать|идет|идёт|речь)$/u

/** «Где в учебнике говорится о коррозии?» без вещества в указателе: § и страница лучших найденных страниц учебника. */
function answerTopicLocation(query: string, hits: readonly BookHitLike[]): BookAnswer | null {
  // смысловые слова темы: без служебных слов вопроса и без глаголов («объясняется», «рассматривают»)
  const words = ruWords(query).filter((w) => w.length >= 3 && !LOCATION_FILLER_RE.test(w) && !/(ется|ются|ится|ятся|ают|яют|уют|ует|ать|ять|ить|еть)$/.test(w))
  if (!words.length) return null
  const places = new Map<string, { hit: BookHitLike; grade: string; kp: string; pages: string | undefined; title: string }>()
  for (const h of hits) {
    if (h.type !== 'textbook' && h.type !== 'definition' && h.type !== 'summary') continue
    const c = /\[Kimyo (\d+), §([^,\]]+)(?:, стр\. ([^\]]+))?\]/.exec(h.citation ?? '')
    if (!c) continue
    const title = h.title.replace(/:\s.*$/, '')
    const titleWords = ruWords(title)
    // все смысловые слова вопроса — в названии параграфа или в тексте найденной страницы
    const inTitle = words.every((w) => titleWords.some((t) => sameWord(t, w)))
    const textWords = ruWords(h.text)
    const inText = words.every((w) => textWords.some((t) => sameWord(t, w)))
    if (!inTitle && !inText) continue
    const key = `${c[1]}|${c[2]}`
    if (!places.has(key) || inTitle) places.set(key, { hit: h, grade: c[1]!, kp: c[2]!, pages: c[3], title })
    if (places.size >= 3) break
  }
  const list = [...places.values()]
  if (!list.length) return null
  const titled = list.filter((p) => words.every((w) => ruWords(p.title).some((t) => sameWord(t, w))))
  const ordered = [...titled, ...list.filter((p) => !titled.includes(p))].slice(0, 2)
  const fmt = (p: (typeof ordered)[number]) => `учебник «Химия ${p.grade}» (Kimyo ${p.grade}), § ${p.kp} «${p.title}»${p.pages ? `, стр. ${p.pages}` : ''}`
  const sentences = [`Об этом говорится здесь: ${fmt(ordered[0]!)}.`]
  if (ordered[1]) sentences.push(`Ещё — ${fmt(ordered[1])}.`)
  sentences.push(CHECK.location)
  return { sentences, usedCitations: ordered.map((p) => p.hit.citation!).filter(Boolean), usedTitles: ordered.map((p) => p.hit.title) }
}

/**
 * Ответ по указателю учебника или null (тогда отвечает обычный составитель). `hits` — все найденные фрагменты
 * (указатель — type 'index', для «где говорится о теме» — страницы учебника).
 */
export function answerFromBookIndex(
  query: string,
  hits: readonly BookHitLike[],
  lang: StemLang,
  opts: { channel?: 'chat' | 'voice'; noCheckQuestion?: boolean; grade?: number; fallbackWhatIs?: boolean; topicHint?: string } = {},
): BookAnswer | null {
  // «Что такое гидрид кальция?», когда определения в базе нет: формула и место в учебнике — лучше честного отказа
  const intent = detectBookIntent(query, lang) ?? (opts.fallbackWhatIs && WHAT_IS_SUBSTANCE_RE.test(foldText(query)) ? { kind: 'formula' as const } : null)
  if (!intent) return null
  if (!intent.grade && opts.grade) intent.grade = opts.grade
  // голос (канал не указан) — короче: без списка «Ещё …» и без второго варианта реакции
  const channel = opts.channel === 'chat' ? 'chat' : 'voice'
  let out: BookAnswer | null
  if (intent.kind === 'section') out = answerSection(intent, hits, channel)
  else if (intent.kind === 'products') out = answerProducts(intent, query, hits, channel, opts.topicHint)
  else {
    out = answerSubstance(intent, query, hits, channel)
    if (!out && intent.kind === 'location') out = answerTopicLocation(query, hits)
  }
  if (out && opts.noCheckQuestion) out = { ...out, sentences: out.sentences.slice(0, -1) }
  if (out) out.sentences = out.sentences.map((s) => capital(s.trim()))
  return out
}
