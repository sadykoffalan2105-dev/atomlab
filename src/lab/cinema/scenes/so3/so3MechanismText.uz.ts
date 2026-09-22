import type { So3MechanismText } from './so3MechanismText'

export const SO3_TEXT_UZ: So3MechanismText = {
  intro: {
    title: 'Kontakt usuli: SO₃',
    speak: 'Oltingugurt(IV) oksidi katalizatorda oltingugurt(VI) oksidiga qanday aylanishini va bu reaksiya nega qaytar ekanini ko‘ramiz.',
  },
  steps: {
    reactants: {
      title: 'Boshlang‘ich moddalar',
      body:
        'Chapda va o‘ngda — oltingugurt(IV) oksidi SO₂ molekulalari: burchakli, O–S–O burchagi 119,5°, ikkala S–O bog‘i bir xil — 143,1 pm, molekula qutbli (μ = 1,63 D). ' +
        'O‘rtada — kislorod molekulasi O₂, bog‘ uzunligi 120,75 pm. ' +
        'SO₂ dagi oltingugurtning oksidlanish darajasi +4, uni +6 gacha oksidlash mumkin. Oltingugurtni yondirib sezilarli miqdorda SO₃ olinmaydi: oltingugurt asosan SO₂ gacha yonadi — issiq alangada muvozanat chapga siljigan, katalizatorsiz esa oksidlanish sekin; shuning uchun SO₃ sulfat kislota ishlab chiqarishning kontakt usulidagi ikkinchi bosqichda tayyor SO₂ dan olinadi.',
      equation: '2 SO₂ (gaz) + O₂ (gaz)',
      note:
        'O₂ molekulasi — triplet: bo‘shashtiruvchi π*-orbitallardagi ikki elektron juftlashmagan, shuning uchun kislorod paramagnit. Qo‘sh chiziq — maktabdagi «ikki» bog‘ tartibi, bu elektronlarning tasviri emas. ' +
        'SO₂ dagi S–O bog‘lari punktirli tasma bilan chizilgan: π-elektronlar ikkala bog‘ bo‘ylab delokallashgan, soddalashtirilgan hisobda har bir bog‘ tartibi bir yarim, maktabdagi O=S=O yozuvidagidek ikki emas; bog‘ tartibi o‘lchanadigan kattalik emas, u modelga bog‘liq. ' +
        '119,5° burchak va 143,1 pm uzunlik — geometriya turi ko‘rsatilmagan ma’lumotnoma qiymatlari. Muvozanat rₑ geometriyasi biroz kichikroq burchak beradi.',
      speak: 'Yon tomonlarda ikkita burchakli oltingugurt oksidi molekulasi, o‘rtada kislorod molekulasi. Ulardagi oltingugurtni yana oksidlash mumkin.',
    },
    equilibrium: {
      title: 'Qaytarlik va Le Shatelye prinsipi',
      body:
        '2 SO₂ + O₂ ⇌ 2 SO₃ reaksiyasi qaytar va ekzotermik: ΔH = 2·(−395,7) − 2·(−296,8) = −197,8 kJ tenglamaga, ya’ni bir mol SO₃ ga −98,9 kJ. ' +
        'Le Shatelye prinsipiga ko‘ra qizdirish muvozanatni chapga, boshlang‘ich moddalar tomon siljitadi, bosimni oshirish esa o‘ngga: uchta gaz molekulasidan ikkitasi hosil bo‘ladi. ' +
        'Katalizatorsiz SO₂ kuchli qizdirilganda ham juda sekin oksidlanadi: to‘siq baland, qizdirish esa muvozanatni chapga ham siljitadi. Vanadiy katalizatori faqat 400 °C atrofida faollashadi, harorat ko‘tarilgan sari SO₃ unumi kamayadi, shuning uchun jarayon 400–450 °C da olib boriladi — tezlik bilan unum o‘rtasidagi murosa.',
      equation: '2 SO₂ (gaz) + O₂ (gaz) ⇌ 2 SO₃ (gaz)  (V₂O₅, 400–450 °C),  ΔH = −197,8 kJ',
      note:
        'Bir juft molekulaning bitta to‘qnashuvi sekinlashtirib ko‘rsatilgan. 25 °C dagi gazda har bir molekula qo‘shnilari bilan sekundiga milliardlab marta to‘qnashadi, lekin to‘qnashuvlarning juda kichik qismigina reaksiya bilan tugaydi: bog‘larni qayta qurish uchun energiya yetmaydi.',
      speak: 'Reaksiya qaytar va issiqlik chiqaradi. Katalizatorsiz u qizdirilganda ham deyarli bormaydi, kuchli qizdirish esa unumni kamaytiradi.',
    },
    catalyst: {
      title: 'V₂O₅ katalizatori: kislorod vanadiydan',
      body:
        'Katalizator — vanadiy(V) oksidi. Maktab sxemasiga ko‘ra SO₂ molekulasi katalizatordan bitta kislorod atomini oladi: V₂O₅ + SO₂ → V₂O₄ + SO₃. ' +
        'Oltingugurt +4 dan +6 gacha oksidlanib, ikki elektron beradi, vanadiy +5 dan +4 gacha qaytariladi — ikki atomning har biriga bittadan elektron. ' +
        'Bu bosqichning o‘zi endotermik: bir mol SO₂ ga +24,9 kJ. Yuzadan gazga chiqqach, SO₃ molekulasi yassi bo‘ladi: uchala S–O bog‘i bir xil.',
      equation: 'V₂O₅ (qat.) + SO₂ (gaz) → V₂O₄ (qat.) + SO₃ (gaz)  (×2)',
      note:
        'Bu SXEMA. Kontakt usulining haqiqiy katalizatori — g‘ovak kremnezyomdagi kaliy pirosulfati K₂S₂O₇ ichidagi V₂O₅ suyuqlanmasi; V(V)/V(IV) oksidlanish-qaytarilish sikli qattiq V₂O₄ orqali emas, suyuqlanmadagi sulfato-vanadat komplekslari orqali boradi. ' +
        'Katalizator yuzasi nuqtalar to‘ri bilan chizilgan, vanadiy atomlari ko‘rsatilmagan: ularning kadrdagi o‘rni to‘qima bo‘lardi. Oltingugurt yonidagi sonlar — formal oksidlanish darajalari: S–O bog‘lari kovalent, oltingugurt ionlari yo‘q. ' +
        'Molekula katalizatorga kislorod atomi orqali bog‘langan paytda u yassi emas (vanadiydagi sulfatsimon zarracha); SO₃ faqat gazda yassi bo‘ladi, kadrda esa yuza yonidayoq to‘g‘rilanadi — bu shartli. ' +
        'Katalizatorning kislorod atomi SO₃ dagi kabi Kordero kovalent radiusi bilan chizilgan: V₂O₅ dagi V–O bog‘lari ko‘p jihatdan kovalent, shuning uchun bu yerda O²⁻ ioni chizilmaydi; kislorod atomlari yuza to‘ri bilan birga bitta sxema sifatida paydo bo‘ladi.',
      speak: 'Oltingugurt oksidi molekulasi katalizatordan kislorod atomini olib, oltingugurt(VI) oksidiga aylanadi.',
    },
    reoxidation: {
      title: 'Kislorod katalizatorga qaytadi',
      body:
        'O₂ molekulasi qaytarilgan katalizatorga qo‘nadi, O=O bog‘i uziladi va har bir kislorod atomi bo‘shagan joyni egallaydi: V₂O₄ + ½ O₂ → V₂O₅. ' +
        'Kislorod to‘rtta elektron qabul qiladi — aynan oltingugurt vanadiyga bergan elektronlarni. Bu bosqich kuchli ekzotermik: bir mol V₂O₅ ga −123,8 kJ. ' +
        'Katalizator dastlabki holatiga qaytdi: kislorod vanadiy orqali o‘tdi, vanadiyning o‘zi esa mahsulotga kirmadi.',
      equation: 'V₂O₄ (qat.) + ½ O₂ (gaz) → V₂O₅ (qat.)  (×2)',
      note:
        'Tenglamaga bosqichlar yig‘indisi: 2 × (+24,9) + 2 × (−123,8) = −197,8 kJ — to‘g‘ridan-to‘g‘ri reaksiyaniki bilan bir xil: katalizator ΔH ni ham, muvozanat holatini ham o‘zgartirmaydi, u faollanish energiyasi kichikroq yo‘lni ochadi. ' +
        'Mahsulotlardagi kislorod atomlari — avval katalizatorniki edi, O₂ dagi kislorod esa katalizatorda qoldi: sxema kislorodning vanadiy orqali «yurishini» shunday ko‘rsatadi. O₂ ning yuzada parchalanishi va sekinlashtirilgan vaqt — shartli.',
      speak: 'Havodagi kislorod katalizatorga bergan atomlarini qaytaradi. Katalizator yangi aylanishga tayyor.',
    },
    product: {
      title: 'SO₃: yassi uchburchak',
      body:
        'SO₃ molekulasi — muntazam yassi uchburchak, simmetriyasi D₃h: uchala S–O bog‘i bir xil — 141,98 pm, barcha O–S–O burchaklari 120°. ' +
        'Bog‘lar qutbliligining uchta bir xil vektori bir-birini yo‘qotadi, shuning uchun molekula qutbsiz: μ = 0, burchakli SO₂ ning dipol momenti esa 1,63 D. ' +
        'SO₃ dagi S–O bog‘i SO₂ dagidan (143,1 pm) biroz qisqa: S–O bog‘lari kuchli qutbli, SO₃ dagi oltingugurtda musbat zaryad kattaroq va u kislorodni kuchliroq tortadi.',
      equation: 'SO₃ (gaz): S–O = 141,98 pm, ∠O–S–O = 120°, μ = 0',
      note:
        'Maktab yozuvida oltingugurt +6 da uchta qo‘sh S=O bog‘i bor. Aslida uchala bog‘ teng qiymatli: π-elektron zichligi butun molekula bo‘ylab delokallashgan, shuning uchun bog‘ qisqa punktirli tasma bilan chizilgan — tartibi oddiydan katta, qo‘shdan kichik. ' +
        'Rasmdagi karralilik — soddalashtirilgan hisob (bitta π-juft uchta bog‘ga, SO₂ da — ikkitasiga), shuning uchun SO₃ da u SO₂ dagidan kichik chizilgan, garchi bog‘ qisqaroq bo‘lsa ham: uzunlikni faqat bu hisob emas, bog‘ qutbliligi ham belgilaydi, bog‘ tartibining o‘zi esa tanlangan modelga bog‘liq. ' +
        'Uzunlik — gaz molekulasining muvozanat rₑ qiymati. Molekula burilib, to‘rttala atom bir tekislikda yotishini ko‘rsatadi.',
      speak: 'Oltingugurt(VI) oksidi — yassi uchburchak. Uchta bog‘ bir xil, molekula qutbsiz.',
    },
    condensed: {
      title: 'Zavodda va kondensatlangan holatda SO₃',
      body:
        'SO₃ suv bilan shiddatli reaksiyaga kirishadi: SO₃ + H₂O → H₂SO₄, ΔH = −132,5 kJ/mol. ' +
        'Zavodda SO₃ suvga emas, 98 % sulfat kislotaga yuttiriladi va oleum — SO₃ ning H₂SO₄ dagi eritmasi olinadi: suv ustida SO₃ uning bug‘i bilan uchrashib, mayda kislota tomchilaridan barqaror tuman hosil qiladi, u deyarli ushlanmaydi, 98 % H₂SO₄ ustida esa suv bug‘ining ham, SO₃ ning ham bosimi eng kichik. ' +
        'SO₃ ning uchta qattiq shakli bor: γ — siklik S₃O₉ trimerlaridan iborat muzsimon kristallar (suyuqlanish harorati 16,8 °C, qaynash harorati 44,8 °C), β — spiral zanjirlar (suyuqlanish harorati 32,5 °C) va α — qatlamlarga tikilgan zanjirlar (suyuqlanish harorati 62,3 °C). ' +
        'Shuning uchun 25 °C da SO₃ — suyuqlik (γ-shakl suyuqlanmasi, unda trimerlar SO₃ molekulalari bilan muvozanatda) yoki qattiq β va α polimerlari.',
      equation: 'SO₃ (gaz) + H₂O (suyuq.) → H₂SO₄ (suyuq.),  ΔH = −132,5 kJ/mol',
      note:
        'S₃O₉ trimerida har bir oltingugurt — SO₄ tetraedri: ikkita chetki S=O bog‘i (140 pm) va halqadagi ikkita ko‘prikli S–O bog‘i (162 pm). Uzunliklar γ-SO₃ kristallidan (trimer suyuqlikda ham saqlanadi), halqaning barcha atomlaridagi burchaklar esa ideal tetraedr (109,5°) bo‘yicha qurilgan — bu sxema: ko‘prikli kislorod umuman tetraedrik emas, haqiqiy halqada S–O–S burchagi sezilarli kattaroq, halqadagi O–S–O burchagi esa tetraedrikdan kichikroq. ' +
        'Trimer SO₃ molekulasi yonida faqat taqqoslash uchun butunligicha ko‘rsatilgan — u kadrda shu molekuladan yig‘ilmaydi; qo‘shni molekulalar chizilmagan.',
      speak: 'Oltingugurt(VI) oksidi suv bilan sulfat kislota tumanini beradi, shuning uchun uni konsentrlangan sulfat kislotaga yuttiradilar. Oltingugurt(VI) oksidi molekulalari uchtadan halqaga birlashadi.',
    },
  },
  legend: {
    electron: 'Oltingugurt yonidagi sonlar — formal oksidlanish darajalari: kislorod o‘tishidan oldin +4, keyin +6.',
    orbitalPhase: 'Punktirli tasma — delokallashgan bog‘: tartibi oddiydan katta, qo‘shdan kichik. Nuqtalar to‘ri — V₂O₅ katalizatori yuzasining sxemasi.',
  },
  safety: 'SO₂ va SO₃ zaharli, nafas yo‘llarini yemiradi; SO₃ havo namligi bilan sulfat kislota tumanini beradi, suv bilan qaynab, sachrab reaksiyaga kirishadi. Tajriba — faqat virtual yoki o‘qituvchi tomonidan mo‘rili shkafda.',
  energy: {
    title: 'Kataliz bosqichlari bo‘yicha energiya',
    unit: 'kJ',
    caption: '2 SO₂ + O₂ → 2 SO₃ tenglamasiga maktab sxemasining ikki bosqichi: birinchisida ko‘tarilish, ikkinchisida katta tushish; yig‘indi — reaksiya ΔH i.',
    stages: {
      reduction: 'V₂O₅ + SO₂ → V₂O₄ + SO₃',
      reoxidation: 'V₂O₄ + ½ O₂ → V₂O₅',
      total: 'Natija: ΔH',
    },
    summary: 'SO₂ oksidlanishining kataliz bosqichlari bo‘yicha energiyasi: yig‘indi {dH} kJ',
    sources: 'ΔH°f ma’lumotnoma qiymatlari: CRC Handbook, NIST-JANAF (298 K).',
  },
}
