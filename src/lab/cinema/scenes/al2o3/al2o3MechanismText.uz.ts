import type { Al2o3MechanismText } from './al2o3MechanismText'

export const AL2O3_TEXT_UZ: Al2o3MechanismText = {
  intro: {
    title: 'Alyuminiyning yonishi',
    speak: 'Nega alyuminiy qoshiq yonmaydi, alyuminiy kukuni esa lov etib alangalanadi? Metall va kislorod qanday qilib korundga aylanishini koʻramiz.',
  },
  steps: {
    reactants: {
      title: 'Parda ostidagi alyuminiy',
      body:
        'Pastda — metall alyuminiy boʻlagi: yoqlari markazlashgan kubik panjara (YMK, Fm-3m), katak qirrasi a = 405 pm, har bir atomning 12 ta qoʻshnisi 286,3 pm masofada; Al ning metall radiusi — 143 pm. ' +
        'Metall ustidan qalinligi 2–4 nm boʻlgan tabiiy oksid pardasi bilan qoplangan — bu katakning 5–10 qirrasiga teng. Parda AMORF: undagi Al³⁺ va O²⁻ ionlari uzoq tartibsiz joylashgan, bu korund emas. ' +
        'O₂ molekulalari (qoʻsh bogʻ, 120,75 pm) parda sirtiga qoʻnadi, lekin undan oʻta olmaydi — shuning uchun alyuminiy qoshiq havoda yonmaydi.',
      equation: '4 Al (q.) + 3 O₂ (g.)',
      note:
        'Parda metall katagi bilan bir xil masshtabda, qalinlikning quyi chegarasi boʻyicha chizilgan; nam havoda eskirganda u 5 nm gacha oʻsadi. ' +
        'Ionlarning tartibsiz joylashuvi — amorf oksidning sxemasi: unda Al ning odatda toʻrt-besh O qoʻshnisi bor (AlO₄ tetraedrlari va AlO₅ piramidalari, Lee va hammualliflar), shuning uchun pardadagi Al³⁺ radiusi Shennon boʻyicha KS 4 da olingan — 39 pm, O²⁻ niki — 138 pm. ' +
        'O₂ ning «qoʻnishi» — soddalashtirish: kislorod sirtga adsorbsiyalanadi, ammo 25 °C da ionlar oksid orqali deyarli oʻtmaydi va parda oʻsishi oʻz-oʻzidan toʻxtaydi (Kabrera — Mott nazariyasi). ' +
        'Metalldagi xira iplar — metall bogʻlanishning sxemasi; metall, parda va O₂ radiusning 0,72 qismida chizilgan.',
      speak: 'Alyuminiy doim yupqa oksid pardasi bilan qoplangan. Kislorod unga qoʻnadi, lekin oʻta olmaydi.',
    },
    release: {
      title: 'Parda yorildi',
      body:
        'Alyuminiy yonishi uchun pardani buzish kerak. Qizdirilganda uning ostidagi metall suyuqlanadi (660,3 °C) va kengayadi, oksid esa qattiq qoladi — u faqat 2072 °C da suyuqlanadi — va parda yoriladi. ' +
        'Kukun va qirindi yorqin yonadi: sirt juda katta, har bir zarrachada metall kam; termitda Fe₂O₃ + 2 Al → 2 Fe + Al₂O₃ reaksiyasida 851,5 kJ ajraladi. ' +
        'Gess qonuni bosqichlari boʻyicha endi erkin atomlar kerak: 2 mol Al ni bugʻlatishga 2 · 330,0 = 660,0 kJ, 1½ mol O₂ ni 3 mol O atomiga ajratishga 3 · 249,2 = 747,6 kJ sarflanadi.',
      equation: 'Al (q.) → Al (g.);  O₂ (g.) → 2 O (g.)',
      note:
        'Parda aslida murakkabroq buziladi: qizdirilganda amorf oksid kristall shakllarga oʻtadi va yaxlitligini yoʻqotadi — bu yerdagi yoriq sxema. ' +
        'Alangada alyuminiy tomchisi qaynaydi va uning bugʻi yonadi, shuning uchun Al (g.) atomlari faqat hisob bosqichi emas. ' +
        'Kislorod atomi O(³P) oltita valent elektronga ega, ulardan ikkitasi juftlashmagan — shuning uchun har bir O da ikkita yakka nuqta bor. Qolgan metall va parda kadrdan chiqadi: haqiqiy qoshiqda atomlar soni 10²³ ga yaqin.',
      speak: 'Qizdirilganda parda yoriladi. Alyuminiy atomlari metalldan chiqadi, kislorod molekulalari atomlarga ajraladi.',
    },
    transfer: {
      title: 'Ikki Al atomidan oltita elektron',
      body:
        'Har bir alyuminiy atomi uchta tashqi elektronini (3s²3p¹) beradi va Al³⁺ ioniga aylanadi: 577,5 + 1816,7 + 2744,8 = 5139,0 kJ/mol, 2 Al uchun esa — 10 278,0 kJ. ' +
        'Uchinchi elektron eng qimmat: u allaqachon ikki karra zaryadlangan iondan uziladi. Radius 143 dan 53,5 pm gacha kamayadi. ' +
        'Har bir kislorod atomi ikkita elektron oladi: birinchisini yutuq bilan, −141,0 kJ/mol, ikkinchisini sarf bilan, +744 kJ/mol, chunki uni O⁻ zaryadi itaradi. O²⁻ ioni 66 dan 138 pm gacha kattalashadi. 12 ta elektron berildi, 12 tasi olindi.',
      equation: 'Al⁰ − 3e⁻ → Al³⁺  (×4);  O₂⁰ + 4e⁻ → 2 O²⁻  (×3)',
      note:
        'Atomlar atrofidagi nuqtalar — Lyuis boʻyicha valent elektronlar soni (Al da uchta, O da oltita, O²⁻ da sakkizta), ularning joylashuvi emas. Elektronlarning yoylar boʻylab uchishi va sekinlashtirilgan vaqt — shartli. ' +
        'Zaryad har bir elektron ketgan yoki kelgan onda oʻzgaradi, radius esa faqat Al³⁺ va O²⁻ paydo boʻlganda: Al⁺, Al²⁺ va O⁻ uchun Shennon radiuslari yoʻq, kristallarda bunday zarrachalar uchramaydi. Ion radiuslari — Shennon boʻyicha korunddagi haqiqiy KS da: Al³⁺ — KS 6, O²⁻ — KS 4. ' +
        'Bu yerdagi ishoralar — elektron qoʻshilish entalpiyalari (Δ_eg H); IUPAC yozuvida kislorodning birinchi elektronga moyilligi musbat ishora bilan yoziladi: +141,0 kJ/mol. ' +
        'Gaz holidagi O²⁻ ioni beqaror: +744 ni oʻlchab boʻlmaydi, u Born — Gaber sikllaridan olinadi va adabiyotda +844 gacha yetadi.',
      speak: 'Har bir alyuminiy uchta elektron beradi, har bir kislorod ikkitasini oladi. Ikkinchi elektronni kislorod energiya sarflab oladi.',
    },
    lattice: {
      title: 'Korund',
      body:
        'Ionlar korund α-Al₂O₃ panjarasiga joylashadi: fazoviy guruh R-3c, geksagonal katak a = 475,7 pm, c = 1298,8 pm, Z = 6, zichlik 3,99 g/sm³. ' +
        'O²⁻ ionlari geksagonal zich joylashuv hosil qiladi, Al³⁺ esa ular orasidagi oktaedrik boʻshliqlarning 2/3 qismini egallaydi. ' +
        'Har bir Al³⁺ ning oltita O²⁻ qoʻshnisi, har bir O²⁻ ning toʻrtta Al³⁺ qoʻshnisi bor: KS 6:4, formula talab qilganidek (2 · 6 = 3 · 4). Gaz holidagi ionlardan panjaraning yigʻilishi taxminan 15 170 kJ/mol ajratadi.',
      equation: '2 Al³⁺ (g.) + 3 O²⁻ (g.) → Al₂O₃ (q.),  U ≈ −15 170 kJ/mol',
      note:
        'Boʻlak — 2×2×1 elementar katak, 148 ta ion: korund katagi c boʻyicha deyarli uch marta choʻziq, 2×2×2 esa baland ustunga aylanib qolardi. Och chiziqlar — katak qirralari, bogʻlar emas. ' +
        'Panjara sharlari uzoqdagi qatlamlar koʻrinishi uchun radiusning 0,5 qismida chizilgan; haqiqiy kristallda ionlar bir-biriga tegib turadi. ' +
        'Korund suyuqlanmadan — yonishda va termitda — yoki oksid ~1000 °C dan yuqorida qizdirilganda kristallanadi; qoshiq ustida u emas, balki amorf parda bor.',
      speak: 'Ionlar korundni hosil qiladi — eng qattiq minerallardan biri.',
    },
    octahedron: {
      title: 'AlO₆ oktaedri',
      body:
        'Bitta Al³⁺ ioni va uning buzilgan oktaedr uchlaridagi oltita O²⁻ qoʻshnisi ajratib koʻrsatilgan. ' +
        'Al–O bogʻlari ikki xil uzunlikda — uchtasi 185,4 pm va uchtasi 197,1 pm: oktaedr juftlari umumiy yoq bilan tutashgan va Al³⁺ ionlari u orqali bir-birini itaradi. ' +
        'Har bir O²⁻ toʻrtta Al³⁺ dan iborat buzilgan tetraedrda joylashgan. Shennon radiuslari yigʻindisi 53,5 + 138 = 191,5 pm — aynan ikki uzunlik orasida.',
      equation: 'Al³⁺: KS 6 (AlO₆);  O²⁻: KS 4 (OAl₄)',
      note:
        'Punktir — koordinatsion koʻpyoqlarning qirralari (siyohrang — Al³⁺ atrofidagi oktaedr, pushti — O²⁻ atrofidagi tetraedr), bogʻlar emas. Al–O uzunliklari katakdagi ion koordinatalaridan hisoblangan (Kirfel va Eichhorn), qoʻlda yozilmagan. ' +
        'Yoqut va sapfir — Cr³⁺ va Fe/Ti aralashmali oʻsha korund. Alyuminiy oksidi amfoter: amorf va γ-Al₂O₃ kislotalarda ham, ishqorlarda ham eriydi, korund esa deyarli inert.',
      speak: 'Har bir alyuminiy ionining oltita kislorod qoʻshnisi, har bir kislorodning toʻrtta alyuminiy qoʻshnisi bor.',
    },
    energy: {
      title: 'Energetik yakun',
      body:
        '1 mol Al₂O₃ uchun bosqichlarni qoʻshamiz: +660,0 (2 Al ni bugʻlatish) + 10 278,0 (2 Al ni Al³⁺ gacha ionlash) + 747,6 (1½ O₂ → 3 O) − 423,0 (3 · EA₁) + 2232,0 (3 · EA₂) − 15 170,3 (panjara) = −1675,7 kJ/mol — korundning maʼlumotnomadagi hosil boʻlish issiqligi. ' +
        'Panjarasiz yigʻindi +13 494,6 kJ/mol: sarflar ulkan, ammo +3 va −2 zaryadli ionlar panjarasi koʻproq qaytaradi — uning energiyasi MgO nikidan (−3789) taxminan toʻrt marta katta. ' +
        '4 Al + 3 O₂ → 2 Al₂O₃ tenglamasi uchun 3351,4 kJ ajraladi.',
      equation: '4 Al (q.) + 3 O₂ (g.) → 2 Al₂O₃ (q.),  ΔH = −3351,4 kJ',
      note:
        'Panjara energiyasi −15 170,3 oʻlchanmagan, balki sikldan chiqarilgan: U = ΔH°f − Σ(qolgan bosqichlar). U EA₂ = +744 bilan kelishilgan — xuddi U(MgO) = −3789 kabi; boshqa EA₂ (+844 gacha) va boshqa usullar bilan adabiyotda 15 100 dan 15 900 kJ/mol gacha olinadi, shuning uchun birini ikkinchisisiz oʻzgartirib boʻlmaydi. ' +
        'Toʻrtinchi elektronni toʻlgan 2s²2p⁶ qobigʻidan uzishga toʻgʻri kelardi — bu narxni hech qanday panjara qoplay olmaydi, shuning uchun alyuminiy faqat +3. Qatʼiy aytganda, bu 298 K dagi panjara entalpiyasi. ' +
        'Alyuminiy koʻzni qamashtiruvchi oq alanga bilan yonadi, lekin 3D da olov chizilmaydi.',
      speak: 'Yakun: har mol korund uchun minus bir ming olti yuz yetmish olti kilojoul. Energiyani panjara beradi.',
    },
  },
  legend: {
    electron: 'Izli va e⁻ yozuvli havorang nuqta — oʻtayotgan elektron.',
    orbitalPhase: 'Atom atrofidagi havorang nuqtalar — Lyuis boʻyicha valent elektronlar: Al da uchta (3s²3p¹), O da oltita, O²⁻ da sakkizta. Bu elektronlar soni, orbital shakli emas.',
  },
  safety:
    'Alyuminiy kukuni yonadi va chang bulutida portlashi mumkin; termit suyuq temir va koʻz uchun xavfli koʻzni qamashtiruvchi yorugʻlik beradi. Bunday tajribalarni faqat oʻqituvchi koʻrsatadi — ochiq havoda yoki moʻrili shkafda, himoya koʻzoynagida; mustaqil takrorlash mumkin emas.',
  energy: {
    title: 'Born — Gaber sikli',
    unit: 'kJ/mol',
    caption: '1 mol Al₂O₃ uchun sarflar (yuqoriga) va yutuq (pastga); bosqichlarda zarrachalar koeffitsiyentlari — 2 Al va 3 O; bosqichlar yigʻindisi — hosil boʻlish issiqligi.',
    stages: {
      sublimation: '2 Al (q.) → 2 Al (g.)',
      ionization: '2 Al → 2 Al³⁺ + 6e⁻',
      dissociation: '1½ O₂ → 3 O',
      affinity1: '3 O + 3e⁻ → 3 O⁻',
      affinity2: '3 O⁻ + 3e⁻ → 3 O²⁻',
      lattice: '2 Al³⁺ + 3 O²⁻ → Al₂O₃ (q.)',
      total: 'Yakun: ΔH°f',
    },
    summary: 'Al₂O₃ uchun Born — Gaber sikli: bosqichlar yigʻindisi {dH} kJ/mol',
    sources: 'Maʼlumotnoma qiymatlari: CRC Handbook, NIST-JANAF; panjara energiyasi EA₂(O) = +744 da sikldan chiqarilgan.',
  },
}
