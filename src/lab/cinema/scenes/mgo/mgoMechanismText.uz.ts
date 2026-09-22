import type { MgoMechanismText } from './mgoMechanismText'

export const MGO_TEXT_UZ: MgoMechanismText = {
  intro: {
    title: 'Ion bogʻlanish: ikkita elektron',
    speak: 'Magniyning yonishini kuzatamiz: har bir magniy atomi kislorodga ikkita elektron beradi.',
  },
  steps: {
    reactants: {
      title: 'Dastlabki moddalar',
      body:
        'Chapda — metall magniy boʻlagi: geksagonal zich joylashuvning (GZJ, P6₃/mmc) 2×2×1 elementar katagi, a = 320,9 pm, c = 521,1 pm. Har bir atomning oʻn ikkita eng yaqin qoʻshnisi bor: oltitasi oʻz qatlamida 320,9 pm da va oltitasi qoʻshni qatlamlarda 319,7 pm da. ' +
        'Oʻngda — kislorod molekulasi O₂: atomlarni uzunligi 120,75 pm boʻlgan qoʻsh bogʻ (σ + π) tutib turadi, uni uzish uchun 498,4 kJ/mol kerak. ' +
        'Metalldagi magniy atomining radiusi 160 pm, kislorodning kovalent radiusi 66 pm. 25 °C da kislorod — gaz, magniy — yupqa oksid parda ostidagi kumushrang metall (suyuqlanish harorati 650 °C).',
      equation: '2 Mg (q.) + O₂ (g.)',
      note:
        'Kislorod reaksiyaga O₂ MOLEKULASI holida kirishadi — havoda yakka kislorod atomlari yoʻq. O₂ molekulasi — triplet: unda ikkita juftlashmagan elektron bor. Lyuis boʻyicha O=O chizigʻi (σ + π) buni tushuntirmaydi — unda barcha elektronlar juftlashgan; tripletni faqat molekulyar orbitallar nazariyasi tushuntiradi: ikkita elektron turli π*-orbitallarda turadi, bogʻ tartibi esa baribir 2. Oʻqning yon tomonlaridagi π-paqlar — soddalashtirilgan rasm. ' +
        'Bir necha nanometrdan boshlanadigan oksid parda koʻrsatilgan butun boʻlakdan qalinroq, shuning uchun kadrda — parda ostidagi metall, pardaning oʻzi esa chizilmagan. Metall boʻlagidagi xira iplar — metall bogʻlanishning sxemasi (butun kristallning umumiy elektronlari), alohida bogʻlar emas; kadrda 8 ta atom, massasi 0,1–1 g boʻlgan maktab lentasida esa ular 10²¹–10²² tartibida. ' +
        'Reaksiyada 2 ta Mg atomi va bitta O₂ molekulasi qatnashadi; boʻlakning qolgan 6 ta atomi kadrdan chiqadi — bu modda yoʻqolishi emas, balki kadr almashishi.',
      speak: 'Chapda metall magniy, oʻngda qoʻsh bogʻli kislorod molekulasi.',
    },
    ignition: {
      title: 'Yondirish',
      body:
        'Reaksiya oʻz-oʻzidan boshlanmaydi: magniy oksid parda bilan qoplangan, O=O bogʻi esa mustahkam. Gorelka alangasi birinchi turtki beradi — keyin magniy oʻzi, koʻzni qamashtiruvchi oq nur bilan yonadi. ' +
        'Energiyani Born — Gaber sikli boʻyicha hisoblaymiz. Uning birinchi bosqichlari: magniy atomi metalldan gazga oʻtkaziladi — har mol uchun 147,1 kJ (sublimatsiya), O=O qoʻsh bogʻi esa gomolitik uziladi: yarim mol O₂ uchun 249,2 kJ ketadi — bu atom holidagi kislorodning hosil boʻlish issiqligi ΔH°f(O, gaz). ' +
        'Ikkala bosqich ham endotermik — energiya zinapoyasi yuqoriga koʻtariladi.',
      equation: 'Mg (q.) → Mg (g.);  ½ O₂ (g.) → O (g.)',
      note:
        '2–6-qadamlar — yonishning xronologiyasi emas, balki termokimyoviy sikl: energiyani hisoblash uchun xayoliy yoʻl. Gess qonuniga koʻra ΔH yoʻlga bogʻliq emas, shuning uchun istalgan qulay yoʻl xuddi shu issiqlikni beradi. ' +
        'Aslida magniy 1090 °C dayoq qaynaydi — bu MgO ning uchib ketish haroratidan ancha past — va Glassman mezoniga koʻra bugʻ fazasida yonadi: Mg bugʻlari kislorod bilan gazda reaksiyaga kirishadi (Mg + O₂ → MgO + O, Mg + O → MgO), MgO esa oq tutunga kondensatlanadi. Erkin O²⁻ ionlari bunda hech qachon hosil boʻlmaydi. ' +
        'Alanga 3D da chizilmaydi; uning oq nuri — choʻgʻlangan MgO zarrachalarining issiqlik nurlanishi. Harorat chegarasini mahsulotning oʻzi belgilaydi: taxminan 3430 K da (≈ 3157 °C) suyuq MgO atomlarga parchalanib bugʻlanadi, MgO (s.) → Mg (g.) + O (g.), va bu bosqich ortiqcha issiqlikning hammasini yutadi. ' +
        'Havoda yonayotgan lentada 2200–3100 °C oʻlchanadi: tarqoqlik usulga va alangadagi joyga bogʻliq, diapazonning yuqori chegarasi esa chegaradan atigi ≈ 57 K past — oksidning uchib ketishi havoda ham haroratni cheklaydi. Adashtirmang: 3105 K (≈ 2830 °C, NIST-JANAF) — bu MgO ning qaynash emas, erish harorati. ' +
        'Bogʻ uzilgandan keyin har bir O atomida ikkita juftlashmagan elektron bor (O(³P) holati).',
      speak: 'Yondirish — va magniy oq alanga bilan yonib ketadi. Atomlar metalldan chiqadi, kislorod molekulasidagi bogʻ teng ikkiga boʻlinadi.',
    },
    transfer: {
      title: 'Birinchi elektron',
      body:
        'Magniyning tashqi qatlamida ikkita elektron bor (3s²) va u ularni bittadan beradi. Birinchisi 737,7 kJ/mol (IE₁) evaziga ketadi — Mg⁺ ioni hosil boʻladi. ' +
        'Kislorod bu elektronni oladi va O⁻ ioniga aylanadi, bunda energiya ajraladi: Δ_eg H = −141,0 kJ/mol. IUPAC yozuvida xuddi shu kattalik elektronga moyillik deb ataladi va musbat ishora bilan yoziladi: +141,0 kJ/mol — jarayon bitta, faqat ishora kelishuvi boshqacha. ' +
        'Elektron uchib ketayotganda zaryad saqlanadi: ionlar va uchayotgan elektronlar zaryadlarining yigʻindisi nolga teng.',
      equation: 'Mg (g.) − 1e⁻ → Mg⁺ (g.);  O (g.) + 1e⁻ → O⁻ (g.)  (×2)',
      note: 'Atomlar atrofidagi nuqtalar — Lyuis boʻyicha valent elektronlar soni (Mg da ikkita, O da oltita, O⁻ da yettita), ularning joylashuvi emas. Elektronning yoy boʻylab «uchishi» va sekinlashtirilgan vaqt — shartli: oʻtish kvant sakrashi. Oraliq zarrachalar Mg⁺ va O⁻ uchun jadvaldagi ion radiuslari yoʻq, shuning uchun bu qadamda sharlar oʻlchami oʻzgarmaydi — zaryad va yozuv oʻzgaradi.',
      speak: 'Har bir magniy atomi birinchi elektronini beradi, kislorod esa uni energiya ajratib oladi.',
    },
    second: {
      title: 'Ikkinchi elektron',
      body:
        'Ikkinchi elektron allaqachon musbat boʻlgan Mg⁺ ionidan ketadi, shuning uchun u deyarli ikki barobar qimmat: 1450,7 kJ/mol (IE₂). Magniy butun tashqi qatlamini yoʻqotadi va 160 pm dan 72 pm gacha kichrayadi — bu Mg²⁺ kationi. ' +
        'Kislorod esa ikkinchi elektronni SARF BILAN oladi: +744 kJ/mol — O⁻ ioni allaqachon manfiy va keyingi elektronni itaradi. Buning evaziga u oktetni toʻldiradi va 66 pm dan 140 pm gacha kattalashadi: O²⁻ anioni Mg²⁺ dan 1,94 marta yirik.',
      equation: 'Mg⁺ (g.) − 1e⁻ → Mg²⁺ (g.);  O⁻ (g.) + 1e⁻ → O²⁻ (g.)  (×2)',
      note: 'Yakka O²⁻ ioni gazda beqaror va ortiqcha elektronni darhol yoʻqotadi, shuning uchun EA₂ bevosita oʻlchanmaydi: u Born — Gaber sikllaridan hisoblanadi va adabiyotda +744 dan +844 kJ/mol gacha beriladi. Loyiha yadrosi +744 ni MgO panjara energiyasi −3789 kJ/mol bilan juftlikda saqlaydi — birini ikkinchisisiz oʻzgartirib boʻlmaydi. Bu yerda turli xil radiuslar solishtiriladi: Mg ning metall radiusi va O ning kovalent radiusi Shennonning ion radiuslari bilan; tendensiya toʻgʻri, lekin shkalalar turlicha.',
      speak: 'Magniy ikkinchi elektronini beradi va keskin kichrayadi. Kislorod uni energiya sarflab oladi, lekin toʻliq oktetga ega boʻladi.',
    },
    attraction: {
      title: 'Elektrostatik tortishish',
      body:
        'Qarama-qarshi ionlar Kulon qonuni boʻyicha tortishadi va siklda tortishish toʻlgan elektron qobiqlarning itarishi bilan muvozanatlashguncha yaqinlashadi. Yakka gaz holidagi MgO molekulasi haqiqatan mavjud, uning muvozanat masofasi 174,9 pm. ' +
        'Lekin bu ±2 juft emas: yakka O²⁻ ioni ikkinchi elektronni ushlab tura olmaydi, va molekulada zaryadlar taxminan ±1 gacha tenglashadi. ±2 zaryadlar faqat kristallda barqaror, u yerda har bir ion qarama-qarshi ionlar bilan oʻralgan (6-qadam).',
      equation: 'Mg²⁺ (g.) + O²⁻ (g.) → MgO (g.) — rasman;  haqiqiy MgO (g.): rₑ = 174,9 pm',
      note:
        'Bu qadamdagi Mg²⁺ va O²⁻ yozuvlari — siklning rasmiy zaryadlari. Haqiqiy MgO (g.) molekulasi Mg⁺O⁻ ga yaqinroq: uning dipol momenti ≈ 6,2 D, 174,9 pm dagi ±2 nuqtaviy zaryadlar esa 16,8 D berardi (±1 — 8,4 D); 174,9 pm masofa aynan shu haqiqiy molekula uchun koʻrsatilgan. ' +
        'KS 6 dagi Shennon ion (effektiv) radiuslari yigʻindisi — 72 + 140 = 212 pm — 174,9 pm dan katta: gaz juftining sferalari 37 pm ga ustma-ust tushadi. Bu xato emas: gazda ionlar bir-birini kuchli qutblaydi, Shennonda esa yakka juft uchun radiuslar yoʻq. Bu qadamda sharlar Shennonning toʻliq radiusida chizilgan (1–4-qadamlarda — radiusning 0,72 qismida), shuning uchun ustma-ust tushish koʻrinadi. ' +
        'Kristallda xuddi shu juft 210,6 pm masofada turadi (6-qadam). Nuqtali yoylar — kuch chiziqlarining sxemasi; son-sanoqsiz juft oʻrniga ikkita juft — soddalashtirish.',
      speak: 'Qarama-qarshi ionlar tortishadi. Haqiqiy gaz holidagi magniy oksidi molekulasida yadrolar bir yuz yetmish besh pikometrgacha yaqinlashadi, lekin undagi zaryadlar ikkidan koʻra birga yaqinroq.',
    },
    lattice: {
      title: 'Panjara va qiyin suyuqlanish',
      body:
        'Har bir ion barcha qoʻshnilarini tortadi va ionlar tosh tuzidagi kabi turdagi panjaraga joylashadi: Fm3̄m, ikkita YoMK kichik panjara, katak qirrasi a = 421,1 pm, Z = 4, zichlik 3,58 g/sm³. Har bir Mg²⁺ ning oltita O²⁻ qoʻshnisi bor va aksincha — KS 6:6. Kristallda muvozanat masofasi 210,6 pm — gazdagi 174,9 pm dan uzoqroq. ' +
        'Panjaraning yigʻilishi 3789 kJ/mol ajratadi — bu 4,8 marta koʻp, NaCl da esa 787. Nega aynan toʻrt marta emas? Tortishish energiyasi q₁q₂/r ga proporsional (kuch kabi 1/r² ga emas): zaryadlar koʻpaytmasi 4 koeffitsiyent beradi, qisqaroq masofa — yana 282,0/210,6, nuqtaviy zaryadlar modelida jami ≈ 5,4. Qobiqlarning itarishi ikkala energiyani deyarli bir xil kamaytiradi — MgO da atigi bir-ikki foiz koʻproq — shuning uchun haqiqiy 4,8 ni boshqa narsa tushuntiradi: MgO dagi effektiv zaryad 2 dan kichik (O²⁻ ioni faqat panjara maydonida mavjud), U(MgO) ning oʻzi esa oʻlchanmaydigan EA₂ orqali chiqarilgan — EA₂ = +844 boʻlganda (+744 oʻrniga) nisbat ≈ 4,9 boʻlardi. ' +
        'Qiyin suyuqlanish shundan: MgO taxminan 2830 °C da, NaCl esa 801 °C da suyuqlanadi.',
      equation: 'Mg²⁺ (g.) + O²⁻ (g.) → MgO (q.),  U = −3789 kJ/mol',
      note:
        'Kadrda 2×2×2 elementar katakdan iborat fragment — 125 ta ion, har qirrada 5 tadan; och chiziqlar — bogʻlar emas, katak qirralari. Syujetning toʻrtta ionidan tashqari panjara ionlari — xuddi shunday boshqa aktlarning mahsulotlari: qolgan 121 ta ion kadrga tayyor holda kiradi. Fragmentda 63 ta Mg²⁺ ioni va 62 ta O²⁻ ioni bor, shuning uchun kesma umuman zaryadlangan (+2), haqiqiy kristall esa neytral — bu soddalashtirish. ' +
        'Panjara sharlari radiusning 0,5 qismida chizilgan, fragment orqali qirralar koʻrinib tursin: haqiqiy kristallda qoʻshni ionlar tegib turadi (72 + 140 = 212 ≈ 210,6 pm). Maʼlumotnomalar MgO ning suyuqlanish haroratini 2825 dan 2852 °C gacha beradi, bu yerda yadroning bitta qiymati — 2830 °C; MgO taxminan 3600 °C da parchalanib qaynaydi. Panjara bosqichi −3789 EA₂ = +744 bilan kelishilgan; CRC Handbook −3791 beradi — farq 0,05 %.',
      speak: 'Tuzdagi panjaraning xuddi oʻzi, lekin zaryadlar ikki barobar katta: panjara deyarli besh barobar mustahkam, oksid esa faqat ikki ming sakkiz yuz oʻttiz daraja atrofida suyuqlanadi.',
    },
    energy: {
      title: 'Energetik yakun',
      body:
        'Born — Gaber siklining barcha bosqichlarini qoʻshamiz: +147,1 (sublimatsiya) + 249,2 (dissotsiatsiya) + 737,7 (IE₁) + 1450,7 (IE₂) − 141,0 (EA₁) + 744,0 (EA₂) − 3789,0 (panjara) = har mol MgO uchun −601,3 kJ. Jadvaldagi hosil boʻlish issiqligi −601,6: farq 0,3 kJ/mol — maʼlumotnoma tarqoqligi doirasida. ' +
        'Panjara energiyasisiz dastlabki oltita bosqich yigʻindisi +3187,7 kJ/mol boʻlardi — jarayon juda koʻp issiqlik yutardi. ' +
        'Reaksiyani ekzotermik qiladigan aynan panjara: 2 Mg + O₂ tenglamasida 1203,2 kJ ajraladi.',
      equation: '2 Mg (q.) + O₂ (g.) → 2 MgO (q.),  ΔH = −1203,2 kJ',
      note: 'Elektron balansi: 2 Mg⁰ − 4e⁻ → 2 Mg²⁺, O₂⁰ + 4e⁻ → 2 O²⁻ — qancha elektron berilgan boʻlsa, shuncha olingan. ½ O₂ → O bosqichi ΔH°f(O, gaz) = 249,2 kJ/mol ga teng (298 K da) — O=O bogʻ energiyasining yarmi (498,4). 298 K dagi siklning panjara bosqichi — aniq aytganda panjara entalpiyasi; panjara energiyasi U undan bir necha kJ/mol ga farq qiladi. Xuddi shunday IE va EA — 0 K dagi kattaliklar: 298 K da har bir shunday bosqichga rasman har elektron uchun ±5/2 RT qoʻshiladi, yopiq siklda esa bu tuzatishlar bir-birini yoʻqqa chiqaradi. Kristall ustidagi ΔH°f — jadvaldagi (−601,6), zinapoya — bosqichlar yigʻindisi (−601,3).',
      speak: 'Yakun: har mol oksid uchun minus olti yuz bir kilojoul. Energiyani kristall panjara beradi.',
    },
  },
  legend: {
    electron: 'Izli va e⁻ yozuvli moviy nuqta — oʻtayotgan elektron; ular jami toʻrtta, har bir magniy atomidan ikkitadan.',
    orbitalPhase: 'Atom atrofidagi moviy nuqtalar — Lyuis boʻyicha valent elektronlar: Mg da ikkita (3s²), O da oltita, O⁻ da yettita, O²⁻ da sakkizta. Bu elektronlar soni, orbital shakli emas.',
  },
  safety:
    'Yonayotgan magniyga toʻgʻridan-toʻgʻri qarash mumkin emas: alanga koʻzni qamashtiradi va koʻz uchun xavfli ultrabinafsha nur chiqaradi. Tajribani faqat oʻqituvchi qora shisha orqali koʻrsatadi. Yonayotgan magniyni na suv bilan — u suvdan kislorodni tortib oladi, vodorod ajraladi va portlaydi — na karbonat angidridli yoki koʻpikli oʻt oʻchirgich bilan oʻchirib boʻlmaydi: magniy karbonat angidridda ham yonadi (2 Mg + CO₂ → 2 MgO + C). Quruq qum yoki D sinf kukuni bilan oʻchiriladi.',
  energy: {
    title: 'Born — Gaber sikli',
    unit: 'kJ/mol',
    caption: '1 mol MgO uchun sarflar (yuqoriga) va yutuq (pastga); bosqichlar yigʻindisi — hosil boʻlish issiqligi.',
    stages: {
      sublimation: 'Mg (q.) → Mg (g.)',
      dissociation: '½ O₂ → O',
      ionization1: 'Mg → Mg⁺ + e⁻',
      ionization2: 'Mg⁺ → Mg²⁺ + e⁻',
      affinity1: 'O + e⁻ → O⁻',
      affinity2: 'O⁻ + e⁻ → O²⁻',
      lattice: 'Mg²⁺ + O²⁻ → MgO (q.)',
      total: 'Yakun: ΔH°f',
    },
    summary: 'MgO uchun Born — Gaber sikli: bosqichlar yigʻindisi {dH} kJ/mol',
    sources: 'Maʼlumotnoma qiymatlari: NIST-JANAF, CRC Handbook (panjara energiyasi va EA₂ — Born — Gaber sikli boʻyicha).',
  },
}
