import type { FesMechanismText } from './fesMechanismText'

export const FES_TEXT_UZ: FesMechanismText = {
  intro: {
    title: 'Aralashma yoki birikma',
    speak: 'Oltingugurt kukunini temir qirindisi bilan aralashtiramiz, so‘ng qizdiramiz — va aralashma birikmadan nimasi bilan farq qilishini ko‘ramiz.',
  },
  steps: {
    mixture: {
      title: 'Temir va oltingugurt aralashmasi',
      body:
        'Chapda — temir qirindisi: Fe atomlari hajmiy markazlashgan kubik panjarada turadi (HMK, Im-3m, a = 286,65 pm), har birining sakkizta eng yaqin qo‘shnisi 248,2 pm masofada. ' +
        'O‘ngda — oltingugurt: 25 °C da u alohida atomlar emas, balki S₈ toj molekulalari, S–S bog‘ uzunligi 205,5 pm, S–S–S burchagi 108°. ' +
        'Hozircha bu faqat ARALASHMA: nisbati ixtiyoriy, har bir modda o‘z xossalarini saqlaydi. Magnit aralashmadan temirni tortib oladi, oltingugurt esa qoladi — demak, undagi temir hamon temirligicha.',
      equation: 'Fe (qat.) + S₈ (qat.) — aralashma, magnit bilan ajratiladi',
      note: 'Temir bu yerda to‘qqiz atomli bo‘lak, oltingugurt esa bitta S₈ toji shaklida ko‘rsatilgan; haqiqiy namunada ular 10²³ ga yaqin. Magnit oddiy brusok qilib chizilgan: bu yerda faqat tortilish faktining o‘zi muhim.',
      speak: 'Hozircha bu shunchaki aralashma: magnit temirni tortib oladi, oltingugurt joyida qoladi.',
    },
    heating: {
      title: 'Qizdirish va reaksiyaning boshlanishi',
      body:
        'Aralashma qizdiriladi. Qizdirish faqat reaksiyani BOSHLASH uchun kerak: atomlar o‘z panjaralaridan va S₈ tojidan uzilishi lozim. ' +
        'Reaksiya boshlanishi bilan aralashma qizarib, o‘zi yonishda davom etadi — gorelkani olib qo‘ysa ham bo‘ladi. Faqat EKZOTERMIK reaksiya shunday tutadi: ajralib chiqqan energiya boshlanishiga sarflanganidan ko‘p. ' +
        'Bu — oddiy aralashtirish emas, kimyoviy o‘zgarish sodir bo‘lganining birinchi belgisi.',
      equation: 'Fe (qat.) → Fe (gaz), +416,3 kJ/mol;  ⅛ S₈ (qat.) → S (gaz), +277,2 kJ/mol',
      note: 'Kadrda BITTA temir atomi va BITTA oltingugurt atomi kuzatiladi — qolgan aralashma ham xuddi shunday reaksiyaga kirishadi va asosiy voqeani to‘smaslik uchun kadrdan chiqib ketadi.',
      speak: 'Qizdiramiz — va aralashma alangalanadi. Keyin u o‘zi yonadi: reaksiya ekzotermik.',
    },
    transfer: {
      title: 'Elektronlarning o‘tishi',
      body:
        'Temir ikkita tashqi elektronini (4s²) beradi, oltingugurt ularni qabul qilib, tashqi qavatini sakkiztaga to‘ldiradi. ' +
        'Temir atomi butun bir elektron qavatini yo‘qotib, 126 dan 78 pm gacha kichrayadi — bu Fe²⁺ kationi. Oltingugurt atomi esa 105 dan 184 pm gacha kengayadi: S²⁻ anioni Fe²⁺ dan 2,36 marta yirikroq. ' +
        'Elektron balansi to‘g‘ri keladi: ikkita berildi, ikkitasi olindi. Umumiy zaryad chapda 0, o‘ngda (+2) + (−2) = 0.',
      equation: 'Fe⁰ − 2e⁻ → Fe²⁺;  S⁰ + 2e⁻ → S²⁻',
      note: 'Elektronning yoy bo‘ylab «uchishi» va temir atrofidagi yorqin halqa — shartli belgilar: o‘tish kvant xarakterda, halqa esa faqat tashqi elektronlar qayerdaligini ko‘rsatadi.',
      speak: 'Temir ikkita elektron beradi va kichrayadi. Oltingugurt ularni oladi va yiriklashadi.',
    },
    lattice: {
      title: 'NiAs tipidagi panjara',
      body:
        'Qarama-qarshi zaryadlar Kulon qonuni bo‘yicha tortishadi: ionlar 244,5 pm masofaga yaqinlashadi va kristall hosil qiladi. ' +
        'Temir(II)-sulfid — bu troilit, NiAs struktura tipi: har bir Fe²⁺ oltita S²⁻ oktaedri ichida, har bir S²⁻ esa oltita Fe²⁺ uchburchak prizmasi ichida turadi, KS 6/6. ' +
        'Ionlar qat’iy navbatlashadi, shuning uchun bir xil zaryadlar hech qayerda tegmaydi. Bog‘ sof ionli emas: Fe va S ning elektromanfiyligi 1,83 va 2,58, farqi atigi 0,75 — ionli-kovalent bog‘.',
      equation: 'Fe²⁺ + S²⁻ → FeS (qat.), d(Fe–S) = 244,5 pm, KS 6/6',
      note:
        'Chizilgani — NiAs tipidagi IDEAL yacheyka (a = 344,3 pm, c = 587,7 pm); haqiqiy troilit esa uning biroz buzilgan √3a × 2c superstrukturasi: P-62c, a = 596,3 pm, c = 1175,4 pm, Z = 12, ρ = 4,61 g/sm³. ' +
        'Shu buzilish tufayli chizilgan Fe–S masofasi o‘lchanganidan 1 % kattaroq. 31 iondan iborat qatlam ko‘rsatilgan.',
      speak: 'Ionlar tortishadi va nikel-arsenid tipidagi panjaraga tiziladi: har birida oltita qo‘shni.',
    },
    product: {
      title: 'Yangi modda',
      body:
        'Natijada temir(II)-sulfid FeS hosil bo‘ldi — na temirga, na oltingugurtga o‘xshamaydigan qora qattiq modda. ' +
        'Endi magnit ojiz: temir ferromagnit, troilit esa antiferromagnit — ionlarining magnit momentlari bir-birini so‘ndiradi, umumiy magnitlanish yo‘q va maktab magniti kristallni ko‘tara olmaydi. ' +
        'Ikkinchi dalil — xlorid kislota bilan reaksiya: sulfid chirigan tuxum hidli vodorod sulfid H₂S beradi, dastlabki aralashma esa faqat temirdan vodorod bergan bo‘lardi. Birikmaning tarkibi qat’iy doimiy: bitta temir atomiga bitta oltingugurt atomi.',
      equation: 'FeS + 2 HCl → FeCl₂ + H₂S↑',
      note: 'Kislotali probirka 3D da chizilmagan — faqat sinov tenglamasi ko‘rsatilgan. Vodorod sulfid tajribasini o‘qituvchi mo‘ri ostida o‘tkazadi.',
      speak: 'Magnit endi hech nimani tortmaydi: bu temir emas, yangi modda — temir sulfidi.',
    },
    energy: {
      title: 'Energiya va xulosa',
      body:
        'Gess qonuni bo‘yicha balansni yig‘amiz. Atomlarni ozod qilishga 416,3 + 277,2 = 693,5 kJ/mol sarflandi, kristall yig‘ilishida esa 793,5 kJ/mol ajralib chiqdi. ' +
        'Natija: ΔH°f(FeS) = −100,0 kJ/mol — yutuq sarfdan katta, shuning uchun ham aralashma yondirilgandan keyin o‘zi yonadi. ' +
        'Tajriba xulosasi: ARALASHMANI fizik yo‘l bilan (magnit bilan) ajratish mumkin, nisbati ixtiyoriy, komponentlar xossalarini saqlaydi; BIRIKMANI esa bunday ajratib bo‘lmaydi, tarkibi doimiy, xossalari o‘ziga xos.',
      equation: 'Fe (qat.) + S (qat.) → FeS (qat.), ΔH°f = −100,0 kJ/mol',
      note: 'Kristall yig‘ilishi energiyasi (−793,5 kJ/mol) jadval qiymati emas: u Gess qonuni bo‘yicha siklning qoldig‘i sifatida hisoblangan. Qolgan ikki bosqich — gaz holidagi atomlarning ma’lumotnomadagi hosil bo‘lish issiqliklari.',
      speak: 'Har mol uchun yuz kilojoul ajralib chiqadi. Aralashmani ajratish mumkin, birikmani esa yo‘q.',
    },
  },
  legend: {
    electron: 'Izli ko‘k nuqta — o‘tayotgan elektron, bu yerda ular ikkita.',
    orbitalPhase: 'Temir atrofidagi yorqin halqa — tashqi 4s² elektronlarning shartli belgisi, orbital shakli emas.',
    magnet: 'Qizil-ko‘k brusok — magnit. Birinchi qadamda u temirni ko‘taradi, beshinchisida sulfidni joyidan qimirlata olmaydi.',
  },
  safety: 'Temir va oltingugurt aralashmasini faqat o‘qituvchi, faqat mo‘ri ostida yondiradi: oltingugurt havoda bo‘g‘uvchi SO₂ beradi, sulfid esa kislota bilan zaharli vodorod sulfid H₂S hosil qiladi. Bu tajribani mustaqil takrorlash mumkin emas.',
  energy: {
    title: 'Gess qonuni bo‘yicha energiya',
    unit: 'kJ/mol',
    caption: '1 mol FeS uchun sarf (yuqoriga) va yutuq (pastga); bosqichlar yig‘indisi — hosil bo‘lish issiqligi.',
    stages: {
      atomFe: 'Fe (qat.) → Fe (gaz)',
      atomS: '⅛ S₈ (qat.) → S (gaz)',
      crystal: 'Fe (gaz) + S (gaz) → FeS (qat.)',
      total: 'Natija: ΔH°f',
    },
    summary: 'FeS energiya zinapoyasi: bosqichlar yig‘indisi {dH} kJ/mol',
    sources: 'Ma’lumotnoma qiymatlari: CODATA, CRC Handbook. Kristall yig‘ilishi energiyasi jadvaldan olinmagan, Gess qonuni bo‘yicha hisoblangan.',
  },
}
