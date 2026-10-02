#!/usr/bin/env node
/**
 * Чёткость слов: пост-коррекция транскрипта (chemTranscript).
 *   • формулы словами → запись (RU/EN/UZ);
 *   • ≥ 95 % наблюдаемых ослышек STT исправляются (STT_FIX_PAIRS + Дамерау–Левенштейн/фонетика);
 *   • 40 обычных фраз не портятся;
 *   • числа словами → цифры в контексте, «моль» не трогаем;
 *   • выбор альтернативы по химическому счёту; словарь ≥ 2000 терминов.
 *
 * Запуск: npx tsx scripts/test-voice-transcript.mts
 */
import assert from 'node:assert/strict'
import {
  CHEM_DICTIONARY,
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

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
