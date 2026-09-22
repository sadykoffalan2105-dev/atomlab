import type { Sio2MechanismText } from './sio2MechanismText'

/** O‘zbekcha dars matni: Si + O₂ → SiO₂. Har bir son rus matni va ma’lumotlar yadrosi bilan bir xil. */
export const SIO2_TEXT_UZ: Sio2MechanismText = {
  intro: {
    title: 'Atom kristall: SiO₂',
    speak: 'Nima uchun kremniy oksidi tosh, uglerod oksidi esa gaz ekanini ko‘ramiz.',
  },
  steps: {
    reactants: {
      title: 'Boshlang‘ich moddalar',
      body:
        'Markazda — kristall kremniyning bitta elementar yacheykasi: olmossimon panjara (Fd-3m), qirrasi a = 543,1 pm. ' +
        'Har bir Si atomi to‘rtta qo‘shnisi bilan uzunligi 235,2 pm bo‘lgan oddiy σ-bog‘lar Si–Si orqali bog‘langan — olmosdagi uglerod kabi tetraedr uchlari bo‘ylab. ' +
        'O‘ngda va chapda — ikkita kislorod molekulasi O₂: qo‘sh bog‘ O=O, 120,75 pm (rₑ), ikkita juftlashmagan elektron (triplet). 25 °C da kremniy — qattiq modda, kislorod — gaz.',
      equation: 'Si (qat.) + O₂ (gaz)',
      note:
        'Butun kristallning bitta yacheykasi ko‘rsatilgan; Si–Si bog‘lari naycha qilib chizilgan, chunki kremniy metall emas, atom (kovalent) kristall. ' +
        'Sharlar — Kordero kovalent radiuslari (Si 111 pm, O 66 pm), 0,72 ulushda: to‘liq radiusda qo‘shni atomlar bog‘larni yopib qo‘yardi. ' +
        'Tetraedr quradigan bitta Si atomiga ikkita O₂ molekulasi olingan: karkasdagi har bir O atomi ikkita Si uchun umumiy, shuning uchun SiO₂ formulasiga aynan bitta O₂ molekulasi to‘g‘ri keladi. Yacheyka bog‘lari O atomlari turadigan joyga qarab turishi uchun burilgan.',
      speak: 'Markazda kremniy kristali, yonlarida kislorod molekulalari. Kremniy olmos kabi tuzilgan: har bir atomning to‘rtta qo‘shnisi bor.',
    },
    surface: {
      title: 'Sirt yonidagi kislorod',
      body:
        'Kislorod kremniy sirtiga yaqinlashadi va O=O bog‘i gomolitik uziladi: har bir O atomi ikkitadan juftlashmagan elektron olib ketadi. ' +
        'Havoda kremniy doimo o‘zining qalinligi 1–2 nm bo‘lgan amorf SiO₂ pardasi bilan qoplangan, kislorod kremniyga shu parda orqali o‘tishi kerak — shuning uchun 25 °C da oksidlanish deyarli to‘xtaydi, qalin oksid esa faqat kislorod yoki suv bug‘ida qizdirib o‘stiriladi. ' +
        'O₂ ni atomlarga formal ajratishga 2 × 249,2 = 498,4 kJ/mol O₂ sarflanadi.',
      equation: 'O₂ (gaz) → 2 O',
      note:
        'Oksid pardasi kadrda chizilmagan: 1–2 nm ko‘rsatilgan butun yacheykadan (0,54 nm) qalinroq, u atomlarni yopib qo‘yardi. ' +
        'Kremniy kristallining qolgan qismi kadrdan olib tashlangan, bitta Si atomi va uning to‘rtta qo‘shnisi qolgan — kislorod ularning bog‘lariga o‘tiradi. ' +
        'Atomar kislorod — ikkita juftlashmagan elektronli O(³P), shuning uchun har bir O atomida oltita valent nuqta bor: ikkita juft va ikkita yakka. O₂ ning atomlarga ajralishi — Gess qonuni bosqichi: haqiqiy sirtda kislorod gazga uchib chiqmasdan kremniy bog‘lari bo‘ylab tarqaladi.',
      speak: 'Kislorod molekulasi sirt yonida atomlarga ajraladi. Kremniy yupqa oksid pardasi bilan qoplangan — shuning uchun xona haroratida u deyarli oksidlanmaydi.',
    },
    insertion: {
      title: 'To‘rtta Si–O bog‘i',
      body:
        'O atomi Si–Si bog‘i orasiga kiradi: shu bog‘ning umumiy jufti va kislorodning ikkita juftlashmagan elektroni ikkita σ-bog‘ Si–O hosil qiladi, Si–O–Si ko‘prigi paydo bo‘ladi. ' +
        'Bu to‘rt marta — Si atomining bog‘lari soniga ko‘ra takrorlanadi: markaziy kremniy to‘rtta O atomi bilan bog‘lanadi, Si–O bog‘ining o‘rtacha uzunligi 160,9 pm (kvarsda — 160,5 va 161,4 pm). ' +
        'Bog‘ qutbli: O ning elektrmanfiyligi 3,44, Si niki 1,9 (farqi 1,54), umumiy juftlar kislorod tomon siljigan — O da qisman zaryad δ−, Si da δ+. Si–O bog‘i Si–Si dan 2,1 marta mustahkam: 464,8 ga qarshi 225,0 kJ/mol.',
      equation: 'Si–Si + O → Si–O–Si  (×4)',
      note:
        'Qo‘shni Si atomlari uzoqlashadi: Si–O–Si ko‘prigi Si–Si bog‘idan uzunroq, shuning uchun oksid o‘zi o‘sib chiqqan kremniydan ko‘proq joy egallaydi. ' +
        'To‘rtta kirish bitta atom atrofida ketma-ket ko‘rsatilgan — haqiqiy Si/SiO₂ chegarasida ular butun oksidlanish fronti bo‘ylab boradi. ' +
        'δ+ va δ− belgilari — qisman zaryadlar: SiO₂ — qutbli kovalent karkas, unda Si⁴⁺ va O²⁻ ionlari yo‘q, shuning uchun sharlar radiusi ion emas, kovalent. Ko‘prik O dagi nuqtalar — ikkita bo‘linmagan juft, kislorodning yana ikkita elektroni Si–O bog‘lariga o‘tgan.',
      speak: 'Kislorod atomi ikkita kremniy atomi orasiga kiradi. To‘rt marta — va kremniyda kislorod bilan to‘rtta bog‘ bor.',
    },
    tetrahedra: {
      title: 'SiO₄ tetraedri',
      body:
        'Si atrofidagi to‘rtta O atomi tetraedr uchlarida turadi: O–Si–O burchagi 109,5°. Har bir O — ikkita SiO₄ tetraedrining umumiy uchi, Si–O–Si burchagi 143,7°; bitta Si atomiga 4 × ½ = 2 ta O atomi to‘g‘ri keladi — SiO₂ formulasi shundan, garchi alohida SiO₂ molekulasi bo‘lmasa ham. ' +
        'Nega CO₂ kabi O=Si=O molekulasi emas? Uglerodda ikkita qo‘sh bog‘ to‘rtta oddiy bog‘dan foydaliroq: 2 × 799 = 1598 ga qarshi 4 × 358 = 1432 kJ/mol — va CO₂ alohida molekulalardan iborat gaz bo‘lib qoladi. ' +
        'Kremniyda to‘rtta σ-bog‘ Si–O 4 × 464,8 = 1859,2 kJ/mol beradi, π-bog‘ Si=O esa kuchsiz: yirik Si atomining 3p-orbitali kislorodning 2p-orbitali bilan yomon qoplanadi. Shuning uchun kremniy cheksiz karkas quradi va SiO₂ — qattiq tosh.',
      equation: 'n Si + 2n O → (SiO₂)ₙ',
      note:
        'Yonidagi CO₂ — taqqoslash molekulasi, u faqat shu qadamda ko‘rinadi. Bog‘ energiyalari — o‘rtacha jadval qiymatlari (C–O — spirtlar va efirlarda, C=O — CO₂ ning o‘zida), shuning uchun taqqoslash taxminiy. ' +
        'Si=O qo‘sh bog‘ining energiyasi faqat alohida gaz molekulalari uchun ma’lum — karkasda bunday bog‘ yo‘q, biz uni son bilan belgilamaymiz. Punktir — bog‘lar emas, tetraedr qirralari (O···O).',
      speak: 'Kislorod tetraedr uchlarida turadi, har bir uch ikkita tetraedr uchun umumiy. Kremniyning kislorod bilan to‘rtta oddiy bog‘i qo‘sh bog‘lardan foydaliroq — shuning uchun gaz emas, tosh hosil bo‘ladi.',
    },
    quartz: {
      title: 'α-kvars karkasi',
      body:
        'Tetraedrlar uchlari bilan tartibli bog‘lansa, α-kvars hosil bo‘ladi — 25 °C da SiO₂ ning barqaror shakli: fazoviy guruh P3₂21, yacheyka a = 491,6 pm, c = 540,5 pm, Z = 3, zichligi 2,646 g/sm³. ' +
        'Har bir Si ni to‘rtta O, har bir O ni ikkita Si o‘rab turadi: koordinatsion sonlar 4:2. Tetraedrlar 3₂ vint o‘qlari atrofida spiral zanjirlarga buralgan. ' +
        'Lekin muhim: kremniy to‘g‘ridan-to‘g‘ri oksidlanganda AMORF SiO₂ o‘sadi — o‘sha tetraedrlar uzoq tartibsiz bog‘langan (oksidning bunday o‘sishini Dil — Grouv modeli tavsiflaydi), kvars kristallari esa suyuqlanmadan yoki yer qa’ridagi issiq suvli eritmalardan (gidrotermal) o‘sadi.',
      equation: 'Si (qat.) + O₂ (gaz) → SiO₂ (qat.)',
      note:
        'Kadrda 2×2×2 elementar yacheykadan iborat fragment — 86 atom; och chiziqlar — yacheyka qirralari, punktir — bitta spiral zanjir. α-kvars karkasi SiO₂ ning barqaror shakli sifatida ko‘rsatilgan; kremniyning o‘zida oksid amorf. ' +
        'Kvarsning ko‘zgudagi egizagida vint o‘qlari 3₁ — bu boshqa enantiomorf. Fragment chetidagi atomlar uzilgandek ko‘rinadi: kristallda ularning kadrdan tashqarida qo‘shnilari bor.',
      speak: 'Tetraedrlardan tuzilgan tartibli karkas — bu kvars. Lekin kremniyda oksid amorf o‘sadi, kvars kristallari esa suyuqlanma va issiq eritmalardan o‘sadi.',
    },
    energy: {
      title: 'Energetik yakun',
      body:
        'Bir mol SiO₂ uchun Gess qonuni bosqichlarini qo‘shamiz: +450,0 (Si atomizatsiyasi) + 498,4 (2 ta O atomi) − 1859,2 (4 ta Si–O bog‘i) = −910,8 kJ/mol; α-kvarsning jadvaldagi hosil bo‘lish issiqligi −910,7 kJ/mol. ' +
        'Barcha sarflar — 948,4 kJ/mol, to‘rtta Si–O bog‘i esa deyarli ikki barobar ko‘p qaytaradi. ' +
        'Karkasni faqat butun kristall bo‘ylab Si–O bog‘larini uzib buzish mumkin, shuning uchun kvars qattiq va qiyin suyuqlanadi, ftorid kislotadan boshqa kislotalar unga ta’sir qilmaydi: SiO₂ + 4 HF → SiF₄↑ + 2 H₂O.',
      equation: 'Si (qat.) + O₂ (gaz) → SiO₂ (qat.),  ΔH = −910,7 kJ',
      note:
        'Kremniy atomizatsiyasi (+450,0) — Gess qonunining formal bosqichi: oksidlanishda erkin Si atomlari bo‘lmaydi. Bosqichlar yig‘indisi jadvaldagi ΔH°f dan 0,1 kJ/mol ga farq qiladi — bu Si–O bog‘i o‘rtacha energiyasining (464,8) o‘ndan birgacha yaxlitlanishi. ' +
        'Formal elektron balans: Si⁰ − 4e⁻ → Si⁺⁴, O₂⁰ + 4e⁻ → 2 O⁻² — bu ion zaryadlari emas, oksidlanish darajalari; haqiqiy qisman zaryadlar — δ+ va δ−. Sharlar kovalent radiusning 0,72 ulushida chizilgan; tetraedr punktiri — yo‘naltiruvchi chiziq, nurlanish emas.',
      speak: 'Yakun: mol uchun minus to‘qqiz yuz o‘n kilojoul. Energiyani kremniyning kislorod bilan to‘rtta mustahkam bog‘i beradi.',
    },
  },
  legend: {
    electron: 'O atrofidagi havorang nuqtalar — Lyuis bo‘yicha valent elektronlar: O atomida oltita, ko‘prik O da to‘rtta (ikkita bo‘linmagan juft).',
    orbitalPhase: 'Naychalar — σ-bog‘lar; O=O va C=O o‘qi ustida va ostidagi yarim shaffof bo‘laklar — π-bog‘lar; punktir — SiO₄ tetraedri qirralari va spiral zanjir.',
  },
  safety:
    'Tajribani mustaqil takrorlamang: kremniy kislorodda faqat kuchli qizdirilganda yonadi, kremniy va kvarsning mayda changi o‘pkaga zararli (silikoz). Shisha va kvarsni eritadigan ftorid kislota HF juda zaharli va teri orqali o‘tadi — u bilan faqat mutaxassis ishlashi mumkin.',
  energy: {
    title: 'Gess sikli',
    unit: 'kJ/mol',
    caption: '1 mol SiO₂ uchun sarflar (yuqoriga) va yutuq (pastga); bosqichlar yig‘indisi — hosil bo‘lish issiqligi.',
    stages: {
      atomization: 'Si (qat.) → Si (gaz)',
      dissociation: 'O₂ → 2 O',
      bonds: 'Si + 2 O → SiO₂ (4 Si–O)',
      total: 'Yakun: ΔH°f',
    },
    summary: 'SiO₂ uchun Gess sikli: bosqichlar yig‘indisi {dH} kJ/mol',
    sources: 'Ma’lumotnoma qiymatlari: NIST-JANAF, CRC Handbook; Si–O bog‘i energiyasi α-kvars atomizatsiyasidan chiqarilgan.',
  },
}
