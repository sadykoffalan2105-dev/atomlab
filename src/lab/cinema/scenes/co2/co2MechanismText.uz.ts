import type { Co2MechanismText } from './co2MechanismText'

/** O‘zbekcha matn: «ko‘mirning yonishi: C (grafit) + O₂ → CO₂». */
export const CO2_TEXT_UZ: Co2MechanismText = {
  intro: {
    title: 'Qutbli kovalent bog‘',
    speak: 'Ko‘mir qanday yonishini ko‘ramiz: uglerod va kislorod elektronni bermaydi, balki ularni taqsimlaydi — deyarli teng.',
  },
  steps: {
    reactants: {
      title: 'Ko‘mir va kislorod',
      body:
        'Chapda — grafit donasi. Uglerod atomlari muntazam oltiburchaklardan iborat yassi qatlamlarga terilgan: qatlam ichida har bir atomning 141,8 pm masofada uchta qo‘shnisi bor. ' +
        'Qatlamlarning o‘zi bir-biridan 335 pm uzoqlikda yotadi va faqat kuchsiz molekulalararo tortishish bilan ushlanib turadi — shuning uchun grafit yumshoq va qog‘ozda iz qoldiradi. ' +
        'O‘ngda — kislorod molekulalari O₂: uzunligi 120,8 pm bo‘lgan QO‘SH bog‘ bilan birikkan ikki atom. Ko‘mir yonishi uchun uni qizdirish kerak: yog‘och ko‘mir taxminan 300 °C da, koks va grafit esa faqat 600–700 °C da alangalanadi.',
      equation: 'C (grafit) + O₂ (gaz)',
      note:
        'Har birida 24 atomdan iborat ikki qatlamli bo‘lak ko‘rsatilgan; ko‘mir donasida ular 10²⁰ dan ko‘p. Alangalanish harorati uglerodning shakliga va donaning o‘lchamiga bog‘liq, shuning uchun taxminiy berilgan. ' +
        'Grafit — uglerodning standart holati: uning ΔH°f qiymati nolga teng deb olingan (olmos uchun +1,9 kJ/mol).',
      speak: 'Chapda grafit — qatlamli uglerod, o‘ngda ikki atomli kislorod molekulalari. Avval ko‘mirni qizdirish kerak.',
    },
    erosion: {
      title: 'Atom qatlamni tark etadi',
      body:
        'Qizigan qatlamning chetidan uglerod atomi chiqib ketadi: uni qo‘shnilariga bog‘lab turgan ikkita C–C bog‘i uziladi. ' +
        'Bir mol atomni grafitdan yulib olish 716,7 kJ turadi — bu atomizatsiya entalpiyasi, butun reaksiyaning eng qimmat bosqichi. ' +
        'Shuning uchun ko‘mir o‘zicha yonmaydi: issiqlik bermaguningizcha atomlarda panjarani tark etishga kuch yetmaydi.',
      equation: 'C (grafit) → C (gaz),  ΔH = +716,7 kJ/mol',
      note:
        'ERKIN UGLEROD ATOMI — Gess qonuni bo‘yicha HISOB bosqichi, alanga zarrasi emas. Aslida ko‘mir sirtda yonadi: kislorod to‘g‘ridan to‘g‘ri qatlam chetidagi atomlar bilan reaksiyaga kirishadi. ' +
        'Gess qonuni istalgan yo‘l bilan hisoblashga ruxsat beradi — issiqlik effekti yo‘lga bog‘liq emas.',
      speak: 'Uglerod atomi qatlamni tark etadi. Bu eng qimmat bosqich: mol uchun yetti yuz o‘n olti kilojoul.',
    },
    firstBond: {
      title: 'Birinchi C=O bog‘i',
      body:
        'Kislorod molekulasi uglerod atomiga yaqinlashadi. O=O qo‘sh bog‘i GOMOLITIK uziladi: umumiy juftlar teng bo‘linadi, har bir atomga o‘z yarmi tegadi va bunga bir mol O₂ uchun 498 kJ sarflanadi. ' +
        'Birinchi kislorod atomi uglerodga o‘tiradi va C=O bog‘i yopiladi. ' +
        'Kislorodning elektrmanfiyligi uglerodnikidan katta, shuning uchun umumiy elektron zichligi unga tomon siljiydi: bog‘ ion emas, QUTBLI KOVALENT bo‘lib chiqadi — elektronlar umumiyligicha qoladi.',
      equation: 'O₂ (gaz) → 2 O (gaz), ΔH = +498 kJ/mol;  C + O → C=O',
      note:
        'Birinchi bog‘ tayyor CO₂ dagidek qilib chizilgan. Kislorod yetarli bo‘lsa, ikkinchi atom deyarli darhol qo‘shiladi; ' +
        'yetmasa — uglerod is gazi CO da to‘xtaydi, u yerda bog‘ UCH KARRALI (6-qadam).',
      speak: 'Kislorod molekulasidagi bog‘ teng ikkiga uziladi va birinchi kislorod atomi uglerodga o‘tiradi.',
    },
    linear: {
      title: 'Molekula to‘g‘rilanadi',
      body:
        'Ikkinchi kislorod atomi yon tomondan keladi va bir lahzaga zarracha BURCHAKLI bo‘lib qoladi — taxminan 155°. Ammo bu yerda uglerodda elektron zichligining atigi ikkita sohasi bor va birorta taqsimlanmagan juft yo‘q, ' +
        'shuning uchun ular bir-birini eng uzoqqa itaradi: molekula aynan 180° gacha to‘g‘rilanadi. ' +
        'CO₂ dagi uglerod sp-gibridlangan — ikkita sp-orbital o‘q bo‘ylab σ-bog‘larni ushlaydi, qolgan ikkita p-orbital esa perpendikulyar tekisliklarda IKKITA π-bog‘ beradi. ' +
        'Har bir C=O bog‘i σ + π dan iborat: uzunligi 116,0 pm, energiyasi 799 kJ/mol — aldegidlardagi oddiy C=O qo‘sh bog‘idan (122 pm, 745 kJ/mol) qisqaroq va mustahkamroq.',
      equation: 'O=C=O,  ∠O–C–O = 180°,  d(C=O) = 116,0 pm',
      note:
        'O‘q ustidagi va ostidagi binafsha bulutlar — π-bog‘larning sxematik belgisi, uglerodagi ko‘k «tomchilar» esa xuddi shunday sxematik ko‘rsatilgan sp-gibrid orbitallar. ' +
        'Bular to‘lqin funksiyasining izosirti EMAS, faqat elektron zichligi yuqori bo‘lgan sohaning belgisi.',
      speak: 'Ikkinchi bog‘ yopiladi va molekula to‘g‘ri chiziqqa aylanadi. Uglerod sp-gibridlangan, ikkita pi-bog‘ esa perpendikulyar tekisliklarda yotadi.',
    },
    polarity: {
      title: 'Bog‘lar qutbli, molekula qutbsiz',
      body:
        'Kislorodning elektrmanfiyligi 3,44, uglerodniki 2,55: farq 0,89. Demak, har bir C=O bog‘i qutbli — uglerodda δ+, kislorodlarda δ−. ' +
        'Lekin molekula chiziqli va simmetrik: ikkita bir xil vektor aniq qarama-qarshi tomonga yo‘nalgan va yig‘indisi nolga teng. Shuning uchun butun CO₂ ning dipol momenti 0 D — bog‘lar qutbli, molekula qutbsiz. ' +
        'Shunga qaramay karbonat angidrid suvda eriydi va erigan CO₂ ning kichik qismi ko‘mir kislotasi H₂CO₃ ga aylanadi — gazlangan suvning nordon ta’mi shundan.',
      equation: 'μ(C=O) ≠ 0, ammo Σμ = 0;  CO₂ + H₂O ⇌ H₂CO₃',
      note:
        'Uglerodning +4 va kislorodning −2 oksidlanish darajasi — SHARTLI hisob: molekulada haqiqiy C⁴⁺ va O²⁻ ionlari yo‘q, elektronlar faqat kislorodga tomon siljigan. ' +
        'Erigan CO₂ ning bir foizdan kamrog‘i H₂CO₃ ga o‘tadi, shuning uchun tenglamada strelka emas, muvozanat belgisi turadi.',
      speak: 'Bog‘lar qutbli, molekula esa qutbsiz: ikkita bir xil dipol qarama-qarshi yo‘nalgan va bir-birini so‘ndiradi.',
    },
    energy: {
      title: 'Energiya: issiqlik, yorug‘lik va is gazi',
      body:
        'Gess qonuni bo‘yicha bosqichlarni qo‘shamiz: grafitni atomlashga +716,7 kJ, O₂ ni uzishga +498,4 va ikkita C=O bog‘ini hosil qilishga −1608,6. Natija: bir mol CO₂ ga −393,5 kJ — bir mol uglerod yonganda shuncha issiqlik va yorug‘lik ajraladi. ' +
        'Agar soddaroq, O‘RTACHA bog‘ energiyalari bo‘yicha hisoblansa, −383 kJ chiqadi: taxminan 10 kJ farq jadvaldagi 799 kJ/mol o‘rtacha qiymat bo‘lgani uchun paydo bo‘ladi, CO₂ ning o‘zida esa bog‘ biroz mustahkamroq — 804 kJ/mol. ' +
        'Kislorod yetishmasa, CO₂ o‘rniga is gazi CO hosil bo‘ladi: issiqlik uch barobar kam (−110,5 kJ/mol), gazning o‘zi esa o‘ta zaharli.',
      equation: 'C (grafit) + O₂ (gaz) → CO₂ (gaz),  ΔH°f = −393,5 kJ/mol;  2 C + O₂ → 2 CO,  ΔH°f(CO) = −110,5 kJ/mol',
      note: 'Zinapoya atomizatsiya yo‘li bo‘yicha qurilgan: bu Gess qonuni bilan HISOBLASH usuli, yonish mexanizmi emas.',
      speak: 'Mol uchun minus uch yuz to‘qson uch yarim kilojoul. Kislorod yetishmasa esa zaharli is gazi hosil bo‘ladi.',
    },
  },
  legend: {
    electron: 'To‘q sariq-ko‘k strelka — bog‘ning dipol momenti: u δ+ dan δ− ga yo‘nalgan.',
    orbitalPhase: 'Ko‘k «tomchilar» — uglerodning sxematik sp-gibrid orbitallari; o‘q ustidagi va ostidagi binafsha bulutlar — perpendikulyar tekisliklardagi ikkita π-bog‘.',
  },
  safety:
    'Is gazi CO rangsiz va hidsiz, o‘ta zaharli: u gemoglobin bilan kisloroddan taxminan 200 marta mustahkamroq birikadi. ' +
    'Cho‘g‘ to‘liq yonib bo‘lmaguncha pechni yopish mumkin emas, yonish bilan bog‘liq tajribalarni esa faqat o‘qituvchi so‘rish shkafida o‘tkazadi.',
  energy: {
    title: 'Gess qonuni bo‘yicha energiya',
    unit: 'kJ/mol',
    caption: '1 mol CO₂ uchun sarf (yuqoriga) va yutuq (pastga); bosqichlar yig‘indisi — hosil bo‘lish issiqligi. Bu HISOB yo‘li, yonish mexanizmi emas.',
    stages: {
      atomization: 'C (grafit) → C (gaz)',
      dissociation: 'O₂ → 2 O',
      bonds: 'C + 2 O → CO₂',
      total: 'Natija: ΔH°f',
    },
    summary: 'CO₂ uchun Gess sikli: bosqichlar yig‘indisi {dH} kJ/mol',
    sources: 'Ma’lumotnoma qiymatlari: NIST-JANAF, CRC Handbook; bog‘ energiyalari — jadval o‘rtachalari.',
  },
}
