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
      'Молекулы § 2.5–2.6 (с. 52–55), изомеры C₄H₈ и C₅H₁₀ с кольцом; получение циклоалканов, раскрытие малых колец, замещение у циклогексана и его дегидрирование в бензол (с. 55). Агрегатное состояние зависит от числа атомов C: циклопропан и циклобутан — газы, циклопентан и циклогексан — жидкости.',
    goalEn:
      'Molecules of § 2.5–2.6 (pp. 52–55), ring isomers of C₄H₈ and C₅H₁₀; making cycloalkanes, opening small rings, substitution in cyclohexane and its dehydrogenation to benzene (p. 55). The physical state depends on the number of C atoms: cyclopropane and cyclobutane are gases, cyclopentane and cyclohexane are liquids.',
    goalUz:
      '§ 2.5–2.6 molekulalari (52–55-betlar), C₄H₈ va C₅H₁₀ ning halqali izomerlari; tsikloalkanlarning olinishi, kichik halqalarning ochilishi, tsiklogeksanda oʻrin olish va uning benzolga degidrogenlanishi (55-bet). Agregat holat C atomlari soniga bogʻliq: tsiklopropan va tsiklobutan — gazlar, tsiklopentan va tsiklogeksan — suyuqliklar.',
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
      'g10-cyc-c6h12-dehydro',
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
    goalRu:
      '§ 2.7–2.9 (с. 57–62): гомологический ряд CₙH₂ₙ (C₂H₄ … C₇H₁₄), изомерия скелета и положения двойной связи, цис- и транс-бутен-2; присоединение H₂, Br₂, HBr (правило Марковникова), окисление KMnO₄ и полимеризация; получение этилена и схема его применения (с. 61); качественные реакции — бромная вода и KMnO₄.',
    goalEn:
      '§ 2.7–2.9 (pp. 57–62): the CₙH₂ₙ series (C₂H₄ … C₇H₁₄), skeletal and double-bond-position isomerism, cis- and trans-but-2-ene; adding H₂, Br₂, HBr (Markovnikov’s rule), KMnO₄ oxidation and polymerization; making ethylene and its uses scheme (p. 61); tests — bromine water and KMnO₄.',
    goalUz:
      '§ 2.7–2.9 (57–62-betlar): CₙH₂ₙ gomologik qatori (C₂H₄ … C₇H₁₄), skelet va qoʻsh bogʻ holati izomeriyasi, sis- va trans-buten-2; H₂, Br₂, HBr birikishi (Markovnikov qoidasi), KMnO₄ bilan oksidlanish va polimerlanish; etilenning olinishi va qoʻllanilish sxemasi (61-bet); sifat reaksiyalari — bromli suv va KMnO₄.',
    classId: 'alkene',
    challengeIds: [
      'ethylene',
      'propene',
      'but-1-ene',
      'pent-1-ene',
      'hex-1-ene',
      'hept-1-ene',
      '3-methylbut-1-ene',
      '4-4-dimethylpent-2-ene',
      'isobutylene',
      '2-methylbut-1-ene',
      'cis-but-2-ene',
      'trans-but-2-ene',
      'pent-2-ene',
      '2-methylbut-2-ene',
      '2-2-dimethylhept-3-ene',
      '1-2-dibromoethane',
      'bromoethane',
      '2-bromopropane',
      'ethylene-glycol',
      '1-2-dibromopropane',
      '1-chloropropane',
      'chloroethane',
      'ethanol',
      '1-2-dichloroethane',
      'ethylene-oxide',
    ],
    equationIds: [
      'g10-ale-c2h4-h2',
      'g10-ale-c2h4-br2',
      'g10-ale-c2h4-hbr',
      'g10-ale-markovnikov',
      'g10-ale-wagner',
      'g10-ale-pe',
      'g10-ale-etoh-dehydr',
      'g10-ale-ch4-c2h4',
      'g10-ale-c2h6-dehydro',
      'g10-ale-zn',
      'g10-ale-c3h7cl-koh',
      'g10-ale-s61-hcl',
      'g10-ale-s61-h2o',
      'g10-ale-s61-cl2',
      'g10-ale-s61-o2',
      'g10-ale-kmno4-acid',
    ],
    isomerChallengeIds: ['c4h8-alkene', 'c5h10-alkene'],
    nomenclatureQuizId: 'g10-alkenes-p59',
    defaultMolId: 'ethylene',
  }),
  L({
    id: 'alkadienes',
    chapter: 2,
    titleRu: 'Алкадиены и каучук',
    titleEn: 'Alkadienes and rubber',
    titleUz: 'Alkadiyenlar va kauchuk',
    goalRu:
      '§ 2.10–2.12 (с. 63–70): кумулированные (аллен), сопряжённые и изолированные диены, изомеры C₅H₈ и C₄H₆; получение бутадиена, 1,2- и 1,4-присоединение брома, гидрирование, горение; каучуки — полибутадиен, полиизопрен, хлоропреновый, бутадиен-стирольный; вулканизация (с. 69): сера сшивает цепи мостиками по двойным связям.',
    goalEn:
      '§ 2.10–2.12 (pp. 63–70): cumulated (allene), conjugated and isolated dienes, isomers of C₅H₈ and C₄H₆; making butadiene, 1,2- and 1,4-addition of bromine, hydrogenation, combustion; rubbers — polybutadiene, polyisoprene, chloroprene, styrene–butadiene; vulcanization (p. 69): sulfur cross-links the chains at the double bonds.',
    goalUz:
      '§ 2.10–2.12 (63–70-betlar): kumulyatsiyalangan (allen), tutash va izolyatsiyalangan diyenlar, C₅H₈ va C₄H₆ izomerlari; butadiyenning olinishi, bromning 1,2- va 1,4-birikishi, gidrogenlash, yonish; kauchuklar — polibutadiyen, poliizopren, xloropren, butadiyen-stirol; vulkanizatsiya (69-bet): oltingugurt zanjirlarni qoʻsh bogʻlar boʻyicha tikadi.',
    classId: 'alkadiene',
    challengeIds: [
      'butadiene',
      'propadiene',
      'hexa-1-5-diene',
      'buta-1-2-diene',
      'penta-1-2-diene',
      'cis-penta-1-3-diene',
      'trans-penta-1-3-diene',
      'penta-1-4-diene',
      'isoprene',
      '3-methylhexa-1-5-diene',
      '3-methylbuta-1-2-diene',
      'but-2-yne',
      'chloroprene',
      '1-4-dibromobut-2-ene',
      '3-4-dibromobut-1-ene',
      'n-butane',
      'ethanol',
      'styrene',
    ],
    equationIds: [
      'g10-dien-lebedev',
      'g10-dien-butane',
      'g10-dien-br2-14',
      'g10-dien-br2-12',
      'g10-dien-h2',
      'g10-dien-c3h4-burn',
      'g10-dien-pbd',
      'g10-dien-pbd-cis',
      'g10-dien-pip',
      'g10-dien-cr',
      'g10-dien-pip-70',
      'g10-dien-cr-70',
      'g10-dien-sbr',
    ],
    isomerChallengeIds: ['c5h8-diene', 'c4h6'],
    nomenclatureQuizId: 'g10-alkadienes',
    defaultMolId: 'butadiene',
  }),
  L({
    id: 'alkynes',
    chapter: 2,
    titleRu: 'Алкины',
    titleEn: 'Alkynes',
    titleUz: 'Alkinlar',
    goalRu:
      '§ 2.13–2.14 (с. 72–75): ряд CₙH₂ₙ₋₂ (ацетилен, метил-, этил-, диметилацетилен…), изомеры C₄H₆, C₅H₈ и задание с. 73 про C₇H₁₂, межклассовая изомерия с диенами; линейный фрагмент C–C≡C–C — цис/транс нет; получение ацетилена, реакции Кучерова и Зелинского, горение, окисление KMnO₄ (в учебнике опечатка «+ 2H₂» — верно 2H₂O).',
    goalEn:
      '§ 2.13–2.14 (pp. 72–75): the CₙH₂ₙ₋₂ series (acetylene, methyl-, ethyl-, dimethylacetylene…), isomers of C₄H₆, C₅H₈ and the p. 73 task on C₇H₁₂, interclass isomerism with dienes; the linear C–C≡C–C unit — no cis/trans; making acetylene, the Kucherov and Zelinsky reactions, combustion, KMnO₄ oxidation (the textbook misprints “+ 2H₂” — it is 2H₂O).',
    goalUz:
      '§ 2.13–2.14 (72–75-betlar): CₙH₂ₙ₋₂ qatori (atsetilen, metil-, etil-, dimetilatsetilen…), C₄H₆, C₅H₈ izomerlari va 73-betdagi C₇H₁₂ topshirigʻi, diyenlar bilan sinflararo izomeriya; chiziqli C–C≡C–C fragmenti — sis/trans yoʻq; atsetilenning olinishi, Kucherov va Zelinskiy reaksiyalari, yonish, KMnO₄ bilan oksidlanish (darslikda xato «+ 2H₂» — toʻgʻrisi 2H₂O).',
    classId: 'alkyne',
    challengeIds: [
      'acetylene',
      'propyne',
      'but-1-yne',
      'but-2-yne',
      'pent-1-yne',
      'pent-2-yne',
      '3-methylbut-1-yne',
      'hex-1-yne',
      'hept-1-yne',
      'hept-2-yne',
      'hept-3-yne',
      '3-methylhex-1-yne',
      '4-4-dimethylpent-2-yne',
      'propadiene',
      'butadiene',
      'acetaldehyde',
      'benzene',
    ],
    equationIds: [
      'g10-alky-carbide',
      'g10-alky-ch4',
      'g10-alky-kucherov',
      'g10-alky-trimer',
      'g10-alky-c3h4-burn',
      'g10-alky-c5h8-burn',
      'g10-alky-kmno4',
    ],
    isomerChallengeIds: ['c4h6', 'c5h8-alkyne', 'c7h12-alkyne'],
    nomenclatureQuizId: 'g10-alkynes',
    defaultMolId: 'acetylene',
  }),
  L({
    id: 'arenes',
    chapter: 2,
    titleRu: 'Арены',
    titleEn: 'Arenes',
    titleUz: 'Arenlar',
    goalRu:
      '§ 2.15–2.17 (с. 77–83): бензол (sp², единая 6π-система) и гомологи, о-, м-, п-ксилолы; получение аренов, замещение в кольце (бромирование, нитрование, тротил), окисление боковой цепи толуола, присоединение H₂ и Cl₂; стирол — присоединение по винильной группе, окисление KMnO₄, полимеризация; стирол получают дегидрированием этилбензола (в учебнике ошибочно «гидрированием»).',
    goalEn:
      '§ 2.15–2.17 (pp. 77–83): benzene (sp², one 6π system) and its homologues, o-, m-, p-xylenes; making arenes, ring substitution (bromination, nitration, TNT), oxidation of the toluene side chain, adding H₂ and Cl₂; styrene — addition at the vinyl group, KMnO₄ oxidation, polymerization; styrene is made by dehydrogenating ethylbenzene (the textbook wrongly says “hydrogenating”).',
    goalUz:
      '§ 2.15–2.17 (77–83-betlar): benzol (sp², yagona 6π-tizim) va gomologlari, o-, m-, p-ksilollar; arenlarning olinishi, halqada oʻrin olish (bromlash, nitrolash, trotil), toluol yon zanjirining oksidlanishi, H₂ va Cl₂ birikishi; stirol — vinil guruhiga birikish, KMnO₄ bilan oksidlanish, polimerlanish; stirol etilbenzolni degidrogenlab olinadi (darslikda xato «gidrogenlab»).',
    classId: 'arene',
    challengeIds: [
      'benzene',
      'toluene',
      'ethylbenzene',
      'o-xylene',
      'm-xylene',
      'p-xylene',
      'cyclohexane',
      'methylcyclohexane',
      'bromobenzene',
      '2-4-6-tribromotoluene',
      'benzoic-acid',
      'hexachlorocyclohexane',
      'styrene',
      '1-2-dichloroethylbenzene',
      '1-chloroethylbenzene',
      '1-phenylethanol',
      '1-phenylethane-1-2-diol',
      'acetylene',
      'biphenyl',
      'diphenylmethane',
      'triphenylmethane',
      'naphthalene',
      'anthracene',
    ],
    equationIds: [
      'g10-aren-c6h12-dehydro',
      'g10-aren-toluene',
      'g10-aren-trimer',
      'g10-aren-br2',
      'g10-aren-hno3',
      'g10-aren-tnt',
      'g10-aren-tol-br3',
      'g10-aren-tol-kmno4',
      'g10-aren-cl2-uv',
      'g10-arene-h2',
      'g10-sty-h2',
      'g10-sty-cl2',
      'g10-sty-hcl',
      'g10-sty-h2o',
      'g10-sty-poly',
      'g10-sty-burn',
      'g10-sty-kmno4-acid',
      'g10-sty-kmno4-neutral',
      'g10-sty-kmno4-cold',
      'g10-sty-from-eb',
      'g10-sty-from-benzene',
    ],
    isomerChallengeIds: ['c8h10-arene'],
    nomenclatureQuizId: 'g10-arenes',
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
    goalRu:
      '§ 2.18–2.22 (с. 87–95): природный газ, нефть и уголь как сырьё; задачи с. 87 (сжигание метана, ацетилен из метана), крекинг (с. 47, 50); практическое занятие с. 95 — шаростержневые модели углеводородов, их названия и молярные массы.',
    goalEn:
      '§ 2.18–2.22 (pp. 87–95): natural gas, oil and coal as feedstock; the p. 87 tasks (burning methane, acetylene from methane), cracking (pp. 47, 50); the p. 95 practical — ball-and-stick models of hydrocarbons, their names and molar masses.',
    goalUz:
      '§ 2.18–2.22 (87–95-betlar): tabiiy gaz, neft va koʻmir xomashyo sifatida; 87-bet masalalari (metanning yonishi, metandan atsetilen), kreking (47, 50-betlar); 95-betdagi amaliy mashgʻulot — uglevodorodlarning shar-sterjenli modellari, nomlari va molyar massalari.',
    classId: 'all',
    challengeIds: [
      'methane',
      'ethane',
      'propane',
      'n-butane',
      'acetylene',
      '2-methylpent-2-ene',
      '3-3-dimethylbut-1-yne',
      'but-2-ene',
      '3-3-dimethylpent-1-ene',
      'isobutane',
      'cyclobutane',
      'neopentane',
      '3-3-dimethylbut-1-ene',
      '2-methylbut-1-ene',
      'propyne',
      '1-2-dichloroethane',
      '2-3-dimethylhexane',
      'cyclopentane',
      '2-methylbut-2-ene',
      '3-4-dimethylpent-1-ene',
    ],
    equationIds: ['g10-src-ch4-burn', 'g10-src-ch4-c2h2', 'g10-alk-crack-octane', 'g10-alk-decane-crack-p50'],
    nomenclatureQuizId: 'g10-sources-tasks',
    defaultMolId: 'methane',
  }),
  L({
    id: 'ch2-summary',
    chapter: 2,
    titleRu: 'Итог главы II: взаимосвязь углеводородов',
    titleEn: 'Chapter II summary: how hydrocarbons are linked',
    titleUz: 'II bob yakuni: uglevodorodlarning oʻzaro bogʻliqligi',
    goalRu:
      '§ 2.23 (с. 100–102): таблица классов углеводородов (в учебнике строки перепутаны — показана исправленной в квизе), цепочка пропан → X₁ … X₅ и задание 1 — цепочки a)–d); опечатки словесных цепочек с. 101 («карбид кальция → этен» — верно этин; повтор «этен → этен»).',
    goalEn:
      '§ 2.23 (pp. 100–102): the table of hydrocarbon classes (the textbook mixes up rows — shown corrected in the quiz), the chain propane → X₁ … X₅ and task 1 — chains a)–d); typos in the word chains on p. 101 (“calcium carbide → ethene” should be ethyne; the repeated “ethene → ethene”).',
    goalUz:
      '§ 2.23 (100–102-betlar): uglevodorod sinflari jadvali (darslikda qatorlar almashib ketgan — kvizda tuzatilgan), propan → X₁ … X₅ zanjiri va 1-topshiriq — a)–d) zanjirlar; 101-betdagi soʻzli zanjirlardagi xatolar («kalsiy karbid → eten» — toʻgʻrisi etin; «eten → eten» takrori).',
    classId: 'all',
    challengeIds: [
      'propane',
      '2-bromopropane',
      'propene',
      'benzene',
      'cumene',
      'benzoic-acid',
      'ethanol',
      'ethyl-benzoate',
      'acetylene',
      'acetaldehyde',
      'vinyl-chloride',
      'ethane',
      'chloroethane',
      'ethylene',
      '1-2-dichloroethane',
      'n-butane',
      'but-1-ene',
    ],
    equationIds: [
      'g10-sum-x1',
      'g10-sum-x2',
      'g10-sum-x3',
      'g10-sum-x4',
      'g10-sum-x5',
      'g10-sum-a1',
      'g10-sum-a2',
      'g10-sum-a3',
      'g10-sum-a4',
      'g10-sum-b1',
      'g10-sum-b2',
      'g10-sum-b3',
      'g10-sum-c1',
      'g10-sum-c2',
      'g10-sum-c3',
      'g10-sum-c4',
      'g10-sum-d4',
      'g10-sum-d5',
      'g10-sum-d6',
      'g10-sum-d7',
    ],
    nomenclatureQuizId: 'g10-ch2-summary',
    defaultMolId: 'cumene',
  }),
  L({
    id: 'alcohols',
    chapter: 3,
    titleRu: 'Спирты',
    titleEn: 'Alcohols',
    titleUz: 'Spirtlar',
    goalRu: 'Собрать спирты с группой –OH и уравнения реакций.',
    goalEn: 'Build alcohols with –OH and balance their reaction equations.',
    goalUz: '–OH guruhli spirtlarni yigʻing; reaksiya tenglamalarini tenglashtiring.',
    classId: 'alcohol',
    challengeIds: ['methanol', 'ethanol', 'propanol'],
    equationIds: ['g10-alcohol-meoh', 'g10-alcohol-na', 'g10-alcohol-hbr', 'g10-alkene-dehydration'],
    defaultMolId: 'ethanol',
  }),
  L({
    id: 'polyols',
    chapter: 3,
    titleRu: 'Многоатомные спирты',
    titleEn: 'Polyols',
    titleUz: 'Koʻp atomli spirtlar',
    goalRu: 'Сравнить этиленгликоль и глицерин; уравнение нитрования глицерина.',
    goalEn: 'Compare ethylene glycol and glycerol; balance glycerol nitration.',
    goalUz: 'Etilenglikol va glitserinni solishtiring; glitserin nitratlashini tenglashtiring.',
    classId: 'polyol',
    challengeIds: ['ethylene-glycol', 'glycerol'],
    equationIds: ['g10-polyol-hno3'],
    defaultMolId: 'glycerol',
  }),
  L({
    id: 'phenols',
    chapter: 3,
    titleRu: 'Фенолы',
    titleEn: 'Phenols',
    titleUz: 'Fenollar',
    goalRu: 'Увидеть фенольный гидроксил на арене.',
    goalEn: 'See the phenolic hydroxyl on an arene.',
    goalUz: 'Aren ustidagi fenol gidroksilini koʻring.',
    classId: 'phenol',
    challengeIds: ['phenol'],
    equationIds: ['g10-phenol-naoh'],
    defaultMolId: 'phenol',
  }),
  L({
    id: 'ethers',
    chapter: 3,
    titleRu: 'Простые эфиры',
    titleEn: 'Ethers',
    titleUz: 'Oddiy efirlar',
    goalRu: 'Собрать эфирную связь C–O–C; отличить от спирта.',
    goalEn: 'Build the C–O–C ether link; tell it apart from an alcohol.',
    goalUz: 'C–O–C efir bogʻini yigʻing; spirtdan ajrating.',
    classId: 'ether',
    challengeIds: ['dimethyl-ether', 'diethyl-ether'],
    equationIds: ['g10-ether-etoh'],
    isomerChallengeIds: ['c4h10o'],
    defaultMolId: 'diethyl-ether',
  }),
  L({
    id: 'aldehydes',
    chapter: 3,
    titleRu: 'Альдегиды',
    titleEn: 'Aldehydes',
    titleUz: 'Aldegidlar',
    goalRu: 'Собрать карбонильную группу альдегида.',
    goalEn: 'Build an aldehyde carbonyl group.',
    goalUz: 'Aldegid karbonil guruhini yigʻing.',
    classId: 'aldehyde',
    challengeIds: ['formaldehyde', 'acetaldehyde'],
    equationIds: ['g10-ald-ox', 'g10-ald-silver'],
    defaultMolId: 'acetaldehyde',
  }),
  L({
    id: 'ketones',
    chapter: 3,
    titleRu: 'Кетоны',
    titleEn: 'Ketones',
    titleUz: 'Ketonlar',
    goalRu: 'Собрать ацетон и уравнять гидрирование.',
    goalEn: 'Build acetone and balance its hydrogenation.',
    goalUz: 'Atseton yigʻing; gidrogenlashni tenglashtiring.',
    classId: 'ketone',
    challengeIds: ['acetone'],
    equationIds: ['g10-ketone-h2'],
    defaultMolId: 'acetone',
  }),
  L({
    id: 'acids',
    chapter: 3,
    titleRu: 'Карбоновые кислоты',
    titleEn: 'Carboxylic acids',
    titleUz: 'Karbon kislotalar',
    goalRu: 'Собрать карбоксильную группу и уравнение нейтрализации.',
    goalEn: 'Build a carboxyl group and a neutralization equation.',
    goalUz: 'Karboksil guruhini yigʻing; neytrallash tenglamasini bajaring.',
    classId: 'acid',
    challengeIds: ['formic-acid', 'acetic-acid'],
    equationIds: ['g10-acid-naoh'],
    defaultMolId: 'acetic-acid',
  }),
  L({
    id: 'esters',
    chapter: 3,
    titleRu: 'Сложные эфиры',
    titleEn: 'Esters',
    titleUz: 'Murakkab efirlar',
    goalRu: 'Собрать этилацетат; уравнения Фишера и гидролиза.',
    goalEn: 'Build ethyl acetate; practice Fischer and hydrolysis equations.',
    goalUz: 'Etilatsetat yigʻing; Fisher va gidroliz tenglamalarini bajaring.',
    classId: 'ester',
    challengeIds: ['ethyl-acetate'],
    equationIds: ['g10-ester-fischer', 'g10-ester-hydrolysis', 'g10-ester-sapon'],
    defaultMolId: 'ethyl-acetate',
  }),
  L({
    id: 'fats',
    chapter: 3,
    titleRu: 'Жиры и мыло',
    titleEn: 'Fats and soap',
    titleUz: 'Yogʻlar va sovun',
    goalRu: 'Осмотреть модель триглицерида и уравнять омыление.',
    goalEn: 'Inspect a triglyceride model and balance saponification.',
    goalUz: 'Triglisertid modelini koʻring; sovunlashni tenglashtiring.',
    classId: 'ester',
    challengeIds: ['triacetin', 'glycerol', 'ethyl-acetate'],
    equationIds: ['g10-fat-sapon', 'g10-ester-sapon'],
    defaultMolId: 'triacetin',
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
    if (s <= 22) return ORGANIC_CURRICULUM_BY_ID['sources-oil']!
    return ORGANIC_CURRICULUM_BY_ID['ch2-summary']!
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
