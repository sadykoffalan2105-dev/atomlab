/**
 * «Учитель» для «Как образуется»: фразы для КАЖДОГО этапа КАЖДОГО из 200 веществ каталога на RU / EN / UZ — как
 * объясняет учитель по Kimyo 8 (§ 9–10 строение электронных слоёв, § 14 электроотрицательность, § 15 ковалентная
 * связь, § 16 ионная связь, § 17 кристаллические решётки). Фразы строятся из типа и пути образования
 * (formationScripts.ts — таблица docs/plans/formation200-rules.md), данных плана (formationPlan: частицы, заряды,
 * валентности, связи, форма) и «уникального момента» (special, перевод — formationTeacherSpecial.ts).
 *
 * Ничего не выдумывается: числа электронов и заряды берутся из плана, путь — из таблицы, особенность — из таблицы.
 */
import { formationPlan, isMetal, type FormationPlan, type FormationSpecies, type FormationShapeKey } from './formationPlan'
import { formationScript, type FormationRouteKind, type FormationScript } from './formationScripts'
import { formationSpecialRu, formationSpecialText } from './formationTeacherSpecial'

export type TeacherLang = 'ru' | 'en' | 'uz'
export type TeacherLines = { main: string; sub: string; ref: string }
/** «Доска» рядом с 3D: электронная и структурная формулы (ковалентные), схемы перехода e⁻ (ионные), тип решётки. */
export type TeacherBoard = { electron: string | null; structural: string | null; schemes: string[]; lattice: string }

type Tri = readonly [string, string, string]
const LI = { ru: 0, en: 1, uz: 2 } as const
const pick = (t: Tri, l: TeacherLang): string => t[LI[l]]

// ─── Справочные данные школьного курса ─────────────────────────────────────

/** Внешний энергетический уровень (Kimyo 8, § 9–10); у d-металлов в скобках — предвнешний d-подуровень. */
const OUTER: Record<string, string> = {
  H: '1s¹', Li: '2s¹', Be: '2s²', B: '2s²2p¹', C: '2s²2p²', N: '2s²2p³', O: '2s²2p⁴', F: '2s²2p⁵',
  Na: '3s¹', Mg: '3s²', Al: '3s²3p¹', Si: '3s²3p²', P: '3s²3p³', S: '3s²3p⁴', Cl: '3s²3p⁵',
  K: '4s¹', Ca: '4s²', Br: '4s²4p⁵', I: '5s²5p⁵', Ba: '6s²', Pb: '6s²6p²',
  Zn: '4s² (3d¹⁰)', Cu: '4s¹ (3d¹⁰)', Fe: '4s² (3d⁶)', Cr: '4s¹ (3d⁵)', Mn: '4s² (3d⁵)', V: '4s² (3d³)',
  Ag: '5s¹ (4d¹⁰)', Au: '6s¹ (5d¹⁰)', Hg: '6s² (5d¹⁰)',
}
/** Число электронов на внешнем уровне у элементов главных подгрупп (номер группы). */
const VAL_E: Record<string, number> = {
  H: 1, Li: 1, Na: 1, K: 1, Be: 2, Mg: 2, Ca: 2, Ba: 2, B: 3, Al: 3, C: 4, Si: 4, Pb: 4, N: 5, P: 5, O: 6, S: 6, F: 7, Cl: 7, Br: 7, I: 7,
  Zn: 2, Hg: 2, Ag: 1, Au: 1, Cu: 1,
}
/** Неспаренные e⁻ в основном состоянии. */
const UNPAIRED: Record<string, number> = { H: 1, B: 1, C: 2, Si: 2, N: 3, P: 3, O: 2, S: 2, F: 1, Cl: 1, Br: 1, I: 1 }
/** Электроотрицательность по Полингу (Kimyo 8, § 14, табл. 13) — для направления смещения пар. */
const EN: Record<string, number> = { H: 2.2, C: 2.55, N: 3.04, O: 3.44, F: 3.98, Si: 1.9, P: 2.19, S: 2.58, Cl: 3.16, Br: 2.96, I: 2.66, Mn: 1.55, Cr: 1.66, V: 1.63 }
const D_METALS = new Set(['Fe', 'Cu', 'Cr', 'Mn', 'V', 'Au'])

/** Ссылки на учебник. */
const REF = {
  e: ['Kimyo 8, § 9–10; § 14, табл. 13', 'Kimyo 8, §§ 9–10; § 14, table 13', 'Kimyo 8, 9–10-§; 14-§, 13-jadval'] as Tri,
  en: ['Kimyo 8, § 14, табл. 13', 'Kimyo 8, § 14, table 13', 'Kimyo 8, 14-§, 13-jadval'] as Tri,
  cov: ['Kimyo 8, § 15, с. 66–70', 'Kimyo 8, § 15, pp. 66–70', 'Kimyo 8, 15-§, 66–70-betlar'] as Tri,
  da: ['Kimyo 8, § 15, с. 69–70; § 37, с. 160', 'Kimyo 8, § 15, pp. 69–70; § 37, p. 160', 'Kimyo 8, 15-§, 69–70-betlar; 37-§, 160-bet'] as Tri,
  ion: ['Kimyo 8, § 16, с. 71–73', 'Kimyo 8, § 16, pp. 71–73', 'Kimyo 8, 16-§, 71–73-betlar'] as Tri,
  lat: ['Kimyo 8, § 17, с. 73–76', 'Kimyo 8, § 17, pp. 73–76', 'Kimyo 8, 17-§, 73–76-betlar'] as Tri,
  nacl: ['Kimyo 8, § 17, с. 73–76, рис. 13', 'Kimyo 8, § 17, pp. 73–76, fig. 13', 'Kimyo 8, 17-§, 73–76-betlar, 13-rasm'] as Tri,
  geo: ['Kimyo 9, § 2, с. 16–18', 'Kimyo 9, § 2, pp. 16–18', 'Kimyo 9, 2-§, 16–18-betlar'] as Tri,
}

/** Вид пути образования (подпись в блоке уравнения). */
const KIND: Record<FormationRouteKind | 'dimerization' | 'amphoteric', Tri> = {
  elements: ['из простых веществ', 'from simple substances', 'oddiy moddalardan'],
  atoms: ['из атомов', 'from atoms', 'atomlardan'],
  neutralization: ['нейтрализация', 'neutralisation', 'neytrallanish'],
  oxideWater: ['присоединение воды', 'addition of water', 'suv biriktirish'],
  oxideAcid: ['оксид + кислота', 'oxide + acid', 'oksid + kislota'],
  baseAcidOxide: ['основание (оксид) + кислотный оксид', 'base (oxide) + acidic oxide', 'asos (oksid) + kislotali oksid'],
  exchange: ['реакция обмена', 'exchange reaction', 'almashinish reaksiyasi'],
  decomposition: ['разложение', 'decomposition', 'parchalanish'],
  redox: ['окислительно-восстановительная реакция', 'redox reaction', 'oksidlanish-qaytarilish reaksiyasi'],
  hydration: ['гидратация (присоединение кристаллизационной воды)', 'hydration (water of crystallisation)', 'gidratlanish (kristallizatsiya suvi birikadi)'],
  mixture: ['совместная кристаллизация двух солей', 'two salts crystallising together', 'ikki tuzning birga kristallanishi'],
  protonTransfer: ['перенос протона H⁺', 'proton (H⁺) transfer', 'proton (H⁺) oʻtishi'],
  dehydration: ['отщепление воды', 'loss of water', 'suv ajralishi'],
  dimerization: ['соединение двух молекул (димеризация)', 'two molecules join (dimerisation)', 'ikki molekula birikadi (dimerlanish)'],
  amphoteric: ['амфотерный гидроксид + щёлочь', 'amphoteric hydroxide + alkali', 'amfoter gidroksid + ishqor'],
}
/** Что происходит на уровне частиц при таком пути (одна фраза). */
const KIND_MOMENT: Record<keyof typeof KIND, Tri> = {
  elements: ['Вещество получают прямо из простых веществ: их связи рвутся, атомы соединяются по-новому.', 'The substance is made directly from simple substances: their bonds break and the atoms join in a new way.', 'Modda bevosita oddiy moddalardan olinadi: ularning bogʻlari uziladi, atomlar yangicha birikadi.'],
  atoms: ['Простое вещество: атомы одного элемента соединяются общими электронными парами.', 'A simple substance: atoms of one element join through shared electron pairs.', 'Oddiy modda: bir element atomlari umumiy elektron juftlar orqali birikadi.'],
  neutralization: ['Кислота даёт ионы H⁺, основание — OH⁻: H⁺ + OH⁻ → H₂O. Ионы металла и кислотного остатка остаются — это соль.', 'The acid gives H⁺ ions, the base gives OH⁻: H⁺ + OH⁻ → H₂O. The metal ions and the acid-residue ions remain — that is the salt.', 'Kislota H⁺ ionlarini, asos OH⁻ ionlarini beradi: H⁺ + OH⁻ → H₂O. Metall ionlari va kislota qoldigʻi ionlari qoladi — bu tuz.'],
  oxideWater: ['Молекула воды присоединяется: неподелённая пара атома O воды переходит к атому оксида, H⁺ — к кислороду.', 'A water molecule adds on: a lone pair of the water O atom goes to the oxide atom, and H⁺ moves to oxygen.', 'Suv molekulasi birikadi: suv O atomining taqsimlanmagan elektron jufti oksid atomiga oʻtadi, H⁺ esa kislorodga.'],
  oxideAcid: ['Оксид-ион O²⁻ забирает два иона H⁺ кислоты: O²⁻ + 2H⁺ → H₂O; катион металла переходит в соль.', 'The oxide ion O²⁻ takes two H⁺ ions from the acid: O²⁻ + 2H⁺ → H₂O; the metal cation passes into the salt.', 'Oksid-ion O²⁻ kislotaning ikkita H⁺ ionini oladi: O²⁻ + 2H⁺ → H₂O; metall kationi tuzga oʻtadi.'],
  baseAcidOxide: ['Ион O²⁻ (или OH⁻) отдаёт неподелённую пару атому неметалла кислотного оксида — так образуется кислотный остаток.', 'The O²⁻ (or OH⁻) ion gives its lone pair to the non-metal atom of the acidic oxide — this is how the acid residue forms.', 'O²⁻ (yoki OH⁻) ioni taqsimlanmagan elektron juftini kislotali oksidning metallmas atomiga beradi — kislota qoldigʻi shunday hosil boʻladi.'],
  exchange: ['Ионы встречаются в растворе и обмениваются партнёрами; реакция идёт, если уходит осадок, газ или вода.', 'Ions meet in solution and swap partners; the reaction goes if a precipitate, a gas or water leaves.', 'Ionlar eritmada uchrashib, sheriklarini almashtiradi; choʻkma, gaz yoki suv chiqsa, reaksiya boradi.'],
  decomposition: ['При нагревании сложная частица распадается: отщепляется O₂, CO₂ или H₂O, остаётся нужное вещество.', 'On heating a complex particle breaks up: O₂, CO₂ or H₂O splits off and the substance remains.', 'Qizdirilganda murakkab zarracha parchalanadi: O₂, CO₂ yoki H₂O ajraladi, kerakli modda qoladi.'],
  redox: ['Атомы меняют степени окисления: одни отдают электроны, другие принимают — отдано e⁻ = принято e⁻.', 'Atoms change oxidation states: some give electrons, others accept them — electrons given = electrons accepted.', 'Atomlar oksidlanish darajasini oʻzgartiradi: biri elektron beradi, boshqasi qabul qiladi — berilgan e⁻ = qabul qilingan e⁻.'],
  hydration: ['Молекулы воды (уголок, диполь) поворачиваются атомом O к катиону и встраиваются в кристалл соли.', 'Water molecules (bent, a dipole) turn their O atom towards the cation and build into the salt crystal.', 'Suv molekulalari (burchakli, dipol) O atomi bilan kationga burilib, tuz kristaliga joylashadi.'],
  mixture: ['Две соли кристаллизуются рядом: в каждой своя ионная решётка, общего соединения нет.', 'Two salts crystallise side by side: each has its own ionic lattice, there is no single compound.', 'Ikki tuz yonma-yon kristallanadi: har birining oʻz ion panjarasi bor, yagona birikma yoʻq.'],
  protonTransfer: ['Ион H⁺ переходит к неподелённой паре атома (у аммиака — N): возникает донорно-акцепторная связь.', 'An H⁺ ion moves to an atom’s lone pair (in ammonia — N): a donor–acceptor bond forms.', 'H⁺ ioni atomning taqsimlanmagan elektron juftiga (ammiakda — N) oʻtadi: donor-akseptor bogʻ hosil boʻladi.'],
  dehydration: ['Отщепляется вода: две группы O–H дают H₂O, а между атомами остаётся мостик –O–.', 'Water splits off: two O–H groups give H₂O and an –O– bridge remains between the atoms.', 'Suv ajraladi: ikkita O–H guruhi H₂O beradi, atomlar orasida –O– koʻprigi qoladi.'],
  dimerization: ['Две молекулы объединяют свои неспаренные электроны в общую пару — возникает новая связь.', 'Two molecules pair up their unpaired electrons into a shared pair — a new bond forms.', 'Ikki molekula juftlashmagan elektronlarini umumiy juftga birlashtiradi — yangi bogʻ hosil boʻladi.'],
  amphoteric: ['Амфотерный гидроксид реагирует со щёлочью: ионы OH⁻ отдают пары иону металла — образуется комплексный ион.', 'The amphoteric hydroxide reacts with alkali: OH⁻ ions give pairs to the metal ion — a complex ion forms.', 'Amfoter gidroksid ishqor bilan reaksiyaga kirishadi: OH⁻ ionlari metall ioniga juft beradi — kompleks ion hosil boʻladi.'],
}
/** Где вид пути из таблицы требует уточнения в подписи. */
const KIND_LABEL_OVERRIDE: Record<string, keyof typeof KIND> = { tb_n2o4: 'dimerization', tb_na2znoh4: 'amphoteric' }

export function routeKindKey(id: string): keyof typeof KIND | null {
  const s = formationScript(id)
  if (!s) return null
  return KIND_LABEL_OVERRIDE[id] ?? s.routeKind
}
export function routeKindLabel(id: string, lang: TeacherLang): string {
  const k = routeKindKey(id)
  return k ? pick(KIND[k], lang) : ''
}

/** Электронная (точки — общие пары) и структурная формулы ковалентных частиц (школьная запись, § 15). */
const FORMULAS: Record<string, readonly [string | null, string]> = {
  tb_h2: ['H:H', 'H–H'], tb_cl2: ['Cl:Cl', 'Cl–Cl'], tb_f2: ['F:F', 'F–F'], tb_br2: ['Br:Br', 'Br–Br'], tb_i2: ['I:I', 'I–I'],
  tb_o2: ['O::O', 'O=O'], tb_n2: ['N⋮⋮N', 'N≡N'], tb_o3: ['O::O:O', 'O=O→O'], tb_p4: [null, 'P₄ (6 × P–P)'], tb_s8: [null, 'S₈ (8 × S–S)'],
  co2: ['O::C::O', 'O=C=O'], hcl: ['H:Cl', 'H–Cl'], hbr: ['H:Br', 'H–Br'], hi: ['H:I', 'H–I'], hf: ['H:F', 'H–F'],
  h2o: ['H:O:H', 'H–O–H'], h2s: ['H:S:H', 'H–S–H'], nh3: ['H:N(:H):H', 'H–N(–H)–H'], tb_ph3: ['H:P(:H):H', 'H–P(–H)–H'],
  tb_sih4: ['H:Si(:H)(:H):H', 'H–Si(–H)(–H)–H'], tb_sif4: ['F:Si(:F)(:F):F', 'F–Si(–F)(–F)–F'], tb_cs2: ['S::C::S', 'S=C=S'],
  co: ['C⋮⋮O', 'C≡O'], so2: ['O::S::O', 'O=S=O'], so3: [null, 'O=S(=O)=O'], no: ['N::O', '·N=O'], no2: [null, 'O=N–O·'],
  h2so4: [null, 'H–O–S(=O)₂–O–H'], h2so3: [null, '(H–O)₂S=O'], hno3: [null, 'H–O–N(=O)→O'], hno2: ['H:O:N::O', 'H–O–N=O'],
  h3po4: [null, '(H–O)₃P=O'], h2co3: [null, '(H–O)₂C=O'], h2o2: ['H:O:O:H', 'H–O–O–H'], hclo: ['H:O:Cl', 'H–O–Cl'],
  hclo3: [null, 'H–O–Cl(=O)₂'], hclo4: [null, 'H–O–Cl(=O)₃'], hmno4: [null, 'H–O–Mn(=O)₃'],
  tb_cl2o7: [null, 'O₃Cl–O–ClO₃'], tb_mn2o7: [null, 'O₃Mn–O–MnO₃'], n2o5: [null, 'O₂N–O–NO₂'], n2o: [null, 'N≡N→O'],
  tb_n2o3: [null, 'O=N–NO₂'], tb_n2o4: [null, 'O₂N–NO₂'], p2o5: [null, 'P₄O₁₀: 4 P=O + 6 P–O–P'], tb_p4o10: [null, 'P₄O₁₀: 4 P=O + 6 P–O–P'],
  tb_h4p2o7: [null, '(HO)₂P(=O)–O–P(=O)(OH)₂'], nh3_h2o: [null, 'H₃N···H–O–H'],
  sio2: [null, '≡Si–O–Si≡'], cro3: [null, '–O–CrO₂–O–CrO₂–'], tb_v2o5: [null, 'V=O, V–O–V'], h2sio3: [null, '(H–O)₂Si=O → (–O–Si(OH)₂–)ₙ'],
  tb_hpo3: [null, '(–O–P(=O)(OH)–)ₙ'],
}

/** Школьная формула многоатомного иона: центр, связи и откуда заряд (Kimyo 8, § 15–16). */
const POLY: Record<string, { c: string; tri: Tri }> = {
  'OH⁻': { c: 'O', tri: ['O–H (ковалентная полярная)', 'O–H (polar covalent)', 'O–H (kovalent qutbli)'] },
  'SO₄²⁻': { c: 'S', tri: ['центр S, две S=O, две S–O', 'central S, two S=O, two S–O', 'markazda S, ikkita S=O, ikkita S–O'] },
  'HSO₄⁻': { c: 'S', tri: ['центр S, две S=O, одна S–O, одна S–O–H', 'central S, two S=O, one S–O, one S–O–H', 'markazda S, ikkita S=O, bitta S–O, bitta S–O–H'] },
  'SO₃²⁻': { c: 'S', tri: ['центр S с неподелённой парой, одна S=O, две S–O', 'central S with a lone pair, one S=O, two S–O', 'markazda taqsimlanmagan juftli S, bitta S=O, ikkita S–O'] },
  'CO₃²⁻': { c: 'C', tri: ['центр C, одна C=O, две C–O', 'central C, one C=O, two C–O', 'markazda C, bitta C=O, ikkita C–O'] },
  'HCO₃⁻': { c: 'C', tri: ['центр C, одна C=O, одна C–O, одна C–O–H', 'central C, one C=O, one C–O, one C–O–H', 'markazda C, bitta C=O, bitta C–O, bitta C–O–H'] },
  'NO₃⁻': { c: 'N', tri: ['центр N, одна N=O, одна N–O, одна N→O', 'central N, one N=O, one N–O, one N→O', 'markazda N, bitta N=O, bitta N–O, bitta N→O'] },
  'NO₂⁻': { c: 'N', tri: ['центр N с неподелённой парой, одна N=O, одна N–O', 'central N with a lone pair, one N=O, one N–O', 'markazda taqsimlanmagan juftli N, bitta N=O, bitta N–O'] },
  'PO₄³⁻': { c: 'P', tri: ['центр P, одна P=O, три P–O', 'central P, one P=O, three P–O', 'markazda P, bitta P=O, uchta P–O'] },
  'HPO₄²⁻': { c: 'P', tri: ['центр P, одна P=O, две P–O, одна P–O–H', 'central P, one P=O, two P–O, one P–O–H', 'markazda P, bitta P=O, ikkita P–O, bitta P–O–H'] },
  'H₂PO₄⁻': { c: 'P', tri: ['центр P, одна P=O, одна P–O, две P–O–H', 'central P, one P=O, one P–O, two P–O–H', 'markazda P, bitta P=O, bitta P–O, ikkita P–O–H'] },
  'SiO₃²⁻': { c: 'Si', tri: ['цепь тетраэдров SiO₄ с общими вершинами (мостики Si–O–Si), у каждого Si две Si–O', 'a chain of SiO₄ tetrahedra sharing corners (Si–O–Si bridges), each Si with two Si–O', 'umumiy uchli SiO₄ tetraedrlari zanjiri (Si–O–Si koʻpriklari), har bir Si da ikkita Si–O'] },
  'MnO₄⁻': { c: 'Mn', tri: ['центр Mn (+7), три Mn=O, одна Mn–O', 'central Mn (+7), three Mn=O, one Mn–O', 'markazda Mn (+7), uchta Mn=O, bitta Mn–O'] },
  'MnO₄²⁻': { c: 'Mn', tri: ['центр Mn (+6), две Mn=O, две Mn–O', 'central Mn (+6), two Mn=O, two Mn–O', 'markazda Mn (+6), ikkita Mn=O, ikkita Mn–O'] },
  'CrO₄²⁻': { c: 'Cr', tri: ['центр Cr (+6), две Cr=O, две Cr–O', 'central Cr (+6), two Cr=O, two Cr–O', 'markazda Cr (+6), ikkita Cr=O, ikkita Cr–O'] },
  'Cr₂O₇²⁻': { c: 'Cr', tri: ['два тетраэдра CrO₄ с общим O (мостик Cr–O–Cr), у каждого Cr две Cr=O и одна Cr–O', 'two CrO₄ tetrahedra sharing an O (Cr–O–Cr bridge), each Cr with two Cr=O and one Cr–O', 'umumiy O li ikkita CrO₄ tetraedri (Cr–O–Cr koʻprigi), har bir Cr da ikkita Cr=O va bitta Cr–O'] },
  'ClO₃⁻': { c: 'Cl', tri: ['центр Cl (+5) с неподелённой парой, две Cl=O, одна Cl–O', 'central Cl (+5) with a lone pair, two Cl=O, one Cl–O', 'markazda taqsimlanmagan juftli Cl (+5), ikkita Cl=O, bitta Cl–O'] },
  'ClO₂⁻': { c: 'Cl', tri: ['центр Cl (+3), одна Cl=O, одна Cl–O; уголок', 'central Cl (+3), one Cl=O, one Cl–O; bent', 'markazda Cl (+3), bitta Cl=O, bitta Cl–O; burchakli'] },
  'ClO⁻': { c: 'Cl', tri: ['Cl–O одинарная, Cl (+1)', 'single Cl–O, Cl (+1)', 'oddiy Cl–O, Cl (+1)'] },
  'AlO₂⁻': { c: 'Al', tri: ['в кристалле — каркас тетраэдров AlO₄; в растворе — [Al(OH)₄]⁻', 'in the crystal — a framework of AlO₄ tetrahedra; in solution — [Al(OH)₄]⁻', 'kristallda — AlO₄ tetraedrlari karkasi; eritmada — [Al(OH)₄]⁻'] },
  'ZnO₂²⁻': { c: 'Zn', tri: ['обобщённая схема; в растворе — [Zn(OH)₄]²⁻', 'a generalised scheme; in solution — [Zn(OH)₄]²⁻', 'umumlashgan sxema; eritmada — [Zn(OH)₄]²⁻'] },
  '[Zn(OH)₄]²⁻': { c: 'Zn', tri: ['Zn²⁺ в центре тетраэдра, четыре OH⁻ дают пары (донорно-акцепторные связи)', 'Zn²⁺ in the centre of a tetrahedron, four OH⁻ give pairs (donor–acceptor bonds)', 'Zn²⁺ tetraedr markazida, toʻrtta OH⁻ juft beradi (donor-akseptor bogʻlar)'] },
  'O₂²⁻': { c: 'O', tri: ['пероксид-ион: связь O–O сохраняется (одинарная, неполярная)', 'peroxide ion: the O–O bond stays (single, non-polar)', 'peroksid-ion: O–O bogʻi saqlanadi (oddiy, qutbsiz)'] },
  'O₂⁻': { c: 'O', tri: ['надпероксид-ион: O–O и один лишний e⁻ на два атома (нечётный)', 'superoxide ion: O–O plus one extra e⁻ on two atoms (odd)', 'superoksid-ion: O–O va ikki atomga bitta ortiqcha e⁻ (toq)'] },
  'S₂²⁻': { c: 'S', tri: ['дисульфид-ион [S–S]²⁻: одинарная S–S', 'disulfide ion [S–S]²⁻: a single S–S', 'disulfid-ion [S–S]²⁻: oddiy S–S'] },
  'C₂²⁻': { c: 'C', tri: ['ацетиленид-ион [C≡C]²⁻: тройная связь', 'acetylide ion [C≡C]²⁻: a triple bond', 'atsetilenid-ion [C≡C]²⁻: uchlamchi bogʻ'] },
  'NH₄⁺': { c: 'N', tri: ['NH₃ + H⁺ → NH₄⁺: неподелённая пара N → H⁺ (донорно-акцепторная), тетраэдр', 'NH₃ + H⁺ → NH₄⁺: the lone pair of N → H⁺ (donor–acceptor), a tetrahedron', 'NH₃ + H⁺ → NH₄⁺: N ning taqsimlanmagan jufti → H⁺ (donor-akseptor), tetraedr'] },
}

const SHAPE: Partial<Record<FormationShapeKey, Tri>> = {
  linear: ['линейная', 'linear', 'chiziqli'],
  angular: ['угловая (уголок)', 'bent (angular)', 'burchakli'],
  'trigonal-planar': ['плоский треугольник', 'trigonal planar', 'yassi uchburchak'],
  'trigonal-pyramidal': ['треугольная пирамида', 'trigonal pyramid', 'uchburchakli piramida'],
  tetrahedral: ['тетраэдр', 'tetrahedron', 'tetraedr'],
  octahedral: ['октаэдр', 'octahedron', 'oktaedr'],
  ring: ['кольцо-корона', 'crown-shaped ring', 'toj shaklidagi halqa'],
  'tetrahedron-p4': ['тетраэдр из четырёх атомов P', 'tetrahedron of four P atoms', 'toʻrtta P atomidan tetraedr'],
  'atomic-lattice': ['атомный каркас', 'covalent network', 'atom karkas'],
  polymeric: ['цепи (слои) — полимер', 'chains (layers) — a polymer', 'zanjirlar (qatlamlar) — polimer'],
  p4o10: ['молекула P₄O₁₀', 'P₄O₁₀ molecule', 'P₄O₁₀ molekulasi'],
}
const ANGLE: Record<string, string> = {
  h2o: '104,5°', h2s: '92°', nh3: '107°', tb_ph3: '93,5°', so2: '119°', tb_o3: '117°', no2: '134°', co2: '180°', tb_cs2: '180°', n2o: '180°',
  so3: '120°', hno3: '120°', tb_sih4: '109,5°', tb_sif4: '109,5°', tb_p4: '60°', h2o2: '~95° (O–O–H)',
}

// ─── Помощники ─────────────────────────────────────────────────────────────

const num = (x: number, l: TeacherLang): string => (l === 'en' ? x.toFixed(2) : x.toFixed(2).replace('.', ','))
const elOf = (sp: FormationSpecies): string => Object.keys(sp.comp)[0] ?? sp.formula
const stripCharge = (f: string): string => f.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+$/, '')
/** У металла в этом веществе есть ковалентная доля связи (Kimyo 8 § 16 — честная подпись). */
const COVALENT_SHARE_IDS = new Set(['salt_al_cl', 'salt_fe3_cl', 'tb_aucl3', 'salt_cu_s', 'salt_zn_s', 'tb_hgo', 'tb_beo', 'tb_al4c3', 'fes2'])

type Ctx = { id: string; s: FormationScript; p: FormationPlan | null; ionic: boolean }
const cache = new Map<string, Ctx | null>()
function ctx(id: string): Ctx | null {
  if (cache.has(id)) return cache.get(id)!
  const s = formationScript(id)
  let c: Ctx | null = null
  if (s) {
    const p = formationPlan(id)
    c = { id, s, p, ionic: s.type === 'IB' || s.type === 'IC' || s.type === 'IH' }
  }
  cache.set(id, c)
  return c
}

/** Катионы металлов (без NH₄⁺) и все анионы плана. */
function ions(c: Ctx) {
  const sp = c.p?.species ?? []
  const metalCations = sp.filter((x) => x.charge > 0 && x.kind === 'ion' && isMetal(elOf(x)))
  const nh4 = sp.filter((x) => x.charge > 0 && x.kind === 'polyion')
  const anions = sp.filter((x) => x.charge < 0)
  const water = sp.find((x) => x.kind === 'molecule')
  const given = metalCations.reduce((a, x) => a + x.charge * x.count, 0)
  const taken = anions.reduce((a, x) => a + -x.charge * x.count, 0)
  return { metalCations, nh4, anions, water, given, taken }
}

/** Схемы перехода e⁻ в стиле учебника: «Na⁰ − 1e⁻ → Na⁺», «Cl⁰ + 1e⁻ → Cl⁻», «SO₄: … ; 2e⁻ от металла». */
export function transferSchemes(id: string, lang: TeacherLang): string[] {
  const c = ctx(id)
  if (!c || !c.ionic || !c.p) return []
  const { metalCations, nh4, anions } = ions(c)
  const out: string[] = []
  for (const m of metalCations) out.push(`${elOf(m)}⁰ − ${m.charge}e⁻ → ${m.formula}`)
  for (const n of nh4) out.push(n.formula === 'NH₄⁺' ? 'NH₃ + H⁺ → NH₄⁺' : n.formula)
  for (const a of anions) {
    const q = -a.charge
    if (a.kind === 'ion' && !metalCations.length) out.push(`H${elOf(a)} → H⁺ + ${a.formula}`)
    else if (a.kind === 'ion') out.push(`${elOf(a)}⁰ + ${q}e⁻ → ${a.formula}`)
    else {
      const poly = POLY[a.formula]
      const from = metalCations.length ? pick([`${q}e⁻ от металла`, `${q}e⁻ from the metal`, `${q}e⁻ metalldan`], lang) : pick([`заряд ${q}− от ушедших H⁺`, `charge ${q}− left by the H⁺ that moved away`, `${q}− zaryad ketgan H⁺ dan`], lang)
      out.push(`${stripCharge(a.formula)}: ${poly ? pick(poly.tri, lang) : a.formula}; ${from}`)
    }
  }
  return out
}

function valenceLine(el: string, l: TeacherLang): string {
  const cfg = OUTER[el]
  const n = VAL_E[el]
  if (n !== undefined && !D_METALS.has(el)) return `${el} ${cfg ?? ''}: ${n} e⁻`.replace('  ', ' ')
  return `${el} ${cfg ?? ''}`.trim() + pick([' (d-металл)', ' (d-metal)', ' (d-metall)'], l)
}

/** Возбуждение центрального атома (C, Si, S, P, Cl …): валентность больше числа неспаренных e⁻ в основном состоянии. */
function excitation(p: FormationPlan): { el: string; v: number } | null {
  for (const sp of p.species) {
    const el = elOf(sp)
    const v = Math.max(...(sp.valences ?? [0]))
    const u = UNPAIRED[el]
    // возбуждение распаривает пары: неспаренных становится больше на 2, 4 … (C: 2 → 4; S: 2 → 4, 6; P: 3 → 5; Cl: 1 → 3, 5, 7).
    // Валентность III у C в CO — не возбуждение, а донорно-акцепторная связь.
    if (u !== undefined && el !== 'N' && el !== 'O' && v > u && (v - u) % 2 === 0) return { el, v }
  }
  return null
}

function bondsLine(p: FormationPlan | null): string {
  if (!p) return ''
  return p.bondKinds.map((b) => `${b.label} ×${b.count}`).join(' · ')
}

/** Пары смещены к более электроотрицательному атому: «S–O: к O» …, без дублей. */
function shiftLine(p: FormationPlan | null, l: TeacherLang): string {
  if (!p) return ''
  const seen = new Set<string>()
  const parts: string[] = []
  for (const b of p.bondKinds) {
    const m = /^([A-Z][a-z]?)[–=≡]([A-Z][a-z]?)$/.exec(b.label)
    if (!m) continue
    const [, a, z] = m as unknown as [string, string, string]
    if (a === z) continue
    const ea = EN[a]
    const ez = EN[z]
    if (ea === undefined || ez === undefined) continue
    const to = ea > ez ? a : z
    const key = [a, z].sort().join('')
    if (seen.has(key)) continue
    seen.add(key)
    parts.push(`${a}–${z} → ${to}`)
  }
  if (!parts.length) return ''
  return pick([`Пары смещены к более электроотрицательному атому (δ−): ${parts.join(', ')}.`, `The pairs are shifted towards the more electronegative atom (δ−): ${parts.join(', ')}.`, `Juftlar elektromanfiyroq atom tomon siljigan (δ−): ${parts.join(', ')}.`], l)
}

function covalentNote(c: Ctx, l: TeacherLang): string {
  if (c.s.type !== 'IB' && !COVALENT_SHARE_IDS.has(c.id)) return ''
  const hydride = (c.p?.species ?? []).some((x) => x.formula === 'H⁻')
  if (hydride) return ''
  if (!(c.s.dEN < 1.5 || COVALENT_SHARE_IDS.has(c.id))) return ''
  return pick([' Честно: связь ионная с заметной долей ковалентности (ΔЭО невелика, ион металла сильно притягивает электроны аниона).', ' To be honest: the bond is ionic with a noticeable covalent share (small ΔEN, the metal ion strongly pulls the anion’s electrons).', ' Rostini aytganda: bogʻ ion bogʻ, lekin sezilarli kovalent ulushi bor (ΔEM kichik, metall ioni anion elektronlarini kuchli tortadi).'], l)
}

function latticeHead(c: Ctx, l: TeacherLang): string {
  const t = c.s.type
  if (c.id === 'tb_kcl_nacl') return pick(['Две ионные кристаллические решётки рядом', 'Two ionic crystal lattices side by side', 'Yonma-yon ikki ion kristall panjara'], l)
  if (t === 'IB' || t === 'IC' || t === 'IH') return pick(['Ионная кристаллическая решётка', 'Ionic crystal lattice', 'Ion kristall panjara'], l)
  if (t === 'N') return pick(['Атомная кристаллическая решётка', 'Atomic (covalent) crystal lattice', 'Atom kristall panjara'], l)
  if (t === 'PM') return pick(['Полимер: цепи / слои', 'Polymer: chains / layers', 'Polimer: zanjirlar / qatlamlar'], l)
  if (c.s.latticeKind === 'molecular') return pick(['Молекулярная кристаллическая решётка', 'Molecular crystal lattice', 'Molekulyar kristall panjara'], l)
  return pick(['Решётки нет — свободные молекулы', 'No lattice — free molecules', 'Panjara yoʻq — erkin molekulalar'], l)
}

/** Структурный тип решётки по таблице — имена минералов / типов одинаковы на трёх языках (кроме окончаний). */
const LATTICE_TYPES: [RegExp, Tri][] = [
  [/антифлюорит/, ['типа антифлюорита', 'antifluorite type', 'antiflyuorit tipidagi']],
  [/CsCl/, ['типа CsCl', 'CsCl type', 'CsCl tipidagi']],
  [/NaCl/, ['типа NaCl', 'NaCl type', 'NaCl tipidagi']],
  [/сфалерит|типа ZnS/, ['типа сфалерита (ZnS)', 'sphalerite (ZnS) type', 'sfalerit (ZnS) tipidagi']],
  [/вюрцит/, ['типа вюрцита', 'wurtzite type', 'vyursit tipidagi']],
  [/корунд/, ['типа корунда', 'corundum type', 'korund tipidagi']],
  [/рутил/, ['типа рутила', 'rutile type', 'rutil tipidagi']],
  [/шпинель/, ['шпинель', 'spinel', 'shpinel']],
  [/куприт/, ['типа куприта', 'cuprite type', 'kuprit tipidagi']],
  [/тенорит/, ['тенорит', 'tenorite', 'tenorit']],
  [/NiAs|троилит/, ['типа NiAs (троилит)', 'NiAs (troilite) type', 'NiAs (troilit) tipidagi']],
  [/CdCl₂/, ['слоистая, типа CdCl₂', 'layered, CdCl₂ type', 'qatlamli, CdCl₂ tipidagi']],
  [/CdI₂/, ['слоистая, типа CdI₂', 'layered, CdI₂ type', 'qatlamli, CdI₂ tipidagi']],
  [/кальцит/, ['кальцит', 'calcite', 'kalsit']],
  [/барит/, ['барит', 'barite', 'barit']],
  [/глёт/, ['глёт (слои)', 'litharge (layers)', 'glyot (qatlamlar)']],
  [/Au₂Cl₆/, ['димеры Au₂Cl₆', 'Au₂Cl₆ dimers', 'Au₂Cl₆ dimerlari']],
  [/зигзаг/, ['зигзаг-цепи –Hg–O–', 'zigzag –Hg–O– chains', '–Hg–O– zigzag zanjirlari']],
  [/слоист/, ['слоистая', 'layered', 'qatlamli']],
  [/котуннит|PbCl₂/, ['типа PbCl₂ (котуннит)', 'PbCl₂ (cotunnite) type', 'PbCl₂ (kotunnit) tipidagi']],
  [/биксбиит/, ['биксбиит', 'bixbyite', 'biksbiit']],
  [/цепи CuCl₄/, ['цепи CuCl₄', 'CuCl₄ chains', 'CuCl₄ zanjirlari']],
]
function latticeType(c: Ctx, l: TeacherLang): string {
  for (const [re, t] of LATTICE_TYPES) if (re.test(c.s.lattice)) return pick(t, l)
  if (c.s.latticeKind === 'schema') return pick(['обобщённый фрагмент (структурный тип не называем)', 'a generalised fragment (structure type not named)', 'umumlashgan boʻlak (struktura tipi aytilmaydi)'], l)
  return ''
}
/** Координация «6:6», «Na⁺ 4, S²⁻ 8», «Al³⁺ 6, O²⁻ 4» из столбца «Итог». */
function coordination(c: Ctx): string {
  const m = /(\d+)\s*:\s*(\d+)/.exec(c.s.lattice)
  if (m) return `${m[1]}:${m[2]}`
  const pairs = [...c.s.lattice.matchAll(/([A-Z][a-z]?[⁰¹²³⁴⁵⁶⁷⁸⁹]*[⁺⁻])\s*(\d+)/g)].map((x) => `${x[1]} ${x[2]}`)
  return pairs.join(', ')
}

/** Особенность из таблицы написана как заметка для анимации («показать …», «сказать честно», «генератор есть») — учителю нужен сам факт. */
function cleanRu(t: string): string {
  return t
    .replace(/\s*\((?:исправлено 03\.10:[^)]*)\)/g, '')
    .replace(/\s*\((?:показать|сказать|сказать честно|сказать честно одной строкой|одна фраза|генератор[^)]*)\)/g, '')
    .replace(/\s*—\s*(?:показать|одна фраза|связать с)[^;.]*/g, '')
    .replace(/;\s*(?:показать|связать с)[^;.]*/g, '')
    .replace(/\s*\(генератор[^)]*\)/g, '')
    .replace(/,\s*генератор[^)]*/g, '')
    .replace(/,\s*сказать\s+/g, ': ')
    .replace(/\s*—\s*сказать\)/g, ')')
    .replace(/\s*Этапы:.*$/, '')
    .replace(/(^|[\s(:;])показать\s+/g, '$1')
    .replace(/,?\s*сказать честно одной строкой/g, '')
    .replace(/сказать честно/g, 'честно')
    .replace(/^ЭТАЛОН:\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function formationTeacherSpecial(id: string, lang: TeacherLang): string {
  const c = ctx(id)
  if (!c) return ''
  return lang === 'ru' ? (formationSpecialRu(id) ?? cleanRu(c.s.special)) : (formationSpecialText(id, lang) ?? '')
}

/** Главная ссылка для вещества (по типу). */
export function formationTeacherRef(id: string, lang: TeacherLang): string {
  const c = ctx(id)
  if (!c) return ''
  return pick(c.ionic ? REF.ion : c.s.type === 'N' || c.s.type === 'PM' ? REF.lat : REF.cov, lang)
}

export function formationTeacherBoard(id: string, lang: TeacherLang): TeacherBoard | null {
  const c = ctx(id)
  if (!c) return null
  const f = FORMULAS[id]
  return {
    electron: f?.[0] ?? null,
    structural: f?.[1] ?? null,
    schemes: transferSchemes(id, lang),
    lattice: [latticeHead(c, lang), latticeType(c, lang), coordination(c)].filter(Boolean).join(' · '),
  }
}

// ─── Фразы этапов ──────────────────────────────────────────────────────────

const STAGE_KEYS = ['reagents', 'break', 'approach', 'valence', 'inner', 'transfer', 'pairs', 'bonds', 'assemble', 'lattice', 'final'] as const

function reagentsLines(c: Ctx, l: TeacherLang): TeacherLines {
  const k = routeKindKey(c.id)!
  const F = c.s.formula
  const metals = (c.p?.species ?? []).filter((x) => x.charge > 0 && isMetal(elOf(x))).map(elOf)
  if (c.s.direct) {
    const metalNote = metals.length
      ? pick([` Металл (${[...new Set(metals)].join(', ')}) — атомы в металлической решётке: катионы и «электронный газ».`, ` The metal (${[...new Set(metals)].join(', ')}) is atoms in a metallic lattice: cations and an “electron gas”.`, ` Metall (${[...new Set(metals)].join(', ')}) — metall panjaradagi atomlar: kationlar va «elektron gaz».`], l)
      : ''
    return {
      main: c.s.route,
      sub: `${pick(KIND_MOMENT[k], l)}${metalNote}`,
      ref: pick(c.ionic ? REF.ion : REF.cov, l),
    }
  }
  return {
    main: c.s.route,
    sub: `${pick([`Из простых веществ ${F} напрямую не получают — путь: ${pick(KIND[k], 'ru')}.`, `${F} is not made directly from simple substances — the route: ${pick(KIND[k], 'en')}.`, `${F} oddiy moddalardan bevosita olinmaydi — yoʻli: ${pick(KIND[k], 'uz')}.`], l)} ${pick(KIND_MOMENT[k], l)}`,
    ref: pick(c.ionic ? REF.ion : REF.cov, l),
  }
}

function breakLines(c: Ctx, l: TeacherLang): TeacherLines {
  const lhs = c.s.route.split(/→|⇄/)[0] ?? ''
  const bonds: string[] = []
  const add = (x: string) => {
    if (!bonds.includes(x)) bonds.push(x)
  }
  if (/H₂(?!O|S|C|P|Si)/.test(lhs)) add('H–H')
  if (/O₂(?![A-Za-z₀-₉])/.test(lhs.replace(/[A-Z][a-z]?O₂/g, (m) => (m === 'O₂' ? m : '#')))) add('O=O')
  if (/(^|[^A-Za-z])\d*N₂(?![A-Za-z₀-₉])/.test(lhs)) add('N≡N')
  for (const h of ['F', 'Cl', 'Br', 'I']) if (new RegExp(`(^|[^A-Za-z])\\d*${h}₂(?![A-Za-z₀-₉])`).test(lhs)) add(`${h}–${h}`)
  if (/(^|[^A-Za-z₀-₉])\d*S(?![a-zA-Z₀-₉])/.test(lhs)) add('S–S (S₈)')
  if (/(^|[^A-Za-z₀-₉])\d*P(?![a-zA-Z₀-₉])/.test(lhs)) add('P–P')
  const metalAtoms = c.s.direct && (c.p?.species ?? []).some((x) => x.charge > 0 && isMetal(elOf(x)))
  const main = bonds.length ? bonds.join(' · ') : c.s.direct ? pick(['Металлическая связь', 'Metallic bonding', 'Metall bogʻ'], l) : c.s.route.split(/→|⇄/)[0]!.trim()
  const sub = c.s.direct
    ? `${pick(['Чтобы атомы соединились по-новому, старые связи рвутся: молекулы распадаются на атомы', 'For the atoms to join in a new way, the old bonds break: molecules split into atoms', 'Atomlar yangicha birikishi uchun eski bogʻlar uziladi: molekulalar atomlarga ajraladi'], l)}${metalAtoms ? pick([', атомы металла выходят из решётки', ', metal atoms leave the lattice', ', metall atomlari panjaradan chiqadi'], l) : ''}${pick(['. Для этого нужна энергия (нагрев, поджиг, свет).', '. This takes energy (heating, ignition, light).', '. Buning uchun energiya kerak (qizdirish, yondirish, yorugʻlik).'], l)}`
    : pick(
        ['В исходных веществах рвутся связи, ионы выходят из решёток (в растворе — уже свободны). Дальше — модель строения: из каких частиц складывается вещество.', 'In the starting substances bonds break and ions leave their lattices (in solution they are already free). Next — the structure model: which particles build the substance.', 'Boshlangʻich moddalarda bogʻlar uziladi, ionlar panjaradan chiqadi (eritmada ular allaqachon erkin). Keyin — tuzilish modeli: modda qaysi zarrachalardan tashkil topadi.'],
        l,
      )
  return { main, sub, ref: pick(REF.cov, l) }
}

function approachLines(c: Ctx, l: TeacherLang): TeacherLines {
  const d = num(c.s.dEN, l)
  if (c.s.type === 'S') {
    const ov = c.id === 'tb_h2' ? pick(['s–s', 's–s', 's–s'], l) : c.id === 'tb_o2' ? pick(['σ (по оси) + π (боком)', 'σ (along the axis) + π (sideways)', 'σ (oʻq boʻylab) + π (yon tomondan)'], l) : c.id === 'tb_n2' ? pick(['σ + 2π', 'σ + 2π', 'σ + 2π'], l) : pick(['p–p по оси (σ)', 'p–p along the axis (σ)', 'p–p oʻq boʻylab (σ)'], l)
    return {
      main: pick([`Перекрывание облаков: ${ov}`, `Overlap of the clouds: ${ov}`, `Bulutlarning qoplanishi: ${ov}`], l),
      sub: pick(['Атомы одного элемента сближаются; их электронные облака перекрываются — между ядрами возникает общая электронная пара. ΔЭО = 0: связь ковалентная неполярная.', 'Atoms of one element approach; their electron clouds overlap — a shared electron pair appears between the nuclei. ΔEN = 0: the bond is non-polar covalent.', 'Bir element atomlari yaqinlashadi; elektron bulutlari qoplanadi — yadrolar orasida umumiy elektron juft paydo boʻladi. ΔEM = 0: bogʻ kovalent qutbsiz.'], l),
      ref: pick(REF.cov, l),
    }
  }
  if (c.ionic && !ions(c).metalCations.length) {
    return {
      main: `${pick(['ΔЭО', 'ΔEN', 'ΔEM'], l)} = ${d}`,
      sub: pick(['Металла нет: молекула NH₃ и кислота сближаются, ион H⁺ кислоты притягивается к неподелённой паре атома N.', 'There is no metal: an NH₃ molecule and the acid approach, and the acid’s H⁺ ion is drawn to the lone pair of the N atom.', 'Metall yoʻq: NH₃ molekulasi va kislota yaqinlashadi, kislotaning H⁺ ioni N atomining taqsimlanmagan juftiga tortiladi.'], l),
      ref: pick(REF.da, l),
    }
  }
  if (c.ionic) {
    return {
      main: `ΔЭО = ${d}`.replace('ΔЭО', pick(['ΔЭО', 'ΔEN', 'ΔEM'], l)),
      sub: pick(['Атом металла и атом неметалла сближаются. Неметалл гораздо сильнее притягивает электроны — электрон перейдёт к нему (металл + неметалл → ионная связь, § 16).', 'A metal atom and a non-metal atom approach. The non-metal pulls electrons much more strongly — the electron will move to it (metal + non-metal → ionic bond, § 16).', 'Metall atomi va metallmas atomi yaqinlashadi. Metallmas elektronlarni ancha kuchli tortadi — elektron unga oʻtadi (metall + metallmas → ion bogʻ, 16-§).'], l),
      ref: pick(REF.en, l),
    }
  }
  return {
    main: `${pick(['ΔЭО', 'ΔEN', 'ΔEM'], l)} = ${d}`,
    sub: pick(['Атомы разных неметаллов сближаются, их электронные облака перекрываются. Электроотрицательности отличаются незначительно — электроны не переходят, а становятся общими (ковалентная полярная связь).', 'Atoms of different non-metals approach and their electron clouds overlap. Their electronegativities differ only slightly — electrons do not move over but become shared (polar covalent bond).', 'Turli metallmaslar atomlari yaqinlashadi, elektron bulutlari qoplanadi. Elektromanfiyliklari biroz farq qiladi — elektronlar oʻtmaydi, umumiy boʻladi (kovalent qutbli bogʻ).'], l),
    ref: pick(REF.en, l),
  }
}

function valenceLines(c: Ctx, l: TeacherLang): TeacherLines {
  const p = c.p
  const els = [...new Set((p?.species ?? []).flatMap((x) => Object.keys(x.comp)))]
  const main = els.map((e) => valenceLine(e, l)).join(' · ')
  const dEN = `${pick(['ΔЭО', 'ΔEN', 'ΔEM'], l)} = ${num(c.s.dEN, l)}`
  if (c.ionic && p) {
    const { metalCations, anions } = ions(c)
    const give = metalCations.map((m) => {
      const el = elOf(m)
      const n = VAL_E[el]
      return D_METALS.has(el) || el === 'Pb' || (n !== undefined && n !== m.charge)
        ? pick([`${el} в этом веществе отдаёт ${m.charge} e⁻ (степень окисления +${m.charge})`, `${el} gives ${m.charge} e⁻ in this substance (oxidation state +${m.charge})`, `${el} bu moddada ${m.charge} e⁻ beradi (oksidlanish darajasi +${m.charge})`], l)
        : pick([`у ${el} на внешнем уровне ${m.charge} e⁻ — он ${m.charge === 1 ? 'его' : 'их'} отдаёт`, `${el} has ${m.charge} e⁻ on its outer level — it gives ${m.charge === 1 ? 'it' : 'them'} away`, `${el} ning tashqi pogʻonasida ${m.charge} e⁻ — ${m.charge === 1 ? 'uni' : 'ularni'} beradi`], l)
    })
    const take = anions
      .filter((a) => a.kind === 'ion')
      .map((a) => {
        const el = elOf(a)
        const q = -a.charge
        return el === 'H'
          ? pick([`H (1s¹) — как галоген: до заполнения уровня не хватает 1 e⁻ → H⁻`, `H (1s¹) acts like a halogen: it lacks 1 e⁻ to fill its level → H⁻`, `H (1s¹) — galogen kabi: pogʻonani toʻldirishga 1 e⁻ yetmaydi → H⁻`], l)
          : pick([`у ${el} до октета не хватает ${q} e⁻`, `${el} lacks ${q} e⁻ to complete the octet`, `${el} ga oktetgacha ${q} e⁻ yetmaydi`], l)
      })
    const parts = metalCations.length ? [...give, ...take] : []
    if (!parts.length)
      parts.push(pick(['металла нет: у N аммиака после трёх связей N–H остаётся неподелённая пара — её получит ион H⁺ кислоты', 'there is no metal: after three N–H bonds the N of ammonia keeps a lone pair — the acid’s H⁺ ion will get it', 'metall yoʻq: ammiak N ida uchta N–H bogʻidan keyin taqsimlanmagan juft qoladi — uni kislotaning H⁺ ioni oladi'], l))
    return { main, sub: `${parts.join('; ')}. ${dEN}.`, ref: pick(REF.e, l) }
  }
  const ex = p ? excitation(p) : null
  const exLine = ex
    ? pick([` Атом ${ex.el} переходит в возбуждённое состояние: ${ex.v} неспаренных e⁻ (валентность ${ex.v}).`, ` The ${ex.el} atom goes into an excited state: ${ex.v} unpaired e⁻ (valency ${ex.v}).`, ` ${ex.el} atomi qoʻzgʻalgan holatga oʻtadi: ${ex.v} ta juftlashmagan e⁻ (valentlik ${ex.v}).`], l)
    : ''
  if (c.s.type === 'S' && p) {
    const sp = p.species[0]
    const el = sp ? elOf(sp) : ''
    const u = UNPAIRED[el]
    if (u !== undefined) {
      const tail = sp && sp.count === 2 && (u === 2 || u === 3) ? pick([`, поэтому связь ${u === 2 ? 'двойная' : 'тройная'}`, `, so the bond is ${u === 2 ? 'double' : 'triple'}`, `, shuning uchun bogʻ ${u === 2 ? 'qoʻsh' : 'uchlamchi'}`], l) : ''
      return {
        main,
        sub: `${pick([`У атома ${el} на внешнем уровне ${VAL_E[el]} e⁻, из них неспаренных — ${u}${tail}. Неспаренные электроны и образуют общие пары.`, `The ${el} atom has ${VAL_E[el]} e⁻ on its outer level, ${u} of them unpaired${tail}. The unpaired electrons form the shared pairs.`, `${el} atomining tashqi pogʻonasida ${VAL_E[el]} e⁻, ulardan juftlashmagani — ${u}${tail}. Juftlashmagan elektronlar umumiy juftlarni hosil qiladi.`], l)} ${dEN}.`,
        ref: pick(REF.e, l),
      }
    }
  }
  const dMetal = els.find((e) => D_METALS.has(e))
  const dLine = dMetal ? pick([` У ${dMetal} валентными становятся и d-электроны предвнешнего уровня.`, ` In ${dMetal} the d-electrons of the inner level also become valence electrons.`, ` ${dMetal} da tashqi oldi pogʻonaning d-elektronlari ham valent boʻladi.`], l) : ''
  const radical = c.id === 'no' || c.id === 'no2' ? pick([' Число валентных e⁻ нечётное — один электрон остаётся неспаренным (радикал).', ' The number of valence e⁻ is odd — one electron stays unpaired (a radical).', ' Valent e⁻ soni toq — bitta elektron juftlashmagan qoladi (radikal).'], l) : ''
  return {
    main,
    sub: `${pick(['Валентные электроны внешнего энергетического уровня (точки) образуют связи; неспаренные — отдельно, пары — рядом.', 'The valence electrons of the outer energy level (dots) form the bonds; unpaired ones sit alone, pairs sit together.', 'Tashqi energetik pogʻonaning valent elektronlari (nuqtalar) bogʻ hosil qiladi; juftlashmaganlari — alohida, juftlari — yonma-yon.'], l)}${exLine}${dLine}${radical} ${dEN}.`,
    ref: pick(REF.e, l),
  }
}

function transferLines(c: Ctx, l: TeacherLang): TeacherLines {
  const schemes = transferSchemes(c.id, l)
  const { given, taken, metalCations, nh4 } = ions(c)
  let sub: string
  if (metalCations.length) {
    sub = pick([`Каждый электрон переходит от атома металла к неметаллу по отдельности: отдано ${given} e⁻ = принято ${given} e⁻. Катион меньше атома, анион — больше.`, `Each electron moves from a metal atom to the non-metal separately: ${given} e⁻ given = ${given} e⁻ accepted. The cation is smaller than the atom, the anion is larger.`, `Har bir elektron metall atomidan metallmasga alohida oʻtadi: berilgan ${given} e⁻ = qabul qilingan ${given} e⁻. Kation atomdan kichik, anion — katta.`], l)
    if (nh4.length || taken !== given) sub += pick([` Остальной заряд анионов (${taken - given}−) — от ионов H⁺, перешедших к NH₃.`, ` The rest of the anion charge (${taken - given}−) comes from H⁺ ions that moved to NH₃.`, ` Anionlar zaryadining qolgani (${taken - given}−) — NH₃ ga oʻtgan H⁺ ionlaridan.`], l)
  } else {
    sub = pick([`Металла нет: ион H⁺ переходит от кислоты к неподелённой паре N аммиака, а электрон атома H остаётся у кислотного остатка — так появляются заряды (${taken}− у анионов, ${taken}+ у NH₄⁺).`, `There is no metal: an H⁺ ion moves from the acid to the lone pair of N in ammonia, while the H atom’s electron stays with the acid residue — that is how the charges appear (${taken}− on the anions, ${taken}+ on NH₄⁺).`, `Metall yoʻq: H⁺ ioni kislotadan ammiak N ining taqsimlanmagan juftiga oʻtadi, H atomining elektroni esa kislota qoldigʻida qoladi — zaryadlar shunday paydo boʻladi (anionlarda ${taken}−, NH₄⁺ da ${taken}+).`], l)
  }
  return { main: schemes.join(' · '), sub: `${sub}${covalentNote(c, l)}`, ref: pick(REF.ion, l) }
}

function innerLines(c: Ctx, l: TeacherLang): TeacherLines {
  const polys = (c.p?.species ?? []).filter((x) => x.kind === 'polyion')
  const main = polys.map((x) => `${x.formula}: ${POLY[x.formula] ? pick(POLY[x.formula]!.tri, l) : x.formula}`).join(' · ')
  const da = polys.some((x) => x.donorAcceptor)
  const neg = polys.filter((x) => x.charge < 0)
  const q = neg.map((x) => `${x.formula} — ${-x.charge}e⁻`).join(', ')
  const sub =
    pick(['Внутри многоатомного иона атомы неметаллов соединяются общими электронными парами — ковалентные полярные связи, по одной.', 'Inside the polyatomic ion the non-metal atoms join through shared electron pairs — polar covalent bonds, one at a time.', 'Koʻp atomli ion ichida metallmas atomlari umumiy elektron juftlar orqali birikadi — kovalent qutbli bogʻlar, birma-bir.'], l) +
    (q && !ions(c).metalCations.length
      ? pick([` Заряд аниона (${q}) — от ушедшего иона H⁺: электрон атома H остался у кислотного остатка.`, ` The anion’s charge (${q}) comes from the H⁺ ion that left: the H atom’s electron stayed with the acid residue.`, ` Anion zaryadi (${q}) — ketgan H⁺ ionidan: H atomining elektroni kislota qoldigʻida qolgan.`], l)
      : '') +
    (q && ions(c).metalCations.length ? pick([` Недостающие электроны (${q}) приходят от металла и завершают октеты концевых O — заряд иона появляется именно тогда.`, ` The missing electrons (${q}) come from the metal and complete the octets of the end O atoms — that is when the ion’s charge appears.`, ` Yetishmagan elektronlar (${q}) metalldan keladi va chetki O atomlarining oktetini toʻldiradi — ion zaryadi aynan shunda paydo boʻladi.`], l) : '') +
    (da ? pick([' Донорно-акцепторная связь: один атом даёт неподелённую пару, другой — свободную орбиталь.', ' Donor–acceptor bond: one atom provides a lone pair, the other a free orbital.', ' Donor-akseptor bogʻ: bir atom taqsimlanmagan juftni, ikkinchisi boʻsh orbitalni beradi.'], l) : '')
  if (!polys.length)
    return {
      main: pick(['Многоатомных ионов нет', 'No polyatomic ions', 'Koʻp atomli ionlar yoʻq'], l),
      sub: pick(['Все ионы этого вещества одноатомные: внутри них ковалентных связей нет — сразу переход электронов.', 'All the ions of this substance are monatomic: there are no covalent bonds inside them — straight to electron transfer.', 'Bu moddaning barcha ionlari bir atomli: ular ichida kovalent bogʻ yoʻq — darhol elektronlar oʻtishi.'], l),
      ref: pick(REF.ion, l),
    }
  return { main: main || bondsLine(c.p), sub, ref: pick(da ? REF.da : REF.cov, l) }
}

function pairsLines(c: Ctx, l: TeacherLang): TeacherLines {
  const f = FORMULAS[c.id]
  const main = f ? (f[0] ? `${f[0]} → ${f[1]}` : f[1]) : bondsLine(c.p)
  const n = c.p ? c.p.bondKinds.reduce((a, b) => a + b.count * (b.label.includes('≡') ? 3 : b.label.includes('=') ? 2 : 1), 0) : 0
  const da = /→|≡O|C≡O/.test(f?.[1] ?? '') && c.id !== 'tb_n2'
  let sub = c.s.type === 'S'
    ? pick(['Общие пары появляются по одной; они посередине между одинаковыми атомами — связь ковалентная неполярная. Двойная связь — две пары, тройная — три.', 'Shared pairs appear one at a time; they sit midway between identical atoms — a non-polar covalent bond. A double bond is two pairs, a triple — three.', 'Umumiy juftlar birma-bir paydo boʻladi; ular bir xil atomlar oʻrtasida — kovalent qutbsiz bogʻ. Qoʻsh bogʻ — ikki juft, uchlamchi — uch.'], l)
    : `${pick(['Общие пары появляются по одной. Каждая связь — общая электронная пара: по одному e⁻ от каждого атома.', 'Shared pairs appear one at a time. Each bond is a shared electron pair: one e⁻ from each atom.', 'Umumiy juftlar birma-bir paydo boʻladi. Har bir bogʻ — umumiy elektron juft: har bir atomdan bittadan e⁻.'], l)} ${shiftLine(c.p, l)}`
  if (n > 0) sub += pick([` Всего общих пар в показанной модели: ${n}.`, ` Shared pairs in the model shown: ${n}.`, ` Koʻrsatilgan modelda jami umumiy juftlar: ${n}.`], l)
  if (da) sub += pick([' Одна из связей — донорно-акцепторная: оба электрона пары даёт один атом (в записи часто — стрелка →).', ' One of the bonds is donor–acceptor: both electrons of the pair come from one atom (often drawn as an arrow →).', ' Bogʻlardan biri — donor-akseptor: juftning ikkala elektronini bitta atom beradi (koʻpincha → strelka bilan yoziladi).'], l)
  return { main, sub, ref: pick(da ? REF.da : REF.cov, l) }
}

function bondsLines(c: Ctx, l: TeacherLang): TeacherLines {
  const f = FORMULAS[c.id]
  const main = c.ionic ? bondsLine(c.p) || pick(['Ионная связь', 'Ionic bond', 'Ion bogʻ'], l) : f?.[1] ?? bondsLine(c.p)
  const sub = c.ionic
    ? pick(['Палочки — ковалентные связи внутри многоатомных ионов; между ионами связь ионная — палочек нет, только притяжение зарядов.', 'Sticks are covalent bonds inside the polyatomic ions; between the ions the bond is ionic — no sticks, only attraction of charges.', 'Tayoqchalar — koʻp atomli ionlar ichidagi kovalent bogʻlar; ionlar orasida bogʻ ion bogʻ — tayoqcha yoʻq, faqat zaryadlar tortishuvi.'], l)
    : pick(['Структурная формула: каждая черта — общая электронная пара (связь). Число черт у атома — его валентность.', 'Structural formula: each dash is a shared electron pair (a bond). The number of dashes at an atom is its valency.', 'Struktura formulasi: har bir chiziqcha — umumiy elektron juft (bogʻ). Atomdagi chiziqchalar soni — uning valentligi.'], l)
  return { main, sub, ref: pick(c.ionic ? REF.ion : REF.cov, l) }
}

function assembleLines(c: Ctx, l: TeacherLang): TeacherLines {
  const p = c.p
  if (c.ionic) {
    return {
      main: p?.balance ?? c.s.particles.split(';')[0]!,
      sub: pick([`Разноимённо заряженные ионы притягиваются друг к другу — формульная единица ${c.s.formula}: суммарный заряд 0.`, `Oppositely charged ions attract each other — the formula unit ${c.s.formula}: total charge 0.`, `Qarama-qarshi zaryadli ionlar bir-biriga tortiladi — ${c.s.formula} formula birligi: umumiy zaryad 0.`], l),
      ref: pick(REF.ion, l),
    }
  }
  const sh = p?.shapes.find((x) => SHAPE[x.key])
  const shape = sh ? pick(SHAPE[sh.key]!, l) : ''
  const ang = ANGLE[c.id] ? `, ${l === 'en' ? ANGLE[c.id]!.replace(',', '.') : ANGLE[c.id]}` : ''
  const lone = /O|S|N|P/.test(Object.keys(p?.species.reduce((a, x) => ({ ...a, ...x.comp }), {}) ?? {}).join('')) && (sh?.key === 'angular' || sh?.key === 'trigonal-pyramidal')
  return {
    main: shape ? `${pick(['Форма', 'Shape', 'Shakl'], l)}: ${shape}${ang}` : c.s.formula,
    sub:
      pick(['Электронные пары отталкиваются друг от друга — атомы занимают свои места, и частица принимает форму.', 'Electron pairs repel each other — the atoms take their places and the particle gets its shape.', 'Elektron juftlar bir-biridan itariladi — atomlar oʻz joyini egallaydi va zarracha shaklga keladi.'], l) +
      (lone ? pick([' Неподелённые пары центрального атома тоже занимают место — поэтому уголок / пирамида.', ' The lone pairs of the central atom also take up room — hence the bent / pyramidal shape.', ' Markaziy atomning taqsimlanmagan juftlari ham joy egallaydi — shuning uchun burchakli / piramida.'], l) : ''),
    ref: pick(REF.geo, l),
  }
}

function latticeLines(c: Ctx, l: TeacherLang): TeacherLines {
  const head = latticeHead(c, l)
  const type = latticeType(c, l)
  const coord = coordination(c)
  if (c.ionic) {
    const coordLine = coord ? pick([` Координация ${coord}: столько ближайших соседей-противоионов у каждого иона.`, ` Coordination ${coord}: the number of nearest oppositely charged neighbours of each ion.`, ` Koordinatsiya ${coord}: har bir ionning qarama-qarshi zaryadli eng yaqin qoʻshnilari soni.`], l) : ''
    const water = c.s.type === 'IH' && c.id !== 'tb_kcl_nacl' ? pick([' Молекулы кристаллизационной воды стоят в решётке атомом O к катиону.', ' Molecules of water of crystallisation sit in the lattice with their O towards the cation.', ' Kristallizatsiya suvi molekulalari panjarada O atomi bilan kationga qarab turadi.'], l) : ''
    return {
      main: type ? `${head} · ${type}` : head,
      sub: `${pick(['В узлах — ионы; каждый окружён ионами противоположного знака. Ионные вещества твёрдые, тугоплавкие, хрупкие; расплавы и растворы проводят ток.', 'Ions sit at the lattice points; each is surrounded by ions of opposite charge. Ionic substances are hard, high-melting and brittle; their melts and solutions conduct electricity.', 'Tugunlarda — ionlar; har biri qarama-qarshi zaryadli ionlar bilan oʻralgan. Ion moddalar qattiq, qiyin suyuqlanadigan, moʻrt; suyuqlanmalari va eritmalari tok oʻtkazadi.'], l)}${coordLine}${water}`,
      ref: pick(/NaCl/.test(c.s.lattice) ? REF.nacl : REF.lat, l),
    }
  }
  if (c.s.type === 'N')
    return {
      main: head,
      sub: pick(['В узлах — атомы Si и O, связанные ковалентными связями; каждый O — мостик между двумя Si, тетраэдры SiO₄ соединены вершинами. Молекул нет: SiO₂ — простейшая формула. Очень твёрдый, тугоплавкий.', 'Si and O atoms sit at the lattice points, joined by covalent bonds; each O bridges two Si, the SiO₄ tetrahedra share corners. There are no molecules: SiO₂ is the simplest formula. Very hard and high-melting.', 'Tugunlarda — kovalent bogʻlar bilan bogʻlangan Si va O atomlari; har bir O — ikki Si orasidagi koʻprik, SiO₄ tetraedrlari uchlari bilan birlashgan. Molekula yoʻq: SiO₂ — eng oddiy formula. Juda qattiq, qiyin suyuqlanadi.'], l),
      ref: pick(REF.lat, l),
    }
  if (c.s.type === 'PM')
    return {
      main: head,
      sub: pick([`Отдельной молекулы ${c.s.formula} нет: звенья соединены мостиками –O– в цепи или слои; ${c.s.formula} — простейшая формула.`, `There is no separate ${c.s.formula} molecule: the units are joined by –O– bridges into chains or layers; ${c.s.formula} is the simplest formula.`, `Alohida ${c.s.formula} molekulasi yoʻq: boʻgʻinlar –O– koʻpriklari bilan zanjir yoki qatlamga birlashgan; ${c.s.formula} — eng oddiy formula.`], l),
      ref: pick(REF.lat, l),
    }
  if (c.s.latticeKind === 'molecular')
    return {
      main: head,
      sub: pick([`В узлах — молекулы; между молекулами слабые силы притяжения, внутри — прочные ковалентные связи. Поэтому твёрдое ${c.s.formula} легкоплавкое, летучее.`, `Molecules sit at the lattice points; between molecules the forces are weak, inside them the covalent bonds are strong. So solid ${c.s.formula} melts easily and is volatile.`, `Tugunlarda — molekulalar; molekulalar orasida tortishish kuchsiz, ichida esa mustahkam kovalent bogʻlar. Shuning uchun qattiq ${c.s.formula} oson suyuqlanadi, uchuvchan.`], l),
      ref: pick(REF.lat, l),
    }
  return {
    main: head,
    sub: pick(['При обычных условиях вещество — газ или жидкость: молекулы движутся свободно, между ними слабые силы. Решётку ионов здесь рисовать нельзя.', 'Under normal conditions the substance is a gas or a liquid: the molecules move freely, the forces between them are weak. There is no ionic lattice here.', 'Oddiy sharoitda modda — gaz yoki suyuqlik: molekulalar erkin harakatlanadi, ular orasidagi kuchlar kuchsiz. Bu yerda ion panjara yoʻq.'], l),
    ref: pick(REF.lat, l),
  }
}

function finalLines(c: Ctx, l: TeacherLang): TeacherLines {
  const bond: Tri =
    c.s.type === 'S'
      ? ['ковалентная неполярная связь', 'non-polar covalent bond', 'kovalent qutbsiz bogʻ']
      : c.s.type === 'IB'
        ? ['ионная связь', 'ionic bond', 'ion bogʻ']
        : c.ionic
          ? ['ионная связь между ионами, ковалентная полярная — внутри многоатомных ионов', 'ionic bonds between the ions, polar covalent bonds inside the polyatomic ions', 'ionlar orasida ion bogʻ, koʻp atomli ionlar ichida — kovalent qutbli bogʻ']
          : ['ковалентная полярная связь', 'polar covalent bond', 'kovalent qutbli bogʻ']
  const sp = formationTeacherSpecial(c.id, l)
  return {
    main: `${c.s.formula} — ${pick(bond, l)}`,
    sub: `${pick(['Особенность', 'Key point', 'Oʻziga xoslik'], l)}: ${sp}`,
    ref: formationTeacherRef(c.id, l),
  }
}

/** Новый этап, о котором учитель не знает (например, 'route' от движка) — общая фраза по виду пути. */
function routeLines(c: Ctx, l: TeacherLang): TeacherLines {
  const k = routeKindKey(c.id)!
  return { main: `${pick(KIND[k], l)}: ${c.s.route}`, sub: pick(KIND_MOMENT[k], l), ref: pick(c.ionic ? REF.ion : REF.cov, l) }
}

/**
 * Фразы учителя: main — крупная строка (схема, формула, связи), sub — 1–2 фразы в стиле учебника, ref — § и страницы.
 * null — вещества нет в таблице 200.
 */
export function formationTeacherLines(id: string, stageKey: string, lang: TeacherLang): TeacherLines | null {
  const c = ctx(id)
  if (!c) return null
  switch (stageKey) {
    case 'reagents':
      return reagentsLines(c, lang)
    case 'break':
      return breakLines(c, lang)
    case 'approach':
      return approachLines(c, lang)
    case 'valence':
      return valenceLines(c, lang)
    case 'inner':
      return c.ionic ? innerLines(c, lang) : pairsLines(c, lang)
    case 'transfer':
      return c.ionic ? transferLines(c, lang) : pairsLines(c, lang)
    case 'pairs':
      return c.ionic ? transferLines(c, lang) : pairsLines(c, lang)
    case 'bonds':
      return bondsLines(c, lang)
    case 'assemble':
      return assembleLines(c, lang)
    case 'lattice':
      return latticeLines(c, lang)
    case 'final':
      return finalLines(c, lang)
    default:
      return routeLines(c, lang)
  }
}

export const FORMATION_TEACHER_STAGES: readonly string[] = STAGE_KEYS
