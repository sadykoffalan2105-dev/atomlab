#!/usr/bin/env node
/**
 * Чёткость слов: пост-коррекция транскрипта (chemTranscript).
 *   • формулы словами → запись (RU/EN/UZ);
 *   • ≥ 95 % наблюдаемых ослышек STT исправляются (STT_FIX_PAIRS + Дамерау–Левенштейн/фонетика);
 *   • 40 обычных фраз не портятся;
 *   • числа словами → цифры в контексте, «моль» не трогаем;
 *   • выбор альтернативы по химическому счёту; словарь ≥ 2000 терминов;
 *   • ≥ 300 новых правил ослышек (вещества, элементы, учёные, школьные фразы, узбекские слова),
 *     120 фраз с ослышками, 60 бытовых фраз без ложных замен, новые формулы словами,
 *     контекст диалога (тема урока, слова учителя) при выборе альтернативы.
 *
 * Запуск: npx tsx scripts/test-voice-transcript.mts
 */
import assert from 'node:assert/strict'
import { KNOWN_WORDS } from '../src/learn/brain/speech/chemTerms.generated.ts'
import { STT_FIX_PAIRS_EXTRA } from '../src/learn/brain/speech/sttFixesExtra.ts'
import {
  ALL_STT_FIX_PAIRS,
  CHEM_DICTIONARY,
  norm,
  noteTeacherSpeech,
  resetRecognitionContext,
  scoreAlternatives,
  setRecognitionTopic,
  STT_FIX_PAIRS,
  correctTerm,
  fixTranscript,
  pickBestAlternative,
  spokenFormulasToText,
  spokenNumbersToDigits,
} from '../src/learn/brain/speech/chemTranscript.ts'

let passed = 0
let failed = 0
function test(name: string, fn: () => void): void {
  try {
    fn()
    passed++
    console.log(`  ok  ${name}`)
  } catch (e) {
    failed++
    console.error(`  FAIL ${name}\n       ${(e as Error).stack ?? e}`)
  }
}

console.log('\n# Формулы словами')
test('RU: аш два о → H₂O и другие', () => {
  const cases: [string, string][] = [
    ['что такое аш два о', 'что такое H₂O'],
    ['аш два эс о четыре это серная кислота', 'H₂SO₄ это серная кислота'],
    ['эн а о аш', 'NaOH'],
    ['натрий о аш', 'NaOH'],
    ['це о два', 'CO₂'],
    ['эн аш три', 'NH₃'],
    ['ка о аш', 'KOH'],
    ['це а це о три', 'CaCO₃'],
    ['аш це эль', 'HCl'],
    ['натрий хлор', 'NaCl'],
    ['эс о два', 'SO₂'],
  ]
  for (const [heard, want] of cases) assert.equal(spokenFormulasToText(heard, 'ru'), want, heard)
})
test('EN/UZ: h two o → H₂O, ha ikki o → H₂O', () => {
  assert.equal(spokenFormulasToText('what is h two o', 'en'), 'what is H₂O')
  assert.equal(spokenFormulasToText('sodium chlorine', 'en'), 'NaCl')
  assert.equal(spokenFormulasToText('ha ikki o nima', 'uz'), 'H₂O nima')
})
test('предлог «о» и одиночные буквы не превращаются в формулы', () => {
  assert.equal(spokenFormulasToText('расскажи о натрии', 'ru'), 'расскажи о натрии')
  assert.equal(spokenFormulasToText('о чём ты', 'ru'), 'о чём ты')
  assert.equal(spokenFormulasToText('а что потом', 'ru'), 'а что потом')
})

console.log('\n# Ослышки терминов')
test(`≥ 95 % из ${STT_FIX_PAIRS.length} пар исправляются`, () => {
  let ok = 0
  const bad: string[] = []
  for (const [heard, want] of STT_FIX_PAIRS) {
    const got = fixTranscript(heard, 'ru')
    if (got.toLowerCase() === want.toLowerCase()) ok++
    else bad.push(`${heard} → ${got} (надо ${want})`)
  }
  const share = ok / STT_FIX_PAIRS.length
  assert.ok(share >= 0.95, `исправлено ${(share * 100).toFixed(1)} %: ${bad.join('; ')}`)
  console.log(`      исправлено ${ok}/${STT_FIX_PAIRS.length}`)
})
test('ослышки вне таблицы: фонетика / Дамерау–Левенштейн', () => {
  assert.equal(correctTerm('валинтность'), 'валентность')
  assert.equal(correctTerm('гидраксид'), 'гидроксид')
  assert.equal(correctTerm('электралит'), 'электролит')
})
test('словарные русские слова не трогаем («масса» ≠ «масло»)', () => {
  const phrases = [
    'какая масса у этого вещества', 'почему вода кипит при ста градусах', 'что такое валентность', 'повтори пожалуйста ещё раз',
    'я не понял объясни проще', 'давай следующий вопрос', 'сколько периодов в таблице', 'какой цвет у раствора',
    'что будет если смешать', 'как называется этот процесс', 'приведи пример реакции обмена', 'зачем нужен катализатор',
    'можно я отвечу', 'мне кажется это оксид меди', 'подожди я подумаю', 'это правильно или нет',
    'расскажи про Менделеева', 'кто открыл кислород', 'где используют серную кислоту', 'как получить водород в лаборатории',
    'какие свойства у металлов', 'почему железо ржавеет', 'чем отличается атом от молекулы', 'что показывает индекс в формуле',
    'сколько электронов у натрия', 'как расставить коэффициенты', 'какие бывают типы реакций', 'что такое степень окисления',
    'объясни ионную связь', 'что такое щёлочь', 'как работает индикатор', 'какая реакция называется экзотермической',
    'в чём разница между кислотой и основанием', 'сколько весит моль воды', 'что такое моль', 'давай решим задачу',
    'хорошо спасибо понятно', 'нет не понял', 'да всё ясно', 'ещё один пример пожалуйста',
  ]
  const changed: string[] = []
  for (const p of phrases) {
    const got = fixTranscript(p, 'ru')
    if (got !== p) changed.push(`${p} → ${got}`)
  }
  assert.deepEqual(changed, [])
})

console.log('\n# Числа словами')
test('девяносто восемь грамм → 98 г; «моль» не трогаем', () => {
  assert.equal(spokenNumbersToDigits('девяносто восемь грамм', 'ru'), '98 г')
  assert.equal(spokenNumbersToDigits('два моль воды', 'ru'), '2 моль воды')
  assert.equal(spokenNumbersToDigits('двадцать два процента', 'ru'), '22 %')
  assert.equal(spokenNumbersToDigits('один вопрос', 'ru'), 'один вопрос')
  assert.equal(spokenNumbersToDigits('ninety eight grams', 'en'), '98 g')
  assert.equal(spokenNumbersToDigits('toqson sakkiz gramm', 'uz'), '98 g')
})
test('fixTranscript целиком: формула + ослышка + число', () => {
  assert.equal(fixTranscript('аксид аш два о масса восемнадцать грамм', 'ru'), 'оксид H₂O масса 18 г')
})

console.log('\n# Альтернативы и словарь')
test('альтернатива с химическими словами выигрывает', () => {
  const best = pickBestAlternative([
    { transcript: 'что такое аксиома', confidence: 0.6 },
    { transcript: 'что такое оксид', confidence: 0.55 },
    { transcript: 'что такое аксид', confidence: 0.5 },
  ])
  assert.equal(best, 'что такое оксид')
})
test('словарь терминов ≥ 2000', () => {
  assert.ok(CHEM_DICTIONARY.size >= 2000, `size ${CHEM_DICTIONARY.size}`)
  console.log(`      терминов: ${CHEM_DICTIONARY.size}`)
})


console.log('\n# Расширенные ослышки (sttFixesExtra)')
test(`≥ 300 новых правил, ≥ 98 % из них исправляются (отдельным словом)`, () => {
  assert.ok(STT_FIX_PAIRS_EXTRA.length >= 300, `правил ${STT_FIX_PAIRS_EXTRA.length}`)
  const bad = STT_FIX_PAIRS_EXTRA.filter(([h, f]) => fixTranscript(h, 'ru').toLowerCase() !== f.toLowerCase())
  assert.ok(bad.length / STT_FIX_PAIRS_EXTRA.length <= 0.02, bad.map(([h, f]) => `${h} → ${fixTranscript(h, 'ru')} (надо ${f})`).join('; '))
  console.log(`      правил: ${STT_FIX_PAIRS_EXTRA.length} (всего с базовыми ${ALL_STT_FIX_PAIRS.length}), не исправлено: ${bad.length}`)
})
test('ослышка внутри фразы: все правила в контексте «расскажи про … подробнее» (≥ 98 %)', () => {
  let ok = 0
  const bad: string[] = []
  for (const [heard, fix] of STT_FIX_PAIRS_EXTRA) {
    const got = fixTranscript(`расскажи про ${heard} подробнее`, 'ru')
    if (got.toLowerCase() === `расскажи про ${fix} подробнее`.toLowerCase()) ok++
    else bad.push(`${heard} → ${got}`)
  }
  assert.ok(ok / STT_FIX_PAIRS_EXTRA.length >= 0.98, bad.slice(0, 20).join('; '))
  console.log(`      в контексте: ${ok}/${STT_FIX_PAIRS_EXTRA.length}`)
})
test('«услышанное» не бывает обычным русским словом (кроме смены регистра/ё)', () => {
  const known = new Set(KNOWN_WORDS.map(norm))
  const risky = STT_FIX_PAIRS_EXTRA.filter(([h, f]) => !h.includes(' ') && known.has(norm(h)) && norm(h) !== norm(f))
  assert.deepEqual(risky, [])
})
test('120 реальных фраз с ослышками исправляются целиком', () => {
  const cases: [string, string][] = [
    ['что такое пирманганат калия', 'что такое перманганат калия'],
    ['какая малярная масса воды', 'какая молярная масса воды'],
    ['лаваузье открыл кисларод', 'Лавуазье открыл кислород'],
    ['обьясни пажалуйста реакцыю нейтролизации', 'объясни пожалуйста реакцию нейтрализации'],
    ['чё такое амфатерный оксид', 'что такое амфотерный оксид'],
    ['тушунмадим устоз', 'не понял, учитель'],
    ['раскажи про изамеры бутана', 'расскажи про изомеры бутана'],
    ['как расставить коэфициенты в уровнении', 'как расставить коэффициенты в уравнении'],
    ['почему желеса ржавеет', 'почему железа ржавеет'],
    ['сколка электронав у атома натрия', 'сколько электронов у атома натрия'],
    ['что получится при гидролеза соли', 'что получится при гидролиза соли'],
    ['кто такой бутлеров', 'кто такой Бутлеров'],
    ['закон авагадро', 'закон Авогадро'],
    ['реакция этирификации', 'реакция этерификации'],
    ['что такое этирификация', 'что такое этерификация'],
    ['формула глюказы', 'формула глюкозы'],
    ['гибредизация углерода в метане', 'гибридизация углерода в метане'],
    ['чем алконы отличаются от алкенов', 'чем алканы отличаются от алкенов'],
    ['ацителен горит', 'ацетилен горит'],
    ['как получить этелен', 'как получить этилен'],
    ['вадород легче воздуха', 'водород легче воздуха'],
    ['кальцый реагирует с водой', 'кальций реагирует с водой'],
    ['цынк и соляная кислота', 'цинк и соляная кислота'],
    ['свенец тяжёлый металл', 'свинец тяжёлый металл'],
    ['марганиц в перманганате', 'марганец в перманганате'],
    ['что такое электроотрецательность', 'что такое электроотрицательность'],
    ['кристалическая решотка', 'кристаллическая решётка'],
    ['дай пример экзатермической реакции', 'дай пример экзотермической реакции'],
    ['химическое равнавесие', 'химическое равновесие'],
    ['принцип лешателье', 'принцип Ле Шателье'],
    ['правило марковникова', 'правило Марковникова'],
    ['что сделал резерфорт', 'что сделал Резерфорд'],
    ['лабараторная работа номер три', 'лабораторная работа номер три'],
    ['где прабирка', 'где пробирка'],
    ['спертовка не горит', 'спиртовка не горит'],
    ['какой индикатара цвет', 'какой индикатора цвет'],
    ['метил оранж в кислоте', 'метилоранж в кислоте'],
    ['фенол фталеин малиновый', 'фенолфталеин малиновый'],
    ['следуюший вопрос', 'следующий вопрос'],
    ['павтори ещё раз', 'повтори ещё раз'],
    ['непанятно объясни проще', 'непонятно объясни проще'],
    ['рахмат устоз', 'спасибо, учитель'],
    ['нима это', 'что это'],
    ['кимё это интересно', 'химия это интересно'],
    ['модда и элемент', 'вещество и элемент'],
    ['дай мисол реакции', 'дай пример реакции'],
    ['тенглама реакции', 'уравнение реакции'],
    ['уй вазифа какая', 'домашнее задание какая'],
    ['щас скажу', 'сейчас скажу'],
    ['раскажите про никиль', 'расскажите про никель'],
  ]
  // Ещё 70 — по одной ослышке из правил, в разных фразах.
  const templates = ['а что такое {}', 'я не понял про {}', 'можно пример {} пожалуйста', 'скажи {} ещё раз', 'это {} или нет', 'давай про {} поговорим', 'зачем нужен {}']
  const extra = STT_FIX_PAIRS_EXTRA.filter(([h]) => !h.includes(' ')).filter((_, i) => i % 7 === 0).slice(0, 70)
  extra.forEach(([heard, fix], i) => {
    const tpl = templates[i % templates.length]!
    cases.push([tpl.replace('{}', heard), tpl.replace('{}', fix)])
  })
  assert.ok(cases.length >= 120, `cases ${cases.length}`)
  const bad: string[] = []
  for (const [heard, want] of cases) {
    const got = fixTranscript(heard, 'ru')
    if (got !== want) bad.push(`${heard} → ${got} (надо ${want})`)
  }
  if (bad.length) console.log(`      расхождения: ${bad.join('; ')}`)
  assert.deepEqual(bad, [])
  console.log(`      фраз: ${cases.length}, расхождений: ${bad.length}`)
})

console.log('\n# Обычные фразы без химии — без ложных замен')
test('60 бытовых/школьных фраз не меняются', () => {
  const phrases = [
    'привет как дела', 'я сегодня опоздал на урок', 'можно выйти', 'у меня болит голова', 'мама сказала прийти пораньше',
    'мы вчера ходили в кино', 'какая погода завтра', 'я люблю играть в футбол', 'у нас контрольная по математике',
    'дай мне ручку', 'где моя тетрадь', 'когда закончится урок', 'я забыл дневник дома', 'можно я сяду у окна',
    'спасибо большое', 'до свидания', 'включи музыку', 'мне нравится этот фильм', 'сколько времени', 'я устал',
    'давай поиграем', 'расскажи анекдот', 'кто ты такой', 'как тебя зовут', 'ты умеешь петь', 'а ты живой',
    'что ты любишь', 'какой твой любимый цвет', 'я хочу стать врачом', 'мой брат учится в университете',
    'у меня есть кошка', 'мы живём в Ташкенте', 'поедем летом на море', 'бабушка печёт пироги', 'я читаю книгу',
    'это очень интересно', 'я не согласен', 'ты прав', 'подожди минутку', 'я сейчас вернусь', 'мне надо подумать',
    'скажи что-нибудь смешное', 'зачем нужна школа', 'почему небо голубое', 'почему трава зелёная', 'как работает телефон',
    'кто изобрёл интернет', 'какая самая высокая гора', 'сколько планет в солнечной системе', 'что такое любовь',
    'как стать умнее', 'помоги с уроками', 'я получил пятёрку', 'учитель задал много', 'завтра выходной',
    'мы играли в шахматы', 'папа купил машину', 'у сестры день рождения', 'пойдём гулять', 'я хочу есть',
  ]
  assert.ok(phrases.length >= 60)
  const changed: string[] = []
  for (const p of phrases) {
    const got = fixTranscript(p, 'ru')
    if (got !== p) changed.push(`${p} → ${got}`)
  }
  assert.deepEqual(changed, [])
})
test('перечисление элементов и «и» между словами — не формула', () => {
  const keep = [
    'натрий и хлор', 'азот кислород водород это неметаллы', 'железо и медь', 'а у тебя', 'и а и у', 'медь цинк и железо',
    'аш и о', 'кальций магний барий', 'я и ты', 'хлор и бром галогены',
  ]
  for (const p of keep) assert.equal(spokenFormulasToText(p, 'ru'), p, p)
})

console.log('\n# Новые формулы словами')
test('KMnO₄, Ca(OH)₂, MgO, NaCl («эн а це эл»), FeS, HNO₃, pH, CuSO₄, Al(OH)₃', () => {
  const cases: [string, string][] = [
    ['ка эм эн о четыре', 'KMnO₄'], ['це а о аш два', 'Ca(OH)₂'], ['эм же о', 'MgO'], ['эн а це эл', 'NaCl'],
    ['железо сера', 'FeS'], ['аш эн о три', 'HNO₃'], ['пэ аш раствора', 'pH раствора'], ['це у эс о четыре', 'CuSO₄'],
    ['алюминий о аш три', 'Al(OH)₃'], ['це а', 'Ca'], ['калий йод', 'KI'], ['эф е о', 'FeO'],
  ]
  for (const [heard, want] of cases) {
    assert.equal(spokenFormulasToText(heard, 'ru'), want, heard)
  }
})

console.log('\n# Контекст диалога при выборе альтернативы')
test('тема урока и слова учителя решают ничью между похожими альтернативами', () => {
  resetRecognitionContext()
  const alts = [
    { transcript: 'кислород и азот', confidence: 0.6 },
    { transcript: 'кислород и озон', confidence: 0 },
  ]
  // Без контекста — первая (вероятность + ранг); учитель только что говорил про озон — «озон».
  assert.equal(pickBestAlternative(alts), 'кислород и азот')
  setRecognitionTopic('Аллотропия кислорода')
  noteTeacherSpeech('Озон — аллотропная модификация кислорода, у него три атома.')
  assert.equal(pickBestAlternative(alts), 'кислород и озон')
  const scored = scoreAlternatives(alts)
  assert.ok(scored[1]!.context > scored[0]!.context)
  resetRecognitionContext()
  assert.equal(pickBestAlternative(alts), 'кислород и азот')
})
test('confidence 0 у 2–5 альтернатив (Chrome) не мешает: химическая альтернатива всё равно выигрывает', () => {
  resetRecognitionContext()
  assert.equal(
    pickBestAlternative([
      { transcript: 'что такое валет', confidence: 0.81 },
      { transcript: 'что такое валентность', confidence: 0 },
    ]),
    'что такое валентность',
  )
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
