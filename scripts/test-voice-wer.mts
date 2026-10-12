#!/usr/bin/env node
/**
 * WER / CER оценки распознавания (scripts/voice/wer.mts): 15 пар «эталон → распознано» с известным WER,
 * нормализация узбекских апострофов, числа словами ↔ цифрами (ru / uz / en), формулы через fixTranscript,
 * корпусная агрегация по группам.
 *
 * Запуск: npm run test:voice-wer   (npx tsx scripts/test-voice-wer.mts)
 */
import assert from 'node:assert/strict'
import { aggregate, cer, chemExact, digitsToWords, normalizeText, wer, wordsToDigits, type WerLang } from './voice/wer.mts'

let passed = 0
let failed = 0
function test(name: string, fn: () => void): void {
  try {
    fn()
    passed++
    console.log(`  ok  ${name}`)
  } catch (e) {
    failed++
    console.error(`  FAIL ${name}\n       ${(e as Error).message}`)
  }
}

const near = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`)

/** [язык, эталон, распознано, ожидаемый WER, (необязательно) вариант] */
const PAIRS: [WerLang, string, string, number, string?][] = [
  ['ru', 'что такое валентность', 'Что такое валентность?', 0],
  ['ru', 'объясни ещё раз помедленнее', 'Объясни еще раз, помедленнее.', 0],
  ['ru', 'что такое валентность', 'что такое ценность', 1 / 3],
  ['ru', 'спасибо, всё понятно', 'спасибо понятно', 1 / 3],
  ['ru', 'стоп', 'стоп стоп', 1],
  ['ru', 'ответ сорок четыре грамма', 'ответ 44 грамма', 0],
  ['ru', 'массовая доля равна двенадцати процентам', 'массовая доля равна 12 процентам', 0, 'digits'],
  ['ru', 'аш два о это вода', 'H₂O это вода', 0, 'chem'],
  ['uz', 'suvning molyar massasi oʻn sakkiz gramm', "suvning molyar massasi o'n sakkiz gramm", 0, 'plain'],
  ['uz', 'to’xta', 'to`xta', 0, 'plain'],
  ['uz', "javob qirq to'rt gramm", 'javob 44 gramm', 0],
  ['en', 'the answer is forty four grams', 'The answer is 44 grams.', 0],
  ['en', 'twenty five grams of salt in one hundred grams of water', '25 grams of salt in 100 grams of water', 0],
  ['en', 'what is the valence of oxygen', 'what is the balance of oxygen', 1 / 6],
  ['en', 'next question', '', 1],
]

console.log('WER: 15 пар с известными значениями')
for (const [lang, ref, hyp, expected, variant] of PAIRS) {
  test(`${lang}: «${ref}» ← «${hyp}» = ${(expected * 100).toFixed(1)}%`, () => {
    const r = wer(ref, hyp, lang)
    near(r.wer, expected, `WER (вариант ${r.variant}: «${r.ref}» / «${r.hyp}»)`)
    if (variant) assert.equal(r.variant, variant, `вариант нормализации`)
  })
}

console.log('нормализация')
test('узбекские апострофы ʻ ʼ ’ ‘ ` → одинаковые', () => {
  const forms = ['oʻn', 'oʼn', 'o’n', 'o‘n', 'o`n', "o'n"]
  for (const f of forms) assert.equal(normalizeText(f), "o'n", f)
  assert.equal(normalizeText("'kislorod'"), 'kislorod', 'кавычки-апострофы по краям слова убираются')
})
test('пунктуация, регистр, ё, подстрочные цифры', () => {
  assert.equal(normalizeText('Ёж, H₂SO₄ — кислота!'), 'еж h2so4 кислота')
})
test('цифры → слова (ru / uz / en)', () => {
  assert.equal(digitsToWords('18 грамм', 'ru'), 'восемнадцать грамм')
  assert.equal(digitsToWords('125', 'ru'), 'сто двадцать пять')
  assert.equal(digitsToWords('2000', 'ru'), 'две тысячи')
  assert.equal(digitsToWords('18 gramm', 'uz'), "o'n sakkiz gramm")
  assert.equal(digitsToWords('244', 'uz'), "ikki yuz qirq to'rt")
  assert.equal(digitsToWords('100 degrees', 'en'), 'one hundred degrees')
})
test('слова → цифры (с падежами ru)', () => {
  assert.equal(wordsToDigits('двадцать пять грамм соли в ста граммах', 'ru'), '25 грамм соли в 100 граммах')
  assert.equal(wordsToDigits('восемнадцати', 'ru'), '18')
  assert.equal(wordsToDigits("yigirma besh gramm", 'uz'), '25 gramm')
  assert.equal(wordsToDigits('one hundred and twenty', 'en'), '100 and 20')
  assert.equal(wordsToDigits('two thousand five hundred', 'en'), '2500')
})
test('CER по символам', () => {
  near(cer('кислород', 'кеслород'), 1 / 8, 'CER')
  near(cer('', ''), 0, 'пусто/пусто')
})
test('пустые строки: тишина распознана как тишина = 0, вставка в тишину = 1', () => {
  near(wer('', '', 'ru').wer, 0, 'пусто/пусто')
  near(wer('', 'шум', 'ru').wer, 1, 'пусто/текст')
})
test('формулы: точное совпадение после fixTranscript', () => {
  assert.ok(chemExact('аш два эс о четыре это кислота', 'H2SO4 это кислота', 'ru'))
  assert.ok(!chemExact('аш два о это вода', 'аш три о это вода', 'ru'))
})
test('агрегация: корпусный WER по языкам', () => {
  const g = aggregate(
    [
      { id: 'a', lang: 'ru', variant: 'clean', cat: 'q', ref: 'один два три четыре', hyp: 'один два три' },
      { id: 'b', lang: 'ru', variant: 'clean', cat: 'q', ref: 'пять шесть', hyp: 'пять шесть' },
      { id: 'c', lang: 'en', variant: 'clean', cat: 'q', ref: 'stop', hyp: 'top' },
    ],
    (r) => r.lang,
  )
  assert.equal(g.length, 2)
  const ru = g.find((x) => x.key === 'ru')!
  assert.equal(ru.refWords, 6)
  near(ru.wer, 1 / 6, 'ru')
  near(g.find((x) => x.key === 'en')!.wer, 1, 'en')
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
