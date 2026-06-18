import type { vrLabRu } from './vrLabRu'

export const vrLabUz: Record<keyof typeof vrLabRu, string> = {
  'nav.vrLab': 'VR laboratoriya',

  'vrLab.title': 'VR 3D laboratoriya',
  'vrLab.lead':
    'Virtual laboratoriya stoli: probirka, stakan, eritmalar aralashtirish va ko\'rinadigan reaksiyalar. Modda tanlang, probirkaga quying, 1+2 aralashtiring — natija stakanda.',
  'vrLab.backLab': 'Reaktorga qaytish',

  'vrLab.picker.title': 'Moddalar katalogi',
  'vrLab.picker.search': 'Formula yoki nom…',
  'vrLab.picker.starterOnly': 'Faqat tajriba uchun (reaksiya beradi)',
  'vrLab.picker.selected': 'Tanlandi: {formula}',

  'vrLab.tube.selected': 'Probirka {n}',
  'vrLab.action.pour': 'Probirkaga quyish',
  'vrLab.action.mix': '1 + 2 aralashtirish',
  'vrLab.action.empty': 'Stolni tozalash',
  'vrLab.action.emptyTube': 'Probirkani bo\'shatish',

  'vrLab.result.title': 'Natija',
  'vrLab.result.equation': 'Tenglama',
  'vrLab.result.none': '1 va 2 probirkalarga ikki xil reagent qo\'ying.',

  'vrLab.reaction.neutralization': 'Neytrallash — tuz va suv hosil bo\'ldi, issiqlik ajraldi.',
  'vrLab.reaction.hydration': 'Oksid gidratlanishi — asos yoki kislota hosil bo\'ldi.',
  'vrLab.reaction.gas': 'Gaz erishi — pufakchalar va rang o\'zgarishi.',
  'vrLab.reaction.co2': 'CO₂ ajralishi — kuchli ko\'piklanish!',
  'vrLab.reaction.catalysis': 'Katalitik parchalanish — faol gaz ajralishi.',
  'vrLab.reaction.dissolve': 'Cho\'kma erishi — eritma rangi o\'zgardi.',
  'vrLab.reaction.blueSolution': 'Ko\'k mis sulfat eritmasi hosil bo\'ldi.',
  'vrLab.reaction.yellowSolution': 'Sariq tusli temir(III) xlorid eritmasi.',
  'vrLab.reaction.whiteFume': 'Oq NH₄Cl tutuni.',
  'vrLab.reaction.precipitate': 'Cho\'kma hosil bo\'ldi.',
  'vrLab.reaction.noReaction': 'Ko\'rinadigan reaksiya yo\'q.',
  'vrLab.reaction.unlistedAcidBase': 'Kislota va asos aralashdi — neytrallash mumkin.',
  'vrLab.reaction.same': 'Bir xil moddalar — yangi reaksiya yo\'q.',
  'vrLab.reaction.empty': 'Probirkalar bo\'sh — reagent qo\'shing.',

  'vrLab.stats.reactions': 'Bazada {n} reaksiya',
  'vrLab.stats.colors': '{n} eritma rangi',
}
