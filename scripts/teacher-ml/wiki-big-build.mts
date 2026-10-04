/**
 * Большая энциклопедия учителя (wf16): .tmp/wiki-big/raw/*.jsonl → public/kb/wiki/ (ленивая загрузка, не в бандле).
 *
 *   npx tsx scripts/teacher-ml/wiki-big-build.mts
 *
 * Выход (всё грузится по требованию через fetch, см. src/learn/kb/wikiBig.ts):
 *   public/kb/wiki/meta.json      — заголовки статей, метки тем, число шардов, лицензия и источник;
 *   public/kb/wiki/i/<k>.json     — обратный индекс по первой букве термина: T (слова заголовка), A (уточнение
 *                                   в скобках и другие названия из первой фразы), K (ключевые слова вступления, tf-idf);
 *   public/kb/wiki/s/<n>.json     — тексты: статья с номером d лежит в шарде d % S на позиции ⌊d / S⌋.
 * Тексты — вступления статей русской Википедии (CC BY-SA 4.0), 2–5 абзацев, обрезка по границе предложения.
 * Статьи-инструкции (взрывчатка, яды, наркотики), списки и неоднозначности отбрасываются.
 */
import fs from 'node:fs'
import path from 'node:path'
import { analyzeTerms } from '../../src/learn/kb/analyzer.ts'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const RAW = path.join(ROOT, '.tmp', 'wiki-big', 'raw')
const OUT = path.join(ROOT, 'public', 'kb', 'wiki')
const MAX_CHARS = 1100
const SHARD_BYTES = 2_600_000
const KEYWORDS = 10

const UNSAFE_TEXT = /рецепт(ур)?\w*\s+(изготовлен|получен|приготовлен)|в домашних условиях|кустарн\w+ (изготов|производ|синтез)|самодельн\w+ взрыв|изготовить (дома|самостоятельно|своими руками)|смеша(ть|йте|в)\s[^.]{0,60}(в соотношении|в пропорции)\s*\d|пошагов\w+ (инструкци|синтез)|инструкци\w+ по (изготовлению|синтезу|приготовлению)/i
const UNSAFE_TITLE = /наркот|психотроп|психоактив|боевое отравляющее|отравляющ\w+ вещество|нервно-паралитич|зарин|зоман|иприт|люизит|VX|новичок \(|фосген|синильн|цианид калия|цианистый калий|рицин|стрихнин|террор|самодельн|бомба|граната|мина \(|снаряд|детонатор|капсюль|взрыватель|пороховой заряд|боеприпас|оружие|амфетамин|метамфетамин|кокаин|героин|опиоид|ЛСД|каннабис|марихуан|экстази|MDMA|спайс/i
const TAG_CODE: Record<string, string> = { key: 'k', chemistry: 'c', scientist: 'p', biology: 'b', medicine: 'm', physics: 'f', earth: 'e', astronomy: 'a', safety: 's', everyday: 'd', history: 'h', uzbekistan: 'u' }

type Raw = { id: number; title: string; text: string; tag: string; cat: string }

/** Скобки-этимологии в первой фразе: «(от др.-греч. …; лат. …)» — ученику не нужны; скобки с годами жизни оставляем. */
function dropEtymology(s: string): string {
  let prev = ''
  let out = s
  for (let guard = 0; guard < 4 && prev !== out; guard++) {
    prev = out
    out = out.replace(/\s?\(([^()]*)\)/g, (m, inner: string) => {
      if (/\b1[0-9]\d\d\b|\b20[0-2]\d\b|до н\. э\./.test(inner)) return m
      if (/(лат\.|англ\.|греч\.|нем\.|франц\.|фр\.|араб\.|перс\.|тюрк\.|узб\.|итал\.|исп\.|МФА|произн|от\s|также\s|сокр\.|transl|[ˈˌ]|\bот\b)/i.test(inner) || inner.length > 80) return ''
      return m
    })
  }
  return out.replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ')
}

/** 2–5 абзацев вступления, не длиннее MAX_CHARS, по границе предложения. */
function trimIntro(text: string): string {
  const paras = text.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 0 && !/^[=\s]/.test(p))
  if (!paras.length) return ''
  paras[0] = dropEtymology(paras[0]!)
  let out = ''
  for (const p of paras.slice(0, 5)) {
    if ((out + p).length <= MAX_CHARS) {
      out = out ? `${out}\n${p}` : p
      continue
    }
    // последний абзац — частично, по предложениям
    const sentences = p.split(/(?<=[.!?…])\s+(?=[«"(A-ZА-ЯЁ0-9])/u)
    let partial = ''
    for (const s of sentences) {
      if (out.length + partial.length + s.length + 1 > MAX_CHARS) break
      partial = partial ? `${partial} ${s}` : s
    }
    if (partial) out = out ? `${out}\n${partial}` : partial
    break
  }
  return out.trim()
}

const t0 = Date.now()
const files = fs.existsSync(RAW) ? fs.readdirSync(RAW).filter((f) => f.endsWith('.jsonl')).sort() : []
const seen = new Set<number>()
const seenTitle = new Set<string>()
const docs: { title: string; text: string; tag: string }[] = []
let dropped = { unsafe: 0, short: 0, list: 0, dup: 0 }
for (const f of files) {
  for (const line of fs.readFileSync(path.join(RAW, f), 'utf8').split('\n')) {
    if (!line.trim()) continue
    let r: Raw
    try {
      r = JSON.parse(line) as Raw
    } catch {
      continue
    }
    if (seen.has(r.id) || seenTitle.has(r.title)) {
      dropped.dup++
      continue
    }
    seen.add(r.id)
    seenTitle.add(r.title)
    if (/^(Список|Хронология|Категория|Шаблон|Портал)\b/.test(r.title)) {
      dropped.list++
      continue
    }
    if (UNSAFE_TITLE.test(r.title) || UNSAFE_TEXT.test(r.text)) {
      dropped.unsafe++
      continue
    }
    const text = trimIntro(r.text)
    if (text.length < 140 || /может означать|может относиться|— значения/.test(text.slice(0, 200))) {
      dropped.short++
      continue
    }
    docs.push({ title: r.title, text, tag: TAG_CODE[r.tag] ?? 'c' })
  }
}

// ключевые статьи — первыми (номер меньше), остальное — в порядке категорий
const N = docs.length
const totalBytes = docs.reduce((s, d) => s + Buffer.byteLength(d.text) + 4, 0)
const S = Math.max(1, Math.ceil(totalBytes / SHARD_BYTES))

// ------------------------------------------------------------------ индекс
const baseTitle = (t: string) => t.replace(/\s*\([^)]*\)\s*$/, '').trim()
const qualifier = (t: string) => t.match(/\(([^)]*)\)\s*$/)?.[1] ?? ''
/** Другие названия из первой фразы: «Хлори́д на́трия (поваренная соль, NaCl) — …» → «поваренная соль NaCl». */
function aliasesOf(text: string): string {
  const first = text.split(/(?<=[.!?])\s/)[0] ?? ''
  const head = first.split(/\s[—–]\s/)[0] ?? ''
  if (head.length > 160) return ''
  const inParens = [...head.matchAll(/\(([^()]*)\)/g)].map((m) => m[1]!).filter((x) => !/\d{4}/.test(x))
  const orNames = [...head.matchAll(/\b(?:или|также|иначе)\s+([^,;()]+)/g)].map((m) => m[1]!)
  return [...inParens, ...orNames].join(' ')
}

const df = new Map<string, number>()
const docTerms: string[][] = []
for (const d of docs) {
  const terms = analyzeTerms(d.text)
  docTerms.push(terms)
  for (const t of new Set(terms)) df.set(t, (df.get(t) ?? 0) + 1)
}
type Post = { T: Map<string, number[]>; A: Map<string, number[]>; K: Map<string, number[]> }
const shards = new Map<string, Post>()
const keyOf = (term: string) => term.codePointAt(0)!.toString(36)
function add(kind: keyof Post, term: string, doc: number) {
  // В редких статьях анализатор отдаёт не строку — такие «слова» в индекс не кладём
  if (typeof term !== 'string' || !term) return
  const k = keyOf(term)
  let p = shards.get(k)
  if (!p) shards.set(k, (p = { T: new Map(), A: new Map(), K: new Map() }))
  const arr = p[kind].get(term) ?? []
  if (arr[arr.length - 1] !== doc) arr.push(doc)
  p[kind].set(term, arr)
}
docs.forEach((d, i) => {
  const tTerms = new Set(analyzeTerms(baseTitle(d.title)))
  for (const t of tTerms) add('T', t, i)
  const aTerms = new Set(analyzeTerms(`${qualifier(d.title)} ${aliasesOf(d.text)}`).filter((t) => !tTerms.has(t)))
  for (const t of aTerms) add('A', t, i)
  // ключевые слова: tf-idf по вступлению, первые 300 символов — с весом ×2
  const tf = new Map<string, number>()
  const head = new Set(analyzeTerms(d.text.slice(0, 300)))
  for (const t of docTerms[i]!) tf.set(t, (tf.get(t) ?? 0) + 1)
  const scored = [...tf]
    .filter(([t]) => !tTerms.has(t) && !aTerms.has(t) && t.length >= 3 && (df.get(t) ?? 0) < N * 0.08)
    .map(([t, c]) => [t, (c + (head.has(t) ? 2 : 0)) * Math.log(N / (df.get(t) ?? 1))] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, KEYWORDS)
  for (const [t] of scored) add('K', t, i)
})

// ------------------------------------------------------------------ запись
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(path.join(OUT, 's'), { recursive: true })
fs.mkdirSync(path.join(OUT, 'i'), { recursive: true })
const shardTexts: string[][] = Array.from({ length: S }, () => [])
docs.forEach((d, i) => shardTexts[i % S]!.push(d.text))
let maxFile = 0
let textBytes = 0
for (let k = 0; k < S; k++) {
  const body = JSON.stringify(shardTexts[k])
  fs.writeFileSync(path.join(OUT, 's', `${k}.json`), body)
  maxFile = Math.max(maxFile, Buffer.byteLength(body))
  textBytes += Buffer.byteLength(body)
}
let indexBytes = 0
const obj = (m: Map<string, number[]>) => Object.fromEntries([...m].sort((a, b) => (a[0] < b[0] ? -1 : 1)))
for (const [k, p] of shards) {
  const body = JSON.stringify({ T: obj(p.T), A: obj(p.A), K: obj(p.K) })
  fs.writeFileSync(path.join(OUT, 'i', `${k}.json`), body)
  indexBytes += Buffer.byteLength(body)
  maxFile = Math.max(maxFile, Buffer.byteLength(body))
}
const meta = {
  v: 1,
  source: 'Википедия (ru.wikipedia.org), вступления статей',
  license: 'CC BY-SA 4.0',
  built: new Date().toISOString().slice(0, 10),
  n: N,
  shards: S,
  keys: [...shards.keys()].sort(),
  titles: docs.map((d) => d.title),
  tags: docs.map((d) => d.tag).join(''),
}
const metaBody = JSON.stringify(meta)
fs.writeFileSync(path.join(OUT, 'meta.json'), metaBody)
const tagCount: Record<string, number> = {}
for (const d of docs) tagCount[d.tag] = (tagCount[d.tag] ?? 0) + 1
console.log(
  `[wiki-big-build] статей ${N} (отброшено: ${JSON.stringify(dropped)}), теги ${JSON.stringify(tagCount)}\n` +
    `  тексты ${(textBytes / 1e6).toFixed(1)} МБ в ${S} шардах, индекс ${(indexBytes / 1e6).toFixed(2)} МБ в ${shards.size} файлах, meta ${(Buffer.byteLength(metaBody) / 1e6).toFixed(2)} МБ, ` +
    `крупнейший файл ${(maxFile / 1e6).toFixed(2)} МБ, ${((Date.now() - t0) / 1000).toFixed(1)} с`,
)
