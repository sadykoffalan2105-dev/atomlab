import type { learnPathwayRu } from './learnPathwayRu'

/** O'zbek (lotin) pathway matnlari. */
export const learnPathwayUz: Record<keyof typeof learnPathwayRu, string> = {
  'learn.pathways.title': 'Laboratoriya yo\'llari',
  'learn.pathways.lead':
    'Bosqichma-bosqich senariy: kontekst → bashorat → materiallar → reaktorda protokol → natija → refleksiya. LabXchange kabi, ATOMLAB 3D bilan.',
  'learn.pathways.back': 'O\'qishga qaytish',
  'learn.pathways.open': 'Laboratoriya yo\'llari',
  'learn.pathways.estimated': '≈ {n} daqiqa',
  'learn.pathways.progress': '{done} / {total} vazifa',
  'learn.pathways.completed': 'Yo\'l tugallandi',
  'learn.pathways.continue': 'Davom etish',
  'learn.pathways.start': 'Yo\'lni boshlash',

  'learn.pathway.h2o.title': 'Suv sintezi',
  'learn.pathway.h2o.lead':
    'H₂ va O₂ dan H₂O hosil qilish: massa saqlanishi qonuni, muvozanatlash va reaktorda virtual sintez.',

  'learn.pathway.step.context': 'Kontekst',
  'learn.pathway.step.predictions': 'Bashorat',
  'learn.pathway.step.materials': 'Materiallar',
  'learn.pathway.step.protocol': 'Protokol',
  'learn.pathway.step.results': 'Natijalar',
  'learn.pathway.step.reflection': 'Refleksiya',
  'learn.pathway.step.summary': 'Xulosa',

  'learn.pathway.sidebar.title': 'Yo\'l progressi',
  'learn.pathway.sidebar.tasks': '{done} / {total}',
  'learn.pathway.nav.prev': 'Orqaga',
  'learn.pathway.nav.next': 'Keyingi',
  'learn.pathway.nav.finish': 'Bosqichni tugatish',

  'learn.pathway.context.title': 'Nega bu reaksiya?',
  'learn.pathway.context.body':
    '2H₂ + O₂ → 2H₂O — oddiy moddalarning birikishi uchun klassik misol. Vodorod va kislorod — gazlar; mahsulot — suyuq suv. Atomlar soni ikki tomonda ham teng bo\'lishi kerak.',
  'learn.pathway.context.equationLabel': 'Reaksiya tenglamasi',
  'learn.pathway.context.readDone': 'Kirishni o\'qidim',

  'learn.pathway.predictions.title': 'Bashorat qiling',
  'learn.pathway.predictions.q1': '2H₂ + O₂ → 2H₂O uchun qanday koeffitsientlar kerak?',
  'learn.pathway.predictions.q1.a1': '2, 1, 2',
  'learn.pathway.predictions.q1.a2': '1, 1, 1',
  'learn.pathway.predictions.q1.a3': '2, 2, 2',
  'learn.pathway.predictions.q2': 'Ikki mol H₂O da nechta vodorod atomi bor?',
  'learn.pathway.predictions.q2.a1': '4',
  'learn.pathway.predictions.q2.a2': '2',
  'learn.pathway.predictions.q2.a3': '6',
  'learn.pathway.predictions.correct': 'To\'g\'ri!',
  'learn.pathway.predictions.wrong': 'Yana urinib ko\'ring.',

  'learn.pathway.materials.title': 'Reagentlar va mahsulot',
  'learn.pathway.materials.h2': 'Vodorod H₂ — rangsiz gaz, yoqilg\'i.',
  'learn.pathway.materials.o2': 'Kislorod O₂ — yonish va oksidlanish uchun kerak bo\'lgan gaz.',
  'learn.pathway.materials.h2o': 'Suv H₂O — reaksiya mahsuloti.',
  'learn.pathway.materials.viewed': 'Reagentlar tarkibini o\'rgandim',

  'learn.pathway.protocol.title': 'Reaktorda protokol',
  'learn.pathway.protocol.lead':
    'ATOMLAB virtual laboratoriyasida uch qadamni bajaring. Reaktorni oching — tenglama va mahsulot oldindan kiritilgan.',
  'learn.pathway.protocol.check1': 'Tenglama bilan reaktorni ochdim',
  'learn.pathway.protocol.check2': 'Koeffitsientlarni muvozanatladim',
  'learn.pathway.protocol.check3': 'Sintezni ishga tushirdim va H₂O molekulasini ko\'rdim',
  'learn.pathway.protocol.openLab': 'Reaktorni ochish',

  'learn.pathway.results.title': 'Bashorat va natija',
  'learn.pathway.results.lead':
    'Bashoratingiz: 2–1–2 koeffitsientlar va H, O atomlarining saqlanishi. Sintezdan keyin suv molekulasini ko\'rishingiz kerak edi.',
  'learn.pathway.results.confirm': 'Reaktorda sintez muvaffaqiyatli o\'tdi',

  'learn.pathway.reflection.title': 'Qisqa refleksiya',
  'learn.pathway.reflection.q1': 'Nega sintezdan oldin tenglamani muvozanatlash kerak?',
  'learn.pathway.reflection.q1.a1': 'Har bir element atomlari soni saqlansin',
  'learn.pathway.reflection.q1.a2': 'Tenglama chiroyli ko\'rinsin',
  'learn.pathway.reflection.q2': 'Suv hosil bo\'lganda nima o\'zgardi?',
  'learn.pathway.reflection.q2.a1': 'Boshqa xossali yangi modda hosil bo\'ldi',
  'learn.pathway.reflection.q2.a2': 'Hech narsa — bu fizik aralashma',

  'learn.pathway.summary.title': 'Yo\'l tugallandi!',
  'learn.pathway.summary.body':
    'To\'liq tsiklni o\'tdingiz: kontekst, bashorat, materiallar, protokol, natija va refleksiya. Laboratoriyada sintezni takrorlang yoki 7-sinf mavzulariga o\'ting.',
  'learn.pathway.summary.badge': 'Suv sintezi',
  'learn.pathway.summary.toGrade': '7-sinf mavzulari',
  'learn.pathway.summary.toLab': 'Yana reaktorda',
}
