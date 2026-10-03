/**
 * Уравнение образования вещества каталога для «Как образуется» (школьная химия, Kimyo 7–11):
 *  • direct — из простых веществ (2Na + Cl₂ → 2NaCl, 4Fe + 3O₂ → 2Fe₂O₃, N₂ + 3H₂ ⇄ 2NH₃); у простых веществ —
 *    из атомов (2Cl → Cl₂, 4P → P₄); источник — 200 основных реакций каталога (mainReactions200) или расчёт для
 *    бинарных веществ, которые реально получают из простых (без «запрещённых»: NO₂, SO₃, FeCl₂, H₂O₂, Ag₂O…);
 *  • lab — как получают в лаборатории / промышленности, если из простых веществ напрямую не получают
 *    (SO₃ + H₂O → H₂SO₄, CaO + CO₂ → CaCO₃) — из 200 основных реакций или справочная таблица ниже.
 * Каждое уравнение проверяется на баланс атомов (balanceOf) — тест scripts/test-formation-plan.mts.
 */
import { MAIN_REACTIONS_200 } from '../data/catalog/mainReactions200'
import { compoundById } from '../data/compounds'
import { fromElementsPolicy } from './substanceSynthesisRoute'

export type FormationEquation = {
  /** из простых веществ (или из атомов — у простого вещества); null — напрямую не получают */
  direct: string | null
  /** 'atoms' — простое вещество: связь между атомами; 'elements' — из простых веществ */
  directKind: 'atoms' | 'elements' | null
  /** лабораторный / промышленный способ (если direct нет — обязателен) */
  lab: string | null
  /** условия (нагрев, катализатор…) — из основных реакций */
  heat: boolean
  catalyst: string | null
  /** id основной реакции (mr001…), если уравнение оттуда */
  mainId: string | null
  /** исходные простые вещества direct (H₂, O₂, Na…) — для 3D-этапа «исходные вещества» */
  reagents: string[]
}

// ─── Разбор и баланс ───────────────────────────────────────────────────────

const SUBS: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
const plain = (s: string): string => [...s].map((c) => SUBS[c] ?? c).join('')

/** Состав формулы: «Ca(HCO₃)₂», «CuSO₄·5H₂O», «(NH₄)₂Cr₂O₇». */
export function formulaComp(formula: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const raw of plain(formula).replace(/\s+/g, '').split(/[·*]/)) {
    const m = /^(\d+)(.*)$/.exec(raw)
    const k = m && /[A-Z([]/.test(m[2]!.charAt(0)) ? Number(m[1]) : 1
    const body = m && k !== 1 ? m[2]! : raw
    const stack: Record<string, number>[] = [{}]
    let i = 0
    const num = (): number => {
      let d = ''
      while (i < body.length && /\d/.test(body[i]!)) d += body[i++]!
      return d ? Number(d) : 1
    }
    while (i < body.length) {
      const ch = body[i]!
      if (ch === '(' || ch === '[') {
        stack.push({})
        i++
      } else if (ch === ')' || ch === ']') {
        i++
        const n = num()
        const top = stack.pop()!
        const dst = stack[stack.length - 1]!
        for (const [e, x] of Object.entries(top)) dst[e] = (dst[e] ?? 0) + x * n
      } else if (/[A-Z]/.test(ch)) {
        let el = ch
        i++
        if (i < body.length && /[a-z]/.test(body[i]!)) el += body[i++]!
        const n = num()
        const dst = stack[stack.length - 1]!
        dst[el] = (dst[el] ?? 0) + n
      } else i++
    }
    for (const [e, x] of Object.entries(stack[0]!)) out[e] = (out[e] ?? 0) + x * k
  }
  return out
}

/** Части уравнения: [[коэффициент, формула]] слева и справа. */
export function equationSides(eq: string): { left: [number, string][]; right: [number, string][] } | null {
  const parts = eq.split(/\s*(?:→|⇄|=)\s*/)
  if (parts.length !== 2) return null
  const side = (s: string): [number, string][] =>
    s.split(/\s+\+\s+/).map((t) => {
      const m = /^(\d+)\s*(.+)$/.exec(t.trim())
      return m ? [Number(m[1]), m[2]!.trim()] : [1, t.trim()]
    })
  return { left: side(parts[0]!), right: side(parts[1]!) }
}

/** Разность атомов (слева − справа) по элементам; пусто — уравнение уравнено. */
export function balanceOf(eq: string): Record<string, number> | null {
  const s = equationSides(eq)
  if (!s) return null
  const d: Record<string, number> = {}
  for (const [k, f] of s.left) for (const [e, n] of Object.entries(formulaComp(f))) d[e] = (d[e] ?? 0) + k * n
  for (const [k, f] of s.right) for (const [e, n] of Object.entries(formulaComp(f))) d[e] = (d[e] ?? 0) - k * n
  for (const e of Object.keys(d)) if (d[e] === 0) delete d[e]
  return d
}

export const isBalanced = (eq: string): boolean => {
  const d = balanceOf(eq)
  return !!d && Object.keys(d).length === 0
}

// ─── Простые вещества ──────────────────────────────────────────────────────

/** Двухатомные простые вещества: H₂, N₂, O₂, F₂, Cl₂, Br₂, I₂. */
export const DIATOMIC = new Set(['H', 'N', 'O', 'F', 'Cl', 'Br', 'I'])
/** Формула простого вещества в школьном уравнении: H₂, O₂, Na, S, P, C. */
export const simpleFormula = (el: string): string => (DIATOMIC.has(el) ? `${el}₂` : el)
/** Формула в уравнении: элемент — «простое», иначе — формула. */
const isSimpleFormula = (f: string): boolean => Object.keys(formulaComp(f)).length === 1

/** Бинарные вещества, которые из простых веществ напрямую НЕ получают (или получают другое вещество). */
const NOT_DIRECT = new Set([
  'no2', 'so3', 'n2o', 'n2o5', 'tb_n2o3', 'tb_n2o4', 'tb_cl2o7', 'h2o2', 'feo', 'salt_fe2_cl', 'mno2', 'cro3', 'tb_cro', 'tb_mno',
  'tb_mn2o3', 'tb_mn3o4', 'ago', 'na2o', 'k2o', 'fes2', 'tb_bao2', 'tb_ph3', 'tb_sih4', 'tb_cac2', 'salt_fe3_s', 'tb_crcl2',
  'cl2o', 'clo2', 'tb_cl2o', 'tb_clo2', 'mn2o7', 'tb_mn2o7', 'cuo2', 'tb_cu2o', 'sio2_none',
])

/** Лабораторные / промышленные способы (школьные), где в 200 основных реакциях нет реакции с этим продуктом. */
const LAB: Record<string, string> = {
  tb_cl2: 'MnO₂ + 4HCl → MnCl₂ + Cl₂ + 2H₂O',
  tb_o2: '2KMnO₄ → K₂MnO₄ + MnO₂ + O₂',
  tb_h2: 'Zn + 2HCl → ZnCl₂ + H₂',
  tb_n2: 'NH₄NO₂ → N₂ + 2H₂O',
  tb_s8: '16H₂S + 8SO₂ → 3S₈ + 16H₂O',
  tb_i2: '2KI + Cl₂ → 2KCl + I₂',
  tb_br2: '2KBr + Cl₂ → 2KCl + Br₂',
  tb_p4: '2Ca₃(PO₄)₂ + 6SiO₂ + 10C → 6CaSiO₃ + P₄ + 10CO',
  tb_f2: '2KHF₂ → 2KF + H₂ + F₂',
  salt_k_mno4: '2K₂MnO₄ + Cl₂ → 2KMnO₄ + 2KCl',
  salt_nh4_cl: 'NH₃ + HCl → NH₄Cl',
  salt_k2cr2o7: '2K₂CrO₄ + H₂SO₄ → K₂Cr₂O₇ + K₂SO₄ + H₂O',
  hf: 'CaF₂ + H₂SO₄ → CaSO₄ + 2HF',
  salt_ca_hco3_2: 'CaCO₃ + CO₂ + H₂O → Ca(HCO₃)₂',
  salt_nh4_so4: '2NH₃ + H₂SO₄ → (NH₄)₂SO₄',
  hno2: '2NaNO₂ + H₂SO₄ → Na₂SO₄ + 2HNO₂',
  tb_cac2: 'CaO + 3C → CaC₂ + CO',
  h2sio3: 'Na₂SiO₃ + 2HCl → 2NaCl + H₂SiO₃',
  n2o5: '4NO₂ + O₂ → 2N₂O₅',
  salt_ca_no3: 'CaCO₃ + 2HNO₃ → Ca(NO₃)₂ + H₂O + CO₂',
  na2o: 'Na₂O₂ + 2Na → 2Na₂O',
  k2o: 'K₂O₂ + 2K → 2K₂O',
  fes2: 'FeS + S → FeS₂',
  cro3: 'K₂Cr₂O₇ + H₂SO₄ → K₂SO₄ + 2CrO₃ + H₂O',
  tb_ph3: 'Ca₃P₂ + 6H₂O → 3Ca(OH)₂ + 2PH₃',
  tb_cuso4_5h2o: 'CuSO₄ + 5H₂O → CuSO₄·5H₂O',
  tb_sih4: 'Mg₂Si + 4HCl → 2MgCl₂ + SiH₄',
  nh3_h2o: 'NH₃ + H₂O ⇄ NH₃·H₂O',
  salt_na_clo2: '2ClO₂ + 2NaOH + H₂O₂ → 2NaClO₂ + O₂ + 2H₂O',
  salt_pb_no3: 'PbO + 2HNO₃ → Pb(NO₃)₂ + H₂O',
  tb_cro: 'Cr(OH)₂ → CrO + H₂O',
  tb_croh2: 'CrCl₂ + 2NaOH → Cr(OH)₂ + 2NaCl',
  tb_nahso4: 'NaOH + H₂SO₄ → NaHSO₄ + H₂O',
  salt_al_no3: 'Al(OH)₃ + 3HNO₃ → Al(NO₃)₃ + 3H₂O',
  hclo: 'Cl₂ + H₂O ⇄ HCl + HClO',
  salt_mg_co3: 'MgCl₂ + Na₂CO₃ → MgCO₃ + 2NaCl',
  hclo4: 'KClO₄ + H₂SO₄ → KHSO₄ + HClO₄',
  tb_cuoh2co3: '2CuSO₄ + 2Na₂CO₃ + H₂O → (CuOH)₂CO₃ + 2Na₂SO₄ + CO₂',
  tb_cl2o7: '2HClO₄ + P₂O₅ → Cl₂O₇ + 2HPO₃',
  tb_crcl2: 'Cr + 2HCl → CrCl₂ + H₂',
  salt_ba_no3: 'BaCO₃ + 2HNO₃ → Ba(NO₃)₂ + H₂O + CO₂',
  tb_mn3o4: '3MnO₂ → Mn₃O₄ + O₂',
  tb_croh3: 'CrCl₃ + 3NaOH → Cr(OH)₃ + 3NaCl',
  hmno4: 'Ba(MnO₄)₂ + H₂SO₄ → BaSO₄ + 2HMnO₄',
  salt_fe3_no3: 'Fe(OH)₃ + 3HNO₃ → Fe(NO₃)₃ + 3H₂O',
  hclo3: 'Ba(ClO₃)₂ + H₂SO₄ → BaSO₄ + 2HClO₃',
  tb_hpo3: 'P₂O₅ + H₂O → 2HPO₃',
  ago: '2AgNO₃ + 2NaOH → Ag₂O + 2NaNO₃ + H₂O',
  tb_cah2po42: 'Ca₃(PO₄)₂ + 4H₃PO₄ → 3Ca(H₂PO₄)₂',
  tb_cahpo4: 'Ca(OH)₂ + H₃PO₄ → CaHPO₄ + 2H₂O',
  tb_caocl2: 'Ca(OH)₂ + Cl₂ → CaOCl₂ + H₂O',
  tb_n2o3: 'NO + NO₂ → N₂O₃',
  tb_caso4_2h2o: 'CaSO₄ + 2H₂O → CaSO₄·2H₂O',
  salt_fe2_no3: 'FeSO₄ + Ba(NO₃)₂ → Fe(NO₃)₂ + BaSO₄',
  tb_kcl_mgcl2_6h2o: 'KCl + MgCl₂ + 6H₂O → KCl·MgCl₂·6H₂O',
  tb_kcl_nacl: 'KCl + NaCl → KCl·NaCl',
  tb_mn2o3: '4MnO₂ → 2Mn₂O₃ + O₂',
  salt_nh4_co3: '2NH₃ + CO₂ + H₂O → (NH₄)₂CO₃',
  tb_sif4: 'SiO₂ + 4HF → SiF₄ + 2H₂O',
  tb_feso4_7h2o: 'FeSO₄ + 7H₂O → FeSO₄·7H₂O',
  tb_kcl_mgso4_3h2o: 'KCl + MgSO₄ + 3H₂O → KCl·MgSO₄·3H₂O',
  tb_mno: 'MnCO₃ → MnO + CO₂',
  tb_na2so4_10h2o: 'Na₂SO₄ + 10H₂O → Na₂SO₄·10H₂O',
  tb_nh42hpo4: '2NH₃ + H₃PO₄ → (NH₄)₂HPO₄',
  salt_k_cro4: 'K₂Cr₂O₇ + 2KOH → 2K₂CrO₄ + H₂O',
  tb_n2o4: '2NO₂ ⇄ N₂O₄',
  tb_na2zno2: 'ZnO + 2NaOH → Na₂ZnO₂ + H₂O',
  tb_bao2: '2BaO + O₂ → 2BaO₂',
  tb_h4p2o7: '2H₃PO₄ → H₄P₂O₇ + H₂O',
  salt_k_so3: 'SO₂ + 2KOH → K₂SO₃ + H₂O',
  salt_nh4_cr2o7: 'K₂Cr₂O₇ + 2NH₄Cl → (NH₄)₂Cr₂O₇ + 2KCl',
  tb_mg3po42: '3MgCl₂ + 2Na₃PO₄ → Mg₃(PO₄)₂ + 6NaCl',
  cu2o: '4CuO → 2Cu₂O + O₂',
  salt_na_br: 'NaOH + HBr → NaBr + H₂O',
  bao: 'BaCO₃ → BaO + CO₂',
}

/** Из простых веществ: a·X + b·Y → n·продукт (минимальные целые). null — не уравнять малыми числами. */
function directFromElements(formula: string, comp: Record<string, number>): { eq: string; reagents: string[] } | null {
  const els = Object.keys(comp)
  const per = (el: string) => (DIATOMIC.has(el) ? 2 : 1)
  for (let n = 1; n <= 8; n++) {
    const coef = els.map((el) => (comp[el]! * n) / per(el))
    if (!coef.every((x) => Number.isInteger(x))) continue
    // Металлы — первыми (2Na + Cl₂), иначе — как в формуле (H₂ + Cl₂, C + O₂).
    const order = els.map((el, i) => ({ el, k: coef[i]! })).sort((a, b) => metalRank(a.el) - metalRank(b.el))
    const left = order.map(({ el, k }) => `${k === 1 ? '' : k}${simpleFormula(el)}`).join(' + ')
    return { eq: `${left} → ${n === 1 ? '' : n}${formula}`, reagents: order.map(({ el }) => simpleFormula(el)) }
  }
  return null
}

const NONMET = new Set(['H', 'B', 'C', 'N', 'O', 'F', 'Si', 'P', 'S', 'Cl', 'Se', 'Br', 'I', 'As', 'Te'])
const metalRank = (el: string): number => (NONMET.has(el) ? 1 : 0)

/** Атомы → простое вещество: 2Cl → Cl₂, 8S → S₈, 3O₂ → 2O₃ (озонатор). */
function directFromAtoms(formula: string, comp: Record<string, number>): { eq: string; reagents: string[] } | null {
  const [el] = Object.keys(comp)
  if (!el) return null
  const n = comp[el]!
  if (el === 'O' && n === 3) return { eq: '3O₂ → 2O₃', reagents: ['O₂'] }
  return { eq: `${n}${el} → ${formula}`, reagents: [el] }
}

const cache = new Map<string, FormationEquation | null>()

export function formationEquation(compoundId: string): FormationEquation | null {
  if (cache.has(compoundId)) return cache.get(compoundId)!
  const r = build(compoundId)
  cache.set(compoundId, r)
  return r
}

function build(id: string): FormationEquation | null {
  const c = compoundById[id]
  if (!c) return null
  const f = c.formulaUnicode
  const comp = formulaComp(f)
  const els = Object.keys(comp)
  // Реакции, где вещество — продукт (формула стоит справа целиком).
  const asProduct = MAIN_REACTIONS_200.filter((r) => {
    const sides = equationSides(r.equation)
    return !!sides && sides.right.some(([, x]) => x === f) && !sides.left.some(([, x]) => x === f)
  })
  const fromSimple = asProduct.find((r) => equationSides(r.equation)!.left.every(([, x]) => isSimpleFormula(x)))
  let direct: string | null = null
  let directKind: FormationEquation['directKind'] = null
  let reagents: string[] = []
  let mainId: string | null = null
  let heat = false
  let catalyst: string | null = null
  if (els.length === 1) {
    const a = directFromAtoms(f, comp)
    if (a) {
      direct = a.eq
      directKind = 'atoms'
      reagents = a.reagents
    }
  } else if (fromSimple && !NOT_DIRECT.has(id)) {
    direct = fromSimple.equation
    directKind = 'elements'
    reagents = equationSides(fromSimple.equation)!.left.map(([, x]) => x)
    mainId = fromSimple.id
    heat = !!fromSimple.lab.heat
    catalyst = fromSimple.lab.catalyst ?? null
  } else if (els.length === 2 && !NOT_DIRECT.has(id) && fromElementsPolicy(id) !== 'forbidden') {
    const d = directFromElements(f, comp)
    if (d) {
      direct = d.eq
      directKind = 'elements'
      reagents = d.reagents
    }
  }
  let lab: string | null = LAB[id] ?? null
  if (!lab) {
    // Лучшая школьная реакция получения: соединение / обмен / нейтрализация — раньше остальных.
    const rank = (t: string) => ['combination', 'neutralization', 'exchange', 'substitution', 'decomposition', 'redox', 'combustion'].indexOf(t)
    const best = asProduct.filter((r) => r !== fromSimple || NOT_DIRECT.has(id)).sort((a, b) => rank(a.type) - rank(b.type))[0]
    if (best) {
      lab = best.equation
      if (!direct) {
        mainId = best.id
        heat = !!best.lab.heat
        catalyst = best.lab.catalyst ?? null
      }
    }
  }
  if (!direct && !lab) return null
  return { direct, directKind, lab, heat, catalyst, mainId, reagents }
}
