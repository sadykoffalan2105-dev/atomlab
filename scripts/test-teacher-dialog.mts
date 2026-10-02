/**
 * Диалоги с «человеческим» слоем ИИ-учителя (RU/EN/UZ): приветствия, small talk, эмоции,
 * вычисления, единицы, химия без книги, опечатки, смешанные фразы, «запомни», поправки,
 * контекст «а у него?». Проверяем: нет падений, намерения распознаны, ответы не повторяются
 * подряд, химические числа — из данных проекта, слова ученика не выдаются за проверенный факт.
 *
 *   npm run test:teacher-dialog
 */
import {
  humanTurn,
  setHumanClock,
  setHumanRandom,
  setMemoryProfileBackend,
  loadProfile,
  applyFeedback,
  preferredDetail,
  type HumanTurn,
} from '../src/learn/brain/human/index.ts'
import { molarMassOf } from '../src/learn/brain/human/chemFacts.ts'
import { ELEMENTS } from '../src/data/elements.ts'

setMemoryProfileBackend()
let seed = 7
setHumanRandom(() => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
})
setHumanClock(() => new Date(2026, 8, 30, 9, 15))

type Lang = 'ru' | 'en' | 'uz'
type Expect = string | 'null' | 'prefix'
interface Step {
  lang: Lang
  say: string
  expect: Expect
  /** Подстроки, которые должны быть в ответе (или в префиксе). */
  has?: (string | RegExp)[]
  /** Подстроки, которых быть не должно. */
  not?: (string | RegExp)[]
  check?: (t: HumanTurn | null) => string | null
}

const M = (f: string) => molarMassOf(f)!.total
const ru2 = (v: number) => v.toFixed(2).replace('.', ',')
const el = (sym: string) => ELEMENTS.find((e) => e.symbol === sym)!
/** Учитель не назначает лекарств — только отдых, вода, сказать взрослым. */
const NO_MEDS = /таблетк|лекарств|аспирин|парацетамол|ибупрофен|анальгин|антибиотик|выпей\s+(что-нибудь|средство)|\bpills?\b|medicine|painkiller|\btablets?\b|dori\s+ich|tabletka/i

const steps: Step[] = [
  // ---- приветствия и small talk (RU)
  { lang: 'ru', say: 'Привет!', expect: 'greet', has: [/Доброе утро|С добрым утром|Привет, доброе утро/] },
  { lang: 'ru', say: 'привте', expect: 'greet' },
  { lang: 'ru', say: 'Здраствуйте учитель', expect: 'greet' },
  { lang: 'ru', say: 'приииивет', expect: 'greet' },
  { lang: 'ru', say: 'как дела?', expect: 'howareyou' },
  { lang: 'ru', say: 'как у тебя дела', expect: 'howareyou' },
  { lang: 'ru', say: 'кто ты?', expect: 'whoareyou', not: ['Я — ИИ-помощник'] },
  { lang: 'ru', say: 'что ты умеешь?', expect: 'whatcanyou', has: [/молярн/] },
  { lang: 'ru', say: 'спасибо большое!', expect: 'thanks' },
  { lang: 'ru', say: 'спосибо', expect: 'thanks' },
  { lang: 'ru', say: 'извини', expect: 'sorry' },
  { lang: 'ru', say: 'ты классный учитель', expect: 'compliment' },
  { lang: 'ru', say: 'хахаха', expect: 'laugh' },
  { lang: 'ru', say: 'пошути', expect: 'joke' },
  { lang: 'ru', say: 'расскажи ещё шутку', expect: 'joke' },
  { lang: 'ru', say: 'расскажи интересный факт', expect: 'fact' },
  { lang: 'ru', say: 'удиви меня', expect: 'fact' },
  { lang: 'ru', say: 'который час?', expect: 'time', has: ['09:15'] },
  { lang: 'ru', say: 'какое сегодня число?', expect: 'date', has: ['30 сентября 2026', 'среда'] },
  { lang: 'ru', say: 'какая завтра погода?', expect: 'offline_world', has: [/интернет/] },
  // ---- эмоции
  { lang: 'ru', say: 'я устал', expect: 'emo_tired', has: [/перерыв|отдохни|пройдись/i] },
  { lang: 'ru', say: 'мне скучно', expect: 'emo_bored' },
  { lang: 'ru', say: 'боюсь завтрашней контрольной', expect: 'emo_scared' },
  { lang: 'ru', say: 'завтра контрольная, страшно', expect: 'emo_scared' },
  { lang: 'ru', say: 'я ничего не понимаю', expect: 'emo_confused' },
  { lang: 'ru', say: 'замотивируй меня', expect: 'motivation' },
  { lang: 'ru', say: 'грустно сегодня', expect: 'emo_sad' },
  // ---- вычисления и единицы
  { lang: 'ru', say: 'сколько будет 2+2*3', expect: 'arith', check: (t) => num(t) === 8 ? null : 'ожидалось 8' },
  { lang: 'ru', say: 'посчитай (12+8)*3', expect: 'arith', check: (t) => num(t) === 60 ? null : 'ожидалось 60' },
  { lang: 'ru', say: 'сколько будет 7 умножить на 6', expect: 'arith', check: (t) => num(t) === 42 ? null : 'ожидалось 42' },
  { lang: 'ru', say: '15% от 200', expect: 'arith', check: (t) => num(t) === 30 ? null : 'ожидалось 30' },
  { lang: 'ru', say: 'корень из 144', expect: 'arith', check: (t) => num(t) === 12 ? null : 'ожидалось 12' },
  { lang: 'ru', say: 'сколько будет 5/0', expect: 'arith', has: [/не могу посчитать/] },
  { lang: 'ru', say: '2,5 кг в граммы', expect: 'units', check: (t) => num(t) === 2500 ? null : 'ожидалось 2500' },
  { lang: 'ru', say: 'сколько миллилитров в 1,5 л', expect: 'units', check: (t) => num(t) === 1500 ? null : 'ожидалось 1500' },
  { lang: 'ru', say: '25 °C в кельвины', expect: 'units', check: (t) => Math.abs(num(t) - 298.15) < 1e-9 ? null : 'ожидалось 298,15' },
  { lang: 'ru', say: '300 K в градусы цельсия', expect: 'units', check: (t) => Math.abs(num(t) - 26.85) < 1e-9 ? null : 'ожидалось 26,85' },
  // ---- химия без книги
  { lang: 'ru', say: 'молярная масса H2SO4', expect: 'chem', has: [ru2(M('H2SO4'))], check: (t) => near(t, 'molar', M('H2SO4')) },
  { lang: 'ru', say: 'Какая молярная масса серной кислоты?', expect: 'chem', has: [ru2(M('H2SO4'))] },
  { lang: 'ru', say: 'M(Ca(OH)2)?', expect: 'chem', check: (t) => near(t, 'molar', M('CaO2H2')) },
  { lang: 'ru', say: 'сколько весит 2 моль воды', expect: 'chem', check: (t) => near(t, 'mass', 2 * M('H2O')) },
  { lang: 'ru', say: 'какой порядковый номер у кислорода?', expect: 'chem', has: ['8'], check: (t) => (t?.kind === 'reply' && t.numbers?.z === 8 ? null : 'Z кислорода') },
  { lang: 'ru', say: 'а у натрия?', expect: 'chem', check: (t) => (t?.kind === 'reply' && t.numbers?.z === 11 ? null : 'ожидался натрий, Z=11') },
  { lang: 'ru', say: 'а его атомная масса?', expect: 'chem', check: (t) => near(t, 'mass', el('Na').atomicMass) },
  { lang: 'ru', say: 'сколько нейтронов у него?', expect: 'chem', check: (t) => (t?.kind === 'reply' && t.numbers?.neutrons === 12 ? null : 'ожидалось 12 нейтронов') },
  { lang: 'ru', say: 'расскажи про кальций', expect: 'chem', has: ['№ 20', 'Ca'] },
  { lang: 'ru', say: 'электронная конфигурация серы', expect: 'chem', has: ['3p⁴'] },
  { lang: 'ru', say: 'что такое моль?', expect: 'null' },
  { lang: 'ru', say: 'какие свойства у кислорода?', expect: 'null' },
  // ---- смешанные фразы
  { lang: 'ru', say: 'привет, а что такое моль?', expect: 'prefix', check: (t) => (t?.kind === 'prefix' && /моль/.test(t.rest) ? null : 'остаток должен содержать «моль»') },
  { lang: 'ru', say: 'Привет! Молярная масса NaCl?', expect: 'chem', has: [ru2(M('NaCl'))] },
  { lang: 'ru', say: 'спасибо, а сколько будет 3*3?', expect: 'arith', check: (t) => num(t) === 9 ? null : 'ожидалось 9' },
  { lang: 'ru', say: 'я не понимаю, что такое валентность?', expect: 'prefix' },
  // ---- память
  { lang: 'ru', say: 'меня зовут Алан', expect: 'mem_name', has: ['Алан'] },
  { lang: 'ru', say: 'как меня зовут?', expect: 'mem_recall', has: ['Алан'] },
  { lang: 'ru', say: 'я в 8 классе', expect: 'mem_grade', has: ['8'] },
  { lang: 'ru', say: 'мне нравится тема кислоты', expect: 'mem_like' },
  { lang: 'ru', say: 'запомни: у меня контрольная в пятницу', expect: 'mem_note', check: (t) => (t?.kind === 'reply' && t.noteStatus === 'unverified' ? null : 'заметка должна быть «со слов ученика»'), not: [/Сверил|всё верно/] },
  { lang: 'ru', say: 'запомни, что молярная масса H2SO4 равна 100', expect: 'mem_note', has: [ru2(M('H2SO4')), 'спорн'], check: (t) => (t?.kind === 'reply' && t.noteStatus === 'contradicted' ? null : 'ложный факт не должен приниматься') },
  { lang: 'ru', say: 'запомни: порядковый номер кислорода 8', expect: 'mem_note', has: ['верно'], check: (t) => (t?.kind === 'reply' && t.noteStatus === 'checked' ? null : 'верный факт должен сверяться') },
  { lang: 'ru', say: 'нет, правильно: атомная масса натрия 30', expect: 'mem_correction', check: (t) => (t?.kind === 'reply' && t.noteStatus === 'contradicted' ? null : 'неверная поправка должна быть спорной'), not: ['Ты прав'] },
  { lang: 'ru', say: 'нет, правильно формула воды H2O', expect: 'mem_correction', has: ['Ты прав'] },
  { lang: 'ru', say: 'что ты обо мне знаешь?', expect: 'mem_recall', has: ['Алан', '8 классе', 'спорно', 'с твоих слов'] },
  { lang: 'ru', say: 'привет', expect: 'greet', has: ['Алан'] },
  { lang: 'ru', say: 'пока!', expect: 'bye', has: ['Алан'] },
  // ---- EN
  { lang: 'en', say: 'hello!', expect: 'greet', has: [/Good morning|Morning|Hi, good morning/] },
  { lang: 'en', say: 'helo', expect: 'greet' },
  { lang: 'en', say: 'how are you?', expect: 'howareyou' },
  { lang: 'en', say: 'who are you', expect: 'whoareyou' },
  { lang: 'en', say: 'thanks a lot', expect: 'thanks' },
  { lang: 'en', say: 'tell me a joke', expect: 'joke' },
  { lang: 'en', say: "i'm so tired", expect: 'emo_tired' },
  { lang: 'en', say: 'I am scared of the exam tomorrow', expect: 'emo_scared' },
  { lang: 'en', say: 'what is 12 times 12', expect: 'arith', check: (t) => num(t) === 144 ? null : 'expected 144' },
  { lang: 'en', say: '500 ml to l', expect: 'units', check: (t) => num(t) === 0.5 ? null : 'expected 0.5' },
  { lang: 'en', say: 'molar mass of CO2', expect: 'chem', check: (t) => near(t, 'molar', M('CO2')) },
  { lang: 'en', say: 'what is the atomic number of iron', expect: 'chem', check: (t) => (t?.kind === 'reply' && t.numbers?.z === 26 ? null : 'Fe Z=26') },
  { lang: 'en', say: 'and its mass?', expect: 'chem', check: (t) => near(t, 'mass', el('Fe').atomicMass) },
  { lang: 'en', say: 'hi, what is a mole?', expect: 'prefix' },
  { lang: 'en', say: 'my name is Sara', expect: 'mem_name', has: ['Sara'] },
  { lang: 'en', say: 'remember: I like experiments with fire', expect: 'mem_note', check: (t) => (t?.kind === 'reply' && t.noteStatus === 'unverified' ? null : 'note must be unverified') },
  { lang: 'en', say: 'bye', expect: 'bye', has: ['Sara'] },
  // ---- UZ
  { lang: 'uz', say: 'salom', expect: 'greet', has: [/Xayrli tong|Assalomu alaykum|Salom/] },
  { lang: 'uz', say: 'Assalomu alaykum ustoz', expect: 'greet' },
  { lang: 'uz', say: 'qalaysiz?', expect: 'howareyou' },
  { lang: 'uz', say: 'rahmat', expect: 'thanks' },
  { lang: 'uz', say: 'charchadim', expect: 'emo_tired' },
  // ---- «физиология и человечность»: состояния ученика (без медицинских назначений), вопросы об учителе, быт
  { lang: 'ru', say: 'э ну это самое я хочу есть', expect: 'emo_hungry', has: [/перекус|поесть|еда|воды|вод/i], not: [NO_MEDS] },
  { lang: 'ru', say: 'пить хочу', expect: 'emo_hungry', not: [NO_MEDS] },
  { lang: 'ru', say: 'я не выспался', expect: 'emo_sleepy', has: [/вод|поспи|сон|короткую|проветри|отдых|один вопрос/i], not: [NO_MEDS] },
  { lang: 'ru', say: 'спать хочу', expect: 'emo_sleepy', not: [NO_MEDS] },
  { lang: 'ru', say: 'у меня болит голова', expect: 'emo_pain', has: [/взросл|родител|воды|вод/i], not: [NO_MEDS] },
  { lang: 'ru', say: 'болит живот', expect: 'emo_pain', has: [/взросл|родител|врач/i], not: [NO_MEDS] },
  { lang: 'ru', say: 'я заболел', expect: 'emo_sick', has: [/выздор|поправ|отдых|лечишься|сог|тёпл|тепл/i], not: [NO_MEDS] },
  { lang: 'ru', say: 'у меня температура', expect: 'emo_sick', not: [NO_MEDS] },
  { lang: 'ru', say: 'мне холодно', expect: 'emo_cold', has: [/тепл|тёпл|чай|согре|кофт|плед/i] },
  { lang: 'ru', say: 'мне жарко и душно', expect: 'emo_hot', has: [/вод|проветр|окно/i] },
  { lang: 'ru', say: 'я злюсь', expect: 'emo_angry', has: [/выдох|выдыха|пауз|пройдись|по-другому|проще|воды|разбер|другой пример|исправлюсь/i] },
  { lang: 'ru', say: 'меня всё бесит', expect: 'emo_angry' },
  { lang: 'ru', say: 'меня обидели', expect: 'emo_hurt', has: [/обид|сочувств|жаль|слуша/i] },
  { lang: 'ru', say: 'ты живой?', expect: 'teacher_alive', has: [/программ/i] },
  { lang: 'ru', say: 'ты робот или человек', expect: 'teacher_alive' },
  { lang: 'ru', say: 'сколько тебе лет', expect: 'teacher_age', has: [/ATOMLAB|программ|разговор/i] },
  { lang: 'ru', say: 'у тебя есть чувства?', expect: 'teacher_feelings', has: [/программ|чувств|эмоци/i] },
  { lang: 'ru', say: 'ты устаёшь?', expect: 'teacher_tired', has: [/не уста|программ|отдых/i] },
  { lang: 'ru', say: 'кто тебя создал', expect: 'teacher_creator', has: [/ATOMLAB/] },
  { lang: 'ru', say: 'что будешь делать на выходных', expect: 'life_weekend' },
  { lang: 'ru', say: 'я вчера весь вечер играл в майнкрафт', expect: 'life_games' },
  { lang: 'ru', say: 'у меня сегодня тренировка по футболу', expect: 'life_sport' },
  { lang: 'ru', say: 'я поел плов, было вкусно', expect: 'life_food', has: [/NaCl|NaHCO₃|CO₂|C₆H₁₂O₆|глюкоз|соль|сода/i] },
  { lang: 'ru', say: 'я поссорился с другом', expect: 'life_friends' },
  { lang: 'ru', say: 'школа достала', expect: 'life_school' },
  { lang: 'ru', say: 'получил двойку по химии', expect: 'life_grades', has: [/тем|оценк|повтор|споткнул/i] },
  { lang: 'ru', say: 'мама ругает за оценки', expect: 'life_parents' },
  { lang: 'ru', say: 'родители не разрешают играть', expect: 'life_parents' },
  { lang: 'ru', say: 'объясни по-другому', expect: 'null' },
  { lang: 'ru', say: 'какая погода в субботу', expect: 'offline_world' },
  { lang: 'en', say: "um i'm hungry", expect: 'emo_hungry', not: [NO_MEDS] },
  { lang: 'en', say: "i didn't sleep well", expect: 'emo_sleepy' },
  { lang: 'en', say: 'my head hurts', expect: 'emo_pain', has: [/adult|parent|water/i], not: [NO_MEDS] },
  { lang: 'en', say: "i'm sick", expect: 'emo_sick', not: [NO_MEDS] },
  { lang: 'en', say: "i'm cold", expect: 'emo_cold' },
  { lang: 'en', say: "i'm so angry", expect: 'emo_angry' },
  { lang: 'en', say: 'are you alive?', expect: 'teacher_alive', has: [/program|software/i] },
  { lang: 'en', say: 'how old are you', expect: 'teacher_age' },
  { lang: 'en', say: 'who created you', expect: 'teacher_creator', has: [/ATOMLAB/] },
  { lang: 'en', say: 'i played minecraft all day', expect: 'life_games' },
  { lang: 'uz', say: 'qornim och', expect: 'emo_hungry', not: [NO_MEDS] },
  { lang: 'uz', say: 'boshim og‘riyapti', expect: 'emo_pain', has: [/kattalar|ota-ona|suv/i], not: [NO_MEDS] },
  { lang: 'uz', say: 'kasalman', expect: 'emo_sick', not: [NO_MEDS] },
  { lang: 'uz', say: 'sen tirikmisan', expect: 'teacher_alive', has: [/dastur/i] },
  { lang: 'uz', say: 'seni kim yaratdi', expect: 'teacher_creator', has: [/ATOMLAB/] },
  { lang: 'uz', say: 'jahlim chiqdi', expect: 'emo_angry' },
  { lang: 'uz', say: 'do‘stim bilan urishib qoldim', expect: 'life_friends' },
  { lang: 'uz', say: 'zerikdim', expect: 'emo_bored' },
  { lang: 'uz', say: 'hazil ayt', expect: 'joke' },
  { lang: 'uz', say: 'mening ismim Dilnoza', expect: 'mem_name', has: ['Dilnoza'] },
  { lang: 'uz', say: 'ismim nima?', expect: 'mem_recall', has: ['Dilnoza'] },
  { lang: 'uz', say: 'kislorodning tartib raqami', expect: 'chem', check: (t) => (t?.kind === 'reply' && t.numbers?.z === 8 ? null : 'O Z=8') },
  { lang: 'uz', say: '3 kg necha gramm', expect: 'null' },
  { lang: 'uz', say: '2 kg ga gramm', expect: 'units', check: (t) => num(t) === 2000 ? null : '2000' },
  { lang: 'uz', say: 'H2O molyar massasi', expect: 'chem', check: (t) => near(t, 'molar', M('H2O')) },
  { lang: 'uz', say: 'xayr', expect: 'bye' },
  // ---- учебные вопросы остаются за учебником
  { lang: 'ru', say: 'что такое оксиды?', expect: 'null' },
  { lang: 'ru', say: 'объясни закон сохранения массы', expect: 'null' },
  { lang: 'ru', say: 'хорошо', expect: 'null' },
  // ---- приватность: «забудь всё»
  { lang: 'ru', say: 'забудь всё', expect: 'mem_forget' },
  { lang: 'ru', say: 'как меня зовут?', expect: 'mem_recall', not: ['Алан', 'Dilnoza'] },
]

function num(t: HumanTurn | null): number {
  return t?.kind === 'reply' ? (t.numbers?.result ?? NaN) : NaN
}

function near(t: HumanTurn | null, key: string, want: number): string | null {
  if (t?.kind !== 'reply') return 'нет ответа'
  const got = t.numbers?.[key]
  return got != null && Math.abs(got - want) < 1e-6 ? null : `${key}: ожидалось ${want}, получено ${got}`
}

let fail = 0
let lastText = ''
const byIntent = new Map<string, string[]>()
for (const [i, s] of steps.entries()) {
  let turn: HumanTurn | null = null
  try {
    turn = humanTurn(s.say, { lang: s.lang, lastTeacher: lastText })
  } catch (e) {
    console.error(`✗ [${i}] «${s.say}» — падение: ${(e as Error).message}`)
    fail++
    continue
  }
  const got = turn === null ? 'null' : turn.kind === 'prefix' ? 'prefix' : turn.intent
  const text = turn?.kind === 'reply' ? turn.text : turn?.kind === 'prefix' ? turn.prefix : ''
  const errs: string[] = []
  if (got !== s.expect) errs.push(`намерение ${got}, ожидалось ${s.expect}`)
  for (const h of s.has ?? []) if (!(typeof h === 'string' ? text.includes(h) : h.test(text))) errs.push(`нет «${h}»`)
  for (const h of s.not ?? []) if (typeof h === 'string' ? text.includes(h) : h.test(text)) errs.push(`лишнее «${h}»`)
  const c = s.check?.(turn)
  if (c) errs.push(c)
  if (text && text === lastText) errs.push('ответ повторяет предыдущий')
  if (turn?.kind === 'reply') {
    const prev = byIntent.get(turn.intent) ?? []
    if (prev.length && prev[prev.length - 1] === text && !/^mem_/.test(turn.intent)) errs.push('тот же вариант подряд для намерения')
    byIntent.set(turn.intent, [...prev, text])
  }
  if (errs.length) {
    fail++
    console.error(`✗ [${i}] ${s.lang} «${s.say}» → ${got}: ${errs.join('; ')}\n    ${text.replace(/\n/g, ' | ').slice(0, 220)}`)
  } else {
    console.log(`✓ ${s.lang} «${s.say}» → ${got}  ${text.replace(/\n/g, ' | ').slice(0, 110)}`)
  }
  if (text) lastText = text
}

// Разнообразие: 6 приветствий подряд — без одинаковых соседей.
{
  const seen: string[] = []
  for (let i = 0; i < 6; i++) {
    const t = humanTurn('привет', { lang: 'ru' })
    seen.push(t?.kind === 'reply' ? t.text : '')
  }
  for (let i = 1; i < seen.length; i++) {
    if (seen[i] === seen[i - 1]) {
      fail++
      console.error('✗ приветствие повторилось подряд:', seen[i])
    }
  }
  console.log(`✓ разнообразие приветствий: ${new Set(seen).size} разных из ${seen.length}`)
}

// 👍/👎 меняют стиль.
{
  const long = 'слово '.repeat(120)
  applyFeedback(long, false)
  applyFeedback(long, false)
  if (preferredDetail(loadProfile()) !== 'brief') {
    fail++
    console.error('✗ 👎 на длинный ответ должен вести к краткости')
  } else console.log('✓ 👎 на длинный ответ → короче')
  applyFeedback('коротко', false)
  applyFeedback('коротко', false)
  applyFeedback('коротко', false)
  applyFeedback('коротко', false)
  if (preferredDetail(loadProfile()) !== 'more') {
    fail++
    console.error('✗ 👎 на короткий ответ должен вести к подробности')
  } else console.log('✓ 👎 на короткий ответ → подробнее')
}

console.log(`\nРеплик: ${steps.length}. Ошибок: ${fail}.`)
if (steps.length < 60) {
  console.error('✗ меньше 60 реплик')
  process.exit(1)
}
process.exit(fail ? 1 : 0)
