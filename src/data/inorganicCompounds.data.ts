import type { RawCompoundDef } from '../types/chemistry'
import { hash32 } from '../chemistry/placeholderMolecule'
import { mergeIonic } from '../chemistry/ionicComposition'

const SUB = '₀₁₂₃₄₅₆₇₈₉'
function sub(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUB[Number(d)] ?? d)
    .join('')
}

function wrapCount(u: string, n: number): string {
  if (n <= 1) return u
  // Уже в скобках: (OH), (HCO₃), …
  if (u.startsWith('(')) return `${u}${sub(n)}`
  // Моноатомный анион/катион (Cl, Br, S, …) — без скобок: FeCl₃, Na₂S
  if (/^[A-Z][a-z]?$/.test(u)) return `${u}${sub(n)}`
  // Полиатомная группа: (NH₄)₂, (SO₄)₃, (NO₃)₂, (Cr₂O₇)…
  return `(${u})${sub(n)}`
}

type CationDef = {
  id: string
  genitive: string
  comp: Record<string, number>
  charge: number
}

const NH4 = { comp: { N: 1, H: 4 } as Record<string, number>, charge: 1 }

const CATIONS_MONO: CationDef[] = [
  { id: 'na', genitive: 'натрия', comp: { Na: 1 }, charge: 1 },
  { id: 'k', genitive: 'калия', comp: { K: 1 }, charge: 1 },
  { id: 'li', genitive: 'лития', comp: { Li: 1 }, charge: 1 },
  { id: 'nh4', genitive: 'аммония', comp: NH4.comp, charge: 1 },
  { id: 'ag', genitive: 'серебра', comp: { Ag: 1 }, charge: 1 },
  { id: 'cs', genitive: 'цезия', comp: { Cs: 1 }, charge: 1 },
  { id: 'mg', genitive: 'магния', comp: { Mg: 1 }, charge: 2 },
  { id: 'ca', genitive: 'кальция', comp: { Ca: 1 }, charge: 2 },
  { id: 'ba', genitive: 'бария', comp: { Ba: 1 }, charge: 2 },
  { id: 'sr', genitive: 'стронция', comp: { Sr: 1 }, charge: 2 },
  { id: 'zn', genitive: 'цинка', comp: { Zn: 1 }, charge: 2 },
  { id: 'cu', genitive: 'меди(II)', comp: { Cu: 1 }, charge: 2 },
  { id: 'fe2', genitive: 'железа(II)', comp: { Fe: 1 }, charge: 2 },
  { id: 'pb', genitive: 'свинца(II)', comp: { Pb: 1 }, charge: 2 },
  { id: 'sn', genitive: 'олова(II)', comp: { Sn: 1 }, charge: 2 },
  { id: 'mn', genitive: 'марганца(II)', comp: { Mn: 1 }, charge: 2 },
  { id: 'ni', genitive: 'никеля(II)', comp: { Ni: 1 }, charge: 2 },
  { id: 'cobalt', genitive: 'кобальта(II)', comp: { Co: 1 }, charge: 2 },
  { id: 'al', genitive: 'алюминия', comp: { Al: 1 }, charge: 3 },
  { id: 'fe3', genitive: 'железа(III)', comp: { Fe: 1 }, charge: 3 },
  { id: 'cr', genitive: 'хрома(III)', comp: { Cr: 1 }, charge: 3 },
]

const ANIONS: Record<
  string,
  { comp: Record<string, number>; charge: number; noun: string; u: string }
> = {
  Cl: { comp: { Cl: 1 }, charge: -1, noun: 'Хлорид', u: 'Cl' },
  Br: { comp: { Br: 1 }, charge: -1, noun: 'Бромид', u: 'Br' },
  I: { comp: { I: 1 }, charge: -1, noun: 'Йодид', u: 'I' },
  F: { comp: { F: 1 }, charge: -1, noun: 'Фторид', u: 'F' },
  NO2: { comp: { N: 1, O: 2 }, charge: -1, noun: 'Нитрит', u: 'NO₂' },
  NO3: { comp: { N: 1, O: 3 }, charge: -1, noun: 'Нитрат', u: 'NO₃' },
  MnO4: { comp: { Mn: 1, O: 4 }, charge: -1, noun: 'Марганцовокислый', u: 'MnO₄' },
  ClO3: { comp: { Cl: 1, O: 3 }, charge: -1, noun: 'Хлорат', u: 'ClO₃' },
  ClO4: { comp: { Cl: 1, O: 4 }, charge: -1, noun: 'Перхлорат', u: 'ClO₄' },
  SO4: { comp: { S: 1, O: 4 }, charge: -2, noun: 'Сульфат', u: 'SO₄' },
  SO3: { comp: { S: 1, O: 3 }, charge: -2, noun: 'Сульфит', u: 'SO₃' },
  CO3: { comp: { C: 1, O: 3 }, charge: -2, noun: 'Карбонат', u: 'CO₃' },
  S: { comp: { S: 1 }, charge: -2, noun: 'Сульфид', u: 'S' },
  SiO3: { comp: { Si: 1, O: 3 }, charge: -2, noun: 'Силикат', u: 'SiO₃' },
  CrO4: { comp: { Cr: 1, O: 4 }, charge: -2, noun: 'Хромат', u: 'CrO₄' },
  Cr2O7: { comp: { Cr: 2, O: 7 }, charge: -2, noun: 'Дихромат', u: 'Cr₂O₇' },
  PO4: { comp: { P: 1, O: 4 }, charge: -3, noun: 'Фосфат', u: 'PO₄' },
}

function gcdCharge(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

function cationPart(cat: CationDef, nCat: number): string {
  if (cat.id === 'nh4') return wrapCount('NH₄', nCat)
  const sym = Object.keys(cat.comp)[0]
  const perUnit = cat.comp[sym] ?? 1
  const total = perUnit * nCat
  if (total === 1) return sym
  return `${sym}${sub(total)}`
}

function anionPart(an: { u: string }, nAn: number): string {
  return wrapCount(an.u, nAn)
}

function saltDescriptionRu(id: string, cat: CationDef, anKey: string): string {
  const an = ANIONS[anKey]
  if (!an) return ''
  const title = `${an.noun} ${cat.genitive}`
  const pick = (a: string, b: string, c: string) => [a, b, c][hash32(id) % 3]!

  // Точечные правки по замечаниям аудита карточек
  if (id === 'salt_cr_f') {
    return `${title} — безводный фиолетовый (или тёмно-зелёный гидрат) реагент. В промышленности используют как катализатор органического синтеза (фторирование) и протраву при крашении тканей, а не как источник кислот и щелочей. Прямой синтез 2Cr+3F₂ в школьной лаборатории не проводят из‑за токсичности фтора.`
  }
  if (id === 'salt_cr_cl') {
    return `${title} — кристаллическое вещество: безводная форма фиолетовая, гексагидрат — тёмно-зелёный. Несъедобен и не заменяет поваренную соль. Применяют как катализатор, в дублении кожи и лабораторных синтезах соединений хрома.`
  }
  if (id === 'salt_cr_i' || id === 'salt_cr_br') {
    return `${title} — лабораторный реагент для синтеза комплексных соединений хрома. Гигроскопичен, дорог и в базовые школьные наборы обычно не входит; описания «как у поваренной соли» к нему не относятся.`
  }
  if (id === 'salt_na_no2') {
    return `${title} — соль азотистой кислоты с анионом NO₂⁻ (не нитрат NO₃⁻!). В промышленности получают восстановлением нитрата натрия. В чистом виде осторожно (токсичность); на уроках важны реакции нитритов и отличие от нитратов.`
  }
  if (id === 'salt_na_s') {
    return `${title} — бескислородная соль сероводородной кислоты (нет кислорода в формуле). Получают сплавлением натрия с серой: 2Na+S →(t°) Na₂S (бурно). Термически устойчив (плавится около 1180 °C без разложения); не относят к солям кислородных кислот.`
  }
  if (id === 'salt_fe3_s') {
    return `${title} — неустойчивый сульфид железа(III). При сухом нагреве Fe+S образуется FeS, а не Fe₂S₃; Fe₂S₃ при нагревании разлагается: Fe₂S₃ → 2FeS + S. В растворе возможен осадок Fe³⁺+S²⁻ при низкой температуре.`
  }
  if (id === 'salt_fe2_s') {
    return `${title} — сульфид железа(II), типичный продукт нагревания смеси Fe и S. Чёрный, используется для получения H₂S в лаборатории. Не путать с Fe₂S₃.`
  }
  if (id === 'salt_na_br') {
    return `${title} — ионная соль. Прямой контакт натрия с жидким бромом крайне экзотермичен и опасен; спокойнее получают нейтрализацией: NaOH+HBr → NaBr+H₂O или Na₂CO₃+2HBr → 2NaBr+H₂O+CO₂.`
  }

  const hal = anKey === 'Cl' || anKey === 'Br' || anKey === 'I' || anKey === 'F'
  if (hal) {
    return pick(
      `${title} — простая ионная соль галогенид-аниона, обычно хорошо растворима в воде. В школьных опытах её растворы берут для реакций обмена, качественных реакций на ионы и электролиза.`,
      `${title} в кристаллическом виде и в растворе диссоциирует на ионы, поэтому удобен для объяснения электролитов и таблицы растворимости. На уроках часто показывают получение нерастворимого галогенида серебра и цепочки «металл — раствор соли».`,
      `${title} — наглядный пример кристаллической ионной решётки. В лабораторных работах сравнивают активность металлов, изучают коррозию и осаждение.`,
    )
  }
  if (anKey === 'NO3') {
    return pick(
      `${title} — соль азотной кислоты (анион NO₃⁻), в воде сильный электролит. В демонстрациях используют при разборе реакций с металлами и обсуждении оксидов азота. Нитраты входят в удобрения; на школьном уровне важны ОВР азота.`,
      `${title} хорошо растворим и быстро даёт ионы в растворе. В быту и технике нитраты встречаются в удобрениях и пиротехнике; на уроке — степени окисления азота.`,
      `${title} встречается в виде кристаллов или раствора. Получают из HNO₃ и металла / оксида / гидроксида, а не из N₂+металл+O₂. В промышленности ион NO₃⁻ участвует во многих циклах.`,
    )
  }
  if (anKey === 'NO2') {
    return pick(
      `${title} — соль азотистой кислоты (анион NO₂⁻, не NO₃⁻). В растворе — электролит; на уроках отличают нитриты от нитратов и обсуждают окислительно-восстановительные свойства азота.`,
      `${title} получают восстановлением соответствующего нитрата или обменом. Прямой синтез из N₂, металла и O₂ химически невозможен.`,
      `${title} содержит нитрит-ион NO₂⁻. В чистом виде работу ведут осторожно; в школьном курсе важна номенклатура и отличие от нитратов.`,
    )
  }
  if (anKey === 'MnO4' || anKey === 'ClO3' || anKey === 'ClO4' || anKey === 'CrO4' || anKey === 'Cr2O7') {
    return pick(
      `${title} содержит анион с высокой степенью окисления, поэтому раствор часто проявляет окислительные свойства. В школе — только аккуратные демонстрации. Не получают сплавлением металла с Mn/Cl/Cr и кислородом.`,
      `${title} — сильный электролит; цвет и поведение раствора помогают объяснить степени окисления. Работают с разбавленными растворами.`,
      `${title} удобен для иллюстрации стехиометрии ОВР. Получение — через манганаты / хлораты / хроматы и обмен, а не «металл+неметалл+O₂».`,
    )
  }
  if (anKey === 'S') {
    return pick(
      `${title} — бескислородная соль (сульфид). Для щелочных металлов возможен синтез из простых веществ при нагревании; многие сульфиды осаждают из раствора. Не относят к солям кислородных кислот.`,
      `${title} реагирует с кислотами с выделением H₂S (осторожно, яд). В природе — сульфидные руды; на уроках — качественная реакция на S²⁻.`,
      `${title} иллюстрирует свойства сульфид-иона и таблицу растворимости. Не путать с сульфатами и сульфитами.`,
    )
  }
  if (anKey === 'SO4' || anKey === 'SO3' || anKey === 'CO3' || anKey === 'SiO3') {
    return pick(
      `${title} — соль кислородсодержащей кислоты. В школе изучают растворимость, гидролиз карбонатов, реакции с кислотами. Получают из оксида / гидроксида и кислоты, а не сплавлением металла с неметаллом и O₂.`,
      `${title} — типичный представитель солей кислородных кислот. На уроках показывают взаимодействие с кислотами и перевод ионов в малорастворимые формы.`,
      `${title} служит примером для таблицы растворимости и качественных реакций. Карбонаты есть в соде; силикаты — в стекольной химии.`,
    )
  }
  if (anKey === 'PO4') {
    return pick(
      `${title} — соль ортофосфата; часто менее растворима, чем нитраты, и удобна для опытов с осаждением. Получают обменом или из H₃PO₄, не из металла+P+O₂.`,
      `${title} связывают с апатитом и удобрениями. На уроках — качественные реакции на PO₄³⁻.`,
      `${title} получают из растворов фосфорной кислоты или обменным осаждением. Объект для расчётов по стехиометрии.`,
    )
  }
  return pick(
    `${title} — неорганическая соль из базового школьного перечня; в водном растворе ведёт себя как электролит.`,
    `${title} помогает показать связь между формулой, степенями окисления и свойствами раствора.`,
    `${title} иллюстрирует ионную природу кристаллических веществ и законы эквивалентности при осаждении.`,
  )
}

function addSalt(
  out: RawCompoundDef[],
  seen: Set<string>,
  cat: CationDef,
  anKey: string,
  skip?: (composition: Record<string, number>) => boolean,
) {
  const an = ANIONS[anKey]
  if (!an) return
  if (cat.id === 'k' && anKey === 'Cr2O7') return
  const g = gcdCharge(cat.charge, an.charge)
  const nCat = Math.abs(an.charge) / g
  const nAn = Math.abs(cat.charge) / g
  const composition = mergeIonic({ comp: cat.comp, charge: cat.charge }, { comp: an.comp, charge: an.charge })
  if (skip?.(composition)) return
  const key = Object.entries(composition)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}:${n}`)
    .join('|')
  if (seen.has(key)) return
  seen.add(key)
  const id = `salt_${cat.id}_${anKey.toLowerCase()}`
  const formulaUnicode = `${cationPart(cat, nCat)}${anionPart(an, nAn)}`
  out.push({
    id,
    category: 'salt',
    nameRu: `${an.noun} ${cat.genitive}`,
    formulaUnicode,
    composition,
    descriptionRu: saltDescriptionRu(id, cat, anKey),
    ...(anKey === 'Cr2O7' || anKey === 'CrO4' ? { accentColor: '#e85a28' } : {}),
    ...(anKey === 'MnO4' ? { accentColor: '#e040a0' } : {}),
  })
}

function generateSalts(): RawCompoundDef[] {
  const out: RawCompoundDef[] = []
  const seen = new Set<string>()

  const anionMinus1 = ['Cl', 'Br', 'I', 'F', 'NO2', 'NO3', 'MnO4', 'ClO3', 'ClO4'] as const
  const anionMinus2 = ['SO4', 'SO3', 'CO3', 'S', 'SiO3', 'CrO4', 'Cr2O7'] as const
  const anionMinus3 = ['PO4'] as const

  for (const cat of CATIONS_MONO) {
    if (cat.charge === 1) {
      for (const ak of anionMinus1) addSalt(out, seen, cat, ak)
      for (const ak of anionMinus2) addSalt(out, seen, cat, ak)
    }
    if (cat.charge === 2) {
      for (const ak of anionMinus2) addSalt(out, seen, cat, ak)
      for (const ak of anionMinus1) addSalt(out, seen, cat, ak)
    }
    if (cat.charge === 3) {
      for (const ak of anionMinus3) addSalt(out, seen, cat, ak)
      for (const ak of anionMinus1) addSalt(out, seen, cat, ak)
      for (const ak of anionMinus2) addSalt(out, seen, cat, ak)
    }
  }

  // (NH₄)₃PO₄
  const nh4 = CATIONS_MONO.find((c) => c.id === 'nh4')!
  const po4 = ANIONS.PO4
  const compNh43po4 = mergeIonic({ comp: nh4.comp, charge: 1 }, { comp: po4.comp, charge: po4.charge })
  const kN = Object.entries(compNh43po4)
    .sort()
    .map(([a, b]) => `${a}:${b}`)
    .join('|')
  if (!seen.has(kN)) {
    seen.add(kN)
    out.push({
      id: 'salt_nh4_3_po4',
      category: 'salt',
      nameRu: 'Ортофосфат аммония',
      formulaUnicode: '(NH₄)₃PO₄',
      composition: compNh43po4,
      descriptionRu:
        'Ортофосфат аммония — соль, в которой катион аммония сочетается с фосфат-ионом в стехиометрии 3:1. В водном растворе проявляет свойства удобрения и буфера по отношению к кислотам и основаниям. В школьном курсе его упоминают рядом с фосфорными удобрениями и с биохимической ролью фосфатов; в лаборатории применяют как реагент средней растворимости и для демонстрации состава сложной соли.',
    })
  }

  // Гидрокарбонаты + важные соли
  const specials: RawCompoundDef[] = [
    {
      id: 'salt_nahco3',
      category: 'salt',
      nameRu: 'Гидрокарбонат натрия',
      formulaUnicode: 'NaHCO₃',
      composition: { Na: 1, H: 1, C: 1, O: 3 },
      descriptionRu:
        'Пищевая сода — белый порошок, кристаллическая кислая соль угольной кислоты. В кулинарии даёт подъём тесту за счёт выделения CO₂ при нагревании или в контакте с кислотой. В быту удаляет запахи и мягко чистит поверхности; на уроке химии демонстрирует амфотерный характер ионов HCO₃⁻ и связь с жёсткостью воды.',
    },
    {
      id: 'salt_khco3',
      category: 'salt',
      nameRu: 'Гидрокарбонат калия',
      formulaUnicode: 'KHCO₃',
      composition: { K: 1, H: 1, C: 1, O: 3 },
      descriptionRu:
        'Гидрокарбонат калия хорошо растворим в воде и используется как мягкий регулятор кислотности в пищевой и фармацевтической промышленности. В аналитике и на занятиях его сравнивают с гидрокарбонатом натрия, обсуждая общие свойства ионов HCO₃⁻. В домашних условиях реже встречается, чем сода, но по химической роли близок к ней.',
    },
    {
      id: 'salt_ca_hco3_2',
      category: 'salt',
      nameRu: 'Гидрокарбонат кальция',
      formulaUnicode: 'Ca(HCO₃)₂',
      composition: { Ca: 1, H: 2, C: 2, O: 6 },
      descriptionRu:
        'Образуется в растворе при растворении карбоната кальция в воде, насыщенной углекислым газом; именно он отвечает за временную жёсткость водопроводной воды. При кипячении выпадает карбонат и освобождается CO₂ — классический бытовой и школьный опыт. В природе участвует в формировании карстовых пещер и сталактитов.',
    },
    {
      id: 'salt_k2cr2o7',
      category: 'salt',
      nameRu: 'Дихромат калия',
      formulaUnicode: 'K₂Cr₂O₇',
      composition: { K: 2, Cr: 2, O: 7 },
      accentColor: '#e85a28',
      synthesisLab: { needsHeat: false },
      synthesisConditionsRu: {
        temperature: 'Температура: обычно комнатная / слабый нагрев при упаривании раствора.',
        pressure: 'Давление: атмосферное; работа в вытяжке (Cr(VI) токсичен).',
        catalyst: 'Катализатор: не нужен. Среда: кислая (H₂SO₄) для перехода хромат ⇄ дихромат.',
      },
      laboratoryRecipeRu: 'Маршрут: 2K₂CrO₄ + H₂SO₄ → K₂Cr₂O₇ + K₂SO₄ + H₂O (не 4Cr+4K+7O₂)',
      descriptionRu:
        'Оранжево-красные кристаллы сильного окислителя на основе хрома(VI). Не получают прямым соединением K, Cr и O₂. В школе — окисление спиртов и ОВР в кислой среде; хранят отдельно от восстановителей. Токсичен, работать в вытяжке.',
    },
  ]
  for (const s of specials) {
    const k = Object.entries(s.composition)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([a, b]) => `${a}:${b}`)
      .join('|')
    if (!seen.has(k)) {
      seen.add(k)
      out.push(s)
    }
  }

  return out
}

const OXIDES: RawCompoundDef[] = [
  {
    id: 'co',
    category: 'oxide',
    nameRu: 'Угарный газ',
    formulaUnicode: 'CO',
    composition: { C: 1, O: 1 },
    descriptionRu:
      'Бесцветный ядовитый газ без запаха и вкуса, образуется при неполном горении органики и в работе двигателей. В организме связывается с гемоглобином сильнее кислорода; в быту опасен при утечке газа и плохой вентиляции. На уроке сравнивают с CO₂ и разбирают правила безопасности при горении.',
  },
  {
    id: 'so2',
    category: 'oxide',
    nameRu: 'Сернистый газ',
    formulaUnicode: 'SO₂',
    composition: { S: 1, O: 2 },
    descriptionRu:
      'Газ с резким «зажигалочным» запахом, хорошо растворяется в воде с образованием кислой среды. В промышленности идёт на получение серной кислоты; в качестве консерванта встречается в пищевой химии (в строго дозированных количествах). В школе демонстрируют растворимость, кислотные свойства и окислительно-восстановительную роль серы.',
  },
  {
    id: 'so3',
    category: 'oxide',
    nameRu: 'Серный ангидрид',
    formulaUnicode: 'SO₃',
    composition: { S: 1, O: 3 },
    synthesisLab: { needsHeat: true, needsCatalyst: true },
    synthesisConditionsRu: {
      temperature: 'Температура: контактный процесс ≈400–450 °C (окисление SO₂).',
      pressure: 'Давление: атмосферное или слегка повышенное (промышленность).',
      catalyst: 'Катализатор: V₂O₅ (контактный процесс) или Pt; без катализатора реакция крайне медленная.',
    },
    laboratoryRecipeRu:
      'Маршрут: S + O₂ → SO₂, затем 2SO₂ + O₂ ⇄ 2SO₃ (V₂O₅, 400–450 °C)',
    descriptionRu:
      'Сильный кислотный оксид, взаимодействует с водой с бурным выделением тепла и образованием серной кислоты. В технике — ключевое звено контактного процесса. Прямое горение серы даёт SO₂, а не SO₃. В лаборатории с ним работают крайне осторожно из-за дымности и агрессивности к коже и слизистым.',
  },
  {
    id: 'no',
    category: 'oxide',
    nameRu: 'Оксид азота(II)',
    formulaUnicode: 'NO',
    composition: { N: 1, O: 1 },
    synthesisLab: { needsHeat: true },
    synthesisConditionsRu: {
      temperature:
        'Температура: N₂ + O₂ ⇄ 2NO — сильно эндотермична, >2000 °C или электрический разряд (молния). При комнатной температуре азот с кислородом не реагируют.',
      pressure: 'Давление: атмосферное (в атмосфере / дуге).',
      catalyst: 'Катализатор: не требуется; нужна высокая энергия.',
    },
    laboratoryRecipeRu: 'N₂ + O₂ ⇄ 2NO (>2000 °C или разряд)',
    descriptionRu:
      'Нейтральный газ, в воздухе быстро окисляется до NO₂ с окраской. В организме — сигнальная молекула; в технике — звено синтеза HNO₃. На занятиях: N₂+O₂ только при экстремальном нагреве/разряде, цепочка NO → NO₂ → HNO₃.',
  },
  {
    id: 'no2',
    category: 'oxide',
    nameRu: 'Оксид азота(IV)',
    formulaUnicode: 'NO₂',
    composition: { N: 1, O: 2 },
    laboratoryRecipeRu: 'Маршрут: 2NO + O₂ → 2NO₂',
    descriptionRu:
      'Красно-бурый токсичный газ с резким запахом, участвует в смоге и кислотных дождях. Получают окислением NO или действием конц. HNO₃ на медь. Не пишут прямое N₂+O₂ → NO₂. Изучают равновесие 2NO₂ ⇌ N₂O₄.',
  },
  {
    id: 'n2o',
    category: 'oxide',
    nameRu: 'Закись азота',
    formulaUnicode: 'N₂O',
    composition: { N: 2, O: 1 },
    laboratoryRecipeRu: 'Маршрут: NH₄NO₃ →(t°) N₂O + 2H₂O',
    descriptionRu:
      'Бесцветный газ со сладковатым запахом («веселящий газ»), компонент ингаляционного наркоза (только специалисты). Не получают прямым N₂+O₂. В курсе сравнивают с CO₂ и степень окисления азота +1.',
  },
  {
    id: 'n2o5',
    category: 'oxide',
    nameRu: 'Ангидрид азотной кислоты',
    formulaUnicode: 'N₂O₅',
    composition: { N: 2, O: 5 },
    laboratoryRecipeRu: 'Маршрут: 2HNO₃ + P₂O₅ → N₂O₅ + 2HPO₃ (не из N₂+O₂)',
    descriptionRu:
      'Белое гигроскопичное вещество, в воде даёт HNO₃. Никогда не образуется прямым соединением азота и кислорода. В лаборатории — обезвоживание конц. HNO₃ оксидом фосфора(V) или окисление NO₂ озоном.',
  },
  {
    id: 'p2o5',
    category: 'oxide',
    nameRu: 'Фосфорный ангидрид',
    formulaUnicode: 'P₂O₅',
    composition: { P: 2, O: 5 },
    synthesisLab: { needsHeat: true },
    synthesisConditionsRu: {
      temperature: 'Температура: горение фосфора — сильный нагрев / воспламенение.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
    },
    descriptionRu:
      'Сильный осушитель и кислотный оксид, бурно реагирует с водой: P₂O₅ + 3H₂O → 2H₃PO₄. Применяют для удаления воды. На уроке — удобрения и фосфорные кислоты.',
  },
  {
    id: 'sio2',
    category: 'oxide',
    nameRu: 'Диоксид кремния',
    formulaUnicode: 'SiO₂',
    composition: { Si: 1, O: 2 },
    synthesisLab: { needsHeat: true },
    synthesisConditionsRu: {
      temperature: 'Температура: Si + O₂ — сильный нагрев; молекулярный SiO₂ в газе только >2000 °C.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
    },
    descriptionRu:
      'Атомная решётка [SiO₄]ₙ (кварц, песок, стекло): каждый Si связан с 4 O, каждый O мостиковый. Это не молекула O=Si=O. Химически инертен к большинству кислот, кроме HF. С водой почти не реагирует.',
  },
  {
    id: 'li2o',
    category: 'oxide',
    nameRu: 'Оксид лития',
    formulaUnicode: 'Li₂O',
    composition: { Li: 2, O: 1 },
    synthesisLab: { needsHeat: true },
    synthesisConditionsRu: {
      temperature: 'Температура: 4Li + O₂ = 2Li₂O — воспламенение / нагрев >180–200 °C (не «комнатная»).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
    },
    descriptionRu:
      'Ионная решётка (антифлюорит: Li⁺, O²⁻), не молекула Li–O–Li. С водой даёт LiOH. Важен в аккумуляторах; в школе сравнивают с Na₂O и K₂O.',
  },
  {
    id: 'na2o',
    category: 'oxide',
    nameRu: 'Оксид натрия',
    formulaUnicode: 'Na₂O',
    composition: { Na: 2, O: 1 },
    synthesisLab: { needsHeat: true },
    synthesisConditionsRu: {
      temperature: 'Температура: окисление натрия — нагрев / контролируемое горение.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
    },
    descriptionRu:
      'Ионный оксид; с водой → NaOH. В чистом виде редко хранят из‑за гигроскопичности. Ряд Na → Na₂O → NaOH → соли.',
  },
  {
    id: 'k2o',
    category: 'oxide',
    nameRu: 'Оксид калия',
    formulaUnicode: 'K₂O',
    composition: { K: 2, O: 1 },
    synthesisLab: { needsHeat: true },
    synthesisConditionsRu: {
      temperature: 'Температура: окисление калия — нагрев / горение.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
    },
    descriptionRu:
      'Основной оксид калия, с водой образует KOH. В сельском хозяйстве калий — элемент питания; в классе сравнивают активность Na и K.',
  },
  {
    id: 'mgo',
    category: 'oxide',
    nameRu: 'Оксид магния',
    formulaUnicode: 'MgO',
    composition: { Mg: 1, O: 1 },
    synthesisLab: { needsHeat: true },
    synthesisConditionsRu: {
      temperature: 'Температура: 2Mg + O₂ = 2MgO — воспламенение / >600 °C, яркая вспышка (не комнатная).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
    },
    descriptionRu:
      'Ионная решётка типа NaCl (не молекула Mg–O). «Магнезия» — антацид и стройматериал. При комнатной температуре — лишь тонкая плёнка оксида; полное окисление — при горении ленты.',
  },
  {
    id: 'cao',
    category: 'oxide',
    nameRu: 'Оксид кальция',
    formulaUnicode: 'CaO',
    composition: { Ca: 1, O: 1 },
    synthesisLab: { needsHeat: true },
    synthesisConditionsRu: {
      temperature:
        'Температура: промышленно CaCO₃ →(900–1000 °C) CaO + CO₂; прямой 2Ca + O₂ — нагрев >300 °C (не комнатная).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
    },
    laboratoryRecipeRu: '2Ca + O₂ = 2CaO (нагрев >300 °C; пром.: CaCO₃ → CaO + CO₂)',
    descriptionRu:
      'Негашёная известь — ионная решётка типа NaCl (не молекула Ca–O). Бурно гасится водой. Промышленно — обжиг известняка 900–1000 °C. При комнатной температуре металл лишь медленно тускнеет.',
  },
  {
    id: 'bao',
    category: 'oxide',
    nameRu: 'Оксид бария',
    formulaUnicode: 'BaO',
    composition: { Ba: 1, O: 1 },
    synthesisLab: { needsHeat: true },
    synthesisConditionsRu: {
      temperature:
        'Температура: Ba в O₂ при ~500 °C чаще даёт пероксид BaO₂; чистый BaO — разложение BaO₂ (>800 °C) или BaCO₃ (t°).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
    },
    laboratoryRecipeRu: 'Маршрут: 2BaO₂ →(>800 °C) 2BaO + O₂ или BaCO₃ →(t°) BaO + CO₂',
    descriptionRu:
      'Сильный основной оксид → Ba(OH)₂ с водой. Токсичен. Горение Ba на воздухе часто даёт пероксид BaO₂, а не сразу BaO — важно для школьной точности.',
  },
  {
    id: 'sro',
    category: 'oxide',
    nameRu: 'Оксид стронция',
    formulaUnicode: 'SrO',
    composition: { Sr: 1, O: 1 },
    synthesisLab: { needsHeat: true },
    synthesisConditionsRu: {
      temperature: 'Температура: 2Sr + O₂ = 2SrO — воспламенение / 250–300 °C (не комнатная).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
    },
    descriptionRu:
      'Ионная решётка типа NaCl (не молекула Sr–O). С водой — щёлочь; в пиротехнике — красное пламя. При комнатной температуре — медленное окисление поверхности.',
  },
  {
    id: 'al2o3',
    category: 'oxide',
    nameRu: 'Оксид алюминия',
    formulaUnicode: 'Al₂O₃',
    composition: { Al: 2, O: 3 },
    synthesisLab: { needsHeat: true },
    synthesisConditionsRu: {
      temperature:
        'Температура: 4Al + 3O₂ = 2Al₂O₃ — сильный нагрев >600–700 °C или снятие защитной плёнки; не «комнатная».',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
    },
    laboratoryRecipeRu: '4Al + 3O₂ = 2Al₂O₃ (нагрев; защитная плёнка мешает при обычных условиях)',
    descriptionRu:
      'Корунд — атомно-ионная решётка (не линейная молекула O=Al–O–Al=O). Защитная оксидная плёнка блокирует окисление при обычных условиях. Амфотерный; абразив, керамика, алуминотермия.',
  },
  {
    id: 'feo',
    category: 'oxide',
    nameRu: 'Оксид железа(II)',
    formulaUnicode: 'FeO',
    composition: { Fe: 1, O: 1 },
    laboratoryRecipeRu: 'Маршрут: Fe₂O₃ + CO →(>570 °C) 2FeO + CO₂ (горение Fe даёт Fe₃O₄)',
    descriptionRu:
      'Закись железа неустойчива на воздухе. Горение железа даёт окалину Fe₃O₄, а не FeO. Чистый FeO — восстановлением Fe₂O₃ (>570 °C) или разложением оксалата в инертной атмосфере.',
  },
  {
    id: 'fe2o3',
    category: 'oxide',
    nameRu: 'Оксид железа(III)',
    formulaUnicode: 'Fe₂O₃',
    composition: { Fe: 2, O: 3 },
    synthesisLab: { needsHeat: true },
    synthesisConditionsRu: {
      temperature:
        'Температура: длительный обжиг / окисление порошка >400–500 °C; простое горение Fe → Fe₃O₄, не гематит.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
    },
    laboratoryRecipeRu: 'Маршрут: обжиг / 2Fe(OH)₃ → Fe₂O₃ + 3H₂O (искровое горение Fe → Fe₃O₄)',
    descriptionRu:
      'Гематит, охра, ржавчина. Решётка корундового типа (не линейная цепочка). Искровое горение железа даёт Fe₃O₄; Fe₂O₃ — при продолжительном окислении или прокаливании гидроксида.',
  },
  {
    id: 'fe3o4',
    category: 'oxide',
    nameRu: 'Оксид железа(II,III)',
    formulaUnicode: 'Fe₃O₄',
    composition: { Fe: 3, O: 4 },
    synthesisLab: { needsHeat: true },
    synthesisConditionsRu: {
      temperature: 'Температура: 3Fe + 2O₂ = Fe₃O₄ — воспламенение / сильный нагрев >500 °C.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
    },
    laboratoryRecipeRu: '3Fe + 2O₂ = Fe₃O₄ (горение / окалина)',
    descriptionRu:
      'Магнетит — шпинель FeIIFeIII₂O₄ (не линейная молекула). Важная руда и продукт горения железа. Fe при комнатной температуре не «сгорает» до оксида.',
  },
  {
    id: 'cuo',
    category: 'oxide',
    nameRu: 'Оксид меди(II)',
    formulaUnicode: 'CuO',
    composition: { Cu: 1, O: 1 },
    synthesisLab: { needsHeat: true },
    synthesisConditionsRu: {
      temperature: 'Температура: 2Cu + O₂ = 2CuO — нагрев >400–500 °C на воздухе (не комнатная).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
    },
    descriptionRu:
      'Чёрный порошок; решётка тенорита (не молекула Cu–O). Сухой O₂ при комнатной температуре почти не реагирует; с влагой/CO₂ — зелёная патина, не CuO. Окислитель в демонстрациях.',
  },
  {
    id: 'cu2o',
    category: 'oxide',
    nameRu: 'Оксид меди(I)',
    formulaUnicode: 'Cu₂O',
    composition: { Cu: 2, O: 1 },
    laboratoryRecipeRu: 'Маршрут: 4CuO →(>1020 °C) 2Cu₂O + O₂ или восстановление свежего Cu(OH)₂',
    descriptionRu:
      'Кирпично-красный куприт. При 400–500 °C медь даёт чёрный CuO, а не Cu₂O; оксид(I) — при >1000 °C / недостатке O₂ или восстановлением Cu(OH)₂ (проба Троммера).',
  },
  {
    id: 'zno',
    category: 'oxide',
    nameRu: 'Оксид цинка',
    formulaUnicode: 'ZnO',
    composition: { Zn: 1, O: 1 },
    synthesisLab: { needsHeat: true },
    synthesisConditionsRu: {
      temperature: 'Температура: 2Zn + O₂ → 2ZnO — сильный нагрев >500–600 °C, голубовато-белое пламя.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
    },
    descriptionRu:
      'Белый порошок (буква O, не цифра 0). При комнатной температуре — лишь медленная плёнка оксида. Амфотерный; в мазях, резине, косметике. В лаборатории — сжигание цинковой стружки.',
  },
  {
    id: 'ago',
    category: 'oxide',
    nameRu: 'Оксид серебра(I)',
    formulaUnicode: 'Ag₂O',
    composition: { Ag: 2, O: 1 },
    descriptionRu:
      'Тёмный нестойкий порошок, при нагревании распадается на серебро и кислород. Используют в миниэлементах и как мягкий окислитель. На уроке показывают разложение и связь с качественной реакцией на Ag⁺.',
  },
  {
    id: 'pbo',
    category: 'oxide',
    nameRu: 'Оксид свинца(II)',
    formulaUnicode: 'PbO',
    composition: { Pb: 1, O: 1 },
    descriptionRu:
      'Жёлтый или красный модификации «масикота» и «литаргия», применяли в стекле и глазури; сейчас ограничены из-за токсичности свинца. Амфотерный оксид. В школе подчёркивают меры предосторожности.',
  },
  {
    id: 'pbo2',
    category: 'oxide',
    nameRu: 'Оксид свинца(IV)',
    formulaUnicode: 'PbO₂',
    composition: { Pb: 1, O: 2 },
    descriptionRu:
      'Тёмный порошок сильного окислителя, входит в состав свинцовых аккумуляторов. В органическом синтезе окисляет спирты. На занятиях связывают с окислительно-восстановительной парой Pb⁴⁺/Pb²⁺.',
  },
  {
    id: 'mno2',
    category: 'oxide',
    nameRu: 'Оксид марганца(IV)',
    formulaUnicode: 'MnO₂',
    composition: { Mn: 1, O: 2 },
    descriptionRu:
      'Чёрный порошок-катализатор разложения перекиси водорода и окислитель в батарейках и сухих элементах. В органическом синтезе применяют для окислений. Классическая демонстрация «пена из перекиси».',
  },
  {
    id: 'cr2o3',
    category: 'oxide',
    nameRu: 'Оксид хрома(III)',
    formulaUnicode: 'Cr₂O₃',
    composition: { Cr: 2, O: 3 },
    descriptionRu:
      'Стойкий зелёный пигмент «хромовая зелень», используют в красках и полировке металла. Амфотерный оксид. В курсе связывают с CrO₃ и обсуждают разные степени окисления хрома.',
  },
  {
    id: 'cro3',
    category: 'oxide',
    nameRu: 'Триоксид хрома',
    formulaUnicode: 'CrO₃',
    composition: { Cr: 1, O: 3 },
    descriptionRu:
      'Красные гигроскопичные кристаллы сильного окислителя, даёт хромовую кислоту в воде. Токсичен и пожароопасен в смесях с органикой. В школе только краткие демонстрации с защитой и вытяжкой.',
  },
  {
    id: 'sno2',
    category: 'oxide',
    nameRu: 'Оксид олова(IV)',
    formulaUnicode: 'SnO₂',
    composition: { Sn: 1, O: 2 },
    descriptionRu:
      'Главная оловянная руда касситерит, проводник в электронике и катализатор. Белые эмали и керамика часто содержат SnO₂. На уроке сравнивают с SnO и обсуждают амфотерность олова.',
  },
  {
    id: 'h2o2',
    category: 'oxide',
    nameRu: 'Перекись водорода',
    formulaUnicode: 'H₂O₂',
    composition: { H: 2, O: 2 },
    descriptionRu:
      'Водный раствор применяют как антисептик и отбеливатель; концентрированная — сильный окислитель в промышленности. Разлагается на воду и кислород под действием катализаторов. Классические опыты с MnO₂ и с «кислородной» пеной.',
  },
  {
    id: 'li2o2',
    category: 'oxide',
    nameRu: 'Перекись лития',
    formulaUnicode: 'Li₂O₂',
    composition: { Li: 2, O: 2 },
    descriptionRu:
      'Пероксид лития используют в химии источников кислорода и в специальных поглотителей CO₂. Сильный окислитель и осушитель. В курсе сопоставляют с Na₂O₂ и с пероксид-ионом.',
  },
  {
    id: 'na2o2',
    category: 'oxide',
    nameRu: 'Перекись натрия',
    formulaUnicode: 'Na₂O₂',
    composition: { Na: 2, O: 2 },
    descriptionRu:
      'Жёлто-белый пероксид, бурно реагирует с водой с выделением кислорода и образованием щёлочи. Применяют как отбеливатель и компонент поглотителей. Опыт «горящая полынья» с фильтром.',
  },
  {
    id: 'clo2',
    category: 'oxide',
    nameRu: 'Диоксид хлора',
    formulaUnicode: 'ClO₂',
    composition: { Cl: 1, O: 2 },
    descriptionRu:
      'Жёлто-зелёный газ, сильный окислитель и дезинфектант для воды и поверхностей. В чистом виде взрывоопасен; на производстве разводят на месте. В школе изучают по уравнениям и правилам промышленной химии.',
  },
]

const ACIDS: RawCompoundDef[] = [
  {
    id: 'hcl',
    category: 'acid',
    nameRu: 'Соляная кислота',
    formulaUnicode: 'HCl',
    composition: { H: 1, Cl: 1 },
    descriptionRu:
      'Водный раствор хлороводорода — одна из самых сильных минеральных кислот, полностью диссоциирует в разбавленном виде. В промышленности нужна для очистки поверхностей металлов, синтеза солей и пищевой добавки (регулятор кислотности). В классе демонстрируют действие на индикаторы, металлы и карбонаты.',
  },
  {
    id: 'hbr',
    category: 'acid',
    nameRu: 'Бромоводородная кислота',
    formulaUnicode: 'HBr',
    composition: { H: 1, Br: 1 },
    descriptionRu:
      'Сильная кислота, по свойствам близка к соляной, но бромид-ион участвует в окислительно-восстановительных реакциях. Применяют в органическом синтезе и в аналитике. На уроке сравнивают активность галогенов и кислотного ряда.',
  },
  {
    id: 'hi',
    category: 'acid',
    nameRu: 'Йодоводородная кислота',
    formulaUnicode: 'HI',
    composition: { H: 1, I: 1 },
    descriptionRu:
      'Очень сильная кислота и восстановитель: йодид-ион легко отдаёт электроны. Используют в органическом синтезе и для восстановления оксидов. В школе обсуждают окислительные свойства концентрированной кислоты при нагревании.',
  },
  {
    id: 'hf',
    category: 'acid',
    nameRu: 'Плавиковая кислота',
    formulaUnicode: 'HF',
    composition: { H: 1, F: 1 },
    descriptionRu:
      'Слабая по степени диссоциации, но опасная из-за проникновения сквозь ткани и растворения кремнезёма в стекле и керамике. Применяют для травления стекла и пассивации металлов. Работают только в вытяжке с кальций-содержащей пастой при ожогах.',
  },
  {
    id: 'fes2',
    category: 'other',
    nameRu: 'Пирит (дисульфид железа)',
    formulaUnicode: 'FeS₂',
    composition: { Fe: 1, S: 2 },
    descriptionRu:
      '«Золото глупцов» — жёлтый минерал, важное сырьё для получения серной кислоты. При обжиге на воздухе: 4FeS₂ + 11O₂ → 2Fe₂O₃ + 8SO₂. В лаборатории из пирита или FeS получают H₂S; на уроке 9 класса связывают с промышленным циклом серы.',
  },
  {
    id: 'h2s',
    category: 'acid',
    nameRu: 'Сероводород',
    formulaUnicode: 'H₂S',
    composition: { H: 2, S: 1 },
    descriptionRu:
      'Газ с запахом тухлых яиц, слабая двухосновная кислота в воде, сильный яд для дыхания. В природе выделяется при гниении и в сероводородных источниках. На уроке получают из FeS и HCl, показывают качественную реакцию на S²⁻.',
  },
  {
    id: 'h2so4',
    category: 'acid',
    nameRu: 'Серная кислота',
    formulaUnicode: 'H₂SO₄',
    composition: { H: 2, S: 1, O: 4 },
    synthesisLab: { needsHeat: false },
    synthesisConditionsRu: {
      temperature: 'Температура: SO₃ + H₂O — сильный разогрев; в промышленности SO₃ поглощают в H₂SO₄.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен для гидратации SO₃; V₂O₅ (400–450 °C) — только для стадии 2SO₂ + O₂ ⇄ 2SO₃.',
    },
    laboratoryRecipeRu: 'Маршрут: SO₃ + H₂O → H₂SO₄ (после контактного процесса)',
    descriptionRu:
      'Король минеральных кислот: обезвоживает органику (обугливание сахара, бумаги), катализирует этерификацию и нитрование. В аккумуляторах, удобрениях и очистных средствах. Концентрированная — сильный окислитель; разбавленная — типичная сильная двухосновная кислота и электролит.',
  },
  {
    id: 'h2so3',
    category: 'acid',
    nameRu: 'Сернистая кислота',
    formulaUnicode: 'H₂SO₃',
    composition: { H: 2, S: 1, O: 3 },
    laboratoryRecipeRu: 'Маршрут: SO₂ + H₂O ⇄ H₂SO₃',
    descriptionRu:
      'Существует в основном в равновесии с растворённым SO₂; кислородом воздуха постепенно окисляется до серной кислоты (или сульфат-ионов SO₄²⁻). Используют как консервант и антисептик. На занятиях связывают с сернистым газом и отбеливанием шёлка.',
  },
  {
    id: 'hno3',
    category: 'acid',
    nameRu: 'Азотная кислота',
    formulaUnicode: 'HNO₃',
    composition: { H: 1, N: 1, O: 3 },
    synthesisLab: { needsCatalyst: true, needsHeat: true, needsPressure: true },
    synthesisConditionsRu: {
      temperature: 'Температура: окисление NH₃ на Pt–Rh ~800–900 °C; далее охлаждение и окисление NO → NO₂.',
      pressure: 'Давление: повышенное на стадии абсорбции NO₂ в воде.',
      catalyst: 'Катализатор: Pt–Rh сетка (процесс Оствальда); не «H₂+N₂+O₂ = HNO₃».',
    },
    laboratoryRecipeRu:
      'Маршрут Оствальда: 4NH₃+5O₂ → 4NO+6H₂O; 2NO+O₂ → 2NO₂; 4NO₂+O₂+2H₂O → 4HNO₃',
    descriptionRu:
      'Сильная кислота и окислитель, пассивирует алюминий и железо в концентрированном виде, растворяет медь с выделением NO₂. Нужна для удобрений, взрывчатых веществ и анализа. В классе — только в разбавленном виде и под контролем. Прямого синтеза из N₂, H₂ и O₂ нет.',
  },
  {
    id: 'hno2',
    category: 'acid',
    nameRu: 'Азотистая кислота',
    formulaUnicode: 'HNO₂',
    composition: { H: 1, N: 1, O: 2 },
    laboratoryRecipeRu: 'Маршрут: NaNO₂ + HCl → HNO₂ + NaCl (холод) или N₂O₃ + H₂O ⇄ 2HNO₂',
    descriptionRu:
      'Нестойкая слабая кислота: в свободном виде существует лишь в холодных разбавленных растворах; легко окисляется до азотной. Участвует в диазотировании. На уроке обсуждают NO₂⁻ и то, что прямой синтез из N₂+H₂+O₂ невозможен.',
  },
  {
    id: 'h3po4',
    category: 'acid',
    nameRu: 'Ортофосфорная кислота',
    formulaUnicode: 'H₃PO₄',
    composition: { H: 3, P: 1, O: 4 },
    laboratoryRecipeRu: 'Маршрут: P₂O₅ + 3H₂O → 2H₃PO₄ (после 4P+5O₂ → 2P₂O₅)',
    descriptionRu:
      'Трёхосновная кислота средней силы, пищевая добавка и компонент безазотных удобрений. Термический путь: горение P → P₂O₅, затем гидратация; промышленно — обработка фосфатов серной кислотой. Не получают прямым P+H₂+O₂ в один шаг.',
  },
  {
    id: 'h3po3',
    category: 'acid',
    nameRu: 'Фосфористая кислота',
    formulaUnicode: 'H₃PO₃',
    composition: { H: 3, P: 1, O: 3 },
    laboratoryRecipeRu: 'Маршрут: P₄O₆ + 6H₂O → 4H₃PO₃ или PCl₃ + 3H₂O → H₃PO₃ + 3HCl',
    descriptionRu:
      'Структура HPO(OH)₂: тетраэдр вокруг P (P=O, P–H, две P–OH). Фактически двухосновная из‑за связи P—H; восстановитель (P в +3). Не образуется прямым соединением P+H₂+O₂.',
  },
  {
    id: 'h2co3',
    category: 'acid',
    nameRu: 'Угольная кислота',
    formulaUnicode: 'H₂CO₃',
    composition: { H: 2, C: 1, O: 3 },
    laboratoryRecipeRu: 'Маршрут: CO₂ + H₂O ⇄ H₂CO₃',
    descriptionRu:
      'Нестойкая кислота в равновесии с CO₂ и водой; от неё зависят кислотность дождя и газированных напитков. Не образуется прямым C+H₂+O₂. На занятиях — побеление известковой воды и тление известняка.',
  },
  {
    id: 'h2sio3',
    category: 'acid',
    nameRu: 'Кремниевая кислота',
    formulaUnicode: 'H₂SiO₃',
    composition: { H: 2, Si: 1, O: 3 },
    laboratoryRecipeRu: 'Маршрут: Na₂SiO₃ + 2HCl → H₂SiO₃↓ + 2NaCl',
    descriptionRu:
      'Выпадает гелем при действии сильных кислот на растворимые силикаты. SiO₂ с водой почти не реагирует; прямого Si+H₂+O₂ → H₂SiO₃ нет. В школе — классическая реакция «стеклянного сада» / сосульки Na₂SiO₃ + HCl.',
  },
  {
    id: 'hclo4',
    category: 'acid',
    nameRu: 'Хлорная кислота',
    formulaUnicode: 'HClO₄',
    composition: { H: 1, Cl: 1, O: 4 },
    laboratoryRecipeRu: 'Маршрут: KClO₄ + H₂SO₄ → KHSO₄ + HClO₄',
    descriptionRu:
      'Одна из самых сильных кислот (Cl +7); концентрированные растворы и особенно ангидрид взрывоопасны с органикой. Не образуется смешением Cl₂+H₂+O₂. В школе — ряд кислородных кислот хлора и правила безопасности.',
  },
  {
    id: 'hclo3',
    category: 'acid',
    nameRu: 'Хлорноватая кислота',
    formulaUnicode: 'HClO₃',
    composition: { H: 1, Cl: 1, O: 3 },
    laboratoryRecipeRu: 'Маршрут: Ba(ClO₃)₂ + H₂SO₄ → BaSO₄↓ + 2HClO₃',
    descriptionRu:
      'Сильная кислота и окислитель (Cl +5); соли — хлораты — в пиротехнике и спичках. В чистом виде неустойчива. Не получают прямым Cl₂+H₂+O₂. Не путать с хлорной HClO₄ (Cl +7).',
  },
  {
    id: 'hclo',
    category: 'acid',
    nameRu: 'Хлорноватистая кислота',
    formulaUnicode: 'HClO',
    composition: { H: 1, Cl: 1, O: 1 },
    laboratoryRecipeRu: 'Маршрут: Cl₂ + H₂O ⇄ HClO + HCl (или Cl₂O + H₂O ⇄ 2HClO)',
    descriptionRu:
      'Слабая кислота (Cl +1), в растворе неустойчива; гипохлорит даёт отбеливающий эффект «Белизны». Не образуется смешением Cl₂+H₂+O₂. В курсе — ряд степеней окисления хлора от HCl до HClO₄.',
  },
  {
    id: 'hmno4',
    category: 'acid',
    nameRu: 'Марганцовая кислота',
    formulaUnicode: 'HMnO₄',
    composition: { H: 1, Mn: 1, O: 4 },
    laboratoryRecipeRu: 'Маршрут: Mn₂O₇ + H₂O → 2HMnO₄ или Ba(MnO₄)₂ + H₂SO₄ → BaSO₄↓ + 2HMnO₄',
    descriptionRu:
      'Сильная кислота и окислитель, даёт фиолетовые растворы MnO₄⁻. Не образуется из H₂+Mn+O₂. В школе чаще работают с KMnO₄; свободную кислоту получают из оксида Mn(VII) или перманганата бария.',
  },
  {
    id: 'h2cro4',
    category: 'acid',
    nameRu: 'Хромовая кислота',
    formulaUnicode: 'H₂CrO₄',
    composition: { H: 2, Cr: 1, O: 4 },
    laboratoryRecipeRu: 'Маршрут: CrO₃ + H₂O ⇄ H₂CrO₄',
    descriptionRu:
      'Жёлто-оранжевые растворы Cr(VI), сильный окислитель и компонент «хромовой смеси» (токсично). Получают растворением CrO₃ в воде или подкислением хроматов. Не из Cr+H₂+O₂ напрямую.',
  },
]

const BASES: RawCompoundDef[] = [
  {
    id: 'naoh',
    category: 'base',
    nameRu: 'Гидроксид натрия',
    formulaUnicode: 'NaOH',
    composition: { Na: 1, O: 1, H: 1 },
    descriptionRu:
      'Едкая щёлочь в виде гранул или раствора: сильное основание, разъедает органику и растворяет жиры. В быту в составе средств для прочистки труб; в промышленности — для мыла, бумаги и нефтехимии. На уроке стандартный титрант и реагент для получения солей.',
  },
  {
    id: 'koh',
    category: 'base',
    nameRu: 'Гидроксид калия',
    formulaUnicode: 'KOH',
    composition: { K: 1, O: 1, H: 1 },
    descriptionRu:
      'Щёлочь, близкая по силе к NaOH, но более гигроскопична; применяют в мыловарении и в производстве жидкого мыла. В лаборатории используют для сухих сред и поглощения CO₂. Сравнивают с NaOH по растворимости и пламенным окрашениям.',
  },
  {
    id: 'lioh',
    category: 'base',
    nameRu: 'Гидроксид лития',
    formulaUnicode: 'LiOH',
    composition: { Li: 1, O: 1, H: 1 },
    descriptionRu:
      'Сильное основание, входит в электролиты литиевых батарей и в поглотители CO₂ в космической технике. В медицине реже, чем NaOH. На занятиях помещают в ряд щелочных металлов и обсуждают тренд радиус-основность.',
  },
  {
    id: 'csoh',
    category: 'base',
    nameRu: 'Гидроксид цезия',
    formulaUnicode: 'CsOH',
    composition: { Cs: 1, O: 1, H: 1 },
    descriptionRu:
      'Одно из самых сильных типичных оснований среди гидроксидов щелочных металлов. В специальных катализаторах и в исследовательской химии. В школе иллюстрирует рост основности вниз по группе.',
  },
  {
    id: 'ba_oh_2',
    category: 'base',
    nameRu: 'Гидроксид бария',
    formulaUnicode: 'Ba(OH)₂',
    composition: { Ba: 1, O: 2, H: 2 },
    descriptionRu:
      'Сильное основание, даёт ядовитый Ba²⁺ в растворе; применяют в аналитике и для сушки газов. В пищевой промышленности — ограниченно как добавка. Качественная реакция с сульфат-ионом — белый BaSO₄.',
  },
  {
    id: 'ca_oh_2',
    category: 'base',
    nameRu: 'Гидроксид кальция',
    formulaUnicode: 'Ca(OH)₂',
    composition: { Ca: 1, O: 2, H: 2 },
    descriptionRu:
      'Гашёная известь — суспензия и раствор в строительстве, побелке и дезинфекции погребов. Малорастворим, но среда щёлочная. Классический опыт с фенолфталеином в «известковой воде».',
  },
  {
    id: 'sr_oh_2',
    category: 'base',
    nameRu: 'Гидроксид стронция',
    formulaUnicode: 'Sr(OH)₂',
    composition: { Sr: 1, O: 2, H: 2 },
    descriptionRu:
      'Сильное основание, в пиротехнике даёт красное пламя. В лаборатории реже NaOH, но важен для сравнения щёлочноземельных гидроксидов. Токсичность Sr²⁺ учитывают при работе.',
  },
  {
    id: 'mg_oh_2',
    category: 'base',
    nameRu: 'Гидроксид магния',
    formulaUnicode: 'Mg(OH)₂',
    composition: { Mg: 1, O: 2, H: 2 },
    descriptionRu:
      'Белый малорастворимый осадок, входит в суспензию «магнезии» как слабое слабительное и антацид. В морской воде участвует в балансе углерода. Получают из Mg²⁺ и щёлочи на уроке.',
  },
  {
    id: 'cu_oh_2',
    category: 'base',
    nameRu: 'Гидроксид меди(II)',
    formulaUnicode: 'Cu(OH)₂',
    composition: { Cu: 1, O: 2, H: 2 },
    descriptionRu:
      'Голубой осадок, при нагревании переходит в чёрный CuO; растворяется в кислотах и в концентрированной щёлочи (амфотерность). В пестицидах и как пигмент. Демонстрация комплексов [Cu(NH₃)₄]²⁺.',
  },
  {
    id: 'fe_oh_2',
    category: 'base',
    nameRu: 'Гидроксид железа(II)',
    formulaUnicode: 'Fe(OH)₂',
    composition: { Fe: 1, O: 2, H: 2 },
    descriptionRu:
      'Серо-зелёный осадок, быстро темнеет на воздухе из-за окисления до Fe(OH)₃. Показывает восстановительные свойства Fe²⁺. В природе — промежуточное звено коррозии железа.',
  },
  {
    id: 'fe_oh_3',
    category: 'base',
    nameRu: 'Гидроксид железа(III)',
    formulaUnicode: 'Fe(OH)₃',
    composition: { Fe: 1, O: 3, H: 3 },
    descriptionRu:
      'Бурый желеобразный осадок, основа ржавчины в присутствии кислорода и влаги. Используют как сорбент и пигмент. На уроке получают из Fe³⁺ и щёлочи, обсуждают гидролиз солей железа.',
  },
  {
    id: 'al_oh_3',
    category: 'base',
    nameRu: 'Гидроксид алюминия',
    formulaUnicode: 'Al(OH)₃',
    composition: { Al: 1, O: 3, H: 3 },
    descriptionRu:
      'Белый амфотерный гидроксид, реагирует с кислотами и с концентрированными щелочами. В медицине — антацид, в водоподготовке — коагулянт. Центральный пример амфотерности в школьном курсе.',
  },
  {
    id: 'zn_oh_2',
    category: 'base',
    nameRu: 'Гидроксид цинка',
    formulaUnicode: 'Zn(OH)₂',
    composition: { Zn: 1, O: 2, H: 2 },
    descriptionRu:
      'Белый амфотерный осадок, растворяется в избытке щёлочи с образованием цинкатов. В батарейках и пигментах. Сравнивают с Al(OH)₃ и демонстрируют растворение в NH₃·H₂O.',
  },
  {
    id: 'nh3',
    category: 'other',
    nameRu: 'Аммиак',
    formulaUnicode: 'NH₃',
    composition: { N: 1, H: 3 },
    descriptionRu:
      'Бесцветный газ с резким запахом, слабое основание в воде (NH₃·H₂O). Получают в лаборатории из NH₄Cl и Ca(OH)₂, в промышленности — реакцией Haber. Используют для удобрений, синтеза HNO₃ и качественных реакций на Cu²⁺.',
  },
  {
    id: 'nh3_h2o',
    category: 'base',
    nameRu: 'Гидроксид аммония (аммиак водный)',
    formulaUnicode: 'NH₃·H₂O',
    composition: { N: 1, H: 5, O: 1 },
    descriptionRu:
      'Водный раствор аммиака — слабое основание и комплексообразователь, резкий запах. В быту в чистящих средствах; в лаборатории — для качественных реакций и растворения Cu(OH)₂. Хранят в плотно закрытой посуде из-за летучести NH₃.',
  },
]

/** Все неорганические записи без ручной 3D-геометрии (H₂O, CO₂, NaCl добавляются отдельно). */
export const INORGANIC_RAW: RawCompoundDef[] = [...OXIDES, ...ACIDS, ...BASES, ...generateSalts()]
