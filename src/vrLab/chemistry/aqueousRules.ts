import { compoundById } from '../../data/compounds'
import type { VrLabReactionEffect } from '../types'
import { buildSimpleEquation, type ReactionProduct } from './equationBuilder'
import {
  decomposeAqueous,
  findSaltInCatalog,
  isAcid,
  isBase,
  isBasicOxide,
  isCarbonateOrBicarbonate,
  parseSaltId,
  saltIdFromIons,
} from './ionRegistry'
import { precipitateLikely } from './solubilityBridge'

export type RuleResult = {
  productId: string
  effect: VrLabReactionEffect
  messageKey: string
  heat: number
  bubbleIntensity: number
  equationUnicode: string
  products?: ReactionProduct[]
  precipitateId?: string
  gasIds?: string[]
  confidence: 'rule'
}

const HYDRATION: Record<string, { productId: string; heat: number }> = {
  cao: { productId: 'ca_oh_2', heat: 0.95 },
  mgo: { productId: 'mg_oh_2', heat: 0.5 },
  na2o: { productId: 'naoh', heat: 0.9 },
  k2o: { productId: 'koh', heat: 0.88 },
  bao: { productId: 'ba_oh_2', heat: 0.85 },
  li2o: { productId: 'lioh', heat: 0.82 },
  p2o5: { productId: 'h3po4', heat: 0.75 },
  so3: { productId: 'h2so4', heat: 0.8 },
  n2o5: { productId: 'hno3', heat: 0.7 },
}

const ACID_STRENGTH: Record<string, number> = {
  hcl: 0.7,
  hbr: 0.68,
  hno3: 0.75,
  h2so4: 0.85,
  h3po4: 0.55,
  h2co3: 0.35,
  h2so3: 0.4,
  ch3cooh: 0.3,
}

function acidHeat(acidId: string): number {
  return ACID_STRENGTH[acidId] ?? 0.55
}

function saltFromAcidBase(acidId: string, baseId: string): string | null {
  const acidIons = decomposeAqueous(acidId)
  const baseIons = decomposeAqueous(baseId)
  if (!acidIons || !baseIons) return null
  return findSaltInCatalog(baseIons.cationId, acidIons.anionId)
}

export function tryNeutralization(a: string, b: string): RuleResult | null {
  let acid = isAcid(a) ? a : isAcid(b) ? b : null
  let base = isBase(a) ? a : isBase(b) ? b : null
  if (!acid || !base) return null

  const saltId = saltFromAcidBase(acid, base)
  const productId = saltId && compoundById[saltId] ? saltId : 'nacl'
  const heat = acidHeat(acid)
  return {
    productId,
    effect: 'neutralization',
    messageKey: 'vrLab.reaction.neutralization',
    heat,
    bubbleIntensity: 0.15 + heat * 0.15,
    equationUnicode: buildSimpleEquation(acid, base, productId, ['h2o']),
    products: [
      { compoundId: productId, phase: 'liquid', coeff: 1 },
      { compoundId: 'h2o', phase: 'liquid', coeff: 1 },
    ],
    confidence: 'rule',
  }
}

export function tryAcidCarbonate(a: string, b: string): RuleResult | null {
  const acid = isAcid(a) ? a : isAcid(b) ? b : null
  const other = acid === a ? b : a
  if (!acid || !isCarbonateOrBicarbonate(other)) return null

  const ions = decomposeAqueous(other)
  if (!ions) return null
  const saltId = findSaltInCatalog(ions.cationId, 'cl') ?? findSaltInCatalog(ions.cationId, 'no3')
  const productId = saltId && compoundById[saltId] ? saltId : 'nacl'

  return {
    productId: 'co2',
    effect: 'gasEvolution',
    messageKey: 'vrLab.reaction.co2',
    heat: 0.35,
    bubbleIntensity: 0.88,
    equationUnicode: buildSimpleEquation(acid, other, productId, ['h2o', 'co2']),
    products: [
      { compoundId: productId, phase: 'liquid', coeff: 1 },
      { compoundId: 'h2o', phase: 'liquid', coeff: 1 },
      { compoundId: 'co2', phase: 'gas', coeff: 1 },
    ],
    gasIds: ['co2'],
    confidence: 'rule',
  }
}

export function tryAcidBasicOxide(a: string, b: string): RuleResult | null {
  const acid = isAcid(a) ? a : isAcid(b) ? b : null
  const oxide = isBasicOxide(a) ? a : isBasicOxide(b) ? b : null
  if (!acid || !oxide) return null

  const oxideMap: Record<string, string> = {
    cuo: 'salt_cu_cl',
    fe2o3: 'salt_fe3_cl',
    zno: 'salt_zn_cl',
    cao: 'salt_ca_cl',
    mgo: 'salt_mg_cl',
    feo: 'salt_fe2_cl',
  }
  const productId = oxideMap[oxide] && compoundById[oxideMap[oxide]!] ? oxideMap[oxide]! : 'nacl'

  return {
    productId,
    effect: 'colorShift',
    messageKey: 'vrLab.reaction.dissolve',
    heat: 0.4,
    bubbleIntensity: 0.12,
    equationUnicode: buildSimpleEquation(acid, oxide, productId, ['h2o']),
    confidence: 'rule',
  }
}

export function tryDoubleDisplacement(a: string, b: string): RuleResult | null {
  const ionsA = decomposeAqueous(a)
  const ionsB = decomposeAqueous(b)
  if (!ionsA || !ionsB) return null
  if (ionsA.cationId === ionsB.cationId && ionsA.anionId === ionsB.anionId) return null

  const newSalt1 = saltIdFromIons(ionsA.cationId, ionsB.anionId)
  const newSalt2 = saltIdFromIons(ionsB.cationId, ionsA.anionId)

  const precip1 =
    precipitateLikely(ionsA.cationId, ionsB.anionId) ||
    (ionsA.cationId === 'ag' && ['cl', 'br', 'i'].includes(ionsB.anionId)) ||
    (ionsB.cationId === 'ag' && ['cl', 'br', 'i'].includes(ionsA.anionId))
  const precip2 =
    precipitateLikely(ionsB.cationId, ionsA.anionId) ||
    (ionsB.cationId === 'ag' && ['cl', 'br', 'i'].includes(ionsA.anionId)) ||
    (ionsA.cationId === 'ag' && ['cl', 'br', 'i'].includes(ionsB.anionId))

  if (!precip1 && !precip2) return null

  const precipId = precip1
    ? compoundById[newSalt1]
      ? newSalt1
      : ionsA.cationId === 'ag' && ionsB.anionId === 'cl'
        ? 'salt_ag_cl'
        : null
    : compoundById[newSalt2]
      ? newSalt2
      : ionsB.cationId === 'ag' && ionsA.anionId === 'cl'
        ? 'salt_ag_cl'
        : null

  if (!precipId) return null

  const liquidId = precip1 && !precip2 ? newSalt2 : newSalt1
  const productId = compoundById[liquidId] ? liquidId : precipId

  return {
    productId,
    effect: 'precipitate',
    messageKey: 'vrLab.reaction.precipitate',
    heat: 0.25,
    bubbleIntensity: 0.35,
    equationUnicode: `${compoundById[a]?.formulaUnicode} + ${compoundById[b]?.formulaUnicode} → ${compoundById[precipId]?.formulaUnicode}↓ + ${compoundById[liquidId]?.formulaUnicode ?? '…'}`,
    products: [
      { compoundId: precipId, phase: 'solid', coeff: 1 },
      { compoundId: productId, phase: 'liquid', coeff: 1 },
    ],
    precipitateId: precipId,
    confidence: 'rule',
  }
}

export function trySaltWithAcid(a: string, b: string): RuleResult | null {
  const acid = isAcid(a) ? a : isAcid(b) ? b : null
  const salt = parseSaltId(acid === a ? b : a)
  if (!acid || !salt) return null

  if (salt.anionId === 'co3' || salt.anionId === 'hco3') {
    return tryAcidCarbonate(acid, acid === a ? b : a)
  }

  const acidIons = decomposeAqueous(acid)
  if (!acidIons) return null

  if (salt.anionId === acidIons.anionId) return null

  const newSalt = findSaltInCatalog(salt.cationId, acidIons.anionId)
  if (!newSalt) return null

  const precipAnion = salt.anionId
  const weakGas = precipAnion === 's' || precipAnion === 'so3'

  if (precipitateLikely(salt.cationId, acidIons.anionId)) {
    return tryDoubleDisplacement(a, b)
  }

  if (weakGas) {
    return {
      productId: newSalt,
      effect: 'gasEvolution',
      messageKey: 'vrLab.reaction.gas',
      heat: 0.3,
      bubbleIntensity: 0.6,
      equationUnicode: buildSimpleEquation(acid, acid === a ? b : a, newSalt),
      confidence: 'rule',
    }
  }

  return null
}

export function tryBaseWithMetalSalt(a: string, b: string): RuleResult | null {
  const base = isBase(a) ? a : isBase(b) ? b : null
  const salt = parseSaltId(base === a ? b : a)
  if (!base || !salt) return null

  const METAL_OH: Record<string, string> = {
    cu: 'cu_oh_2',
    fe2: 'fe_oh_2',
    fe3: 'fe_oh_3',
    zn: 'zn_oh_2',
    al: 'al_oh_3',
    mg: 'mg_oh_2',
    ca: 'ca_oh_2',
    ba: 'ba_oh_2',
    pb: 'pb_oh_2',
  }
  const ohId = METAL_OH[salt.cationId]
  if (!ohId || !compoundById[ohId]) return null
  if (!precipitateLikely(salt.cationId, 'oh')) return null

  const baseIons = decomposeAqueous(base)
  if (!baseIons) return null
  const newSalt = findSaltInCatalog(baseIons.cationId, salt.anionId)
  const productId = newSalt && compoundById[newSalt] ? newSalt : ohId
  const saltFormula = compoundById[base === a ? b : a]?.formulaUnicode ?? ''
  const baseFormula = compoundById[base]?.formulaUnicode ?? ''
  const ohFormula = compoundById[ohId]?.formulaUnicode ?? ''
  const aqFormula = compoundById[productId]?.formulaUnicode ?? '…'

  return {
    productId,
    effect: 'precipitate',
    messageKey: 'vrLab.reaction.precipitate',
    heat: 0.3,
    bubbleIntensity: 0.22,
    equationUnicode: `${baseFormula} + ${saltFormula} → ${ohFormula}↓ + ${aqFormula}`,
    precipitateId: ohId,
    confidence: 'rule',
  }
}

export function tryBaseWithSalt(a: string, b: string): RuleResult | null {
  const base = isBase(a) ? a : isBase(b) ? b : null
  const salt = parseSaltId(base === a ? b : a)
  if (!base || !salt) return null

  const baseIons = decomposeAqueous(base)
  if (!baseIons) return null

  const saltId = base === a ? b : a
  if (salt.cationId === 'nh4' || saltId.includes('nh4')) {
    return {
      productId: 'nh3',
      effect: 'gasEvolution',
      messageKey: 'vrLab.reaction.gas',
      heat: 0.35,
      bubbleIntensity: 0.75,
      equationUnicode: buildSimpleEquation(base, base === a ? b : a, 'nh3', ['h2o']),
      gasIds: ['nh3'],
      confidence: 'rule',
    }
  }

  const newSalt = findSaltInCatalog(baseIons.cationId, salt.anionId)
  if (!newSalt) return null

  const precipId = saltIdFromIons(salt.cationId, 'oh')
  if (compoundById[precipId] && precipitateLikely(salt.cationId, 'oh')) {
    return {
      productId: newSalt,
      effect: 'precipitate',
      messageKey: 'vrLab.reaction.precipitate',
      heat: 0.3,
      bubbleIntensity: 0.25,
      equationUnicode: `${compoundById[base]?.formulaUnicode} + ${compoundById[b === base ? a : b]?.formulaUnicode} → ${compoundById[precipId]?.formulaUnicode}↓ + ${compoundById[newSalt]?.formulaUnicode}`,
      precipitateId: precipId,
      confidence: 'rule',
    }
  }

  return null
}

export function tryHydration(a: string, b: string): RuleResult | null {
  if (a !== 'h2o' && b !== 'h2o') return null
  const oxide = a === 'h2o' ? b : a
  const hit = HYDRATION[oxide]
  if (!hit || !compoundById[hit.productId]) return null
  return {
    productId: hit.productId,
    effect: 'hydration',
    messageKey: 'vrLab.reaction.hydration',
    heat: hit.heat,
    bubbleIntensity: 0.35,
    equationUnicode: buildSimpleEquation(oxide, 'h2o', hit.productId),
    confidence: 'rule',
  }
}

export function tryAcidBasePrecipitate(a: string, b: string): RuleResult | null {
  const acid = isAcid(a) ? a : isAcid(b) ? b : null
  const base = isBase(a) ? a : isBase(b) ? b : null
  if (!acid || !base) return null

  const baseIons = decomposeAqueous(base)
  if (!baseIons) return null

  const precipId = saltIdFromIons(baseIons.cationId, 'oh')
  if (!compoundById[precipId]) return null

  if (['fe_oh_3', 'al_oh_3', 'cu_oh_2', 'zn_oh_2', 'fe_oh_2'].includes(base)) {
    const saltId = saltFromAcidBase(acid, base)
    return {
      productId: saltId ?? precipId,
      effect: 'colorShift',
      messageKey: 'vrLab.reaction.dissolve',
      heat: 0.45,
      bubbleIntensity: 0.15,
      equationUnicode: buildSimpleEquation(acid, base, saltId ?? precipId, ['h2o']),
      confidence: 'rule',
    }
  }

  return null
}

export function applyAqueousRules(a: string, b: string): RuleResult | null {
  const rules = [
    tryNeutralization,
    tryAcidCarbonate,
    tryAcidBasicOxide,
    tryHydration,
    tryDoubleDisplacement,
    tryBaseWithMetalSalt,
    trySaltWithAcid,
    tryBaseWithSalt,
    tryAcidBasePrecipitate,
  ]
  for (const rule of rules) {
    const hit = rule(a, b)
    if (hit) return hit
  }
  return null
}
