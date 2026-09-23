import type { NaclMechanismText } from './naclMechanismText'

export const NACL_TEXT_UZ: NaclMechanismText = {
  intro: {
    title: 'Ion bogʻlanish',
    speak: 'Natriy va xlor qanday qilib osh tuziga aylanishini koʻramiz: elektron bir atomdan boshqasiga oʻtadi.',
  },
  steps: {
    reactants: {
      title: 'Dastlabki moddalar',
      body:
        'Chapda — metall natriyning bitta elementar katagi: hajmiy markazlashgan kubik panjara (HMK, Im-3m), katak qirrasi a = 429,1 pm, har bir atomning sakkizta eng yaqin qoʻshnisi 371,6 pm masofada. ' +
        'Oʻngda — xlor molekulasi Cl₂: ikki atom bitta umumiy elektron jufti bilan bogʻlangan (σ-bogʻ), bogʻ uzunligi 198,8 pm. ' +
        'Metalldagi natriy atomining radiusi 186 pm, xlorning kovalent radiusi 102 pm (Cl–Cl bogʻ uzunligining yarmi 99,4 pm — farq maʼlumotnoma tarqoqligi doirasida). 25 °C da xlor — gaz, natriy — qattiq metall.',
      equation: '2 Na (q.) + Cl₂ (g.)',
      note: 'Xlor reaksiyaga Cl₂ MOLEKULASI holida kirishadi — ballonda yakka xlor atomlari yoʻq. Natriy shari xlor sharidan kattaroq chizilgan va bu maʼlumotlarga mos: 186 pm — metall radius (metalldagi atom), 102 pm — kovalent radius (molekuladagi atom). Bular TURLI xil radiuslar: ular oʻlchamlar tartibini koʻrsatadi, bir xil oʻlchangan atomlarni solishtirmaydi. Natriy atrofidagi och chiziqlar — elementar katak qirralari, bogʻlar emas; metall xira — natriy havoda tez xiralashadi.',
      speak: 'Chapda metall natriy katagi, oʻngda xlor molekulasi. Xlor doim ikki atomli.',
    },
    sublimation: {
      title: 'Sublimatsiya va dissotsiatsiya',
      body:
        'Reaksiya boshlanishi uchun zarrachalarni ozod qilish kerak. Natriy atomi metalldan uziladi — bunga har mol uchun 107,3 kJ sarflanadi (sublimatsiya). ' +
        'Cl–Cl bogʻi gomolitik uziladi: umumiy juft teng boʻlinadi, har bir atomga bittadan elektron tegadi. Yarim mol Cl₂ uchun 121,3 kJ ketadi — bu atom holidagi xlorning 298 K dagi maʼlumotnomadagi hosil boʻlish issiqligi ΔH°f(Cl, gaz). ' +
        'Har ikkala bosqich endotermik — energiya zinapoyasi yuqoriga koʻtariladi.',
      equation: 'Na (q.) → Na (g.);  ½ Cl₂ (g.) → Cl (g.)',
      note: 'Metallning bitta katagi chizilgan: ikki atom reaksiyaga ketadi, qolganlari kadrdan chiqadi — haqiqiy natriy boʻlagida atomlar soni 10²³ ga yaqin. Qadam oxirida valent nuqtalar paydo boʻladi — elektron oʻtishidan oldingi holat: Na da bitta, Cl da yettita.',
      speak: 'Natriy atomi metalldan chiqadi, xlor molekulasidagi bogʻ teng ikkiga boʻlinadi. Ikkalasi ham energiya talab qiladi.',
    },
    transfer: {
      title: 'Elektronni berish va olish',
      body:
        'Natriyning yagona tashqi elektroni (3s¹) xlor atomiga oʻtadi: uni uzib olishga 495,8 kJ/mol sarflanadi (ionlanish energiyasi). ' +
        'Natriy butun tashqi qatlamini yoʻqotadi va 186 pm dan 102 pm gacha kichrayadi — bu Na⁺ kationi. Xlor sakkizinchi elektronni oladi, oktetni toʻldiradi va 102 pm dan 181 pm gacha kattalashadi: Cl⁻ anioni Na⁺ dan taxminan 1,8 marta yirik. ' +
        'Elektron qoʻshilishi energiya ajratadi: Δ_eg H = −348,6 kJ/mol. IUPAC yozuvida xuddi shu kattalik elektronga moyillik deb ataladi va musbat ishora bilan yoziladi: +348,6 kJ/mol — jarayon bitta, faqat ishora kelishuvi boshqacha.',
      equation: 'Na⁰ − 1e⁻ → Na⁺  (×2);  Cl⁰ + 1e⁻ → Cl⁻  (×2)',
      note: 'Atomlar atrofidagi nuqtalar — Lyuis boʻyicha valent elektronlar soni (Na da bitta, Cl da yettita, Cl⁻ da sakkizta), ularning joylashuvi emas. Elektronning yoy boʻylab «uchishi» va sekinlashtirilgan vaqt — shartli: oʻtish kvant sakrashi. Donor yozuvi elektron KETGAN kadrda Na⁺ ga oʻzgaradi — zaryad aynan shunda paydo boʻladi (Na → Na⁺ + e⁻ — bu ionlanishning oʻzi), shuning uchun elektron uchayotganda kadrda Na⁺ + e⁻ + Cl turadi va zaryadlar yigʻindisi nolga teng. Na va Cl ning oʻlchami va rangi keyinroq, yutilish onida va bir vaqtda oʻzgaradi — ikki zarrachaning oʻzgarishi bitta hodisa boʻlib oʻqilsin. Ikkinchi oʻtish — birinchisining ikkinchi atomlar jufti uchun takrori. Bu yerda turli xil radiuslar solishtiriladi: Na ning metall radiusi va Cl ning kovalent radiusi Shennonning ion radiuslari bilan; tendensiya toʻgʻri, lekin sonlar turli shkalalardan olingan.',
      speak: 'Natriy bitta elektron beradi va kichrayadi. Xlor elektronni oladi va kattalashadi.',
    },
    attraction: {
      title: 'Elektrostatik tortishish',
      body:
        'Qarama-qarshi zaryadlar Kulon qonuni boʻyicha tortishadi: kuch masofa kvadratiga teskari proporsional. ' +
        'Na⁺ va Cl⁻ tortishish toʻlgan elektron qobiqlarning itarilishi bilan muvozanatlashguncha yaqinlashadi. Yakka gaz holidagi NaCl molekulasida bu muvozanat masofasi 236,1 pm. ' +
        'Ion bogʻlanish shu: umumiy juft emas, balki butun zaryadlarning tortishishi.',
      equation: 'Na⁺ (g.) + Cl⁻ (g.) → Na⁺Cl⁻ (g.),  rₑ = 236,1 pm',
      note:
        'Shennonning KS 6 dagi ion (effektiv) radiuslari yigʻindisi 102 + 181 = 283 pm, bu 236,1 pm dan katta: gaz juftining sferalari 47 pm ga ustma-ust tushadi. Bu xato emas — gazda ionlar bir-birini qutblaydi, Shennonda esa yakka juft uchun radiuslar yoʻq. Bu qadamda sharlar Shennonning toʻliq radiusida chizilgan (1–3-qadamlarda radiusning 0,72 qismida), shuning uchun ustma-ust tushish koʻrinadi: Na⁺ sharining yaqin choragi Cl⁻ sferasi ichiga kiradi — 46,9 pm, uning 204 pm diametridan. ' +
        'Kristallda xuddi shu juft 282,0 pm masofada turadi (5-qadam). Nuqtali yoylar — maydon chiziqlarining sxemasi; son-sanoqsiz juft oʻrniga ikkita juft — soddalashtirish.',
      speak: 'Plyus va minus tortishadi. Gaz holidagi tuz molekulasida ionlar ikki yuz oʻttiz olti pikometrgacha yaqinlashadi.',
    },
    lattice: {
      title: 'Kristall panjara',
      body:
        'Bitta juft bilan ish tugamaydi: har bir ion barcha qoʻshnilarini tortadi. Ionlar tosh tuzi panjarasiga joylashadi — fazoviy guruh Fm-3m, ikkita yoqlari markazlashgan kubik (YMK) ost-panjara, katak qirrasi a = 564,0 pm, Z = 4, maʼlumotnomadagi zichlik 2,165 g/sm³. ' +
        'Har bir Na⁺ ning oktaedr uchlarida oltita Cl⁻ qoʻshnisi bor, har bir Cl⁻ ning esa oltita Na⁺: koordinatsion son 6:6. Oltita qoʻshnining toʻlgan qobiqlari itarilishi qoʻshiladi, shuning uchun kristallda muvozanat gazdagidan uzoqroqda yuzaga keladi: 282,0 pm (gazda 236,1 pm edi). ' +
        'Gaz holidagi ionlardan panjaraning yigʻilishi 787,0 kJ/mol ajratadi.',
      equation: 'Na⁺ (g.) + Cl⁻ (g.) → NaCl (q.),  U = −787,0 kJ/mol',
      note: 'Kadrda 3×3×3 elementar katakdan iborat boʻlak — 343 ta ion, har qirrada 7 tadan; och chiziqlar — katak qirralari, bogʻlar emas. Yarim shaffof oktaedrlar — ikki tanlangan ion atrofi: Na⁺ atrofida oltita Cl⁻, Cl⁻ atrofida oltita Na⁺ (KS 6:6). Oktaedrning boʻyogʻi va konturi — ATROF KOʻPYOQLIGINING yoqlari va qirralari, bogʻlar emas: ion panjarasida bogʻ yoʻq. Oktaedrlar koʻrsatilayotganda qolgan ionlar soʻndiriladi — oltita qoʻshnini sanash mumkin. Panjara sharlari radiusning 0,5 qismida chizilgan, toki boʻlak orqali qirralar koʻrinsin: haqiqiy kristallda qoʻshni ionlar bir-biriga tegib turadi (102 + 181 = 283 ≈ 282,0 pm). Bir millimetrli tuz donasida ionlar soni 10¹⁹ ga yaqin.',
      speak: 'Ionlar kubik panjara hosil qiladi. Har bir ionning qarama-qarshi ishorali oltita qoʻshnisi bor.',
    },
    energy: {
      title: 'Energiya yakuni',
      body:
        'Born — Haber siklining barcha bosqichlarini qoʻshamiz: +107,3 (sublimatsiya) + 121,3 (dissotsiatsiya) + 495,8 (ionlanish) − 348,6 (elektron qoʻshilishi) − 787,0 (panjara) = har mol NaCl uchun −411,2 kJ — aynan jadvaldagi hosil boʻlish issiqligi. ' +
        'Panjara energiyasisiz dastlabki toʻrt bosqich yigʻindisi +375,8 kJ/mol boʻlar edi, yaʼni jarayon issiqlik yutgan boʻlardi. ' +
        'Reaksiyani ekzotermik qiladigan narsa aynan panjara energiyasi: 2 Na + Cl₂ tenglamasi boʻyicha 822,4 kJ ajraladi.',
      equation: '2 Na (q.) + Cl₂ (g.) → 2 NaCl (q.),  ΔH = −822,4 kJ',
      note:
        'Tenglamaning elektron balansi: 2 Na⁰ − 2e⁻ → 2 Na⁺, Cl₂⁰ + 2e⁻ → 2 Cl⁻ — qancha elektron berilsa, shuncha olinadi. ½ Cl₂ → Cl bosqichi ΔH°f(Cl, gaz) = 121,3 kJ/mol ga teng olingan (298 K, NIST-JANAF) — u bilan sikl aniq yopiladi. Maktab jadvallari Cl–Cl bogʻ energiyasining (243 kJ/mol) yarmini oladi — 121,5, unda yigʻindi −411,0 chiqadi. Panjara bosqichi −787,0 kJ/mol — sikl aynan yopiladigan qiymat; maʼlumotnomadagi qiymatlar 786–788 kJ/mol oraligʻida. Qatʼiy aytganda, bu 298 K dagi panjara entalpiyasi: panjara energiyasi U undan taxminan 2RT ≈ 5 kJ/mol ga farq qiladi. ' +
        'Natriy xlorda yorqin sariq alanga bilan yonadi — bu metall ustidagi qoʻzgʻalgan natriy atomlarining nuri (D chizigʻi, 589 nm), tuzning rangi emas; 3D da alanga chizilmaydi.',
      speak: 'Yakun: har mol tuz uchun minus toʻrt yuz oʻn bir kilojoul. Energiyani kristall panjara beradi.',
    },
  },
  legend: {
    electron: 'Izli va e⁻ belgili koʻk nuqta — oʻtayotgan elektron.',
    orbitalPhase: 'Atom atrofidagi koʻk nuqtalar — Lyuis boʻyicha valent elektronlar: Na da bitta (3s¹), Cl da yettita, Cl⁻ da sakkizta. Bu elektronlar soni, orbital shakli emas.',
  },
  safety: 'Xlor zaharli, natriy suvdan olov oladi. «Natriy xlorda» tajribasini faqat oʻqituvchi tortuv shkafida koʻrsatadi — uni mustaqil takrorlash mumkin emas.',
  energy: {
    title: 'Born — Haber sikli',
    unit: 'kJ/mol',
    caption: '1 mol NaCl uchun sarf (yuqoriga) va yutuq (pastga); bosqichlar yigʻindisi — hosil boʻlish issiqligi.',
    stages: {
      sublimation: 'Na (q.) → Na (gaz)',
      dissociation: '½ Cl₂ → Cl',
      ionization: 'Na → Na⁺ + e⁻',
      affinity: 'Cl + e⁻ → Cl⁻',
      lattice: 'Na⁺ + Cl⁻ → NaCl (q.)',
      total: 'Yakun: ΔH°f',
    },
    summary: 'NaCl uchun Born — Haber sikli: bosqichlar yigʻindisi {dH} kJ/mol',
    sources: 'Maʼlumotnoma qiymatlari: NIST-JANAF, CRC Handbook (panjara energiyasi — Born — Haber sikli boʻyicha).',
  },
}
