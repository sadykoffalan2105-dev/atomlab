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
        'Chapda — metall natriy boʻlagi: Na atomlari hajmiy markazlashgan kubik panjarada (HMK, Im-3m) turadi, har birining sakkizta eng yaqin qoʻshnisi 371,6 pm masofada. ' +
        'Oʻngda — xlor molekulasi Cl₂: ikki atom bitta umumiy elektron jufti bilan bogʻlangan, bogʻ uzunligi 198,8 pm. ' +
        'Metalldagi natriy atomining radiusi 186 pm, xlor atomining kovalent radiusi 102 pm (Cl–Cl bogʻ uzunligining yarmi 99 pm — farq maʼlumotnoma tarqoqligi doirasida). 25 °C da xlor — gaz, natriy — qattiq metall.',
      equation: '2 Na (q.) + Cl₂ (g.)',
      note: 'Xlor reaksiyaga aynan Cl₂ MOLEKULASI holida kirishadi, alohida atomlar holida emas: ballonda yakka xlor atomlari yoʻq.',
      speak: 'Chapda metall natriy, oʻngda xlor molekulasi. Xlor doim ikki atomli.',
    },
    sublimation: {
      title: 'Sublimatsiya va dissotsiatsiya',
      body:
        'Reaksiya boshlanishi uchun zarrachalarni ozod qilish kerak. Natriy atomi metall panjaradan uziladi — bunga har mol uchun 107,3 kJ sarflanadi (sublimatsiya). ' +
        'Cl–Cl bogʻi gomolitik uziladi: umumiy juft teng boʻlinadi, har bir atomga bittadan elektron tegadi. Yarim mol Cl₂ uchun 121,7 kJ ketadi. ' +
        'Har ikkala bosqich endotermik — energiya zinapoyasi yuqoriga koʻtariladi.',
      equation: 'Na (q.) → Na (g.);  ½ Cl₂ (g.) → Cl (g.)',
      note: 'Metallning atigi toʻqqiz atomli boʻlagi chizilgan; haqiqiy natriy boʻlagida ularning soni 10²³ ga yaqin.',
      speak: 'Natriy atomi metalldan chiqadi, xlor molekulasidagi bogʻ teng ikkiga boʻlinadi. Ikkalasi ham energiya talab qiladi.',
    },
    transfer: {
      title: 'Elektronni berish va olish',
      body:
        'Natriyning yagona tashqi elektroni (3s¹) xlor atomiga oʻtadi: uni uzib olishga 495,8 kJ/mol sarflanadi (ionlanish energiyasi). ' +
        'Natriy butun bir elektron qatlamini yoʻqotadi va 186 pm dan 102 pm gacha kichrayadi — bu endi Na⁺ kationi. ' +
        'Xlor tashqi elektronlar sakkizligini toʻldiradi va 102 pm dan 181 pm gacha kattalashadi: Cl⁻ anioni Na⁺ dan taxminan 1,8 marta yirik. Elektron qoʻshilishi 349 kJ/mol ajratadi.',
      equation: 'Na⁰ − 1e⁻ → Na⁺  (×2);  Cl₂⁰ + 2e⁻ → 2 Cl⁻',
      note: 'Elektronning yoy boʻylab «uchishi» va natriy atrofidagi yorugʻ halqa — shartli belgilar: oʻtish kvant sakrashi, halqa esa faqat tashqi elektron qayerdaligini koʻrsatadi.',
      speak: 'Natriy bitta elektron beradi va kichrayadi. Xlor elektronni oladi va kattalashadi.',
    },
    attraction: {
      title: 'Elektrostatik tortishish',
      body:
        'Qarama-qarshi zaryadlar Kulon qonuni boʻyicha tortishadi: kuch masofa kvadratiga teskari proporsional. ' +
        'Na⁺ va Cl⁻ tortishish toʻlgan elektron qobiqlarning itarilishi bilan muvozanatlashguncha yaqinlashadi — 282 pm masofada. ' +
        'Ion bogʻlanish shu: umumiy juft emas, balki butun zaryadlarning tortishishi.',
      equation: 'Na⁺ + Cl⁻ → Na⁺Cl⁻,  d = 282 pm',
      note: 'Maydon chiziqlari nuqtalar bilan chizilgan — shunda tortishish yoʻnalishi koʻrinadi; ionlar orasida haqiqiy «iplar» yoʻq, albatta.',
      speak: 'Plyus va minus tortishadi va ikki yuz sakson ikki pikometr masofada toʻxtaydi.',
    },
    lattice: {
      title: 'Kristall panjara',
      body:
        'Bitta juft bilan ish tugamaydi: har bir ion barcha qoʻshnilarini tortadi. Ionlar tosh tuzi panjarasiga joylashadi — fazoviy guruh Fm-3m, ikkita yoqlari markazlashgan kubik (YMK) ost-panjara, katak qirrasi 564,0 pm, Z = 4, zichlik 2,165 g/sm³. ' +
        'Zaryadlar qatʼiy almashinadi, shuning uchun bir xil ishorali ionlar hech qachon qoʻshni boʻlmaydi. ' +
        'Har bir Na⁺ ning oktaedr uchlarida roppa-rosa oltita Cl⁻ qoʻshnisi bor, har bir Cl⁻ ning esa oltita Na⁺: koordinatsion son 6. Panjaraning yigʻilishi 786 kJ/mol ajratadi.',
      equation: 'Na⁺ (g.) + Cl⁻ (g.) → NaCl (q.),  U = −786 kJ/mol',
      note: 'Kadrda 4×4×4 boʻlak — 64 ta ion. Bir millimetrli tuz donasida ularning soni 10¹⁹ ga yaqin.',
      speak: 'Ionlar kubik panjara hosil qiladi. Har bir ionning qarama-qarshi ishorali oltita qoʻshnisi bor.',
    },
    energy: {
      title: 'Energiya yakuni',
      body:
        'Born — Haber siklining barcha bosqichlarini qoʻshamiz: +107,3 (sublimatsiya) + 121,7 (dissotsiatsiya) + 495,8 (ionlanish) − 348,6 (elektronga moyillik) − 787,0 (panjara) = har mol NaCl uchun −411 kJ. ' +
        'Panjara energiyasisiz dastlabki toʻrt bosqich yigʻindisi +376 kJ/mol boʻlar edi, yaʼni jarayon issiqlik yutgan boʻlardi. ' +
        'Reaksiyani ekzotermik qiladigan narsa aynan panjara energiyasi: natriy xlorda yorqin sariq alanga bilan yonadi.',
      equation: '2 Na (q.) + Cl₂ (g.) → 2 NaCl (q.),  ΔH = −822 kJ',
      note: 'Alanganing sariq rangi — qoʻzgʻalgan natriy atomlarining nuri (D chizigʻi, 589 nm), tuzning oʻz rangi emas.',
      speak: 'Yakun: har mol tuz uchun minus toʻrt yuz oʻn bir kilojoul. Energiyani kristall panjara beradi.',
    },
  },
  legend: {
    electron: 'Izli koʻk nuqta — oʻtayotgan elektron.',
    orbitalPhase: 'Natriy atrofidagi yorugʻ halqa — tashqi 3s¹ elektronning shartli belgisi, orbital shakli emas.',
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
