import type { FormationStory, StoryHud } from '../formationStory'
import type { FinalPhase, PhaseInfo } from './phase'

type Tri = [string, string, string]

/**
 * HUD-карточки (стекло у 3D-окна) для ВСЕХ сценариев «Как образуется»: тот же текст, что раньше рисовался 3D-плашками
 * поверх атомов, с теми же окнами времени — уравнение пути и подписи частиц сцены пути (RouteBadge), подпись итоговой
 * решётки по типу (ионная / молекулярная / цепь / каркас). Интерфейс может убрать плашки поверх атомов без потери информации.
 */
export function buildStoryHud(story: Omit<FormationStory, 'hud'>, formula: string): StoryHud[] {
  const hud: StoryHud[] = []
  const st = (k: string) => story.stages.find((s) => s.key === k)
  const fin = story.stages[story.stages.length - 1]!
  const rs = story.routeStage
  if (rs) {
    hud.push({ t0: rs.t0, t1: rs.t0 + rs.dur, title: rs.title[0], lines: [`Путь: ${rs.equation}`], tone: 'route', titleT: rs.title, linesT: [[`Путь: ${rs.equation}`, `Route: ${rs.equation}`, `Yoʻl: ${rs.equation}`]] })
    // Подписи частиц: одинаковый текст с перекрывающимися окнами — одна строка (MnO₄⁻ ×2 → одна).
    const seen = new Map<string, StoryHud>()
    for (const b of rs.badges) {
      const prev = seen.get(b.text)
      if (prev && b.from <= prev.t1 && b.to >= prev.t0) {
        prev.t0 = Math.min(prev.t0, b.from)
        prev.t1 = Math.max(prev.t1, b.to)
        continue
      }
      const redox = b.text.includes('→')
      const h: StoryHud = {
        t0: b.from,
        t1: b.to,
        title: redox ? 'Степени окисления' : 'Частицы',
        lines: [b.text],
        tone: redox ? 'redox' : 'route',
        titleT: redox ? ['Степени окисления', 'Oxidation states', 'Oksidlanish darajalari'] : ['Частицы', 'Particles', 'Zarrachalar'],
      }
      seen.set(b.text, h)
      hud.push(h)
    }
  }
  const latS = st('lattice')
  const cap = (t: Tri, t0: number, t1: number) => hud.push({ t0, t1, title: t[0], lines: [], tone: 'check', titleT: t, linesT: [] })
  if (story.latticeKind === 'ionic' && latS) cap(['Ионная кристаллическая решётка', 'Ionic crystal lattice', 'Ion kristall panjara'], latS.t0 + 0.4, fin.t0 + 2.6)
  else if (story.latticeKind === 'molecular') cap(['Молекулярная решётка: молекулы в узлах', 'Molecular lattice: molecules at the sites', 'Molekulyar panjara: tugunlarda molekulalar'], fin.t0 + 0.4, fin.t0 + fin.dur - 1.4)
  else if (story.latticeKind === 'chain') cap([`(${formula})ₙ — цепь звеньев`, `(${formula})ₙ — a chain of units`, `(${formula})ₙ — boʻgʻinlar zanjiri`], fin.t0 + 0.4, fin.t0 + fin.dur - 1.4)
  else if (story.latticeKind === 'network') {
    const sa = st('assemble')
    if (sa) cap(['Каркас тетраэдров SiO₄ (молекул нет)', 'Framework of SiO₄ tetrahedra (no molecules)', 'SiO₄ tetraedrlari karkasi (molekula yoʻq)'], sa.t0 + 0.3, story.total)
  }
  return hud.sort((a, b) => a.t0 - b.t0)
}

// ─── Карточка фазы итога (25 °C): газ / жидкость / раствор / решётка ───

/** Перевод подписей решётки (тип, координация) RU → EN / UZ: фразы по порядку, длинные раньше. */
const LAT_T: Tri[] = [
  ['искажённый тип NaCl', 'distorted NaCl type', 'buzilgan NaCl turi'],
  ['тип арагонита', 'aragonite type', 'aragonit turi'],
  ['тип β-K₂SO₄', 'β-K₂SO₄ type', 'β-K₂SO₄ turi'],
  ['тип барита', 'barite type', 'barit turi'],
  ['типа NaCl', 'NaCl type', 'NaCl turi'],
  ['типа CsCl', 'CsCl type', 'CsCl turi'],
  ['тип NaCl', 'NaCl type', 'NaCl turi'],
  ['тип CdI₂', 'CdI₂ type', 'CdI₂ turi'],
  ['тип CdCl₂', 'CdCl₂ type', 'CdCl₂ turi'],
  ['BiI₃-тип', 'BiI₃ type', 'BiI₃ turi'],
  ['смесь двух решёток', 'a mixture of two lattices', 'ikki panjara aralashmasi'],
  ['двойная соль', 'double salt', 'qoʻsh tuz'],
  ['кристаллогидрат', 'crystal hydrate', 'kristallogidrat'],
  ['атомный каркас', 'covalent framework', 'atom karkas'],
  ['водородные связи', 'hydrogen bonds', 'vodorod bogʻlar'],
  ['молекул S₈ в ячейке', 'S₈ molecules per cell', 'ta S₈ molekulasi yacheykada'],
  ['внутри молекулы', 'inside the molecule', 'molekula ichida'],
  ['белый фосфор', 'white phosphorus', 'oq fosfor'],
  ['метафосфорная', 'metaphosphoric', 'metafosfat'],
  ['обратная шпинель', 'inverse spinel', 'teskari shpinel'],
  ['с вакансиями', 'with vacancies', 'boʻsh joylar bilan'],
  ['зигзаг-цепи', 'zigzag chains', 'zigzag zanjirlar'],
  ['искажённый рутил', 'distorted rutile', 'buzilgan rutil'],
  ['искажённая', 'distorted', 'buzilgan'],
  ['искажённый', 'distorted', 'buzilgan'],
  ['ромбоэдрическая', 'rhombohedral', 'romboedrik'],
  ['ромбическая', 'orthorhombic', 'rombik'],
  ['кубическая', 'cubic', 'kubik'],
  ['гексагональная', 'hexagonal', 'geksagonal'],
  ['моноклинная', 'monoclinic', 'monoklin'],
  ['тетрагональная', 'tetragonal', 'tetragonal'],
  ['тетрагон.', 'tetragonal', 'tetragonal'],
  ['молекулярная', 'molecular', 'molekulyar'],
  ['слоистая', 'layered', 'qatlamli'],
  ['ионная', 'ionic', 'ion'],
  ['полимер', 'polymer', 'polimer'],
  ['кольца', 'rings', 'halqalar'],
  ['слои', 'layers', 'qatlamlar'],
  ['молекулы', 'molecules', 'molekulalar'],
  ['молекул', 'molecules', 'molekulalar'],
  ['тетраэдров', 'of tetrahedra', 'tetraedrlari'],
  ['тетраэдры', 'tetrahedra', 'tetraedrlar'],
  ['тетраэдр', 'tetrahedron', 'tetraedr'],
  ['пирамид', 'of pyramids', 'piramidalari'],
  ['цепи', 'chains', 'zanjirlar'],
  ['гантели', 'dumbbells', 'gantellar'],
  ['ионы', 'ions', 'ionlar'],
  ['линейный', 'linear', 'chiziqli'],
  ['треугольник', 'triangle', 'uchburchak'],
  ['квадрат', 'square', 'kvadrat'],
  ['димеры', 'dimers', 'dimerlar'],
  ['каркас', 'framework', 'karkas'],
  ['сульфата', 'of sulfate', 'sulfat'],
  ['кварц', 'quartz', 'kvars'],
  ['сфалерит', 'zinc blende', 'sfalerit'],
  ['вюрцит', 'wurtzite', 'vyursit'],
  ['антифлюорит', 'antifluorite', 'antiflyuorit'],
  ['куприт', 'cuprite', 'kuprit'],
  ['корунд', 'corundum', 'korund'],
  ['гематит', 'hematite', 'gematit'],
  ['кальцит', 'calcite', 'kalsit'],
  ['магнезит', 'magnesite', 'magnezit'],
  ['барит', 'barite', 'barit'],
  ['глёт', 'litharge', 'glyot'],
  ['брусит', 'brucite', 'brusit'],
  ['портландит', 'portlandite', 'portlandit'],
  ['рутил', 'rutile', 'rutil'],
  ['пиролюзит', 'pyrolusite', 'piroluzit'],
  ['шпинель', 'spinel', 'shpinel'],
  ['магнетит', 'magnetite', 'magnetit'],
  ['гаусманит', 'hausmannite', 'gausmanit'],
  ['тенорит', 'tenorite', 'tenorit'],
  ['ковеллин', 'covellite', 'kovellin'],
  ['халькозин', 'chalcocite', 'xalkozin'],
  ['биксбиит', 'bixbyite', 'biksbiit'],
  ['котуннит', 'cotunnite', 'kotunnit'],
  ['троилит', 'troilite', 'troilit'],
  ['пирит', 'pyrite', 'pirit'],
  ['ангидрит', 'anhydrite', 'angidrit'],
  ['малахит', 'malachite', 'malaxit'],
  ['монетит', 'monetite', 'monetit'],
  ['карналлит', 'carnallite', 'karnallit'],
  ['каинит', 'kainite', 'kainit'],
  ['пл.', 'm.p.', 'suyuql. t.'],
  ['по OH⁻', 'by OH⁻', 'OH⁻ boʻyicha'],
  ['по H₂O', 'by H₂O', 'H₂O boʻyicha'],
  ['по Cl⁻', 'by Cl⁻', 'Cl⁻ boʻyicha'],
  ['по H⁻', 'by H⁻', 'H⁻ boʻyicha'],
  ['по O', 'by O', 'O boʻyicha'],
  ['по S', 'by S', 'S boʻyicha'],
  ['по P', 'by P', 'P boʻyicha'],
  ['по C', 'by C', 'C boʻyicha'],
  [' пм', ' pm', ' pm'],
  [' и ', ' and ', ' va '],
  [' с ', ' with ', ' bilan '],
]
/** Подпись решётки на языке loc (0 RU, 1 EN, 2 UZ). */
export function latticeLabelT(ru: string, loc: 0 | 1 | 2): string {
  if (loc === 0) return ru
  let s = ru
  for (const t of LAT_T) s = s.split(t[0]).join(t[loc])
  return s
}
const SUBS = '₀₁₂₃₄₅₆₇₈₉'
/** Сопряжённое основание кислоты: HCl → Cl⁻, H₂CO₃ → HCO₃⁻, HClO₃ → ClO₃⁻. */
function conjugateBase(f: string): string {
  const m = /^H([₂-₉])(.*)$/.exec(f)
  if (m) {
    const n = SUBS.indexOf(m[1]!) - 1
    return `H${n > 1 ? SUBS[n] : ''}${m[2]}⁻`
  }
  return `${f.replace(/^H/, '')}⁻`
}
/**
 * Карточка фазы на [fin.t0 + 0,8, конец показа]: газ / жидкость / раствор (H₃O⁺ и анион среди воды) /
 * решётка (тип, координация, параметры ячейки) и честная подпись (note) — RU / EN / UZ.
 */
export function buildPhaseHud(story: Pick<FormationStory, 'stages' | 'total'>, formula: string, phase: FinalPhase, info: PhaseInfo): StoryHud {
  const fin = story.stages[story.stages.length - 1]!
  const lines: Tri[] = []
  let title: Tri
  if (phase === 'gas') {
    title = ['Газ при 25 °C', 'Gas at 25 °C', '25 °C da gaz']
    lines.push(['Газ: молекулы далеко друг от друга и движутся свободно', 'Gas: the molecules are far apart and move freely', 'Gaz: molekulalar bir-biridan uzoq va erkin harakatlanadi'])
  } else if (phase === 'liquid') {
    title = ['Жидкость при 25 °C', 'Liquid at 25 °C', '25 °C da suyuqlik']
    lines.push(['Жидкость: молекулы вплотную, но скользят', 'Liquid: the molecules are close together but slide past each other', 'Suyuqlik: molekulalar zich, lekin bir-biri ustida sirpanadi'])
  } else if (phase === 'solution') {
    title = ['Раствор в воде', 'Solution in water', 'Suvdagi eritma']
    const A = conjugateBase(formula)
    if (!info.acidH?.length) lines.push([`Раствор: в основном молекулы ${formula}, немного NH₄⁺ и OH⁻`, `Solution: mostly ${formula} molecules, a few NH₄⁺ and OH⁻`, `Eritma: asosan ${formula} molekulalari, ozgina NH₄⁺ va OH⁻`])
    else if (info.dissociation === 'strong') lines.push([`Раствор: H₃O⁺ и ${A} среди молекул воды`, `Solution: H₃O⁺ and ${A} among water molecules`, `Eritma: suv molekulalari orasida H₃O⁺ va ${A}`])
    else lines.push([`Раствор: в основном молекулы ${formula}, немного H₃O⁺ и ${A}`, `Solution: mostly ${formula} molecules, a few H₃O⁺ and ${A}`, `Eritma: asosan ${formula} molekulalari, ozgina H₃O⁺ va ${A}`])
  } else {
    const L = info.lattice
    const type = L?.type ?? (phase === 'network' ? 'атомный каркас' : phase === 'chain' ? 'полимер' : phase === 'molecular' ? 'молекулярная' : 'ионная')
    title = [/^типа /.test(type) ? `Решётка ${type}` : `Решётка: ${type}`, `Lattice: ${latticeLabelT(type, 1)}`, `Panjara: ${latticeLabelT(type, 2)}`]
    if (L?.coord) lines.push([`КЧ: ${L.coord}`, `CN: ${latticeLabelT(L.coord, 1)}`, `KS: ${latticeLabelT(L.coord, 2)}`])
    const par = (['a', 'b', 'c'] as const).filter((q) => L?.[q]).map((q) => `${q} = ${L![q]}`).join(', ')
    if (par) lines.push([`${par} пм`, `${par} pm`, `${par} pm`])
  }
  if (info.note) lines.push(info.note)
  return { t0: fin.t0 + 0.8, t1: story.total, title: title[0], lines: lines.map((l) => l[0]), tone: 'check', titleT: title, linesT: lines }
}
