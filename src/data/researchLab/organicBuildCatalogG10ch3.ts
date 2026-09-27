/**
 * Kimyo 10, глава III (§ 3.1–3.21, с. 103–167): молекулы органической лаборатории.
 * Источник — расшифровки docs/textbook/g10-ch3-alcohols.md, g10-ch3-phenols-carbonyls.md,
 * g10-ch3-acids-esters-carbs.md. Ошибки и опечатки учебника показаны исправленными, с пояснением «в учебнике …».
 *
 * Скелет задаётся упрощённой строкой SMILES (только C O N S Cl Br, связи = и #, ветви (), циклы 1–9,
 * бензол — в форме Кекуле). Водород добавляется по валентности; набор атомов (kit) считается из скелета.
 * Id совпадают с веществами книги (textbookOrganic.data.ts), если такие уже есть: запись каталога
 * заменяет автоописание (названия RU/EN/UZ, IUPAC, исправления учебника) и делает молекулу собираемой.
 *
 * Вещества, которые модель не может показать честно (соли — этилат, фенолят, ацетат; эфиры азотной
 * и серной кислот с N(V)/S(VI); соединения иода), остаются в уравнениях уроков.
 */
import type { OrganicElement, SkeletonSpec } from '../../chemistry/organic/organicGraph'
import type { IrPeak, OrganicBuildChallenge, OrganicClassId, OrganicKit } from './organicBuildCatalog'

const OH: IrPeak = { wavenumber: 3350, intensity: 0.92, label: 'O–H' }
const CH: IrPeak = { wavenumber: 2920, intensity: 0.7, label: 'C–H' }
const CO: IrPeak = { wavenumber: 1100, intensity: 0.55, label: 'C–O' }
const CO_ETH: IrPeak = { wavenumber: 1120, intensity: 0.65, label: 'C–O (эфир)' }
const CC_D: IrPeak = { wavenumber: 1650, intensity: 0.55, label: 'C=C' }
const CO_ALD: IrPeak = { wavenumber: 1730, intensity: 0.9, label: 'C=O' }
const CO_EST: IrPeak = { wavenumber: 1740, intensity: 0.9, label: 'C=O (сл. эфир)' }
const AROM: IrPeak = { wavenumber: 1500, intensity: 0.5, label: 'Ar' }
const CO_KET: IrPeak = { wavenumber: 1715, intensity: 0.92, label: 'C=O' }
const COOH: IrPeak = { wavenumber: 1710, intensity: 0.88, label: 'C=O' }

const ORGANIC_ATOMS = ['Cl', 'Br', 'C', 'O', 'N', 'S'] as const satisfies readonly OrganicElement[]
const VALENCE: Record<(typeof ORGANIC_ATOMS)[number], number> = { C: 4, O: 2, N: 3, S: 2, Cl: 1, Br: 1 }

/** Упрощённый SMILES → скелет тяжёлых атомов. */
export function smilesSkeleton(src: string): SkeletonSpec {
  const elements: OrganicElement[] = []
  const edges: ([number, number] | [number, number, 1 | 2 | 3])[] = []
  const stack: number[] = []
  const rings = new Map<string, { at: number; order: 1 | 2 | 3 }>()
  let prev = -1
  let order: 1 | 2 | 3 = 1
  let i = 0
  const link = (a: number, b: number, o: 1 | 2 | 3) => edges.push(o === 1 ? [a, b] : [a, b, o])
  while (i < src.length) {
    const c = src[i]!
    if (c === '(') {
      stack.push(prev)
      i += 1
    } else if (c === ')') {
      prev = stack.pop() ?? -1
      i += 1
    } else if (c === '=' || c === '#' || c === '-') {
      order = c === '=' ? 2 : c === '#' ? 3 : 1
      i += 1
    } else if (/[1-9]/.test(c)) {
      const open = rings.get(c)
      if (open) {
        link(open.at, prev, (order !== 1 ? order : open.order) as 1 | 2 | 3)
        rings.delete(c)
      } else rings.set(c, { at: prev, order })
      order = 1
      i += 1
    } else {
      const el = ORGANIC_ATOMS.find((a) => src.startsWith(a, i))
      if (!el) throw new Error(`smilesSkeleton: неизвестный символ «${c}» в ${src}`)
      elements.push(el)
      const idx = elements.length - 1
      if (prev >= 0) link(prev, idx, order)
      prev = idx
      order = 1
      i += el.length
    }
  }
  if (rings.size || stack.length) throw new Error(`smilesSkeleton: незакрытый цикл или ветвь в ${src}`)
  return { elements, edges }
}

/** Набор атомов по скелету: тяжёлые атомы + H по валентности. */
function kitOf(s: SkeletonSpec): OrganicKit {
  const used = s.elements.map(() => 0)
  for (const e of s.edges) {
    used[e[0]]! += e[2] ?? 1
    used[e[1]]! += e[2] ?? 1
  }
  const kit: Record<string, number> = {}
  let h = 0
  s.elements.forEach((el, i) => {
    kit[el] = (kit[el] ?? 0) + 1
    h += Math.max(0, (VALENCE[el as keyof typeof VALENCE] ?? 0) - used[i]!)
  })
  if (h) kit.H = h
  return kit as OrganicKit
}

type Tri = readonly [title: string, hint: string, success: string]

function m(
  id: string,
  classId: OrganicClassId,
  formula: string,
  smiles: string,
  ru: Tri,
  en: Tri,
  uz: Tri,
  equationRu: string,
  opts: { ir?: readonly IrPeak[]; degrees?: boolean; isomer?: string; equationEn?: string; equationUz?: string } = {},
): OrganicBuildChallenge {
  const skeleton = smilesSkeleton(smiles)
  const kit = kitOf(skeleton)
  return {
    id,
    isomerCandidateId: opts.isomer,
    classId,
    buildStage: /\d/.test(smiles) ? 'ring' : 'chain',
    formula,
    kit,
    titleRu: ru[0],
    hintRu: ru[1],
    successRu: ru[2],
    titleEn: en[0],
    hintEn: en[1],
    successEn: en[2],
    titleUz: uz[0],
    hintUz: uz[1],
    successUz: uz[2],
    skeleton,
    irPeaks: opts.ir ?? [CH],
    allowOxygen: Boolean(kit.O),
    allowNitrogen: Boolean(kit.N),
    allowChlorine: Boolean(kit.Cl),
    showCarbonDegrees: opts.degrees,
    equationRu,
    equationEn: opts.equationEn ?? equationRu,
    equationUz: opts.equationUz ?? equationRu,
  }
}

const ALC = [OH, CH, CO] as const
const ACID = [OH, COOH, CH] as const
const EST = [CH, CO_EST, CO_ETH] as const
/** Неразветвлённый радикал из n атомов C. */
const cn = (n: number) => 'C'.repeat(n)
/** Ацил олеиновой кислоты от C2 до C18 (двойная связь C9=C10, считая C1 — карбонильный). */
const OLEYL = `${cn(7)}C=C${cn(8)}`
const PHE = [OH, AROM, CO] as const
/** Фенил C₆H₅– (форма Кекуле). */
const PH = 'C1=CC=CC=C1'

export const G10_CH3_BUILD_CHALLENGES: readonly OrganicBuildChallenge[] = [
  // ——— § 3.1–3.2 Одноатомные спирты (с. 107–113) ———
  m('propan-2-ol', 'alcohol', 'C₃H₈O', 'CC(O)C',
    ['Пропанол-2 (вторичный спирт)', 'CH₃–CH(OH)–CH₃ (IUPAC: пропан-2-ол). Учебник, с. 107: группа OH у атома C, связанного с двумя другими атомами C, — спирт вторичный (метка II над этим C). С. 109: пропанол-1 и пропанол-2 — изомеры положения OH.', 'Пропанол-2 собран — вторичный спирт.'],
    ['Propan-2-ol (secondary alcohol)', 'CH₃–CH(OH)–CH₃ (IUPAC: propan-2-ol). Textbook p. 107: the OH sits on a carbon bonded to two other carbons, so the alcohol is secondary (label II on that C). P. 109: propan-1-ol and propan-2-ol are positional isomers of OH.', 'Propan-2-ol built — a secondary alcohol.'],
    ['Propanol-2 (ikkilamchi spirt)', 'CH₃–CH(OH)–CH₃ (IUPAC: propan-2-ol). Darslik, 107-bet: OH ikki C bilan bogʻlangan C atomida — spirt ikkilamchi (shu C ustida II belgisi). 109-bet: propanol-1 va propanol-2 — OH holati izomerlari.', 'Propanol-2 yigʻildi — ikkilamchi spirt.'],
    'CH₃–CH(OH)–CH₃ — пропан-2-ол', { ir: ALC, degrees: true }),
  m('tert-butanol', 'alcohol', 'C₄H₁₀O', 'CC(C)(C)O',
    ['2-Метилпропанол-2 (третичный спирт)', '(CH₃)₃C–OH (IUPAC: 2-метилпропан-2-ол). Учебник, с. 107: атом C при OH связан с тремя атомами C — спирт третичный (метка III).', '2-Метилпропанол-2 собран — третичный спирт.'],
    ['2-Methylpropan-2-ol (tertiary alcohol)', '(CH₃)₃C–OH (IUPAC: 2-methylpropan-2-ol). Textbook p. 107: the carbon bearing OH is bonded to three carbons — a tertiary alcohol (label III).', '2-Methylpropan-2-ol built — a tertiary alcohol.'],
    ['2-Metilpropanol-2 (uchlamchi spirt)', '(CH₃)₃C–OH (IUPAC: 2-metilpropan-2-ol). Darslik, 107-bet: OH turgan C uchta C bilan bogʻlangan — uchlamchi spirt (III belgisi).', '2-Metilpropanol-2 yigʻildi — uchlamchi spirt.'],
    '(CH₃)₃C–OH — 2-метилпропан-2-ол', { ir: ALC, degrees: true }),
  m('allyl-alcohol', 'alcohol', 'C₃H₆O', 'C=CCO',
    ['Проп-2-ен-1-ол (аллиловый спирт)', 'CH₂=CH–CH₂–OH. В учебнике (с. 107) эта формула подписана «виниловый спирт» — это ошибка: у формулы учебника OH отделена от двойной связи группой CH₂, это аллиловый спирт (IUPAC: проп-2-ен-1-ол). Виниловый спирт — CH₂=CH–OH, он неустойчив.', 'Аллиловый спирт собран — непредельный одноатомный спирт.'],
    ['Prop-2-en-1-ol (allyl alcohol)', 'CH₂=CH–CH₂–OH. The textbook (p. 107) labels this formula “vinyl alcohol” — that is a mistake: here a CH₂ group separates OH from the double bond, so it is allyl alcohol (IUPAC: prop-2-en-1-ol). Vinyl alcohol is CH₂=CH–OH and it is unstable.', 'Allyl alcohol built — an unsaturated monohydric alcohol.'],
    ['Prop-2-en-1-ol (allil spirti)', 'CH₂=CH–CH₂–OH. Darslikda (107-bet) bu formula «vinil spirti» deb yozilgan — bu xato: bu yerda OH qoʻsh bogʻdan CH₂ guruhi bilan ajralgan, bu allil spirti (IUPAC: prop-2-en-1-ol). Vinil spirti — CH₂=CH–OH, u beqaror.', 'Allil spirti yigʻildi — toʻyinmagan bir atomli spirt.'],
    'CH₂=CH–CH₂–OH — проп-2-ен-1-ол', { ir: [OH, CH, CC_D] }),
  m('6-ethyl-4-methyl-3-chlorononan-4-ol', 'alcohol', 'C₁₂H₂₅ClO', 'CCC(Cl)C(C)(O)CC(CC)CCC',
    ['4-Метил-3-хлор-6-этилнонан-4-ол', 'Главная цепь — 9 атомов C, нумерация с конца, ближнего к OH: OH и CH₃ у C4, Cl у C3, C₂H₅ у C6. Учебник (с. 108–109) называет «6-этил-4-метил-3-хлорнонанол-4»; по правилам заместители перечисляют по алфавиту: метил, хлор, этил — 4-метил-3-хлор-6-этилнонан-4-ол.', 'Молекула собрана: третичный спирт с цепью из 9 C.'],
    ['3-Chloro-6-ethyl-4-methylnonan-4-ol', 'Main chain of 9 carbons numbered from the end nearer OH: OH and CH₃ on C4, Cl on C3, C₂H₅ on C6. The textbook (pp. 108–109) writes “6-ethyl-4-methyl-3-chlorononan-4-ol”; substituents go in alphabetical order — in English 3-chloro-6-ethyl-4-methylnonan-4-ol.', 'Molecule built: a tertiary alcohol with a 9-carbon chain.'],
    ['4-Metil-3-xlor-6-etilnonan-4-ol', 'Asosiy zanjir — 9 ta C, OH ga yaqin uchidan raqamlanadi: C4 da OH va CH₃, C3 da Cl, C6 da C₂H₅. Darslik (108–109-betlar) «6-etil-4-metil-3-xlornonanol-4» deb ataydi; oʻrinbosarlar alifbo tartibida: metil, xlor, etil.', 'Molekula yigʻildi: 9 C zanjirli uchlamchi spirt.'],
    'C₁₂H₂₅ClO — 4-метил-3-хлор-6-этилнонан-4-ол', { ir: ALC }),
  m('methoxyethane', 'ether', 'C₃H₈O', 'COCC',
    ['Метилэтиловый эфир (метоксиэтан)', 'CH₃–O–C₂H₅: атом O между двумя радикалами, группы OH нет. Учебник, с. 130–131: смешанный простой эфир; C₃H₈O — межклассовый изомер пропанолов.', 'Метоксиэтан собран — смешанный простой эфир.'],
    ['Methyl ethyl ether (methoxyethane)', 'CH₃–O–C₂H₅: O between two radicals, no OH group. Textbook pp. 130–131: a mixed ether; C₃H₈O is an interclass isomer of the propanols.', 'Methoxyethane built — a mixed ether.'],
    ['Metiletil efiri (metoksietan)', 'CH₃–O–C₂H₅: O ikki radikal orasida, OH guruhi yoʻq. Darslik, 130–131-betlar: aralash oddiy efir; C₃H₈O — propanollarning sinflararo izomeri.', 'Metoksietan yigʻildi — aralash oddiy efir.'],
    'C₂H₅OSO₃H + CH₃OH → C₂H₅–O–CH₃ + H₂SO₄', { ir: [CH, CO_ETH] }),
  m('pentan-1-ol', 'alcohol', 'C₅H₁₂O', 'CCCCCO',
    ['Пентанол-1', 'CH₃(CH₂)₃CH₂OH (IUPAC: пентан-1-ол). Учебник, с. 112: получается восстановлением пентаналя водородом.', 'Пентан-1-ол собран — первичный спирт.'],
    ['Pentan-1-ol', 'CH₃(CH₂)₃CH₂OH (IUPAC: pentan-1-ol). Textbook p. 112: made by reducing pentanal with hydrogen.', 'Pentan-1-ol built — a primary alcohol.'],
    ['Pentanol-1', 'CH₃(CH₂)₃CH₂OH (IUPAC: pentan-1-ol). Darslik, 112-bet: pentanalni vodorod bilan qaytarib olinadi.', 'Pentan-1-ol yigʻildi — birlamchi spirt.'],
    'CH₃(CH₂)₃CHO + H₂ → CH₃(CH₂)₃CH₂OH', { ir: ALC }),
  m('pentanal', 'aldehyde', 'C₅H₁₀O', 'CCCCC=O',
    ['Пентаналь', 'CH₃(CH₂)₃CHO: альдегидная группа на конце цепи из 5 C (валериановый альдегид). Учебник, с. 112: восстанавливается в пентан-1-ол.', 'Пентаналь собран.'],
    ['Pentanal', 'CH₃(CH₂)₃CHO: aldehyde group at the end of a 5-carbon chain (valeraldehyde). Textbook p. 112: reduced to pentan-1-ol.', 'Pentanal built.'],
    ['Pentanal', 'CH₃(CH₂)₃CHO: 5 C zanjir oxirida aldegid guruhi. Darslik, 112-bet: pentan-1-olga qaytariladi.', 'Pentanal yigʻildi.'],
    'CH₃(CH₂)₃CHO + H₂ → CH₃(CH₂)₃CH₂OH', { ir: [CH, CO_ALD] }),
  m('pent-2-en-1-ol', 'alcohol', 'C₅H₁₀O', 'CCC=CCO',
    ['Пент-2-ен-1-ол', 'CH₃CH₂CH=CH–CH₂OH: OH у C1, двойная связь C2=C3. Учебник, с. 112: получается восстановлением этилпент-2-еноата, двойная связь сохраняется.', 'Пент-2-ен-1-ол собран — непредельный спирт.'],
    ['Pent-2-en-1-ol', 'CH₃CH₂CH=CH–CH₂OH: OH on C1, double bond C2=C3. Textbook p. 112: made by reducing ethyl pent-2-enoate; the double bond stays.', 'Pent-2-en-1-ol built — an unsaturated alcohol.'],
    ['Pent-2-en-1-ol', 'CH₃CH₂CH=CH–CH₂OH: C1 da OH, C2=C3 qoʻsh bogʻ. Darslik, 112-bet: etilpent-2-enoatni qaytarib olinadi, qoʻsh bogʻ saqlanadi.', 'Pent-2-en-1-ol yigʻildi — toʻyinmagan spirt.'],
    'CH₃CH₂CH=CHCOOC₂H₅ + 2H₂ → CH₃CH₂CH=CHCH₂OH + C₂H₅OH', { ir: [OH, CH, CC_D] }),
  m('ethyl-pent-2-enoate', 'ester', 'C₇H₁₂O₂', 'CCC=CC(=O)OCC',
    ['Этилпент-2-еноат', 'CH₃CH₂CH=CH–COO–C₂H₅: сложный эфир пент-2-еновой кислоты и этанола. Учебник, с. 112: при восстановлении даёт пент-2-ен-1-ол и этанол.', 'Этилпент-2-еноат собран.'],
    ['Ethyl pent-2-enoate', 'CH₃CH₂CH=CH–COO–C₂H₅: ester of pent-2-enoic acid and ethanol. Textbook p. 112: reduction gives pent-2-en-1-ol and ethanol.', 'Ethyl pent-2-enoate built.'],
    ['Etilpent-2-enoat', 'CH₃CH₂CH=CH–COO–C₂H₅: pent-2-en kislota va etanolning murakkab efiri. Darslik, 112-bet: qaytarilganda pent-2-en-1-ol va etanol beradi.', 'Etilpent-2-enoat yigʻildi.'],
    'CH₃CH₂CH=CHCOOC₂H₅ + 2H₂ → CH₃CH₂CH=CHCH₂OH + C₂H₅OH', { ir: [CH, CO_EST, CC_D] }),

  // ——— § 3.3–3.5 Многоатомные спирты (с. 115–121) ———
  m('xylitol', 'polyol', 'C₅H₁₂O₅', 'OCC(O)C(O)C(O)CO',
    ['Ксилит (пентан-1,2,3,4,5-пентол)', 'HOCH₂–(CHOH)₃–CH₂OH: пять групп OH на цепи из 5 C. Учебник, с. 115, называет его «пятиатомный спирт пентанол» — неточно: пентанол — одноатомный спирт; у ксилита пять OH, IUPAC — пентан-1,2,3,4,5-пентол.', 'Ксилит собран — пятиатомный спирт.'],
    ['Xylitol (pentane-1,2,3,4,5-pentol)', 'HOCH₂–(CHOH)₃–CH₂OH: five OH groups on a 5-carbon chain. The textbook (p. 115) calls it “the pentahydric alcohol pentanol” — inaccurate: pentanol is monohydric; xylitol has five OH, IUPAC pentane-1,2,3,4,5-pentol.', 'Xylitol built — a pentahydric alcohol.'],
    ['Ksilit (pentan-1,2,3,4,5-pentol)', 'HOCH₂–(CHOH)₃–CH₂OH: 5 C zanjirda beshta OH. Darslik (115-bet) uni «besh atomli spirt pentanol» deydi — noaniq: pentanol bir atomli spirt; ksilitda beshta OH, IUPAC — pentan-1,2,3,4,5-pentol.', 'Ksilit yigʻildi — besh atomli spirt.'],
    'C₅H₇(OH)₅ — ксилит', { ir: ALC }),
  m('sorbitol', 'polyol', 'C₆H₁₄O₆', 'OCC(O)C(O)C(O)C(O)CO',
    ['Сорбит (гексан-1,2,3,4,5,6-гексол)', 'HOCH₂–(CHOH)₄–CH₂OH: шесть групп OH. Учебник, с. 115, называет его «шестиатомный спирт гексанол» — неточно: гексанол одноатомный; IUPAC — гексан-1,2,3,4,5,6-гексол. С. 159: получается восстановлением глюкозы.', 'Сорбит собран — шестиатомный спирт.'],
    ['Sorbitol (hexane-1,2,3,4,5,6-hexol)', 'HOCH₂–(CHOH)₄–CH₂OH: six OH groups. The textbook (p. 115) calls it “the hexahydric alcohol hexanol” — inaccurate: hexanol is monohydric; IUPAC hexane-1,2,3,4,5,6-hexol. P. 159: made by reducing glucose.', 'Sorbitol built — a hexahydric alcohol.'],
    ['Sorbit (geksan-1,2,3,4,5,6-geksol)', 'HOCH₂–(CHOH)₄–CH₂OH: oltita OH. Darslik (115-bet) «olti atomli spirt geksanol» deydi — noaniq: geksanol bir atomli; IUPAC — geksan-1,2,3,4,5,6-geksol. 159-bet: glyukozani qaytarib olinadi.', 'Sorbit yigʻildi — olti atomli spirt.'],
    'CH₂OH(CHOH)₄CHO + H₂ → CH₂OH(CHOH)₄CH₂OH', { ir: ALC }),
  m('butane-1-2-diol', 'polyol', 'C₄H₁₀O₂', 'OCC(O)CC',
    ['Бутан-1,2-диол', 'HOCH₂–CH(OH)–CH₂–CH₃. Учебник, с. 117, таблица гликолей C₄, строка 1: название верное (α-гликоль, OH у соседних атомов C).', 'Бутан-1,2-диол собран.'],
    ['Butane-1,2-diol', 'HOCH₂–CH(OH)–CH₂–CH₃. Textbook p. 117, table of C₄ glycols, row 1: the name is correct (an α-glycol, OH on neighbouring carbons).', 'Butane-1,2-diol built.'],
    ['Butan-1,2-diol', 'HOCH₂–CH(OH)–CH₂–CH₃. Darslik, 117-bet, C₄ glikollar jadvali, 1-qator: nomi toʻgʻri (α-glikol, OH qoʻshni C larda).', 'Butan-1,2-diol yigʻildi.'],
    'C₄H₈(OH)₂ — бутан-1,2-диол', { ir: ALC }),
  m('butane-1-3-diol', 'polyol', 'C₄H₁₀O₂', 'OCCC(O)C',
    ['Бутан-1,3-диол', 'HOCH₂–CH₂–CH(OH)–CH₃ (бутандиол-1,3, с. 116). В таблице с. 117 (строка 2) названия сдвинуты на строку: эта формула подписана «1,2-бутиленгликоль», верно — бутан-1,3-диол (β-гликоль).', 'Бутан-1,3-диол собран.'],
    ['Butane-1,3-diol', 'HOCH₂–CH₂–CH(OH)–CH₃ (p. 116). In the table on p. 117 (row 2) the names are shifted by one row: this formula is labelled “1,2-butylene glycol”; correct — butane-1,3-diol (a β-glycol).', 'Butane-1,3-diol built.'],
    ['Butan-1,3-diol', 'HOCH₂–CH₂–CH(OH)–CH₃ (116-bet). 117-bet jadvalida (2-qator) nomlar bir qatorga surilgan: bu formula «1,2-butilenglikol» deb yozilgan; toʻgʻrisi — butan-1,3-diol (β-glikol).', 'Butan-1,3-diol yigʻildi.'],
    'C₄H₈(OH)₂ — бутан-1,3-диол', { ir: ALC }),
  m('butane-1-4-diol', 'polyol', 'C₄H₁₀O₂', 'OCCCCO',
    ['Бутан-1,4-диол', 'HOCH₂–(CH₂)₂–CH₂OH. В таблице с. 117 (строка 3) подписан «бутандиол-1,3» — названия сдвинуты; верно — бутан-1,4-диол (γ-гликоль, обе OH у первичных C).', 'Бутан-1,4-диол собран.'],
    ['Butane-1,4-diol', 'HOCH₂–(CH₂)₂–CH₂OH. In the table on p. 117 (row 3) it is labelled “butane-1,3-diol” — names are shifted; correct — butane-1,4-diol (a γ-glycol, both OH on primary carbons).', 'Butane-1,4-diol built.'],
    ['Butan-1,4-diol', 'HOCH₂–(CH₂)₂–CH₂OH. 117-bet jadvalida (3-qator) «butandiol-1,3» deb yozilgan — nomlar surilgan; toʻgʻrisi — butan-1,4-diol (γ-glikol).', 'Butan-1,4-diol yigʻildi.'],
    'C₄H₈(OH)₂ — бутан-1,4-диол', { ir: ALC }),
  m('butane-2-3-diol', 'polyol', 'C₄H₁₀O₂', 'CC(O)C(O)C',
    ['Бутан-2,3-диол', 'CH₃–CH(OH)–CH(OH)–CH₃. В таблице с. 117 (строка 4) подписан «бутандиол-1,4» — названия сдвинуты; верно — бутан-2,3-диол (α-гликоль, обе OH у вторичных C).', 'Бутан-2,3-диол собран.'],
    ['Butane-2,3-diol', 'CH₃–CH(OH)–CH(OH)–CH₃. In the table on p. 117 (row 4) it is labelled “butane-1,4-diol” — names are shifted; correct — butane-2,3-diol (an α-glycol, both OH on secondary carbons).', 'Butane-2,3-diol built.'],
    ['Butan-2,3-diol', 'CH₃–CH(OH)–CH(OH)–CH₃. 117-bet jadvalida (4-qator) «butandiol-1,4» deb yozilgan — nomlar surilgan; toʻgʻrisi — butan-2,3-diol.', 'Butan-2,3-diol yigʻildi.'],
    'C₄H₈(OH)₂ — бутан-2,3-диол', { ir: ALC }),
  m('2-methylpropane-1-2-diol', 'polyol', 'C₄H₁₀O₂', 'OCC(C)(C)O',
    ['2-Метилпропан-1,2-диол', 'HOCH₂–C(OH)(CH₃)–CH₃. В таблице с. 117 (строка 5) подписан «бутандиол-2,3» — названия сдвинуты; верно — 2-метилпропан-1,2-диол (одна OH у первичного, другая у третичного C).', '2-Метилпропан-1,2-диол собран.'],
    ['2-Methylpropane-1,2-diol', 'HOCH₂–C(OH)(CH₃)–CH₃. In the table on p. 117 (row 5) it is labelled “butane-2,3-diol” — names are shifted; correct — 2-methylpropane-1,2-diol (one OH on a primary, the other on a tertiary carbon).', '2-Methylpropane-1,2-diol built.'],
    ['2-Metilpropan-1,2-diol', 'HOCH₂–C(OH)(CH₃)–CH₃. 117-bet jadvalida (5-qator) «butandiol-2,3» deb yozilgan — nomlar surilgan; toʻgʻrisi — 2-metilpropan-1,2-diol.', '2-Metilpropan-1,2-diol yigʻildi.'],
    'C₄H₈(OH)₂ — 2-метилпропан-1,2-диол', { ir: ALC }),
  m('2-methylpropane-1-3-diol', 'polyol', 'C₄H₁₀O₂', 'OCC(C)CO',
    ['2-Метилпропан-1,3-диол', 'HOCH₂–CH(CH₃)–CH₂OH. В таблице с. 117 (строка 6) подписан «2-метилпропандиол-1,2» — названия сдвинуты; верно — 2-метилпропан-1,3-диол (β-гликоль).', '2-Метилпропан-1,3-диол собран.'],
    ['2-Methylpropane-1,3-diol', 'HOCH₂–CH(CH₃)–CH₂OH. In the table on p. 117 (row 6) it is labelled “2-methylpropane-1,2-diol” — names are shifted; correct — 2-methylpropane-1,3-diol (a β-glycol).', '2-Methylpropane-1,3-diol built.'],
    ['2-Metilpropan-1,3-diol', 'HOCH₂–CH(CH₃)–CH₂OH. 117-bet jadvalida (6-qator) «2-metilpropandiol-1,2» deb yozilgan — nomlar surilgan; toʻgʻrisi — 2-metilpropan-1,3-diol.', '2-Metilpropan-1,3-diol yigʻildi.'],
    'C₄H₈(OH)₂ — 2-метилпропан-1,3-диол', { ir: ALC }),
  m('butane-1-2-4-triol', 'polyol', 'C₄H₁₀O₃', 'OCC(O)CCO',
    ['Бутан-1,2,4-триол', 'HO–CH₂–CH(OH)–CH₂–CH₂–OH. Учебник, с. 118, задание 1: записать формулу бутантриола-1,2,4.', 'Бутан-1,2,4-триол собран — трёхатомный спирт.'],
    ['Butane-1,2,4-triol', 'HO–CH₂–CH(OH)–CH₂–CH₂–OH. Textbook p. 118, task 1: write the formula of butane-1,2,4-triol.', 'Butane-1,2,4-triol built — a trihydric alcohol.'],
    ['Butan-1,2,4-triol', 'HO–CH₂–CH(OH)–CH₂–CH₂–OH. Darslik, 118-bet, 1-topshiriq: butantriol-1,2,4 formulasini yozing.', 'Butan-1,2,4-triol yigʻildi — uch atomli spirt.'],
    'C₄H₇(OH)₃ — бутан-1,2,4-триол', { ir: ALC }),
  m('5-6-dimethyloctane-3-5-diol', 'polyol', 'C₁₀H₂₂O₂', 'CCC(O)CC(C)(O)C(C)CC',
    ['5,6-Диметилоктан-3,5-диол', 'Цепь из 8 C, группы OH у C3 и C5, метилы у C5 и C6. Учебник, с. 116: пример названия двухатомного спирта — нумерация с конца, ближнего к OH.', '5,6-Диметилоктан-3,5-диол собран.'],
    ['5,6-Dimethyloctane-3,5-diol', 'An 8-carbon chain, OH on C3 and C5, methyls on C5 and C6. Textbook p. 116: naming a diol — number from the end nearer the OH groups.', '5,6-Dimethyloctane-3,5-diol built.'],
    ['5,6-Dimetiloktan-3,5-diol', '8 C zanjir, C3 va C5 da OH, C5 va C6 da metil. Darslik, 116-bet: ikki atomli spirtni nomlash — OH ga yaqin uchidan raqamlanadi.', '5,6-Dimetiloktan-3,5-diol yigʻildi.'],
    'C₁₀H₂₀(OH)₂ — 5,6-диметилоктан-3,5-диол', { ir: ALC }),
  m('2-chloroethanol', 'halo', 'C₂H₅ClO', 'OCCCl',
    ['2-Хлорэтанол', 'HO–CH₂–CH₂–Cl. Учебник, с. 119: одна группа OH этиленгликоля замещается на галоген при действии HHal.', '2-Хлорэтанол собран.'],
    ['2-Chloroethanol', 'HO–CH₂–CH₂–Cl. Textbook p. 119: one OH of ethylene glycol is replaced by a halogen with HHal.', '2-Chloroethanol built.'],
    ['2-Xloretanol', 'HO–CH₂–CH₂–Cl. Darslik, 119-bet: HHal taʼsirida etilenglikolning bitta OH guruhi galogenga almashadi.', '2-Xloretanol yigʻildi.'],
    'CH₂(OH)–CH₂(OH) + HCl → CH₂(OH)–CH₂Cl + H₂O', { ir: ALC }),
  m('ethylene-glycol-monoacetate', 'ester', 'C₄H₈O₃', 'CC(=O)OCCO',
    ['2-Гидроксиэтилацетат', 'CH₃–CO–O–CH₂–CH₂–OH: одна группа OH этиленгликоля этерифицирована уксусной кислотой. Учебник, с. 119 (в уравнении учебника не записана вода).', '2-Гидроксиэтилацетат собран — моноэфир гликоля.'],
    ['2-Hydroxyethyl acetate', 'CH₃–CO–O–CH₂–CH₂–OH: one OH of ethylene glycol is esterified by acetic acid. Textbook p. 119 (the textbook equation omits the water).', '2-Hydroxyethyl acetate built — a glycol monoester.'],
    ['2-Gidroksietilatsetat', 'CH₃–CO–O–CH₂–CH₂–OH: etilenglikolning bitta OH guruhi sirka kislota bilan eterlangan. Darslik, 119-bet (tenglamada suv yozilmagan).', '2-Gidroksietilatsetat yigʻildi.'],
    'CH₂(OH)–CH₂(OH) + CH₃–COOH → CH₂(OH)–CH₂–OC(O)–CH₃ + H₂O', { ir: [OH, CH, CO_EST] }),
  m('1-4-dioxane', 'ether', 'C₄H₈O₂', 'C1COCCO1',
    ['1,4-Диоксан', 'Шестичленный цикл –CH₂–CH₂–O–CH₂–CH₂–O–. Учебник, с. 119: получается из двух молекул этиленгликоля при отщеплении двух молекул воды (H₂SO₄).', '1,4-Диоксан собран — циклический простой эфир.'],
    ['1,4-Dioxane', 'Six-membered ring –CH₂–CH₂–O–CH₂–CH₂–O–. Textbook p. 119: formed from two ethylene glycol molecules losing two water molecules (H₂SO₄).', '1,4-Dioxane built — a cyclic ether.'],
    ['1,4-Dioksan', 'Olti aʼzoli halqa –CH₂–CH₂–O–CH₂–CH₂–O–. Darslik, 119-bet: ikki etilenglikol molekulasidan ikki molekula suv ajralib hosil boʻladi (H₂SO₄).', '1,4-Dioksan yigʻildi — halqali oddiy efir.'],
    '2HO–CH₂–CH₂–OH → C₄H₈O₂ + 2H₂O', { ir: [CH, CO_ETH] }),
  m('ethylene-oxide', 'ether', 'C₂H₄O', 'C1CO1',
    ['Этиленоксид (оксиран)', 'Трёхчленный цикл C–C–O (эпоксид). Учебник, с. 118: гидратация даёт этиленгликоль; с. 130 — опечатка «этиленоксид элоксид», верно — эпоксид; IUPAC — оксиран.', 'Этиленоксид собран — напряжённый цикл из трёх атомов.'],
    ['Ethylene oxide (oxirane)', 'Three-membered C–C–O ring (an epoxide). Textbook p. 118: hydration gives ethylene glycol; p. 130 has the typo “elokside”, correct — epoxide; IUPAC — oxirane.', 'Ethylene oxide built — a strained three-atom ring.'],
    ['Etilenoksid (oksiran)', 'Uch aʼzoli C–C–O halqa (epoksid). Darslik, 118-bet: gidratatsiyasi etilenglikol beradi; 130-betda «eloksid» — xato, toʻgʻrisi epoksid; IUPAC — oksiran.', 'Etilenoksid yigʻildi.'],
    'C₂H₄O + H₂O → HO–CH₂–CH₂–OH', { ir: [CH, CO_ETH] }),
  m('1-2-3-trichloropropane', 'halo', 'C₃H₅Cl₃', 'ClCC(Cl)CCl',
    ['1,2,3-Трихлорпропан (трихлоргидрин)', 'Cl–CH₂–CHCl–CH₂–Cl: все три OH глицерина заменены на Cl. Учебник, с. 120–121: глицерин + 3HCl; обратно — водный раствор NaOH.', '1,2,3-Трихлорпропан собран.'],
    ['1,2,3-Trichloropropane (trichlorohydrin)', 'Cl–CH₂–CHCl–CH₂–Cl: all three OH of glycerol replaced by Cl. Textbook pp. 120–121: glycerol + 3HCl; back again with aqueous NaOH.', '1,2,3-Trichloropropane built.'],
    ['1,2,3-Trixlorpropan (trixlorgidrin)', 'Cl–CH₂–CHCl–CH₂–Cl: glitserinning uchala OH guruhi Cl ga almashgan. Darslik, 120–121-betlar: glitserin + 3HCl; teskarisi — NaOH ning suvli eritmasi.', '1,2,3-Trixlorpropan yigʻildi.'],
    'C₃H₅(OH)₃ + 3HCl → C₃H₅Cl₃ + 3H₂O'),

  // ——— § 3.6–3.7 Ароматические спирты и фенолы (с. 123–128) ———
  m('benzyl-alcohol', 'alcohol', 'C₇H₈O', `OC${PH}`,
    ['Бензиловый спирт (фенилметанол)', 'C₆H₅–CH₂OH: группа OH в боковой цепи, а не у атома кольца, — поэтому это ароматический спирт, а не фенол. Учебник, с. 123 и 127: получается гидролизом бензилхлорида.', 'Бензиловый спирт собран — ароматический спирт.'],
    ['Benzyl alcohol (phenylmethanol)', 'C₆H₅–CH₂OH: the OH is in the side chain, not on a ring atom, so this is an aromatic alcohol, not a phenol. Textbook pp. 123 and 127: made by hydrolysis of benzyl chloride.', 'Benzyl alcohol built — an aromatic alcohol.'],
    ['Benzil spirti (fenilmetanol)', 'C₆H₅–CH₂OH: OH yon zanjirda, halqa atomida emas — shuning uchun bu fenol emas, aromatik spirt. Darslik, 123 va 127-betlar: benzilxloridni gidrolizlab olinadi.', 'Benzil spirti yigʻildi — aromatik spirt.'],
    'C₆H₅CH₂Cl + H₂O → C₆H₅CH₂OH + HCl', { ir: PHE }),
  m('1-phenylethanol', 'alcohol', 'C₈H₁₀O', `CC(O)${PH}`,
    ['1-Фенилэтанол', 'C₆H₅–CH(OH)–CH₃ (IUPAC: 1-фенилэтан-1-ол). Учебник, с. 123: ароматический спирт, OH у атома C боковой цепи, соседнего с кольцом.', '1-Фенилэтанол собран.'],
    ['1-Phenylethanol', 'C₆H₅–CH(OH)–CH₃ (IUPAC: 1-phenylethan-1-ol). Textbook p. 123: an aromatic alcohol, OH on the side-chain carbon next to the ring.', '1-Phenylethanol built.'],
    ['1-Feniletanol', 'C₆H₅–CH(OH)–CH₃ (IUPAC: 1-feniletan-1-ol). Darslik, 123-bet: aromatik spirt, OH halqaga qoʻshni yon zanjir C atomida.', '1-Feniletanol yigʻildi.'],
    'C₆H₅–CH(OH)–CH₃ — 1-фенилэтан-1-ол', { ir: PHE }),
  m('2-phenylethanol', 'alcohol', 'C₈H₁₀O', `OCC${PH}`,
    ['2-Фенилэтанол', 'C₆H₅–CH₂–CH₂–OH (IUPAC: 2-фенилэтан-1-ол). Учебник, с. 123: OH на конце боковой цепи — ароматический спирт.', '2-Фенилэтанол собран.'],
    ['2-Phenylethanol', 'C₆H₅–CH₂–CH₂–OH (IUPAC: 2-phenylethan-1-ol). Textbook p. 123: OH at the end of the side chain — an aromatic alcohol.', '2-Phenylethanol built.'],
    ['2-Feniletanol', 'C₆H₅–CH₂–CH₂–OH (IUPAC: 2-feniletan-1-ol). Darslik, 123-bet: OH yon zanjir oxirida — aromatik spirt.', '2-Feniletanol yigʻildi.'],
    'C₆H₅–CH₂–CH₂–OH — 2-фенилэтан-1-ол', { ir: PHE }),
  m('2-phenylpropan-1-ol', 'alcohol', 'C₉H₁₂O', `OCC(C)${PH}`,
    ['2-Фенилпропанол-1', 'HO–CH₂–CH(C₆H₅)–CH₃ (IUPAC: 2-фенилпропан-1-ол). Учебник, с. 123: главная цепь из 3 C, фенил у C2, OH у C1.', '2-Фенилпропан-1-ол собран.'],
    ['2-Phenylpropan-1-ol', 'HO–CH₂–CH(C₆H₅)–CH₃ (IUPAC: 2-phenylpropan-1-ol). Textbook p. 123: a 3-carbon main chain, phenyl on C2, OH on C1.', '2-Phenylpropan-1-ol built.'],
    ['2-Fenilpropanol-1', 'HO–CH₂–CH(C₆H₅)–CH₃ (IUPAC: 2-fenilpropan-1-ol). Darslik, 123-bet: asosiy zanjir 3 C, C2 da fenil, C1 da OH.', '2-Fenilpropan-1-ol yigʻildi.'],
    'HO–CH₂–CH(C₆H₅)–CH₃ — 2-фенилпропан-1-ол', { ir: PHE }),
  m('1-phenylbutan-1-ol', 'alcohol', 'C₁₀H₁₄O', `CCCC(O)${PH}`,
    ['1-Фенилбутанол-1', 'C₆H₅–CH(OH)–CH₂–CH₂–CH₃ (IUPAC: 1-фенилбутан-1-ол). Учебник, с. 124: фенил и OH у одного атома C1.', '1-Фенилбутан-1-ол собран.'],
    ['1-Phenylbutan-1-ol', 'C₆H₅–CH(OH)–CH₂–CH₂–CH₃ (IUPAC: 1-phenylbutan-1-ol). Textbook p. 124: phenyl and OH on the same carbon C1.', '1-Phenylbutan-1-ol built.'],
    ['1-Fenilbutanol-1', 'C₆H₅–CH(OH)–CH₂–CH₂–CH₃ (IUPAC: 1-fenilbutan-1-ol). Darslik, 124-bet: fenil va OH bitta C1 atomida.', '1-Fenilbutan-1-ol yigʻildi.'],
    'C₆H₅–CH(OH)–C₃H₇ — 1-фенилбутан-1-ол', { ir: PHE }),
  m('2-methyl-1-phenylpropan-2-ol', 'alcohol', 'C₁₀H₁₄O', `CC(C)(O)C${PH}`,
    ['2-Метил-1-фенилпропанол-2', 'C₆H₅–CH₂–C(OH)(CH₃)₂ (IUPAC: 2-метил-1-фенилпропан-2-ол). Учебник, с. 124: третичный ароматический спирт.', '2-Метил-1-фенилпропан-2-ол собран.'],
    ['2-Methyl-1-phenylpropan-2-ol', 'C₆H₅–CH₂–C(OH)(CH₃)₂ (IUPAC: 2-methyl-1-phenylpropan-2-ol). Textbook p. 124: a tertiary aromatic alcohol.', '2-Methyl-1-phenylpropan-2-ol built.'],
    ['2-Metil-1-fenilpropanol-2', 'C₆H₅–CH₂–C(OH)(CH₃)₂ (IUPAC: 2-metil-1-fenilpropan-2-ol). Darslik, 124-bet: uchlamchi aromatik spirt.', '2-Metil-1-fenilpropan-2-ol yigʻildi.'],
    'C₆H₅–CH₂–C(OH)(CH₃)₂ — 2-метил-1-фенилпропан-2-ол', { ir: PHE }),
  m('o-cresol', 'phenol', 'C₇H₈O', 'CC1=C(O)C=CC=C1',
    ['о-Крезол (2-метилфенол)', 'CH₃ и OH у соседних атомов кольца (орто-положение). Учебник, с. 124: OH у атома бензольного кольца — это фенол.', 'о-Крезол собран.'],
    ['o-Cresol (2-methylphenol)', 'CH₃ and OH on neighbouring ring atoms (ortho). Textbook p. 124: OH on a benzene-ring atom makes a phenol.', 'o-Cresol built.'],
    ['o-Krezol (2-metilfenol)', 'CH₃ va OH halqaning qoʻshni atomlarida (orto). Darslik, 124-bet: OH benzol halqasi atomida — bu fenol.', 'o-Krezol yigʻildi.'],
    'CH₃–C₆H₄–OH — 2-метилфенол', { ir: PHE }),
  m('m-cresol', 'phenol', 'C₇H₈O', 'CC1=CC(O)=CC=C1',
    ['м-Крезол (3-метилфенол)', 'CH₃ и OH через один атом кольца (мета-положение). Учебник, с. 124.', 'м-Крезол собран.'],
    ['m-Cresol (3-methylphenol)', 'CH₃ and OH one ring atom apart (meta). Textbook p. 124.', 'm-Cresol built.'],
    ['m-Krezol (3-metilfenol)', 'CH₃ va OH halqada bitta atom oraliqda (meta). Darslik, 124-bet.', 'm-Krezol yigʻildi.'],
    'CH₃–C₆H₄–OH — 3-метилфенол', { ir: PHE }),
  m('p-cresol', 'phenol', 'C₇H₈O', 'CC1=CC=C(O)C=C1',
    ['п-Крезол (4-метилфенол)', 'CH₃ и OH напротив друг друга (пара-положение). Учебник, с. 124.', 'п-Крезол собран.'],
    ['p-Cresol (4-methylphenol)', 'CH₃ and OH opposite each other (para). Textbook p. 124.', 'p-Cresol built.'],
    ['p-Krezol (4-metilfenol)', 'CH₃ va OH bir-biriga qarama-qarshi (para). Darslik, 124-bet.', 'p-Krezol yigʻildi.'],
    'CH₃–C₆H₄–OH — 4-метилфенол', { ir: PHE }),
  m('catechol', 'phenol', 'C₆H₆O₂', 'OC1=C(O)C=CC=C1',
    ['Пирокатехин (бензол-1,2-диол)', 'Две группы OH у соседних атомов кольца. В учебнике (с. 125) опечатка «пирокатексин (бензениол-1,2)» — верно пирокатехин, бензол-1,2-диол.', 'Пирокатехин собран — двухатомный фенол.'],
    ['Catechol (benzene-1,2-diol)', 'Two OH groups on neighbouring ring atoms. The textbook (p. 125) has the typo “pirokateksin (benzeniol-1,2)” — correct: catechol (pyrocatechol), benzene-1,2-diol.', 'Catechol built — a dihydric phenol.'],
    ['Pirokatexin (benzol-1,2-diol)', 'Ikki OH halqaning qoʻshni atomlarida. Darslikda (125-bet) «pirokateksin (benzeniol-1,2)» — xato, toʻgʻrisi pirokatexin, benzol-1,2-diol.', 'Pirokatexin yigʻildi — ikki atomli fenol.'],
    'C₆H₄(OH)₂ — бензол-1,2-диол', { ir: PHE }),
  m('resorcinol', 'phenol', 'C₆H₆O₂', 'OC1=CC(O)=CC=C1',
    ['Резорцин (бензол-1,3-диол)', 'Две группы OH в мета-положении. Учебник, с. 125 (таблица двухатомных фенолов).', 'Резорцин собран.'],
    ['Resorcinol (benzene-1,3-diol)', 'Two OH groups in the meta position. Textbook p. 125 (table of dihydric phenols).', 'Resorcinol built.'],
    ['Rezorsin (benzol-1,3-diol)', 'Ikki OH meta-holatda. Darslik, 125-bet (ikki atomli fenollar jadvali).', 'Rezorsin yigʻildi.'],
    'C₆H₄(OH)₂ — бензол-1,3-диол', { ir: PHE }),
  m('hydroquinone', 'phenol', 'C₆H₆O₂', 'OC1=CC=C(O)C=C1',
    ['Гидрохинон (бензол-1,4-диол)', 'Две группы OH в пара-положении. Учебник, с. 124–125.', 'Гидрохинон собран.'],
    ['Hydroquinone (benzene-1,4-diol)', 'Two OH groups in the para position. Textbook pp. 124–125.', 'Hydroquinone built.'],
    ['Gidroxinon (benzol-1,4-diol)', 'Ikki OH para-holatda. Darslik, 124–125-betlar.', 'Gidroxinon yigʻildi.'],
    'C₆H₄(OH)₂ — бензол-1,4-диол', { ir: PHE }),
  m('pyrogallol', 'phenol', 'C₆H₆O₃', 'OC1=C(O)C(O)=CC=C1',
    ['Пирогаллол (бензол-1,2,3-триол)', 'Три группы OH у трёх соседних атомов кольца. Учебник, с. 124–125: трёхатомный фенол.', 'Пирогаллол собран.'],
    ['Pyrogallol (benzene-1,2,3-triol)', 'Three OH groups on three neighbouring ring atoms. Textbook pp. 124–125: a trihydric phenol.', 'Pyrogallol built.'],
    ['Pirogallol (benzol-1,2,3-triol)', 'Uchta OH halqaning ketma-ket qoʻshni atomlarida. Darslik, 124–125-betlar: uch atomli fenol.', 'Pirogallol yigʻildi.'],
    'C₆H₃(OH)₃ — бензол-1,2,3-триол', { ir: PHE }),
  m('phloroglucinol', 'phenol', 'C₆H₆O₃', 'OC1=CC(O)=CC(O)=C1',
    ['Флороглюцин (бензол-1,3,5-триол)', 'Три группы OH через один атом кольца. В учебнике (с. 125) опечатка «флорогютцин (бензентриол-1,3,5)» — верно флороглюцин, бензол-1,3,5-триол.', 'Флороглюцин собран.'],
    ['Phloroglucinol (benzene-1,3,5-triol)', 'Three OH groups on alternate ring atoms. The textbook (p. 125) has the typo “florogyuttsin” — correct: phloroglucinol, benzene-1,3,5-triol.', 'Phloroglucinol built.'],
    ['Floroglyutsin (benzol-1,3,5-triol)', 'Uchta OH halqada bir atom oraliqda. Darslikda (125-bet) «florogyutsin» — xato, toʻgʻrisi floroglyutsin, benzol-1,3,5-triol.', 'Floroglyutsin yigʻildi.'],
    'C₆H₃(OH)₃ — бензол-1,3,5-триол', { ir: PHE }),
  m('2-4-6-tribromophenol', 'phenol', 'C₆H₃Br₃O', 'OC1=C(Br)C=C(Br)C=C1Br',
    ['2,4,6-Трибромфенол', 'Br в обоих орто- и в пара-положении к OH. Учебник, с. 125: белый осадок при действии бромной воды на фенол — качественная реакция.', '2,4,6-Трибромфенол собран — белый осадок.'],
    ['2,4,6-Tribromophenol', 'Br in both ortho positions and the para position to OH. Textbook p. 125: the white precipitate from phenol and bromine water — a qualitative test.', '2,4,6-Tribromophenol built — a white precipitate.'],
    ['2,4,6-Tribromfenol', 'Br OH ga nisbatan ikkala orto- va para-holatda. Darslik, 125-bet: fenolga bromli suv taʼsirida oq choʻkma — sifat reaksiyasi.', '2,4,6-Tribromfenol yigʻildi — oq choʻkma.'],
    'C₆H₅OH + 3Br₂ → C₆H₂Br₃OH↓ + 3HBr', { ir: PHE }),
  m('2-4-6-trimethylphenol', 'phenol', 'C₉H₁₂O', 'CC1=CC(C)=C(O)C(C)=C1',
    ['2,4,6-Триметилфенол', 'Три группы CH₃ в орто- и пара-положениях к OH. Учебник, с. 126, задание: написать изомеры C₉H₁₂O (например 2,3,5-триметилфенол, 4-пропилфенол).', '2,4,6-Триметилфенол собран.'],
    ['2,4,6-Trimethylphenol', 'Three CH₃ groups ortho and para to OH. Textbook p. 126, task: write isomers of C₉H₁₂O (e.g. 2,3,5-trimethylphenol, 4-propylphenol).', '2,4,6-Trimethylphenol built.'],
    ['2,4,6-Trimetilfenol', 'Uchta CH₃ OH ga nisbatan orto- va para-holatlarda. Darslik, 126-bet, topshiriq: C₉H₁₂O izomerlarini yozing (masalan 2,3,5-trimetilfenol, 4-propilfenol).', '2,4,6-Trimetilfenol yigʻildi.'],
    'C₆H₂(CH₃)₃OH — 2,4,6-триметилфенол', { ir: PHE }),

  // ——— § 3.8 Простые эфиры (с. 130–132) ———
  m('methyl-propyl-ether', 'ether', 'C₄H₁₀O', 'COCCC',
    ['Метилпропиловый эфир (1-метоксипропан)', 'CH₃–O–CH₂–CH₂–CH₃. Учебник, с. 130–131: изомер диэтилового эфира (метамерия — радикалы по обе стороны O разные) и межклассовый изомер бутан-1-ола.', '1-Метоксипропан собран.'],
    ['Methyl propyl ether (1-methoxypropane)', 'CH₃–O–CH₂–CH₂–CH₃. Textbook pp. 130–131: an isomer of diethyl ether (metamerism — different radicals on each side of O) and an interclass isomer of butan-1-ol.', '1-Methoxypropane built.'],
    ['Metilpropil efiri (1-metoksipropan)', 'CH₃–O–CH₂–CH₂–CH₃. Darslik, 130–131-betlar: dietil efirining izomeri (metameriya) va butan-1-olning sinflararo izomeri.', '1-Metoksipropan yigʻildi.'],
    'CH₃–O–C₃H₇ — 1-метоксипропан', { ir: [CH, CO_ETH] }),
  m('divinyl-ether', 'ether', 'C₄H₆O', 'C=COC=C',
    ['Дивиниловый эфир', 'CH₂=CH–O–CH=CH₂ (IUPAC: этенилоксиэтен). Учебник, с. 130: непредельный простой эфир.', 'Дивиниловый эфир собран.'],
    ['Divinyl ether', 'CH₂=CH–O–CH=CH₂ (IUPAC: ethenyloxyethene). Textbook p. 130: an unsaturated ether.', 'Divinyl ether built.'],
    ['Divinil efiri', 'CH₂=CH–O–CH=CH₂ (IUPAC: eteniloksieten). Darslik, 130-bet: toʻyinmagan oddiy efir.', 'Divinil efiri yigʻildi.'],
    'CH₂=CH–O–CH=CH₂ — этенилоксиэтен', { ir: [CH, CO_ETH, CC_D] }),
  m('anisole', 'ether', 'C₇H₈O', `CO${PH}`,
    ['Анизол (метилфениловый эфир)', 'CH₃–O–C₆H₅ (IUPAC: метоксибензол). Учебник, с. 130: простой эфир фенола — у атома кольца не OH, а OCH₃, поэтому это не фенол.', 'Анизол собран.'],
    ['Anisole (methyl phenyl ether)', 'CH₃–O–C₆H₅ (IUPAC: methoxybenzene). Textbook p. 130: an ether of phenol — the ring carries OCH₃, not OH, so it is not a phenol.', 'Anisole built.'],
    ['Anizol (metilfenil efiri)', 'CH₃–O–C₆H₅ (IUPAC: metoksibenzol). Darslik, 130-bet: fenolning oddiy efiri — halqada OH emas, OCH₃, shuning uchun fenol emas.', 'Anizol yigʻildi.'],
    'CH₃–O–C₆H₅ — метоксибензол', { ir: [CH, CO_ETH, AROM] }),
  m('butyl-isopropyl-ether', 'ether', 'C₇H₁₆O', 'CC(C)OCCCC',
    ['2-Бутоксипропан', 'CH₃CH(CH₃)–O–(CH₂)₃CH₃ (бутилизопропиловый эфир). Учебник, с. 132: концентрированная HI расщепляет эфир — пропан-2-ол и 1-иодбутан.', '2-Бутоксипропан собран.'],
    ['2-Butoxypropane', 'CH₃CH(CH₃)–O–(CH₂)₃CH₃ (butyl isopropyl ether). Textbook p. 132: concentrated HI cleaves the ether — propan-2-ol and 1-iodobutane.', '2-Butoxypropane built.'],
    ['2-Butoksipropan', 'CH₃CH(CH₃)–O–(CH₂)₃CH₃ (butilizopropil efiri). Darslik, 132-bet: konsentrlangan HI efirni parchalaydi — propan-2-ol va 1-yodbutan.', '2-Butoksipropan yigʻildi.'],
    'CH₃CH(CH₃)–O–(CH₂)₃CH₃ + HI → CH₃CH(OH)CH₃ + CH₃(CH₂)₃I', { ir: [CH, CO_ETH] }),

  // ——— § 3.9–3.10 Альдегиды (с. 133–136) ———
  m('propanal', 'aldehyde', 'C₃H₆O', 'CCC=O',
    ['Пропаналь (пропионовый альдегид)', 'CH₃–CH₂–CHO. Учебник, с. 133–134: гидрирование даёт пропан-1-ол, «серебряное зеркало» — пропановую кислоту. С. 137: изомер ацетона (C₃H₆O).', 'Пропаналь собран.'],
    ['Propanal (propionaldehyde)', 'CH₃–CH₂–CHO. Textbook pp. 133–134: hydrogenation gives propan-1-ol, the “silver mirror” gives propanoic acid. P. 137: an isomer of acetone (C₃H₆O).', 'Propanal built.'],
    ['Propanal (propion aldegid)', 'CH₃–CH₂–CHO. Darslik, 133–134-betlar: gidrogenlash propan-1-ol, «kumush koʻzgu» — propan kislota beradi. 137-bet: atsetonning izomeri (C₃H₆O).', 'Propanal yigʻildi.'],
    'CH₃CH₂CHO + H₂ → CH₃CH₂CH₂OH', { ir: [CH, CO_ALD] }),
  m('butanal', 'aldehyde', 'C₄H₈O', 'CCCC=O',
    ['Бутаналь (масляный альдегид)', 'CH₃–CH₂–CH₂–CHO. Учебник, с. 133: гомологический ряд альдегидов.', 'Бутаналь собран.'],
    ['Butanal (butyraldehyde)', 'CH₃–CH₂–CH₂–CHO. Textbook p. 133: the homologous series of aldehydes.', 'Butanal built.'],
    ['Butanal (moy aldegidi)', 'CH₃–CH₂–CH₂–CHO. Darslik, 133-bet: aldegidlarning gomologik qatori.', 'Butanal yigʻildi.'],
    'C₃H₇–CHO — бутаналь', { ir: [CH, CO_ALD] }),
  m('isobutanal', 'aldehyde', 'C₄H₈O', 'CC(C)C=O',
    ['2-Метилпропаналь (изомасляный альдегид)', '(CH₃)₂CH–CHO. Учебник, с. 133: изомер бутаналя с разветвлённой цепью; нумерация от атома C альдегидной группы.', '2-Метилпропаналь собран.'],
    ['2-Methylpropanal (isobutyraldehyde)', '(CH₃)₂CH–CHO. Textbook p. 133: a branched isomer of butanal; numbering starts at the aldehyde carbon.', '2-Methylpropanal built.'],
    ['2-Metilpropanal (izomoy aldegidi)', '(CH₃)₂CH–CHO. Darslik, 133-bet: butanalning tarmoqlangan izomeri; raqamlash aldegid guruhi C atomidan.', '2-Metilpropanal yigʻildi.'],
    '(CH₃)₂CH–CHO — 2-метилпропаналь', { ir: [CH, CO_ALD] }),
  m('vinyl-alcohol', 'alcohol', 'C₂H₄O', 'C=CO',
    ['Виниловый спирт (этенол)', 'CH₂=CH–OH: группа OH у атома C двойной связи. Учебник, с. 133: неустойчивое промежуточное вещество реакции Кучерова — сразу перестраивается в уксусный альдегид (изомер C₂H₄O).', 'Этенол собран — он неустойчив.'],
    ['Vinyl alcohol (ethenol)', 'CH₂=CH–OH: OH on a double-bond carbon. Textbook p. 133: the unstable intermediate of the Kucherov reaction — it at once rearranges into acetaldehyde (an isomer, C₂H₄O).', 'Ethenol built — it is unstable.'],
    ['Vinil spirti (etenol)', 'CH₂=CH–OH: OH qoʻsh bogʻ C atomida. Darslik, 133-bet: Kucherov reaksiyasining beqaror oraliq moddasi — darhol sirka aldegidiga aylanadi (C₂H₄O izomeri).', 'Etenol yigʻildi — u beqaror.'],
    'HC≡CH + H₂O → [CH₂=CH–OH] → CH₃CHO', { ir: [OH, CC_D] }),

  // ——— § 3.11 Кетоны (с. 137–138) ———
  m('pentan-3-one', 'ketone', 'C₅H₁₀O', 'CCC(=O)CC',
    ['Диэтилкетон (пентан-3-он)', 'C₂H₅–CO–C₂H₅. Учебник, с. 137: карбонильная группа в середине цепи из 5 C.', 'Пентан-3-он собран.'],
    ['Diethyl ketone (pentan-3-one)', 'C₂H₅–CO–C₂H₅. Textbook p. 137: the carbonyl group in the middle of a 5-carbon chain.', 'Pentan-3-one built.'],
    ['Dietilketon (pentan-3-on)', 'C₂H₅–CO–C₂H₅. Darslik, 137-bet: karbonil guruhi 5 C zanjir oʻrtasida.', 'Pentan-3-on yigʻildi.'],
    'C₂H₅–CO–C₂H₅ — пентан-3-он', { ir: [CH, CO_KET] }),
  m('pentan-2-one', 'ketone', 'C₅H₁₀O', 'CC(=O)CCC',
    ['Метилпропилкетон (пентан-2-он)', 'CH₃–CO–CH₂–CH₂–CH₃. Учебник, с. 137: изомер диэтилкетона — положение группы C=O другое.', 'Пентан-2-он собран.'],
    ['Methyl propyl ketone (pentan-2-one)', 'CH₃–CO–CH₂–CH₂–CH₃. Textbook p. 137: an isomer of diethyl ketone with the C=O in another position.', 'Pentan-2-one built.'],
    ['Metilpropilketon (pentan-2-on)', 'CH₃–CO–CH₂–CH₂–CH₃. Darslik, 137-bet: dietilketon izomeri — C=O guruhi boshqa holatda.', 'Pentan-2-on yigʻildi.'],
    'CH₃–CO–C₃H₇ — пентан-2-он', { ir: [CH, CO_KET] }),

  // ——— § 3.12–3.13 Карбоновые кислоты (с. 140–142) ———
  m('butanoic-acid', 'acid', 'C₄H₈O₂', 'CCCC(=O)O',
    ['Масляная кислота (бутановая)', 'C₃H₇–COOH. Учебник, с. 140 (таблица): тривиальное название — масляная, систематическое — бутановая. С. 141: вытесняется из бутаноата натрия серной кислотой.', 'Масляная кислота собрана.'],
    ['Butyric acid (butanoic acid)', 'C₃H₇–COOH. Textbook p. 140 (table): trivial name butyric, systematic butanoic. P. 141: sulfuric acid releases it from sodium butanoate.', 'Butyric acid built.'],
    ['Moy kislota (butan kislota)', 'C₃H₇–COOH. Darslik, 140-bet (jadval): trivial nomi — moy kislota, sistematik — butan kislota. 141-bet: natriy butanoatdan sulfat kislota bilan siqib chiqariladi.', 'Moy kislota yigʻildi.'],
    '2CH₃CH₂CH₂COONa + H₂SO₄ → 2CH₃CH₂CH₂COOH + Na₂SO₄', { ir: ACID }),
  m('pentanoic-acid', 'acid', 'C₅H₁₀O₂', 'CCCCC(=O)O',
    ['Валериановая кислота (пентановая)', 'C₄H₉–COOH. Учебник, с. 140 (таблица): валериановая — пентановая кислота.', 'Валериановая кислота собрана.'],
    ['Valeric acid (pentanoic acid)', 'C₄H₉–COOH. Textbook p. 140 (table): valeric = pentanoic acid.', 'Valeric acid built.'],
    ['Valerian kislota (pentan kislota)', 'C₄H₉–COOH. Darslik, 140-bet (jadval): valerian — pentan kislota.', 'Valerian kislota yigʻildi.'],
    'C₄H₉–COOH — пентановая кислота', { ir: ACID }),
  m('hexanoic-acid', 'acid', 'C₆H₁₂O₂', 'CCCCCC(=O)O',
    ['Капроновая кислота (гексановая)', 'C₅H₁₁–COOH. Учебник, с. 140 и 152: капроновая — гексановая кислота, насыщенная.', 'Капроновая кислота собрана.'],
    ['Caproic acid (hexanoic acid)', 'C₅H₁₁–COOH. Textbook pp. 140 and 152: caproic = hexanoic acid, saturated.', 'Caproic acid built.'],
    ['Kapron kislota (geksan kislota)', 'C₅H₁₁–COOH. Darslik, 140 va 152-betlar: kapron — geksan kislota, toʻyingan.', 'Kapron kislota yigʻildi.'],
    'C₅H₁₁–COOH — гексановая кислота', { ir: ACID }),
  m('palmitic-acid', 'acid', 'C₁₆H₃₂O₂', `${cn(15)}C(=O)O`,
    ['Пальмитиновая кислота (гексадекановая)', 'C₁₅H₃₁–COOH: насыщенная цепь из 16 C. Учебник, с. 140 и 152: высшая жирная кислота, входит в состав жиров (трипальмитин).', 'Пальмитиновая кислота собрана.'],
    ['Palmitic acid (hexadecanoic acid)', 'C₁₅H₃₁–COOH: a saturated 16-carbon chain. Textbook pp. 140 and 152: a higher fatty acid found in fats (tripalmitin).', 'Palmitic acid built.'],
    ['Palmitin kislota (geksadekan kislota)', 'C₁₅H₃₁–COOH: toʻyingan 16 C zanjir. Darslik, 140 va 152-betlar: yogʻlar tarkibidagi yuqori yogʻ kislota (tripalmitin).', 'Palmitin kislota yigʻildi.'],
    'C₁₅H₃₁COOH — гексадекановая кислота', { ir: ACID }),
  m('margaric-acid', 'acid', 'C₁₇H₃₄O₂', `${cn(16)}C(=O)O`,
    ['Маргариновая кислота (гептадекановая)', 'C₁₆H₃₃–COOH: насыщенная цепь из 17 C. Учебник, с. 152: в таблице жирных кислот.', 'Маргариновая кислота собрана.'],
    ['Margaric acid (heptadecanoic acid)', 'C₁₆H₃₃–COOH: a saturated 17-carbon chain. Textbook p. 152: in the table of fatty acids.', 'Margaric acid built.'],
    ['Margarin kislota (geptadekan kislota)', 'C₁₆H₃₃–COOH: toʻyingan 17 C zanjir. Darslik, 152-bet: yogʻ kislotalar jadvalida.', 'Margarin kislota yigʻildi.'],
    'C₁₆H₃₃COOH — гептадекановая кислота', { ir: ACID }),
  m('stearic-acid', 'acid', 'C₁₈H₃₆O₂', `${cn(17)}C(=O)O`,
    ['Стеариновая кислота (октадекановая)', 'C₁₇H₃₅–COOH: насыщенная цепь из 18 C. Учебник, с. 140, 142 и 152: с глицерином даёт тристеарин.', 'Стеариновая кислота собрана.'],
    ['Stearic acid (octadecanoic acid)', 'C₁₇H₃₅–COOH: a saturated 18-carbon chain. Textbook pp. 140, 142 and 152: with glycerol it gives tristearin.', 'Stearic acid built.'],
    ['Stearin kislota (oktadekan kislota)', 'C₁₇H₃₅–COOH: toʻyingan 18 C zanjir. Darslik, 140, 142 va 152-betlar: glitserin bilan tristearin beradi.', 'Stearin kislota yigʻildi.'],
    'C₃H₅(OH)₃ + 3C₁₇H₃₅COOH → (C₁₇H₃₅COO)₃C₃H₅ + 3H₂O', { ir: ACID }),
  m('2-methylbutanoic-acid', 'acid', 'C₅H₁₀O₂', 'CCC(C)C(=O)O',
    ['2-Метилбутановая кислота', 'CH₃–CH₂–CH(CH₃)–COOH: нумерация с атома C карбоксильной группы, метил у C2. Учебник, с. 140.', '2-Метилбутановая кислота собрана.'],
    ['2-Methylbutanoic acid', 'CH₃–CH₂–CH(CH₃)–COOH: numbering starts at the carboxyl carbon, methyl on C2. Textbook p. 140.', '2-Methylbutanoic acid built.'],
    ['2-Metilbutan kislota', 'CH₃–CH₂–CH(CH₃)–COOH: raqamlash karboksil C atomidan, C2 da metil. Darslik, 140-bet.', '2-Metilbutan kislota yigʻildi.'],
    'CH₃–CH₂–CH(CH₃)–COOH — 2-метилбутановая кислота', { ir: ACID }),
  m('chloroacetic-acid', 'acid', 'C₂H₃ClO₂', 'ClCC(=O)O',
    ['Хлоруксусная кислота', 'CH₂Cl–COOH. Учебник, с. 142: продукт хлорирования уксусной кислоты на свету. В учебнике названа «хлорическая уксусная кислота» — неверно: «хлорная», «хлорноватая» — названия неорганических кислот хлора; верно — хлоруксусная (IUPAC: хлорэтановая).', 'Хлоруксусная кислота собрана.'],
    ['Chloroacetic acid', 'CH₂Cl–COOH. Textbook p. 142: the product of chlorinating acetic acid in light. The textbook’s Russian name «хлорическая уксусная кислота» is wrong (it echoes the names of inorganic chlorine acids); correct — chloroacetic acid (IUPAC: chloroethanoic acid).', 'Chloroacetic acid built.'],
    ['Xlorsirka kislota', 'CH₂Cl–COOH. Darslik, 142-bet: sirka kislotani yorugʻlikda xlorlash mahsuloti. Darslikdagi «xlorik sirka kislota» nomi notoʻgʻri (xlorning anorganik kislotalari nomiga oʻxshaydi); toʻgʻrisi — xlorsirka kislota (IUPAC: xloretan kislota).', 'Xlorsirka kislota yigʻildi.'],
    'CH₃COOH + Cl₂ → CH₂ClCOOH + HCl', { ir: ACID }),
  m('dichloroacetic-acid', 'acid', 'C₂H₂Cl₂O₂', 'ClC(Cl)C(=O)O',
    ['Дихлоруксусная кислота', 'CHCl₂–COOH. Учебник, с. 142: вторая стадия хлорирования. В учебнике — «дихлорическая уксусная кислота», верно — дихлоруксусная (IUPAC: дихлорэтановая).', 'Дихлоруксусная кислота собрана.'],
    ['Dichloroacetic acid', 'CHCl₂–COOH. Textbook p. 142: the second chlorination step. The textbook calls it «дихлорическая уксусная кислота»; correct — dichloroacetic acid (IUPAC: dichloroethanoic acid).', 'Dichloroacetic acid built.'],
    ['Dixlorsirka kislota', 'CHCl₂–COOH. Darslik, 142-bet: xlorlashning ikkinchi bosqichi. Darslikda — «dixlorik sirka kislota», toʻgʻrisi — dixlorsirka kislota.', 'Dixlorsirka kislota yigʻildi.'],
    'CH₂ClCOOH + Cl₂ → CHCl₂COOH + HCl', { ir: ACID }),
  m('trichloroacetic-acid', 'acid', 'C₂HCl₃O₂', 'ClC(Cl)(Cl)C(=O)O',
    ['Трихлоруксусная кислота', 'CCl₃–COOH. Учебник, с. 142: третья стадия хлорирования. В учебнике — «трихлорическая уксусная кислота», верно — трихлоруксусная (IUPAC: трихлорэтановая).', 'Трихлоруксусная кислота собрана.'],
    ['Trichloroacetic acid', 'CCl₃–COOH. Textbook p. 142: the third chlorination step. The textbook calls it «трихлорическая уксусная кислота»; correct — trichloroacetic acid (IUPAC: trichloroethanoic acid).', 'Trichloroacetic acid built.'],
    ['Trixlorsirka kislota', 'CCl₃–COOH. Darslik, 142-bet: xlorlashning uchinchi bosqichi. Darslikda — «trixlorik sirka kislota», toʻgʻrisi — trixlorsirka kislota.', 'Trixlorsirka kislota yigʻildi.'],
    'CHCl₂COOH + Cl₂ → CCl₃COOH + HCl', { ir: ACID }),

  // ——— § 3.14–3.15 Сложные эфиры (с. 146–149) ———
  m('methyl-formate', 'ester', 'C₂H₄O₂', 'O=COC',
    ['Метилформиат (метилметаноат)', 'H–COO–CH₃: эфир муравьиной кислоты и метанола. Учебник, с. 146–147: межклассовый изомер уксусной кислоты (C₂H₄O₂).', 'Метилформиат собран.'],
    ['Methyl formate (methyl methanoate)', 'H–COO–CH₃: the ester of formic acid and methanol. Textbook pp. 146–147: an interclass isomer of acetic acid (C₂H₄O₂).', 'Methyl formate built.'],
    ['Metilformiat (metilmetanoat)', 'H–COO–CH₃: chumoli kislota va metanol efiri. Darslik, 146–147-betlar: sirka kislotaning sinflararo izomeri (C₂H₄O₂).', 'Metilformiat yigʻildi.'],
    'HCOOCH₃ — метилметаноат', { ir: EST }),
  m('ethyl-formate', 'ester', 'C₃H₆O₂', 'O=COCC',
    ['Этилформиат (этилметаноат)', 'H–COO–C₂H₅: этиловый эфир муравьиной кислоты. Учебник, с. 146.', 'Этилформиат собран.'],
    ['Ethyl formate (ethyl methanoate)', 'H–COO–C₂H₅: the ethyl ester of formic acid. Textbook p. 146.', 'Ethyl formate built.'],
    ['Etilformiat (etilmetanoat)', 'H–COO–C₂H₅: chumoli kislotaning etil efiri. Darslik, 146-bet.', 'Etilformiat yigʻildi.'],
    'HCOOC₂H₅ — этилметаноат', { ir: EST }),
  m('methyl-acetate', 'ester', 'C₃H₆O₂', 'CC(=O)OC',
    ['Метилацетат (метилэтаноат)', 'CH₃–COO–CH₃. Учебник, с. 147: сложный эфир с запахом яблок; с. 149, задание 3: образуется из уксусной кислоты и метанола.', 'Метилацетат собран.'],
    ['Methyl acetate (methyl ethanoate)', 'CH₃–COO–CH₃. Textbook p. 147: an ester that smells of apples; p. 149, task 3: formed from acetic acid and methanol.', 'Methyl acetate built.'],
    ['Metilatsetat (metiletanoat)', 'CH₃–COO–CH₃. Darslik, 147-bet: olma hidli murakkab efir; 149-bet, 3-topshiriq: sirka kislota va metanoldan hosil boʻladi.', 'Metilatsetat yigʻildi.'],
    'CH₃COOH + CH₃OH → CH₃COOCH₃ + H₂O', { ir: EST }),
  m('methyl-propionate', 'ester', 'C₄H₈O₂', 'CCC(=O)OC',
    ['Метилпропионат (метилпропаноат)', 'C₂H₅–COO–CH₃. Учебник, с. 146–147: изомер этилацетата — эфирная группа в другом месте цепи (C₄H₈O₂).', 'Метилпропионат собран.'],
    ['Methyl propionate (methyl propanoate)', 'C₂H₅–COO–CH₃. Textbook pp. 146–147: an isomer of ethyl acetate — the ester group sits elsewhere in the chain (C₄H₈O₂).', 'Methyl propionate built.'],
    ['Metilpropionat (metilpropanoat)', 'C₂H₅–COO–CH₃. Darslik, 146–147-betlar: etilatsetat izomeri — efir guruhi zanjirning boshqa joyida (C₄H₈O₂).', 'Metilpropionat yigʻildi.'],
    'C₂H₅COOCH₃ — метилпропаноат', { ir: EST }),
  m('butyl-acetate', 'ester', 'C₆H₁₂O₂', 'CC(=O)OCCCC',
    ['Бутилацетат (бутилэтаноат)', 'CH₃–COO–C₄H₉. Учебник, с. 146 и 149 (задание): вещество CH₃COOC₄H₉ называется бутилацетат.', 'Бутилацетат собран.'],
    ['Butyl acetate (butyl ethanoate)', 'CH₃–COO–C₄H₉. Textbook pp. 146 and 149 (task): CH₃COOC₄H₉ is butyl acetate.', 'Butyl acetate built.'],
    ['Butilatsetat (butiletanoat)', 'CH₃–COO–C₄H₉. Darslik, 146 va 149-betlar (topshiriq): CH₃COOC₄H₉ — butilatsetat.', 'Butilatsetat yigʻildi.'],
    'CH₃COOC₄H₉ — бутилэтаноат', { ir: EST }),
  m('butyl-propionate', 'ester', 'C₇H₁₄O₂', 'CCC(=O)OCCCC',
    ['Бутилпропионат (бутилпропаноат)', 'CH₃–CH₂–C(O)–O–C₄H₉. В учебнике (с. 146) формула записана «H₃C₂–C₂H–C(O)–O–C₄H₉» — неверно; остаток пропионовой кислоты — CH₃–CH₂–C(O)–.', 'Бутилпропионат собран.'],
    ['Butyl propionate (butyl propanoate)', 'CH₃–CH₂–C(O)–O–C₄H₉. The textbook (p. 146) writes the formula as “H₃C₂–C₂H–C(O)–O–C₄H₉”, which is wrong; the propionic acid residue is CH₃–CH₂–C(O)–.', 'Butyl propionate built.'],
    ['Butilpropionat (butilpropanoat)', 'CH₃–CH₂–C(O)–O–C₄H₉. Darslikda (146-bet) formula «H₃C₂–C₂H–C(O)–O–C₄H₉» deb yozilgan — notoʻgʻri; propion kislota qoldigʻi CH₃–CH₂–C(O)–.', 'Butilpropionat yigʻildi.'],
    'C₂H₅COOC₄H₉ — бутилпропаноат', { ir: EST }),
  m('ethyl-isobutyrate', 'ester', 'C₆H₁₂O₂', 'CC(C)C(=O)OCC',
    ['Этилизобутират (этил-2-метилпропаноат)', '(CH₃)₂CH–COO–C₂H₅. Учебник, с. 147: один из изомеров C₆H₁₂O₂.', 'Этилизобутират собран.'],
    ['Ethyl isobutyrate (ethyl 2-methylpropanoate)', '(CH₃)₂CH–COO–C₂H₅. Textbook p. 147: one of the C₆H₁₂O₂ isomers.', 'Ethyl isobutyrate built.'],
    ['Etilizobutirat (etil-2-metilpropanoat)', '(CH₃)₂CH–COO–C₂H₅. Darslik, 147-bet: C₆H₁₂O₂ izomerlaridan biri.', 'Etilizobutirat yigʻildi.'],
    '(CH₃)₂CHCOOC₂H₅ — этил-2-метилпропаноат', { ir: EST }),
  m('ethyl-butyrate', 'ester', 'C₆H₁₂O₂', 'CCCC(=O)OCC',
    ['Этилбутират (этилбутаноат)', 'CH₃–CH₂–CH₂–C(O)–O–CH₂–CH₃. В учебнике (с. 147) нарисован как «CH₃–CH₂–C(O)–O–CH₂–CH₂» — у кислотного остатка не хватает CH₂, а у этила — концевого H; верная формула — выше.', 'Этилбутират собран.'],
    ['Ethyl butyrate (ethyl butanoate)', 'CH₃–CH₂–CH₂–C(O)–O–CH₂–CH₃. The textbook (p. 147) draws “CH₃–CH₂–C(O)–O–CH₂–CH₂” — the acid part lacks a CH₂ and the ethyl lacks its end H; the correct formula is above.', 'Ethyl butyrate built.'],
    ['Etilbutirat (etilbutanoat)', 'CH₃–CH₂–CH₂–C(O)–O–CH₂–CH₃. Darslikda (147-bet) «CH₃–CH₂–C(O)–O–CH₂–CH₂» deb chizilgan — kislota qoldigʻida CH₂ yetishmaydi; toʻgʻri formula — yuqorida.', 'Etilbutirat yigʻildi.'],
    'C₃H₇COOC₂H₅ — этилбутаноат', { ir: EST }),
  m('propyl-propionate', 'ester', 'C₆H₁₂O₂', 'CCC(=O)OCCC',
    ['Пропилпропионат (пропилпропаноат)', 'C₂H₅–COO–C₃H₇. Учебник, с. 147: в тексте опечатка «пропилпропонат».', 'Пропилпропионат собран.'],
    ['Propyl propionate (propyl propanoate)', 'C₂H₅–COO–C₃H₇. Textbook p. 147: the text has the typo “propylproponate”.', 'Propyl propionate built.'],
    ['Propilpropionat (propilpropanoat)', 'C₂H₅–COO–C₃H₇. Darslik, 147-bet: matnda «propilproponat» xatosi.', 'Propilpropionat yigʻildi.'],
    'C₂H₅COOC₃H₇ — пропилпропаноат', { ir: EST }),
  m('isopropyl-propionate', 'ester', 'C₆H₁₂O₂', 'CCC(=O)OC(C)C',
    ['Изопропилпропионат (пропан-2-илпропаноат)', 'C₂H₅–COO–CH(CH₃)₂. Учебник, с. 147: изомер пропилпропионата — спиртовой радикал разветвлён.', 'Изопропилпропионат собран.'],
    ['Isopropyl propionate (propan-2-yl propanoate)', 'C₂H₅–COO–CH(CH₃)₂. Textbook p. 147: an isomer of propyl propionate with a branched alcohol radical.', 'Isopropyl propionate built.'],
    ['Izopropilpropionat (propan-2-ilpropanoat)', 'C₂H₅–COO–CH(CH₃)₂. Darslik, 147-bet: propilpropionat izomeri — spirt radikali tarmoqlangan.', 'Izopropilpropionat yigʻildi.'],
    'C₂H₅COOCH(CH₃)₂ — пропан-2-илпропаноат', { ir: EST }),
  m('isoamyl-acetate', 'ester', 'C₇H₁₄O₂', 'CC(=O)OCCC(C)C',
    ['Изоамилацетат (3-метилбутилэтаноат)', 'CH₃–COO–CH₂–CH₂–CH(CH₃)₂. Учебник, с. 147: сложный эфир с запахом груши.', 'Изоамилацетат собран.'],
    ['Isoamyl acetate (3-methylbutyl ethanoate)', 'CH₃–COO–CH₂–CH₂–CH(CH₃)₂. Textbook p. 147: an ester that smells of pears.', 'Isoamyl acetate built.'],
    ['Izoamilatsetat (3-metilbutiletanoat)', 'CH₃–COO–CH₂–CH₂–CH(CH₃)₂. Darslik, 147-bet: nok hidli murakkab efir.', 'Izoamilatsetat yigʻildi.'],
    'CH₃COOC₅H₁₁ — 3-метилбутилэтаноат', { ir: EST }),
  m('pentyl-formate', 'ester', 'C₆H₁₂O₂', 'O=COCCCCC',
    ['Пентилформиат (пентилметаноат)', 'H–COO–(CH₂)₄CH₃. В учебнике (с. 147) опечатка «пентилметионат» — верно пентилметаноат (пентилформиат).', 'Пентилформиат собран.'],
    ['Pentyl formate (pentyl methanoate)', 'H–COO–(CH₂)₄CH₃. The textbook (p. 147) has the typo “pentyl methionate” — correct: pentyl methanoate (pentyl formate).', 'Pentyl formate built.'],
    ['Pentilformiat (pentilmetanoat)', 'H–COO–(CH₂)₄CH₃. Darslikda (147-bet) «pentilmetionat» xatosi — toʻgʻrisi pentilmetanoat (pentilformiat).', 'Pentilformiat yigʻildi.'],
    'HCOO(CH₂)₄CH₃ — пентилметаноат', { ir: EST }),

  // ——— § 3.16–3.17 Жиры и мыла (с. 152–155) ———
  m('palmitoleic-acid', 'acid', 'C₁₆H₃₀O₂', `${cn(6)}C=C${cn(7)}C(=O)O`,
    ['Пальмитолеиновая кислота', 'C₁₅H₂₉–COOH: одна двойная связь C9=C10 (цис). Учебник, с. 152: ненасыщенная жирная кислота. Модель показывает связи; цис-изгиб цепи в 3D не задан.', 'Пальмитолеиновая кислота собрана.'],
    ['Palmitoleic acid', 'C₁₅H₂₉–COOH: one C9=C10 double bond (cis). Textbook p. 152: an unsaturated fatty acid. The model shows the bonds; the cis bend of the chain is not set in 3D.', 'Palmitoleic acid built.'],
    ['Palmitolein kislota', 'C₁₅H₂₉–COOH: bitta C9=C10 qoʻsh bogʻ (sis). Darslik, 152-bet: toʻyinmagan yogʻ kislota. Model bogʻlarni koʻrsatadi; sis-egilish 3D da berilmagan.', 'Palmitolein kislota yigʻildi.'],
    'C₁₅H₂₉COOH — пальмитолеиновая кислота', { ir: [OH, COOH, CC_D] }),
  m('oleic-acid', 'acid', 'C₁₈H₃₄O₂', `${cn(8)}C=C${cn(7)}C(=O)O`,
    ['Олеиновая кислота', 'C₁₇H₃₃–COOH: одна двойная связь C9=C10 (цис). Учебник, с. 152–154: входит в триолеин — жидкий жир. Цис-изгиб цепи в 3D не задан.', 'Олеиновая кислота собрана.'],
    ['Oleic acid', 'C₁₇H₃₃–COOH: one C9=C10 double bond (cis). Textbook pp. 152–154: part of triolein, a liquid fat. The cis bend is not set in 3D.', 'Oleic acid built.'],
    ['Olein kislota', 'C₁₇H₃₃–COOH: bitta C9=C10 qoʻsh bogʻ (sis). Darslik, 152–154-betlar: suyuq yogʻ — triolein tarkibida. Sis-egilish 3D da berilmagan.', 'Olein kislota yigʻildi.'],
    'C₃H₅(OH)₃ + 3C₁₇H₃₃COOH → (C₁₇H₃₃COO)₃C₃H₅ + 3H₂O', { ir: [OH, COOH, CC_D] }),
  m('linoleic-acid', 'acid', 'C₁₈H₃₂O₂', `${cn(5)}C=CCC=C${cn(7)}C(=O)O`,
    ['Линолевая кислота', 'C₁₇H₃₁–COOH: две двойные связи C9=C10 и C12=C13 (цис). Учебник, с. 152.', 'Линолевая кислота собрана.'],
    ['Linoleic acid', 'C₁₇H₃₁–COOH: two double bonds, C9=C10 and C12=C13 (cis). Textbook p. 152.', 'Linoleic acid built.'],
    ['Linol kislota', 'C₁₇H₃₁–COOH: ikki qoʻsh bogʻ, C9=C10 va C12=C13 (sis). Darslik, 152-bet.', 'Linol kislota yigʻildi.'],
    'C₁₇H₃₁COOH — линолевая кислота', { ir: [OH, COOH, CC_D] }),
  m('linolenic-acid', 'acid', 'C₁₈H₃₀O₂', `CCC=CCC=CCC=C${cn(7)}C(=O)O`,
    ['Линоленовая кислота', 'C₁₇H₂₉–COOH: три двойные связи C9=C10, C12=C13, C15=C16 (цис). Учебник, с. 152.', 'Линоленовая кислота собрана.'],
    ['Linolenic acid', 'C₁₇H₂₉–COOH: three double bonds, C9=C10, C12=C13, C15=C16 (cis). Textbook p. 152.', 'Linolenic acid built.'],
    ['Linolen kislota', 'C₁₇H₂₉–COOH: uchta qoʻsh bogʻ, C9=C10, C12=C13, C15=C16 (sis). Darslik, 152-bet.', 'Linolen kislota yigʻildi.'],
    'C₁₇H₂₉COOH — линоленовая кислота', { ir: [OH, COOH, CC_D] }),
  m('tristearin', 'ester', 'C₅₇H₁₁₀O₆', `C(OC(=O)${cn(17)})C(OC(=O)${cn(17)})COC(=O)${cn(17)}`,
    ['Тристеарин', '(C₁₇H₃₅COO)₃C₃H₅: глицерин, этерифицированный тремя остатками стеариновой кислоты, — твёрдый жир. Учебник, с. 142 и 153: при омылении даёт глицерин и мыло (стеарат натрия).', 'Тристеарин собран — твёрдый жир.'],
    ['Tristearin', '(C₁₇H₃₅COO)₃C₃H₅: glycerol esterified with three stearic acid residues — a solid fat. Textbook pp. 142 and 153: saponification gives glycerol and soap (sodium stearate).', 'Tristearin built — a solid fat.'],
    ['Tristearin', '(C₁₇H₃₅COO)₃C₃H₅: uchta stearin kislota qoldigʻi bilan eterlangan glitserin — qattiq yogʻ. Darslik, 142 va 153-betlar: sovunlanganda glitserin va sovun (natriy stearat) beradi.', 'Tristearin yigʻildi — qattiq yogʻ.'],
    '(C₁₇H₃₅COO)₃C₃H₅ + 3NaOH → C₃H₅(OH)₃ + 3C₁₇H₃₅COONa', { ir: EST }),
  m('tripalmitin', 'ester', 'C₅₁H₉₈O₆', `C(OC(=O)${cn(15)})C(OC(=O)${cn(15)})COC(=O)${cn(15)}`,
    ['Трипальмитин', '(C₁₅H₃₁COO)₃C₃H₅: триглицерид пальмитиновой кислоты. Учебник, с. 155: практическое занятие — омыление жира.', 'Трипальмитин собран.'],
    ['Tripalmitin', '(C₁₅H₃₁COO)₃C₃H₅: the triglyceride of palmitic acid. Textbook p. 155: practical work — saponifying a fat.', 'Tripalmitin built.'],
    ['Tripalmitin', '(C₁₅H₃₁COO)₃C₃H₅: palmitin kislota triglitseridi. Darslik, 155-bet: amaliy mashgʻulot — yogʻni sovunlash.', 'Tripalmitin yigʻildi.'],
    '(C₁₅H₃₁COO)₃C₃H₅ + 3NaOH → C₃H₅(OH)₃ + 3C₁₅H₃₁COONa', { ir: EST }),
  m('triolein', 'ester', 'C₅₇H₁₀₄O₆', `C(OC(=O)${OLEYL})C(OC(=O)${OLEYL})COC(=O)${OLEYL}`,
    ['Триолеин', '(C₁₇H₃₃COO)₃C₃H₅: триглицерид олеиновой кислоты, в каждом остатке одна двойная связь — жидкий жир (масло). Учебник, с. 153–154: гидрогенизация превращает его в тристеарин; реакция Бертло.', 'Триолеин собран — жидкий жир.'],
    ['Triolein', '(C₁₇H₃₃COO)₃C₃H₅: the triglyceride of oleic acid, one double bond per residue — a liquid fat (oil). Textbook pp. 153–154: hydrogenation turns it into tristearin; the Berthelot reaction.', 'Triolein built — a liquid fat.'],
    ['Triolein', '(C₁₇H₃₃COO)₃C₃H₅: olein kislota triglitseridi, har qoldiqda bitta qoʻsh bogʻ — suyuq yogʻ (moy). Darslik, 153–154-betlar: gidrogenlash uni tristearinga aylantiradi; Bertlo reaksiyasi.', 'Triolein yigʻildi — suyuq yogʻ.'],
    '(C₁₇H₃₃COO)₃C₃H₅ + 3H₂ → (C₁₇H₃₅COO)₃C₃H₅', { ir: [CH, CO_EST, CC_D] }),

  // ——— § 3.18 Моносахариды (с. 156–159) ———
  // Модель задаёт связи; пространственное положение OH (D/L, α/β) в 3D не различается — это сказано в подсказках.
  m('ribose', 'carb', 'C₅H₁₀O₅', 'O=CC(O)C(O)C(O)CO',
    ['Рибоза (открытая форма)', 'CH₂OH–(CHOH)₃–CHO: пентоза — пять атомов C, альдегидная группа и четыре OH. Учебник, с. 156: моносахариды — альдегидоспирты или кетоноспирты (в учебнике «альдегидные спирты или кетоспирты»).', 'Рибоза собрана — альдопентоза.'],
    ['Ribose (open chain)', 'CH₂OH–(CHOH)₃–CHO: a pentose — five carbons, an aldehyde group and four OH. Textbook p. 156: monosaccharides are aldehyde-alcohols or ketone-alcohols.', 'Ribose built — an aldopentose.'],
    ['Riboza (ochiq shakl)', 'CH₂OH–(CHOH)₃–CHO: pentoza — beshta C, aldegid guruhi va toʻrtta OH. Darslik, 156-bet: monosaxaridlar — aldegidospirtlar yoki ketonospirtlar.', 'Riboza yigʻildi — aldopentoza.'],
    'C₅H₁₀O₅ — рибоза', { ir: [OH, CH, CO_ALD] }),
  m('glyceraldehyde', 'carb', 'C₃H₆O₃', 'O=CC(O)CO',
    ['Глицериновый альдегид (D- и L-)', 'CH₂OH–CH(OH)–CHO: простейший альдегидоспирт, у C2 — асимметрический атом. Учебник, с. 158: «альдегид D-глицерина» и «альдегид L-глицерина» — верно D- и L-глицериновый альдегид; это зеркальные изомеры. Модель показывает связи; D и L в ней не различаются — это расположение OH у C2 (в проекции Фишера справа у D, слева у L).', 'Глицериновый альдегид собран.'],
    ['Glyceraldehyde (D- and L-)', 'CH₂OH–CH(OH)–CHO: the simplest aldehyde-alcohol; C2 is an asymmetric carbon. Textbook p. 158 writes “aldehyde of D-glycerol”; correct — D- and L-glyceraldehyde, mirror-image isomers. The model shows the bonds; D and L differ only in where the OH on C2 points (right in the Fischer projection for D, left for L).', 'Glyceraldehyde built.'],
    ['Glitserin aldegidi (D- va L-)', 'CH₂OH–CH(OH)–CHO: eng oddiy aldegidospirt, C2 — asimmetrik atom. Darslik, 158-bet: «D-glitserin aldegidi» — toʻgʻrisi D- va L-glitserin aldegidi; bular koʻzgu izomerlar. Model bogʻlarni koʻrsatadi; D va L farqi — C2 dagi OH holati (Fisher proyeksiyasida D da oʻngda, L da chapda).', 'Glitserin aldegidi yigʻildi.'],
    'CH₂OH–CH(OH)–CHO — 2,3-дигидроксипропаналь', { ir: [OH, CH, CO_ALD] }),
  m('dihydroxyacetone', 'carb', 'C₃H₆O₃', 'OCC(=O)CO',
    ['Дигидроксиацетон', 'CH₂OH–CO–CH₂OH: простейший кетоноспирт, изомер глицеринового альдегида. В учебнике (с. 158) — «диоксиацетон», верно — дигидроксиацетон (1,3-дигидроксипропан-2-он).', 'Дигидроксиацетон собран.'],
    ['Dihydroxyacetone', 'CH₂OH–CO–CH₂OH: the simplest ketone-alcohol, an isomer of glyceraldehyde. The textbook (p. 158) says “dioxyacetone”; correct — dihydroxyacetone (1,3-dihydroxypropan-2-one).', 'Dihydroxyacetone built.'],
    ['Digidroksiatseton', 'CH₂OH–CO–CH₂OH: eng oddiy ketonospirt, glitserin aldegidining izomeri. Darslikda (158-bet) «dioksiatseton» — toʻgʻrisi digidroksiatseton.', 'Digidroksiatseton yigʻildi.'],
    'CH₂OH–CO–CH₂OH — 1,3-дигидроксипропан-2-он', { ir: [OH, CH, CO_KET] }),
  m('alpha-glucopyranose', 'carb', 'C₆H₁₂O₆', 'OCC1OC(O)C(O)C(O)C1O',
    ['α-Глюкоза (пиранозная форма)', 'Шестичленный цикл из пяти атомов C и одного O: OH у C5 присоединилась к группе C=O, у C1 появилась новая OH. Учебник, с. 158: в α-форме OH при C1 расположена по другую сторону кольца, чем группа CH₂OH (внизу на рисунке Хеуорса), в β-форме — с той же стороны. Модель показывает кольцо и связи; α и β в ней не различаются.', 'Пиранозное кольцо глюкозы собрано.'],
    ['α-Glucose (pyranose form)', 'A six-membered ring of five carbons and one O: the OH on C5 has added to the C=O group and C1 has a new OH. Textbook p. 158: in the α form the C1 OH is on the opposite side of the ring from CH₂OH (down in the Haworth drawing), in the β form on the same side. The model shows the ring and the bonds; α and β are not distinguished in it.', 'The glucose pyranose ring is built.'],
    ['α-Glyukoza (piranoza shakli)', 'Besh C va bitta O dan iborat olti aʼzoli halqa: C5 dagi OH C=O guruhiga birikkan, C1 da yangi OH paydo boʻlgan. Darslik, 158-bet: α-shaklda C1 dagi OH halqaning CH₂OH ga qarama-qarshi tomonida, β-shaklda — bir tomonida. Model halqa va bogʻlarni koʻrsatadi; α va β farqlanmaydi.', 'Glyukozaning piranoza halqasi yigʻildi.'],
    'C₆H₁₂O₆ (цикл) ⇄ C₆H₁₂O₆ (открытая форма)', { ir: [OH, CH, CO] }),
  m('fructose-open', 'carb', 'C₆H₁₂O₆', 'OCC(=O)C(O)C(O)C(O)CO',
    ['Фруктоза (открытая форма)', 'CH₂OH–CO–(CHOH)₃–CH₂OH: гексоза с кетогруппой у C2 — кетоноспирт, изомер глюкозы. Учебник, с. 156 и 159: в растворе открытая форма в равновесии с фуранозными циклами.', 'Фруктоза собрана — кетогексоза.'],
    ['Fructose (open chain)', 'CH₂OH–CO–(CHOH)₃–CH₂OH: a hexose with the keto group on C2 — a ketone-alcohol, an isomer of glucose. Textbook pp. 156 and 159: in solution the open form is in equilibrium with the furanose rings.', 'Fructose built — a ketohexose.'],
    ['Fruktoza (ochiq shakl)', 'CH₂OH–CO–(CHOH)₃–CH₂OH: C2 da keto guruhli geksoza — ketonospirt, glyukoza izomeri. Darslik, 156 va 159-betlar: eritmada ochiq shakl furanoza halqalari bilan muvozanatda.', 'Fruktoza yigʻildi — ketogeksoza.'],
    'C₆H₁₂O₆ (фруктоза) — изомер глюкозы', { ir: [OH, CH, CO_KET] }),
  m('fructofuranose', 'carb', 'C₆H₁₂O₆', 'OCC1(O)OC(CO)C(O)C1O',
    ['Фруктоза (фуранозная форма)', 'Пятичленный цикл из четырёх атомов C и одного O: OH у C5 присоединилась к кетогруппе C2. Учебник, с. 159: открытая форма фруктозы находится в равновесии с циклическими α- и β-фуранозными формами (в модели α и β не различаются).', 'Фуранозное кольцо фруктозы собрано.'],
    ['Fructose (furanose form)', 'A five-membered ring of four carbons and one O: the OH on C5 has added to the C2 keto group. Textbook p. 159: open-chain fructose is in equilibrium with the cyclic α- and β-furanose forms (the model does not distinguish α and β).', 'The fructose furanose ring is built.'],
    ['Fruktoza (furanoza shakli)', 'Toʻrt C va bitta O dan iborat besh aʼzoli halqa: C5 dagi OH C2 keto guruhiga birikkan. Darslik, 159-bet: fruktozaning ochiq shakli α- va β-furanoza shakllari bilan muvozanatda (modelda α va β farqlanmaydi).', 'Fruktozaning furanoza halqasi yigʻildi.'],
    'C₆H₁₂O₆ (фруктоза, цикл) ⇄ C₆H₁₂O₆ (открытая форма)', { ir: [OH, CH, CO] }),
  m('methyl-glucoside', 'carb', 'C₇H₁₄O₆', 'COC1OC(CO)C(O)C(O)C1O',
    ['Метилглюкозид', 'C₆H₁₁O₅–OCH₃: водород OH при C1 циклической глюкозы замещён на CH₃ (гликозидная связь). Учебник, с. 158: глюкоза + метанол в присутствии сухого HCl.', 'Метилглюкозид собран.'],
    ['Methyl glucoside', 'C₆H₁₁O₅–OCH₃: the H of the C1 OH in cyclic glucose is replaced by CH₃ (a glycosidic bond). Textbook p. 158: glucose + methanol with dry HCl.', 'Methyl glucoside built.'],
    ['Metilglyukozid', 'C₆H₁₁O₅–OCH₃: halqali glyukozaning C1 dagi OH vodorodi CH₃ ga almashgan (glikozid bogʻ). Darslik, 158-bet: glyukoza + metanol quruq HCl ishtirokida.', 'Metilglyukozid yigʻildi.'],
    'C₆H₁₂O₆ + CH₃OH → C₆H₁₁O₅–OCH₃ + H₂O', { ir: [OH, CH, CO_ETH] }),
  m('glucose-pentaacetate', 'carb', 'C₁₆H₂₂O₁₁', 'CC(=O)OCC1OC(OC(C)=O)C(OC(C)=O)C(OC(C)=O)C1OC(C)=O',
    ['Пентаацетат глюкозы', 'C₆H₇O₆(CH₃CO)₅: все пять групп OH глюкозы этерифицированы уксусной кислотой — значит, в глюкозе пять гидроксилов. Учебник, с. 158 (в уравнении учебника нет 5H₂O).', 'Пентаацетат глюкозы собран.'],
    ['Glucose pentaacetate', 'C₆H₇O₆(CH₃CO)₅: all five OH groups of glucose are esterified by acetic acid — proof that glucose has five hydroxyls. Textbook p. 158 (the textbook equation omits 5H₂O).', 'Glucose pentaacetate built.'],
    ['Glyukoza pentaatsetati', 'C₆H₇O₆(CH₃CO)₅: glyukozaning beshala OH guruhi sirka kislota bilan eterlangan — demak, glyukozada beshta gidroksil bor. Darslik, 158-bet (tenglamada 5H₂O yoʻq).', 'Glyukoza pentaatsetati yigʻildi.'],
    'C₆H₁₂O₆ + 5CH₃COOH → C₆H₇O₆(CH₃CO)₅ + 5H₂O', { ir: [CH, CO_EST, CO_ETH] }),
  m('gluconic-acid', 'acid', 'C₆H₁₂O₇', 'OCC(O)C(O)C(O)C(O)C(=O)O',
    ['Глюконовая кислота', 'CH₂OH–(CHOH)₄–COOH: альдегидная группа глюкозы окислена в карбоксильную. Учебник, с. 158: продукт реакции глюкозы с Cu(OH)₂ при нагревании (и «серебряного зеркала» — в виде глюконата аммония).', 'Глюконовая кислота собрана.'],
    ['Gluconic acid', 'CH₂OH–(CHOH)₄–COOH: the aldehyde group of glucose is oxidised to a carboxyl. Textbook p. 158: the product of glucose with hot Cu(OH)₂ (and of the “silver mirror”, as ammonium gluconate).', 'Gluconic acid built.'],
    ['Glyukon kislota', 'CH₂OH–(CHOH)₄–COOH: glyukozaning aldegid guruhi karboksilgacha oksidlangan. Darslik, 158-bet: glyukozaning qizdirilgan Cu(OH)₂ bilan reaksiyasi mahsuloti.', 'Glyukon kislota yigʻildi.'],
    'CH₂OH(CHOH)₄CHO + 2Cu(OH)₂ → CH₂OH(CHOH)₄COOH + Cu₂O↓ + 2H₂O', { ir: ACID }),

  // ——— § 3.19–3.21 Дисахариды и полисахариды (с. 160–167) ———
  m('sucrose-structure', 'carb', 'C₁₂H₂₂O₁₁', 'OCC1OC(OC2(CO)OC(CO)C(O)C2O)C(O)C(O)C1O',
    ['Сахароза (строение)', 'Остаток глюкозы (пиранозное кольцо) и остаток фруктозы (фуранозное кольцо) связаны через атом O между C1 глюкозы и C2 фруктозы. Учебник, с. 161 (верхний рисунок): при гидролизе — глюкоза и фруктоза («инвертный сахар»). В модели α/β не различаются.', 'Сахароза собрана — дисахарид.'],
    ['Sucrose (structure)', 'A glucose residue (pyranose ring) and a fructose residue (furanose ring) joined through an O between C1 of glucose and C2 of fructose. Textbook p. 161 (top drawing): hydrolysis gives glucose and fructose (“invert sugar”). The model does not distinguish α/β.', 'Sucrose built — a disaccharide.'],
    ['Saxaroza (tuzilishi)', 'Glyukoza qoldigʻi (piranoza halqa) va fruktoza qoldigʻi (furanoza halqa) glyukozaning C1 va fruktozaning C2 atomlari orasidagi O orqali bogʻlangan. Darslik, 161-bet: gidrolizda glyukoza va fruktoza («invert shakar»).', 'Saxaroza yigʻildi — disaxarid.'],
    'C₁₂H₂₂O₁₁ + H₂O → C₆H₁₂O₆ + C₆H₁₂O₆', { ir: [OH, CH, CO_ETH] }),
  m('maltose', 'carb', 'C₁₂H₂₂O₁₁', 'OCC1OC(OC2C(CO)OC(O)C(O)C2O)C(O)C(O)C1O',
    ['Мальтоза', 'Два остатка α-глюкозы, связь 1→4: атом O соединяет C1 одного кольца с C4 другого. Учебник, с. 160–161: продукт ступенчатого гидролиза крахмала. Лактоза имеет те же связи — отличается только расположением OH (см. подсказку лактозы).', 'Мальтоза собрана.'],
    ['Maltose', 'Two α-glucose residues with a 1→4 link: an O joins C1 of one ring to C4 of the other. Textbook pp. 160–161: a product of stepwise starch hydrolysis. Lactose has the same bonds and differs only in the positions of OH groups (see lactose).', 'Maltose built.'],
    ['Maltoza', 'Ikki α-glyukoza qoldigʻi, 1→4 bogʻ: O bir halqaning C1 ini ikkinchisining C4 i bilan bogʻlaydi. Darslik, 160–161-betlar: kraxmal bosqichli gidrolizi mahsuloti. Laktozada bogʻlar xuddi shunday — faqat OH holati farq qiladi.', 'Maltoza yigʻildi.'],
    'C₁₂H₂₂O₁₁ + H₂O → 2C₆H₁₂O₆', { ir: [OH, CH, CO_ETH] }),
  m('lactose', 'carb', 'C₁₂H₂₂O₁₁', 'OCC1OC(OC2C(CO)OC(O)C(O)C2O)C(O)C(O)C1O',
    ['Лактоза (молочный сахар)', 'Остаток β-галактозы и остаток глюкозы, связь 1→4. Учебник, с. 161. Граф связей тот же, что у мальтозы: галактоза отличается от глюкозы только положением OH у C4, а β-связь — положением O у C1; модель эти пространственные различия не показывает.', 'Лактоза собрана.'],
    ['Lactose (milk sugar)', 'A β-galactose residue and a glucose residue, 1→4 link. Textbook p. 161. The bond graph is the same as maltose: galactose differs from glucose only in the position of the C4 OH, and the β link in the position of the O on C1; the model does not show these spatial differences.', 'Lactose built.'],
    ['Laktoza (sut shakari)', 'β-Galaktoza va glyukoza qoldiqlari, 1→4 bogʻ. Darslik, 161-bet. Bogʻlar grafi maltozaniki bilan bir xil: galaktoza glyukozadan faqat C4 dagi OH holati bilan farq qiladi; model bu fazoviy farqlarni koʻrsatmaydi.', 'Laktoza yigʻildi.'],
    'C₁₂H₂₂O₁₁ + H₂O → C₆H₁₂O₆ + C₆H₁₂O₆', { ir: [OH, CH, CO_ETH] }),
  m('amylose-fragment', 'carb', 'C₁₈H₃₂O₁₆', 'OCC1OC(OC2C(CO)OC(OC3C(CO)OC(O)C(O)C3O)C(O)C2O)C(O)C(O)C1O',
    ['Амилоза — фрагмент из трёх звеньев', 'Линейная цепь остатков α-глюкозы, связи 1→4. Учебник, с. 164–165: крахмал — 20–30 % амилозы и 70–80 % амилопектина; при гидролизе даёт α-глюкозу. Показаны три звена — настоящая цепь из сотен звеньев (C₆H₁₀O₅)ₙ.', 'Фрагмент амилозы собран.'],
    ['Amylose — a three-unit fragment', 'A linear chain of α-glucose residues with 1→4 links. Textbook pp. 164–165: starch is 20–30 % amylose and 70–80 % amylopectin; hydrolysis gives α-glucose. Three units are shown — the real chain has hundreds, (C₆H₁₀O₅)ₙ.', 'Amylose fragment built.'],
    ['Amiloza — uch boʻgʻinli fragment', 'α-Glyukoza qoldiqlarining 1→4 bogʻli chiziqli zanjiri. Darslik, 164–165-betlar: kraxmal — 20–30 % amiloza va 70–80 % amilopektin. Uch boʻgʻin koʻrsatilgan — haqiqiy zanjirda yuzlab boʻgʻin, (C₆H₁₀O₅)ₙ.', 'Amiloza fragmenti yigʻildi.'],
    '(C₆H₁₀O₅)ₙ + nH₂O → nC₆H₁₂O₆', { ir: [OH, CH, CO_ETH] }),
  m('amylopectin-fragment', 'carb', 'C₁₈H₃₂O₁₆', 'OC1OC(COC2OC(CO)C(O)C(O)C2O)C(OC3OC(CO)C(O)C(O)C3O)C(O)C1O',
    ['Амилопектин — фрагмент с ветвлением', 'Остаток глюкозы, к которому присоединены два других: через O4 (связь 1→4, как в амилозе) и через O6 (связь 1→6 — точка ветвления). Учебник, с. 164–165: амилопектин разветвлён. Показаны три звена.', 'Фрагмент амилопектина собран.'],
    ['Amylopectin — a branched fragment', 'A glucose residue carrying two others: via O4 (a 1→4 link, as in amylose) and via O6 (a 1→6 link — the branch point). Textbook pp. 164–165: amylopectin is branched. Three units are shown.', 'Amylopectin fragment built.'],
    ['Amilopektin — tarmoqlangan fragment', 'Glyukoza qoldigʻiga yana ikkitasi birikkan: O4 orqali (1→4 bogʻ, amilozadagidek) va O6 orqali (1→6 bogʻ — tarmoqlanish nuqtasi). Darslik, 164–165-betlar. Uch boʻgʻin koʻrsatilgan.', 'Amilopektin fragmenti yigʻildi.'],
    '(C₆H₁₀O₅)ₙ + nH₂O → nC₆H₁₂O₆', { ir: [OH, CH, CO_ETH] }),
  m('cellulose-fragment', 'carb', 'C₁₈H₃₂O₁₆', 'OCC1OC(OC2C(CO)OC(OC3C(CO)OC(O)C(O)C3O)C(O)C2O)C(O)C(O)C1O',
    ['Целлюлоза — фрагмент из трёх звеньев', 'Линейная цепь остатков β-глюкозы, связи 1→4. Учебник, с. 165: при гидролизе целлюлозы получается β-глюкоза, при нитровании — тринитрат, при ацетилировании — триацетат целлюлозы. Граф связей тот же, что у фрагмента амилозы: разница α/β — пространственная, модель её не показывает.', 'Фрагмент целлюлозы собран.'],
    ['Cellulose — a three-unit fragment', 'A linear chain of β-glucose residues with 1→4 links. Textbook p. 165: hydrolysis gives β-glucose, nitration gives cellulose trinitrate, acetylation cellulose triacetate. The bond graph is the same as the amylose fragment: the α/β difference is spatial and the model does not show it.', 'Cellulose fragment built.'],
    ['Sellyuloza — uch boʻgʻinli fragment', 'β-Glyukoza qoldiqlarining 1→4 bogʻli chiziqli zanjiri. Darslik, 165-bet: gidrolizda β-glyukoza, nitrolashda trinitrat, atsetillashda triatsetat hosil boʻladi. Bogʻlar grafi amiloza fragmentiniki bilan bir xil: α/β farqi fazoviy.', 'Sellyuloza fragmenti yigʻildi.'],
    '(C₆H₇O₂(OH)₃)ₙ + 3nHNO₃ → (C₆H₇O₂(ONO₂)₃)ₙ + 3nH₂O', { ir: [OH, CH, CO_ETH] }),
]
