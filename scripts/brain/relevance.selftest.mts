/**
 * npm run brain:selftest — юнит-проверки без LLM: тема найденного (relevance.ts), способы получения (obtain.ts),
 * падежи названий (declension.ts), ложный мат на химических словах (moderation.ts).
 */
import { createBrain } from '../../brain/server.ts'
import { retrieve } from '../../brain/pipeline/retrieve.ts'
import { cmpForm, normalizeInput } from '../../brain/pipeline/normalize.ts'
import { questionType, wantsEncyclopedia } from '../../brain/pipeline/intent.ts'
import { runTools } from '../../brain/pipeline/tools.ts'
import { genitive, prepositional } from '../../brain/pipeline/declension.ts'
import { moderate } from '../../brain/pipeline/moderation.ts'

let pass = 0
let fail = 0
function ok(cond: boolean, name: string, detail = ''): void {
  if (cond) pass++
  else fail++
  console.log(`${cond ? '  ok ' : '  FAIL'}  ${name}${!cond && detail ? ` — ${detail}` : ''}`)
}

// ——— падежи
const G: [string, string, string][] = [
  ['Натрий', 'натрия', 'натрии'],
  ['Кислород', 'кислорода', 'кислороде'],
  ['Серная кислота', 'серной кислоты', 'серной кислоте'],
  ['Оксид меди(II)', 'оксида меди(II)', 'оксиде меди(II)'],
  ['Углекислый газ', 'углекислого газа', 'углекислом газе'],
  ['Медь', 'меди', 'меди'],
  ['Железо', 'железа', 'железе'],
  ['Сера', 'серы', 'сере'],
  ['Никель', 'никеля', 'никеле'],
  ['Свинец', 'свинца', 'свинце'],
  ['Негашёная известь', 'негашёной извести', 'негашёной извести'],
  ['Бертолетова соль', 'бертолетовой соли', 'бертолетовой соли'],
  ['Веселящий газ', 'веселящего газа', 'веселящем газе'],
  ['H₂O', 'H₂O', 'H₂O'],
]
console.log('падежи:')
for (const [n, gen, prep] of G) {
  ok(genitive(n) === gen, `«${n}» → ${gen}`, genitive(n))
  ok(prepositional(n) === prep, `«${n}» → о ${prep}`, prepositional(n))
}

// ——— мат: химические слова не ругательства
console.log('модерация:')
for (const q of ['How is oxygen produced in the lab?', 'hydroxyl group', 'deoxygenated water']) ok(!moderate(q).flagged, `не мат: «${q}»`)
for (const q of ['охуеть', 'fuck oxygen']) ok(moderate(q).flagged, `мат: «${q}»`)

// ——— поиск и инструмент
const brain = createBrain({ llm: null })
await brain.deps.journal.buildIndex()
const { kb, journal, config } = brain.deps
async function find(q: string) {
  const norm = normalizeInput(q, 'auto')
  const cmp = cmpForm(norm.text)
  const wantEnc = wantsEncyclopedia(cmp) || questionType(cmp) === 'who'
  const r = await retrieve(norm.text, norm.lang, { gradeId: 'g9' }, wantEnc, { kb, journal, embeds: null, llm: null, config })
  return { r, tools: runTools(norm.text, cmp, norm.lang, kb) }
}

console.log('поиск по теме:')
{
  const { r } = await find('Почему небо голубое?')
  ok(!r.items.some((c) => /голуб(ой|ев)/iu.test(c.title)), 'небо голубое: нет «Голубой сдвиг» / «Голубева»', r.items.map((c) => c.title).join(' | '))
}
{
  const { r, tools } = await find('Как получить кислород?')
  ok(!r.items.some((c) => /пристли|шееле/iu.test(c.title)), 'как получить кислород: нет справок об учёных', r.items.map((c) => c.title).join(' | '))
  ok(/^Kimyo|^ATOMLAB/i.test(r.items[0]?.source ?? ''), 'как получить кислород: первым — учебник/ATOMLAB', r.items[0]?.source)
  const t = tools.find((x) => x.tool === 'obtain')?.text ?? ''
  for (const re of [/2KMnO₄ →\(t°\) K₂MnO₄ \+ MnO₂ \+ O₂/, /2KClO₃ →\(t°, MnO₂\) 2KCl \+ 3O₂/, /2H₂O₂ →\(MnO₂\) 2H₂O \+ O₂/, /электролиз/, /В промышленности: .*воздух/u, /Способы получения кислорода/])
    ok(re.test(t), `кислород: ${re.source}`, t.slice(0, 160))
  ok(!/NaNO₂\s*→/.test(t), 'кислород: нет «NaNO₂ →»')
}
{
  const { r } = await find('Кто открыл кислород?')
  ok(r.items.some((c) => /пристли|шееле/iu.test(c.title)), 'кто открыл кислород: учёные остаются', r.items.map((c) => c.title).join(' | '))
}
{
  const { r } = await find('Что такое катализатор?')
  ok(/^Kimyo/i.test(r.items[0]?.source ?? ''), 'катализатор: первым — учебник Kimyo (а не Википедия)', `${r.items[0]?.source} · ${r.items[0]?.title}`)
}
for (const [q, re] of [
  ['Kislorod qanday olinadi?', /Laboratoriyada: .*KMnO₄/u],
  ['How is oxygen produced in the lab?', /In the lab: .*KMnO₄/u],
  ['Как получают серную кислоту?', /SO₃ \+ H₂O → H₂SO₄/],
  ['Как получают хлороводород?', /H₂ \+ Cl₂ → 2HCl/],
  ['Как получить хлор?', /MnO₂ \+ 4HCl/],
] as const) {
  const { tools } = await find(q)
  const t = tools.find((x) => x.tool === 'obtain')?.text ?? ''
  ok(re.test(t), `«${q}» → ${re.source}`, t.slice(0, 160))
}
{
  const { tools } = await find('Как образуется ионная связь?')
  ok(!tools.some((x) => x.tool === 'obtain'), '«как образуется ионная связь» — не способ получения')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
