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
import { delatex } from '../../brain/pipeline/delatex.ts'
import { StreamGate } from '../../brain/pipeline/postcheck.ts'

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
  const { r } = await find('Кто открыл кислород?')
  ok(r.items.some((c) => /^Пристли, Джозеф/u.test(c.title) || /Джозеф Пристли/u.test(c.title)), 'кто открыл кислород: Пристли не отброшен «не в заголовке»', r.items.map((c) => c.title).join(' | '))
}
{
  const { r } = await find('What is a mole?')
  ok(!r.items.slice(0, 3).some((c) => /Угольная кислота|Гидролиз солей/u.test(c.title)), 'What is a mole?: нет «Угольной кислоты»/«Гидролиза солей» в top-3 (слабый терм)', r.items.map((c) => c.title).join(' | '))
  ok(!r.items.some((c) => /википед|wikipedia/iu.test(c.source)), 'What is a mole?: школьный вопрос без Википедии', r.items.map((c) => c.source).join(' | '))
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

// ——— формулы LaTeX → обычный текст (сайт LaTeX не рисует)
console.log('формулы без LaTeX:')
for (const [src, want] of [
  ['при нагревании: \\(2\\text{KMnO}_4 \\rightarrow \\text{K}_2\\text{MnO}_4 + \\text{MnO}_2 + \\text{O}_2\\uparrow\\).', 'при нагревании: 2KMnO₄ → K₂MnO₄ + MnO₂ + O₂↑.'],
  ['\\(2\\text{H}_2\\text{O}_2 \\rightarrow 2\\text{H}_2\\text{O} + \\text{O}_2\\uparrow\\)', '2H₂O₂ → 2H₂O + O₂↑'],
  ['$\\ce{CaCO3 + 2HCl -> CaCl2 + H2O + CO2 ^}$', 'CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑'],
  ['\\(\\mathrm{SO_4^{2-}}\\) и \\(\\text{Fe}^{3+}\\)', 'SO₄²⁻ и Fe³⁺'],
  ['N₂ + 3H₂ \\rightleftharpoons 2NH₃, \\(\\Delta H < 0\\), 450\\,^\\circ C', 'N₂ + 3H₂ ⇄ 2NH₃, ΔH < 0, 450 °C'],
  ['\\(2\\text{KClO}_3 \\xrightarrow{t, \\text{MnO}_2} 2\\text{KCl} + 3\\text{O}_2\\)', '2KClO₃ →(t, MnO₂) 2KCl + 3O₂'],
  ['Цена набора — $100, H₂O без разметки.', 'Цена набора — $100, H₂O без разметки.'],
] as const) {
  const got = delatex(src)
  ok(got === want, `delatex «${src.slice(0, 40)}…»`, got)
}
{
  let out = ''
  const g = new StreamGate('ru', 200, (p) => (out += p))
  const src = 'Кислород получают разложением перманганата калия при нагревании, это самый удобный способ в школьной лаборатории: \\(2\\text{KMnO}_4 \\rightarrow \\text{K}_2\\text{MnO}_4 + \\text{MnO}_2 + \\text{O}_2\\uparrow\\). Готово.'
  for (const tok of src.match(/.{1,7}/gs)!) g.push(tok)
  g.end()
  ok(out.includes('2KMnO₄ → K₂MnO₄ + MnO₂ + O₂↑') && !/[\\{]/.test(out), 'поток (StreamGate) без LaTeX', out)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
