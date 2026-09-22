import type { H2oMechanismText } from './h2oMechanismText'

export const H2O_TEXT_UZ: H2oMechanismText = {
  intro: {
    title: 'Zanjir reaksiya va qutbli molekula',
    speak: 'Vodorod va kisloroddan suv qanday tug‘ilishini ko‘ramiz — radikallar zanjiri orqali.',
  },
  steps: {
    reactants: {
      title: 'Qaldiroq gaz',
      body:
        'Kadrda ikki hajm vodorod bilan bir hajm kislorod aralashmasi (qaldiroq gaz): to‘rtta H₂ molekulasi va ikkita O₂ molekulasi. 25 °C da ikkala modda ham ikki atomli molekulalardan iborat gaz, ballonda yakka atomlar yo‘q. ' +
        'H₂ da bitta σ-bog‘, rₑ = 74,14 pm, uzilish energiyasi 435,8 kJ/mol; O₂ da bog‘ qo‘sh (σ + π), rₑ = 120,75 pm, uzilish energiyasi 498,4 kJ/mol. ' +
        'O₂ molekulasi — triplet: unda ikkita juftlashmagan elektron bor, shuning uchun suyuq kislorod magnitga tortiladi.',
      equation: '2 H₂ (gaz) + O₂ (gaz);  kadrda 4 H₂ + 2 O₂',
      note: 'Sharchalar — Kordero kovalent radiuslari (H 31 pm, O 66 pm), 0,72 ulushda chizilgan. O₂ dagi ikki havorang nuqta — tripletning ikki juftlashmagan elektroni; aslida ular butun molekulaning ikki π*-orbitali bo‘ylab delokallashgan, nuqtalar elektronlar sonini ko‘rsatadi, joyini emas. 10²³ o‘rniga to‘rtta H₂ va ikkita O₂ — soddalashtirish.',
      speak: 'Vodorod va kislorod — ikki atomli gazlar. Ikki hajm vodorodga bir hajm kislorod — bu qaldiroq gaz.',
    },
    spark: {
      title: 'Uchqun: initsiirlash',
      body:
        'Xona haroratida aralashma yillab turishi mumkin: yondirmasdan reaksiya bormaydi. ' +
        'Uchqun bitta H₂ molekulasidagi bog‘ni gomolitik uzadi — umumiy juft teng bo‘linadi va ikkita H· radikali hosil bo‘ladi, har birida bittadan juftlashmagan elektron. ' +
        'Buning uchun +436,0 kJ/mol kerak — bu zanjirning initsiirlanishi. Ikkinchi H· radikali kadrdan chiqib, o‘z zanjirini boshlaydi.',
      equation: 'H₂ → 2 H·,  ΔH = +436,0 kJ/mol',
      note: 'Bosqich atomar vodorodning hosil bo‘lish issiqligidan hisoblangan: 2 · 218,0 = 436,0 kJ/mol (NIST-JANAF); jadvaldagi H–H bog‘ energiyasi 435,8, ma’lumotnomalar orasidagi farq 0,2 kJ/mol. Chaqnash — energiya berilishining shartli belgisi, u molekulalardan tashqarida; haqiqiy uchqunda birinchi radikallar turli yo‘llar bilan, jumladan O₂ dan ham hosil bo‘ladi.',
      speak: 'Uchqun vodorod molekulasini ikkiga bo‘ladi — ikkita radikal paydo bo‘ladi.',
    },
    branching: {
      title: 'Zanjirning tarmoqlanishi',
      body:
        'H· radikali O₂ molekulasiga urilib, bitta kislorod atomini olib ketadi: H· + O₂ → ·OH + O. Bosqich endotermik, +68,5 kJ/mol, — shuning uchun yondirilmagan qaldiroq gaz barqaror. ' +
        'Bo‘shagan O atomi — IKKITA juftlashmagan elektronli O(³P); u darhol H₂ dan vodorod atomini tortib oladi: O + H₂ → ·OH + H·, +6,1 kJ/mol. ' +
        'Bitta radikaldan uchta bo‘ldi: zanjir tarmoqlandi.',
      equation: 'H· + O₂ → ·OH + O(³P);  O(³P) + H₂ → ·OH + H·',
      note: 'Nuqtalar — juftlashmagan elektronlar: H· da bitta, ·OH da bitta (kislorodda), O atomida ikkita. Kislorod atomini bitta nuqta bilan «O·» deb yozish noto‘g‘ri: O(³P) atomida ikkita juftlashmagan elektron bor. Har bir bosqichda ularning soni saqlanadi: 1 + 2 = 1 + 2 va 2 + 0 = 1 + 1. ·OH radikalidagi O–H uzunligi suvdagidek, 95,8 pm chizilgan; radikalning o‘zida bog‘ biroz uzunroq.',
      speak: 'Bitta radikal uchtaga aylanadi — zanjir tarmoqlanadi.',
    },
    propagation: {
      title: 'Zanjirning davom etishi',
      body:
        '·OH radikallari H₂ molekulalaridan vodorodni tortib oladi: ·OH + H₂ → H₂O + H·. Bu bosqich ekzotermik, −61,1 kJ/mol: aynan shu yerda suv tug‘iladi va issiqlik ajraladi. ' +
        'Har bir bunday qadam H· radikalini qaytaradi va zanjir davom etadi. ' +
        'Bitta bo‘g‘in natijasi: H· + O₂ + 3 H₂ → 2 H₂O + 3 H·, ΔH = −47,6 kJ/mol — radikallar uch barobar ko‘paydi, bo‘g‘inlar ko‘chkidek ko‘payadi va aralashma portlaydi.',
      equation: '·OH + H₂ → H₂O + H·  (×2)',
      note: 'Uchta H· radikali yo‘qolmaydi: haqiqiy aralashmada har biri yangi bo‘g‘in boshlaydi, zanjir esa ikki radikal idish devorida yoki uchinchi zarracha bilan uchrashganda uziladi (2 H· → H₂). Barcha zarrachalar neytral — faqat juftlashmagan elektronlar soni o‘zgaradi. Kadrdagi ikkinchi O₂ o‘z H· ini kutadi.',
      speak: 'OH radikali vodorodni oladi — suv hosil bo‘ladi va yana radikal qaytadi.',
    },
    molecule: {
      title: 'Suv molekulasi',
      body:
        'Suv molekulasi burchakli: ikkita O–H bog‘i 95,8 pm dan, H–O–H burchagi 104,5° (tebranish bo‘yicha o‘rtachalangan r₀; muvozanat rₑ qiymatlari — 95,72 pm va 104,52°). ' +
        'Kislorodning elektromanfiyligi 3,44, vodorodniki 2,20: umumiy juftlar kislorod tomon siljigan, O da qisman zaryad δ−, H da δ+. ' +
        'Molekula burchakli bo‘lgani uchun ikki qutbli bog‘ vektorlari bir-birini yo‘qotmaydi: dipol momenti μ = 1,855 D.',
      equation: 'H₂O: d(O–H) = 95,8 pm, ∠H–O–H = 104,5°, μ = 1,855 D',
      note: 'Kislorodda ikkita bo‘linmagan juft bor — maktab sp³ sxemasidagi havorang yarim shaffof bo‘lakchalar (109,5° tetraedrik burchak ostidagi «quyon quloqlari»). Fotoelektron spektrlarga ko‘ra juftlar teng emas (1b₁ va 3a₁ orbitallari), shuning uchun bo‘lakchalar o‘lchov emas, model: faqat H–O–H burchagi o‘lchanadi. Bog‘larning qutbliligi shu qadamda ta’kidlangan — bog‘lar hosil bo‘lgan paytdanoq qutbli.',
      speak: 'Suv molekulasi — burchak. Kislorod elektronlarni o‘ziga tortadi, shuning uchun molekula qutbli.',
    },
    ice: {
      title: 'Muz Ih',
      body:
        'Sovitilganda suv molekulalari muz Ih ga yig‘iladi: fazoviy guruh P6₃/mmc, a = 451,8 pm, c = 735,6 pm, Z = 4. ' +
        'Har bir molekula to‘rtta qo‘shnisi bilan vodorod bog‘lari orqali bog‘langan (KS 4), O···O masofasi 276,2 pm; har bir O···O chizig‘ida aynan bitta H atomi, har bir O da ikkita o‘ziniki (Bernal — Faulerning muz qoidalari). ' +
        'Tetraedrlar to‘ri g‘ovak, unda bo‘shliq ko‘p, shuning uchun muzning zichligi — 0,92 g/sm³ (250 K da) — suyuq suvnikidan kichik va muz suzib yuradi.',
      equation: 'H₂O (suyuq.) → H₂O (qat., muz Ih)',
      note: 'Fragment — 2×2×1 elementar yacheyka, 16 molekula; och chiziqlar — yacheyka qirralari, punktir — H···O vodorod bog‘lari. Yadro bazisida faqat kislorod panjarachasi bor: muzda H atomlari tartibsiz, bu yerda muz qoidalariga mos joylashuvlardan biri ko‘rsatilgan. H O···O chizig‘ida 95,8 pm masofada turadi — muzda O–H bog‘i biroz uzunroq, H–O–H burchagi esa tetraedrikka yaqin. Zichlik — rentgen zichligi, 250 K dagi yacheykadan.',
      speak: 'Muzda har bir molekula to‘rtta qo‘shnisini vodorod bog‘lari bilan ushlaydi. To‘r g‘ovak, shuning uchun muz suvdan yengil.',
    },
    energy: {
      title: 'Energetik natija',
      body:
        'Gess qonuni bosqichlarini erkin atomlar orqali qo‘shamiz: +436,0 (H₂ → 2 H) + 249,2 (½ O₂ → O) − 429,9 (H + O → ·OH) − 497,1 (H + ·OH → H₂O) = −241,8 kJ bir mol suv bug‘iga — aynan jadvaldagi hosil bo‘lish issiqligi. ' +
        'Butun tenglama 2 H₂ + O₂ → 2 H₂O (gaz) uchun 483,6 kJ ajraladi. ' +
        'Bug‘ kondensatlansa, yana 44,0 kJ/mol ajraladi va suyuq suv uchun ΔH°f = −285,8 kJ/mol.',
      equation: '2 H₂ (gaz) + O₂ (gaz) → 2 H₂O (gaz),  ΔH = −483,6 kJ',
      note: 'Bu reaksiya bosqichlari emas, hisob yo‘li: haqiqiy yo‘l — 2–4 qadamlardagi zanjir, lekin Gess qonuniga ko‘ra natija yo‘lga bog‘liq emas. 436,0 = 2 · 218,0 bosqichi — atomar vodorodning ikki hosil bo‘lish issiqligi; 429,9 va 497,1 — O–H bog‘larining ketma-ket uzilish energiyalari: ·OH radikalidagi bog‘ birinchisidan osonroq uziladi. O‘rtacha bog‘ energiyalari bo‘yicha maktab hisobi (2 · 435,8 + 498 − 4 · 463) −482,4 kJ beradi — o‘rtachalash tufayli modul bo‘yicha 1,2 kJ kam. Vodorod deyarli rangsiz issiq alanga bilan yonadi; 3D da alanga chizilmaydi.',
      speak: 'Natija: bir mol bug‘ga minus ikki yuz qirq ikki kilojoul. Energiyani yangi O–H bog‘lari beradi.',
    },
  },
  legend: {
    electron: 'Zarrachalar yonidagi havorang nuqtalar — radikallarning juftlashmagan elektronlari: H· da bitta, ·OH da bitta, O(³P) da ikkita, O₂ molekulasida ikkita.',
    orbitalPhase: 'Kisloroddagi havorang yarim shaffof bo‘lakchalar — ikkita bo‘linmagan juft (maktab sp³ sxemasi).',
    water: 'Molekulalar orasidagi punktir — H···O vodorod bog‘i, kovalent bog‘ emas.',
  },
  safety: 'Qaldiroq gaz uchqundan portlaydi. Tajribani faqat o‘qituvchi ko‘rsatadi — juda kichik hajmdagi gaz bilan, himoya ekrani ortida; vodorodni kislorod bilan mustaqil aralashtirish mumkin emas.',
  energy: {
    title: 'Gess qonuni bo‘yicha energiya',
    unit: 'kJ/mol',
    caption: 'Erkin atomlar orqali hisob yo‘li (reaksiya bosqichlari emas), 1 mol H₂O (bug‘) ga; bosqichlar yig‘indisi — hosil bo‘lish issiqligi.',
    stages: {
      dissocHH: 'H₂ → 2 H',
      dissocOO: '½ O₂ → O',
      bond1: 'H + O → ·OH',
      bond2: 'H + ·OH → H₂O',
      total: 'Natija: ΔH°f',
    },
    summary: 'H₂O uchun atomlar orqali yo‘l: bosqichlar yig‘indisi {dH} kJ/mol',
    sources: 'Ma’lumotnoma qiymatlari: NIST-JANAF va CRC Handbook (ΔH°f, bog‘ energiyalari), NIST CCCBDB (molekula geometriyasi); muz Ih — rentgen-struktura ma’lumotlari.',
  },
}
