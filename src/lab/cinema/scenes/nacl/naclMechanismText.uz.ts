import type { NaclMechanismText } from './naclMechanismText'

export const NACL_TEXT_UZ: NaclMechanismText = {
  intro: {
    title: 'Ion bogʻlanish',
    speak: 'Natriy va xlor qanday qilib osh tuziga aylanishini koʻramiz: elektron bir atomdan boshqasiga oʻtadi.',
  },
  steps: {
    reactants: {
      title: 'Dastlabki moddalar',
      body: 'Natriy — yumshoq kumushrang metall: uning kristallida Na atomlari zich joylashgan. Xlor — sargʻish-yashil zaharli gaz, u ikki atomli Cl₂ molekulalaridan iborat, ulardagi ikki atom umumiy elektron jufti bilan bogʻlangan. Natriy va xlor uchrashganda shiddatli reaksiyaga kirishadi — osh tuzi NaCl hosil boʻladi.',
      equation: '2Na + Cl₂',
      note: 'Shar ichidagi belgi — elementning kimyoviy belgisi. Metallning bitta katagi va bitta xlor molekulasi koʻrsatilgan; haqiqiy natriy boʻlagida atomlar milliardlab marta koʻp.',
      speak: 'Chapda natriy metali, oʻngda xlor molekulasi. Xlor doim ikki atomdan iborat.',
    },
    sublimation: {
      title: 'Natriy va xlor atomlarining tuzilishi',
      body: 'Reaksiyada alohida atomlar qatnashadi: natriy atomlari metalldan chiqadi, xlor molekulasi ikki atomga ajraladi. Natriy yadrosining zaryadi +11, elektronlari uchta energetik pogʻonada joylashgan: 2, 8, 1 — tashqi pogʻonada bor-yoʻgʻi bitta elektron. Xlor yadrosining zaryadi +17, elektronlari: 2, 8, 7 — sakkiz elektronli tugallangan tashqi pogʻonagacha unga bitta elektron yetishmaydi.',
      equation: 'Na (+11): 2, 8, 1      Cl (+17): 2, 8, 7',
      note: 'Shar atrofidagi yorugʻ nuqtalar buluti — tashqi pogʻonaning elektron buluti: natriyda u siyrak (bitta elektron), xlorda zich (yettita elektron), yetishmayotgan elektron oʻrnida «darcha» bor. Katta havorang nuqtalar — tashqi pogʻona elektronlari, ularni sanash mumkin.',
      speak: 'Natriyning tashqi pogʻonasida bitta elektron, xlorda yettita. Xlorga sakkiztagacha bitta elektron yetishmaydi.',
    },
    transfer: {
      title: 'Elektronning oʻtishi',
      body: 'Natriy uchun yettita elektron qabul qilgandan koʻra bitta tashqi elektronni berish oson; xlor uchun esa yettitasini bergandan koʻra bittasini qabul qilish oson. Shuning uchun elektron natriy atomidan xlor atomiga oʻtadi. Natriy tashqi pogʻonasini yoʻqotadi — tashqarida sakkiz elektronli tugallangan pogʻona qoladi (2, 8): atom musbat ion Na⁺ ga aylandi. Xlor tashqi pogʻonasini sakkiz elektrongacha toʻldirdi (2, 8, 8): atom manfiy ion Cl⁻ ga aylandi.',
      equation: 'Na⁰ − 1e⁻ → Na⁺      Cl⁰ + 1e⁻ → Cl⁻',
      note: 'Na⁺ ioni Na atomidan kichik — unda bitta elektron pogʻona kam. Cl⁻ ioni Cl atomidan katta — ortiqcha elektron bulutni kengaytiradi. Elektronning yoy boʻylab uchishi — koʻrgazmali sxema: aslida oʻtish atomlar toʻqnashgan paytda sodir boʻladi. Cl₂ molekulasining ikki xlor atomi ikki natriy atomidan bittadan elektron qabul qiladi.',
      speak: 'Natriy elektron beradi va musbat ionga aylanadi. Xlor elektron qabul qiladi va manfiy ionga aylanadi. Endi ikkalasining tashqi pogʻonasida sakkiztadan elektron bor.',
    },
    attraction: {
      title: 'Ion bogʻlanish',
      body: 'Ionlar — zaryadlangan zarrachalar. Musbat ion Na⁺ va manfiy ion Cl⁻ bir-biriga tortiladi. Ionlar orasida vujudga keladigan bogʻlanish ion bogʻlanish deyiladi. U tipik metall va tipik metallmas atomlari orasida hosil boʻladi, masalan NaCl, KBr, Na₂S da.',
      equation: 'Na⁺ + Cl⁻ → Na⁺Cl⁻',
      note: 'Ionlar orasidagi yuguruvchi nuqtalar — elektr tortishishning shartli tasviri. Ionlarda umumiy elektron jufti yoʻq: elektron butunlay xlorga oʻtgan.',
      speak: 'Musbat va manfiy tortishadi. Ionlar orasidagi bogʻlanish ion bogʻlanish deyiladi.',
    },
    lattice: {
      title: 'Ion kristall panjara',
      body: 'Har bir ion bittasini emas, qarama-qarshi ishorali barcha qoʻshnilarini tortadi. Shuning uchun ionlar kristall panjaraga tiziladi: uning tugunlarida Na⁺ va Cl⁻ ionlari navbatlashadi. Har bir Na⁺ ioni oltita Cl⁻ ioni bilan, har bir Cl⁻ esa oltita Na⁺ ioni bilan oʻralgan. Kristallda alohida NaCl molekulalari yoʻq: formula natriy va xlor ionlari teng ekanini koʻrsatadi.',
      equation: 'Na⁺ + Cl⁻ → NaCl (kristall)',
      note: 'Kristallning kichik boʻlagi koʻrsatilgan — har bir qirrada 5 tadan ion. Yorugʻ koʻpyoqlar bitta Na⁺ va bitta Cl⁻ ionining oltita qoʻshnisini ajratib koʻrsatadi; ingichka chiziqlar — kub qirralari, bogʻlanishlar emas.',
      speak: 'Ionlar kub shaklidagi panjaraga joylashadi. Har bir ion qarama-qarshi ishorali oltita ion bilan oʻralgan.',
    },
    energy: {
      title: 'Xulosa: natriy xlorid',
      body: 'Har bir natriy atomi bitta elektron berdi, har bir xlor atomi bitta elektron qabul qildi. Na⁺ va Cl⁻ ionlari hosil boʻldi, ularni kristallda ion bogʻlanish ushlab turadi. Shunday qilib natriy xlorid — osh tuzi hosil boʻladi. Ion panjarali moddalar qattiq va qiyin suyuqlanadi; ularning eritmalari va suyuqlanmalari elektr tokini oʻtkazadi.',
      equation: '2Na + Cl₂ → 2NaCl',
      note: 'Elektron balans: 2Na⁰ − 2e⁻ → 2Na⁺, Cl₂⁰ + 2e⁻ → 2Cl⁻ — qancha elektron berilgan boʻlsa, shuncha qabul qilingan. Ionlarning navbatlashishi har tomondan koʻrinishi uchun panjara sekin aylanadi.',
      speak: 'Natriy elektronlarini berdi, xlor ularni qabul qildi. Ion bogʻlanishli osh tuzi hosil boʻldi.',
    },
  },
  legend: {
    electron: 'Izi va e⁻ yozuvi bor havorang nuqta — oʻtayotgan elektron.',
    orbitalPhase: 'Yorugʻ nuqtalar buluti — tashqi pogʻonaning elektron buluti: Na da siyrak (bitta elektron), Cl da zich (yettita), ionlarda tugallangan (sakkizta). Katta havorang nuqtalar — tashqi pogʻona elektronlari.',
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
