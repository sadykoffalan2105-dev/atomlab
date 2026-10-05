/** Органика v2 — подписи просмотрщика (свой словарь RU/EN/UZ, чтобы не трогать общие messages*.ts). */
import type { OV2Lang } from '../contracts'
import type { OV2GroupKey } from '../../../data/organicV2/types'
import type { ConformationKey, IsomerKind } from './molMath'

const RU = {
  ballStick: 'Шарики', spaceFill: 'Объём', wire: 'Каркас',
  styleTitle: 'Модель', overlayTitle: 'Слой', toolTitle: 'Инструмент',
  none: 'Нет', hybrid: 'Гибридизация', groups: 'Группы', charges: 'Заряды δ', carbonDegree: 'Степень C',
  measure: 'Линейка', rotate: 'Вращение',
  measureHint: 'Нажмите на 2 атома — расстояние, на 3 — угол', rotateHint: 'Нажмите на одинарную связь C–C',
  notRotatable: 'Эта связь не вращается (кратная или в цикле)',
  reset: 'Двойной клик — исходный вид', skeletal: 'Скелетная', structural: 'Развёрнутая',
  tab3d: '3D', tab2d: 'Формула', tabInfo: 'Свойства',
  cls: 'Класс', formula: 'Брутто-формула', semi: 'Полуструктурная', mass: 'Молярная масса', massUnit: 'г/моль',
  hybC: 'Гибридизация C', fgroups: 'Функциональные группы', stereo: 'Стереохимия', book: 'Где в учебнике',
  bookText: (g: string) => `Kimyo ${g} класс`, pages: (p: string) => `с. ${p}`, lessonWord: 'урок', noGroups: 'нет (углеводород)', noStereo: 'нет стереоцентров',
  distance: 'Расстояние', angle: 'Угол', clear: 'Сбросить',
  newman: 'Проекция Ньюмена', energy: 'Торсионная энергия', kj: 'кДж/моль', dihedral: 'Угол φ',
  front: 'передний', back: 'задний',
  cis: 'цис', trans: 'транс', atoms: 'атомов', loading: 'Загрузка…',
  isomersOf: (f: string) => `Изомеры ${f}`, reference: 'Образец', open: 'Открыть',
}
type Dict = typeof RU

const EN: Dict = {
  ballStick: 'Ball & stick', spaceFill: 'Space-fill', wire: 'Wireframe',
  styleTitle: 'Model', overlayTitle: 'Layer', toolTitle: 'Tool',
  none: 'None', hybrid: 'Hybridization', groups: 'Groups', charges: 'Charges δ', carbonDegree: 'C degree',
  measure: 'Ruler', rotate: 'Rotate',
  measureHint: 'Tap 2 atoms for a distance, 3 for an angle', rotateHint: 'Tap a single C–C bond',
  notRotatable: 'This bond cannot rotate (multiple or in a ring)',
  reset: 'Double-click to reset view', skeletal: 'Skeletal', structural: 'Expanded',
  tab3d: '3D', tab2d: 'Formula', tabInfo: 'Properties',
  cls: 'Class', formula: 'Molecular formula', semi: 'Condensed formula', mass: 'Molar mass', massUnit: 'g/mol',
  hybC: 'Carbon hybridization', fgroups: 'Functional groups', stereo: 'Stereochemistry', book: 'In the textbook',
  bookText: (g: string) => `Kimyo grade ${g}`, pages: (p: string) => `p. ${p}`, lessonWord: 'lesson', noGroups: 'none (hydrocarbon)', noStereo: 'no stereocentres',
  distance: 'Distance', angle: 'Angle', clear: 'Clear',
  newman: 'Newman projection', energy: 'Torsional energy', kj: 'kJ/mol', dihedral: 'Angle φ',
  front: 'front', back: 'back',
  cis: 'cis', trans: 'trans', atoms: 'atoms', loading: 'Loading…',
  isomersOf: (f: string) => `Isomers of ${f}`, reference: 'Reference', open: 'Open',
}

const UZ: Dict = {
  ballStick: 'Sharchalar', spaceFill: 'Hajmli', wire: 'Karkas',
  styleTitle: 'Model', overlayTitle: 'Qatlam', toolTitle: 'Asbob',
  none: 'Yo‘q', hybrid: 'Gibridlanish', groups: 'Guruhlar', charges: 'Zaryadlar δ', carbonDegree: 'C darajasi',
  measure: 'Chizg‘ich', rotate: 'Aylantirish',
  measureHint: '2 ta atom — masofa, 3 ta — burchak', rotateHint: 'Oddiy C–C bog‘ni bosing',
  notRotatable: 'Bu bog‘ aylanmaydi (karrali yoki halqada)',
  reset: 'Ikki marta bosish — boshlang‘ich ko‘rinish', skeletal: 'Skelet', structural: 'Yoyilgan',
  tab3d: '3D', tab2d: 'Formula', tabInfo: 'Xossalar',
  cls: 'Sinf', formula: 'Molekulyar formula', semi: 'Qisqartirilgan formula', mass: 'Molyar massa', massUnit: 'g/mol',
  hybC: 'C gibridlanishi', fgroups: 'Funksional guruhlar', stereo: 'Stereokimyo', book: 'Darslikda',
  bookText: (g: string) => `Kimyo ${g}-sinf`, pages: (p: string) => `${p}-bet`, lessonWord: 'dars', noGroups: 'yo‘q (uglevodorod)', noStereo: 'stereomarkaz yo‘q',
  distance: 'Masofa', angle: 'Burchak', clear: 'Tozalash',
  newman: 'Nyumen proyeksiyasi', energy: 'Torsion energiya', kj: 'kJ/mol', dihedral: 'φ burchak',
  front: 'oldingi', back: 'orqa',
  cis: 'sis', trans: 'trans', atoms: 'atom', loading: 'Yuklanmoqda…',
  isomersOf: (f: string) => `${f} izomerlari`, reference: 'Namuna', open: 'Ochish',
}

export const VIEWER_T: Record<OV2Lang, Dict> = { ru: RU, en: EN, uz: UZ }

export const CONFORMATION_T: Record<OV2Lang, Record<ConformationKey, string>> = {
  ru: { eclipsed: 'заслонённая', staggered: 'заторможенная', gauche: 'гош (скошенная)', anti: 'анти (заторможенная)', syn: 'син (полностью заслонённая)', between: 'промежуточная' },
  en: { eclipsed: 'eclipsed', staggered: 'staggered', gauche: 'gauche', anti: 'anti (staggered)', syn: 'syn (fully eclipsed)', between: 'intermediate' },
  uz: { eclipsed: 'to‘silgan', staggered: 'tormozlangan', gauche: 'gosh', anti: 'anti (tormozlangan)', syn: 'sin (to‘liq to‘silgan)', between: 'oraliq' },
}

export const ISOMER_T: Record<OV2Lang, Record<IsomerKind, string>> = {
  ru: { same: 'та же молекула', chain: 'изомерия углеродной цепи', groupPosition: 'положение функциональной группы', bondPosition: 'положение кратной связи', interclass: 'межклассовая изомерия', cisTrans: 'цис-транс-изомерия', optical: 'оптическая изомерия', structural: 'структурная изомерия' },
  en: { same: 'same molecule', chain: 'chain isomerism', groupPosition: 'functional-group position', bondPosition: 'multiple-bond position', interclass: 'functional (interclass) isomerism', cisTrans: 'cis–trans isomerism', optical: 'optical isomerism', structural: 'structural isomerism' },
  uz: { same: 'o‘sha molekula', chain: 'uglerod zanjiri izomeriyasi', groupPosition: 'funksional guruh holati', bondPosition: 'karrali bog‘ holati', interclass: 'sinflararo izomeriya', cisTrans: 'sis-trans izomeriya', optical: 'optik izomeriya', structural: 'struktur izomeriya' },
}

/** Короткая подпись группы на модели (как в учебнике). */
export const GROUP_SHORT: Record<OV2GroupKey, string> = {
  hydroxyl: '–OH', phenolOH: '–OH', carbonylAldehyde: '–CHO', carbonylKetone: '>C=O', carboxyl: '–COOH', ester: '–COO–',
  ether: '–O–', amino: '–NH₂', nitro: '–NO₂', halogen: '–Hal', alkene: 'C=C', alkyne: 'C≡C', arene: 'C₆H₅', sulfo: '–SO₃H',
  nitrile: '–C≡N', amide: '–CONH₂', nitrate: '–ONO₂',
}

export const GROUP_NAME: Record<OV2Lang, Record<OV2GroupKey, string>> = {
  ru: { hydroxyl: 'гидроксильная', phenolOH: 'фенольная –OH', carbonylAldehyde: 'альдегидная', carbonylKetone: 'карбонильная (кетон)', carboxyl: 'карбоксильная', ester: 'сложноэфирная', ether: 'простая эфирная', amino: 'аминогруппа', nitro: 'нитрогруппа', halogen: 'галоген', alkene: 'двойная связь', alkyne: 'тройная связь', arene: 'бензольное кольцо', sulfo: 'сульфогруппа', nitrile: 'нитрильная', amide: 'амидная', nitrate: 'нитратная' },
  en: { hydroxyl: 'hydroxyl', phenolOH: 'phenolic OH', carbonylAldehyde: 'aldehyde', carbonylKetone: 'ketone carbonyl', carboxyl: 'carboxyl', ester: 'ester', ether: 'ether', amino: 'amino', nitro: 'nitro', halogen: 'halogen', alkene: 'double bond', alkyne: 'triple bond', arene: 'benzene ring', sulfo: 'sulfo', nitrile: 'nitrile', amide: 'amide', nitrate: 'nitrate' },
  uz: { hydroxyl: 'gidroksil', phenolOH: 'fenol –OH', carbonylAldehyde: 'aldegid', carbonylKetone: 'karbonil (keton)', carboxyl: 'karboksil', ester: 'murakkab efir', ether: 'oddiy efir', amino: 'aminoguruh', nitro: 'nitroguruh', halogen: 'galogen', alkene: 'qo‘sh bog‘', alkyne: 'uchlamchi bog‘', arene: 'benzol halqasi', sulfo: 'sulfoguruh', nitrile: 'nitril', amide: 'amid', nitrate: 'nitrat' },
}

/** Цвет подсветки группы (одинаковый в обеих темах — поверх тёмного 3D). */
export const GROUP_COLOR: Record<OV2GroupKey, string> = {
  hydroxyl: '#38bdf8', phenolOH: '#38bdf8', carbonylAldehyde: '#f59e0b', carbonylKetone: '#f59e0b', carboxyl: '#f43f5e', ester: '#a78bfa',
  ether: '#2dd4bf', amino: '#60a5fa', nitro: '#fb923c', halogen: '#4ade80', alkene: '#facc15', alkyne: '#e879f9', arene: '#c084fc', sulfo: '#fde047',
  nitrile: '#93c5fd', amide: '#818cf8', nitrate: '#fdba74',
}
