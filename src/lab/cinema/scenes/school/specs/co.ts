/**
 * CO — 2C + O₂ → 2CO (Kimyo 7, § 2.12, с. 69–70: «углерод с ограниченным количеством кислорода»).
 * Тройная связь C≡O: две обычные общие пары + одна донорно-акцепторная (O — донор, C — акцептор; Kimyo 8, с. 69–70).
 * По формуле учебник даёт C(II) (с. 63) — на деле у обоих атомов по три связи. Длина 112,8 пм (ядро: 'C#O').
 */
import { ref } from './core'
import { ATOM_C, ATOM_O, P_C_GRAPHITE, P_O2, T7_OXIDES, T7_OXYGEN_PROPS, T7_VALENCE_EXERCISES, T8_DATIVE, T8_LEVELS } from './shared'
import type { ParticleSpec, SchoolSceneSpec, TextbookRef } from './types'

const T7_CO_EXAMPLE: TextbookRef = {
  grade: 7,
  pages: [69, 70],
  section: '§ 2.12',
  title: 'Составление уравнений химических реакций',
  what: 'пример: углерод с ограниченным количеством кислорода: C + O₂ → CO, уравнивание → 2C + O₂ → 2CO',
  asInBook: 'C + O₂ → CO → 2C + O₂ → 2CO',
}

const T9_CARBON_OXIDES: TextbookRef = {
  grade: 9,
  pages: [50, 51],
  section: '§ 10',
  title: 'Важнейшие соединения углерода',
  what: 'CO — бесцветный газ без запаха, чрезвычайно ядовит, легче воздуха; горит синим пламенем; CO₂ + C = 2CO; связывается с гемоглобином; формула записана «:C=O:»',
  asInBook: ':C=O:',
}

const P_CO: ParticleSpec = {
  id: 'CO',
  formula: 'CO',
  name: { ru: 'оксид углерода(II), угарный газ', en: 'carbon(II) oxide, carbon monoxide', uz: 'uglerod(II) oksidi, is gazi' },
  role: 'product',
  phase: 'г',
  kind: 'molecule',
  // формальные заряды C⁻≡O⁺ — не рисуются в 7 классе; объясняют, почему минус диполя на углероде
  atoms: [
    { id: 'C', element: 'C', charge: -1 },
    { id: 'O', element: 'O', charge: 1 },
  ],
  bonds: [{ a: 'C', b: 'O', pairs: 3, dative: { donor: 'O' }, polar: true, length: { bond: 'C#O' } }],
  lonePairs: { C: 1, O: 1 },
  unpaired: {},
  charge: 0,
  shape: 'diatomic',
  dipoleKey: 'CO',
  polarity: 'polar',
  resonance: {
    show: {
      ru: 'Показываем C≡O: две общие пары из неспаренных электронов C и O и третья — донорно-акцепторная (пара кислорода на свободной орбитали углерода); по одной неподелённой паре у каждого атома.',
      en: 'We show C≡O: two shared pairs from the unpaired electrons of C and O and a third, donor-acceptor pair (an oxygen pair in the empty orbital of carbon); one lone pair on each atom.',
      uz: 'C≡O koʻrsatiladi: C va O ning juftlashmagan elektronlaridan ikkita umumiy juft va uchinchisi — donor-akseptor juft (kislorod jufti uglerodning boʻsh orbitalida); har bir atomda bittadan boʻlinmagan juft.',
    },
    real: {
      ru: 'После образования три пары неотличимы. Связь очень прочная и короткая — 112,8 пм. Диполь молекулы маленький, и его минус — на углероде, хотя кислород электроотрицательнее: донорно-акцепторная пара «сдвинута» к углероду.',
      en: 'Once formed, the three pairs are indistinguishable. The bond is very strong and short — 112.8 pm. The dipole of the molecule is small, and its negative end is on carbon although oxygen is more electronegative: the donor-acceptor pair is «shifted» to carbon.',
      uz: 'Hosil boʻlgach, uchala juft bir-biridan farq qilmaydi. Bogʻ juda mustahkam va qisqa — 112,8 pm. Molekula dipoli kichik va uning manfiy uchi uglerodda, garchi kislorod elektromanfiyroq boʻlsa ham: donor-akseptor juft uglerod tomonga «siljigan».',
    },
  },
}

export const CO_SPEC: SchoolSceneSpec = {
  id: 'co',
  substance: 'CO',
  focus: 'CO',
  name: { ru: 'Угарный газ', en: 'Carbon monoxide', uz: 'Is gazi' },
  bondType: 'covalent-polar',
  reaction: {
    equation: '2C + O₂ → 2CO',
    reactants: [
      { formula: 'C', coef: 2, phase: 'тв', particle: 'C' },
      { formula: 'O₂', coef: 1, phase: 'г', particle: 'O2' },
    ],
    products: [{ formula: 'CO', coef: 2, phase: 'г', particle: 'CO' }],
    reversible: false,
    kind: 'combustion',
    bankId: 'c-o2-co',
    sources: [T7_CO_EXAMPLE, T9_CARBON_OXIDES],
    conditions: {
      heating: true,
      oxygen: 'lack',
      text: {
        ru: 'нагревание при недостатке кислорода (глубокий слой раскалённых углей, закрытая печь)',
        en: 'heating with too little oxygen (a deep layer of red-hot coals, a closed stove)',
        uz: 'kislorod yetishmaganda qizdirish (choʻgʻlangan koʻmirning chuqur qatlami, yopiq pech)',
      },
    },
    heat: 'exo',
    heatSource: ref('NIST-JANAF: ΔH°f(CO, г) < 0 (ядро: thermoData «CO(g)»)'),
  },
  atoms: [ATOM_C, ATOM_O],
  particles: [P_C_GRAPHITE, P_O2, P_CO],
  mechanism: {
    breaks: [
      {
        particle: 'O2',
        a: 'Oa',
        b: 'Ob',
        why: { ru: 'две общие пары O=O расходятся; атомов O хватает только по одному на атом C', en: 'the two O=O pairs split; there is only one O atom for each C atom', uz: 'ikkita O=O jufti ajraladi; har bir C atomiga faqat bittadan O atomi yetadi' },
      },
    ],
    forms: [
      {
        particle: 'CO',
        a: 'C',
        b: 'O',
        how: 'shared+dative',
        why: {
          ru: 'две пары — из неспаренных электронов C и O; третья — неподелённая пара O на свободной орбитали C',
          en: 'two pairs from the unpaired electrons of C and O; the third is a lone pair of O in the empty orbital of C',
          uz: 'ikki juft — C va O ning juftlashmagan elektronlaridan; uchinchisi — O ning boʻlinmagan jufti C ning boʻsh orbitalida',
        },
      },
    ],
  },
  valence: {
    particle: 'CO',
    school: { C: 2, O: 2 },
    schoolSource: T7_VALENCE_EXERCISES,
    oxidation: { C: 2, O: -2 },
    verdict: { C: 'formal', O: 'formal' },
    explain: {
      ru: 'По формуле CO учебник находит валентность углерода II (с. 63): один атом кислорода «двухвалентен». На деле между атомами три общие пары — две обычные и одна донорно-акцепторная, поэтому у углерода и у кислорода по три связи. «II» — это степень окисления углерода +2, а не число связей.',
      en: 'From the formula CO the textbook finds valence II for carbon (p. 63): one «divalent» oxygen atom. In reality there are three shared pairs between the atoms — two ordinary and one donor-acceptor, so both carbon and oxygen have three bonds. «II» is the oxidation state of carbon, +2, not the number of bonds.',
      uz: 'CO formulasi boʻyicha darslik uglerod valentligini II deb topadi (63-bet): bitta «ikki valentli» kislorod atomi. Aslida atomlar orasida uchta umumiy juft bor — ikkitasi oddiy va bittasi donor-akseptor, shuning uchun uglerodda ham, kislorodda ham uchtadan bogʻ. «II» — bogʻlar soni emas, uglerodning +2 oksidlanish darajasi.',
    },
  },
  observations: [
    {
      text: {
        ru: 'Угарный газ — бесцветный газ без запаха, чрезвычайно ядовит, немного легче воздуха, плохо растворяется в воде.',
        en: 'Carbon monoxide is a colourless odourless gas, extremely poisonous, slightly lighter than air, poorly soluble in water.',
        uz: 'Is gazi — rangsiz, hidsiz gaz, oʻta zaharli, havodan biroz yengil, suvda yomon eriydi.',
      },
      source: T9_CARBON_OXIDES,
    },
    {
      text: {
        ru: 'На воздухе CO горит синим пламенем и превращается в углекислый газ: 2CO + O₂ → 2CO₂.',
        en: 'In air CO burns with a blue flame and turns into carbon dioxide: 2CO + O₂ → 2CO₂.',
        uz: 'Havoda CO koʻk alanga bilan yonadi va karbonat angidridga aylanadi: 2CO + O₂ → 2CO₂.',
      },
      source: T7_OXYGEN_PROPS,
    },
    {
      text: {
        ru: 'CO — несолеобразующий оксид: с водой, кислотами и щелочами при обычных условиях соли не образует.',
        en: 'CO is a non-salt-forming oxide: under ordinary conditions it forms no salts with water, acids or alkalis.',
        uz: 'CO — tuz hosil qilmaydigan oksid: oddiy sharoitda suv, kislotalar va ishqorlar bilan tuz hosil qilmaydi.',
      },
      source: T7_OXIDES,
    },
  ],
  uses: [
    {
      text: {
        ru: 'Восстановитель в металлургии (получение железа из оксидов), часть газообразного топлива.',
        en: 'A reducing agent in metallurgy (obtaining iron from its oxides), part of gaseous fuel.',
        uz: 'Metallurgiyada qaytaruvchi (oksidlardan temir olish), gazsimon yoqilgʻi tarkibiy qismi.',
      },
      source: T9_CARBON_OXIDES,
    },
  ],
  intro: {
    title: { ru: 'Угарный газ: тройная связь', en: 'Carbon monoxide: a triple bond', uz: 'Is gazi: uchlamchi bogʻ' },
    speak: {
      ru: 'Когда кислорода мало, уголь сгорает до угарного газа. Посмотрим, почему связь в его молекуле тройная.',
      en: 'When oxygen is scarce, charcoal burns to carbon monoxide. Let us see why the bond in its molecule is triple.',
      uz: 'Kislorod kam boʻlsa, koʻmir is gazigacha yonadi. Uning molekulasidagi bogʻ nega uchlamchi ekanini koʻramiz.',
    },
  },
  safety: {
    ru: 'Угарный газ смертельно ядовит и не имеет запаха. Нельзя закрывать печную заслонку, пока в печи тлеют угли.',
    en: 'Carbon monoxide is deadly poisonous and has no smell. Never close the stove damper while coals are still smouldering.',
    uz: 'Is gazi oʻlim darajasida zaharli va hidsiz. Pechda koʻmir choʻgʻlanib turganda pech moʻrisini yopib boʻlmaydi.',
  },
  steps: [
    {
      id: 'reactants',
      level: 7,
      seconds: 4.5,
      show: ['два атома C из кусочка угля', 'одна молекула O₂ (O=O)', 'подпись «2C + O₂» — кислорода мало'],
      text: {
        ru: {
          title: 'Исходные вещества',
          body: 'Уголь (углерод C) и кислород O₂. Если кислорода мало — например, в глубине раскалённых углей или в печи с закрытой заслонкой, — углерод сгорает не до углекислого, а до угарного газа CO. На два атома углерода здесь приходится только одна молекула кислорода.',
          equation: '2C + O₂',
          note: 'В сцене — два атома углерода; настоящий уголь — твёрдое вещество из множества атомов C. Этот пример разобран в учебнике (с. 69–70).',
          speak: 'Два атома углерода и всего одна молекула кислорода. Кислорода мало.',
        },
        en: {
          title: 'Starting substances',
          body: 'Charcoal (carbon C) and oxygen O₂. If oxygen is scarce — for example deep inside red-hot coals or in a stove with a closed damper — carbon burns not to carbon dioxide but to carbon monoxide, CO. Here there is only one oxygen molecule for two carbon atoms.',
          equation: '2C + O₂',
          note: 'The scene shows two carbon atoms; real charcoal is a solid of very many C atoms. This example is worked out in the textbook (pp. 69–70).',
          speak: 'Two carbon atoms and only one oxygen molecule. There is little oxygen.',
        },
        uz: {
          title: 'Dastlabki moddalar',
          body: 'Koʻmir (uglerod C) va kislorod O₂. Agar kislorod kam boʻlsa — masalan, choʻgʻlangan koʻmir ichida yoki moʻrisi yopiq pechda, — uglerod karbonat angidridgacha emas, is gazi CO gacha yonadi. Bu yerda ikki uglerod atomiga faqat bitta kislorod molekulasi toʻgʻri keladi.',
          equation: '2C + O₂',
          note: 'Sahnada ikkita uglerod atomi; haqiqiy koʻmir juda koʻp C atomlaridan iborat qattiq modda. Bu misol darslikda tahlil qilingan (69–70-betlar).',
          speak: 'Ikkita uglerod atomi va bor-yoʻgʻi bitta kislorod molekulasi. Kislorod kam.',
        },
      },
    },
    {
      id: 'atoms',
      level: 8,
      seconds: 5.5,
      show: ['облако C: 1 пара + 2 одиночных электрона и пустое место (свободная орбиталь — светлый «кармашек»)', 'облако O: 2 пары + 2 одиночных', 'схема C (+6): 2, 4; O (+8): 2, 6'],
      sources: [T8_LEVELS, T8_DATIVE],
      text: {
        ru: {
          title: 'Строение атомов углерода и кислорода',
          body: 'Заряд ядра углерода +6, электроны: 2, 4. Из четырёх внешних электронов углерода два спарены и два нет, а ещё у него есть свободное место — пустая орбиталь. Заряд ядра кислорода +8, электроны: 2, 6 — две пары и два неспаренных электрона.',
          equation: 'C (+6): 2, 4      O (+8): 2, 6',
          note: 'Строение слоёв и понятие «свободная орбиталь» — материал 8 класса. Светлый «кармашек» в облаке углерода — это свободное место для чужой пары электронов.',
          speak: 'У углерода два неспаренных электрона и свободное место, у кислорода — два неспаренных электрона и две пары.',
        },
        en: {
          title: 'Structure of carbon and oxygen atoms',
          body: 'The nuclear charge of carbon is +6, electrons: 2, 4. Of carbon’s four outer electrons two are paired and two are not, and it also has a free place — an empty orbital. The nuclear charge of oxygen is +8, electrons: 2, 6 — two pairs and two unpaired electrons.',
          equation: 'C (+6): 2, 4      O (+8): 2, 6',
          note: 'Electron shells and the idea of a «free orbital» are grade 8 material. The light «pocket» in the carbon cloud is a free place for someone else’s electron pair.',
          speak: 'Carbon has two unpaired electrons and a free place, oxygen has two unpaired electrons and two pairs.',
        },
        uz: {
          title: 'Uglerod va kislorod atomlarining tuzilishi',
          body: 'Uglerod yadrosining zaryadi +6, elektronlari: 2, 4. Uglerodning toʻrtta tashqi elektronidan ikkitasi juftlashgan, ikkitasi yoʻq, yana unda boʻsh joy — boʻsh orbital bor. Kislorod yadrosining zaryadi +8, elektronlari: 2, 6 — ikkita juft va ikkita juftlashmagan elektron.',
          equation: 'C (+6): 2, 4      O (+8): 2, 6',
          note: 'Pogʻonalar tuzilishi va «boʻsh orbital» tushunchasi — 8-sinf materiali. Uglerod bulutidagi yorugʻ «choʻntak» — begona elektron jufti uchun boʻsh joy.',
          speak: 'Uglerodda ikkita juftlashmagan elektron va boʻsh joy bor, kislorodda — ikkita juftlashmagan elektron va ikkita juft.',
        },
      },
    },
    {
      id: 'breaking',
      level: 7,
      seconds: 4.5,
      show: ['O=O гаснет, два атома O расходятся — каждый к своему атому C'],
      text: {
        ru: {
          title: 'Молекула кислорода распадается',
          body: 'При нагревании две общие пары в молекуле O₂ расходятся, и получаются два атома кислорода. Каждому атому углерода достаётся только один атом кислорода — поэтому получится CO, а не CO₂.',
          equation: 'O=O → O + O',
          note: 'Схема. В настоящей печи CO часто получается в два этапа: сначала уголь сгорает до CO₂, а потом CO₂ реагирует с раскалённым углём: CO₂ + C → 2CO (9 класс).',
          speak: 'Кислорода хватает только по одному атому на каждый атом углерода.',
        },
        en: {
          title: 'The oxygen molecule splits',
          body: 'On heating the two shared pairs of the O₂ molecule split, giving two oxygen atoms. Each carbon atom gets only one oxygen atom — so CO forms, not CO₂.',
          equation: 'O=O → O + O',
          note: 'A scheme. In a real stove CO often forms in two stages: first charcoal burns to CO₂, then CO₂ reacts with red-hot charcoal: CO₂ + C → 2CO (grade 9).',
          speak: 'There is only enough oxygen for one atom per carbon atom.',
        },
        uz: {
          title: 'Kislorod molekulasi parchalanadi',
          body: 'Qizdirilganda O₂ molekulasidagi ikkita umumiy juft ajraladi va ikkita kislorod atomi hosil boʻladi. Har bir uglerod atomiga faqat bitta kislorod atomi tegadi — shuning uchun CO₂ emas, CO hosil boʻladi.',
          equation: 'O=O → O + O',
          note: 'Sxema. Haqiqiy pechda CO koʻpincha ikki bosqichda hosil boʻladi: avval koʻmir CO₂ gacha yonadi, soʻng CO₂ choʻgʻlangan koʻmir bilan reaksiyaga kirishadi: CO₂ + C → 2CO (9-sinf).',
          speak: 'Kislorod har bir uglerod atomiga faqat bittadan atom yetadi.',
        },
      },
    },
    {
      id: 'bonding',
      level: 8,
      seconds: 7,
      show: [
        'два неспаренных электрона C и два неспаренных O встают двумя парами между ядрами',
        'затем одна неподелённая пара O сдвигается в свободную орбиталь C — стрелка O→C (донорно-акцепторная)',
        'итого три пары между ядрами',
      ],
      sources: [T8_DATIVE],
      text: {
        ru: {
          title: 'Три общие пары',
          body: 'Два неспаренных электрона углерода и два неспаренных электрона кислорода образуют две общие пары. Третью пару даёт сам кислород: одна его неподелённая пара занимает свободную орбиталь углерода. Такую связь называют донорно-акцепторной: кислород — донор, углерод — акцептор. Всего между атомами три общие пары — тройная связь C≡O.',
          equation: 'C + O → C≡O',
          note: 'Стрелка показывает донорно-акцепторную пару: обе её точки пришли от кислорода. Когда связь образовалась, эта пара ничем не отличается от двух других.',
          speak: 'Две пары — общие, третью пару кислород отдал в общее пользование. Получилась тройная связь.',
        },
        en: {
          title: 'Three shared pairs',
          body: 'The two unpaired electrons of carbon and the two unpaired electrons of oxygen form two shared pairs. The third pair comes from oxygen itself: one of its lone pairs occupies the empty orbital of carbon. This kind of bond is called donor-acceptor: oxygen is the donor, carbon the acceptor. Altogether there are three shared pairs between the atoms — a C≡O triple bond.',
          equation: 'C + O → C≡O',
          note: 'The arrow shows the donor-acceptor pair: both of its dots came from oxygen. Once the bond has formed, this pair is no different from the other two.',
          speak: 'Two pairs are shared, the third pair oxygen gave for common use. A triple bond has formed.',
        },
        uz: {
          title: 'Uchta umumiy juft',
          body: 'Uglerodning ikkita juftlashmagan elektroni va kislorodning ikkita juftlashmagan elektroni ikkita umumiy juft hosil qiladi. Uchinchi juftni kislorodning oʻzi beradi: uning bitta boʻlinmagan jufti uglerodning boʻsh orbitalini egallaydi. Bunday bogʻ donor-akseptor bogʻ deyiladi: kislorod — donor, uglerod — akseptor. Atomlar orasida jami uchta umumiy juft — C≡O uchlamchi bogʻ.',
          equation: 'C + O → C≡O',
          note: 'Strelka donor-akseptor juftni koʻrsatadi: uning ikkala nuqtasi kisloroddan kelgan. Bogʻ hosil boʻlgach, bu juft qolgan ikkitasidan farq qilmaydi.',
          speak: 'Ikki juft umumiy, uchinchi juftni kislorod umumiy foydalanishga berdi. Uchlamchi bogʻ hosil boʻldi.',
        },
      },
    },
    {
      id: 'product',
      level: 8,
      seconds: 5.5,
      show: ['молекула C≡O: три пары между ядрами, по одной неподелённой паре у C и у O', 'подпись длины 112,8 пм'],
      sources: [T9_CARBON_OXIDES],
      text: {
        ru: {
          title: 'Молекула угарного газа',
          body: 'Молекула CO состоит из двух атомов, соединённых тройной связью; у каждого атома осталась одна неподелённая пара. Тройная связь очень прочная и короткая — 112,8 пм, короче двойной связи C=O в углекислом газе.',
          equation: 'C≡O',
          note: 'В учебнике 9 класса (с. 50) угарный газ записан как :C=O: — с двойной связью. Это неточно: связь тройная, это видно по её длине и прочности.',
          speak: 'В угарном газе между углеродом и кислородом три общие пары — тройная связь.',
        },
        en: {
          title: 'The carbon monoxide molecule',
          body: 'The CO molecule consists of two atoms joined by a triple bond; each atom keeps one lone pair. The triple bond is very strong and short — 112.8 pm, shorter than the C=O double bond in carbon dioxide.',
          equation: 'C≡O',
          note: 'The grade 9 textbook (p. 50) writes carbon monoxide as :C=O: — with a double bond. This is inaccurate: the bond is triple, as its length and strength show.',
          speak: 'In carbon monoxide there are three shared pairs between carbon and oxygen — a triple bond.',
        },
        uz: {
          title: 'Is gazi molekulasi',
          body: 'CO molekulasi uchlamchi bogʻ bilan bogʻlangan ikki atomdan iborat; har bir atomda bittadan boʻlinmagan juft qolgan. Uchlamchi bogʻ juda mustahkam va qisqa — 112,8 pm, karbonat angidriddagi C=O qoʻsh bogʻidan qisqaroq.',
          equation: 'C≡O',
          note: '9-sinf darsligida (50-bet) is gazi :C=O: — qoʻsh bogʻ bilan yozilgan. Bu noaniq: bogʻ uchlamchi, bu uning uzunligi va mustahkamligidan koʻrinadi.',
          speak: 'Is gazida uglerod va kislorod orasida uchta umumiy juft — uchlamchi bogʻ bor.',
        },
      },
    },
    {
      id: 'summary',
      level: 7,
      seconds: 4.5,
      show: ['две молекулы CO', 'уравнение 2C + O₂ → 2CO и подсчёт атомов'],
      text: {
        ru: {
          title: 'Итог: угарный газ',
          body: 'Два атома углерода и одна молекула кислорода дали две молекулы угарного газа. Угарный газ бесцветен, не имеет запаха и очень ядовит. На воздухе он горит синим пламенем, превращаясь в углекислый газ.',
          equation: '2C + O₂ → 2CO',
          note: 'Баланс: слева 2 атома C и 2 атома O, справа столько же. По формуле CO учебник находит валентность углерода II (с. 63), хотя связей у атома три — см. пояснение.',
          speak: 'При недостатке кислорода получается угарный газ. В его молекуле тройная связь.',
        },
        en: {
          title: 'Result: carbon monoxide',
          body: 'Two carbon atoms and one oxygen molecule have given two molecules of carbon monoxide. Carbon monoxide is colourless, has no smell and is very poisonous. In air it burns with a blue flame, turning into carbon dioxide.',
          equation: '2C + O₂ → 2CO',
          note: 'Balance: on the left 2 C atoms and 2 O atoms, on the right the same. From the formula CO the textbook finds valence II for carbon (p. 63), though the atom has three bonds — see the explanation.',
          speak: 'With too little oxygen, carbon monoxide forms. Its molecule has a triple bond.',
        },
        uz: {
          title: 'Xulosa: is gazi',
          body: 'Ikkita uglerod atomi va bitta kislorod molekulasi ikkita is gazi molekulasini berdi. Is gazi rangsiz, hidsiz va juda zaharli. Havoda u koʻk alanga bilan yonib, karbonat angidridga aylanadi.',
          equation: '2C + O₂ → 2CO',
          note: 'Balans: chapda 2 ta C va 2 ta O atomi, oʻngda ham shuncha. CO formulasi boʻyicha darslik uglerod valentligini II deb topadi (63-bet), vaholanki atomda uchta bogʻ bor — izohga qarang.',
          speak: 'Kislorod yetishmaganda is gazi hosil boʻladi. Uning molekulasida uchlamchi bogʻ bor.',
        },
      },
    },
  ],
  caveats: [
    {
      id: 'co-valence-ii',
      kind: 'textbook-simplification',
      source: T7_VALENCE_EXERCISES,
      text: {
        ru: 'Учебник 7 кл. (с. 63) по формуле CO находит «C (II)». Это верно как степень окисления (+2), но связей у углерода в CO три: две обычные общие пары и одна донорно-акцепторная (8 кл., с. 69–70).',
        en: 'The grade 7 textbook (p. 63) finds «C (II)» from the formula CO. This is right as the oxidation state (+2), but carbon in CO has three bonds: two ordinary shared pairs and one donor-acceptor pair (grade 8, pp. 69–70).',
        uz: '7-sinf darsligi (63-bet) CO formulasidan «C (II)» ni topadi. Bu oksidlanish darajasi (+2) sifatida toʻgʻri, lekin CO da uglerodning bogʻlari uchta: ikkita oddiy umumiy juft va bitta donor-akseptor juft (8-sinf, 69–70-betlar).',
      },
    },
    {
      id: 'co-double-in-g9',
      kind: 'textbook-error',
      source: T9_CARBON_OXIDES,
      text: {
        ru: 'Учебник 9 кл. (с. 50) пишет строение CO как «:C=O:» — с двойной связью. Правильно — тройная связь C≡O с неподелённой парой у каждого атома; двойной связи противоречат и длина (112,8 пм), и прочность молекулы.',
        en: 'The grade 9 textbook (p. 50) writes the structure of CO as «:C=O:» — with a double bond. Correct is the C≡O triple bond with a lone pair on each atom; a double bond contradicts both the length (112.8 pm) and the strength of the molecule.',
        uz: '9-sinf darsligi (50-bet) CO tuzilishini «:C=O:» — qoʻsh bogʻ bilan yozadi. Toʻgʻrisi — har bir atomda boʻlinmagan juftli C≡O uchlamchi bogʻ; qoʻsh bogʻga uzunlik (112,8 pm) ham, molekula mustahkamligi ham zid.',
      },
    },
    {
      id: 'co-dipole',
      kind: 'model-limit',
      source: ref('CRC Handbook «Dipole moments»: CO 0,11 D, отрицательный конец — C'),
      text: {
        ru: 'Хотя кислород электроотрицательнее, минус маленького диполя CO — на атоме углерода. Школьное правило «пара смещена к более электроотрицательному атому» здесь не работает из-за донорно-акцепторной пары.',
        en: 'Although oxygen is more electronegative, the negative end of the small CO dipole is on carbon. The school rule «the pair shifts towards the more electronegative atom» fails here because of the donor-acceptor pair.',
        uz: 'Kislorod elektromanfiyroq boʻlsa ham, CO kichik dipolining manfiy uchi uglerod atomida. «Juft elektromanfiyroq atomga siljiydi» degan maktab qoidasi bu yerda donor-akseptor juft tufayli ishlamaydi.',
      },
    },
    {
      id: 'co-two-stage',
      kind: 'scene-simplification',
      source: T9_CARBON_OXIDES,
      text: {
        ru: 'Сцена соединяет C и O сразу. В печи CO образуется и так, и через CO₂: C + O₂ → CO₂, затем CO₂ + C → 2CO на раскалённом угле (9 кл., с. 50). Итоговое уравнение то же: 2C + O₂ → 2CO.',
        en: 'The scene joins C and O directly. In a stove CO forms both this way and via CO₂: C + O₂ → CO₂, then CO₂ + C → 2CO on red-hot charcoal (grade 9, p. 50). The overall equation is the same: 2C + O₂ → 2CO.',
        uz: 'Sahna C va O ni bevosita biriktiradi. Pechda CO shunday ham, CO₂ orqali ham hosil boʻladi: C + O₂ → CO₂, soʻng choʻgʻlangan koʻmirda CO₂ + C → 2CO (9-sinf, 50-bet). Umumiy tenglama bir xil: 2C + O₂ → 2CO.',
      },
    },
  ],
}
