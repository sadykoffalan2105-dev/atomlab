import type { AppLocale } from './types'

type Loc = 'en' | 'uz'

const CATION: Record<string, { en: string; uz: string }> = {
  na: { en: 'Sodium', uz: 'Natriy' },
  k: { en: 'Potassium', uz: 'Kaliy' },
  li: { en: 'Lithium', uz: 'Litiy' },
  nh4: { en: 'Ammonium', uz: 'Ammoniy' },
  ag: { en: 'Silver', uz: 'Kumush' },
  cs: { en: 'Cesium', uz: 'Seziy' },
  mg: { en: 'Magnesium', uz: 'Magniy' },
  ca: { en: 'Calcium', uz: 'Kalsiy' },
  ba: { en: 'Barium', uz: 'Bariy' },
  sr: { en: 'Strontium', uz: 'Stronsiy' },
  zn: { en: 'Zinc', uz: 'Rux' },
  cu: { en: 'Copper(II)', uz: 'Mis(II)' },
  fe2: { en: 'Iron(II)', uz: 'Temir(II)' },
  pb: { en: 'Lead(II)', uz: 'Qo\'rg\'oshin(II)' },
  sn: { en: 'Tin(II)', uz: 'Qalay(II)' },
  mn: { en: 'Manganese(II)', uz: 'Marganets(II)' },
  ni: { en: 'Nickel(II)', uz: 'Nikel(II)' },
  cobalt: { en: 'Cobalt(II)', uz: 'Kobalt(II)' },
  al: { en: 'Aluminum', uz: 'Alyuminiy' },
  fe3: { en: 'Iron(III)', uz: 'Temir(III)' },
  cr: { en: 'Chromium(III)', uz: 'Xrom(III)' },
}

const ANION: Record<string, { en: string; uz: string }> = {
  cl: { en: 'chloride', uz: 'xloridi' },
  br: { en: 'bromide', uz: 'bromidi' },
  i: { en: 'iodide', uz: 'yodidi' },
  f: { en: 'fluoride', uz: 'ftoridi' },
  no2: { en: 'nitrite', uz: 'nitriti' },
  no3: { en: 'nitrate', uz: 'nitrat' },
  mno4: { en: 'permanganate', uz: 'permanganati' },
  clo3: { en: 'chlorate', uz: 'xlorati' },
  clo4: { en: 'perchlorate', uz: 'perxlorati' },
  so4: { en: 'sulfate', uz: 'sulfati' },
  so3: { en: 'sulfite', uz: 'sulfiti' },
  co3: { en: 'carbonate', uz: 'karbonati' },
  s: { en: 'sulfide', uz: 'sulfidi' },
  sio3: { en: 'silicate', uz: 'silikati' },
  cro4: { en: 'chromate', uz: 'xromati' },
  cr2o7: { en: 'dichromate', uz: 'dixromati' },
  po4: { en: 'phosphate', uz: 'fosfati' },
}

const SPECIAL_SALT: Record<string, { en: string; uz: string }> = {
  salt_nh4_3_po4: { en: 'Ammonium phosphate', uz: 'Ammoniy fosfati' },
  salt_nahco3: { en: 'Sodium bicarbonate', uz: 'Natriy gidrokarbonati' },
  salt_khco3: { en: 'Potassium bicarbonate', uz: 'Kaliy gidrokarbonati' },
  salt_ca_hco3_2: { en: 'Calcium bicarbonate', uz: 'Kalsiy gidrokarbonati' },
  salt_k2cr2o7: { en: 'Potassium dichromate', uz: 'Kaliy dixromati' },
}

/** Фиксированные вещества (оксиды, кислоты, основания, базовые). */
const MANUAL: Record<string, { en: string; uz: string }> = {
  h2o: { en: 'Water', uz: 'Suv' },
  co2: { en: 'Carbon dioxide', uz: 'Karbonat angidrid' },
  nacl: { en: 'Sodium chloride', uz: 'Natriy xloridi' },
  co: { en: 'Carbon monoxide', uz: 'Uglerod monooksidi' },
  so2: { en: 'Sulfur dioxide', uz: 'Oltingugurt dioksidi' },
  so3: { en: 'Sulfur trioxide', uz: 'Oltingugurt trioksidi' },
  no: { en: 'Nitrogen monoxide', uz: 'Azot monooksidi' },
  no2: { en: 'Nitrogen dioxide', uz: 'Azot dioksidi' },
  n2o: { en: 'Nitrous oxide', uz: 'Azot(I) oksidi' },
  n2o5: { en: 'Dinitrogen pentoxide', uz: 'Azot kislotasi angidridi' },
  p2o5: { en: 'Phosphorus pentoxide', uz: 'Fosfor pentoksidi' },
  sio2: { en: 'Silicon dioxide', uz: 'Kremniy dioksidi' },
  li2o: { en: 'Lithium oxide', uz: 'Litiy oksidi' },
  na2o: { en: 'Sodium oxide', uz: 'Natriy oksidi' },
  k2o: { en: 'Potassium oxide', uz: 'Kaliy oksidi' },
  mgo: { en: 'Magnesium oxide', uz: 'Magniy oksidi' },
  cao: { en: 'Calcium oxide', uz: 'Kalsiy oksidi' },
  bao: { en: 'Barium oxide', uz: 'Bariy oksidi' },
  sro: { en: 'Strontium oxide', uz: 'Stronsiy oksidi' },
  al2o3: { en: 'Aluminum oxide', uz: 'Alyuminiy oksidi' },
  feo: { en: 'Iron(II) oxide', uz: 'Temir(II) oksidi' },
  fe2o3: { en: 'Iron(III) oxide', uz: 'Temir(III) oksidi' },
  fe3o4: { en: 'Iron(II,III) oxide', uz: 'Temir(II,III) oksidi' },
  cuo: { en: 'Copper(II) oxide', uz: 'Mis(II) oksidi' },
  cu2o: { en: 'Copper(I) oxide', uz: 'Mis(I) oksidi' },
  zno: { en: 'Zinc oxide', uz: 'Rux oksidi' },
  ago: { en: 'Silver(I) oxide', uz: 'Kumush(I) oksidi' },
  pbo: { en: 'Lead(II) oxide', uz: 'Qo\'rg\'oshin(II) oksidi' },
  pbo2: { en: 'Lead(IV) oxide', uz: 'Qo\'rg\'oshin(IV) oksidi' },
  mno2: { en: 'Manganese(IV) oxide', uz: 'Marganets(IV) oksidi' },
  cr2o3: { en: 'Chromium(III) oxide', uz: 'Xrom(III) oksidi' },
  cro3: { en: 'Chromium trioxide', uz: 'Xrom trioksidi' },
  sno2: { en: 'Tin(IV) oxide', uz: 'Qalay(IV) oksidi' },
  h2o2: { en: 'Hydrogen peroxide', uz: 'Vodorod peroksidi' },
  li2o2: { en: 'Lithium peroxide', uz: 'Litiy peroksidi' },
  na2o2: { en: 'Sodium peroxide', uz: 'Natriy peroksidi' },
  clo2: { en: 'Chlorine dioxide', uz: 'Xlor dioksidi' },
  hcl: { en: 'Hydrochloric acid', uz: 'Xlorid kislotasi' },
  hbr: { en: 'Hydrobromic acid', uz: 'Bromid kislotasi' },
  hi: { en: 'Hydroiodic acid', uz: 'Yodid kislotasi' },
  hf: { en: 'Hydrofluoric acid', uz: 'Ftorid kislotasi' },
  h2s: { en: 'Hydrogen sulfide', uz: 'Vodorod sulfidi' },
  h2so4: { en: 'Sulfuric acid', uz: 'Oltingugurt kislotasi' },
  h2so3: { en: 'Sulfurous acid', uz: 'Oltingugurt(IV) kislotasi' },
  hno3: { en: 'Nitric acid', uz: 'Azot kislotasi' },
  hno2: { en: 'Nitrous acid', uz: 'Azotist kislotasi' },
  h3po4: { en: 'Phosphoric acid', uz: 'Fosfor kislotasi' },
  h3po3: { en: 'Phosphorous acid', uz: 'Fosforist kislotasi' },
  h2co3: { en: 'Carbonic acid', uz: 'Uglerod kislotasi' },
  h2sio3: { en: 'Silicic acid', uz: 'Kremniy kislotasi' },
  hclo3: { en: 'Chloric acid', uz: 'Xlorovat kislotasi' },
  hclo4: { en: 'Perchloric acid', uz: 'Xlor (perxlor) kislotasi' },
  hclo: { en: 'Hypochlorous acid', uz: 'Xlorovatist kislotasi' },
  hmno4: { en: 'Permanganic acid', uz: 'Marganets kislotasi' },
  h2cro4: { en: 'Chromic acid', uz: 'Xrom kislotasi' },
  naoh: { en: 'Sodium hydroxide', uz: 'Natriy gidroksidi' },
  koh: { en: 'Potassium hydroxide', uz: 'Kaliy gidroksidi' },
  lioh: { en: 'Lithium hydroxide', uz: 'Litiy gidroksidi' },
  csoh: { en: 'Cesium hydroxide', uz: 'Seziy gidroksidi' },
  ba_oh_2: { en: 'Barium hydroxide', uz: 'Bariy gidroksidi' },
  ca_oh_2: { en: 'Calcium hydroxide', uz: 'Kalsiy gidroksidi' },
  sr_oh_2: { en: 'Strontium hydroxide', uz: 'Stronsiy gidroksidi' },
  mg_oh_2: { en: 'Magnesium hydroxide', uz: 'Magniy gidroksidi' },
  cu_oh_2: { en: 'Copper(II) hydroxide', uz: 'Mis(II) gidroksidi' },
  fe_oh_2: { en: 'Iron(II) hydroxide', uz: 'Temir(II) gidroksidi' },
  fe_oh_3: { en: 'Iron(III) hydroxide', uz: 'Temir(III) gidroksidi' },
  al_oh_3: { en: 'Aluminum hydroxide', uz: 'Alyuminiy gidroksidi' },
  zn_oh_2: { en: 'Zinc hydroxide', uz: 'Rux gidroksidi' },
  nh3_h2o: { en: 'Aqueous ammonia', uz: 'Suvli ammiak' },
}

function saltName(id: string, loc: Loc): string | null {
  const special = SPECIAL_SALT[id]
  if (special) return special[loc]

  const m = id.match(/^salt_([^_]+)_(.+)$/)
  if (!m) return null
  const [, catId, anKey] = m
  const cat = CATION[catId]
  const an = ANION[anKey]
  if (!cat || !an) return null
  if (loc === 'en') return `${cat.en} ${an.en}`
  return `${cat.uz} ${an.uz}`
}

export function resolveCompoundName(id: string, locale: AppLocale): string | null {
  if (locale === 'ru') return null
  const loc: Loc = locale === 'en' ? 'en' : 'uz'
  const manual = MANUAL[id]
  if (manual) return manual[loc]
  return saltName(id, loc)
}
