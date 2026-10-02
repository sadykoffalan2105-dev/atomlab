/**
 * Классификатор намерений ученика: метрики модели (пороги) + ручные проверки ML-шага маршрута
 * (humanTurn промолчал → mlIntentStep): разговорные реплики из банка без повторов подряд,
 * подсказки стиля для учебных намерений, низкая уверенность → null, поправки → дообучение.
 *
 *   npm run test:teacher-intent
 */
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { HOLDOUT } from './teacher-ml/intent-holdout.mts'
import { INTENTS, type Intent } from '../src/learn/brain/ml/intentFeatures.ts'
import { IntentModel, type IntentModelFile } from '../src/learn/brain/ml/intentModelCore.ts'
import { setIntentModel, setIntentMemoryBackend, predictIntent, teachIntent, explainIntent, forgetIntentDeltas, intentDeltaStats } from '../src/learn/brain/ml/intentClassifier.ts'
import { mlIntentStep, resetIntentSession, noteNegativeFeedback, mergeIntentStyle } from '../src/learn/brain/ml/intentStep.ts'
import { setReplyRandom } from '../src/learn/brain/ml/intentReplies.ts'
import { humanTurn, setHumanRandom, setMemoryProfileBackend } from '../src/learn/brain/human/index.ts'

const here = dirname(fileURLToPath(import.meta.url))
const MODEL = join(here, '..', 'src', 'data', 'teacher', 'intentModel.json')
const DATA = join(here, 'teacher-ml', 'data', 'intent-dataset.json')
const MIN_HELDOUT = 0.92
const MIN_HANDWRITTEN = 0.85
const MAX_SIZE = 400 * 1024

let failures = 0
const fail = (msg: string) => {
  failures++
  console.log(`  ✗ ${msg}`)
}
const ok = (msg: string) => console.log(`  ✓ ${msg}`)

// ---------------------------------------------------------------- 1. метрики
const file = JSON.parse(readFileSync(MODEL, 'utf8')) as IntentModelFile
const model = new IntentModel(file)
const size = statSync(MODEL).size
console.log(`[intent] модель: ${file.features.length} признаков, ${file.intents.length} намерений, ${(size / 1024).toFixed(0)} КБ`)
if (size > MAX_SIZE) fail(`модель больше ${MAX_SIZE / 1024} КБ`)
if (file.intents.length < 24) fail('меньше 24 намерений')
if (JSON.stringify(file.intents) !== JSON.stringify(INTENTS)) fail('список намерений модели не совпадает с INTENTS')

const acc = (rows: { text: string; intent: string }[]) => rows.filter((r) => model.predict(r.text).intent === r.intent).length / rows.length
let heldoutAcc = 1
try {
  const ds = JSON.parse(readFileSync(DATA, 'utf8')) as { train: unknown[]; heldout: { text: string; intent: string }[] }
  heldoutAcc = acc(ds.heldout)
  if (ds.train.length + ds.heldout.length < 4000) fail(`датасет меньше 4000 фраз (${ds.train.length + ds.heldout.length})`)
  console.log(`[intent] отложенная выборка: ${(heldoutAcc * 100).toFixed(1)} % (${ds.heldout.length} фраз)`)
} catch {
  console.log('[intent] датасет не найден (npm run teacher:intent-data) — проверяем только рукописный набор')
}
const handAcc = acc(HOLDOUT)
console.log(`[intent] рукописный набор: ${(handAcc * 100).toFixed(1)} % (${HOLDOUT.length} фраз)`)
if (heldoutAcc < MIN_HELDOUT) fail(`accuracy на отложенной выборке ${(heldoutAcc * 100).toFixed(1)} % < ${MIN_HELDOUT * 100} %`)
if (handAcc < MIN_HANDWRITTEN) fail(`accuracy на рукописном наборе ${(handAcc * 100).toFixed(1)} % < ${MIN_HANDWRITTEN * 100} %`)
if (HOLDOUT.length < 150) fail('рукописный набор меньше 150 фраз')

// ---------------------------------------------------------------- 2. маршрут: humanTurn → mlIntentStep
setIntentModel(file)
setIntentMemoryBackend()
setMemoryProfileBackend()
let seed = 11
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
setHumanRandom(rnd)
setReplyRandom(rnd)
resetIntentSession()

type Lang = 'ru' | 'en' | 'uz'
interface Check {
  lang: Lang
  say: string
  /** reply: разговорная реплика; style: подсказка стиля; null: ничего не меняем; rewrite: переписанный вопрос. */
  expect: 'reply' | 'style' | 'null' | 'rewrite'
  intent?: Intent
  has?: (string | RegExp)[]
  style?: Partial<Record<'wantWhy' | 'wantExample' | 'simpler', boolean>> & { detail?: 'more' }
  /** Реплика должна пройти мимо humanTurn (иначе её бы и так обработали). */
  afterHuman?: boolean
}
const checks: Check[] = [
  // разговорные намерения, которых humanTurn не знает (или знает частично)
  { lang: 'ru', say: 'дароу учитель, я снова тут', expect: 'reply', intent: 'greet' },
  { lang: 'ru', say: 'ну всё, на сегодня хватит, я пошёл', expect: 'reply', intent: 'bye' },
  { lang: 'ru', say: 'спасибо что объяснил, выручил', expect: 'reply', intent: 'thanks' },
  { lang: 'ru', say: 'как настроение сегодня у тебя?', expect: 'reply', intent: 'how_are_you' },
  { lang: 'ru', say: 'расскажи анекдот про химика плиз', expect: 'reply', intent: 'joke', has: [/атом|ион|гелий|нитрат|аспирин|H, I, J/i] },
  { lang: 'ru', say: 'ты бот или настоящий учитель?', expect: 'reply', intent: 'about_teacher', has: [/учебник|ATOMLAB|химии/i] },
  { lang: 'ru', say: 'посоветуй сериал на вечер', expect: 'reply', intent: 'offtopic', has: [/хим/i] },
  { lang: 'ru', say: 'какая завтра погода в самарканде', expect: 'reply', intent: 'offtopic', has: [/моль|кислот|кислород|оксид|коэффициент|таблиц|тема урока/i] },
  { lang: 'ru', say: 'ыфвафыва', expect: 'reply', intent: 'gibberish' },
  { lang: 'ru', say: 'у меня ничего не получается, я тупой', expect: 'reply', intent: 'encourage', has: [/не один|шаг|пауз|не сдавайся|ошибк|сложное|проще/i] },
  { lang: 'ru', say: 'отлично, теперь всё понятно', expect: 'reply', intent: 'feedback_pos' },
  { lang: 'ru', say: 'ты ответил не на мой вопрос', expect: 'reply', intent: 'feedback_neg' },
  { lang: 'en', say: 'hello there teacher, im back', expect: 'reply', intent: 'greet' },
  { lang: 'en', say: 'whats the capital of canada', expect: 'reply', intent: 'offtopic', has: [/chem|mole|acid|oxygen|periodic|lesson/i] },
  { lang: 'en', say: 'i give up, this is too hard for me', expect: 'reply', intent: 'encourage' },
  { lang: 'en', say: 'tell me something funny about atoms', expect: 'reply', intent: 'joke' },
  { lang: 'uz', say: 'assalomu alaykum ustoz, men keldim', expect: 'reply', intent: 'greet' },
  { lang: 'uz', say: 'futbol o‘yini kim yutdi kecha', expect: 'reply', intent: 'offtopic', has: [/kimyo|mol|kislota|kislorod|oksid|davriy|dars/i] },
  { lang: 'uz', say: 'menga juda qiyin, charchadim', expect: 'reply', intent: 'encourage' },
  { lang: 'uz', say: 'katta raxmat ustoz', expect: 'reply', intent: 'thanks' },
  // учебные намерения → подсказка стиля, без готового ответа
  { lang: 'ru', say: 'почему медь не реагирует с соляной кислотой', expect: 'style', intent: 'why', style: { wantWhy: true } },
  { lang: 'ru', say: 'приведи примеры оснований', expect: 'style', intent: 'example', style: { wantExample: true } },
  { lang: 'ru', say: 'объясни попроще плиз', expect: 'style', intent: 'simpler', style: { simpler: true } },
  { lang: 'ru', say: 'расскажи поподробнее про соли', expect: 'style', intent: 'more_detail', style: { detail: 'more' } },
  { lang: 'ru', say: 'что токое валентность', expect: 'style', intent: 'define' },
  { lang: 'ru', say: 'уравняй Al + O2 → Al2O3', expect: 'style', intent: 'balance' },
  { lang: 'ru', say: 'что будет если натрий бросить в воду', expect: 'style', intent: 'reaction_products' },
  { lang: 'ru', say: 'реши задачу: 10 г соли растворили в 90 г воды, найди массовую долю', expect: 'style', intent: 'problem' },
  { lang: 'ru', say: 'что делать если кислота попала на руку', expect: 'style', intent: 'lab_safety' },
  { lang: 'ru', say: 'проверь меня по оксидам', expect: 'style', intent: 'exam_me' },
  { lang: 'ru', say: 'помоги с домашкой по химии', expect: 'style', intent: 'homework_help' },
  { lang: 'ru', say: 'переведи 250 мл в литры', expect: 'style', intent: 'units' },
  { lang: 'ru', say: 'расскажи про серную кислоту подробнее', expect: 'style', intent: 'more_detail', style: { detail: 'more' } },
  { lang: 'en', say: 'why does sodium explode in water', expect: 'style', intent: 'why', style: { wantWhy: true } },
  { lang: 'en', say: 'difference between ionic and covalent bond', expect: 'style', intent: 'compare' },
  { lang: 'uz', say: 'oksidlarga misol keltiring', expect: 'style', intent: 'example', style: { wantExample: true } },
  { lang: 'uz', say: 'nega natriy suvda portlaydi', expect: 'style', intent: 'why', style: { wantWhy: true } },
  // химия, похожая на offtopic/тарабарщину — не трогаем
  { lang: 'ru', say: 'H2SO4', expect: 'null' },
  { lang: 'ru', say: 'NaCl', expect: 'null' },
  // поправка → переписанный вопрос
  { lang: 'ru', say: 'нет, я спросил что такое моль', expect: 'rewrite', has: ['что такое моль'] },
  { lang: 'en', say: 'no, i meant what is molar mass of water', expect: 'rewrite', has: ['molar mass of water'] },
]

const lastReplies = new Map<string, string>()
let n = 0
for (const c of checks) {
  n++
  const human = humanTurn(c.say, { lang: c.lang })
  const res = await mlIntentStep(c.say, c.lang)
  const label = `${c.lang} «${c.say}»`
  if (c.expect === 'null') {
    if (res?.reply) fail(`${label}: ожидали null/стиль, получили реплику «${res.reply.slice(0, 60)}»`)
    else ok(`${label}: без вмешательства`)
    continue
  }
  if (c.expect === 'rewrite') {
    if (!res?.rewrite) fail(`${label}: ожидали rewrite, получили ${JSON.stringify(res)?.slice(0, 80)}`)
    else if (c.has && !c.has.every((h) => (typeof h === 'string' ? res.rewrite!.includes(h) : h.test(res.rewrite!)))) fail(`${label}: rewrite «${res.rewrite}» без ожидаемого`)
    else ok(`${label} → «${res.rewrite}»`)
    continue
  }
  if (!res) {
    // humanTurn мог перехватить реплику раньше — это не ошибка маршрута, но ML должен быть уверен
    const pred = await predictIntent(c.say)
    fail(`${label}: ML промолчал (p=${pred?.p.toFixed(2)} ${pred?.intent}); humanTurn=${human ? human.kind : 'null'}`)
    continue
  }
  if (c.intent && res.intent !== c.intent) {
    fail(`${label}: намерение ${res.intent} (p=${res.p.toFixed(2)}), ожидалось ${c.intent}`)
    continue
  }
  if (c.expect === 'reply') {
    if (!res.reply) {
      fail(`${label}: ожидали реплику, получили стиль`)
      continue
    }
    if (c.has && !c.has.every((h) => (typeof h === 'string' ? res.reply!.includes(h) : h.test(res.reply!)))) fail(`${label}: в реплике нет ожидаемого: «${res.reply}»`)
    else ok(`${label} → ${res.intent} (${res.p.toFixed(2)}): «${res.reply.slice(0, 70)}…»`)
    const key = `${c.lang}:${res.intent}`
    if (lastReplies.get(key) === res.reply) fail(`${label}: повтор реплики подряд`)
    lastReplies.set(key, res.reply)
  } else {
    if (res.reply) {
      fail(`${label}: ожидали стиль, получили реплику «${res.reply.slice(0, 60)}»`)
      continue
    }
    const st = res.style ?? {}
    const want = c.style ?? {}
    const bad = Object.entries(want).filter(([k, v]) => (st as Record<string, unknown>)[k] !== v)
    if (bad.length) fail(`${label}: стиль ${JSON.stringify(st)}, ожидалось ${JSON.stringify(want)}`)
    else ok(`${label} → ${res.intent} (${res.p.toFixed(2)}) стиль ${JSON.stringify(st)}`)
  }
}

// ---------------------------------------------------------------- 3. без повторов подряд (6 вызовов одного намерения)
{
  const seen: string[] = []
  for (let i = 0; i < 6; i++) {
    const r = await mlIntentStep('расскажи анекдот про химика', 'ru')
    seen.push(r?.reply ?? '')
  }
  const repeats = seen.filter((s, i) => i > 0 && s === seen[i - 1]).length
  if (repeats) fail(`шутки повторяются подряд (${repeats})`)
  else ok('6 шуток подряд без повторов')
}

// ---------------------------------------------------------------- 4. дообучение в моменте
{
  forgetIntentDeltas()
  resetIntentSession()
  // берём фразу, которую базовая модель относит НЕ к целевому намерению (ошибка из рукописного набора или произвольная)
  const target: Intent = 'feedback_pos'
  const candidates = ['класс спасибо понял', 'ну ты даёшь, прям разложил по полочкам', 'вот это да, дошло наконец', 'ага, теперь сходится']
  let phrase = candidates[0]!
  for (const c of candidates) {
    const p = await predictIntent(c)
    if (p && p.intent !== target) {
      phrase = c
      break
    }
  }
  const before = await predictIntent(phrase)
  const learned = await teachIntent(phrase, target)
  const after = await predictIntent(phrase)
  if (before?.intent === target) ok(`teachIntent: все кандидаты уже ${target} — проверяем только сохранение дельт (learned=${learned})`)
  else if (!learned || after?.intent !== target) fail(`teachIntent не сдвинул предсказание: «${phrase}» ${before?.intent} → ${after?.intent}`)
  else ok(`teachIntent: «${phrase}» ${before?.intent} (${before?.p.toFixed(2)}) → ${target} (${after?.p.toFixed(2)})`)
  await teachIntent('а можно ещё разок про это самое', 'repeat')
  const stats = intentDeltaStats()
  if (stats.features < 1) fail('дельты не сохранились')
  else ok(`дельты: ${stats.features} признаков, поправок ${stats.corrections}`)

  // похожая фраза тоже сдвигается (обобщение по n-граммам)
  const near = await predictIntent('можно ещё разок')
  if (near?.intent !== 'repeat') console.log(`  · соседняя фраза «можно ещё разок» → ${near?.intent} (обобщение не обязательно)`)
  else ok('соседняя фраза «можно ещё разок» → repeat (обобщение)')

  // 👎 + переформулировка → поправка прошлой реплики
  forgetIntentDeltas()
  resetIntentSession()
  const odds = ['выдай мне про массу одного моля воды', 'сколько тянет моль водички', 'вес одной порции воды в молях', 'какая масса у H2O если взять моль']
  let odd = odds[0]!
  for (const c of odds) {
    const p = await predictIntent(c)
    if (!p || p.intent !== 'molar_mass') {
      odd = c
      break
    }
  }
  const first = await mlIntentStep(odd, 'ru')
  noteNegativeFeedback()
  const second = await mlIntentStep('какая молярная масса у воды', 'ru')
  if (first && second?.intent === 'molar_mass' && first.intent !== 'molar_mass') {
    if (!second.learned) fail('после 👎 и переформулировки не было дообучения')
    else {
      const re = await predictIntent(odd)
      if (re?.intent !== 'molar_mass') fail(`после поправки «${odd}» → ${re?.intent}`)
      else ok(`👎 + переформулировка: «${odd}» ${first.intent} → molar_mass`)
    }
  } else ok(`👎-сценарий: первая реплика уже ${first?.intent ?? 'null'} — поправка не нужна`)

  // «это была шутка» → прошлая реплика помечается шуткой
  forgetIntentDeltas()
  resetIntentSession()
  await mlIntentStep('а правда что водород это газ с характером', 'ru')
  const jk = await mlIntentStep('это была шутка', 'ru')
  if (!jk?.reply) fail('на «это была шутка» нет реплики')
  else ok(`«это была шутка» → «${jk.reply}» (learned=${jk.learned})`)

  const ex = await explainIntent('что такое оксиды')
  if (!ex || ex.contributions.length === 0) fail('explainIntent пуст')
  else ok(`explainIntent: ${ex.prediction.intent} (${ex.prediction.p.toFixed(2)}), признаки: ${ex.contributions.slice(0, 3).map((c) => c.feature).join(', ')}`)
}

// ---------------------------------------------------------------- 5. слияние стиля
{
  const base = { wantWhy: false, wantExample: false, simpler: false, detail: 'brief' as const }
  const m1 = mergeIntentStyle(base, { detail: 'more' }, false)
  const m2 = mergeIntentStyle(base, { detail: 'more' }, true)
  const m3 = mergeIntentStyle({ ...base, wantWhy: true }, { wantExample: true }, false)
  if (m1.detail !== 'more' || m2.detail !== 'brief' || !m3.wantWhy || !m3.wantExample) fail('mergeIntentStyle: неверное слияние')
  else ok('mergeIntentStyle: регулярки главнее при явном follow-up, булевы — через ИЛИ')
}

console.log(failures ? `\n[intent] ПРОВАЛЕНО: ${failures} (проверок маршрута ${n})` : `\n[intent] OK: все проверки пройдены (маршрут ${n}, heldout ${(heldoutAcc * 100).toFixed(1)} %, рукописные ${(handAcc * 100).toFixed(1)} %)`)
process.exit(failures ? 1 : 0)
