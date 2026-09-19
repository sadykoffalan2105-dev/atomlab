import type { So2MechanismText } from './so2MechanismText'

/** O‘zbekcha matnlar: «S + O₂ → SO₂» darsi (qoidalar — so2MechanismText.ts). */
export const SO2_TEXT_UZ: So2MechanismText = {
  intro: {
    title: 'Qutbli kovalent bog‘',
    speak: 'Oltingugurtning yonishini ko‘ramiz: ikki kislorod atomi oltingugurt bilan elektron juftlarini baham ko‘radi.',
  },
  steps: {
    reactants: {
      title: 'Oltingugurt va kislorod',
      body:
        'Oddiy sharoitda oltingugurt — sariq qattiq modda, uning zarrasi yakka atom emas, balki toj shaklidagi sakkiz atomli S₈ HALQASI: S–S bog‘i 205,5 pm, S–S–S burchagi 108°. ' +
        'Kislorod esa ikki atomli O₂ gazi, qo‘sh bog‘ uzunligi 120,8 pm; havoda yakka kislorod atomlari bo‘lmaydi. ' +
        'Oltingugurt yoqilganda KO‘K alanga bilan yonadi — biz shu reaksiyani bosqichma-bosqich ko‘rib chiqamiz.',
      equation: 'S (qat., rombik) + O₂ (gaz) → SO₂ (gaz)',
      note: 'Ekranda bitta S₈ toji va bitta O₂ molekulasi; oltingugurt zarrachasida bunday tojlar 10²⁰ ga yaqin.',
      speak: 'Oltingugurt — sakkiz atomli halqa, kislorod esa doim ikki atomli.',
    },
    ring: {
      title: 'Halqa ochiladi',
      body:
        'Oltingugurt reaksiyaga kirishishi uchun atomni halqadan ozod qilish kerak. Avval bitta S–S bog‘i uziladi va toj zanjirga aylanadi, so‘ng ikkinchisi uziladi va chetki atom ajralib chiqadi. ' +
        'Rombik oltingugurtdan bir mol gaz holidagi oltingugurt atomini olish uchun 277,2 kJ kerak: bu bosqich ENDOTERMIK, energiya sarflanadi. ' +
        'Shuning uchun oltingugurtni yoqish kerak: xona haroratida u kislorod bilan o‘z-o‘zidan reaksiyaga kirishmaydi.',
      equation: '⅛ S₈ (qat.) → S (gaz),  ΔH = +277,2 kJ/mol',
      note: 'Alangada erkin oltingugurt atomlari kam va bir lahza yashaydi: ekranda atom QANDAY ozod bo‘lishi ko‘rsatilgan, soni emas.',
      speak: 'Ikkita S–S bog‘i uziladi va bitta oltingugurt atomi tojdan chiqadi.',
    },
    firstBond: {
      title: 'Birinchi S=O bog‘i',
      body:
        'Kislorod molekulasini ham uzish kerak: O₂ → 2 O bir molga 498,4 kJ turadi. Uzilish GOMOLITIK — umumiy juft teng bo‘linadi va ionlar emas, ikkita bir xil atom hosil bo‘ladi. ' +
        'So‘ng oltingugurt atomi va kislorod atomi yaqinlashadi, har biri umumiy juftga bittadan elektron beradi. ' +
        'Shunday qilib uzunligi 143,1 pm bo‘lgan kovalent S=O bog‘i paydo bo‘ladi: elektronlar ikkala atomga tegishli, lekin elektromanfiyroq kislorodga tortilgan.',
      equation: 'O₂ (gaz) → 2 O (gaz), ΔH = +498,4 kJ/mol;   S (gaz) + O (gaz) → S=O',
      note: 'Elektronlar yorug‘ nuqtalar, tashqi qavat esa halqa bilan ko‘rsatilgan: bu «tashqi elektronlar shu yerda» belgisi, orbital shakli emas.',
      speak: 'Kislorod ikkiga bo‘linadi va oltingugurt u bilan elektron juftini baham ko‘radi.',
    },
    bend: {
      title: 'Ikkinchi bog‘ va 119,5° burchak',
      body:
        'Ikkinchi kislorod atomi ikkinchi S=O bog‘ini beradi. Endi oltingugurt atrofida UCHTA elektron guruh bor: ikkita bog‘ va bitta TAQSIMLANMAGAN JUFT. ' +
        'Elektron juftlarining itarilishi nazariyasiga ko‘ra uchta guruh tekislikda taxminan 120° ga tarqaladi, shuning uchun molekula BURCHAKLI bo‘ladi; taqsimlanmagan juft bog‘dan «yo‘g‘onroq» va burchakni 119,5° gacha siqadi. ' +
        'CO₂ dagi uglerodda guruh atigi ikkita va taqsimlanmagan juft yo‘q — shuning uchun CO₂ chiziqli, 180°. ' +
        'SO₂ dagi ikkala bog‘ ham bir xil, 143,1 pm: π-elektronlar uchta markazga delokallashgan, har bir bog‘ning tartibi 2 emas, taxminan 1,5. Molekula qutbli, μ = 1,63 D.',
      equation: 'O=S=O,  ∠O–S–O = 119,5°,  d(S=O) = 143,1 pm,  μ = 1,63 D',
      note: '«Keng» shakldan burchakli shaklga o‘tish shartli ko‘rsatilgan — taqsimlanmagan juftning ta’siri ko‘rinsin uchun: aslida SO₂ doim burchakli.',
      speak: 'Oltingugurtdagi taqsimlanmagan juft burchakni siqadi — molekula burchakli, CO₂ esa chiziqli.',
    },
    properties: {
      title: 'Oltingugurt(IV)-oksid xossalari',
      body:
        'SO₂ — o‘tkir hidli rangsiz gaz, havodan og‘ir, suvda yaxshi eriydi. Eritma kislotali bo‘ladi va maktab yozuvida uni sulfit kislota H₂SO₃ deb ataydilar. ' +
        'Zavod va issiqlik elektr stansiyalari mo‘rilaridan chiqadigan SO₂ KISLOTALI YOMG‘IRLARga sabab bo‘ladi: ular marmarni yemiradi va o‘rmonlarni nobud qiladi. ' +
        'V₂O₅ katalizatorida 400–500 °C da SO₂ yanada oksidlanib SO₃ ga aylanadi — bu sulfat kislota ishlab chiqarishning asosiy bosqichi. ' +
        'E’tibor bering: uchinchi kislorod aynan taqsimlanmagan juft turgan joyga keladi va SO₃ tekis hamda simmetrik bo‘ladi.',
      equation: 'SO₂ + H₂O ⇌ H₂SO₃;   2 SO₂ + O₂ ⇌ 2 SO₃ (V₂O₅, 400–500 °C)',
      note:
        'Erkin H₂SO₃ ajratib olinmagan: eritmada u gidratlangan SO₂ va HSO₃⁻ ionlaridir. ' +
        'Koeffitsiyentlar mollarga tegishli — ekranda bitta molekula; V₂O₅ katalizatori panjara emas, belgi bilan ko‘rsatilgan.',
      speak: 'Oltingugurt(IV)-oksid kislotali yomg‘ir beradi, katalizatorda esa SO₃ ga aylanadi.',
    },
    energy: {
      title: 'Energiya yakuni',
      body:
        'Bosqichlarni qo‘shamiz. Oltingugurt atomini halqadan ozod qilish +277,2 kJ, kislorod molekulasini uzish +498,4 kJ: jami 775,6 kJ sarf. ' +
        'Buning evaziga ikkita yangi S=O bog‘i 1072,4 kJ beradi. ' +
        'Yakun: bir mol SO₂ ga −296,8 kJ — reaksiya EKZOTERMIK. Shuning uchun yoqilgan oltingugurt qizdirishsiz o‘zi yonaveradi.',
      equation: 'S (qat., rombik) + O₂ (gaz) → SO₂ (gaz),  ΔH°f = −296,8 kJ/mol',
      note:
        '1072,4 kJ yutuq Gess qonuni bo‘yicha topilgan, bog‘ energiyalari jadvalidan emas: bir bog‘ga 536,2 kJ to‘g‘ri keladi — jadvaldagi o‘rtacha S=O qiymatidan (522 kJ/mol) ko‘proq, ' +
        'chunki SO₂ ning o‘zida π-zichlik delokallashgan va bog‘lar o‘rtachadan mustahkamroq.',
      speak: 'Yetti yuz yetmish besh sarfladik, ming yetmish ikki oldik — reaksiya ekzotermik.',
    },
  },
  legend: {
    electron: 'Yorug‘ nuqta — elektron; oltingugurt ostidagi ikki nuqta uning taqsimlanmagan juftidir.',
    orbitalPhase: 'Molekula tekisligining ustidagi va ostidagi bulut — delokallashgan π-elektronlar; rasm shartli.',
  },
  safety: 'SO₂ zaharli: ko‘z va nafas yo‘llarini ta’sirlaydi, katta dozada xavfli. Oltingugurtni faqat so‘rg‘ich shkafda va oz miqdorda yoqing.',
  energy: {
    title: 'Reaksiya energiyasi',
    unit: 'kJ/mol',
    caption: 'Yuqoriga — sarf, pastga — yutuq. S=O bog‘lari atomlarni ozod qilishdan ko‘ra ko‘proq energiya qaytaradi.',
    stages: {
      atomization: 'Oltingugurt atomizatsiyasi: ⅛ S₈ (qat.) → S (gaz)',
      dissociation: 'Kislorod dissotsiatsiyasi: O₂ → 2 O (gaz)',
      bonds: 'Ikkita S=O bog‘i',
      total: 'ΔH°f(SO₂, gaz)',
    },
    summary: 'Reaksiya yakuni {dH} kJ/mol',
    sources: 'ΔH°f — NIST-JANAF va CRC Handbook; bog‘ uzunliklari va burchaklar — NIST CCCBDB.',
  },
}
