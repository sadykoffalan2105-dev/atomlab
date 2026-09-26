/**
 * Kimyo 10, глава III (§ 3.1–3.21): задания режима «Изомеры» по примерам учебника.
 * Источник — docs/textbook/g10-ch3-*.md. Кандидаты — молекулы органической лаборатории (id реестра).
 */
import type { IrPeak, IsomerCandidate, IsomerChallenge } from './researchLabData'

const OH: IrPeak = { wavenumber: 3350, intensity: 0.92, label: 'O–H' }
const CH: IrPeak = { wavenumber: 2920, intensity: 0.7, label: 'C–H' }
const CO: IrPeak = { wavenumber: 1100, intensity: 0.55, label: 'C–O' }
const CO_ETH: IrPeak = { wavenumber: 1120, intensity: 0.65, label: 'C–O (эфир)' }
const C_O: IrPeak = { wavenumber: 1720, intensity: 0.9, label: 'C=O' }
const AROM: IrPeak = { wavenumber: 1500, intensity: 0.5, label: 'Ar' }

const PALETTE = ['#7dd3fc', '#a5b4fc', '#c4b5fd', '#f0abfc', '#fda4af', '#fcd34d', '#86efac', '#5eead4', '#fdba74']

type Kind = 'alcohol' | 'ether' | 'carbonyl' | 'acid' | 'ester' | 'phenol'
const KIND: Record<Kind, { skeleton: IsomerCandidate['skeleton']; groups: string[]; ir: IrPeak[] }> = {
  alcohol: { skeleton: 'alcohol', groups: ['alcohol', 'OH'], ir: [OH, CH, CO] },
  ether: { skeleton: 'ether', groups: ['ether'], ir: [CH, CO_ETH] },
  carbonyl: { skeleton: 'n', groups: ['carbonyl'], ir: [CH, C_O] },
  acid: { skeleton: 'n', groups: ['acid', 'OH'], ir: [OH, C_O] },
  ester: { skeleton: 'n', groups: ['ester'], ir: [CH, C_O, CO_ETH] },
  phenol: { skeleton: 'ring', groups: ['phenol', 'OH'], ir: [OH, AROM] },
}

type Row = readonly [id: string, ru: string, en: string, uz: string, formula: string, correct: boolean, kind: Kind, noteRu: string, noteEn: string, noteUz: string]

function cands(rows: readonly Row[]): IsomerCandidate[] {
  return rows.map(([id, nameRu, nameEn, nameUz, formula, correct, kind, hazardRu, hazardEn, hazardUz], i) => ({
    id,
    nameRu,
    nameEn,
    nameUz,
    formula,
    correct,
    skeleton: KIND[kind].skeleton,
    functionalGroups: KIND[kind].groups,
    irPeaks: KIND[kind].ir,
    hazardRu,
    hazardEn,
    hazardUz,
    color: PALETTE[i % PALETTE.length]!,
  }))
}

export const G10_CH3_ISOMER_CHALLENGES: readonly IsomerChallenge[] = [
  {
    id: 'c2h6o',
    formula: 'C₂H₆O',
    targetCount: 2,
    titleRu: 'C₂H₆O: спирт и простой эфир',
    titleEn: 'C₂H₆O: an alcohol and an ether',
    titleUz: 'C₂H₆O: spirt va oddiy efir',
    hintRu: 'Учебник, с. 109: этанол и диметиловый эфир — межклассовые изомеры. Отметьте оба вещества состава C₂H₆O.',
    hintEn: 'Textbook p. 109: ethanol and dimethyl ether are interclass isomers. Mark both C₂H₆O compounds.',
    hintUz: 'Darslik, 109-bet: etanol va dimetil efiri — sinflararo izomerlar. C₂H₆O tarkibli ikkala moddani belgilang.',
    candidates: cands([
      ['ethanol', 'Этанол', 'Ethanol', 'Etanol', 'C₂H₆O', true, 'alcohol', 'Спирт: группа OH, водородные связи — жидкость.', 'Alcohol: OH group, hydrogen bonds — a liquid.', 'Spirt: OH guruhi, vodorod bogʻlar — suyuqlik.'],
      ['methanol', 'Метанол', 'Methanol', 'Metanol', 'CH₄O', false, 'alcohol', 'Ловушка: CH₄O — другая формула (гомолог).', 'Trap: CH₄O is another formula (a homologue).', 'Tuzoq: CH₄O — boshqa formula (gomolog).'],
      ['dimethyl-ether', 'Диметиловый эфир', 'Dimethyl ether', 'Dimetil efiri', 'C₂H₆O', true, 'ether', 'Простой эфир: нет OH, при обычных условиях газ.', 'Ether: no OH, a gas at room conditions.', 'Oddiy efir: OH yoʻq, oddiy sharoitda gaz.'],
      ['acetaldehyde', 'Этаналь', 'Ethanal', 'Etanal', 'C₂H₄O', false, 'carbonyl', 'Ловушка: C₂H₄O — на два H меньше.', 'Trap: C₂H₄O has two H fewer.', 'Tuzoq: C₂H₄O — ikki H kam.'],
    ]),
  },
  {
    id: 'c3h8o',
    formula: 'C₃H₈O',
    targetCount: 3,
    titleRu: 'Все изомеры C₃H₈O',
    titleEn: 'All isomers of C₃H₈O',
    titleUz: 'C₃H₈O ning barcha izomerlari',
    hintRu: 'Учебник, с. 109 и 130–131: пропанол-1 и пропанол-2 — изомеры положения OH, метилэтиловый эфир — межклассовый изомер. Всего три вещества.',
    hintEn: 'Textbook pp. 109 and 130–131: propan-1-ol and propan-2-ol are OH-position isomers, methyl ethyl ether is an interclass isomer. Three compounds in all.',
    hintUz: 'Darslik, 109 va 130–131-betlar: propanol-1 va propanol-2 — OH holati izomerlari, metiletil efiri — sinflararo izomer. Jami uchta modda.',
    candidates: cands([
      ['propanol', 'Пропан-1-ол', 'Propan-1-ol', 'Propan-1-ol', 'C₃H₈O', true, 'alcohol', 'Первичный спирт: OH у крайнего C.', 'Primary alcohol: OH on the end carbon.', 'Birlamchi spirt: OH chetki C da.'],
      ['allyl-alcohol', 'Проп-2-ен-1-ол', 'Prop-2-en-1-ol', 'Prop-2-en-1-ol', 'C₃H₆O', false, 'alcohol', 'Ловушка: двойная связь — C₃H₆O.', 'Trap: a double bond — C₃H₆O.', 'Tuzoq: qoʻsh bogʻ — C₃H₆O.'],
      ['propan-2-ol', 'Пропан-2-ол', 'Propan-2-ol', 'Propan-2-ol', 'C₃H₈O', true, 'alcohol', 'Вторичный спирт: OH у среднего C.', 'Secondary alcohol: OH on the middle carbon.', 'Ikkilamchi spirt: OH oʻrtadagi C da.'],
      ['ethanol', 'Этанол', 'Ethanol', 'Etanol', 'C₂H₆O', false, 'alcohol', 'Ловушка: гомолог, C₂H₆O.', 'Trap: a homologue, C₂H₆O.', 'Tuzoq: gomolog, C₂H₆O.'],
      ['methoxyethane', 'Метоксиэтан', 'Methoxyethane', 'Metoksietan', 'C₃H₈O', true, 'ether', 'Простой эфир: межклассовый изомер пропанолов.', 'An ether: interclass isomer of the propanols.', 'Oddiy efir: propanollarning sinflararo izomeri.'],
      ['propanal', 'Пропаналь', 'Propanal', 'Propanal', 'C₃H₆O', false, 'carbonyl', 'Ловушка: альдегид C₃H₆O.', 'Trap: the aldehyde C₃H₆O.', 'Tuzoq: aldegid C₃H₆O.'],
    ]),
  },
  {
    id: 'c4h10o2-diols',
    formula: 'C₄H₁₀O₂ · диолы',
    targetCount: 6,
    titleRu: 'Гликоли C₄ из таблицы с. 117',
    titleEn: 'C₄ glycols from the table on p. 117',
    titleUz: '117-bet jadvalidagi C₄ glikollar',
    hintRu: 'Учебник, с. 117: шесть двухатомных спиртов C₄H₁₀O₂ (две группы OH у разных атомов C). В таблице учебника названия со 2-й строки сдвинуты на строку — здесь названия верные.',
    hintEn: 'Textbook p. 117: six diols C₄H₁₀O₂ (two OH groups on different carbons). From row 2 on, the textbook table shifts the names by one row — the names here are correct.',
    hintUz: 'Darslik, 117-bet: oltita ikki atomli spirt C₄H₁₀O₂ (ikki OH turli C larda). Darslik jadvalida 2-qatordan nomlar bir qatorga surilgan — bu yerda nomlar toʻgʻri.',
    candidates: cands([
      ['butane-1-2-diol', 'Бутан-1,2-диол', 'Butane-1,2-diol', 'Butan-1,2-diol', 'C₄H₁₀O₂', true, 'alcohol', 'α-Гликоль: OH у соседних C.', 'α-Glycol: OH on neighbouring carbons.', 'α-Glikol: OH qoʻshni C larda.'],
      ['butane-1-2-4-triol', 'Бутан-1,2,4-триол', 'Butane-1,2,4-triol', 'Butan-1,2,4-triol', 'C₄H₁₀O₃', false, 'alcohol', 'Ловушка: три OH — C₄H₁₀O₃.', 'Trap: three OH — C₄H₁₀O₃.', 'Tuzoq: uchta OH — C₄H₁₀O₃.'],
      ['butane-1-3-diol', 'Бутан-1,3-диол', 'Butane-1,3-diol', 'Butan-1,3-diol', 'C₄H₁₀O₂', true, 'alcohol', 'β-Гликоль (в учебнике — «1,2-бутиленгликоль»).', 'β-Glycol (the textbook: “1,2-butylene glycol”).', 'β-Glikol (darslikda — «1,2-butilenglikol»).'],
      ['butane-1-4-diol', 'Бутан-1,4-диол', 'Butane-1,4-diol', 'Butan-1,4-diol', 'C₄H₁₀O₂', true, 'alcohol', 'γ-Гликоль (в учебнике — «бутандиол-1,3»).', 'γ-Glycol (the textbook: “butane-1,3-diol”).', 'γ-Glikol (darslikda — «butandiol-1,3»).'],
      ['n-butanol', 'Бутан-1-ол', 'Butan-1-ol', 'Butan-1-ol', 'C₄H₁₀O', false, 'alcohol', 'Ловушка: одноатомный спирт, C₄H₁₀O.', 'Trap: a monohydric alcohol, C₄H₁₀O.', 'Tuzoq: bir atomli spirt, C₄H₁₀O.'],
      ['butane-2-3-diol', 'Бутан-2,3-диол', 'Butane-2,3-diol', 'Butan-2,3-diol', 'C₄H₁₀O₂', true, 'alcohol', 'α-Гликоль (в учебнике — «бутандиол-1,4»).', 'α-Glycol (the textbook: “butane-1,4-diol”).', 'α-Glikol (darslikda — «butandiol-1,4»).'],
      ['2-methylpropane-1-2-diol', '2-Метилпропан-1,2-диол', '2-Methylpropane-1,2-diol', '2-Metilpropan-1,2-diol', 'C₄H₁₀O₂', true, 'alcohol', 'Разветвлённый (в учебнике — «бутандиол-2,3»).', 'Branched (the textbook: “butane-2,3-diol”).', 'Tarmoqlangan (darslikda — «butandiol-2,3»).'],
      ['ethylene-glycol', 'Этиленгликоль', 'Ethylene glycol', 'Etilenglikol', 'C₂H₆O₂', false, 'alcohol', 'Ловушка: гомолог C₂H₆O₂.', 'Trap: the homologue C₂H₆O₂.', 'Tuzoq: gomolog C₂H₆O₂.'],
      ['2-methylpropane-1-3-diol', '2-Метилпропан-1,3-диол', '2-Methylpropane-1,3-diol', '2-Metilpropan-1,3-diol', 'C₄H₁₀O₂', true, 'alcohol', 'Разветвлённый β-гликоль (в учебнике — «2-метилпропандиол-1,2»).', 'Branched β-glycol (the textbook: “2-methylpropane-1,2-diol”).', 'Tarmoqlangan β-glikol (darslikda — «2-metilpropandiol-1,2»).'],
    ]),
  },
  {
    id: 'c7h8o-phenols',
    formula: 'C₇H₈O · фенолы',
    targetCount: 3,
    titleRu: 'Фенолы среди изомеров C₇H₈O',
    titleEn: 'Phenols among the C₇H₈O isomers',
    titleUz: 'C₇H₈O izomerlari orasidagi fenollar',
    hintRu: 'Учебник, с. 123–126: фенол — OH у атома бензольного кольца; если OH в боковой цепи — это ароматический спирт, если O связан с двумя радикалами — простой эфир. Отметьте три крезола.',
    hintEn: 'Textbook pp. 123–126: a phenol has OH on a benzene-ring atom; OH in the side chain means an aromatic alcohol, O between two radicals means an ether. Mark the three cresols.',
    hintUz: 'Darslik, 123–126-betlar: fenolda OH benzol halqasi atomida; OH yon zanjirda boʻlsa — aromatik spirt, O ikki radikal orasida boʻlsa — oddiy efir. Uchta krezolni belgilang.',
    candidates: cands([
      ['o-cresol', 'о-Крезол', 'o-Cresol', 'o-Krezol', 'C₇H₈O', true, 'phenol', 'OH у кольца, CH₃ рядом (орто).', 'OH on the ring, CH₃ next to it (ortho).', 'OH halqada, CH₃ yonida (orto).'],
      ['benzyl-alcohol', 'Бензиловый спирт', 'Benzyl alcohol', 'Benzil spirti', 'C₇H₈O', false, 'alcohol', 'Та же формула, но OH в боковой цепи — ароматический спирт (межклассовый изомер).', 'Same formula, but OH is in the side chain — an aromatic alcohol (interclass isomer).', 'Formula bir xil, lekin OH yon zanjirda — aromatik spirt (sinflararo izomer).'],
      ['m-cresol', 'м-Крезол', 'm-Cresol', 'm-Krezol', 'C₇H₈O', true, 'phenol', 'OH и CH₃ в мета-положении.', 'OH and CH₃ in the meta position.', 'OH va CH₃ meta-holatda.'],
      ['anisole', 'Анизол', 'Anisole', 'Anizol', 'C₇H₈O', false, 'ether', 'Та же формула, но это простой эфир — межклассовый изомер, OH нет.', 'Same formula, but it is an ether — an interclass isomer with no OH.', 'Formula bir xil, lekin bu oddiy efir — sinflararo izomer, OH yoʻq.'],
      ['p-cresol', 'п-Крезол', 'p-Cresol', 'p-Krezol', 'C₇H₈O', true, 'phenol', 'OH и CH₃ в пара-положении.', 'OH and CH₃ in the para position.', 'OH va CH₃ para-holatda.'],
      ['phenol', 'Фенол', 'Phenol', 'Fenol', 'C₆H₆O', false, 'phenol', 'Ловушка: C₆H₆O — гомолог крезолов.', 'Trap: C₆H₆O is a homologue of the cresols.', 'Tuzoq: C₆H₆O — krezollarning gomologi.'],
    ]),
  },
  {
    id: 'c4h10o-textbook',
    formula: 'C₄H₁₀O',
    targetCount: 3,
    titleRu: 'Изомеры C₄H₁₀O со с. 130–131',
    titleEn: 'C₄H₁₀O isomers from pp. 130–131',
    titleUz: '130–131-betlardagi C₄H₁₀O izomerlari',
    hintRu: 'Учебник, с. 130–131: диэтиловый эфир и 1-метоксипропан — метамеры (разные радикалы при O), бутан-1-ол — межклассовый изомер. Отметьте три вещества состава C₄H₁₀O.',
    hintEn: 'Textbook pp. 130–131: diethyl ether and 1-methoxypropane are metamers (different radicals on O), butan-1-ol is an interclass isomer. Mark the three C₄H₁₀O compounds.',
    hintUz: 'Darslik, 130–131-betlar: dietil efiri va 1-metoksipropan — metamerlar, butan-1-ol — sinflararo izomer. C₄H₁₀O tarkibli uchta moddani belgilang.',
    candidates: cands([
      ['diethyl-ether', 'Диэтиловый эфир', 'Diethyl ether', 'Dietil efiri', 'C₄H₁₀O', true, 'ether', 'Симметричный эфир C₂H₅–O–C₂H₅.', 'A symmetrical ether C₂H₅–O–C₂H₅.', 'Simmetrik efir C₂H₅–O–C₂H₅.'],
      ['methoxyethane', 'Метоксиэтан', 'Methoxyethane', 'Metoksietan', 'C₃H₈O', false, 'ether', 'Ловушка: C₃H₈O — гомолог.', 'Trap: C₃H₈O is a homologue.', 'Tuzoq: C₃H₈O — gomolog.'],
      ['methyl-propyl-ether', '1-Метоксипропан', '1-Methoxypropane', '1-Metoksipropan', 'C₄H₁₀O', true, 'ether', 'Метамер диэтилового эфира: CH₃ и C₃H₇ при O.', 'A metamer of diethyl ether: CH₃ and C₃H₇ on O.', 'Dietil efirining metameri: O da CH₃ va C₃H₇.'],
      ['butanal', 'Бутаналь', 'Butanal', 'Butanal', 'C₄H₈O', false, 'carbonyl', 'Ловушка: альдегид C₄H₈O.', 'Trap: the aldehyde C₄H₈O.', 'Tuzoq: aldegid C₄H₈O.'],
      ['n-butanol', 'Бутан-1-ол', 'Butan-1-ol', 'Butan-1-ol', 'C₄H₁₀O', true, 'alcohol', 'Спирт — межклассовый изомер простых эфиров.', 'An alcohol — an interclass isomer of the ethers.', 'Spirt — oddiy efirlarning sinflararo izomeri.'],
      ['divinyl-ether', 'Дивиниловый эфир', 'Divinyl ether', 'Divinil efiri', 'C₄H₆O', false, 'ether', 'Ловушка: две двойные связи — C₄H₆O.', 'Trap: two double bonds — C₄H₆O.', 'Tuzoq: ikki qoʻsh bogʻ — C₄H₆O.'],
    ]),
  },
  {
    id: 'c3h6o-carbonyl',
    formula: 'C₃H₆O · карбонильные',
    targetCount: 2,
    titleRu: 'Альдегид и кетон состава C₃H₆O',
    titleEn: 'The aldehyde and the ketone C₃H₆O',
    titleUz: 'C₃H₆O tarkibli aldegid va keton',
    hintRu: 'Учебник, с. 137: пропаналь и ацетон — межклассовые изомеры C₃H₆O (группа C=O на конце цепи или в середине). Отметьте оба карбонильных соединения.',
    hintEn: 'Textbook p. 137: propanal and acetone are interclass isomers of C₃H₆O (C=O at the end of the chain or in the middle). Mark both carbonyl compounds.',
    hintUz: 'Darslik, 137-bet: propanal va atseton — C₃H₆O ning sinflararo izomerlari (C=O zanjir oxirida yoki oʻrtasida). Ikkala karbonil birikmani belgilang.',
    candidates: cands([
      ['propanal', 'Пропаналь', 'Propanal', 'Propanal', 'C₃H₆O', true, 'carbonyl', 'Альдегид: C=O на конце цепи.', 'Aldehyde: C=O at the chain end.', 'Aldegid: C=O zanjir oxirida.'],
      ['propanol', 'Пропан-1-ол', 'Propan-1-ol', 'Propan-1-ol', 'C₃H₈O', false, 'alcohol', 'Ловушка: спирт C₃H₈O — продукт гидрирования пропаналя.', 'Trap: the alcohol C₃H₈O — the hydrogenation product of propanal.', 'Tuzoq: spirt C₃H₈O — propanalning gidrogenlanish mahsuloti.'],
      ['acetone', 'Ацетон (пропан-2-он)', 'Acetone (propan-2-one)', 'Atseton (propan-2-on)', 'C₃H₆O', true, 'carbonyl', 'Кетон: C=O в середине цепи.', 'Ketone: C=O in the middle of the chain.', 'Keton: C=O zanjir oʻrtasida.'],
      ['acetaldehyde', 'Этаналь', 'Ethanal', 'Etanal', 'C₂H₄O', false, 'carbonyl', 'Ловушка: гомолог C₂H₄O.', 'Trap: the homologue C₂H₄O.', 'Tuzoq: gomolog C₂H₄O.'],
      ['butanone', 'Бутанон', 'Butanone', 'Butanon', 'C₄H₈O', false, 'carbonyl', 'Ловушка: гомолог C₄H₈O.', 'Trap: the homologue C₄H₈O.', 'Tuzoq: gomolog C₄H₈O.'],
    ]),
  },
  {
    id: 'c2h4o2',
    formula: 'C₂H₄O₂',
    targetCount: 2,
    titleRu: 'Кислота и сложный эфир C₂H₄O₂',
    titleEn: 'An acid and an ester, C₂H₄O₂',
    titleUz: 'C₂H₄O₂ kislota va murakkab efir',
    hintRu: 'Учебник, с. 147: уксусная кислота и метилформиат — межклассовые изомеры C₂H₄O₂. Отметьте оба.',
    hintEn: 'Textbook p. 147: acetic acid and methyl formate are interclass isomers of C₂H₄O₂. Mark both.',
    hintUz: 'Darslik, 147-bet: sirka kislota va metilformiat — C₂H₄O₂ ning sinflararo izomerlari. Ikkalasini belgilang.',
    candidates: cands([
      ['acetic-acid', 'Уксусная кислота', 'Acetic acid', 'Sirka kislota', 'C₂H₄O₂', true, 'acid', 'Карбоновая кислота: группа –COOH.', 'A carboxylic acid: the –COOH group.', 'Karbon kislota: –COOH guruhi.'],
      ['formic-acid', 'Муравьиная кислота', 'Formic acid', 'Chumoli kislota', 'CH₂O₂', false, 'acid', 'Ловушка: гомолог CH₂O₂.', 'Trap: the homologue CH₂O₂.', 'Tuzoq: gomolog CH₂O₂.'],
      ['methyl-formate', 'Метилформиат', 'Methyl formate', 'Metilformiat', 'C₂H₄O₂', true, 'ester', 'Сложный эфир H–COO–CH₃.', 'The ester H–COO–CH₃.', 'Murakkab efir H–COO–CH₃.'],
      ['ethyl-formate', 'Этилформиат', 'Ethyl formate', 'Etilformiat', 'C₃H₆O₂', false, 'ester', 'Ловушка: C₃H₆O₂.', 'Trap: C₃H₆O₂.', 'Tuzoq: C₃H₆O₂.'],
      ['acetaldehyde', 'Этаналь', 'Ethanal', 'Etanal', 'C₂H₄O', false, 'carbonyl', 'Ловушка: один атом O — C₂H₄O.', 'Trap: one O atom — C₂H₄O.', 'Tuzoq: bitta O — C₂H₄O.'],
    ]),
  },
  {
    id: 'c6h12o2-esters',
    formula: 'C₆H₁₂O₂ · сложные эфиры',
    targetCount: 6,
    titleRu: 'Сложные эфиры C₆H₁₂O₂ (с. 146–149)',
    titleEn: 'Esters C₆H₁₂O₂ (pp. 146–149)',
    titleUz: 'C₆H₁₂O₂ murakkab efirlari (146–149-betlar)',
    hintRu: 'Учебник, с. 147: этилизобутират, этилбутират, пропилпропионат, изопропилпропионат — изомеры C₆H₁₂O₂; той же формулы бутилацетат (с. 149) и пентилформиат (с. 147). Кислота той же формулы — межклассовый изомер, не эфир.',
    hintEn: 'Textbook p. 147: ethyl isobutyrate, ethyl butyrate, propyl propionate and isopropyl propionate are isomers of C₆H₁₂O₂; butyl acetate (p. 149) and pentyl formate (p. 147) share the formula. The acid of the same formula is an interclass isomer, not an ester.',
    hintUz: 'Darslik, 147-bet: etilizobutirat, etilbutirat, propilpropionat, izopropilpropionat — C₆H₁₂O₂ izomerlari; butilatsetat (149-bet) va pentilformiat (147-bet) ham shu formulada. Shu formulali kislota — sinflararo izomer, efir emas.',
    candidates: cands([
      ['ethyl-isobutyrate', 'Этилизобутират', 'Ethyl isobutyrate', 'Etilizobutirat', 'C₆H₁₂O₂', true, 'ester', 'Кислотный остаток разветвлён.', 'A branched acid residue.', 'Kislota qoldigʻi tarmoqlangan.'],
      ['hexanoic-acid', 'Гексановая кислота', 'Hexanoic acid', 'Geksan kislota', 'C₆H₁₂O₂', false, 'acid', 'Та же формула, но это кислота — межклассовый изомер.', 'Same formula, but it is an acid — an interclass isomer.', 'Formula bir xil, lekin bu kislota — sinflararo izomer.'],
      ['ethyl-butyrate', 'Этилбутират', 'Ethyl butyrate', 'Etilbutirat', 'C₆H₁₂O₂', true, 'ester', 'C₃H₇–COO–C₂H₅ (в учебнике нарисован с ошибкой).', 'C₃H₇–COO–C₂H₅ (drawn with an error in the textbook).', 'C₃H₇–COO–C₂H₅ (darslikda xato chizilgan).'],
      ['propyl-propionate', 'Пропилпропионат', 'Propyl propionate', 'Propilpropionat', 'C₆H₁₂O₂', true, 'ester', 'C₂H₅–COO–C₃H₇.', 'C₂H₅–COO–C₃H₇.', 'C₂H₅–COO–C₃H₇.'],
      ['ethyl-acetate', 'Этилацетат', 'Ethyl acetate', 'Etilatsetat', 'C₄H₈O₂', false, 'ester', 'Ловушка: C₄H₈O₂.', 'Trap: C₄H₈O₂.', 'Tuzoq: C₄H₈O₂.'],
      ['isopropyl-propionate', 'Изопропилпропионат', 'Isopropyl propionate', 'Izopropilpropionat', 'C₆H₁₂O₂', true, 'ester', 'Спиртовой радикал разветвлён.', 'A branched alcohol radical.', 'Spirt radikali tarmoqlangan.'],
      ['butyl-acetate', 'Бутилацетат', 'Butyl acetate', 'Butilatsetat', 'C₆H₁₂O₂', true, 'ester', 'CH₃–COO–C₄H₉ (с. 149).', 'CH₃–COO–C₄H₉ (p. 149).', 'CH₃–COO–C₄H₉ (149-bet).'],
      ['butyl-propionate', 'Бутилпропионат', 'Butyl propionate', 'Butilpropionat', 'C₇H₁₄O₂', false, 'ester', 'Ловушка: C₇H₁₄O₂ — на CH₂ больше.', 'Trap: C₇H₁₄O₂ — one CH₂ more.', 'Tuzoq: C₇H₁₄O₂ — bitta CH₂ ortiq.'],
      ['pentyl-formate', 'Пентилформиат', 'Pentyl formate', 'Pentilformiat', 'C₆H₁₂O₂', true, 'ester', 'H–COO–C₅H₁₁ (в учебнике «пентилметионат»).', 'H–COO–C₅H₁₁ (the textbook: “pentyl methionate”).', 'H–COO–C₅H₁₁ (darslikda «pentilmetionat»).'],
    ]),
  },
  {
    id: 'c3h6o3-trioses',
    formula: 'C₃H₆O₃',
    targetCount: 2,
    titleRu: 'Альдоза и кетоза C₃H₆O₃',
    titleEn: 'An aldose and a ketose, C₃H₆O₃',
    titleUz: 'C₃H₆O₃ aldoza va ketoza',
    hintRu: 'Учебник, с. 158: глицериновый альдегид (альдегидоспирт) и дигидроксиацетон (кетоноспирт, в учебнике «диоксиацетон») — изомеры C₃H₆O₃.',
    hintEn: 'Textbook p. 158: glyceraldehyde (an aldehyde-alcohol) and dihydroxyacetone (a ketone-alcohol) are isomers of C₃H₆O₃.',
    hintUz: 'Darslik, 158-bet: glitserin aldegidi (aldegidospirt) va digidroksiatseton (ketonospirt, darslikda «dioksiatseton») — C₃H₆O₃ izomerlari.',
    candidates: cands([
      ['glyceraldehyde', 'Глицериновый альдегид', 'Glyceraldehyde', 'Glitserin aldegidi', 'C₃H₆O₃', true, 'carbonyl', 'Группа CHO на конце цепи — альдоза.', 'CHO at the chain end — an aldose.', 'Zanjir oxirida CHO — aldoza.'],
      ['glycerol', 'Глицерин', 'Glycerol', 'Glitserin', 'C₃H₈O₃', false, 'alcohol', 'Ловушка: C₃H₈O₃ — нет группы C=O.', 'Trap: C₃H₈O₃ — no C=O group.', 'Tuzoq: C₃H₈O₃ — C=O guruhi yoʻq.'],
      ['dihydroxyacetone', 'Дигидроксиацетон', 'Dihydroxyacetone', 'Digidroksiatseton', 'C₃H₆O₃', true, 'carbonyl', 'Группа C=O в середине — кетоза.', 'C=O in the middle — a ketose.', 'C=O oʻrtada — ketoza.'],
      ['ribose', 'Рибоза', 'Ribose', 'Riboza', 'C₅H₁₀O₅', false, 'carbonyl', 'Ловушка: пентоза C₅H₁₀O₅.', 'Trap: the pentose C₅H₁₀O₅.', 'Tuzoq: pentoza C₅H₁₀O₅.'],
    ]),
  },
  {
    id: 'c6h12o6-glucose-fructose',
    formula: 'C₆H₁₂O₆',
    targetCount: 2,
    titleRu: 'Глюкоза и фруктоза — изомеры C₆H₁₂O₆',
    titleEn: 'Glucose and fructose — isomers of C₆H₁₂O₆',
    titleUz: 'Glyukoza va fruktoza — C₆H₁₂O₆ izomerlari',
    hintRu: 'Учебник, с. 156: гексозы глюкоза (альдегидоспирт) и фруктоза (кетоноспирт) — изомеры C₆H₁₂O₆. Отметьте открытые формы обеих.',
    hintEn: 'Textbook p. 156: the hexoses glucose (an aldehyde-alcohol) and fructose (a ketone-alcohol) are isomers of C₆H₁₂O₆. Mark the open-chain forms of both.',
    hintUz: 'Darslik, 156-bet: geksozalar glyukoza (aldegidospirt) va fruktoza (ketonospirt) — C₆H₁₂O₆ izomerlari. Ikkalasining ochiq shaklini belgilang.',
    candidates: cands([
      ['glucose-open', 'Глюкоза (открытая форма)', 'Glucose (open chain)', 'Glyukoza (ochiq shakl)', 'C₆H₁₂O₆', true, 'carbonyl', 'Альдегидная группа у C1.', 'The aldehyde group on C1.', 'C1 da aldegid guruhi.'],
      ['sorbitol', 'Сорбит', 'Sorbitol', 'Sorbit', 'C₆H₁₄O₆', false, 'alcohol', 'Ловушка: C₆H₁₄O₆ — продукт восстановления глюкозы.', 'Trap: C₆H₁₄O₆ — the reduction product of glucose.', 'Tuzoq: C₆H₁₄O₆ — glyukozaning qaytarilish mahsuloti.'],
      ['fructose-open', 'Фруктоза (открытая форма)', 'Fructose (open chain)', 'Fruktoza (ochiq shakl)', 'C₆H₁₂O₆', true, 'carbonyl', 'Кетогруппа у C2.', 'The keto group on C2.', 'C2 da keto guruh.'],
      ['ribose', 'Рибоза', 'Ribose', 'Riboza', 'C₅H₁₀O₅', false, 'carbonyl', 'Ловушка: пентоза C₅H₁₀O₅.', 'Trap: the pentose C₅H₁₀O₅.', 'Tuzoq: pentoza C₅H₁₀O₅.'],
      ['gluconic-acid', 'Глюконовая кислота', 'Gluconic acid', 'Glyukon kislota', 'C₆H₁₂O₇', false, 'acid', 'Ловушка: C₆H₁₂O₇ — продукт окисления.', 'Trap: C₆H₁₂O₇ — the oxidation product.', 'Tuzoq: C₆H₁₂O₇ — oksidlanish mahsuloti.'],
    ]),
  },
]
