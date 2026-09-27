import type { SchoolLessonText } from '../school/schoolSpec'

/** O'zbekcha dars matni: 2H₂ + O₂ → 2H₂O (maktab varianti, 7-sinf). Sonlar ruscha matn bilan bir xil. */
export const H2O_TEXT_UZ: SchoolLessonText = {
  intro: {
    title: 'Vodorod va kisloroddan suv qanday hosil bo‘ladi',
    speak: 'Vodorod va kislorod atomlari umumiy elektron juftlar orqali suv molekulasiga qanday birikishini ko‘ramiz.',
  },
  steps: {
    reactants: {
      title: 'Vodorod va kislorod',
      body:
        'Vodorod H₂ va kislorod O₂ — rangsiz, hidsiz gazlar, ularning molekulalari ikki atomdan iborat. ' +
        'Ikki hajm vodorod bilan bir hajm kislorod aralashmasi qaldiroq gaz deyiladi: uchqundan u portlaydi. ' +
        'H₂ molekulasida atomlar bitta umumiy elektron jufti bilan (H–H), O₂ molekulasida esa ikkitasi bilan (O=O) bog‘langan.',
      equation: '2H₂ + O₂  (qaldiroq gaz, 2 : 1)',
      note: 'O=O — maktab yozuvi. Aslida O₂ molekulasida ikkita juftlashmagan elektron bor, shuning uchun suyuq kislorod magnitga tortiladi; 7-sinfda O=O yozuvidan foydalanamiz.',
      speak: 'Vodorod va kislorod — ikki atomli molekulalardan iborat gazlar. Ikki hajm vodorod va bir hajm kislorod — qaldiroq gaz.',
    },
    atoms: {
      title: 'Atomlarning tuzilishi',
      body:
        'Vodorod atomida bitta elektron bor: H +1 )1. Kislorod atomida ikki qavatda sakkizta elektron: O +8 )2 )6, tashqi qavatda oltita elektron, ulardan ikkitasi juftlashmagan. ' +
        'Shuning uchun O₂ da atomlar orasida ikkita umumiy juft bor, har bir O atomida esa ikkita taqsimlanmagan juft qoladi. ' +
        'Atom atrofidagi bulut — uning tashqi elektron qavati, nuqtalar — shu qavat elektronlari.',
      equation: 'H +1 )1     O +8 )2 )6',
      note: 'Bulutlar va nuqtalar — maktab modeli: elektronlar bir joyda turmaydi, nuqtalar ularning soni va juftlarga qanday taqsimlanganini ko‘rsatadi.',
      speak: 'Vodorodda bitta elektron, kislorodning tashqi qavatida oltita, ulardan ikkitasi juftlashmagan.',
    },
    breaking: {
      title: 'Bog‘lar uziladi',
      body:
        'Aralashma uchqun bilan yondiriladi. H₂ va O₂ molekulalaridagi bog‘lar uziladi: har bir umumiy juft ajraladi va har bir atomga bittadan elektron qaytadi. ' +
        'Atomlar hosil bo‘ladi: vodorodda bitta juftlashmagan elektron, kislorodda ikkita juftlashmagan elektron va ikkita taqsimlanmagan juft.',
      equation: '2H₂ + O₂ → 4H· + 2·O·',
      note: 'Aslida reaksiya H, O va OH zarrachalari orqali zanjir bo‘lib boradi va barcha bog‘lar birdaniga uzilmaydi. «Bog‘lar uzildi — atomlar birikdi» sxemasi yangi umumiy juftlar qayerdan kelishini ko‘rsatadi; elektronlar soni o‘zgarmaydi.',
      speak: 'Bog‘lar uziladi: har bir juft ajralib, bittadan elektron o‘z atomiga qaytadi.',
    },
    pairs: {
      title: 'Umumiy juftlar hosil bo‘ladi',
      body:
        'Kislorod atomi ikkita vodorod atomi bilan birikadi. Tashqi qavat bulutlari bir-birini qoplaydi va juftlashmagan elektronlar juft-juft bo‘lib uchrashadi: H atomidan bitta va O atomidan bitta elektron yadrolar orasida umumiy juft hosil qiladi. ' +
        'Har bir O atomida ikkita umumiy juft bo‘ladi. Endi vodorodning tashqi qavatida 2 ta, kislorodnikida 8 ta elektron: qavatlar tugallangan.',
      equation: 'H· + ·O· + ·H → H : O : H',
      note: 'Kislorod elektronlarni vodoroddan kuchliroq tortadi, shuning uchun umumiy juftlar O atomi tomon siljigan — O–H bog‘i kovalent qutbli.',
      speak: 'Vodoroddan bitta, kisloroddan bitta elektron — va yadrolar orasida umumiy juft paydo bo‘ladi.',
    },
    molecule: {
      title: 'Suv molekulasi',
      body:
        'Har bir umumiy juft — O–H bog‘i; struktura formulada u chiziqcha bilan tasvirlanadi: H–O–H. Suvda kislorod ikki valentli (ikki chiziqcha), vodorod bir valentli. ' +
        'Molekula burchakli: H–O–H burchagi 104,5°, O–H bog‘ining uzunligi 95,8 pm. Kislorod atomida ikkita taqsimlanmagan juft qoladi.',
      equation: 'H–O–H,  ∠HOH = 104,5°',
      note: 'Burchakli shaklni kislorodning taqsimlanmagan juftlari hosil qiladi: ular O–H bog‘larini itaradi. Qutbli bog‘lar va burchakli shakl tufayli suv molekulasi qutbli.',
      speak: 'Yuz to‘rt yarim gradus burchak ostida ikkita O–H bog‘i va kislorodda ikkita taqsimlanmagan juft.',
    },
    result: {
      title: 'Natija: suv',
      body:
        'Ikki molekula vodorod va bir molekula kisloroddan ikki molekula suv hosil bo‘ldi. Reaksiyadan oldin va keyin har bir element atomlari soni teng: 4 ta H atomi va 2 ta O atomi. ' +
        'Reaksiya portlash bilan boradi va issiqlik ajraladi; idishning sovuq devorida bug‘ suv tomchilari bo‘lib yig‘iladi.',
      equation: '2H₂ + O₂ → 2H₂O',
      note: 'Kadrdagi oltita atom — model; tajribada juda ko‘p molekulalar xuddi shu 2 : 1 nisbatda reaksiyaga kirishadi.',
      speak: 'Ikki molekula vodorod va bir molekula kislorod ikki molekula suv beradi. Atomlar yo‘qolmaydi — ular qayta joylashadi.',
    },
  },
  legend: {
    electron: 'tashqi qavat elektroni',
    sharedPair: 'umumiy elektron jufti — bog‘ (chiziqcha)',
    lonePair: 'taqsimlanmagan elektron jufti',
    unpaired: 'juftlashmagan elektron',
  },
  safety: 'Qaldiroq gaz portlovchi: tajribani faqat o‘qituvchi himoya ekrani ortida ko‘rsatadi. Yondirishdan oldin vodorod tozaligi tekshiriladi.',
}
