import { solubilityMark, type SolubilityMark } from '../../data/solubilityTableData'

const CATION_MAP: Record<string, string> = {
  na: 'na',
  k: 'k',
  li: 'li',
  nh4: 'nh4',
  mg: 'mg',
  ca: 'ca',
  ba: 'ba',
  fe2: 'fe2',
  fe3: 'fe3',
  cu: 'cu',
  zn: 'zn',
  al: 'al',
  ag: 'na',
  cs: 'na',
  sr: 'ca',
  pb: 'ba',
  sn: 'ba',
  mn: 'fe2',
  ni: 'fe2',
  cobalt: 'fe2',
  cr: 'fe3',
  h: 'na',
}

const ANION_MAP: Record<string, string> = {
  cl: 'cl',
  br: 'br',
  i: 'i',
  f: 'f',
  no2: 'no2',
  no3: 'no3',
  mno4: 'no3',
  clo3: 'no3',
  clo4: 'no3',
  so4: 'so4',
  so3: 'so3',
  co3: 'co3',
  s: 's',
  sio3: 'co3',
  cro4: 'so4',
  cr2o7: 'so4',
  po4: 'po4',
  oh: 'oh',
  hco3: 'co3',
  ch3coo: 'ch3coo',
}

export function mapCationToTable(cationId: string): string {
  return CATION_MAP[cationId] ?? 'na'
}

export function mapAnionToTable(anionId: string): string {
  return ANION_MAP[anionId] ?? 'no3'
}

export function isInsolubleInWater(cationId: string, anionId: string): boolean {
  const mark = solubilityMark(mapCationToTable(cationId), mapAnionToTable(anionId))
  return mark === 'N' || mark === 'M'
}

export function solubilityForIonPair(cationId: string, anionId: string): SolubilityMark {
  return solubilityMark(mapCationToTable(cationId), mapAnionToTable(anionId))
}

export function precipitateLikely(cationId: string, anionId: string): boolean {
  const m = solubilityForIonPair(cationId, anionId)
  return m === 'N' || m === 'M'
}
