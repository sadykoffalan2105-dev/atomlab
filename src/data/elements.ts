import periodicRaw from './periodicTableRaw.json'
import gridPositions from './elementGridPositions.json'
import { ELEMENT_NAMES_RU } from './elementNamesRu'
import { elementDiscoveryYear } from './elementDiscoveryYears'
import type { ElementViewModel } from '../types/chemistry'

interface RawElement {
  atomicNumber: number
  symbol: string
  atomicMass: number
  cPKHexColor: string
  groupBlock?: string
  oxidationStates?: string
  electronConfiguration?: string
  standardState?: string
  electronegativity?: number | null
  atomicRadius?: number | null
  ionizationEnergy?: number | null
  electronAffinity?: number | null
  meltingPoint?: number | null
  boilingPoint?: number | null
  density?: number | null
  yearDiscovered?: string | number | null
}

const gridByZ = new Map<number, { x: number; y: number }>(
  (gridPositions as { z: number; x: number; y: number }[]).map((e) => [e.z, e]),
)

/** Нормализация CPK hex: дополняем до 6 символов, пустые — fallback. */
export function normalizeCpkHex(raw?: string | null, fallback = '8899AA'): string {
  if (!raw?.trim()) return fallback
  const clean = raw.replace(/^#/, '').trim()
  if (!/^[0-9A-Fa-f]{1,6}$/.test(clean)) return fallback
  return clean.padStart(6, '0').toUpperCase()
}

const rawList = periodicRaw as RawElement[]

export const ELEMENTS: readonly ElementViewModel[] = rawList
  .filter((e) => e.atomicNumber >= 1 && e.atomicNumber <= 118)
  .map((e) => {
    const g = gridByZ.get(e.atomicNumber) ?? { x: 1, y: 1 }
    const nameRu = ELEMENT_NAMES_RU[e.atomicNumber - 1] ?? e.symbol
    return {
      z: e.atomicNumber,
      symbol: e.symbol,
      nameRu,
      atomicMass: e.atomicMass,
      cpkHex: normalizeCpkHex(e.cPKHexColor),
      gridX: g.x,
      gridY: g.y,
      groupBlock: e.groupBlock ?? 'unknown',
      oxidationStates: (e.oxidationStates ?? '—').replace(/\s*,\s*/g, ', '),
      electronConfiguration: (e.electronConfiguration ?? '—').replace(/\s+/g, ' ').trim(),
      standardState: (e.standardState ?? '—').replace(/\s+/g, ' ').trim() || '—',
      electronegativity: e.electronegativity ?? null,
      atomicRadius: e.atomicRadius ?? null,
      ionizationEnergy: e.ionizationEnergy ?? null,
      electronAffinity: e.electronAffinity ?? null,
      meltingPoint: e.meltingPoint ?? null,
      boilingPoint: e.boilingPoint ?? null,
      density: e.density ?? null,
      yearDiscovered:
        elementDiscoveryYear(e.atomicNumber) ??
        (e.yearDiscovered != null ? String(e.yearDiscovered) : null),
    }
  })
  .sort((a, b) => a.z - b.z)

export function getElementByZ(z: number): ElementViewModel | undefined {
  return ELEMENTS.find((e) => e.z === z)
}

export function getElementBySymbol(sym: string): ElementViewModel | undefined {
  const s = sym.trim()
  return ELEMENTS.find((e) => e.symbol.toLowerCase() === s.toLowerCase())
}

export function estimateNeutrons(atomicMass: number, z: number): number {
  return Math.max(0, Math.round(atomicMass) - z)
}
