import { compoundById } from '../../data/compounds'

export type IonPair = { cationId: string; anionId: string; nCat: number; nAn: number }

const CATION_IDS = [
  'na',
  'k',
  'li',
  'nh4',
  'ag',
  'cs',
  'mg',
  'ca',
  'ba',
  'sr',
  'zn',
  'cu',
  'fe2',
  'fe3',
  'pb',
  'sn',
  'mn',
  'ni',
  'cobalt',
  'al',
  'cr',
] as const

const ANION_KEYS = [
  'cl',
  'br',
  'i',
  'f',
  'no2',
  'no3',
  'mno4',
  'clo3',
  'clo4',
  'so4',
  'so3',
  'co3',
  's',
  'sio3',
  'cro4',
  'cr2o7',
  'po4',
  'oh',
  'hco3',
] as const

const ACID_ANION: Record<string, string> = {
  hcl: 'cl',
  hbr: 'br',
  hi: 'i',
  hf: 'f',
  hno3: 'no3',
  hno2: 'no2',
  h2so4: 'so4',
  h2so3: 'so3',
  h2co3: 'co3',
  h3po4: 'po4',
  h2s: 's',
  hclo4: 'clo4',
  hclo3: 'clo3',
  ch3cooh: 'ch3coo',
}

const BASE_CATION: Record<string, string> = {
  naoh: 'na',
  koh: 'k',
  lioh: 'li',
  ca_oh_2: 'ca',
  mg_oh_2: 'mg',
  ba_oh_2: 'ba',
  sr_oh_2: 'sr',
  fe_oh_2: 'fe2',
  fe_oh_3: 'fe3',
  al_oh_3: 'al',
  zn_oh_2: 'zn',
  cu_oh_2: 'cu',
  nh3_h2o: 'nh4',
}

const CARBONATE_IDS = new Set(['salt_na_co3', 'salt_k_co3', 'salt_ca_co3', 'salt_mg_co3', 'salt_ba_co3', 'salt_li_co3'])
const HCO3_IDS = new Set(['salt_nahco3', 'salt_khco3', 'salt_ca_hco3_2', 'salt_mg_hco3_2'])

export function saltIdFromIons(cationId: string, anionKey: string): string {
  return `salt_${cationId}_${anionKey.toLowerCase()}`
}

export function parseSaltId(compoundId: string): IonPair | null {
  if (!compoundId.startsWith('salt_')) return null
  const rest = compoundId.slice(5)
  for (const cat of CATION_IDS) {
    const prefix = `${cat}_`
    if (!rest.startsWith(prefix)) continue
    const anPart = rest.slice(prefix.length)
    for (const an of ANION_KEYS) {
      if (anPart === an || anPart === `${an}_2` || anPart === `${an}_3`) {
        const c = compoundById[compoundId]
        if (!c) return null
        const nCat = (c.composition[cat === 'fe2' || cat === 'fe3' ? 'Fe' : cat.charAt(0).toUpperCase() + cat.slice(1)] ?? 1) as number
        return { cationId: cat, anionId: an, nCat: Math.max(1, nCat), nAn: 1 }
      }
    }
  }
  if (compoundId === 'salt_nh4_3_po4') return { cationId: 'nh4', anionId: 'po4', nCat: 3, nAn: 1 }
  return null
}

export function decomposeAqueous(compoundId: string): IonPair | null {
  if (compoundId === 'nacl') return { cationId: 'na', anionId: 'cl', nCat: 1, nAn: 1 }

  const salt = parseSaltId(compoundId)
  if (salt) return salt

  const acidAn = ACID_ANION[compoundId]
  if (acidAn) return { cationId: 'h', anionId: acidAn, nCat: 1, nAn: 1 }

  const baseCat = BASE_CATION[compoundId]
  if (baseCat) return { cationId: baseCat, anionId: 'oh', nCat: 1, nAn: 1 }

  const c = compoundById[compoundId]
  if (!c) return null

  if (CARBONATE_IDS.has(compoundId)) {
    const cat = compoundId.replace('salt_', '').replace('_co3', '')
    return { cationId: cat, anionId: 'co3', nCat: cat === 'na' || cat === 'k' ? 2 : 1, nAn: 1 }
  }
  if (HCO3_IDS.has(compoundId)) {
    if (compoundId === 'salt_ca_hco3_2') return { cationId: 'ca', anionId: 'hco3', nCat: 1, nAn: 2 }
    const cat = compoundId.replace('salt_', '').replace('hco3', '').replace('_', '')
    return { cationId: cat, anionId: 'hco3', nCat: 1, nAn: 1 }
  }

  if (c.category === 'base' && c.composition.O && c.composition.H) {
    const metal = Object.keys(c.composition).find((k) => k !== 'O' && k !== 'H')
    if (metal) {
      const catMap: Record<string, string> = {
        Na: 'na',
        K: 'k',
        Ca: 'ca',
        Mg: 'mg',
        Ba: 'ba',
        Fe: compoundId.includes('fe3') ? 'fe3' : 'fe2',
        Al: 'al',
        Zn: 'zn',
        Cu: 'cu',
      }
      const catId = catMap[metal]
      if (catId) return { cationId: catId, anionId: 'oh', nCat: c.composition[metal] ?? 1, nAn: (c.composition.O ?? 1) }
    }
  }

  return null
}

export function isCarbonateOrBicarbonate(compoundId: string): boolean {
  if (CARBONATE_IDS.has(compoundId) || HCO3_IDS.has(compoundId)) return true
  const ions = decomposeAqueous(compoundId)
  return ions?.anionId === 'co3' || ions?.anionId === 'hco3'
}

export function isAcid(compoundId: string): boolean {
  return compoundById[compoundId]?.category === 'acid' || compoundId in ACID_ANION
}

export function isBase(compoundId: string): boolean {
  const c = compoundById[compoundId]
  return c?.category === 'base' || compoundId in BASE_CATION || compoundId === 'nh3_h2o'
}

export function isBasicOxide(compoundId: string): boolean {
  const c = compoundById[compoundId]
  if (!c || c.category !== 'oxide') return false
  const basicIds = ['cao', 'mgo', 'na2o', 'k2o', 'bao', 'feo', 'fe2o3', 'cuo', 'zno', 'pbo']
  return basicIds.includes(compoundId) || Boolean(c.composition.O && !c.composition.H)
}

export function isAcidicOxide(compoundId: string): boolean {
  const ids = ['co2', 'so2', 'so3', 'no2', 'p2o5', 'sio2']
  return ids.includes(compoundId)
}

export function findSaltInCatalog(cationId: string, anionKey: string): string | null {
  const id = saltIdFromIons(cationId, anionKey)
  return compoundById[id] ? id : null
}
