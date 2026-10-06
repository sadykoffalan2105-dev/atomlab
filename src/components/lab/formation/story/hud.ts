import type { FormationStory, StoryHud } from '../formationStory'

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
