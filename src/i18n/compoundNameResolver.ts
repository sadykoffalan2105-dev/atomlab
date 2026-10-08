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

/** UZ — изафетная форма «natriy xloridi», «kaliy nitrati» (как в Kimyo 8). */
const ANION: Record<string, { en: string; uz: string }> = {
  cl: { en: 'chloride', uz: 'xloridi' },
  br: { en: 'bromide', uz: 'bromidi' },
  i: { en: 'iodide', uz: 'yodidi' },
  f: { en: 'fluoride', uz: 'ftoridi' },
  no2: { en: 'nitrite', uz: 'nitriti' },
  no3: { en: 'nitrate', uz: 'nitrati' },
  mno4: { en: 'permanganate', uz: 'permanganati' },
  clo2: { en: 'chlorite', uz: 'xloriti' },
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

/**
 * Фиксированные вещества (оксиды, кислоты, основания, простые вещества, вещества учебников tb_*).
 * EN — школьная ИЮПАК-номенклатура; UZ — как в Kimyo 8–9: «temir(III) oksidi», кислоты по аниону — «sulfat kislota»,
 * «nitrat kislota», «xlorid kislota» (не кальки «oltingugurt kislotasi»).
 */
const MANUAL: Record<string, { en: string; uz: string }> = {
  h2o: { en: 'Water', uz: 'Suv' },
  co2: { en: 'Carbon dioxide', uz: 'Uglerod(IV) oksidi' }, // «karbonat angidrid» — в описании (аудит d2: имя без тривиального)
  nacl: { en: 'Sodium chloride', uz: 'Natriy xloridi' },
  co: { en: 'Carbon monoxide', uz: 'Uglerod(II) oksidi' }, // «is gazi» — в описании
  so2: { en: 'Sulfur dioxide', uz: 'Oltingugurt(IV) oksidi' },
  so3: { en: 'Sulfur trioxide', uz: 'Oltingugurt(VI) oksidi' },
  no: { en: 'Nitrogen monoxide', uz: 'Azot(II) oksidi' },
  no2: { en: 'Nitrogen dioxide', uz: 'Azot(IV) oksidi' },
  n2o: { en: 'Nitrogen(I) oxide', uz: 'Azot(I) oksidi' },
  n2o5: { en: 'Nitrogen(V) oxide', uz: 'Azot(V) oksidi' },
  p2o5: { en: 'Phosphorus(V) oxide', uz: 'Fosfor(V) oksidi' },
  sio2: { en: 'Silicon(IV) oxide', uz: 'Kremniy(IV) oksidi' },
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
  ago: { en: 'Silver oxide', uz: 'Kumush oksidi' },
  pbo: { en: 'Lead(II) oxide', uz: 'Qo\'rg\'oshin(II) oksidi' },
  pbo2: { en: 'Lead(IV) oxide', uz: 'Qo\'rg\'oshin(IV) oksidi' },
  mno2: { en: 'Manganese(IV) oxide', uz: 'Marganets(IV) oksidi' },
  cr2o3: { en: 'Chromium(III) oxide', uz: 'Xrom(III) oksidi' },
  cro3: { en: 'Chromium(VI) oxide', uz: 'Xrom(VI) oksidi' },
  sno2: { en: 'Tin(IV) oxide', uz: 'Qalay(IV) oksidi' },
  h2o2: { en: 'Hydrogen peroxide', uz: 'Vodorod peroksidi' },
  li2o2: { en: 'Lithium peroxide', uz: 'Litiy peroksidi' },
  na2o2: { en: 'Sodium peroxide', uz: 'Natriy peroksidi' },
  clo2: { en: 'Chlorine dioxide', uz: 'Xlor(IV) oksidi' },
  tb_mn2o7: { en: 'Manganese(VII) oxide', uz: 'Marganets(VII) oksidi' },
  tb_cl2o7: { en: 'Chlorine(VII) oxide', uz: 'Xlor(VII) oksidi' },
  tb_cro: { en: 'Chromium(II) oxide', uz: 'Xrom(II) oksidi' },
  tb_mn3o4: { en: 'Manganese(II,III) oxide', uz: 'Marganets(II,III) oksidi' },
  tb_mn2o3: { en: 'Manganese(III) oxide', uz: 'Marganets(III) oksidi' },
  tb_mno: { en: 'Manganese(II) oxide', uz: 'Marganets(II) oksidi' },
  tb_v2o5: { en: 'Vanadium(V) oxide', uz: 'Vanadiy(V) oksidi' },
  tb_hgo: { en: 'Mercury(II) oxide', uz: 'Simob(II) oksidi' },
  tb_n2o3: { en: 'Nitrogen(III) oxide', uz: 'Azot(III) oksidi' },
  tb_n2o4: { en: 'Dinitrogen tetroxide', uz: 'Diazot tetraoksidi' }, // «azot(IV) oksidi dimeri» — в описании
  tb_beo: { en: 'Beryllium oxide', uz: 'Berilliy oksidi' },
  tb_p4o10: { en: 'Phosphorus(V) oxide', uz: 'Fosfor(V) oksidi' }, // молекулы P₄O₁₀ — в описании (как RU «Оксид фосфора(V)»)
  tb_k2o2: { en: 'Potassium peroxide', uz: 'Kaliy peroksidi' },
  tb_bao2: { en: 'Barium peroxide', uz: 'Bariy peroksidi' },
  tb_ko2: { en: 'Potassium superoxide', uz: 'Kaliy nadperoksidi' },
  // кислоты
  hcl: { en: 'Hydrochloric acid', uz: 'Xlorid kislota' },
  hbr: { en: 'Hydrobromic acid', uz: 'Bromid kislota' },
  hi: { en: 'Hydroiodic acid', uz: 'Yodid kislota' },
  hf: { en: 'Hydrofluoric acid', uz: 'Ftorid kislota' },
  h2s: { en: 'Hydrogen sulfide', uz: 'Vodorod sulfid' },
  h2so4: { en: 'Sulfuric acid', uz: 'Sulfat kislota' },
  h2so3: { en: 'Sulfurous acid', uz: 'Sulfit kislota' },
  hno3: { en: 'Nitric acid', uz: 'Nitrat kislota' },
  hno2: { en: 'Nitrous acid', uz: 'Nitrit kislota' },
  h3po4: { en: 'Phosphoric acid', uz: 'Ortofosfat kislota' },
  h3po3: { en: 'Phosphorous acid', uz: 'Fosfit kislota' },
  h2co3: { en: 'Carbonic acid', uz: 'Karbonat kislota' },
  h2sio3: { en: 'Silicic acid', uz: 'Silikat kislota' },
  hclo3: { en: 'Chloric acid', uz: 'Xlorat kislota' },
  hclo4: { en: 'Perchloric acid', uz: 'Perxlorat kislota' },
  hclo: { en: 'Hypochlorous acid', uz: 'Gipoxlorit kislota' },
  hmno4: { en: 'Permanganic acid', uz: 'Permanganat kislota' },
  h2cro4: { en: 'Chromic acid', uz: 'Xromat kislota' },
  tb_hpo3: { en: 'Metaphosphoric acid', uz: 'Metafosfat kislota' },
  tb_h4p2o7: { en: 'Pyrophosphoric acid', uz: 'Pirofosfat kislota' },
  // основания
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
  nh3_h2o: { en: 'Aqueous ammonia', uz: 'Ammiakli suv (ammoniy gidroksidi)' },
  tb_croh2: { en: 'Chromium(II) hydroxide', uz: 'Xrom(II) gidroksidi' },
  tb_croh3: { en: 'Chromium(III) hydroxide', uz: 'Xrom(III) gidroksidi' },
  // простые вещества
  tb_h2: { en: 'Hydrogen', uz: 'Vodorod' },
  tb_o2: { en: 'Oxygen', uz: 'Kislorod' },
  tb_o3: { en: 'Ozone', uz: 'Ozon' },
  tb_n2: { en: 'Nitrogen', uz: 'Azot' },
  tb_f2: { en: 'Fluorine', uz: 'Ftor' },
  tb_cl2: { en: 'Chlorine', uz: 'Xlor' },
  tb_br2: { en: 'Bromine', uz: 'Brom' },
  tb_i2: { en: 'Iodine', uz: 'Yod' },
  tb_s8: { en: 'Sulfur (rhombic, S₈)', uz: 'Oltingugurt (rombik, S₈)' },
  tb_p4: { en: 'White phosphorus', uz: 'Oq fosfor' },
  // прочие бинарные
  nh3: { en: 'Ammonia', uz: 'Ammiak' },
  tb_ph3: { en: 'Phosphine', uz: 'Fosfin' },
  tb_sih4: { en: 'Silane', uz: 'Silan' },
  tb_cs2: { en: 'Carbon disulfide', uz: 'Uglerod disulfidi' },
  tb_sif4: { en: 'Silicon tetrafluoride', uz: 'Kremniy ftoridi' }, // как RU «Фторид кремния» (Kimyo 9: «фторид кремния SiF₄»)
  tb_nah: { en: 'Sodium hydride', uz: 'Natriy gidridi' },
  tb_kh: { en: 'Potassium hydride', uz: 'Kaliy gidridi' },
  tb_cah2: { en: 'Calcium hydride', uz: 'Kalsiy gidridi' },
  tb_cac2: { en: 'Calcium carbide', uz: 'Kalsiy karbidi' },
  tb_al4c3: { en: 'Aluminum carbide', uz: 'Alyuminiy karbidi' },
  tb_ca3p2: { en: 'Calcium phosphide', uz: 'Kalsiy fosfidi' },
  fes2: { en: 'Pyrite (iron disulfide)', uz: 'Pirit (temir disulfidi)' },
  // соли учебников
  tb_ca3po42: { en: 'Calcium phosphate', uz: 'Kalsiy fosfati' },
  tb_na3po4: { en: 'Sodium phosphate', uz: 'Natriy fosfati' },
  tb_mg3po42: { en: 'Magnesium phosphate', uz: 'Magniy fosfati' },
  tb_ag3po4: { en: 'Silver phosphate', uz: 'Kumush fosfati' },
  tb_cahpo4: { en: 'Calcium hydrogen phosphate', uz: 'Kalsiy gidrofosfati' },
  tb_cah2po42: { en: 'Calcium dihydrogen phosphate', uz: 'Kalsiy digidrofosfati' },
  tb_nh42hpo4: { en: 'Diammonium hydrogen phosphate', uz: 'Ammoniy gidrofosfati' },
  tb_nahso4: { en: 'Sodium hydrogen sulfate', uz: 'Natriy gidrosulfati' },
  tb_cuoh2co3: { en: 'Basic copper(II) carbonate (malachite)', uz: 'Mis(II) gidroksokarbonati (malaxit)' },
  tb_k2mno4: { en: 'Potassium manganate', uz: 'Kaliy manganati' },
  tb_crcl2: { en: 'Chromium(II) chloride', uz: 'Xrom(II) xloridi' },
  tb_aucl3: { en: 'Gold(III) chloride', uz: 'Oltin(III) xloridi' },
  tb_cu2s: { en: 'Copper(I) sulfide', uz: 'Mis(I) sulfidi' },
  tb_caocl2: { en: 'Bleaching powder (calcium chloride hypochlorite)', uz: 'Xlorli ohak' },
  tb_kclo: { en: 'Potassium hypochlorite', uz: 'Kaliy gipoxloriti' },
  tb_naalo2: { en: 'Sodium metaaluminate', uz: 'Natriy metaalyuminati' },
  tb_na2zno2: { en: 'Sodium zincate', uz: 'Natriy sinkati' },
  tb_na2znoh4: { en: 'Sodium tetrahydroxozincate', uz: 'Natriy tetragidroksosinkati' },
  tb_cuso4_5h2o: { en: 'Copper(II) sulfate pentahydrate (blue vitriol)', uz: 'Mis kuporosi (CuSO₄·5H₂O)' },
  tb_feso4_7h2o: { en: 'Iron(II) sulfate heptahydrate (green vitriol)', uz: 'Temir kuporosi (FeSO₄·7H₂O)' },
  tb_caso4_2h2o: { en: 'Gypsum (calcium sulfate dihydrate)', uz: 'Gips (CaSO₄·2H₂O)' },
  tb_na2so4_10h2o: { en: 'Glauber\'s salt (sodium sulfate decahydrate)', uz: 'Glauber tuzi (Na₂SO₄·10H₂O)' },
  tb_kcl_mgcl2_6h2o: { en: 'Carnallite', uz: 'Karnallit' },
  tb_kcl_mgso4_3h2o: { en: 'Kainite', uz: 'Kainit' },
  tb_kcl_nacl: { en: 'Sylvinite', uz: 'Silvinit' },
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
