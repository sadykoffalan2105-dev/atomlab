import type { PboMechanismText } from './pboMechanismText'

export const PBO_TEXT_UZ: PboMechanismText = {
  intro: {
    title: 'Qo‘rg‘oshin(II) oksid',
    speak: 'Qo‘rg‘oshin kislorod bilan qanday birikishini va qo‘rg‘oshin oksidi panjarasi nima uchun qatlamli ekanini ko‘ramiz.',
  },
  steps: {
    reactants: {
      title: 'Boshlang‘ich moddalar',
      body:
        'Chapda — metall qo‘rg‘oshinning bitta elementar yacheykasi: yoqlari markazlashgan kub panjara (YoMK, Fm-3m), qirrasi a = 495,1 pm, har bir atomning 350,1 pm masofada 12 ta eng yaqin qo‘shnisi bor. ' +
        'O‘ngda — kislorod molekulasi O₂: qo‘sh bog‘ (σ va π), muvozanat uzunligi rₑ = 120,75 pm; molekulada ikkita juftlashmagan elektron bor. ' +
        'Qo‘rg‘oshinning metall radiusi 175 pm, kislorodning kovalent radiusi 66 pm. Moddalar standart holatda, 25 °C da shunday ko‘rinadi: qo‘rg‘oshin — yumshoq metall (327,5 °C da suyuqlanadi), kislorod — gaz.',
      equation: '2 Pb (qat.) + O₂ (gaz)',
      note: 'Qattiq YoMK-qo‘rg‘oshin — 25 °C dagi standart holat, reaksiya energiyasi undan hisoblanadi (6-qadam); u oksidlanish paytidagi qo‘rg‘oshin emas: massikot 489 °C dan yuqorida olinadi, u yerda qo‘rg‘oshin allaqachon suyuqlanma (327,5 °C da suyuqlanadi). Kislorod reaksiyaga O₂ MOLEKULASI holida kirishadi — havoda yakka kislorod atomlari yo‘q. Qo‘rg‘oshin yacheykasidagi xira iplar — metall bog‘ sxemasi (butun kristallning umumiy elektronlari), atomlar juftlari orasidagi alohida bog‘lar emas; O=O o‘qining ustidagi va ostidagi yaproqlar — π-bog‘.',
      speak: 'Chapda metall qo‘rg‘oshin yacheykasi, o‘ngda qo‘sh bog‘li kislorod molekulasi.',
    },
    sublimation: {
      title: 'Sublimatsiya va dissotsiatsiya',
      body:
        'O‘zgarishni xayoliy bosqichlarga bo‘lamiz — energiyani hisoblash uchun shunday qulay. Birinchisi: qo‘rg‘oshin atomi metalldan ajraladi — buning uchun molga 195,2 kJ kerak (sublimatsiya). ' +
        'O=O qo‘sh bog‘i gomolitik uziladi: bog‘ elektronlari atomlar orasida teng bo‘linadi. Yarim mol O₂ uchun 249,2 kJ sarflanadi — bu 298 K dagi atomar kislorodning hosil bo‘lish issiqligi ΔH°f(O, gaz), butun mol O₂ uchun esa 498,4 kJ. ' +
        'Ikkala bosqich ham endotermik — energiya zinapoyasi yuqoriga ko‘tariladi.',
      equation: 'Pb (qat.) → Pb (gaz);  ½ O₂ (gaz) → O (gaz)',
      note: 'Bu energiyani hisoblash uchun XAYOLIY yo‘l (Born — Gaber sikli), reaksiya mexanizmi emas: oksidlanishda qo‘rg‘oshin bug‘lanmaydi — uning bug‘ bosimi juda kichik, haqiqiy reaksiyada erkin atomlar ham, gaz ionlari ham yo‘q. Aslida O₂ metall yoki suyuqlanma sirtiga o‘tiradi va shu yerning o‘zida atomlarga ajraladi, oksid esa qatlam bo‘lib o‘sadi. Gess qonuniga ko‘ra energiya yo‘lga bog‘liq emas, shuning uchun xayoliy bosqichlar to‘g‘ri yakun beradi. Metallning bitta yacheykasi ko‘rsatilgan: ikki atom reaksiyaga ketadi, qolganlari kadrdan chiqadi — haqiqiy qo‘rg‘oshin bo‘lagida taxminan 10²³ atom bor. Qadam oxirida valent nuqtalar paydo bo‘ladi: Pb da to‘rtta (6s² jufti va ikkita yakka 6p), O da oltita — ikki juft va ikki juftlashmagan elektron, O(³P) atomi.',
      speak: 'Moddalarni xayolan zarrachalarga ajratamiz: qo‘rg‘oshin atomi metalldan chiqadi, kislorod molekulasidagi qo‘sh bog‘ uziladi. Ikkala bosqich ham energiya talab qiladi.',
    },
    transfer: {
      title: 'Ikki elektron',
      body:
        'Har bir qo‘rg‘oshin atomi ikkita elektron beradi — ikkalasi ham 6p: birinchisi 715,6 kJ/mol, ikkinchisi 1450,5 kJ/mol turadi (ionlanish energiyalari). 6s² jufti Pb²⁺ ionida qoladi — u hali kerak bo‘ladi. ' +
        'Kislorod birinchi elektronni energiya ajratib (−141,0 kJ/mol), ikkinchisini esa sarf bilan qabul qiladi: +744 kJ/mol, chunki elektron allaqachon manfiy bo‘lgan O⁻ ioniga kiritiladi. ' +
        'Kadrdagi qo‘rg‘oshin shari 175 pm (metall radius) dan 98 pm (Pb²⁺ ning ion radiusi) ga, kislorod shari 66 pm (kovalent radius) dan 138 pm (O²⁻ ning ion radiusi) ga o‘zgaradi: kation atomdan kichik, anion katta.',
      equation: 'Pb⁰ − 2e⁻ → Pb²⁺  (×2);  O⁰ + 2e⁻ → O²⁻  (×2)',
      note: 'Nuqtalar — valent elektronlar soni (Pb da to‘rtta, Pb²⁺ da ikkita, O da oltita, O²⁻ da sakkizta), ularning joylashuvi emas; yoy bo‘ylab «uchish» va sekinlashtirilgan vaqt — shartli. Zaryad har bir elektron ketgan yoki kelgan kadrda o‘zgaradi (Pb → Pb⁺ → Pb²⁺, O → O⁻ → O²⁻), shar o‘lchami esa ion tayyor bo‘lganda: Shennonda Pb⁺ va O⁻ radiuslari yo‘q. Pb²⁺ va O²⁻ radiuslari KS 4 uchun olingan — PbO da ikkala ionning qurshovi shunday; KS 6 da Pb²⁺ 119 pm bo‘lardi. 175, 66 va 98, 138 pm radiuslari turlicha aniqlangan: metall radius — metalldagi Pb–Pb masofasining yarmi, kovalent — bog‘ uzunliklaridan (Kordero), ion radiuslari — O²⁻ radiusiga bog‘langan Shennonning shartli shkalasi; erkin Pb atomining metall radiusi yo‘q, Pb (gaz) shari shunchaki shu o‘lchamda chizilgan. Shuning uchun «kichraydi — kattalashdi» taqqoslashi sifatiy. O²⁻ ioni gazda mavjud emas: EA₂ o‘lchanmaydi, Born — Gaber sikllaridan chiqariladi; gazdagi Pb²⁺ va O²⁻ — xayoliy sikl bosqichlari, haqiqiy reaksiyada ular yo‘q.',
      speak: 'Qo‘rg‘oshin ikki elektron beradi va kichrayadi, olti es jufti qoladi. Kislorod ikki elektron oladi va kattalashadi.',
    },
    massicot: {
      title: 'Massikot',
      body:
        'Haqiqiy reaksiyada oksid qo‘rg‘oshin sirtida qatlam bo‘lib o‘sadi. Suyuqlangan qo‘rg‘oshin (u 327,5 °C da suyuqlanadi) havoda 489 °C dan yuqorida oksidlanganda suyuqlanma sirtida sariq massikot, β-PbO hosil bo‘ladi: rombik panjara Pbcm, a = 589,3, b = 549,0, c = 475,3 pm, Z = 4, zichligi 9,64 g/sm³. ' +
        'Har bir Pb²⁺ ning har xil masofada to‘rtta O²⁻ qo‘shnisi bor (eng qisqasi 222,1 pm), har bir O²⁻ ning — to‘rtta Pb²⁺: KS 4:4. ' +
        'Massikot 489 °C dan PbO ning 888 °C dagi suyuqlanishigacha barqaror.',
      equation: '2 Pb (suyuq.) + O₂ (gaz) → 2 PbO (qat., massikot, β),  t > 489 °C',
      note: 'Kadrda 2×2×2 elementar yacheykadan iborat bo‘lak — 64 ion; och chiziqlar — yacheyka qirralari, bog‘lar emas. Panjara sharlari radiusning 0,5 qismida chizilgan, shunda bo‘lak orqali qirralar ko‘rinadi. «Ion ketidan ion» yig‘ilishi — xayoliy siklning davomi, shartli va kuchli sekinlashtirib ko‘rsatilgan: reaksiyada gazdagi Pb²⁺ va O²⁻ ionlari yo‘q — O₂ suyuqlanma sirtida xemosorbsiyalanib dissotsilanadi, oksid qatlami sirtdan o‘sadi, Pb–O bog‘i esa ko‘p jihatdan kovalent. Bo‘lak atrofidagi sariq ramka — modda rangi (massikot sariq); qizil sharlar — O atomining CPK rangi, oksid rangi emas. Yacheyka Hill (1985) neytron ma’lumotlari bo‘yicha; Kay (1961) da qirralar pikometrning ulushlari qadar farq qiladi.',
      speak: 'Issiq qo‘rg‘oshin oksidi sariq massikot bo‘lib kristallanadi.',
    },
    litharge: {
      title: 'Glyot',
      body:
        'Sekin sovitilganda massikot qizil glyotga, α-PbO ga — 25 °C da barqaror shaklga qayta quriladi: tetragonal panjara P4/nmm, a = 397,5, c = 502,3 pm, Z = 2, zichligi 9,34 g/sm³. ' +
        'Har bir Pb²⁺ kvadrat piramida PbO₄ ning uchida turadi: 232,1 pm li to‘rtta Pb–O bog‘i bir tomonga, O²⁻ qatlamiga yo‘nalgan, boshqa tomonda esa 6s² jufti qoladi. Qatlamlar shunday taxlanganki, juftlar qatlamlar orasidagi tirqishga qaraydi: tirqish orqali Pb²⁺ ionlari orasi 384,7 pm. ' +
        'Glyotning ΔH°f −219,0 kJ/mol, massikotniki −217,3: sariq shakl 25 °C da metastabil, u glyotdan 1,7 kJ/mol yuqori.',
      equation: 'β-PbO (sariq) → α-PbO (qizil),  ΔH = −1,7 kJ/mol',
      note: 'Bo‘lak — 2×2×2 yacheyka, 63 ion; ramka chetlarida O²⁻ ionlari Pb²⁺ dan ko‘p (39 va 24), cheksiz kristallning tarkibi esa aynan PbO. Bitta Pb²⁺ yonidagi punktir — uning koordinatsion piramidasi, bog‘ tayoqchalari emas. Ion ustidagi 6s² jufti nuqtalari — «juftning bo‘rtib chiqishi» maktab sxemasi: Walsh va hammualliflar (2011) hisoblariga ko‘ra, asimmetriyani Pb 6s ning O 2p bilan bog‘lamaydigan aralashuvi yaratadi, uni Pb 6p aralashmasi barqarorlashtiradi. Bu yerda bir xil Pb²⁺ ionlari tirqish orqali qo‘shni — qatlamli tuzilish uchun bu odatiy: har bir ion baribir faqat qarama-qarshi ionlar bilan o‘ralgan. Massikotning glyotga qayta qurilishi shartli ko‘rsatilgan — bir bo‘lak parchalanadi, boshqasi o‘sadi. Qizil ramka — glyot rangi; sharlarning qizil rangi — O atomining CPK rangi, u sariq massikotda ham shunday bo‘lardi. Yacheyka Wyckoff (1963) bo‘yicha, boshqa ishlarda a pikometrning o‘ndan bir ulushlari qadar farq qiladi; 384,7 pm tirqish shu yacheyka va z(Pb) dan qayta hisoblangan.',
      speak: 'Sovitilganda qizil glyot hosil bo‘ladi: qatlamlar, ular orasida olti es juftlari.',
    },
    energy: {
      title: 'Energetik yakun',
      body:
        'Born — Gaber sikli bosqichlarini qo‘shamiz: +195,2 (sublimatsiya) + 249,2 (dissotsiatsiya) + 715,6 + 1450,5 (ionlanish) − 141,0 + 744,0 (ikki elektron birikishi) − 3432,5 (panjara) = −219,0 kJ bir mol PbO ga — glyotning jadvaldagi hosil bo‘lish issiqligi. ' +
        'Panjara bosqichisiz yig‘indi +3213,5 kJ/mol bo‘lardi. 2 Pb + O₂ tenglamasiga 438,0 kJ ajraladi. ' +
        'PbO — amfoter oksid: u kislotalarda ham (PbO + 2 HNO₃ → Pb(NO₃)₂ + H₂O), ishqorlarda ham (PbO + 2 NaOH + H₂O → Na₂[Pb(OH)₄]) eriydi.',
      equation: '2 Pb (qat.) + O₂ (gaz) → 2 PbO (qat., glyot),  ΔH = −438,0 kJ',
      note: 'Panjara energiyasi hech bir modda uchun, hatto NaCl uchun ham bevosita o‘lchanmaydi: u sikldan chiqariladi. Bu yerda ham −3432,5 kJ/mol bosqichi siklning o‘zidan olingan, shuning uchun yig‘indi jadval bilan tuzilishiga ko‘ra mos keladi. PbO uchun sikl boshqa sababga ko‘ra FORMAL: Pb–O bog‘i ko‘p jihatdan kovalent, ion formulalari (Born — Lande, Kapustinskiy) sikl bilan mos kelmaydi va «panjara» bosqichi bu yerda shartli. Ma’lumotnomalarda (CRC) PbO uchun sezilarli kattaroq panjara energiyasi keltirilgan — farq deyarli butunlay EA₂(O) tanlovidan. EA₂(O) = +744 qiymati MgO va CaO panjaralari bilan kelishilgan; adabiyotda sezilarli kattaroq qiymatlar ham uchraydi va ular bilan birga panjara bosqichi ham «suzadi». Yakun 298 K ga — qattiq qo‘rg‘oshin va glyotga tegishli; haqiqiy sintez 489 °C dan yuqorida suyuqlanmada boradi, u yerda issiqlik effekti biroz boshqacha, lekin 298 K dagi ΔH° — holat funksiyasi va yo‘lga bog‘liq emas. Darslikda PbO yondirish bilan emas, qo‘rg‘oshin nitratini parchalash bilan olinadi: 2 Pb(NO₃)₂ → 2 PbO + 4 NO₂ + O₂, ΔH = +598,6 kJ — reaksiya endotermik va faqat qizdirilganda boradi.',
      speak: 'Yakun: qo‘rg‘oshin oksidining bir moliga minus ikki yuz o‘n to‘qqiz kilojoul.',
    },
  },
  legend: {
    electron: 'Izli va e⁻ belgili havorang nuqta — o‘tayotgan elektron.',
    orbitalPhase: 'Atom yonidagi havorang nuqtalar — valent elektronlar: Pb da 6s² jufti va ikkita 6p, O da oltita; Pb²⁺ da 6s² jufti qoladi, O²⁻ da — sakkizta. Bu elektronlar soni, orbital shakli emas.',
  },
  safety: 'Qo‘rg‘oshin va uning barcha birikmalari zaharli: ular organizmda to‘planib, asab tizimini shikastlaydi. Qo‘rg‘oshin oksidi changi va bug‘lari ayniqsa xavfli, qo‘rg‘oshin nitrati parchalanganda esa zaharli NO₂ ajraladi. Tajriba faqat virtual ko‘rsatiladi.',
  energy: {
    title: 'Formal Born — Gaber sikli',
    unit: 'kJ/mol',
    caption: '1 mol PbO ga sarflar (yuqoriga) va yutuq (pastga); sikl formal — PbO dagi bog‘ ko‘p jihatdan kovalent.',
    stages: {
      sublimation: 'Pb (qat.) → Pb (gaz)',
      dissociation: '½ O₂ → O',
      ionization1: 'Pb → Pb⁺ + e⁻',
      ionization2: 'Pb⁺ → Pb²⁺ + e⁻',
      affinity1: 'O + e⁻ → O⁻',
      affinity2: 'O⁻ + e⁻ → O²⁻',
      lattice: 'Pb²⁺ + O²⁻ → PbO (qat.)',
      total: 'Yakun: ΔH°f',
    },
    summary: 'PbO uchun formal Born — Gaber sikli: bosqichlar yig‘indisi {dH} kJ/mol',
    sources: 'Ma’lumotnoma qiymatlari: NIST-JANAF, CRC Handbook; panjara bosqichi sikldan chiqarilgan.',
  },
}
