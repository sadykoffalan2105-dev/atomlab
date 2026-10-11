/**
 * npx tsx scripts/brain/dialog.selftest.mts — проверки мозга v2 (DIALOG) без Ollama и без папки данных:
 *   resolveStandalone на парах «история → реплика → ожидаемый standalone / followUp / класс длины»;
 *   planAnswer на комбинациях тип × охват × detail × профиль; selfCheck на текстах; questionOf на формате v3;
 *   runChat в процессе с mock-LLM на многоходовых диалогах ru/uz/en (meta.standalone, meta.followUp, длина).
 */
import { Knowledge } from '../../brain/kb/shards.ts'
import { setElementWords } from '../../brain/pipeline/normalize.ts'
import { cmpForm } from '../../brain/pipeline/normalize.ts'
import { DEFAULT_CONFIG } from '../../brain/config.ts'
import type { ChatMessage, ChatRequest, DoneEvent, MetaEvent } from '../../brain/pipeline/chat.ts'
import { buildDialogState } from '../../brain/pipeline/dialogState.ts'
import { resolveStandalone } from '../../brain/pipeline/dialogResolve.ts'
import { planAnswer } from '../../brain/pipeline/dialogPlan.ts'
import { selfCheck } from '../../brain/pipeline/dialogCheck.ts'
import type { AnswerPlan, StandaloneQuery } from '../../brain/pipeline/dialogTypes.ts'
import { R1 } from '../../brain/pipeline/ownerRule.ts'
import { StreamGate, wordCount } from '../../brain/pipeline/postcheck.ts'
import type { StudentSnapshot } from '../../brain/student/model.ts'
import { buildUserTurn, PERSONA, questionOf } from '../../brain/persona/systemPrompt.ts'
import { uzToRuTerms } from '../../brain/persona/uzGlossary.ts'

const kb = new Knowledge().load()
setElementWords(kb.qa.elements.flatMap((e) => [e.s, e.ru, e.en, e.uz]))

let pass = 0
let fail = 0
function ok(cond: boolean, name: string, detail = ''): void {
  if (cond) pass++
  else fail++
  console.log(`${cond ? '  ok ' : '  FAIL'}  ${name}${!cond && detail ? ` — ${detail}` : ''}`)
}

const ctx = { gradeId: 'g8', mode: 'chat' as const, detail: 'brief' as const }

/** История: чередование user/assistant, последняя — реплика ученика. */
function msgs(...xs: string[]): ChatMessage[] {
  return xs.map((content, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content }))
}

type Case = { name: string; m: ChatMessage[]; lang: 'ru' | 'uz' | 'en'; text?: RegExp; notText?: RegExp; followUp?: string; topic?: string | null; entity?: string; grade?: string; len?: string }

const A_VAL = 'Валентность — способность атома образовывать определённое число химических связей. У кислорода валентность II, поэтому вода — H₂O. Хотите задачу на валентность?'
const A_NA = 'Натрий (Na) — щелочной металл, элемент №11. Он бурно реагирует с водой: 2Na + 2H₂O → 2NaOH + H₂↑. Хотите увидеть опыт?'
const A_UZ = 'Valentlik — atomning maʼlum sondagi kimyoviy bogʻ hosil qilish qobiliyati. Kislorodning valentligi II. Masala yechamizmi?'
const A_EN = 'Valence is the number of chemical bonds an atom can form. Oxygen has a valence of two, so water is H₂O. Shall we try a problem?'

const CASES: Case[] = [
  { name: 'ru: а у натрия? → валентность у натрия', m: msgs('Какая валентность у кислорода?', A_VAL, 'а у натрия?'), lang: 'ru', text: /валентность у натрия/i, followUp: 'switch_entity', topic: 'валентность', entity: 'Натрий' },
  { name: 'ru: а у серы? → валентность у серы', m: msgs('Какая валентность у кислорода?', A_VAL, 'А у серы?'), lang: 'ru', text: /валентность у серы/i, followUp: 'switch_entity' },
  { name: 'ru: а почему? → причина по ответу', m: msgs('Что такое валентность?', A_VAL, 'а почему?'), lang: 'ru', text: /^Почему: Валентность — способность/, followUp: 'why', topic: 'валентность' },
  { name: 'ru: объясни проще → тема', m: msgs('Что такое валентность?', A_VAL, 'объясни проще'), lang: 'ru', text: /^Объясни проще: валентность$/, followUp: 'simpler', len: 'short' },
  { name: 'ru: не понял → проще', m: msgs('Что такое валентность?', A_VAL, 'не понял'), lang: 'ru', followUp: 'simpler' },
  { name: 'ru: приведи пример', m: msgs('Что такое валентность?', A_VAL, 'приведи пример'), lang: 'ru', text: /^Приведи пример: валентность$/, followUp: 'example', len: 'short' },
  { name: 'ru: подробнее → long', m: msgs('Что такое валентность?', A_VAL, 'расскажи подробнее'), lang: 'ru', text: /подробнее: валентность/, followUp: 'more', len: 'long' },
  { name: 'ru: повтори → прежний вопрос', m: msgs('Что такое валентность?', A_VAL, 'повтори'), lang: 'ru', text: /^Что такое валентность\?$/, followUp: 'repeat' },
  { name: 'ru: а в 8 классе как это объясняют? → класс 8', m: msgs('Что такое валентность?', A_VAL, 'а в 8 классе как это объясняют?'), lang: 'ru', text: /валентность/i, followUp: 'switch_grade', grade: 'g8' },
  { name: 'ru: «да» после «Хотите задачу?» → confirm', m: msgs('Что такое валентность?', A_VAL, 'да'), lang: 'ru', text: /^Да: хотите задачу на валентность/, followUp: 'confirm' },
  { name: 'ru: а почему он так реагирует? → натрий', m: msgs('Что будет, если натрий бросить в воду?', A_NA, 'а почему он так бурно реагирует?'), lang: 'ru', text: /натрий/i, followUp: 'deictic' },
  { name: 'ru: а как его получить? → натрий', m: msgs('Расскажи про натрий', A_NA, 'а как его получить?'), lang: 'ru', text: /натрий/i, followUp: 'deictic' },
  { name: 'ru: а где применяется? → натрий', m: msgs('Расскажи про натрий', A_NA, 'а где применяется?'), lang: 'ru', text: /натрий/i, followUp: 'deictic' },
  { name: 'ru: новый полный вопрос — без изменений', m: msgs('Что такое валентность?', A_VAL, 'Что такое моль?'), lang: 'ru', text: /^Что такое моль\?$/, followUp: 'none' },
  { name: 'ru: «а что такое моль?» — новый вопрос', m: msgs('Что такое валентность?', A_VAL, 'а что такое моль?'), lang: 'ru', followUp: 'none' },
  { name: 'ru: сайт уже переписал — «объясни проще валентность» без изменений', m: msgs('Что такое валентность?', A_VAL, 'объясни проще валентность'), lang: 'ru', text: /^объясни проще валентность$/, followUp: 'none', len: 'short' },
  { name: 'ru: «кратко» → short', m: msgs('Что такое электролиз? Кратко'), lang: 'ru', followUp: 'none', len: 'short' },
  { name: 'ru: «подробно» → long', m: msgs('Объясни подробно, что такое гидролиз солей'), lang: 'ru', len: 'long' },
  { name: 'ru: первый вопрос — без изменений', m: msgs('Почему натрий хранят под керосином?'), lang: 'ru', text: /^Почему натрий хранят под керосином\?$/, followUp: 'none' },
  { name: 'ru: «а степень окисления?» → понятие в той же постановке', m: msgs('Какая валентность у натрия?', 'У натрия валентность I.', 'а степень окисления?'), lang: 'ru', text: /степень окисления у натрия/i, followUp: 'switch_entity', topic: 'степень окисления' },
  { name: 'ru: формула: а у H2SO4?', m: msgs('Какая молярная масса у HCl?', 'M(HCl) = 36,46 г/моль.', 'а у H2SO4?'), lang: 'ru', text: /H2SO4|H₂SO₄/, followUp: 'switch_entity' },
  { name: 'uz: natriy-chi? → valentlik natriy', m: msgs('Kislorodning valentligi qanday?', A_UZ, 'natriy-chi?'), lang: 'uz', text: /natriy/i, followUp: 'switch_entity', topic: 'валентность' },
  { name: 'uz: nega? → sabab', m: msgs('Valentlik nima?', A_UZ, 'nega?'), lang: 'uz', text: /^Nega: Valentlik/, followUp: 'why' },
  { name: 'uz: soddaroq → valentlik', m: msgs('Valentlik nima?', A_UZ, 'soddaroq tushuntir'), lang: 'uz', text: /^Valentlikni soddaroq tushuntiring$/, followUp: 'simpler', topic: 'валентность' },
  { name: 'uz: misol → valentlik', m: msgs('Valentlik nima?', A_UZ, 'misol keltir'), lang: 'uz', text: /^Valentlikka misol keltiring$/, followUp: 'example' },
  { name: 'uz: ha → confirm', m: msgs('Valentlik nima?', A_UZ, 'ha'), lang: 'uz', text: /^Ha: masala yechamizmi/, followUp: 'confirm' },
  { name: 'uz: 8-sinfda-chi? → switch_grade', m: msgs('Valentlik nima?', A_UZ, '8-sinfda qanday tushuntiriladi?'), lang: 'uz', followUp: 'switch_grade', grade: 'g8' },
  { name: 'en: and for sodium? → valence of sodium', m: msgs('What is the valence of oxygen?', A_EN, 'and for sodium?'), lang: 'en', text: /sodium/i, followUp: 'switch_entity', topic: 'валентность' },
  { name: 'en: why? → reason', m: msgs('What is valence?', A_EN, 'why?'), lang: 'en', text: /^Why: Valence is/, followUp: 'why' },
  { name: 'en: simpler please', m: msgs('What is valence?', A_EN, 'simpler please'), lang: 'en', text: /^Explain more simply: valence$/, followUp: 'simpler' },
  { name: 'en: give an example', m: msgs('What is valence?', A_EN, 'give an example'), lang: 'en', text: /^Give an example: valence$/, followUp: 'example' },
  { name: 'en: yes → confirm', m: msgs('What is valence?', A_EN, 'yes'), lang: 'en', text: /^Yes: shall we try a problem/, followUp: 'confirm' },
  { name: 'en: in grade 8? → switch_grade', m: msgs('What is valence?', A_EN, 'and in grade 8?'), lang: 'en', followUp: 'switch_grade', grade: 'g8' },
  { name: 'en: explain it like for grade 7 → switch_grade', m: msgs('What is a mole?', 'A mole is the amount of substance.', 'explain it like for grade 7'), lang: 'en', followUp: 'switch_grade', grade: 'g7' },
  // партнёр по предлогу и обстоятельство места
  { name: 'ru: «а с медью?» → меняется партнёр', m: msgs('Серная кислота реагирует с цинком?', 'Да: Zn + H₂SO₄ → ZnSO₄ + H₂↑.', 'а с медью?'), lang: 'ru', text: /^Серная кислота реагирует с медью\?$/, followUp: 'switch_entity' },
  { name: 'ru: «а соляная кислота?» → меняется предмет', m: msgs('Серная кислота реагирует с цинком?', 'Да: Zn + H₂SO₄ → ZnSO₄ + H₂↑.', 'а соляная кислота?'), lang: 'ru', text: /^Соляная кислота реагирует с цинком\?$/, followUp: 'switch_entity' },
  { name: 'en: and with copper? → партнёр', m: msgs('Does sulfuric acid react with zinc?', 'Yes: Zn + H₂SO₄ → ZnSO₄ + H₂↑.', 'and with copper?'), lang: 'en', text: /^Does sulfuric acid react with copper\?$/, followUp: 'switch_entity' },
  { name: 'ru: «а в промышленности?» → то же получение', m: msgs('Как получить кислород в лаборатории?', 'Разложением KMnO₄ при нагревании.', 'а в промышленности?'), lang: 'ru', text: /^Как получают кислород в промышленности\?$/, followUp: 'deictic' },
  { name: 'uz: sanoatda-chi? → то же получение', m: msgs('Kislorod laboratoriyada qanday olinadi?', 'KMnO₄ parchalanishi bilan.', 'sanoatda-chi?'), lang: 'uz', text: /^Kislorod sanoatda qanday olinadi\?$/, followUp: 'deictic' },
]

console.log('самодостаточный вопрос (resolveStandalone):')
for (const c of CASES) {
  const t0 = performance.now()
  const state = buildDialogState(c.m, ctx, kb)
  const last = c.m[c.m.length - 1]!.content
  const sq = resolveStandalone(last, state, { lang: c.lang, cmp: cmpForm(last), kb, gradeId: ctx.gradeId })
  const ms = performance.now() - t0
  const bad: string[] = []
  if (c.text && !c.text.test(sq.text)) bad.push(`text «${sq.text}»`)
  if (c.notText && c.notText.test(sq.text)) bad.push(`text «${sq.text}»`)
  if (c.followUp && sq.followUp !== c.followUp) bad.push(`followUp ${sq.followUp}`)
  if (c.topic !== undefined && sq.topic !== c.topic) bad.push(`topic ${sq.topic}`)
  if (c.entity && !sq.entities.includes(c.entity)) bad.push(`entities ${JSON.stringify(sq.entities)}`)
  if (c.grade && sq.grade !== c.grade) bad.push(`grade ${sq.grade}`)
  if (c.len && sq.lengthClass !== c.len) bad.push(`len ${sq.lengthClass}`)
  ok(!bad.length, c.name, `${bad.join('; ')} [state topic=${state.topic} ents=${JSON.stringify(state.entities)} last=${state.lastStandalone}] (${ms.toFixed(1)} мс)`)
}

console.log('узбекский словарь:')
ok(uzToRuTerms('Kovalent bogʻ nima?')[0] === 'ковалентная связь', 'kovalent bogʻ → ковалентная связь', JSON.stringify(uzToRuTerms('Kovalent bogʻ nima?')))
ok(uzToRuTerms("oksidlanish darajasini qanday topamiz")[0] === 'степень окисления', 'oksidlanish darajasini → степень окисления', JSON.stringify(uzToRuTerms('oksidlanish darajasini qanday topamiz')))
ok(uzToRuTerms('valentlikni tushuntir').includes('валентность'), 'valentlikni → валентность')

// ——— план ответа
console.log('план ответа (planAnswer):')
const snap0 = { levelInt: 3, mood: 'neutral', pace: 'normal', recentErrors: [] } as unknown as StudentSnapshot
const st0 = buildDialogState(msgs('Что такое валентность?', A_VAL, 'а почему?'), ctx, kb)
const sqOf = (over: Partial<StandaloneQuery>): StandaloneQuery => ({ text: 'Что такое моль?', lang: 'ru', topic: 'моль', entities: [], grade: 'g8', scope: 'school', kind: 'definition', lengthClass: 'short', followUp: 'none', resolvedBy: 'none', original: 'Что такое моль?', ...over })
type PlanCase = { name: string; sq: Partial<StandaloneQuery>; mode?: 'chat' | 'live'; detail?: 'brief' | 'more'; profile?: 'laptop' | 'gpu'; lc?: string; check?: (p: AnswerPlan) => boolean }
const PLANS: PlanCase[] = [
  { name: 'definition + school → short', sq: {}, lc: 'short' },
  { name: 'definition + detail more → normal', sq: {}, detail: 'more', lc: 'normal' },
  { name: 'why + school → normal', sq: { kind: 'why' }, lc: 'normal' },
  { name: 'broad → normal, more → long', sq: { kind: 'general', scope: 'broad' }, detail: 'more', lc: 'long' },
  { name: 'chitchat → tiny', sq: { kind: 'chitchat' }, lc: 'tiny' },
  { name: '«кратко» в реплике → short даже при more', sq: { kind: 'why', original: 'Почему небо голубое? Кратко' }, detail: 'more', lc: 'short' },
  { name: '«подробно» → long', sq: { kind: 'definition', original: 'Объясни подробно, что такое моль' }, lc: 'long' },
  { name: 'calc → без минимума слов', sq: { kind: 'calc' }, check: (p) => p.words[0] === 0 },
  { name: 'live → ≤ 70 слов, без блока ДИАЛОГ', sq: { kind: 'why', followUp: 'why' }, mode: 'live', check: (p) => p.words[1] <= 70 && !p.dialogBlock },
  { name: 'laptop: история 2, знания 600, без проверки', sq: { kind: 'why' }, check: (p) => p.useHistory === 2 && p.knowledgeChars === 600 && !p.verify },
  { name: 'gpu: история 8, знания 2400, проверка why', sq: { kind: 'why' }, profile: 'gpu', check: (p) => p.useHistory === 8 && p.knowledgeChars === 2400 && p.verify },
  { name: 'follow-up why → блок ДИАЛОГ ≤ 230 симв. с темой', sq: { kind: 'why', followUp: 'why', topic: 'валентность' }, check: (p) => p.dialogBlock.startsWith('ДИАЛОГ: тема — валентность') && p.dialogBlock.length <= 230 },
  { name: 'switch_grade → каркас «на уровне 8 класса»', sq: { kind: 'definition', followUp: 'switch_grade', grade: 'g8' }, check: (p) => /уровне 8 класса/.test(p.structure) },
]
for (const c of PLANS) {
  const p = planAnswer(sqOf(c.sq), st0, snap0, { mode: c.mode ?? 'chat', detail: c.detail ?? 'brief', profile: c.profile ?? 'laptop', config: DEFAULT_CONFIG })
  const good = (!c.lc || p.lengthClass === c.lc) && (!c.check || c.check(p))
  ok(good, c.name, `lengthClass ${p.lengthClass}, words ${p.words}, history ${p.useHistory}, verify ${p.verify}, block «${p.dialogBlock}» (${p.dialogBlock.length})`)
}

// ——— самопроверка
console.log('самопроверка (selfCheck):')
const planShort = planAnswer(sqOf({}), st0, snap0, { mode: 'chat', detail: 'brief', profile: 'laptop', config: DEFAULT_CONFIG })
{
  const r = selfCheck('Водород горит: 2H₂ + O₂ → H₂O. Это экзотермическая реакция, выделяется много тепла и образуется вода.', { sq: sqOf({ kind: 'general' }), tools: [], lang: 'ru', kb, plan: { ...planShort, words: [0, 200] } })
  ok(r.fixes.includes('equation') && /2H₂ \+ O₂ → 2H₂O/.test(r.text), 'неуравненное уравнение заменено уравненным', r.text)
}
{
  const r = selfCheck('Валентность показывает, сколько связей образует атом; у элементов первой группы она равна единице.', { sq: sqOf({ followUp: 'switch_entity', entities: ['Натрий'], topic: 'валентность' }), tools: [], lang: 'ru', kb, plan: { ...planShort, words: [0, 200] } })
  ok(r.fixes.includes('entity') && /Натрий \(Na\)/.test(r.text), 'новая сущность (натрий) дописана фактами', r.text)
}
{
  const r = selfCheck('Valentlik — natriyda bitta. Natriy oddiy sharoitda qattiq metall, uning xossalari yadro zaryadi bilan belgilanadi.', { sq: sqOf({ lang: 'uz', followUp: 'switch_entity', entities: ['Натрий'] }), tools: [], lang: 'uz', kb, plan: { ...planShort, words: [0, 200] } })
  ok(!r.fixes.includes('entity'), 'uz: «natriy» засчитан как упоминание натрия', r.fixes.join(','))
}
{
  const r = selfCheck("Bu jarayon o'zgarishsiz, mog'or emas.", { sq: sqOf({ lang: 'uz' }), tools: [], lang: 'uz', kb, plan: { ...planShort, words: [0, 200] } })
  ok(/oʻzgarishsiz/.test(r.text) && /mogʻor/.test(r.text) && r.fixes.includes('uz_apostrophe'), 'uz: апострофы o\'/g\' → oʻ/gʻ', r.text)
}
{
  const long = Array.from({ length: 30 }, (_, i) => `Предложение номер ${i + 1} про моль и число Авогадро.`).join(' ')
  const r = selfCheck(long, { sq: sqOf({}), tools: [], lang: 'ru', kb, plan: planShort })
  ok(r.fixes.includes('trim') && wordCount(r.text) <= Math.round(planShort.words[1] * 1.25), 'длиннее класса × 1,25 — обрезано по предложению', String(wordCount(r.text)))
}
{
  const r = selfCheck('Медь не реагирует с соляной кислотой. Медь реагирует с соляной кислотой бурно.', { sq: sqOf({ kind: 'general' }), tools: [], lang: 'ru', kb, plan: { ...planShort, words: [0, 200] } })
  ok(r.fixes.includes('contradiction'), '«не реагирует … реагирует» — пометка противоречия', r.fixes.join(','))
}

{
  const r = selfCheck('Валентность у натрия равна I: у атома один неспаренный elektron во внешнем слое, и он легко отдаёт этот электрон.', { sq: sqOf({ kind: 'general' }), tools: [], lang: 'ru', kb, plan: { ...planShort, words: [0, 200] } })
  ok(/неспаренный электрон/.test(r.text) && r.fixes.includes('ru_latin_term'), 'ru: латинский «elektron» → «электрон»', r.text)
}
{
  // старая Ollama не понимает think:false — рассуждения <think>…</think> не должны дойти до ученика
  let out = ''
  const gate = new StreamGate('ru', 200, (s) => (out += s))
  for (const tok of ['<thi', 'nk>Хм, ученик спрашивает про воду, ', 'подумаю…</th', 'ink>\n', 'Вода — оксид водорода H₂O. ', 'Она кипит при 100 °C.']) gate.push(tok)
  gate.end()
  ok(!/think|Хм|подумаю/.test(out) && /^Вода — оксид водорода H₂O\./.test(out), 'StreamGate вырезает <think>…</think>', JSON.stringify(out))
}

// ——— подсказка v3
console.log('подсказка v3 (buildUserTurn / questionOf):')
{
  const sq = sqOf({ text: 'Какая валентность у натрия?', original: 'а у натрия?', resolvedBy: 'rules', followUp: 'switch_entity', entities: ['Натрий'], topic: 'валентность' })
  const plan = planAnswer(sq, st0, snap0, { mode: 'chat', detail: 'brief', profile: 'laptop', config: DEFAULT_CONFIG })
  const turn = buildUserTurn({ lang: 'ru', mode: 'chat', detail: 'brief', gradeId: 'g8', knowledge: [], background: [], plan, standalone: sq, tools: [], studentBlock: '', reasoned: false, question: sq.text, maxItems: 3, maxChars: 600 })
  ok(questionOf(turn) === 'Какая валентность у натрия?', 'questionOf отрезает строку «реплика ученика дословно»', JSON.stringify(questionOf(turn)))
  ok(/реплика ученика дословно: «а у натрия\?»/.test(turn), 'оригинал реплики в подсказке')
  ok(/ФОРМАТ:\n40–90 слов, по-русски\./.test(turn), 'ФОРМАТ по классу длины', turn.slice(turn.indexOf('ФОРМАТ'), turn.indexOf('ФОРМАТ') + 60))
  ok(turn.indexOf('ДИАЛОГ:') > -1 && turn.indexOf('ДИАЛОГ:') < turn.indexOf('ВОПРОС УЧЕНИКА'), 'блок ДИАЛОГ перед вопросом')
  // слова — токены с буквами, без дословных фраз владельца R1/R2 (их длину задаёт контракт)
  const words = (s: string) => s.replace(R1, '').split(/\s+/).filter((w) => /\p{L}/u.test(w)).length
  ok(words(PERSONA.ru) <= 230 && words(PERSONA.uz) <= 230 && words(PERSONA.en) <= 230, 'персоны v3 ≤ 230 слов', `${words(PERSONA.ru)}/${words(PERSONA.uz)}/${words(PERSONA.en)} слов`)
  ok(PERSONA.ru.includes(R1) && PERSONA.uz.includes(R1) && PERSONA.en.includes(R1), 'R1 дословно во всех персонах')
  ok(PERSONA.ru.includes('Пожалуйста, выражайтесь корректно, использование ненормативной лексики в этом чате недопустимо.'), 'R2 дословно в персоне ru')
  ok(/Не говори «не знаю» и «нет в базе»/.test(PERSONA.ru), 'запрет «не знаю/нет в базе» в персоне')
}

// ——— многоходовые диалоги через runChat (mock-LLM и запасной путь)
console.log('диалоги через runChat (mock-LLM / без LLM):')
{
  const { runChat } = await import('../../brain/pipeline/chat.ts')
  const { MockLlm } = await import('../../brain/llm/mock.ts')
  const { Journal } = await import('../../brain/kb/journal.ts')
  const { StudentStore } = await import('../../brain/student/events.ts')
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  // пустой журнал во временной папке: проверка не трогает папку данных владельца
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atomlab-dialog-selftest-'))
  const journal = new Journal(path.join(tmp, 'kb-journal.jsonl'))
  const students = new StudentStore(tmp)
  const ask = async (m: ChatMessage[], llm: InstanceType<typeof MockLlm> | null, extra: Partial<ChatRequest['context']> = {}, lang: ChatRequest['lang'] = 'auto') => {
    let meta: MetaEvent | null = null
    let done: DoneEvent | null = null
    await runChat(
      { sessionId: 'dlg', studentId: 'dlg', lang, stream: true, messages: m, context: { ...ctx, ...extra } },
      { kb, journal, embeds: null, llm, students, config: DEFAULT_CONFIG, noJournal: true },
      { meta: (x) => (meta = x), delta: () => {}, done: (d) => (done = d), error: () => {} },
    )
    return { meta: meta as MetaEvent | null, done: done as DoneEvent | null }
  }
  const mock = new MockLlm()
  for (const [name, llm] of [['mock', mock], ['без LLM', null]] as const) {
    const a = await ask(msgs('Какая валентность у кислорода?', A_VAL, 'а у натрия?'), llm)
    ok(a.meta?.followUp === 'switch_entity' && /валентность у натрия/i.test(a.meta?.standalone ?? '') && /натри/i.test(a.done?.text ?? ''), `${name}: «а у натрия?» — ответ про натрий`, `${a.meta?.standalone} | ${a.done?.text.slice(0, 120)}`)
    const b = await ask(msgs('Что такое валентность?', A_VAL, 'объясни проще'), llm)
    ok(b.meta?.followUp === 'simpler' && b.meta?.lengthClass === 'short' && /валентн/i.test(b.done?.text ?? ''), `${name}: «объясни проще» — коротко про валентность`, `${b.meta?.lengthClass} | ${b.done?.text.slice(0, 160)}`)
    const c = await ask(msgs('Valentlik nima?', A_UZ, 'soddaroq tushuntir'), llm)
    ok(c.meta?.lang === 'uz' && c.meta?.followUp === 'simpler' && !/[а-яё]/i.test(c.done?.text ?? ''), `${name}: uz «soddaroq» — по-узбекски`, c.done?.text.slice(0, 160))
    const d = await ask(msgs('What is the valence of oxygen?', A_EN, 'and for sodium?'), llm)
    ok(d.meta?.followUp === 'switch_entity' && /sodium|natri|Na\b/i.test(d.done?.text ?? ''), `${name}: en «and for sodium?» — про натрий`, d.done?.text.slice(0, 160))
    const e = await ask(msgs('Что такое валентность?', A_VAL, 'да'), llm)
    ok(e.meta?.followUp === 'confirm' && e.meta?.intent !== 'smalltalk', `${name}: «да» после «Хотите задачу?» — не светская беседа`, `${e.meta?.intent} ${e.meta?.standalone}`)
    const f = await ask(msgs('Что такое органическая химия?', 'Органическая химия изучает соединения углерода.', 'а чем она отличается от неорганической?'), llm)
    ok(f.done?.text === R1, `${name}: R1 по переписанному вопросу`, f.done?.text.slice(0, 120))
    ok((a.done?.citations ?? []).every((x) => !/Википедия/.test(x)), `${name}: школьный ответ не цитирует энциклопедию`, JSON.stringify(a.done?.citations))
    // язык разговора «липкий»: сайт для латиницы без признаков шлёт 'en' — узбекский разговор остаётся узбекским
    const g = await ask(msgs('Valentlik nima?', A_UZ, 'natriyniki-chi?'), llm, {}, 'en')
    ok(g.meta?.lang === 'uz' && !/(the|what|is|of)/i.test(g.done?.text ?? ''), `${name}: uz «natriyniki-chi?» при lang=en — по-узбекски`, `${g.meta?.lang} ${g.meta?.standalone} | ${g.done?.text.slice(0, 120)}`)
    const h = await ask(msgs('Что такое валентность?', A_VAL, 'ok'), llm)
    ok(h.meta?.lang === 'ru' && /[а-яё]/i.test(h.done?.text ?? ''), `${name}: «ok» латиницей в русском разговоре — по-русски`, `${h.meta?.lang} | ${h.done?.text.slice(0, 120)}`)
    const i = await ask(msgs('а почему?'), llm)
    ok(i.meta?.followUp === 'why' && /уточн/i.test(i.done?.text ?? ''), `${name}: «а почему?» без темы — уточняющий вопрос`, `${i.meta?.followUp} | ${i.done?.text.slice(0, 120)}`)
  }
  fs.rmSync(tmp, { recursive: true, force: true })
}

console.log(`
[dialog.selftest] прошло ${pass}, провалов ${fail}`)
process.exitCode = fail ? 1 : 0
