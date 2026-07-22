import { defaultSynthesisConditionsText } from '../chemistry/synthesisConditionsDefaults'
import { buildDefaultLaboratoryRecipeRu } from '../chemistry/laboratoryRecipeText'
import { resolveLaboratoryRecipeRu } from '../chemistry/substanceSynthesisRoute'
import { resolveObtainingBundle } from '../chemistry/substanceObtaining'
import { getMolecularGeometryOrNull } from '../chemistry/catalogGeometryOverrides'
import { buildSignatureMolecule } from '../chemistry/placeholderMolecule'
import type { CompoundCategory, CompoundDef, RawCompoundDef } from '../types/chemistry'
import { INORGANIC_RAW } from './inorganicCompounds.data'

function accentForCategory(cat: CompoundCategory): string {
  if (cat === 'oxide') return '#5ad8ff'
  if (cat === 'acid') return '#ffb05c'
  if (cat === 'base') return '#ff8ec9'
  if (cat === 'salt') return '#b8c8ff'
  return '#8899aa'
}

function compositionKey(counts: Record<string, number>): string {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}:${n}`)
    .join('|')
}

function recipeIn(p: RawCompoundDef): string {
  return resolveLaboratoryRecipeRu(
    p.id,
    p.formulaUnicode,
    p.laboratoryRecipeRu,
    buildDefaultLaboratoryRecipeRu(p),
  )
}

function obtainingIn(p: RawCompoundDef) {
  const bundle = resolveObtainingBundle({
    ...p,
    laboratoryRecipeRu: p.laboratoryRecipeRu ?? recipeIn(p),
  })
  const baseCond = defaultSynthesisConditionsText(bundle.lab, p.category)
  const useBundleRecipe =
    !p.laboratoryRecipeRu ||
    p.laboratoryRecipeRu.startsWith('Маршрут:') ||
    (p.obtainingStepsRu?.length ?? 0) > 0 ||
    bundle.steps.length > 1
  return {
    laboratoryRecipeRu: useBundleRecipe ? bundle.recipeRu : (p.laboratoryRecipeRu ?? bundle.recipeRu),
    obtainingStepsRu: p.obtainingStepsRu?.length ? p.obtainingStepsRu : bundle.steps,
    synthesisConditionsRu: {
      ...baseCond,
      ...bundle.conditions,
      ...p.synthesisConditionsRu,
    },
    synthesisLab: { ...bundle.lab, ...p.synthesisLab },
  }
}

export function finalizeCompound(p: RawCompoundDef): CompoundDef {
  const accent = p.accentColor ?? accentForCategory(p.category)
  const countsFromAtoms = (atoms: { symbol: string }[]) => {
    const m: Record<string, number> = {}
    for (const a of atoms) {
      const k = a.symbol
      m[k] = (m[k] ?? 0) + 1
    }
    return m
  }
  const keyFromCounts = (counts: Record<string, number>) =>
    Object.keys(counts)
      .filter((k) => (counts[k] ?? 0) > 0)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => `${k}:${counts[k]}`)
      .join('|')

  const ensureHasBonds = (atoms: RawCompoundDef['atoms'], bonds: RawCompoundDef['bonds']) => {
    const a = atoms ?? []
    const b = bonds ?? []
    if (a.length <= 1) return { atoms: a, bonds: b ?? [] }
    // Salts: we allow separated ions (no inter-ion sticks).
    if (p.category === 'salt') return { atoms: a, bonds: b ?? [] }
    if (Array.isArray(b) && b.length > 0) return { atoms: a, bonds: b }
    // If a compound provides atoms but no bonds, generate a connected “sticks” graph.
    // Keep it deterministic and chemically-plausible using the existing generator.
    const geo = buildSignatureMolecule(p.composition, p.id, p.category)
    const same =
      geo.atoms.length === a.length &&
      geo.atoms.every((ga, i) => ga.symbol.toLowerCase() === (a[i]?.symbol ?? '').toLowerCase())
    return same ? { atoms: a, bonds: geo.bonds } : { atoms: geo.atoms, bonds: geo.bonds }
  }

  const validateGeometryOrNull = (
    _source: 'raw' | 'handBuilt',
    atoms: RawCompoundDef['atoms'],
    bonds: RawCompoundDef['bonds'],
  ): { atoms: NonNullable<RawCompoundDef['atoms']>; bonds: NonNullable<RawCompoundDef['bonds']> } | null => {
    const a = atoms ?? []
    const b0 = bonds ?? []
    if (a.length === 0) return null
    const expectedKey = keyFromCounts(p.composition)
    const gotKey = keyFromCounts(countsFromAtoms(a))
    const okCounts = expectedKey === gotKey
    const separateSaltCations = new Set(['Na', 'K', 'Li', 'Cs', 'Mg', 'Ca', 'Ba', 'Sr', 'Ag'])
    const b =
      p.category !== 'salt'
        ? b0
        : b0.filter(([i, j]) => {
            const si = a[i]?.symbol
            const sj = a[j]?.symbol
            if (!si || !sj) return false
            return !(separateSaltCations.has(si) || separateSaltCations.has(sj))
          })

    // If a salt has ONLY inter-ion bonds (often from PubChem 2D),
    // filtering those cations can leave us with no sticks at all.
    // Recover internal bonds deterministically from our generator, but still keep cations separated.
    let bondsRecovered: typeof b = b
    if (p.category === 'salt' && a.length > 1 && Array.isArray(bondsRecovered) && bondsRecovered.length === 0) {
      const geo = buildSignatureMolecule(p.composition, p.id, p.category)
      const rec = geo.bonds.filter(([i, j]) => {
        const si = geo.atoms[i]?.symbol
        const sj = geo.atoms[j]?.symbol
        if (!si || !sj) return false
        return !(separateSaltCations.has(si) || separateSaltCations.has(sj))
      })
      if (rec.length > 0) bondsRecovered = rec
    }
    const okBonds =
      a.length <= 1
        ? true
        : p.category === 'salt'
          ? true
          : Array.isArray(bondsRecovered) && bondsRecovered.length > 0
    const okBondIdx =
      a.length <= 1
        ? true
        : Array.isArray(bondsRecovered) &&
          bondsRecovered.every(([i, j]) => Number.isInteger(i) && Number.isInteger(j) && i >= 0 && j >= 0 && i < a.length && j < a.length)
    if (!okCounts) return null
    if (!okBonds) return null
    if (!okBondIdx) return null
    return { atoms: a, bonds: bondsRecovered }
  }

  if (p.atoms && p.atoms.length > 0 && p.bonds !== undefined) {
    const validated = validateGeometryOrNull('raw', p.atoms, p.bonds)
    const fixed = ensureHasBonds(validated?.atoms ?? p.atoms, validated?.bonds ?? p.bonds)
    const obt = obtainingIn(p)
    return {
      ...p,
      accentColor: accent,
      atoms: fixed.atoms,
      bonds: fixed.bonds,
      ...obt,
    }
  }
  const handBuilt = getMolecularGeometryOrNull(p.id)
  if (handBuilt) {
    const validated = validateGeometryOrNull('handBuilt', handBuilt.atoms, handBuilt.bonds)
    const fixed = validated ? ensureHasBonds(validated.atoms, validated.bonds) : buildSignatureMolecule(p.composition, p.id, p.category)
    const obt = obtainingIn(p)
    return {
      ...p,
      accentColor: accent,
      atoms: fixed.atoms,
      bonds: fixed.bonds,
      ...obt,
    }
  }
  const geo = buildSignatureMolecule(p.composition, p.id, p.category)
  const obt = obtainingIn(p)
  return {
    ...p,
    accentColor: accent,
    atoms: geo.atoms,
    bonds: geo.bonds,
    ...obt,
  }
}

const handRaw: RawCompoundDef[] = [
  {
    id: 'h2o',
    category: 'oxide',
    nameRu: 'Вода',
    formulaUnicode: 'H₂O',
    composition: { H: 2, O: 1 },
    atoms: [
      { symbol: 'O', pos: [0, 0, 0] },
      { symbol: 'H', pos: [0.84, 0.62, 0] },
      { symbol: 'H', pos: [-0.84, 0.62, 0] },
    ],
    bonds: [
      [0, 1],
      [0, 2],
    ],
    accentColor: '#6ec8ff',
    descriptionRu: 'Полярная молекула, растворитель.',
    laboratoryRecipeRu: '2H₂ + O₂ = 2H₂O',
  },
  {
    id: 'co2',
    category: 'oxide',
    nameRu: 'Углекислый газ',
    formulaUnicode: 'CO₂',
    composition: { C: 1, O: 2 },
    atoms: [
      { symbol: 'C', pos: [0, 0, 0] },
      { symbol: 'O', pos: [1.16, 0, 0] },
      { symbol: 'O', pos: [-1.16, 0, 0] },
    ],
    bonds: [
      [0, 1],
      [0, 2],
    ],
    accentColor: '#b8c8ff',
    descriptionRu: 'Линейная молекула.',
    laboratoryRecipeRu: 'C + O₂ = CO₂',
  },
  {
    id: 'nacl',
    category: 'salt',
    nameRu: 'Хлорид натрия',
    formulaUnicode: 'NaCl',
    composition: { Na: 1, Cl: 1 },
    atoms: [
      { symbol: 'Na', pos: [-0.55, 0, 0] },
      { symbol: 'Cl', pos: [0.55, 0, 0] },
    ],
    bonds: [],
    accentColor: '#ff9ec9',
    descriptionRu: 'Ионная соль.',
    laboratoryRecipeRu: '2Na + Cl₂ = 2NaCl',
  },
]

const mergedRaw: RawCompoundDef[] = [...handRaw, ...INORGANIC_RAW]
const seenComp = new Set<string>()
const dedupedRaw: RawCompoundDef[] = []
for (const r of mergedRaw) {
  const ck = compositionKey(r.composition)
  if (seenComp.has(ck)) continue
  seenComp.add(ck)
  dedupedRaw.push(r)
}

const list: CompoundDef[] = dedupedRaw.map(finalizeCompound)

export const compoundById: Record<string, CompoundDef> = Object.fromEntries(list.map((c) => [c.id, c]))

function atomCount(c: CompoundDef): number {
  return Object.values(c.composition).reduce((a, b) => a + b, 0)
}

export function compoundsSortedForMatch(): readonly CompoundDef[] {
  return [...list].sort((a, b) => atomCount(b) - atomCount(a))
}

/** Список для выпадающего списка в реакторе (по названию). */
export function compoundsListAlphabeticalRu(): readonly CompoundDef[] {
  return [...list].sort((a, b) => a.nameRu.localeCompare(b.nameRu, 'ru'))
}
