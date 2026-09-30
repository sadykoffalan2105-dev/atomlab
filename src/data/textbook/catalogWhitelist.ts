/**
 * Каталог веществ = только вещества из учебников «Химия» 7–11.
 * Список id строит scripts/textbook-inventory/build-whitelist.mts (сверка формул учебников с каталогом по составу).
 */
import whitelist from './catalogWhitelist.json'
import rank from './catalogRank.json'
import { CATALOG_TOP200 } from '../catalog/catalogTop200'

/**
 * Вещества не из учебников, на которые опираются реактор и банк реакций (ClO₂-рецепт, реакции с KClO₄ и т. п.).
 * В данных остаются, в каталоге не показываются.
 */
export const CATALOG_HIDDEN_IDS: ReadonlySet<string> = new Set([
  'clo2',
  'salt_k_clo4',
  'salt_ba_mno4',
  'salt_ba_clo3',
  'salt_cu_cr2o7',
  'salt_fe3_s',
  'adamantane',
  'triacetin',
  // Упрощённая схема сахарозы с неполным составом (C₁₁H₁₂O₁₁ вместо C₁₂H₂₂O₁₁): в каталоге — полная модель
  // 'sucrose-structure' (Kimyo 10, гл. III); упрощённая остаётся в данных для просмотра в студии органики.
  'sucrose',
  // Гипотетические формулы из упражнений учебника (не выделены как индивидуальные вещества):
  // данные сохранены, в каталоге не показываем.
  'tb_i2o7',
  'tb_cl2o3',
  'tb_cl2o5',
  'tb_br2o7',
  'tb_h4v2o7',
  'tb_hgoh2',
  'tb_hg2o',
  'salt_al_co3',
  // Единичные упоминания вне программы (минералы-силикаты в таблицах, экзотика Sc/Ge/Xe/Pt/Bi/Cd, опечатки книги):
  // данные сохранены, в каталоге не показываем.
  'salt_cs_f',
  'salt_mg_sio3',
  'salt_ba_i',
  'salt_pb_co3',
  'salt_ni_f',
  'salt_al_cr2o7',
  'tb_si3n4',
  'tb_tic',
  'tb_au2o3',
  'tb_ticl4',
  'tb_h2b4o7',
  'tb_bh3',
  'tb_rbh',
  'tb_na2beo2',
  'tb_gecl4',
  'tb_geo2',
  'tb_clf3',
  'tb_xeo4',
  'tb_cacn2',
  'tb_k2sif6',
  'tb_sii4',
  'tb_ptno32',
  'tb_na2o_al2o3_6sio2',
  'tb_nanh2',
  'tb_cao_3mgo_4sio2',
  'tb_caso4_h2o',
  'tb_mgo_cao',
  'tb_na2o_al2o3_2sio2',
  'tb_k2o_2h2o_3al2o3_6sio2',
  'tb_alh3',
  'tb_k2so4_cr2so43_12h2o',
  'tb_nh42so4_cr2so43_6h2o',
  'tb_h2mno4',
  'tb_al2o3_3beo_6sio2',
  'tb_al4p2o73',
  'tb_sr3po42',
  'tb_bino33',
  'tb_cdno32',
  'tb_feco5',
  'tb_scoh3',
  'tb_sc2o3',
  // Органика из таблиц гомологов и единичных задач 10 класса (вне основной программы)
  'n-tridecane',
  'n-tetradecane',
  'n-hexadecane',
  'n-nonadecane',
  'n-pentacosane',
  'n-octacosane',
  'n-dotriacontane',
  'n-pentatriacontane',
  'n-octatriacontane',
  'cyclodecane',
  '4-ethyl-5-5-6-trimethylhept-2-yne',
  '6-ethyl-4-methyl-3-chlorononan-4-ol',
  '5-6-dimethyloctane-3-5-diol',
  'beta-carotene',
])

const TEXTBOOK_IDS: ReadonlySet<string> = new Set([...whitelist.inorganic, ...whitelist.organic])

/*
 * 30.09.2026: снова ровно 200 видимых неорганических (catalogTop200.ts) — решение владельца. Ниже — прежняя история:
 * правила «ровно 200 видимых неорганических» не было: каталог показывает каждое вещество из реакций учебников 7–11
 * (проверка — scripts/test-catalog-textbook-substances.mts). Из CATALOG_HIDDEN_IDS убраны вещества, которые стоят
 * в реакциях книг: Zn(OH)Cl и KHSO₃ (9 кл., гидролиз, с. 36), Fe₂(CO₃)₃ (9 кл., с. 37 — полный гидролиз),
 * FeN (9 кл., с. 159 — Fe + N₂), NOCl (11 кл., с. 120 — 2NO + Cl₂ ⇌ 2NOCl).
 */

/** Неорганические вещества каталога в порядке школьной значимости (scripts/textbook-inventory/rank-substances.mts --write). */
export const CATALOG_INORGANIC_RANK: readonly string[] = rank.rankedInorganic

const RANK_INDEX: ReadonlyMap<string, number> = new Map(CATALOG_INORGANIC_RANK.map((id, i) => [id, i]))

/** Место вещества в рейтинге школьной значимости (0 — самое важное); вне рейтинга — Infinity. */
export function catalogSchoolRank(id: string): number {
  return RANK_INDEX.get(id) ?? Number.POSITIVE_INFINITY
}

/** Вещество есть в учебниках (или нужно лаборатории) — остаётся в данных приложения. */
export function isTextbookCompoundId(id: string): boolean {
  return id.startsWith('tb_') || TEXTBOOK_IDS.has(id) || CATALOG_HIDDEN_IDS.has(id)
}

/** Все неорганические вещества рейтинга (439) — чтобы отличить неорганику от органики без импорта compounds (цикл). */
const RANKED_INORGANIC: ReadonlySet<string> = new Set(CATALOG_INORGANIC_RANK)

/**
 * Показывать ли вещество в каталоге и списках выбора. Неорганика — только 200 самых употребительных веществ
 * школьной химии (src/data/catalog/catalogTop200.ts, решение владельца 30.09.2026); органика — всё из учебников,
 * кроме CATALOG_HIDDEN_IDS. Скрытие не удаляет данные: compoundById, реактор и уравнения учебника видят вещество.
 */
export function isCatalogVisibleId(id: string): boolean {
  if (CATALOG_HIDDEN_IDS.has(id)) return false
  if (RANKED_INORGANIC.has(id)) return CATALOG_TOP200.has(id)
  return true
}
