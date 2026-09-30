/**
 * Классы и семейства «по корню» для 200 веществ каталога (docs/plans/catalog-top200.md, §1).
 *
 * Корень — частица, которая переходит из вещества в вещество без изменения: кислотный остаток (Cl⁻, SO₄²⁻, NO₃⁻ …),
 * гидроксид-ион OH⁻, ион аммония NH₄⁺, пероксид-ион O₂²⁻. Кислота и её соли — одно семейство (HCl → NaCl, CaCl₂…:
 * «хлориды»), класс вещества (кислота / соль) — отдельно. Оксиды — по свойствам (основные, амфотерные, кислотные,
 * несолеобразующие), основания — щёлочи / нерастворимые / амфотерные.
 */
import { CATALOG_TOP200_IDS } from './catalogTop200'

export type SubstanceClass = 'simple' | 'oxide' | 'base' | 'acid' | 'salt' | 'binary'

export type FamilyId =
  | 'chloride'
  | 'bromide'
  | 'iodide'
  | 'fluoride'
  | 'sulfide'
  | 'sulfate'
  | 'hydrosulfate'
  | 'sulfite'
  | 'nitrate'
  | 'nitrite'
  | 'carbonate'
  | 'hydrocarbonate'
  | 'phosphate'
  | 'silicate'
  | 'chromate'
  | 'permanganate'
  | 'oxochlorate'
  | 'aluminateZincate'
  | 'hydrate'
  | 'doubleSalt'
  | 'alkali'
  | 'baseInsoluble'
  | 'hydroxideAmphoteric'
  | 'ammoniaHydrate'
  | 'oxideBasic'
  | 'oxideAmphoteric'
  | 'oxideAcidic'
  | 'oxideIndifferent'
  | 'oxideMixed'
  | 'peroxide'
  | 'hydrogenNonmetal'
  | 'hydrideMetal'
  | 'carbidePhosphide'
  | 'nonmetalBinary'
  | 'simpleMolecule'

export type Root = {
  /** формула корня: SO₄²⁻, OH⁻, NH₄⁺ */
  formula: string
  charge: number
}

export type FamilyInfo = {
  id: FamilyId
  ru: string
  en: string
  uz: string
  /** корень семейства (у оксидов и простых веществ — нет) */
  root?: Root
}

const r = (formula: string, charge: number): Root => ({ formula, charge })

/** Семейства в порядке показа (чипы каталога). */
export const FAMILIES: readonly FamilyInfo[] = [
  { id: 'chloride', ru: 'Хлориды', en: 'Chlorides', uz: 'Xloridlar', root: r('Cl⁻', -1) },
  { id: 'bromide', ru: 'Бромиды', en: 'Bromides', uz: 'Bromidlar', root: r('Br⁻', -1) },
  { id: 'iodide', ru: 'Иодиды', en: 'Iodides', uz: 'Yodidlar', root: r('I⁻', -1) },
  { id: 'fluoride', ru: 'Фториды', en: 'Fluorides', uz: 'Ftoridlar', root: r('F⁻', -1) },
  { id: 'sulfide', ru: 'Сульфиды', en: 'Sulfides', uz: 'Sulfidlar', root: r('S²⁻', -2) },
  { id: 'sulfate', ru: 'Сульфаты', en: 'Sulfates', uz: 'Sulfatlar', root: r('SO₄²⁻', -2) },
  { id: 'hydrosulfate', ru: 'Гидросульфаты', en: 'Hydrogen sulfates', uz: 'Gidrosulfatlar', root: r('HSO₄⁻', -1) },
  { id: 'sulfite', ru: 'Сульфиты', en: 'Sulfites', uz: 'Sulfitlar', root: r('SO₃²⁻', -2) },
  { id: 'nitrate', ru: 'Нитраты', en: 'Nitrates', uz: 'Nitratlar', root: r('NO₃⁻', -1) },
  { id: 'nitrite', ru: 'Нитриты', en: 'Nitrites', uz: 'Nitritlar', root: r('NO₂⁻', -1) },
  { id: 'carbonate', ru: 'Карбонаты', en: 'Carbonates', uz: 'Karbonatlar', root: r('CO₃²⁻', -2) },
  { id: 'hydrocarbonate', ru: 'Гидрокарбонаты', en: 'Hydrogen carbonates', uz: 'Gidrokarbonatlar', root: r('HCO₃⁻', -1) },
  { id: 'phosphate', ru: 'Фосфаты', en: 'Phosphates', uz: 'Fosfatlar', root: r('PO₄³⁻', -3) },
  { id: 'silicate', ru: 'Силикаты', en: 'Silicates', uz: 'Silikatlar', root: r('SiO₃²⁻', -2) },
  { id: 'chromate', ru: 'Хроматы и дихроматы', en: 'Chromates & dichromates', uz: 'Xromatlar va dixromatlar', root: r('CrO₄²⁻', -2) },
  { id: 'permanganate', ru: 'Перманганаты и манганаты', en: 'Permanganates & manganates', uz: 'Permanganatlar va manganatlar', root: r('MnO₄⁻', -1) },
  { id: 'oxochlorate', ru: 'Гипохлориты, хлориты, хлораты', en: 'Hypochlorites, chlorites, chlorates', uz: 'Gipoxloritlar, xloritlar, xloratlar', root: r('ClO⁻', -1) },
  { id: 'aluminateZincate', ru: 'Алюминаты и цинкаты', en: 'Aluminates & zincates', uz: 'Aluminatlar va sinkatlar', root: r('AlO₂⁻', -1) },
  { id: 'hydrate', ru: 'Кристаллогидраты', en: 'Crystal hydrates', uz: 'Kristallogidratlar' },
  { id: 'doubleSalt', ru: 'Двойные соли и минералы', en: 'Double salts & minerals', uz: 'Qo‘sh tuzlar va minerallar' },
  { id: 'alkali', ru: 'Щёлочи', en: 'Alkalis', uz: 'Ishqorlar', root: r('OH⁻', -1) },
  { id: 'baseInsoluble', ru: 'Нерастворимые основания', en: 'Insoluble bases', uz: 'Erimaydigan asoslar', root: r('OH⁻', -1) },
  { id: 'hydroxideAmphoteric', ru: 'Амфотерные гидроксиды', en: 'Amphoteric hydroxides', uz: 'Amfoter gidroksidlar', root: r('OH⁻', -1) },
  { id: 'ammoniaHydrate', ru: 'Гидрат аммиака', en: 'Ammonia hydrate', uz: 'Ammiak gidrati', root: r('NH₄⁺', 1) },
  { id: 'oxideBasic', ru: 'Основные оксиды', en: 'Basic oxides', uz: 'Asosli oksidlar', root: r('O²⁻', -2) },
  { id: 'oxideAmphoteric', ru: 'Амфотерные оксиды', en: 'Amphoteric oxides', uz: 'Amfoter oksidlar', root: r('O²⁻', -2) },
  { id: 'oxideAcidic', ru: 'Кислотные оксиды', en: 'Acidic oxides', uz: 'Kislotali oksidlar' },
  { id: 'oxideIndifferent', ru: 'Несолеобразующие оксиды', en: 'Non-salt-forming oxides', uz: 'Tuz hosil qilmaydigan oksidlar' },
  { id: 'oxideMixed', ru: 'Смешанные оксиды', en: 'Mixed oxides', uz: 'Aralash oksidlar', root: r('O²⁻', -2) },
  { id: 'peroxide', ru: 'Пероксиды', en: 'Peroxides', uz: 'Peroksidlar', root: r('O₂²⁻', -2) },
  { id: 'hydrogenNonmetal', ru: 'Водородные соединения неметаллов', en: 'Nonmetal hydrides', uz: 'Metallmaslarning vodorodli birikmalari' },
  { id: 'hydrideMetal', ru: 'Гидриды металлов', en: 'Metal hydrides', uz: 'Metall gidridlari', root: r('H⁻', -1) },
  { id: 'carbidePhosphide', ru: 'Карбиды и фосфиды', en: 'Carbides & phosphides', uz: 'Karbidlar va fosfidlar' },
  { id: 'nonmetalBinary', ru: 'Бинарные соединения неметаллов', en: 'Nonmetal binary compounds', uz: 'Metallmaslarning binar birikmalari' },
  { id: 'simpleMolecule', ru: 'Простые вещества', en: 'Elements (molecules)', uz: 'Oddiy moddalar' },
]

type Entry = readonly [SubstanceClass, FamilyId, Root?]

/**
 * Таблица 200: класс, семейство и (если отличается от корня семейства) собственный корень.
 * Порядок — как в CATALOG_TOP200_IDS.
 */
const T: Readonly<Record<string, Entry>> = {
  co2: ['oxide', 'oxideAcidic'],
  hcl: ['acid', 'chloride'],
  h2o: ['oxide', 'hydrogenNonmetal'],
  h2so4: ['acid', 'sulfate'],
  so2: ['oxide', 'oxideAcidic'],
  nacl: ['salt', 'chloride'],
  co: ['oxide', 'oxideIndifferent'],
  salt_ca_co3: ['salt', 'carbonate'],
  tb_cl2: ['simple', 'simpleMolecule'],
  tb_o2: ['simple', 'simpleMolecule'],
  ca_oh_2: ['base', 'alkali'],
  tb_h2: ['simple', 'simpleMolecule'],
  hno3: ['acid', 'nitrate'],
  naoh: ['base', 'alkali'],
  h2s: ['acid', 'sulfide'],
  salt_cu_so4: ['salt', 'sulfate'],
  nh3: ['binary', 'hydrogenNonmetal'],
  koh: ['base', 'alkali'],
  salt_na_so4: ['salt', 'sulfate'],
  tb_n2: ['simple', 'simpleMolecule'],
  salt_k_cl: ['salt', 'chloride'],
  tb_s8: ['simple', 'simpleMolecule'],
  cuo: ['oxide', 'oxideBasic'],
  cu_oh_2: ['base', 'baseInsoluble'],
  salt_na_co3: ['salt', 'carbonate'],
  cao: ['oxide', 'oxideBasic'],
  sio2: ['oxide', 'oxideAcidic'],
  no: ['oxide', 'oxideIndifferent'],
  no2: ['oxide', 'oxideAcidic'],
  salt_k_so4: ['salt', 'sulfate'],
  salt_ba_so4: ['salt', 'sulfate'],
  tb_i2: ['simple', 'simpleMolecule'],
  salt_ca_cl: ['salt', 'chloride'],
  al2o3: ['oxide', 'oxideAmphoteric'],
  salt_k_mno4: ['salt', 'permanganate'],
  tb_br2: ['simple', 'simpleMolecule'],
  salt_na_no3: ['salt', 'nitrate'],
  salt_fe3_cl: ['salt', 'chloride'],
  h3po4: ['acid', 'phosphate'],
  mno2: ['oxide', 'oxideAmphoteric'],
  p2o5: ['oxide', 'oxideAcidic'],
  fe2o3: ['oxide', 'oxideAmphoteric'],
  tb_p4: ['simple', 'simpleMolecule'],
  al_oh_3: ['base', 'hydroxideAmphoteric'],
  salt_ag_no3: ['salt', 'nitrate'],
  salt_k_no3: ['salt', 'nitrate'],
  salt_zn_cl: ['salt', 'chloride'],
  so3: ['oxide', 'oxideAcidic'],
  zno: ['oxide', 'oxideAmphoteric'],
  salt_fe2_so4: ['salt', 'sulfate'],
  salt_al_cl: ['salt', 'chloride'],
  salt_nahco3: ['salt', 'hydrocarbonate'],
  fe_oh_3: ['base', 'hydroxideAmphoteric'],
  h2co3: ['acid', 'carbonate'],
  salt_nh4_cl: ['salt', 'chloride'],
  h2so3: ['acid', 'sulfite'],
  salt_al_so4: ['salt', 'sulfate'],
  mgo: ['oxide', 'oxideBasic'],
  salt_cu_cl: ['salt', 'chloride'],
  hbr: ['acid', 'bromide'],
  h2o2: ['oxide', 'peroxide'],
  salt_ba_cl: ['salt', 'chloride'],
  tb_ca3po42: ['salt', 'phosphate'],
  salt_ag_cl: ['salt', 'chloride'],
  tb_f2: ['simple', 'simpleMolecule'],
  salt_k_co3: ['salt', 'carbonate'],
  fe3o4: ['oxide', 'oxideMixed'],
  hi: ['acid', 'iodide'],
  salt_k_clo3: ['salt', 'oxochlorate', r('ClO₃⁻', -1)],
  salt_nh4_no3: ['salt', 'nitrate'],
  salt_k2cr2o7: ['salt', 'chromate', r('Cr₂O₇²⁻', -2)],
  salt_fe2_cl: ['salt', 'chloride'],
  zn_oh_2: ['base', 'hydroxideAmphoteric'],
  fe_oh_2: ['base', 'baseInsoluble'],
  salt_mg_cl: ['salt', 'chloride'],
  salt_zn_so4: ['salt', 'sulfate'],
  salt_k_i: ['salt', 'iodide'],
  salt_fe2_s: ['salt', 'sulfide'],
  tb_o3: ['simple', 'simpleMolecule'],
  hf: ['acid', 'fluoride'],
  salt_ca_hco3_2: ['salt', 'hydrocarbonate'],
  cu2o: ['oxide', 'oxideBasic'],
  ba_oh_2: ['base', 'alkali'],
  salt_ca_so4: ['salt', 'sulfate'],
  salt_nh4_so4: ['salt', 'sulfate'],
  salt_na_br: ['salt', 'bromide'],
  mg_oh_2: ['base', 'baseInsoluble'],
  salt_mg_so4: ['salt', 'sulfate'],
  tb_cah2: ['binary', 'hydrideMetal'],
  hno2: ['acid', 'nitrite'],
  tb_cac2: ['binary', 'carbidePhosphide', r('C₂²⁻', -2)],
  salt_na_sio3: ['salt', 'silicate'],
  salt_fe3_so4: ['salt', 'sulfate'],
  tb_na3po4: ['salt', 'phosphate'],
  h2sio3: ['acid', 'silicate'],
  n2o5: ['oxide', 'oxideAcidic'],
  salt_ca_no3: ['salt', 'nitrate'],
  salt_k_br: ['salt', 'bromide'],
  salt_na_so3: ['salt', 'sulfite'],
  tb_nah: ['binary', 'hydrideMetal'],
  cr2o3: ['oxide', 'oxideAmphoteric'],
  feo: ['oxide', 'oxideBasic'],
  salt_na_s: ['salt', 'sulfide'],
  na2o: ['oxide', 'oxideBasic'],
  salt_cu_no3: ['salt', 'nitrate'],
  salt_mn_so4: ['salt', 'sulfate'],
  fes2: ['binary', 'sulfide', r('S₂²⁻', -2)],
  k2o: ['oxide', 'oxideBasic'],
  cro3: ['oxide', 'oxideAcidic'],
  li2o: ['oxide', 'oxideBasic'],
  tb_ph3: ['binary', 'hydrogenNonmetal'],
  tb_cuso4_5h2o: ['salt', 'hydrate', r('SO₄²⁻', -2)],
  tb_sih4: ['binary', 'hydrogenNonmetal'],
  n2o: ['oxide', 'oxideIndifferent'],
  nh3_h2o: ['base', 'ammoniaHydrate'],
  salt_na_clo2: ['salt', 'oxochlorate', r('ClO₂⁻', -1)],
  na2o2: ['oxide', 'peroxide'],
  salt_cr_so4: ['salt', 'sulfate'],
  salt_pb_no3: ['salt', 'nitrate'],
  tb_cro: ['oxide', 'oxideBasic'],
  tb_croh2: ['base', 'baseInsoluble'],
  salt_mn_cl: ['salt', 'chloride'],
  tb_nahso4: ['salt', 'hydrosulfate'],
  salt_al_no3: ['salt', 'nitrate'],
  hclo: ['acid', 'oxochlorate'],
  salt_mg_co3: ['salt', 'carbonate'],
  salt_na_i: ['salt', 'iodide'],
  salt_zn_s: ['salt', 'sulfide'],
  salt_cu_s: ['salt', 'sulfide'],
  hclo4: ['acid', 'oxochlorate', r('ClO₄⁻', -1)],
  salt_al_s: ['salt', 'sulfide'],
  salt_pb_s: ['salt', 'sulfide'],
  lioh: ['base', 'alkali'],
  tb_cuoh2co3: ['salt', 'carbonate'],
  tb_k2mno4: ['salt', 'permanganate', r('MnO₄²⁻', -2)],
  tb_cl2o7: ['oxide', 'oxideAcidic'],
  tb_crcl2: ['salt', 'chloride'],
  tb_mn2o7: ['oxide', 'oxideAcidic'],
  bao: ['oxide', 'oxideBasic'],
  salt_ba_no3: ['salt', 'nitrate'],
  salt_zn_no3: ['salt', 'nitrate'],
  tb_mn3o4: ['oxide', 'oxideMixed'],
  tb_croh3: ['base', 'hydroxideAmphoteric'],
  tb_v2o5: ['oxide', 'oxideAcidic'],
  tb_cs2: ['binary', 'nonmetalBinary'],
  pbo: ['oxide', 'oxideAmphoteric'],
  tb_k2o2: ['oxide', 'peroxide'],
  salt_k_s: ['salt', 'sulfide'],
  tb_aucl3: ['salt', 'chloride'],
  salt_ca_s: ['salt', 'sulfide'],
  salt_ag_br: ['salt', 'bromide'],
  salt_na_no2: ['salt', 'nitrite'],
  hmno4: ['acid', 'permanganate'],
  salt_li_cl: ['salt', 'chloride'],
  salt_fe3_no3: ['salt', 'nitrate'],
  hclo3: ['acid', 'oxochlorate', r('ClO₃⁻', -1)],
  salt_ag_i: ['salt', 'iodide'],
  tb_hgo: ['oxide', 'oxideBasic'],
  tb_hpo3: ['acid', 'phosphate', r('PO₃⁻', -1)],
  ago: ['oxide', 'oxideBasic'],
  salt_cr_cl: ['salt', 'chloride'],
  salt_k_no2: ['salt', 'nitrite'],
  salt_pb_i: ['salt', 'iodide'],
  tb_al4c3: ['binary', 'carbidePhosphide', r('C⁴⁻', -4)],
  tb_cah2po42: ['salt', 'phosphate', r('H₂PO₄⁻', -1)],
  salt_ca_sio3: ['salt', 'silicate'],
  tb_ag3po4: ['salt', 'phosphate'],
  tb_cahpo4: ['salt', 'phosphate', r('HPO₄²⁻', -2)],
  tb_caocl2: ['salt', 'oxochlorate'],
  tb_n2o3: ['oxide', 'oxideAcidic'],
  tb_caso4_2h2o: ['salt', 'hydrate', r('SO₄²⁻', -2)],
  salt_pb_cl: ['salt', 'chloride'],
  tb_kh: ['binary', 'hydrideMetal'],
  tb_naalo2: ['salt', 'aluminateZincate'],
  tb_beo: ['oxide', 'oxideAmphoteric'],
  tb_cu2s: ['salt', 'sulfide'],
  salt_fe2_no3: ['salt', 'nitrate'],
  tb_kcl_mgcl2_6h2o: ['salt', 'doubleSalt', r('Cl⁻', -1)],
  tb_kcl_nacl: ['salt', 'doubleSalt', r('Cl⁻', -1)],
  tb_mn2o3: ['oxide', 'oxideBasic'],
  salt_nh4_co3: ['salt', 'carbonate'],
  tb_kclo: ['salt', 'oxochlorate'],
  tb_p4o10: ['oxide', 'oxideAcidic'],
  tb_sif4: ['binary', 'nonmetalBinary'],
  tb_feso4_7h2o: ['salt', 'hydrate', r('SO₄²⁻', -2)],
  tb_kcl_mgso4_3h2o: ['salt', 'doubleSalt', r('SO₄²⁻', -2)],
  tb_mno: ['oxide', 'oxideBasic'],
  tb_na2so4_10h2o: ['salt', 'hydrate', r('SO₄²⁻', -2)],
  tb_nh42hpo4: ['salt', 'phosphate', r('HPO₄²⁻', -2)],
  salt_k_cro4: ['salt', 'chromate'],
  tb_ca3p2: ['binary', 'carbidePhosphide', r('P³⁻', -3)],
  tb_n2o4: ['oxide', 'oxideAcidic'],
  tb_na2zno2: ['salt', 'aluminateZincate', r('ZnO₂²⁻', -2)],
  tb_bao2: ['oxide', 'peroxide'],
  tb_h4p2o7: ['acid', 'phosphate', r('P₂O₇⁴⁻', -4)],
  tb_ko2: ['oxide', 'peroxide', r('O₂⁻', -1)],
  tb_na2znoh4: ['salt', 'aluminateZincate', r('[Zn(OH)₄]²⁻', -2)],
  salt_k_so3: ['salt', 'sulfite'],
  salt_nh4_cr2o7: ['salt', 'chromate', r('Cr₂O₇²⁻', -2)],
  tb_mg3po42: ['salt', 'phosphate'],
}

const FAMILY_BY_ID = new Map(FAMILIES.map((f) => [f.id, f]))

export type CatalogFamilyEntry = {
  id: string
  cls: SubstanceClass
  family: FamilyInfo
  /** корень этого вещества (свой или семейства); нет — у оксидов неметаллов и простых веществ */
  root?: Root
}

/** Класс, семейство и корень вещества из 200; null — вещества нет в таблице. */
export function familyOf(id: string): CatalogFamilyEntry | null {
  const e = T[id]
  if (!e) return null
  const family = FAMILY_BY_ID.get(e[1])!
  return { id, cls: e[0], family, root: e[2] ?? family.root }
}

/** Название семейства на языке интерфейса. */
export function familyName(f: FamilyInfo, locale: string): string {
  if (locale.startsWith('en')) return f.en
  if (locale.startsWith('uz')) return f.uz
  return f.ru
}

/** Семейства, в которых есть вещества из 200, с их id (в порядке FAMILIES). */
export function familiesWithMembers(): { family: FamilyInfo; ids: string[] }[] {
  return FAMILIES.map((family) => ({ family, ids: CATALOG_TOP200_IDS.filter((id) => T[id]?.[1] === family.id) })).filter((x) => x.ids.length > 0)
}

/** Для теста: все id таблицы. */
export const FAMILY_TABLE_IDS: readonly string[] = Object.keys(T)
