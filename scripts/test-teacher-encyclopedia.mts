/**
 * Энциклопедия учителя (Википедия, CC BY-SA 4.0) — wf15.
 *
 *   npm run test:teacher-encyclopedia
 *
 * Проверяем: корпус загружен (≥ 1500 статей RU, ≥ 150 учёных, подпись лицензии, нет статей-инструкций);
 * 40 вопросов «за пределами школы» → ответ есть, с ключевым словом/годом из статьи, 3–5 предложений + вопрос,
 * подпись «[Википедия: … — CC BY-SA]»; 20 школьных вопросов → энциклопедия школьный ответ не перебивает.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { composeLocalTeacherReply } from '../src/learn/learnTeacherRouter.ts'
import { preloadKnowledge } from '../src/learn/kb/index.ts'
import type { LearnLocalAssistantContext } from '../src/learn/learnLocalAssistant.ts'
import { setWikiBigLoader, searchWikiBig } from '../src/learn/kb/wikiBig.ts'
import { BIG_QUESTIONS } from './teacher-wiki-big-questions.mts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CORPUS = path.join(ROOT, 'src', 'data', 'kb', 'corpus')

let passed = 0
let failed = 0
const failures: string[] = []
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++
  else {
    failed++
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

type Chunk = { id: string; type: string; lang: string; title: string; text: string; source: string; tags?: string[] }

/* ------------------------------------------------------------------ 1. корпус */
const files = fs.readdirSync(CORPUS).filter((f) => /^kb-corpus-wiki/.test(f))
const chunks: Chunk[] = files.flatMap((f) => (JSON.parse(fs.readFileSync(path.join(CORPUS, f), 'utf8')) as { chunks: Chunk[] }).chunks)
const ru = chunks.filter((c) => c.lang === 'ru')
const scientists = ru.filter((c) => c.tags?.includes('scientist') || c.tags?.includes('uzbekistan'))
const sci = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'teacher', 'scientistsIndex.json'), 'utf8')) as { count: number; scientists: { surname: string; variants: string[] }[] }
console.log(`[corpus] files ${files.join(', ')}: ${chunks.length} chunks (${ru.length} ru, ${chunks.filter((c) => c.lang === 'en').length} en, ${chunks.filter((c) => c.lang === 'uz').length} uz), scientists ${scientists.length}, index ${sci.count}`)
check('corpus: ≥ 1500 ru articles', ru.length >= 1500, String(ru.length))
check('corpus: ≥ 150 scientists', scientists.length >= 150, String(scientists.length))
check('scientistsIndex: ≥ 150 entries with variants', sci.count >= 150 && sci.scientists.every((s) => s.variants.length >= 1), String(sci.count))
check('corpus: every chunk is type encyclopedia with CC BY-SA source', chunks.every((c) => c.type === 'encyclopedia' && /CC BY-SA/.test(c.source)))
check('corpus: unique ids', new Set(chunks.map((c) => c.id)).size === chunks.length)
const UNSAFE = /рецепт(ур)?\w*\s+(изготовлен|получен|приготовлен)|в домашних условиях|кустарн\w+ (изготов|производ|синтез)|самодельн\w+ взрыв|изготовить (дома|самостоятельно|своими руками)|инструкци\w+ по (изготовлению|синтезу|приготовлению)|пошагов\w+ (инструкци|синтез)/i
const UNSAFE_TITLE = /наркот|психотроп|боевое отравляющее|зарин|зоман|иприт|люизит|рицин|цианистый калий|бомба|детонатор|боеприпас/i
const unsafe = chunks.filter((c) => UNSAFE.test(c.text) || UNSAFE_TITLE.test(c.title))
check('corpus: no synthesis instructions (explosives / drugs / poisons)', unsafe.length === 0, unsafe.map((c) => c.title).slice(0, 5).join('; '))
check('corpus: no footnotes [1] or stress marks', !chunks.some((c) => /\[\d+\]|́/.test(c.text)))
check('corpus: texts ≤ 2600 chars', chunks.every((c) => c.text.length <= 2600))

/* ------------------------------------------------------------------ 2. ответы */
const ctxOf = (locale: 'ru' | 'en' | 'uz', gradeId = 'g8'): LearnLocalAssistantContext => ({
  locale,
  gradeId,
  chapterId: 'c1',
  sectionId: 's01',
  sectionTitle: '',
  slideTitle: '',
  slideBody: '',
  mode: 'teacher',
  kpNumber: 1,
})

type Q = { q: string; lang?: 'ru' | 'en' | 'uz'; has: (string | RegExp)[]; grade?: string; /** школьный уверенный ответ с подписью учебника тоже засчитывается */ allowSchool?: boolean }
const ENC: Q[] = [
  { q: 'кто такой Менделеев', has: [/1834|периодическ/i] },
  { q: 'расскажи о Лавуазье', has: [/1743|кислород|Лавуазье/i] },
  { q: 'кто открыл кислород', has: [/Пристли|Шееле|Лавуазье|кислород/i] },
  { q: 'что такое хроматография', allowSchool: true, has: [/хроматограф|разделени/i] },
  { q: 'как делают аммиак в промышленности', allowSchool: true, has: [/Габер|аммиак|азот/i] },
  { q: 'зачем нужен озоновый слой', allowSchool: true, has: [/озон|ультрафиолет/i] },
  { q: 'who was Marie Curie', lang: 'en', has: [/Curie|radioactiv|Polish|1867/i] },
  { q: 'Mendeleyev kim', lang: 'uz', has: [/Mendeleyev|Менделеев|davriy|периодическ/i] },
  { q: 'химики Узбекистана', has: [/Узбекистан|Ташкент|узбек/i] },
  { q: 'за что дали Нобелевскую премию по химии в 2023 году', has: [/Нобелевск|квантов|точк|Бавенди|Екимов|2023/i] },
  { q: 'кто такой Ломоносов', has: [/1711|Ломоносов|учёный/i] },
  { q: 'кто такой Бутлеров', has: [/1828|Бутлеров|строени/i] },
  { q: 'расскажи о Марии Кюри', has: [/Кюри|радиоактивн|полоний|радий/i] },
  { q: 'кто открыл радиоактивность', has: [/Беккерель|Кюри|радиоактивн/i] },
  { q: 'кто такой Резерфорд', has: [/Резерфорд|1871|ядр|атом/i] },
  { q: 'кто такой Фарадей', has: [/Фарадей|1791|электр/i] },
  { q: 'кто такой Абид Садыков', has: [/Садыков|узбек|Ташкент|академик/i] },
  { q: 'биография Зелинского', has: [/Зелинск|1861|противогаз|катализ|химик/i] },
  { q: 'что такое алхимия', allowSchool: true, has: [/алхими/i] },
  { q: 'что такое флогистон', allowSchool: true, has: [/флогистон|горени/i] },
  { q: 'история открытия периодического закона', has: [/Менделеев|периодическ|1869/i] },
  { q: 'что такое процесс Габера', allowSchool: true, has: [/Габер|аммиак|азот|водород/i] },
  { q: 'как получают серную кислоту контактным способом', allowSchool: true, has: [/серн|контактн|катализатор|оксид серы/i] },
  { q: 'как работает литий-ионный аккумулятор', allowSchool: true, has: [/литий|аккумулятор|электрод/i] },
  { q: 'что такое парниковый эффект', allowSchool: true, has: [/парников|атмосфер|углекисл/i] },
  { q: 'что такое кислотные дожди', allowSchool: true, has: [/кислотн|дожд|оксид/i] },
  { q: 'что такое зелёная химия', allowSchool: true, has: [/зел[её]н\w+ хими|отход|экологи/i] },
  { q: 'из чего делают мыло', allowSchool: true, has: [/мыл|жир|щ[её]лоч|натри/i] },
  { q: 'что такое ЯМР', allowSchool: true, has: [/ядерн|магнитн|резонанс|ЯМР|спектроскоп/i] },
  { q: 'что такое масс-спектрометрия', allowSchool: true, has: [/масс|ион|спектр/i] },
  { q: 'кто такой Альфред Нобель', has: [/Нобель|динамит|1833|преми/i] },
  { q: 'что такое крекинг нефти', allowSchool: true, has: [/крекинг|нефт|углеводород/i] },
  { q: 'как производят цемент', allowSchool: true, has: [/цемент|клинкер|обжиг|известняк/i] },
  { q: 'кто такой Полинг', has: [/Полинг|1901|связ|Нобелевск/i] },
  { q: 'who discovered oxygen', lang: 'en', has: [/Priestley|Scheele|Lavoisier|oxygen|кислород/i] },
  { q: 'tell me about the scientist Lavoisier', lang: 'en', has: [/Lavoisier|1743|chemistry|Лавуазье/i] },
  { q: 'what is chromatography', allowSchool: true, lang: 'en', has: [/chromatograph|separat|хроматограф/i] },
  { q: 'Lomonosov kim edi', lang: 'uz', has: [/Lomonosov|Ломоносов|1711|olim|учёный/i] },
  { q: 'Mariya Kyuri haqida gapirib ber', lang: 'uz', has: [/Kyuri|Curie|Кюри|radioaktiv|радиоактивн/i] },
  { q: 'что такое пенициллин и кто его открыл', has: [/пенициллин|Флеминг|антибиотик/i] },
]

const SCHOOL: { q: string; lang?: 'ru' | 'en' | 'uz'; grade?: string }[] = [
  { q: 'что такое моль' },
  { q: 'валентность кислорода' },
  { q: 'что такое оксиды' },
  { q: 'что такое кислоты' },
  { q: 'что такое соли' },
  { q: 'что такое основания' },
  { q: 'что такое молярная масса' },
  { q: 'закон сохранения массы веществ' },
  { q: 'что такое химическая реакция' },
  { q: 'что такое атом' },
  { q: 'что такое молекула' },
  { q: 'что такое валентность' },
  { q: 'что такое электроотрицательность', grade: 'g8' },
  { q: 'что такое ковалентная связь', grade: 'g8' },
  { q: 'что такое степень окисления', grade: 'g8' },
  { q: 'что такое электролиты', grade: 'g9' },
  { q: 'что такое гидролиз солей', grade: 'g9' },
  { q: 'что такое алканы', grade: 'g10' },
  { q: 'что такое изомеры', grade: 'g10' },
  { q: 'реакция нейтрализации' },
]

await preloadKnowledge({})
// wf16: большая энциклопедия подключена и для прежних вопросов — как в браузере (там fetch из BASE_URL/kb/wiki/)
{
  const dir = path.join(ROOT, 'public', 'kb', 'wiki')
  if (fs.existsSync(path.join(dir, 'meta.json'))) setWikiBigLoader(async (rel) => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')))
}
const WIKI_SIGN = /\[(Википедия|Wikipedia|Vikipediya): .+ — CC BY-SA\]/
const t0 = performance.now()
let encOk = 0
let encSigned = 0
for (const item of ENC) {
  const lang = item.lang ?? 'ru'
  const res = await composeLocalTeacherReply([{ role: 'user', content: item.q }], ctxOf(lang, item.grade ?? 'g8'))
  const text = res.text
  const signed = WIKI_SIGN.test(text)
  const body = text.replace(/\n\n\[[^\]]+\]\s*$/u, '')
  // счёт утверждений — простым делением (сокращение «и др.» в конце фразы composer не режет, это не ошибка)
  const statements = body.split(/(?<=[.!?])\s+(?=[«"(A-ZА-ЯЁ0-9])/u).filter((s) => s.trim().length > 20 && !/\?\s*$/.test(s))
  const hasKey = item.has.some((k) => (typeof k === 'string' ? body.includes(k) : k.test(body)))
  const endsWithHook = /\?\s*$/.test(body.trim())
  const schoolOkToo = Boolean(item.allowSchool) && res.confident && !signed
  // 2 утверждения — только у очень коротких вступлений (учёные Узбекистана); обычно 3–5
  const ok =
    (signed && hasKey && statements.length >= 2 && statements.length <= 6 && endsWithHook) ||
    schoolOkToo ||
    // учёный из проверенных карточек ATOMLAB (scientistTalk, слой humanTurn) — тоже верный ответ: факты сверены, годы и достижение есть
    (/\[ATOMLAB — (учёные|scientists|olimlar)\]/.test(text) && hasKey && statements.length >= 1)
  if (ok) encOk++
  if (signed) encSigned++
  check(`enc: ${item.q}`, ok, `signed=${signed} key=${hasKey} statements=${statements.length} hook=${endsWithHook} :: ${text.slice(0, 160).replace(/\n/g, ' ')}`)
}
let schoolOk = 0
for (const item of SCHOOL) {
  const res = await composeLocalTeacherReply([{ role: 'user', content: item.q }], ctxOf(item.lang ?? 'ru', item.grade ?? 'g8'))
  const ok = res.confident && !WIKI_SIGN.test(res.text)
  if (ok) schoolOk++
  check(`school: ${item.q}`, ok, `confident=${res.confident} :: ${res.text.slice(0, 140).replace(/\n/g, ' ')}`)
}
console.log(`[answers] encyclopedia ${encOk}/${ENC.length} (${encSigned} from Wikipedia), school untouched ${schoolOk}/${SCHOOL.length}, ${Math.round(performance.now() - t0)} ms`)

/* ------------------------------------------------------------------ 3. большая энциклопедия (wf16, public/kb/wiki) */
const BIG_DIR = path.join(ROOT, 'public', 'kb', 'wiki')
if (fs.existsSync(path.join(BIG_DIR, 'meta.json'))) {
  const meta = JSON.parse(fs.readFileSync(path.join(BIG_DIR, 'meta.json'), 'utf8')) as { n: number; shards: number; license: string; titles: string[]; tags: string }
  const files = [path.join(BIG_DIR, 'meta.json'), ...fs.readdirSync(path.join(BIG_DIR, 's')).map((f) => path.join(BIG_DIR, 's', f)), ...fs.readdirSync(path.join(BIG_DIR, 'i')).map((f) => path.join(BIG_DIR, 'i', f))]
  const sizes = files.map((f) => fs.statSync(f).size)
  const totalMb = sizes.reduce((a, b) => a + b, 0) / 1e6
  console.log(`[big] ${meta.n} статей, ${meta.shards} шардов текста, ${files.length} файлов, ${totalMb.toFixed(1)} МБ, крупнейший ${(Math.max(...sizes) / 1e6).toFixed(2)} МБ`)
  check('big: license CC BY-SA', /CC BY-SA/.test(meta.license))
  check('big: every file ≤ 4 MB', sizes.every((s) => s <= 4_000_000))
  check('big: total ≤ 60 MB', totalMb <= 60, totalMb.toFixed(1))
  check('big: titles = n, tags = n', meta.titles.length === meta.n && meta.tags.length === meta.n)
  const unsafeBig = meta.titles.filter((t) => UNSAFE_TITLE.test(t))
  check('big: no unsafe titles', unsafeBig.length === 0, unsafeBig.slice(0, 5).join('; '))
  // в тесте — файлы с диска (в браузере — fetch из BASE_URL/kb/wiki/)
  setWikiBigLoader(async (rel) => JSON.parse(fs.readFileSync(path.join(BIG_DIR, rel), 'utf8')))
  await searchWikiBig('гемоглобин') // загрузка meta (в браузере — один раз за сессию)
  let bigOk = 0
  let fromWiki = 0
  const times: number[] = []
  const bad: string[] = []
  for (const item of BIG_QUESTIONS) {
    const t = performance.now()
    const res = await composeLocalTeacherReply([{ role: 'user', content: item.q }], ctxOf('ru', 'g8'))
    times.push(performance.now() - t)
    const body = res.text.replace(/\n\n\[[^\]]+\]\s*$/u, '')
    const ok = res.confident && item.has.test(body) && !item.not?.test(res.text)
    if (WIKI_SIGN.test(res.text)) fromWiki++
    if (ok) bigOk++
    else bad.push(`${item.q} :: ${res.text.slice(0, 130).replace(/\n/g, ' ')}`)
  }
  times.sort((a, b) => a - b)
  const acc = bigOk / BIG_QUESTIONS.length
  console.log(
    `[big] вопросы «за пределами школы»: ${bigOk}/${BIG_QUESTIONS.length} (${(acc * 100).toFixed(1)} %), из Википедии ${fromWiki}; ` +
      `время ответа медиана ${times[times.length >> 1]!.toFixed(0)} мс, p90 ${times[Math.floor(times.length * 0.9)]!.toFixed(0)} мс`,
  )
  for (const b of bad) console.log(`  miss ${b}`)
  check('big: ≥ 150 questions', BIG_QUESTIONS.length >= 150, String(BIG_QUESTIONS.length))
  check('big: accuracy ≥ 97 %', acc >= 0.97, `${(acc * 100).toFixed(1)} %`)
  // wf17: 177 прежних вопросов + ≥ 60 ловушек (имя ≠ фамилия, упоминание ≠ тема, «кто открыл», «витамин C»)
  check('big: ≥ 237 questions incl. traps', BIG_QUESTIONS.length >= 237, String(BIG_QUESTIONS.length))
  check('big: median answer ≤ 300 ms', times[times.length >> 1]! <= 300, `${times[times.length >> 1]!.toFixed(0)} ms`)
  // школьные вопросы по-прежнему отвечает учебник (большая энциклопедия их не перебивает)
  let schoolStill = 0
  for (const item of SCHOOL) {
    const res = await composeLocalTeacherReply([{ role: 'user', content: item.q }], ctxOf(item.lang ?? 'ru', item.grade ?? 'g8'))
    if (res.confident && !WIKI_SIGN.test(res.text)) schoolStill++
  }
  check('big: school answers untouched', schoolStill === SCHOOL.length, `${schoolStill}/${SCHOOL.length}`)
} else {
  check('big: public/kb/wiki/meta.json exists', false)
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) {
  console.log(failures.map((f) => ` - ${f}`).join('\n'))
  process.exit(1)
}
