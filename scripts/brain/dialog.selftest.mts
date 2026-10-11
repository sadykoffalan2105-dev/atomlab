/**
 * npx tsx scripts/brain/dialog.selftest.mts — проверки мозга v2 (DIALOG) без Ollama и без папки данных:
 *   resolveStandalone на парах «история → реплика → ожидаемый standalone / followUp / класс длины»;
 *   planAnswer на комбинациях тип × охват × detail × профиль; selfCheck на текстах; questionOf на формате v3;
 *   runChat в процессе с mock-LLM на многоходовых диалогах ru/uz/en (meta.standalone, meta.followUp, длина).
 */
import { Knowledge } from '../../brain/kb/shards.ts'
import { DEFAULT_CONFIG } from '../../brain/config.ts'
import { setElementWords } from '../../brain/pipeline/normalize.ts'
import { cmpForm } from '../../brain/pipeline/normalize.ts'
import type { ChatMessage } from '../../brain/pipeline/chat.ts'
import { buildDialogState } from '../../brain/pipeline/dialogState.ts'
import { resolveStandalone } from '../../brain/pipeline/dialogResolve.ts'
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
  { name: 'uz: soddaroq → valentlik', m: msgs('Valentlik nima?', A_UZ, 'soddaroq tushuntir'), lang: 'uz', text: /^Soddaroq tushuntir: valentlik$/, followUp: 'simpler', topic: 'валентность' },
  { name: 'uz: misol → valentlik', m: msgs('Valentlik nima?', A_UZ, 'misol keltir'), lang: 'uz', text: /^Misol keltir: valentlik$/, followUp: 'example' },
  { name: 'uz: ha → confirm', m: msgs('Valentlik nima?', A_UZ, 'ha'), lang: 'uz', text: /^Ha: masala yechamizmi/, followUp: 'confirm' },
  { name: 'uz: 8-sinfda-chi? → switch_grade', m: msgs('Valentlik nima?', A_UZ, '8-sinfda qanday tushuntiriladi?'), lang: 'uz', followUp: 'switch_grade', grade: 'g8' },
  { name: 'en: and for sodium? → valence of sodium', m: msgs('What is the valence of oxygen?', A_EN, 'and for sodium?'), lang: 'en', text: /sodium/i, followUp: 'switch_entity', topic: 'валентность' },
  { name: 'en: why? → reason', m: msgs('What is valence?', A_EN, 'why?'), lang: 'en', text: /^Why: Valence is/, followUp: 'why' },
  { name: 'en: simpler please', m: msgs('What is valence?', A_EN, 'simpler please'), lang: 'en', text: /^Explain more simply: valence$/, followUp: 'simpler' },
  { name: 'en: give an example', m: msgs('What is valence?', A_EN, 'give an example'), lang: 'en', text: /^Give an example: valence$/, followUp: 'example' },
  { name: 'en: yes → confirm', m: msgs('What is valence?', A_EN, 'yes'), lang: 'en', text: /^Yes: shall we try a problem/, followUp: 'confirm' },
  { name: 'en: in grade 8? → switch_grade', m: msgs('What is valence?', A_EN, 'and in grade 8?'), lang: 'en', followUp: 'switch_grade', grade: 'g8' },
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

// @@REST@@

console.log(`
[dialog.selftest] прошло ${pass}, провалов ${fail}`)
process.exitCode = fail ? 1 : 0
