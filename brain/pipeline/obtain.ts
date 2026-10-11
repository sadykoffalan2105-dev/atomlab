/**
 * Инструмент «как получить X» / «способы получения X» / «как образуется X» / «how is X made» / «X qanday olinadi».
 * Берёт ТОЛЬКО проверенные уравнения из данных проекта и кладёт их в ответ и в подсказку модели как факты:
 *   1) src/data/catalog/catalogObtaining200.ts — этапы получения 200 веществ каталога (выверены по Kimyo 7–9);
 *   2) дополнения учебника ниже (электролиз воды, промышленный способ из воздуха) — для простых газов;
 *   3) qaBank: rec (способы получения из учебника) и реакции учебника, где вещество — продукт;
 *   4) 200 основных реакций (src/data/catalog/mainReactions200.ts), где вещество — главный продукт.
 * Лабораторные и промышленные способы — отдельными строками (по пометке «промышленность»).
 */
import { catalogObtainingSteps } from '../../src/data/catalog/catalogObtaining200.ts'
import { MAIN_REACTIONS_200 } from '../../src/data/catalog/mainReactions200.ts'
import type { Knowledge, QaElement, QaSubstance } from '../kb/shards.ts'
import { genitive } from './declension.ts'
import { findElements, findFormulas, findSubstances, pretty } from './entities.ts'
import type { Lang } from './normalize.ts'
import type { ToolResult } from './tools.ts'

const L = (lang: Lang, ru: string, uz: string, en: string) => (lang === 'ru' ? ru : lang === 'uz' ? uz : en)

/** Вопрос о получении (любой язык). «как образуется» — отдельно: там нужно именно вещество, не элемент и не ион. */
export const OBTAIN_RE =
  /(как\s+(можно\s+|их\s+|его\s+|е[её]\s+)?(получ|добы|производ|синтезир|приготов|выдел)|способ\p{L}*\s+(получ|добыч|производ)|получени\p{L}*|получа[ею]т|получить|добыва[ею]т|в\s+промышленности\s+получ|how\s+(is|are|do|does|can|to|we|you)\b[^?]{0,40}\b(made|produced|obtained|prepared|make|produce|obtain|prepare|get)|preparation\s+of|production\s+of|ways?\s+to\s+(make|obtain|produce|prepare)|qanday\s+(olin|hosil\s+qilin|ishlab\s+chiqar)|olish\s+usul|olinishi|olinadi|ishlab\s+chiqarish)/iu
const FORM_RE = /(как\s+образу|как\s+образовал|what\s+forms|how\s+(is|are)\b[^?]{0,30}\bformed|qanday\s+hosil\s+bo)/iu
const NOT_SUBSTANCE_FORM = /(ион|связ|молекул[аы]?\s+(вод|кисл)|электрон|облак|орбитал|кристалл|решётк|решетк|\bion|\bbond|electron|orbital|\bbog['ʻ‘’]?)/iu

const DIATOMIC = new Set(['H', 'O', 'N', 'F', 'Cl', 'Br', 'I'])

type Kind = 'lab' | 'industry' | 'any'
type Row = { eq: string; note?: string; kind: Kind }

/** Пометка учебника → лаборатория / промышленность / без пометки. */
const kindOf = (note = ''): Kind => (/промышл/iu.test(note) ? 'industry' : /(лаборатор|разложени|катализатор|аппарат|электролиз воды)/iu.test(note) ? 'lab' : 'any')

/** Дополнения учебника (Kimyo 7: электролиз воды, с. 136; промышленность — из жидкого воздуха). */
const EXTRA: Record<string, { lab?: Row[]; industry?: Record<Lang, string> }> = {
  tb_o2: {
    lab: [{ eq: '2H₂O →(электролиз) 2H₂↑ + O₂↑', note: 'электролиз воды (7 класс, с. 136)', kind: 'lab' }],
    industry: {
      ru: 'из воздуха: сжижение и перегонка жидкого воздуха (азот кипит при −196 °C и испаряется первым, кислород — при −183 °C) — физический способ, без химической реакции',
      uz: 'havodan: suyuq havoni haydash (azot −196 °C da birinchi bugʻlanadi, kislorod −183 °C da) — kimyoviy reaksiyasiz fizik usul',
      en: 'from air: fractional distillation of liquefied air (nitrogen boils off first at −196 °C, oxygen at −183 °C) — a physical method, no chemical reaction',
    },
  },
  tb_n2: {
    industry: {
      ru: 'из воздуха: перегонка жидкого воздуха (азот кипит при −196 °C) — физический способ',
      uz: 'havodan: suyuq havoni haydash (azot −196 °C da qaynaydi) — fizik usul',
      en: 'from air: distillation of liquefied air (nitrogen boils at −196 °C) — a physical method',
    },
  },
  tb_h2: {
    lab: [{ eq: '2H₂O →(электролиз) 2H₂↑ + O₂↑', note: 'электролиз воды (7 класс, с. 136)', kind: 'lab' }],
    industry: {
      ru: 'конверсия метана CH₄ + H₂O →(t°, кат.) CO + 3H₂ и электролиз воды',
      uz: 'metan konversiyasi CH₄ + H₂O →(t°, kat.) CO + 3H₂ va suv elektrolizi',
      en: 'steam reforming of methane CH₄ + H₂O →(t°, cat.) CO + 3H₂ and electrolysis of water',
    },
  },
}

type Target = { ascii: string; prettyF: string; sub: QaSubstance | null; el: QaElement | null }

function simpleSubstance(el: QaElement, kb: Knowledge): QaSubstance | null {
  const tries = DIATOMIC.has(el.s) ? [`${el.s}2`, el.s] : [el.s, `${el.s}4`, `${el.s}8`]
  for (const t of tries) {
    const s = kb.substanceByFormula.get(t)
    if (s) return s
  }
  return null
}

/** Бытовые и старые названия, которых нет в qaBank (там «Соляная кислота», «Оксид кальция»…). */
const ALIASES: [RegExp, string][] = [
  [/хлороводород|хлористого?\s+водород|hydrogen chloride|vodorod xlorid/iu, 'HCl'],
  [/негаш[её]н\p{L}*\s+извест|quicklime|so[ʻ'‘’]?ndirilmagan ohak/iu, 'CaO'],
  [/гаш[её]н\p{L}*\s+извест|slaked lime|so[ʻ'‘’]?ndirilgan ohak/iu, 'Ca(OH)2'],
  [/едк\p{L}*\s+натр|каустическ\p{L}*\s+сод|caustic soda/iu, 'NaOH'],
  [/питьев\p{L}*\s+сод|baking soda/iu, 'NaHCO3'],
  [/угарн\p{L}*\s+газ|carbon monoxide|is gazi/iu, 'CO'],
  [/сернист\p{L}*\s+газ|sulfur dioxide|sulphur dioxide/iu, 'SO2'],
  [/веселящ\p{L}*\s+газ|laughing gas/iu, 'N2O'],
]

function targetOf(text: string, kb: Knowledge, allowElement: boolean): Target | null {
  for (const [re, ascii] of ALIASES) {
    const sub = re.test(text) ? kb.substanceByFormula.get(ascii) : undefined
    if (sub) return { ascii, prettyF: sub.f, sub, el: null }
  }
  const f =findFormulas(text, true).find((x) => kb.substanceByFormula.has(x.ascii) || (Object.keys(x.counts).length === 1 && kb.elementBySymbol.has(x.ascii.replace(/\d+$/, ''))))
  const named = findSubstances(text, kb)
  const els = findElements(text, kb)
  if (f && (!named.length || f.index <= named[0]!.index)) {
    const sub = kb.substanceByFormula.get(f.ascii) ?? null
    return { ascii: f.ascii, prettyF: f.pretty, sub, el: Object.keys(f.counts).length === 1 ? (kb.elementBySymbol.get(Object.keys(f.counts)[0]!) ?? null) : null }
  }
  if (named.length) {
    const s = named[0]!.item
    const el = Object.keys(s.comp).length === 1 ? (kb.elementBySymbol.get(Object.keys(s.comp)[0]!) ?? null) : null
    return { ascii: s.fa, prettyF: s.f, sub: s, el }
  }
  if (allowElement && els.length) {
    const el = els[0]!.item
    const sub = simpleSubstance(el, kb)
    const ascii = sub?.fa ?? (DIATOMIC.has(el.s) ? `${el.s}2` : el.s)
    return { ascii, prettyF: sub?.f ?? pretty(ascii), sub, el }
  }
  return null
}

/** Правая часть уравнения содержит формулу (с учётом коэффициента, ↑/↓). */
function producesFormula(eq: string, prettyF: string): boolean {
  const right = eq.split(/→|⇄|⇌|=/).slice(1).join(' ')
  return right
    .split('+')
    .map((x) => x.replace(/\([^)]*\)$/, '').replace(/[↑↓\s]/g, '').replace(/^\d+/, ''))
    .some((x) => x === prettyF)
}

function rowsFor(t: Target, kb: Knowledge): Row[] {
  const rows: Row[] = []
  const seen = new Set<string>()
  const norm = (e: string) => e.replace(/\s+/g, '').replace(/[↑↓]/g, '').replace(/=/g, '→')
  const add = (r: Row) => {
    const k = norm(r.eq)
    if (seen.has(k) || rows.length >= 6) return
    seen.add(k)
    rows.push(r)
  }
  const id = t.sub?.id
  const cat = id ? catalogObtainingSteps(id) : null
  if (cat) for (const s of cat.steps) add({ eq: s.equation, note: s.note, kind: kindOf(s.note) })
  if (id && EXTRA[id]?.lab) for (const r of EXTRA[id].lab!) add(r)
  if (rows.length < 3 && t.sub?.rec) {
    // rec учебника: уравнения через «;» — иногда цепочка (S → SO₂ → SO₃ → H₂SO₄): берём всю, если хоть одно даёт вещество;
    // пояснения без уравнения («обжиг / длительное окисление…») и «Cl + Cl → Cl₂» (молекула из атомов) — пропускаем
    const eqs = t.sub.rec
      .split(/;\s*/)
      .map((r) => r.trim().replace(/\s=\s/, ' → '))
      .filter((eq) => /→|⇄/.test(eq) && !(eq.split(/→|⇄/)[0] ?? '').split('+').every((x) => /^\s*\d*[A-Z][a-z]?\s*$/.test(x)))
    if (eqs.some((eq) => producesFormula(eq, t.prettyF))) for (const eq of eqs) add({ eq, kind: 'any' })
  }
  if (rows.length < 3 && id) for (const m of MAIN_REACTIONS_200) if (m.main === id && producesFormula(m.equation, t.prettyF)) add({ eq: m.equation, kind: 'any' })
  if (rows.length < 2) {
    const rank = (x: string) => (x === 'decomposition' ? 0 : x === 'substitution' ? 1 : 2)
    for (const r of [...kb.qa.reactions].filter((x) => x.p.includes(t.ascii)).sort((a, b) => rank(a.t) - rank(b.t))) {
      if (rows.length >= 3) break
      if (producesFormula(r.eq, t.prettyF)) add({ eq: r.eq, note: r.kp ? `Kimyo ${r.bg ?? r.g[0]}, §${r.kp}` : undefined, kind: 'any' })
    }
  }
  return rows
}

function nameOf(t: Target, lang: Lang): string {
  if (lang === 'ru') return t.sub?.ru || t.el?.ru || t.prettyF
  const n = lang === 'uz' ? t.sub?.uz || t.el?.uz : t.sub?.en || t.el?.en
  return n || t.prettyF
}

export function isObtainQuestion(cmp: string): boolean {
  return OBTAIN_RE.test(cmp) || (FORM_RE.test(cmp) && !NOT_SUBSTANCE_FORM.test(cmp))
}

export function obtainTool(text: string, cmp: string, lang: Lang, kb: Knowledge): ToolResult | null {
  const obtain = OBTAIN_RE.test(cmp)
  const form = !obtain && FORM_RE.test(cmp) && !NOT_SUBSTANCE_FORM.test(cmp)
  if (!obtain && !form) return null
  const t = targetOf(text, kb, obtain)
  if (!t) return null
  const rows = rowsFor(t, kb)
  const ind = t.sub ? EXTRA[t.sub.id]?.industry : undefined
  if (!rows.length && !ind) return null
  const circ = ['①', '②', '③', '④', '⑤', '⑥']
  const fmtRow = (r: Row, i: number) => `${circ[i] ?? `${i + 1}.`} ${r.eq}${lang === 'ru' && r.note ? ` — ${r.note}` : ''}`
  const lab = rows.filter((r) => r.kind === 'lab')
  const other = rows.filter((r) => r.kind === 'any')
  const industry = rows.filter((r) => r.kind === 'industry')
  const name = nameOf(t, lang)
  const head = L(
    lang,
    `Способы получения ${genitive(name)} (${t.prettyF}) — проверенные уравнения учебника и ATOMLAB:`,
    `${name} (${t.prettyF}) olish usullari — darslik va ATOMLAB tekshirgan tenglamalar:`,
    `How ${name.toLowerCase()} (${t.prettyF}) is obtained — verified textbook/ATOMLAB equations:`,
  )
  const lines = [head]
  let n = 0
  if (lab.length) lines.push(`${L(lang, 'В лаборатории', 'Laboratoriyada', 'In the lab')}: ${lab.map((r) => fmtRow(r, n++)).join('; ')}.`)
  if (other.length) lines.push(`${lab.length || industry.length ? L(lang, 'Также', 'Shuningdek', 'Also') : L(lang, 'Уравнения', 'Tenglamalar', 'Equations')}: ${other.map((r) => fmtRow(r, n++)).join('; ')}.`)
  const indParts = [...industry.map((r) => fmtRow(r, n++)), ...(ind ? [ind[lang]] : [])]
  if (indParts.length) lines.push(`${L(lang, 'В промышленности', 'Sanoatda', 'In industry')}: ${indParts.join('; ')}.`)
  const all = rows.map((r) => r.eq)
  return {
    tool: 'obtain',
    text: lines.join('\n'),
    facts: `${t.prettyF}: ${all.join('; ')}${ind ? `; ${ind.en}` : ''}`,
    // уравнения — справка, а не «числа»: модель может пересказать их своими словами, точный текст уже в подсказке
    numbers: [],
    cite: '[ATOMLAB: способы получения]',
  }
}
