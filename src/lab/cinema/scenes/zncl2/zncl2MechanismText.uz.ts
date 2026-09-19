import type { Zncl2MechanismText } from './zncl2MechanismText'

/** Dars matni «Vodorod olish: Zn + 2 HCl → ZnCl₂ + H₂↑» — o‘zbekcha. */
export const ZNCL2_TEXT_UZ: Zncl2MechanismText = {
  intro: {
    title: 'Vodorod olish',
    speak: 'Rux xlorid kislotadan vodorodni qanday siqib chiqarishini ko‘ramiz — bu H₂ olishning asosiy maktab usuli.',
  },
  steps: {
    acid: {
      title: 'Rux xlorid kislotada',
      body:
        'Chap tomonda — rux metall plastinkasi: atomlar geksagonal zich joylashuvda (GZJ, P6₃/mmc) turadi, qatlamda oltita eng yaqin qo‘shni 266,5 pm masofada, qo‘shni qatlamlarda yana oltitasi ≈291 pm da. ' +
        'O‘ng tomonda — eritma. Xlorid kislota kuchli, suvda to‘liq dissotsilanadi, shuning uchun stakanda HCl molekulalari umuman yo‘q: faqat H⁺ va Cl⁻ ionlari bor. ' +
        'Yalang‘och proton suvda yashay olmaydi — u darrov suv molekulasiga birikib, gidroksoniy ioni H₃O⁺ holida bo‘ladi. Xlorid-ion yirik, 181 pm, va shunchaki yonidan suzib o‘tadi.',
      equation: 'HCl (eritma) → H⁺ + Cl⁻;  H⁺ + H₂O → H₃O⁺',
      note: 'Kadrda reaksiyaning aniq bitta ulushi bor: bitta rux atomi, ikkita proton va ikkita xlorid-ion — zaryad tenglashadi. Haqiqiy eritma tomchisida zarrachalar soni 10²¹ atrofida.',
      speak: 'Kislotada HCl molekulalari yo‘q: faqat gidroksoniy va xlorid ionlari. Rux proton bilan uchrashuvni kutmoqda.',
    },
    contact: {
      title: 'Proton elektronlarni oladi',
      body:
        'H₃O⁺ ioni metall sirtiga yaqin kelib, protonini unga beradi va o‘zi yana oddiy suv molekulasiga aylanadi. ' +
        'Metalldagi elektronlar umumiy — ular butun bo‘lakka tegishli, shuning uchun elektronlar oqimi plastinka bo‘ylab proton o‘tirgan joyga yo‘naladi. ' +
        'Har bir proton bittadan elektron olib, sirtda ushlanib turgan neytral vodorod atomiga aylanadi: 2 H⁺ + 2e⁻ → 2 H. Rux esa aniq ikkita elektron beradi.',
      equation: '2 H₃O⁺ + 2e⁻ → 2 H (sirtda) + 2 H₂O',
      note: 'H⁺ — bu yalang‘och yadro: uning radiusi atomnikidan taxminan yuz ming marta kichik, shuning uchun uni masshtabda chizib bo‘lmaydi va kichik yaltiroq nuqta sifatida ko‘rsatilgan. Elektronning yoy bo‘ylab «uchishi» ham shartli: metallning umumiy elektronlarida alohida trayektoriya yo‘q.',
      speak: 'Proton metallga o‘tiradi va elektron oladi. Elektronlar butun rux bo‘lagi bo‘ylab oqadi.',
    },
    hydrogen: {
      title: 'H₂ molekulasining tug‘ilishi',
      body:
        'Sirtdagi ikkita qo‘shni vodorod atomi bir-birini topib, elektronlarini umumiy juftga birlashtiradi — shunday qilib uzunligi 74,14 pm bo‘lgan qutbsiz kovalent bog‘ hosil bo‘ladi. ' +
        'Bu bog‘ni uzish uchun 436 kJ/mol kerak, shuning uchun H₂ molekulasi juda mustahkam va eritmada qolmaydi. ' +
        'Molekulalar pufakchaga yig‘iladi, pufakcha plastinkadan uzilib yuqoriga ko‘tariladi: Kipp apparatida aynan shu pufakchalar ko‘rinadi.',
      equation: '2 H → H₂ (gaz)↑,  d(H–H) = 74,14 pm,  E(H–H) = 436 kJ/mol',
      note: 'Pufakcha nuqtalar halqasi bilan chizilgan. Diametri bir millimetr bo‘lgan haqiqiy pufakchada taxminan 10¹⁷ ta vodorod molekulasi bor.',
      speak: 'Ikki vodorod atomi molekulaga birlashadi. Pufakcha uzilib yuqoriga ko‘tariladi.',
    },
    dissolve: {
      title: 'Rux eritmaga o‘tadi',
      body:
        'Ikkita elektronni berib bo‘lgach, rux atomini panjara ushlab tura olmaydi va u suvga Zn²⁺ ioni sifatida chiqadi. ' +
        'U ikkala tashqi 4s-elektronini yo‘qotadi va 134 pm dan 74 pm gacha — deyarli ikki barobar — kichrayadi: kation doimo o‘z atomidan kichik. ' +
        'Suvda yalang‘och ion bo‘lmaydi: oltita suv molekulasi unga qisman manfiy zaryadli kislorodi bilan buriladi va Zn–O masofasi 208 pm bo‘lgan oktaedrik akvakompleks [Zn(H₂O)₆]²⁺ hosil qiladi.',
      equation: 'Zn⁰ − 2e⁻ → Zn²⁺;  Zn²⁺ + 6 H₂O → [Zn(H₂O)₆]²⁺',
      note: 'Rux hali metall ichida ekan, «atom ionga aylandi» deyish erta: u yerda elektronlar umumiy. Zn²⁺ ioniga aynan panjarani tark etgan atom aylanadi. Ion bilan suv orasidagi chiziqlar ion-dipol tortishuvining belgisi, u yerda hech qanday «ip» yo‘q.',
      speak: 'Rux eritmaga ion bo‘lib chiqadi. U deyarli ikki barobar kichrayadi va oltita suv molekulasiga o‘raladi.',
    },
    spectators: {
      title: 'Tomoshabin ionlar va ZnCl₂ eritmasi',
      body:
        'Xlorid ionlari butun reaksiya davomida o‘zgarmadi: Cl⁻ edi, Cl⁻ bo‘lib qoldi. Bunday zarrachalar tomoshabin ionlar deyiladi va qisqa ionli tenglamaga yozilmaydi. ' +
        'Endi stakanda rux xlorid eritmasi bor: Zn²⁺ va Cl⁻ ionlari suv bilan ajratilgan va bir-biri bilan bog‘lanmagan. ' +
        'Eritma bug‘latilsa, oq ZnCl₂ tuzi qoladi: tetragonal kristall, fazoviy guruh I-42d, a = 539,8 pm, c = 1033 pm, unda ruxni endi oltita suv emas, to‘rtta xlorid o‘raydi (Zn–Cl 229 pm).',
      equation: 'Zn + 2 H⁺ → Zn²⁺ + H₂↑  (Cl⁻ — tomoshabin)',
      note: 'Konsentrlangan xlorid kislotada manzara murakkabroq: xlorid ionlari suvni siqib chiqaradi va [ZnCl₄]²⁻ kabi xlorokomplekslar hosil bo‘ladi. Sahnada suyultirilgan eritma ko‘rsatilgan, unda rux akvakompleks bo‘lib qoladi.',
      speak: 'Xlorid ionlari o‘zgarmadi — ular tomoshabin. Stakanda rux xlorid eritmasi.',
    },
    energy: {
      title: 'Energiya va xavfsizlik',
      body:
        'Reaksiya ekzotermik: ΔH = −153,9 kJ har mol rux uchun, probirka sezilarli isiydi. Gess qonuni bo‘yicha bosqichlarga ajratamiz: ruxni bug‘latish kerak (+130,4), ikkita elektronni uzib olish (+906,4 va +1733,3), protonlarni suvdan tortib olish (+2182) — foyda esa protonlarning elektron olishi (−2624), H₂ molekulasining hosil bo‘lishi (−436) va rux ionining gidratlanishi (−2046) hisobiga. ' +
        'Reaksiya nega umuman boradi degan savolga eng qisqa javobni kuchlanishlar qatori beradi: E°(Zn²⁺/Zn) = −0,76 V, E°(2H⁺/H₂) = 0,00 V, demak EYuK = +0,76 V > 0. ' +
        'Misda E° = +0,34 V, EYuK esa −0,34 V chiqadi — shuning uchun mis xlorid kislotada erimaydi va undan vodorodni siqib chiqarmaydi.',
      equation: 'Zn (qat.) + 2 HCl (eritma) → ZnCl₂ (eritma) + H₂ (gaz)↑,  ΔH = −153,9 kJ/mol',
      note: 'Zinapoyaning alohida bosqichlari protonning gidratlanish entalpiyasi −1091 kJ/mol deb olingan shkalaga bog‘langan: zaryadi tenglashgan tenglamada bu tanlov qisqaradi, lekin bitta bosqichni boshqa ma’lumotnomadagi son bilan solishtirib bo‘lmaydi.',
      speak: 'Reaksiya issiqlik chiqarib boradi: minus bir yuz ellik to‘rt kilojoul. Rux vodoroddan faolroq, mis esa yo‘q.',
    },
  },
  legend: {
    electron: 'Izli ko‘k nuqta — metall bo‘ylab protonga ketayotgan elektron.',
    orbitalPhase: 'Plastinka ichidagi yaltirash — metallning erkin elektronlarining shartli belgisi, trayektoriyasi emas.',
    water: 'Ikkita oq shar bilan qizil shar — suv molekulasi: O–H 95,8 pm, H–O–H burchagi 104,45°.',
  },
  safety:
    'Vodorod havo bilan portlovchi aralashma beradi va bitta uchqun yetarli, shuning uchun u suvni siqib chiqarish usulida yig‘iladi va yoqishdan oldin albatta tozalikka tekshiriladi. Xlorid kislota teri va ko‘zni kuydiradi: faqat ko‘zoynak va qo‘lqopda ishlang, kislotani suvga quying, aksincha emas.',
  energy: {
    title: 'Reaksiya energiyasi (Gess sikli)',
    unit: 'kJ/mol',
    caption: 'Xarajatlar (yuqoriga) va foyda (pastga) 1 mol rux uchun; bosqichlar yig‘indisi — reaksiyaning issiqlik effekti.',
    stages: {
      sublimation: 'Zn (qat.) → Zn (gaz)',
      ionization1: 'Zn → Zn⁺ + e⁻',
      ionization2: 'Zn⁺ → Zn²⁺ + e⁻',
      dehydration: '2 H⁺ (eritma) → 2 H⁺ (gaz)',
      neutralization: '2 H⁺ + 2e⁻ → 2 H',
      recombination: '2 H → H₂ (gaz)',
      hydration: 'Zn²⁺ (gaz) → Zn²⁺ (eritma)',
      total: 'Natija: reaksiyaning ΔH',
    },
    summary: 'Zn + 2H⁺ → Zn²⁺ + H₂ uchun Gess sikli: bosqichlar yig‘indisi {dH} kJ/mol',
    sources: 'Ma’lumotnoma qiymatlari: CRC Handbook, NIST-JANAF; gidratlanish entalpiyalari ΔH(H⁺) = −1091 kJ/mol shkalasida (Smith, 1977).',
  },
}
