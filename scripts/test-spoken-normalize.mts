/**
 * Понимание живой, надиктованной речи: spokenNormalize (src/learn/brain/human/spokenNormalize.ts).
 *   1) 80 надиктованных фраз (RU/EN/UZ: заполнители, хвосты «да?», повторы, числа словами, без пунктуации)
 *      → канонический вопрос (сравнение по spokenKey);
 *   2) 40 из них через humanTurn / answerFromQaBank дают то же намерение и те же числа/сущность,
 *      что и чистая формулировка.
 *
 *   npx tsx scripts/test-spoken-normalize.mts
 */
import { readFileSync } from 'node:fs'
import { spokenNormalize, spokenKey } from '../src/learn/brain/human/spokenNormalize.ts'
import { humanTurn, setHumanClock, setHumanRandom, setMemoryProfileBackend } from '../src/learn/brain/human/index.ts'
import { answerFromQaBank, setQaBank } from '../src/learn/brain/qa/qaBank.ts'
import type { QaBank } from '../src/learn/brain/qa/qaBankTypes.ts'

setMemoryProfileBackend()
setHumanClock(() => new Date(2026, 9, 2, 10, 0))
setQaBank(JSON.parse(readFileSync(new URL('../src/data/teacher/qaBank.json', import.meta.url), 'utf8')) as QaBank)

type Lang = 'ru' | 'en' | 'uz'
/** [надиктовано, канонический вопрос, язык, слой для сравнения ответа] */
type Row = [string, string, Lang, 'human' | 'qa' | null]

const rows: Row[] = [
  // ---- RU: заполнители
  ['э… ну… это самое… короче, что такое моль, да?', 'что такое моль?', 'ru', null],
  ['ну типа что такое оксид', 'что такое оксид?', 'ru', null],
  ['слушай скажи а что такое что такое оксид', 'что такое оксид', 'ru', null],
  ['э как бы в общем какая валентность у железа понимаешь', 'какая валентность у железа?', 'ru', 'qa'],
  ['блин я устал', 'я устал', 'ru', 'human'],
  ['ну вот значит я не выспался', 'я не выспался', 'ru', 'human'],
  ['короче мне скучно', 'мне скучно', 'ru', 'human'],
  ['эм привет', 'привет', 'ru', 'human'],
  ['ну здравствуйте учитель', 'здравствуйте учитель', 'ru', 'human'],
  ['это самое спасибо большое', 'спасибо большое', 'ru', 'human'],
  ['слушай а какая формула у серной кислоты а', 'какая формула у серной кислоты?', 'ru', 'qa'],
  ['скажи мне молярная масса воды', 'молярная масса воды', 'ru', 'qa'],
  ['подскажи молярную массу H2SO4 ну', 'молярную массу H2SO4', 'ru', 'human'],
  ['так, э, расскажи про железо', 'расскажи про железо', 'ru', 'human'],
  ['ну расскажи про натрий да', 'расскажи про натрий?', 'ru', 'human'],
  ['типа кто ты', 'кто ты', 'ru', 'human'],
  ['э ты робот или человек а', 'ты робот или человек?', 'ru', 'human'],
  ['ну сколько тебе лет', 'сколько тебе лет', 'ru', 'human'],
  ['в общем я хочу есть', 'я хочу есть', 'ru', 'human'],
  ['блин у меня болит голова', 'у меня болит голова', 'ru', 'human'],
  // ---- RU: хвосты и повторы
  ['вода это оксид, да?', 'вода это оксид?', 'ru', null],
  ['соль растворяется в воде, правильно?', 'соль растворяется в воде?', 'ru', null],
  ['кислород это газ, так?', 'кислород это газ?', 'ru', null],
  ['что такое что такое кислота', 'что такое кислота', 'ru', null],
  ['молярная молярная масса воды', 'молярная масса воды', 'ru', 'qa'],
  ['что такое окси оксид', 'что такое оксид', 'ru', null],
  ['формула формула хлорида натрия', 'формула хлорида натрия', 'ru', 'qa'],
  ['расскажи расскажи про кальций', 'расскажи про кальций', 'ru', 'human'],
  ['как дела как дела', 'как дела', 'ru', 'human'],
  ['какая валентность у у кислорода', 'какая валентность у кислорода?', 'ru', 'qa'],
  // ---- RU: числа словами и единицы
  ['сколько весит двести грамм воды', 'сколько весит 200 г воды', 'ru', null],
  ['два моль кислорода это сколько грамм', '2 моль кислорода это сколько грамм', 'ru', null],
  ['масса трех моль воды', 'масса 3 моль воды', 'ru', 'human'],
  ['пятьдесят грамм соли', '50 г соли', 'ru', null],
  ['что проходят в восьмом классе', 'что проходят в 8 классе', 'ru', 'qa'],
  ['я учусь в седьмом классе', 'я учусь в 7 классе', 'ru', 'human'],
  ['двадцать пять плюс семнадцать', '25 плюс 17', 'ru', 'human'],
  ['сто грамм', '100 г', 'ru', null],
  ['один вопрос можно', 'один вопрос можно', 'ru', null],
  ['аш два о это вода да', 'аш два о это вода?', 'ru', null],
  // ---- RU: без пунктуации и регистра (STT)
  ['какая молярная масса у углекислого газа', 'какая молярная масса у углекислого газа?', 'ru', 'qa'],
  ['с чем реагирует натрий', 'с чем реагирует натрий', 'ru', 'qa'],
  ['что получится из цинка и соляной кислоты', 'что получится из цинка и соляной кислоты?', 'ru', 'qa'],
  ['как получить кислород ну', 'как получить кислород?', 'ru', 'qa'],
  ['ну что такое валентность', 'что такое валентность?', 'ru', null],
  ['где находится в таблице железо', 'где находится в таблице железо?', 'ru', 'qa'],
  ['в каком классе изучают серную кислоту', 'в каком классе изучают серную кислоту', 'ru', 'qa'],
  ['электронная конфигурация натрия э', 'электронная конфигурация натрия', 'ru', 'qa'],
  ['атомная масса железа, значит', 'атомная масса железа', 'ru', 'qa'],
  ['ну это, кто тебя создал', 'кто тебя создал', 'ru', 'human'],
  // ---- EN
  ['um what is like the molar mass of water you know', 'what is the molar mass of water?', 'en', 'qa'],
  ['so uh tell me what is an acid right', 'what is an acid?', 'en', null],
  ['uh i mean hello', 'hello', 'en', 'human'],
  ["um i'm hungry", "i'm hungry", 'en', 'human'],
  ['like how old are you huh', 'how old are you?', 'en', 'human'],
  ['so, um, what is the formula of sulfuric acid', 'what is the formula of sulfuric acid?', 'en', 'qa'],
  ['what are the products of twenty five grams of zinc', 'what are the products of 25 g of zinc?', 'en', null],
  ['two moles of oxygen', '2 moles of oxygen', 'en', null],
  ['basically are you a robot or a human', 'are you a robot or a human', 'en', 'human'],
  ['hmm molar mass of carbon dioxide ok', 'molar mass of carbon dioxide?', 'en', 'qa'],
  ['what what is an oxide', 'what is an oxide', 'en', null],
  ['tell me about iron um', 'about iron', 'en', 'human'],
  ['you know i am so tired', 'i am so tired', 'en', 'human'],
  ['erm what does sodium react with', 'what does sodium react with?', 'en', 'qa'],
  ['teacher, electron configuration of sodium', 'electron configuration of sodium', 'en', 'qa'],
  // ---- UZ
  ['xo‘sh demak mol nima a', 'mol nima?', 'uz', null],
  ['ya’ni suv molyar massasi', 'suv molyar massasi', 'uz', 'qa'],
  ['anavi, salom ustoz', 'salom ustoz', 'uz', 'human'],
  ['ikki mol kislorod', '2 mol kislorod', 'uz', null],
  ['demak charchadim', 'charchadim', 'uz', 'human'],
  ['xullas sen tirikmisan', 'sen tirikmisan', 'uz', 'human'],
  ['oltingugurt kislotasining formulasi qanday, to‘g‘rimi', 'oltingugurt kislotasining formulasi qanday?', 'uz', 'qa'],
  ['hali, qornim och', 'qornim och', 'uz', 'human'],
  ['natriy nima bilan reaksiyaga kirishadi demak', 'natriy nima bilan reaksiyaga kirishadi', 'uz', 'qa'],
  ['xo‘sh xo‘sh seni kim yaratdi', 'seni kim yaratdi', 'uz', 'human'],
  ['endi temir haqida', 'temir haqida', 'uz', 'human'],
  ['yigirma besh gramm tuz', '25 gramm tuz', 'uz', null],
  ['mana, rahmat', 'rahmat', 'uz', 'human'],
  ['bilasizmi suv formulasi nima', 'suv formulasi nima?', 'uz', 'qa'],
  ['ustoz, kislorod molyar massasi a', 'kislorod molyar massasi?', 'uz', 'qa'],
]

let fail = 0
let n1 = 0
for (const [noisy, clean] of rows) {
  n1++
  const got = spokenNormalize(noisy)
  if (spokenKey(got) !== spokenKey(clean)) {
    fail++
    console.error(`✗ «${noisy}» → «${got}», ожидалось «${clean}»`)
  }
}
console.log(`✓ нормализация: ${n1 - fail} из ${n1} фраз → канонический вопрос`)

let n2 = 0
let fail2 = 0
for (const [noisy, clean, lang, layer] of rows) {
  if (!layer) continue
  n2++
  if (layer === 'human') {
    let seed = 11
    setHumanRandom(() => ((seed = (seed * 16807) % 2147483647) / 2147483647))
    const a = humanTurn(noisy, { lang })
    seed = 11
    const b = humanTurn(clean, { lang })
    const ia = a ? (a.kind === 'reply' ? a.intent : `prefix:${a.intents.join('+')}`) : 'null'
    const ib = b ? (b.kind === 'reply' ? b.intent : `prefix:${b.intents.join('+')}`) : 'null'
    const na = a?.kind === 'reply' ? JSON.stringify(a.numbers ?? null) : ''
    const nb = b?.kind === 'reply' ? JSON.stringify(b.numbers ?? null) : ''
    if (ia !== ib || na !== nb || ib === 'null') {
      fail2++
      console.error(`✗ humanTurn: «${noisy}» → ${ia} ${na}; чистая «${clean}» → ${ib} ${nb}`)
    }
  } else {
    const a = await answerFromQaBank(noisy, { lang, grade: 8, lastEntity: null })
    const b = await answerFromQaBank(clean, { lang, grade: 8, lastEntity: null })
    const key = (x: typeof a) => (x ? `${x.intent}|${x.entity ? `${x.entity.kind}:${x.entity.key}` : ''}|${JSON.stringify(x.numbers ?? null)}` : 'null')
    if (key(a) !== key(b) || !b) {
      fail2++
      console.error(`✗ qa: «${noisy}» → ${key(a)}; чистая «${clean}» → ${key(b)}`)
    }
  }
}
console.log(`✓ тот же ответ, что у чистой формулировки: ${n2 - fail2} из ${n2}`)

const ok = rows.length >= 80 && fail === 0 && n2 >= 40 && fail2 === 0
console.log(`\nФраз: ${rows.length}, сравнений ответов: ${n2}. Ошибок: ${fail + fail2}.`)
console.log(ok ? 'TEST OK' : 'TEST FAILED')
process.exit(ok ? 0 : 1)
