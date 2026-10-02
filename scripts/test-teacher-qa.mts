/**
 * Тест «большой базы данных» учителя (src/learn/brain/qa/qaBank.ts + src/data/teacher/qaBank.json).
 * Генерируем ≥ 400 вопросов из самой базы (вещества, элементы, реакции, глоссарий; RU/EN/UZ, падежи,
 * опечатки) и проверяем: ответ есть, содержит верное число / формулу / уравнение / §; молярные массы
 * совпадают с расчётом из ELEMENTS; 60 «чужих» фраз (приветствия, общие вопросы) → null.
 *
 *   npm run test:teacher-qa
 */
import { readFileSync } from 'node:fs'
import { answerFromQaBank, formatMass, setQaBank, type QaAnswer, type QaLang } from '../src/learn/brain/qa/qaBank.ts'
import type { QaBank, QaElement, QaSubstance } from '../src/learn/brain/qa/qaBankTypes.ts'
import { setMemoryProfileBackend } from '../src/learn/brain/human/studentProfile.ts'
import { ELEMENTS } from '../src/data/elements.ts'

setMemoryProfileBackend()
const bank = JSON.parse(readFileSync(new URL('../src/data/teacher/qaBank.json', import.meta.url), 'utf8')) as QaBank
setQaBank(bank)

const SUB = '₀₁₂₃₄₅₆₇₈₉'
const pretty = (f: string) => f.replace(/(?<=[A-Za-z)\]])(\d+)/g, (d) => [...d].map((c) => SUB[Number(c)]).join(''))

/* ---------------------------------------------------------- молярные массы из ELEMENTS */
const massBy = new Map(ELEMENTS.map((e) => [e.symbol, e.atomicMass]))
let massMismatch = 0
for (const s of bank.substances) {
  let M = 0
  for (const [sym, n] of Object.entries(s.comp)) M += (massBy.get(sym) ?? 0) * n
  if (Math.abs(Math.round(M * 100) / 100 - s.M) > 0.011) {
    massMismatch++
    console.log(`  молярная масса расходится: ${s.id} ${s.f} база ${s.M} vs ELEMENTS ${M.toFixed(2)}`)
  }
}

/* ---------------------------------------------------------- падежи и опечатки */
function genWord(w: string): string {
  if (/ая$/.test(w)) return w.slice(0, -2) + 'ой'
  if (/яя$/.test(w)) return w.slice(0, -2) + 'ей'
  if (/ота$/.test(w) || /ода$/.test(w)) return w.slice(0, -1) + 'ы'
  if (/а$/.test(w)) return w.slice(0, -1) + 'ы'
  if (/ь$/.test(w)) return w.slice(0, -1) + 'и'
  if (/ий$/.test(w)) return w.slice(0, -2) + 'ия'
  if (/й$/.test(w)) return w.slice(0, -1) + 'я'
  if (/о$/.test(w)) return w.slice(0, -1) + 'а'
  return w + 'а'
}
/** Родительный падеж названия: «серная кислота» → «серной кислоты», «хлорид натрия» → «хлорида натрия». */
function genitive(name: string): string {
  const words = name.toLowerCase().split(' ')
  const first = words[0]!
  const adjective = /(ая|яя)$/.test(first)
  words[0] = genWord(first)
  if (adjective && words[1]) words[1] = genWord(words[1])
  return words.join(' ')
}
function typo(name: string): string | null {
  const words = name.toLowerCase().split(' ')
  const i = words.findIndex((w) => /^\p{L}{5,}$/u.test(w))
  if (i < 0) return null
  const w = words[i]!
  words[i] = w.slice(0, 2) + w[3] + w[2] + w.slice(4) // перестановка соседних букв (Дамерау = 1)
  return words.join(' ')
}

/* ---------------------------------------------------------- вопросы */
interface Q {
  say: string
  lang: QaLang
  intent?: string | string[]
  has?: (string | RegExp)[]
  group: string
}
const qs: Q[] = []
const add = (q: Q) => qs.push(q)

const subs = bank.substances
  .filter((s) => s.g.length && s.cls !== 'other' && !s.id.startsWith('org') && /^[А-ЯЁ][а-яё-]+(\s[а-яё]+)?(\([IVX]+\))?$/.test(s.ru))
  .sort((a, b) => a.id.localeCompare(b.id))
  .filter((_, i) => i % 3 === 0)
  .slice(0, 60)
for (const s of subs) {
  const M = formatMass(s.M, 'ru')
  add({ say: `молярная масса ${genitive(s.ru)}`, lang: 'ru', intent: 'molar', has: [M, s.f], group: 'molar-ru-gen' })
  add({ say: `Чему равна молярная масса ${genitive(s.ru)}?`, lang: 'ru', intent: 'molar', has: [M], group: 'molar-ru-q' })
  add({ say: `какая формула у ${genitive(s.ru)}?`, lang: 'ru', intent: 'formula', has: [s.f], group: 'formula-ru' })
  add({ say: `${s.ru} — это какой класс веществ?`, lang: 'ru', intent: ['class', 'family'], has: [s.f], group: 'class-ru' })
  add({ say: `в каком классе изучают ${s.ru.toLowerCase()}`, lang: 'ru', intent: 'where', has: [String(s.g[0])], group: 'where-ru' })
  const t = typo(s.ru)
  if (t) add({ say: `молярная масса ${t}`, lang: 'ru', intent: 'molar', has: [M], group: 'molar-ru-typo' })
  if (/\d/.test(s.fa) || s.fa.length >= 3) add({ say: `молярная масса ${s.fa.toLowerCase()}`, lang: 'ru', intent: 'molar', has: [M], group: 'molar-ru-ascii' })
  add({ say: `${s.f} — что это за вещество?`, lang: 'ru', intent: ['definition', 'about'], has: [s.ru], group: 'about-ru-formula' })
  if (s.en) {
    add({ say: `molar mass of ${s.en.toLowerCase()}`, lang: 'en', intent: 'molar', has: [formatMass(s.M, 'en')], group: 'molar-en' })
    add({ say: `What is the formula of ${s.en.toLowerCase()}?`, lang: 'en', intent: 'formula', has: [s.f], group: 'formula-en' })
    add({ say: `which class does ${s.en.toLowerCase()} belong to`, lang: 'en', intent: ['class', 'family'], has: [s.f], group: 'class-en' })
  }
  if (s.uz) {
    add({ say: `${s.uz.toLowerCase()} molyar massasi`, lang: 'uz', intent: 'molar', has: [formatMass(s.M, 'uz')], group: 'molar-uz' })
    add({ say: `${s.uz.toLowerCase()}ning formulasi qanday?`, lang: 'uz', intent: 'formula', has: [s.f], group: 'formula-uz' })
  }
}

const els = bank.elements.filter((e) => e.z <= 30 && e.per && e.grp)
for (const e of els) {
  add({ say: `какая группа и период у ${genitive(e.ru)}`, lang: 'ru', intent: 'position', has: [String(e.per), String(e.grp)], group: 'position-ru' })
  if (e.cfg) add({ say: `electron configuration of ${e.en.toLowerCase()}`, lang: 'en', intent: 'config', has: [e.cfg], group: 'config-en' })
  if (e.ox) add({ say: `${e.uz.toLowerCase()} oksidlanish darajalari`, lang: 'uz', intent: 'valency', has: [e.ox], group: 'valency-uz' })
  add({ say: `атомная масса ${genitive(e.ru)}`, lang: 'ru', intent: 'armass', has: [formatMass(e.A, 'ru')], group: 'armass-ru' })
}

const subByFa = new Map(bank.substances.map((s) => [s.fa.toLowerCase(), s]))
const elBySym = new Map(bank.elements.map((e) => [e.s, e]))
const nameOf = (f: string): { ru: string; en?: string; uz?: string } | null => {
  const s = subByFa.get(f.toLowerCase())
  if (s) return s
  const el = elBySym.get(f) ?? elBySym.get(f.replace(/2$/, ''))
  return el ? { ru: el.ru, en: el.en, uz: el.uz } : null
}
const twoReactants = bank.reactions.filter((r) => r.r.length === 2 && !r.org && r.r.every((f) => nameOf(f)))
let rxCount = 0
for (const r of twoReactants) {
  if (rxCount >= 40) break
  const [a, b] = r.r.map((f) => nameOf(f)!) as [{ ru: string; en?: string; uz?: string }, { ru: string; en?: string; uz?: string }]
  if (a.ru === b.ru) continue
  rxCount++
  const prod = pretty(r.p[0]!)
  add({ say: `что получится из ${genitive(a.ru)} и ${genitive(b.ru)}?`, lang: 'ru', intent: 'products', has: [prod], group: 'products-ru' })
  if (a.en && b.en) add({ say: `what is formed from ${a.en.toLowerCase()} and ${b.en.toLowerCase()}`, lang: 'en', intent: 'products', has: [prod], group: 'products-en' })
  if (a.uz && b.uz) add({ say: `${a.uz.toLowerCase()} va ${b.uz.toLowerCase()} dan nima hosil bo'ladi`, lang: 'uz', intent: 'products', has: [prod], group: 'products-uz' })
}
for (const r of bank.reactions.filter((x) => x.t && !x.org).slice(0, 40)) {
  const ascii = r.eq.split('').map((ch) => (SUB.includes(ch) ? String(SUB.indexOf(ch)) : ch)).join('').replace(/[→⇄]/g, '->')
  add({ say: `тип реакции ${ascii}`, lang: 'ru', intent: 'rxtype', has: [r.eq], group: 'rxtype-ru' })
}
let reactsCount = 0
for (const s of subs) {
  if (reactsCount >= 25) break
  if (!bank.reactions.some((r) => r.r.length > 1 && r.r.some((f) => f.toLowerCase() === s.fa.toLowerCase()))) continue
  reactsCount++
  add({ say: `с чем реагирует ${s.ru.toLowerCase()}?`, lang: 'ru', intent: 'reacts', has: [s.f, /\[Kimyo \d+/], group: 'reacts-ru' })
  if (s.en) add({ say: `what does ${s.en.toLowerCase()} react with`, lang: 'en', intent: 'reacts', has: [s.f], group: 'reacts-en' })
}
let obtainCount = 0
for (const s of subs) {
  if (obtainCount >= 25) break
  if (!bank.reactions.some((r) => r.p.some((f) => f.toLowerCase() === s.fa.toLowerCase()))) continue
  obtainCount++
  add({ say: `как получить ${s.ru.toLowerCase()}`, lang: 'ru', intent: 'obtain', has: [s.f, /→|⇄/], group: 'obtain-ru' })
  if (s.uz) add({ say: `${s.uz.toLowerCase()} qanday olinadi`, lang: 'uz', intent: 'obtain', has: [s.f], group: 'obtain-uz' })
}
for (const t of bank.terms.filter((x) => x.src === 'core' && x.en.length && x.uz.length).filter((_, i) => i % 10 === 0).slice(0, 25)) {
  add({ say: `как по-английски ${t.ru}`, lang: 'ru', intent: 'translate', has: [t.en[0]!], group: 'translate-ru' })
  add({ say: `${t.ru} inglizcha qanday bo'ladi`, lang: 'uz', intent: 'translate', has: [t.en[0]!], group: 'translate-uz' })
}
for (const d of bank.definitions.filter((x) => x.term.split(' ').length <= 2).filter((_, i) => i % 15 === 0).slice(0, 15)) {
  add({ say: `где в учебнике про ${d.term.toLowerCase()}`, lang: 'ru', intent: 'where', has: [new RegExp(`\\[Kimyo \\d+, §`)], group: 'where-term-ru' })
}

/* ---------------------------------------------------------- чужие фразы → null */
/* ---------------------------------------------------------- надиктованные формы и новые намерения */
const FILL_RU = ['э ну ', 'слушай, ', 'ну типа ', 'это самое, ', 'короче ', 'скажи ', 'в общем ', 'блин ']
const TAIL_RU = [' да?', ', а?', ' ну', '', ' правильно?', '']
let k = 0
const spoken = (q: string) => `${FILL_RU[k % FILL_RU.length]}${q}${TAIL_RU[k++ % TAIL_RU.length]}`
const sub40 = subs.slice(0, 40)
for (const s of sub40) {
  const M = formatMass(s.M, 'ru')
  add({ say: spoken(`молярная масса ${genitive(s.ru)}`), lang: 'ru', intent: 'molar', has: [M], group: 'spoken-molar' })
  add({ say: spoken(`какая формула у ${genitive(s.ru)}`), lang: 'ru', intent: 'formula', has: [s.f], group: 'spoken-formula' })
  add({ say: spoken(`расскажи про ${s.ru.toLowerCase()}`), lang: 'ru', intent: 'about', has: [s.f, M, /класс|кислота|соль|оксид|основание|вещество/i], group: 'about-story' })
  if (s.use) add({ say: `что ты знаешь про ${s.fa}`, lang: 'ru', intent: 'about', has: [s.ru, /Применение/], group: 'about-know' })
  if (s.en) add({ say: `um tell me about ${s.en.toLowerCase()} you know`, lang: 'en', intent: 'about', has: [s.f], group: 'spoken-about-en' })
}
for (const s of subs.slice(0, 10)) {
  if (s.uz) add({ say: `xo'sh ${s.uz.toLowerCase()} molyar massasi a`, lang: 'uz', intent: 'molar', has: [formatMass(s.M, 'uz')], group: 'spoken-molar-uz' })
}
for (let i = 0; i + 1 < sub40.length; i += 2) {
  const a = sub40[i]!
  const b = sub40[i + 1]!
  add({ say: `чем отличается ${a.ru.toLowerCase()} от ${genitive(b.ru)}`, lang: 'ru', intent: 'compare', has: [a.f, b.f, formatMass(a.M, 'ru'), formatMass(b.M, 'ru')], group: 'compare-subst' })
  if (a.en && b.en) add({ say: `compare ${a.en.toLowerCase()} and ${b.en.toLowerCase()}`, lang: 'en', intent: 'compare', has: [a.f, b.f], group: 'compare-en' })
}
add({ say: 'чем отличается атом от молекулы', lang: 'ru', intent: 'compare', has: [/атом/i, /молекул/i, /\[Kimyo \d+/], group: 'compare-terms' })
add({ say: 'сравни кислоты и основания', lang: 'ru', intent: 'compare', has: [/кислот/i, /основани/i, /\[Kimyo \d+/], group: 'compare-terms' })
const els20 = els.slice(0, 20)
for (const e of els20) {
  const metalloid = e.blk === 'Metalloid'
  const metal = !metalloid && /metal|lanthanide|actinide/i.test(e.blk)
  add({ say: `${e.ru.toLowerCase()} это металл или неметалл`, lang: 'ru', intent: 'metal', has: [metalloid ? /полуметалл/ : metal ? /— металл/ : /— неметалл/], group: 'metal-ru' })
  if (bank.substances.some((s) => s.comp[e.s] && Object.keys(s.comp).length > 1 && !s.id.startsWith('org')))
    add({ say: `какие соединения образует ${e.ru.toLowerCase()}`, lang: 'ru', intent: 'compounds', has: [new RegExp(`${e.s}[₀-₉A-Za-z]`), /\[ATOMLAB/], group: 'compounds-ru' })
  add({ say: spoken(`расскажи о ${genitive(e.ru)}`), lang: 'ru', intent: 'about', has: [e.s], group: 'spoken-elem-about' })
}
for (let i = 0; i + 1 < els20.length && i < 20; i += 2) {
  const a = els20[i]!
  const b = els20[i + 1]!
  add({ say: `чем отличается ${a.ru.toLowerCase()} от ${genitive(b.ru)}`, lang: 'ru', intent: 'compare', has: [a.s, b.s, `Z = ${a.z}`, `Z = ${b.z}`], group: 'compare-elem' })
}
let condCount = 0
for (const r of bank.reactions.filter((x) => x.c && x.r.length === 2 && !x.org && x.r.every((f) => nameOf(f)))) {
  if (condCount >= 20) break
  const [a, b] = r.r.map((f) => nameOf(f)!) as [{ ru: string }, { ru: string }]
  if (a.ru === b.ru) continue
  condCount++
  add({ say: `условия реакции ${a.ru.toLowerCase()} и ${b.ru.toLowerCase()}`, lang: 'ru', intent: 'conditions', has: [pretty(r.p[0]!), /—/], group: 'conditions-ru' })
}
for (const g of [7, 8, 9, 10, 11]) {
  const first = bank.sections.find((s) => s.g === g)
  if (!first) continue
  add({ say: `что проходят в ${g} классе`, lang: 'ru', intent: 'syllabus', has: [first.title.slice(0, 25), `[Kimyo ${g}]`], group: 'syllabus-ru' })
  add({ say: `topics of grade ${g}`, lang: 'en', intent: 'syllabus', has: [first.title.slice(0, 25)], group: 'syllabus-en' })
}
add({ say: 'что проходят в восьмом классе', lang: 'ru', intent: 'syllabus', has: ['[Kimyo 8]'], group: 'syllabus-spoken' })
for (const ch of [1, 2, 3]) {
  const first = bank.sections.find((s) => s.g === 8 && s.id?.startsWith(`c${ch}-`))
  if (first) add({ say: `какие темы в главе ${ch}`, lang: 'ru', intent: 'syllabus', has: [first.title.slice(0, 25), `глава ${ch}`], group: 'syllabus-chapter' })
}

const foreign: [string, QaLang][] = [
  ['э ну как дела', 'ru'],
  ['слушай привет', 'ru'],
  ['короче я устал', 'ru'],
  ['um hello there', 'en'],
  ['xo‘sh salom ustoz', 'uz'],
  ['привет', 'ru'],
  ['как дела?', 'ru'],
  ['спасибо', 'ru'],
  ['что такое моль', 'ru'],
  ['почему небо голубое', 'ru'],
  ['что такое химия', 'ru'],
  ['объясни закон сохранения массы', 'ru'],
  ['как решать задачи на массовую долю', 'ru'],
  ['что такое валентность', 'ru'],
  ['почему вода кипит при 100 градусах', 'ru'],
  ['сколько будет 2+2', 'ru'],
  ['расскажи анекдот', 'ru'],
  ['ты кто', 'ru'],
  ['мне скучно', 'ru'],
  ['я устал', 'ru'],
  ['помоги с домашкой', 'ru'],
  ['дай задачу', 'ru'],
  ['проверь меня', 'ru'],
  ['что такое атом', 'ru'],
  ['что такое молекула', 'ru'],
  ['что такое период в таблице менделеева', 'ru'],
  ['что такое группа', 'ru'],
  ['как найти массовую долю', 'ru'],
  ['что такое раствор', 'ru'],
  ['что такое индикатор', 'ru'],
  ['что такое оксиды', 'ru'],
  ['что такое кислоты', 'ru'],
  ['что такое реакция обмена', 'ru'],
  ['как уравнивать реакции', 'ru'],
  ['что такое электролит', 'ru'],
  ['что такое катализатор', 'ru'],
  ['пока', 'ru'],
  ['до свидания', 'ru'],
  ['ок', 'ru'],
  ['понятно', 'ru'],
  ['не понимаю', 'ru'],
  ['ещё раз', 'ru'],
  ['проще', 'ru'],
  ['пример', 'ru'],
  ['почему', 'ru'],
  ['зачем учить химию', 'ru'],
  ['какой сегодня день', 'ru'],
  ['который час', 'ru'],
  ['как тебя зовут', 'ru'],
  ['who are you', 'en'],
  ['what is a mole', 'en'],
  ['hello', 'en'],
  ['why is the sky blue', 'en'],
  ['what is an acid', 'en'],
  ['how to balance equations', 'en'],
  ['what is a catalyst', 'en'],
  ['explain redox', 'en'],
  ['thanks a lot', 'en'],
  ['salom', 'uz'],
  ['qalaysan', 'uz'],
  ['mol nima', 'uz'],
  ['kimyo nima', 'uz'],
  ["nima uchun osmon ko'k", 'uz'],
  ['rahmat', 'uz'],
  ['xayr', 'uz'],
]

/* ---------------------------------------------------------- прогон */
let pass = 0
let fail = 0
const failsByGroup = new Map<string, number>()
const totalByGroup = new Map<string, number>()
const shownFails: string[] = []
const intentsOk = (a: QaAnswer, want?: string | string[]) => !want || (Array.isArray(want) ? want.includes(a.intent) : a.intent === want)
const t0 = Date.now()
for (const q of qs) {
  totalByGroup.set(q.group, (totalByGroup.get(q.group) ?? 0) + 1)
  const a = await answerFromQaBank(q.say, { lang: q.lang, grade: 8, lastEntity: null })
  let err: string | null = null
  if (!a) err = 'null'
  else if (!intentsOk(a, q.intent)) err = `intent ${a.intent}`
  else {
    const miss = (q.has ?? []).find((h) => (typeof h === 'string' ? !a.text.toLowerCase().includes(h.toLowerCase()) : !h.test(a.text)))
    if (miss !== undefined) err = `нет «${String(miss)}» в: ${a.text.split('\n')[0]!.slice(0, 120)}`
  }
  if (err) {
    fail++
    failsByGroup.set(q.group, (failsByGroup.get(q.group) ?? 0) + 1)
    if (shownFails.length < 40) shownFails.push(`  ✗ [${q.group}] «${q.say}» → ${err}`)
  } else pass++
}
let foreignFail = 0
for (const [say, lang] of foreign) {
  const a = await answerFromQaBank(say, { lang, grade: 8, lastEntity: null })
  if (a) {
    foreignFail++
    console.log(`  ✗ чужая фраза перехвачена: «${say}» → ${a.intent}: ${a.text.split('\n')[0]!.slice(0, 100)}`)
  }
}
const ms = Date.now() - t0

console.log(shownFails.join('\n'))
console.log('\nПо группам (ошибки/всего):')
for (const [g, n] of totalByGroup) console.log(`  ${g.padEnd(18)} ${String(failsByGroup.get(g) ?? 0).padStart(3)} / ${n}`)
const total = qs.length
const rate = pass / total
console.log(`\nВопросов: ${total}, верно: ${pass}, ошибок: ${fail} (${(rate * 100).toFixed(1)} %), ${ms} мс, ${(ms / (total + foreign.length)).toFixed(1)} мс/вопрос`)
console.log(`Чужих фраз: ${foreign.length}, перехвачено: ${foreignFail}`)
console.log(`Молярные массы vs ELEMENTS: расхождений ${massMismatch} из ${bank.substances.length}`)
console.log(`База: веществ ${bank.substances.length}, элементов ${bank.elements.length}, реакций ${bank.reactions.length}, терминов ${bank.terms.length}, определений ${bank.definitions.length}, разделов ${bank.sections.length}`)

const ok = total >= 400 && rate >= 0.95 && foreignFail === 0 && massMismatch === 0
console.log(ok ? '\nTEST OK' : '\nTEST FAILED')
process.exitCode = ok ? 0 : 1
