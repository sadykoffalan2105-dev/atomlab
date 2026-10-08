/**
 * Тексты «Как образуется» в реакторе — три пути получения CO₂ (RU / EN / UZ). Химия — по Kimyo 7–9
 * и справочным данным (длины связей, углы, ΔH°). Подписи 3D (tags) короткие — до ~30 символов.
 */
import type { Tri } from '../geom'

export type RouteStageText = { title: Tri; main: Tri; sub?: Tri }
export type RouteHudText = { stage: string; from: number; to: number; title: Tri; lines: Tri[]; tone?: 'redox' | 'route' | 'check' }
export type RouteTexts = {
  title: Tri
  equation: string
  stages: Record<string, RouteStageText>
  hud: RouteHudText[]
  tags: Record<string, Tri>
}

const same = (s: string): Tri => [s, s, s]

export const ROUTE_UI = {
  heading: ['Как образуется CO₂', 'How CO₂ forms', 'CO₂ qanday hosil boʻladi'] as Tri,
  stage: ['Этап', 'Stage', 'Bosqich'] as Tri,
  pause: ['Пауза', 'Pause', 'Pauza'] as Tri,
  resume: ['Продолжить', 'Play', 'Davom etish'] as Tri,
  replay: ['Сначала', 'Replay', 'Boshidan'] as Tri,
  close: ['Закрыть', 'Close', 'Yopish'] as Tri,
  speed: ['Скорость', 'Speed', 'Tezlik'] as Tri,
  time: ['Время показа', 'Playback time', 'Koʻrsatish vaqti'] as Tri,
  prev: ['Предыдущий этап', 'Previous stage', 'Oldingi bosqich'] as Tri,
  next: ['Следующий этап', 'Next stage', 'Keyingi bosqich'] as Tri,
  facts: ['Факты', 'Facts', 'Faktlar'] as Tri,
  routes: ['Другие пути получения CO₂', 'Other ways to make CO₂', 'CO₂ olishning boshqa usullari'] as Tri,
  note: [
    'Модель: длины связей и углы — справочные, число частиц уменьшено. Крутите мышью или пальцем.',
    'Model: bond lengths and angles are reference values; the number of particles is reduced. Drag to rotate.',
    'Model: bogʻ uzunliklari va burchaklar maʼlumotnomadan, zarrachalar soni kamaytirilgan. Sichqoncha yoki barmoq bilan aylantiring.',
  ] as Tri,
}

export const ROUTE_TEXTS = {
  'co2-combustion': {
    title: ['Горение угля', 'Burning coal', 'Koʻmirning yonishi'],
    equation: 'C + O₂ → CO₂',
    stages: {
      reagents: {
        title: ['Уголь и кислород', 'Coal and oxygen', 'Koʻmir va kislorod'],
        main: [
          'Уголь — почти чистый углерод: слои атомов C, как в графите (C–C 142 пм). К краю слоя подлетает молекула O₂.',
          'Coal is almost pure carbon: layers of C atoms, as in graphite (C–C 142 pm). An O₂ molecule flies to the edge of the layer.',
          'Koʻmir deyarli toza ugleroddan iborat: grafitdagidek C atomlari qatlamlari (C–C 142 pm). Qatlam chetiga O₂ molekulasi uchib keladi.',
        ],
        sub: ['В молекуле O₂ двойная связь O=O (σ + π), 121 пм.', 'O₂ has a double bond O=O (σ + π), 121 pm.', 'O₂ molekulasida qoʻsh bogʻ O=O (σ + π), 121 pm.'],
      },
      ignite: {
        title: ['Поджиг', 'Ignition', 'Alangalantirish'],
        main: [
          'Холодный уголь не горит: нужна энергия активации. При нагревании атомы колеблются сильнее, и связь O=O рвётся.',
          'Cold coal does not burn: activation energy is needed. On heating the atoms vibrate harder and the O=O bond breaks.',
          'Sovuq koʻmir yonmaydi: faollanish energiyasi kerak. Qizdirilganda atomlar kuchliroq tebranadi va O=O bogʻi uziladi.',
        ],
        sub: ['Каждый атом O: 2s²2p⁴ — два неспаренных электрона.', 'Each O atom: 2s²2p⁴ — two unpaired electrons.', 'Har bir O atomi: 2s²2p⁴ — ikkita juftlashmagan elektron.'],
      },
      attack: {
        title: ['Кислород садится на углерод', 'Oxygen binds to carbon', 'Kislorod uglerodga birikadi'],
        main: [
          'Атомы O садятся на крайний атом углерода. Его связи C–C со слоем рвутся — атом C отрывается.',
          'The O atoms land on an edge carbon atom. Its C–C bonds to the layer break and the C atom is torn off.',
          'O atomlari chetdagi uglerod atomiga qoʻnadi. Uning qatlam bilan C–C bogʻlari uziladi — C atomi ajralib chiqadi.',
        ],
        sub: [
          'Горение начинается с края слоя: там у атомов C есть свободные валентности.',
          'Burning starts at the layer edge, where C atoms have free valences.',
          'Yonish qatlam chetidan boshlanadi: u yerda C atomlarida boʻsh valentliklar bor.',
        ],
      },
      transfer: {
        title: ['Смещение электронов: ОВР', 'Electron shift: a redox reaction', 'Elektronlar siljishi: OQR'],
        main: [
          'Кислород электроотрицательнее углерода, поэтому 4 валентных электрона C смещаются к атомам O. Углерод окисляется (C⁰ → C⁺⁴), кислород восстанавливается (O⁰ → O⁻²).',
          'Oxygen is more electronegative than carbon, so the 4 valence electrons of C shift toward the O atoms. Carbon is oxidized (C⁰ → C⁺⁴), oxygen is reduced (O⁰ → O⁻²).',
          'Kislorod ugleroddan elektromanfiyroq, shuning uchun C ning 4 ta valent elektroni O atomlari tomon siljiydi. Uglerod oksidlanadi (C⁰ → C⁺⁴), kislorod qaytariladi (O⁰ → O⁻²).',
        ],
        sub: [
          'C — восстановитель, O₂ — окислитель. Электроны не уходят совсем: связь ковалентная полярная.',
          'C is the reducing agent, O₂ the oxidizing agent. The electrons are not fully transferred: the bond is polar covalent.',
          'C — qaytaruvchi, O₂ — oksidlovchi. Elektronlar butunlay oʻtmaydi: bogʻ kovalent qutbli.',
        ],
      },
      bonds: {
        title: ['Две двойные связи C=O', 'Two C=O double bonds', 'Ikkita C=O qoʻsh bogʻi'],
        main: [
          'Четыре общие пары: в каждой связи C=O одна σ (по оси) и одна π (сбоку). Две π-связи взаимно перпендикулярны. Молекула линейная: 180°, C=O 116 пм.',
          'Four shared pairs: each C=O bond has one σ (along the axis) and one π (to the side). The two π bonds are perpendicular. The molecule is linear: 180°, C=O 116 pm.',
          'Toʻrtta umumiy juft: har bir C=O bogʻida bitta σ (oʻq boʻylab) va bitta π (yon tomonda). Ikki π-bogʻ oʻzaro perpendikulyar. Molekula chiziqli: 180°, C=O 116 pm.',
        ],
        sub: ['Образование связей выделяет энергию — вспышка света и тепла.', 'Bond formation releases energy — a flash of light and heat.', 'Bogʻlar hosil boʻlishida energiya ajraladi — yorugʻlik va issiqlik chaqnashi.'],
      },
      release: {
        title: ['Газ уходит, уголь горит дальше', 'The gas leaves, the coal keeps burning', 'Gaz chiqadi, koʻmir yonishda davom etadi'],
        main: [
          'CO₂ улетает газом. Выделенное тепло поджигает соседние атомы края — горение поддерживает само себя.',
          'CO₂ flies away as a gas. The released heat ignites the neighbouring edge atoms — burning sustains itself.',
          'CO₂ gaz holida uchib ketadi. Ajralgan issiqlik chetdagi qoʻshni atomlarni alangalantiradi — yonish oʻz-oʻzidan davom etadi.',
        ],
        sub: ['ΔH = −393,5 кДж/моль: реакция экзотермическая.', 'ΔH = −393.5 kJ/mol: the reaction is exothermic.', 'ΔH = −393,5 kJ/mol: reaksiya ekzotermik.'],
      },
      final: {
        title: ['Углекислый газ', 'Carbon dioxide', 'Karbonat angidrid'],
        main: [
          'O=C=O: линейная молекула. Связи полярные, но молекула неполярная — два диполя гасят друг друга.',
          'O=C=O: a linear molecule. The bonds are polar, but the molecule is nonpolar — the two dipoles cancel.',
          'O=C=O: chiziqli molekula. Bogʻlar qutbli, ammo molekula qutbsiz — ikki dipol bir-birini yoʻqqa chiqaradi.',
        ],
        sub: ['При недостатке кислорода образуется угарный газ: 2C + O₂ → 2CO.', 'With too little oxygen, carbon monoxide forms: 2C + O₂ → 2CO.', 'Kislorod yetishmaganda is gazi hosil boʻladi: 2C + O₂ → 2CO.'],
      },
    },
    hud: [
      { stage: 'reagents', from: 0.1, to: 1, tone: 'route', title: ['Горение угля', 'Burning coal', 'Koʻmirning yonishi'], lines: [same('C + O₂ →(t°) CO₂'), ['реакция соединения', 'combination reaction', 'birikish reaksiyasi']] },
      { stage: 'ignite', from: 0, to: 1, tone: 'route', title: ['Горение угля', 'Burning coal', 'Koʻmirning yonishi'], lines: [same('C + O₂ →(t°) CO₂'), ['нужен поджиг', 'ignition is needed', 'alangalantirish kerak']] },
      {
        stage: 'transfer',
        from: 0.15,
        to: 1,
        tone: 'redox',
        title: ['Электронный баланс', 'Electron balance', 'Elektron balans'],
        lines: [
          ['C⁰ − 4e⁻ → C⁺⁴ (окисление)', 'C⁰ − 4e⁻ → C⁺⁴ (oxidation)', 'C⁰ − 4e⁻ → C⁺⁴ (oksidlanish)'],
          ['O₂⁰ + 4e⁻ → 2O⁻² (восстановление)', 'O₂⁰ + 4e⁻ → 2O⁻² (reduction)', 'O₂⁰ + 4e⁻ → 2O⁻² (qaytarilish)'],
          ['C — восстановитель, O₂ — окислитель', 'C: reducing agent, O₂: oxidizing agent', 'C — qaytaruvchi, O₂ — oksidlovchi'],
        ],
      },
      { stage: 'bonds', from: 0, to: 1, tone: 'route', title: ['Связи', 'Bonds', 'Bogʻlar'], lines: [same('O=C=O'), ['2σ + 2π, 180°, 116 пм', '2σ + 2π, 180°, 116 pm', '2σ + 2π, 180°, 116 pm']] },
      { stage: 'release', from: 0, to: 1, tone: 'check', title: ['Энергия', 'Energy', 'Energiya'], lines: [['C + O₂ → CO₂ + 393,5 кДж', 'C + O₂ → CO₂ + 393.5 kJ', 'C + O₂ → CO₂ + 393,5 kJ'], ['ΔH = −393,5 кДж/моль', 'ΔH = −393.5 kJ/mol', 'ΔH = −393,5 kJ/mol']] },
      { stage: 'final', from: 0, to: 1, tone: 'check', title: ['Итог', 'Result', 'Natija'], lines: [same('C + O₂ → CO₂'), ['ОВР · соединение · экзотермическая', 'redox · combination · exothermic', 'OQR · birikish · ekzotermik']] },
    ],
    tags: {
      coal: ['уголь ≈ графит', 'coal ≈ graphite', 'koʻmir ≈ grafit'],
      o2: ['O₂: O=O, 121 пм', 'O₂: O=O, 121 pm', 'O₂: O=O, 121 pm'],
      ignite: ['поджиг: энергия активации', 'ignition: activation energy', 'faollanish energiyasi'],
      breakOO: ['O=O рвётся', 'O=O breaks', 'O=O uziladi'],
      tearOff: ['C–C рвутся', 'C–C bonds break', 'C–C bogʻlari uziladi'],
      c0: same('C⁰'),
      c4: same('C⁺⁴'),
      o0: same('O⁰'),
      om2: same('O⁻²'),
      reducer: ['восстановитель', 'reducing agent', 'qaytaruvchi'],
      oxidizer: ['окислитель', 'oxidizing agent', 'oksidlovchi'],
      shift: ['e⁻ смещаются к O', 'e⁻ shift toward O', 'e⁻ O tomon siljiydi'],
      sp: same('σ + π'),
      length: ['116 пм', '116 pm', '116 pm'],
      angle: same('180°'),
      heat: ['ΔH = −393,5 кДж/моль', 'ΔH = −393.5 kJ/mol', 'ΔH = −393,5 kJ/mol'],
      burn: ['соседи тоже горят', 'neighbours burn too', 'qoʻshnilar ham yonadi'],
      gas: same('CO₂ ↑'),
      co2: ['углекислый газ', 'carbon dioxide', 'karbonat angidrid'],
    },
  },

  'co2-acid': {
    title: ['Мрамор и соляная кислота', 'Marble and hydrochloric acid', 'Marmar va xlorid kislota'],
    equation: 'CaCO₃ + 2HCl → CaCl₂ + CO₂↑ + H₂O',
    stages: {
      reagents: {
        title: ['Мрамор и кислота', 'Marble and acid', 'Marmar va kislota'],
        main: [
          'Мрамор CaCO₃ — ионный кристалл из Ca²⁺ и CO₃²⁻. Карбонат-ион — плоский треугольник: 120°, C–O 129 пм. В растворе — молекулы HCl среди молекул воды.',
          'Marble, CaCO₃, is an ionic crystal of Ca²⁺ and CO₃²⁻. The carbonate ion is a flat triangle: 120°, C–O 129 pm. The solution holds HCl molecules among water molecules.',
          'Marmar CaCO₃ — Ca²⁺ va CO₃²⁻ ionlaridan tuzilgan ion kristall. Karbonat-ion — yassi uchburchak: 120°, C–O 129 pm. Eritmada suv molekulalari orasida HCl molekulalari bor.',
        ],
        sub: [
          'Палочки показывают одну из формул CO₃²⁻; на деле заряд 2− распределён по трём O, и все три связи одинаковые.',
          'The sticks show one formula of CO₃²⁻; in fact the 2− charge is spread over three O atoms and all three bonds are equal.',
          'Tayoqchalar CO₃²⁻ ning bitta formulasini koʻrsatadi; aslida 2− zaryad uchta O ga taqsimlangan va uchala bogʻ bir xil.',
        ],
      },
      dissociate: {
        title: ['HCl → H⁺ + Cl⁻', 'HCl → H⁺ + Cl⁻', 'HCl → H⁺ + Cl⁻'],
        main: [
          'В воде HCl распадается на ионы: общая пара электронов целиком уходит к хлору — он электроотрицательнее. Остаются ион H⁺ и ион Cl⁻.',
          'In water HCl splits into ions: the shared electron pair goes entirely to chlorine, which is more electronegative. An H⁺ ion and a Cl⁻ ion remain.',
          'Suvda HCl ionlarga ajraladi: umumiy elektron jufti butunlay xlorga oʻtadi — u elektromanfiyroq. H⁺ ioni va Cl⁻ ioni qoladi.',
        ],
        sub: [
          'Соляная кислота — сильная: ионы H⁺ (в воде — H₃O⁺) делают раствор кислым.',
          'Hydrochloric acid is strong: H⁺ ions (H₃O⁺ in water) make the solution acidic.',
          'Xlorid kislota — kuchli: H⁺ ionlari (suvda H₃O⁺) eritmani kislotali qiladi.',
        ],
      },
      protonate1: {
        title: ['Первый H⁺: HCO₃⁻', 'The first H⁺: HCO₃⁻', 'Birinchi H⁺: HCO₃⁻'],
        main: [
          'Ион H⁺ садится на неподелённую пару атома O карбонат-иона — получается гидрокарбонат-ион HCO₃⁻. Карбонат отрывается от кристалла, Ca²⁺ уходит в раствор.',
          'An H⁺ ion binds to a lone pair of an O atom of the carbonate ion, giving the hydrogen carbonate ion HCO₃⁻. The carbonate leaves the crystal and Ca²⁺ goes into solution.',
          'H⁺ ioni karbonat-ion O atomining boʻlinmagan juftiga birikadi — gidrokarbonat-ion HCO₃⁻ hosil boʻladi. Karbonat kristalldan ajraladi, Ca²⁺ eritmaga oʻtadi.',
        ],
        sub: [
          'Связь O–H образована парой электронов кислорода (донорно-акцепторный механизм).',
          'The O–H bond is formed by the oxygen’s electron pair (donor–acceptor mechanism).',
          'O–H bogʻi kislorodning elektron jufti hisobiga hosil boʻladi (donor-akseptor mexanizm).',
        ],
      },
      protonate2: {
        title: ['Второй H⁺: H₂CO₃', 'The second H⁺: H₂CO₃', 'Ikkinchi H⁺: H₂CO₃'],
        main: [
          'Второй ион H⁺ присоединяется к другому атому O — получается угольная кислота H₂CO₃. Это слабая и непрочная кислота.',
          'A second H⁺ ion attaches to another O atom, giving carbonic acid, H₂CO₃. It is a weak and unstable acid.',
          'Ikkinchi H⁺ ioni boshqa O atomiga birikadi — karbonat kislota H₂CO₃ hosil boʻladi. Bu kuchsiz va beqaror kislota.',
        ],
        sub: ['В H₂CO₃ связи уже разные: C=O 121 пм, C–OH 134 пм.', 'In H₂CO₃ the bonds now differ: C=O 121 pm, C–OH 134 pm.', 'H₂CO₃ da bogʻlar endi har xil: C=O 121 pm, C–OH 134 pm.'],
      },
      decompose: {
        title: ['H₂CO₃ → CO₂ + H₂O', 'H₂CO₃ → CO₂ + H₂O', 'H₂CO₃ → CO₂ + H₂O'],
        main: [
          'Угольная кислота сразу распадается: атом H переходит к соседней группе OH, связь C–O рвётся (пара уходит к O) — уходит молекула воды. Освободившаяся пара второго O становится π-связью: O=C=O.',
          'Carbonic acid breaks down at once: an H atom moves to the neighbouring OH group and the C–O bond breaks (the pair goes to O), so a water molecule leaves. The freed pair of the other O becomes a π bond: O=C=O.',
          'Karbonat kislota darhol parchalanadi: H atomi qoʻshni OH guruhiga oʻtadi, C–O bogʻi uziladi (juft O ga oʻtadi) — suv molekulasi ajraladi. Ikkinchi O ning boʻshagan jufti π-bogʻga aylanadi: O=C=O.',
        ],
        sub: ['Угол O–C–O раскрывается от 120° до 180°, связи сокращаются до 116 пм.', 'The O–C–O angle opens from 120° to 180°; the bonds shorten to 116 pm.', 'O–C–O burchagi 120° dan 180° gacha ochiladi, bogʻlar 116 pm gacha qisqaradi.'],
      },
      gas: {
        title: ['Пузырьки CO₂↑', 'CO₂ bubbles ↑', 'CO₂ pufakchalari ↑'],
        main: [
          'CO₂ плохо растворяется и уходит из раствора пузырьками. Поэтому реакция обмена идёт до конца: один из продуктов — газ.',
          'CO₂ dissolves poorly and leaves the solution as bubbles. That is why this exchange reaction goes to completion: one of the products is a gas.',
          'CO₂ yomon eriydi va eritmadan pufakchalar holida chiqib ketadi. Shuning uchun almashinish reaksiyasi oxirigacha boradi: mahsulotlardan biri — gaz.',
        ],
        sub: ['В растворе остаются ионы Ca²⁺ и Cl⁻ — это раствор хлорида кальция CaCl₂.', 'Ca²⁺ and Cl⁻ ions stay in solution: this is a calcium chloride solution, CaCl₂.', 'Eritmada Ca²⁺ va Cl⁻ ionlari qoladi — bu kalsiy xlorid CaCl₂ eritmasi.'],
      },
      final: {
        title: ['Итог: три продукта', 'Result: three products', 'Natija: uchta mahsulot'],
        main: [
          'CaCO₃ + 2HCl → CaCl₂ + CO₂↑ + H₂O. Степени окисления не меняются (C⁺⁴ → C⁺⁴): это не ОВР, а реакция обмена.',
          'CaCO₃ + 2HCl → CaCl₂ + CO₂↑ + H₂O. Oxidation states do not change (C⁺⁴ → C⁺⁴): this is not redox but an exchange reaction.',
          'CaCO₃ + 2HCl → CaCl₂ + CO₂↑ + H₂O. Oksidlanish darajalari oʻzgarmaydi (C⁺⁴ → C⁺⁴): bu OQR emas, almashinish reaksiyasi.',
        ],
        sub: [
          'Так получают CO₂ в лаборатории (аппарат Киппа). Проверка: CO₂ мутит известковую воду.',
          'This is how CO₂ is made in the lab (Kipp’s apparatus). Test: CO₂ turns limewater cloudy.',
          'Laboratoriyada CO₂ shunday olinadi (Kipp apparati). Sinov: CO₂ ohakli suvni loyqalantiradi.',
        ],
      },
    },
    hud: [
      { stage: 'reagents', from: 0.15, to: 1, tone: 'route', title: ['Реакция обмена', 'Exchange reaction', 'Almashinish reaksiyasi'], lines: [same('CaCO₃ + 2HCl → CaCl₂ + CO₂↑ + H₂O'), ['мрамор + соляная кислота', 'marble + hydrochloric acid', 'marmar + xlorid kislota']] },
      { stage: 'dissociate', from: 0, to: 1, tone: 'route', title: ['Диссоциация', 'Dissociation', 'Dissotsilanish'], lines: [same('HCl → H⁺ + Cl⁻'), ['пара e⁻ уходит к Cl', 'the e⁻ pair goes to Cl', 'e⁻ jufti Cl ga oʻtadi']] },
      { stage: 'protonate1', from: 0, to: 1, tone: 'route', title: ['Присоединение H⁺', 'Adding H⁺', 'H⁺ birikishi'], lines: [same('CO₃²⁻ + H⁺ → HCO₃⁻')] },
      { stage: 'protonate2', from: 0, to: 1, tone: 'route', title: ['Присоединение H⁺', 'Adding H⁺', 'H⁺ birikishi'], lines: [same('CO₃²⁻ + H⁺ → HCO₃⁻'), same('HCO₃⁻ + H⁺ → H₂CO₃')] },
      { stage: 'decompose', from: 0, to: 1, tone: 'check', title: ['Распад угольной кислоты', 'Carbonic acid breaks down', 'Karbonat kislota parchalanishi'], lines: [same('H₂CO₃ → CO₂↑ + H₂O'), ['C⁺⁴ → C⁺⁴: не ОВР', 'C⁺⁴ → C⁺⁴: not redox', 'C⁺⁴ → C⁺⁴: OQR emas']] },
      { stage: 'gas', from: 0, to: 1, tone: 'check', title: ['Сокращённое ионное уравнение', 'Net ionic equation', 'Qisqartirilgan ionli tenglama'], lines: [same('CaCO₃ + 2H⁺ → Ca²⁺ + CO₂↑ + H₂O'), ['Cl⁻ в реакции не участвуют', 'Cl⁻ ions are spectators', 'Cl⁻ ionlari reaksiyada qatnashmaydi']] },
      { stage: 'final', from: 0, to: 1, tone: 'check', title: ['Проверка на CO₂', 'Test for CO₂', 'CO₂ ga sinov'], lines: [same('CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O'), ['известковая вода мутнеет', 'limewater turns cloudy', 'ohakli suv loyqalanadi']] },
    ],
    tags: {
      marble: ['мрамор CaCO₃', 'marble CaCO₃', 'marmar CaCO₃'],
      carbonate: ['CO₃²⁻: 120°, 129 пм', 'CO₃²⁻: 120°, 129 pm', 'CO₃²⁻: 120°, 129 pm'],
      hcl: same('HCl'),
      water: ['вода', 'water', 'suv'],
      pairToCl: ['пара e⁻ → Cl', 'e⁻ pair → Cl', 'e⁻ jufti → Cl'],
      hco3: same('HCO₃⁻'),
      h2co3: ['H₂CO₃ — угольная кислота', 'H₂CO₃: carbonic acid', 'H₂CO₃ — karbonat kislota'],
      lone: ['неподелённая пара O', 'O lone pair', 'O ning boʻlinmagan jufti'],
      hJump: ['H переходит к OH', 'H moves to OH', 'H OH ga oʻtadi'],
      breakCO: ['C–O рвётся', 'C–O breaks', 'C–O uziladi'],
      newPi: ['новая π-связь', 'new π bond', 'yangi π-bogʻ'],
      angle: same('120° → 180°'),
      h2o: same('H₂O'),
      bubble: ['CO₂↑ пузырёк', 'CO₂↑ bubble', 'CO₂↑ pufakcha'],
      caq: ['Ca²⁺ в растворе', 'Ca²⁺ in solution', 'eritmadagi Ca²⁺'],
      clq: ['Cl⁻ в растворе', 'Cl⁻ in solution', 'eritmadagi Cl⁻'],
      notRedox: ['C⁺⁴ → C⁺⁴: не ОВР', 'C⁺⁴ → C⁺⁴: not redox', 'C⁺⁴ → C⁺⁴: OQR emas'],
      cacl2: ['CaCl₂ (раствор)', 'CaCl₂ (solution)', 'CaCl₂ (eritma)'],
    },
  },

  'co2-calcination': {
    title: ['Обжиг известняка', 'Calcining limestone', 'Ohaktoshni kuydirish'],
    equation: 'CaCO₃ →(t°) CaO + CO₂↑',
    stages: {
      reagents: {
        title: ['Известняк CaCO₃', 'Limestone, CaCO₃', 'Ohaktosh CaCO₃'],
        main: [
          'Известняк, мел и мрамор — это CaCO₃. В кристалле слои ионов Ca²⁺ чередуются со слоями плоских карбонат-ионов CO₃²⁻ (120°, C–O 129 пм).',
          'Limestone, chalk and marble are CaCO₃. In the crystal, layers of Ca²⁺ ions alternate with layers of flat carbonate ions CO₃²⁻ (120°, C–O 129 pm).',
          'Ohaktosh, boʻr va marmar — bu CaCO₃. Kristallda Ca²⁺ ionlari qatlamlari yassi karbonat-ionlar CO₃²⁻ qatlamlari bilan almashinib keladi (120°, C–O 129 pm).',
        ],
        sub: ['Внутри CO₃²⁻ связи ковалентные, между Ca²⁺ и CO₃²⁻ — ионная связь.', 'Inside CO₃²⁻ the bonds are covalent; between Ca²⁺ and CO₃²⁻ the bond is ionic.', 'CO₃²⁻ ichida bogʻlar kovalent, Ca²⁺ va CO₃²⁻ orasida — ion bogʻ.'],
      },
      heat: {
        title: ['Нагрев ≈ 900 °C', 'Heating to ≈ 900 °C', 'Qizdirish ≈ 900 °C'],
        main: [
          'В печи известняк нагревают примерно до 900 °C. Ионы колеблются всё сильнее — кристалл поглощает энергию.',
          'In a kiln limestone is heated to about 900 °C. The ions vibrate harder and harder: the crystal absorbs energy.',
          'Pechda ohaktosh taxminan 900 °C gacha qizdiriladi. Ionlar tobora kuchliroq tebranadi — kristall energiya yutadi.',
        ],
        sub: ['Без нагрева CaCO₃ устойчив: на его разложение нужна энергия.', 'Without heating CaCO₃ is stable: decomposing it takes energy.', 'Qizdirilmasa CaCO₃ barqaror: uni parchalash uchun energiya kerak.'],
      },
      break: {
        title: ['Разрыв связи C–O', 'A C–O bond breaks', 'C–O bogʻi uziladi'],
        main: [
          'В карбонат-ионе рвётся одна связь C–O. Пара электронов уходит к кислороду — он становится ионом O²⁻ и остаётся рядом с Ca²⁺. Из оставшихся атомов собирается CO₂: угол 120° → 180°, связи 129 → 116 пм.',
          'One C–O bond of the carbonate ion breaks. The electron pair goes to oxygen, which becomes an O²⁻ ion and stays next to Ca²⁺. The remaining atoms form CO₂: the angle opens 120° → 180°, bonds 129 → 116 pm.',
          'Karbonat-ionda bitta C–O bogʻi uziladi. Elektron jufti kislorodga oʻtadi — u O²⁻ ioniga aylanadi va Ca²⁺ yonida qoladi. Qolgan atomlardan CO₂ yigʻiladi: burchak 120° → 180°, bogʻlar 129 → 116 pm.',
        ],
        sub: [
          'Неподелённая пара второго O становится π-связью: O=C=O. C⁺⁴ остаётся C⁺⁴ — это не ОВР.',
          'A lone pair of the other O becomes a π bond: O=C=O. C⁺⁴ stays C⁺⁴, so this is not redox.',
          'Ikkinchi O ning boʻlinmagan jufti π-bogʻga aylanadi: O=C=O. C⁺⁴ C⁺⁴ boʻlib qoladi — bu OQR emas.',
        ],
      },
      escape: {
        title: ['CO₂ уходит газом', 'CO₂ escapes as a gas', 'CO₂ gaz boʻlib chiqadi'],
        main: [
          'Молекулы CO₂ улетают с печными газами, следом разлагаются соседние карбонат-ионы.',
          'The CO₂ molecules leave with the kiln gases; the neighbouring carbonate ions decompose next.',
          'CO₂ molekulalari pech gazlari bilan chiqib ketadi, ketidan qoʻshni karbonat-ionlar parchalanadi.',
        ],
        sub: ['Газ уходит — поэтому разложение идёт до конца.', 'The gas leaves, so the decomposition goes to completion.', 'Gaz chiqib ketadi — shuning uchun parchalanish oxirigacha boradi.'],
      },
      cao: {
        title: ['Решётка CaO', 'The CaO lattice', 'CaO panjarasi'],
        main: [
          'Ионы Ca²⁺ и O²⁻ перестраиваются в кубическую решётку, как у NaCl: в кристалле каждый ион окружён шестью ионами другого знака, Ca–O 240 пм.',
          'The Ca²⁺ and O²⁻ ions rearrange into a cubic lattice like NaCl: in the crystal each ion is surrounded by six ions of the opposite charge, Ca–O 240 pm.',
          'Ca²⁺ va O²⁻ ionlari NaCl dagidek kubik panjaraga qayta joylashadi: kristallda har bir ion qarama-qarshi zaryadli oltita ion bilan oʻralgan, Ca–O 240 pm.',
        ],
        sub: ['CaO — негашёная известь. На экране — фрагмент решётки из 8 ионов.', 'CaO is quicklime. The screen shows a lattice fragment of 8 ions.', 'CaO — soʻndirilmagan ohak. Ekranda — 8 ta iondan iborat panjara boʻlagi.'],
      },
      final: {
        title: ['Итог', 'Result', 'Natija'],
        main: [
          'CaCO₃ → CaO + CO₂↑ — реакция разложения. Энергия поглощается: ΔH = +178 кДж/моль (эндотермическая).',
          'CaCO₃ → CaO + CO₂↑ is a decomposition reaction. Energy is absorbed: ΔH = +178 kJ/mol (endothermic).',
          'CaCO₃ → CaO + CO₂↑ — parchalanish reaksiyasi. Energiya yutiladi: ΔH = +178 kJ/mol (endotermik).',
        ],
        sub: [
          'Негашёную известь применяют в строительстве: CaO + H₂O → Ca(OH)₂ (гашёная известь).',
          'Quicklime is used in construction: CaO + H₂O → Ca(OH)₂ (slaked lime).',
          'Soʻndirilmagan ohak qurilishda ishlatiladi: CaO + H₂O → Ca(OH)₂ (soʻndirilgan ohak).',
        ],
      },
    },
    hud: [
      { stage: 'reagents', from: 0.1, to: 1, tone: 'route', title: ['Реакция разложения', 'Decomposition reaction', 'Parchalanish reaksiyasi'], lines: [same('CaCO₃ →(t°) CaO + CO₂↑'), ['известняк → известь + углекислый газ', 'limestone → quicklime + CO₂', 'ohaktosh → ohak + karbonat angidrid']] },
      { stage: 'heat', from: 0, to: 1, tone: 'check', title: ['Энергия', 'Energy', 'Energiya'], lines: [['CaCO₃ + 178 кДж → CaO + CO₂', 'CaCO₃ + 178 kJ → CaO + CO₂', 'CaCO₃ + 178 kJ → CaO + CO₂'], ['ΔH = +178 кДж/моль (поглощается)', 'ΔH = +178 kJ/mol (absorbed)', 'ΔH = +178 kJ/mol (yutiladi)']] },
      {
        stage: 'break',
        from: 0.1,
        to: 1,
        tone: 'check',
        title: ['Степени окисления', 'Oxidation states', 'Oksidlanish darajalari'],
        lines: [['Ca⁺², C⁺⁴, O⁻² — до и после', 'Ca⁺², C⁺⁴, O⁻² before and after', 'Ca⁺², C⁺⁴, O⁻² — oldin va keyin'],['пара связи C–O и так числилась за O', 'the C–O bond pair was already counted to O', 'C–O bogʻ jufti baribir O ga hisoblangan'], ['не ОВР', 'not redox', 'OQR emas']],
      },
      { stage: 'escape', from: 0, to: 1, tone: 'route', title: ['Газ уходит', 'The gas leaves', 'Gaz chiqadi'], lines: [same('CaCO₃ → CaO + CO₂↑')] },
      { stage: 'cao', from: 0.1, to: 1, tone: 'route', title: ['Негашёная известь', 'Quicklime', 'Soʻndirilmagan ohak'], lines: [['CaO: решётка типа NaCl', 'CaO: NaCl-type lattice', 'CaO: NaCl tipidagi panjara'], ['Ca–O 240 пм', 'Ca–O 240 pm', 'Ca–O 240 pm']] },
      { stage: 'final', from: 0, to: 1, tone: 'check', title: ['Итог', 'Result', 'Natija'], lines: [same('CaCO₃ → CaO + CO₂↑'), ['разложение · эндотермическая · не ОВР', 'decomposition · endothermic · not redox', 'parchalanish · endotermik · OQR emas']] },
    ],
    tags: {
      crystal: ['CaCO₃: слои Ca²⁺ и CO₃²⁻', 'CaCO₃: layers of Ca²⁺ and CO₃²⁻', 'CaCO₃: Ca²⁺ va CO₃²⁻ qatlamlari'],
      carbonate: ['CO₃²⁻: 120°, 129 пм', 'CO₃²⁻: 120°, 129 pm', 'CO₃²⁻: 120°, 129 pm'],
      heat: same('≈ 900 °C'),
      absorb: ['энергия поглощается', 'energy is absorbed', 'energiya yutiladi'],
      pairToO: ['пара e⁻ → O', 'e⁻ pair → O', 'e⁻ jufti → O'],
      o2m: ['O²⁻ остаётся с Ca²⁺', 'O²⁻ stays with Ca²⁺', 'O²⁻ Ca²⁺ bilan qoladi'],
      angle: same('120° → 180°'),
      newPi: ['новая π-связь', 'new π bond', 'yangi π-bogʻ'],
      gas: same('CO₂ ↑'),
      cao: ['CaO: решётка типа NaCl', 'CaO: NaCl-type lattice', 'CaO: NaCl tipidagi panjara'],
      len240: ['Ca–O 240 пм', 'Ca–O 240 pm', 'Ca–O 240 pm'],
      notRedox: ['C⁺⁴ → C⁺⁴: не ОВР', 'C⁺⁴ → C⁺⁴: not redox', 'C⁺⁴ → C⁺⁴: OQR emas'],
      endo: ['ΔH = +178 кДж/моль', 'ΔH = +178 kJ/mol', 'ΔH = +178 kJ/mol'],
    },
  },
} satisfies Record<string, RouteTexts>

export type RouteId = keyof typeof ROUTE_TEXTS
