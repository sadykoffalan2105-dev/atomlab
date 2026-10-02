/**
 * Живая речь учителя (speakLikeHuman) и быстрый ответ об учёном (scientistTalk).
 *
 *   npm run test:teacher-voice
 *
 * Проверяем: все фактические предложения сохраняются (множество нормализованных предложений),
 * прирост длины ≤ 25 слов, вступления не повторяются подряд в серии из 10, имя — не чаще 1 раза
 * в 3 ответа, подписи источников целы; scientistTalk — 30 вопросов об учёных (RU/EN/UZ, падежи)
 * дают ответ с годами/достижением, 15 фраз не об учёных → null.
 */
import assert from 'node:assert/strict'
import {
  speakLikeHuman,
  resetVoiceMemory,
  canonSentence,
  splitVoiceSentences,
  scientistTalk,
  findScientists,
  SCIENTIST_SIGNATURE,
  setMemoryProfileBackend,
  saveProfile,
  loadProfile,
  type VoiceKind,
  type VoiceLang,
} from '../src/learn/brain/human/index.ts'
import { softenBureaucratic } from '../src/learn/brain/human/personaVoice.ts'
import { SCIENTIST_ENTRIES } from '../src/learn/knowledge/learnScientistsKnowledge.ts'

setMemoryProfileBackend()
let failures = 0
const fail = (msg: string) => {
  failures += 1
  console.error('  ✗', msg)
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length

/** Канон предложения с учётом разрешённой правки канцелярита (факт тот же). */
const canon = (s: string, lang: VoiceLang) => canonSentence(softenBureaucratic(s, lang))
const factSet = (text: string, lang: VoiceLang) =>
  new Set(
    splitVoiceSentences(text)
      .filter(Boolean)
      .map((s) => canon(s, lang))
      .filter((s) => s.length > 12),
  )

/* ------------------------------------------------------------ 60 ответов разных типов */

type Sample = { lang: VoiceLang; kind: VoiceKind; query: string; text: string }
const RU_BOOK = [
  'Оксиды — сложные вещества, состоящие из двух элементов, один из которых кислород в степени окисления −2. Данное вещество делится на основные, кислотные и амфотерные. Следует отметить, что оксиды металлов обычно основные.\n\n[Kimyo 8, §12, стр. 40]',
  'Моль — количество вещества, содержащее 6,02·10²³ частиц. Молярная масса численно равна относительной молекулярной массе. Например, M(H₂O) = 18 г/моль.\n\n[Kimyo 7, §2.3, стр. 51] [ATOMLAB: формулы]',
  'Кислоты — электролиты, при диссоциации которых образуются катионы водорода. В настоящее время применяют теорию Аррениуса. **Серная кислота** H₂SO₄ — сильная двухосновная кислота.',
  'Скорость реакции растёт с температурой, потому что увеличивается доля активных молекул. Правило Вант-Гоффа: при повышении температуры на 10 °C скорость возрастает в 2–4 раза.\n\n[Kimyo 9, §5, стр. 22]',
  'Периодический закон: свойства элементов находятся в периодической зависимости от заряда ядра. В периоде слева направо металлические свойства ослабевают. В группе сверху вниз — усиливаются.',
  'Полимеры — вещества с очень большой молекулярной массой, молекулы которых состоят из повторяющихся звеньев. Полиэтилен получают полимеризацией этилена. Полиэтилен получают полимеризацией этилена.',
  'Вода — оксид водорода H₂O. Температура кипения 100 °C при нормальном давлении. Молекула полярная, угол между связями 104,5°.\n\n[Kimyo 8, §20, стр. 71]',
  'Электролиз — окислительно-восстановительный процесс под действием постоянного тока. На катоде идёт восстановление, на аноде — окисление. Так получают алюминий из расплава Al₂O₃.',
  'Мыло — натриевые или калиевые соли высших карбоновых кислот. Моющее действие связано с тем, что молекула имеет гидрофильную и гидрофобную части. Данное вещество получают омылением жиров.',
  'Батарейка — гальванический элемент: в ней энергия химической реакции превращается в электрическую. Цинк окисляется на аноде, а на катоде восстанавливается оксид марганца(IV). Напряжение солевого элемента ≈ 1,5 В.',
]
const EN_BOOK = [
  'Oxides are binary compounds of oxygen with oxidation state −2. Metal oxides are usually basic. Non-metal oxides are usually acidic.\n\n[Kimyo 8, §12, p. 40]',
  'A mole contains 6.02·10²³ particles. Molar mass is numerically equal to relative molecular mass. For example, M(CO₂) = 44 g/mol.',
  'Acids dissociate to form hydrogen cations. Sulfuric acid H₂SO₄ is a strong dibasic acid. It is produced by the contact process.',
  'Reaction rate increases with temperature because more molecules have enough energy. Catalysts lower the activation energy.',
  'Polymers are macromolecules built from repeating units. Polyethylene is made by polymerisation of ethylene.\n\n[ATOMLAB: органика]',
]
const UZ_BOOK = [
  'Oksidlar — ikki elementdan tashkil topgan murakkab moddalar, biri kislorod. Metall oksidlari odatda asosli boʻladi. Metallmas oksidlari — kislotali.\n\n[Kimyo 8, §12, 40-bet]',
  'Mol — 6,02·10²³ zarracha tutgan modda miqdori. Molyar massa nisbiy molekulyar massaga son jihatdan teng. Masalan, M(H₂O) = 18 g/mol.',
  'Kislotalar dissotsilanganda vodorod kationlari hosil boʻladi. Sulfat kislota H₂SO₄ — kuchli ikki asosli kislota.',
  'Reaksiya tezligi harorat oshishi bilan ortadi. Katalizator faollanish energiyasini pasaytiradi.',
  'Polimerlar — takrorlanuvchi zvenolardan tuzilgan makromolekulalar. Polietilen etilenni polimerlash orqali olinadi.',
]
const NO_ANSWER: Sample[] = [
  { lang: 'ru', kind: 'noAnswer', query: 'кто выиграл чемпионат мира', text: 'Честно скажу: точного ответа на «кто выиграл чемпионат мира» в моей базе нет, а выдумывать я не буду.' },
  { lang: 'en', kind: 'noAnswer', query: 'who won the world cup', text: 'To be honest, my knowledge base has no exact answer to “who won the world cup”, and I will not make one up.' },
  { lang: 'uz', kind: 'noAnswer', query: 'jahon chempionatini kim yutdi', text: 'Rostini aytsam, «jahon chempionatini kim yutdi» bo‘yicha bazamda aniq javob yo‘q, o‘ylab topmayman.' },
]
const FACTS: Sample[] = [
  { lang: 'ru', kind: 'fact', query: 'что такое валентность', text: '**Валентность** — способность атома образовывать определённое число химических связей. У водорода валентность I, у кислорода — II.' },
  { lang: 'en', kind: 'fact', query: 'what is valence', text: 'Valence is the number of chemical bonds an atom can form. Hydrogen has valence I, oxygen II.' },
  { lang: 'ru', kind: 'fact', query: 'почему железо ржавеет', text: 'Железо ржавеет из-за окисления кислородом воздуха в присутствии влаги. Ржавчина — смесь гидратированных оксидов железа(III).' },
  { lang: 'ru', kind: 'fact', query: 'как работает катализатор', text: 'Катализатор ускоряет реакцию, снижая энергию активации, и сам не расходуется. В автомобиле платина окисляет угарный газ до CO₂.' },
  { lang: 'ru', kind: 'fact', query: 'химия на кухне', text: 'Сода с уксусом даёт углекислый газ — поэтому тесто поднимается. Карамелизация сахара — разложение сахарозы при нагревании.' },
]
const ENCYCLOPEDIA: Sample[] = [
  { lang: 'ru', kind: 'encyclopedia', query: 'кто такой Менделеев', text: 'Дмитрий Иванович Менделеев (1834–1907) — русский химик, автор Периодического закона (1869). Он предсказал свойства галлия, скандия и германия.\n\n[ATOMLAB — учёные]' },
  { lang: 'en', kind: 'encyclopedia', query: 'who was Dalton', text: 'John Dalton (1766–1844) — atomic theory; each element has atoms of a characteristic mass.\n\n[ATOMLAB — учёные]' },
]

const queries = ['что такое оксиды', 'сколько весит моль воды', 'почему кислоты проводят ток', 'почему скорость растёт', 'что такое периодический закон', 'что такое полимеры', 'расскажи о воде', 'как работает электролиз', 'зачем мыло в быту', 'как работает батарейка']
const samples: Sample[] = [
  ...RU_BOOK.map((text, i) => ({ lang: 'ru' as const, kind: 'book' as const, query: queries[i]!, text })),
  ...RU_BOOK.map((text, i) => ({ lang: 'ru' as const, kind: 'book' as const, query: queries[(i + 3) % 10]!, text })),
  ...EN_BOOK.map((text, i) => ({ lang: 'en' as const, kind: 'book' as const, query: ['what are oxides', 'how much is a mole', 'what is an acid', 'why does rate grow', 'what are polymers'][i]!, text })),
  ...EN_BOOK.map((text) => ({ lang: 'en' as const, kind: 'book' as const, query: 'tell me more', text })),
  ...UZ_BOOK.map((text, i) => ({ lang: 'uz' as const, kind: 'book' as const, query: ['oksid nima', 'mol nima', 'kislota nima', 'nega tezlik ortadi', 'polimer nima'][i]!, text })),
  ...UZ_BOOK.map((text) => ({ lang: 'uz' as const, kind: 'book' as const, query: 'batafsil', text })),
  ...NO_ANSWER,
  ...NO_ANSWER,
  ...FACTS,
  ...FACTS,
  ...ENCYCLOPEDIA,
  ...ENCYCLOPEDIA,
]
assert.ok(samples.length >= 60, `нужно ≥ 60 образцов, есть ${samples.length}`)

console.log(`speakLikeHuman: ${samples.length} ответов`)
resetVoiceMemory()
saveProfile({ ...loadProfile(), name: 'Азиз', detail: 0, examples: 0 })
const openersSeen: string[] = []
let nameUses = 0
samples.forEach((s, i) => {
  const out = speakLikeHuman(s.text, { lang: s.lang, kind: s.kind, seed: i, query: s.query, nearTopics: ['Оксиды', 'Кислоты'] })
  // 1) факты сохранены
  const before = factSet(s.text, s.lang)
  const after = factSet(out, s.lang)
  for (const f of before) if (!after.has(f)) fail(`[${i}] потеряно предложение: «${f.slice(0, 60)}…»\n     было: ${s.text}\n     стало: ${out}`)
  // 2) прирост ≤ 25 слов
  const added = words(out) - words(s.text)
  if (added > 25) fail(`[${i}] прирост ${added} слов > 25: ${out}`)
  // 3) подписи целы
  for (const cite of s.text.match(/\[[^\]]+\]/g) ?? []) if (!out.includes(cite)) fail(`[${i}] потеряна подпись ${cite}`)
  // 4) маркдаун сохранён
  for (const bold of s.text.match(/\*\*[^*]+\*\*/g) ?? []) if (!out.includes(bold)) fail(`[${i}] потерян маркдаун ${bold}`)
  // 5) канцелярит снят (RU)
  if (s.lang === 'ru' && /Данное вещество|Следует отметить/.test(out)) fail(`[${i}] канцелярит остался: ${out}`)
  // 6) «не знаю» — честно и с близкими темами
  if (s.kind === 'noAnswer') {
    if (!/Оксиды|Кислоты/.test(out)) fail(`[${i}] «не знаю» без близких тем: ${out}`)
    if (words(out) > words(s.text) + 25) fail(`[${i}] «не знаю» слишком длинное`)
  }
  const opener = out.split(/[.!?:]\s/)[0]!
  openersSeen.push(opener)
  if (out.startsWith('Азиз,')) nameUses += 1
})
// 7) вступление не повторяется подряд в серии из 10 (одна и та же тема, один язык)
resetVoiceMemory()
const series = Array.from({ length: 10 }, (_, k) => speakLikeHuman(RU_BOOK[0]!, { lang: 'ru', kind: 'book', seed: k, query: 'что такое оксиды' }).split('\n')[0]!.split(/(?<=[.!?:])\s/)[0]!)
for (let k = 1; k < series.length; k++) if (series[k] === series[k - 1] && !series[k]!.startsWith('Оксиды')) fail(`повтор вступления подряд: «${series[k]}»`)
// 8) имя — не чаще 1 раза на 3 ответа
if (nameUses > Math.ceil(samples.length / 3)) fail(`имя использовано ${nameUses} раз из ${samples.length}`)
console.log(`  вступления: ${new Set(openersSeen).size} разных; имя: ${nameUses} раз из ${samples.length}`)
// 9) smalltalk — без изменений; пустой ответ — пустой
assert.equal(speakLikeHuman('Привет! Как дела?', { lang: 'ru', kind: 'smalltalk', seed: 1 }), 'Привет! Как дела?')
assert.equal(speakLikeHuman('', { lang: 'ru', kind: 'book', seed: 1 }), '')
// 10) второй вызов не наращивает второе вступление
const once = speakLikeHuman(RU_BOOK[1]!, { lang: 'ru', kind: 'book', seed: 0, query: 'что такое моль' })
const twice = speakLikeHuman(once, { lang: 'ru', kind: 'book', seed: 0, query: 'что такое моль' })
if (words(twice) - words(RU_BOOK[1]!) > 25) fail(`повторный вызов раздул ответ: ${twice}`)
// 11) настроение
const cool = speakLikeHuman(RU_BOOK[2]!, { lang: 'ru', kind: 'book', seed: 4, mood: 'cool' })
if (!/(круто|нравится|впечатляет|том же|удивлять|зацепило|сильно|реакция)/i.test(cool.split('\n')[0]!)) fail(`нет реакции на «круто»: ${cool}`)
// 12) краткий стиль из профиля — без концовки-вопроса
saveProfile({ ...loadProfile(), detail: -2 })
const brief = speakLikeHuman(RU_BOOK[0]!, { lang: 'ru', kind: 'book', seed: 2 })
if (/\?\s*$/.test(brief.replace(/\n\n\[.*\]$/s, ''))) fail(`краткий стиль, а концовка-вопрос есть: ${brief}`)
saveProfile({ ...loadProfile(), detail: 0, name: null })

/* ------------------------------------------------------------ scientistTalk */

console.log(`scientistTalk: учёных в базе — ${SCIENTIST_ENTRIES.length}`)
if (SCIENTIST_ENTRIES.length < 60) fail(`учёных ${SCIENTIST_ENTRIES.length} < 60`)
for (const e of SCIENTIST_ENTRIES) {
  if (!/\d{3,4}\s*[–-]\s*\d{3,4}|род\.\s*\d{4}/.test(e.ru)) fail(`у ${e.id} нет годов жизни в RU`)
  if (!e.en?.trim()) fail(`у ${e.id} нет EN`)
}

const yes: [VoiceLang, string, string][] = [
  ['ru', 'кто такой Менделеев?', 'mendeleev'],
  ['ru', 'расскажи о Менделееве', 'mendeleev'],
  ['ru', 'расскажи про Бутлерова', 'butlerov'],
  ['ru', 'что сделал Ломоносов для химии', 'lomonosov'],
  ['ru', 'Ломоносова', 'lomonosov'],
  ['ru', 'что открыл Лавуазье', 'lavoisier'],
  ['ru', 'чем известен Дальтон', 'dalton'],
  ['ru', 'кто такой Нильс Бор', 'bohr'],
  ['ru', 'кто такая Мария Кюри', 'curie'],
  ['ru', 'вклад Авогадро в химию', 'avogadro'],
  ['ru', 'кто такой Резерфорд', 'rutherford'],
  ['ru', 'расскажи об Аррениусе', 'arrhenius'],
  ['ru', 'кто такой Ибн Сина', 'ibn-sina'],
  ['ru', 'что открыл Фарадей', 'faraday'],
  ['ru', 'кто такой Зелинский', 'zelinsky'],
  ['ru', 'расскажи о Марковникове', 'markovnikov'],
  ['ru', 'кто такой Кекуле', 'kekule'],
  ['ru', 'что сделал Вёлер', 'wohler'],
  ['ru', 'чем знаменит Пристли', 'priestley'],
  ['ru', 'Менделеев', 'mendeleev'],
  ['ru', 'кто такой Габер', 'haber'],
  ['ru', 'расскажи о Семёнове', 'semenov'],
  ['en', 'who was Dalton', 'dalton'],
  ['en', 'tell me about Mendeleev', 'mendeleev'],
  ['en', 'who is Marie Curie', 'curie'],
  ['en', 'what did Lavoisier discover', 'lavoisier'],
  ['en', 'who was Avogadro?', 'avogadro'],
  ['uz', 'Mendeleyev haqida', 'mendeleev'],
  ['uz', 'Lomonosov kim edi', 'lomonosov'],
  ['uz', 'Ibn Sino haqida aytib ber', 'ibn-sina'],
  ['uz', 'Dalton kim', 'dalton'],
]
let seed = 0
for (const [lang, q, id] of yes) {
  const r = scientistTalk(q, lang, seed++)
  if (!r) {
    fail(`нет ответа об учёном: [${lang}] «${q}» (ожидали ${id}); findScientists → ${findScientists(q).map((e) => e.id).join(',') || '—'}`)
    continue
  }
  if (!r.ids.includes(id)) fail(`[${lang}] «${q}»: ожидали ${id}, получили ${r.ids.join(',')}`)
  if (!/\d{3,4}\s*[–-]\s*\d{4}|род\.\s*\d{4}|b\.\s*\d{4}|\(\d{4}/.test(r.text)) fail(`[${lang}] «${q}»: в ответе нет годов: ${r.text}`)
  if (!r.text.includes(SCIENTIST_SIGNATURE)) fail(`[${lang}] «${q}»: нет подписи ${SCIENTIST_SIGNATURE}`)
  const n = splitVoiceSentences(r.text.replace(SCIENTIST_SIGNATURE, '')).filter(Boolean).length
  if (n < 2 || n > 8) fail(`[${lang}] «${q}»: ${n} предложений (ждали 3–5 + вступление/концовка)`)
}
const no: [VoiceLang, string][] = [
  ['ru', 'что такое закон Авогадро'],
  ['ru', 'число Авогадро чему равно'],
  ['ru', 'таблица Менделеева'],
  ['ru', 'правило Марковникова'],
  ['ru', 'что такое бор'],
  ['ru', 'расскажи о воде'],
  ['ru', 'сколько весит моль кислорода'],
  ['ru', 'что такое оксиды'],
  ['ru', 'привет, как дела?'],
  ['ru', 'закон сохранения массы'],
  ['ru', 'как получить аммиак'],
  ['en', 'what is the periodic law'],
  ['en', 'Avogadro constant value'],
  ['uz', 'oksid nima'],
  ['uz', 'Mendeleyev jadvali'],
  ['ru', 'расскажи про бензол'],
]
for (const [lang, q] of no) {
  const r = scientistTalk(q, lang, seed++)
  if (r) fail(`ложное срабатывание: [${lang}] «${q}» → ${r.ids.join(',')}`)
}
// Пример живого ответа
console.log('\n  пример:', scientistTalk('кто такой Бутлеров?', 'ru', 3)!.text.replace(/\n/g, ' | '))
console.log('  пример:', scientistTalk('who was Dalton', 'en', 5)!.text.replace(/\n/g, ' | '))

if (failures) {
  console.error(`\nОШИБОК: ${failures}`)
  process.exit(1)
}
console.log('\nОК: speakLikeHuman и scientistTalk — все проверки зелёные')
