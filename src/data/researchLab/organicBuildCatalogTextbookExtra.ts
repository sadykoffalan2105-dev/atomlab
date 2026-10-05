/**
 * Органические вещества из реакций учебника Kimyo 10 (src/data/textbook/equations-g10.json), которых не было
 * в органическом реестре: парафин C₂₃H₄₈, бромметан, нитросоединения и эфиры азотной/серной кислот,
 * бензолсульфокислота, иодоформ, 1-иодбутан, пентанамид. Подключается одной строкой-спредом в organicBuildCatalog.ts.
 *
 * Скелет — упрощённый SMILES (C O N S Cl Br I, связи = и #, ветви (), циклы 1–9, бензол в форме Кекуле).
 * Атомы с особой валентностью: [N+] — азот нитрогруппы и нитратов (4 связи), [O-] — одинарно связанный O нитрогруппы
 * (1 связь); S с шестью связями (сульфогруппа, эфир серной кислоты) получает валентность VI автоматически.
 * Водород добавляется по валентности; брутто-формула набора сверяется с формулой учебника
 * (scripts/test-catalog-textbook-substances.mts).
 */
import type { OrganicElement, SkeletonSpec } from '../../chemistry/organic/organicGraph'
import type { IrPeak, OrganicBuildChallenge, OrganicClassId, OrganicKit } from './organicBuildCatalog'

const CH: IrPeak = { wavenumber: 2920, intensity: 0.7, label: 'C–H' }
const AROM: IrPeak = { wavenumber: 1500, intensity: 0.5, label: 'Ar' }
const NO2: IrPeak = { wavenumber: 1530, intensity: 0.9, label: 'NO₂' }
const ONO2: IrPeak = { wavenumber: 1640, intensity: 0.9, label: 'O–NO₂' }
const SO3: IrPeak = { wavenumber: 1180, intensity: 0.85, label: 'S=O' }
const OH: IrPeak = { wavenumber: 3350, intensity: 0.8, label: 'O–H' }
const CBR: IrPeak = { wavenumber: 600, intensity: 0.6, label: 'C–Br' }
const CI: IrPeak = { wavenumber: 500, intensity: 0.6, label: 'C–I' }
const AMIDE: IrPeak = { wavenumber: 1660, intensity: 0.9, label: 'C=O (амид)' }
const NH: IrPeak = { wavenumber: 3350, intensity: 0.6, label: 'N–H' }

const ATOMS = ['Cl', 'Br', 'C', 'O', 'N', 'S', 'I'] as const satisfies readonly OrganicElement[]
const VALENCE: Record<(typeof ATOMS)[number], number> = { C: 4, O: 2, N: 3, S: 2, Cl: 1, Br: 1, I: 1 }
/** Заряженные атомы в квадратных скобках: валентность по формальному заряду. */
const BRACKET: Record<string, { el: OrganicElement; valence: number }> = {
  '[N+]': { el: 'N', valence: 4 },
  '[O-]': { el: 'O', valence: 1 },
  // для 3D-моделей солей (scripts/textbook-inventory/salt-geometry.mts): оксоний и карбанион
  '[O+]': { el: 'O', valence: 3 },
  '[C-]': { el: 'C', valence: 3 },
}

/** Упрощённый SMILES → скелет тяжёлых атомов (+ особая валентность N⁺, O⁻, S(VI)). */
export function smilesSkeleton(src: string): SkeletonSpec {
  const elements: OrganicElement[] = []
  const edges: ([number, number] | [number, number, 1 | 2 | 3])[] = []
  const special = new Map<number, number>()
  const stack: number[] = []
  const rings = new Map<string, { at: number; order: 1 | 2 | 3 }>()
  let prev = -1
  let order: 1 | 2 | 3 = 1
  let i = 0
  const link = (a: number, b: number, o: 1 | 2 | 3) => edges.push(o === 1 ? [a, b] : [a, b, o])
  const addAtom = (el: OrganicElement) => {
    elements.push(el)
    const idx = elements.length - 1
    if (prev >= 0) link(prev, idx, order)
    prev = idx
    order = 1
    return idx
  }
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
    } else if (c === '[') {
      const tok = Object.keys(BRACKET).find((b) => src.startsWith(b, i))
      if (!tok) throw new Error(`smilesSkeleton: неизвестный атом в скобках в ${src}`)
      special.set(addAtom(BRACKET[tok]!.el), BRACKET[tok]!.valence)
      i += tok.length
    } else {
      const el = ATOMS.find((a) => src.startsWith(a, i))
      if (!el) throw new Error(`smilesSkeleton: неизвестный символ «${c}» в ${src}`)
      addAtom(el)
      i += el.length
    }
  }
  if (rings.size || stack.length) throw new Error(`smilesSkeleton: незакрытый цикл или ветвь в ${src}`)
  // S с числом связей больше двух — сера(VI) сульфогруппы / эфира серной кислоты
  const used = elements.map(() => 0)
  for (const e of edges) {
    used[e[0]]! += e[2] ?? 1
    used[e[1]]! += e[2] ?? 1
  }
  elements.forEach((el, k) => {
    if (!special.has(k) && used[k]! > VALENCE[el as keyof typeof VALENCE]) {
      if (el !== 'S') throw new Error(`smilesSkeleton: у ${el} (${k}) связей ${used[k]} — больше валентности в ${src}`)
      special.set(k, used[k]!)
    }
  })
  const valence = [...special.entries()].map(([k, v]) => [k, v] as const)
  return valence.length ? { elements, edges, valence } : { elements, edges }
}

/** Набор атомов по скелету: тяжёлые атомы + H по валентности (с особой валентностью). */
export function kitOf(s: SkeletonSpec): OrganicKit {
  const used = s.elements.map(() => 0)
  for (const e of s.edges) {
    used[e[0]]! += e[2] ?? 1
    used[e[1]]! += e[2] ?? 1
  }
  const special = new Map(s.valence ?? [])
  const kit: Record<string, number> = {}
  let h = 0
  s.elements.forEach((el, i) => {
    kit[el] = (kit[el] ?? 0) + 1
    h += Math.max(0, (special.get(i) ?? VALENCE[el as keyof typeof VALENCE] ?? 0) - used[i]!)
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
  opts: { ir?: readonly IrPeak[]; viewOnly?: boolean } = {},
): OrganicBuildChallenge {
  const skeleton = smilesSkeleton(smiles)
  const kit = kitOf(skeleton)
  return {
    id,
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
    viewOnly: opts.viewOnly,
    equationRu,
    equationEn: equationRu,
    equationUz: equationRu,
  }
}

const PH = 'C1=CC=CC=C1'
const NITRO = '[N+](=O)[O-]'

export const G10_TEXTBOOK_EXTRA_CHALLENGES: readonly OrganicBuildChallenge[] = [
  m('n-tricosane', 'alkane', 'C₂₃H₄₈', 'C'.repeat(23),
    ['Трикозан (парафин)', 'Неразветвлённый алкан из 23 атомов C — пример парафина. Учебник, с. 37: при нагревании с CuO углерод парафина окисляется до CO₂, водород — до H₂O (доказательство C и H в органике).', 'Трикозан собран — парафин.'],
    ['Tricosane (paraffin)', 'Unbranched alkane with 23 carbon atoms — a paraffin. Textbook p. 37: heated with CuO, the carbon of paraffin is oxidised to CO₂ and the hydrogen to H₂O (proof of C and H in organic matter).', 'Tricosane built — a paraffin.'],
    ['Trikozan (parafin)', '23 ta C atomli tarmoqlanmagan alkan — parafin. Darslik, 37-bet: CuO bilan qizdirilganda parafin uglerodi CO₂ gacha, vodorodi H₂O gacha oksidlanadi (organik moddada C va H ni isbotlash).', 'Trikozan yigʻildi — parafin.'],
    'C₂₃H₄₈ + 70CuO → 23CO₂ + 24H₂O + 70Cu', { viewOnly: true }),
  m('bromomethane', 'halo', 'CH₃Br', 'CBr',
    ['Бромметан', 'CH₃Br — галогеналкан. Учебник, с. 46: смесь бромэтана и бромметана с натрием (реакция Вюрца) даёт пропан, а также этан и бутан.', 'Бромметан собран.'],
    ['Bromomethane', 'CH₃Br — a haloalkane. Textbook p. 46: a mixture of bromoethane and bromomethane with sodium (Wurtz reaction) gives propane, together with ethane and butane.', 'Bromomethane built.'],
    ['Brommetan', 'CH₃Br — galogenalkan. Darslik, 46-bet: brometan va brommetan aralashmasi natriy bilan (Vyurs reaksiyasi) propan, shuningdek etan va butan hosil qiladi.', 'Brommetan yigʻildi.'],
    'CH₃CH₂–Br + Br–CH₃ + 2Na → CH₃CH₂CH₃ + 2NaBr', { ir: [CH, CBR] }),
  m('nitrobenzene', 'nitrogen', 'C₆H₅NO₂', `${PH}${NITRO}`,
    ['Нитробензол', 'C₆H₅–NO₂: нитрогруппа у бензольного кольца (N⁺ связан с одним O двойной связью, со вторым O⁻ — одинарной). Учебник, с. 79: нитрование бензола смесью HNO₃ и H₂SO₄.', 'Нитробензол собран.'],
    ['Nitrobenzene', 'C₆H₅–NO₂: a nitro group on the benzene ring (N⁺ has a double bond to one O and a single bond to O⁻). Textbook p. 79: nitration of benzene with a HNO₃/H₂SO₄ mixture.', 'Nitrobenzene built.'],
    ['Nitrobenzol', 'C₆H₅–NO₂: benzol halqasidagi nitroguruh (N⁺ bitta O bilan qoʻsh, ikkinchi O⁻ bilan oddiy bogʻ). Darslik, 79-bet: benzolni HNO₃ va H₂SO₄ aralashmasi bilan nitrolash.', 'Nitrobenzol yigʻildi.'],
    'C₆H₆ + HNO₃ → C₆H₅NO₂ + H₂O', { ir: [AROM, NO2], viewOnly: true }),
  m('2-4-6-trinitrotoluene', 'nitrogen', 'C₇H₅N₃O₆', `CC1=C(${NITRO})C=C(${NITRO})C=C1${NITRO}`,
    ['2,4,6-Тринитротолуол (тротил)', 'CH₃–C₆H₂(NO₂)₃: три нитрогруппы в положениях 2, 4, 6 кольца толуола (метильная группа направляет замещение в орто- и пара-положения). Учебник, с. 80.', '2,4,6-Тринитротолуол собран.'],
    ['2,4,6-Trinitrotoluene (TNT)', 'CH₃–C₆H₂(NO₂)₃: three nitro groups at ring positions 2, 4, 6 of toluene (the methyl group directs substitution to the ortho and para positions). Textbook p. 80.', '2,4,6-Trinitrotoluene built.'],
    ['2,4,6-Trinitrotoluol (trotil)', 'CH₃–C₆H₂(NO₂)₃: toluol halqasining 2, 4, 6-holatlarida uchta nitroguruh (metil guruh oʻrinbosarni orto- va para-holatlarga yoʻnaltiradi). Darslik, 80-bet.', '2,4,6-Trinitrotoluol yigʻildi.'],
    'C₆H₅–CH₃ + 3HNO₃ → CH₃–C₆H₂(NO₂)₃ + 3H₂O', { ir: [AROM, NO2, CH], viewOnly: true }),
  m('ethyl-nitrate', 'ester', 'C₂H₅ONO₂', `CCO${NITRO}`,
    ['Этилнитрат', 'C₂H₅–O–NO₂ — сложный эфир азотной кислоты и этанола. Учебник, с. 110: спирты реагируют с кислотами, образуя сложные эфиры.', 'Этилнитрат собран.'],
    ['Ethyl nitrate', 'C₂H₅–O–NO₂ — the ester of nitric acid and ethanol. Textbook p. 110: alcohols react with acids to form esters.', 'Ethyl nitrate built.'],
    ['Etilnitrat', 'C₂H₅–O–NO₂ — nitrat kislota va etanolning murakkab efiri. Darslik, 110-bet: spirtlar kislotalar bilan murakkab efirlar hosil qiladi.', 'Etilnitrat yigʻildi.'],
    'C₂H₅OH + HNO₃ → C₂H₅ONO₂ + H₂O', { ir: [CH, ONO2], viewOnly: true }),
  m('ethyl-hydrogen-sulfate', 'ester', 'C₂H₅OSO₃H', 'CCOS(=O)(=O)O',
    ['Этилсерная кислота', 'C₂H₅–O–SO₂–OH — кислый эфир серной кислоты (сера(VI)). Учебник, с. 110 и 131: образуется из этанола и H₂SO₄; с избытком спирта даёт диэтиловый эфир.', 'Этилсерная кислота собрана.'],
    ['Ethyl hydrogen sulfate', 'C₂H₅–O–SO₂–OH — the acid ester of sulfuric acid (sulfur(VI)). Textbook pp. 110 and 131: formed from ethanol and H₂SO₄; with more alcohol it gives diethyl ether.', 'Ethyl hydrogen sulfate built.'],
    ['Etilsulfat kislota', 'C₂H₅–O–SO₂–OH — sulfat kislotaning nordon efiri (oltingugurt(VI)). Darslik, 110 va 131-betlar: etanol va H₂SO₄ dan hosil boʻladi; spirt ortigʻi bilan dietil efir beradi.', 'Etilsulfat kislota yigʻildi.'],
    'C₂H₅OH + H₂SO₄ → C₂H₅OSO₃H + H₂O', { ir: [OH, SO3, CH], viewOnly: true }),
  m('iodoform', 'halo', 'CHI₃', 'IC(I)I',
    ['Иодоформ', 'CHI₃ (трииодметан) — жёлтые кристаллы с характерным запахом. Учебник, с. 111: иодоформная проба на этанол (I₂ и NaOH).', 'Иодоформ собран.'],
    ['Iodoform', 'CHI₃ (triiodomethane) — yellow crystals with a typical smell. Textbook p. 111: the iodoform test for ethanol (I₂ and NaOH).', 'Iodoform built.'],
    ['Yodoform', 'CHI₃ (triyodmetan) — oʻziga xos hidli sariq kristallar. Darslik, 111-bet: etanolga yodoform sinovi (I₂ va NaOH).', 'Yodoform yigʻildi.'],
    'C₂H₅OH + 6NaOH + 4I₂ → CHI₃ + HCOONa + 5NaI + 5H₂O', { ir: [CH, CI], viewOnly: true }),
  m('nitroglycerin', 'ester', 'C₃H₅(ONO₂)₃', `C(O${NITRO})C(O${NITRO})CO${NITRO}`,
    ['Тринитроглицерин (нитроглицерин)', 'C₃H₅(ONO₂)₃ — сложный эфир глицерина и азотной кислоты (три группы O–NO₂). Учебник, с. 120–121: этерификация глицерина азотной кислотой.', 'Нитроглицерин собран.'],
    ['Glyceryl trinitrate (nitroglycerin)', 'C₃H₅(ONO₂)₃ — the ester of glycerol and nitric acid (three O–NO₂ groups). Textbook pp. 120–121: esterification of glycerol with nitric acid.', 'Nitroglycerin built.'],
    ['Trinitroglitserin (nitroglitserin)', 'C₃H₅(ONO₂)₃ — glitserin va nitrat kislotaning murakkab efiri (uchta O–NO₂ guruh). Darslik, 120–121-betlar: glitserinni nitrat kislota bilan eterifikatsiyalash.', 'Nitroglitserin yigʻildi.'],
    'C₃H₅(OH)₃ + 3HNO₃ → C₃H₅(ONO₂)₃ + 3H₂O', { ir: [CH, ONO2], viewOnly: true }),
  m('benzenesulfonic-acid', 'acid', 'C₆H₅SO₃H', `OS(=O)(=O)${PH}`,
    ['Бензолсульфокислота', 'C₆H₅–SO₃H: сульфогруппа (сера(VI)) у бензольного кольца — сильная кислота. Учебник, с. 127: с NaOH даёт бензолсульфонат натрия (путь к фенолу).', 'Бензолсульфокислота собрана.'],
    ['Benzenesulfonic acid', 'C₆H₅–SO₃H: a sulfo group (sulfur(VI)) on the benzene ring — a strong acid. Textbook p. 127: with NaOH it gives sodium benzenesulfonate (a route to phenol).', 'Benzenesulfonic acid built.'],
    ['Benzolsulfokislota', 'C₆H₅–SO₃H: benzol halqasidagi sulfoguruh (oltingugurt(VI)) — kuchli kislota. Darslik, 127-bet: NaOH bilan natriy benzolsulfonat beradi (fenol olish yoʻli).', 'Benzolsulfokislota yigʻildi.'],
    'C₆H₅SO₃H + NaOH → C₆H₅SO₃Na + H₂O', { ir: [AROM, SO3, OH], viewOnly: true }),
  m('1-iodobutane', 'halo', 'C₄H₉I', 'CCCCI',
    ['1-Иодбутан', 'CH₃(CH₂)₃I — галогеналкан. Учебник, с. 132: простые эфиры расщепляются иодоводородом; из 2-бутоксипропана получаются пропанол-2 и 1-иодбутан.', '1-Иодбутан собран.'],
    ['1-Iodobutane', 'CH₃(CH₂)₃I — a haloalkane. Textbook p. 132: ethers are cleaved by hydrogen iodide; 2-butoxypropane gives propan-2-ol and 1-iodobutane.', '1-Iodobutane built.'],
    ['1-Yodbutan', 'CH₃(CH₂)₃I — galogenalkan. Darslik, 132-bet: oddiy efirlar yodovodorod bilan parchalanadi; 2-butoksipropandan propanol-2 va 1-yodbutan hosil boʻladi.', '1-Yodbutan yigʻildi.'],
    'CH₃CH(CH₃)O(CH₂)₃CH₃ + HI → CH₃CH(OH)CH₃ + CH₃(CH₂)₃I', { ir: [CH, CI], viewOnly: true }),
  m('pentanamide', 'nitrogen', 'C₅H₁₁NO', 'CCCCC(=O)N',
    ['Пентанамид (амид валериановой кислоты)', 'CH₃CH₂CH₂CH₂–CO–NH₂: группа OH карбоксила заменена на NH₂. Учебник, с. 179: валериановая кислота с аммиаком даёт амид.', 'Пентанамид собран.'],
    ['Pentanamide (valeric acid amide)', 'CH₃CH₂CH₂CH₂–CO–NH₂: the OH of the carboxyl group is replaced by NH₂. Textbook p. 179: valeric acid with ammonia gives the amide.', 'Pentanamide built.'],
    ['Pentanamid (valerian kislota amidi)', 'CH₃CH₂CH₂CH₂–CO–NH₂: karboksil guruhning OH i NH₂ ga almashgan. Darslik, 179-bet: valerian kislota ammiak bilan amid beradi.', 'Pentanamid yigʻildi.'],
    'CH₃CH₂CH₂CH₂COOH + NH₃ → CH₃CH₂CH₂CH₂CONH₂ + H₂O', { ir: [CH, AMIDE, NH] }),
]
