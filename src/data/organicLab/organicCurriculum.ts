/**
 * Учебная программа органической лаборатории по Kimyo 10.
 * Модули (~уроки): смотреть / собрать / уравнение / изомеры / название.
 */
import type { OrganicClassId } from '../researchLab/organicBuildCatalog'
import { G10_G11_EDU_EQUATIONS } from '../researchLab/g10g11Equations'
import { organicMoleculeById } from './organicMoleculeRegistry'

export type OrganicLessonMode = 'view' | 'build' | 'equation' | 'isomer' | 'name'

export type OrganicLesson = {
  id: string
  /** Глава Kimyo 10 (1–4) */
  chapter: 1 | 2 | 3 | 4
  titleRu: string
  titleEn: string
  titleUz: string
  goalRu: string
  goalEn: string
  goalUz: string
  /** Основной класс для чипов молекул */
  classId: OrganicClassId | 'all'
  /** ID из organicBuildCatalog / organicMoleculeRegistry */
  challengeIds: readonly string[]
  /** Уравнения g10 из g10g11Equations (пустой = режим уравнения скрыт) */
  equationIds: readonly string[]
  /** Задания ISOMER_CHALLENGES (пустой = режим изомеров скрыт) */
  isomerChallengeIds: readonly string[]
  /** ID квиза NOMENCLATURE_QUIZZES (нет = режим названия скрыт) */
  nomenclatureQuizId?: string
  /** Дополнительные квизы урока (переключатель в режиме «Название») */
  extraQuizIds?: readonly string[]
  /** Молекула по умолчанию при входе в урок */
  defaultMolId: string
}

function L(
  partial: Omit<OrganicLesson, 'titleEn' | 'titleUz' | 'goalEn' | 'goalUz' | 'isomerChallengeIds'> & {
    titleEn?: string
    titleUz?: string
    goalEn?: string
    goalUz?: string
    isomerChallengeIds?: readonly string[]
  },
): OrganicLesson {
  return {
    ...partial,
    titleEn: partial.titleEn ?? partial.titleRu,
    titleUz: partial.titleUz ?? partial.titleRu,
    goalEn: partial.goalEn ?? partial.goalRu,
    goalUz: partial.goalUz ?? partial.goalRu,
    isomerChallengeIds: partial.isomerChallengeIds ?? [],
  }
}

const VIEW_ONLY = new Set(['glucose-pyranose', 'fructose', 'sucrose', 'triacetin'])

export const ORGANIC_CURRICULUM: readonly OrganicLesson[] = [
  L({
    id: 'intro-structure',
    chapter: 1,
    titleRu: 'Строение и первые молекулы',
    titleEn: 'Structure and first molecules',
    titleUz: 'Tuzilish va birinchi molekulalar',
    goalRu: 'Увидеть метан и этан в 3D, понять валентность углерода.',
    goalEn: 'See methane and ethane in 3D; understand carbon valence.',
    goalUz: 'Metan va etanni 3D da koʻring; uglerod valentligini tushuning.',
    classId: 'alkane',
    challengeIds: ['methane', 'ethane'],
    equationIds: [],
    defaultMolId: 'methane',
  }),
  L({
    id: 'isomers',
    chapter: 1,
    titleRu: 'Изомерия',
    titleEn: 'Isomerism',
    titleUz: 'Izomeriya',
    goalRu: 'Найти изомеры бутана, пентана, гексана и все 9 изомеров гептана C₇H₁₆ (с. 43); отличить спирт от эфира.',
    goalEn: 'Find the isomers of butane, pentane, hexane and all 9 heptane isomers C₇H₁₆ (p. 43); tell alcohol from ether.',
    goalUz: 'Butan, pentan, geksan izomerlarini va geptan C₇H₁₆ ning barcha 9 izomerini toping (43-bet); spirtni efirdan ajrating.',
    classId: 'alkane',
    challengeIds: [
      'n-butane',
      'isobutane',
      'n-pentane',
      'isopentane',
      'neopentane',
      'n-hexane',
      '2-methylpentane',
      '3-methylpentane',
      '2-2-dimethylbutane',
      '2-3-dimethylbutane',
      'n-heptane',
      '2-methylhexane',
      '3-methylhexane',
      '2-2-dimethylpentane',
      '2-3-dimethylpentane',
      '2-4-dimethylpentane',
      '3-3-dimethylpentane',
      '3-ethylpentane',
      '2-2-3-trimethylbutane',
    ],
    equationIds: ['g10-alkane-isomer', 'g10-rt-isomerization'],
    isomerChallengeIds: ['c5h12', 'c6h14', 'c7h16', 'c4h10o'],
    defaultMolId: 'n-pentane',
  }),
  L({
    id: 'reaction-types',
    chapter: 1,
    titleRu: 'Типы органических реакций',
    titleEn: 'Types of organic reactions',
    titleUz: 'Organik reaksiyalar turlari',
    goalRu:
      'Примеры § 1.6 (с. 26–28): замещение, присоединение, разложение, элиминирование, изомеризация, конденсация, поликонденсация и радикальный механизм по стадиям.',
    goalEn:
      'Examples of § 1.6 (pp. 26–28): substitution, addition, decomposition, elimination, isomerization, condensation, polycondensation and the radical mechanism step by step.',
    goalUz:
      '§ 1.6 misollari (26–28-betlar): oʻrin olish, birikish, parchalanish, eliminirlanish, izomerlanish, kondensatsiya, polikondensatsiya va radikal mexanizm bosqichma-bosqich.',
    classId: 'all',
    challengeIds: [
      'ethane',
      'chloroethane',
      'ethanol',
      'propene',
      'propane',
      'ethylene',
      '1-2-dichloroethane',
      'methane',
      'n-pentane',
      'isopentane',
      'acetaldehyde',
      '3-hydroxybutanal',
      'terephthalic-acid',
      'ethylene-glycol',
      'chloromethane',
    ],
    equationIds: [
      'g10-rt-ethane-cl2',
      'g10-rt-chloroethane-koh',
      'g10-rt-propene-h2',
      'g10-rt-ethene-cl2',
      'g10-rt-ethene-hcl',
      'g10-rt-decane-crack',
      'g10-rt-methane-decomp',
      'g10-rt-elim-hcl',
      'g10-rt-elim-h2o',
      'g10-rt-elim-h2',
      'g10-rt-isomerization',
      'g10-rt-aldol',
      'g10-rt-pet',
      'g10-rt-rad-init',
      'g10-rt-rad-prop1',
      'g10-rt-rad-prop2',
    ],
    defaultMolId: 'ethane',
  }),
  L({
    id: 'nomenclature',
    chapter: 1,
    titleRu: 'Номенклатура',
    titleEn: 'Nomenclature',
    titleUz: 'Nomenklatura',
    goalRu:
      'Назвать молекулы § 1.7–1.8 (с. 30–33): главная цепь, нумерация, старшая группа; школьное название и вариант IUPAC.',
    goalEn:
      'Name the molecules of § 1.7–1.8 (pp. 30–33): main chain, numbering, senior group; the school name and the IUPAC variant.',
    goalUz:
      '§ 1.7–1.8 molekulalarini nomlang (30–33-betlar): asosiy zanjir, raqamlash, katta guruh; maktab nomi va IUPAC varianti.',
    classId: 'all',
    challengeIds: [
      '2-methylpentane',
      '2-2-dimethylbutane',
      '2-3-dimethylbutane',
      'cysteine',
      'propanoic-acid',
      'isobutane',
      'isobutylene',
      'butan-2-ol',
      'butadiene',
      'butanone',
      '4-bromomethylheptane',
      'methane',
      'ethylene',
      'ethanol',
      'acetaldehyde',
      'acetone',
    ],
    equationIds: [],
    nomenclatureQuizId: 'g10-textbook-names',
    extraQuizIds: ['basics-suffix'],
    defaultMolId: '2-methylpentane',
  }),
  L({
    id: 'alkanes',
    chapter: 2,
    titleRu: 'Алканы',
    titleEn: 'Alkanes',
    titleUz: 'Alkanlar',
    goalRu:
      'Изооктан и типы атомов C, названия разветвлённых алканов, задача про C₇H₁₆; уравнения получения и свойств алканов (с. 43–50).',
    goalEn:
      'Isooctane and carbon types, names of branched alkanes, the C₇H₁₆ task; equations for making alkanes and their properties (pp. 43–50).',
    goalUz:
      'Izooktan va C atomlari turlari, shoxlangan alkanlar nomi, C₇H₁₆ masalasi; alkanlarning olinishi va xossalari tenglamalari (43–50-betlar).',
    classId: 'alkane',
    challengeIds: [
      'methane',
      'ethane',
      'propane',
      'n-butane',
      'isobutane',
      'n-pentane',
      'isopentane',
      'isooctane',
      '2-methylhexane',
      '3-methyl-4-ethylhexane',
      '2-3-5-trimethylhexane',
      'chloromethane',
      'dichloromethane',
      'chloroform',
      'tetrachloromethane',
      '2-3-dimethylbut-2-ene',
    ],
    equationIds: [
      'g10-alk-wurtz-ethyl',
      'g10-alk-wurtz-mix-propane',
      'g10-alk-wurtz-mix-ethane',
      'g10-alk-dumas-ch4',
      'g10-alk-dumas-c2h6',
      'g10-alk-al4c3-h2o',
      'g10-alk-al4c3-hcl',
      'g10-alk-kolbe',
      'g10-alk-crack-octane',
      'g10-alk-crack-dodecane',
      'g10-alk-coal-h2',
      'g10-alk-co-h2',
      'g10-alkane-ch4-burn',
      'g10-alkane-c3h8-burn',
      'g10-alk-c4h10-burn',
      'g10-alk-decane-crack-p50',
      'g10-alkane-ch4-cl2',
      'g10-alk-ch3cl-cl2',
      'g10-alk-ch2cl2-cl2',
      'g10-alk-chcl3-cl2',
      'g10-alkane-c2h6-burn',
      'g10-alkane-wurtz',
      'g10-alkane-isomer',
    ],
    isomerChallengeIds: ['c5h12', 'c6h14', 'c7h16-c5chain'],
    defaultMolId: 'methane',
  }),
  L({
    id: 'cycloalkanes',
    chapter: 2,
    titleRu: 'Циклоалканы',
    titleEn: 'Cycloalkanes',
    titleUz: 'Tsikloalkanlar',
    goalRu:
      'Молекулы § 2.5–2.6 (с. 52–55), изомеры C₄H₈ и C₅H₁₀ с кольцом; получение циклоалканов, раскрытие малых колец и замещение у циклогексана.',
    goalEn:
      'Molecules of § 2.5–2.6 (pp. 52–55), ring isomers of C₄H₈ and C₅H₁₀; making cycloalkanes, opening small rings and substitution in cyclohexane.',
    goalUz:
      '§ 2.5–2.6 molekulalari (52–55-betlar), C₄H₈ va C₅H₁₀ ning halqali izomerlari; tsikloalkanlarning olinishi, kichik halqalarning ochilishi va tsiklogeksanda oʻrin olish.',
    classId: 'cycloalkane',
    challengeIds: [
      'cyclopropane',
      'cyclobutane',
      'cyclopentane',
      'cyclohexane',
      'methylcyclopropane',
      '1-2-dimethylcyclobutane',
      '1-methyl-3-ethylcyclopentane',
      'methylcyclobutane',
      '1-1-dimethylcyclopropane',
      '1-2-dimethylcyclopropane',
      'ethylcyclopropane',
      '1-5-dibromopentane',
      'benzene',
      'chlorocyclohexane',
    ],
    equationIds: [
      'g10-cyc-zn',
      'g10-arene-h2',
      'g10-cyc-c3h6-h2',
      'g10-cyc-c5h10-h2',
      'g10-cyc-c6h12-cl2',
      'g10-cyclo-burn',
    ],
    isomerChallengeIds: ['c4h8-ring', 'c5h10-ring'],
    defaultMolId: 'cyclohexane',
  }),
  L({
    id: 'alkenes',
    chapter: 2,
    titleRu: 'Алкены',
    titleEn: 'Alkenes',
    titleUz: 'Alkenlar',
    goalRu: 'Собрать двойную связь и уравнения присоединения этилена.',
    goalEn: 'Build a double bond and ethylene addition equations.',
    goalUz: 'Qoʻsh bogʻ yigʻing; etilen qoʻshilish tenglamalarini bajaring.',
    classId: 'alkene',
    challengeIds: ['ethylene', 'propene'],
    equationIds: [
      'g10-alkene-c2h4-br2',
      'g10-alkene-c2h4-h2',
      'g10-alkene-c2h4-h2o',
      'g10-alkene-markovnikov',
    ],
    defaultMolId: 'ethylene',
  }),
  L({
    id: 'alkadienes',
    chapter: 2,
    titleRu: 'Алкадиены и каучук',
    titleEn: 'Alkadienes and rubber',
    titleUz: 'Alkadiyenlar va kauchuk',
    goalRu: 'Увидеть сопряжённые двойные связи и уравнение полимеризации.',
    goalEn: 'See conjugated double bonds and a polymerization equation.',
    goalUz: 'Konʼyugatsiyalangan qoʻsh bogʻlar va polimerlanish tenglamasini koʻring.',
    classId: 'alkadiene',
    challengeIds: ['butadiene', 'isoprene'],
    equationIds: ['g10-diene-rubber'],
    defaultMolId: 'butadiene',
  }),
  L({
    id: 'alkynes',
    chapter: 2,
    titleRu: 'Алкины',
    titleEn: 'Alkynes',
    titleUz: 'Alkinlar',
    goalRu: 'Собрать тройную связь и уравнения ацетилена.',
    goalEn: 'Build a triple bond and acetylene equations.',
    goalUz: 'Uchli bogʻ yigʻing; atsetilen tenglamalarini bajaring.',
    classId: 'alkyne',
    challengeIds: ['acetylene', 'propyne'],
    equationIds: ['g10-alkyne-carbide', 'g10-alkyne-h2', 'g10-alkyne-kucherov'],
    defaultMolId: 'acetylene',
  }),
  L({
    id: 'arenes',
    chapter: 2,
    titleRu: 'Арены',
    titleEn: 'Arenes',
    titleUz: 'Arenlar',
    goalRu: 'Собрать бензольное кольцо и уравнения замещения.',
    goalEn: 'Build a benzene ring and substitution equations.',
    goalUz: 'Benzol halqasini yigʻing; oʻrinbosarlik tenglamalarini bajaring.',
    classId: 'arene',
    challengeIds: ['benzene', 'toluene', 'styrene'],
    equationIds: ['g10-arene-br2', 'g10-arene-hno3', 'g10-arene-friedel', 'g10-styrene-poly'],
    defaultMolId: 'benzene',
  }),
  L({
    id: 'halo',
    chapter: 2,
    titleRu: 'Галогенпроизводные',
    titleEn: 'Haloalkanes',
    titleUz: 'Galogenli birikmalar',
    goalRu: 'Собрать хлорметан / хлорэтан; уравнение SN2.',
    goalEn: 'Build chloromethane / chloroethane; practice an SN2 equation.',
    goalUz: 'Xlorometan / xloroetan yigʻing; SN2 tenglamasini bajaring.',
    classId: 'halo',
    challengeIds: ['chloromethane', 'chloroethane'],
    equationIds: ['g10-halo-sn2', 'g10-alkane-ch4-cl2'],
    defaultMolId: 'chloromethane',
  }),
  L({
    id: 'sources-oil',
    chapter: 2,
    titleRu: 'Нефть, газ и уголь',
    titleEn: 'Oil, gas and coal',
    titleUz: 'Neft, gaz va koʻmir',
    goalRu: 'Связать природные источники с крекингом и коксованием.',
    goalEn: 'Link natural sources to cracking and coking equations.',
    goalUz: 'Tabiiy manbalarni kreking va koksash tenglamalari bilan bogʻlang.',
    classId: 'all',
    challengeIds: ['methane', 'ethylene', 'benzene', 'propane'],
    equationIds: ['g10-alkane-cracking', 'g10-oil-cracking', 'g10-coal-coke', 'g10-alkene-pe'],
    defaultMolId: 'methane',
  }),
  L({
    id: 'alcohols',
    chapter: 3,
    titleRu: 'Спирты',
    titleEn: 'Alcohols',
    titleUz: 'Spirtlar',
    goalRu:
      '§ 3.1–3.2 (с. 107–113): гомологический ряд, первичный/вторичный/третичный спирт, аллиловый спирт (в учебнике — «виниловый»), название нонан-4-ола, изомеры C₃H₈O и C₂H₆O; реакции спиртов, иодоформная проба и получение.',
    goalEn:
      '§ 3.1–3.2 (pp. 107–113): the homologous series, primary/secondary/tertiary alcohols, allyl alcohol (the textbook says “vinyl”), naming the nonan-4-ol, isomers of C₃H₈O and C₂H₆O; reactions of alcohols, the iodoform test and preparation.',
    goalUz:
      '§ 3.1–3.2 (107–113-betlar): gomologik qator, birlamchi/ikkilamchi/uchlamchi spirt, allil spirti (darslikda «vinil»), nonan-4-ol nomi, C₃H₈O va C₂H₆O izomerlari; spirtlarning reaksiyalari, yodoform sinovi va olinishi.',
    classId: 'alcohol',
    challengeIds: [
      'methanol',
      'ethanol',
      'propanol',
      'propan-2-ol',
      'tert-butanol',
      'n-butanol',
      'allyl-alcohol',
      '6-ethyl-4-methyl-3-chlorononan-4-ol',
      'dimethyl-ether',
      'methoxyethane',
      'diethyl-ether',
      'ethyl-acetate',
      'chloroethane',
      'ethylene',
      'pentanal',
      'pentan-1-ol',
      'ethyl-pent-2-enoate',
      'pent-2-en-1-ol',
      'formaldehyde',
      'formic-acid',
      'glucose-open',
    ],
    equationIds: [
      'g10c3-etoh-na',
      'g10c3-etoh-hno3',
      'g10c3-etoh-h2so4',
      'g10c3-etoh-ether',
      'g10c3-etoh-acetic',
      'g10c3-etoh-hcl',
      'g10c3-iodoform',
      'g10c3-ethene-h2o',
      'g10c3-pentanal-h2',
      'g10c3-ester-reduction',
      'g10c3-ch4-to-ch3oh',
      'g10c3-ch4-to-hcho',
      'g10c3-ch4-to-hcooh',
      'g10c3-glucose-ferment',
      'g10c3-chloroethane-h2o',
    ],
    isomerChallengeIds: ['c3h8o', 'c2h6o'],
    nomenclatureQuizId: 'g10-ch3-alcohols',
    defaultMolId: 'ethanol',
  }),
  L({
    id: 'polyols',
    chapter: 3,
    titleRu: 'Многоатомные спирты',
    titleEn: 'Polyols',
    titleUz: 'Koʻp atomli spirtlar',
    goalRu:
      '§ 3.3–3.5 (с. 115–121): этиленгликоль, глицерин, ксилит, сорбит, гликоли C₄ (исправленная таблица с. 117); реакции, качественная реакция с Cu(OH)₂, обе цепочки с. 121 и задачи.',
    goalEn:
      '§ 3.3–3.5 (pp. 115–121): ethylene glycol, glycerol, xylitol, sorbitol, the C₄ glycols (corrected table of p. 117); reactions, the Cu(OH)₂ test, both chains of p. 121 and the tasks.',
    goalUz:
      '§ 3.3–3.5 (115–121-betlar): etilenglikol, glitserin, ksilit, sorbit, C₄ glikollar (117-bet jadvali tuzatilgan); reaksiyalar, Cu(OH)₂ bilan sifat reaksiyasi, 121-betdagi ikkala zanjir va masalalar.',
    classId: 'polyol',
    challengeIds: [
      'ethylene-glycol',
      'glycerol',
      'xylitol',
      'sorbitol',
      'butane-1-2-diol',
      'butane-1-3-diol',
      'butane-1-4-diol',
      'butane-2-3-diol',
      '2-methylpropane-1-2-diol',
      '2-methylpropane-1-3-diol',
      '5-6-dimethyloctane-3-5-diol',
      'butane-1-2-4-triol',
      'ethylene-oxide',
      '1-2-dichloroethane',
      '2-chloroethanol',
      'ethylene-glycol-monoacetate',
      'acetaldehyde',
      '1-4-dioxane',
      '1-2-3-trichloropropane',
      'chloroethane',
      'ethylene',
      'triacetin',
    ],
    equationIds: [
      'g10c3-epoxide-h2o',
      'g10c3-dce-naoh',
      'g10c3-alkene-kmno4',
      'g10c3-fat-hydrolysis-118',
      'g10c3-glycol-na',
      'g10c3-glycol-acetic',
      'g10c3-glycol-hcl',
      'g10c3-glycol-dehydration',
      'g10c3-glycol-dioxane',
      'g10c3-glycerol-hno3',
      'g10c3-glycerol-hcl',
      'g10c3-trichloropropane-naoh',
      'g10c3-glycerol-cuoh2',
      'g10c3-glycol-cuoh2',
      'g10c3-glycerol-rcooh',
      'g10c3-chain1-elim',
      'g10c3-chain1-br2',
      'g10c3-chain1-naoh',
    ],
    isomerChallengeIds: ['c4h10o2-diols'],
    nomenclatureQuizId: 'g10-ch3-polyols',
    defaultMolId: 'glycerol',
  }),
  L({
    id: 'phenols',
    chapter: 3,
    titleRu: 'Фенолы',
    titleEn: 'Phenols',
    titleUz: 'Fenollar',
    goalRu:
      '§ 3.6–3.7 (с. 123–128): ароматические спирты и фенолы — где стоит OH; крезолы, двух- и трёхатомные фенолы (исправлены опечатки названий); кислотные свойства, бромная вода и FeCl₃, получение фенола; задачи с. 126.',
    goalEn:
      '§ 3.6–3.7 (pp. 123–128): aromatic alcohols and phenols — where the OH sits; cresols, di- and trihydric phenols (name typos corrected); acidic properties, bromine water and FeCl₃, making phenol; tasks of p. 126.',
    goalUz:
      '§ 3.6–3.7 (123–128-betlar): aromatik spirtlar va fenollar — OH qayerda; krezollar, ikki va uch atomli fenollar (nomlardagi xatolar tuzatilgan); kislotali xossalar, bromli suv va FeCl₃, fenol olish; 126-bet masalalari.',
    classId: 'phenol',
    challengeIds: [
      'phenol',
      'benzyl-alcohol',
      '1-phenylethanol',
      '2-phenylethanol',
      '2-phenylpropan-1-ol',
      '1-phenylbutan-1-ol',
      '2-methyl-1-phenylpropan-2-ol',
      'o-cresol',
      'm-cresol',
      'p-cresol',
      'catechol',
      'resorcinol',
      'hydroquinone',
      'pyrogallol',
      'phloroglucinol',
      '2-4-6-tribromophenol',
      'salicyl-alcohol',
      'dihydroxydiphenylmethane',
      'formaldehyde',
      'benzyl-chloride',
      'benzene',
      'chlorobenzene',
      '2-4-6-trimethylphenol',
      'butane-1-2-4-triol',
    ],
    equationIds: [
      'g10c3-phenol-na',
      'g10c3-phenol-naoh',
      'g10c3-phenolate-co2',
      'g10c3-phenol-br2',
      'g10c3-phenol-hcho-1',
      'g10c3-phenol-hcho-2',
      'g10c3-phenol-fecl3',
      'g10c3-phenol-fecl3-simple',
      'g10c3-benzyl-chloride-h2o',
      'g10c3-kekule-1',
      'g10c3-kekule-2',
      'g10c3-phenolate-hcl',
      'g10c3-benzene-cl2',
      'g10c3-chlorobenzene-naoh',
      'g10c3-phenolate-h2so4',
    ],
    isomerChallengeIds: ['c7h8o-phenols'],
    nomenclatureQuizId: 'g10-ch3-phenols',
    defaultMolId: 'phenol',
  }),
  L({
    id: 'ethers',
    chapter: 3,
    titleRu: 'Простые эфиры',
    titleEn: 'Ethers',
    titleUz: 'Oddiy efirlar',
    goalRu:
      '§ 3.8 (с. 130–132): симметричные и смешанные эфиры, дивиниловый эфир, оксиран, анизол, изомеры C₄H₁₀O; синтез Вильямсона, получение через этилсерную кислоту, оксониевая соль и расщепление HI.',
    goalEn:
      '§ 3.8 (pp. 130–132): symmetrical and mixed ethers, divinyl ether, oxirane, anisole, isomers of C₄H₁₀O; the Williamson synthesis, the ethyl hydrogen sulfate route, the oxonium salt and cleavage by HI.',
    goalUz:
      '§ 3.8 (130–132-betlar): simmetrik va aralash efirlar, divinil efiri, oksiran, anizol, C₄H₁₀O izomerlari; Uilyamson sintezi, etilsulfat kislota orqali olish, oksoniy tuzi va HI bilan parchalanish.',
    classId: 'ether',
    challengeIds: [
      'dimethyl-ether',
      'diethyl-ether',
      'methoxyethane',
      'methyl-propyl-ether',
      'divinyl-ether',
      'ethylene-oxide',
      'anisole',
      'n-butanol',
      'butyl-isopropyl-ether',
      'propan-2-ol',
      'ethanol',
      'methanol',
      'chloromethane',
    ],
    equationIds: [
      'g10c3-williamson',
      'g10c3-etoh-h2so4',
      'g10c3-ether-stage2',
      'g10c3-ether-mixed',
      'g10c3-etoh-ether-al2o3',
      'g10c3-oxonium',
      'g10c3-ether-hi',
    ],
    isomerChallengeIds: ['c4h10o-textbook', 'c4h10o'],
    nomenclatureQuizId: 'g10-ch3-ethers',
    defaultMolId: 'diethyl-ether',
  }),
  L({
    id: 'aldehydes',
    chapter: 3,
    titleRu: 'Альдегиды',
    titleEn: 'Aldehydes',
    titleUz: 'Aldegidlar',
    goalRu:
      '§ 3.9–3.10 (с. 133–136): ряд альдегидов, получение (CuO, Кучеров, 1,1-дихлорэтан), гидрирование, «серебряное зеркало», Cu(OH)₂ → CuOH → Cu₂O (в учебнике — «красная медь»), фенолформальдегидная смола, практическое занятие с. 136.',
    goalEn:
      '§ 3.9–3.10 (pp. 133–136): the aldehyde series, preparation (CuO, Kucherov, 1,1-dichloroethane), hydrogenation, the “silver mirror”, Cu(OH)₂ → CuOH → Cu₂O (the textbook says “red copper”), phenol-formaldehyde resin, practical work of p. 136.',
    goalUz:
      '§ 3.9–3.10 (133–136-betlar): aldegidlar qatori, olinishi (CuO, Kucherov, 1,1-dixloretan), gidrogenlash, «kumush koʻzgu», Cu(OH)₂ → CuOH → Cu₂O (darslikda «qizil mis»), fenolformaldegid smolasi, 136-bet amaliy mashgʻuloti.',
    classId: 'aldehyde',
    challengeIds: [
      'formaldehyde',
      'acetaldehyde',
      'propanal',
      'butanal',
      'isobutanal',
      'pentanal',
      'methanol',
      'acetylene',
      'vinyl-alcohol',
      '1-1-dichloroethane',
      'propanol',
      'propanoic-acid',
      'acetic-acid',
      'formic-acid',
      'phenol',
      'dihydroxydiphenylmethane',
      'glycerol',
    ],
    equationIds: [
      'g10c3-meoh-cuo',
      'g10c3-kucherov',
      'g10c3-dichloroethane-naoh',
      'g10c3-propanal-h2',
      'g10c3-propanal-ag2o',
      'g10c3-acetaldehyde-cuoh2',
      'g10c3-cuoh-cu2o',
      'g10c3-phenol-formaldehyde',
      'g10c3-cuso4-naoh',
      'g10c3-glycerol-cuoh2',
      'g10c3-formalin-cuoh2',
    ],
    nomenclatureQuizId: 'g10-ch3-aldehydes',
    defaultMolId: 'acetaldehyde',
  }),
  L({
    id: 'ketones',
    chapter: 3,
    titleRu: 'Кетоны',
    titleEn: 'Ketones',
    titleUz: 'Ketonlar',
    goalRu:
      '§ 3.11 (с. 137–138): ацетон и гомологи (метилэтил-, диэтил-, метилпропилкетон), изомерия с альдегидами (C₃H₆O); получение из алкинов, 2,2-дихлорпропана, ацетата кальция и уксусной кислоты; гидрирование.',
    goalEn:
      '§ 3.11 (pp. 137–138): acetone and its homologues (methyl ethyl, diethyl, methyl propyl ketone), isomerism with aldehydes (C₃H₆O); preparation from alkynes, 2,2-dichloropropane, calcium acetate and acetic acid; hydrogenation.',
    goalUz:
      '§ 3.11 (137–138-betlar): atseton va gomologlari (metiletil-, dietil-, metilpropilketon), aldegidlar bilan izomeriya (C₃H₆O); alkinlardan, 2,2-dixlorpropandan, kalsiy atsetatdan va sirka kislotadan olinishi; gidrogenlash.',
    classId: 'ketone',
    challengeIds: [
      'acetone',
      'butanone',
      'pentan-3-one',
      'pentan-2-one',
      'propanal',
      'propyne',
      '2-2-dichloropropane',
      'propan-2-ol',
      'acetic-acid',
    ],
    equationIds: [
      'g10c3-propyne-h2o',
      'g10c3-dichloropropane-h2o',
      'g10c3-acetone-h2',
      'g10c3-ca-acetate',
      'g10c3-acetic-acetone',
    ],
    isomerChallengeIds: ['c3h6o-carbonyl'],
    nomenclatureQuizId: 'g10-ch3-ketones',
    defaultMolId: 'acetone',
  }),
  L({
    id: 'acids',
    chapter: 3,
    titleRu: 'Карбоновые кислоты',
    titleEn: 'Carboxylic acids',
    titleUz: 'Karbon kislotalar',
    goalRu:
      '§ 3.12–3.13 (с. 140–142): ряд кислот (тривиальные и систематические названия), 2-метилбутановая кислота, водородные связи в димере; получение и свойства — металлы, щёлочи, оксиды, «серебряное зеркало» муравьиной кислоты, хлоруксусные кислоты (в учебнике — «хлорические»).',
    goalEn:
      '§ 3.12–3.13 (pp. 140–142): the acid series (trivial and systematic names), 2-methylbutanoic acid, hydrogen bonds in the dimer; preparation and properties — metals, alkalis, oxides, the “silver mirror” of formic acid, the chloroacetic acids (misnamed in the textbook).',
    goalUz:
      '§ 3.12–3.13 (140–142-betlar): kislotalar qatori (trivial va sistematik nomlar), 2-metilbutan kislota, dimerdagi vodorod bogʻlar; olinishi va xossalari — metallar, ishqorlar, oksidlar, chumoli kislotaning «kumush koʻzgusi», xlorsirka kislotalar (darslikda nomi xato).',
    classId: 'acid',
    challengeIds: [
      'formic-acid',
      'acetic-acid',
      'propanoic-acid',
      'butanoic-acid',
      'pentanoic-acid',
      'hexanoic-acid',
      'palmitic-acid',
      'stearic-acid',
      '2-methylbutanoic-acid',
      'chloroacetic-acid',
      'dichloroacetic-acid',
      'trichloroacetic-acid',
      'ethanol',
      'acetaldehyde',
      'ethyl-acetate',
      'glycerol',
    ],
    equationIds: [
      'g10c3-etoh-cuo',
      'g10c3-acetaldehyde-o2',
      'g10c3-ester-hydrolysis-141',
      'g10c3-butanoate-h2so4',
      'g10c3-acetic-na',
      'g10c3-propanoic-naoh',
      'g10c3-acetic-mgo',
      'g10c3-etoh-acetic',
      'g10c3-formic-ag2o',
      'g10c3-acetic-cl2',
      'g10c3-chloroacetic-cl2',
      'g10c3-dichloroacetic-cl2',
      'g10c3-tristearin-synth',
    ],
    nomenclatureQuizId: 'g10-ch3-acids',
    defaultMolId: 'acetic-acid',
  }),
  L({
    id: 'esters',
    chapter: 3,
    titleRu: 'Сложные эфиры',
    titleEn: 'Esters',
    titleUz: 'Murakkab efirlar',
    goalRu:
      '§ 3.14–3.15 (с. 146–149): названия сложных эфиров с исправлениями учебника (бутилпропионат, этилбутират, «пентилметионат»), изомерия C₆H₁₂O₂ и C₂H₄O₂, фруктовые эфиры; этерификация, кислотный (⇄) и щелочной (→) гидролиз, задания с. 149.',
    goalEn:
      '§ 3.14–3.15 (pp. 146–149): ester names with the textbook’s errors fixed (butyl propionate, ethyl butyrate, “pentyl methionate”), isomerism of C₆H₁₂O₂ and C₂H₄O₂, fruit esters; esterification, acid (⇄) and alkaline (→) hydrolysis, tasks of p. 149.',
    goalUz:
      '§ 3.14–3.15 (146–149-betlar): murakkab efirlar nomlari, darslik xatolari tuzatilgan (butilpropionat, etilbutirat, «pentilmetionat»), C₆H₁₂O₂ va C₂H₄O₂ izomeriyasi, meva efirlari; eterifikatsiya, kislotali (⇄) va ishqoriy (→) gidroliz, 149-bet topshiriqlari.',
    classId: 'ester',
    challengeIds: [
      'ethyl-acetate',
      'methyl-formate',
      'ethyl-formate',
      'methyl-acetate',
      'methyl-propionate',
      'butyl-acetate',
      'butyl-propionate',
      'ethyl-isobutyrate',
      'ethyl-butyrate',
      'propyl-propionate',
      'isopropyl-propionate',
      'isoamyl-acetate',
      'pentyl-formate',
      'acetic-acid',
      'hexanoic-acid',
      'methanol',
      'ethanol',
    ],
    equationIds: [
      'g10c3-esterification-147',
      'g10c3-ethyl-acetate-h2o',
      'g10c3-ethyl-acetate-naoh',
      'g10c3-task3-a',
      'g10c3-task3-b',
      'g10c3-phenol-naoh',
    ],
    isomerChallengeIds: ['c6h12o2-esters', 'c2h4o2'],
    nomenclatureQuizId: 'g10-ch3-esters',
    defaultMolId: 'ethyl-acetate',
  }),
  L({
    id: 'fats',
    chapter: 3,
    titleRu: 'Жиры и мыло',
    titleEn: 'Fats and soap',
    titleUz: 'Yogʻlar va sovun',
    goalRu:
      '§ 3.16–3.17 (с. 152–155): насыщенные и ненасыщенные жирные кислоты, тристеарин, триолеин, трипальмитин; кислотный гидролиз (с исправленным коэффициентом), омыление, гидрогенизация, реакция Бертло, практическое занятие с. 155.',
    goalEn:
      '§ 3.16–3.17 (pp. 152–155): saturated and unsaturated fatty acids, tristearin, triolein, tripalmitin; acid hydrolysis (coefficient corrected), saponification, hydrogenation, the Berthelot reaction, practical work of p. 155.',
    goalUz:
      '§ 3.16–3.17 (152–155-betlar): toʻyingan va toʻyinmagan yogʻ kislotalar, tristearin, triolein, tripalmitin; kislotali gidroliz (koeffitsiyent tuzatilgan), sovunlanish, gidrogenlash, Bertlo reaksiyasi, 155-bet amaliy mashgʻuloti.',
    classId: 'ester',
    challengeIds: [
      'tristearin',
      'triolein',
      'tripalmitin',
      'stearic-acid',
      'margaric-acid',
      'palmitic-acid',
      'hexanoic-acid',
      'butanoic-acid',
      'palmitoleic-acid',
      'oleic-acid',
      'linoleic-acid',
      'linolenic-acid',
      'glycerol',
      'triacetin',
    ],
    equationIds: [
      'g10c3-fat-acid-hydrolysis',
      'g10c3-tristearin-naoh',
      'g10c3-triolein-h2',
      'g10c3-berthelot',
      'g10c3-tripalmitin-naoh',
      'g10c3-stearate-h2so4',
      'g10c3-soap-hydrolysis',
    ],
    nomenclatureQuizId: 'g10-ch3-fats',
    defaultMolId: 'tristearin',
  }),
  L({
    id: 'carbohydrates',
    chapter: 3,
    titleRu: 'Моносахариды',
    titleEn: 'Monosaccharides',
    titleUz: 'Monosaxaridlar',
    goalRu: 'Сравнить глюкозу и фруктозу; уравнения брожения и окисления.',
    goalEn: 'Compare glucose and fructose; fermentation and oxidation equations.',
    goalUz: 'Glyukoza va fruktozani solishtiring; fermentatsiya va oksidlanish tenglamalari.',
    classId: 'carb',
    challengeIds: ['glucose-open', 'glucose-pyranose', 'fructose'],
    equationIds: ['g10-carb-ferment', 'g10-carb-burn'],
    defaultMolId: 'glucose-pyranose',
  }),
  L({
    id: 'disaccharides',
    chapter: 3,
    titleRu: 'Ди- и полисахариды',
    titleEn: 'Di- and polysaccharides',
    titleUz: 'Di- va polisaxaridlar',
    goalRu: 'Увидеть сахарозу и уравнение гидролиза (путь к крахмалу и целлюлозе).',
    goalEn: 'See sucrose and its hydrolysis (path to starch and cellulose).',
    goalUz: 'Saxarozani va gidroliz tenglamasini koʻring (kraxmal va tsellyuloza yoʻli).',
    classId: 'carb',
    challengeIds: ['sucrose', 'glucose-pyranose', 'fructose'],
    equationIds: ['g10-carb-sucrose'],
    defaultMolId: 'sucrose',
  }),
  L({
    id: 'nitrogen',
    chapter: 3,
    titleRu: 'Азотсодержащие',
    titleEn: 'Nitrogen compounds',
    titleUz: 'Azotli birikmalar',
    goalRu: 'Собрать метиламин и анилин.',
    goalEn: 'Build methylamine and aniline.',
    goalUz: 'Metilamin va anilinni yigʻing.',
    classId: 'nitrogen',
    challengeIds: ['methylamine', 'aniline'],
    equationIds: ['g10-amine-nh3-rx', 'g10-nitro-aniline'],
    defaultMolId: 'aniline',
  }),
  L({
    id: 'industry-env',
    chapter: 4,
    titleRu: 'Промышленность и отходы',
    titleEn: 'Industry and waste',
    titleUz: 'Sanoat va chiqindilar',
    goalRu: 'Связать полимеры и переработку с уравнениями крекинга и полиэтилена.',
    goalEn: 'Link polymers and recycling to cracking and polyethylene equations.',
    goalUz: 'Polimerlar va qayta ishlashni kreking va polietilen tenglamalari bilan bogʻlang.',
    classId: 'all',
    challengeIds: ['ethylene', 'styrene', 'benzene', 'ethanol'],
    equationIds: ['g10-alkene-pe', 'g10-styrene-poly', 'g10-alkane-cracking'],
    defaultMolId: 'ethylene',
  }),
]

export const ORGANIC_CURRICULUM_BY_ID: Readonly<Record<string, OrganicLesson>> = Object.fromEntries(
  ORGANIC_CURRICULUM.map((l) => [l.id, l]),
)

export const ORGANIC_CHAPTER_LABELS: Record<
  1 | 2 | 3 | 4,
  { ru: string; en: string; uz: string }
> = {
  1: {
    ru: 'I. Теория строения',
    en: 'I. Structure theory',
    uz: 'I. Tuzilish nazariyasi',
  },
  2: {
    ru: 'II. Углеводороды',
    en: 'II. Hydrocarbons',
    uz: 'II. Uglevodorodlar',
  },
  3: {
    ru: 'III. Кислород- и N-соединения',
    en: 'III. O- and N-compounds',
    uz: 'III. O- va N-birikmalar',
  },
  4: {
    ru: 'IV. Промышленность и среда',
    en: 'IV. Industry and environment',
    uz: 'IV. Sanoat va muhit',
  },
}

export function pickLessonTitle(lesson: OrganicLesson, locale: string): string {
  if (locale === 'en') return lesson.titleEn
  if (locale === 'uz') return lesson.titleUz
  return lesson.titleRu
}

export function pickLessonGoal(lesson: OrganicLesson, locale: string): string {
  if (locale === 'en') return lesson.goalEn
  if (locale === 'uz') return lesson.goalUz
  return lesson.goalRu
}

export function pickChapterLabel(chapter: 1 | 2 | 3 | 4, locale: string): string {
  const Lbl = ORGANIC_CHAPTER_LABELS[chapter]
  if (locale === 'en') return Lbl.en
  if (locale === 'uz') return Lbl.uz
  return Lbl.ru
}

export function lessonsByChapter(chapter: 1 | 2 | 3 | 4): OrganicLesson[] {
  return ORGANIC_CURRICULUM.filter((l) => l.chapter === chapter)
}

/** Урок по ID challenge / mol (первая подходящая запись программы). */
export function lessonForMoleculeId(molId: string): OrganicLesson | undefined {
  return ORGANIC_CURRICULUM.find((l) => l.challengeIds.includes(molId))
}

export function lessonForChallengeId(challengeId: string): OrganicLesson | undefined {
  return lessonForMoleculeId(challengeId)
}

/**
 * Маппинг Learn g10 chapter (+ опционально section) → ближайший урок лаборатории.
 */
export function resolveOrganicLessonFromLearn(
  chapter: number,
  section?: number,
): OrganicLesson {
  const ch = Math.min(4, Math.max(1, Math.floor(chapter))) as 1 | 2 | 3 | 4
  const s = section != null && Number.isFinite(section) ? Math.floor(section) : undefined

  if (ch === 1) {
    if (s == null) return ORGANIC_CURRICULUM_BY_ID['intro-structure']!
    if (s <= 3) return ORGANIC_CURRICULUM_BY_ID['intro-structure']!
    if (s <= 4) return ORGANIC_CURRICULUM_BY_ID['isomers']!
    if (s === 6) return ORGANIC_CURRICULUM_BY_ID['reaction-types']!
    if (s <= 8) return ORGANIC_CURRICULUM_BY_ID['nomenclature']!
    return ORGANIC_CURRICULUM_BY_ID['intro-structure']!
  }

  if (ch === 2) {
    if (s == null) return ORGANIC_CURRICULUM_BY_ID['alkanes']!
    if (s <= 4) return ORGANIC_CURRICULUM_BY_ID['alkanes']!
    if (s <= 6) return ORGANIC_CURRICULUM_BY_ID['cycloalkanes']!
    if (s <= 9) return ORGANIC_CURRICULUM_BY_ID['alkenes']!
    if (s <= 12) return ORGANIC_CURRICULUM_BY_ID['alkadienes']!
    if (s <= 14) return ORGANIC_CURRICULUM_BY_ID['alkynes']!
    if (s <= 17) return ORGANIC_CURRICULUM_BY_ID['arenes']!
    return ORGANIC_CURRICULUM_BY_ID['sources-oil']!
  }

  if (ch === 3) {
    if (s == null) return ORGANIC_CURRICULUM_BY_ID['alcohols']!
    if (s <= 2) return ORGANIC_CURRICULUM_BY_ID['alcohols']!
    if (s <= 5) return ORGANIC_CURRICULUM_BY_ID['polyols']!
    if (s <= 7) return ORGANIC_CURRICULUM_BY_ID['phenols']!
    if (s <= 8) return ORGANIC_CURRICULUM_BY_ID['ethers']!
    if (s <= 10) return ORGANIC_CURRICULUM_BY_ID['aldehydes']!
    if (s <= 11) return ORGANIC_CURRICULUM_BY_ID['ketones']!
    if (s <= 13) return ORGANIC_CURRICULUM_BY_ID['acids']!
    if (s <= 15) return ORGANIC_CURRICULUM_BY_ID['esters']!
    if (s <= 17) return ORGANIC_CURRICULUM_BY_ID['fats']!
    if (s <= 18) return ORGANIC_CURRICULUM_BY_ID['carbohydrates']!
    if (s <= 21) return ORGANIC_CURRICULUM_BY_ID['disaccharides']!
    return ORGANIC_CURRICULUM_BY_ID['nitrogen']!
  }

  return ORGANIC_CURRICULUM_BY_ID['industry-env']!
}

/** Валидные equationIds урока (отфильтровать устаревшие). */
export function equationsForLesson(lesson: OrganicLesson) {
  const set = new Set(lesson.equationIds)
  return G10_G11_EDU_EQUATIONS.filter((e) => set.has(e.id))
}

export function defaultMolForLesson(lesson: OrganicLesson): string {
  if (organicMoleculeById[lesson.defaultMolId]) return lesson.defaultMolId
  for (const id of lesson.challengeIds) {
    if (organicMoleculeById[id]) return id
  }
  return 'methane'
}

export function lessonHasBuild(lesson: OrganicLesson): boolean {
  return lesson.challengeIds.some((id) => !VIEW_ONLY.has(id) && organicMoleculeById[id]?.challengeId)
}

export function lessonHasEquation(lesson: OrganicLesson): boolean {
  return lesson.equationIds.length > 0
}

export function lessonHasIsomer(lesson: OrganicLesson): boolean {
  return lesson.isomerChallengeIds.length > 0
}

export function lessonHasName(lesson: OrganicLesson): boolean {
  return Boolean(lesson.nomenclatureQuizId)
}
