import type { vrLabRu } from './vrLabRu'

export const vrLabUz: Record<keyof typeof vrLabRu, string> = {
  'nav.vrLab': 'VR laboratoriya',

  'vrLab.title': 'VR 3D laboratoriya',
  'vrLab.lead':
    'Kolbalarni torting, katalogdan modda quying va reaktorda aralashtiring. Chann ustida: g\'ildirak yoki R — egish.',
  'vrLab.controlsHint': 'G\'ildirak / R — egish · cyan halqaga torting',
  'vrLab.backLab': 'Reaktorga qaytish',

  'vrLab.picker.title': 'Moddalar katalogi',
  'vrLab.picker.search': 'Formula yoki nom…',
  'vrLab.picker.starterOnly': 'Faqat tajriba uchun (reaksiya beradi)',
  'vrLab.picker.selected': 'Tanlandi: {formula}',

  'vrLab.tube.selected': 'Probirka {n}',
  'vrLab.shelf.selected': 'Kolba {n}',
  'vrLab.vat.selected': 'Aralashtirish reaktori',
  'vrLab.section.shelf': 'Kolbalar (1–10)',
  'vrLab.shelf.dragHint':
    'Kolbani stolga torting. Chann ustida: g\'ildirak yoki R — egish, qo\'yib yuboring.',
  'vrLab.shelf.onWall': 'Polkada',
  'vrLab.shelf.onBench': 'Stolda',
  'vrLab.vat.waitSecond': 'Chanda {formula} — ikkinchi reagent quying.',
  'vrLab.action.pourShelf': 'Kolbaga quyish',
  'vrLab.action.pourVat': 'Changa quyish',
  'vrLab.action.selectVat': 'Channi tanlash',
  'vrLab.action.emptyVat': 'Channi tozalash',
  'vrLab.action.emptyShelf': 'Kolbani bo\'shatish',
  'vrLab.action.empty': 'Hammasini tozalash',

  'vrLab.result.title': 'Natija',
  'vrLab.result.equation': 'Tenglama',
  'vrLab.result.none': 'Changa ikki xil reagent quying — kolba tanlang va «Changa quyish».',

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
  'vrLab.reaction.empty': 'Kolbalar bo\'sh — katalogdan reagent quying.',

  'vrLab.stats.reactions': 'Bazada {n} reaksiya',
  'vrLab.stats.colors': '{n} eritma rangi',
  'vrLab.stats.tier.high': 'Kino-grafika',
  'vrLab.stats.tier.medium': 'O\'rtacha sifat',
  'vrLab.stats.tier.low': 'Tejamkor rejim',
}
