import periodicRaw from './periodicTableRaw.json'
import gridPositions from './elementGridPositions.json'
import { ELEMENT_NAMES_RU } from './elementNamesRu'
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
}

const gridByZ = new Map<number, { x: number; y: number }>(
  (gridPositions as { z: number; x: number; y: number }[]).map((e) => [e.z, e]),
)

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
      cpkHex: e.cPKHexColor?.replace(/^#/, '') ?? '8899aa',
      gridX: g.x,
      gridY: g.y,
      groupBlock: e.groupBlock ?? 'unknown',
      oxidationStates: (e.oxidationStates ?? '—').replace(/\s*,\s*/g, ', '),
      electronConfiguration: (e.electronConfiguration ?? '—').replace(/\s+/g, ' ').trim(),
      standardState: (e.standardState ?? '—').replace(/\s+/g, ' ').trim() || '—',
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
