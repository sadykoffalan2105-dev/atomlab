/**
 * Задания «Изомеры» для Kimyo 10, гл. II § 2.7–2.17 (с. 57–78): алкены, диены, алкины, арены.
 * Подключается одной строкой-спредом в ISOMER_CHALLENGES (researchLabData.ts).
 * Карточка показывает структурную формулу — брутто-формулу ученик считает сам.
 */
import type { IrPeak, IsomerCandidate, IsomerChallenge } from './researchLabData'

const CH_PEAK: IrPeak = { wavenumber: 2920, intensity: 0.7, label: 'C–H' }
const PALETTE = ['#7dd3fc', '#a5b4fc', '#c4b5fd', '#f0abfc', '#fda4af', '#fcd34d', '#86efac', '#5eead4', '#fdba74']

type Row = readonly [
  id: string,
  ru: string,
  en: string,
  uz: string,
  formula: string,
  correct: boolean,
  skeleton: IsomerCandidate['skeleton'],
  group: string,
  note: readonly [ru: string, en: string, uz: string],
]

function cands(rows: readonly Row[]): IsomerCandidate[] {
  return rows.map(([id, nameRu, nameEn, nameUz, formula, correct, skeleton, group, note], i) => ({
    id,
    nameRu,
    nameEn,
    nameUz,
    formula,
    correct,
    skeleton,
    functionalGroups: [group],
    irPeaks: [CH_PEAK],
    hazardRu: note[0],
    hazardEn: note[1],
    hazardUz: note[2],
    color: PALETTE[i % PALETTE.length]!,
  }))
}

const OTHER = (f: string) => [`Ловушка: это ${f} — другая формула.`, `Trap: this is ${f} — another formula.`, `Tuzoq: bu ${f} — boshqa formula.`] as const

export const G10_CH2_ISOMER_CHALLENGES: readonly IsomerChallenge[] = [
  {
    id: 'c4h8-alkene',
    formula: 'C₄H₈',
    targetCount: 6,
    titleRu: 'Все изомеры C₄H₈: алкены, цис/транс и циклы',
    titleEn: 'All C₄H₈ isomers: alkenes, cis/trans and rings',
    titleUz: 'C₄H₈ ning barcha izomerlari: alkenlar, sis/trans va halqalar',
    hintRu:
      'Учебник, с. 58–59: у C₄H₈ три алкена по строению (бутен-1, бутен-2, 2-метилпропен), причём бутен-2 существует в цис- и транс-формах; ещё два межклассовых изомера — циклоалканы (§ 2.5). Отметьте все шесть веществ состава C₄H₈.',
    hintEn:
      'Textbook pp. 58–59: C₄H₈ has three structural alkenes (but-1-ene, but-2-ene, 2-methylpropene), and but-2-ene exists as cis and trans forms; two more interclass isomers are cycloalkanes (§ 2.5). Mark all six C₄H₈ substances.',
    hintUz:
      'Darslik, 58–59-betlar: C₄H₈ ning tuzilishi boʻyicha uchta alkeni bor (buten-1, buten-2, 2-metilpropen), buten-2 esa sis- va trans-shakllarda boʻladi; yana ikkita sinflararo izomer — tsikloalkanlar (§ 2.5). C₄H₈ tarkibli barcha oltita moddani belgilang.',
    candidates: cands([
      ['but-1-ene', 'Бутен-1', 'But-1-ene', 'Buten-1', 'CH₂=CH–CH₂–CH₃', true, 'n', 'alkene', ['Двойная связь у C1.', 'Double bond at C1.', 'Qoʻsh bogʻ C1 da.']],
      ['cis-but-2-ene', 'цис-Бутен-2', 'cis-But-2-ene', 'sis-Buten-2', 'цис-CH₃–CH=CH–CH₃', true, 'n', 'alkene', ['Метилы по одну сторону C=C.', 'Methyls on the same side of C=C.', 'Metillar C=C ning bir tomonida.']],
      ['n-butane', 'Бутан', 'Butane', 'Butan', 'CH₃–CH₂–CH₂–CH₃', false, 'n', 'alkane', OTHER('C₄H₁₀')],
      ['trans-but-2-ene', 'транс-Бутен-2', 'trans-But-2-ene', 'trans-Buten-2', 'транс-CH₃–CH=CH–CH₃', true, 'n', 'alkene', ['Метилы по разные стороны C=C.', 'Methyls on opposite sides of C=C.', 'Metillar C=C ning turli tomonlarida.']],
      ['isobutylene', '2-Метилпропен', '2-Methylpropene', '2-Metilpropen', 'CH₂=C(CH₃)–CH₃', true, 'iso', 'alkene', ['Разветвлённый скелет; цис/транс нет.', 'Branched skeleton; no cis/trans.', 'Shoxlangan skelet; sis/trans yoʻq.']],
      ['butadiene', 'Бутадиен-1,3', 'Buta-1,3-diene', 'Butadiyen-1,3', 'CH₂=CH–CH=CH₂', false, 'n', 'alkadiene', OTHER('C₄H₆')],
      ['cyclobutane', 'Циклобутан', 'Cyclobutane', 'Tsiklobutan', 'цикло-(CH₂)₄', true, 'ring', 'cycloalkane', ['Межклассовый изомер — циклоалкан.', 'Interclass isomer — a cycloalkane.', 'Sinflararo izomer — tsikloalkan.']],
      ['methylcyclopropane', 'Метилциклопропан', 'Methylcyclopropane', 'Metiltsiklopropan', 'цикло-C₃H₅–CH₃', true, 'ring', 'cycloalkane', ['Межклассовый изомер — циклоалкан.', 'Interclass isomer — a cycloalkane.', 'Sinflararo izomer — tsikloalkan.']],
      ['propene', 'Пропен', 'Propene', 'Propen', 'CH₂=CH–CH₃', false, 'n', 'alkene', OTHER('C₃H₆')],
    ]),
  },
  {
    id: 'c5h10-alkene',
    formula: 'C₅H₁₀ · алкены',
    targetCount: 5,
    titleRu: 'Алкены C₅H₁₀ (с. 58)',
    titleEn: 'Alkenes C₅H₁₀ (p. 58)',
    titleUz: 'C₅H₁₀ alkenlari (58-bet)',
    hintRu:
      'Учебник, с. 58: изомерия скелета и положения двойной связи. Отметьте пять алкенов C₅H₁₀ (цис- и транс-пентен-2 здесь считаются одним строением). Циклопентан той же формулы — межклассовый изомер, не алкен.',
    hintEn:
      'Textbook p. 58: skeletal and double-bond-position isomerism. Mark the five C₅H₁₀ alkenes (cis- and trans-pent-2-ene count as one structure here). Cyclopentane has the same formula but is an interclass isomer, not an alkene.',
    hintUz:
      'Darslik, 58-bet: skelet va qoʻsh bogʻ holati izomeriyasi. C₅H₁₀ ning beshta alkenini belgilang (sis- va trans-penten-2 bu yerda bitta tuzilish hisoblanadi). Shu formulali tsiklopentan — sinflararo izomer, alken emas.',
    candidates: cands([
      ['pent-1-ene', 'Пентен-1', 'Pent-1-ene', 'Penten-1', 'CH₂=CH–CH₂–CH₂–CH₃', true, 'n', 'alkene', ['Неразветвлённая цепь, C=C у C1.', 'Unbranched chain, C=C at C1.', 'Shoxlanmagan zanjir, C=C C1 da.']],
      ['cyclopentane', 'Циклопентан', 'Cyclopentane', 'Tsiklopentan', 'цикло-(CH₂)₅', false, 'ring', 'cycloalkane', ['Та же формула C₅H₁₀, но это циклоалкан — не алкен.', 'Same formula C₅H₁₀, but a cycloalkane — not an alkene.', 'Formula bir xil C₅H₁₀, lekin bu tsikloalkan — alken emas.']],
      ['pent-2-ene', 'Пентен-2', 'Pent-2-ene', 'Penten-2', 'CH₃–CH=CH–CH₂–CH₃', true, 'n', 'alkene', ['C=C у C2; есть цис- и транс-формы.', 'C=C at C2; has cis and trans forms.', 'C=C C2 da; sis- va trans-shakllari bor.']],
      ['2-methylbut-1-ene', '2-Метилбутен-1', '2-Methylbut-1-ene', '2-Metilbuten-1', 'CH₂=C(CH₃)–CH₂–CH₃', true, 'iso', 'alkene', ['Разветвлённая цепь, C=C у C1.', 'Branched chain, C=C at C1.', 'Shoxlangan zanjir, C=C C1 da.']],
      ['isoprene', 'Изопрен', 'Isoprene', 'Izopren', 'CH₂=C(CH₃)–CH=CH₂', false, 'iso', 'alkadiene', OTHER('C₅H₈')],
      ['3-methylbut-1-ene', '3-Метилбутен-1', '3-Methylbut-1-ene', '3-Metilbuten-1', 'CH₂=CH–CH(CH₃)–CH₃', true, 'iso', 'alkene', ['Метил у C3, C=C у C1.', 'Methyl at C3, C=C at C1.', 'Metil C3 da, C=C C1 da.']],
      ['2-methylbut-2-ene', '2-Метилбутен-2', '2-Methylbut-2-ene', '2-Metilbuten-2', 'CH₃–C(CH₃)=CH–CH₃', true, 'iso', 'alkene', ['Метил у C2, C=C у C2.', 'Methyl at C2, C=C at C2.', 'Metil C2 da, C=C C2 da.']],
      ['n-pentane', 'Пентан', 'Pentane', 'Pentan', 'CH₃–(CH₂)₃–CH₃', false, 'n', 'alkane', OTHER('C₅H₁₂')],
    ]),
  },
  {
    id: 'c5h8-diene',
    formula: 'C₅H₈ · диены',
    targetCount: 5,
    titleRu: 'Алкадиены C₅H₈ (с. 64–65)',
    titleEn: 'Alkadienes C₅H₈ (pp. 64–65)',
    titleUz: 'C₅H₈ alkadiyenlari (64–65-betlar)',
    hintRu:
      'Учебник, с. 64–65: отметьте пять диенов C₅H₈ — три неразветвлённых (пентадиены-1,2, -1,3, -1,4) и два разветвлённых. Цис/транс-пентадиен-1,3 считаются одним строением. Пентин-1 той же формулы — межклассовый изомер (алкин).',
    hintEn:
      'Textbook pp. 64–65: mark the five C₅H₈ dienes — three unbranched (penta-1,2-, 1,3-, 1,4-diene) and two branched. cis/trans-Penta-1,3-diene count as one structure. Pent-1-yne has the same formula but is an interclass isomer (an alkyne).',
    hintUz:
      'Darslik, 64–65-betlar: C₅H₈ ning beshta diyenini belgilang — uchta shoxlanmagan (pentadiyen-1,2, -1,3, -1,4) va ikkita shoxlangan. sis/trans-pentadiyen-1,3 bitta tuzilish hisoblanadi. Shu formulali pentin-1 — sinflararo izomer (alkin).',
    candidates: cands([
      ['penta-1-2-diene', 'Пентадиен-1,2', 'Penta-1,2-diene', 'Pentadiyen-1,2', 'H₂C=C=CH–CH₂–CH₃', true, 'n', 'alkadiene', ['Кумулированные C=C=C.', 'Cumulated C=C=C.', 'Kumulyatsiyalangan C=C=C.']],
      ['penta-1-3-diene', 'Пентадиен-1,3', 'Penta-1,3-diene', 'Pentadiyen-1,3', 'H₂C=CH–CH=CH–CH₃', true, 'n', 'alkadiene', ['Сопряжённые C=C–C=C.', 'Conjugated C=C–C=C.', 'Tutash C=C–C=C.']],
      ['pent-1-yne', 'Пентин-1', 'Pent-1-yne', 'Pentin-1', 'HC≡C–CH₂–CH₂–CH₃', false, 'n', 'alkyne', ['Та же формула C₅H₈, но тройная связь — алкин, не диен.', 'Same formula C₅H₈, but a triple bond — an alkyne, not a diene.', 'Formula bir xil C₅H₈, lekin uchli bogʻ — alkin, diyen emas.']],
      ['penta-1-4-diene', 'Пентадиен-1,4', 'Penta-1,4-diene', 'Pentadiyen-1,4', 'H₂C=CH–CH₂–CH=CH₂', true, 'n', 'alkadiene', ['Изолированные C=C.', 'Isolated C=C.', 'Izolyatsiyalangan C=C.']],
      ['isoprene', '2-Метилбутадиен-1,3 (изопрен)', '2-Methylbuta-1,3-diene (isoprene)', '2-Metilbutadiyen-1,3 (izopren)', 'CH₂=C(CH₃)–CH=CH₂', true, 'iso', 'alkadiene', ['Разветвлённый сопряжённый диен.', 'A branched conjugated diene.', 'Shoxlangan tutash diyen.']],
      ['butadiene', 'Бутадиен-1,3', 'Buta-1,3-diene', 'Butadiyen-1,3', 'CH₂=CH–CH=CH₂', false, 'n', 'alkadiene', OTHER('C₄H₆')],
      ['3-methylbuta-1-2-diene', '3-Метилбутадиен-1,2', '3-Methylbuta-1,2-diene', '3-Metilbutadiyen-1,2', 'CH₂=C=C(CH₃)–CH₃', true, 'iso', 'alkadiene', ['Разветвлённый кумулированный диен.', 'A branched cumulated diene.', 'Shoxlangan kumulyatsiyalangan diyen.']],
      ['2-methylbut-2-ene', '2-Метилбутен-2', '2-Methylbut-2-ene', '2-Metilbuten-2', 'CH₃–C(CH₃)=CH–CH₃', false, 'iso', 'alkene', OTHER('C₅H₁₀')],
    ]),
  },
  {
    id: 'c4h6',
    formula: 'C₄H₆',
    targetCount: 4,
    titleRu: 'Диены и алкины C₄H₆ — межклассовая изомерия',
    titleEn: 'Dienes and alkynes C₄H₆ — interclass isomerism',
    titleUz: 'C₄H₆ diyen va alkinlari — sinflararo izomeriya',
    hintRu:
      'Учебник, с. 65 и 73: у диенов и алкинов общая формула CₙH₂ₙ₋₂, поэтому они межклассовые изомеры. Отметьте два диена и два алкина состава C₄H₆. На с. 73 бутины ошибочно подписаны «бутен-1» и «бутен-2».',
    hintEn:
      'Textbook pp. 65 and 73: dienes and alkynes share the formula CₙH₂ₙ₋₂, so they are interclass isomers. Mark two dienes and two alkynes of formula C₄H₆. On p. 73 the butynes are mislabelled “butene-1” and “butene-2”.',
    hintUz:
      'Darslik, 65 va 73-betlar: diyen va alkinlarning umumiy formulasi CₙH₂ₙ₋₂, shuning uchun ular sinflararo izomerlar. C₄H₆ tarkibli ikkita diyen va ikkita alkinni belgilang. 73-betda butinlar xato «buten-1» va «buten-2» deb yozilgan.',
    candidates: cands([
      ['buta-1-2-diene', 'Бутадиен-1,2', 'Buta-1,2-diene', 'Butadiyen-1,2', 'H₂C=C=CH–CH₃', true, 'n', 'alkadiene', ['Кумулированный диен.', 'Cumulated diene.', 'Kumulyatsiyalangan diyen.']],
      ['isobutylene', '2-Метилпропен', '2-Methylpropene', '2-Metilpropen', 'CH₂=C(CH₃)–CH₃', false, 'iso', 'alkene', OTHER('C₄H₈')],
      ['butadiene', 'Бутадиен-1,3', 'Buta-1,3-diene', 'Butadiyen-1,3', 'CH₂=CH–CH=CH₂', true, 'n', 'alkadiene', ['Сопряжённый диен.', 'Conjugated diene.', 'Tutash diyen.']],
      ['but-1-yne', 'Бутин-1', 'But-1-yne', 'Butin-1', 'HC≡C–CH₂–CH₃', true, 'n', 'alkyne', ['Алкин: C≡C у C1.', 'Alkyne: C≡C at C1.', 'Alkin: C≡C C1 da.']],
      ['propyne', 'Пропин', 'Propyne', 'Propin', 'HC≡C–CH₃', false, 'n', 'alkyne', OTHER('C₃H₄')],
      ['but-2-yne', 'Бутин-2', 'But-2-yne', 'Butin-2', 'CH₃–C≡C–CH₃', true, 'n', 'alkyne', ['Алкин: C≡C в середине цепи.', 'Alkyne: C≡C in the middle.', 'Alkin: C≡C zanjir oʻrtasida.']],
    ]),
  },
  {
    id: 'c5h8-alkyne',
    formula: 'C₅H₈ · алкины',
    targetCount: 3,
    titleRu: 'Алкины C₅H₈ (с. 73)',
    titleEn: 'Alkynes C₅H₈ (p. 73)',
    titleUz: 'C₅H₈ alkinlari (73-bet)',
    hintRu:
      'Учебник, с. 73: изомерия положения тройной связи и углеродного скелета. У алкинов нет цис/транс-изомеров: фрагмент C–C≡C–C линейный (180°). Изопрен той же формулы — диен.',
    hintEn:
      'Textbook p. 73: isomerism of the triple-bond position and of the skeleton. Alkynes have no cis/trans isomers: the C–C≡C–C unit is linear (180°). Isoprene has the same formula but is a diene.',
    hintUz:
      'Darslik, 73-bet: uchli bogʻ holati va skelet izomeriyasi. Alkinlarda sis/trans-izomerlar yoʻq: C–C≡C–C fragmenti chiziqli (180°). Shu formulali izopren — diyen.',
    candidates: cands([
      ['pent-1-yne', 'Пентин-1', 'Pent-1-yne', 'Pentin-1', 'HC≡C–CH₂–CH₂–CH₃', true, 'n', 'alkyne', ['C≡C у C1.', 'C≡C at C1.', 'C≡C C1 da.']],
      ['isoprene', 'Изопрен', 'Isoprene', 'Izopren', 'CH₂=C(CH₃)–CH=CH₂', false, 'iso', 'alkadiene', ['Та же формула C₅H₈, но две двойные связи — диен.', 'Same formula C₅H₈, but two double bonds — a diene.', 'Formula bir xil C₅H₈, lekin ikki qoʻsh bogʻ — diyen.']],
      ['pent-2-yne', 'Пентин-2', 'Pent-2-yne', 'Pentin-2', 'CH₃–C≡C–CH₂–CH₃', true, 'n', 'alkyne', ['C≡C у C2.', 'C≡C at C2.', 'C≡C C2 da.']],
      ['but-1-yne', 'Бутин-1', 'But-1-yne', 'Butin-1', 'HC≡C–CH₂–CH₃', false, 'n', 'alkyne', OTHER('C₄H₆')],
      ['3-methylbut-1-yne', '3-Метилбутин-1', '3-Methylbut-1-yne', '3-Metilbutin-1', 'HC≡C–CH(CH₃)–CH₃', true, 'iso', 'alkyne', ['Разветвлённый скелет.', 'Branched skeleton.', 'Shoxlangan skelet.']],
      ['hex-1-yne', 'Гексин-1', 'Hex-1-yne', 'Geksin-1', 'HC≡C–(CH₂)₃–CH₃', false, 'n', 'alkyne', OTHER('C₆H₁₀')],
    ]),
  },
  {
    id: 'c7h12-alkyne',
    formula: 'C₇H₁₂',
    targetCount: 5,
    titleRu: 'Задание с. 73: пять изомеров C₇H₁₂',
    titleEn: 'Task p. 73: five isomers of C₇H₁₂',
    titleUz: '73-bet topshirigʻi: C₇H₁₂ ning beshta izomeri',
    hintRu:
      'Учебник, с. 73: составьте пять изомеров C₇H₁₂. Выберите пять алкинов этой формулы; карточки другой формулы — ловушки (посчитайте атомы H: у алкина CₙH₂ₙ₋₂).',
    hintEn:
      'Textbook p. 73: write five isomers of C₇H₁₂. Pick the five alkynes of this formula; cards with another formula are traps (count the H atoms: an alkyne is CₙH₂ₙ₋₂).',
    hintUz:
      'Darslik, 73-bet: C₇H₁₂ ning beshta izomerini tuzing. Shu formulali beshta alkinni tanlang; boshqa formulali kartalar — tuzoq (H atomlarini sanang: alkin CₙH₂ₙ₋₂).',
    candidates: cands([
      ['hept-1-yne', 'Гептин-1', 'Hept-1-yne', 'Geptin-1', 'HC≡C–(CH₂)₄–CH₃', true, 'n', 'alkyne', ['C≡C у C1.', 'C≡C at C1.', 'C≡C C1 da.']],
      ['hept-2-yne', 'Гептин-2', 'Hept-2-yne', 'Geptin-2', 'CH₃–C≡C–(CH₂)₃–CH₃', true, 'n', 'alkyne', ['C≡C у C2.', 'C≡C at C2.', 'C≡C C2 da.']],
      ['hept-1-ene', 'Гептен-1', 'Hept-1-ene', 'Gepten-1', 'CH₂=CH–(CH₂)₄–CH₃', false, 'n', 'alkene', OTHER('C₇H₁₄')],
      ['hept-3-yne', 'Гептин-3', 'Hept-3-yne', 'Geptin-3', 'CH₃–CH₂–C≡C–(CH₂)₂–CH₃', true, 'n', 'alkyne', ['C≡C у C3.', 'C≡C at C3.', 'C≡C C3 da.']],
      ['3-methylhex-1-yne', '3-Метилгексин-1', '3-Methylhex-1-yne', '3-Metilgeksin-1', 'HC≡C–CH(CH₃)–(CH₂)₂–CH₃', true, 'iso', 'alkyne', ['Разветвлённый скелет.', 'Branched skeleton.', 'Shoxlangan skelet.']],
      ['hex-1-yne', 'Гексин-1', 'Hex-1-yne', 'Geksin-1', 'HC≡C–(CH₂)₃–CH₃', false, 'n', 'alkyne', OTHER('C₆H₁₀')],
      ['4-4-dimethylpent-2-yne', '4,4-Диметилпентин-2', '4,4-Dimethylpent-2-yne', '4,4-Dimetilpentin-2', 'CH₃–C≡C–C(CH₃)₂–CH₃', true, 'neo', 'alkyne', ['Разветвлённый скелет.', 'Branched skeleton.', 'Shoxlangan skelet.']],
      ['n-heptane', 'Гептан', 'Heptane', 'Geptan', 'CH₃–(CH₂)₅–CH₃', false, 'n', 'alkane', OTHER('C₇H₁₆')],
    ]),
  },
  {
    id: 'c8h10-arene',
    formula: 'C₈H₁₀',
    targetCount: 4,
    titleRu: 'Арены C₈H₁₀ (с. 78)',
    titleEn: 'Arenes C₈H₁₀ (p. 78)',
    titleUz: 'C₈H₁₀ arenlari (78-bet)',
    hintRu:
      'Учебник, с. 78: у C₈H₁₀ четыре арена — этилбензол и три ксилола (о-, м-, п-, т. е. 1,2-, 1,3- и 1,4-диметилбензол). Стирол и толуол — другие формулы.',
    hintEn:
      'Textbook p. 78: C₈H₁₀ has four arenes — ethylbenzene and three xylenes (o-, m-, p-, i.e. 1,2-, 1,3- and 1,4-dimethylbenzene). Styrene and toluene have other formulas.',
    hintUz:
      'Darslik, 78-bet: C₈H₁₀ ning toʻrtta areni bor — etilbenzol va uchta ksilol (o-, m-, p-, ya’ni 1,2-, 1,3- va 1,4-dimetilbenzol). Stirol va toluol — boshqa formulalar.',
    candidates: cands([
      ['ethylbenzene', 'Этилбензол', 'Ethylbenzene', 'Etilbenzol', 'C₆H₅–CH₂–CH₃', true, 'n', 'arene', ['Одна боковая цепь C₂H₅.', 'One C₂H₅ side chain.', 'Bitta C₂H₅ yon zanjir.']],
      ['styrene', 'Стирол', 'Styrene', 'Stirol', 'C₆H₅–CH=CH₂', false, 'n', 'arene', OTHER('C₈H₈')],
      ['o-xylene', 'о-Ксилол', 'o-Xylene', 'o-Ksilol', '1,2-(CH₃)₂C₆H₄', true, 'iso', 'arene', ['Метилы рядом (орто).', 'Methyls adjacent (ortho).', 'Metillar yonma-yon (orto).']],
      ['m-xylene', 'м-Ксилол', 'm-Xylene', 'm-Ksilol', '1,3-(CH₃)₂C₆H₄', true, 'iso', 'arene', ['Метилы через один атом (мета).', 'Methyls one atom apart (meta).', 'Metillar bir atom oraligʻida (meta).']],
      ['toluene', 'Толуол', 'Toluene', 'Toluol', 'C₆H₅–CH₃', false, 'n', 'arene', OTHER('C₇H₈')],
      ['p-xylene', 'п-Ксилол', 'p-Xylene', 'p-Ksilol', '1,4-(CH₃)₂C₆H₄', true, 'iso', 'arene', ['Метилы напротив (пара).', 'Methyls opposite (para).', 'Metillar qarama-qarshi (para).']],
      ['cumene', 'Кумол', 'Cumene', 'Kumol', 'C₆H₅–CH(CH₃)₂', false, 'iso', 'arene', OTHER('C₉H₁₂')],
    ]),
  },
]
