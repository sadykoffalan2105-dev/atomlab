/**
 * npm run brain:selftest:retrieve — проверки поиска «сначала школа» (мозг v2, retrieveV2) и классификаторов
 * questionKind / classifyScope / GRADE_HINT_RE без LLM, на ручных самодостаточных вопросах (как их построит DIALOG).
 */
import { createBrain } from '../../brain/server.ts'
import { retrieveV2 } from '../../brain/pipeline/retrieve.ts'
import { cmpForm, normalizeInput } from '../../brain/pipeline/normalize.ts'
import { classifyScope, GRADE_HINT_RE, questionKind } from '../../brain/pipeline/intent.ts'
import { entityMentioned } from '../../brain/pipeline/entities.ts'
import type { QuestionKind, Scope, StandaloneQuery } from '../../brain/pipeline/dialogTypes.ts'

let pass = 0
let fail = 0
function ok(cond: boolean, name: string, detail = ''): void {
  if (cond) pass++
  else fail++
  console.log(`${cond ? '  ok ' : '  FAIL'}  ${name}${!cond && detail ? ` — ${detail}` : ''}`)
}

const brain = createBrain({ llm: null })
await brain.deps.journal.buildIndex()
const { kb, journal, config } = brain.deps

function sq(p: Partial<StandaloneQuery> & { text: string }): StandaloneQuery {
  const norm = normalizeInput(p.text, 'auto')
  return { lang: norm.lang, topic: null, entities: [], grade: 'g8', scope: 'school', kind: 'general', lengthClass: 'normal', followUp: 'none', resolvedBy: 'rules', original: p.text, ...p }
}
async function find(q: StandaloneQuery, maxItems = 6) {
  return retrieveV2({ query: q, ctx: { gradeId: q.grade ?? 'g8' }, profile: 'laptop', budgetChars: 600, maxItems }, { kb, journal, embeds: null, llm: null, config })
}
const titles = (r: { items: { title: string; source: string; sourceKind: string }[] }) => r.items.map((c) => `${c.sourceKind}:${c.source}:${c.title.slice(0, 40)}`).join(' | ')

console.log('поиск «сначала школа»:')
{
  const r = await find(sq({ text: 'Что такое валентность?', grade: 'g8', topic: 'валентность', kind: 'definition' }))
  ok(r.items[0]?.sourceKind === 'textbook_grade' && /^Kimyo 8/.test(r.items[0]?.source ?? ''), '(1) валентность, 8 класс → первым Kimyo 8', titles(r))
  ok(!r.encyclopediaUsed && r.schoolHit && r.scopeUsed === 'school', '(1) школа есть, Википедии нет', `${r.scopeUsed} enc=${r.encyclopediaUsed}`)
}
{
  const r = await find(sq({ text: 'Что такое валентность?', grade: 'g7', topic: 'валентность', kind: 'definition' }))
  ok(r.items[0]?.sourceKind === 'textbook_grade' && /^Kimyo 7/.test(r.items[0]?.source ?? ''), '(2) валентность, 7 класс → первым Kimyo 7', titles(r))
}
{
  const r = await find(sq({ text: 'Какая валентность у натрия?', topic: 'валентность', entities: ['Na'], followUp: 'switch_entity', kind: 'definition' }))
  const top3 = r.items.slice(0, 3)
  ok(top3.some((c) => c.terms.has('валентн')), '(3) «а у натрия?» → в top-3 есть «валентн»', titles(r))
  ok(top3.some((c) => c.terms.has('натр') || /натри/iu.test(c.title + c.text)), '(3) «а у натрия?» → в top-3 есть «натрий»', titles(r))
}
for (const grade of ['g8', 'g9'] as const) {
  const r = await find(sq({ text: 'What is a mole?', grade, kind: 'definition' }))
  ok(!r.items.slice(0, 3).some((c) => /Угольная кислота|Гидролиз солей/u.test(c.title)), `(4) What is a mole? (${grade}) → нет «Угольной кислоты»/«Гидролиза» в top-3`, titles(r))
  ok(!r.items.some((c) => c.sourceKind === 'encyclopedia'), `(4) What is a mole? (${grade}) → без Википедии`, titles(r))
}
{
  const r = await find(sq({ text: 'Расскажи про историю открытия кислорода', scope: 'broad', kind: 'who_history' }))
  ok(r.items.some((c) => /Пристли|Шееле/u.test(c.title)), '(5) история открытия кислорода → Пристли/Шееле', titles(r))
  ok(!r.items.some((c) => /Глюкоза/u.test(c.title)), '(5) история открытия кислорода → без «Глюкозы»', titles(r))
}
{
  const r = await find(sq({ text: 'Кто открыл кислород?', scope: 'broad', kind: 'who_history' }))
  ok(r.items.some((c) => /Пристли, Джозеф|Джозеф Пристли/u.test(c.title)), '(5б) кто открыл кислород → карточка/статья о Пристли', titles(r))
}
{
  const r = await find(sq({ text: 'Что такое энтропия?', scope: 'broad', kind: 'definition' }))
  ok(r.items.length >= 1, '(6) энтропия (broad) → есть хотя бы один фрагмент', titles(r))
}
{
  const r = await find(sq({ text: 'Что такое фуллерен?', grade: 'g8', kind: 'definition' }))
  const encIdx = r.items.findIndex((c) => c.sourceKind === 'encyclopedia' || c.sourceKind === 'index')
  const school = r.items.some((c) => c.sourceKind !== 'encyclopedia' && c.sourceKind !== 'index')
  ok(r.scopeUsed === 'broad' || encIdx === -1 || encIdx >= 2 || !school, '(7) фуллерен: школа пуста → broad, иначе энциклопедия не выше 3-го места', `${r.scopeUsed}; ${titles(r)}`)
  ok(r.scopeUsed !== 'school' || r.schoolHit || r.confR < config.thresholds.medium, '(7) школьный вопрос без учебника → уверенность не выше medium', `conf ${r.confR.toFixed(2)}`)
}
{
  const r = await find(sq({ text: 'Valentlik nima?', grade: 'g7', lang: 'uz', topic: 'валентность', kind: 'definition' }))
  ok(/^Kimyo 7/.test(r.items[0]?.source ?? ''), '(uz) Valentlik nima? (7 класс) → первым Kimyo 7', titles(r))
}
{
  const r = await find(sq({ text: 'Что такое катализатор?', grade: 'g9', kind: 'definition' }))
  ok(r.items[0] ? r.items[0].sourceKind !== 'encyclopedia' : false, 'катализатор (9 класс) → первым не Википедия', titles(r))
}

// ——— (8) охват
console.log('охват (classifyScope):')
const SCOPES: [string, Scope][] = [
  ['Что такое валентность?', 'school'],
  ['Как получить кислород?', 'school'],
  ['Valentlik nima?', 'school'],
  ['What is a mole?', 'school'],
  ['Вычисли молярную массу H2SO4', 'school'],
  ['Почему железо ржавеет?', 'school'],
  ['Kislorod qanday olinadi?', 'school'],
  ['What are oxides?', 'school'],
  ['Какая валентность у натрия?', 'school'],
  ['Что такое оксиды? Кратко.', 'school'],
  ['Кто открыл кислород?', 'broad'],
  ['Что такое энтропия?', 'broad'],
  ['Расскажи про историю открытия кислорода', 'broad'],
  ['Как получают алюминий в промышленности?', 'broad'],
  ['Зачем нужен электролиз в жизни?', 'broad'],
  ['Where is electrolysis used in real life?', 'broad'],
  ['Объясни гибридизацию орбиталей', 'broad'],
  ['Какая завтра погода?', 'offtopic'],
  ['Кто выиграл чемпионат по футболу?', 'offtopic'],
  ['Tell me a joke about football', 'offtopic'],
]
for (const [q, want] of SCOPES) {
  const n = normalizeInput(q, 'auto')
  const got = classifyScope(n.text, cmpForm(n.text), n.lang, kb)
  ok(got.scope === want, `«${q}» → ${want}`, `${got.scope} (${got.why})`)
}

// ——— (9) тип вопроса
console.log('тип вопроса (questionKind):')
const KINDS: [string, QuestionKind][] = [
  ['Что такое валентность?', 'definition'],
  ['Какая валентность у натрия?', 'definition'],
  ['Почему железо ржавеет?', 'why'],
  ['Как получить кислород?', 'howto_obtain'],
  ['Чем отличаются металлы от неметаллов?', 'compare'],
  ['Свойства серной кислоты', 'properties'],
  ['Зачем нужен электролиз в жизни?', 'uses'],
  ['Кто открыл кислород?', 'who_history'],
  ['Вычисли молярную массу H2SO4', 'calc'],
  ['Какая степень окисления марганца в MnO2?', 'calc'],
  ['Правда ли, что все кислоты содержат кислород?', 'test_style'],
  ['Выбери правильный ответ: валентность кислорода а) I б) II в) III', 'test_style'],
  ['Проверь моё решение: 2Fe + O2 = Fe2O3', 'homework'],
  ['спасибо', 'chitchat'],
  ['повтори', 'repeat'],
  ['да', 'confirm'],
  ['Valentlik nima?', 'definition'],
  ['Temir nega zanglaydi?', 'why'],
  ['Kislorod qanday olinadi?', 'howto_obtain'],
  ['H2SO4 ning molyar massasini hisoblang', 'calc'],
  ['What is a mole?', 'definition'],
  ['Why does iron rust?', 'why'],
  ['How is oxygen produced in the lab?', 'howto_obtain'],
  ['Who discovered oxygen?', 'who_history'],
]
for (const [q, want] of KINDS) {
  const n = normalizeInput(q, 'auto')
  const got = questionKind(cmpForm(n.text), n.text)
  ok(got === want, `«${q}» → ${want}`, got)
}

console.log('класс в реплике (GRADE_HINT_RE):')
for (const [q, want] of [
  ['а в 7 классе как это объясняют?', '7'],
  ['объясни для 8-го класса', '8'],
  ['7-sinf uchun tushuntir', '7'],
  ['how would you explain it in grade 7?', '7'],
  ['explain like for 10th grade', '10'],
  ['сколько будет 7 + 8?', null],
  ['Fe2O3 и 11 г', null],
] as const) {
  const m = q.match(GRADE_HINT_RE)
  ok((m?.[1] ?? null) === want, `«${q}» → ${want ?? 'нет'}`, String(m?.[1]))
}

console.log('сущность в тексте (entityMentioned):')
for (const [text, e, want] of [
  ['Валентность натрия равна I.', 'Na', true],
  ['Natriyning valentligi I ga teng.', 'Na', true],
  ['Sodium has valence I.', 'Na', true],
  ['M(H₂SO₄) = 98,08 г/моль', 'H2SO4', true],
  ['Серная кислота реагирует с медью.', 'H2SO4', true],
  ['Азотная кислота HNO₃ — сильный окислитель.', 'азотная кислота', true],
  ['Валентность кислорода — II.', 'Na', false],
  ['Кальций активнее магния.', 'серная кислота', false],
] as const) ok(entityMentioned(text, e, kb) === want, `«${text}» ∋ ${e} = ${want}`)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
