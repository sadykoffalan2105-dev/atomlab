/**
 * Тривиальные названия учебника Kimyo 10–11 (синонимы к систематическим).
 * Ключ — SMILES, сравнение — по канонической форме (индекс строится лениво при первом вызове).
 * Формат: SMILES, RU (первое — главное), EN, UZ.
 */
import type { Mol } from './graph'
import { canonicalizeMol } from './canonical'
import { parseSmiles } from './smiles'
import { toMol } from './graph'

type Entry = readonly [smiles: string, ru: readonly string[], en: readonly string[], uz: readonly string[]]

const T: readonly Entry[] = [
  ['C=C', ['Этилен', 'Этен'], ['Ethylene', 'Ethene'], ['Etilen', 'Eten']],
  ['C#C', ['Ацетилен', 'Этин'], ['Acetylene', 'Ethyne'], ['Asetilen', 'Etin']],
  ['C=CC=C', ['Дивинил', 'Бутадиен-1,3'], ['Butadiene'], ['Divinil']],
  ['C=CC(C)=C', ['Изопрен', '2-Метилбутадиен-1,3'], ['Isoprene'], ['Izopren']],
  ['C=C=C', ['Аллен', 'Пропадиен'], ['Allene', 'Propadiene'], ['Allen']],
  ['C=CC(Cl)=C', ['Хлоропрен'], ['Chloroprene'], ['Xloropren']],
  ['C#CC=C', ['Винилацетилен'], ['Vinylacetylene'], ['Vinilatsetilen']],
  ['C=CCl', ['Винилхлорид', 'Хлорвинил'], ['Vinyl chloride'], ['Vinilxlorid']],
  ['ClC(Cl)Cl', ['Хлороформ', 'Трихлорметан'], ['Chloroform'], ['Xloroform']],
  ['IC(I)I', ['Иодоформ'], ['Iodoform'], ['Yodoform']],
  ['ClCCl', ['Дихлорметан', '~Метиленхлорид'], ['Dichloromethane'], ['Dixlormetan']],
  ['ClC(Cl)(Cl)Cl', ['Тетрахлорметан', 'Четырёххлористый углерод'], ['Tetrachloromethane'], ['Tetraxlormetan']],
  ['C1=CC=CC=C1', ['Бензол'], ['Benzene'], ['Benzol']],
  ['CC1=CC=CC=C1', ['Толуол', 'Метилбензол'], ['Toluene', 'Methylbenzene'], ['Toluol']],
  ['C=CC1=CC=CC=C1', ['Стирол', 'Винилбензол'], ['Styrene'], ['Stirol']],
  ['CC1=CC=CC=C1C', ['о-Ксилол', '1,2-Диметилбензол'], ['o-Xylene'], ['o-Ksilol']],
  ['CC1=CC=CC(C)=C1', ['м-Ксилол', '1,3-Диметилбензол'], ['m-Xylene'], ['m-Ksilol']],
  ['CC1=CC=C(C)C=C1', ['п-Ксилол', '1,4-Диметилбензол'], ['p-Xylene'], ['p-Ksilol']],
  ['CC(C)C1=CC=CC=C1', ['Кумол', 'Изопропилбензол'], ['Cumene'], ['Kumol']],
  ['C=CC1=CC=C(C=C)C=C1', ['Дивинилбензол'], ['Divinylbenzene'], ['Divinilbenzol']],
  ['C1=CC=C(C=C1)C1=CC=CC=C1', ['Дифенил', 'Бифенил'], ['Biphenyl'], ['Difenil']],
  ['C1=CC=C(C=C1)CC1=CC=CC=C1', ['Дифенилметан'], ['Diphenylmethane'], ['Difenilmetan']],
  ['C1=CC=C(C=C1)C(C1=CC=CC=C1)C1=CC=CC=C1', ['Трифенилметан'], ['Triphenylmethane'], ['Trifenilmetan']],
  ['c1ccc2ccccc2c1', ['Нафталин'], ['Naphthalene'], ['Naftalin']],
  ['c1ccc2cc3ccccc3cc2c1', ['Антрацен'], ['Anthracene'], ['Antratsen']],
  ['C1C2CC3CC1CC(C2)C3', ['Адамантан'], ['Adamantane'], ['Adamantan']],
  ['ClC1C(Cl)C(Cl)C(Cl)C(Cl)C1Cl', ['Гексахлорциклогексан', 'Гексахлоран'], ['Hexachlorocyclohexane'], ['Geksaxlorsiklogeksan']],
  ['CC(C)CC(C)(C)C', ['Изооктан', '2,2,4-Триметилпентан'], ['Isooctane'], ['Izooktan']],
  ['Oc1ccccc1', ['Фенол'], ['Phenol'], ['Fenol']],
  ['OCCO', ['Этиленгликоль', 'Этандиол-1,2'], ['Ethylene glycol'], ['Etilenglikol']],
  ['OCC(O)CO', ['Глицерин', 'Пропантриол-1,2,3'], ['Glycerol'], ['Glitserin']],
  ['C=O', ['Формальдегид', 'Метаналь'], ['Formaldehyde', 'Methanal'], ['Formaldegid']],
  ['CC=O', ['Уксусный альдегид', 'Ацетальдегид', 'Этаналь'], ['Acetaldehyde', 'Ethanal'], ['Sirka aldegidi', 'Etanal']],
  ['CCC=O', ['~Пропионовый альдегид'], ['Propionaldehyde'], ['Propion aldegid']],
  ['CCCC=O', ['~Масляный альдегид'], ['Butyraldehyde'], ['Moy aldegidi']],
  ['CC(C)C=O', ['~Изомасляный альдегид'], ['Isobutyraldehyde'], ['Izomoy aldegidi']],
  ['O=Cc1ccccc1', ['Бензальдегид'], ['Benzaldehyde'], ['Benzaldegid']],
  ['CC(C)=O', ['Ацетон', 'Пропанон'], ['Acetone', 'Propanone'], ['Aseton']],
  ['CCC(=O)CC', ['~Диэтилкетон'], ['Diethyl ketone'], ['Dietilketon']],
  ['CCCC(C)=O', ['~Метилпропилкетон'], ['Methyl propyl ketone'], ['Metilpropilketon']],
  ['CC(=O)c1ccccc1', ['Ацетофенон'], ['Acetophenone'], ['Atsetofenon']],
  ['O=C(c1ccccc1)c1ccccc1', ['Бензофенон'], ['Benzophenone'], ['Benzofenon']],
  ['CC(=O)C(C)=O', ['Диацетил'], ['Diacetyl'], ['Diatsetil']],
  ['CC(=O)CC(C)=O', ['Ацетилацетон'], ['Acetylacetone'], ['Atsetilatseton']],
  ['OC=O', ['Муравьиная кислота', 'Метановая кислота'], ['Formic acid'], ['Chumoli kislota']],
  ['CC(O)=O', ['Уксусная кислота', 'Этановая кислота'], ['Acetic acid'], ['Sirka kislota']],
  ['CCC(O)=O', ['Пропионовая кислота'], ['Propionic acid'], ['Propion kislota']],
  ['CCCC(O)=O', ['Масляная кислота'], ['Butyric acid'], ['Moy kislota']],
  ['CCCCC(O)=O', ['Валериановая кислота'], ['Valeric acid'], ['Valerian kislota']],
  ['CCCCCC(O)=O', ['Капроновая кислота'], ['Caproic acid'], ['Kapron kislota']],
  ['CCCCCCCCCCCCCCCC(O)=O', ['Пальмитиновая кислота'], ['Palmitic acid'], ['Palmitin kislota']],
  ['CCCCCCCCCCCCCCCCC(O)=O', ['Маргариновая кислота'], ['Margaric acid'], ['Margarin kislota']],
  ['CCCCCCCCCCCCCCCCCC(O)=O', ['Стеариновая кислота'], ['Stearic acid'], ['Stearin kislota']],
  ['CCCCCCC=CCCCCCCCC(O)=O', ['Пальмитолеиновая кислота'], ['Palmitoleic acid'], ['Palmitolein kislota']],
  ['CCCCCCCCC=CCCCCCCCC(O)=O', ['Олеиновая кислота'], ['Oleic acid'], ['Olein kislota']],
  ['CCCCCC=CCC=CCCCCCCCC(O)=O', ['Линолевая кислота'], ['Linoleic acid'], ['Linol kislota']],
  ['CCC=CCC=CCC=CCCCCCCCC(O)=O', ['Линоленовая кислота'], ['Linolenic acid'], ['Linolen kislota']],
  ['OC(=O)CCl', ['Хлоруксусная кислота'], ['Chloroacetic acid'], ['Xlorsirka kislota']],
  ['OC(=O)C(Cl)Cl', ['Дихлоруксусная кислота'], ['Dichloroacetic acid'], ['Dixlorsirka kislota']],
  ['OC(=O)C(Cl)(Cl)Cl', ['Трихлоруксусная кислота'], ['Trichloroacetic acid'], ['Trixlorsirka kislota']],
  ['OC(=O)C(O)=O', ['Щавелевая кислота'], ['Oxalic acid'], ['Oksalat kislota']],
  ['OC(=O)CCC(O)=O', ['Янтарная кислота'], ['Succinic acid'], ['Qahrabo kislota']],
  ['OC(=O)CCCCC(O)=O', ['Адипиновая кислота'], ['Adipic acid'], ['Adipin kislota']],
  ['OC(=O)CC(O)C(O)=O', ['Яблочная кислота'], ['Malic acid'], ['Olma kislota']],
  ['OC(=O)CC(O)(CC(O)=O)C(O)=O', ['Лимонная кислота'], ['Citric acid'], ['Limon kislota']],
  ['CC(=O)CCC(O)=O', ['Левулиновая кислота'], ['Levulinic acid'], ['Levulin kislota']],
  ['OC(=O)c1ccccc1', ['Бензойная кислота'], ['Benzoic acid'], ['Benzoy kislota']],
  ['OC(=O)c1ccc(cc1)C(O)=O', ['Терефталевая кислота'], ['Terephthalic acid'], ['Tereftal kislota']],
  ['OC(=O)c1ccccc1O', ['Салициловая кислота'], ['Salicylic acid'], ['Salitsil kislota']],
  ['CC(=O)Oc1ccccc1C(O)=O', ['Ацетилсалициловая кислота', 'Аспирин'], ['Acetylsalicylic acid', 'Aspirin'], ['Atsetilsalitsil kislota']],
  ['OCC(O)C1OC(=O)C(O)=C1O', ['Аскорбиновая кислота', 'Витамин C'], ['Ascorbic acid'], ['Askorbin kislota']],
  ['OCC(O)C(O)C(O)C(O)C(O)=O', ['Глюконовая кислота'], ['Gluconic acid'], ['Glyukon kislota']],
  ['OS(=O)(=O)c1ccccc1', ['Бензолсульфокислота'], ['Benzenesulfonic acid'], ['Benzolsulfokislota']],
  ['CCOS(=O)(=O)O', ['Этилсерная кислота'], ['Ethyl hydrogen sulfate'], ['Etilsulfat kislota']],
  ['CCO[N+](=O)[O-]', ['Этилнитрат'], ['Ethyl nitrate'], ['Etilnitrat']],
  ['O=[N+]([O-])OCC(CO[N+](=O)[O-])O[N+](=O)[O-]', ['Тринитроглицерин', 'Нитроглицерин'], ['Nitroglycerin'], ['Nitroglitserin']],
  ['CC(=O)OC(C)=O', ['Уксусный ангидрид'], ['Acetic anhydride'], ['Sirka angidridi']],
  ['CC(=O)OCC(COC(C)=O)OC(C)=O', ['Триацетин'], ['Triacetin'], ['Triatsetin']],
  ['CCCCCCCCCCCCCCCCCC(=O)OCC(COC(=O)CCCCCCCCCCCCCCCCC)OC(=O)CCCCCCCCCCCCCCCCC', ['Тристеарин'], ['Tristearin'], ['Tristearin']],
  ['CCCCCCCCCCCCCCCC(=O)OCC(COC(=O)CCCCCCCCCCCCCCC)OC(=O)CCCCCCCCCCCCCCC', ['Трипальмитин'], ['Tripalmitin'], ['Tripalmitin']],
  ['CCCCCCCCC=CCCCCCCCC(=O)OCC(COC(=O)CCCCCCCC=CCCCCCCCC)OC(=O)CCCCCCCC=CCCCCCCCC', ['Триолеин'], ['Triolein'], ['Triolein']],
  ['COc1ccccc1', ['Анизол', 'Метилфениловый эфир'], ['Anisole'], ['Anizol']],
  ['C1COCCO1', ['1,4-Диоксан'], ['1,4-Dioxane'], ['1,4-Dioksan']],
  ['C1CO1', ['Этиленоксид', 'Оксиран'], ['Ethylene oxide', 'Oxirane'], ['Etilenoksid']],
  ['OCc1ccccc1', ['Бензиловый спирт'], ['Benzyl alcohol'], ['Benzil spirt']],
  ['ClCc1ccccc1', ['Бензилхлорид'], ['Benzyl chloride'], ['Benzilxlorid']],
  ['C=CCO', ['Аллиловый спирт'], ['Allyl alcohol'], ['Allil spirt']],
  ['C=CO', ['Виниловый спирт'], ['Vinyl alcohol'], ['Vinil spirt']],
  ['OCC=Cc1ccccc1', ['Коричный спирт'], ['Cinnamyl alcohol'], ['Dolchin spirti']],
  ['C=CCc1ccc(O)c(OC)c1', ['Эвгенол'], ['Eugenol'], ['Evgenol']],
  ['O=C1OC(c2ccc(O)cc2)(c2ccc(O)cc2)c2ccccc21', ['Фенолфталеин'], ['Phenolphthalein'], ['Fenolftalein']],
  ['CC(C=CC=C(C)C=CC1=C(C)CCCC1(C)C)=CC=CC=C(C)C=CC=C(C)C=CC1=C(C)CCCC1(C)C', ['β-Каротин'], ['β-Carotene'], ['β-Karotin']],
  ['CC(O)CC=O', ['~Альдоль'], ['Aldol'], ['Aldol']],
  ['CCCCCCCCC=CCCCCCCCC(=O)OCC(COC(=O)CCCCCCCC=CCCCCCCCC)OC(=O)CCCCCCCCCCCCCCCCC', ['1,3-Диолеоил-2-стеароилглицерин'], ['1,3-Dioleoyl-2-stearoylglycerol'], ['1,3-Dioleoil-2-stearoilglitserin']],
  ['CCCCCCCCC=CCCCCCCCC(=O)OCC(COC(=O)CCCCCCCCCCCCCCCCC)OC(=O)CCCCCCCCCCCCCCC', ['Стеаропальмитоолеин'], ['Stearopalmitoolein'], ['Stearopalmitoolein']],
  ['CCCCCCCCCCCCCCCCCC(=O)OCC(COC(=O)CCCCCCCCCCCCCCCCC)OC(=O)CCCCCCCCCCCCCCC', ['Дистеаропальмитин'], ['Distearopalmitin'], ['Distearopalmitin']],
  ['CC(C)(C)O', ['~трет-Бутиловый спирт'], ['tert-Butanol'], ['Uchlamchi butil spirti']],
  ['CC(C)O', ['~Изопропиловый спирт'], ['Isopropanol'], ['Izopropil spirti']],
  ['CO', ['~Метиловый спирт'], ['Methyl alcohol'], ['Metil spirti']],
  ['CCO', ['~Этиловый спирт'], ['Ethyl alcohol'], ['Etil spirti']],
]

let index: Map<string, { ru: string[]; en: string[]; uz: string[] }> | null = null

function build(): Map<string, { ru: string[]; en: string[]; uz: string[] }> {
  const idx = new Map<string, { ru: string[]; en: string[]; uz: string[] }>()
  for (const [s, ru, en, uz] of T) {
    if (!ru.length) continue
    const code = canonicalizeMol(toMol(parseSmiles(s))).smiles
    const prev = idx.get(code)
    if (prev) { prev.ru.push(...ru); prev.en.push(...en); prev.uz.push(...uz) } else idx.set(code, { ru: [...ru], en: [...en], uz: [...uz] })
  }
  return idx
}

/**
 * Тривиальные названия (RU/EN/UZ) для молекулы или null. `primary` — тривиальные, которые учебник ставит первыми
 * (бензол, ацетон…); `secondary` — после систематического (метиловый спирт → «Метанол» главное). Цис/транс не учитывается (олеиновая — цис). */
export function trivialNamesFor(m: Mol): { ru: string[]; en: string[]; uz: string[] } | null {
  if (!index) index = build()
  const plain: Mol = { ...m, stereo: new Map() }
  return index.get(canonicalizeMol(plain).smiles) ?? null
}
