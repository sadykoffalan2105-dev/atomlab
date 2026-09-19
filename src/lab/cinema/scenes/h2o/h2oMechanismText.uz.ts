import type { H2oMechanismText } from './h2oMechanismText'

/** «2 H₂ + O₂ → 2 H₂O» darsining o‘zbekcha matni. Raqamlar ruscha variant bilan bir xil. */
export const H2O_TEXT_UZ: H2oMechanismText = {
  intro: {
    title: 'Qutbli kovalent bog‘',
    speak: 'Vodorod kislorodda qanday yonishini ko‘ramiz: elektron juftlari umumiy bo‘ladi va suv hosil bo‘ladi.',
  },
  steps: {
    reactants: {
      title: 'Gremuchiy gaz (portlovchi aralashma)',
      body:
        'Chapda ikkita vodorod molekulasi H₂, o‘ngda bitta kislorod molekulasi O₂. 25 °C da ikkala oddiy modda ham gaz va aynan IKKI ATOMLI molekulalardan iborat: ballonda yakka H yoki O atomlari yo‘q. ' +
        'H₂ molekulasida atomlar bitta umumiy elektron jufti bilan bog‘langan, yadrolar orasi 74,14 pm; O₂ da bog‘ qo‘sh va kaltaroq — 120,8 pm. ' +
        'Ikki hajm vodorod va bir hajm kislorod aralashmasi portlovchi gaz deyiladi: u yillab turishi mumkin, ammo bitta uchqundan bir zumda reaksiyaga kirishadi.',
      equation: '2 H₂ (gaz) + O₂ (gaz)',
      note: 'Sharchalar radiusi kovalent: H 31 pm, O 66 pm — shuning uchun vodorod kisloroddan ikki barobar kichik ko‘rinadi.',
      speak: 'Vodorod va kislorod — ikki atomli gazlar. Ikki hajm vodorod va bir hajm kislorod portlovchi aralashma.',
    },
    spark: {
      title: 'Uchqun: bog‘lar uziladi',
      body:
        'Aralashma o‘z-o‘zidan yonmaydi: reaksiya boshlanishi uchun aktivlanish energiyasi kerak — uchqun, alanga yoki katalizator. ' +
        'Uchqundan bog‘lar GOMOLITIK uziladi: umumiy juft teng bo‘linadi va har bir bo‘lak bittadan elektron oladi. Natijada juftlashmagan elektronli erkin radikallar H· va O· hosil bo‘ladi. ' +
        'Bog‘ni uzish endotermik jarayon: ikkita H–H va bitta O=O bog‘iga 2 · 436 + 498 = 1370 kJ kerak. Energiya zinapoyasida bular YUQORIGA qadam.',
      equation: '2 H₂ → 4 H· (+872 kJ);  O₂ → 2 O· (+498 kJ)',
      note: 'Haqiqiy vodorod yonishi — zanjirli radikal reaksiya (H· + O₂ → ·OH + O· va hokazo). Bu yerda soddalashtirilgan «avval hammasini uzdik, keyin hammasini yig‘dik» manzarasi ko‘rsatilgan: bog‘ energiyalari bo‘yicha hisob aynan shuni nazarda tutadi va Gess qonuni bo‘yicha yakuniy natija bir xil chiqadi.',
      speak: 'Uchqun kerak. Bog‘lar teng bo‘linadi, radikallar paydo bo‘ladi — bunga energiya sarflanadi.',
    },
    bonds: {
      title: 'Yangi O–H bog‘lari',
      body:
        'Radikallar soniyaning juda kichik ulushicha yashaydi va darhol qayta tuziladi: har bir kislorod atomi ikkita vodorod atomini oladi. ' +
        'H atomi bitta elektron, O atomi ikkinchisini beradi va bu JUFT UMUMIY bo‘ladi — kovalent bog‘ shunday tuzilgan. O–H bog‘ uzunligi 95,8 pm. ' +
        'Ammo juft teng bo‘linmaydi: kislorodning elektromanfiyligi 3,44, vodorodniki esa 2,20, shuning uchun umumiy juft buluti kislorod tomonga siljigan. Bunday bog‘ QUTBLI kovalent bog‘ deyiladi.',
      equation: '4 H· + 2 O· → 2 H₂O (gaz);  4 · (−463 kJ)',
      note: 'Vodoroddan kislorodga uchayotgan nurli nuqta — shartli belgi. Kovalent bog‘da elektron butunlay berilmaydi: juft umumiy bo‘lib qoladi, faqat uning buluti siljiydi. To‘liq berilishi ion bog‘i bo‘lardi, NaCl dagi kabi.',
      speak: 'Har bir kislorod ikkita vodorodni oladi. Elektron jufti umumiy, lekin kislorod tomonga siljigan.',
    },
    molecule: {
      title: 'Burchakli molekula',
      body:
        'Suv molekulasi to‘g‘ri emas, burchakli: H–O–H burchagi 104,45°. Kislorodda to‘rtta elektron jufti bor — ikkitasi bog‘lovchi va IKKITASI TAQSIMLANMAGAN (ular yarim shaffof bargchalar bilan chizilgan). ' +
        'To‘rt juft bir-birini itaradi va tetraedrga (109,5°) intiladi, ammo taqsimlanmagan juftlar bog‘lovchilaridan «yo‘g‘onroq» va bog‘lar orasidagi burchakni 104,45° gacha siqadi. Kislorodning bu holati sp³-gibridlanish deyiladi. ' +
        'Aynan shu burchak tufayli suv tekis tayoqcha emas, burchak shaklida; uning deyarli butun kimyosi shunga asoslangan.',
      equation: 'H₂O: ∠H–O–H = 104,45°, d(O–H) = 95,8 pm',
      note: 'Faqat H–O–H burchagi o‘lchanadi. Taqsimlanmagan juftlarning yo‘nalishini tajriba bevosita bermaydi, shuning uchun bargchalar ideal tetraedr burchagi 109,47° bo‘yicha chizilgan — bu model, o‘lchov emas.',
      speak: 'Burchak bir yuz to‘rt yarim daraja. Ikkita taqsimlanmagan juft bog‘larni siqadi.',
    },
    polarity: {
      title: 'Qutblilik va vodorod bog‘i',
      body:
        'Elektronlarning siljishi tufayli kislorodda qisman manfiy zaryad δ−, vodorodlarda esa qisman musbat δ+ paydo bo‘ladi. Bular ion emas: zaryad KASR, kislorodda taxminan −0,66 e, har bir vodorodda +0,33 e. ' +
        'Molekula burchakli, shuning uchun zaryadlar bir-birini yo‘qotmaydi — momenti 1,85 D bo‘lgan dipol hosil bo‘ladi. Shuning uchun suv tuzlarni eritadi: uning dipollari ionlarni o‘rab olib, panjarani ajratadi. ' +
        'Bir molekulaning vodorodi qo‘shnisining kislorodiga tortiladi — bu vodorod bog‘i, H···O ≈ 185 pm (kislorod yadrolari orasi taxminan 280 pm). U oddiy O–H bog‘idan yigirma barobardan ko‘proq kuchsiz, ammo aynan shuning uchun suv minus sakson emas, 100 °C da qaynaydi.',
      equation: 'H₂O: δ−(O) ≈ −0,66 e, δ+(H) ≈ +0,33 e, μ = 1,85 D',
      note: 'Qisman zaryadlar dipol momentidan eng sodda nuqtaviy zaryadlar modelida hisoblangan: μ = 2·q·d·cos(θ/2). Aniqroq modellar boshqa raqam beradi — δ hisoblash usuliga bog‘liq va o‘lchanadigan kattalik emas.',
      speak: 'Kislorodda minus, vodorodlarda plyus. Shuning uchun molekulalar vodorod bog‘lari bilan bir-biriga yopishadi.',
    },
    energy: {
      title: 'Energiya yakuni',
      body:
        'Bog‘larni uzishga 1370 kJ sarfladik, to‘rtta O–H bog‘i hosil bo‘lishida esa 1852 kJ oldik. Yutuq — ikki molekulaga 482 kJ, ya’ni bir mol suvga 241 kJ. ' +
        'Suv BUG‘ining ma’lumotnomadagi hosil bo‘lish issiqligi −241,8 kJ/mol — bog‘ energiyalari bo‘yicha hisob mos keldi. Bug‘ suyuqlikka aylansa, yana 44 kJ/mol ajraladi va suyuq suv uchun ΔH°f = −285,8 kJ/mol. ' +
        'Minus energiya ajralishini bildiradi: vodorod rangsiz issiq alanga bilan yonadi, sovuq sirtda esa darhol suv tomchilari o‘tiradi.',
      equation: '2 H₂ (gaz) + O₂ (gaz) → 2 H₂O (gaz), ΔH = −482 kJ',
      note: 'Sahnada BUG‘ ko‘rsatilgan: bog‘ energiyalari gaz holidagi molekulalarga tegishli. −285,8 kJ/mol qiymati suyuq suv uchun, 44 kJ/mol farq esa kondensatsiya issiqligi.',
      speak: 'Yakun: bir mol bug‘ga minus ikki yuz qirq ikki kilojoul, suyuq suvga minus ikki yuz sakson olti.',
    },
  },
  legend: {
    electron: 'Izli ko‘k nuqta — umumiy juftga qo‘shilayotgan elektron.',
    orbitalPhase: 'Kisloroddagi yarim shaffof bargchalar — ikkita taqsimlanmagan elektron jufti (model bo‘yicha chizilgan).',
    water: 'Molekulalar orasidagi ingichka punktir chiziq — vodorod bog‘i, kovalent emas.',
  },
  safety:
    'Vodorod va kislorod aralashmasi keng chegarada portlovchi. Portlovchi gaz tajribasini faqat o‘qituvchi, juda kichik hajmda va himoya ko‘zoynagida o‘tkazadi — bunday aralashmani mustaqil tayyorlash mumkin emas.',
  energy: {
    title: 'Bog‘ energiyalari bo‘yicha energiya (Gess qonuni)',
    unit: 'kJ/mol',
    caption: '1 mol H₂O bug‘iga sarf (yuqoriga) va yutuq (pastga); qadamlar yig‘indisi — hosil bo‘lish issiqligi.',
    stages: {
      dissocHH: 'H₂ → 2 H',
      dissocOO: '½ O₂ → O',
      bond1: 'H + O → HO',
      bond2: 'H + HO → H₂O',
      total: 'Yakun: ΔH°f',
    },
    summary: 'H₂O uchun bog‘ energiyalari bo‘yicha hisob: qadamlar yig‘indisi {dH} kJ/mol',
    sources: 'Ma’lumotnoma qiymatlari: CRC Handbook, NIST-JANAF (bog‘ energiyalari, hosil bo‘lish issiqliklari); H–O–H burchagi — mikroto‘lqinli spektroskopiya.',
  },
}
