/**
 * Тексты showcase CO₂ (C + O₂ → CO₂): подписи этапов панели, HUD-карточки фактов и 3D-подписи сцены (RU/EN/UZ).
 * Факты — Kimyo 8 (§ кристаллические решётки: в узлах молекулярной решётки — молекулы), Kimyo 9 (группа углерода:
 * невозбуждённое состояние s²p², возбуждённое s¹p³; валентность II и IV; CO₂, «сухой лёд»), справочник: C=O 1,16 Å,
 * ∠O=C=O 180°, ЭО(O) 3,44 − ЭО(C) 2,55 = 0,89, ΔH°f(CO₂) = −394 кДж/моль, возгонка сухого льда −78 °C.
 */
import type { ShowcaseTexts, Tri } from './index'

export const CO2_TEXTS: ShowcaseTexts = {
  stages: {
    reagents: {
      title: ['Реагенты: C и O₂', 'Reagents: C and O₂', 'Reagentlar: C va O₂'],
      main: [
        'Углерод — атом из угля или графита. Кислород — молекула O₂: двойная связь O=O, в ней одна σ-связь и одна π-связь.',
        'Carbon is an atom from coal or graphite. Oxygen is the O₂ molecule: a double bond O=O made of one σ bond and one π bond.',
        'Uglerod — koʻmir yoki grafitdan olingan atom. Kislorod — O₂ molekulasi: O=O qoʻsh bogʻ, unda bitta σ-bogʻ va bitta π-bogʻ.',
      ],
      sub: ['C + O₂ → CO₂ — горение угля.', 'C + O₂ → CO₂ — burning coal.', 'C + O₂ → CO₂ — koʻmirning yonishi.'],
    },
    break: {
      title: ['Поджиг', 'Ignition', 'Yondirish'],
      main: [
        'Поджигаем. При нагревании связь O=O разрывается, и два атома кислорода готовы соединиться с углеродом.',
        'We light it. On heating the O=O bond breaks, and the two oxygen atoms are ready to join the carbon.',
        'Yondiramiz. Qizdirilganda O=O bogʻ uziladi va ikki kislorod atomi uglerod bilan birikishga tayyor.',
      ],
      sub: ['Чтобы уголь загорелся, его нужно нагреть — потом реакция греет сама себя.', 'Coal needs heating to catch fire — then the reaction keeps itself hot.', 'Koʻmir yonishi uchun uni qizdirish kerak — keyin reaksiya oʻzini oʻzi isitadi.'],
    },
    approach: {
      title: ['Сближение', 'Approach', 'Yaqinlashish'],
      main: [
        'Атомы кислорода подходят к углероду с двух сторон. У каждого атома O — 6 валентных электронов, из них 2 неспаренных.',
        'The oxygen atoms come up to the carbon from both sides. Each O atom has 6 valence electrons, 2 of them unpaired.',
        'Kislorod atomlari uglerodga ikki tomondan yaqinlashadi. Har bir O atomida 6 ta valent elektron, shundan 2 tasi juftlashmagan.',
      ],
      sub: ['Углерод в основном состоянии: 2s²2p² — пока только 2 неспаренных электрона.', 'Carbon in its ground state: 2s²2p² — only 2 unpaired electrons so far.', 'Uglerod asosiy holatda: 2s²2p² — hozircha faqat 2 ta juftlashmagan elektron.'],
    },
    valence: {
      title: ['Возбуждение углерода', 'Carbon gets excited', 'Uglerodning qoʻzgʻalishi'],
      main: [
        'Один электрон с 2s-облака перескакивает на пустое 2p-облако: 2s²2p² → 2s¹2p³. Теперь у углерода 4 неспаренных электрона — валентность IV.',
        'One electron jumps from the 2s cloud to the empty 2p cloud: 2s²2p² → 2s¹2p³. Now carbon has 4 unpaired electrons — valence IV.',
        'Bitta elektron 2s-bulutdan boʻsh 2p-bulutga sakraydi: 2s²2p² → 2s¹2p³. Endi uglerodda 4 ta juftlashmagan elektron — valentlik IV.',
      ],
      sub: ['Поэтому углерод бывает двух- и четырёхвалентным; в CO₂ он четырёхвалентен.', 'That is why carbon can be di- or tetravalent; in CO₂ it is tetravalent.', 'Shuning uchun uglerod ikki va toʻrt valentli boʻladi; CO₂ da u toʻrt valentli.'],
    },
    pairs: {
      title: ['Две связи C=O', 'Two C=O bonds', 'Ikkita C=O bogʻ'],
      main: [
        'Каждая связь C=O — две общие пары: σ-пара образуется, когда облака перекрываются по линии между ядрами, π-пара — когда p-облака перекрываются сбоку, над и под осью.',
        'Each C=O bond is two shared pairs: the σ pair forms when the clouds overlap along the line between the nuclei, the π pair when p clouds overlap sideways, above and below the axis.',
        'Har bir C=O bogʻ — ikkita umumiy juft: σ-juft bulutlar yadrolar orasidagi chiziq boʻylab qoplanganda, π-juft esa p-bulutlar yon tomondan, oʻq ustida va ostida qoplanganda hosil boʻladi.',
      ],
      sub: ['Кислород электроотрицательнее (3,44 против 2,55): пары смещены к O — на нём δ−, на углероде δ+.', 'Oxygen is more electronegative (3.44 vs 2.55): the pairs shift to O — δ− on O, δ+ on carbon.', 'Kislorod elektrmanfiyroq (3,44 va 2,55): juftlar O tomon siljigan — unda δ−, uglerodda δ+.'],
    },
    bonds: {
      title: ['Связи и энергия', 'Bonds and energy', 'Bogʻlar va energiya'],
      main: [
        'Обе двойные связи готовы. При образовании связей энергия выделяется: на каждый моль CO₂ — 394 кДж тепла.',
        'Both double bonds are done. Forming bonds releases energy: 394 kJ of heat for every mole of CO₂.',
        'Ikkala qoʻsh bogʻ tayyor. Bogʻlar hosil boʻlganda energiya ajraladi: har bir mol CO₂ uchun 394 kJ issiqlik.',
      ],
      sub: ['Вот почему уголь — топливо: тепло горения греет дома и котлы электростанций.', 'That is why coal is a fuel: the heat of burning warms homes and power-station boilers.', 'Shuning uchun koʻmir — yoqilgʻi: yonish issiqligi uylarni va elektr stansiya qozonlarini isitadi.'],
    },
    assemble: {
      title: ['Линейная молекула', 'A linear molecule', 'Chiziqli molekula'],
      main: [
        'Молекула выпрямляется: угол O=C=O равен 180°, длина каждой связи C=O — 1,16 Å. Связи полярные, но два диполя направлены в противоположные стороны и гасят друг друга.',
        'The molecule straightens out: the O=C=O angle is 180°, each C=O bond is 1.16 Å long. The bonds are polar, but the two dipoles point in opposite directions and cancel each other.',
        'Molekula toʻgʻrilanadi: O=C=O burchagi 180°, har bir C=O bogʻ uzunligi 1,16 Å. Bogʻlar qutbli, lekin ikki dipol qarama-qarshi yoʻnalgan va bir-birini yoʻqotadi.',
      ],
      sub: ['Главное: связи полярные, а молекула CO₂ — неполярная.', 'Key point: the bonds are polar, but the CO₂ molecule is non-polar.', 'Asosiysi: bogʻlar qutbli, molekula CO₂ esa qutbsiz.'],
    },
    final: {
      title: ['Углекислый газ и сухой лёд', 'Carbon dioxide and dry ice', 'Karbonat angidrid va quruq muz'],
      main: [
        'Углекислый газ: молекулы свободно летают и поглощают инфракрасное излучение — это парниковый газ; растения берут CO₂ для фотосинтеза. При −78 °C CO₂ становится твёрдым «сухим льдом»: молекулы занимают узлы молекулярной кристаллической решётки.',
        'Carbon dioxide gas: the molecules fly freely and absorb infrared radiation — it is a greenhouse gas; plants take CO₂ for photosynthesis. At −78 °C CO₂ becomes solid “dry ice”: the molecules sit at the sites of a molecular crystal lattice.',
        'Karbonat angidrid gazi: molekulalar erkin uchadi va infraqizil nurlanishni yutadi — bu issiqxona gazi; oʻsimliklar CO₂ ni fotosintez uchun oladi. −78 °C da CO₂ qattiq «quruq muz»ga aylanadi: molekulalar molekulyar kristall panjara tugunlarini egallaydi.',
      ],
      sub: ['Сухой лёд не тает, а сразу испаряется — поэтому им охлаждают мороженое и делают «туман» на сцене.', 'Dry ice does not melt, it turns straight into gas — that is why it chills ice cream and makes stage “fog”.', 'Quruq muz erimaydi, toʻgʻridan-toʻgʻri gazga aylanadi — shuning uchun u bilan muzqaymoq sovitiladi va sahnada «tuman» yasaladi.'],
    },
  },
  hud: [
    {
      stage: 'reagents', from: 0.08, to: 1, title: ['Реагенты', 'Reagents', 'Reagentlar'],
      lines: [['C — атом (уголь, графит)', 'C — an atom (coal, graphite)', 'C — atom (koʻmir, grafit)'], ['O₂ — связь O=O: σ + π', 'O₂ — the O=O bond: σ + π', 'O₂ — O=O bogʻ: σ + π'], ['C + O₂ → CO₂', 'C + O₂ → CO₂', 'C + O₂ → CO₂']],
    },
    {
      stage: 'valence', from: 0.02, to: 0.42, title: ['Углерод: основное состояние', 'Carbon: ground state', 'Uglerod: asosiy holat'],
      lines: [['2s² 2p² — 2 неспаренных e⁻', '2s² 2p² — 2 unpaired e⁻', '2s² 2p² — 2 ta juftlashmagan e⁻'], ['валентность II', 'valence II', 'valentlik II']],
    },
    {
      stage: 'valence', from: 0.42, to: 1, title: ['Углерод: возбуждённое состояние', 'Carbon: excited state', 'Uglerod: qoʻzgʻalgan holat'],
      lines: [['2s¹ 2p³ — 4 неспаренных e⁻', '2s¹ 2p³ — 4 unpaired e⁻', '2s¹ 2p³ — 4 ta juftlashmagan e⁻'], ['валентность IV', 'valence IV', 'valentlik IV'], ['s и p смешиваются: два облака вдоль оси (sp)', 's and p mix: two clouds along the axis (sp)', 's va p aralashadi: oʻq boʻylab ikki bulut (sp)']],
      tone: 'check',
    },
    {
      stage: 'pairs', from: 0.04, to: 1, title: ['Связь C=O = σ + π', 'The C=O bond = σ + π', 'C=O bogʻ = σ + π'],
      lines: [['σ — перекрывание по оси', 'σ — overlap along the axis', 'σ — oʻq boʻylab qoplanish'], ['π — сбоку, над и под осью', 'π — sideways, above and below the axis', 'π — yon tomondan, oʻq ustida va ostida'], ['ΔЭО = 3,44 − 2,55 = 0,89 — полярные', 'ΔEN = 3.44 − 2.55 = 0.89 — polar', 'ΔEM = 3,44 − 2,55 = 0,89 — qutbli']],
    },
    {
      stage: 'bonds', from: 0.1, to: 1, title: ['Энергия', 'Energy', 'Energiya'],
      lines: [['C + O₂ → CO₂, ΔH = −394 кДж/моль', 'C + O₂ → CO₂, ΔH = −394 kJ/mol', 'C + O₂ → CO₂, ΔH = −394 kJ/mol'], ['горение угля — источник тепла', 'burning coal — a source of heat', 'koʻmir yonishi — issiqlik manbai']],
    },
    {
      stage: 'assemble', from: 0.05, to: 1, title: ['Геометрия', 'Geometry', 'Geometriya'],
      lines: [['O=C=O — линейная, 180°', 'O=C=O — linear, 180°', 'O=C=O — chiziqli, 180°'], ['C=O 1,16 Å', 'C=O 1.16 Å', 'C=O 1,16 Å'], ['диполи гасятся: молекула неполярная', 'the dipoles cancel: a non-polar molecule', 'dipollar yoʻqoladi: molekula qutbsiz']],
      tone: 'check',
    },
    {
      stage: 'final', from: 0.02, to: 0.46, title: ['Газ', 'Gas', 'Gaz'],
      lines: [['без цвета и запаха, тяжелее воздуха', 'colourless, odourless, heavier than air', 'rangsiz, hidsiz, havodan ogʻir'], ['поглощает ИК-излучение — парниковый газ', 'absorbs infrared — a greenhouse gas', 'infraqizil nurni yutadi — issiqxona gazi'], ['растения берут CO₂ для фотосинтеза', 'plants take CO₂ for photosynthesis', 'oʻsimliklar CO₂ ni fotosintez uchun oladi']],
    },
    {
      stage: 'final', from: 0.46, to: 0.9, title: ['Сухой лёд', 'Dry ice', 'Quruq muz'],
      lines: [['твёрдый CO₂ — молекулярная решётка', 'solid CO₂ — a molecular lattice', 'qattiq CO₂ — molekulyar panjara'], ['в узлах — молекулы CO₂', 'molecules of CO₂ at the sites', 'tugunlarda — CO₂ molekulalari'], ['−78 °C: испаряется, минуя жидкость', '−78 °C: turns to gas, skipping the liquid', '−78 °C: suyuqlikni chetlab bugʻlanadi']],
      tone: 'check',
    },
  ],
}

/** 3D-подписи сцены (Tag) — короткие. */
export const CO2_TAGS: Record<string, Tri> = {
  carbon: ['атом углерода — из угля, графита', 'carbon atom — from coal, graphite', 'uglerod atomi — koʻmir, grafitdan'],
  o2: ['O₂: σ + π', 'O₂: σ + π', 'O₂: σ + π'],
  sigma: ['σ', 'σ', 'σ'],
  pi: ['π', 'π', 'π'],
  ignite: ['поджиг: O=O рвётся', 'ignition: O=O breaks', 'yondirish: O=O uziladi'],
  twoUnpaired: ['2 неспаренных e⁻', '2 unpaired e⁻', '2 ta juftlashmagan e⁻'],
  ground: ['C: 2s²2p² — 2 неспаренных', 'C: 2s²2p² — 2 unpaired', 'C: 2s²2p² — 2 ta juftlashmagan'],
  jump: ['2s → 2p', '2s → 2p', '2s → 2p'],
  excited: ['возбуждённое состояние — 4 неспаренных e⁻', 'excited state — 4 unpaired e⁻', 'qoʻzgʻalgan holat — 4 ta juftlashmagan e⁻'],
  deltaPlus: ['δ+', 'δ+', 'δ+'],
  deltaMinus: ['δ−', 'δ−', 'δ−'],
  angle: ['180°', '180°', '180°'],
  length: ['C=O 1,16 Å', 'C=O 1.16 Å', 'C=O 1,16 Å'],
  heat: ['ΔH = −394 кДж/моль', 'ΔH = −394 kJ/mol', 'ΔH = −394 kJ/mol'],
  cancel: ['связи полярные, молекула — неполярная', 'polar bonds, non-polar molecule', 'bogʻlar qutbli, molekula — qutbsiz'],
  gas: ['газ: молекулы летают свободно', 'gas: molecules fly freely', 'gaz: molekulalar erkin uchadi'],
  dryIce: ['сухой лёд: молекулярная решётка', 'dry ice: a molecular lattice', 'quruq muz: molekulyar panjara'],
}
