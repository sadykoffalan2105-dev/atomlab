import { buildFullSectionSlides } from './g7PilotSlideBuilder'

export { buildFullSectionSlides } from './g7PilotSlideBuilder'

const slide = (
  prefix: string,
  topic: string,
  example: string,
  checkpointQ: string,
  choices: [string, string, string, string],
  correctIndex: number,
  labHint: string,
  extra?: Parameters<typeof buildFullSectionSlides>[8],
) => buildFullSectionSlides('uz', prefix, topic, example, checkpointQ, choices, correctIndex, labHint, extra)

export const learnG7C1S01 = slide(
  'learn.g7.c1.s01',
  'Kimyo fan sifatida',
  'Kimyo moddalar va ularning o\'zgarishlarini o\'rganadi: havo va suv tarkibidan tortib organizm va sanoatdagi reaksiyalargacha. ATOMLAB da xuddi shu g\'oyalar hajmli modellarda ko\'rsatilgan — proyektorda dars uchun qulay.',
  'Kimyo birinchi navbatda nimani o\'rganadi?',
  ['Faqat metallarni', 'Moddalarni va ularning o\'zgarishlarini', 'Faqat organikani', 'Faqat hisob-kitoblarni'],
  1,
  'Laboratoriyani oching: Mendeleev jadvalidagi elementlardan reaksiya yig\'ing va 3D mahsulotni ko\'ring.',
  {
    bullets0: [
      'Kimyo moddalar, ularning tarkibi va o\'zgarishlarini o\'rganadi',
      'Tajriba va hisob-kitob bir-birini to\'ldiradi',
      '3D mikrodunyoni «ko\'rishga» yordam beradi',
    ],
    diagram0: ['Moddalar haqidagi fan', 'Makrotajriba ↔ mikromodel'],
    callout3: 'SI o\'qituvchidan so\'rang: «Kundalik hayotda kimyodan misol keltir».',
  },
)

export const learnG7C1S02 = slide(
  'learn.g7.c1.s02',
  'Modda va xossalari',
  'Muz, suv va bug\' — bir modda (H₂O) turli agregat holatlarida. Xossalar zarralar tuzilishiga bog\'liq.',
  'Modda xossasi nima?',
  ['Qadoq rangi', 'Moddani tanib olish uchun ko\'rinadigan belgi', 'Yorliqdagi nom', 'Faqat hid'],
  1,
  'Katalogda suvni oching va formulani 3D model bilan solishtiring.',
)

export const learnG7C1S03 = slide(
  'learn.g7.c1.s03',
  'Kimyo kabinetida xavfsizlik',
  'Ko\'zoynak, qo\'lqop, tortish va olov bilan ehtiyotkorlik — majburiy. Virtual laboratoriyada ham tartibga o\'rganing.',
  'Laboratoriyada birinchi navbatda nima kerak?',
  ['Stollar orasida yugurish', 'Mehnat xavfsizligi qoidalariga rioya qilish', 'Ta\'m uchun sinab ko\'rish', 'Hamma narsani bitta probirka ichiga quyish'],
  1,
  'Haqiqiy tajribadan oldin qoidalarni takrorlang; ATOMLAB da sintez xavfsiz, lekin odatlar muhim.',
)

export const learnG7C1S04 = slide(
  'learn.g7.c1.s04',
  'Laboratoriya asboblari va isitish',
  'Shtativ, probirkalar, spirtli lampa va gaz gorelka — tajribalar uchun asboblar. Isitish ko\'p reaksiyalarni tezlashtiradi.',
  'Shtativ nima uchun ishlatiladi?',
  ['Bezak uchun', 'Isitishda probirkalarni ishonchli mahkamlash uchun', 'Faqat tarozilar uchun', 'Suv saqlash uchun'],
  1,
  'ATOMLAB laboratoriyasida isitish sintez panelida ko\'rsatilgan — reagentlarni tanlab ko\'ring.',
)

export const learnG7C1S05 = slide(
  'learn.g7.c1.s05',
  'Toza modda va aralashmalar',
  'Do\'kondagi NaCl tuzi ko\'pincha aralashmalarni o\'z ichiga oladi — bu aralashma. Toza moddani ajratish muhim ko\'nikma.',
  'Aralashma toza moddadan nimasi bilan farq qiladi?',
  ['Aralashma — bitta modda', 'Aralashmani komponentlarga ajratish mumkin', 'Aralashma doimo gaz', 'Hech narsa bilan'],
  1,
  'O\'ng panelda eritmalar bo\'yicha masalani yeching — «Eritmalar va konsentratsiya» turi.',
)

export const learnG7C1S06 = slide(
  'learn.g7.c1.s06',
  'Aralashmalarni ajratish',
  'Filtrlash, bug\'latish, magnit ajratish — tozalash usullari. Komponentlar xossalariga qarab usulni tanlang.',
  'Qumni suvdan qanday ajratish mumkin?',
  ['Bug\'latish', 'Filtrlash', 'Sublimatsiya', 'Elektroliz'],
  1,
  'Ish maydonida tuzni tozalash bosqichlarini yozing.',
)

export const learnG7C1S07 = slide(
  'learn.g7.c1.s07',
  'Agregat holatlar',
  'Qattiq, suyuq, gazsimon — isitish/sovitishda modda tarkib o\'zgarmasdan holatini o\'zgartiradi (fizik hodisa).',
  'Muzning erishi bu…',
  ['Kimyoviy reaksiya', 'Fizik hodisa', 'Yonish', 'Zanglash'],
  1,
  'Katalogda H₂O (muz/suv) modellarini solishtiring.',
)

export const learnG7C1S08 = slide(
  'learn.g7.c1.s08',
  'Fizik va kimyoviy hodisalar',
  'Shakar erishi — fizik; yonish — kimyoviy. Kimyoning belgisi — yangi moddalar paydo bo\'lishi.',
  'Havoda magniyning yonishi bu…',
  ['Fizik hodisa', 'Kimyoviy hodisa', 'Erish', 'Bug\'lanish'],
  1,
  '3D panelda Mg + O₂ reaksiyasi animatsiyasini ko\'ring.',
)

export const learnG7C1S09 = slide(
  'learn.g7.c1.s09',
  'Kundalik hayotda kimyo',
  'Ovqat pishirish, kislorodli oqartirish, achishish — kundalik kimyo. Reaksiya belgilarini kuzating va yozing.',
  'Uyda kimyoviy jarayon misoli:',
  ['Suvning muzlashi', 'Sirka kislotaligi va soda bilan reaksiyasi', 'Yog\'ning erishi', 'Havoning erishi'],
  1,
  'Oshxonadan misol o\'ylab toping va o\'ngdagi SI o\'qituvchidan so\'rang.',
)

export const learnG7C1S10 = slide(
  'learn.g7.c1.s10',
  'Takrorlash: moddalar',
  'Mustahkamlaymiz: toza/aralashma, fiz/kim, xavfsizlik. Atom va elementlarga tayyorgarlik.',
  'Aralashmani…',
  ['Faqat yoqish mumkin', 'Qismlarga ajratish mumkin', 'Tegish mumkin emas', 'Faqat muzlatish mumkin'],
  1,
  'O\'ng panelda masalani bajaring va § ni tugallangan deb belgilang.',
)

export const learnG7C2S01 = slide(
  'learn.g7.c2.s01',
  'Atom — modda zarralari',
  'Atom — kimyoviy elementning eng kichik zarralari. 3D da yadro va elektron qobig\'i ko\'rinadi.',
  'Vodorod atomi o\'z ichiga oladi…',
  ['Faqat neytronlar', 'Proton va elektron(lar)', 'Faqat elektronlar', 'Faqat molekulalar'],
  1,
  'Mendeleev jadvalini oching va H ni tanlang — atom modeli bilan solishtiring.',
)

export const learnG7C2S02 = slide(
  'learn.g7.c2.s02',
  'Atom tuzilishi',
  'Yadro (protonlar, neytronlar) va qobiqdagi elektronlar. Yadro zaryadi elementni belgilaydi.',
  'Atom massasi qayerda jamlangan?',
  ['Qobiqda', 'Yadroda', 'Atomlar orasida', 'Faqat elektronlarda'],
  1,
  'Kislorod modelini aylantiring — qobiq soniga e\'tibor bering.',
)

export const learnG7C2S03 = slide(
  'learn.g7.c2.s03',
  'Kimyoviy element va belgi',
  'Har bir elementning belgisi (H, O, Cl) va Mendeleev jadvalidagi tartib raqami bor.',
  'Xlor belgisi:',
  ['H', 'O', 'Cl', 'Na'],
  2,
  'Ilovada davriy jadvalda Cl ni toping.',
)

export const learnG7C2S04 = slide(
  'learn.g7.c2.s04',
  'Nisbiy atom massasi',
  'Ar — element atomlarining o\'rtacha massasi. Formula molyar massasini hisoblash uchun kerak.',
  'SI tizimida modda miqdori birligi:',
  ['Kilogramm', 'Mol', 'Litr', 'Amper'],
  1,
  'Ish maydonida «Molyar massa» masalasini yeching.',
)

export const learnG7C2S05 = slide(
  'learn.g7.c2.s05',
  'Izotoplar',
  'Izotoplar — bir element atomlari neytronlar soni bilan farq qiladi. Kimyoviy xossalari yaqin.',
  'Izotoplar … soni bilan farq qiladi',
  ['Protonlar', 'Neytronlar', 'Molekuladagi elektronlar', 'Molekulalar'],
  1,
  'Darslik bo\'yicha H va D (deyteriy) atom modellarini solishtiring va xulosa yozing.',
)

export const learnG7C2S06 = slide(
  'learn.g7.c2.s06',
  'Kimyoviy formula va valentlik',
  'Formula tarkibni ko\'rsatadi; valentlik — atomning bog\'lanish hosil qilish qobiliyati (H—I, O—II).',
  'Ko\'p birikmalarda kislorod valentligi:',
  ['I', 'II', 'III', 'VII'],
  1,
  'H₂O formulasi tuzing va katalogda 3D modelni tekshiring.',
)

export const learnG7C3S01 = slide(
  'learn.g7.c3.s01',
  'Havo tarkibi',
  'Havo — aralashma: ~78% N₂, ~21% O₂, Ar, CO₂. Kislorod yonishni qo\'llab-quvvatlaydi.',
  'Hajm bo\'yicha havoning asosiy komponenti:',
  ['Kislorod', 'Azot', 'Uglekislota', 'Vodorod'],
  1,
  '3D da O₂ (diatomic:8) ni oching va yonishdagi rolini muhokama qiling.',
)

export const learnG7C3S02 = slide(
  'learn.g7.c3.s02',
  'Yonish',
  'Yonish — issiqlik va yorug\'lik ajratadigan tez oksidlanish. Yonuvchi modda, oksidlovchi va tutash kerak.',
  'Yonish bu:',
  ['Issiqlik va yorug\'lik bilan oksidlanish', 'Faqat erish', 'Faqat bug\'lanish', 'Faqat eritish'],
  0,
  'Laboratoriyada yonish reaksiyasini yig\'ing (C + O₂).',
)

export const learnG7C3S03 = slide(
  'learn.g7.c3.s03',
  'Kislorod',
  'O₂ ni vodorod peroksidining parchalanishi yoki suvning elektrolizi bilan olishadi; yonishni qo\'llab-quvvatlaydi.',
  'Kislorod qaysi guruhga kiradi:',
  ['Nometallar', 'Metallar', 'Tuzlar', 'Kislotalar'],
  0,
  '3D: diatomic:8. Darslikda temir bilan reaksiyani tekshiring.',
)

export const learnG7C4S01 = slide(
  'learn.g7.c4.s01',
  'Vodorod',
  'H₂ — eng yengil gaz; tiklovchi; kislotalar + Zn, Al bilan olinadi.',
  'Vodorod odatdagi reaksiyalarda —',
  ['Tiklovchi', 'Oksidlovchi', 'Kislota', 'Tuz'],
  0,
  '3D da H₂ modeli (diatomic:1).',
)

export const learnG7C4S02 = slide(
  'learn.g7.c4.s02',
  'Suv',
  'H₂O — polar molekula; erituvchi; gidroliz va elektrolizda ishtirok etadi.',
  'Suv qaysi guruhga kiradi:',
  ['Oksidlar', 'Kislotalar', 'Tuzlar', 'Metallar'],
  0,
  'molecule:h2o ni oching va vodorod bog\'ini muhokama qiling.',
)

export const learnG7C5S01 = slide(
  'learn.g7.c5.s01',
  'Organizmdagi kimyo',
  'Oqsillar, yog\'lar, uglevodlar — hujayralardagi organik moddalar; suv — almashinuv muhiti.',
  'Glyukoza qaysi guruhga kiradi:',
  ['Uglevodlar', 'Metallar', 'Galogellar', 'Metall oksidlari'],
  0,
  'Katalogda CO₂ va organik molekulalar formulalarini solishtiring.',
)

export const learnG7PilotUz = {
  ...learnG7C1S01,
  ...learnG7C1S02,
  ...learnG7C1S03,
  ...learnG7C1S04,
  ...learnG7C1S05,
  ...learnG7C1S06,
  ...learnG7C1S07,
  ...learnG7C1S08,
  ...learnG7C1S09,
  ...learnG7C1S10,
  ...learnG7C2S01,
  ...learnG7C2S02,
  ...learnG7C2S03,
  ...learnG7C2S04,
  ...learnG7C2S05,
  ...learnG7C2S06,
  ...learnG7C3S01,
  ...learnG7C3S02,
  ...learnG7C3S03,
  ...learnG7C4S01,
  ...learnG7C4S02,
  ...learnG7C5S01,
}
