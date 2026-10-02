/**
 * Ответы учителя по «большой базе данных» (src/data/teacher/qaBank.json): вещества, элементы,
 * реакции учебников + 200 основных, глоссарий RU/EN/UZ, определения и разделы Kimyo 7–11.
 *
 * Распознаём в реплике сущность (формула в любом регистре / с индексами, название RU/EN/UZ
 * в любом падеже через stemRussian, опечатки по Дамерау ≤ 1 для слов ≥ 5 букв) и вопрос
 * («молярная масса», «формула», «класс», «что получится из … и …», «с чем реагирует», «как получить»,
 * «тип реакции», «где в учебнике», «определение», «группа/период», «валентность», перевод термина).
 * Не уверены (нет сущности или нет вопроса) → null: дальше отвечает поиск по учебнику.
 * Числа и уравнения — только из базы; каждая фраза подписана источником «[Kimyo 8, §12]» / «[ATOMLAB — каталог]».
 *
 * База грузится dynamic import'ом (отдельный чанк Vite), первый вызов ждёт загрузку.
 */
import { stemRussian } from '../../kb/stemRu'
import { updateProfile, type TalkEntity } from '../human/studentProfile'
import type { QaBank, QaDefinition, QaElement, QaReaction, QaSection, QaSubstance, QaTerm } from './qaBankTypes'

export type QaLang = 'ru' | 'en' | 'uz'

export type QaIntent =
  | 'molar'
  | 'formula'
  | 'class'
  | 'family'
  | 'products'
  | 'reacts'
  | 'obtain'
  | 'rxtype'
  | 'where'
  | 'definition'
  | 'about'
  | 'usage'
  | 'source'
  | 'position'
  | 'valency'
  | 'config'
  | 'armass'
  | 'translate'

export interface QaOptions {
  lang: QaLang
  /** Класс ученика (7–11) — предпочтение реакций и § его учебника. */
  grade?: number | null
  /** Прошлое вещество разговора — для «а его формула?». */
  lastEntity?: TalkEntity | null
}

export interface QaAnswer {
  text: string
  citations: string[]
  intent: QaIntent
  entity?: TalkEntity
  /** Числа ответа (для тестов). */
  numbers?: Record<string, number>
}

/* ============================================================ индекс */

type Ent = { kind: 'substance'; s: QaSubstance } | { kind: 'element'; e: QaElement }

interface Index {
  bank: QaBank
  byFormula: Map<string, Ent[]>
  byFormulaLower: Map<string, Ent[]>
  names: Map<string, Ent[]>
  namesLight: Map<string, Ent[]>
  vocab: Map<number, Set<string>>
  rxByReactant: Map<string, QaReaction[]>
  rxByProduct: Map<string, QaReaction[]>
  rxByKey: Map<string, QaReaction>
  terms: Map<string, QaTerm[]>
  defs: Map<string, QaDefinition[]>
  sections: QaSection[]
}

let indexPromise: Promise<Index> | null = null

function loadIndex(): Promise<Index> {
  if (!indexPromise) {
    indexPromise = import('../../../data/teacher/qaBank.json')
      .then((mod) => buildIndex((mod as { default: unknown }).default as QaBank))
      .catch((err: unknown) => {
        indexPromise = null
        throw err
      })
  }
  return indexPromise
}

/** Для тестов и скриптов: подставить базу напрямую (без dynamic import). */
export function setQaBank(bank: QaBank): void {
  indexPromise = Promise.resolve(buildIndex(bank))
}

const SUB = '₀₁₂₃₄₅₆₇₈₉'
const plainFormula = (f: string) => [...f].map((ch) => (SUB.includes(ch) ? String(SUB.indexOf(ch)) : ch)).join('').replace(/[•*]/g, '·')
const prettyFormula = (f: string) => plainFormula(f).replace(/(?<=[A-Za-z)\]])(\d+)/g, (d) => [...d].map((c) => SUB[Number(c)]).join(''))

const ROMAN: Record<string, string> = { '1': 'i', '2': 'ii', '3': 'iii', '4': 'iv', '5': 'v', '6': 'vi', '7': 'vii', '8': 'viii' }
const UZ_SUFFIXES = ['larning', 'lardan', 'larini', 'larga', 'larda', 'larni', 'lari', 'ning', 'dan', 'lar', 'ini', 'ga', 'da', 'ni', 'si', 'i']

function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[ʻʼ’‘`´]/g, "'")
    .replace(/[«»"]/g, ' ')
}

function tokenize(folded: string): string[] {
  return folded.split(/[^\p{L}\p{N}']+/u).filter(Boolean)
}

function stemToken(w: string): string {
  if (ROMAN[w]) return ROMAN[w]!
  if (/^[ivx]+$/.test(w)) return w
  if (/^[а-я]/.test(w)) return stemRussian(w)
  if (/^[a-z]/.test(w)) {
    // Узбекские аффиксы снимаем до двух раз: xloridining → xloridi → xlorid.
    let s = w
    for (let round = 0; round < 2; round++) {
      const suf = UZ_SUFFIXES.find((x) => s.length - x.length >= 4 && s.endsWith(x))
      if (!suf) break
      s = s.slice(0, -suf.length)
    }
    if (s === w && w.length > 4 && /(?<!s)s$/.test(w)) return w.slice(0, -1)
    return s
  }
  return w
}

const nameKey = (name: string) => tokenize(fold(name)).map(stemToken).join(' ')

/** Лёгкая основа (одно окончание): «нитрита» → «нитрит» — страховка там, где Snowball режет по-разному. */
function lightStem(w: string): string {
  if (ROMAN[w]) return ROMAN[w]!
  if (!/^[а-я]/.test(w)) return stemToken(w)
  const cut = w.replace(/(ами|ями|ого|его|ому|ему|ыми|ими|ая|яя|ой|ей|ый|ий|ом|ем|ах|ях|ов|ев|ам|ям|ы|и|а|я|у|ю|е|о|ь|й)$/u, '')
  return cut.length >= 3 ? cut : w
}
const lightKey = (name: string) => tokenize(fold(name)).map(lightStem).join(' ')

function pushMap<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const arr = m.get(k)
  if (arr) {
    if (!arr.includes(v)) arr.push(v)
  } else m.set(k, [v])
}

const DIATOMIC = new Set(['H', 'N', 'O', 'F', 'Cl', 'Br', 'I'])

/** Формулы, под которыми сущность встречается в уравнениях (ASCII, нижний регистр). */
function formulasOf(ent: Ent): string[] {
  if (ent.kind === 'substance') return [ent.s.fa.toLowerCase()]
  const s = ent.e.s
  const out = [s]
  if (DIATOMIC.has(s)) out.push(`${s}2`)
  if (s === 'P') out.push('P4')
  if (s === 'S') out.push('S8')
  return out.map((x) => x.toLowerCase())
}

function buildIndex(bank: QaBank): Index {
  const idx: Index = {
    bank,
    byFormula: new Map(),
    byFormulaLower: new Map(),
    names: new Map(),
    namesLight: new Map(),
    vocab: new Map(),
    rxByReactant: new Map(),
    rxByProduct: new Map(),
    rxByKey: new Map(),
    terms: new Map(),
    defs: new Map(),
    sections: bank.sections,
  }
  const addVocab = (name: string) => {
    for (const w of tokenize(fold(name))) {
      if (w.length < 4 || /\d/.test(w)) continue
      let set = idx.vocab.get(w.length)
      if (!set) idx.vocab.set(w.length, (set = new Set()))
      set.add(w)
    }
  }
  const addName = (name: string | undefined, ent: Ent) => {
    if (!name) return
    const key = nameKey(name)
    if (!key) return
    pushMap(idx.names, key, ent)
    pushMap(idx.namesLight, lightKey(name), ent)
    addVocab(name)
    // Без римской цифры и скобок: «оксид меди» → все оксиды меди (выбор — по классу ученика).
    const noRoman = key.replace(/\s+(i|ii|iii|iv|v|vi|vii|viii)\b/g, '')
    if (noRoman !== key) pushMap(idx.names, noRoman, ent)
  }
  for (const s of bank.substances) {
    const ent: Ent = { kind: 'substance', s }
    pushMap(idx.byFormula, s.fa, ent)
    if (s.fa.length >= 3 || /\d/.test(s.fa)) pushMap(idx.byFormulaLower, s.fa.toLowerCase(), ent)
    addName(s.ru, ent)
    addName(s.en, ent)
    addName(s.uz, ent)
    // «Хлорид натрия (поваренная соль)» → обе части.
    const m = s.ru.match(/^(.+?)\s*\((.+)\)$/)
    if (m && !/^[ivx]+$/i.test(m[2]!)) {
      addName(m[1], ent)
      addName(m[2], ent)
    }
  }
  for (const e of bank.elements) {
    const ent: Ent = { kind: 'element', e }
    pushMap(idx.byFormula, e.s, ent)
    addName(e.ru, ent)
    addName(e.en, ent)
    addName(e.uz, ent)
  }
  // Формы, совпадающие с названиями стран, — не элементы.
  for (const w of ['германия', 'франция', 'индия']) idx.names.delete(stemRussian(w))
  for (const r of bank.reactions) {
    for (const f of r.r) pushMap(idx.rxByReactant, f.toLowerCase(), r)
    for (const f of r.p) pushMap(idx.rxByProduct, f.toLowerCase(), r)
    idx.rxByKey.set(rxKey(r.r, r.p), r)
  }
  for (const t of bank.terms) {
    pushMap(idx.terms, nameKey(t.ru), t)
    for (const en of t.en) pushMap(idx.terms, nameKey(en), t)
    for (const uz of t.uz) pushMap(idx.terms, nameKey(uz), t)
  }
  for (const d of bank.definitions) pushMap(idx.defs, nameKey(d.term), d)
  return idx
}

const rxKey = (r: string[], p: string[]) => `${[...r].map((s) => s.toLowerCase()).sort().join('+')}>${[...p].map((s) => s.toLowerCase()).sort().join('+')}`

/* ============================================================ опечатки */

/** Расстояние Дамерау — Левенштейна (с ограничением 2 — больше нам не нужно). */
export function damerau(a: string, b: string): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 1) return 2
  const m = a.length
  const n = b.length
  let prev2: number[] = []
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur: number[] = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1)
      cur.push(v)
    }
    prev2 = prev
    prev = cur
  }
  return prev[n]!
}

/** Слова вопроса, которые нельзя «исправлять» в названия веществ. */
const STOP = new Set(
  'какая какой какое какие сколько масса массы формула класс классе молярная молярной группа группе период периоде валентность получить получают реагирует учебнике тип реакции чему равна скажи назови будет между what which where molar mass formula class group period react obtain get which grade textbook nima qaysi qanday massa formula sinf guruh davr olish kerak haqida'.split(
    ' ',
  ),
)

function correctTypos(words: string[], idx: Index): string[] {
  return words.map((w) => {
    if (w.length < 5 || /\d/.test(w) || STOP.has(w)) return w
    const exact = idx.vocab.get(w.length)?.has(w)
    if (exact) return w
    let best: string | null = null
    for (const len of [w.length, w.length - 1, w.length + 1]) {
      const set = idx.vocab.get(len)
      if (!set) continue
      for (const cand of set) {
        if (cand[0] !== w[0] && cand[1] !== w[1]) continue
        if (damerau(w, cand) <= 1) {
          if (best && best !== cand) return w // неоднозначно — не трогаем
          best = cand
        }
      }
    }
    return best ?? w
  })
}

/* ============================================================ сущности */

interface Found {
  ent: Ent[]
  start: number
  end: number
}

const SYMBOL_STOP = new Set(['He', 'In', 'At', 'As', 'Be', 'No', 'Am', 'Ho', 'La', 'Pa', 'Po', 'Os', 'Es', 'Mo', 'Ga', 'Da', 'Si', 'Na'])

function findEntities(text: string, folded: string, idx: Index): Ent[][] {
  const found: Found[] = []
  // 1) Формулы и символы: по исходному тексту (регистр важен для Co / CO).
  const rawTokens = text.split(/[\s,;:!?]+|(?<=\p{L})\.(?=\s|$)/u).filter(Boolean)
  rawTokens.forEach((tok, i) => {
    let clean = tok.replace(/^[«"']+|[»"'.]+$/g, '')
    // Скобки вокруг слова снимаем, скобки внутри формулы «(NH₄)₂CO₃» — оставляем.
    if (clean.startsWith('(') && !clean.slice(1).includes(')')) clean = clean.slice(1)
    if (clean.endsWith(')') && !clean.slice(0, -1).includes('(')) clean = clean.slice(0, -1)
    if (!clean || !/^[A-Za-z(]/.test(clean)) return
    const p = plainFormula(clean).replace(/\s+/g, '')
    let ents = idx.byFormula.get(p)
    if (ents && p.length <= 2 && SYMBOL_STOP.has(p) && !/(элемент|element|символ|symbol)\s*$/iu.test(text.slice(0, text.indexOf(tok)))) ents = undefined
    if (!ents && (p.length >= 3 || /\d/.test(p))) ents = idx.byFormulaLower.get(p.toLowerCase())
    if (ents) found.push({ ent: ents, start: i * 1000, end: i * 1000 })
  })
  // 2) Названия: стемы, опечатки, n-граммы до 4 слов.
  const words = correctTypos(tokenize(folded), idx)
  const stems = words.map(stemToken)
  const light = words.map(lightStem)
  const used = new Array<boolean>(stems.length).fill(false)
  for (let n = Math.min(4, stems.length); n >= 1; n--) {
    for (let i = 0; i + n <= stems.length; i++) {
      if (used.slice(i, i + n).some(Boolean)) continue
      const key = stems.slice(i, i + n).join(' ')
      const ents = idx.names.get(key) ?? idx.namesLight.get(light.slice(i, i + n).join(' '))
      if (!ents) continue
      // Однобуквенные/двухбуквенные формулы уже учтены; имя из одного короткого слова — только ≥ 3 букв.
      if (n === 1 && words[i]!.length < 3) continue
      for (let k = i; k < i + n; k++) used[k] = true
      found.push({ ent: ents, start: i, end: i + n - 1 })
    }
  }
  // Формула и название одного вещества («вода H₂O») — одна сущность.
  const out: Ent[][] = []
  const seen = new Set<string>()
  for (const f of found.sort((a, b) => a.start - b.start)) {
    const id = f.ent.map((e) => (e.kind === 'substance' ? e.s.id : `el:${e.e.s}`)).join('|')
    const ids = new Set(f.ent.map((e) => (e.kind === 'substance' ? e.s.id : `el:${e.e.s}`)))
    if (seen.has(id) || [...ids].some((x) => seen.has(x))) continue
    for (const x of ids) seen.add(x)
    out.push(f.ent)
  }
  return out
}

const ELEMENT_INTENTS = new Set<QaIntent>(['position', 'valency', 'config', 'armass'])

/** Один кандидат из группы (элемент/вещество с тем же именем, несколько оксидов меди). */
function choose(group: Ent[], intent: QaIntent | null, grade: number | null | undefined): Ent {
  const subs = group.filter((e): e is Extract<Ent, { kind: 'substance' }> => e.kind === 'substance')
  const els = group.filter((e): e is Extract<Ent, { kind: 'element' }> => e.kind === 'element')
  if (intent && ELEMENT_INTENTS.has(intent) && els.length) return els[0]!
  if (intent === 'molar' && els.length && !subs.length) return els[0]!
  if (!subs.length) return els[0]!
  if (subs.length === 1) return subs[0]!
  const score = (s: QaSubstance) => (grade && s.g.includes(grade) ? 10 : 0) + s.g.length + (s.fam ? 1 : 0) + (s.d ? 1 : 0)
  return [...subs].sort((a, b) => score(b.s) - score(a.s))[0]!
}

function entityFromTalk(t: TalkEntity, idx: Index): Ent | null {
  if (t.kind === 'element') return idx.byFormula.get(t.key)?.find((e) => e.kind === 'element') ?? null
  const p = plainFormula(t.key).replace(/\s+/g, '')
  return idx.byFormula.get(p)?.[0] ?? idx.byFormulaLower.get(p.toLowerCase())?.[0] ?? null
}

function talkOf(ent: Ent): TalkEntity {
  return ent.kind === 'element' ? { kind: 'element', key: ent.e.s, label: ent.e.ru } : { kind: 'formula', key: ent.s.fa, label: ent.s.ru }
}

/* ============================================================ вопрос */

const INTENTS: [QaIntent, RegExp][] = [
  ['translate', /как (будет )?по[- ](английск|узбекск|русск)|по[- ]английски|по[- ]узбекски|по[- ]русски|in (english|uzbek|russian)|inglizcha|o'zbekcha|ruscha|translat|перевод|перевед|tarjima/u],
  ['products', /что (получится|получается|образуется|выйдет|будет|даст|дадут)|какой продукт|продукт\p{L}* реакции|what (is|are|will be|gets?) (formed|produced|made)|what do (you|we) get|products? of|nima hosil|hosil bo'l|mahsulot/u],
  ['rxtype', /тип\p{L}* (этой |данной )?реакци|какого типа|какая это реакция|к какому типу|это (овр|окислительно)|type of (this |the )?reaction|what (kind|type) of reaction|is (this|it) (a )?redox|reaksiya(ning)? turi|qanday reaksiya|qaysi turga/u],
  ['reacts', /с чем (реагирует|взаимодействует|вступает|может реагировать)|с какими веществами|какие реакции|химические свойства|react(s|ing)? with|what does .+ react|what reacts|nima bilan (reaksiya|ta'sir)|kimyoviy xossa/u],
  ['obtain', /как (получить|получают|добывают|синтезир|приготовить|сделать|образуется)|получени|способ\p{L}* получения|how (to|do (you|we|they)|can (i|we|you)|is .+) (get|obtain|prepare|make|produce|synthesi)|preparation of|production of|qanday (olinadi|olish|olamiz|tayyorlanadi)|olish usul|olinishi/u],
  ['where', /где в учебнике|где (это )?(написано|описано|изучается|проходят|искать)|в каком (параграфе|классе|учебнике|разделе|году)|какой параграф|на какой странице|where in the (textbook|book)|which (grade|paragraph|section|chapter)|what grade|qaysi (sinf|paragraf|bob|darslik|sahifa)|nechanchi sinf/u],
  ['armass', /атомн\p{L}* масс|относительн\p{L}* атомн|atomic (mass|weight)|atom massa|nisbiy atom/u],
  ['molar', /молярн|мольн\p{L}* масс|молекулярн\p{L}* масс|относительн\p{L}* молекулярн|molar|molecular (mass|weight)|molyar|molekulyar massa|сколько весит|мас+\p{L}*|weigh|mass\b|massa/u],
  ['config', /электронн\p{L}* (конфигурац|формул|строени|оболоч)|конфигурац|electron(ic)? configuration|elektron (konfiguratsiya|formula|tuzilish)/u],
  ['valency', /валентн|степен\p{L}* окислен|valenc|oxidation (state|number)|oksidlanish (daraja|son)/u],
  ['position', /групп|период|где (стоит|находится|расположен)|\bgroup\b|\bperiod\b|guruh|davr/u],
  ['formula', /формул|formula/u],
  ['family', /семейств|\bfamily\b|oila/u],
  ['class', /какой (это )?класс|к какому классу|класс\p{L}* (вещест|соединен)|это (кислота|соль|оксид|основание|щ[её]лочь)|относится|what class|class of|which class|is (it|this) (an? )?(acid|salt|oxide|base)|qaysi sinf(ga|i)?|sinfi|kislotami|tuzmi|oksidmi|asosmi/u],
  ['usage', /применен|применя|использу|где (нужн|использ)|для чего (нужн|использ|служит)|зачем нужн|used for|uses? of|application|where is .+ used|qo'llanil|ishlatil|nima uchun kerak|qayerda ishlat/u],
  ['source', /откуда (берут|получают|добывают|бер[её]тся)|где (добывают|встречается|находится в природе)|в природе|нахождени|месторожден|where (is|does|do) .+ (found|occur|come from)|in nature|tabiatda|qayerdan olinadi|qayerda uchraydi/u],
  ['definition', /что такое|что это (за|такое)|определени|дай определение|what (is|are) (an? |the )?|define|definition|\bnima\b|deganda|ta'rif/u],
  ['about', /расскажи|поведай|опиши|характеристик|tell me about|describe|\babout\b|haqida|to'g'risida|ta'rifla/u],
]

function detectIntent(folded: string): QaIntent | null {
  for (const [intent, re] of INTENTS) if (re.test(folded)) return intent
  return null
}

/* ============================================================ уравнение в тексте */

const ARROW = /\s*(?:<->|<=>|⇄|⇌|->|→|=>|=)\s*/
function splitSide(side: string): string[] {
  return side
    .split(/\s*\+\s*/)
    .map((p) =>
      p
        .replace(/[↑↓]/g, '')
        .replace(/\((г|ж|тв|р-р|р|aq|g|l|s|k)\)/g, '')
        .replace(/^\s*\d+(?:[.,/]\d+)?\s*/, '')
        .replace(/\s+/g, '')
        .trim(),
    )
    .filter(Boolean)
}
function parseEquationText(text: string): { r: string[]; p: string[] } | null {
  if (!/\+/.test(text) || !ARROW.test(text)) return null
  const m = text.match(/([A-Za-z0-9()\[\]₀-₉·\s+]+?)\s*(?:<->|<=>|⇄|⇌|->|→|=>|=)\s*([A-Za-z0-9()\[\]₀-₉·↑↓\s+]+)/u)
  if (!m) return null
  const r = splitSide(plainFormula(m[1]!))
  const p = splitSide(plainFormula(m[2]!))
  if (!r.length || !p.length || !/[A-Z]/.test(r[0]!)) return null
  return { r, p }
}

/* ============================================================ фразы */

type Tri = [ru: string, en: string, uz: string]

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
const pick = <T>(arr: readonly T[], seed: number): T => arr[seed % arr.length]!

/** Число для ответа: 2 знака, RU/UZ — запятая, без хвостовых нулей (98,08; 18,02; 40). */
export function formatMass(n: number, lang: QaLang): string {
  const s = n.toFixed(2).replace(/\.?0+$/, '')
  return lang === 'en' ? s : s.replace('.', ',')
}

const TYPE_LABEL: Record<string, Tri> = {
  combination: ['соединения', 'combination (synthesis)', 'birikish'],
  decomposition: ['разложения', 'decomposition', 'parchalanish'],
  substitution: ['замещения', 'substitution (displacement)', "o'rin olish"],
  exchange: ['обмена', 'exchange (double displacement)', 'almashinish'],
  neutralization: ['нейтрализации', 'neutralization', 'neytrallanish'],
  combustion: ['горения', 'combustion', 'yonish'],
  redox: ['окислительно-восстановительная', 'redox', 'oksidlanish-qaytarilish'],
  hydrolysis: ['гидролиза', 'hydrolysis', 'gidroliz'],
  electrolysis: ['электролиза', 'electrolysis', 'elektroliz'],
  addition: ['присоединения', 'addition', 'birikish'],
  elimination: ['отщепления', 'elimination', 'ajralish'],
  polymerization: ['полимеризации', 'polymerization', 'polimerlanish'],
  isomerization: ['изомеризации', 'isomerization', 'izomerlanish'],
  oxidation: ['окисления', 'oxidation', 'oksidlanish'],
  reduction: ['восстановления', 'reduction', 'qaytarilish'],
  esterification: ['этерификации', 'esterification', 'eterifikatsiya'],
  dehydration: ['дегидратации', 'dehydration', 'degidratatsiya'],
  hydrogenation: ['гидрирования', 'hydrogenation', 'gidrogenlash'],
  halogenation: ['галогенирования', 'halogenation', 'galogenlash'],
  cracking: ['крекинга', 'cracking', 'kreking'],
}
const CLASS_LABEL: Record<string, Tri> = {
  oxide: ['оксид', 'an oxide', 'oksid'],
  acid: ['кислота', 'an acid', 'kislota'],
  base: ['основание', 'a base', 'asos'],
  salt: ['соль', 'a salt', 'tuz'],
  simple: ['простое вещество', 'a simple substance', 'oddiy modda'],
  binary: ['бинарное соединение', 'a binary compound', 'binar birikma'],
  other: ['вещество', 'a substance', 'modda'],
}
const BLOCK_LABEL: Record<string, Tri> = {
  Nonmetal: ['неметалл', 'a nonmetal', 'metallmas'],
  'Noble gas': ['благородный (инертный) газ', 'a noble gas', 'inert gaz'],
  'Alkali metal': ['щелочной металл', 'an alkali metal', 'ishqoriy metall'],
  'Alkaline earth metal': ['щелочноземельный металл', 'an alkaline earth metal', 'ishqoriy-yer metall'],
  Metalloid: ['полуметалл', 'a metalloid', 'yarimmetall'],
  Halogen: ['галоген', 'a halogen', 'galogen'],
  'Post-transition metal': ['металл', 'a post-transition metal', 'metall'],
  'Transition metal': ['переходный металл', 'a transition metal', "o'tish metali"],
  Lanthanide: ['лантаноид', 'a lanthanide', 'lantanoid'],
  Actinide: ['актиноид', 'an actinide', 'aktinoid'],
}
const STATE_LABEL: Record<string, Tri> = { Gas: ['газ', 'a gas', 'gaz'], Liquid: ['жидкость', 'a liquid', 'suyuqlik'], Solid: ['твёрдое вещество', 'a solid', 'qattiq modda'] }

const li = (lang: QaLang) => (lang === 'en' ? 1 : lang === 'uz' ? 2 : 0)
const tr = (t: Tri | undefined, lang: QaLang, fallback = '') => (t ? t[li(lang)] : fallback)

function substanceName(s: QaSubstance, lang: QaLang): string {
  if (lang === 'en' && s.en) return s.en
  if (lang === 'uz' && s.uz) return s.uz
  return s.ru
}
function elementName(e: QaElement, lang: QaLang): string {
  return lang === 'en' ? e.en : lang === 'uz' ? e.uz : e.ru
}
function entName(ent: Ent, lang: QaLang): string {
  return ent.kind === 'substance' ? substanceName(ent.s, lang) : elementName(ent.e, lang)
}
const lower1 = (s: string) => (s.length > 1 && s[1] === s[1]!.toLowerCase() ? s[0]!.toLowerCase() + s.slice(1) : s)

const CATALOG_CIT: Tri = ['[ATOMLAB — каталог]', '[ATOMLAB — catalog]', '[ATOMLAB — katalog]']
const TABLE_CIT: Tri = ['[ATOMLAB — таблица элементов]', '[ATOMLAB — periodic table]', '[ATOMLAB — davriy jadval]']

function rxCitation(r: QaReaction, lang: QaLang): string {
  const g = r.bg ?? r.g[0]
  if (g && r.kp) return `[Kimyo ${g}, §${r.kp}]`
  if (g && r.pg) return `[Kimyo ${g}, ${lang === 'en' ? 'p.' : lang === 'uz' ? 'b.' : 'с.'} ${r.pg}]`
  return tr(['[ATOMLAB — реактор]', '[ATOMLAB — reactor]', '[ATOMLAB — reaktor]'], lang)
}

function conditionsText(r: QaReaction, lang: QaLang): string {
  const parts: string[] = []
  if (r.c) parts.push(r.c)
  if (r.lab?.heat && !/t°|нагрев|heat|qizdir|°c/i.test(r.c ?? '')) parts.push(tr(['нагревание', 'heating', 'qizdirish'], lang))
  if (r.lab?.pressure && !/давлен|pressure|bosim/i.test(r.c ?? '')) parts.push(tr(['давление', 'pressure', 'bosim'], lang))
  if (r.lab?.catalyst && !r.c?.includes(r.lab.catalyst)) parts.push(`${tr(['катализатор', 'catalyst', 'katalizator'], lang)} ${r.lab.catalyst}`)
  return parts.join(', ')
}

function typeText(r: QaReaction, lang: QaLang): string {
  const t = r.t ? tr(TYPE_LABEL[r.t], lang, r.t) : ''
  const base = t ? (lang === 'ru' ? (r.t === 'redox' ? 'реакция окислительно-восстановительная' : `реакция ${t}`) : lang === 'en' ? `${t} reaction` : `${t} reaksiyasi`) : ''
  const redox = r.rx === true && r.t !== 'redox' ? tr([', ОВР', ', redox', ', OQR'], lang) : r.rx === false ? tr([', не ОВР', ', not redox', ', OQR emas'], lang) : ''
  return base + redox
}

function rxLine(r: QaReaction, lang: QaLang, withType = true): string {
  const cond = conditionsText(r, lang)
  const bits = [withType ? typeText(r, lang) : '', cond].filter(Boolean).join('; ')
  return `${r.eq}${bits ? ` — ${bits}` : ''}`
}

function sortByGrade(list: QaReaction[], grade: number | null | undefined): QaReaction[] {
  const score = (r: QaReaction) => (grade && r.g.includes(grade) ? 20 : 0) + (r.mr ? 10 : 0) + (r.kp ? 2 : 0) - (r.org ? 5 : 0) - r.g[0]! * 0.1
  return [...list].sort((a, b) => score(b) - score(a))
}

function uniqueCitations(list: QaReaction[], lang: QaLang): string[] {
  return [...new Set(list.map((r) => rxCitation(r, lang)))].slice(0, 3)
}

/* ============================================================ ответы */

function done(text: string, citations: string[], intent: QaIntent, ent: Ent | null, numbers?: Record<string, number>): QaAnswer {
  const entity = ent ? talkOf(ent) : undefined
  if (entity) {
    try {
      updateProfile(() => ({ lastEntity: entity }))
    } catch {
      /* нет localStorage — не страшно */
    }
  }
  const body = citations.length ? `${text}\n\n${citations.join(' ')}` : text
  return { text: body, citations, intent, entity, numbers }
}

function breakdown(s: QaSubstance, idx: Index, lang: QaLang): string {
  const A = new Map(idx.bank.elements.map((e) => [e.s, e.A]))
  return Object.entries(s.comp)
    .map(([sym, n]) => `${n > 1 ? `${n}·` : ''}${formatMass(A.get(sym) ?? 0, lang)} (${sym})`)
    .join(' + ')
}

function answerSubstance(s: QaSubstance, intent: QaIntent, lang: QaLang, idx: Index, seed: number, grade: number | null | undefined): QaAnswer | null {
  const name = substanceName(s, lang)
  const ent: Ent = { kind: 'substance', s }
  const cls = tr(CLASS_LABEL[s.cl2 ?? s.cls] ?? CLASS_LABEL.other, lang)
  const fam = s.fam ? (lang === 'en' ? s.fam.en : lang === 'uz' ? s.fam.uz : s.fam.ru) : ''
  const cat = tr(CATALOG_CIT, lang)
  switch (intent) {
    case 'molar':
    case 'armass': {
      const M = formatMass(s.M, lang)
      const b = breakdown(s, idx, lang)
      const ru = [
        `Молярная масса вещества «${name}» (${s.f}) — ${M} г/моль. Считаем по формуле: ${b} = ${M}.`,
        `M(${s.f}) = ${M} г/моль. Складываем атомные массы: ${b}.`,
        `${name}, ${s.f}: молярная масса ${M} г/моль (${b}). Единица — граммы на моль.`,
      ]
      const en = [
        `The molar mass of ${lower1(name)} (${s.f}) is ${M} g/mol. From the formula: ${b} = ${M}.`,
        `M(${s.f}) = ${M} g/mol. Add up the atomic masses: ${b}.`,
        `${name}, ${s.f}: molar mass ${M} g/mol (${b}). The unit is grams per mole.`,
      ]
      const uz = [
        `${name} (${s.f}) molyar massasi — ${M} g/mol. Formula bo'yicha: ${b} = ${M}.`,
        `M(${s.f}) = ${M} g/mol. Atom massalarini qo'shamiz: ${b}.`,
        `${name}, ${s.f}: molyar massa ${M} g/mol (${b}). Birligi — gramm/mol.`,
      ]
      return done(pick(lang === 'en' ? en : lang === 'uz' ? uz : ru, seed), [tr(TABLE_CIT, lang)], 'molar', ent, { M: s.M })
    }
    case 'formula': {
      const ru = [`Формула вещества «${name}» — ${s.f}. Это ${cls}${fam ? ` (${lower1(fam)})` : ''}.`, `${name}: ${s.f}. По классу — ${cls}${fam ? `, семейство «${fam}»` : ''}.`, `Записываем так: ${s.f} — ${lower1(name)}, ${cls}.`]
      const en = [`The formula of ${lower1(name)} is ${s.f}. It is ${cls}${fam ? ` (${lower1(fam)})` : ''}.`, `${name}: ${s.f}. By class it is ${cls}${fam ? `, family "${fam}"` : ''}.`, `We write it as ${s.f} — ${lower1(name)}, ${cls}.`]
      const uz = [`${name} formulasi — ${s.f}. Bu ${cls}${fam ? ` (${lower1(fam)})` : ''}.`, `${name}: ${s.f}. Sinfi — ${cls}${fam ? `, oilasi «${fam}»` : ''}.`, `Bunday yoziladi: ${s.f} — ${lower1(name)}, ${cls}.`]
      return done(pick(lang === 'en' ? en : lang === 'uz' ? uz : ru, seed), [cat], 'formula', ent)
    }
    case 'class':
    case 'family': {
      const root = s.fam?.root ? tr([`, общий корень — ${s.fam.root}`, `, common root ${s.fam.root}`, `, umumiy ildiz — ${s.fam.root}`], lang) : ''
      const ru = [`${name} (${s.f}) — это ${cls}${fam ? `, семейство «${fam}»${root}` : ''}.`, `По классу ${s.f} — ${cls}${fam ? `; относится к семейству «${fam}»${root}` : ''}.`, `${name} (${s.f}): класс — ${cls}${fam ? `, семейство — ${lower1(fam)}${root}` : ''}.`]
      const en = [`${name} (${s.f}) is ${cls}${fam ? `, family "${fam}"${root}` : ''}.`, `By class ${s.f} is ${cls}${fam ? `; it belongs to the family "${fam}"${root}` : ''}.`, `${name} (${s.f}): class — ${cls}${fam ? `, family — ${lower1(fam)}${root}` : ''}.`]
      const uz = [`${name} (${s.f}) — bu ${cls}${fam ? `, «${fam}» oilasi${root}` : ''}.`, `${s.f} sinfi — ${cls}${fam ? `; «${fam}» oilasiga kiradi${root}` : ''}.`, `${name} (${s.f}): sinfi — ${cls}${fam ? `, oilasi — ${lower1(fam)}${root}` : ''}.`]
      return done(pick(lang === 'en' ? en : lang === 'uz' ? uz : ru, seed), [cat], intent, ent)
    }
    case 'usage': {
      if (!s.use) return null
      const ru = [`${name} (${s.f}) — применение: ${lower1(s.use)}`, `Где используют ${s.f}: ${lower1(s.use)}`, `${s.f}: ${s.use}`]
      const en = [`${name} (${s.f}) — uses (from the catalog, in Russian): ${s.use}`, `Where ${lower1(name)} is used: ${s.use}`, `${s.f}: ${s.use}`]
      const uz = [`${name} (${s.f}) — qo'llanilishi (katalogdan, ruscha): ${s.use}`, `${name} qayerda ishlatiladi: ${s.use}`, `${s.f}: ${s.use}`]
      return done(pick(lang === 'en' ? en : lang === 'uz' ? uz : ru, seed), [cat], 'usage', ent)
    }
    case 'source': {
      if (!s.src) return null
      const ru = [`${name} (${s.f}) — откуда берут: ${lower1(s.src)}`, `Откуда берут ${s.f}: ${lower1(s.src)}`, `${s.f}: ${s.src}`]
      const en = [`${name} (${s.f}) — where it comes from (catalog, in Russian): ${s.src}`, `Source of ${lower1(name)}: ${s.src}`, `${s.f}: ${s.src}`]
      const uz = [`${name} (${s.f}) — qayerdan olinadi (katalog, ruscha): ${s.src}`, `${name} manbai: ${s.src}`, `${s.f}: ${s.src}`]
      return done(pick(lang === 'en' ? en : lang === 'uz' ? uz : ru, seed), [cat], 'source', ent)
    }
    case 'obtain': {
      const made = sortByGrade((idx.rxByProduct.get(s.fa.toLowerCase()) ?? []).filter((r) => !r.org || s.id.startsWith('org')), grade).slice(0, 3)
      if (!made.length && !s.rec) return null
      const lines = made.map((r, i) => `${i + 1}) ${rxLine(r, lang)} ${rxCitation(r, lang)}`)
      const rec = s.rec && !made.some((r) => plainFormula(r.eq).includes(plainFormula(s.rec!.split(';')[0]!.split('→')[0]!.trim()))) ? tr([`Каталог: ${s.rec}`, `Catalog: ${s.rec}`, `Katalog: ${s.rec}`], lang) : ''
      const head = pick(
        lang === 'en'
          ? [`How to obtain ${lower1(name)} (${s.f}):`, `${name} (${s.f}) can be prepared like this:`, `Ways to get ${s.f}:`]
          : lang === 'uz'
            ? [`${name} (${s.f}) qanday olinadi:`, `${name} (${s.f}) ni shunday olish mumkin:`, `${s.f} olish usullari:`]
            : [`Как получить ${s.f} (${lower1(name)}):`, `${name} (${s.f}) получают так:`, `Способы получения ${s.f}:`],
        seed,
      )
      return done([head, ...lines, rec].filter(Boolean).join('\n'), [...uniqueCitations(made, lang), ...(rec ? [cat] : [])], 'obtain', ent)
    }
    case 'reacts': {
      const list = sortByGrade((idx.rxByReactant.get(s.fa.toLowerCase()) ?? []).filter((r) => r.r.length > 1), grade)
      // По одной на тип, потом остальные — до 5.
      const byType = new Map<string, QaReaction>()
      for (const r of list) if (!byType.has(r.t ?? '')) byType.set(r.t ?? '', r)
      const chosen = [...byType.values()]
      for (const r of list) if (chosen.length < 5 && !chosen.includes(r)) chosen.push(r)
      if (!chosen.length) return null
      const head = pick(
        lang === 'en'
          ? [`What ${lower1(name)} (${s.f}) reacts with — from the textbooks:`, `Reactions of ${s.f} in the textbooks:`, `${name} takes part in these reactions:`]
          : lang === 'uz'
            ? [`${name} (${s.f}) nima bilan reaksiyaga kirishadi — darsliklardan:`, `${s.f} reaksiyalari darsliklarda:`, `${name} quyidagi reaksiyalarda qatnashadi:`]
            : [`С чем реагирует ${s.f} (${lower1(name)}) — по учебникам:`, `Реакции ${s.f} в учебниках:`, `${name} участвует в таких реакциях:`],
        seed,
      )
      const lines = chosen.slice(0, 5).map((r, i) => `${i + 1}) ${rxLine(r, lang)} ${rxCitation(r, lang)}`)
      return done([head, ...lines].join('\n'), uniqueCitations(chosen, lang), 'reacts', ent)
    }
    case 'where': {
      const rx = sortByGrade(
        [...(idx.rxByReactant.get(s.fa.toLowerCase()) ?? []), ...(idx.rxByProduct.get(s.fa.toLowerCase()) ?? [])].filter((r) => r.kp),
        grade,
      )
      const seen = new Set<string>()
      const spots: string[] = []
      for (const r of rx) {
        const c = rxCitation(r, lang)
        if (seen.has(c)) continue
        seen.add(c)
        spots.push(`${c}${r.ttl ? ` «${r.ttl}»` : ''}: ${r.eq}`)
        if (spots.length >= 3) break
      }
      const grades = s.g.length ? s.g.join(', ') : ''
      const ch = s.ch ? tr([`, тема «${s.ch}»`, `, topic "${s.ch}"`, `, mavzu «${s.ch}»`], lang) : ''
      if (!grades && !spots.length) return null
      const head = grades
        ? pick(
            lang === 'en'
              ? [`${name} (${s.f}) is studied in grade ${grades}${ch}.`, `In the textbooks ${s.f} appears in grade ${grades}${ch}.`, `Grade ${grades}${ch} — that is where ${lower1(name)} is covered.`]
              : lang === 'uz'
                ? [`${name} (${s.f}) ${grades}-sinfda o'rganiladi${ch}.`, `Darsliklarda ${s.f} ${grades}-sinfda uchraydi${ch}.`, `${grades}-sinf${ch} — ${lower1(name)} shu yerda o'tiladi.`]
                : [`${name} (${s.f}) изучается в ${grades} классе${ch}.`, `В учебниках ${s.f} встречается в ${grades} классе${ch}.`, `${grades} класс${ch} — там проходят ${s.f}.`],
            seed,
          )
        : ''
      const list = spots.length ? `${tr(['Где смотреть:', 'Where to look:', 'Qayerdan qarash:'], lang)}\n${spots.map((x) => `• ${x}`).join('\n')}` : ''
      return done([head, list].filter(Boolean).join('\n'), [...seen].slice(0, 3), 'where', ent)
    }
    case 'definition':
    case 'about': {
      const desc = s.d ? ` ${s.d}` : ''
      const grades = s.g.length ? tr([` Изучается в ${s.g.join(', ')} классе.`, ` Studied in grade ${s.g.join(', ')}.`, ` ${s.g.join(', ')}-sinfda o'rganiladi.`], lang) : ''
      const ru = [`${name} (${s.f}) — ${cls}${fam ? `, семейство «${fam}»` : ''}, M = ${formatMass(s.M, lang)} г/моль.${desc}${grades}`, `${name}, формула ${s.f}: ${cls}${fam ? ` из семейства «${fam}»` : ''}.${desc}${grades}`, `Коротко о ${s.f} (${lower1(name)}): ${cls}${fam ? `, ${lower1(fam)}` : ''}; молярная масса ${formatMass(s.M, lang)} г/моль.${desc}`]
      const en = [`${name} (${s.f}) is ${cls}${fam ? `, family "${fam}"` : ''}, M = ${formatMass(s.M, lang)} g/mol.${desc ? ` Catalog note (Russian):${desc}` : ''}${grades}`, `${name}, formula ${s.f}: ${cls}${fam ? ` from the family "${fam}"` : ''}.${desc}${grades}`, `In short, ${s.f} (${lower1(name)}): ${cls}${fam ? `, ${lower1(fam)}` : ''}; molar mass ${formatMass(s.M, lang)} g/mol.${desc}`]
      const uz = [`${name} (${s.f}) — ${cls}${fam ? `, «${fam}» oilasi` : ''}, M = ${formatMass(s.M, lang)} g/mol.${desc ? ` Katalog izohi (ruscha):${desc}` : ''}${grades}`, `${name}, formulasi ${s.f}: ${cls}${fam ? `, «${fam}» oilasidan` : ''}.${desc}${grades}`, `Qisqacha ${s.f} (${lower1(name)}): ${cls}${fam ? `, ${lower1(fam)}` : ''}; molyar massasi ${formatMass(s.M, lang)} g/mol.${desc}`]
      return done(pick(lang === 'en' ? en : lang === 'uz' ? uz : ru, seed), [cat], intent, ent, { M: s.M })
    }
    default:
      return null
  }
}

function answerElement(e: QaElement, intent: QaIntent, lang: QaLang, seed: number): QaAnswer | null {
  const name = elementName(e, lang)
  const ent: Ent = { kind: 'element', e }
  const cit = [tr(TABLE_CIT, lang)]
  const block = tr(BLOCK_LABEL[e.blk], lang, e.blk)
  switch (intent) {
    case 'armass':
    case 'molar': {
      const A = formatMass(e.A, lang)
      const ru = [`Относительная атомная масса элемента ${name} (${e.s}) — ${A}; молярная масса атомов — ${A} г/моль.`, `Ar(${e.s}) = ${A}. Значит, моль атомов ${e.s} весит ${A} г.`, `${name}, ${e.s}: атомная масса ${A} а. е. м.`]
      const en = [`The relative atomic mass of ${lower1(name)} (${e.s}) is ${A}; the molar mass of its atoms is ${A} g/mol.`, `Ar(${e.s}) = ${A}. So a mole of ${lower1(name)} atoms weighs ${A} g.`, `${name}, ${e.s}: atomic mass ${A} u.`]
      const uz = [`${name} (${e.s}) nisbiy atom massasi — ${A}; atomlarining molyar massasi — ${A} g/mol.`, `Ar(${e.s}) = ${A}. Demak, bir mol ${lower1(name)} atomi ${A} g keladi.`, `${name}, ${e.s}: atom massasi ${A} m.a.b.`]
      return done(pick(lang === 'en' ? en : lang === 'uz' ? uz : ru, seed), cit, 'armass', ent, { A: e.A })
    }
    case 'position': {
      const per = e.per ?? '—'
      const grp = e.grp ?? tr(['вне основных групп', 'outside the main groups', 'asosiy guruhlardan tashqari'], lang)
      const ru = [`${name} (${e.s}) — ${per}-й период, ${typeof grp === 'number' ? `${grp}-я группа` : grp}; порядковый номер ${e.z}, ${block}.`, `${name}: ищи в ${per} периоде${typeof grp === 'number' ? `, группа ${grp}` : ''} — №${e.z}, ${block}.`, `${e.s}: период ${per}${typeof grp === 'number' ? `, группа ${grp}` : ''}, Z = ${e.z}.`]
      const en = [`${name} (${e.s}) is in period ${per}${typeof grp === 'number' ? `, group ${grp}` : ` (${grp})`}; atomic number ${e.z}, ${block}.`, `Look for ${lower1(name)} in period ${per}${typeof grp === 'number' ? `, group ${grp}` : ''}: No. ${e.z}, ${block}.`, `${e.s}: period ${per}${typeof grp === 'number' ? `, group ${grp}` : ''}, Z = ${e.z}.`]
      const uz = [`${name} (${e.s}) — ${per}-davr${typeof grp === 'number' ? `, ${grp}-guruh` : ` (${grp})`}; tartib raqami ${e.z}, ${block}.`, `${name}ni ${per}-davrdan qidir${typeof grp === 'number' ? `, ${grp}-guruh` : ''}: №${e.z}, ${block}.`, `${e.s}: davr ${per}${typeof grp === 'number' ? `, guruh ${grp}` : ''}, Z = ${e.z}.`]
      return done(pick(lang === 'en' ? en : lang === 'uz' ? uz : ru, seed), cit, 'position', ent, { period: e.per ?? 0, group: e.grp ?? 0, z: e.z })
    }
    case 'valency': {
      if (!e.ox) return null
      const ru = [`${name} (${e.s}): степени окисления по таблице — ${e.ox}.`, `${e.s} проявляет степени окисления ${e.ox}.`, `Возможные степени окисления ${e.s}: ${e.ox}.`]
      const en = [`Oxidation states of ${lower1(name)} (${e.s}) from the table: ${e.ox}.`, `${e.s} shows oxidation states ${e.ox}.`, `Possible oxidation states of ${lower1(name)}: ${e.ox}.`]
      const uz = [`${name} (${e.s}) oksidlanish darajalari jadval bo'yicha: ${e.ox}.`, `${e.s} ${e.ox} oksidlanish darajalarini namoyon qiladi.`, `${name} uchun mumkin bo'lgan oksidlanish darajalari: ${e.ox}.`]
      return done(pick(lang === 'en' ? en : lang === 'uz' ? uz : ru, seed), cit, 'valency', ent)
    }
    case 'config': {
      if (!e.cfg) return null
      const ru = [`Электронная конфигурация элемента ${name} (${e.s}, Z = ${e.z}): ${e.cfg}.`, `${e.s}: ${e.cfg} — так распределены ${e.z} электронов.`, `Записываем конфигурацию ${e.s}: ${e.cfg}.`]
      const en = [`Electron configuration of ${lower1(name)} (${e.s}, Z = ${e.z}): ${e.cfg}.`, `${e.s}: ${e.cfg} — that is how its ${e.z} electrons are arranged.`, `We write the configuration of ${lower1(name)} as ${e.cfg}.`]
      const uz = [`${name} (${e.s}, Z = ${e.z}) elektron konfiguratsiyasi: ${e.cfg}.`, `${e.s}: ${e.cfg} — ${e.z} ta elektron shunday joylashgan.`, `${name} konfiguratsiyasini shunday yozamiz: ${e.cfg}.`]
      return done(pick(lang === 'en' ? en : lang === 'uz' ? uz : ru, seed), cit, 'config', ent, { z: e.z })
    }
    case 'formula':
    case 'definition':
    case 'about':
    case 'class': {
      const st = e.st ? tr(STATE_LABEL[e.st], lang, e.st) : ''
      const A = formatMass(e.A, lang)
      const per = e.per ?? '—'
      const grp = typeof e.grp === 'number' ? e.grp : '—'
      const ru = [`${name} (${e.s}) — химический элемент №${e.z}, ${block}; период ${per}, группа ${grp}, Ar = ${A}${st ? `; при обычных условиях — ${st}` : ''}.`, `${e.s}, ${lower1(name)}: порядковый номер ${e.z}, ${block}, Ar = ${A}${e.ox ? `, степени окисления ${e.ox}` : ''}.`, `Карточка элемента: ${name} (${e.s}), Z = ${e.z}, период ${per}, группа ${grp}, ${block}, Ar = ${A}.`]
      const en = [`${name} (${e.s}) is chemical element No. ${e.z}, ${block}; period ${per}, group ${grp}, Ar = ${A}${st ? `; at normal conditions it is ${st}` : ''}.`, `${e.s}, ${lower1(name)}: atomic number ${e.z}, ${block}, Ar = ${A}${e.ox ? `, oxidation states ${e.ox}` : ''}.`, `Element card: ${name} (${e.s}), Z = ${e.z}, period ${per}, group ${grp}, ${block}, Ar = ${A}.`]
      const uz = [`${name} (${e.s}) — №${e.z} kimyoviy element, ${block}; davr ${per}, guruh ${grp}, Ar = ${A}${st ? `; oddiy sharoitda — ${st}` : ''}.`, `${e.s}, ${lower1(name)}: tartib raqami ${e.z}, ${block}, Ar = ${A}${e.ox ? `, oksidlanish darajalari ${e.ox}` : ''}.`, `Element kartochkasi: ${name} (${e.s}), Z = ${e.z}, davr ${per}, guruh ${grp}, ${block}, Ar = ${A}.`]
      return done(pick(lang === 'en' ? en : lang === 'uz' ? uz : ru, seed), cit, intent, ent, { z: e.z, A: e.A })
    }
    default:
      return null
  }
}

function answerReactionsBetween(ents: Ent[], intent: QaIntent, lang: QaLang, idx: Index, seed: number, grade: number | null | undefined): QaAnswer | null {
  const sets = ents.map((e) => new Set(formulasOf(e)))
  const first = [...sets[0]!].flatMap((f) => idx.rxByReactant.get(f) ?? [])
  const matches = first.filter((r) => sets.every((set) => r.r.some((f) => set.has(f.toLowerCase()))))
  if (!matches.length) return null
  const exact = matches.filter((r) => r.r.length === sets.length)
  const list = sortByGrade(exact.length ? exact : matches, grade).slice(0, 3)
  const names = ents.map((e) => entName(e, lang)).map(lower1)
  const joined = lang === 'en' ? names.join(' and ') : lang === 'uz' ? names.join(' va ') : names.join(' и ')
  const head =
    intent === 'rxtype'
      ? pick(
          lang === 'en'
            ? [`Reaction of ${joined} — by type:`, `Here is what kind of reaction it is:`, `Type of the reaction between ${joined}:`]
            : lang === 'uz'
              ? [`${joined} reaksiyasi — turi bo'yicha:`, `Bu qanday reaksiya ekanini ko'ramiz:`, `${joined} orasidagi reaksiya turi:`]
              : [`${names.map((n) => n[0]!.toUpperCase() + n.slice(1)).join(' + ')} — по типу:`, `Смотрим, что это за реакция:`, `Реагируют ${joined}; тип реакции:`],
          seed,
        )
      : pick(
          lang === 'en'
            ? [`From ${joined} you get:`, `${names.map((n) => n[0]!.toUpperCase() + n.slice(1)).join(' + ')} — here is what the textbooks give:`, `When ${joined} react, the products are:`]
            : lang === 'uz'
              ? [`${joined} dan hosil bo'ladi:`, `${names.map((n) => n[0]!.toUpperCase() + n.slice(1)).join(' + ')} — darsliklarda shunday:`, `${joined} reaksiyaga kirishganda hosil bo'ladi:`]
              : [`Реагируют ${joined} — получится:`, `${names.map((n) => n[0]!.toUpperCase() + n.slice(1)).join(' + ')} — в учебниках так:`, `Когда реагируют ${joined}, образуется:`],
          seed,
        )
  const lines = list.map((r, i) => `${list.length > 1 ? `${i + 1}) ` : ''}${rxLine(r, lang)} ${rxCitation(r, lang)}`)
  return done([head, ...lines].join('\n'), uniqueCitations(list, lang), intent === 'rxtype' ? 'rxtype' : 'products', ents[0]!)
}

function answerEquation(eq: { r: string[]; p: string[] }, intent: QaIntent | null, lang: QaLang, idx: Index, seed: number, grade: number | null | undefined): QaAnswer | null {
  let r = idx.rxByKey.get(rxKey(eq.r, eq.p)) ?? null
  if (!r) {
    // Продукты записаны не полностью / с опечаткой — ищем по полному набору реагентов.
    const cands = (idx.rxByReactant.get(eq.r[0]!.toLowerCase()) ?? []).filter(
      (x) => x.r.length === eq.r.length && eq.r.every((f) => x.r.some((y) => y.toLowerCase() === f.toLowerCase())) && eq.p.some((f) => x.p.some((y) => y.toLowerCase() === f.toLowerCase())),
    )
    r = sortByGrade(cands, grade)[0] ?? null
  }
  if (!r) return null
  if (intent === 'where') {
    const ru = [`Это уравнение есть в учебнике: ${r.eq}${r.ttl ? ` — параграф «${r.ttl}»` : ''}.`, `${r.eq} — смотри ${rxCitation(r, lang)}${r.ttl ? `, «${r.ttl}»` : ''}.`, `В книге: ${r.eq}${r.ttl ? ` (тема «${r.ttl}»)` : ''}.`]
    const en = [`This equation is in the textbook: ${r.eq}${r.ttl ? ` — paragraph "${r.ttl}"` : ''}.`, `${r.eq} — see ${rxCitation(r, lang)}${r.ttl ? `, "${r.ttl}"` : ''}.`, `In the book: ${r.eq}${r.ttl ? ` (topic "${r.ttl}")` : ''}.`]
    const uz = [`Bu tenglama darslikda bor: ${r.eq}${r.ttl ? ` — «${r.ttl}» paragrafi` : ''}.`, `${r.eq} — qarang ${rxCitation(r, lang)}${r.ttl ? `, «${r.ttl}»` : ''}.`, `Kitobda: ${r.eq}${r.ttl ? ` («${r.ttl}» mavzusi)` : ''}.`]
    return done(pick(lang === 'en' ? en : lang === 'uz' ? uz : ru, seed), [rxCitation(r, lang)], 'where', null)
  }
  const type = typeText(r, lang)
  const cond = conditionsText(r, lang)
  const condText = cond ? tr([` Условия: ${cond}.`, ` Conditions: ${cond}.`, ` Sharoit: ${cond}.`], lang) : ''
  if (!type && !cond) return null
  const ru = [`${r.eq} — ${type || 'реакция из учебника'}.${condText}`, `Это ${type || 'реакция из учебника'}: ${r.eq}.${condText}`, `По учебнику ${r.eq} — ${type || 'реакция'}.${condText}`]
  const en = [`${r.eq} — ${type || 'a textbook reaction'}.${condText}`, `This is ${type ? `a ${type}` : 'a textbook reaction'}: ${r.eq}.${condText}`, `In the textbook ${r.eq} is ${type ? `a ${type}` : 'a reaction'}.${condText}`]
  const uz = [`${r.eq} — ${type || 'darslikdagi reaksiya'}.${condText}`, `Bu ${type || 'darslikdagi reaksiya'}: ${r.eq}.${condText}`, `Darslik bo'yicha ${r.eq} — ${type || 'reaksiya'}.${condText}`]
  return done(pick(lang === 'en' ? en : lang === 'uz' ? uz : ru, seed), [rxCitation(r, lang)], 'rxtype', null)
}

function answerTranslate(stems: string[], idx: Index, lang: QaLang, seed: number): QaAnswer | null {
  let best: QaTerm | null = null
  let bestN = 0
  for (let n = Math.min(4, stems.length); n >= 1 && !best; n--) {
    for (let i = 0; i + n <= stems.length; i++) {
      const t = idx.terms.get(stems.slice(i, i + n).join(' '))
      if (t && n > bestN) {
        best = t[0]!
        bestN = n
      }
    }
  }
  if (!best) return null
  const f = best.f?.length ? ` (${best.f.join(', ')})` : ''
  const en = best.en.join(' / ') || '—'
  const uz = best.uz.join(' / ') || '—'
  const ruT = [`«${best.ru}»${f}: по-английски — ${en}, по-узбекски — ${uz}.`, `Термин «${best.ru}»${f}. English: ${en}. Oʻzbekcha: ${uz}.`, `${best.ru}${f} = ${en} (англ.) = ${uz} (узб.).`]
  const enT = [`"${best.ru}"${f}: in English — ${en}, in Uzbek — ${uz}.`, `The term "${best.ru}"${f}. English: ${en}. Uzbek: ${uz}.`, `${best.ru}${f} = ${en} (EN) = ${uz} (UZ).`]
  const uzT = [`«${best.ru}»${f}: inglizcha — ${en}, oʻzbekcha — ${uz}.`, `«${best.ru}»${f} atamasi. Inglizcha: ${en}. Oʻzbekcha: ${uz}.`, `${best.ru}${f} = ${en} (ing.) = ${uz} (oʻzb.).`]
  return done(pick(lang === 'en' ? enT : lang === 'uz' ? uzT : ruT, seed), [tr(['[ATOMLAB — глоссарий]', '[ATOMLAB — glossary]', '[ATOMLAB — lugʻat]'], lang)], 'translate', null)
}

/** «Где в учебнике про валентность» — определения и § по термину (не вещество). */
function answerWhereTerm(stems: string[], idx: Index, lang: QaLang, seed: number, grade: number | null | undefined): QaAnswer | null {
  let defs: QaDefinition[] = []
  let key = ''
  for (let n = Math.min(4, stems.length); n >= 1 && !defs.length; n--) {
    for (let i = 0; i + n <= stems.length; i++) {
      const k = stems.slice(i, i + n).join(' ')
      const d = idx.defs.get(k)
      if (d?.length) {
        defs = d
        key = k
        break
      }
    }
  }
  const secs = key ? idx.sections.filter((s) => nameKey(s.title).split(' ').some((w) => key.split(' ').includes(w))) : []
  if (!defs.length && !secs.length) return null
  const sorted = [...defs].sort((a, b) => (grade && a.g === grade ? -1 : 0) - (grade && b.g === grade ? -1 : 0) || a.g - b.g)
  const lines: string[] = []
  const cits: string[] = []
  for (const d of sorted.slice(0, 2)) {
    const c = `[Kimyo ${d.g}, §${d.kp}]`
    cits.push(c)
    lines.push(`• ${d.term} — ${d.def} ${c}`)
  }
  for (const s of secs.slice(0, 3)) {
    const c = `[Kimyo ${s.g}, §${s.kp}]`
    if (cits.includes(c)) continue
    cits.push(c)
    lines.push(`• ${c} «${s.title}», ${tr(['с.', 'p.', 'b.'], lang)} ${s.pg}`)
  }
  const head = pick(lang === 'en' ? ['Where to find it in the textbooks:', 'Here is where the books cover it:', 'In the textbooks:'] : lang === 'uz' ? ['Darsliklarda qayerdan topish mumkin:', 'Kitoblarda shu yerda:', 'Darsliklarda:'] : ['Где искать в учебниках:', 'В книгах это здесь:', 'В учебниках:'], seed)
  return done([head, ...lines].join('\n'), cits.slice(0, 3), 'where', null)
}

/* ============================================================ вход */

const wordCount = (s: string) => s.replace(/[—–-]+/g, ' ').split(/\s+/).filter(Boolean).length

/**
 * Ответ по базе фактов или null (не уверены — пусть отвечает учебник).
 * Вызывается ПОСЛЕ humanTurn (элемент по символу, молярная масса по формуле уже отвечены там).
 */
export async function answerFromQaBank(text: string, opts: QaOptions): Promise<QaAnswer | null> {
  const t = text.trim()
  if (!t || t.length > 240) return null
  let idx: Index
  try {
    idx = await loadIndex()
  } catch {
    return null
  }
  const lang = opts.lang
  const grade = opts.grade ?? null
  const folded = fold(t)
  const seed = hash(folded)
  const intent = detectIntent(folded)
  const stems = correctTypos(tokenize(folded), idx).map(stemToken)

  if (intent === 'translate') return answerTranslate(stems, idx, lang, seed)

  const eq = parseEquationText(t)
  if (eq) return answerEquation(eq, intent, lang, idx, seed, grade)

  let groups = findEntities(t, folded, idx)
  if (!groups.length) {
    if (intent === 'where') return answerWhereTerm(stems, idx, lang, seed, grade)
    // Эллипсис: «а его формула?», «а молярная масса?» — прошлое вещество разговора.
    const elliptic = /(?<!\p{L})(его|е[её]|него|не[её]|этого|оно|она|он|а|it|its|this|that|uning|buning|shuning|bu|shu|u)(?!\p{L})/u.test(folded) || wordCount(folded) <= 3
    if (intent && elliptic && opts.lastEntity && wordCount(folded) <= 6 && intent !== 'definition' && intent !== 'about') {
      const prev = entityFromTalk(opts.lastEntity, idx)
      if (prev) groups = [[prev]]
    }
    if (!groups.length) return null
  }

  const ents = groups.map((g) => choose(g, intent, grade))
  if ((intent === 'products' || intent === 'rxtype') && ents.length >= 2) return answerReactionsBetween(ents.slice(0, 3), intent, lang, idx, seed, grade)
  if (!intent && ents.length >= 2 && /\s(и|and|va|\+)\s/u.test(folded) && wordCount(folded) <= 6) return answerReactionsBetween(ents.slice(0, 3), 'products', lang, idx, seed, grade)
  if (intent === 'products' || intent === 'rxtype') return null

  const ent = ents[0]!
  let finalIntent: QaIntent | null = intent
  if (!finalIntent) {
    // Голое название («серная кислота», «хлорид натрия?») — карточка; длинная фраза без вопроса — учебник.
    const rest = wordCount(folded.replace(/[?!.,]/g, ' ')) - (ent.kind === 'substance' ? wordCount(fold(entName(ent, lang))) : 1)
    if (rest > 1) return null
    finalIntent = 'about'
  }
  if (finalIntent === 'definition' || finalIntent === 'about') {
    // «Что такое моль», «почему вода кипит» — не наш вопрос: сущность должна быть сутью фразы.
    const extra = wordCount(folded.replace(/[?!.,]/g, ' ')) - wordCount(fold(entName(ent, lang)))
    if (extra > 4) return null
    if (/почему|зачем|как\s|сколько|why|how\s|nima uchun|qanday|nega/u.test(folded)) return null
  }
  if (ent.kind === 'substance') {
    return answerSubstance(ent.s, finalIntent, lang, idx, seed, grade)
  }
  if (finalIntent === 'reacts' || finalIntent === 'obtain' || finalIntent === 'where') {
    // Простое вещество элемента: реакции ищем по символу и двухатомной форме.
    const forms = formulasOf(ent)
    const sub = forms.map((f) => idx.byFormulaLower.get(f)?.find((x) => x.kind === 'substance')).find(Boolean)
    if (sub && sub.kind === 'substance') return answerSubstance(sub.s, finalIntent, lang, idx, seed, grade)
    if (finalIntent === 'reacts') {
      const list = sortByGrade(forms.flatMap((f) => idx.rxByReactant.get(f) ?? []).filter((r) => r.r.length > 1), grade)
      if (!list.length) return null
      const name = elementName(ent.e, lang)
      const head = tr([`С чем реагирует ${lower1(name)} — по учебникам:`, `What ${lower1(name)} reacts with — from the textbooks:`, `${name} nima bilan reaksiyaga kirishadi — darsliklardan:`], lang)
      const lines = list.slice(0, 5).map((r, i) => `${i + 1}) ${rxLine(r, lang)} ${rxCitation(r, lang)}`)
      return done([head, ...lines].join('\n'), uniqueCitations(list.slice(0, 5), lang), 'reacts', ent)
    }
    if (finalIntent === 'where') return answerWhereTerm(stems, idx, lang, seed, grade)
    return null
  }
  return answerElement(ent.e, finalIntent, lang, seed)
}

/** Размер базы — для отчёта и экрана «что умеет учитель». */
export async function qaBankStats(): Promise<{ substances: number; elements: number; reactions: number; terms: number; definitions: number; sections: number; names: number }> {
  const idx = await loadIndex()
  const b = idx.bank
  return {
    substances: b.substances.length,
    elements: b.elements.length,
    reactions: b.reactions.length,
    terms: b.terms.length,
    definitions: b.definitions.length,
    sections: b.sections.length,
    names: idx.names.size,
  }
}

export { prettyFormula as qaPrettyFormula }
