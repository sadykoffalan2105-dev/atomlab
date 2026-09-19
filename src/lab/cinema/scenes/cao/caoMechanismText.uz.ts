import type { CaoMechanismText } from './caoMechanismText'

/** Ohaktoshni kuydirish CaCO₃ → CaO + CO₂ — dars matni, o‘zbekcha. */
export const CAO_TEXT_UZ: CaoMechanismText = {
  intro: {
    title: 'Ohaktoshni kuydirish',
    speak: 'Pechda ohaktoshdan so‘ndirilmagan ohak va karbonat angidrid qanday olinishini ko‘ramiz.',
  },
  steps: {
    calcite: {
      title: 'Kalsit: qatlamlar va uchburchaklar',
      body:
        'Ohaktosh — bu kalsit CaCO₃, fazoviy guruh R3̄c, Z = 6, zichligi 2,711 g/sm³. ' +
        'Ca²⁺ ionlari qatlamlari yassi CO₃²⁻ uchburchaklari qatlamlari bilan almashinadi: qo‘shni kalsiy qatlamlari orasi c/6 = 284,4 pm, qatlam ichida esa eng yaqin Ca²⁺ ionlari 499 pm masofada turadi. ' +
        'Karbonat ionidagi uchala C–O bog‘ bir xil — 128,4 pm, O–C–O burchaklari aniq 120°: −2 zaryad uchta kislorodga taqsimlangan, shuning uchun bog‘ tartibi 1⅓, «bitta qo‘sh va ikkita yakka» emas. ' +
        'Har bir Ca²⁺ 235,9 pm masofadagi oltita kislorod atomi bilan o‘ralgan.',
      equation: 'CaCO₃ (qat.): Ca²⁺ + CO₃²⁻',
      note: 'Qatlamlarning o‘zaro joylashuvi sxematik ko‘rsatilgan — haqiqiy romboedrik katak murakkabroq; qatlamlararo masofalar va CO₃²⁻ guruhining geometriyasi haqiqiy.',
      speak: 'Ohaktosh qatlamlardan iborat: kalsiy, keyin yassi karbonat uchburchaklari, yana kalsiy.',
    },
    heating: {
      title: 'Pech: harorat — bu tebranish',
      body:
        'Kristalldagi ionlar doim tebranadi, hatto xona haroratida ham; qizdirish faqat tebranish kengligini oshiradi. ' +
        'Ohak pechida ohaktosh 900…1000 °C gacha qizdiriladi va karbonat ionidagi C–O bog‘lari tobora cho‘ziladi. ' +
        'Bu qadamda energiya narvoni YUQORIGA ko‘tariladi: ohaktoshning parchalanishi endotermik, o‘zidan-o‘zi bormaydi.',
      equation: 'CaCO₃ (qat.) + Q → …,  pech 900…1000 °C',
      note: 'Tebranish kengligi bir necha barobar oshirib ko‘rsatilgan: haqiqiy ion taxminan 10–15 pm siljiydi, buni ekranda ilg‘ab bo‘lmasdi.',
      speak: 'Qanchalik issiq bo‘lsa, ionlar shunchalik kuchli tebranadi. Pechda to‘qqiz yuz daraja.',
    },
    release: {
      title: 'Karbonat angidrid chiqib ketadi',
      body:
        'Bitta C–O bog‘i uziladi va umumiy elektron jufti butunlay kislorodda qoladi: CO₃²⁻ O²⁻ va CO₂ ga ajraladi. ' +
        'Qolgan kislorod bog‘langan atomdan erkin oksid ioniga aylanadi va 66 pm dan 140 pm gacha kattalashadi — ikki barobardan ko‘p. ' +
        'Qolgan ikkita bog‘ aksincha qisqaradi: 128,4 pm dan 116 pm gacha, burchak esa 120° dan 180° gacha ochiladi — chiziqli CO₂ molekulasi hosil bo‘ladi va gaz sifatida kristalldan chiqib ketadi. ' +
        'Oksidlanish darajalari o‘zgarmaydi: Ca +2, uglerod +4, kislorod −2 — bu oksidlanish-qaytarilish reaksiyasi EMAS.',
      equation: 'CO₃²⁻ → O²⁻ + CO₂ ↑',
      note: 'Kislorodga o‘tayotgan ko‘k nuqtalar jufti — C–O bog‘ining elektron jufti shartli belgisi; geterolitik uzilish ko‘rinsin deb uning «uchishi» chizilgan.',
      speak: 'Bog‘ uziladi, elektron jufti kislorodda qoladi, karbonat angidrid esa uchib ketadi.',
    },
    rocksalt: {
      title: 'Yangi panjara: so‘ndirilmagan ohak',
      body:
        'Qolgan Ca²⁺ va O²⁻ tosh tuzi panjarasiga qayta teriladi — fazoviy guruh Fm-3m, katak qirrasi 481,1 pm, eng yaqin Ca–O masofasi 240,5 pm, Z = 4. ' +
        'Har bir Ca²⁺ oltita O²⁻ bilan, har bir O²⁻ esa oltita Ca²⁺ bilan o‘ralgan: koordinatsion son 6 ga 6, bir xil zaryadlar hech qachon qo‘shni bo‘lmaydi. ' +
        'Bu yerda zaryadlar ±1 emas, ±2, shuning uchun tortishish to‘rt barobar kuchli: CaO panjara energiyasi −3400 kJ/mol, NaCl da esa −787. Karbonat guruhlari ketgach kristall zichroq bo‘ldi: 3,34 va 2,711 g/sm³.',
      equation: 'Ca²⁺ + O²⁻ → CaO (qat.),  d = 240,5 pm, KS 6 : 6',
      note: 'Kadrda 4 × 2 × 2 bo‘lak — ikkita elementar katak, 16 ion. Qum donasidek ohak bo‘lagida ular taxminan 10¹⁹ ta.',
      speak: 'Kalsiy va kislorod ohakning kubik panjarasiga teriladi. Har bir ionning oltita qo‘shnisi bor.',
    },
    classroom: {
      title: 'Undan keyin nima bo‘ladi',
      body:
        'So‘ndirilmagan ohak suv bilan so‘ndiriladi va bu ekzotermik jarayon: chelakdagi ohak qaynay boshlaydi. Mexanizmi oddiy — oksid ioni suvdan proton tortib oladi: O²⁻ + H₂O → 2 OH⁻, natijada kalsiy gidroksid Ca(OH)₂ hosil bo‘lib, 64,5 kJ/mol ajraladi. ' +
        'Ca(OH)₂ eritmasi — ohakli suv, karbonat angidridga maktab reaktivi: undan CO₂ o‘tkazsangiz, loyqalanadi, chunki biz boshlagan o‘sha kalsiy karbonat cho‘kmaga tushadi (yana 114,7 kJ/mol). ' +
        'Aylana yopildi: CaCO₃ → CaO → Ca(OH)₂ → CaCO₃.',
      equation: 'CaO + H₂O → Ca(OH)₂ + 64,5 kJ;  Ca(OH)₂ + CO₂ → CaCO₃ ↓ + H₂O',
      note: 'Ikkala reaksiya ham oldinga chiqarilgan bitta CaO formula birligida ko‘rsatilgan — shunda kristall kadrda butun qoladi; stakanda esa son-sanoqsiz zarracha qatnashadi.',
      speak: 'Ohak suv bilan so‘ndiriladi, ohakli suv esa karbonat angidriddan loyqalanadi.',
    },
    energy: {
      title: 'Nega kuchli qizdirish kerak',
      body:
        'Gess qonuni bo‘yicha hosil bo‘lish issiqliklaridan hisoblaymiz: −634,9 (CaO) − 393,5 (CO₂) + 1207,6 (CaCO₃) = +179,2 kJ/mol. ' +
        '«Plyus» belgisi energiyani KIRITISH kerakligini bildiradi — kuydirish natriy yoki magniy yonishidan shu bilan farq qiladi. ' +
        'Lekin gaz ajraladi va tartibsizlik keskin ortadi: ΔS° = +160,2 J/(mol·K). ΔG = ΔH − TΔS ifodasida harorat ortgan sari TΔS ustun keladi va T = 179 200 / 160,2 ≈ 1119 K (846 °C) da ΔG nolga aylanadi. Shundan yuqorida reaksiya boradi — shuning uchun pech 900…1000 °C da ushlab turiladi. ' +
        'So‘ndirilmagan ohak — bu sement, qurilish qorishmasi, po‘latni oltingugurt va fosfordan tozalash; ohaktoshni kuydirish Yerdagi eng ommaviy reaksiyalardan biri.',
      equation: 'CaCO₃ (qat.) → CaO (qat.) + CO₂ (gaz),  ΔH = +179,2 kJ/mol',
      note: '1119 K — bu CO₂ ning standart bosimi 1 atm bo‘lgandagi ΔG° = 0 sharti; pechda gaz doim olib ketiladi, shuning uchun parchalanish biroz erta boshlanadi.',
      speak: 'Plyus bir yuz yetmish to‘qqiz kilojoul. Reaksiya faqat pechda boradi — ammo sement va ohak beradi.',
    },
  },
  legend: {
    electron: 'Ko‘k nuqtalar jufti — C–O bog‘ining elektron jufti: bog‘ uzilganda u butunlay kislorodda qoladi.',
    vibration: 'Panjara tugunlarining titrashi — issiqlik harakati; harorat qancha yuqori bo‘lsa, tebranish shuncha keng.',
    water: 'Oq sharchalar — vodorod atomlari; suv molekulasi haqiqiy H–O–H burchagi 104,45° bilan chizilgan.',
  },
  safety:
    'So‘ndirilmagan ohak CaO terini kuydiradi va ayniqsa ko‘z uchun xavfli, so‘ndirishda esa suv qaynab sachraydi. Faqat ko‘zoynak va qo‘lqopda ishlanadi, ohak har doim suvga solinadi, aksincha emas.',
  energy: {
    title: 'Gess sikli',
    unit: 'kJ/mol',
    caption: 'Oddiy moddalar orqali bosqichlar: ohaktoshning parchalanishi (yuqoriga) va CaO bilan CO₂ ning hosil bo‘lishi (pastga). Yakuni musbat — reaksiya endotermik.',
    stages: {
      decompose: 'CaCO₃ → Ca + C + 3/2 O₂',
      co2: 'C + O₂ → CO₂',
      cao: 'Ca + ½ O₂ → CaO',
      total: 'Yakun: reaksiya ΔH',
    },
    summary: 'Ohaktoshni kuydirish uchun Gess sikli: bosqichlar yig‘indisi {dH} kJ/mol',
    sources: 'Ma’lumotlar: CRC Handbook (ΔH°f va S°), ICSD (panjara parametrlari), Shannon (ion radiuslari).',
  },
}
