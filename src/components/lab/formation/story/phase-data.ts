import type { FinalPhase, PhaseInfo, Tri } from './phase'

/**
 * Итог «Как образуется» «как в жизни» при 25 °C для 200 веществ каталога: агрегатное состояние, класс, фаза для сцены
 * и справочная решётка (структурный тип, параметры ячейки в пм, координация). Источник — таблица
 * docs/plans/formation-200-structures.md (CRC Handbook, 97th ed.; справочники структур). Параметры у
 * тетрагональных/ромбических псевдокубических ячеек — как в справочнике; что упрощено — в note (RU/EN/UZ).
 *
 * Коды решёток (code): RS — тип NaCl 6:6; CsCl — 8:8; ZB — сфалерит 4:4; WZ — вюрцит 4:4; AF — антифлюорит 4:8;
 * CUP — куприт 2:4; COR — корунд 6:4; CAL — кальцит; BAR — барит; CdI2 — слоистая 6:3; L3 — слоистая MX₃ 6:2;
 * PbCl2 — котуннит (КЧ 9); RUT — рутил 6:3; SPI — шпинель; NiAs — троилит; U — низкосимметричная (схема формульных
 * единиц); MOL — молекулярный кристалл; CHAIN — полимер; NET — атомный каркас.
 * gen — ключ генератора фрагмента (story/lattice.ts: SYNTH или CRYSTAL_DATA); нет — схема/модель-кристалл.
 */
export type PhaseState = 'g' | 'l' | 's' | 'aq'
/** I — ионное, M — молекулы, MC — молекулярный кристалл, P — полимер, N — каркас, H — гидрат / двойная соль */
export type PhaseCls = 'I' | 'M' | 'MC' | 'P' | 'N' | 'H'
export type LatticeCode =
  | 'RS' | 'CsCl' | 'ZB' | 'WZ' | 'AF' | 'CUP' | 'COR' | 'CAL' | 'BAR' | 'CdI2' | 'L3' | 'PbCl2' | 'RUT' | 'SPI' | 'NiAs' | 'U'
  | 'MOL' | 'CHAIN' | 'NET'
export type PhaseRow = { state: PhaseState; cls: PhaseCls; phase: FinalPhase; info: PhaseInfo; code?: LatticeCode; gen?: string }

// ─── Честные подписи ───
const N_GAS: Tri = [
  'В модели молекулы газа ближе, чем на самом деле: реально они в ~10 раз дальше друг от друга',
  'The gas molecules are drawn closer than they are: in reality they are ~10 times farther apart',
  'Modelda gaz molekulalari haqiqatdagidan yaqinroq: aslida ular bir-biridan ~10 marta uzoqroq',
]
const N_LIQ: Tri = [
  'Жидкость: молекулы почти вплотную и всё время меняют соседей',
  'Liquid: the molecules almost touch and keep changing neighbours',
  'Suyuqlik: molekulalar deyarli zich joylashgan va qoʻshnilarini doim almashtiradi',
]
const N_SCHEMA: Tri = [
  'Схема формульных единиц: соотношение ионов верное, настоящая решётка сложнее (упрощено)',
  'A scheme of formula units: the ion ratio is right, the real lattice is more complex (simplified)',
  'Formula birliklari sxemasi: ionlar nisbati toʻgʻri, haqiqiy panjara murakkabroq (soddalashtirilgan)',
]
const N_WEAK: Tri = [
  'Слабая кислота: в растворе распадается лишь малая доля молекул',
  'A weak acid: only a small share of the molecules ionise in solution',
  'Kuchsiz kislota: eritmada molekulalarning ozgina qismi ionlanadi',
]
const tri = (ru: string, en: string, uz: string): Tri => [ru, en, uz]

// ─── Конструкторы строк ───
const gas = (note: Tri = N_GAS): PhaseRow => ({ state: 'g', cls: 'M', phase: 'gas', info: { copies: 8, spacing: 2.6, note } })
const liquid = (note: Tri = N_LIQ): PhaseRow => ({ state: 'l', cls: 'M', phase: 'liquid', info: { copies: 12, spacing: 1.08, note } })
/** раствор; acidH — индексы атомов H модели карточки (buildSchoolHeroModel), уходящих к воде как H⁺ */
const sol = (state: PhaseState, dissociation: 'strong' | 'weak' | 'none', acidH: number[], note?: Tri): PhaseRow => ({
  state,
  cls: 'M',
  phase: 'solution',
  info: { copies: 0, spacing: 1.08, waters: 6, dissociation, acidH, ...(note ? { note } : {}) },
})
const mc = (type: string, coord: string, p: { a?: number; b?: number; c?: number } = {}, note?: Tri): PhaseRow => ({
  state: 's',
  cls: 'MC',
  phase: 'molecular',
  code: 'MOL',
  info: { copies: 0, spacing: 0, lattice: { type, coord, ...p }, ...(note ? { note } : {}) },
})
const chain = (type: string, coord: string, p: { a?: number; b?: number; c?: number } = {}, note?: Tri): PhaseRow => ({
  state: 's',
  cls: 'P',
  phase: 'chain',
  code: 'CHAIN',
  info: { copies: 0, spacing: 0, lattice: { type, coord, ...p }, ...(note ? { note } : {}) },
})
const GEN: Partial<Record<LatticeCode, string>> = {
  RS: 'nacl', CsCl: 'cscl', ZB: 'sphalerite', WZ: 'wurtzite', AF: 'antifluorite', CUP: 'cuprite', COR: 'corundum',
  CdI2: 'cdi2', L3: 'mx3layer', RUT: 'rutile', NiAs: 'troilite', CAL: 'nacl',
}
const TYPE: Record<LatticeCode, string> = {
  RS: 'типа NaCl', CsCl: 'типа CsCl', ZB: 'сфалерит (ZnS)', WZ: 'вюрцит', AF: 'антифлюорит', CUP: 'куприт', COR: 'корунд',
  CAL: 'кальцит', BAR: 'барит', CdI2: 'слоистая, тип CdI₂', L3: 'слоистая MX₃', PbCl2: 'котуннит (PbCl₂)', RUT: 'рутил',
  SPI: 'шпинель', NiAs: 'NiAs (троилит)', U: 'ионная', MOL: 'молекулярная', CHAIN: 'полимер', NET: 'атомный каркас',
}
/** ионный кристалл: code — тип; p — параметры, пм; coord — координация; gen: false — без генератора (модель-кристалл / схема) */
const ion = (
  code: LatticeCode,
  coord: string,
  p: { a?: number; b?: number; c?: number; type?: string; gen?: string | false; state?: PhaseState; cls?: PhaseCls } = {},
  note?: Tri,
): PhaseRow => {
  const gen = p.gen === false ? undefined : (p.gen ?? GEN[code])
  const lat = { type: p.type ?? TYPE[code], coord, ...(p.a ? { a: p.a } : {}), ...(p.b ? { b: p.b } : {}), ...(p.c ? { c: p.c } : {}) }
  return {
    state: p.state ?? 's',
    cls: p.cls ?? 'I',
    phase: 'ionic',
    code,
    ...(gen ? { gen } : {}),
    info: { copies: 0, spacing: 0, lattice: lat, ...(note ? { note } : code === 'U' ? { note: N_SCHEMA } : {}) },
  }
}
const U = (coord: string, note: Tri = N_SCHEMA, p: { state?: PhaseState; cls?: PhaseCls; type?: string } = {}) => ion('U', coord, { ...p, gen: false }, note)
const H = (coord: string, note: Tri = N_SCHEMA, type = 'кристаллогидрат') => ion('U', coord, { cls: 'H', type, gen: false }, note)

const N_TETRA: Tri = tri(
  'Реальная решётка тетрагонально искажена вдоль оси гантелей; в модели — кубическая (тип NaCl)',
  'The real lattice is tetragonally stretched along the dumbbells; the model uses the cubic NaCl type',
  'Haqiqiy panjara gantellar oʻqi boʻylab tetragonal choʻzilgan; modelda — kubik (NaCl turi)',
)
const N_CDCL2: Tri = tri(
  'Тип CdCl₂: те же слои MX₂, но уложены по три в ячейке; в модели слои — как у CdI₂',
  'CdCl₂ type: the same MX₂ layers, stacked three per cell; the model stacks them as in CdI₂',
  'CdCl₂ turi: oʻsha MX₂ qatlamlari, yacheykada uchtadan joylashgan; modelda — CdI₂ dagidek',
)
const N_DIM: Tri = tri(
  'Параметры ячейки: c — расстояние между слоями (на один слой)',
  'Cell parameters: c is the spacing between layers (per layer)',
  'Yacheyka parametrlari: c — qatlamlar orasidagi masofa (bitta qatlamga)',
)
const N_SOLID_NO: Tri = tri(
  'В твёрдом виде не выделено — существует только в растворе; решётка показана условно',
  'Not isolated as a solid — exists only in solution; the lattice is shown schematically',
  'Qattiq holda ajratilmagan — faqat eritmada mavjud; panjara shartli koʻrsatilgan',
)
const N_HYDR: Tri = tri(
  'Безводная соль неустойчива; обычно встречается кристаллогидрат. Схема формульных единиц (упрощено)',
  'The anhydrous salt is unstable; usually it is a hydrate. A scheme of formula units (simplified)',
  'Suvsiz tuz beqaror; odatda kristallogidrat holida uchraydi. Formula birliklari sxemasi (soddalashtirilgan)',
)
const N_AMORPH: Tri = tri(
  'Осадок обычно аморфный (на деле — оксогидроксид с водой); схема формульных единиц (упрощено)',
  'The precipitate is usually amorphous (really an oxide-hydroxide with water); a scheme of formula units (simplified)',
  'Choʻkma odatda amorf (aslida — suvli oksogidroksid); formula birliklari sxemasi (soddalashtirilgan)',
)

export const PHASE_DATA: Readonly<Record<string, PhaseRow>> = {
  // ── Газы (25 °C, 1 атм) ──
  co2: gas(), so2: gas(), co: gas(), tb_cl2: gas(), tb_o2: gas(), tb_h2: gas(), h2s: gas(), nh3: gas(), tb_n2: gas(),
  no: gas(), no2: gas(), tb_f2: gas(), tb_o3: gas(), tb_ph3: gas(), tb_sih4: gas(), n2o: gas(), tb_sif4: gas(),
  tb_n2o4: gas(tri(
    'N₂O₄ кипит при 21 °C: при 25 °C — газ в равновесии с NO₂; реально молекулы в ~10 раз дальше',
    'N₂O₄ boils at 21 °C: at 25 °C it is a gas in equilibrium with NO₂; really the molecules are ~10 times farther apart',
    'N₂O₄ 21 °C da qaynaydi: 25 °C da — NO₂ bilan muvozanatdagi gaz; aslida molekulalar ~10 marta uzoqroq',
  )),
  tb_n2o3: gas(tri(
    'N₂O₃ устойчив только ниже −21 °C; при 25 °C распадается на NO и NO₂ — показана молекула N₂O₃',
    'N₂O₃ is stable only below −21 °C; at 25 °C it breaks into NO and NO₂ — the N₂O₃ molecule is shown',
    'N₂O₃ faqat −21 °C dan past barqaror; 25 °C da NO va NO₂ ga parchalanadi — N₂O₃ molekulasi koʻrsatilgan',
  )),
  // ── Кислоты-газы: карточка — раствор (соляная, бромоводородная, иодоводородная, плавиковая кислоты) ──
  hcl: sol('aq', 'strong', [0]),
  hbr: sol('aq', 'strong', [0]),
  hi: sol('aq', 'strong', [0]),
  hf: sol('aq', 'weak', [0], tri(
    'HF — слабая кислота (прочная связь H–F): большая часть молекул в растворе не распадается',
    'HF is a weak acid (strong H–F bond): most molecules stay whole in solution',
    'HF — kuchsiz kislota (H–F bogʻi mustahkam): eritmada molekulalarning koʻpi parchalanmaydi',
  )),
  // ── Жидкости ──
  h2o: liquid(), h2so4: liquid(), hno3: liquid(), tb_br2: liquid(), h2o2: liquid(), hclo4: liquid(), tb_cl2o7: liquid(),
  tb_mn2o7: liquid(), tb_cs2: liquid(),
  so3: liquid(tri(
    'SO₃ плавится при 17 °C: при 25 °C — жидкость (в ней есть тримеры S₃O₉); в модели — молекулы SO₃',
    'SO₃ melts at 17 °C: at 25 °C it is a liquid (with S₃O₉ trimers); the model shows SO₃ molecules',
    'SO₃ 17 °C da eriydi: 25 °C da — suyuqlik (S₃O₉ trimerlari bor); modelda — SO₃ molekulalari',
  )),
  // ── Только в растворе ──
  h2co3: sol('aq', 'weak', [4, 5], N_WEAK),
  h2so3: sol('aq', 'weak', [4, 5], N_WEAK),
  hclo: sol('aq', 'weak', [2], N_WEAK),
  hno2: sol('aq', 'weak', [3], N_WEAK),
  hclo3: sol('aq', 'strong', [4]),
  hmno4: sol('aq', 'strong', [5]),
  nh3_h2o: sol('aq', 'weak', [], tri(
    'NH₃·H₂O ⇄ NH₄⁺ + OH⁻ — равновесие сильно сдвинуто влево: ионов мало (слабое основание)',
    'NH₃·H₂O ⇄ NH₄⁺ + OH⁻ — the equilibrium lies far to the left: few ions (a weak base)',
    'NH₃·H₂O ⇄ NH₄⁺ + OH⁻ — muvozanat chapga kuchli siljigan: ionlar kam (kuchsiz asos)',
  )),
  // ── Молекулярные кристаллы ──
  tb_s8: mc('ромбическая, кольца S₈', '16 молекул S₈ в ячейке', { a: 1046, b: 1287, c: 2449 }),
  tb_i2: mc('ромбическая, слои молекул I₂', 'I–I 272 пм внутри молекулы', { a: 718, b: 471, c: 981 }),
  tb_p4: mc('кубическая (белый фосфор), молекулы P₄', 'тетраэдры P₄, P–P 221 пм', {}, tri(
    'Белый фосфор: молекулы P₄ в кубической ячейке (точная укладка сложна — упрощено)',
    'White phosphorus: P₄ molecules in a cubic cell (the exact packing is complex — simplified)',
    'Oq fosfor: kubik yacheykada P₄ molekulalari (aniq joylashuv murakkab — soddalashtirilgan)',
  )),
  p2o5: mc('гексагональная, молекулы P₄O₁₀', 'P 4 (по O)', { a: 1030, c: 1340 }, tri(
    'P₂O₅ — простейшая формула; в кристалле — молекулы P₄O₁₀',
    'P₂O₅ is the simplest formula; the crystal is made of P₄O₁₀ molecules',
    'P₂O₅ — eng oddiy formula; kristallda — P₄O₁₀ molekulalari',
  )),
  tb_p4o10: mc('гексагональная, молекулы P₄O₁₀', 'P 4 (по O)', { a: 1030, c: 1340 }),
  h3po4: mc('моноклинная, водородные связи', 'P 4 (по O); пл. 42 °C', {}, tri(
    'Чистая H₃PO₄ плавится при 42 °C; продают обычно 85 % раствор',
    'Pure H₃PO₄ melts at 42 °C; it is usually sold as an 85 % solution',
    'Toza H₃PO₄ 42 °C da eriydi; odatda 85 % li eritma holida sotiladi',
  )),
  tb_h4p2o7: mc('молекулярная, водородные связи', 'P 4 (по O); пл. 61 °C'),
  n2o5: mc('гексагональная, ионы NO₂⁺ и NO₃⁻', 'NO₂⁺ линейный, NO₃⁻ треугольник', {}, tri(
    'В кристалле N₂O₅ — ионы нитрония NO₂⁺ и нитрата NO₃⁻; в модели — молекула N₂O₅ (как в газе)',
    'Solid N₂O₅ is made of nitronium NO₂⁺ and nitrate NO₃⁻ ions; the model shows the N₂O₅ molecule (as in the gas)',
    'Kristall N₂O₅ — nitroniy NO₂⁺ va nitrat NO₃⁻ ionlari; modelda — N₂O₅ molekulasi (gazdagidek)',
  )),
  // ── Полимеры ──
  h2sio3: chain('цепи / слои тетраэдров SiO₄', 'Si 4 (по O)', {}, tri(
    'H₂SiO₃ — простейшая формула; на деле гель xSiO₂·yH₂O',
    'H₂SiO₃ is the simplest formula; really it is a gel xSiO₂·yH₂O',
    'H₂SiO₃ — eng oddiy formula; aslida xSiO₂·yH₂O geli',
  )),
  cro3: chain('ромбическая, цепи тетраэдров CrO₄', 'Cr 4 (по O)'),
  tb_hpo3: chain('цепи тетраэдров PO₄ (метафосфорная)', 'P 4 (по O)'),
  tb_v2o5: chain('ромбическая, слои пирамид VO₅', 'V 5 (по O)', { a: 1151, b: 356, c: 437 }, tri(
    'V₂O₅ — слоистый кристалл; в модели показаны соседние звенья',
    'V₂O₅ is a layered crystal; the model shows neighbouring units',
    'V₂O₅ — qatlamli kristall; modelda qoʻshni boʻgʻinlar koʻrsatilgan',
  )),
  // ── Каркас ──
  sio2: { state: 's', cls: 'N', phase: 'network', code: 'NET', info: { copies: 0, spacing: 0, lattice: { type: 'кварц (атомный каркас)', coord: 'Si 4 : O 2', a: 491, c: 541 } } },

  // ── Ионные: тип NaCl ──
  nacl: ion('RS', 'Na⁺ 6 : Cl⁻ 6', { a: 564, gen: false }),
  mgo: ion('RS', 'Mg²⁺ 6 : O²⁻ 6', { a: 421, gen: false }),
  cao: ion('RS', 'Ca²⁺ 6 : O²⁻ 6', { a: 481 }),
  salt_k_cl: ion('RS', 'K⁺ 6 : Cl⁻ 6', { a: 629 }),
  salt_k_br: ion('RS', 'K⁺ 6 : Br⁻ 6', { a: 660 }),
  salt_k_i: ion('RS', 'K⁺ 6 : I⁻ 6', { a: 706 }),
  salt_na_br: ion('RS', 'Na⁺ 6 : Br⁻ 6', { a: 597 }),
  salt_na_i: ion('RS', 'Na⁺ 6 : I⁻ 6', { a: 647 }),
  salt_li_cl: ion('RS', 'Li⁺ 6 : Cl⁻ 6', { a: 514 }),
  salt_ag_cl: ion('RS', 'Ag⁺ 6 : Cl⁻ 6', { a: 555 }),
  salt_ag_br: ion('RS', 'Ag⁺ 6 : Br⁻ 6', { a: 577 }),
  feo: ion('RS', 'Fe²⁺ 6 : O²⁻ 6', { a: 431 }),
  bao: ion('RS', 'Ba²⁺ 6 : O²⁻ 6', { a: 554 }),
  tb_mno: ion('RS', 'Mn²⁺ 6 : O²⁻ 6', { a: 444 }),
  tb_cro: ion('RS', 'Cr²⁺ 6 : O²⁻ 6', { a: 420 }, tri(
    'CrO неустойчив, его решётка изучена плохо: принят тип NaCl, a ≈ 420 пм (оценка)',
    'CrO is unstable and poorly studied: the NaCl type with a ≈ 420 pm is assumed (estimate)',
    'CrO beqaror, panjarasi kam oʻrganilgan: NaCl turi, a ≈ 420 pm qabul qilingan (taxminiy)',
  )),
  salt_ca_s: ion('RS', 'Ca²⁺ 6 : S²⁻ 6', { a: 569 }),
  salt_pb_s: ion('RS', 'Pb²⁺ 6 : S²⁻ 6', { a: 594 }),
  tb_nah: ion('RS', 'Na⁺ 6 : H⁻ 6', { a: 488 }),
  tb_kh: ion('RS', 'K⁺ 6 : H⁻ 6', { a: 571 }),
  // NaCl-подобные с двухатомным анионом (гантели в узлах аниона)
  fes2: ion('RS', 'Fe²⁺ 6 : S₂²⁻ 6', { a: 542, type: 'пирит (тип NaCl, гантели S₂)' }, tri(
    'Пирит: гантели S₂²⁻ в узлах аниона решётки типа NaCl, повёрнуты по диагоналям куба',
    'Pyrite: S₂²⁻ dumbbells sit on the anion sites of an NaCl-type lattice, turned along the cube diagonals',
    'Pirit: S₂²⁻ gantellari NaCl turidagi panjaraning anion tugunlarida, kub diagonallari boʻylab burilgan',
  )),
  tb_cac2: ion('RS', 'Ca²⁺ 6 : C₂²⁻ 6', { a: 388, c: 637, type: 'CaC₂ (искажённый тип NaCl)' }, N_TETRA),
  tb_bao2: ion('RS', 'Ba²⁺ 6 : O₂²⁻ 6', { a: 538, c: 684, type: 'CaC₂ (искажённый тип NaCl)' }, N_TETRA),
  tb_ko2: ion('RS', 'K⁺ 6 : O₂⁻ 6', { a: 572, c: 675, type: 'CaC₂ (искажённый тип NaCl)' }, N_TETRA),
  // ── CsCl, сфалерит, вюрцит, NiAs ──
  salt_nh4_cl: ion('CsCl', 'NH₄⁺ 8 : Cl⁻ 8', { a: 386 }),
  salt_zn_s: ion('ZB', 'Zn²⁺ 4 : S²⁻ 4', { a: 541 }),
  salt_ag_i: ion('WZ', 'Ag⁺ 4 : I⁻ 4', { a: 459, c: 751, type: 'вюрцит (β-AgI)' }, tri(
    'При 25 °C AgI — смесь β (вюрцит) и γ (сфалерит); обе формы 4:4',
    'At 25 °C AgI is a mix of β (wurtzite) and γ (zinc blende); both are 4:4',
    '25 °C da AgI — β (vyursit) va γ (sfalerit) aralashmasi; ikkalasi ham 4:4',
  )),
  zno: ion('WZ', 'Zn²⁺ 4 : O²⁻ 4', { a: 325, c: 521 }),
  tb_beo: ion('WZ', 'Be²⁺ 4 : O²⁻ 4', { a: 270, c: 438 }),
  salt_fe2_s: ion('NiAs', 'Fe²⁺ 6 : S²⁻ 6', { a: 597, c: 1174 }),
  // ── Антифлюорит ──
  na2o: ion('AF', 'Na⁺ 4 : O²⁻ 8', { a: 555 }),
  k2o: ion('AF', 'K⁺ 4 : O²⁻ 8', { a: 644 }),
  li2o: ion('AF', 'Li⁺ 4 : O²⁻ 8', { a: 462 }),
  salt_na_s: ion('AF', 'Na⁺ 4 : S²⁻ 8', { a: 653 }),
  salt_k_s: ion('AF', 'K⁺ 4 : S²⁻ 8', { a: 739 }),
  // ── Куприт ──
  cu2o: ion('CUP', 'Cu⁺ 2 : O²⁻ 4', { a: 427 }),
  ago: ion('CUP', 'Ag⁺ 2 : O²⁻ 4', { a: 472 }),
  // ── Корунд, кальцит, барит, глёт ──
  al2o3: ion('COR', 'Al³⁺ 6 : O²⁻ 4', { a: 476, c: 1299, gen: false }),
  fe2o3: ion('COR', 'Fe³⁺ 6 : O²⁻ 4', { a: 504, c: 1375, type: 'корунд (гематит)' }),
  cr2o3: ion('COR', 'Cr³⁺ 6 : O²⁻ 4', { a: 496, c: 1359 }),
  salt_ca_co3: ion('CAL', 'Ca²⁺ 6 (по O)', { a: 499, c: 1706 }),
  salt_mg_co3: ion('CAL', 'Mg²⁺ 6 (по O)', { a: 463, c: 1502, type: 'кальцит (магнезит)' }),
  salt_na_no3: ion('CAL', 'Na⁺ 6 (по O)', { a: 507, c: 1681 }),
  salt_ba_so4: ion('BAR', 'Ba²⁺ 12 (по O)', { a: 887, b: 545, c: 715, gen: false }),
  pbo: ion('U', 'Pb²⁺ 4 (по O), слои', { a: 397, c: 502, type: 'глёт (тетрагональная, слоистая)', gen: false }, tri(
    'Глёт: слои PbO, у Pb²⁺ четыре O с одной стороны (неподелённая пара — с другой)',
    'Litharge: PbO layers; each Pb²⁺ has four O on one side (the lone pair on the other)',
    'Glyot: PbO qatlamlari; Pb²⁺ ning bir tomonida toʻrtta O (boʻlinmagan juft — boshqa tomonda)',
  )),
  // ── Слоистые CdI₂ / CdCl₂ ──
  mg_oh_2: ion('CdI2', 'Mg²⁺ 6 : OH⁻ 3', { a: 314, c: 477, type: 'слоистая, тип CdI₂ (брусит)' }),
  ca_oh_2: ion('CdI2', 'Ca²⁺ 6 : OH⁻ 3', { a: 359, c: 491, type: 'слоистая, тип CdI₂ (портландит)' }),
  fe_oh_2: ion('CdI2', 'Fe²⁺ 6 : OH⁻ 3', { a: 326, c: 460 }),
  tb_croh2: ion('CdI2', 'Cr²⁺ 6 : OH⁻ 3', { a: 326, c: 460 }, tri(
    'Cr(OH)₂ изучен мало: принят тип CdI₂ с параметрами Fe(OH)₂ (оценка)',
    'Cr(OH)₂ is poorly studied: the CdI₂ type with the cell of Fe(OH)₂ is assumed (estimate)',
    'Cr(OH)₂ kam oʻrganilgan: Fe(OH)₂ parametrlari bilan CdI₂ turi qabul qilingan (taxminiy)',
  )),
  salt_pb_i: ion('CdI2', 'Pb²⁺ 6 : I⁻ 3', { a: 456, c: 698 }),
  salt_mg_cl: ion('CdI2', 'Mg²⁺ 6 : Cl⁻ 3', { a: 364, c: 588, type: 'слоистая, тип CdCl₂' }, N_CDCL2),
  salt_fe2_cl: ion('CdI2', 'Fe²⁺ 6 : Cl⁻ 3', { a: 360, c: 585, type: 'слоистая, тип CdCl₂' }, N_CDCL2),
  salt_mn_cl: ion('CdI2', 'Mn²⁺ 6 : Cl⁻ 3', { a: 371, c: 586, type: 'слоистая, тип CdCl₂' }, N_CDCL2),
  // ── Слоистые MX₃ ──
  salt_al_cl: ion('L3', 'Al³⁺ 6 : Cl⁻ 2', { a: 591, c: 616, type: 'слоистая MX₃ (AlCl₃)' }, tri(
    'В кристалле Al³⁺ окружён 6 Cl⁻ (слои); молекула AlCl₃ модели (как в паре — Al₂Cl₆) вписана в слой',
    'In the crystal Al³⁺ has 6 Cl⁻ (layers); the AlCl₃ molecule of the model (as in the vapour — Al₂Cl₆) is fitted into a layer',
    'Kristallda Al³⁺ ni 6 ta Cl⁻ oʻrab turadi (qatlamlar); modeldagi AlCl₃ molekulasi (bugʻdagidek — Al₂Cl₆) qatlamga joylangan',
  )),
  salt_fe3_cl: ion('L3', 'Fe³⁺ 6 : Cl⁻ 2', { a: 606, c: 580, type: 'слоистая MX₃ (BiI₃-тип)' }, N_DIM),
  salt_cr_cl: ion('L3', 'Cr³⁺ 6 : Cl⁻ 2', { a: 595, c: 580, type: 'слоистая MX₃ (CrCl₃)' }, N_DIM),
  // ── Рутил ──
  mno2: ion('RUT', 'Mn⁴⁺ 6 : O²⁻ 3', { a: 440, c: 287, type: 'рутил (пиролюзит)' }),
  salt_ca_cl: ion('RUT', 'Ca²⁺ 6 : Cl⁻ 3', { a: 624, b: 643, c: 420, type: 'искажённый рутил (CaCl₂)' }, tri(
    'CaCl₂ — искажённый рутил (ромбическая ячейка); в модели — рутил',
    'CaCl₂ is a distorted rutile (orthorhombic cell); the model uses rutile',
    'CaCl₂ — buzilgan rutil (rombik yacheyka); modelda — rutil',
  )),
  // ── Котуннит (схема + подпись) ──
  salt_ba_cl: ion('PbCl2', 'Ba²⁺ 9 (по Cl⁻)', { a: 787, b: 469, c: 938, gen: false }, N_SCHEMA),
  salt_pb_cl: ion('PbCl2', 'Pb²⁺ 9 (по Cl⁻)', { a: 762, b: 453, c: 904, gen: false }, N_SCHEMA),
  tb_cah2: ion('PbCl2', 'Ca²⁺ 9 (по H⁻)', { a: 594, b: 364, c: 680, gen: false }, N_SCHEMA),
  // ── Шпинели (схема + подпись) ──
  fe3o4: ion('SPI', 'Fe³⁺ 4 и 6, Fe²⁺ 6 (по O)', { a: 840, type: 'обратная шпинель (магнетит)', gen: false }, tri(
    'Обратная шпинель: Fe³⁺ в тетраэдрах и октаэдрах, Fe²⁺ в октаэдрах; в модели — схема формульных единиц',
    'Inverse spinel: Fe³⁺ in tetrahedra and octahedra, Fe²⁺ in octahedra; the model shows formula units',
    'Teskari shpinel: Fe³⁺ tetraedr va oktaedrlarda, Fe²⁺ oktaedrlarda; modelda — formula birliklari',
  )),
  tb_mn3o4: ion('SPI', 'Mn²⁺ 4, Mn³⁺ 6 (по O)', { a: 576, c: 944, type: 'шпинель (гаусманит, тетрагон.)', gen: false }, tri(
    'Гаусманит — искажённая шпинель: Mn²⁺ в тетраэдрах, Mn³⁺ в октаэдрах; в модели — схема',
    'Hausmannite is a distorted spinel: Mn²⁺ in tetrahedra, Mn³⁺ in octahedra; the model is a scheme',
    'Gausmanit — buzilgan shpinel: Mn²⁺ tetraedrlarda, Mn³⁺ oktaedrlarda; modelda — sxema',
  )),
  // ── Схема + честная подпись ──
  cuo: ion('U', 'Cu²⁺ 4 : O²⁻ 4', { a: 468, b: 342, c: 513, type: 'тенорит (моноклинная)', gen: false }, tri(
    'Тенорит: Cu²⁺ окружён 4 O (квадрат); в модели — шахматная укладка 6:6 (упрощено)',
    'Tenorite: Cu²⁺ has 4 O (a square); the model uses a 6:6 checkerboard (simplified)',
    'Tenorit: Cu²⁺ ni 4 ta O (kvadrat) oʻrab turadi; modelda — 6:6 shaxmat joylashuvi (soddalashtirilgan)',
  )),
  tb_hgo: ion('U', 'Hg²⁺ 2 : O²⁻ 2', { type: 'зигзаг-цепи –Hg–O–', gen: false }, tri(
    'В кристалле HgO — зигзаг-цепи –Hg–O–Hg–O– (Hg 2); в модели — схема (упрощено)',
    'Solid HgO consists of zigzag –Hg–O–Hg–O– chains (Hg 2); the model is a scheme (simplified)',
    'Kristall HgO — –Hg–O–Hg–O– zigzag zanjirlari (Hg 2); modelda — sxema (soddalashtirilgan)',
  )),
  salt_cu_s: ion('U', 'Cu 3 и 4 (по S)', { type: 'ковеллин (гексагональная)', gen: false }, tri(
    'Ковеллин сложен: часть S образует пары S₂, связь во многом ковалентная; схема 1:1 (упрощено)',
    'Covellite is complex: some S form S₂ pairs, the bonding is largely covalent; a 1:1 scheme (simplified)',
    'Kovellin murakkab: S ning bir qismi S₂ juftlarini hosil qiladi, bogʻ koʻp jihatdan kovalent; 1:1 sxema (soddalashtirilgan)',
  )),
  salt_al_s: ion('U', 'Al³⁺ 4 (по S)', { type: 'вюрцит с вакансиями', gen: false }),
  tb_ca3p2: ion('U', 'Ca²⁺ 6 (по P)', { gen: false }),
  tb_al4c3: ion('U', 'Al³⁺ 4 (по C)', { type: 'ромбоэдрическая (слоистая)', gen: false }),
  tb_aucl3: ion('U', 'Au³⁺ 4 (квадрат Cl)', { type: 'димеры Au₂Cl₆', gen: false }, tri(
    'В кристалле — плоские димеры Au₂Cl₆ (Au 4, квадрат); схема формульных единиц (упрощено)',
    'The crystal is made of flat Au₂Cl₆ dimers (Au 4, square); a scheme of formula units (simplified)',
    'Kristallda — yassi Au₂Cl₆ dimerlari (Au 4, kvadrat); formula birliklari sxemasi (soddalashtirilgan)',
  )),
  tb_mn2o3: ion('U', 'Mn³⁺ 6 (по O)', { a: 941, type: 'биксбиит (кубическая)', gen: false }),
  tb_crcl2: ion('U', 'Cr²⁺ 4+2 (искажённый рутил)', { gen: false }),
  tb_cu2s: ion('U', 'Cu⁺ 3 (по S), халькозин', { gen: false }, tri(
    'Халькозин: Cu⁺ подвижны, связь во многом ковалентная; схема 2:1 (упрощено)',
    'Chalcocite: the Cu⁺ ions are mobile, the bonding is largely covalent; a 2:1 scheme (simplified)',
    'Xalkozin: Cu⁺ harakatchan, bogʻ koʻp jihatdan kovalent; 2:1 sxema (soddalashtirilgan)',
  )),
  salt_cu_cl: ion('U', 'Cu²⁺ 4+2, цепи CuCl₄', { gen: false }),
  salt_zn_cl: ion('U', 'Zn²⁺ 4 : Cl⁻ 2 (тетраэдры ZnCl₄)', { type: 'δ-ZnCl₂ (тетраэдры)', gen: false }),
  // ── Остальные ионные: схема формульных единиц, координация катиона по O ──
  naoh: U('Na⁺ 6 (по O)'), koh: U('K⁺ 6 (по O, искажённая)'), lioh: U('Li⁺ 4 (тетраэдр OH⁻), слои'),
  cu_oh_2: U('Cu²⁺ 4+2 (по O)'), zn_oh_2: U('Zn²⁺ 4 (тетраэдр OH⁻)'), ba_oh_2: U('Ba²⁺ ≥ 7 (по O)'),
  al_oh_3: U('Al³⁺ 6 (по OH⁻), слои'), fe_oh_3: U('Fe³⁺ 6 (по O)', N_AMORPH), tb_croh3: U('Cr³⁺ 6 (по O)', N_AMORPH),
  salt_cu_so4: U('Cu²⁺ 4+2 (по O)'), salt_na_so4: U('Na⁺ 6 (по O)'), salt_k_so4: U('K⁺ 9–10 (по O)'),
  salt_fe2_so4: U('Fe²⁺ 6 (по O)'), salt_zn_so4: U('Zn²⁺ 6 (по O)'), salt_mg_so4: U('Mg²⁺ 6 (по O)'),
  salt_mn_so4: U('Mn²⁺ 6 (по O)'), salt_ca_so4: U('Ca²⁺ 8 (по O), ангидрит'), salt_nh4_so4: U('NH₄⁺ 8 (по O)'),
  salt_al_so4: U('Al³⁺ 6 (по O)'), salt_fe3_so4: U('Fe³⁺ 6 (по O)'), salt_cr_so4: U('Cr³⁺ 6 (по O)'),
  tb_nahso4: U('Na⁺ 6 (по O)'),
  salt_na_co3: U('Na⁺ 6 (по O)'), salt_k_co3: U('K⁺ 8–9 (по O)'), salt_nahco3: U('Na⁺ 6 (по O)'),
  salt_ca_hco3_2: U('Ca²⁺ 6–8 (по O)', N_SOLID_NO, { state: 'aq' }),
  salt_nh4_co3: U('NH₄⁺ 8 (водородные связи)'), tb_cuoh2co3: U('Cu²⁺ 4+2 (малахит)'),
  salt_k_no3: U('K⁺ 9 (по O), тип арагонита'), salt_ag_no3: U('Ag⁺ 2–4 (по O)'), salt_nh4_no3: U('NH₄⁺ 8 (по O)'),
  salt_ca_no3: U('Ca²⁺ 12 (по O)'), salt_ba_no3: U('Ba²⁺ 12 (по O)'), salt_pb_no3: U('Pb²⁺ 12 (по O)'),
  salt_cu_no3: U('Cu²⁺ 4+2 (по O)'), salt_zn_no3: U('Zn²⁺ 4/6 (по O)', N_HYDR), salt_al_no3: U('Al³⁺ 6 (по O)', N_HYDR),
  salt_fe3_no3: U('Fe³⁺ 6 (по O)', N_HYDR), salt_fe2_no3: U('Fe²⁺ 6 (по O)', N_HYDR),
  salt_na_no2: U('Na⁺ 6 (по O)'), salt_k_no2: U('K⁺ 8–9 (по O)'),
  salt_k_mno4: U('K⁺ 10–12 (по O), тип барита'), tb_k2mno4: U('K⁺ 9–10 (по O)'),
  salt_k_clo3: U('K⁺ 8–9 (по O)'), salt_na_clo2: U('Na⁺ 6 (по O)'),
  tb_kclo: U('K⁺ 6–8 (по O)', N_SOLID_NO, { state: 'aq' }),
  tb_caocl2: U('Ca²⁺ 6–8', tri(
    'Хлорная известь — смесь веществ; формула CaOCl₂ условна; схема формульных единиц',
    'Bleaching powder is a mixture; the formula CaOCl₂ is conventional; a scheme of formula units',
    'Xlorli ohak — moddalar aralashmasi; CaOCl₂ formulasi shartli; formula birliklari sxemasi',
  )),
  salt_k2cr2o7: U('K⁺ 8–9 (по O)'), salt_k_cro4: U('K⁺ 9–10 (по O), тип β-K₂SO₄'), salt_nh4_cr2o7: U('NH₄⁺ 8 (по O)'),
  salt_na_sio3: U('Na⁺ 5–6 (по O), цепи SiO₃'), salt_ca_sio3: U('Ca²⁺ 6 (по O), цепи SiO₃'),
  salt_na_so3: U('Na⁺ 6 (по O)'), salt_k_so3: U('K⁺ 8–9 (по O)'),
  tb_ca3po42: U('Ca²⁺ 6–8 (по O)'), tb_na3po4: U('Na⁺ 6 (по O)'), tb_ag3po4: U('Ag⁺ 4 (по O)'),
  tb_cahpo4: U('Ca²⁺ 7–8 (по O), монетит'), tb_cah2po42: U('Ca²⁺ 8 (по O)'), tb_nh42hpo4: U('NH₄⁺ 8 (водородные связи)'),
  tb_mg3po42: U('Mg²⁺ 5–6 (по O)'),
  na2o2: U('Na⁺ 6 (по O)'), tb_k2o2: U('K⁺ 6–8 (по O)'), tb_naalo2: U('Na⁺ 4, Al³⁺ 4 (каркас AlO₄)'),
  tb_na2zno2: U('Na⁺ 4, Zn²⁺ 4 (по O)'), tb_na2znoh4: U('Zn²⁺ 4 ([Zn(OH)₄]²⁻), Na⁺ 6'),
  // ── Кристаллогидраты и двойные соли ──
  tb_cuso4_5h2o: H('Cu²⁺ 4+2 (4 H₂O + 2 O сульфата)'),
  tb_caso4_2h2o: H('Ca²⁺ 8 (6 O сульфата + 2 H₂O), слои'),
  tb_feso4_7h2o: H('Fe²⁺ 6 ([Fe(H₂O)₆]²⁺)'),
  tb_na2so4_10h2o: H('Na⁺ 6 ([Na(H₂O)₆]⁺)'),
  tb_kcl_mgcl2_6h2o: H('Mg²⁺ 6 ([Mg(H₂O)₆]²⁺), K⁺ 6 (по Cl⁻)', N_SCHEMA, 'двойная соль (карналлит)'),
  tb_kcl_mgso4_3h2o: H('Mg²⁺ 6, K⁺ 8–9', N_SCHEMA, 'двойная соль (каинит)'),
  tb_kcl_nacl: H('K⁺ 6 : Cl⁻ 6 и Na⁺ 6 : Cl⁻ 6', tri(
    'Сильвинит — смесь кристаллов KCl и NaCl (обе решётки типа NaCl), а не одно вещество',
    'Sylvinite is a mixture of KCl and NaCl crystals (both NaCl-type), not one substance',
    'Silvinit — KCl va NaCl kristallari aralashmasi (ikkalasi NaCl turida), bitta modda emas',
  ), 'смесь двух решёток типа NaCl'),
}

/** Строка таблицы фаз по id (нет — null: вещество вне 200). */
export function phaseRow(id: string): PhaseRow | null {
  return PHASE_DATA[id] ?? null
}
