/**
 * Уравнения уроков органической лаборатории: Kimyo 10, гл. II, § 2.6–2.24 (с. 55–102).
 * Источник — docs/textbook/g10-ch2-alkenes-dienes.md и g10-ch2-alkynes-arenes.md.
 * Записи — как в учебнике (структурные формулы, условия над стрелкой); опечатки учебника исправлены
 * и пояснены в подсказке («в учебнике …»). Подключается одной строкой-спредом в g10g11Equations.ts.
 */
import type { GradeEq } from './g10g11Equations'

type Tri = readonly [ru: string, en: string, uz: string]

function e(p: {
  id: string
  topic: Tri
  left: readonly string[]
  right: readonly string[]
  display?: string
  cond?: Tri | string
  hint: Tri
}): GradeEq {
  const cond = typeof p.cond === 'string' ? ([p.cond, p.cond, p.cond] as const) : p.cond
  return {
    id: p.id,
    grade: 'g10',
    topicRu: p.topic[0],
    topicEn: p.topic[1],
    topicUz: p.topic[2],
    left: p.left,
    right: p.right,
    displayRu: p.display ?? `${p.left.join(' + ')} → ${p.right.join(' + ')}`,
    ...(cond ? { conditionsRu: cond[0], conditionsEn: cond[1], conditionsUz: cond[2] } : {}),
    hintRu: p.hint[0],
    hintEn: p.hint[1],
    hintUz: p.hint[2],
  }
}

const CAT_T: Tri = ['кат., t', 'cat., t', 'kat., t']
const CAT: Tri = ['кат.', 'cat.', 'kat.']
const ALC_T: Tri = ['спирт. р-р, t', 'alcoholic soln., t', 'spirtli eritma, t']
const LIGHT: Tri = ['hv', 'hv', 'hv']

export const G10_CH2_EQUATIONS: readonly GradeEq[] = [
  // ——— § 2.6 Циклоалканы: дегидрирование (с. 55) ———
  e({
    id: 'g10-cyc-c6h12-dehydro',
    topic: ['Циклоалканы · дегидрирование', 'Cycloalkanes · dehydrogenation', 'Tsikloalkanlar · degidrogenlash'],
    left: ['C₆H₁₂'],
    right: ['C₆H₆', '3H₂'],
    cond: 'Pt, t',
    hint: [
      'Учебник, с. 55: циклогексан отдаёт три молекулы водорода и превращается в бензол — реакция, обратная гидрированию бензола (с. 54).',
      'Textbook p. 55: cyclohexane gives off three H₂ molecules and becomes benzene — the reverse of benzene hydrogenation (p. 54).',
      'Darslik, 55-bet: tsiklogeksan uchta H₂ molekulasini ajratib benzolga aylanadi — benzol gidrogenlanishiga (54-bet) teskari reaksiya.',
    ],
  }),

  // ——— § 2.8 Алкены: свойства и получение (с. 59–61) ———
  e({
    id: 'g10-ale-c2h4-h2',
    topic: ['Алкены · гидрирование', 'Alkenes · hydrogenation', 'Alkenlar · gidrogenlash'],
    left: ['CH₂=CH₂', 'H₂'],
    right: ['CH₃–CH₃'],
    cond: CAT,
    hint: [
      'Учебник, с. 59: водород присоединяется по двойной связи — этилен превращается в этан.',
      'Textbook p. 59: hydrogen adds across the double bond — ethylene becomes ethane.',
      'Darslik, 59-bet: vodorod qoʻsh bogʻ boʻyicha birikadi — etilen etanga aylanadi.',
    ],
  }),
  e({
    id: 'g10-ale-c2h4-br2',
    topic: ['Алкены · бромная вода', 'Alkenes · bromine water', 'Alkenlar · bromli suv'],
    left: ['CH₂=CH₂', 'Br₂'],
    right: ['CH₂Br–CH₂Br'],
    cond: ['бромная вода', 'bromine water', 'bromli suv'],
    hint: [
      'Учебник, с. 59 и 62 (опыт 2): бромная вода обесцвечивается — качественная реакция на двойную связь; получается 1,2-дибромэтан.',
      'Textbook pp. 59 and 62 (experiment 2): bromine water is decolourised — the test for a double bond; 1,2-dibromoethane forms.',
      'Darslik, 59 va 62-betlar (2-tajriba): bromli suv rangsizlanadi — qoʻsh bogʻga sifat reaksiyasi; 1,2-dibrometan hosil boʻladi.',
    ],
  }),
  e({
    id: 'g10-ale-c2h4-hbr',
    topic: ['Алкены · гидрогалогенирование', 'Alkenes · hydrohalogenation', 'Alkenlar · gidrogalogenlash'],
    left: ['CH₂=CH₂', 'HBr'],
    right: ['CH₃–CH₂Br'],
    hint: [
      'Учебник, с. 59: H и Br присоединяются к разным атомам C двойной связи — бромэтан.',
      'Textbook p. 59: H and Br add to the two carbons of the double bond — bromoethane.',
      'Darslik, 59-bet: H va Br qoʻsh bogʻning turli C atomlariga birikadi — brometan.',
    ],
  }),
  e({
    id: 'g10-ale-markovnikov',
    topic: ['Алкены · правило Марковникова', 'Alkenes · Markovnikov’s rule', 'Alkenlar · Markovnikov qoidasi'],
    left: ['CH₂=CH–CH₃', 'HBr'],
    right: ['CH₃–CH(Br)–CH₃'],
    hint: [
      'Учебник, с. 59: водород присоединяется к более гидрированному атому C (CH₂=), бром — к соседнему; получается 2-бромпропан.',
      'Textbook p. 59: hydrogen goes to the carbon that already has more H (CH₂=), bromine to its neighbour — 2-bromopropane.',
      'Darslik, 59-bet: vodorod koʻproq vodorodli C ga (CH₂=), brom qoʻshnisiga birikadi — 2-brompropan.',
    ],
  }),
  e({
    id: 'g10-ale-wagner',
    topic: ['Алкены · окисление (Вагнер)', 'Alkenes · oxidation (Wagner)', 'Alkenlar · oksidlanish (Vagner)'],
    left: ['3CH₂=CH₂', '4H₂O', '2KMnO₄'],
    right: ['3CH₂OH–CH₂OH', '2MnO₂↓', '2KOH'],
    hint: [
      'Учебник, с. 60: водный раствор KMnO₄ обесцвечивается, выпадает бурый MnO₂; этилен окисляется до этиленгликоля (этан-1,2-диола).',
      'Textbook p. 60: aqueous KMnO₄ is decolourised and brown MnO₂ precipitates; ethylene is oxidised to ethylene glycol (ethane-1,2-diol).',
      'Darslik, 60-bet: KMnO₄ ning suvli eritmasi rangsizlanadi, qoʻngʻir MnO₂ choʻkadi; etilen etilenglikolgacha (etan-1,2-diol) oksidlanadi.',
    ],
  }),
  e({
    id: 'g10-ale-pe',
    topic: ['Алкены · полимеризация', 'Alkenes · polymerization', 'Alkenlar · polimerlanish'],
    left: ['nCH₂=CH₂'],
    right: ['(–CH₂–CH₂–)ₙ'],
    hint: [
      'Учебник, с. 60: π-связи раскрываются, мономеры соединяются в цепь — полиэтилен; звено –CH₂–CH₂–.',
      'Textbook p. 60: π bonds open and monomers join into a chain — polyethylene; the repeating unit is –CH₂–CH₂–.',
      'Darslik, 60-bet: π-bogʻlar ochilib, monomerlar zanjirga birikadi — polietilen; zveno –CH₂–CH₂–.',
    ],
  }),
  e({
    id: 'g10-ale-etoh-dehydr',
    topic: ['Алкены · получение из спирта', 'Alkenes · from ethanol', 'Alkenlar · spirtdan olinishi'],
    left: ['C₂H₅OH'],
    right: ['C₂H₄', 'H₂O'],
    cond: ['t, H₂SO₄ (конц.)', 't, H₂SO₄ (conc.)', 't, H₂SO₄ (kons.)'],
    hint: [
      'Учебник, с. 60: концентрированная серная кислота отнимает воду от этанола — лабораторный способ получения этилена.',
      'Textbook p. 60: concentrated sulfuric acid removes water from ethanol — the lab method for ethylene.',
      'Darslik, 60-bet: konsentrlangan sulfat kislota etanoldan suvni tortib oladi — etilenning laboratoriyada olinishi.',
    ],
  }),
  e({
    id: 'g10-ale-ch4-c2h4',
    topic: ['Алкены · из метана', 'Alkenes · from methane', 'Alkenlar · metandan'],
    left: ['2CH₄'],
    right: ['C₂H₄', '2H₂'],
    cond: 't',
    hint: [
      'Учебник, с. 60: при нагревании две молекулы метана дают этилен и водород.',
      'Textbook p. 60: on heating, two methane molecules give ethylene and hydrogen.',
      'Darslik, 60-bet: qizdirilganda ikki metan molekulasi etilen va vodorod beradi.',
    ],
  }),
  e({
    id: 'g10-ale-c2h6-dehydro',
    topic: ['Алкены · дегидрирование этана', 'Alkenes · ethane dehydrogenation', 'Alkenlar · etan degidrogenlanishi'],
    left: ['C₂H₆'],
    right: ['C₂H₄', 'H₂'],
    cond: CAT_T,
    hint: [
      'Учебник, с. 60: отщепление водорода от этана — промышленный способ получения этилена.',
      'Textbook p. 60: removing hydrogen from ethane — an industrial route to ethylene.',
      'Darslik, 60-bet: etandan vodorod ajratish — etilenni sanoatda olish usuli.',
    ],
  }),
  e({
    id: 'g10-ale-zn',
    topic: ['Алкены · дигалогенпроизводное + Zn', 'Alkenes · dihalide + Zn', 'Alkenlar · digalogenli birikma + Zn'],
    left: ['CH₂Br–CHBr–CH₃', 'Zn'],
    right: ['CH₂=CH–CH₃', 'ZnBr₂'],
    hint: [
      'Учебник, с. 60: цинк отнимает два атома Br у соседних атомов C 1,2-дибромпропана — между ними возникает двойная связь.',
      'Textbook p. 60: zinc removes two Br atoms from neighbouring carbons of 1,2-dibromopropane — a double bond forms between them.',
      'Darslik, 60-bet: rux 1,2-dibrompropanning qoʻshni C atomlaridan ikki Br ni tortib oladi — ular orasida qoʻsh bogʻ hosil boʻladi.',
    ],
  }),
  e({
    id: 'g10-ale-c3h7cl-koh',
    topic: ['Алкены · дегидрогалогенирование', 'Alkenes · dehydrohalogenation', 'Alkenlar · degidrogalogenlash'],
    left: ['C₃H₇Cl', 'KOH'],
    right: ['C₃H₆', 'KCl', 'H₂O'],
    cond: ['спирт. р-р', 'alcoholic soln.', 'spirtli eritma'],
    hint: [
      'Учебник, с. 60: спиртовой (не водный!) раствор щёлочи отщепляет HCl от хлорпропана — получается пропен.',
      'Textbook p. 60: an alcoholic (not aqueous!) alkali solution removes HCl from chloropropane — propene forms.',
      'Darslik, 60-bet: ishqorning spirtli (suvli emas!) eritmasi xlorpropandan HCl ni ajratadi — propen hosil boʻladi.',
    ],
  }),
  e({
    id: 'g10-ale-s61-hcl',
    topic: ['Этилен · схема с. 61: хлорэтан', 'Ethylene · p. 61 scheme: chloroethane', 'Etilen · 61-bet sxemasi: xloretan'],
    left: ['C₂H₄', 'HCl'],
    right: ['C₂H₅Cl'],
    hint: [
      'По схеме применения этилена (с. 61): в учебнике только стрелка «этилен → хлорэтан»; уравнение звена — присоединение HCl.',
      'From the ethylene uses scheme (p. 61): the textbook shows only the arrow “ethylene → chloroethane”; the step is HCl addition.',
      'Etilen qoʻllanilishi sxemasi boʻyicha (61-bet): darslikda faqat «etilen → xloretan» strelkasi; bosqich — HCl birikishi.',
    ],
  }),
  e({
    id: 'g10-ale-s61-h2o',
    topic: ['Этилен · схема с. 61: этанол', 'Ethylene · p. 61 scheme: ethanol', 'Etilen · 61-bet sxemasi: etanol'],
    left: ['C₂H₄', 'H₂O'],
    right: ['C₂H₅OH'],
    cond: ['H₃PO₄, t, p', 'H₃PO₄, t, p', 'H₃PO₄, t, p'],
    hint: [
      'По схеме с. 61: гидратация этилена — промышленный способ получения этанола.',
      'From the p. 61 scheme: hydration of ethylene — the industrial route to ethanol.',
      '61-bet sxemasi boʻyicha: etilen gidratlanishi — etanolni sanoatda olish usuli.',
    ],
  }),
  e({
    id: 'g10-ale-s61-cl2',
    topic: ['Этилен · схема с. 61: 1,2-дихлорэтан', 'Ethylene · p. 61 scheme: 1,2-dichloroethane', 'Etilen · 61-bet sxemasi: 1,2-dixloretan'],
    left: ['C₂H₄', 'Cl₂'],
    right: ['CH₂Cl–CH₂Cl'],
    hint: [
      'По схеме с. 61: хлор присоединяется по двойной связи — 1,2-дихлорэтан (растворитель).',
      'From the p. 61 scheme: chlorine adds across the double bond — 1,2-dichloroethane (a solvent).',
      '61-bet sxemasi boʻyicha: xlor qoʻsh bogʻ boʻyicha birikadi — 1,2-dixloretan (erituvchi).',
    ],
  }),
  e({
    id: 'g10-ale-s61-o2',
    topic: ['Этилен · схема с. 61: этиленоксид', 'Ethylene · p. 61 scheme: ethylene oxide', 'Etilen · 61-bet sxemasi: etilenoksid'],
    left: ['2C₂H₄', 'O₂'],
    right: ['2C₂H₄O'],
    cond: ['Ag, t', 'Ag, t', 'Ag, t'],
    hint: [
      'По схеме с. 61: на серебряном катализаторе этилен окисляется кислородом до этиленоксида (оксирана) — трёхчленного цикла C–C–O.',
      'From the p. 61 scheme: over a silver catalyst oxygen oxidises ethylene to ethylene oxide (oxirane) — a three-membered C–C–O ring.',
      '61-bet sxemasi boʻyicha: kumush katalizatorida etilen kislorod bilan etilenoksidgacha (oksiran) oksidlanadi — uch a’zoli C–C–O halqa.',
    ],
  }),
  e({
    id: 'g10-ale-kmno4-acid',
    topic: ['Алкены · KMnO₄ в кислой среде', 'Alkenes · acidic KMnO₄', 'Alkenlar · kislotali muhitda KMnO₄'],
    left: ['5C₂H₄', '12KMnO₄', '18H₂SO₄'],
    right: ['10CO₂', '6K₂SO₄', '12MnSO₄', '28H₂O'],
    hint: [
      'Учебник, с. 62 (опыт 3): подкисленный KMnO₄ обесцвечивается. Электронный баланс: 2C⁻² − 12e⁻ → 2C⁺⁴ (×5); Mn⁺⁷ + 5e⁻ → Mn⁺² (×12).',
      'Textbook p. 62 (experiment 3): acidified KMnO₄ is decolourised. Electron balance: 2C⁻² − 12e⁻ → 2C⁺⁴ (×5); Mn⁺⁷ + 5e⁻ → Mn⁺² (×12).',
      'Darslik, 62-bet (3-tajriba): kislotali KMnO₄ rangsizlanadi. Elektron balans: 2C⁻² − 12e⁻ → 2C⁺⁴ (×5); Mn⁺⁷ + 5e⁻ → Mn⁺² (×12).',
    ],
  }),

  // ——— § 2.11–2.12 Алкадиены и каучук (с. 66–70) ———
  e({
    id: 'g10-dien-lebedev',
    topic: ['Алкадиены · способ Лебедева', 'Alkadienes · Lebedev process', 'Alkadiyenlar · Lebedev usuli'],
    left: ['2CH₃CH₂OH'],
    right: ['CH₂=CH–CH=CH₂', 'H₂', '2H₂O'],
    cond: CAT_T,
    hint: [
      'Учебник, с. 66: из двух молекул этанола получается бутадиен-1,3 — одновременно отщепляются водород и вода.',
      'Textbook p. 66: two ethanol molecules give buta-1,3-diene — hydrogen and water are split off together.',
      'Darslik, 66-bet: ikki etanol molekulasidan butadiyen-1,3 olinadi — vodorod va suv birga ajraladi.',
    ],
  }),
  e({
    id: 'g10-dien-butane',
    topic: ['Алкадиены · из бутана', 'Alkadienes · from butane', 'Alkadiyenlar · butandan'],
    left: ['CH₃–CH₂–CH₂–CH₃'],
    right: ['CH₂=CH–CH=CH₂', '2H₂'],
    cond: CAT_T,
    hint: [
      'Учебник, с. 66: дегидрирование бутана — две молекулы H₂ уходят, образуются две двойные связи.',
      'Textbook p. 66: dehydrogenation of butane — two H₂ molecules leave and two double bonds form.',
      'Darslik, 66-bet: butanning degidrogenlanishi — ikki H₂ molekulasi ajraladi, ikki qoʻsh bogʻ hosil boʻladi.',
    ],
  }),
  e({
    id: 'g10-dien-br2-14',
    topic: ['Алкадиены · 1,4-присоединение', 'Alkadienes · 1,4-addition', 'Alkadiyenlar · 1,4-birikish'],
    left: ['CH₂=CH–CH=CH₂', 'Br₂'],
    right: ['CH₂Br–CH=CH–CH₂Br'],
    hint: [
      'Учебник, с. 66: атомы Br присоединяются к концам сопряжённой системы (C1 и C4), двойная связь переходит в середину — 1,4-дибромбутен-2 (1,4-дибромбут-2-ен).',
      'Textbook p. 66: Br atoms add to the ends of the conjugated system (C1 and C4) and the double bond moves to the middle — 1,4-dibromobut-2-ene.',
      'Darslik, 66-bet: Br atomlari tutash tizimning uchlariga (C1 va C4) birikadi, qoʻsh bogʻ oʻrtaga oʻtadi — 1,4-dibrombuten-2 (1,4-dibrombut-2-en).',
    ],
  }),
  e({
    id: 'g10-dien-br2-12',
    topic: ['Алкадиены · 1,2-присоединение', 'Alkadienes · 1,2-addition', 'Alkadiyenlar · 1,2-birikish'],
    left: ['CH₂=CH–CH=CH₂', 'Br₂'],
    right: ['CH₂Br–CHBr–CH=CH₂'],
    hint: [
      'Учебник, с. 66: бром присоединяется по одной двойной связи (C1 и C2), вторая остаётся — 3,4-дибромбутен-1 (3,4-дибромбут-1-ен).',
      'Textbook p. 66: bromine adds across one double bond (C1 and C2), the other stays — 3,4-dibromobut-1-ene.',
      'Darslik, 66-bet: brom bitta qoʻsh bogʻ boʻyicha (C1 va C2) birikadi, ikkinchisi qoladi — 3,4-dibrombuten-1 (3,4-dibrombut-1-en).',
    ],
  }),
  e({
    id: 'g10-dien-h2',
    topic: ['Алкадиены · гидрирование', 'Alkadienes · hydrogenation', 'Alkadiyenlar · gidrogenlash'],
    left: ['CH₂=CH–CH=CH₂', '2H₂'],
    right: ['CH₃–CH₂–CH₂–CH₃'],
    cond: CAT,
    hint: [
      'Учебник, с. 67: на каждую двойную связь — одна молекула H₂, мольное соотношение диен : H₂ = 1 : 2; получается бутан.',
      'Textbook p. 67: one H₂ per double bond, diene : H₂ = 1 : 2 by moles; butane forms.',
      'Darslik, 67-bet: har bir qoʻsh bogʻga bitta H₂, diyen : H₂ = 1 : 2 mol nisbati; butan hosil boʻladi.',
    ],
  }),
  e({
    id: 'g10-dien-c3h4-burn',
    topic: ['Алкадиены · горение', 'Alkadienes · combustion', 'Alkadiyenlar · yonish'],
    left: ['C₃H₄', '4O₂'],
    right: ['3CO₂', '2H₂O'],
    hint: [
      'Учебник, с. 67: общая схема для CₙH₂ₙ₋₂ — CₙH₂ₙ₋₂ + (1,5n − 0,5)O₂ → nCO₂ + (n − 1)H₂O; при n = 3: 4O₂, 3CO₂, 2H₂O.',
      'Textbook p. 67: the general scheme for CₙH₂ₙ₋₂ is CₙH₂ₙ₋₂ + (1.5n − 0.5)O₂ → nCO₂ + (n − 1)H₂O; for n = 3: 4O₂, 3CO₂, 2H₂O.',
      'Darslik, 67-bet: CₙH₂ₙ₋₂ uchun umumiy sxema — CₙH₂ₙ₋₂ + (1,5n − 0,5)O₂ → nCO₂ + (n − 1)H₂O; n = 3 da: 4O₂, 3CO₂, 2H₂O.',
    ],
  }),
  e({
    id: 'g10-dien-pbd',
    topic: ['Каучук · полибутадиен', 'Rubber · polybutadiene', 'Kauchuk · polibutadiyen'],
    left: ['nCH₂=CH–CH=CH₂'],
    right: ['(–CH₂–CH=CH–CH₂–)ₙ'],
    hint: [
      'Учебник, с. 66: бутадиен полимеризуется в 1,4-положения — в каждом звене остаётся одна двойная связь (в середине).',
      'Textbook p. 66: butadiene polymerises through positions 1,4 — each unit keeps one double bond (in the middle).',
      'Darslik, 66-bet: butadiyen 1,4-holatlar boʻyicha polimerlanadi — har bir zvenoda bitta qoʻsh bogʻ (oʻrtada) qoladi.',
    ],
  }),
  e({
    id: 'g10-dien-pbd-cis',
    topic: ['Каучук · цис-полибутадиен', 'Rubber · cis-polybutadiene', 'Kauchuk · sis-polibutadiyen'],
    left: ['nCH₂=CH–CH=CH₂'],
    right: ['(–CH₂–CH=CH–CH₂–)ₙ'],
    cond: ['C₄H₉Li', 'C₄H₉Li', 'C₄H₉Li'],
    hint: [
      'Учебник, с. 67: с бутиллитием полимеризация идёт стереорегулярно — все звенья в цис-форме (цис-1,4-полибутадиен).',
      'Textbook p. 67: with butyllithium the polymerization is stereoregular — every unit is cis (cis-1,4-polybutadiene).',
      'Darslik, 67-bet: butillitiy bilan polimerlanish stereoregulyar boradi — barcha zvenolar sis-shaklda (sis-1,4-polibutadiyen).',
    ],
  }),
  e({
    id: 'g10-dien-pip',
    topic: ['Каучук · полиизопрен', 'Rubber · polyisoprene', 'Kauchuk · poliizopren'],
    left: ['nCH₂=C(CH₃)–CH=CH₂'],
    right: ['(–CH₂–C(CH₃)=CH–CH₂–)ₙ'],
    hint: [
      'Учебник, с. 66: изопрен (2-метилбутадиен-1,3) даёт полиизопрен — по строению как натуральный каучук.',
      'Textbook p. 66: isoprene (2-methylbuta-1,3-diene) gives polyisoprene — structurally like natural rubber.',
      'Darslik, 66-bet: izopren (2-metilbutadiyen-1,3) poliizopren beradi — tuzilishi tabiiy kauchukka oʻxshaydi.',
    ],
  }),
  e({
    id: 'g10-dien-pip-70',
    topic: ['Каучук · стереорегулярный полиизопрен', 'Rubber · stereoregular polyisoprene', 'Kauchuk · stereoregulyar poliizopren'],
    left: ['nCH₂=C(CH₃)–CH=CH₂'],
    right: ['(–CH₂–C(CH₃)=CH–CH₂–)ₙ'],
    display: 'nCH₂=C(CH₃)–CH=CH₂ → [–CH₂–C(CH₃)=CH–CH₂–]ₙ',
    cond: ['металлоорганич. кат.', 'organometallic cat.', 'metallorganik kat.'],
    hint: [
      'Учебник, с. 70: на металлоорганических катализаторах получают цис-1,4-полиизопрен — синтетический аналог натурального каучука.',
      'Textbook p. 70: organometallic catalysts give cis-1,4-polyisoprene — a synthetic analogue of natural rubber.',
      'Darslik, 70-bet: metallorganik katalizatorlarda sis-1,4-poliizopren olinadi — tabiiy kauchukning sintetik oʻxshashi.',
    ],
  }),
  e({
    id: 'g10-dien-cr',
    topic: ['Каучук · хлоропреновый', 'Rubber · chloroprene', 'Kauchuk · xloropren'],
    left: ['nCH₂=C(Cl)–CH=CH₂'],
    right: ['(–CH₂–C(Cl)=CH–CH₂–)ₙ'],
    hint: [
      'Учебник, с. 66: 2-хлорбутадиен-1,3 (хлоропрен) полимеризуется в хлоропреновый каучук — стоек к бензину и маслам.',
      'Textbook p. 66: 2-chlorobuta-1,3-diene (chloroprene) polymerises into chloroprene rubber — resistant to petrol and oils.',
      'Darslik, 66-bet: 2-xlorbutadiyen-1,3 (xloropren) xloropren kauchukka polimerlanadi — benzin va moylarga chidamli.',
    ],
  }),
  e({
    id: 'g10-dien-cr-70',
    topic: ['Каучук · стереорегулярный хлоропреновый', 'Rubber · stereoregular chloroprene', 'Kauchuk · stereoregulyar xloropren'],
    left: ['nCH₂=C(Cl)–CH=CH₂'],
    right: ['(–CH₂–C(Cl)=CH–CH₂–)ₙ'],
    display: 'nCH₂=C(Cl)–CH=CH₂ → [–CH₂–C(Cl)=CH–CH₂–]ₙ',
    cond: ['металлоорганич. кат.', 'organometallic cat.', 'metallorganik kat.'],
    hint: [
      'Учебник, с. 70: металлоорганический катализатор даёт стереорегулярный хлоропреновый каучук.',
      'Textbook p. 70: an organometallic catalyst gives stereoregular chloroprene rubber.',
      'Darslik, 70-bet: metallorganik katalizator stereoregulyar xloropren kauchuk beradi.',
    ],
  }),
  e({
    id: 'g10-dien-sbr',
    topic: ['Каучук · бутадиен-стирольный', 'Rubber · styrene–butadiene', 'Kauchuk · butadiyen-stirol'],
    left: ['nCH₂=CH–CH=CH₂', 'nC₆H₅–CH=CH₂'],
    right: ['(–CH₂–CH=CH–CH₂–CH(C₆H₅)–CH₂–)ₙ'],
    hint: [
      'Учебник, с. 70: сополимеризация — в звене соединены остатки бутадиена и стирола; бутадиен-стирольный каучук идёт на шины.',
      'Textbook p. 70: copolymerization — each unit joins a butadiene and a styrene residue; styrene–butadiene rubber is used for tyres.',
      'Darslik, 70-bet: sopolimerlanish — zvenoda butadiyen va stirol qoldiqlari birikkan; butadiyen-stirol kauchuk shinalarga ishlatiladi.',
    ],
  }),

  // ——— § 2.14 Алкины: получение и свойства (с. 74–75) ———
  e({
    id: 'g10-alky-carbide',
    topic: ['Алкины · из карбида кальция', 'Alkynes · from calcium carbide', 'Alkinlar · kalsiy karbiddan'],
    left: ['CaC₂', '2H₂O'],
    right: ['HC≡CH', 'Ca(OH)₂'],
    hint: [
      'Учебник, с. 74: карбид кальция разлагается водой — лабораторный способ получения ацетилена.',
      'Textbook p. 74: water decomposes calcium carbide — the lab route to acetylene.',
      'Darslik, 74-bet: kalsiy karbid suv bilan parchalanadi — atsetilenni laboratoriyada olish usuli.',
    ],
  }),
  e({
    id: 'g10-alky-ch4',
    topic: ['Алкины · пиролиз метана', 'Alkynes · methane pyrolysis', 'Alkinlar · metan pirolizi'],
    left: ['2CH₄'],
    right: ['HC≡CH', '3H₂'],
    cond: '1500 °C',
    hint: [
      'Учебник, с. 74: при 1500 °C метан превращается в ацетилен и водород — промышленный способ.',
      'Textbook p. 74: at 1500 °C methane turns into acetylene and hydrogen — the industrial route.',
      'Darslik, 74-bet: 1500 °C da metan atsetilen va vodorodga aylanadi — sanoat usuli.',
    ],
  }),
  e({
    id: 'g10-alky-kucherov',
    topic: ['Алкины · реакция Кучерова', 'Alkynes · Kucherov reaction', 'Alkinlar · Kucherov reaksiyasi'],
    left: ['HC≡CH', 'H₂O'],
    right: ['CH₃–CHO'],
    cond: ['Hg²⁺', 'Hg²⁺', 'Hg²⁺'],
    hint: [
      'Учебник, с. 74: гидратация ацетилена в присутствии солей ртути(II) даёт уксусный альдегид (этаналь).',
      'Textbook p. 74: hydration of acetylene over mercury(II) salts gives acetaldehyde (ethanal).',
      'Darslik, 74-bet: simob(II) tuzlari ishtirokida atsetilen gidratlanishi sirka aldegidini (etanal) beradi.',
    ],
  }),
  e({
    id: 'g10-alky-trimer',
    topic: ['Алкины · тримеризация (Зелинский)', 'Alkynes · trimerization (Zelinsky)', 'Alkinlar · trimerlanish (Zelinskiy)'],
    left: ['3HC≡CH'],
    right: ['C₆H₆'],
    cond: ['C (акт.), t', 'C (activated), t', 'C (faol.), t'],
    hint: [
      'Учебник, с. 75: три молекулы ацетилена над активированным углём замыкаются в бензольное кольцо.',
      'Textbook p. 75: three acetylene molecules close into a benzene ring over activated carbon.',
      'Darslik, 75-bet: uchta atsetilen molekulasi faollashtirilgan koʻmir ustida benzol halqasiga tutashadi.',
    ],
  }),
  e({
    id: 'g10-alky-c3h4-burn',
    topic: ['Алкины · горение пропина', 'Alkynes · propyne combustion', 'Alkinlar · propin yonishi'],
    left: ['C₃H₄', '4O₂'],
    right: ['3CO₂', '2H₂O'],
    hint: [
      'Учебник, с. 75: общая схема CₙH₂ₙ₋₂ + (1,5n − 0,5)O₂ → nCO₂ + (n − 1)H₂O — та же, что у диенов (с. 67); пропин при n = 3.',
      'Textbook p. 75: the general scheme CₙH₂ₙ₋₂ + (1.5n − 0.5)O₂ → nCO₂ + (n − 1)H₂O is the same as for dienes (p. 67); propyne, n = 3.',
      'Darslik, 75-bet: umumiy sxema CₙH₂ₙ₋₂ + (1,5n − 0,5)O₂ → nCO₂ + (n − 1)H₂O — diyenlardagi bilan bir xil (67-bet); propin, n = 3.',
    ],
  }),
  e({
    id: 'g10-alky-c5h8-burn',
    topic: ['Алкины · горение C₅H₈', 'Alkynes · C₅H₈ combustion', 'Alkinlar · C₅H₈ yonishi'],
    left: ['C₅H₈', '7O₂'],
    right: ['5CO₂', '4H₂O'],
    hint: [
      'Учебник, с. 75: n = 5 → 1,5 · 5 − 0,5 = 7 молекул O₂, 5CO₂ и 4H₂O.',
      'Textbook p. 75: n = 5 → 1.5 · 5 − 0.5 = 7 O₂, 5CO₂ and 4H₂O.',
      'Darslik, 75-bet: n = 5 → 1,5 · 5 − 0,5 = 7 ta O₂, 5CO₂ va 4H₂O.',
    ],
  }),
  e({
    id: 'g10-alky-kmno4',
    topic: ['Алкины · окисление KMnO₄', 'Alkynes · KMnO₄ oxidation', 'Alkinlar · KMnO₄ bilan oksidlanish'],
    left: ['3CH≡CH', '8KMnO₄'],
    right: ['3KOOC–COOK', '8MnO₂↓', '2KOH', '2H₂O'],
    cond: ['нейтр./слабощел. среда', 'neutral/weakly alkaline', 'neytral/kuchsiz ishqoriy muhit'],
    hint: [
      'Учебник, с. 75: в учебнике опечатка «+ 2H₂» — должно быть 2H₂O, иначе не сходится кислород (32 атома слева). Продукт — оксалат калия.',
      'Textbook p. 75 misprints “+ 2H₂” — it must be 2H₂O, otherwise oxygen does not balance (32 atoms on the left). The product is potassium oxalate.',
      'Darslik, 75-bet: xato «+ 2H₂» — 2H₂O boʻlishi kerak, aks holda kislorod tenglashmaydi (chapda 32 atom). Mahsulot — kaliy oksalat.',
    ],
  }),

  // ——— § 2.16 Арены: получение и свойства (с. 79–80) ———
  e({
    id: 'g10-aren-c6h12-dehydro',
    topic: ['Арены · из циклогексана', 'Arenes · from cyclohexane', 'Arenlar · tsiklogeksandan'],
    left: ['C₆H₁₂'],
    right: ['C₆H₆', '3H₂'],
    cond: CAT_T,
    hint: [
      'Учебник, с. 79: дегидрирование циклогексана (как на с. 55) — один из способов получения бензола.',
      'Textbook p. 79: dehydrogenation of cyclohexane (as on p. 55) — one way to obtain benzene.',
      'Darslik, 79-bet: tsiklogeksan degidrogenlanishi (55-betdagidek) — benzol olish usullaridan biri.',
    ],
  }),
  e({
    id: 'g10-aren-toluene',
    topic: ['Арены · толуол из метилциклогексана', 'Arenes · toluene from methylcyclohexane', 'Arenlar · metiltsiklogeksandan toluol'],
    left: ['C₆H₁₁–CH₃'],
    right: ['C₆H₅–CH₃', '3H₂'],
    cond: CAT_T,
    hint: [
      'Учебник, с. 79: метилциклогексан отдаёт 3H₂ — кольцо становится ароматическим, получается толуол.',
      'Textbook p. 79: methylcyclohexane gives off 3H₂ — the ring becomes aromatic and toluene forms.',
      'Darslik, 79-bet: metiltsiklogeksan 3H₂ ajratadi — halqa aromatik boʻlib, toluol hosil boʻladi.',
    ],
  }),
  e({
    id: 'g10-aren-trimer',
    topic: ['Арены · бензол из ацетилена', 'Arenes · benzene from acetylene', 'Arenlar · atsetilendan benzol'],
    left: ['3HC≡CH'],
    right: ['C₆H₆'],
    cond: ['C, t', 'C, t', 'C, t'],
    hint: [
      'Учебник, с. 79: тримеризация ацетилена (реакция Зелинского, как на с. 75).',
      'Textbook p. 79: trimerization of acetylene (Zelinsky reaction, as on p. 75).',
      'Darslik, 79-bet: atsetilen trimerlanishi (Zelinskiy reaksiyasi, 75-betdagidek).',
    ],
  }),
  e({
    id: 'g10-aren-br2',
    topic: ['Арены · бромирование', 'Arenes · bromination', 'Arenlar · bromlash'],
    left: ['C₆H₆', 'Br₂'],
    right: ['C₆H₅Br', 'HBr'],
    cond: ['FeCl₃ (FeBr₃), t', 'FeCl₃ (FeBr₃), t', 'FeCl₃ (FeBr₃), t'],
    hint: [
      'Учебник, с. 79: бензол не обесцвечивает бромную воду; с катализатором идёт замещение H в кольце — бромбензол и HBr.',
      'Textbook p. 79: benzene does not decolourise bromine water; with a catalyst a ring H is substituted — bromobenzene and HBr.',
      'Darslik, 79-bet: benzol bromli suvni rangsizlantirmaydi; katalizator bilan halqadagi H almashinadi — brombenzol va HBr.',
    ],
  }),
  e({
    id: 'g10-aren-hno3',
    topic: ['Арены · нитрование', 'Arenes · nitration', 'Arenlar · nitrolash'],
    left: ['C₆H₆', 'HNO₃'],
    right: ['C₆H₅NO₂', 'H₂O'],
    cond: ['H₂SO₄ (конц.), t', 'H₂SO₄ (conc.), t', 'H₂SO₄ (kons.), t'],
    hint: [
      'Учебник, с. 79: нитрующая смесь (HNO₃ + H₂SO₄) замещает H кольца на группу –NO₂ — нитробензол.',
      'Textbook p. 79: the nitrating mixture (HNO₃ + H₂SO₄) replaces a ring H by –NO₂ — nitrobenzene.',
      'Darslik, 79-bet: nitrolovchi aralashma (HNO₃ + H₂SO₄) halqadagi H ni –NO₂ ga almashtiradi — nitrobenzol.',
    ],
  }),
  e({
    id: 'g10-aren-tnt',
    topic: ['Арены · нитрование толуола', 'Arenes · nitration of toluene', 'Arenlar · toluolni nitrolash'],
    left: ['C₆H₅–CH₃', '3HNO₃'],
    right: ['CH₃–C₆H₂(NO₂)₃', '3H₂O'],
    cond: ['H₂SO₄', 'H₂SO₄', 'H₂SO₄'],
    hint: [
      'Учебник, с. 80: метил облегчает замещение — сразу три группы –NO₂ в положениях 2, 4, 6: 2,4,6-тринитротолуол (тротил).',
      'Textbook p. 80: the methyl makes substitution easier — three –NO₂ groups enter positions 2, 4, 6: 2,4,6-trinitrotoluene (TNT).',
      'Darslik, 80-bet: metil oʻrin olishni osonlashtiradi — uchta –NO₂ guruhi 2, 4, 6-holatlarga kiradi: 2,4,6-trinitrotoluol (trotil).',
    ],
  }),
  e({
    id: 'g10-aren-tol-br3',
    topic: ['Арены · бромирование толуола', 'Arenes · bromination of toluene', 'Arenlar · toluolni bromlash'],
    left: ['C₆H₅–CH₃', '3Br₂'],
    right: ['CH₃–C₆H₂Br₃', '3HBr'],
    cond: ['FeBr₃', 'FeBr₃', 'FeBr₃'],
    hint: [
      'Учебник, с. 80: получается 2,4,6-трибромтолуол (2,4,6-трибром-1-метилбензол). В учебнике катализатор не указан — для замещения в кольце нужен FeBr₃.',
      'Textbook p. 80: 2,4,6-tribromotoluene (2,4,6-tribromo-1-methylbenzene) forms. The textbook gives no catalyst — ring substitution needs FeBr₃.',
      'Darslik, 80-bet: 2,4,6-tribromtoluol (2,4,6-tribrom-1-metilbenzol) hosil boʻladi. Darslikda katalizator koʻrsatilmagan — halqada oʻrin olish uchun FeBr₃ kerak.',
    ],
  }),
  e({
    id: 'g10-aren-tol-kmno4',
    topic: ['Арены · окисление толуола', 'Arenes · oxidation of toluene', 'Arenlar · toluol oksidlanishi'],
    left: ['5C₆H₅–CH₃', '6KMnO₄', '9H₂SO₄'],
    right: ['5C₆H₅–COOH', '6MnSO₄', '3K₂SO₄', '14H₂O'],
    hint: [
      'Учебник, с. 80: окисляется только боковая цепь (CH₃ → COOH), кольцо сохраняется — бензойная кислота. Бензол KMnO₄ не обесцвечивает.',
      'Textbook p. 80: only the side chain is oxidised (CH₃ → COOH), the ring survives — benzoic acid. Benzene does not decolourise KMnO₄.',
      'Darslik, 80-bet: faqat yon zanjir oksidlanadi (CH₃ → COOH), halqa saqlanadi — benzoy kislota. Benzol KMnO₄ ni rangsizlantirmaydi.',
    ],
  }),
  e({
    id: 'g10-aren-cl2-uv',
    topic: ['Арены · присоединение хлора', 'Arenes · chlorine addition', 'Arenlar · xlor birikishi'],
    left: ['C₆H₆', '3Cl₂'],
    right: ['C₆H₆Cl₆'],
    cond: ['УФ-свет', 'UV light', 'UB-nur'],
    hint: [
      'Учебник, с. 80: в жёстких условиях (УФ-свет) бензол присоединяет три молекулы Cl₂ — гексахлорциклогексан (гексахлоран).',
      'Textbook p. 80: under harsh conditions (UV light) benzene adds three Cl₂ molecules — hexachlorocyclohexane.',
      'Darslik, 80-bet: qattiq sharoitda (UB-nur) benzol uchta Cl₂ molekulasini biriktiradi — geksaxlortsiklogeksan (geksaxloran).',
    ],
  }),

  // ——— § 2.17 Стирол (с. 82–83) ———
  e({
    id: 'g10-sty-h2',
    topic: ['Стирол · гидрирование', 'Styrene · hydrogenation', 'Stirol · gidrogenlash'],
    left: ['C₆H₅–CH=CH₂', 'H₂'],
    right: ['C₆H₅–CH₂–CH₃'],
    cond: ['Ni', 'Ni', 'Ni'],
    hint: [
      'Учебник, с. 82: водород присоединяется по двойной связи винильной группы — этилбензол.',
      'Textbook p. 82: hydrogen adds across the vinyl double bond — ethylbenzene.',
      'Darslik, 82-bet: vodorod vinil guruhining qoʻsh bogʻi boʻyicha birikadi — etilbenzol.',
    ],
  }),
  e({
    id: 'g10-sty-cl2',
    topic: ['Стирол · галогенирование', 'Styrene · halogenation', 'Stirol · galogenlash'],
    left: ['C₆H₅–CH=CH₂', 'Cl₂'],
    right: ['C₆H₅–CHCl–CH₂Cl'],
    hint: [
      'Учебник, с. 82: хлор присоединяется по двойной связи — (1,2-дихлорэтил)бензол.',
      'Textbook p. 82: chlorine adds across the double bond — (1,2-dichloroethyl)benzene.',
      'Darslik, 82-bet: xlor qoʻsh bogʻ boʻyicha birikadi — (1,2-dixloretil)benzol.',
    ],
  }),
  e({
    id: 'g10-sty-hcl',
    topic: ['Стирол · гидрогалогенирование', 'Styrene · hydrohalogenation', 'Stirol · gidrogalogenlash'],
    left: ['C₆H₅–CH=CH₂', 'HCl'],
    right: ['C₆H₅–CHCl–CH₃'],
    hint: [
      'Учебник, с. 82: по правилу Марковникова H — к группе =CH₂, Cl — к атому C у кольца: (1-хлорэтил)бензол.',
      'Textbook p. 82: by Markovnikov’s rule H goes to =CH₂ and Cl to the carbon next to the ring: (1-chloroethyl)benzene.',
      'Darslik, 82-bet: Markovnikov qoidasi boʻyicha H — =CH₂ ga, Cl — halqa yonidagi C ga: (1-xloretil)benzol.',
    ],
  }),
  e({
    id: 'g10-sty-h2o',
    topic: ['Стирол · гидратация', 'Styrene · hydration', 'Stirol · gidratlanish'],
    left: ['C₆H₅–CH=CH₂', 'H₂O'],
    right: ['C₆H₅–CH(OH)–CH₃'],
    cond: ['H₂SO₄', 'H₂SO₄', 'H₂SO₄'],
    hint: [
      'Учебник, с. 82: вода присоединяется по Марковникову — 1-фенилэтанол (в учебнике «α-гидроксиэтилбензол»).',
      'Textbook p. 82: water adds by Markovnikov’s rule — 1-phenylethanol (the textbook calls it “α-hydroxyethylbenzene”).',
      'Darslik, 82-bet: suv Markovnikov qoidasi boʻyicha birikadi — 1-feniletanol (darslikda «α-gidroksietilbenzol»).',
    ],
  }),
  e({
    id: 'g10-sty-poly',
    topic: ['Стирол · полимеризация', 'Styrene · polymerization', 'Stirol · polimerlanish'],
    left: ['nC₆H₅–CH=CH₂'],
    right: ['(–CH(C₆H₅)–CH₂–)ₙ'],
    cond: CAT,
    hint: [
      'Учебник, с. 82: раскрывается двойная связь винильной группы — полистирол; фенильные группы — боковые.',
      'Textbook p. 82: the vinyl double bond opens — polystyrene; the phenyl groups hang off the chain.',
      'Darslik, 82-bet: vinil guruhining qoʻsh bogʻi ochiladi — polistirol; fenil guruhlari yon tomonda.',
    ],
  }),
  e({
    id: 'g10-sty-burn',
    topic: ['Стирол · горение', 'Styrene · combustion', 'Stirol · yonish'],
    left: ['C₆H₅–CH=CH₂', '10O₂'],
    right: ['8CO₂', '4H₂O'],
    cond: 't',
    hint: [
      'Учебник, с. 82: C₈H₈ сгорает до 8CO₂ и 4H₂O — нужно 16 + 4 = 20 атомов O, то есть 10O₂.',
      'Textbook p. 82: C₈H₈ burns to 8CO₂ and 4H₂O — 16 + 4 = 20 O atoms are needed, i.e. 10O₂.',
      'Darslik, 82-bet: C₈H₈ 8CO₂ va 4H₂O gacha yonadi — 16 + 4 = 20 ta O atomi, ya’ni 10O₂ kerak.',
    ],
  }),
  e({
    id: 'g10-sty-kmno4-acid',
    topic: ['Стирол · KMnO₄ в кислой среде', 'Styrene · acidic KMnO₄', 'Stirol · kislotali muhitda KMnO₄'],
    left: ['C₆H₅–CH=CH₂', '2KMnO₄', '3H₂SO₄'],
    right: ['C₆H₅–COOH', 'CO₂', '2MnSO₄', 'K₂SO₄', '4H₂O'],
    cond: 't',
    hint: [
      'Учебник, с. 82: винильная группа разрывается — бензойная кислота и CO₂. Электроны: винил отдаёт 4 + 6 = 10, два Mn⁺⁷ принимают 2 · 5 = 10.',
      'Textbook p. 82: the vinyl group is cleaved — benzoic acid and CO₂. Electrons: the vinyl gives 4 + 6 = 10, two Mn⁺⁷ take 2 · 5 = 10.',
      'Darslik, 82-bet: vinil guruhi uziladi — benzoy kislota va CO₂. Elektronlar: vinil 4 + 6 = 10 beradi, ikki Mn⁺⁷ 2 · 5 = 10 qabul qiladi.',
    ],
  }),
  e({
    id: 'g10-sty-kmno4-neutral',
    topic: ['Стирол · KMnO₄ в нейтральной среде', 'Styrene · neutral KMnO₄', 'Stirol · neytral muhitda KMnO₄'],
    left: ['3C₆H₅–CH=CH₂', '10KMnO₄'],
    right: ['3C₆H₅–COOK', '3K₂CO₃', '10MnO₂', 'KOH', '4H₂O'],
    cond: 't',
    hint: [
      'Учебник, с. 83: в нейтральной среде вместо кислот образуются соли — бензоат калия и карбонат калия, выпадает MnO₂.',
      'Textbook p. 83: in neutral solution salts form instead of acids — potassium benzoate and potassium carbonate; MnO₂ precipitates.',
      'Darslik, 83-bet: neytral muhitda kislotalar oʻrniga tuzlar — kaliy benzoat va kaliy karbonat hosil boʻladi, MnO₂ choʻkadi.',
    ],
  }),
  e({
    id: 'g10-sty-kmno4-cold',
    topic: ['Стирол · мягкое окисление', 'Styrene · mild oxidation', 'Stirol · yumshoq oksidlanish'],
    left: ['3C₆H₅–CH=CH₂', '2KMnO₄', '4H₂O'],
    right: ['3C₆H₅–CH(OH)–CH₂OH', '2MnO₂', '2KOH'],
    cond: '0 °C',
    hint: [
      'Учебник, с. 83: на холоду двойная связь не рвётся, а присоединяет две группы –OH — 1-фенилэтан-1,2-диол (как этиленгликоль из этилена).',
      'Textbook p. 83: in the cold the double bond is not cleaved but gains two –OH groups — 1-phenylethane-1,2-diol (like ethylene glycol from ethylene).',
      'Darslik, 83-bet: sovuqda qoʻsh bogʻ uzilmaydi, ikkita –OH guruhini biriktiradi — 1-feniletan-1,2-diol (etilendan etilenglikol kabi).',
    ],
  }),
  e({
    id: 'g10-sty-from-eb',
    topic: ['Стирол · из этилбензола', 'Styrene · from ethylbenzene', 'Stirol · etilbenzoldan'],
    left: ['C₆H₅–CH₂–CH₃'],
    right: ['C₆H₅–CH=CH₂', 'H₂'],
    cond: CAT_T,
    hint: [
      'Учебник, с. 83: в учебнике написано «гидрированием этилбензола» — верно дегидрированием: водород не присоединяется, а выделяется (H₂ в правой части).',
      'Textbook p. 83 says “by hydrogenation of ethylbenzene” — it is dehydrogenation: hydrogen is released, not added (H₂ on the right).',
      'Darslik, 83-bet: «etilbenzolni gidrogenlab» deyilgan — toʻgʻrisi degidrogenlab: vodorod birikmaydi, ajraladi (H₂ oʻng tomonda).',
    ],
  }),
  e({
    id: 'g10-sty-from-benzene',
    topic: ['Стирол · из бензола и ацетилена', 'Styrene · from benzene and acetylene', 'Stirol · benzol va atsetilendan'],
    left: ['C₆H₆', 'HC≡CH'],
    right: ['C₆H₅–CH=CH₂'],
    cond: ['AlCl₃, t', 'AlCl₃, t', 'AlCl₃, t'],
    hint: [
      'Учебник, с. 83: бензол присоединяется к ацетилену по одной из π-связей — получается винилбензол (стирол).',
      'Textbook p. 83: benzene adds to acetylene across one π bond — vinylbenzene (styrene) forms.',
      'Darslik, 83-bet: benzol atsetilenga bitta π-bogʻ boʻyicha birikadi — vinilbenzol (stirol) hosil boʻladi.',
    ],
  }),

  // ——— § 2.18 Природный газ: задачи (с. 87) ———
  e({
    id: 'g10-src-ch4-burn',
    topic: ['Природный газ · задача 1', 'Natural gas · task 1', 'Tabiiy gaz · 1-masala'],
    left: ['CH₄', '2O₂'],
    right: ['CO₂', '2H₂O'],
    hint: [
      'Учебник, с. 87, задача 1: 67,2 л O₂ (н. у.) = 67,2 : 22,4 = 3 моль → CO₂ вдвое меньше, 1,5 моль → m(CO₂) = 1,5 · 44 = 66 г.',
      'Textbook p. 87, task 1: 67.2 L O₂ (STP) = 67.2 : 22.4 = 3 mol → half as much CO₂, 1.5 mol → m(CO₂) = 1.5 · 44 = 66 g.',
      'Darslik, 87-bet, 1-masala: 67,2 l O₂ (n. sh.) = 67,2 : 22,4 = 3 mol → CO₂ ikki marta kam, 1,5 mol → m(CO₂) = 1,5 · 44 = 66 g.',
    ],
  }),
  e({
    id: 'g10-src-ch4-c2h2',
    topic: ['Природный газ · задача 2', 'Natural gas · task 2', 'Tabiiy gaz · 2-masala'],
    left: ['2CH₄'],
    right: ['HC≡CH', '3H₂'],
    cond: '1500 °C',
    hint: [
      'Учебник, с. 87, задача 2: по уравнению 2 моль CH₄ → 1 моль C₂H₂, значит из 6 моль метана — 3 моль ацетилена.',
      'Textbook p. 87, task 2: by the equation 2 mol CH₄ → 1 mol C₂H₂, so 6 mol of methane give 3 mol of acetylene.',
      'Darslik, 87-bet, 2-masala: tenglama boʻyicha 2 mol CH₄ → 1 mol C₂H₂, demak 6 mol metandan 3 mol atsetilen.',
    ],
  }),

  // ——— § 2.23 Обобщение: цепочка пропан → X₁ … X₅ (с. 101–102) ———
  e({
    id: 'g10-sum-x1',
    topic: ['Цепочка с. 101 · X₁', 'Chain p. 101 · X₁', '101-bet zanjiri · X₁'],
    left: ['CH₃–CH₂–CH₃', 'Br₂'],
    right: ['CH₃–CH(Br)–CH₃', 'HBr'],
    cond: LIGHT,
    hint: [
      'Учебник, с. 101: на свету бром замещает H у вторичного атома C — X₁ = 2-бромпропан.',
      'Textbook p. 101: in light bromine replaces an H on the secondary carbon — X₁ = 2-bromopropane.',
      'Darslik, 101-bet: yorugʻlikda brom ikkilamchi C dagi H ni almashtiradi — X₁ = 2-brompropan.',
    ],
  }),
  e({
    id: 'g10-sum-x2',
    topic: ['Цепочка с. 101 · X₂', 'Chain p. 101 · X₂', '101-bet zanjiri · X₂'],
    left: ['CH₃–CH(Br)–CH₃', 'NaOH'],
    right: ['CH₃–CH=CH₂', 'NaBr', 'H₂O'],
    cond: ['C₂H₅OH, t', 'C₂H₅OH, t', 'C₂H₅OH, t'],
    hint: [
      'Учебник, с. 101: спиртовой раствор щёлочи отщепляет HBr — X₂ = пропен. Над стрелкой в учебнике KOH, в уравнении NaOH — это равноценно.',
      'Textbook p. 101: alcoholic alkali removes HBr — X₂ = propene. The arrow shows KOH, the equation NaOH — either works.',
      'Darslik, 101-bet: ishqorning spirtli eritmasi HBr ni ajratadi — X₂ = propen. Strelka ustida KOH, tenglamada NaOH — farqi yoʻq.',
    ],
  }),
  e({
    id: 'g10-sum-x3',
    topic: ['Цепочка с. 101 · X₃', 'Chain p. 101 · X₃', '101-bet zanjiri · X₃'],
    left: ['CH₃–CH=CH₂', 'C₆H₆'],
    right: ['C₆H₅–CH(CH₃)₂'],
    cond: ['AlCl₃', 'AlCl₃', 'AlCl₃'],
    hint: [
      'Учебник, с. 101: пропен алкилирует бензол — X₃ = изопропилбензол (кумол).',
      'Textbook p. 101: propene alkylates benzene — X₃ = isopropylbenzene (cumene).',
      'Darslik, 101-bet: propen benzolni alkillaydi — X₃ = izopropilbenzol (kumol).',
    ],
  }),
  e({
    id: 'g10-sum-x4',
    topic: ['Цепочка с. 102 · X₄', 'Chain p. 102 · X₄', '102-bet zanjiri · X₄'],
    left: ['5C₆H₅–CH(CH₃)₂', '18KMnO₄', '27H₂SO₄'],
    right: ['5C₆H₅COOH', '10CO₂', '9K₂SO₄', '18MnSO₄', '42H₂O'],
    hint: [
      'Учебник, с. 102: боковая цепь окисляется до –COOH, два метила — до CO₂; X₄ = бензойная кислота. Электроны на молекулу: 4 + 7 + 7 = 18.',
      'Textbook p. 102: the side chain is oxidised to –COOH, the two methyls to CO₂; X₄ = benzoic acid. Electrons per molecule: 4 + 7 + 7 = 18.',
      'Darslik, 102-bet: yon zanjir –COOH gacha, ikki metil CO₂ gacha oksidlanadi; X₄ = benzoy kislota. Molekulaga elektronlar: 4 + 7 + 7 = 18.',
    ],
  }),
  e({
    id: 'g10-sum-x5',
    topic: ['Цепочка с. 102 · X₅', 'Chain p. 102 · X₅', '102-bet zanjiri · X₅'],
    left: ['C₆H₅–COOH', 'C₂H₅OH'],
    right: ['C₆H₅–COO–C₂H₅', 'H₂O'],
    cond: ['H₂SO₄ (конц.), t', 'H₂SO₄ (conc.), t', 'H₂SO₄ (kons.), t'],
    hint: [
      'Учебник, с. 102: X₅ = этилбензоат. В учебнике это названо «реакцией разложения», но кислота и спирт образуют сложный эфир и воду — это реакция этерификации.',
      'Textbook p. 102: X₅ = ethyl benzoate. The textbook calls it a “decomposition reaction”, but an acid and an alcohol give an ester and water — it is esterification.',
      'Darslik, 102-bet: X₅ = etilbenzoat. Darslikda «parchalanish reaksiyasi» deyilgan, lekin kislota va spirt murakkab efir va suv beradi — bu eterifikatsiya reaksiyasi.',
    ],
  }),

  // ——— § 2.23 Задание 1 (с. 102): цепочки превращений a)–d) ———
  e({
    id: 'g10-sum-a1',
    topic: ['Цепочка a) · CaCO₃ → CaO', 'Chain a) · CaCO₃ → CaO', 'a) zanjir · CaCO₃ → CaO'],
    left: ['CaCO₃'],
    right: ['CaO', 'CO₂'],
    cond: 't',
    hint: [
      'Учебник, с. 102, задание 1 a) и d): обжиг известняка.',
      'Textbook p. 102, task 1 a) and d): roasting limestone.',
      'Darslik, 102-bet, 1-topshiriq a) va d): ohaktoshni kuydirish.',
    ],
  }),
  e({
    id: 'g10-sum-a2',
    topic: ['Цепочка a) · CaO → CaC₂', 'Chain a) · CaO → CaC₂', 'a) zanjir · CaO → CaC₂'],
    left: ['CaO', '3C'],
    right: ['CaC₂', 'CO'],
    cond: 't',
    hint: [
      'Задание 1 a) и d): оксид кальция с коксом в электропечи даёт карбид кальция.',
      'Task 1 a) and d): calcium oxide with coke in an electric furnace gives calcium carbide.',
      '1-topshiriq a) va d): kalsiy oksid koks bilan elektr pechda kalsiy karbid beradi.',
    ],
  }),
  e({
    id: 'g10-sum-a3',
    topic: ['Цепочка a) · CaC₂ → C₂H₂', 'Chain a) · CaC₂ → C₂H₂', 'a) zanjir · CaC₂ → C₂H₂'],
    left: ['CaC₂', '2H₂O'],
    right: ['C₂H₂', 'Ca(OH)₂'],
    hint: [
      'Задание 1 a) и d): карбид кальция + вода → ацетилен (с. 74).',
      'Task 1 a) and d): calcium carbide + water → acetylene (p. 74).',
      '1-topshiriq a) va d): kalsiy karbid + suv → atsetilen (74-bet).',
    ],
  }),
  e({
    id: 'g10-sum-a4',
    topic: ['Цепочка a) · C₂H₂ → CH₃CHO', 'Chain a) · C₂H₂ → CH₃CHO', 'a) zanjir · C₂H₂ → CH₃CHO'],
    left: ['C₂H₂', 'H₂O'],
    right: ['CH₃CHO'],
    cond: ['Hg²⁺', 'Hg²⁺', 'Hg²⁺'],
    hint: [
      'Задание 1 a): реакция Кучерова — уксусный альдегид.',
      'Task 1 a): the Kucherov reaction — acetaldehyde.',
      '1-topshiriq a): Kucherov reaksiyasi — sirka aldegidi.',
    ],
  }),
  e({
    id: 'g10-sum-b1',
    topic: ['Цепочка b) · CH₄ → C₂H₂', 'Chain b) · CH₄ → C₂H₂', 'b) zanjir · CH₄ → C₂H₂'],
    left: ['2CH₄'],
    right: ['C₂H₂', '3H₂'],
    cond: '1500 °C',
    hint: [
      'Задание 1 b): пиролиз метана (с. 74).',
      'Task 1 b): methane pyrolysis (p. 74).',
      '1-topshiriq b): metan pirolizi (74-bet).',
    ],
  }),
  e({
    id: 'g10-sum-b2',
    topic: ['Цепочка b) · C₂H₂ → CH₂=CHCl', 'Chain b) · C₂H₂ → CH₂=CHCl', 'b) zanjir · C₂H₂ → CH₂=CHCl'],
    left: ['C₂H₂', 'HCl'],
    right: ['CH₂=CHCl'],
    cond: ['HgCl₂', 'HgCl₂', 'HgCl₂'],
    hint: [
      'Задание 1 b): к одной π-связи ацетилена присоединяется HCl — хлорвинил (винилхлорид).',
      'Task 1 b): HCl adds to one π bond of acetylene — vinyl chloride.',
      '1-topshiriq b): atsetilenning bitta π-bogʻiga HCl birikadi — xlorvinil (vinilxlorid).',
    ],
  }),
  e({
    id: 'g10-sum-b3',
    topic: ['Цепочка b) · поливинилхлорид', 'Chain b) · PVC', 'b) zanjir · polivinilxlorid'],
    left: ['nCH₂=CHCl'],
    right: ['(–CH₂–CHCl–)ₙ'],
    hint: [
      'Задание 1 b): полимеризация винилхлорида — поливинилхлорид (ПВХ).',
      'Task 1 b): polymerization of vinyl chloride — polyvinyl chloride (PVC).',
      '1-topshiriq b): vinilxlorid polimerlanishi — polivinilxlorid (PVX).',
    ],
  }),
  e({
    id: 'g10-sum-c1',
    topic: ['Цепочка c) · C₂H₆ → C₂H₅Cl', 'Chain c) · C₂H₆ → C₂H₅Cl', 'c) zanjir · C₂H₆ → C₂H₅Cl'],
    left: ['C₂H₆', 'Cl₂'],
    right: ['C₂H₅Cl', 'HCl'],
    cond: LIGHT,
    hint: [
      'Задание 1 c): радикальное хлорирование этана на свету.',
      'Task 1 c): radical chlorination of ethane in light.',
      '1-topshiriq c): yorugʻlikda etanning radikal xlorlanishi.',
    ],
  }),
  e({
    id: 'g10-sum-c2',
    topic: ['Цепочка c) · C₂H₅Cl → C₂H₄', 'Chain c) · C₂H₅Cl → C₂H₄', 'c) zanjir · C₂H₅Cl → C₂H₄'],
    left: ['C₂H₅Cl', 'KOH'],
    right: ['C₂H₄', 'KCl', 'H₂O'],
    cond: ALC_T,
    hint: [
      'Задание 1 c): спиртовой раствор KOH отщепляет HCl — этилен.',
      'Task 1 c): alcoholic KOH removes HCl — ethylene.',
      '1-topshiriq c): KOH ning spirtli eritmasi HCl ni ajratadi — etilen.',
    ],
  }),
  e({
    id: 'g10-sum-c3',
    topic: ['Цепочка c) · C₂H₄ → CH₂Cl–CH₂Cl', 'Chain c) · C₂H₄ → CH₂Cl–CH₂Cl', 'c) zanjir · C₂H₄ → CH₂Cl–CH₂Cl'],
    left: ['C₂H₄', 'Cl₂'],
    right: ['CH₂Cl–CH₂Cl'],
    hint: [
      'Задание 1 c): присоединение хлора — 1,2-дихлорэтан.',
      'Task 1 c): chlorine addition — 1,2-dichloroethane.',
      '1-topshiriq c): xlor birikishi — 1,2-dixloretan.',
    ],
  }),
  e({
    id: 'g10-sum-c4',
    topic: ['Цепочка c) · CH₂Cl–CH₂Cl → C₂H₂', 'Chain c) · CH₂Cl–CH₂Cl → C₂H₂', 'c) zanjir · CH₂Cl–CH₂Cl → C₂H₂'],
    left: ['CH₂Cl–CH₂Cl', '2KOH'],
    right: ['C₂H₂', '2KCl', '2H₂O'],
    cond: ALC_T,
    hint: [
      'Задание 1 c): избыток спиртовой щёлочи отщепляет две молекулы HCl — ацетилен.',
      'Task 1 c): excess alcoholic alkali removes two HCl molecules — acetylene.',
      '1-topshiriq c): ortiqcha spirtli ishqor ikki HCl molekulasini ajratadi — atsetilen.',
    ],
  }),
  e({
    id: 'g10-sum-d4',
    topic: ['Цепочка d) · C₂H₂ → C₂H₄', 'Chain d) · C₂H₂ → C₂H₄', 'd) zanjir · C₂H₂ → C₂H₄'],
    left: ['C₂H₂', 'H₂'],
    right: ['C₂H₄'],
    cond: ['Pd', 'Pd', 'Pd'],
    hint: [
      'Задание 1 d): первые три шага — как в цепочке a). На палладии ацетилен присоединяет одну молекулу H₂ — этилен.',
      'Task 1 d): the first three steps are as in chain a). Over palladium acetylene adds one H₂ — ethylene.',
      '1-topshiriq d): dastlabki uch bosqich — a) zanjirdagidek. Palladiyda atsetilen bitta H₂ biriktiradi — etilen.',
    ],
  }),
  e({
    id: 'g10-sum-d5',
    topic: ['Цепочка d) · C₂H₄ → C₂H₅Cl', 'Chain d) · C₂H₄ → C₂H₅Cl', 'd) zanjir · C₂H₄ → C₂H₅Cl'],
    left: ['C₂H₄', 'HCl'],
    right: ['C₂H₅Cl'],
    hint: [
      'Задание 1 d): присоединение HCl — хлорэтан.',
      'Task 1 d): HCl addition — chloroethane.',
      '1-topshiriq d): HCl birikishi — xloretan.',
    ],
  }),
  e({
    id: 'g10-sum-d6',
    topic: ['Цепочка d) · C₂H₅Cl → C₄H₁₀', 'Chain d) · C₂H₅Cl → C₄H₁₀', 'd) zanjir · C₂H₅Cl → C₄H₁₀'],
    left: ['2C₂H₅Cl', '2Na'],
    right: ['C₄H₁₀', '2NaCl'],
    hint: [
      'Задание 1 d): реакция Вюрца удваивает цепь — бутан.',
      'Task 1 d): the Wurtz reaction doubles the chain — butane.',
      '1-topshiriq d): Vyurts reaksiyasi zanjirni ikki barobar uzaytiradi — butan.',
    ],
  }),
  e({
    id: 'g10-sum-d7',
    topic: ['Цепочка d) · C₄H₁₀ → бутен', 'Chain d) · C₄H₁₀ → butene', 'd) zanjir · C₄H₁₀ → buten'],
    left: ['C₄H₁₀'],
    right: ['C₄H₈', 'H₂'],
    cond: CAT_T,
    hint: [
      'Задание 1 d): дегидрирование бутана — бутен. Ветвь «циклобутен» школьными реакциями из хлорэтана не получается — в задании она неоднозначна, уравнение не приводим.',
      'Task 1 d): dehydrogenation of butane — butene. The “cyclobutene” branch cannot be made from chloroethane by school reactions — it is ambiguous, so no equation is given.',
      '1-topshiriq d): butanning degidrogenlanishi — buten. «Tsiklobuten» tarmogʻini xloretandan maktab reaksiyalari bilan olib boʻlmaydi — u noaniq, tenglama keltirilmaydi.',
    ],
  }),
]
