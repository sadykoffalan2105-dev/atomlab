// Генерирует src/data/organicLab/textbookOrganic.data.ts — органические молекулы из учебников «Химия» 7–11,
// которых не было в каталоге. Структура задаётся упрощённым SMILES (C, O, N, Cl; формы Кекуле; циклы цифрами),
// брутто-формула сверяется с формулой из учебника, граф проверяется на валентность.
// Запуск: npx tsx scripts/textbook-inventory/gen-textbook-organic.mts
import fs from 'node:fs'
import path from 'node:path'
import { parseComposition } from './formula.mts'
import {
  applySkeletonBonds,
  autoBondKitHydrogens,
  createFormulaKit,
  valenceErrors,
  type OrganicElement,
} from '../../src/chemistry/organic/organicGraph'
import { ORGANIC_CLASS_LABELS, type OrganicClassId } from '../../src/data/researchLab/organicBuildCatalog'

// [id, SMILES, название, English, псевдонимы в учебнике через |, класс (если авто не подходит)]
type Entry = [string, string, string, string, string?, OrganicClassId?]
const alkane = (n: number) => 'C'.repeat(n)
const ENTRIES: Entry[] = [
  ['propanoic-acid', 'CCC(=O)O', 'Пропановая кислота', 'Propanoic acid', 'пропионовая кислота'],
  ['propan-2-ol', 'CC(O)C', 'Пропанол-2', 'Propan-2-ol', 'изопропиловый спирт'],
  ['butan-2-ol', 'CCC(O)C', 'Бутанол-2', 'Butan-2-ol'],
  ['tert-butanol', 'CC(C)(C)O', '2-Метилпропанол-2', '2-Methylpropan-2-ol', 'третичный спирт|трет-бутиловый спирт'],
  ['pentan-1-ol', 'CCCCCO', 'Пентанол-1', 'Pentan-1-ol', 'пентанол'],
  ['hex-1-ene', 'C=CCCCC', 'Гексен-1', 'Hex-1-ene', 'гексен'],
  ['pent-1-ene', 'C=CCCC', 'Пентен-1', 'Pent-1-ene', 'пентен'],
  ['pent-2-ene', 'CC=CCC', 'Пентен-2', 'Pent-2-ene'],
  ['but-1-ene', 'C=CCC', 'Бутен-1', 'But-1-ene'],
  ['but-2-ene', 'CC=CC', 'Бутен-2', 'But-2-ene'],
  ['isobutylene', 'C=C(C)C', '2-Метилпропен', '2-Methylpropene', 'изобутилен|2-метилпропен-1'],
  ['3-methylbut-1-ene', 'C=CC(C)C', '3-Метилбутен-1', '3-Methylbut-1-ene'],
  ['2-methylbut-1-ene', 'C=C(C)CC', '2-Метилбутен-1', '2-Methylbut-1-ene'],
  ['2-methylbut-2-ene', 'CC(C)=CC', '2-Метилбутен-2', '2-Methylbut-2-ene'],
  ['2-methylpent-2-ene', 'CC(C)=CCC', '2-Метилпентен-2', '2-Methylpent-2-ene'],
  ['2-3-dimethylbut-2-ene', 'CC(C)=C(C)C', '2,3-Диметилбутен-2', '2,3-Dimethylbut-2-ene'],
  ['4-4-dimethylpent-2-ene', 'CC=CC(C)(C)C', '4,4-Диметилпентен-2', '4,4-Dimethylpent-2-ene'],
  ['2-2-dimethylhept-3-ene', 'CC(C)(C)C=CCCC', '2,2-Диметилгептен-3', '2,2-Dimethylhept-3-ene'],
  ['3-3-dimethylpent-1-ene', 'C=CC(C)(C)CC', '3,3-Диметилпентен-1', '3,3-Dimethylpent-1-ene'],
  ['3-3-dimethylbut-1-ene', 'C=CC(C)(C)C', '3,3-Диметилбутен-1', '3,3-Dimethylbut-1-ene'],
  ['3-4-dimethylpent-1-ene', 'C=CC(C)C(C)C', '3,4-Диметилпентен-1', '3,4-Dimethylpent-1-ene'],
  ['propadiene', 'C=C=C', 'Пропадиен', 'Propadiene'],
  ['buta-1-2-diene', 'C=C=CC', 'Бутадиен-1,2', 'Buta-1,2-diene'],
  ['penta-1-2-diene', 'C=C=CCC', 'Пентадиен-1,2', 'Penta-1,2-diene'],
  ['penta-1-3-diene', 'C=CC=CC', 'Пентадиен-1,3', 'Penta-1,3-diene'],
  ['penta-1-4-diene', 'C=CCC=C', 'Пентадиен-1,4', 'Penta-1,4-diene'],
  ['hexa-1-5-diene', 'C=CCCC=C', 'Гексадиен-1,5', 'Hexa-1,5-diene'],
  ['3-methylhexa-1-5-diene', 'C=CC(C)CC=C', '3-Метилгексадиен-1,5', '3-Methylhexa-1,5-diene'],
  ['3-methylbuta-1-2-diene', 'C=C=C(C)C', '3-Метилбутадиен-1,2', '3-Methylbuta-1,2-diene'],
  ['3-5-dimethylhexa-1-3-diene', 'C=CC(C)=CC(C)C', '3,5-Диметилгексадиен-1,3', '3,5-Dimethylhexa-1,3-diene'],
  ['chloroprene', 'C=C(Cl)C=C', '2-Хлорбутадиен-1,3 (хлоропрен)', 'Chloroprene', '2-хлорбутадиен-1,3'],
  ['but-1-yne', 'C#CCC', 'Бутин-1', 'But-1-yne', 'этилацетилен'],
  ['but-2-yne', 'CC#CC', 'Бутин-2', 'But-2-yne', 'диметилацетилен'],
  ['pent-1-yne', 'C#CCCC', 'Пентин-1', 'Pent-1-yne', 'пентин|пропилацетилен'],
  ['pent-2-yne', 'CC#CCC', 'Пентин-2', 'Pent-2-yne'],
  ['3-methylbut-1-yne', 'C#CC(C)C', '3-Метилбутин-1', '3-Methylbut-1-yne'],
  ['hex-1-yne', 'C#CCCCC', 'Гексин-1', 'Hex-1-yne', 'бутилацетилен'],
  ['3-3-dimethylbut-1-yne', 'C#CC(C)(C)C', '3,3-Диметилбутин-1', '3,3-Dimethylbut-1-yne'],
  ['vinylacetylene', 'C=CC#C', 'Винилацетилен', 'Vinylacetylene'],
  ['4-ethyl-5-5-6-trimethylhept-2-yne', 'CC#CC(CC)C(C)(C)C(C)C', '4-Этил-5,5,6-триметилгептин-2', '4-Ethyl-5,5,6-trimethylhept-2-yne'],
  ['n-heptane', alkane(7), 'Гептан', 'Heptane'],
  ['n-octane', alkane(8), 'Октан', 'Octane', 'н-октан'],
  ['n-nonane', alkane(9), 'Нонан', 'Nonane'],
  ['n-decane', alkane(10), 'Декан', 'Decane'],
  ['n-undecane', alkane(11), 'Ундекан', 'Undecane'],
  ['n-dodecane', alkane(12), 'Додекан', 'Dodecane'],
  ['n-tridecane', alkane(13), 'Тридекан', 'Tridecane'],
  ['n-tetradecane', alkane(14), 'Тетрадекан', 'Tetradecane'],
  ['n-hexadecane', alkane(16), 'Гексадекан', 'Hexadecane'],
  ['n-octadecane', alkane(18), 'Октадекан', 'Octadecane'],
  ['n-nonadecane', alkane(19), 'Нонадекан', 'Nonadecane'],
  ['n-pentacosane', alkane(25), 'Пентакозан', 'Pentacosane'],
  ['n-octacosane', alkane(28), 'Октакозан', 'Octacosane'],
  ['n-dotriacontane', alkane(32), 'Дотриаконтан', 'Dotriacontane', 'алкан с 32 атомами углерода'],
  ['n-pentatriacontane', alkane(35), 'Пентатриаконтан', 'Pentatriacontane'],
  ['n-octatriacontane', alkane(38), 'Октатриаконтан', 'Octatriacontane'],
  ['isooctane', 'CC(C)(C)CC(C)C', '2,2,4-Триметилпентан (изооктан)', 'Isooctane', 'изооктан'],
  ['2-methylhexane', 'CC(C)CCCC', '2-Метилгексан', '2-Methylhexane'],
  ['2-2-dimethylpentane', 'CC(C)(C)CCC', '2,2-Диметилпентан', '2,2-Dimethylpentane'],
  ['2-3-dimethylpentane', 'CC(C)C(C)CC', '2,3-Диметилпентан', '2,3-Dimethylpentane'],
  ['2-4-dimethylpentane', 'CC(C)CC(C)C', '2,4-Диметилпентан', '2,4-Dimethylpentane'],
  ['3-3-dimethylpentane', 'CCC(C)(C)CC', '3,3-Диметилпентан', '3,3-Dimethylpentane'],
  ['3-ethylpentane', 'CCC(CC)CC', '3-Этилпентан', '3-Ethylpentane'],
  ['2-3-dimethylhexane', 'CC(C)C(C)CCC', '2,3-Диметилгексан', '2,3-Dimethylhexane'],
  ['2-3-5-trimethylhexane', 'CC(C)C(C)CC(C)C', '2,3,5-Триметилгексан', '2,3,5-Trimethylhexane'],
  ['3-methyl-4-ethylhexane', 'CCC(C)C(CC)CC', '3-Метил-4-этилгексан', '3-Methyl-4-ethylhexane'],
  ['tetraethylmethane', 'CCC(CC)(CC)CC', '3,3-Диэтилпентан (тетраэтилметан)', '3,3-Diethylpentane', 'тетраэтилметан'],
  ['dimethyldibutylmethane', 'CCCCC(C)(C)CCCC', '5,5-Диметилнонан (диметилдибутилметан)', '5,5-Dimethylnonane', 'диметилдибутилметан'],
  ['methylcyclohexane', 'CC1CCCCC1', 'Метилциклогексан', 'Methylcyclohexane'],
  ['1-2-dimethylcyclopentane', 'CC1CCCC1C', '1,2-Диметилциклопентан', '1,2-Dimethylcyclopentane'],
  ['1-methyl-3-ethylcyclopentane', 'CCC1CCC(C)C1', '1-Метил-3-этилциклопентан', '1-Methyl-3-ethylcyclopentane'],
  ['cyclodecane', 'C1CCCCCCCCC1', 'Циклодекан', 'Cyclodecane'],
  ['ethylbenzene', 'CCC1=CC=CC=C1', 'Этилбензол', 'Ethylbenzene'],
  ['o-xylene', 'CC1=CC=CC=C1C', 'о-Ксилол (1,2-диметилбензол)', 'o-Xylene', '1,2-диметилбензол|о-ксилол'],
  ['cumene', 'CC(C)C1=CC=CC=C1', 'Изопропилбензол (кумол)', 'Cumene', 'кумол|изопропилбензол'],
  ['divinylbenzene', 'C=CC1=CC=C(C=C)C=C1', 'Дивинилбензол', 'Divinylbenzene'],
  ['naphthalene', 'C1=CC=C2C=CC=CC2=C1', 'Нафталин', 'Naphthalene'],
  ['anthracene', 'C1=CC=C2C=C3C=CC=CC3=CC2=C1', 'Антрацен', 'Anthracene'],
  ['biphenyl', 'C1=CC=C(C=C1)C2=CC=CC=C2', 'Дифенил', 'Biphenyl'],
  ['diphenylmethane', 'C(C1=CC=CC=C1)C2=CC=CC=C2', 'Дифенилметан', 'Diphenylmethane'],
  ['triphenylmethane', 'C(C1=CC=CC=C1)(C2=CC=CC=C2)C3=CC=CC=C3', 'Трифенилметан', 'Triphenylmethane'],
  ['beta-carotene', 'CC1=C(C(C)(C)CCC1)C=CC(C)=CC=CC(C)=CC=CC=C(C)C=CC=C(C)C=CC2=C(C)CCCC2(C)C', 'β-Каротин', 'beta-Carotene'],
  ['dichloromethane', 'ClCCl', 'Дихлорметан', 'Dichloromethane'],
  ['chloroform', 'ClC(Cl)Cl', 'Хлороформ (трихлорметан)', 'Chloroform', 'хлороформ|трихлорметан'],
  ['1-1-dichloroethane', 'CC(Cl)Cl', '1,1-Дихлорэтан', '1,1-Dichloroethane'],
  ['1-2-dichloroethane', 'ClCCCl', '1,2-Дихлорэтан', '1,2-Dichloroethane'],
  ['1-chloropropane', 'CCCCl', '1-Хлорпропан', '1-Chloropropane', 'хлорпропан'],
  ['2-chloropropane', 'CC(Cl)C', '2-Хлорпропан', '2-Chloropropane'],
  ['2-2-dichloropropane', 'CC(C)(Cl)Cl', '2,2-Дихлорпропан', '2,2-Dichloropropane'],
  ['1-2-3-trichloropropane', 'ClCC(Cl)CCl', '1,2,3-Трихлорпропан', '1,2,3-Trichloropropane', 'трихлоргидрин'],
  ['1-chlorobutane', 'ClCCCC', '1-Хлорбутан', '1-Chlorobutane'],
  ['2-chlorobutane', 'CC(Cl)CC', '2-Хлорбутан', '2-Chlorobutane'],
  ['3-chloro-3-methylpentane', 'CCC(C)(Cl)CC', '3-Хлор-3-метилпентан', '3-Chloro-3-methylpentane'],
  ['vinyl-chloride', 'C=CCl', 'Винилхлорид', 'Vinyl chloride'],
  ['chlorocyclohexane', 'ClC1CCCCC1', 'Хлорциклогексан', 'Chlorocyclohexane'],
  ['hexachlorocyclohexane', 'ClC1C(Cl)C(Cl)C(Cl)C(Cl)C1Cl', 'Гексахлорциклогексан', 'Hexachlorocyclohexane'],
  ['chlorobenzene', 'ClC1=CC=CC=C1', 'Хлорбензол', 'Chlorobenzene'],
  ['benzyl-chloride', 'ClCC1=CC=CC=C1', 'Бензилхлорид', 'Benzyl chloride', 'хлористый бензил'],
  ['cyclohexanol', 'OC1CCCCC1', 'Циклогексанол', 'Cyclohexanol'],
  ['benzyl-alcohol', 'OCC1=CC=CC=C1', 'Бензиловый спирт', 'Benzyl alcohol'],
  ['2-phenylethanol', 'OCCC1=CC=CC=C1', '2-Фенилэтанол', '2-Phenylethanol', 'фенэтиловый спирт'],
  ['3-phenylpropanol', 'OCCCC1=CC=CC=C1', '3-Фенилпропанол-1', '3-Phenylpropan-1-ol', 'фенилпропиловый спирт'],
  ['1-phenylethanol', 'CC(O)C1=CC=CC=C1', '1-Фенилэтанол', '1-Phenylethanol', 'α-гидроксиэтилбензол'],
  ['2-phenylpropan-1-ol', 'OCC(C)C1=CC=CC=C1', '2-Фенилпропанол-1', '2-Phenylpropan-1-ol'],
  ['1-phenylbutan-1-ol', 'CCCC(O)C1=CC=CC=C1', '1-Фенилбутанол-1', '1-Phenylbutan-1-ol'],
  ['2-methyl-1-phenylpropan-2-ol', 'CC(C)(O)CC1=CC=CC=C1', '2-Метил-1-фенилпропанол-2', '2-Methyl-1-phenylpropan-2-ol'],
  ['cinnamyl-alcohol', 'OCC=CC1=CC=CC=C1', 'Коричный спирт', 'Cinnamyl alcohol', 'циннамильный спирт'],
  ['pent-2-en-1-ol', 'CCC=CCO', 'Пентен-2-ол-1', 'Pent-2-en-1-ol', 'пент-2-ен-1-ол'],
  ['6-ethyl-4-methyl-3-chlorononan-4-ol', 'CCC(Cl)C(C)(O)CC(CC)CCC', '6-Этил-4-метил-3-хлорнонанол-4', '6-Ethyl-4-methyl-3-chlorononan-4-ol'],
  ['butane-1-3-diol', 'CC(O)CCO', 'Бутандиол-1,3', 'Butane-1,3-diol'],
  ['butane-1-2-diol', 'OCC(O)CC', 'Бутандиол-1,2', 'Butane-1,2-diol', '1,2-бутиленгликоль'],
  ['5-6-dimethyloctane-3-5-diol', 'CCC(O)CC(C)(O)C(C)CC', '5,6-Диметилоктандиол-3,5', '5,6-Dimethyloctane-3,5-diol'],
  ['butane-1-2-4-triol', 'OCC(O)CCO', 'Бутантриол-1,2,4', 'Butane-1,2,4-triol', '1,2,4-бутантриол'],
  ['pentaerythritol', 'OCC(CO)(CO)CO', 'Пентаэритрит', 'Pentaerythritol'],
  ['1-phenylethane-1-2-diol', 'OCC(O)C1=CC=CC=C1', '1-Фенилэтиленгликоль', '1-Phenylethane-1,2-diol'],
  ['xylitol', 'OCC(O)C(O)C(O)CO', 'Ксилит', 'Xylitol'],
  ['sorbitol', 'OCC(O)C(O)C(O)C(O)CO', 'Сорбит', 'Sorbitol', 'сорбит|глюцит'],
  ['o-cresol', 'CC1=CC=CC=C1O', 'о-Крезол', 'o-Cresol', 'орто-крезол'],
  ['hydroquinone', 'OC1=CC=C(O)C=C1', 'Гидрохинон', 'Hydroquinone'],
  ['pyrogallol', 'OC1=CC=CC(O)=C1O', 'Пирогаллол', 'Pyrogallol'],
  ['2-4-6-trimethylphenol', 'CC1=CC(C)=C(O)C(C)=C1', '2,4,6-Триметилфенол', '2,4,6-Trimethylphenol'],
  ['salicyl-alcohol', 'OCC1=CC=CC=C1O', 'о-Гидроксибензиловый спирт', 'Salicyl alcohol'],
  ['dihydroxydiphenylmethane', 'OC1=CC=CC=C1CC2=CC=CC=C2O', 'Дигидроксидифенилметан', 'Dihydroxydiphenylmethane'],
  ['guaiacol', 'COC1=CC=CC=C1O', 'Гваякол', 'Guaiacol'],
  ['eugenol', 'COC1=C(O)C=CC(CC=C)=C1', 'Эвгенол', 'Eugenol'],
  ['phenolphthalein', 'O=C1OC(C2=CC=CC=C12)(C3=CC=C(O)C=C3)C4=CC=C(O)C=C4', 'Фенолфталеин', 'Phenolphthalein'],
  ['ethylene-oxide', 'C1CO1', 'Оксид этилена', 'Ethylene oxide', 'окись этилена'],
  ['1-4-dioxane', 'C1COCCO1', '1,4-Диоксан', '1,4-Dioxane', 'диоксан'],
  ['methoxyethane', 'COCC', 'Метилэтиловый эфир (метоксиэтан)', 'Methoxyethane', 'метил-этиловый эфир|метоксиэтан'],
  ['methyl-propyl-ether', 'COCCC', 'Метилпропиловый эфир', 'Methyl propyl ether', 'метил-пропиловый эфир'],
  ['divinyl-ether', 'C=COC=C', 'Дивиниловый эфир', 'Divinyl ether'],
  ['anisole', 'COC1=CC=CC=C1', 'Метилфениловый эфир (анизол)', 'Anisole', 'метилфениловый эфир'],
  ['butyl-isopropyl-ether', 'CC(C)OCCCC', 'Бутилизопропиловый эфир', 'Butyl isopropyl ether'],
  ['propyl-butyl-ether', 'CCCOCCCC', 'Пропилбутиловый эфир', 'Propyl butyl ether'],
  ['propanal', 'CCC=O', 'Пропаналь', 'Propanal', 'пропионовый альдегид'],
  ['butanal', 'CCCC=O', 'Бутаналь', 'Butanal', 'бутановый альдегид'],
  ['isobutanal', 'CC(C)C=O', '2-Метилпропаналь', '2-Methylpropanal', 'изомасляный альдегид'],
  ['pentanal', 'CCCCC=O', 'Пентаналь', 'Pentanal'],
  ['butanone', 'CCC(C)=O', 'Бутанон-2 (метилэтилкетон)', 'Butanone', 'метилэтилкетон|бутанон-2'],
  ['pentan-3-one', 'CCC(=O)CC', 'Пентанон-3 (диэтилкетон)', 'Pentan-3-one', 'диэтилкетон'],
  ['pentan-2-one', 'CCCC(C)=O', 'Пентанон-2 (метилпропилкетон)', 'Pentan-2-one', 'метилпропилкетон'],
  ['cyclohexanone', 'O=C1CCCCC1', 'Циклогексанон', 'Cyclohexanone'],
  ['acetophenone', 'CC(=O)C1=CC=CC=C1', 'Ацетофенон', 'Acetophenone'],
  ['benzophenone', 'O=C(C1=CC=CC=C1)C2=CC=CC=C2', 'Бензофенон', 'Benzophenone'],
  ['diacetyl', 'CC(=O)C(C)=O', 'Диацетил', 'Diacetyl'],
  ['acetylacetone', 'CC(=O)CC(C)=O', 'Ацетилацетон', 'Acetylacetone'],
  ['butanoic-acid', 'CCCC(=O)O', 'Масляная кислота (бутановая)', 'Butanoic acid', 'масляная кислота|бутановая кислота'],
  ['pentanoic-acid', 'CCCCC(=O)O', 'Валериановая кислота (пентановая)', 'Pentanoic acid', 'валериановая кислота|пентановая кислота'],
  ['hexanoic-acid', 'CCCCCC(=O)O', 'Капроновая кислота (гексановая)', 'Hexanoic acid', 'капроновая кислота|гексановая кислота'],
  ['2-methylbutanoic-acid', 'CCC(C)C(=O)O', '2-Метилбутановая кислота', '2-Methylbutanoic acid'],
  ['3-methylbutanoic-acid', 'CC(C)CC(=O)O', '3-Метилбутановая кислота', '3-Methylbutanoic acid'],
  ['pivalic-acid', 'CC(C)(C)C(=O)O', '2,2-Диметилпропановая кислота', '2,2-Dimethylpropanoic acid'],
  ['palmitic-acid', alkane(15) + 'C(=O)O', 'Пальмитиновая кислота', 'Palmitic acid', 'гексадекановая кислота'],
  ['margaric-acid', alkane(16) + 'C(=O)O', 'Маргариновая кислота', 'Margaric acid'],
  ['stearic-acid', alkane(17) + 'C(=O)O', 'Стеариновая кислота', 'Stearic acid', 'октадекановая кислота'],
  ['palmitoleic-acid', 'CCCCCCC=CCCCCCCCC(=O)O', 'Пальмитолеиновая кислота', 'Palmitoleic acid'],
  ['oleic-acid', 'CCCCCCCCC=CCCCCCCCC(=O)O', 'Олеиновая кислота', 'Oleic acid'],
  ['linoleic-acid', 'CCCCCC=CCC=CCCCCCCCC(=O)O', 'Линолевая кислота', 'Linoleic acid'],
  ['linolenic-acid', 'CCC=CCC=CCC=CCCCCCCCC(=O)O', 'Линоленовая кислота', 'Linolenic acid'],
  ['oxalic-acid', 'OC(=O)C(=O)O', 'Щавелевая кислота', 'Oxalic acid'],
  ['succinic-acid', 'OC(=O)CCC(=O)O', 'Янтарная кислота', 'Succinic acid'],
  ['adipic-acid', 'OC(=O)CCCCC(=O)O', 'Адипиновая кислота', 'Adipic acid'],
  ['malic-acid', 'OC(=O)CC(O)C(=O)O', 'Яблочная кислота', 'Malic acid'],
  ['citric-acid', 'OC(=O)CC(O)(CC(=O)O)C(=O)O', 'Лимонная кислота', 'Citric acid'],
  ['levulinic-acid', 'CC(=O)CCC(=O)O', 'Левулиновая кислота', 'Levulinic acid'],
  ['chloroacetic-acid', 'OC(=O)CCl', 'Хлоруксусная кислота', 'Chloroacetic acid'],
  ['dichloroacetic-acid', 'OC(=O)C(Cl)Cl', 'Дихлоруксусная кислота', 'Dichloroacetic acid'],
  ['trichloroacetic-acid', 'OC(=O)C(Cl)(Cl)Cl', 'Трихлоруксусная кислота', 'Trichloroacetic acid'],
  ['benzoic-acid', 'OC(=O)C1=CC=CC=C1', 'Бензойная кислота', 'Benzoic acid'],
  ['salicylic-acid', 'OC(=O)C1=CC=CC=C1O', 'Салициловая кислота', 'Salicylic acid'],
  ['terephthalic-acid', 'OC(=O)C1=CC=C(C=C1)C(=O)O', 'Терефталевая кислота', 'Terephthalic acid', 'фталевые кислоты'],
  ['gluconic-acid', 'OCC(O)C(O)C(O)C(O)C(=O)O', 'Глюконовая кислота', 'Gluconic acid'],
  ['aspirin', 'CC(=O)OC1=CC=CC=C1C(=O)O', 'Ацетилсалициловая кислота (аспирин)', 'Aspirin', 'аспирин'],
  ['ascorbic-acid', 'OCC(O)C1OC(=O)C(O)=C1O', 'Аскорбиновая кислота (витамин C)', 'Ascorbic acid', 'витамин c|аскорбиновая кислота', 'acid'],
  ['methyl-formate', 'O=COC', 'Метилформиат (метилметаноат)', 'Methyl formate', 'метилметаноат|метилформиат'],
  ['ethyl-formate', 'O=COCC', 'Этилформиат', 'Ethyl formate'],
  ['propyl-formate', 'O=COCCC', 'Пропилформиат', 'Propyl formate'],
  ['pentyl-formate', 'O=COCCCCC', 'Пентилформиат', 'Pentyl formate', 'пентилметионат'],
  ['methyl-acetate', 'CC(=O)OC', 'Метилацетат', 'Methyl acetate'],
  ['pentyl-acetate', 'CC(=O)OCCCCC', 'Амилацетат (пентилацетат)', 'Pentyl acetate', 'амилацетат|пентилацетат'],
  ['isoamyl-acetate', 'CC(=O)OCCC(C)C', 'Изоамилацетат', 'Isoamyl acetate'],
  ['methyl-propionate', 'CCC(=O)OC', 'Метилпропионат', 'Methyl propionate'],
  ['propyl-propionate', 'CCC(=O)OCCC', 'Пропилпропионат', 'Propyl propionate'],
  ['isopropyl-propionate', 'CCC(=O)OC(C)C', 'Изопропилпропионат', 'Isopropyl propionate'],
  ['butyl-propionate', 'CCC(=O)OCCCC', 'Бутилпропионат', 'Butyl propionate'],
  ['ethyl-butyrate', 'CCCC(=O)OCC', 'Этилбутират', 'Ethyl butyrate'],
  ['ethyl-isobutyrate', 'CC(C)C(=O)OCC', 'Этилизобутират', 'Ethyl isobutyrate'],
  ['ethyl-benzoate', 'CCOC(=O)C1=CC=CC=C1', 'Этилбензоат', 'Ethyl benzoate'],
  ['ethylene-glycol-monoacetate', 'CC(=O)OCCO', 'Моноацетат этиленгликоля', 'Ethylene glycol monoacetate', 'сложный эфир этиленгликоля'],
  ['acetic-anhydride', 'CC(=O)OC(C)=O', 'Уксусный ангидрид', 'Acetic anhydride'],
  ['tristearin', `${alkane(17)}C(=O)OCC(OC(=O)${alkane(17)})COC(=O)${alkane(17)}`, 'Тристеарин', 'Tristearin', 'жир|тристеарат глицерина'],
  ['tripalmitin', `${alkane(15)}C(=O)OCC(OC(=O)${alkane(15)})COC(=O)${alkane(15)}`, 'Трипальмитин', 'Tripalmitin'],
  ['triolein', 'CCCCCCCCC=CCCCCCCCC(=O)OCC(OC(=O)CCCCCCCC=CCCCCCCCC)COC(=O)CCCCCCCC=CCCCCCCCC', 'Триолеин (триолеат глицерина)', 'Triolein', 'триолеат глицерина'],
  ['dioleoyl-stearoyl-glycerol', 'CCCCCCCCC=CCCCCCCCC(=O)OCC(OC(=O)' + alkane(17) + ')COC(=O)CCCCCCCC=CCCCCCCCC', '1,3-Диолеоил-2-стеароилглицерин', '1,3-Dioleoyl-2-stearoylglycerol'],
  ['stearopalmitolein', alkane(17) + 'C(=O)OCC(OC(=O)' + alkane(15) + ')COC(=O)CCCCCCCC=CCCCCCCCC', 'Стеаропальмитоолеин', 'Stearopalmitolein', 'стеаропальмитолеин'],
  ['distearopalmitin', alkane(17) + 'C(=O)OCC(OC(=O)' + alkane(15) + ')COC(=O)' + alkane(17), 'Дистеаропальмитин', 'Distearopalmitin'],
  ['nitroglycerin', 'C(ON(=O)=O)C(ON(=O)=O)CON(=O)=O', 'Нитроглицерин (тринитрат глицерина)', 'Nitroglycerin', 'тринитроглицерин|нитроглицерин', 'ester'],
  ['ethyl-nitrate', 'CCON(=O)=O', 'Этилнитрат', 'Ethyl nitrate', undefined, 'ester'],
  ['glyceraldehyde', 'OCC(O)C=O', 'Глицериновый альдегид', 'Glyceraldehyde', 'глицеральдегид', 'carb'],
  ['dihydroxyacetone', 'OCC(=O)CO', 'Дигидроксиацетон', 'Dihydroxyacetone', 'диоксиацетон', 'carb'],
  ['ribose', 'OCC(O)C(O)C(O)C=O', 'Рибоза', 'Ribose', undefined, 'carb'],
  ['methyl-glucoside', 'COC1OC(CO)C(O)C(O)C1O', 'Метилглюкозид', 'Methyl glucoside', undefined, 'carb'],
  ['glucose-pentaacetate', 'CC(=O)OCC1OC(OC(C)=O)C(OC(C)=O)C(OC(C)=O)C1OC(C)=O', 'Пентаацетат глюкозы', 'Glucose pentaacetate', undefined, 'carb'],
  ['urea', 'NC(=O)N', 'Мочевина (карбамид)', 'Urea', 'мочевина|карбамид'],
  ['glycine', 'NCC(=O)O', 'Аминоуксусная кислота (глицин)', 'Glycine', 'аминоуксусная кислота|глицин'],
  ['nitromethane', 'CN(=O)=O', 'Нитрометан', 'Nitromethane'],
  ['nitrobenzene', 'O=N(=O)C1=CC=CC=C1', 'Нитробензол', 'Nitrobenzene'],
  ['trinitrotoluene', 'CC1=C(C=C(C=C1N(=O)=O)N(=O)=O)N(=O)=O', '2,4,6-Тринитротолуол', '2,4,6-Trinitrotoluene', '1-метил-2,4,6-тринитробензол'],
  ['picric-acid', 'OC1=C(C=C(C=C1N(=O)=O)N(=O)=O)N(=O)=O', 'Пикриновая кислота (2,4,6-тринитрофенол)', 'Picric acid', 'тринитрофенол|пикриновая кислота'],
  ['acrylonitrile', 'C=CC#N', 'Акрилонитрил', 'Acrylonitrile'],
  ['pyridine', 'C1=CC=NC=C1', 'Пиридин', 'Pyridine'],
  ['pyrrole', 'C1=CC=CN1', 'Пиррол', 'Pyrrole'],
  ['hexamine', 'C1N2CN3CN1CN(C2)C3', 'Гексаметилентетрамин (уротропин)', 'Hexamine', 'уротропин'],
  ['adrenaline', 'CNCC(O)C1=CC(O)=C(O)C=C1', 'Адреналин', 'Adrenaline'],
]

// ---------- упрощённый SMILES → скелет ----------
type Atom = { el: OrganicElement; bonds: number }
function parseSmiles(s: string): { atoms: Atom[]; edges: [number, number, 1 | 2 | 3][] } {
  const atoms: Atom[] = []
  const edges: [number, number, 1 | 2 | 3][] = []
  const stack: number[] = []
  const rings = new Map<number, { at: number; order: 1 | 2 | 3 }>()
  let prev = -1
  let order: 1 | 2 | 3 = 1
  const link = (a: number, b: number, o: 1 | 2 | 3) => {
    edges.push([a, b, o])
    atoms[a]!.bonds += o
    atoms[b]!.bonds += o
  }
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!
    if (ch === '(') stack.push(prev)
    else if (ch === ')') prev = stack.pop()!
    else if (ch === '=') order = 2
    else if (ch === '#') order = 3
    else if (/\d/.test(ch)) {
      const d = Number(ch)
      const open = rings.get(d)
      if (open) {
        link(open.at, prev, (order > open.order ? order : open.order) as 1 | 2 | 3)
        rings.delete(d)
      } else rings.set(d, { at: prev, order })
      order = 1
    } else {
      let el: OrganicElement
      if (s.startsWith('Cl', i)) {
        el = 'Cl'
        i++
      } else if (ch === 'C' || ch === 'O' || ch === 'N') el = ch
      else throw new Error(`bad SMILES char ${ch} in ${s}`)
      atoms.push({ el, bonds: 0 })
      const idx = atoms.length - 1
      if (prev >= 0) link(prev, idx, order)
      order = 1
      prev = idx
    }
  }
  if (rings.size) throw new Error(`unclosed ring in ${s}`)
  return { atoms, edges }
}

const VALENCE: Record<string, number> = { C: 4, O: 2, N: 3, Cl: 1 }
const ORDER: OrganicElement[] = ['C', 'O', 'N', 'Cl']

function classify(smiles: string, atoms: Atom[], edges: [number, number, number][]): OrganicClassId {
  const nb = (i: number) => edges.filter((e) => e[0] === i || e[1] === i).map((e) => ({ j: e[0] === i ? e[1] : e[0], o: e[2] }))
  const has = (el: string) => atoms.some((a) => a.el === el)
  if (has('N')) return 'nitrogen'
  let acid = false
  let ester = false
  let aldehyde = false
  let ketone = false
  let oh = 0
  let phenolic = false
  let ether = false
  atoms.forEach((a, i) => {
    if (a.el === 'C') {
      const n = nb(i)
      const dO = n.some((x) => atoms[x.j]!.el === 'O' && x.o === 2)
      const sO = n.filter((x) => atoms[x.j]!.el === 'O' && x.o === 1)
      const cN = n.filter((x) => atoms[x.j]!.el === 'C').length
      if (dO) {
        if (sO.some((x) => nb(x.j).length === 1)) acid = true
        else if (sO.length) ester = true
        else if (cN <= 1) aldehyde = true
        else ketone = true
      }
    }
    if (a.el === 'O') {
      const n = nb(i)
      if (n.length === 1 && n[0]!.o === 1) {
        oh++
        if (nb(n[0]!.j).some((x) => x.o === 2 && atoms[x.j]!.el === 'C')) phenolic = true
      }
      if (n.length === 2 && n.every((x) => atoms[x.j]!.el === 'C')) ether = true
    }
  })
  const ring = /\d/.test(smiles)
  const aromatic = ring && (smiles.match(/=/g) ?? []).length >= 3 && /C\d?=CC=C/.test(smiles.replace(/\(=O\)/g, ''))
  if (acid) return 'acid'
  if (ester) return 'ester'
  if (aldehyde) return 'aldehyde'
  if (ketone) return 'ketone'
  if (phenolic && aromatic) return 'phenol'
  if (oh >= 2) return 'polyol'
  if (oh === 1) return 'alcohol'
  if (ether) return 'ether'
  if (has('Cl')) return 'halo'
  if (aromatic) return 'arene'
  if (smiles.includes('#')) return 'alkyne'
  const dbl = (smiles.match(/=/g) ?? []).length
  if (dbl >= 2) return 'alkadiene'
  if (dbl === 1) return 'alkene'
  if (ring) return 'cycloalkane'
  return 'alkane'
}

const SUBS = '₀₁₂₃₄₅₆₇₈₉'
const sub = (n: number) => (n === 1 ? '' : String(n).replace(/\d/g, (d) => SUBS[Number(d)]!))
const hill = (c: Record<string, number>) =>
  ['C', 'H', ...Object.keys(c).filter((e) => e !== 'C' && e !== 'H').sort()]
    .filter((e) => c[e])
    .map((e) => e + sub(c[e]!))
    .join('')
const compKey = (c: Record<string, number>) =>
  Object.entries(c)
    .filter(([, n]) => n)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([e, n]) => `${e}${n}`)
    .join('')

// Учебники: темы и формулы по нормализованному названию.
const norm = (s: string) => s.toLowerCase().replace(/\s*\([^)]*\)/g, '').replace(/ё/g, 'е').trim()
type Mention = { grade: number; title: string; page: number | null; formula: string | null }
const mentions = new Map<string, Mention[]>()
for (const g of [7, 8, 9, 10, 11]) {
  const inv = JSON.parse(fs.readFileSync(`src/data/textbook/inventory-g${g}.json`, 'utf8')) as { sections: { sectionId: string; title: string; pageStart?: number }[] }
  const secs = new Map(inv.sections.map((s) => [s.sectionId, s]))
  const subs = JSON.parse(fs.readFileSync(`src/data/textbook/substances-g${g}.json`, 'utf8')) as { substances: { nameRu: string | null; formula: string | null; sections?: string[]; firstPage?: number | null }[] }
  for (const s of subs.substances) {
    if (!s.nameRu) continue
    const keys = new Set([norm(s.nameRu), ...[...s.nameRu.matchAll(/\(([^)]+)\)/g)].map((m) => norm(m[1]!))])
    const sec = s.sections?.map((id) => secs.get(id)).find(Boolean)
    for (const k of keys) {
      const arr = mentions.get(k) ?? []
      arr.push({ grade: g, title: sec?.title.replace(/^§\s*\d+\.?\s*/, '') ?? '', page: s.firstPage ?? sec?.pageStart ?? null, formula: s.formula })
      mentions.set(k, arr)
    }
  }
}

const out: string[] = []
const problems: string[] = []
const seenStruct = new Map<string, string>()
for (const [id, smiles, nameRu, nameEn, aliases, classOverride] of ENTRIES) {
  const { atoms, edges } = parseSmiles(smiles)
  const perm = ORDER.flatMap((el) => atoms.map((a, i) => (a.el === el ? i : -1)).filter((i) => i >= 0))
  const newIndex = new Map(perm.map((old, n) => [old, n]))
  const elements = perm.map((i) => atoms[i]!.el)
  const skEdges = edges.map(([a, b, o]) => [newIndex.get(a)!, newIndex.get(b)!, o] as [number, number, 1 | 2 | 3])
  const kit: Record<string, number> = {}
  let h = 0
  for (const a of atoms) {
    kit[a.el] = (kit[a.el] ?? 0) + 1
    h += Math.max(0, VALENCE[a.el]! - a.bonds)
  }
  if (h) kit.H = h
  const comp = { ...kit }

  // Проверка графа так же, как его строит каталог.
  let g = createFormulaKit(kit)
  g = applySkeletonBonds(g, { elements, edges: skEdges })
  g = autoBondKitHydrogens(g)
  const heavyBonds = g.bonds.filter((b) => !g.atoms.find((x) => x.id === b.a)!.element.startsWith('H') && !g.atoms.find((x) => x.id === b.b)!.element.startsWith('H'))
  const errs = valenceErrors(g)
  if (heavyBonds.length !== skEdges.length || errs.length) {
    problems.push(`${id}: graph bonds ${heavyBonds.length}/${skEdges.length}, valence errors ${errs.length}`)
    continue
  }
  const sk = compKey(comp)
  const dupOf = [...seenStruct.entries()].find(([, s]) => s === smiles)
  if (dupOf) problems.push(`${id}: same SMILES as ${dupOf[0]}`)
  seenStruct.set(id, smiles)

  const names = [nameRu, ...(aliases ? aliases.split('|') : [])].map(norm)
  const found = names.flatMap((n) => mentions.get(n) ?? [])
  let bookFormula: string | null = null
  for (const m of found) {
    const c = m.formula ? parseComposition(m.formula.replace(/[-–=≡]/g, '')) : null
    if (c && compKey(c) === sk) bookFormula ??= m.formula
    else if (c && m.formula && !/^\(|\)n$/.test(m.formula)) problems.push(`${id}: book formula ${m.formula} ≠ ${hill(comp)}`)
  }
  if (!found.length) problems.push(`${id}: no textbook mention for "${nameRu}"`)
  const grades = [...new Set(found.map((m) => m.grade))].sort((a, b) => a - b)
  const topics: Mention[] = []
  for (const m of found) if (m.title && !topics.some((t) => t.grade === m.grade)) topics.push(m)
  const classId = classOverride ?? classify(smiles, atoms, edges)
  const formula = bookFormula && !/[()]n|R/.test(bookFormula) ? bookFormula.replace(/-/g, '–').replace(/(\d+)/g, (d) => d.replace(/\d/g, (x) => SUBS[Number(x)]!)) : hill(comp)
  const where = topics
    .slice(0, 3)
    .map((t) => `${t.grade} класс — «${t.title}»${t.page ? ` (с. ${t.page})` : ''}`)
    .join('; ')
  const label = ORGANIC_CLASS_LABELS[classId].ru.toLowerCase()
  const descriptionRu = `${nameRu} (${hill(comp)}) — вещество из раздела «${label}».${where ? ` В учебниках «Химия»: ${where}.` : ''}`
  const descriptionEn = `${nameEn} (${hill(comp)}) — ${ORGANIC_CLASS_LABELS[classId].en.toLowerCase()}; studied in the school chemistry textbooks.`
  out.push(
    `  ${JSON.stringify({ id, classId, formula, nameRu, nameEn, descriptionRu, descriptionEn, grade: grades.length && grades.every((x) => x === 11) ? 'g11' : 'g10', kit, skeleton: { elements, edges: skEdges } })},`,
  )
}

fs.writeFileSync(
  path.join('src/data/organicLab/textbookOrganic.data.ts'),
  `// Сгенерировано scripts/textbook-inventory/gen-textbook-organic.mts — не редактировать вручную.
// Органические вещества из учебников «Химия» 7–11: скелет тяжёлых атомов + набор атомов (3D строится в каталоге).
import type { OrganicClassId, OrganicKit } from '../researchLab/organicBuildCatalog'
import type { SkeletonSpec } from '../../chemistry/organic/organicGraph'

export type TextbookOrganicSpec = {
  id: string
  classId: OrganicClassId
  formula: string
  nameRu: string
  nameEn: string
  descriptionRu: string
  descriptionEn: string
  grade: 'g10' | 'g11'
  kit: OrganicKit
  skeleton: SkeletonSpec
}

export const TEXTBOOK_ORGANIC_SPECS: readonly TextbookOrganicSpec[] = [
${out.join('\n')}
]
`,
)
console.log('organic generated', out.length, 'of', ENTRIES.length)
console.log(problems.join('\n'))
