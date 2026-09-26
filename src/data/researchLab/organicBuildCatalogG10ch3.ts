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
]
