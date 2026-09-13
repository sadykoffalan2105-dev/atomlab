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
  },
  safety: 'ClO₂ zaharli, konsentrlangan gazi esa portlashi mumkin — shuning uchun u ishlatiladigan joyning oʻzida olinadi va saqlanmaydi.',
}
