import type { MgoMechanismText } from './mgoMechanismText'

export const MGO_TEXT_UZ: MgoMechanismText = {
  intro: {
    title: 'Ion bogʻlanish: ikkita elektron',
    speak: 'Magniyning yonishini kuzatamiz: har bir atom kislorodga birdaniga ikkita elektron beradi.',
  },
  steps: {
    reactants: {
      title: 'Dastlabki moddalar',
      body:
        'Chap tomonda metall magniy boʻlagi: Mg atomlari geksagonal zich joylashuvda (GZJ, P6₃/mmc) turadi, har birining eng yaqin qoʻshnilari oʻn ikkita, masofa taxminan 320 pm. ' +
        'Oʻng tomonda kislorod molekulasi O₂: atomlarni QOʻSH bogʻ ushlab turadi, uzunligi 120,8 pm, energiyasi 498 kJ/mol — bu Cl–Cl bogʻidan ikki barobar mustahkam. ' +
        'Metalldagi magniy atomining radiusi 160 pm, kislorod atomining kovalent radiusi esa bor-yoʻgʻi 66 pm. 25 °C da kislorod — gaz, magniy — kumushrang metall.',
      equation: '2 Mg (qat.) + O₂ (gaz)',
      note: 'Kislorod reaksiyaga aynan O₂ MOLEKULASI holida kirishadi, alohida atomlar holida emas; kadrda metallning 13 ta atomi koʻrsatilgan, haqiqiy magniy lentasida ular 10²¹ ga yaqin.',
      speak: 'Chapda metall magniy, oʻngda qoʻsh bogʻli kislorod molekulasi.',
    },
    ignition: {
      title: 'Yondirish',
      body:
        'Reaksiya oʻz-oʻzidan boshlanmaydi: lenta oksid pardasi bilan qoplangan, O=O bogʻini esa uzish kerak. Gugurt yoki gorelka birinchi turtkini beradi — keyin magniy oʻzi yonadi va shunchalik koʻp issiqlik chiqaradiki, alanga taxminan 3100 K gacha qiziydi va deyarli oq nur sochadi. ' +
        'Magniy atomi metall panjarasidan uziladi — bunga bir mol uchun 147,1 kJ sarflanadi (sublimatsiya). ' +
        'O=O qoʻsh bogʻi gomolitik, teng ikkiga uziladi: yarim mol O₂ uchun 249,2 kJ ketadi. Ikkala bosqich ham endotermik — energiya zinapoyasi yuqoriga koʻtariladi.',
      equation: 'Mg (qat.) → Mg (gaz);  ½ O₂ (gaz) → O (gaz)',
      note: 'Oq alanga yorugʻlik va chaqnash bilan koʻrsatilgan. Haqiqatda yonayotgan magniy kuchli ultrabinafsha nur ham beradi — himoya oynasisiz unga qarash mumkin emas.',
      speak: 'Yondirildi — va magniy koʻzni qamashtiradigan oq alanga bilan yonadi. Kislorod molekulasidagi bogʻ teng ikkiga uziladi.',
    },
    transfer: {
      title: 'Har bir atomdan ikkita elektron',
      body:
        'Magniyning tashqi qavatida ikkita elektron bor (3s²) va u ikkalasini ham beradi. Birinchisi 737,7 kJ/mol evaziga uziladi, ikkinchisi — 1450,7: u allaqachon musbat zaryadlangan Mg⁺ iondan uzib olinadi, shuning uchun ikki barobar qimmat. ' +
        'Magniy butun bir elektron qavatini yoʻqotadi va 160 pm dan 72 pm gacha kichrayadi — bu Mg²⁺ kationi. Kislorod oktetini toʻldiradi va 66 pm dan 140 pm gacha kattalashadi: O²⁻ anioni Mg²⁺ dan 1,94 barobar yirik. ' +
        'Eng muhimi: kislorod birinchi elektronni 141 kJ/mol yutuq bilan qabul qiladi, ikkinchisini esa 744 kJ/mol SARF bilan, chunki O⁻ ioni allaqachon manfiy zaryadlangan va keyingi elektronni itaradi.',
      equation: 'Mg⁰ − 2e⁻ → Mg²⁺  (×2);  O₂⁰ + 4e⁻ → 2 O²⁻',
      note: 'Elektronning yoy boʻylab «uchishi» va magniy atrofidagi yorugʻ halqalar — shartli belgilar: elektron oʻtishi kvant hodisasi, halqalar esa faqat tashqi elektronlar ikkita ekanini koʻrsatadi.',
      speak: 'Magniy ikkita elektron beradi va keskin kichrayadi. Kislorod ikkitasini oladi va ikki barobar kattalashadi.',
    },
    attraction: {
      title: 'Toʻrt barobar kuchli tortishish',
      body:
        'Qarama-qarshi zaryadlar Kulon qonuni boʻyicha tortishadi: kuch zaryadlar koʻpaytmasiga toʻgʻri, masofa kvadratiga teskari proporsional. ' +
        'Bu yerda zaryadlar ±1 emas, ±2 — demak zaryadlar koʻpaytmasi osh tuzidagidan toʻrt barobar katta, tortishish ham toʻrt barobar kuchli. ' +
        'Mg²⁺ va O²⁻ toʻlgan qavatlarning itarishi tortishishni muvozanatlagunga qadar yaqinlashadi — 210,6 pm masofada (NaCl da 282 pm edi).',
      equation: 'Mg²⁺ + O²⁻ → Mg²⁺O²⁻,  d = 210,6 pm',
      note: 'Maydon chiziqlari nuqtalar bilan chizilgan — shunda tortishish yoʻnalishi koʻrinadi; ionlar orasida hech qanday «ip» yoʻq, albatta.',
      speak: 'Zaryadlar ikki barobar katta, masofa esa kichik — tortishish osh tuzidagidan toʻrt barobar kuchli chiqadi.',
    },
    lattice: {
      title: 'Panjara va oʻtga chidamlilik',
      body:
        'Ionlar osh tuzi bilan bir xil turdagi panjaraga joylashadi: fazoviy guruh Fm-3m, ikkita yoqqa markazlashgan kubik (YMK) ost-panjara, katak qirrasi 421,1 pm, Z = 4, zichligi 3,58 g/sm³. ' +
        'Zaryadlar qatʼiy navbatlashadi, shuning uchun bir xil ishorali ionlar hech qachon qoʻshni boʻlmaydi; har bir Mg²⁺ ning roppa-rosa oltita O²⁻ qoʻshnisi bor va aksincha — koordinatsion son 6. ' +
        'Panjaraning yigʻilishi 3789 kJ/mol energiya chiqaradi — bu NaCl dagidan (787) deyarli besh barobar koʻp. Oʻtga chidamlilik ham shundan: MgO ni eritish uchun 2852 °C kerak, osh tuzi uchun esa 801 °C. Shuning uchun pechlarning ichi magniy oksidi bilan qoplanadi.',
      equation: 'Mg²⁺ (gaz) + O²⁻ (gaz) → MgO (qat.),  U = −3789 kJ/mol',
      note: 'Kadrda 4×4×4 boʻlak — 64 ta ion. Bir millimetrlik periklaz donachasida ular 10¹⁹ ga yaqin.',
      speak: 'Tuznikiga oʻxshash panjara, lekin zaryadlar ikki barobar katta — magniy oksidi faqat 2852 gradusda eriydi.',
    },
    energy: {
      title: 'Energiya yakuni',
      body:
        'Born — Haber siklining barcha bosqichlarini qoʻshamiz: +147,1 (sublimatsiya) + 249,2 (dissotsiatsiya) + 737,7 (IE₁) + 1450,7 (IE₂) − 141,0 (EA₁) + 744,0 (EA₂) − 3789,0 (panjara) = bir mol MgO uchun −601 kJ. Jadvaldagi hosil boʻlish issiqligi −601,6 — mos keladi. ' +
        'Panjara energiyasisiz dastlabki oltita bosqich yigʻindisi +3188 kJ/mol boʻlardi: jarayon hech qachon bormas edi. ' +
        'Hammasi panjara energiyasiga tayanadi — aynan u bu reaksiyani maktab kimyosidagi eng yorqin reaksiyalardan biriga aylantiradi.',
      equation: '2 Mg (qat.) + O₂ (gaz) → 2 MgO (qat.),  ΔH = −1202 kJ',
      note: 'Kislorodning ikkinchi elektronga moyilligi bevosita oʻlchanmaydi — u Born — Haber siklidan chiqariladi, shuning uchun maʼlumotnomalarda +744 dan +844 kJ/mol gacha, panjara energiyasi esa −3789 dan −3850 gacha beriladi. Biz siklni jadvaldagi ΔH°f bilan yopadigan mos juftlikni olamiz.',
      speak: 'Natija: bir mol oksid uchun minus olti yuz bir kilojoul. Butun energiyani kristall panjara beradi.',
    },
  },
  legend: {
    electron: 'Izli koʻk nuqta — oʻtayotgan elektron; ular toʻrtta, har bir magniy atomidan ikkitadan.',
    orbitalPhase: 'Magniy atrofidagi ikkita yorugʻ halqa — uning ikkita tashqi 3s² elektronining shartli belgisi, orbital shakli emas.',
  },
  safety:
    'Yonayotgan magniyga toʻgʻridan-toʻgʻri qarash mumkin emas: alanga koʻzni qamashtiruvchi yorugʻlikdan tashqari koʻz uchun xavfli ultrabinafsha nur ham beradi. Tajribani faqat oʻqituvchi, qoraytirilgan oyna orqali koʻrsatadi; yonayotgan magniyni suv bilan oʻchirish mumkin emas — u suvni parchalaydi.',
  energy: {
    title: 'Born — Haber sikli',
    unit: 'kJ/mol',
    caption: '1 mol MgO uchun sarflar (yuqoriga) va yutuqlar (pastga); bosqichlar yigʻindisi — hosil boʻlish issiqligi.',
    stages: {
      sublimation: 'Mg (qat.) → Mg (gaz)',
      dissociation: '½ O₂ → O',
      ionization1: 'Mg → Mg⁺ + e⁻',
      ionization2: 'Mg⁺ → Mg²⁺ + e⁻',
      affinity1: 'O + e⁻ → O⁻',
      affinity2: 'O⁻ + e⁻ → O²⁻',
      lattice: 'Mg²⁺ + O²⁻ → MgO (qat.)',
      total: 'Yakun: ΔH°f',
    },
    summary: 'MgO uchun Born — Haber sikli: bosqichlar yigʻindisi {dH} kJ/mol',
    sources: 'Maʼlumotnoma qiymatlari: NIST-JANAF, CRC Handbook (panjara energiyasi va EA₂ — Born — Haber sikli boʻyicha).',
  },
}
