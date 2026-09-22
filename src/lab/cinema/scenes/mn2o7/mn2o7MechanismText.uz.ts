import type { Mn2o7MechanismText } from './mn2o7MechanismText'

export const MN2O7_TEXT_UZ: Mn2o7MechanismText = {
  intro: {
    title: 'Marganesning yuqori oksidi',
    speak: 'Kaliy permanganat va sulfat kislotadan marganes yetti oksidi qanday hosil bo‘lishini va u bilan ishlash nega xavfli ekanini ko‘ramiz.',
  },
  steps: {
    reactants: {
      title: 'Boshlang‘ich moddalar',
      body:
        'Chapda — kaliy permanganat KMnO₄ ning ikki formula birligi: K⁺ ionlari va MnO₄⁻ tetraedrlari. Permanganat ionida marganes eng yuqori oksidlanish darajasida, +7: barcha yetti valent elektron kislorod tomon siljigan (3d⁰), to‘rtta Mn–O bog‘i teng, uzunligi 162,9 pm, O–Mn–O burchagi 109,5°. ' +
        'O‘ngda — suvsiz sulfat kislota H₂SO₄ molekulasi: ikkita S=O bog‘i 142,2 pm dan va ikkita S–OH bog‘i 157,4 pm dan. ' +
        '25 °C da KMnO₄ — to‘q binafsha kristallar, H₂SO₄ — moysimon suyuqlik.',
      equation: '2 KMnO₄ (qat.) + H₂SO₄ (kons.)',
      note:
        'KMnO₄ kristali ko‘rsatilmagan: kadrda ikki formula birligi — har bir K⁺ o‘z MnO₄⁻ i yonida (masofa K⁺ va O²⁻ ning Shennon radiuslari yig‘indisi bo‘yicha sxema). K⁺ radiusi Shennon bo‘yicha 138 pm (KS 6; kristalda kaliyning qo‘shnilari ko‘proq), Mn, O, S, H atomlari esa Kordero kovalent radiuslari bilan chizilgan — ion shari bilan kovalent zarralar sharlarini to‘g‘ridan-to‘g‘ri solishtirib bo‘lmaydi. ' +
        'MnO₄⁻ dagi Mn–O bog‘larining o‘rtacha tartibi 1,75: bitta σ va π ning bir ulushi, shuning uchun ulardagi π-bo‘laklar qo‘sh bog‘nikidan xiraroq. K⁺ va MnO₄⁻ orasidagi nuqtali yoylar — elektrostatik tortishish sxemasi. Kislotaning O=S=O va HO–S–OH tekisliklari perpendikulyar chizilgan — soddalashtirish.',
      speak: 'Chapda kaliy permanganat: kaliy ionlari va permanganat tetraedrlari, marganes oksidlanish darajasi plyus yetti. O‘ngda sulfat kislota.',
    },
    protonation: {
      title: 'Permanganat ionining protonlanishi',
      body:
        'Konsentrlangan sulfat kislota — protonlar manbai. Uning OH guruhi MnO₄⁻ ning kislorod atomiga vodorod bog‘i masofasigacha yaqinlashadi va proton shu bog‘ bo‘ylab o‘tadi: MnO₄⁻ permanganat kislota HMnO₄ ga, H₂SO₄ esa HSO₄⁻ ioniga aylanadi. ' +
        'Ikkinchi proton ikkinchi MnO₄⁻ ga o‘tadi va sulfat ioni SO₄²⁻ qoladi — S–O bog‘lari 147 pm dan teng bo‘lgan muntazam tetraedr. ' +
        'Ikkita K⁺ ioni sulfatga o‘tadi — darslik tenglamasidagi K₂SO₄ shundan paydo bo‘ladi.',
      equation: '2 MnO₄⁻ + H₂SO₄ → 2 HMnO₄ + SO₄²⁻;  2 K⁺ + SO₄²⁻ → K₂SO₄',
      note:
        'Erkin H⁺ na kadrda, na eritmada bo‘ladi: proton doim ikki kislorod atomidan biriga bog‘langan va vodorod bog‘i (punktir) bo‘ylab sakraydi; H⁺ yozuvi faqat o‘tish lahzasini belgilaydi. Zarralarning zaryadlari o‘sha kadrning o‘zida o‘zgaradi, zaryadlar yig‘indisi nolligicha qoladi. ' +
        'HMnO₄ dagi Mn–O–H burchagi yadroda yo‘q — kislorodli kislota burchagi ∠S–O–H 108,5° olingan, Mn–OH bog‘i esa permanganat uzunligida chizilgan: bu sxema. Oraliq HSO₄⁻ qayta tuzilmasdan ko‘rsatilgan. Sulfatda S–O bog‘ining o‘rtacha tartibi — 1,5. ' +
        'Aslida konsentrlangan sulfat kislotada ikkinchi proton kislotada qoladi va K₂SO₄ emas, gidrosulfat KHSO₄ hosil bo‘ladi; darslik tenglamasi K₂SO₄ bilan yozilgan.',
      speak: 'Sulfat kislota protonlarini beradi va permanganat ioni permanganat kislotaga aylanadi.',
    },
    condensation: {
      title: 'Suvning ajralishi',
      body:
        'Ikki HMnO₄ molekulasi OH guruhlari bilan yaqinlashadi. Bir OH guruhining protoni ikkinchisining kislorodiga o‘tadi va bu guruh suv molekulasi bo‘lib ketadi. ' +
        'Protonini bergan kislorod o‘z marganesida qoladi va ikkinchi marganes atomiga birikadi — ikki tetraedr umumiy uch orqali tutashadi. ' +
        'Shuning uchun Mn₂O₇ permanganat kislotaning angidridi deyiladi: bu suvsiz HMnO₄.',
      equation: '2 HMnO₄ → Mn₂O₇ + H₂O',
      note:
        'Kondensatsiya bitta akt sifatida ko‘rsatilgan. Sulfat kislotada u OH guruhining protonlanishi va suvning ajralishi orqali boradi, konsentrlangan kislota esa bu suvni bog‘laydi. Ketayotgan suv o‘z geometriyasini oladi: O–H 95,8 pm, H–O–H burchagi 104,5°. ' +
        'Marganesning oksidlanish darajasi o‘zgarmaydi — HMnO₄ da ham, Mn₂O₇ da ham +7: Mn₂O₇ ning hosil bo‘lishi oksidlanish-qaytarilish reaksiyasi emas.',
      speak: 'Ikki permanganat kislota molekulasi suv ajratadi va umumiy kislorod atomi orqali tutashadi.',
    },
    molecule: {
      title: 'Mn₂O₇ molekulasi',
      body:
        'O₃Mn–O–MnO₃ — umumiy uchga ega ikkita MnO₄ tetraedri. Oltita chetki Mn=O bog‘i qisqa — 158,5 pm, ikkita ko‘prik Mn–O bog‘i uzunroq — 177 pm, Mn–O–Mn burchagi 120,7°. ' +
        'Chetki bog‘ MnO₄⁻ dagidan (162,9 pm) qisqaroq: unga π-bog‘lanish ko‘proq to‘g‘ri keladi, ko‘prik kislorod esa elektronlarini ikki marganes atomi o‘rtasida bo‘ladi. ' +
        'Bu yerda marganes eng yuqori valentlik VII ni namoyon qiladi — darslikning ikki sinf mavzusi: 7-sinf — valentlik, 9-sinf — marganes va uning birikmalari.',
      equation: 'Mn₂O₇:  Mn +7,  O −2',
      note:
        'Uzunliklar va burchak past haroratdagi kristalning rentgenostruktur tahlilidan olingan (Simon va boshq.). Mn₂O₇ uchun O–Mn–O burchagi yadroda yo‘q — chetki atomlar tetraedrik burchak 109,5° ostida turadi; ikki O uchligining bir-biriga nisbatan burilishi — sxema. ' +
        'π-bo‘laklar — Mn=O π-bog‘lanishining shartli tasviri: marganesda unda d-orbitallar ishtirok etadi.',
      speak: 'Mana marganes yetti oksidi molekulasi: umumiy kislorod atomiga ega ikki tetraedr.',
    },
    liquid: {
      title: 'Dixroizmli suyuqlik',
      body:
        '25 °C da Mn₂O₇ — og‘ir moysimon suyuqlik. Uning rangi yorug‘likka bog‘liq: o‘tuvchi yorug‘likda to‘q qizil-qo‘ng‘ir, qaytgan yorug‘likda esa metall yaltiroqli yashil — bu dixroizm. ' +
        'Rangni zaryad ko‘chishi beradi: yorug‘lik elektronni kisloroddan marganes(VII) ning bo‘sh 3d-orbitallariga o‘tkazadi. ' +
        'Suyuq Mn₂O₇ ning hosil bo‘lish issiqligi taxminan −743 kJ/mol, lekin bu baho.',
      equation: '2 Mn (qat.) + 7/2 O₂ (gaz) → Mn₂O₇ (suyuq.),  ΔH°f ≈ −743 kJ/mol',
      note:
        'Tomchi — makroskopik modda, molekula yonida masshtabsiz chizilgan; uning ranglari dixroizmni shartli ko‘rsatadi, suyuqlikning o‘z nurlanishi yo‘q. ' +
        'ΔH°f(Mn₂O₇) CRC va NIST-JANAF ma’lumotnomalarida yo‘q: son ikkilamchi manbadan (Lidin) olingan va yadroda baho deb belgilangan, shuning uchun narvonning birlamchi jadvallar bilan mosligi da’vo qilinmaydi.',
      speak: 'Marganes yetti oksidi — moysimon suyuqlik: o‘tuvchi yorug‘likda qizil-qo‘ng‘ir, qaytgan yorug‘likda yashil.',
    },
    energy: {
      title: 'Energiya va xavf',
      body:
        'Gess qonuni bo‘yicha: (+1674,4) + (+814,0) + (−1437,8) + (−285,8) + (−743) = +21,8 kJ darslik tenglamasiga. Birinchi ikki pog‘ona — 2 KMnO₄ (2 × 837,2) va H₂SO₄ ning oddiy moddalarga parchalanishi, keyingi uchtasi — K₂SO₄, suv va Mn₂O₇ ning hosil bo‘lishi. ' +
        'Natija nolga yaqin va taxminiy: Mn₂O₇ ulushi ikkilamchi manbadan olingan. ' +
        'Lekin Mn₂O₇ ning o‘zining parchalanishi kuchli ekzotermik: 2 Mn₂O₇ → 4 MnO₂ + 3 O₂, ΔH ≈ −594 kJ. Suyuqlik 25 °C dayoq sekin parchalanadi, qizdirilganda esa portlab.',
      equation: '2 Mn₂O₇ (suyuq.) → 4 MnO₂ (qat.) + 3 O₂ (gaz),  ΔH ≈ −594 kJ',
      note:
        'Reaksiya konsentrlangan kislotada qanday borsa, shunday yozilsa — 2 KMnO₄ + 2 H₂SO₄ → Mn₂O₇ + 2 KHSO₄ + H₂O, — ΔH ≈ −47,6 kJ chiqadi; bu sonlarning barchasi ΔH°f(Mn₂O₇) tufayli taxminiy. ' +
        'Parchalanishda marganes +7 dan +4 gacha qaytariladi, kislorod esa −2 dan 0 gacha oksidlanadi — bu endi oksidlanish-qaytarilish reaksiyasi, ajralgan O₂ esa yonishni quvvatlaydi. Portlash va chaqnash 3D da chizilmaydi.',
      speak: 'Marganes yetti oksidi kislorod ajratib parchalanadi, qizdirilganda — portlab. Bu tajriba faqat virtual bajariladi.',
    },
  },
  legend: {
    electron: 'O‘tish lahzasida H⁺ yozuvli oq shar — proton: u vodorod bog‘i (punktir) bo‘ylab sakraydi va hech qachon erkin bo‘lmaydi.',
    orbitalPhase: 'Bog‘ ustida va ostidagi bo‘laklar — π-bog‘lanish: Mn=O da yorqin, MnO₄⁻ da (bog‘ tartibi 1,75) va sulfatda (1,5) xiraroq.',
  },
  safety:
    'Mn₂O₇ portlovchi: qizdirilganda va zarbdan portlab parchalanadi, spirt va boshqa organik moddalarni tegishi bilan alangalantiradi. Kaliy permanganatning konsentrlangan sulfat kislota bilan aralashmasi maktabda TAYYORLANMAYDI — tajriba faqat virtual yoki videoyozuvda ko‘rsatiladi.',
  energy: {
    title: 'Gess qonuni',
    unit: 'kJ',
    caption: 'Reagentlar oddiy moddalarga parchalanadi (yuqoriga), mahsulotlar ulardan yig‘iladi (pastga); yig‘indi — darslik tenglamasining issiqlik effekti. Baho: ΔH°f(Mn₂O₇) ikkilamchi manbadan.',
    stages: {
      kmno4: '2 KMnO₄ → 2 K + 2 Mn + 4 O₂',
      h2so4: 'H₂SO₄ → H₂ + S + 2 O₂',
      k2so4: '2 K + S + 2 O₂ → K₂SO₄',
      h2o: 'H₂ + ½ O₂ → H₂O (suyuq.)',
      mn2o7: '2 Mn + 7/2 O₂ → Mn₂O₇ (suyuq.), baho',
      total: 'Natija: reaksiya ΔH (baho)',
    },
    summary: 'Mn₂O₇ olish uchun Gess narvoni: yig‘indi {dH} kJ',
    sources: 'ΔH°f: CRC Handbook (KMnO₄, H₂SO₄, K₂SO₄, H₂O); Mn₂O₇ — Lidin R. A. va boshq., «Noorganik moddalar konstantalari» (baho).',
  },
}
