import type { Co2MechanismText } from './co2MechanismText'

/** O‘zbekcha matn: «ko‘mirning yonishi: C (grafit) + O₂ → CO₂». Sonlar ru bilan bir xil va bir xil tartibda. */
export const CO2_TEXT_UZ: Co2MechanismText = {
  intro: {
    title: 'Ko‘mirning yonishi: qutbli kovalent bog‘',
    speak: 'Ko‘mir aslida qanday yonishini ko‘ramiz: kislorod grafit qatlamining chetiga o‘tiradi, uglerod esa gazga kislorod bilan birga chiqadi.',
  },
  steps: {
    reactants: {
      title: 'Grafit va kislorod',
      body:
        'Chapda — grafitning ikki qatlami, uglerodning standart shakli. Qatlam ichida uglerod atomlari muntazam oltiburchaklar hosil qiladi: har birining 142,1 pm masofada uchta qo‘shnisi bor, bog‘lar kovalent. ' +
        'Qatlamlar bir-birining ustida 335,45 pm masofada yotadi (katak parametri c = 670,9 pm ning yarmi) va faqat kuchsiz molekulalararo tortishish bilan ushlanadi — shuning uchun grafit yumshoq va qog‘ozda iz qoldiradi. ' +
        'O‘ngda — kislorod molekulasi O₂: ikki atom uzunligi 120,75 pm bo‘lgan qo‘sh bog‘ (σ + π) bilan bog‘langan.',
      equation: 'C (grafit, qat.) + O₂ (gaz)',
      note:
        'Ingichka chiziqlar — grafit elementar katagining qirralari (fazoviy guruh P6₃/mmc, a = 246,1 pm), bog‘lar emas. Ikki qatlamdan kesib olingan bo‘lak ko‘rsatilgan; ko‘mir donasida qatlam va atomlar bir necha tartib ko‘p. ' +
        'Bog‘lar va π-yaproqlar ko‘rinib turishi uchun sharlar kovalent radiusning 0,5 qismida chizilgan. O₂ molekulasi — tripl holatda, ikkita juftlashmagan elektroni bor: oddiy O=O yozuvi buni ko‘rsatmaydi. Grafit — uglerodning standart holati, uning ΔH°f qiymati nol deb olingan.',
      speak: 'Chapda grafit — qatlamli uglerod, o‘ngda ikki atomli kislorod molekulasi.',
    },
    chemisorption: {
      title: 'Kislorod qatlam chetiga o‘tiradi',
      body:
        'Qatlam ichida uglerodning barcha bog‘lari band, shuning uchun kislorod faqat chet bilan reaksiyaga kirishadi. O₂ molekulasi ikkita qo‘shni chetki atomga o‘tiradi: O=O qo‘sh bog‘i aynan ikkita uglerod–kislorod bog‘i yopilgan paytda uziladi. ' +
        'Chetda sirt komplekslari C(O) hosil bo‘ladi — bog‘ uzunligi taxminan 122 pm bo‘lgan karbonil guruhlar. Bunda erkin kislorod atomlari paydo bo‘lmaydi.',
      equation: 'O₂ (gaz) + 2 C (qatlam cheti) → 2 C(O)',
      note:
        'C(O) kompleksidagi bog‘ uzunligi ketonlarning karbonil guruhi C=O dagidek olingan (122 pm): sirt guruhlarida u yaqin, lekin chetning tuzilishiga bog‘liq. Qatlam chetida «zigzag» va «kreslo» qismlari bo‘ladi — bu yerda bitta holat ko‘rsatilgan. ' +
        'Sirtda O=O ning uzilishi bog‘ning cho‘zilishi va erib yo‘qolishi kabi chizilgan; bosqichning o‘zi kvant jarayon va ekrandagidan ancha tez boradi.',
      speak: 'Kislorod qatlam chetiga o‘tiradi. O=O bog‘i faqat ikkita uglerod–kislorod bog‘i hosil bo‘lishi bilan birga uziladi.',
    },
    desorption: {
      title: 'Chetdan is gazi CO ajraladi',
      body:
        'Kislorodni ushlab turgan chetki uglerod atomi ikkala C–C bog‘ini yo‘qotadi va qatlamni kislorod bilan birga — CO molekulasi ko‘rinishida tark etadi. ' +
        'CO dagi bog‘ uch karrali bo‘ladi (σ va ikkita π) va 112,8 pm gacha qisqaradi; bu kimyodagi eng mustahkam bog‘lardan biri — 1072 kJ/mol. ' +
        'Bu bosqich har mol CO uchun −110,5 kJ beradi — bu is gazining hosil bo‘lish issiqligi. Erkin uglerod atomi bir lahzaga ham paydo bo‘lmaydi.',
      equation: 'C (grafit) + ½ O₂ (gaz) → CO (gaz),  ΔH = −110,5 kJ/mol',
      note:
        'Nega «C atomi grafitdan uchib chiqadi» emas: grafitni atomlarga ajratish 716,7 kJ/mol turadi — bu butun reaksiya har mol CO₂ uchun ajratadigan issiqlikdan 323,2 kJ ko‘p. Shuning uchun atomlarga ajralish faqat energiya zinapoyasida — Gess qonunining rasmiy pog‘onasi sifatida bor, yonish bosqichi sifatida emas. ' +
        'Ikkinchi C(O) kompleksi ham CO molekulasi bo‘lib ajraladi — kadrda bittasi ko‘rsatilgan. Qatlam cheti atomma-atom «yeyiladi» — ko‘mir shunday yonadi.',
      speak: 'Qatlam chetidan is gazi molekulasi ajraladi. Erkin uglerod atomi yo‘q.',
    },
    oxidation: {
      title: 'CO + ·OH → CO₂ + H·',
      body:
        'Quruq is gazi kislorodda deyarli yonmaydi: alangada uni ·OH radikallari yondirib tugatadi, ular suvning hatto izlari bor joyda ham paydo bo‘ladi. ' +
        '·OH radikali kislorod atomi bilan CO ning bo‘sh uchiga o‘tiradi: ikkinchi C=O bog‘i yopiladi, vodorod atomi esa H· radikali bo‘lib ketadi; bosqich 102,3 kJ/mol ajratadi. ' +
        'Jami CO + ½ O₂ → CO₂ har mol CO uchun −283,0 kJ beradi, grafitdan boshlab butun yo‘l esa: −110,5 + (−283,0) = −393,5 kJ har mol CO₂ uchun — CO₂ ning hosil bo‘lish issiqligi.',
      equation: 'CO (gaz) + ·OH (gaz) → CO₂ (gaz) + H· (gaz),  ΔH = −102,3 kJ/mol',
      note:
        'H· radikali yo‘qolmaydi: O₂ bilan uchrashib, u yana ·OH beradi — bu vodorodning yonishidagi kabi zanjir reaksiya. Aslida CO va ·OH qisqa yashovchi HOCO kompleksi orqali o‘tadi; bu yerda u chizilmagan. ' +
        'Radikaldagi O–H bog‘ uzunligi suvdagidek chizilgan — dars ma’lumotlarida ·OH uchun alohida qiymat yo‘q. CO ning ikkita π-bog‘idan biri yangi C=O bog‘iga o‘tadi, shuning uchun CO₂ ning ikkita π-bog‘i o‘zaro perpendikulyar tekisliklarda yotadi.',
      speak: 'Is gazini OH radikali yondirib tugatadi: ikkinchi uglerod–kislorod bog‘i yopiladi, vodorod atomi ketadi.',
    },
    structure: {
      title: 'CO₂ ning tuzilishi: bog‘lar qutbli, molekula — yo‘q',
      body:
        'CO₂ molekulasi chiziqli: O–C–O burchagi 180°, ikkala C=O bog‘i bir xil, uzunligi 116,0 pm. Har bir bog‘ — bu σ + π, ikkala π-bog‘ o‘zaro perpendikulyar tekisliklarda yotadi. ' +
        'Kislorodning elektromanfiyligi 3,44, uglerodniki 2,55, farqi 0,89 — shuning uchun har bir bog‘ qutbli: uglerodda δ+, kislorodlarda δ−. ' +
        'Lekin ikkita bir xil vektor qarama-qarshi tomonga qaraydi va bir-birini yo‘qotadi: molekulaning dipol momenti nolga teng.',
      equation: 'O=C=O,  ∠O–C–O = 180°,  d(C=O) = 116,0 pm,  Σμ = 0',
      note:
        'O‘q ustidagi va ostidagi yaproqlar — π-bog‘larning sxemasi, to‘lqin funksiyasining izosirti emas; bosqich o‘rtasida ular qo‘sh bog‘ning ikki chiziqli odatiy yozuviga aylanadi. Nuqtali strelkalar — bog‘ dipol vektorlarining darslikdagi belgisi. ' +
        'Uglerodda +4 va kislorodda −2 oksidlanish darajalari — rasmiy hisob: molekulada C⁴⁺ va O²⁻ ionlari yo‘q. CO₂ dagi C=O bog‘i aldegid va ketonlardagidan qisqaroq va mustahkamroq (122 pm, 745 kJ/mol): CO₂ da o‘rtacha bog‘ energiyasi 799 kJ/mol, Gess sikli bo‘yicha esa bitta bog‘ga 804,3 to‘g‘ri keladi.',
      speak: 'Bog‘lar qutbli, molekula esa yo‘q: ikkita bir xil dipol qarama-qarshi tomonga qaraydi va bir-birini yo‘qotadi.',
    },
    solid: {
      title: 'Quruq muz',
      body:
        'Sovitilganda CO₂ qattiq holatga — quruq muzga o‘tadi. Bu molekulyar panjara: fazoviy guruh Pa-3, kubik katak qirrasi a = 562,4 pm (150 K da). ' +
        'Molekulalar markazlari yoqlari markazlashgan panjara tugunlarida turadi, har bir molekulaning 12 ta eng yaqin qo‘shnisi bor, katakda Z = 4 ta molekula. ' +
        'Molekula ichida bog‘lar mustahkam kovalent, molekulalar orasida esa faqat kuchsiz molekulalararo tortishish bor — shuning uchun quruq muz atmosfera bosimida erimasdan bug‘lanadi (sublimatsiyalanadi).',
      equation: 'CO₂ (gaz) → CO₂ (qat.);  a = 562,4 pm,  Z = 4,  KS 12',
      note:
        'Bitta elementar katak va 13 ta butun molekula ko‘rsatilgan: markaziy (sahnada hosil bo‘lgan molekula) va qirralar o‘rtasidagi 12 ta qo‘shni — birgalikda katakka 1 + 12·¼ = 4 ta molekula. Molekulalar o‘qlari kubning to‘rtta turli hajmiy diagonali bo‘ylab yo‘nalgan. ' +
        'Kristallda C=O bog‘i biroz qisqaroq — 115,4 pm (150 K dagi rentgen ma’lumotlari), gazda esa 116,0 pm. 150 K da katak bo‘yicha hisoblangan zichlik — 1,643 g/sm³. 25 °C va 1 atm da CO₂ — gaz.',
      speak: 'CO₂ molekulalari quruq muz kristalliga yig‘iladi: har bir molekulaning o‘n ikkita qo‘shnisi bor.',
    },
  },
  legend: {
    electron: 'Molekula ustidagi nuqtali strelkalar — bog‘lar dipol vektorlari: δ+ dan δ− ga; ularning yig‘indisi nolga teng.',
    orbitalPhase: 'Bog‘ o‘qi ustidagi va ostidagi yaproqlar — π-bog‘lar; ikki rang — p-orbital fazasining ishorasi, zaryad emas.',
  },
  safety:
    'Is gazi CO ning rangi ham, hidi ham yo‘q va u o‘ta zaharli: qondagi gemoglobin bilan mustahkam bog‘lanib, uning kislorod tashishiga yo‘l qo‘ymaydi. ' +
    'Cho‘g‘ oxirigacha yonib bo‘lmaguncha pechni yopib bo‘lmaydi, yonish tajribalarini faqat o‘qituvchi mo‘rili shkafda o‘tkazadi.',
  energy: {
    title: 'Gess qonuni bo‘yicha energiya',
    unit: 'kJ/mol',
    caption:
      'Har mol CO₂ uchun sarf (yuqoriga) va yutuq (pastga): +716,7 + 498,4 − 1608,6 = −393,5 kJ/mol. Erkin atomlar orqali yo‘l — rasmiy: grafitning atomlarga ajralishi fizik bosqich emas, lekin Gess qonuni bo‘yicha natija yo‘lga bog‘liq emas.',
    stages: {
      atomization: 'C (grafit) → C (gaz) — fizik bosqich emas',
      dissociation: 'O₂ → 2 O',
      bonds: 'C + 2 O → CO₂',
      total: 'Yakun: ΔH°f',
    },
    summary: 'CO₂ uchun Gess sikli: pog‘onalar yig‘indisi {dH} kJ/mol',
    sources: 'Ma’lumotnoma qiymatlari: NIST-JANAF, CRC Handbook; bog‘ energiyalari — jadvallar bo‘yicha o‘rtacha.',
  },
}
