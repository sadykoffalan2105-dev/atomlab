/**
 * Многоходовые сценарии диалогового менеджера учителя (RU/EN/UZ):
 * викторина (верно / частично / неверно / «не знаю» / «хватит», счёт), три ошибки подряд →
 * предложение разобрать тему, поддержка + выбор шага, обучение учителя в моменте
 * (стиль, слабые темы, имя), домашка по шагам и «покажи решение» из данных,
 * продолжения «а почему?» / «а он?» с темой из стека. Проверяем: намерения, счёт,
 * профиль, отсутствие одинаковых реплик учителя подряд.
 *
 *   npm run test:teacher-dialog-flow
 */
import { dialogStep, dialogSnapshot, setDialogRandom, type DialogInput, type DialogResult } from '../src/learn/brain/dialog/index.ts'
import { resetDialog, setDialogBackend } from '../src/learn/brain/dialog/dialogState.ts'
import { loadProfile, setMemoryProfileBackend, forgetEverything } from '../src/learn/brain/human/studentProfile.ts'
import { loadOralPool, type GradeOralItem } from '../src/learn/brain/dualMode/gradeOralPools.ts'

setMemoryProfileBackend()
setDialogBackend('memory')
let seed = 11
setDialogRandom(() => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
})

type Lang = 'ru' | 'en' | 'uz'
const failures: string[] = []
let steps = 0
let lastTeacher = ''
const teacherLines: string[] = []

const pools = new Map<string, GradeOralItem>()
for (const [g, c, s] of [
  ['g7', 'c1', undefined],
  ['g7', 'c2', undefined],
  ['g8', 'c1', 's04'],
  ['g8', 'c2', undefined],
  ['g9', 'c1', undefined],
  ['g10', 'c1', undefined],
  ['g11', 'c1', undefined],
] as const) {
  for (const it of await loadOralPool(g, c, s)) {
    for (const q of [it.questionSpeak, it.questionSpeakEn, it.questionSpeakUz]) if (q) pools.set(q.trim(), it)
  }
}

function itemFor(text: string): GradeOralItem | null {
  for (const [q, it] of pools) if (text.includes(q)) return it
  return null
}

function sampleOf(it: GradeOralItem, lang: Lang): string {
  const s = lang === 'en' ? it.sampleAnswerEn : lang === 'uz' ? (it.sampleAnswerUz ?? it.sampleAnswerEn) : undefined
  return (s ?? it.sampleAnswer ?? it.rubric.join(' ')).trim()
}

function rubricOf(it: GradeOralItem, lang: Lang): readonly string[] {
  const r = lang === 'en' ? it.rubricEn : lang === 'uz' ? (it.rubricUz ?? it.rubricEn) : undefined
  return r?.length ? r : it.rubric
}

async function step(
  name: string,
  say: string,
  input: DialogInput,
  expect: { intent?: string | null; has?: (string | RegExp)[]; not?: (string | RegExp)[]; rewrite?: RegExp; check?: (r: DialogResult | null) => string | null },
): Promise<DialogResult | null> {
  steps++
  let r: DialogResult | null = null
  try {
    r = await dialogStep(say, input)
  } catch (e) {
    failures.push(`${name}: исключение ${(e as Error).message}`)
    return null
  }
  const text = r?.text ?? ''
  const tag = `${name} («${say}»)`
  if (expect.intent === null && r !== null && !r.rewrite) failures.push(`${tag}: ожидали null, получили ${r.intent}: ${text.slice(0, 80)}`)
  if (expect.intent && r?.intent !== expect.intent) failures.push(`${tag}: ожидали ${expect.intent}, получили ${r?.intent ?? 'null'}: ${text.slice(0, 100)}`)
  for (const h of expect.has ?? []) {
    const ok = typeof h === 'string' ? text.includes(h) : h.test(text)
    if (!ok) failures.push(`${tag}: нет «${h}» в: ${text.slice(0, 160)}`)
  }
  for (const n of expect.not ?? []) {
    const bad = typeof n === 'string' ? text.includes(n) : n.test(text)
    if (bad) failures.push(`${tag}: лишнее «${n}» в: ${text.slice(0, 160)}`)
  }
  if (expect.rewrite && !(r?.rewrite && expect.rewrite.test(r.rewrite))) failures.push(`${tag}: ожидали rewrite ${expect.rewrite}, получили ${r?.rewrite ?? 'нет'}`)
  if (expect.check) {
    const err = expect.check(r)
    if (err) failures.push(`${tag}: ${err}`)
  }
  if (text) {
    if (text === lastTeacher) failures.push(`${tag}: учитель повторил реплику дословно`)
    const head = text.slice(0, 20)
    if (lastTeacher && head === lastTeacher.slice(0, 20)) failures.push(`${tag}: одинаковое начало реплики подряд: «${head}»`)
    lastTeacher = text
    teacherLines.push(text)
  }
  return r
}

const ru7: DialogInput = { lang: 'ru', grade: 'g7', chapterId: 'c1', sectionTitle: 'Чистые вещества и смеси', messages: [] }
const ru8: DialogInput = { lang: 'ru', grade: 'g8', chapterId: 'c1', sectionId: 's04', sectionTitle: 'Основания', messages: [] }
const en9: DialogInput = { lang: 'en', grade: 'g9', chapterId: 'c1', messages: [] }
const uz8: DialogInput = { lang: 'uz', grade: 'g8', chapterId: 'c1', messages: [] }

const fromBank = (r: DialogResult | null) => (itemFor(r?.text ?? '') ? null : 'вопрос не из банка')
const scoreIs = (c: number, p: number, w: number) => (r: DialogResult | null) =>
  r?.score && r.score.correct === c && r.score.partial === p && r.score.wrong === w ? null : `счёт ${JSON.stringify(r?.score)} ≠ ${c}/${p}/${w}`

/* ============================== RU: викторина 8 класс ============================== */
let r = await step('quiz-start', 'проверь меня', ru8, { intent: 'quiz_start', check: fromBank })
let it = itemFor(r?.text ?? '')
if (!it) failures.push('quiz-start: вопрос не из банка')
if (dialogSnapshot().mode !== 'quiz') failures.push('quiz-start: режим не quiz')

r = await step('quiz-correct', it ? sampleOf(it, 'ru') : 'основания', ru8, { intent: 'quiz_correct', has: [/Ещё|Продолжим|Дальше|Готов/], check: scoreIs(1, 0, 0) })
r = await step('quiz-next', 'да', ru8, { intent: 'quiz_question', check: fromBank })
it = itemFor(r?.text ?? '')
const rub = it ? rubricOf(it, 'ru') : []
r = await step('quiz-partial', rub[0] ?? 'металл', ru8, {
  intent: rub.length >= 2 ? 'quiz_partial' : 'quiz_correct',
  has: rub.length >= 2 ? [/упустил|Не хватает|добавь|Ещё важно/] : [],
  check: rub.length >= 2 ? scoreIs(1, 1, 0) : scoreIs(2, 0, 0),
})
const partialCount = rub.length >= 2 ? 1 : 0
const correctCount = rub.length >= 2 ? 1 : 2
r = await step('quiz-next-2', 'ещё', ru8, { intent: 'quiz_question', check: fromBank })
it = itemFor(r?.text ?? '')
r = await step('quiz-hint', 'не знаю', ru8, { intent: 'quiz_hint', has: [/Подсказка|Наводка|Начало ответа/] })
r = await step('quiz-wrong-after-hint', 'не знаю', ru8, {
  intent: 'quiz_wrong',
  has: it ? [sampleOf(it, 'ru').slice(0, 20)] : [],
  check: scoreIs(correctCount, partialCount, 1),
})
r = await step('quiz-next-3', 'дальше', ru8, { intent: 'quiz_question', check: fromBank })
r = await step('quiz-wrong', 'фиолетовый бегемот на велосипеде', ru8, { intent: 'quiz_wrong', has: [/Не совсем|Пока нет|Нет, смотри|Ошибка/], check: scoreIs(correctCount, partialCount, 2) })
r = await step('quiz-stop', 'хватит', ru8, {
  intent: 'quiz_summary',
  has: [new RegExp(`${correctCount} из 4`), /повторить|На повторение|Загляни/],
})
if (dialogSnapshot().mode !== 'chat') failures.push('quiz-stop: режим не вернулся в chat')

/* ============================== RU: три ошибки подряд → разбор темы ============================== */
r = await step('review-start', 'задай вопрос', ru7, { intent: 'quiz_start', check: fromBank })
r = await step('review-wrong-1', 'синий трактор', ru7, { intent: 'quiz_wrong' })
r = await step('review-next-1', 'да', ru7, { intent: 'quiz_question' })
r = await step('review-wrong-2', 'зелёный самолёт', ru7, { intent: 'quiz_wrong' })
r = await step('review-next-2', 'давай', ru7, { intent: 'quiz_question' })
r = await step('review-wrong-3', 'красный пароход', ru7, { intent: 'quiz_review', has: [/разбер|разобрать/] })
if (dialogSnapshot().mode !== 'chat') failures.push('review: после предложения разбора режим не chat')

/* ============================== RU: продолжения с темой из стека ============================== */
r = await step('topic-question', 'что такое оксиды?', { ...ru8, messages: [{ role: 'user', content: 'что такое оксиды?' }] }, { intent: null })
if (!dialogSnapshot().topics.some((t) => /оксид/i.test(t))) failures.push(`topic-question: тема не запомнена: ${dialogSnapshot().topics.join('|')}`)
r = await step('why-no-history', 'а почему?', { ...ru8, messages: [{ role: 'user', content: 'а почему?' }] }, { rewrite: /почему.*оксид/i })
r = await step('why-with-history', 'а почему?', { ...ru8, messages: [{ role: 'user', content: 'что такое оксиды?' }, { role: 'assistant', content: '…' }, { role: 'user', content: 'а почему?' }] }, { intent: null })
r = await step('deictic', 'а он?', { ...ru8, messages: [{ role: 'user', content: 'а он?' }] }, { rewrite: /оксид/i })
r = await step('simpler-no-history', 'проще', { ...ru8, messages: [{ role: 'user', content: 'проще' }] }, { rewrite: /проще.*оксид/i })

/* ============================== RU: поддержка и выбор шага ============================== */
r = await step('support-confused', 'я ничего не понимаю', ru8, { intent: 'support', has: [/проще/i] })
if (loadProfile().mood !== 'confused') failures.push(`support-confused: mood=${loadProfile().mood}`)
r = await step('offer-simpler', 'проще', ru8, { rewrite: /проще.*оксид/i })
r = await step('support-tired', 'я устал', ru8, { intent: 'support' })
if (loadProfile().mood !== 'tired') failures.push(`support-tired: mood=${loadProfile().mood}`)
r = await step('offer-quiz', 'викторина', ru8, { intent: 'quiz_start', check: fromBank })
for (let i = 1; i <= 3; i++) {
  it = itemFor(r?.text ?? '')
  const last = i === 3
  r = await step(`mini-quiz-${i}`, it ? sampleOf(it, 'ru') : 'основания', ru8, { intent: last ? 'quiz_summary' : 'quiz_correct', has: last ? [/3 из 3/, /Ни одной ошибки|Всё верно|без ошибок/] : [] })
  if (!last) r = await step(`mini-quiz-next-${i}`, 'да', ru8, { intent: 'quiz_question' })
}
r = await step('support-down', 'я тупой', ru8, { intent: 'support', has: [/неправильное слово|Не говори так|не про способности|это главное|маленькую победу/] })
r = await step('support-scared', 'боюсь контрольной', ru8, { intent: 'support', has: [/план|контрольн|тревог|рядом/i] })
if (loadProfile().mood !== 'scared') failures.push(`support-scared: mood=${loadProfile().mood}`)
r = await step('support-bored', 'мне скучно', ru8, { intent: 'support' })
r = await step('support-easy', 'это слишком легко', ru8, { intent: 'support', has: [/сложн|планк|быстрее|задач/i] })
r = await step('support-question-passes', 'не понимаю, что такое моль?', ru8, { intent: null })

/* ============================== RU: обучение учителя в моменте ============================== */
r = await step('teach-brief', 'запомни, мне нравится когда коротко', ru8, { intent: 'teach_style', has: [/короч|кратк|коротко/i] })
if (loadProfile().detail !== -2) failures.push(`teach-brief: detail=${loadProfile().detail}`)
r = await step('teach-weak', 'мне сложно с ОВР', ru8, { intent: 'teach_weak', has: ['ОВР'] })
if (!loadProfile().weakTopics.includes('ОВР')) failures.push(`teach-weak: weakTopics=${loadProfile().weakTopics.join('|')}`)
r = await step('teach-name', 'называй меня Алишер', ru8, { intent: 'teach_name', has: ['Алишер'] })
if (loadProfile().name !== 'Алишер') failures.push(`teach-name: name=${loadProfile().name}`)
r = await step('teach-more', 'отвечай подробнее, пожалуйста', ru8, { intent: 'teach_style' })
if (loadProfile().detail !== 2) failures.push(`teach-more: detail=${loadProfile().detail}`)
r = await step('teach-examples', 'объясняй на примерах', ru8, { intent: 'teach_style', has: [/пример/i] })
if (loadProfile().examples !== 2) failures.push(`teach-examples: examples=${loadProfile().examples}`)

/* ============================== RU: домашка ============================== */
r = await step('hw-start', 'помоги с домашкой', ru8, { intent: 'homework_start', has: [/условие/i] })
if (dialogSnapshot().mode !== 'homework') failures.push('hw-start: режим не homework')
r = await step('hw-problem', 'Найти количество вещества в 36 г воды H2O', ru8, { intent: 'homework_step', has: [/Шаг 1/] })
r = await step('hw-step2', 'дано масса 36 г, найти количество вещества', ru8, { intent: 'homework_step', has: [/Шаг 2/, /n = m \/ M/] })
r = await step('hw-step3', 'n = m/M', ru8, { intent: 'homework_step', has: [/Шаг 3/] })
r = await step('hw-reveal', 'покажи решение', ru8, { intent: 'homework_reveal', has: [/M\(H₂O\) = 18/, /= 1,998 моль|= 2 моль/] })
if (dialogSnapshot().mode !== 'chat') failures.push('hw-reveal: режим не chat')
r = await step('hw-start-2', 'помоги с задачей № 5', ru8, { intent: 'homework_start' })
r = await step('hw-exit', 'хватит', ru8, { intent: 'homework_exit' })
if (dialogSnapshot().mode !== 'chat') failures.push('hw-exit: режим не chat')
r = await step('hw-reveal-without-problem', 'помоги с задачей', ru8, { intent: 'homework_start' })
r = await step('hw-reveal-no-data', 'покажи решение', ru8, { intent: 'homework_reveal', has: [/не выдумываю/] })
r = await step('hw-exit-2', 'стоп', ru8, { intent: 'homework_exit' })

/* ============================== EN ============================== */
r = await step('en-quiz-start', 'quiz me', en9, { intent: 'quiz_start', check: fromBank, not: [/[А-Яа-я]{4,}/] })
it = itemFor(r?.text ?? '')
if (!it) failures.push('en-quiz-start: вопрос не из банка')
r = await step('en-quiz-correct', it ? sampleOf(it, 'en') : 'acid', en9, { intent: 'quiz_correct', check: scoreIs(1, 0, 0) })
r = await step('en-quiz-stop', 'stop', en9, { intent: 'quiz_summary', has: [/1 of 1/] })
r = await step('en-support', "I don't understand", en9, { intent: 'support', has: [/simpler/i], not: [/[А-Яа-я]/] })
r = await step('en-offer-quiz', 'quiz', en9, { intent: 'quiz_start', check: fromBank })
r = await step('en-dontknow', "I don't know", en9, { intent: 'quiz_hint', has: [/Hint|clue|begins/i] })
r = await step('en-enough', 'enough', en9, { intent: 'quiz_summary', has: [/0 of 0|Result|Summary|Done/] })
r = await step('en-hw-start', 'help me with my homework', en9, { intent: 'homework_start', not: [/[А-Яа-я]/] })
r = await step('en-hw-problem', 'find the amount of substance in 36 g of H2O', en9, { intent: 'homework_step', has: [/Step 1/] })
r = await step('en-hw-reveal', 'show me the solution', en9, { intent: 'homework_reveal', has: [/M\(H₂O\) = 18/, /1\.998 mol|2 mol/] })
r = await step('en-teach-weak', 'I struggle with redox reactions', en9, { intent: 'teach_weak', has: [/redox reactions/] })
r = await step('en-teach-brief', 'keep it short please', en9, { intent: 'teach_style', not: [/[А-Яа-я]/] })

/* ============================== UZ ============================== */
r = await step('uz-quiz-start', 'savol ber', uz8, { intent: 'quiz_start', check: fromBank })
r = await step('uz-hint', 'bilmayman', uz8, { intent: 'quiz_hint', has: [/Maslahat|Yoʻl-yoʻriq|Javob boshi/] })
r = await step('uz-wrong', 'bilmayman', uz8, { intent: 'quiz_wrong', check: scoreIs(0, 0, 1) })
r = await step('uz-stop', "bo'ldi", uz8, { intent: 'quiz_summary', has: [/1 tadan 0|Natija|Yakun|Hisob/] })
r = await step('uz-support', 'tushunmadim', uz8, { intent: 'support', has: [/soddaroq/i], not: [/[А-Яа-я]/] })
r = await step('uz-support-tired', 'charchadim', uz8, { intent: 'support', not: [/[А-Яа-я]/] })
r = await step('uz-hw-start', 'uy vazifasi bilan yordam ber', uz8, { intent: 'homework_start', not: [/[А-Яа-я]/] })
r = await step('uz-hw-exit', "to'xta", uz8, { intent: 'homework_exit' })
r = await step('uz-teach-brief', 'qisqa javob ber', uz8, { intent: 'teach_style', not: [/[А-Яа-я]/] })

/* ============================== обычные вопросы не перехватываются ============================== */
r = await step('plain-1', 'какая валентность у кислорода?', ru8, { intent: null })
r = await step('plain-2', 'почему вода кипит при 100 градусах?', ru8, { intent: null })
r = await step('plain-3', 'what is a mole?', en9, { intent: null })
r = await step('plain-4', 'реши задачу: найти массу 2 моль H2O', ru8, { intent: null })

/* ============================== состояние переживает перезагрузку модуля-кеша ============================== */
resetDialog()
forgetEverything()
r = await step('fresh-quiz', 'давай потренируемся', ru8, { intent: 'quiz_start' })
r = await step('fresh-stop', 'стоп', ru8, { intent: 'quiz_summary' })

/* ============================== итог ============================== */
const distinct = new Set(teacherLines).size
console.log(`шагов: ${steps}, реплик учителя: ${teacherLines.length}, уникальных: ${distinct}, вопросов в банках: ${pools.size}`)
if (failures.length) {
  console.log(`ОШИБКИ (${failures.length}):`)
  for (const f of failures) console.log(' - ' + f)
  process.exit(1)
}
console.log('OK: диалоговый менеджер — все сценарии пройдены')
