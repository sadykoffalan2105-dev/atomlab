import type { Nh3MechanismText } from './nh3MechanismText'

/** Ammiak sintezi darsining o‘zbekcha matni (N₂ + 3 H₂ ⇌ 2 NH₃). */
export const NH3_TEXT_UZ: Nh3MechanismText = {
  intro: {
    title: 'Ammiak sintezi',
    speak: 'Havodagi eng inert gazdan ammiak — barcha azotli o‘g‘itlar uchun xomashyo qanday olinishini ko‘ramiz.',
  },
  steps: {
    reactants: {
      title: 'Dastlabki moddalar',
      body:
        'Havoning 78 % i azot, ammo u deyarli reaksiyaga kirishmaydi. Sababi — uch karrali N≡N bog‘i: bitta σ va ikkita π bog‘, uzunligi 109,8 pm, uzish uchun 945 kJ/mol kerak. Bu darsdagi eng mustahkam bog‘. ' +
        'Vodorod ham ikki atomli, lekin uning H–H bog‘i ikki barobardan ko‘proq kuchsiz: 74,1 pm uzunlikda 435,8 kJ/mol — 945 ga qarshi 435,8, nisbati 2,2. ' +
        'Ammiak olish uchun ikkala bog‘ni uzib, oltita yangi N–H bog‘ini yig‘ish kerak.',
      equation: 'N₂ (gaz) + 3 H₂ (gaz)',
      note: 'N–N o‘qi atrofidagi ko‘k yoylar — σ bog‘ ustidagi IKKITA π bog‘ning shartli belgisi, orbitallarning shakli emas.',
      speak: 'Azot uch karrali bog‘i tufayli inert: uni uzish uchun bir molga to‘qqiz yuz qirq besh kilojoul kerak.',
    },
    adsorption: {
      title: 'Katalizatorga adsorbsiya',
      body:
        'K₂O va Al₂O₃ promotorli temir katalizatori tenglamaga kirmaydi, ammo usiz reaksiya amalda bormaydi. Molekulalar temir yuzasiga o‘tiradi (hajmiy markazlashgan kub panjara, Im-3m, katak qirrasi 286,65 pm, har bir atomning 248,2 pm masofada sakkizta qo‘shnisi bor). ' +
        'Metall elektronlari azotning bo‘shashtiruvchi orbitallariga o‘tadi: N≡N bog‘i kuchsizlanadi — ekranda uning karraligi uchdan nolgacha tushadi — va aynan yuzada uziladi. Vodorod atomlarga yanada osonroq ajraladi. ' +
        'Ikki egri chiziqqa qarang: katalizatorsiz to‘siq N≡N bog‘ energiyasidan, ya’ni 945 kJ/mol dan past bo‘lmaydi, temirda esa ko‘rinma aktivlanish energiyasi atigi 60–100 kJ/mol.',
      equation: 'N₂ (ads.) → 2 N (ads.);  H₂ (ads.) → 2 H (ads.)',
      note:
        '945 kJ/mol — bu N≡N bog‘ining dissotsiatsiya entalpiyasi, ya’ni katalizatorsiz yo‘l to‘sig‘i uchun QUYIDAN BAHO, o‘lchangan aktivlanish energiyasi emas: gaz fazasida uch karrali bog‘ni undan kam energiya bilan uzib bo‘lmaydi. ' +
        'Katalizator FAQAT to‘siq balandligini pasaytiradi: ikkala egri chiziqning chap va o‘ng sathlari bir xil, ΔH katalizatorga bog‘liq emas. ' +
        '60–100 kJ/mol oralig‘i — promotorlangan temir uchun adabiyotdagi ko‘rinma aktivlanish energiyasining tarqoqligi; kadrda 18 atomli bo‘lak, katalizator donasida ular 10²⁰ ga yaqin.',
      speak: 'Temir uch karrali bog‘ni kuchsizlantiradi va to‘siqni taxminan o‘n barobar pasaytiradi. Issiqlik effekti esa o‘zgarmaydi.',
    },
    bonds: {
      title: 'N–H bog‘lari birin-ketin hosil bo‘ladi',
      body:
        'Yuzada azot va vodorod atomlari uchrashib, BIRIN-KETIN bog‘lanadi: avval NH, keyin NH₂, so‘ng NH₃. Sintez aynan shu sababli katalizatorda boradi, gazdagi to‘qnashuvlarda emas. ' +
        'Har bir N–H bog‘i — umumiy elektron juft, lekin azotning elektromanfiyligi vodorodnikidan katta (3,04 va 2,20), shuning uchun juft azot tomonga siljigan: unda δ−, vodorodda δ+. ' +
        'N–H bog‘ining uzunligi 101,2 pm, o‘rtacha energiyasi 391 kJ/mol.',
      equation: 'N + H → NH;  NH + H → NH₂;  NH₂ + H → NH₃',
      note: 'Ekranda atomlar yuza bo‘ylab silliq siljiydi; aslida ular qo‘shni adsorbsiya markazlari orasida sakraydi.',
      speak: 'Bog‘lar birin-ketin paydo bo‘ladi: en-ash, en-ash ikki, en-ash uch. Umumiy juft azot tomonga siljigan.',
    },
    desorption: {
      title: 'Desorbsiya: ammiak molekulasi',
      body:
        'Tayyor molekula temirdan uziladi — temir esa avvalgidek qoladi. Katalizator sarflanmaydi: u reaksiyada qatnashadi, lekin o‘zgarmagan holda chiqadi. ' +
        'Erkin NH₃ da azot sp³ holatida: uchta bog‘ va BITTA taqsimlanmagan juft. Shu juft tufayli molekula tekis emas, balki uchburchak piramida, H–N–H burchagi tetraedrik 109,5° o‘rniga 106,7° gacha siqilgan. ' +
        'Bunday piramida qutbli: dipol momenti 1,47 D. Shuning uchun ammiak suvda yaxshi eriydi va o‘tkir hidga ega.',
      equation: 'NH₃ (ads.) → NH₃ (gaz)',
      note:
        'Azot ustidagi ikkita yorug‘ nuqta — taqsimlanmagan juftning shartli tasviri: elektronlar bir nuqtada «turmaydi», bu elektron zichligi yuqori soha. ' +
        '106,7° burchak mikroto‘lqinli ma’lumotlarga ko‘ra olingan (NIST CCCBDB, 106,67°); ayrim darsliklarda 107,3° chop etiladi, shuning uchun raqamlar bir oz farq qilishi mumkin.',
      speak: 'Ammiak uchib ketadi, temir o‘zgarmaydi. Taqsimlanmagan juft tufayli molekula bir yuz oltin nuqta yetti burchakli piramida.',
    },
    equilibrium: {
      title: 'Muvozanat va Le Shatelye tamoyili',
      body:
        'Reaksiya qaytar: ammiakning hosil bo‘lishi va parchalanishi bir vaqtda boradi, shuning uchun tenglamada ⇌ yoziladi. Chapda 4 mol gaz (1 N₂ + 3 H₂), o‘ngda esa atigi 2 mol, ya’ni Δn = −2. ' +
        'Le Shatelye tamoyiliga ko‘ra bosimni oshirish muvozanatni gaz molekulalari kam tomonga — o‘ngga suradi; shuning uchun sanoatda 20–30 MPa (200–300 atm) ushlab turiladi. ' +
        'Reaksiya ekzotermik, demak qizdirish muvozanatni CHAPGA suradi. Ammo past haroratda tezlik juda kichik, shuning uchun murosa qilinadi: 400–500 °C, bir o‘tishda taxminan 15 % unum, reaksiyaga kirmagan aralashma qaytariladi.',
      equation: 'N₂ (gaz) + 3 H₂ (gaz) ⇌ 2 NH₃ (gaz)',
      note: 'Ekrandagi ⇌ strelkalarining yorqinligi faqat yo‘nalishni ko‘rsatish uchun har xil; muvozanatda to‘g‘ri va teskari reaksiya tezliklari qat’iy teng.',
      speak: 'Bosim muvozanatni o‘ngga, qizdirish chapga suradi. Shuning uchun yuqori bosim va o‘rtacha haroratda ishlanadi.',
    },
    energy: {
      title: 'Energetik yakun',
      body:
        'Bog‘ energiyalari bo‘yicha bir tenglamaga hisoblaymiz: bitta N≡N bog‘ini uzish +945 kJ, uchta H–H bog‘ini uzish yana +1307,4 kJ, oltita N–H bog‘ining hosil bo‘lishi esa −2346 kJ beradi. Yakun: −93,6 kJ. ' +
        'Hosil bo‘lish issiqliklari bo‘yicha mustaqil hisob −91,8 kJ beradi (bu 2 · (−45,9)); taxminan 2 kJ farq 391 kJ/mol — N–H bog‘ining O‘RTACHA energiyasi bo‘lgani uchun chiqadi. ' +
        'Reaksiya ekzotermik, va aynan shu ammiakni azotli o‘g‘itlar uchun birinchi raqamli xomashyoga aylantirgan: hozirgi insoniyat oqsillaridagi azotning taxminan yarmi shu jarayondan o‘tgan.',
      equation: 'N₂ (gaz) + 3 H₂ (gaz) ⇌ 2 NH₃ (gaz),  ΔH = −92 kJ',
      note: 'Zina BIR TENGLAMAGA, ya’ni 2 mol NH₃ ga qurilgan; bir mol ammiakka bu −45,9 kJ.',
      speak: 'Yakun minus to‘qson ikki kilojoul: oltita bog‘ning hosil bo‘lishi eskilarini uzishdan ko‘ra ko‘proq energiya beradi.',
    },
  },
  legend: {
    electron: 'Ko‘k nuqtalar — elektronlar: π bulutlari, umumiy juftlar va azotning taqsimlanmagan jufti.',
    orbitalPhase: 'N–N o‘qi atrofidagi yoylar — ikkita π bog‘ning shartli belgisi, orbitallar shakli emas.',
    vibration: 'To‘q sariq egri — katalizatorsiz yo‘l, yashili — temirdagi yo‘l. Chekka sathlar bir xil: ΔH o‘zgarmaydi.',
  },
  safety:
    'Ammiak zaharli va nafas yo‘llarini kuchli ta’sirlaydi, vodorod–havo aralashmasi esa portlovchi. Sanoat sintezi 20–30 MPa va 400–500 °C da boradi — maktab laboratoriyasida o‘tkazilmaydi.',
  energy: {
    title: 'Bog‘lar bo‘yicha energiya',
    unit: 'kJ',
    caption: 'Bog‘larni uzish sarfi (yuqoriga) va yangilarining hosil bo‘lish yutug‘i (pastga) bir tenglamaga, ya’ni 2 mol NH₃ ga.',
    stages: {
      hh: '3 H–H → 6 H',
      nn: 'N≡N → 2 N',
      nh: '2 N + 6 H → 2 NH₃',
      total: 'Yakun: reaksiyaning ΔH i',
    },
    summary: 'Ammiak sintezidagi bog‘ energiyalari: bosqichlar yig‘indisi {dH} kJ',
    sources: 'Bog‘ energiyalari va uzunliklari — CRC Handbook, NIST; ΔH°f — NIST-JANAF; jarayon sharoitlari — Ullmann’s Encyclopedia, “Ammonia”.',
  },
}
