import { buildDefaultLaboratoryRecipeRu } from '../chemistry/laboratoryRecipeText'
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
  return p.laboratoryRecipeRu ?? buildDefaultLaboratoryRecipeRu(p)
}

export function finalizeCompound(p: RawCompoundDef): CompoundDef {
  const accent = p.accentColor ?? accentForCategory(p.category)
  const dbg = (hypothesisId: string, location: string, message: string, data: unknown) => {
    // #region agent log
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain', 'X-Debug-Session-Id': 'dbdb64' },
      body: JSON.stringify({
        sessionId: 'dbdb64',
        runId: 'pre-fix',
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }
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
    source: 'raw' | 'handBuilt',
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
    // #region agent log
    if (p.id === 'salt_k_no3') {
      fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain', 'X-Debug-Session-Id': 'dbdb64' },
        body: JSON.stringify({
          sessionId: 'dbdb64',
          runId: 'kno3_dbg',
          hypothesisId: 'H_kno3_bonds_pipeline',
          location: 'src/data/compounds.ts:validateGeometryOrNull',
          message: 'salt_k_no3 bonds pipeline',
          data: {
            source,
            atomsLen: a.length,
            bondsLenRaw: Array.isArray(b0) ? b0.length : null,
            bondsLenAfterFilter: Array.isArray(b) ? b.length : null,
            bondsLenRecovered: Array.isArray(bondsRecovered) ? bondsRecovered.length : null,
            symbolsA: a.slice(0, 8).map((x) => x.symbol),
            firstBondsAfter: Array.isArray(b) ? b.slice(0, 12) : null,
            firstBondsRecovered: Array.isArray(bondsRecovered) ? bondsRecovered.slice(0, 12) : null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
    }
    // #endregion

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
    dbg(
      source === 'handBuilt' ? 'H_pubchem_or_override_wrong' : 'H_raw_geometry',
      'src/data/compounds.ts:validateGeometryOrNull',
      'geometry validation',
      {
        compoundId: p.id,
        source,
        expectedKey,
        gotKey,
        atomsLen: a.length,
        bondsLen: Array.isArray(b0) ? b0.length : null,
        bondsLenAfter: Array.isArray(b) ? b.length : null,
        bondsLenRecovered: Array.isArray(bondsRecovered) ? bondsRecovered.length : null,
        okCounts,
        okBonds,
        okBondIdx,
        firstSymbols: a.slice(0, 6).map((x) => x.symbol),
      },
    )
    if (!okCounts) return null
    if (!okBonds) return null
    if (!okBondIdx) return null
    return { atoms: a, bonds: bondsRecovered }
  }

  if (p.atoms && p.atoms.length > 0 && p.bonds !== undefined) {
    const validated = validateGeometryOrNull('raw', p.atoms, p.bonds)
    const fixed = ensureHasBonds(validated?.atoms ?? p.atoms, validated?.bonds ?? p.bonds)
    dbg('H_path_choice', 'src/data/compounds.ts:finalizeCompound', 'path=raw', {
      compoundId: p.id,
      atomsLen: fixed.atoms.length,
      bondsLen: fixed.bonds.length,
    })
    return {
      ...p,
      accentColor: accent,
      atoms: fixed.atoms,
      bonds: fixed.bonds,
      laboratoryRecipeRu: recipeIn(p),
    }
  }
  const handBuilt = getMolecularGeometryOrNull(p.id)
  if (handBuilt) {
    const validated = validateGeometryOrNull('handBuilt', handBuilt.atoms, handBuilt.bonds)
    if (!validated) {
      dbg('H_reject_handBuilt', 'src/data/compounds.ts:finalizeCompound', 'reject handBuilt geometry (fallback to generator)', {
        compoundId: p.id,
      })
    }
    const fixed = validated ? ensureHasBonds(validated.atoms, validated.bonds) : buildSignatureMolecule(p.composition, p.id, p.category)
    dbg('H_path_choice', 'src/data/compounds.ts:finalizeCompound', validated ? 'path=handBuilt' : 'path=generator_after_reject', {
      compoundId: p.id,
      atomsLen: fixed.atoms.length,
      bondsLen: fixed.bonds.length,
    })
    return {
      ...p,
      accentColor: accent,
      atoms: fixed.atoms,
      bonds: fixed.bonds,
      laboratoryRecipeRu: recipeIn(p),
    }
  }
  const geo = buildSignatureMolecule(p.composition, p.id, p.category)
  dbg('H_path_choice', 'src/data/compounds.ts:finalizeCompound', 'path=generator', {
    compoundId: p.id,
    atomsLen: geo.atoms.length,
    bondsLen: geo.bonds.length,
  })
  return {
    ...p,
    accentColor: accent,
    atoms: geo.atoms,
    bonds: geo.bonds,
    laboratoryRecipeRu: recipeIn(p),
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
