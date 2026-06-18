import { learnHubI18nUz } from './learnHubI18nUz'
import { learnLessonExtraUz } from './learnLessonExtraUz'
import { learnPathwayUz } from './learnPathwayUz'
import { learnPackRu } from './learnPackRu'

/** O'zbek (lotin) — learnPackRu bilan bir xil kalitlar. */
export const learnPackUz = {
  'learn.lead':
    'Yigirma asosiy norganika mavzusi: matnli darslar, 3D «totem» model va katalog yoki laboratoriyada sinash uchun maslahatlar. Progress brauzerda saqlanadi.',
  'learn.hubSlidesAria': 'Mavzu qo\'shimcha materiallari',
  'learn.hubSlideSelectHint':
    'Quyidagi ro\'yxatdan slayd tanlang — ro\'yxat ustida tanlangan slayd moddasining 3D modeli ko\'rsatiladi.',
  'learn.hubSlide3dAria': 'Tanlangan slayd uchun 3D model',

  'learn.tasksMode': 'Masalalar rejimi',
  'learn.tasksModeAria': 'Norganik kimyo masala turlari ko\'rinishini ochish',
  'learn.tasksTitle': 'Masala turlari',
  'learn.tasksLead':
    'SI o\'qituvchi bosqichma-bosqich yordami bilan masala rejimi. Sinfni import qiling, o\'quvchini tanlang — natijalar o\'sish grafigi bilan saqlanadi.',
  'learn.tasksBack': 'Mavzular ro\'yxatiga',
  'learn.tasksGroupQuant': 'Hisob-kitob masalalari',
  'learn.tasksGroupQual': 'Sifatli masalalar',
  'learn.tasksWhatLabel': 'Nima qilish',
  'learn.tasksExampleLabel': 'Misol',

  'learn.tasks.solutions.title': 'Eritmalar: aralashtirish va suyultirish',
  'learn.tasks.solutions.what':
    'Eritilgan modda massa ulushini ω = m(modda) / m(eritma) hisoblang. Odatiy holatlar: suv qo\'shish, suv bug\'latish, tuz qo\'shish, ikki eritmani aralashtirish.',
  'learn.tasks.solutions.example':
    '200 g 10% tuz eritmasiga 50 g suv qo\'shildi. Tuzning yangi massa ulushini toping.',

  'learn.tasks.stoichiometry.title': 'Reaksiya tenglamasi bo\'yicha (stexiometriya)',
  'learn.tasks.stoichiometry.what':
    'Muvozanatlangan tenglama va berilgan ma\'lumotlar bo\'yicha massa, gaz hajmi (masalan n.u. da V = n·22,4 l/mol) yoki modda miqdori n = m/M toping.',
  'learn.tasks.stoichiometry.example':
    '10 g kalsiy karbonati ortiqcha xlorid kislotada eriganda n.u. da qancha CO₂ hajmi ajraladi?',

  'learn.tasks.limiting_reagent.title': 'Ortiqcha va cheklangan reagent',
  'learn.tasks.limiting_reagent.what':
    'Ikki reagent massasi (yoki miqdori) berilgan. n orqali cheklaydigan reagentni aniqlang va mahsulotni faqat shu bo\'yicha hisoblang.',
  'learn.tasks.limiting_reagent.example':
    '5,6 g temir va 6,4 g oltingugurt aralashtirildi. Temir(II) sulfid massasini toping.',

  'learn.tasks.yield_impurities.title': 'Aralashmalar va amaliy chiqish',
  'learn.tasks.yield_impurities.what':
    'Xom ashyodagi aralashma massa ulushi va/yoki mahsulotning nazariy miqdorga nisbatan amaliy chiqishi η ni hisobga oling.',
  'learn.tasks.yield_impurities.example':
    '10% aralashma bo\'lgan 100 kg ohaktoshdan o\'chirilmagan ohak olindi. Uning massasi qancha (masala shartidagi kalsinatsiya ssenariysi bo\'yicha)?',

  'learn.tasks.metal_plate.title': 'Tuz eritmasidagi metall plastinka',
  'learn.tasks.metal_plate.what':
    'Metall plastinka kamroq faol metall tuz eritmasiga tushiriladi: almashtirish, plastinka massasi o\'zgaradi; ajralgan metall massasi yoki massa o\'zgarishini toping.',
  'learn.tasks.metal_plate.example':
    '20 g temir plastinka mis(II) sulfat eritmasiga tushirildi. Keyin plastinka massasi 22 g bo\'ldi. Qancha mis ajraldi?',

  'learn.tasks.electron_balance.title': 'Elektron balansi (OKR)',
  'learn.tasks.electron_balance.what':
    'Oksidlanish darajalarini belgilang, elektron o\'tishlarini yozing, reaksiyani muvozanatlang, oksidlovchi va qayta tiklovchini ko\'rsating.',
  'learn.tasks.electron_balance.example':
    'Muvozanatlang: P + HNO₃ + H₂O → H₃PO₄ + NO.',

  'learn.tasks.ionic_equations.title': 'Iyon tenglamalari (RIO)',
  'learn.tasks.ionic_equations.what':
    'Reaksiyani ionlarda yozing: kuchli elektrolitlar — ionlar, zaif moddalar, cho\'kma va gazlar — molekulyar ko\'rinishda; bir xil ionlarni qisqartiring.',
  'learn.tasks.ionic_equations.example':
    'Natriy sulfat va bariy xlorid reaksiyasi uchun molekulyar, to\'liq va qisqartirilgan iyon tenglamalarini yozing.',

  'learn.tasks.transformation_chains.title': 'O\'zgarish zanjirlari',
  'learn.tasks.transformation_chains.what':
    'A → B → C → … sxemasi bo\'yicha har bosqich reaksiyasini yozing; ko\'pincha so\'zli belgilar beriladi (cho\'kma, gaz, rang).',
  'learn.tasks.transformation_chains.example':
    'Vodorod peroksididan gaz X olinadi. U temir bilan reaksiyada qatiq Y hosil qiladi. Tenglamalarni yozing.',

  'learn.tasks.qualitative_id.title': 'Moddalarni aniqlash',
  'learn.tasks.qualitative_id.what':
    'Sifatli reaksiyalar bo\'yicha moddani aniqlang: ionlar bo\'yicha reagent tanlang (cho\'kma, gaz, erish va h.k.).',
  'learn.tasks.qualitative_id.example':
    'Sulfat-ion qo\'shilganda oq cho\'kma tushsa, qaysi probirkada Ba²⁺ bor? (Tajriba mantiqini tuzing.)',

  'learn.tasks.practice': 'Yechish',
  'learn.tasks.practiceAria': 'Bu toifa bo\'yicha interaktiv masalalarni ochish',

  'learn.task.teacherHint': 'O\'qituvchi yordami',
  'learn.task.teacherHintAgain': 'Keyingi qadam',
  'learn.task.teacherHintMore': 'Yana maslahat',
  'learn.task.teacherHintLead': 'O\'qituvchi bosqichma-bosqich yo\'l ko\'rsatadi — javob emas, yechish yo\'nalishi.',
  'learn.task.teacherHintStep': '{step} qadam',
  'learn.task.teacherHintFoot': 'Maslahatni qo\'llab ko\'ring. Yana kerak bo\'lsa — «Yana maslahat».',
  'learn.task.teacherHintLast': 'Javobdan oldingi oxirgi qadam. O\'zingiz yechib ko\'ring.',

  'learn.task.aiCoach.title': 'SI o\'qituvchi: keyingi qadam',
  'learn.task.aiCoach.lead':
    'O\'qituvchi tayyor javob bermaydi — reja, savol va mantiq tekshiruvi bilan mustaqil fikrlashni rivojlantiradi.',
  'learn.task.aiCoach.scratchLabel': 'Qoralama (Berilgan, Topish, yechish yo\'li)',
  'learn.task.aiCoach.scratchPh': 'Ma\'lumot va mulohazalarni yozing — o\'qituvchi mantiqni tekshiradi, javobni aytmaydi…',
  'learn.task.aiCoach.next': 'Keyingi qadam qanday?',
  'learn.task.aiCoach.nextAgain': 'Yana bir qadam',
  'learn.task.aiCoach.check': 'Mantiqimni tekshirish',
  'learn.task.aiCoach.bubbleLabel': 'O\'qituvchi maslahati',
  'learn.task.aiCoach.foot': 'Bu qadamni o\'zingiz bajaring, keyin yana o\'qituvchidan so\'rang.',
  'learn.task.aiCoach.error': 'Maslahat olinmadi. Yana urinib ko\'ring.',
  'learn.task.aiCoach.promptNext': 'Yechishga bir keyingi qadamni maslahat qiling — javobsiz va tayyor hisobsiz.',
  'learn.task.aiCoach.promptCheck': 'Qoralamadagi mulohazalarimni tekshiring — nima to\'g\'ri, nima aniqlashtirish kerak? Javob bermang.',
  'learn.task.aiCoach.promptCheckEmpty': 'Bu masalani qanday boshlash kerak? Faqat birinchi qadam, javobsiz.',
  'learn.tasks.aiCoachBanner':
    'Yangi: SI o\'qituvchi bosqichma-bosqich yo\'l ko\'rsatadi — reja beradi va mulohazani tekshiradi, tayyor javob bermaydi.',
  'learn.task.activeStudent': 'Yechmoqda: {name}',
  'learn.tasksClass.title': 'Sinf (masala rejimi)',
  'learn.tasksClass.lead': 'O\'quvchilar ro\'yxatini joylashtiring — faolini tanlang. Masala natijalari muvaffaqiyat grafigiga tushadi.',
  'learn.tasksClass.active': 'faol',
  'learn.tasksClass.empty': 'Masala natijalarini saqlash uchun o\'quvchi ismlarini import qiling.',

  'learn.task.syntaxHint': 'Kasr qismi nuqta yoki vergul bilan.',
  'learn.task.answerPlaceholder': 'Sizning javobingiz',
  'learn.task.check': 'Tekshirish',
  'learn.task.newTask': 'Yangi masala',
  'learn.task.correct': 'To\'g\'ri.',
  'learn.task.wrong': 'Noto\'g\'ri.',
  'learn.task.expected': 'Etalon: {value}',
  'learn.task.heroFallback': '3D model mavjud emas (WebGL o\'chirilgan yoki qo\'llab-quvvatlanmaydi).',
  'learn.task.mcqHint': 'Bitta variantni tanlang.',

  'learn.task.sol.question':
    '{mSol} g {wPct}% tuz eritmasiga {mWater} g suv qo\'shildi. Olingan eritmadagi tuz massa ulushini (%) toping.',
  'learn.task.sol.answerLabel': 'Javob (massa ulushi, %)',

  'learn.task.stoich.question':
    'Toza CaCO₃ deb olingan {m} g modda ortiqcha HCl bilan to\'liq reaksiyaga kirib CO₂ ajratadi. n.u. da CO₂ hajmi (22,4 l/mol), l:',
  'learn.task.stoich.answerLabel': 'Javob (hajm, l)',

  'learn.task.limit.question':
    '{mFe} g temir va {mS} g oltingugurt aralashtirildi; Fe + S → FeS reaksiyasi oxirigacha boradi. Molyar massalar: Fe 56, S 32, FeS 88 g/mol. FeS massasi, g:',
  'learn.task.limit.answerLabel': 'Javob (FeS massasi, g)',

  'learn.task.yield.question':
    '{impPct}% aralashmali (aralashmada CaCO₃ yo\'q) {mRock} g ohaktosh bor. CaCO₃ to\'liq parchalanganda CaCO₃ → CaO + CO₂. O\'chirilmagan ohak CaO massasini toping. M(CaCO₃)=100, M(CaO)=56 g/mol.',
  'learn.task.yield.answerLabel': 'Javob (CaO massasi, g)',

  'learn.task.plate.question':
    'Temir plastinka mis(II) tuzi eritmasiga tushirildi. Fe + Cu²⁺ → Fe²⁺ + Cu almashinuvi tufayli plastinka massasi {delta} g ga oshdi (64−56=8 g/mol reaksiya uchun). Ajralgan mis Cu massasi (M = 64 g/mol), g:',
  'learn.task.plate.answerLabel': 'Javob (Cu massasi, g)',

  'learn.task.mcq.redox.q0':
    'P + HNO₃ + H₂O → H₃PO₄ + NO (muvozanatlangan) reaksiyasida oksidlovchi',
  'learn.task.mcq.redox.q0o0': 'fosfor P',
  'learn.task.mcq.redox.q0o1': 'azot kislota HNO₃',
  'learn.task.mcq.redox.q0o2': 'suv H₂O',
  'learn.task.mcq.redox.q0o3': 'azot monooksidi NO',

  'learn.task.mcq.redox.q1': 'NO molekulasida azot oksidlanish darajasi',
  'learn.task.mcq.redox.q1o0': '0',
  'learn.task.mcq.redox.q1o1': '+1',
  'learn.task.mcq.redox.q1o2': '+2',
  'learn.task.mcq.redox.q1o3': '+4',

  'learn.task.mcq.ion.q0':
    'Qisqartirilgan tenglama Ba²⁺ + SO₄²⁻ → BaSO₄↓ quyidagi eritmalarni aralashtirishni tasvirlaydi',
  'learn.task.mcq.ion.q0o0': 'NaCl va KNO₃',
  'learn.task.mcq.ion.q0o1': 'BaCl₂ va Na₂SO₄',
  'learn.task.mcq.ion.q0o2': 'NaOH va HCl',
  'learn.task.mcq.ion.q0o3': 'K₂CO₃ va CaCl₂',

  'learn.task.mcq.ion.q1':
    'NaOH + HCl → NaCl + H₂O uchun qisqartirilgan iyon tenglamasi H⁺ + OH⁻ → H₂O; «spektator» ionlar',
  'learn.task.mcq.ion.q1o0': 'Na⁺ va Cl⁻',
  'learn.task.mcq.ion.q1o1': 'faqat H⁺',
  'learn.task.mcq.ion.q1o2': 'faqat OH⁻',
  'learn.task.mcq.ion.q1o3': 'Na⁺ va OH⁻',

  'learn.task.mcq.chain.q0': 'Suv elektrolizida katodda (qayta tiklanishda) asosan ajraladigan gaz',
  'learn.task.mcq.chain.q0o0': 'O₂',
  'learn.task.mcq.chain.q0o1': 'H₂',
  'learn.task.mcq.chain.q0o2': 'CO₂',
  'learn.task.mcq.chain.q0o3': 'Cl₂',

  'learn.task.mcq.qual.q0':
    'Eritmada Ba²⁺ ni sifatli aniqlash uchun eng qulay qo\'shiladi',
  'learn.task.mcq.qual.q0o0': 'Na⁺ ioni',
  'learn.task.mcq.qual.q0o1': 'Cl⁻ ioni',
  'learn.task.mcq.qual.q0o2': 'SO₄²⁻ ioni',
  'learn.task.mcq.qual.q0o3': 'K⁺ ioni',

  'learn.task.hint.generic.s1': 'Shartni o\'qing va «Berilgan» / «Topish» ni yozing.',
  'learn.task.hint.generic.s2': 'Velichalarni bog\'laydigan formulani yoki tenglamani yozing.',
  'learn.task.hint.generic.s3': 'Sonlarni qo\'ying va birliklarni tekshiring.',
  'learn.task.hint.mcq.s1': 'Bu mavzu bo\'yicha ta\'rif va qoidani eslang.',
  'learn.task.hint.mcq.s2': 'Shartga mutlaqo mos kelmaydigan variantlarni chiqarib tashlang.',
  'learn.task.hint.sol.s1': 'Birinchi eritmadagi eritilgan modda massasini toping.',
  'learn.task.hint.sol.s2': '{mSol} g eritmada {wPct}% massa ulushi — tuz massasini toping.',
  'learn.task.hint.sol.s3': '{mWater} g suv bilan aralashtiring — umumiy massa oshadi.',
  'learn.task.hint.sol.s4': 'Yangi massa ulushi = tuz massasi ÷ umumiy massa × 100%.',
  'learn.task.hint.stoich.s1': 'CO₂ massasi {m} g. Molyar massa 44 g/mol — n ni toping.',
  'learn.task.hint.stoich.s2': 'Muvozanatlangan tenglama bo\'yicha modda miqdorlarini bog\'lang.',
  'learn.task.hint.stoich.s3': 'n.u. da gaz hajmi: V = n × 22,4 l/mol.',
  'learn.task.hint.limit.s1': 'Berilgan: {mFe} g Fe va {mS} g S. Tenglama: Fe + S → FeS.',
  'learn.task.hint.limit.s2': 'n(Fe) va n(S) ni n = m / M bilan toping.',
  'learn.task.hint.limit.s3': 'n(Fe) va n(S) ni solishtiring — kim ortiqcha, kim mahsulotni cheklaydi?',
  'learn.task.hint.limit.s4': 'FeS massasi = n(kichikroq) × 88 g/mol.',
  'learn.task.hint.yield.s1': 'Ruda {mRock} g, aralashma {impPct}% — toza CaCO₃ massasini toping.',
  'learn.task.hint.yield.s2': 'Toza massa = m × (1 − aralashma/100).',
  'learn.task.hint.yield.s3': 'CaO massasi = m(CaCO₃) × 56/100.',
  'learn.task.hint.plate.s1': 'Temir elektron beradi: Fe⁰ → Fe²⁺. Δm = {delta} g.',
  'learn.task.hint.plate.s2': 'Har 2 mol e⁻ uchun 1 mol Cu ajraladi.',
  'learn.task.hint.plate.s3': 'Cu massasi ≈ (Δm / 56) × 64 g bu masala uchun.',
  'learn.task.hint.oge.s1': 'CaCO₃ massasi {m} g, Mr = 100 — n = m/100.',
  'learn.task.hint.oge.s2': 'CaCO₃ + 2HCl → … + CO₂ bo\'yicha: n(CO₂) = n(CaCO₃).',
  'learn.task.hint.oge.s3': 'V(CO₂) = n × 22,4 l n.u. da.',
  'learn.task.hint.redox.s1': 'Barcha atomlarning oksidlanish darajalarini belgilang.',
  'learn.task.hint.redox.s2': 'Oksidlovchi e⁻ oladi, qayta tiklovchi beradi.',
  'learn.task.hint.redox.s3': 'Kim elektron yo\'qotadi, kim oladi?',
  'learn.task.hint.ion.s1': 'Moddalarni ionlarga ajrating — eruvchan yoki cho\'kma?',
  'learn.task.hint.ion.s2': '«Spektator» ionlarni chiqarib tashlang.',
  'learn.task.hint.ion.s3': 'Qisqartirilgan iyon tenglamasi — faqat ishtirokchilar.',
  'learn.task.hint.chain.s1': 'Suv elektrolizida katodda qayta tiklanadi…',
  'learn.task.hint.chain.s2': 'Katod — manfiy elektrod, kationlar unga boradi.',
  'learn.task.hint.qual.s1': 'Ba²⁺ SO₄²⁻ bilan cho\'kma beradi.',
  'learn.task.hint.qual.s2': 'Oq BaSO₄ cho\'kmasi — bariy uchun xarakterli reaksiya.',
  'learn.task.hint.qual.s3': 'SO₄²⁻ ioni bo\'lgan reagentni tanlang.',

  'learn.T.periodicity.title': 'Davriylik',
  'learn.T.periodicity.summary': 'Mendeleev qonuni, davr va guruhdagi elementlarni solishtirish.',
  'learn.T.periodicity.experiment':
    'Ilovada davriy jadvalni oching va ikki qo\'shni elementni konfiguratsiya va oksidlanish darajalari bo\'yicha solishtiring.',

  'learn.T.bond_types.title': 'Kimyoviy bog\'lanish turlari',
  'learn.T.bond_types.summary': 'Oddiy formulalar misolida kovalent va iyonli bog\'lanish.',
  'learn.T.bond_types.experiment':
    'Katalogdan kovalent molekula va iyonli tuz toping; 3D modellarni solishtiring.',

  'learn.T.oxides_acidic.title': 'Kislotali oksidlar',
  'learn.T.oxides_acidic.summary': 'Kislotalar bilan bog\'liqlik; kursda CO₂, SO₂, SO₃ misollari.',
  'learn.T.oxides_acidic.experiment':
    'Katalogdagi «oksid» yozuvidan biri uchun oksidning suv yoki asos bilan reaksiyasini yozing.',

  'learn.T.oxides_basic.title': 'Asosiy oksidlar',
  'learn.T.oxides_basic.summary': 'Metall(I–II) oksidlari va suv bilan gidroksidlar.',
  'learn.T.oxides_basic.experiment':
    'Katalogda CaO va Na₂O ni solishtiring: tarkib, toifa, kartadagi o\'quv tenglamasi.',

  'learn.T.oxides_amphoteric.title': 'Amfoter oksidlar',
  'learn.T.oxides_amphoteric.summary': 'Al₂O₃, ZnO — kislota va ishqor bilan reaksiyalar (dastur bo\'yicha).',
  'learn.T.oxides_amphoteric.experiment':
    'Al₂O₃ kartasini oching va ikkita odatiy reaksiyani yozing: kislota va ishqor eritmasi bilan.',

  'learn.T.acids_strong.title': 'Kuchli kislotalar',
  'learn.T.acids_strong.summary': 'To\'liq dissotsiatsiya; HCl, H₂SO₄, HNO₃ misollari.',
  'learn.T.acids_strong.experiment':
    'Laboratoriyada kuchli kislota va metall bilan tenglama tuzing (faqat o\'qituvchi ruxsati bilan).',

  'learn.T.acids_weak.title': 'Zaif kislotalar va muvozanat',
  'learn.T.acids_weak.summary': 'To\'liq bo\'lmagan dissotsiatsiya; uglerod kislotasi va suvda CO₂.',
  'learn.T.acids_weak.experiment':
    'H₂CO₃ eritmasi gaz fazasidagi bitta molekuladan 3D da qanday farq qilishini so\'z bilan tushuntiring.',

  'learn.T.bases_alkali.title': 'Ishqorlar va gidroksidlar',
  'learn.T.bases_alkali.summary': 'NaOH, KOH — kuchli asoslar, umumiy reaksiya naqshlari.',
  'learn.T.bases_alkali.experiment':
    'Qog\'ozda NaOH + HCl neytrallashtirish iyon tenglamasini yozing.',

  'learn.T.salts_ionic.title': 'Iyonli tuzlar',
  'learn.T.salts_ionic.summary': 'Kristal, ionlar, dissotsiatsiya; etalon — NaCl.',
  'learn.T.salts_ionic.experiment':
    'Katalogdan boshqa binar tuz toping va dissotsiatsiya tenglamasini yozing.',

  'learn.T.salts_solubility.title': 'Eruvchanlik va almashinuv',
  'learn.T.salts_solubility.summary': 'Eruvchanlik jadvali, ion almashinuvi, gaz va cho\'kma.',
  'learn.T.salts_solubility.experiment':
    'Tuz va kislotadan CO₂ gaz ajraladigan reaksiyani o\'ylab toping; formulalarni katalogda tekshiring.',

  'learn.T.gases_nitrogen.title': 'Azot oksidlari',
  'learn.T.gases_nitrogen.summary': 'NO, NO₂, azot oksidlanish darajalari, ekologik kontekst.',
  'learn.T.gases_nitrogen.experiment':
    'NO va NO₂ kartalarini solishtiring: gaz rangi (matndan), oksid turi, odatiy reaksiyalar.',

  'learn.T.gases_sulfur.title': 'Oltingugurt oksidlari',
  'learn.T.gases_sulfur.summary': 'SO₂, SO₃ — kislotali oksidlar, oltingugurt kislotalari bilan bog\'liqlik.',
  'learn.T.gases_sulfur.experiment':
    'SO₂ → serist kislota → bitta tuz bosqichi zanjirini tenglama sifatida tuzing.',

  'learn.T.halogens_intro.title': 'Galogenlar (kirish)',
  'learn.T.halogens_intro.summary': 'HCl, odatiy oksidlovchilar, faollik qatori bilan bog\'liqlik.',
  'learn.T.halogens_intro.experiment':
    'Katalogda HCl va MnO₂ ni oching; aralashma qayerda xavfli bo\'lishi mumkinligini o\'qituvchi bilan muhokama qiling.',

  'learn.T.metals_activity.title': 'Metallar va metall oksidlari',
  'learn.T.metals_activity.summary': 'Faollik qatori (g\'oya), CuO mis(II) oksidi sifatida.',
  'learn.T.metals_activity.experiment':
    'Maktab kursidan qayta tiklovchi bilan mis(II) oksidini qayta tiklashning bir reaksiyasini yozing.',

  'learn.T.redox_intro.title': 'OKR asoslari',
  'learn.T.redox_intro.summary': 'Oksidlovchi, qayta tiklovchi, oksidlanish darajalari, muvozanat.',
  'learn.T.redox_intro.experiment':
    'Laboratoriyani oching va oddiy elektron o\'tishli tenglamani muvozanatlang.',

  'learn.T.electrolysis_intro.title': 'Elektroliz (g\'oyalar)',
  'learn.T.electrolysis_intro.summary': 'Eritma va eritmadagi ionlar, katod va anod sifatiy darajada.',
  'learn.T.electrolysis_intro.experiment':
    'NaCl uchun eritma va eritmada qaysi ionlar razryadlanishi mumkinligini ro\'yxatlang (sxema).',

  'learn.T.water_chemistry.title': 'Suv va eritmalar',
  'learn.T.water_chemistry.summary': 'H₂O dipoli, erituvchi, pH kislotalik bilan bog\'liq.',
  'learn.T.water_chemistry.experiment':
    'Tuz eriganda ion gidratatsiyasini suv 3D modeli bilan bog\'lang.',

  'learn.T.qual_analysis.title': 'Sifatli tahlil (yo\'naltirish)',
  'learn.T.qual_analysis.summary': 'Eritma rangi, oksidlovchilar — kaliy dixromati misoli.',
  'learn.T.qual_analysis.experiment':
    'K₂Cr₂O₇ kartasini o\'qing: oksidlovchi qayerda, sinfda qanday ehtiyot choralari.',

  'learn.T.industrial_touch.title': 'Kimyo va sanoat',
  'learn.T.industrial_touch.summary': 'Kontakt jarayoni, kukurt kislota, SO₃ zanjir bo\'g\'ini.',
  'learn.T.industrial_touch.experiment':
    'Darslikdan SO₂ → SO₃ → H₂SO₄ blok-sxemasini chizing (zavod raqamlarisiz).',

  'learn.T.safety_lab.title': 'Xavfsizlik va ATOMLAB laboratoriyasi',
  'learn.T.safety_lab.summary': 'Virtual muhit haqiqiy kabinet qoidalarini almashtirmaydi.',
  'learn.T.safety_lab.experiment':
    'Ilova laboratoriyasida bitta ssenariyni bajaring va haqiqiy tajribalar uchun o\'qituvchi ko\'rsatmasi bilan solishtiring.',

  'learn.L.l_periodicity.title': 'Davriylik va tendensiyalar',
  'learn.L.l_periodicity.s0':
    'Davr bo\'ylab yadro zaryadi oshganda valent elektronlar kuchliroq tortiladi: chapdan o\'ngga metallik xarakter zaiflashadi.',
  'learn.L.l_periodicity.s1':
    'Guruhdan pastga atom radiusi oshadi; jadval matnidan Na va K ni solishtiring.',
  'learn.L.l_periodicity.h_b':
    'Suv — qisqartirilgan fazalarda polyar kovalent bog\'lar va vodorod bog\'ining oddiy misoli.',
  'learn.L.l_periodicity.s3':
    'Element joyini katalog misollari orqali oksid turiga (kislotali / asosiy) bog\'lang.',

  'learn.L.l_bond_types.title': 'Bog\'lanish: kovalent va iyonli',
  'learn.L.l_bond_types.s0':
    'Kovalent bog\'lanish elektron juftliklarini ulashadi; iyonli — turli elektrsalbiylikdagi atomlar o\'rtasida elektron o\'tishi.',
  'learn.L.l_bond_types.s1':
    'Iyon xarakteri ΔEN bilan oshadi; 3D «shar—tayoq» qaysi atomlar qo\'shni ekanini ko\'rsatadi.',
  'learn.L.l_bond_types.h_b': 'Egilgan suv O—H polyar bog\'larini ko\'rsatadi.',
  'learn.L.l_bond_types.s3':
    'Katalogdan tuz tanlang va kristalda Na—Cl nima uchun iyonli deb olinishini tushuntiring.',

  'learn.L.l_oxides_acidic.title': 'Kislotali oksidlar',
  'learn.L.l_oxides_acidic.s0':
    'Kislotali oksid suv bilan (ko\'pincha muvozanatda) va asoslar bilan tuz va suv berish uchun reaksiyaga kiradi.',
  'learn.L.l_oxides_acidic.s1': 'CO₂ — uglerod(IV) ning klassik kislotali oksidi; tabiiy suv kislotaligi uchun muhim.',
  'learn.L.l_oxides_acidic.h_b': 'Chiziqli CO₂: gibridlanish va kislotali xarakter modeli.',
  'learn.L.l_oxides_acidic.s3':
    'CO₂ ni ortiqcha NaOH bilan oddiy tuzgacha yozing (koeffitsientlarni muvozanatlang).',

  'learn.L.l_oxides_basic.title': 'Asosiy oksidlar',
  'learn.L.l_oxides_basic.s0':
    'Faol metall(I–II) oksidlari asosiy: suv bilan → gidroksid, kislota bilan → tuz va suv.',
  'learn.L.l_oxides_basic.s1': 'CaO qurilish kimyosida va o\'quv o\'rnatmalarida quritgich sifatida uchraydi.',
  'learn.L.l_oxides_basic.h_b': 'Katalogdan soddalashtirilgan binar kalsiy oksidi modeli.',
  'learn.L.l_oxides_basic.s3': 'CaO + H₂O va Na₂O + H₂O mahsulotlarini gidroksid turi bo\'yicha solishtiring.',

  'learn.L.l_oxides_amphoteric.title': 'Amfoter oksid',
  'learn.L.l_oxides_amphoteric.s0':
    'Amfoter oksid kislota va ishqor bilan reaksiyaga kiradi — eritma va konsentratsiya muhim.',
  'learn.L.l_oxides_amphoteric.s1': 'Al₂O₃ — darslikdagi maktab misoli.',
  'learn.L.l_oxides_amphoteric.h_b': 'Katalog geometriyasida Al—O bog\'liqligini ko\'ring.',
  'learn.L.l_oxides_amphoteric.s3':
    'Ikki molekulyar tenglama yozing: Al₂O₃ + kislota va Al₂O₃ + ishqor (dastur bo\'yicha mahsulotlar).',

  'learn.L.l_acids_strong.title': 'Kuchli kislotalar',
  'learn.L.l_acids_strong.s0':
    'Suyultirilgan suvli eritmada kuchli kislota deyarli to\'liq dissotsiatsiya qiladi; 3D erituvchisiz molekulani ko\'rsatadi.',
  'learn.L.l_acids_strong.s1': 'H₂SO₄ quyuq holatda ham kislota, ham oksidlovchi — xavfsizlik qoidalariga amal qiling.',
  'learn.L.l_acids_strong.h_b': 'Katalogdan kukurt kislotasi tuzilishi fragmenti.',
  'learn.L.l_acids_strong.s3': 'Suyultirilgan eritmada H₂SO₄ + NaOH qisqartirilgan iyon tenglamasini yozing.',

  'learn.L.l_acids_weak.title': 'Zaif kislotalar',
  'learn.L.l_acids_weak.s0':
    'Uglerod kislotasi CO₂ va suv bilan muvozanatda — oksid bilan bog\'liq zaif kislota.',
  'learn.L.l_acids_weak.s1': 'Eritmada ionlar va molekulalar muhim; bitta H₂CO₃ gaz molekulasi butun eritmani tasvirlamaydi.',
  'learn.L.l_acids_weak.h_b': 'Uglerod kislotasining o\'quv modeli.',
  'learn.L.l_acids_weak.s3':
    'Nima uchun «suvda CO₂» muhitni kislotalashtiradi, garchi CO₂ o\'zi Bryonsted kislota bo\'lmasa — tushuntiring.',

  'learn.L.l_bases_alkali.title': 'Natriy gidroksidi va ishqor muhit',
  'learn.L.l_bases_alkali.s0':
    'NaOH suvda to\'liq dissotsiatsiya qiladi; qattiq holat gigroskopik — haqiqiy laboratoriya faqat ko\'rsatma bo\'yicha.',
  'learn.L.l_bases_alkali.s1': 'Ishqorlar kislotalar, kislotali oksidlar va ko\'p tuzlar bilan eruvchanlik qoidalariga ko\'ra reaksiyaga kiradi.',
  'learn.L.l_bases_alkali.h_b': 'NaOH modeli: Na—O—H.',
  'learn.L.l_bases_alkali.s3': 'Cho\'kma mahsulotli NaOH + CuSO₄ ni qisqartirilgan iyon ko\'rinishida yozing.',

  'learn.L.l_salts_ionic.title': 'NaCl tuz modeli sifatida',
  'learn.L.l_salts_ionic.s0':
    'NaCl kristalida ionlar navbatlashadi; 3D o\'quv modelida ion markazlari orasidagi masofani ko\'rsatadi.',
  'learn.L.l_salts_ionic.s1': 'Erish va erishda ionlar harakatlanadi; elektroliz alohida mavzu.',
  'learn.L.l_salts_ionic.h_b': 'Katalog modelida Na⁺ va Cl⁻ joylashuvini ko\'ring.',
  'learn.L.l_salts_ionic.s3': 'NaCl eritmasining elektrolizini umumiy sifatiy ko\'rinishda yozing.',

  'learn.L.l_salts_solubility.title': 'Tuzlar va eruvchanlik',
  'learn.L.l_salts_solubility.s0':
    'NaHCO₃ — uglerod kislotasining kislota tuzi; kislotalar va suv qattiqligi muhokamasida uchraydi.',
  'learn.L.l_salts_solubility.s1': 'Ion almashinuvi gaz, suv yoki cho\'kka talab qiladi — eruvchanlik jadvalini tekshiring.',
  'learn.L.l_salts_solubility.h_b': 'Pishirish sodasi ionlari uchun katalog modeli.',
  'learn.L.l_salts_solubility.s3': 'NaHCO₃ + HCl ni molekulyar va qisqartirilgan iyon ko\'rinishida yozing.',

  'learn.L.l_gases_nitrogen.title': 'Azot oksidlari',
  'learn.L.l_gases_nitrogen.s0':
    'NO havoda oson oksidlanadi; NO₂ suvli muhitda kislota xatti-harakati va NOₓ tsikllari.',
  'learn.L.l_gases_nitrogen.s1': 'Azot oksidlanish darajalari +1 dan +5 gacha ko\'p tenglamalar uchun tayanch.',
  'learn.L.l_gases_nitrogen.h_b': '3D da egilgan NO₂.',
  'learn.L.l_gases_nitrogen.s3': 'Darslik bo\'yicha NO₂ + H₂O ni yozing.',

  'learn.L.l_gases_sulfur.title': 'Oltingugurt dioksidi',
  'learn.L.l_gases_sulfur.s0': 'SO₂ suvda kislota xatti-harakati bilan eriydi; sanoat va serist kislota.',
  'learn.L.l_gases_sulfur.s1': 'SO₂ → SO₃ oksidlanishi kukurt kislotasi ishlab chiqarishning markaziy bosqichi.',
  'learn.L.l_gases_sulfur.h_b': 'SO₂ dagi S—O bog\'lari.',
  'learn.L.l_gases_sulfur.s3': 'SO₂ va CO₂ ni kislotali oksidlar sifatida odatiy reaksiyalar bo\'yicha solishtiring.',

  'learn.L.l_halogens_intro.title': 'Xlorid kislota va galogenlar',
  'learn.L.l_halogens_intro.s0':
    'HCl suvda kuchli elektrolit; gaz fazasida bitta polyar molekula.',
  'learn.L.l_halogens_intro.s1': 'Galogenlar oksidlovchi sifatida reaksiya zanjirlarini kuzatadi; avvalo xavfsizlik.',
  'learn.L.l_halogens_intro.h_b': 'HCl modeli.',
  'learn.L.l_halogens_intro.s3': 'HCl + NH₃ ni gaz fazasi va eritmada yozing (ikki variant).',

  'learn.L.l_metals_activity.title': 'Mis(II) oksidi',
  'learn.L.l_metals_activity.s0':
    'CuO asosiy oksid; kislotalar bilan Cu(II) tuzlar, qayta tiklovchilar bilan mis metall.',
  'learn.L.l_metals_activity.s1': 'Faollik qatorida Cu ni suyuq kislotadagi Zn bilan solishtiring.',
  'learn.L.l_metals_activity.h_b': 'Katalogdagi CuO modeli.',
  'learn.L.l_metals_activity.s3': 'CuO + H₂SO₄ → tuz + suv ni muvozanatlang.',

  'learn.L.l_redox_intro.title': 'OKR va muvozanat',
  'learn.L.l_redox_intro.s0':
    'Reaksiya oldi va keyin oksidlanish darajalarini belgilang; elektron balansi — standart usul.',
  'learn.L.l_redox_intro.s1': 'MnO₂ ko\'pincha laboratoriya sxemalarida oksidlovchi (faqat uslubiy qo\'llanma bo\'yicha).',
  'learn.L.l_redox_intro.h_b': 'Katalogdagi MnO₂ strukturaviy modeli.',
  'learn.L.l_redox_intro.s3': 'Laboratoriyani oching va oksidlanish darajalari o\'zgaradigan oddiy tenglama tanlang.',

  'learn.L.l_electrolysis_intro.title': 'Elektroliz va ionlar',
  'learn.L.l_electrolysis_intro.s0':
    'NaCl eritmasida Na⁺ va Cl⁻ razryadlanadi; suvli eritmada suv H⁺ va OH⁻ raqobatlashadi.',
  'learn.L.l_electrolysis_intro.s1': 'Katod qayta tiklaydi, anod oksidlaydi — sifatiy yo\'nalishni eslang.',
  'learn.L.l_electrolysis_intro.h_b': 'Ionlarni muhokama qilish uchun NaCl modeli.',
  'learn.L.l_electrolysis_intro.s3': 'Inert elektrodlar bilan suvli NaCl elektrolizi sxemasini chizing (sifatiy).',

  'learn.L.l_water_chemistry.title': 'Erituvchi sifatida suv',
  'learn.L.l_water_chemistry.s0':
    'Polyar molekulalar suvda yaxshiroq eriydi; ionlar gidratlanadi.',
  'learn.L.l_water_chemistry.s1': 'pH H⁺ konsentratsiyasi bilan bog\'liq; kislotalar va asoslar pH ni o\'zgartiradi.',
  'learn.L.l_water_chemistry.h_b': 'H₂O modeli.',
  'learn.L.l_water_chemistry.s3': 'Nima uchun suvli NaCl neytralga yaqin (25 °C da pH ≈ 7) — tushuntiring.',

  'learn.L.l_qual_analysis.title': 'Kaliy dixromati',
  'learn.L.l_qual_analysis.s0':
    'K₂Cr₂O₇ kislota muhitida kuchli oksidlovchi; yorliqlar va sinf qoidalari muhim.',
  'learn.L.l_qual_analysis.s1': 'Xrom(VI) rangi oksidlanish namoyishlarida ishlatiladi.',
  'learn.L.l_qual_analysis.h_b': 'Katalogdagi tuz modeli.',
  'learn.L.l_qual_analysis.s3': 'Kislota muhitida Cr₂O₇²⁻ qayta tiklanish yarimreaktsiyasini yozing (sifatiy).',

  'learn.L.l_industrial_touch.title': 'Kukurt trioksidi',
  'learn.L.l_industrial_touch.s0':
    'SO₃ — oltingugurt(VI) ning kislotali oksidi; kontakt jarayoni kukurt kislotasiga olib boradi.',
  'learn.L.l_industrial_touch.s1': 'Gigroskopiklik va suv bilan reaksiya ko\'p issiqlik ajratadi (faqat matn).',
  'learn.L.l_industrial_touch.h_b': 'Katalogdagi SO₃ modeli.',
  'learn.L.l_industrial_touch.s3':
    'SO₃ + H₂O yozing va SO₂ ning ikki bosqichli oksidlanishida katalizator rolini muhokama qiling.',

  'learn.L.l_safety_lab.title': 'Ilova laboratoriyasi',
  'learn.L.l_safety_lab.s0':
    'ATOMLAB — o\'quv vizualizatsiyasi: reaktor muvozanatni tekshiradi va 3D mahsulotni ko\'rsatadi, SHV yoki ventilyatsiyani emas.',
  'learn.L.l_safety_lab.s1': 'Haqiqiy tajribalar faqat o\'qituvchi va uslubiy qo\'llanma bilan.',
  'learn.L.l_safety_lab.s2':
    'Avval davriy jadval va moddalar katalogini o\'rganing, keyin virtual reaktorni sinab ko\'ring.',

  ...learnHubI18nUz,
  ...learnLessonExtraUz,
  ...learnPathwayUz,

  'learn.tryLabLessonBody':
    '«Laboratoriya» ga o\'ting, reaktorni oching (reagentlar — o\'ngdagi ⊞ jadval), katalogdan mahsulot tanlang va tenglamani muvozanatlang. Bu o\'quv modeli.',
} satisfies Record<keyof typeof learnPackRu, string>
