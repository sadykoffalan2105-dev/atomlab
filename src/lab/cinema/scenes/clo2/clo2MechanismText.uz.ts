import type { Clo2MechanismText } from './clo2MechanismText'

/**
 * Узбекский пакет урока (латиница, oʻ/gʻ через U+02BB) — перевод CLO2_TEXT_RU.
 * TODO: текст должен проверить учитель химии — носитель узбекского языка.
 * Импорт только type: иначе цикл модулей.
 */
export const CLO2_TEXT_UZ: Clo2MechanismText = {
  intro: {
    title: 'Reaksiya mexanizmi',
    speak: 'Keling, natriy xlorit xlor bilan aslida qanday reaksiyaga kirishishini kuzatamiz. Elektron juftlarini kuzatib boring.',
  },
  steps: {
    reagents: {
      title: 'Eritmadagi zarrachalar',
      body:
        'Suvda natriy xlorit Na⁺ va ClO₂⁻ ionlariga ajraladi. Xlorit ioni burchakli tuzilishga ega: O–Cl–O burchagi ≈ 111°, Cl–O bogʻlari 1,57 Å, xlorning oksidlanish darajasi +3. ' +
        'Eritmaga Cl₂ molekulasi kiradi — undagi ikki atom umumiy elektron juft orqali bogʻlangan (oksidlanish darajasi 0). ' +
        'Na⁺ ionlari reaksiyada ishtirok etmaydi — ular kuzatuvchi ionlardir.',
      equation: '2 NaClO₂ → 2 Na⁺ + 2 ClO₂⁻ ;  Cl₂ (gaz → eritma)',
      speak: 'Suvda natriy xlorit natriy ionlari va xlorit ionlaridan iborat. Eritmaga xlor molekulasi kiradi. Natriy reaksiyada ishtirok etmaydi.',
    },
    approach: {
      title: 'Yaqinlashish',
      body:
        'Xlorit ioni Cl₂ molekulasiga kislorod atomi bilan yaqinlashadi. Kislorodning taqsimlanmagan elektron jufti yaqinroq turgan xlor atomiga qaratilgan. ' +
        'Cl–Cl bogʻining elektronlari uzoqdagi atom tomon siljiydi: yaqin xlor qisman musbat (δ+), uzoqdagisi esa qisman manfiy (δ−) zaryadlanadi.',
      equation: 'O(ClO₂⁻) ··· Clᵟ⁺–Clᵟ⁻',
      note: 'δ qisman zaryadlar sxematik tarzda koʻrsatilgan.',
      speak: 'Xlorit ioni xlor molekulasiga kislorod atomi bilan yaqinlashadi. Xlor molekulasi qutblanadi: yaqin atom qisman musbat, uzoq atom qisman manfiy.',
    },
    clTransfer: {
      title: 'Cl⁺ koʻchishi — sekin bosqich',
      body:
        'Kislorodning taqsimlanmagan elektron jufti yangi O–Cl bogʻiga aylanadi. Shu bilan bir vaqtda Cl–Cl bogʻining elektron jufti butunlay uzoqdagi atomga oʻtadi va u xlorid ioni Cl⁻ holida ajralib chiqadi. ' +
        'Natijada xloritga Cl⁺ birikadi. Bu bosqichda xloritdagi xlor elektron bermaydi — elektronlar bogʻlar ichida juft-juft boʻlib siljiydi.',
      equation: 'ClO₂⁻ + Cl₂ → ClOClO + Cl⁻',
      note: 'Reaksiya tezligini aynan shu bosqich belgilaydi. «Elektron Cl₂ ga sakrab oʻtadi» degan yoʻl tekshirilgan va rad etilgan (Nicoson, Margerum, 2002).',
      speak: 'Kislorodning elektron jufti yangi bogʻ hosil qiladi. Xlor-xlor bogʻining elektronlari uzoqdagi atomga oʻtadi va u xlorid ioni boʻlib ajraladi. Bu eng sekin bosqich.',
    },
    intermediate: {
      title: 'Cl₂O₂ oraliq zarrachasi',
      body:
        'Qisqa yashovchi Cl₂O₂ zarrachasi hosil boʻldi. Kinetika faqat uning tarkibini koʻrsatadi; tuzilishi uchun Cl–O–Cl=O zanjiri taklif qilingan va hisoblashlar bunday zarracha boʻlishi mumkinligini koʻrsatadi. ' +
        'Undagi chetki xlorning oksidlanish darajasi +1, markaziy xlorniki esa avvalgidek +3.',
      equation: 'Cl–O–Cl=O',
      note: 'Zarracha soniyaning ulushlari davomida yashaydi va eritmada bevosita kuzatilmagan; uning tuzilishi hali muhokama qilinmoqda va sxematik koʻrsatilgan.',
      speak: 'Beqaror oraliq zarracha hosil boʻldi, unda ikkita xlor va ikkita kislorod atomi bor. Chetki xlor plyus bir, markaziy xlor plyus uch.',
    },
    attack: {
      title: 'Ikkinchi xlorit ioni',
      body:
        'Oraliq zarrachaga ikkinchi ClO₂⁻ ioni yaqinlashadi. Uning kislorodidagi taqsimlanmagan elektron juft markaziy xlor atomi bilan bogʻ hosil qiladi ' +
        'va bir lahzaga [ClOCl(O)OClO]⁻ kompleksi paydo boʻladi.',
      equation: 'ClOClO + ClO₂⁻ → [ClOCl(O)OClO]⁻',
      note: 'Bunday kompleks HOCl va xlorit oʻrtasidagi oʻxshash reaksiya kinetikasi asosida taklif qilingan (Jia, Margerum, Francisco, 2000); hisoblashlar u mavjud boʻlishi mumkinligini koʻrsatadi. Bu kuzatilgan emas, balki ehtimoliy yoʻl.',
      speak: 'Ikkinchi xlorit ioni yaqinlashadi. Uning kislorodi markaziy xlor atomiga birikadi.',
    },
    split: {
      title: 'Mahsulotlarga parchalanish',
      body:
        'Kompleks bir vaqtning oʻzida ikkita bogʻ boʻyicha parchalanadi. Chetki xlordagi Cl–O bogʻi shunday uziladiki, uning ikkala elektroni ham xlorga oʻtadi — ikkinchi Cl⁻ ajralib chiqadi (+1 → −1). ' +
        'Koʻprikli O–Cl bogʻi teng uziladi: har bir yarmiga bittadan elektron oʻtadi. Natijada ikkita ClO₂ molekulasi hosil boʻladi, ularning har birida bitta juftlashmagan elektron bor.',
      equation: '[ClOCl(O)OClO]⁻ → 2 ClO₂ + Cl⁻',
      note: 'Toʻliq strelka — elektron juftining siljishi, yarim strelka — bitta elektronning siljishi. Qoʻshimcha yoʻl: Cl₂O₂ ning bir qismi suv bilan reaksiyaga kirib, xlorat ioni ClO₃⁻ ni beradi; xlorit ortiqcha boʻlsa, ClO₂ ustun keladi.',
      speak: 'Kompleks parchalanadi. Chetki xlor xlorid ioni boʻlib ajraladi va elektron juftini oʻzi bilan olib ketadi. Koʻprik teng uziladi va ikkita xlor dioksid molekulasi hosil boʻladi.',
    },
    products: {
      title: 'Mahsulotlar',
      body:
        'ClO₂ molekulasi xloritga qaraganda kengroq ochilgan: burchak ≈ 117°, Cl–O bogʻlari qisqaroq — 1,47 Å. Undagi xlor +4. ' +
        'Juftlashmagan elektron bitta atomda turmaydi — u butun O–Cl–O zanjiri boʻylab taqsimlangan, shuning uchun ClO₂ uzoq yashovchi radikal: uning molekulalari juftlashib dimer hosil qilmaydi. ' +
        'Eritmada Na⁺ va Cl⁻ ionlari qoladi — bu erigan osh tuzi, choʻkma emas. ClO₂ eritmani sariq rangga boʻyaydi va qisman sariq-yashil gaz holida ajralib chiqadi.',
      equation: '2 ClO₂ + 2 Na⁺ + 2 Cl⁻',
      speak: 'Ikkita xlor dioksid molekulasi hosil boʻldi: burchagi bir yuz oʻn yetti daraja, xlor plyus toʻrt. Natriy ionlari va xlorid ionlari eritmada qoladi.',
    },
    balance: {
      title: 'Elektron balansi',
      body:
        'Faqat boshlangʻich va oxirgi holatni solishtiramiz. Har bir xlorit ionidagi xlor: +3 → +4, jami 2 ta elektron berildi — bu oksidlanish. ' +
        'Cl₂ dagi xlor atomlari: 0 → −1, jami 2 ta elektron qabul qilindi — bu qaytarilish. ' +
        'Bu faqat yakuniy balans: reaksiya davomida esa elektronlar bogʻlar ichida juft-juft, koʻprikli bogʻ teng uzilganda esa bittadan siljigan (3–6-qadamlar).',
      equation: '2 ClO₂⁻ − 2e⁻ → 2 ClO₂ ;  Cl₂ + 2e⁻ → 2 Cl⁻ ;  2 NaClO₂ + Cl₂ → 2 ClO₂ + 2 NaCl',
      speak: 'Xulosa: xlorit ikkita elektron berib oksidlandi, xlor esa ikkita elektron qabul qilib qaytarildi.',
    },
  },
  legend: {
    electron: 'elektron',
    pairArrow: 'elektron juftining siljishi',
    singleArrow: 'bitta elektronning siljishi',
    water: 'suv molekulalari koʻrsatilmagan',
    orbitalPhase: 'orbital boʻlaklari: rang — toʻlqin funksiyasining ishorasi (fazasi), zaryad emas; kontur — boʻsh orbital',
    vibration: 'atomlar tebranishi: chastotalar nisbati haqiqiy, vaqt ≈10¹³ marta sekinlashtirilgan, amplituda kattalashtirilgan',
  },
  safety: 'ClO₂ zaharli, konsentrlangan gazi esa portlashi mumkin — shuning uchun u ishlatiladigan joyning oʻzida olinadi va saqlanmaydi.',
  energy: {
    title: 'Energetik profil',
    axisG: 'G, kJ/mol',
    axisCoord: 'reaksiya borishi',
    unit: 'kJ/mol',
    measured: 'oʻlchovlardan',
    derived: 'k dan hisoblangan',
    schematic: 'sxematik',
    mainLabel: 'ClO₂ yoʻli {pct} %',
    branchLabel: 'ClO₃⁻ yoʻli {pct} %',
    caveat:
      'ΔG‡ toʻsiqlarining balandligi — koʻrinma qiymatlar: ular tezlik konstantalaridan Eyring tenglamasi boʻyicha hisoblangan (25 °C, 1 M) va har biri oʻz reagentlaridan oʻlchangan, shuning uchun turli bosqichlar choʻqqilarini bitta shkalada solishtirib boʻlmaydi. ' +
      'Qaysi bosqich sekinligini choʻqqi balandligi emas, kinetika koʻrsatadi. ClOClO va kompleks chuqurliklari oʻlchanmagan — bu qismlar sxematik chizilgan. ' +
      'ΔG° = −2F·ΔE° ≈ {dG} kJ/mol (E° = 0,936 V bilan — {dGAlt}); Cl₂ standart holatdagi gaz sifatida olingan.',
    chlorateModels:
      'Ikkala tadqiqot bir fikrda: xlorit ortiqcha boʻlsa, unum ClO₂ tomon siljiydi. Nicoson va Margerum (2002): ClOClO yo ClO₂⁻ bilan reaksiyaga kirishadi (ClO₂ beradi), yo gidrolizlanadi (ClO₃⁻ beradi). ' +
      'Angyal, Fábián va Szabó (2023) gidroliz oʻrniga Cl₂O₂ ning ClO₂⁻ va HOCl bilan reaksiyalarini oladi, xloratning koʻp qismi esa Cl₂O + HClO₂ dan hosil boʻladi. ' +
      'Ikki Cl₂O₂ + ClO₂⁻ bosqichi uchun toʻsiqlar {ts2} va {tsCl} kJ/mol: Cl₂O₂ ning yoʻllar boʻyicha ulushi ≈ {main} : {side} (mahsulot mollari boʻyicha ClO₂ : ClO₃⁻ ≈ 84 : 16, chunki ClO₂ yoʻli ikki molekula beradi). ' +
      'Xlorat termodinamik jihatdan pastroq (≈ −96 kJ/mol, {dG} ga qarshi), lekin ClO₂ tezroq hosil boʻladi — bu kinetik nazorat.',
    halfLife: 'Haqiqiy eritmada (10 mM xlorit) Cl₂ ning yarmi taxminan {ms} ms da sarflanadi — ekranda reaksiya sekinlashtirilgan.',
    sources:
      'Nicoson, Margerum, Inorg. Chem. 2002 · Jia, Margerum, Francisco, Inorg. Chem. 2000 · Angyal, Fábián, Szabó, Inorg. Chem. 2023 · ΔfG° NBS · E°: Cl₂/Cl⁻ 1,358 V, ClO₂/ClO₂⁻ 0,954 V',
    more: 'Modellar va manbalar',
    summary:
      '2ClO₂⁻ + Cl₂ → 2ClO₂ + 2Cl⁻ reaksiyasining energetik profili: yakuniy ΔG° ≈ {dG} kJ/mol; sekin bosqichning koʻrinma toʻsigʻi ≈ {ts1} kJ/mol; ikkinchi bosqich toʻsigʻi oraliq zarrachadan ≈ {ts2} kJ/mol; ' +
      'kompleksdan keyin yoʻl tarmoqlanadi: Cl₂O₂ → ClO₂ {main} %, → xlorat {side} %; xlorat tarmogʻi energiya boʻyicha pastroq, lekin sekinroq. Oraliq zarrachalar darajalari sxematik.',
  },
  ledger: {
    valence: 'valent e⁻',
    valenceHint: 'Atomlar va zaryad saqlanadi, shuning uchun valent elektronlar soni barcha bosqichlarda bir xil.',
    orbital: '2b₁',
    orbitalHint: 'O–Cl–O boʻgʻinining 2b₁ (π*) orbitalidagi elektronlar: xlorit ionida 2 ta, ClO₂ radikalida 1 ta.',
    aria: 'Valent elektronlar: {n} ({breakdown}). 2b₁ orbitalida: {occ}.',
  },
}
