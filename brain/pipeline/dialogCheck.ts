/**
 * Мозг v2, DIALOG: самопроверка ответа модели по точным фактам — после генерации, до done.
 *   (1) числа инструментов на месте (ensureToolNumbers);
 *   (2) уравнения: коэффициенты, которые не сходятся, заменяются уравненными (balanceEquation; версия инструмента — первой);
 *   (3) «а у натрия?»: новая сущность обязана быть в ответе — иначе в начало одна фраза фактов из справочника;
 *   (4) узбекский: апострофы oʻ/gʻ к одному виду (U+02BB); доля кириллицы > 10 % — пометка (перевод делает llm.ts);
 *   (5) длина: длиннее класса × 1,25 — обрезка по предложению; короче половины минимума — добор из запасного пути;
 *   (6) «не реагирует … реагирует» про одно и то же в соседних предложениях — пометка 'contradiction' (на gpu — проверка моделью).
 * fixes пишутся в журнал (dialogs.jsonl), в done не уходят.
 */
import { analyzeTerms } from '../../src/learn/kb/analyzer.ts'
import type { Knowledge } from '../kb/shards.ts'
import type { AnswerPlan, StandaloneQuery } from './dialogTypes.ts'
import { entityMentioned } from './entities.ts'
import { elementFacts, substanceFacts } from './fallback.ts'
import { jaccard } from './hybrid.ts'
import type { Lang } from './normalize.ts'
import { ensureToolNumbers, scrubR3, splitSentences, trimToWords, wordCount } from './postcheck.ts'
import { balanceEquation, extractEquation, type ToolResult } from './tools.ts'

const SUBS = '₀₁₂₃₄₅₆₇₈₉'
/** «2H2O» → «2H₂O»: индексы — цифры после буквы/скобки, коэффициент впереди остаётся. */
const pretty = (ascii: string) => ascii.replace(/(?<=[A-Za-z)\]])\d+/g, (ds) => [...ds].map((d) => SUBS[Number(d)]!).join(''))

/** Узбекская латиница: o'/g' и похожие апострофы → oʻ/gʻ (U+02BB). */
export function normalizeUzApostrophes(text: string): string {
  return text.replace(/(?<=[oOgG])['’‘`ʼ](?=\p{L})/gu, 'ʻ')
}

/** Узбекская латиница терминов в русском ответе → кириллица (замечено вживую на qwen2.5:7b). */
const RU_FROM_LAT: Record<string, string> = { elektron: 'электрон', proton: 'протон', neytron: 'нейтрон', molekula: 'молекула', valentlik: 'валентность', kislota: 'кислота', kislorod: 'кислород', vodorod: 'водород' }
const RU_PLURAL: Record<string, string> = { elektron: 'электроны', proton: 'протоны', neytron: 'нейтроны', molekula: 'молекулы', kislota: 'кислоты' }

const NEG_VERB =/(?<!\p{L})не\s+(реагиру\p{L}*|растворя\p{L}*|проводит|проводят|является|являются|горит|горят)/iu

/** Пары «не реагирует … реагирует» в пределах трёх предложений (про одну и ту же сущность). */
function contradiction(ss: string[]): boolean {
  for (let i = 0; i < Math.min(ss.length, 3); i++) {
    const m = ss[i]!.match(NEG_VERB)
    if (!m) continue
    const stem = m[1]!.slice(0, 6).toLowerCase()
    const subj = analyzeTerms(ss[i]!).slice(0, 3)
    for (let k = i + 1; k < Math.min(ss.length, i + 4); k++) {
      const s = ss[k]!.toLowerCase()
      const at = s.indexOf(stem)
      if (at < 0) continue
      if (/не\s+$/u.test(s.slice(Math.max(0, at - 4), at))) continue
      if (/(но|однако|если|при|только|кроме|however|but)\s/iu.test(s)) continue
      const terms = new Set(analyzeTerms(ss[k]!))
      if (subj.some((t) => terms.has(t))) return true
    }
  }
  return false
}

export function selfCheck(
  body: string,
  a: { sq: StandaloneQuery; tools: ToolResult[]; lang: Lang; kb: Knowledge; plan: AnswerPlan; fallbackText?: string },
): { text: string; fixes: string[] } {
  const fixes: string[] = []
  let text = body
  // (1) числа инструментов
  const withNums = ensureToolNumbers(text, a.tools, a.lang)
  if (withNums !== text) {
    fixes.push('tool_numbers')
    text = withNums
  }
  // (2) уравнения с несходящимися коэффициентами
  const toolEqs = a.tools.filter((t) => t.tool === 'balance' || t.tool === 'obtain').flatMap((t) => t.text.split('\n'))
  for (const s of splitSentences(text)) {
    if (!/[→=]|->/.test(s)) continue
    const eq = extractEquation(s)
    if (!eq) continue
    const b = balanceEquation(eq)
    if (!b || typeof b === 'string' || b.studentBalanced !== false) continue
    // где уравнение стоит в предложении: первая и последняя формула (как написаны: «H2» или «H₂»)
    const toks = eq.split(/\s+/)
    const find = (x: string, last: boolean) => {
      for (const v of [x, pretty(x)]) {
        const i = last ? s.lastIndexOf(v) : s.indexOf(v)
        if (i >= 0) return { i, len: v.length }
      }
      return null
    }
    const f = find(toks[0]!, false)
    const l = find(toks[toks.length - 1]!, true)
    if (!f || !l || l.i < f.i) continue
    const from = f.i
    const to = l.i + l.len
    const species = (x: string) => x.replace(/^\d+/, '').replace(/[₀-₉]/g, (c) => String(SUBS.indexOf(c)))
    const ours = new Set(eq.split(/\s*(?:\+|→)\s*/).map(species))
    const fromTool = toolEqs.find((t) => {
      const e = extractEquation(t)
      return e && new Set(e.split(/\s*(?:\+|→)\s*/).map(species)).size === ours.size && [...ours].every((x) => e.replace(/[₀-₉]/g, (c) => String(SUBS.indexOf(c))).includes(x))
    })
    const good = (fromTool && extractEquation(fromTool)) || b.eq
    const fixed = s.slice(0, from) + good + s.slice(to).replace(/^[↑↓]/, (m) => (good.endsWith(m) ? '' : m))
    text = text.replace(s, fixed)
    fixes.push('equation')
  }
  // (3) новая сущность обязана прозвучать
  const ent = a.sq.followUp === 'switch_entity' ? a.sq.entities[0] : undefined
  if (ent && !entityMentioned(text, ent, a.kb)) {
    const isFormula = /^[A-Z]/.test(ent)
    const sub = isFormula ? a.kb.substanceByFormula.get(ent) : a.kb.qa.substances.find((s) => s.ru === ent)
    const el = !sub ? a.kb.qa.elements.find((e) => (isFormula ? e.s === ent : e.ru === ent)) : undefined
    const fact = sub ? substanceFacts(sub, a.lang, 'definition') : el ? elementFacts(el, a.lang, false) : isFormula ? pretty(ent) : ''
    if (fact) {
      text = `${fact} ${text}`.trim()
      fixes.push('entity')
    }
  }
  // (4) узбекский: апострофы и кириллица
  if (a.lang === 'uz') {
    const n = normalizeUzApostrophes(text)
    if (n !== text) {
      text = n
      fixes.push('uz_apostrophe')
    }
    const letters = (text.match(/\p{L}/gu) ?? []).length
    const cyr = (text.match(/[а-яё]/giu) ?? []).length
    if (letters && cyr / letters > 0.1) fixes.push('uz_cyrillic')
  }
  // (4а) русский ответ: узбекская латиница терминов, которую qwen иногда вставляет («один неспаренный elektron»)
  if (a.lang === 'ru') {
    const n = text.replace(/(?<![\p{L}])(elektron|proton|neytron|molekula|valentlik|kislota|kislorod|vodorod)(lar|i|ni|ning)?(?![\p{L}])/gu, (_m, w: string, suf?: string) => {
      const ru = RU_FROM_LAT[w]!
      return suf === 'lar' ? RU_PLURAL[w] ?? ru : ru
    })
    if (n !== text) {
      text = n
      fixes.push('ru_latin_term')
    }
  }
  // (5) длина по плану
  const [minW, maxW] = a.plan.words
  if (maxW && wordCount(text) > maxW * 1.25) {
    text = trimToWords(text, Math.round(maxW * 1.25))
    fixes.push('trim')
  }
  const kind = a.sq.kind
  if (minW && wordCount(text) < minW * 0.5 && kind !== 'chitchat' && kind !== 'confirm' && kind !== 'calc' && kind !== 'homework' && a.fallbackText) {
    const have = splitSentences(text).map((s) => new Set(analyzeTerms(s)))
    const extra = splitSentences(scrubR3(a.fallbackText, a.lang)).filter((s) => {
      const t = new Set(analyzeTerms(s))
      return !have.some((h) => jaccard(h, t) > 0.5)
    })
    if (extra.length) {
      text = `${text} ${extra.slice(0, 2).join(' ')}`.trim()
      fixes.push('extend')
    }
  }
  // (6) противоречие «не реагирует … реагирует»
  if (a.lang === 'ru' && contradiction(splitSentences(text))) fixes.push('contradiction')
  return { text, fixes }
}
