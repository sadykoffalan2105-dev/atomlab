/**
 * ФАЗЫ ПРОДУКТОВ СЮЖЕТА РЕАКЦИИ при 25 °C и их подписи RU/EN/UZ (лёгкий модуль без геометрии: его читает панель урока).
 * Данные — таблица фаз «Как образуется» v2 (components/lab/formation/story/phase-data.ts); геометрия итога — storyPhase.ts.
 */
import { phaseRow, type LatticeCode, type PhaseRow } from '../../../../components/lab/formation/story/phase-data'
import type { FinalPhase, Tri } from '../../../../components/lab/formation/story/phase'
import { compoundById } from '../../../../data/compounds'
import { ionChargeText, type ReactionStory, type StoryLocale, type StoryTerm } from '../../../../chemistry/reactionStory'

/** Фаза продукта в кадре итога. */
export type StoryProductPhase = 'gas' | 'liquid' | 'solution' | 'ionic' | 'molecular' | 'chain' | 'network' | 'metal'

export type StoryProductInfo = {
  readonly term: number
  readonly formula: string
  readonly id: string | null
  readonly phase: StoryProductPhase
  readonly caption: Tri
  readonly note: Tri | null
}

// ─── формула → id вещества каталога (в таблице фаз — в приоритете) ───

let byFormula: Map<string, string[]> | null = null
const SIMPLE_ID: Readonly<Record<string, string>> = { S: 'tb_s8', P: 'tb_p4', I: 'tb_i2' }

export function compoundIdForFormula(formula: string): string | null {
  if (!byFormula) {
    byFormula = new Map()
    for (const c of Object.values(compoundById)) {
      const k = c.formulaUnicode
      const list = byFormula.get(k)
      if (list) list.push(c.id)
      else byFormula.set(k, [c.id])
    }
  }
  if (SIMPLE_ID[formula]) return SIMPLE_ID[formula]!
  const ids = byFormula.get(formula) ?? []
  return ids.find((x) => phaseRow(x)) ?? ids[0] ?? null
}

// ─── подписи (RU / EN / UZ) ───

const CODE_EN_UZ: Readonly<Record<LatticeCode, [string, string]>> = {
  RS: ['NaCl type', 'NaCl turi'], CsCl: ['CsCl type', 'CsCl turi'], ZB: ['zinc blende (ZnS)', 'sfalerit (ZnS)'],
  WZ: ['wurtzite', 'vyursit'], AF: ['antifluorite', 'antiflyuorit'], CUP: ['cuprite', 'kuprit'], COR: ['corundum', 'korund'],
  CAL: ['calcite', 'kalsit'], BAR: ['baryte', 'barit'], CdI2: ['layered, CdI₂ type', 'qatlamli, CdI₂ turi'],
  L3: ['layered MX₃', 'qatlamli MX₃'], PbCl2: ['cotunnite (PbCl₂)', 'kotunnit (PbCl₂)'], RUT: ['rutile', 'rutil'],
  SPI: ['spinel', 'shpinel'], NiAs: ['NiAs (troilite)', 'NiAs (troilit)'], U: ['ionic', 'ion'], MOL: ['molecular', 'molekulyar'],
  CHAIN: ['polymer', 'polimer'], NET: ['covalent network', 'atom karkas'],
}
const CYR = /[А-Яа-яЁё]/
/** Координация на EN/UZ: «(по O)» → «(by O)», «слои» → «layers»; если осталась кириллица — не показываем. */
function coordFor(coord: string, loc: 0 | 1 | 2): string {
  if (loc === 0) return coord
  const s = coord
    .replace(/по /g, loc === 1 ? 'by ' : '')
    .replace(/\(([^)]*?)\)/g, (_m, x: string) => (loc === 2 && !x.startsWith('by') ? `(${x} boʻyicha)` : `(${x})`))
    .replace(/слои/g, loc === 1 ? 'layers' : 'qatlamlar')
    .replace(/ и /g, loc === 1 ? ' and ' : ' va ')
  return CYR.test(s) ? '' : s
}
function latticeText(row: PhaseRow, loc: 0 | 1 | 2): string {
  const lat = row.info.lattice
  if (!lat) return ''
  const type = loc === 0 ? lat.type.replace(/^типа /, 'тип ') : row.code ? CODE_EN_UZ[row.code][loc - 1] : ''
  const coord = coordFor(lat.coord, loc)
  const a = lat.a ? `a = ${lat.a}${lat.c ? `, c = ${lat.c}` : ''} ${loc === 0 ? 'пм' : 'pm'}` : ''
  const head = (['решётка', 'lattice', 'panjara'] as const)[loc]
  const cn = (['КЧ', 'CN', 'KS'] as const)[loc]
  return [type ? `${head}: ${type}` : '', coord ? `${cn} ${coord}` : '', a].filter(Boolean).join('; ')
}

export const METAL_LATTICE: Readonly<Record<string, 'fcc' | 'bcc' | 'hcp'>> = {
  Cu: 'fcc', Ag: 'fcc', Au: 'fcc', Al: 'fcc', Pb: 'fcc', Ni: 'fcc', Ca: 'fcc', Pt: 'fcc',
  Fe: 'bcc', Na: 'bcc', K: 'bcc', Li: 'bcc', Cr: 'bcc', Ba: 'bcc', V: 'bcc', Mn: 'bcc',
  Zn: 'hcp', Mg: 'hcp', Ti: 'hcp', Co: 'hcp', Cd: 'hcp', Be: 'hcp',
}
const METAL_TXT: Readonly<Record<'fcc' | 'bcc' | 'hcp', Tri>> = {
  fcc: ['металлическая решётка, ГЦК (КЧ 12)', 'metallic lattice, fcc (CN 12)', 'metall panjara, YoMK (KS 12)'],
  bcc: ['металлическая решётка, ОЦК (КЧ 8)', 'metallic lattice, bcc (CN 8)', 'metall panjara, HMK (KS 8)'],
  hcp: ['металлическая решётка, ГПУ (КЧ 12)', 'metallic lattice, hcp (CN 12)', 'metall panjara, GZJ (KS 12)'],
}

/** Ионы раствора из записи члена («Zn²⁺ + 2Cl⁻» → «Zn²⁺, Cl⁻»); у сильной кислоты H⁺ → H₃O⁺. */
function ionList(ions: string | null, strongAcid: boolean): string {
  if (!ions) return ''
  const list = ions.split('+').map((x) => x.trim().replace(/^\d+/, '')).filter(Boolean)
  return [...new Set(list.map((x) => (strongAcid && x === 'H⁺' ? 'H₃O⁺' : x)))].join(', ')
}

function captionOf(formula: string, phase: StoryProductPhase, row: PhaseRow | null, fate: StoryTerm['fate'], el0: string, ions: string): Tri {
  const lat = (loc: 0 | 1 | 2) => (row ? latticeText(row, loc) : '')
  const tail = (s: string) => (s ? `, ${s}` : '')
  const pre = fate === 'precipitate' ? ['осадок ↓, ', 'precipitate ↓, ', 'choʻkma ↓, '] : ['', '', '']
  switch (phase) {
    case 'gas':
      return [`${formula} — газ ↑: молекулы расходятся и поднимаются`, `${formula} — gas ↑: the molecules spread out and rise`, `${formula} — gaz ↑: molekulalar tarqalib, yuqoriga koʻtariladi`]
    case 'liquid':
      return [`${formula} — жидкость: молекулы плотно, порядок только ближний`, `${formula} — liquid: molecules packed closely, only short-range order`, `${formula} — suyuqlik: molekulalar zich, faqat yaqin tartib`]
    case 'solution':
      if (ions) return [`${formula} — в растворе: ионы ${ions} среди молекул воды`, `${formula} — in solution: ${ions} ions among water molecules`, `${formula} — eritmada: ${ions} ionlari suv molekulalari orasida`]
      return [`${formula} — в растворе: молекулы среди молекул воды`, `${formula} — in solution: molecules among water molecules`, `${formula} — eritmada: molekulalar suv molekulalari orasida`]
    case 'metal': {
      const m = METAL_TXT[METAL_LATTICE[el0] ?? 'fcc']
      return [`${formula} — ${pre[0]}металл: ${m[0]}`, `${formula} — ${pre[1]}metal: ${m[1]}`, `${formula} — ${pre[2]}metall: ${m[2]}`]
    }
    case 'molecular':
      return [`${formula} — ${pre[0]}молекулярный кристалл${tail(lat(0))}`, `${formula} — ${pre[1]}molecular crystal${tail(lat(1))}`, `${formula} — ${pre[2]}molekulyar kristall${tail(lat(2))}`]
    case 'chain':
      return [`${formula} — ${pre[0]}полимер (цепи)${tail(lat(0))}`, `${formula} — ${pre[1]}polymer (chains)${tail(lat(1))}`, `${formula} — ${pre[2]}polimer (zanjirlar)${tail(lat(2))}`]
    case 'network':
      return [`${formula} — ${pre[0]}атомный кристалл (каркас)${tail(lat(0))}`, `${formula} — ${pre[1]}covalent network crystal${tail(lat(1))}`, `${formula} — ${pre[2]}atom kristall (karkas)${tail(lat(2))}`]
    default:
      return [`${formula} — ${pre[0]}ионный кристалл${tail(lat(0))}`, `${formula} — ${pre[1]}ionic crystal${tail(lat(1))}`, `${formula} — ${pre[2]}ion kristall${tail(lat(2))}`]
  }
}

/** Водная реакция: вода среди веществ, кислота или обмен/нейтрализация/замещение в растворе соли. */
function aqueous(story: ReactionStory): boolean {
  if (story.terms.some((t) => t.formula === 'H₂O')) return true
  if (story.left.units.some((u) => u.acid)) return true
  if (story.type === 'exchange' || story.type === 'neutralization') return true
  return story.type === 'substitution' && story.terms.some((t) => t.side === 'left' && t.kind === 'ionic' && !/O$|O₂$|O₃$/.test(t.formula))
}

/** Фаза продукта (без геометрии) — её же читает тест. */
export function storyProductPhases(story: ReactionStory): StoryProductInfo[] {
  const aq = aqueous(story)
  const out: StoryProductInfo[] = []
  for (const t of story.terms) {
    if (t.side !== 'right') continue
    const id = t.kind === 'metal' ? null : compoundIdForFormula(t.formula)
    const row = id ? phaseRow(id) : null
    const unit = story.right.units.find((u) => u.term === t.index)
    const el0 = unit ? story.right.atoms[unit.atoms[0]!]!.el : ''
    let phase: StoryProductPhase
    if (t.fate === 'gas') phase = 'gas'
    else if (t.fate === 'water') phase = 'liquid'
    else if (t.kind === 'metal') phase = 'metal'
    else if (t.fate === 'precipitate') phase = row && row.phase !== 'gas' && row.phase !== 'liquid' && row.phase !== 'solution' ? (row.phase as StoryProductPhase) : 'ionic'
    else if (aq && (t.kind === 'ionic' || unit?.acid || row?.phase === 'solution') && row?.phase !== 'gas') phase = 'solution'
    else if (row) phase = row.phase as FinalPhase as StoryProductPhase
    else if (t.kind === 'ionic') phase = 'ionic'
    else if (t.kind === 'atomic') phase = 'network'
    else phase = 'gas'
    const strongAcid = phase === 'solution' && (row?.info.dissociation === 'strong' || /^H(Cl|Br|I|NO₃)$|^H₂SO₄$/.test(t.formula))
    const formula = `${t.formula}`
    const weak = row?.info.dissociation === 'weak' || row?.info.dissociation === 'none'
    let acidIons: string | null = null
    if (strongAcid && unit?.acid) {
      const gs = unit.groups.map((g) => story.right.groups[g]!)
      const nH = gs.filter((g) => g.kind === 'acidH').length
      const res = gs.find((g) => g.kind === 'residue')
      if (res && nH > 0) acidIons = `H⁺ + ${res.label}${ionChargeText(-nH)}`
    }
    const ions = phase === 'solution' && !weak ? ionList(t.ions ?? acidIons, strongAcid) : ''
    const caption = captionOf(formula, phase, row, t.fate, el0, ions)
    const note = phase === 'solution' || phase === 'metal' ? (row?.info.dissociation === 'weak' ? (row.info.note ?? null) : null) : (row?.info.note ?? null)
    out.push({ term: t.index, formula, id, phase, caption, note })
  }
  return out
}

/** Подписи фаз для панели урока: «При 25 °C: …» по строке на продукт и одна честная оговорка. */
export function storyPhaseLines(story: ReactionStory, locale: StoryLocale): string[] {
  const k = locale === 'ru' ? 0 : locale === 'en' ? 1 : 2
  const head = ['При 25 °C', 'At 25 °C', '25 °C da'][k]!
  const ps = storyProductPhases(story)
  const lines = ps.map((p) => p.caption[k]!)
  const note = ps.find((p) => p.note && p.phase !== 'gas' && p.phase !== 'liquid')?.note ?? null
  return [`${head}:`, ...lines, ...(note ? [note[k]!] : [])]
}

