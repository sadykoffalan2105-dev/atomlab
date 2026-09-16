import type { NaclMechanismText } from './naclMechanismText'

export const NACL_TEXT_UZ: NaclMechanismText = {
  intro: {
    title: 'Ion bogʻlanish',
    speak: 'Natriy va xlor qanday qilib osh tuziga aylanishini koʻramiz: elektron bir atomdan ikkinchisiga oʻtadi.',
  },
  steps: {
    approach: {
      title: 'Atomlar yaqinlashadi',
      body:
        'Chap va oʻngda natriy atomlari: har birining tashqi qavatida bitta elektron (3s¹) bor, atom uni oson beradi. ' +
        'Oʻrtada xlor molekulasi Cl₂: ikki atom umumiy elektron juftini boʻlishadi, har biriga barqaror sakkizlikkacha bitta elektron yetishmaydi. ' +
        'Na atomining radiusi 1,86 Å, Cl atominiki 0,99 Å.',
      equation: '2 Na + Cl₂',
      speak: 'Natriy atomlari xlor molekulasiga yaqinlashadi. Natriyda bitta tashqi elektron bor, xlorga sakkizlikkacha bittasi yetishmaydi.',
    },
    homolysis: {
      title: 'Cl–Cl bogʻi uziladi',
      body:
        'Natriy yonida xlor molekulasi beqaror boʻlib qoladi: umumiy juft teng boʻlinadi — har bir xlor atomiga bittadan elektron tegadi. ' +
        'Bunday uzilish gomolitik deb ataladi. Yettitadan tashqi elektroni boʻlgan ikkita xlor atomi hosil boʻladi.',
      equation: 'Cl₂ → 2 Cl',
      note: 'Aslida natriy xlorda yonadi — bosqichlar soniyaning ulushlarida oʻtadi; bu yerda ular sekinlashtirilgan.',
      speak: 'Xlor atomlari orasidagi bogʻ teng ikkiga uziladi. Ikkita xlor atomi hosil boʻladi.',
    },
    transfer: {
      title: 'Elektron oʻtishi',
      body:
        'Natriyning yagona tashqi elektroni xlor atomiga sakraydi. Natriy Na⁺ kationiga aylandi — butun bir elektron qavatini yoʻqotib, deyarli ikki barobar kichraydi (1,02 Å). ' +
        'Xlor elektronni qabul qilib, sakkizligini toʻldirdi va Cl⁻ anioniga aylandi — atomdan sezilarli katta (1,81 Å). Ionlarning zaryadlari yozilgan.',
      equation: 'Na − e⁻ → Na⁺ ;  Cl + e⁻ → Cl⁻',
      note: 'Natriy atrofidagi yogʻdu — 3s-orbitalning shartli belgilanishi; elektron «uchmaydi», u atomlar orasida qayta taqsimlanadi.',
      speak: 'Natriy elektroni xlorga oʻtadi. Natriy musbat ionga aylanib kichrayadi, xlor manfiy ionga aylanib kattalashadi.',
    },
    attraction: {
      title: 'Ionlar tortishadi',
      body:
        'Qarama-qarshi zaryadlar tortishadi: Na⁺ kationi va Cl⁻ anioni elektron qobiqlari tegguncha yaqinlashadi. ' +
        'Bu ion bogʻlanish — ionlarning elektrostatik tortishuvi. Uning yoʻnalishi yoʻq: ion qoʻshnilarini har tomondan tortadi.',
      equation: 'Na⁺ + Cl⁻ → Na⁺Cl⁻',
      speak: 'Musbat va manfiy ionlar bir-birini tortadi. Bu ion bogʻlanish.',
    },
    lattice: {
      title: 'Kristall panjara',
      body:
        'Tuzda alohida NaCl molekulalari yoʻq: ionlar kub panjara hosil qiladi, unda har bir Na⁺ oltita Cl⁻ bilan, har bir Cl⁻ oltita Na⁺ bilan oʻralgan. ' +
        'Kristalda Na–Cl masofasi 2,82 Å. Kichik boʻlak koʻrsatilgan: kub uchlarida sakkizta ion, zaryadlar navbatlashadi.',
      equation: '2 Na + Cl₂ → 2 NaCl',
      note: 'NaCl formulasi ionlarning 1 : 1 nisbatini bildiradi, molekulani emas.',
      speak: 'Ionlar kub panjaraga joylashadi: plyus, minus, plyus, minus. Alohida tuz molekulalari yoʻq.',
    },
    energy: {
      title: 'Energiya ajralishi',
      body:
        'Reaksiya kuchli ekzotermik: har bir mol NaCl uchun 411 kJ ajraladi — natriy xlorda yorqin sariq alanga bilan yonadi. ' +
        'Energiyaning asosiy qismini panjaraning yigʻilishi beradi (−787 kJ/mol); u natriydan elektron ajratish va Cl₂ ni uzish sarfini ortigʻi bilan qoplaydi.',
      equation: '2 Na + Cl₂ → 2 NaCl,  ΔH° = −822 kJ (har mol NaCl uchun −411 kJ)',
      speak: 'Koʻp issiqlik va yorugʻlik ajraladi. Energiyani ion panjarasining yigʻilishi beradi.',
    },
  },
  legend: {
    electron: 'Yorugʻ nuqta — natriyning 3s¹ elektroni; iz uning xlorga yoʻlini koʻrsatadi',
    orbitalPhase: 'Koʻk halqa — natriyning tashqi (3s) orbitali, elektronni berishdan oldin',
  },
  safety:
    'Natriy va xlor xavfli: metall suv bilan portlab reaksiyaga kirishadi, xlor — zaharli gaz. Tajriba faqat tortuvchi shkafda koʻrsatiladi.',
  energy: {
    title: 'Energiya qayerdan: Born — Haber sikli',
    unit: 'kJ/mol',
    caption: '1 mol NaCl uchun sarf (yuqoriga) va yutuq (pastga); bosqichlar yigʻindisi — hosil boʻlish issiqligi.',
    stages: {
      sublimation: 'Na (q.) → Na (gaz)',
      ionization: 'Na → Na⁺ + e⁻',
      dissociation: '½ Cl₂ → Cl',
      affinity: 'Cl + e⁻ → Cl⁻',
      lattice: 'Na⁺ + Cl⁻ → NaCl (q.)',
      total: 'Jami: ΔH°f',
    },
    summary: 'NaCl uchun Born — Haber sikli: bosqichlar yigʻindisi {dH} kJ/mol',
    sources: 'Maʼlumotnoma qiymatlari: NIST-JANAF, CRC Handbook (panjara energiyasi — Born — Haber sikli boʻyicha).',
  },
}
